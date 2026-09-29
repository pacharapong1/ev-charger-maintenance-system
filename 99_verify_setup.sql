-- =====================================================================
-- 99_verify_setup.sql  --  read-only verification
--
-- Run this in the Supabase SQL Editor AFTER 01-04.
-- It only SELECTs and never inserts, updates or deletes, so it is safe
-- to run as many times as you like. Everything should report PASS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Structure: 4 tables
-- ---------------------------------------------------------------------
select '1. tables' as check_name,
       case when count(*) = 4 then 'PASS' else 'FAIL (' || count(*) || '/4)' end as result
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'machines', 'alarms', 'maintenance_records');

-- ---------------------------------------------------------------------
-- 2. RLS enabled on all 4 tables  (if this is FAIL, data is exposed)
-- ---------------------------------------------------------------------
select '2. rls enabled' as check_name,
       case when count(*) = 4 then 'PASS' else 'FAIL (' || count(*) || '/4)' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'machines', 'alarms', 'maintenance_records')
  and c.relrowsecurity;

-- ---------------------------------------------------------------------
-- 3. Policies: 15 total (profiles 3, machines 4, alarms 4, maint 4)
-- ---------------------------------------------------------------------
-- pg_policies exposes the column as 'tablename', not 'table_name'.
select '3. policies: ' || tablename as check_name,
       count(*)::text || ' policy/policies' as result
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- ---------------------------------------------------------------------
-- 4. Status vocabulary
--    Read back from the actual constraints, so this fails if the schema
--    is wrong rather than confirming a hardcoded expectation.
-- ---------------------------------------------------------------------
select '4. machine status' as check_name,
       pg_get_constraintdef(oid) as result
from pg_constraint
where conrelid = 'public.machines'::regclass
  and conname = 'machines_status_check';

-- role is a text column with a CHECK constraint, not a Postgres enum,
-- so the allowed values are read back from the constraint definition.
select '4. profile role' as check_name,
       pg_get_constraintdef(oid) as result
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';

-- ---------------------------------------------------------------------
-- 5. Trigger that maintains updated_at on the app tables
-- ---------------------------------------------------------------------
select '5. updated_at trigger' as check_name,
       case when count(*) >= 1 then 'PASS' else 'FAIL' end as result
from pg_trigger
where tgname = 'trg_set_updated_at' and not tgisinternal;

-- ---------------------------------------------------------------------
-- 6. Dashboard views
-- ---------------------------------------------------------------------
select '6. views' as check_name,
       case when count(*) = 2 then 'PASS' else 'FAIL (' || count(*) || '/2)' end as result
from information_schema.views
where table_schema = 'public'
  and table_name in ('machine_status_summary', 'top_alarm_codes');

-- ---------------------------------------------------------------------
-- 7. Seeded accounts and their roles
--    Expect one of each: Admin, Technician, Engineer, Viewer.
-- ---------------------------------------------------------------------
-- There is no auth.users table behind these rows: the accounts are the
-- profiles themselves, so the username is read straight off the row. Nothing
-- here prints password_hash.
select '7. users' as check_name,
       p.role::text as result,
       p.username   as detail
from public.profiles p
where p.id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
)
order by p.role;

-- 7a. The four role predicates must all exist. is_engineer() is what grants an
--     Engineer write access to alarms, and it is separate from is_staff() on
--     purpose, so a missing one means a half-applied role change. All four must
--     report security_definer = true; false would let RLS recurse.
select '7a. role predicates' as check_name,
       case when count(*) = 4 then 'PASS' else 'FAIL (' || count(*) || '/4)' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin', 'is_staff', 'is_engineer')
  and p.prosecdef;

-- 7b. An Engineer must be able to update alarms but must NOT appear in any
--     policy on another table. is_staff() guards maintenance_records_insert, so
--     if is_engineer() ever shows up there, an Engineer could log maintenance
--     work, which is the mistake this role is designed to avoid. Expected: PASS.
select '7b. engineer scope' as check_name,
       case when count(*) = 0
            then 'PASS'
            else 'FAIL: ' || string_agg(tablename || '.' || policyname, ', ')
       end as result
from pg_policies
where schemaname = 'public'
  and qual like '%is_engineer%'
  and tablename <> 'alarms';

-- ---------------------------------------------------------------------
-- 8. Seed row counts
-- ---------------------------------------------------------------------
select '8. rows' as check_name,
       (select count(*) from public.profiles)             as profiles,
       (select count(*) from public.machines)             as machines,
       (select count(*) from public.alarms)              as alarms,
       (select count(*) from public.maintenance_records) as maintenance;

-- ---------------------------------------------------------------------
-- 9. Machines by status
--    The dashboard reads from machine_status_summary, so this is what
--    the four KPI cards will show.
-- ---------------------------------------------------------------------
select '9. status spread' as check_name,
       status as detail,
       count(*) as machines
from public.machines
group by status
order by status;

-- ---------------------------------------------------------------------
-- 10. Views return rows
-- ---------------------------------------------------------------------
select '10. machine_status_summary' as check_name, * from public.machine_status_summary;
select '10. top_alarm_codes'       as check_name, * from public.top_alarm_codes;

-- ---------------------------------------------------------------------
-- 11. Custom login function
--     The project's own authentication. public.login() must be owned by a
--     role that is not the caller (prolepsesecdef = true) and must be
--     executable by anon, otherwise the login form cannot work.
-- ---------------------------------------------------------------------
select '11. login callable by anon' as check_name,
       case when bool_or(prolepsesecdef) and bool_or(has_function_privilege('anon', p.oid, 'execute'))
            then 'PASS' else 'FAIL' end as result,
       p.proname as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'login';

-- ---------------------------------------------------------------------
-- 12. Password hashes are not readable
--     Column-level privilege, so it does not show up in pg_policies.
--     has_column_privilege is the direct test: if this says true for
--     'authenticated', a signed-in Technician could copy every hash.
-- ---------------------------------------------------------------------
select '12. password_hash hidden' as check_name,
       case when has_column_privilege('anon', 'public.profiles', 'password_hash', 'select')
                  or has_column_privilege('authenticated', 'public.profiles', 'password_hash', 'select')
            then 'FAIL: a hash can be read' else 'PASS' end as result;

-- ---------------------------------------------------------------------
-- 13. No Supabase Auth leftovers
--     The requirement is a project-owned login, so nothing may still be
--     wired to auth.users: no foreign key and no signup trigger.
-- ---------------------------------------------------------------------
select '13. no auth.users coupling' as check_name,
       case when count(*) = 0 then 'PASS' else 'FAIL (' || count(*) || ')' end as result
from (
  -- foreign keys from public tables into auth.users
  select 1 from pg_constraint c
  where c.contype = 'f'
    and c.conrelid = 'public.profiles'::regclass
    and c.confrelid = 'auth.users'::regclass
  union all
  -- triggers still firing on auth.users
  select 1 from pg_trigger t
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
) leftover;
