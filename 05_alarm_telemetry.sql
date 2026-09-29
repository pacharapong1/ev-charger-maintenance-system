-- =============================================================================
-- 05_alarm_telemetry.sql
--
-- Adds peak telemetry to public.alarms for the AI analyzer.
--
-- Run this on a database that was created from 01_schema.sql before the columns
-- existed. A fresh install does not need it: 01_schema.sql already declares the
-- columns, and "add column if not exists" makes re-running either file safe.
--
-- Every statement is idempotent, so it is fine to run more than once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------
-- Nullable on purpose: existing alarms have no telemetry, and a station may not
-- report every channel. A blank reading means "unknown", which the analyzer
-- reports as such rather than guessing.
alter table public.alarms
  add column if not exists voltage_peak numeric(7, 2);

alter table public.alarms
  add column if not exists temperature_peak numeric(7, 2);

alter table public.alarms
  add column if not exists current_peak numeric(7, 2);

-- -----------------------------------------------------------------------------
-- 2. Range guards
-- -----------------------------------------------------------------------------
-- Same bounds as 01_schema.sql. 1500 V covers a 1000 V DC bus with headroom and
-- 250 C is past the point where a power module is already damaged, so anything
-- outside these ranges is a mis-scaled reading rather than a real measurement.
-- Added separately because a constraint cannot be added IF NOT EXISTS, and a
-- duplicate name would abort the script on a fresh database.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'alarms_voltage_peak_check'
  ) then
    alter table public.alarms
      add constraint alarms_voltage_peak_check
      check (voltage_peak is null or (voltage_peak >= 0 and voltage_peak <= 1500));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'alarms_temperature_peak_check'
  ) then
    alter table public.alarms
      add constraint alarms_temperature_peak_check
      check (temperature_peak is null or (temperature_peak >= -50 and temperature_peak <= 250));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'alarms_current_peak_check'
  ) then
    alter table public.alarms
      add constraint alarms_current_peak_check
      check (current_peak is null or (current_peak >= 0 and current_peak <= 1000));
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Comments
-- -----------------------------------------------------------------------------
comment on column public.alarms.voltage_peak is
  'Peak voltage (V) recorded when the alarm fired; null when not reported';
comment on column public.alarms.temperature_peak is
  'Peak temperature (C) recorded when the alarm fired; null when not reported';
comment on column public.alarms.current_peak is
  'Peak current (A) recorded when the alarm fired; null when not reported';

-- =============================================================================
-- Note on RLS
-- =============================================================================
-- No policy change is required. The new columns live on a table that already has
-- policies, and column level access is not expressible in RLS. The permission
-- split that matters is unchanged:
--
--   * alarms_insert / machines_*  -> admin only
--   * alarms_update               -> staff, because a Technician advances status
--   * alarms_delete               -> admin only
--
-- A Technician can therefore still write these columns through the status
-- control, which is the pre-existing application layer gap described in the
-- README. This migration does not widen it.
-- =============================================================================
