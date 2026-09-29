import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Info, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can, rolesWith } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import {
  escapeLike,
  maintenanceFilterCount,
  rangeEnd,
  rangeStart,
  readMaintenanceFilters,
  readTimezoneOffset,
  type SearchParams,
} from '@/lib/filters';
import type { AlarmOption, MachineOption, TechnicianOption } from '@/lib/options';
import { CreateMaintenanceForm } from '@/components/maintenance/MaintenanceForms';
import MaintenanceFilters from '@/components/maintenance/MaintenanceFilters';
import MaintenanceTable, { type MaintenanceRow } from '@/components/maintenance/MaintenanceTable';
import { MaintenanceCsvButton } from '@/components/csv/ExportCsvButton';

export const metadata: Metadata = { title: 'งานซ่อมบำรุง' };

type Props = { searchParams: SearchParams };

export default async function MaintenancePage({ searchParams }: Props) {
  const { user, role } = await requireUser();
  // A Technician may log work and move their own jobs, but the update policy
  // scopes them to rows where technician_id = auth.uid(). The table hides the
  // editor on other people's rows so they are not offered an action that the
  // database would reject.
  const isAdmin = can(role, 'deleteMaintenance');
  const canLog = can(role, 'manageMaintenance');
  const canDelete = isAdmin;

  const filters = readMaintenanceFilters(searchParams);
  const tz = readTimezoneOffset(searchParams);
  const activeCount = maintenanceFilterCount(filters);

  const supabase = createClient();

  let query = supabase
    .from('maintenance_records')
    .select(
      'id, alarm_id, action_taken, status, created_at, technician_id, machines(machine_id, name), alarms(alarm_code)',
    )
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.machineId) query = query.eq('machine_id', filters.machineId);
  // Technician is one of the filter conditions the specification asks for, so
  // "which jobs is each technician carrying" is a one-click question.
  if (filters.technicianId) query = query.eq('technician_id', filters.technicianId);

  const start = rangeStart(filters.from, tz);
  const end = rangeEnd(filters.to, tz);
  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);

  if (filters.search) {
    const term = `%${escapeLike(filters.search)}%`;
    // action_taken is the text an operator actually searches by. The alarm code
    // lives on the joined table, which PostgREST cannot filter with a top level
    // .or(), so it is searched through the foreign key instead.
    query = query.or(`action_taken.ilike.${term},alarms.alarm_code.ilike.${term}`);
  }

  const [result, machineResult, alarmResult, totalResult, technicianResult] = await Promise.all([
    query,
    supabase.from('machines').select('id, machine_id, name').order('machine_id'),
    supabase
      .from('alarms')
      .select('id, alarm_code, machine_id')
      .order('created_at', { ascending: false }),
    supabase.from('maintenance_records').select('*', { count: 'exact', head: true }),
    // The dropdown lists every profile that can carry a job, not only the ones
    // already on the current page of rows, so filtering by a technician who has
    // no visible job is still possible. The role list is read from the permission
    // matrix rather than written out, so it keeps matching canLog above.
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', rolesWith('manageMaintenance'))
      .order('full_name'),
  ]);

  const machines: MachineOption[] = (machineResult.data ?? []).map((machine) => ({
    id: machine.id,
    machineId: machine.machine_id,
    name: machine.name,
  }));

  const technicians: TechnicianOption[] = (technicianResult.data ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
  }));

  const alarms: AlarmOption[] = (alarmResult.data ?? []).map((alarm) => ({
    id: alarm.id,
    alarmCode: alarm.alarm_code,
    machineUuid: alarm.machine_id,
  }));

  // The table needs the technician's display name, so they are read in one extra
  // query rather than an embed, which would silently drop rows whose profile was
  // removed (technician_id is ON DELETE SET NULL).
  const technicianIds = [
    ...new Set((result.data ?? []).map((row) => row.technician_id).filter(Boolean)),
  ] as string[];

  const { data: profiles } = technicianIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', technicianIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const rows: MaintenanceRow[] = (result.data ?? []).map((row) => ({
    id: row.id,
    machineId: row.machines?.machine_id ?? '-',
    machineName: row.machines?.name ?? '-',
    alarmId: row.alarm_id,
    alarmCode: row.alarms?.alarm_code ?? null,
    technicianId: row.technician_id,
    technicianName: row.technician_id
      ? (nameById.get(row.technician_id) ?? 'ไม่ทราบชื่อ')
      : 'ไม่ระบุผู้ดำเนินการ',
    actionTaken: row.action_taken,
    status: row.status,
    createdAt: row.created_at,
  }));

  const total = totalResult.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">
            งานซ่อมบำรุง
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            {canLog
              ? canDelete
                ? 'คุณเพิ่ม แก้ไข เปลี่ยนสถานะ และลบงานซ่อมบำรุงได้'
                : 'คุณเพิ่ม แก้ไข และเปลี่ยนสถานะได้เฉพาะงานของคุณเอง'
              : 'บัญชีของคุณดูข้อมูลได้อย่างเดียว'}
          </p>
        </div>
        {/* Read access to maintenance_records is open to every signed in role
            (maintenance_records_select is `using (true)`), so the report holds
            exactly the rows this table shows. The export is built from them
            rather than from a second query, which keeps it inside that scope. */}
        {result.error ? null : (
          <MaintenanceCsvButton
            rows={rows}
            total={total}
            isFiltered={activeCount > 0}
            offsetMinutes={tz}
          />
        )}
      </div>

      {canLog ? (
        <section className="card">
          <header className="card-header">
            <h2 className="card-title">บันทึกงานซ่อมบำรุง</h2>
            <Plus className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
          </header>
          <div className="p-5">
            <CreateMaintenanceForm machines={machines} alarms={alarms} />
          </div>
        </section>
      ) : null}

      <Suspense fallback={<div className="card h-24 animate-pulse" />}>
        <MaintenanceFilters
          machines={machines}
          technicians={technicians}
          activeCount={activeCount}
          shown={rows.length}
          total={total}
        />
      </Suspense>

      <section className="card">
        {result.error ? (
          <p className="alert-error m-5">โหลดข้อมูลไม่สำเร็จ: {result.error.message}</p>
        ) : (
          <MaintenanceTable
            rows={rows}
            machines={machines}
            alarms={alarms}
            canEdit={canLog}
            canDelete={canDelete}
            currentUserId={user.id}
            isAdmin={isAdmin}
            isFiltered={activeCount > 0}
          />
        )}
      </section>

      <p className="flex items-start gap-1.5 text-xs text-ink-subtle dark:text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          งานซ่อมบำรุงที่ผูกกับ Alarm ต้องเป็น Alarm ของเครื่องจักรเดียวกัน
          ระบบตรวจสอบให้อัตโนมัติก่อนบันทึก
        </span>
      </p>
    </div>
  );
}
