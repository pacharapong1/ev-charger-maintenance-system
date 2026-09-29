-- =============================================================================
-- 04_dashboard_views.sql
-- Aggregation views for the /dashboard KPI cards and charts.
--
-- Run this AFTER 02_rls.sql. Safe to re-run: uses CREATE OR REPLACE.
--
-- WHY A VIEW INSTEAD OF COUNTING IN THE BROWSER
-- ---------------------------------------------
-- The KPI cards and the donut chart need GROUP BY aggregation, and the Top 5
-- alarm codes need a ranked LIMIT. Doing that from the client would mean
-- pulling every alarm row over the wire just to count it in JavaScript. A view
-- lets Postgres aggregate and ship back 4 rows instead of N.
--
-- WHY security_invoker = true
-- ----------------------------
-- Without this clause a view runs with the privileges of the view OWNER
-- (postgres), which BYPASSES the RLS policies on the underlying tables. That
-- would silently expose aggregate counts to roles that cannot read the rows.
-- With security_invoker the view runs as the querying user, so the RLS
-- policies in 02_rls.sql apply exactly as they do to a direct SELECT.
--
-- Requires PostgreSQL 15 or later (Supabase runs 15+). If your project is on
-- an older version, remove the WITH clause and rely on the GRANTs below plus a
-- dedicated read-only reporting role instead.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- machine_status_summary: one row per machine status, for the donut chart and
-- the status breakdown cards.
--
-- Only statuses that actually exist are returned. A status with zero stations
-- produces no row, so the chart component fills the gap with 0 rather than
-- dropping the slice entirely.
-- -----------------------------------------------------------------------------
create or replace view public.machine_status_summary
with (security_invoker = true) as
select
  status,
  count(*)::int as station_count
from public.machines
group by status;

comment on view public.machine_status_summary is
  'จำนวนตู้ชาร์จแยกตามสถานะ (RLS-aware) สำหรับ Donut chart และ KPI cards';

-- -----------------------------------------------------------------------------
-- top_alarm_codes: the 5 most frequent alarm codes, for the bar chart.
--
-- Ties are broken by alarm_code so the ordering is stable across requests. A
-- stable order matters because a chart that reshuffles equal values on every
-- refresh looks broken to the user even though the data is identical.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Grants.
--
-- RLS is the real gate, but Postgres still requires a table-level GRANT before
-- a role can read a view at all. anon is deliberately excluded: these are
-- operational counts, so an unauthenticated visitor should not read them.
-- -----------------------------------------------------------------------------
grant select on public.machine_status_summary to authenticated;
grant select on public.top_alarm_codes to authenticated;

revoke all on public.machine_status_summary from anon;
revoke all on public.top_alarm_codes from anon;

-- =============================================================================
-- VERIFICATION (run after this file, expect 1 and 2 rows for the seeded data)
--
--   select * from public.machine_status_summary order by status;
--   select * from public.top_alarm_codes;
--
-- Confirm the technician_id anons are not used: sign in as each test role in
-- the Supabase dashboard SQL editor and re-run the first query. The counts must
-- match a direct `select count(*) from machines` for that same role.
-- =============================================================================
