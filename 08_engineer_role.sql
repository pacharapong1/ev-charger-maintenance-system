-- =============================================================================
-- EV-ChargeOps : 08_engineer_role.sql
-- Adds the fourth role, Engineer, to a database created before it existed.
--
-- Run AFTER : 07_custom_auth.sql
-- Run for   : a database that already has 01-07 applied
-- Safe for  : a database created from the current 01_schema.sql. Every statement
--             is idempotent, so running it there is a no-op rather than an error.
-- =============================================================================
--
-- What the fourth role is for
-- ---------------------------
-- The three original roles are Admin (everything), Technician (works the queue
-- and logs the repair) and Viewer (reads only). Engineer sits between Technician
-- and Admin: an Engineer investigates WHY a charger faulted rather than doing
-- the swap-out, and writes the answer onto the alarm.
--
--   can                              Admin  Technician  Engineer  Viewer
--   read the fleet and its history      yes       yes       yes      yes
--   create / edit / delete machines     yes        no        no       no
--   open or delete an alarm             yes        no        no       no
--   move an alarm between states        yes       yes        no       no
--   record cause and description        yes        no       yes       no
--   run the AI diagnosis                yes       yes       yes       no
--   log maintenance work                yes       yes        no       no
--   change someone's role               yes        no        no       no
--
-- The design decision that matters: Engineer is NOT part of is_staff().
--
-- is_staff() is what guards maintenance_records_insert. Widening it to include
-- Engineer would quietly hand them the ability to log maintenance work, which is
-- the one thing this role is meant not to do. So Engineer gets its own predicate,
-- is_engineer(), and only the alarms_update policy reads it. Every other policy
-- is untouched, which is why the diff below is so small.
--
-- What this file does NOT do
-- --------------------------
-- It does not create any Engineer account. Accounts are data, and data belongs in
-- 03a_users.sql; run that afterwards to get the demo engineer account. It also
-- does not touch the application layer: lib/permissions.ts is the other half of
-- the same matrix and is updated in the same change.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ALLOW THE VALUE
-- -----------------------------------------------------------------------------
-- The CHECK constraint is what stops an unknown role from ever being written, so
-- it has to be replaced rather than altered. drop first because ALTER ... DROP /
-- ADD CONSTRAINT has no "if exists", and dropping before adding is safe: the
-- re-add below happens in the same transaction as the first statement below, and
-- this file is run one statement at a time from the SQL editor, so the only window
-- where the constraint is absent is between two consecutive runs of this file.
--
-- No UPDATE runs in this file, so no existing row can be rejected by the wider
-- constraint: the three original values remain members of the new list.
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('Admin', 'Technician', 'Engineer', 'Viewer'));


-- -----------------------------------------------------------------------------
-- 2. THE ENGINEER PREDICATE
-- -----------------------------------------------------------------------------
-- Same shape as is_admin() and is_staff(): SECURITY DEFINER so it can read
-- profiles without recursing through the profiles_select policy, and stable so
-- Postgres may evaluate it once per statement.
create or replace function public.is_engineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'Engineer', false);
$$;

revoke all on function public.is_engineer() from public;
grant execute on function public.is_engineer() to authenticated;


-- -----------------------------------------------------------------------------
-- 3. THE ONE POLICY THAT CHANGES
-- -----------------------------------------------------------------------------
-- alarms_update is what lets a role write to a fault record at all. Technician
-- needs it to move an alarm through its states; Engineer needs it to record a
-- diagnosis. Everyone else is still read-only on alarms.
--
-- The policy is dropped and recreated because CREATE POLICY has no OR REPLACE.
-- Both is_staff() and is_engineer() are OR'd, so Technician behaviour is exactly
-- what it was before.
--
-- The known limitation is unchanged by this: RLS filters rows, not columns, so an
-- Engineer with a hand-written request could also change an alarm's status. The
-- application layer is what keeps that button out of reach. Recorded in README
-- section 8.4.
drop policy if exists alarms_update on public.alarms;

create policy alarms_update on public.alarms
  for update to authenticated
  using (public.is_staff() or public.is_engineer())
  with check (public.is_staff() or public.is_engineer());


-- -----------------------------------------------------------------------------
-- 4. VERIFY
-- -----------------------------------------------------------------------------
-- All four statements below are read-only. Everything should report what is
-- written in the comment above it.

-- 4a. The constraint must now list four roles.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';

-- 4b. The predicate must exist, be security definer, and be callable by
--     authenticated. 'f' in the third column would mean RLS could recurse.
select proname,
       prosecdef as security_definer,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_may_call
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_engineer';

-- 4c. Only alarms_update should differ from the previous version. Every other
--     policy on alarms and maintenance_records must be unchanged, which is the
--     check that Engineer did not inherit staff rights by accident.
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('alarms', 'maintenance_records', 'machines')
  and policyname in ('alarms_update', 'maintenance_records_insert', 'machines_update')
order by tablename, policyname;

-- 4d. A maintenance_records_insert that mentions is_engineer means an Engineer
--     could log maintenance work, which is the mistake this design avoids.
--     'PASS' is the expected result.
select 'engineer cannot log maintenance' as check_name,
       case when count(*) = 0
            then 'PASS'
            else 'FAIL: is_engineer appears in ' || string_agg(policyname, ', ')
       end as result
from pg_policies
where schemaname = 'public'
  and qual like '%is_engineer%'
  and tablename <> 'alarms';

-- After this, run 03a_users.sql to get the demo accounts, including eng1.
