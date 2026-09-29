import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlertTriangle, Plus, Wrench } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import {
  alarmFilterCount,
  escapeLike,
  rangeEnd,
  rangeStart,
  readAlarmFilters,
  readTimezoneOffset,
  type SearchParams,
} from '@/lib/filters';
import { CreateAlarmForm, type MachineOption } from '@/components/alarms/AlarmForms';
import AlarmFilters from '@/components/alarms/AlarmFilters';
import AlarmTable, { type AlarmRow } from '@/components/alarms/AlarmTable';
import { AlarmCsvButton } from '@/components/csv/ExportCsvButton';

export const metadata: Metadata = { title: 'Alarm' };

type Props = { searchParams: SearchParams };

export default async function AlarmsPage({ searchParams }: Props) {
  const { role } = await requireUser();
  // Raising an alarm and rewriting one are admin only; a Technician gets the
  // status select but no create form and no record editor.
  const canManage = can(role, 'manageAlarms');
  const canEditDetails = can(role, 'editAlarmDetails');
  const canDelete = can(role, 'deleteAlarms');
  const canAnalyze = can(role, 'useAiAnalysis');

  const filters = readAlarmFilters(searchParams);
  const tz = readTimezoneOffset(searchParams);
  const activeCount = alarmFilterCount(filters);

  const supabase = createClient();

  const [machineResult, totalResult, result] = await Promise.all([
    supabase
      .from('machines')
      .select('id, machine_id, name')
      .order('machine_id', { ascending: true }),
    supabase.from('alarms').select('*', { count: 'exact', head: true }),
    buildAlarmQuery(),
  ]);

  const machines: MachineOption[] = (machineResult.data ?? []).map((machine) => ({
    id: machine.id,
    machineId: machine.machine_id,
    name: machine.name,
  }));

  const total = totalResult.count ?? 0;
  const rows: AlarmRow[] = (result.data ?? []).map((row) => ({
    id: row.id,
    alarmCode: row.alarm_code,
    // machine_id holds the UUID, so the join is what resolves the code an
    // operator recognises.
    machineId: row.machines?.machine_id ?? '-',
    machineName: row.machines?.name ?? '-',
    description: row.description,
    cause: row.cause,
    status: row.status,
    createdAt: row.created_at,
    // numeric columns can arrive as strings depending on the PostgREST config,
    // so they are coerced rather than passed through.
    voltagePeak: row.voltage_peak === null ? null : Number(row.voltage_peak),
    temperaturePeak: row.temperature_peak === null ? null : Number(row.temperature_peak),
    currentPeak: row.current_peak === null ? null : Number(row.current_peak),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">
            บันทึก Alarm
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            {canEditDetails
              ? canDelete
                ? 'คุณเพิ่ม แก้ไข เปลี่ยนสถานะ และลบ Alarm ได้'
                : 'คุณเปิด แก้ไข และเปลี่ยนสถานะ Alarm ได้ แต่ลบไม่ได้'
              : canManage
                ? 'คุณเปลี่ยนสถานะ Alarm ได้ แต่เปิด แก้ไข หรือลบรายการเองไม่ได้'
                : 'บัญชีของคุณดูข้อมูลได้อย่างเดียว'}
          </p>
        </div>
        {/* Reading the log is a read action, so every role may export it. The
            file is built from the rows the query below already returned, which
            keeps the report inside the same RLS scope as the table. */}
        {result.error ? null : (
          <AlarmCsvButton
            rows={rows}
            total={total}
            isFiltered={activeCount > 0}
            offsetMinutes={tz}
          />
        )}
      </div>

      {canEditDetails ? (
        <section className="card">
          <header className="card-header">
            <h2 className="card-title">เปิด Alarm ใหม่</h2>
            <Plus className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
          </header>
          <div className="p-5">
            <CreateAlarmForm machines={machines} />
          </div>
        </section>
      ) : null}

      <Suspense fallback={<div className="card h-24 animate-pulse" />}>
        <AlarmFilters
          machines={machines}
          activeCount={activeCount}
          shown={rows.length}
          total={total}
        />
      </Suspense>

      <section className="card">
        {result.error ? (
          <p className="alert-error m-5">โหลดข้อมูลไม่สำเร็จ: {result.error.message}</p>
        ) : (
          <AlarmTable
            rows={rows}
            machines={machines}
            canManage={canManage}
            canEditDetails={canEditDetails}
            canDelete={canDelete}
            canAnalyze={canAnalyze}
            isFiltered={activeCount > 0}
          />
        )}
      </section>

      {!canManage ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle dark:text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {canEditDetails
            ? 'บัญชีของคุณบันทึกสาเหตุลงใน Alarm ได้ แต่การเปลี่ยนสถานะ Alarm สงวนไว้สำหรับผู้ดูแลระบบและช่างซ่อมบำรุง'
            : 'การเปลี่ยนสถานะ Alarm สงวนไว้สำหรับผู้ดูแลระบบและช่างซ่อมบำรุง'}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle dark:text-slate-500">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          งานซ่อมบำรุงที่อ้างถึง Alarm จะผูกกันไว้
        </p>
      )}
    </div>
  );

  /**
   * Built after the client exists so the branch filters are applied to the same
   * session. The join is needed because alarms store the machine UUID, while
   * operators know their stations by code.
   */  function buildAlarmQuery() {
    let query = supabase
      .from('alarms')
      .select(
        'id, alarm_code, description, cause, status, created_at, voltage_peak, temperature_peak, current_peak, machines(machine_id, name)',
      )
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.machineId) query = query.eq('machine_id', filters.machineId);

    // Both ends inclusive, bounded in the operator's own timezone so a day
    // filter means the calendar day they typed.
    const start = rangeStart(filters.from, tz);
    const end = rangeEnd(filters.to, tz);
    if (start) query = query.gte('created_at', start);
    if (end) query = query.lte('created_at', end);

    if (filters.search) {
      const term = `%${escapeLike(filters.search)}%`;
      query = query.or(`alarm_code.ilike.${term},description.ilike.${term},cause.ilike.${term}`);
    }

    return query;
  }
}
