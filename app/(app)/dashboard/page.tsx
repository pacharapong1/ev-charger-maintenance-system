import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CircleCheckBig,
  Clock,
  Info,
  PlugZap,
  Siren,
  Wrench,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import type { MachineStatus } from '@/lib/supabase/types';
import { buildStatusRows, formatCount, MACHINE_STATUS_COLOR, percentOf } from '@/lib/dashboard';
import KpiCard from '@/components/dashboard/KpiCard';
import StatusBreakdown from '@/components/dashboard/StatusBreakdown';
import { LazyStatusDonutChart, LazyTopAlarmsBarChart } from '@/components/dashboard/lazy-charts';
import RecentAlarmsTable from '@/components/dashboard/RecentAlarmsTable';

export const metadata: Metadata = { title: 'ภาพรวม' };

export default async function DashboardPage() {
  const { role } = await requireUser();
  const supabase = createClient();

  // Every count is independent, so they all run in parallel instead of in
  // sequence. head: true makes Postgres return the count without sending rows.
  // The two views aggregate inside the database, which keeps the chart queries
  // from transferring a whole table just to count it in JavaScript.
  const [
    totalStations,
    statusSummary,
    totalAlarms,
    openAlarms,
    inProgressAlarms,
    totalMaintenance,
    waitingPart,
    pendingMaintenance,
    topAlarmCodes,
    recentAlarms,
  ] = await Promise.all([
    supabase.from('machines').select('*', { count: 'exact', head: true }),
    supabase.from('machine_status_summary').select('status, station_count'),
    supabase.from('alarms').select('*', { count: 'exact', head: true }),
    supabase.from('alarms').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
    supabase
      .from('alarms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'In Progress'),
    supabase.from('maintenance_records').select('*', { count: 'exact', head: true }),
    supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Waiting Part'),
    supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Completed'),
    supabase.from('top_alarm_codes').select('alarm_code, occurrences'),
    supabase
      .from('alarms')
      .select('id, alarm_code, description, status, created_at, machines(machine_id, name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // The view only returns statuses that have at least one station. Collect them
  // into a sparse map and let buildStatusRows fill the missing ones with zero so
  // the chart and legend keep all four statuses.
  const counts = {} as Partial<Record<MachineStatus, number>>;
  for (const row of statusSummary.data ?? []) {
    counts[row.status] = row.station_count;
  }
  const statusRows = buildStatusRows(counts);

  const total = totalStations.count ?? 0;
  // Spec 3.6 requires the four statuses to be countable on the dashboard, so
  // each one is pulled out of the summary explicitly rather than only being
  // drawn in the donut chart.
  const running = statusRows.find((row) => row.status === 'Running')?.count ?? 0;
  const stopped = statusRows.find((row) => row.status === 'Stop')?.count ?? 0;
  const alarmMachines = statusRows.find((row) => row.status === 'Alarm')?.count ?? 0;
  const maintenanceMachines = statusRows.find((row) => row.status === 'Maintenance')?.count ?? 0;

  const activeAlarms = (openAlarms.count ?? 0) + (inProgressAlarms.count ?? 0);
  const closedAlarms = (totalAlarms.count ?? 0) - activeAlarms;

  const maintenanceTotal = totalMaintenance.count ?? 0;
  const pending = pendingMaintenance.count ?? 0;
  const completed = maintenanceTotal - pending;

  const roleNotice = {
    Admin: null,
    Technician:
      'บัญชีของคุณเป็นช่างซ่อมบำรุง จึงอัปเดตสถานะ Alarm และบันทึกงานซ่อมบำรุงได้ แต่จะไม่เห็นปุ่มจัดการเครื่องจักร',
    Engineer:
      'บัญชีของคุณเป็นวิศวกร จึงบันทึกสาเหตุและรายละเอียดลงใน Alarm ได้ แต่จะไม่เห็นปุ่มจัดการเครื่องจักรและปุ่มเปลี่ยนสถานะ',
    Viewer: 'บัญชีของคุณเป็นผู้ดูข้อมูล จึงดูข้อมูลได้อย่างเดียว ปุ่มแก้ไขจะไม่แสดง',
  }[role];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">
            ภาพรวมระบบ
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            สถานะตู้ชาร์จไฟฟ้า Alarms และงานซ่อมบำรุง
          </p>
        </div>

        <p className="inline-flex items-center gap-1.5 text-xs text-ink-subtle dark:text-slate-500">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            ข้อมูล ณ{' '}
            {new Date().toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Bangkok',
            })}
          </span>
        </p>
      </div>

      {roleNotice ? (
        <p className="alert-info flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{roleNotice}</span>
        </p>
      ) : null}

      {/* Headline KPIs. Each is the number an operator acts on first, and links
          to the page where that number can actually be acted on. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="ตู้ชาร์จทั้งหมด"
          value={total}
          icon={PlugZap}
          tone="brand"
          hint={`กำลังทำงาน ${formatCount(running)} · หยุด ${formatCount(stopped)} · เตือน ${formatCount(alarmMachines)} · ซ่อม ${formatCount(maintenanceMachines)}`}
          href="/machines"
          accent={MACHINE_STATUS_COLOR.Running}
        />
        <KpiCard
          label="Active Alarms"
          value={activeAlarms}
          icon={Siren}
          tone={activeAlarms > 0 ? 'red' : 'emerald'}
          hint={`เปิด ${formatCount(openAlarms.count ?? 0)} · กำลังทำ ${formatCount(inProgressAlarms.count ?? 0)} · ปิดแล้ว ${formatCount(closedAlarms)} · รวม ${formatCount(totalAlarms.count ?? 0)} รายการ`}
          href="/alarms"
          accent={MACHINE_STATUS_COLOR.Alarm}
        />
        <KpiCard
          label="งานซ่อมบำรุงที่ค้างอยู่"
          value={pending}
          icon={Wrench}
          tone={pending > 0 ? 'amber' : 'emerald'}
          hint={`เสร็จแล้ว ${formatCount(completed)} จาก ${formatCount(maintenanceTotal)} รายการ · รออะไหล่ ${formatCount(waitingPart.count ?? 0)}`}
          href="/maintenance"
          accent={MACHINE_STATUS_COLOR.Maintenance}
        />
        <KpiCard
          label="เครื่องที่มีความผิดปกติ"
          value={alarmMachines}
          icon={AlertTriangle}
          tone={alarmMachines > 0 ? 'red' : 'emerald'}
          hint={`อยู่ระหว่างซ่อมอีก ${formatCount(maintenanceMachines)} ตู้`}
          href="/machines"
          accent={MACHINE_STATUS_COLOR.Alarm}
        />
      </div>

      {/* Spec 3.6 asks for the count of each of the four statuses, so they are
          also shown as their own cards rather than only inside the chart. */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-muted dark:text-slate-400">
          จำนวนเครื่องจักรแยกตามสถานะ
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusRows.map((row) => (
            <KpiCard
              key={row.status}
              label={row.label}
              value={row.count}
              icon={row.status === 'Alarm' ? AlertTriangle : row.status === 'Maintenance' ? Wrench : Activity}
              tone={
                row.status === 'Alarm'
                  ? 'red'
                  : row.status === 'Maintenance'
                    ? 'amber'
                    : 'brand'
              }
              hint={`${percentOf(row.count, total)}% ของเครื่องจักรทั้งหมด`}
              href={`/machines?status=${encodeURIComponent(row.status)}`}
              accent={row.color}
            />
          ))}
        </div>
      </section>

      <StatusBreakdown rows={statusRows} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <header className="card-header">
            <h2 className="card-title">สัดส่วนสถานะตู้ชาร์จ</h2>
            <Activity className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
          </header>
          <div className="p-5">
            <LazyStatusDonutChart rows={statusRows} />
          </div>
        </section>

        <section className="card lg:col-span-3">
          <header className="card-header">
            <h2 className="card-title">Top 5 Alarm Codes ที่พบบ่อยที่สุด</h2>
            <span className="text-xs text-ink-subtle dark:text-slate-500">
              นับจากทั้งหมด {formatCount(totalAlarms.count ?? 0)} รายการ
            </span>
          </header>
          <div className="p-5">
            <LazyTopAlarmsBarChart data={topAlarmCodes.data ?? []} />
          </div>
        </section>
      </div>

      <section className="card">
        <header className="card-header">
          <h2 className="card-title">Alarms ล่าสุด</h2>
          {activeAlarms > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              {formatCount(activeAlarms)} รายการยังค้างอยู่
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CircleCheckBig className="h-3.5 w-3.5" aria-hidden="true" />
              ไม่มี Alarm ค้างอยู่
            </span>
          )}
        </header>

        <RecentAlarmsTable alarms={recentAlarms.data} error={recentAlarms.error?.message ?? null} />
      </section>

      {!can(role, 'manageRoles') ? (
        <p className="text-xs text-ink-subtle dark:text-slate-500">
          หน้า{' '}
          <Link
            href="/dashboard/team"
            className="text-brand-700 hover:underline dark:text-brand-300"
          >
            สมาชิก
          </Link>{' '}
          เปิดให้เฉพาะผู้ดูแลระบบ
        </p>
      ) : null}
    </div>
  );
}
