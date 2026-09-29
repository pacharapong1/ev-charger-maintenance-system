-- =============================================================================
-- EV-ChargeOps : EV Charging Fleet Alarm & Maintenance Management System
-- Target       : Supabase (PostgreSQL 15+)
-- Install order : 1) 01_schema.sql  2) 02_rls.sql  3) 03_seed.sql
-- =============================================================================

-- Run each file separately in Supabase Dashboard > SQL Editor > New query

-- =============================================================================
-- 01. EXTENSIONS
-- =============================================================================
create extension if not exists pgcrypto with schema extensions;

-- =============================================================================
-- 02. TRIGGER HELPER
-- =============================================================================

-- Auto-update updated_at on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 03. TABLES
-- =============================================================================

-- profiles is also the user table: the project authenticates on its own instead
-- of using Supabase Auth, so credentials live here. There is deliberately no
-- foreign key to auth.users, because nothing in this project writes to the
-- auth schema any more.
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  username    text not null,
  full_name   text,
  role        text not null default 'Viewer',
  -- bcrypt hash produced by pgcrypto (crypt + gen_salt('bf')), never a plain
  -- password. 02_rls.sql revokes SELECT on this column, because a readable hash
  -- is a copyable credential.
  password_hash text not null,
  created_at  timestamptz not null default now(),
  constraint profiles_role_check
    check (role in ('Admin', 'Technician', 'Engineer', 'Viewer')),
  constraint profiles_username_key unique (username),
  -- Letters, digits, dot, underscore, dash. 3-40 characters, starting with a
  -- letter or digit, so a username can never be blank, whitespace or a leading
  -- dash that looks like a system account.
  constraint profiles_username_format_check
    check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$')
);

create table if not exists public.machines (
  id          uuid primary key default gen_random_uuid(),
  machine_id  text not null,
  name        text not null,
  type        text not null,
  location    text,
  status      text not null default 'Stop',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint machines_machine_id_key unique (machine_id),
  -- The four statuses named in the course specification (section 3.2).
  constraint machines_status_check
    check (status in ('Running', 'Stop', 'Alarm', 'Maintenance'))
);

create table if not exists public.alarms (
  id          uuid primary key default gen_random_uuid(),
  machine_id  uuid not null,
  alarm_code  text not null,
  description text not null,
  cause       text,
  status      text not null default 'Open',
  -- Peak telemetry captured when the alarm fired, for the AI analyzer. All three
  -- are nullable because older rows predate the columns and because a station
  -- may not report every channel. The analyzer treats a missing reading as
  -- unknown rather than as zero, so leaving one blank is safe.
  voltage_peak     numeric(7, 2),
  temperature_peak numeric(6, 2),
  current_peak     numeric(7, 2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint alarms_status_check
    check (status in ('Open', 'In Progress', 'Closed')),
  -- Generous bounds that still catch a misplaced decimal point or a sensor
  -- reporting millivolts. 1500 V covers a 1000 V DC bus plus headroom;
  -- 250 C is past the point where a power module is already damaged.
  constraint alarms_voltage_peak_check
    check (voltage_peak is null or (voltage_peak >= 0 and voltage_peak <= 1500)),
  constraint alarms_temperature_peak_check
    check (temperature_peak is null or (temperature_peak >= -50 and temperature_peak <= 250)),
  constraint alarms_current_peak_check
    check (current_peak is null or (current_peak >= 0 and current_peak <= 1000)),
  constraint alarms_machine_id_fkey
    foreign key (machine_id) references public.machines (id) on delete cascade,
  -- supports the composite FK below, keeping maintenance_records consistent
  constraint alarms_id_machine_id_key unique (id, machine_id)
);

create table if not exists public.maintenance_records (
  id            uuid primary key default gen_random_uuid(),
  alarm_id      uuid,
  machine_id    uuid not null,
  technician_id uuid references public.profiles (id) on delete set null,
  action_taken  text not null,
  status        text not null default 'In Progress',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint maintenance_records_status_check
    check (status in ('In Progress', 'Completed', 'Waiting Part')),
  -- composite FK: NULL alarm_id skips the check (MATCH SIMPLE), so a log may
  -- exist for a machine without an alarm, but never against a mismatched one
  constraint maintenance_records_alarm_fkey
    foreign key (alarm_id, machine_id)
    references public.alarms (id, machine_id) on delete restrict,
  constraint maintenance_records_machine_id_fkey
    foreign key (machine_id) references public.machines (id) on delete cascade
);

-- =============================================================================
-- 04. AUTHENTICATION + ROLE HELPERS
-- =============================================================================
-- Authentication is implemented by this project, not by Supabase Auth. The
-- pieces are:
--
--   1. credentials in public.profiles (username + bcrypt password_hash)
--   2. public.login(), the only function the anonymous role may execute, which
--      compares the submitted password against the stored hash
--   3. a session token minted by lib/session.ts after login, signed with the
--      project's JWT secret so that PostgREST accepts it and auth.uid()
--      resolves to the signed-in user
--
-- No row is ever created automatically: an account exists because an Admin
-- inserted it, which is why there is no handle_new_user() trigger here.

-- Verifies a username/password pair and returns the identity on success.
--
-- SECURITY DEFINER is required, not decorative: the caller is anonymous and
-- therefore has no SELECT privilege on public.profiles (02_rls.sql revokes it).
-- The function runs as its owner, which is the same technique current_role()
-- uses to read profiles without recursing through RLS.
--
-- Returning null for a wrong password and for an unknown username are the same
-- answer on purpose, so the response cannot be used to enumerate accounts. The
-- throwaway hash at the end makes the two cases also cost the same time.
create or replace function public.login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.profiles;
begin
  select prof.* into v_match
  from public.profiles prof
  where prof.username = p_username
    and prof.password_hash = extensions.crypt(p_password, prof.password_hash);

  if found then
    return jsonb_build_object(
      'id',         v_match.id,
      'username',   v_match.username,
      'full_name',  v_match.full_name,
      'role',       v_match.role
    );
  end if;

  -- Same work, discarded. bcrypt is deliberately slow, so without this an
  -- unknown username would answer noticeably faster than a wrong password and
  -- leak which usernames exist.
  perform extensions.crypt(p_password, extensions.crypt('x', extensions.gen_salt('bf')));
  return null;
end;
$$;

revoke all on function public.login(text, text) from public;

-- Resolve the role of the caller without triggering RLS recursion on profiles.
-- auth.uid() returns the `sub` claim of the session token minted by
-- lib/session.ts, so this works the same whether the token came from this
-- project's login form or from any other client that can sign one.
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'Admin', false);
$$;

-- Admin + Technician are "staff": read/write on operational tables.
--
-- Engineer is deliberately NOT staff. A Technician logs the work they carried
-- out, which is what maintenance_records_insert is for; an Engineer investigates
-- why the fault happened and records the diagnosis on the alarm itself. Keeping
-- Engineer out of is_staff() is what stops them creating maintenance entries, and
-- is_engineer() below is what lets them write to alarms.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('Admin', 'Technician'), false);
$$;

-- An Engineer records root-cause analysis on an alarm: the cause field and the
-- description, plus the AI diagnosis. That is update access to alarms without
-- permission to delete them, edit the fleet inventory, log maintenance work or
-- change anyone's role.
create or replace function public.is_engineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'Engineer', false);
$$;

-- =============================================================================
-- 05. TRIGGERS (updated_at)
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['machines', 'alarms', 'maintenance_records'] loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- =============================================================================
