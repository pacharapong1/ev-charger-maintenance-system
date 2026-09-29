-- =============================================================================
-- 06_machine_status_migration.sql
--
-- Renames the machine status vocabulary to the four values named in the course
-- specification (section 3.2): Running, Stop, Alarm, Maintenance.
--
-- Run this ONLY if you already created the database with the earlier
-- 01_schema.sql that used Available / Charging / Fault / Under Service.
-- A brand new install does not need it: 01_schema.sql now creates the new
-- vocabulary directly.
--
-- The mapping is one to one and lossless, so no row is lost and no row keeps a
-- value outside the new constraint:
--   Charging      -> Running      (the station is doing its job)
--   Available     -> Stop         (idle, ready for the next car)
--   Fault         -> Alarm        (an alarm is raised against the station)
--   Under Service -> Maintenance  (a technician is working on it)
-- =============================================================================

begin;

-- The existing check constraint blocks the new values, so it has to go before
-- the update and comes back after.
alter table public.machines
  drop constraint if exists machines_status_check;

update public.machines set status = 'Running'     where status = 'Charging';
update public.machines set status = 'Stop'        where status = 'Available';
update public.machines set status = 'Alarm'       where status = 'Fault';
update public.machines set status = 'Maintenance' where status = 'Under Service';

alter table public.machines
  add constraint machines_status_check
    check (status in ('Running', 'Stop', 'Alarm', 'Maintenance'));

-- Fail loudly rather than silently leaving a row the application cannot render.
do $$
begin
  if exists (select 1 from public.machines where status not in ('Running', 'Stop', 'Alarm', 'Maintenance')) then
    raise exception 'ยังมีเครื่องที่สถานะไม่ถูกต้องหลัง migration กรุณาตรวจสอบข้อมูล';
  end if;
end
$$;

commit;

-- ------------------------------------------------------------------ verify --
-- Expected: Running 2, Stop 2, Alarm 1, Maintenance 1 from the seed data.
select status, count(*) from public.machines group by status order by status;
