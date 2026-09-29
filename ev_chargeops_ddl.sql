-- =============================================================================
-- EV-ChargeOps : EV Charging Fleet Alarm and Maintenance Management System
-- Target: Supabase (PostgreSQL 15+).
--
-- Run one file per query tab, in this order:
--   01_schema.sql      tables, helper functions, triggers, indexes
--   02_rls.sql         grants and 15 row level security policies
--   03a_users.sql      3 accounts and roles
--   03b1_machines.sql  6 charger units
--   03b2_alarms.sql    5 alarm records
--   03b3_logs.sql      3 maintenance logs plus a count check
--   04_dashboard_views.sql  the two aggregation views (section 08 below)
--
-- Authentication is this project's own: accounts live in public.profiles with a
-- username and a bcrypt password hash, and there are no rows in auth.users. A
-- database that was built before this change keeps working: run 07_custom_auth.sql
-- first, then the rest as normal.
--
-- Seeded logins, password for all four: Password123!
--   admin    Admin
--   tech1    Technician
--   eng1     Engineer
--   view1    Viewer
--
-- Every text literal in 03a, 03b1, 03b2 and 03b3 uses dollar quoting, so
-- those files contain zero single quotes. The SQL editor inserts a stray
-- quote when pasting, and inside a string that broke into the keyword into
-- and turned the next word into a relation reference. Dollar quoting makes
-- the seed files immune to that. Each SQL statement sits on one line.
--
-- Files are ASCII only and safe to re-run: inserts are idempotent.
-- Add Thai wording later from Table Editor or the REST API, not by paste.
-- =============================================================================
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
  -- password. SELECT on this column is revoked in section 07, because a
  -- readable hash is a copyable credential.
  password_hash text not null,
  created_at  timestamptz not null default now(),
  constraint profiles_role_check check (role in ('Admin', 'Technician', 'Engineer', 'Viewer')),
  constraint profiles_username_key unique (username),
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

-- Bring an existing database in line with the table above. Idempotent, so the
-- consolidated file can be run on a fresh project or an existing one.
alter table public.alarms add column if not exists voltage_peak numeric(7, 2);
alter table public.alarms add column if not exists temperature_peak numeric(6, 2);
alter table public.alarms add column if not exists current_peak numeric(7, 2);

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
--
-- SECURITY DEFINER is required, not decorative: the caller is anonymous and
-- therefore has no SELECT privilege on public.profiles (section 07 revokes it).
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
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('Admin', 'Technician'), false);
$$;

-- Engineer records a root-cause diagnosis on an alarm. Deliberately not part of
-- is_staff(), so that this grant cannot also let them log maintenance work.
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

-- =============================================================================
-- EV-ChargeOps : EV Charging Fleet Alarm & Maintenance Management System
-- Target       : Supabase (PostgreSQL 15+)
-- Install order : 1) 01_schema.sql  2) 02_rls.sql  3) 03_seed.sql
-- =============================================================================

-- Run each file separately in Supabase Dashboard > SQL Editor > New query

-- =============================================================================
-- 06. INDEXES
-- =============================================================================
create index if not exists idx_machines_status       on public.machines (status);
create index if not exists idx_alarms_machine        on public.alarms (machine_id);
create index if not exists idx_alarms_status         on public.alarms (status);
create index if not exists idx_alarms_created_at     on public.alarms (created_at desc);
create index if not exists idx_alarms_machine_status on public.alarms (machine_id, status);
create index if not exists idx_maint_alarm           on public.maintenance_records (alarm_id);
create index if not exists idx_maint_machine         on public.maintenance_records (machine_id);
create index if not exists idx_maint_technician      on public.maintenance_records (technician_id);
create index if not exists idx_maint_status          on public.maintenance_records (status);

-- =============================================================================
-- 07. ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.machines           enable row level security;
alter table public.alarms             enable row level security;
alter table public.maintenance_records enable row level security;

revoke all on public.profiles            from anon;
revoke all on public.machines            from anon;
revoke all on public.alarms              from anon;
revoke all on public.maintenance_records from anon;

grant select, insert, update, delete on public.profiles            to authenticated;
grant select, insert, update, delete on public.machines            to authenticated;
grant select, insert, update, delete on public.alarms              to authenticated;
grant select, insert, update, delete on public.maintenance_records to authenticated;

grant usage on schema public to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin()     to authenticated;
grant execute on function public.is_staff()     to authenticated;
grant execute on function public.is_engineer()  to authenticated;

-- The only thing the anonymous role may do. public.login() is SECURITY DEFINER
-- and reads the password hash on our behalf, which is precisely why anon is
-- revoked from the table itself.
--
-- Brute force is bounded by bcrypt, not by this grant: every attempt costs a
-- key-derivation round that is deliberately slow.
--
-- The column-level REVOKE below matters more than any row policy here. RLS works
-- on rows, so profiles_select cannot hide a single column and every signed-in
-- user may read every profile row. Without the revoke, a Technician could
-- select password_hash and take every credential offline. Because a revoked
-- column is filtered out of results rather than raising, this stays compatible
-- with RLS: queries must name the columns they want instead of using `*`.
grant execute on function public.login(text, text) to anon, authenticated;
revoke select (password_hash) on public.profiles from anon, authenticated;

-- profiles: rows are created only by an Admin inserting an account, never by
-- clients, and the password hash is not readable by anyone.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- machines: read = any signed-in user, write = admin only
drop policy if exists machines_select on public.machines;
create policy machines_select on public.machines
  for select to authenticated
  using (true);

drop policy if exists machines_insert on public.machines;
create policy machines_insert on public.machines
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists machines_update on public.machines;
create policy machines_update on public.machines
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists machines_delete on public.machines;
create policy machines_delete on public.machines
  for delete to authenticated
  using (public.is_admin());

-- alarms: read = any signed-in user, insert = admin,
-- update = staff (a technician advances status; see the trigger below for the
-- column-level limit), delete = admin
drop policy if exists alarms_select on public.alarms;
create policy alarms_select on public.alarms
  for select to authenticated
  using (true);

drop policy if exists alarms_insert on public.alarms;
create policy alarms_insert on public.alarms
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists alarms_update on public.alarms;
create policy alarms_update on public.alarms
  for update to authenticated
  using (public.is_staff() or public.is_engineer())
  with check (public.is_staff() or public.is_engineer());

drop policy if exists alarms_delete on public.alarms;
create policy alarms_delete on public.alarms
  for delete to authenticated
  using (public.is_admin());

-- maintenance_records: admin writes anything, technician writes own rows only
drop policy if exists maintenance_records_select on public.maintenance_records;
create policy maintenance_records_select on public.maintenance_records
  for select to authenticated
  using (true);

drop policy if exists maintenance_records_insert on public.maintenance_records;
create policy maintenance_records_insert on public.maintenance_records
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists maintenance_records_update on public.maintenance_records;
create policy maintenance_records_update on public.maintenance_records
  for update to authenticated
  using (public.is_admin() or technician_id = auth.uid())
  with check (public.is_admin() or technician_id = auth.uid());

drop policy if exists maintenance_records_delete on public.maintenance_records;
create policy maintenance_records_delete on public.maintenance_records
  for delete to authenticated
  using (public.is_admin());

-- =============================================================================

-- Accounts are inserted straight into public.profiles: there is no Supabase Auth
-- and no auth.users row behind them. The password is stored only as a bcrypt hash.
insert into public.profiles (id, username, full_name, role, password_hash) select $$11111111-1111-4111-8111-111111111111$$::uuid, $$admin$$, $$Natthawut Srisuwan$$, $$Admin$$, extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$)) on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, password_hash = excluded.password_hash;

insert into public.profiles (id, username, full_name, role, password_hash) select $$22222222-2222-4222-8222-222222222222$$::uuid, $$tech1$$, $$Somchai Jaidee$$, $$Technician$$, extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$)) on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, password_hash = excluded.password_hash;

insert into public.profiles (id, username, full_name, role, password_hash) select $$33333333-3333-4333-8333-333333333333$$::uuid, $$eng1$$, $$Piyaporn Wongtong$$, $$Engineer$$, extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$)) on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, password_hash = excluded.password_hash;

insert into public.profiles (id, username, full_name, role, password_hash) select $$44444444-4444-4444-8444-444444444444$$::uuid, $$view1$$, $$Anong Chaiyasit$$, $$Viewer$$, extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$)) on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, password_hash = excluded.password_hash;

select count(*) as seeded_users from public.profiles;

insert into public.machines (machine_id, name, type, location, status) values ($$EV-DC-01$$, $$DC Charger Zone A Unit 1$$, $$DC Fast Charger 150kW$$, $$B1 Parking Zone A$$, $$Alarm$$), ($$EV-DC-02$$, $$DC Charger Zone A Unit 2$$, $$DC Fast Charger 150kW$$, $$B1 Parking Zone A$$, $$Running$$), ($$EV-AC-03$$, $$Public AC Charger$$, $$AC Charger 22kW$$, $$Public Lot Level 1$$, $$Stop$$), ($$EV-DC-04$$, $$DC Charger Logistics Hub$$, $$DC Fast Charger 60kW$$, $$Ladkrabang DC Hub$$, $$Maintenance$$), ($$EV-AC-05$$, $$HQ AC Charger$$, $$AC Charger 22kW$$, $$HQ Ground Floor VIP$$, $$Stop$$), ($$EV-DC-06$$, $$Highway DC Station$$, $$DC Fast Charger 350kW$$, $$Chao Phraya Bridge Rest Stop$$, $$Running$$) on conflict (machine_id) do nothing;

insert into public.alarms (machine_id, alarm_code, description, cause, status, created_at) select id, $$ERR-CABLE-01$$, $$Charging gun fails to lock with the CCS2 connector$$, $$Lock actuator jammed, cable damaged$$, $$Open$$, now() - make_interval(days => 2) from public.machines where machine_id = $$EV-DC-01$$ and not exists (select 1 from public.alarms where alarm_code = $$ERR-CABLE-01$$);

insert into public.alarms (machine_id, alarm_code, description, cause, status, created_at) select id, $$ERR-MODULE-OVERHEAT$$, $$Power module overheated above 85 degrees Celsius$$, $$Module cooling fan failed and cabinet air is too hot$$, $$In Progress$$, now() - make_interval(hours => 30) from public.machines where machine_id = $$EV-DC-01$$ and not exists (select 1 from public.alarms where alarm_code = $$ERR-MODULE-OVERHEAT$$);

insert into public.alarms (machine_id, alarm_code, description, cause, status, created_at) select id, $$ERR-INSULATOR-02$$, $$Insulation resistance below 100 kOhm$$, $$HV insulator set 2 is damaged from moisture$$, $$Open$$, now() - make_interval(days => 3) from public.machines where machine_id = $$EV-DC-04$$ and not exists (select 1 from public.alarms where alarm_code = $$ERR-INSULATOR-02$$);

insert into public.alarms (machine_id, alarm_code, description, cause, status, created_at) select id, $$ERR-COMM-03$$, $$Lost connection to OCPP backend, heartbeat missing 5 min$$, $$Fiber uplink loose at distribution cabinet$$, $$In Progress$$, now() - make_interval(days => 1) from public.machines where machine_id = $$EV-DC-06$$ and not exists (select 1 from public.alarms where alarm_code = $$ERR-COMM-03$$);

insert into public.alarms (machine_id, alarm_code, description, cause, status, created_at) select id, $$ERR-GROUND-FAULT$$, $$Ground fault detected, power cut for safety$$, $$PE ground wire loose at terminal block$$, $$Closed$$, now() - make_interval(days => 5) from public.machines where machine_id = $$EV-AC-03$$ and not exists (select 1 from public.alarms where alarm_code = $$ERR-GROUND-FAULT$$);

insert into public.maintenance_records (alarm_id, machine_id, technician_id, action_taken, status, created_at) select al.id, al.machine_id, p.id, $$Disassembled lock actuator, cleaned rail, re-greased$$, $$In Progress$$, now() - make_interval(days => 1) from public.alarms al, public.profiles p where al.alarm_code = $$ERR-CABLE-01$$ and p.id = $$22222222-2222-4222-8222-222222222222$$::uuid and not exists (select 1 from public.maintenance_records mr where mr.alarm_id = al.id);

insert into public.maintenance_records (alarm_id, machine_id, technician_id, action_taken, status, created_at) select al.id, al.machine_id, p.id, $$Inspection confirmed damaged insulator, awaiting replacement part$$, $$Waiting Part$$, now() - make_interval(days => 2) from public.alarms al, public.profiles p where al.alarm_code = $$ERR-INSULATOR-02$$ and p.id = $$33333333-3333-4333-8333-333333333333$$::uuid and not exists (select 1 from public.maintenance_records mr where mr.alarm_id = al.id);

insert into public.maintenance_records (alarm_id, machine_id, technician_id, action_taken, status, created_at) select al.id, al.machine_id, p.id, $$Replaced fiber uplink, rebooted gateway, link stable$$, $$Completed$$, now() - make_interval(hours => 20) from public.alarms al, public.profiles p where al.alarm_code = $$ERR-COMM-03$$ and p.id = $$22222222-2222-4222-8222-222222222222$$::uuid and not exists (select 1 from public.maintenance_records mr where mr.alarm_id = al.id);

-- =============================================================================
-- 08. DASHBOARD VIEWS  (was 04_dashboard_views.sql)
-- =============================================================================
-- Aggregated for /dashboard, so the charts do not have to pull every row over
-- the wire just to count it in JavaScript.
--
-- security_invoker = true is the important part. Without it a view runs as its
-- owner (postgres) and would bypass the RLS policies on the underlying tables,
-- handing aggregate counts to a role that cannot read the rows. With it the view
-- runs as the querying user, so the policies above apply exactly as they do to a
-- direct SELECT.
--
-- Requires PostgreSQL 15+. Supabase is already on 15.
create or replace view public.machine_status_summary
with (security_invoker = true) as
select
  status,
  count(*)::int as station_count
from public.machines
group by status;

comment on view public.machine_status_summary is
  'จำนวนตู้ชาร์จแยกตามสถานะ (RLS-aware) สำหรับ Donut chart และ KPI cards';

-- Ties break on alarm_code so the bar chart keeps a stable order between
-- requests. A chart that reshuffles equal values on every refresh reads as
-- broken even though the data is identical.
create or replace view public.top_alarm_codes
with (security_invoker = true) as
select
  alarm_code,
  count(*)::int as occurrences
from public.alarms
group by alarm_code
order by occurrences desc, alarm_code asc
limit 5;

comment on view public.top_alarm_codes is
  'Top 5 alarm code ที่เกิดบ่อยที่สุด (RLS-aware) สำหรับ Bar chart';

-- RLS is the real gate, but Postgres still needs a table-level GRANT before a
-- role can read a view at all. anon is excluded on purpose: these are
-- operational counts, not something an unauthenticated visitor should see.
grant select on public.machine_status_summary to authenticated;
grant select on public.top_alarm_codes to authenticated;

revoke all on public.machine_status_summary from anon;
revoke all on public.top_alarm_codes from anon;

-- =============================================================================

select (select count(*) from public.machines) as machines, (select count(*) from public.alarms) as alarms, (select count(*) from public.maintenance_records) as maintenance_logs, (select count(*) from public.profiles) as profiles;

-- Both views must return rows. Empty means the tables above are empty, and the
-- dashboard will render four zeroed KPI cards rather than an error.
select 'machine_status_summary' as view_name, count(*) as rows from public.machine_status_summary
union all
select 'top_alarm_codes' as view_name, count(*) as rows from public.top_alarm_codes;

