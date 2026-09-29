-- =============================================================================
-- EV-ChargeOps : 07_custom_auth.sql
-- Target       : Supabase (PostgreSQL 15+)
-- Run AFTER     : 01_schema.sql, 02_rls.sql
-- Needed for    : a database that was created with the earlier version of this
--                 project, where login went through Supabase Auth (auth.users).
--                 A brand new database does not need this file at all: the
--                 current 01_schema.sql already creates the columns, the login
--                 function and the privileges that this migration adds.
-- =============================================================================
--
-- What changes
--   1. profiles gains `username` and `password_hash` and stops referencing
--      auth.users
--   2. public.login() replaces Supabase Auth as the way to sign in
--   3. the on_auth_user_created trigger is removed, because no account is ever
--      created by signing up any more
--   4. every existing session becomes invalid, so everyone logs in again
--
-- Everything here is idempotent, so it is safe to run more than once.

-- =============================================================================
-- 1. BREAK THE LINK TO auth.users
-- =============================================================================
-- The id stays exactly as it is. Existing rows keep the UUID they already had,
-- so maintenance_records.technician_id and every other reference stay valid.
-- Only the automatic deletion from auth.users goes away, which is correct: the
-- application now owns its accounts.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

-- =============================================================================
-- 2. CREDENTIAL COLUMNS
-- =============================================================================
-- Added nullable, backfilled, then tightened. A single statement cannot do
-- that, because the backfill needs the columns to already exist.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists password_hash text;

-- Placeholder usernames: 'user' plus six hex characters derived from the id, so
-- they are deterministic and cannot collide. Rename them to whatever the team
-- prefers afterwards; the final select at the bottom prints the current list.
update public.profiles
set username = 'user' || substr(md5(id::text), 1, 6)
where username is null;

-- Every account is reset to the demo password, because the old ones were hashed
-- by Supabase Auth with its own settings and this project verifies with pgcrypto
-- bcrypt instead. Without this nobody could log in after the migration.
update public.profiles
set password_hash = extensions.crypt('Password123!', extensions.gen_salt('bf'))
where password_hash is null;

alter table public.profiles alter column username      set not null;
alter table public.profiles alter column password_hash set not null;

-- Re-added with if not exists semantics: a database that already has them is
-- left alone. A name collision raises here rather than silently producing two
-- accounts that share a username, which is the constraint doing the real work.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_key' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_username_format_check
      check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$');
  end if;
end;
$$;

-- =============================================================================
-- 3. REPLACE THE SIGN-UP TRIGGER
-- =============================================================================
-- Accounts are no longer created by signing up, so the trigger and its function
-- are dead weight. Dropping them also removes the "first account becomes Admin"
-- rule, which is now the person who runs this SQL.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- =============================================================================
-- 4. THE LOGIN FUNCTION
-- =============================================================================
-- Identical to the one in the current 01_schema.sql. create or replace makes
-- this safe to re-run, and the final revoke strips the default EXECUTE grant
-- that PostgreSQL gives to PUBLIC on new functions.
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

  -- Discarded on purpose: makes an unknown username cost the same time as a
  -- wrong password, so response time cannot be used to enumerate accounts.
  perform extensions.crypt(p_password, extensions.crypt('x', extensions.gen_salt('bf')));
  return null;
end;
$$;

revoke all on function public.login(text, text) from public;

-- =============================================================================
-- 5. PERMISSIONS
-- =============================================================================
-- The same two statements 02_rls.sql now contains, repeated so that this file
-- can be run on its own against an older database.
revoke select (password_hash) on public.profiles from anon, authenticated;
grant execute on function public.login(text, text) to anon, authenticated;

-- =============================================================================
-- 6. VERIFY
-- =============================================================================
-- Sign in with any of these usernames and the password Password123!, then
-- rename them to the account names the team wants to present.
select id, username, full_name, role from public.profiles order by role, username;
