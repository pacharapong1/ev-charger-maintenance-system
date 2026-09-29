import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  buildTimeline,
  historyStats,
  type HistoryAlarm,
  type HistoryWork,
} from '@/lib/history';
import type { AlarmStatus, MachineStatus, MaintenanceStatus } from '@/lib/supabase/types';
import MachineHistoryTimeline from '@/components/machines/MachineHistoryTimeline';
import StatusBadge from '@/components/ui/StatusBadge';

type Props = { params: { machineId: string } };

export const metadata: Metadata = { title: 'ประวัติเครื่องจักร' };

/**
 * Station history for one machine, addressed by its operator facing code.
 *
 * `machines.machine_id` carries a unique constraint, so the code is a stable
 * identifier to put in a URL: the page can be bookmarked or pasted into a
 * handover note and still opens the right station. The UUID primary key would
 * also work but is meaningless to the people using this screen.
 *
 * Every read goes through the caller's own Supabase session, so the alarms and
 * maintenance shown are exactly the rows RLS allows this user to see.
 */
export default async function MachineHistoryPage({ params }: Props) {
  await requireUser();

  const supabase = createClient();

  const { data: machine, error: machineError } = await supabase
    .from('machines')
    .select('id, machine_id, name, type, location, status, created_at')
    .eq('machine_id', params.machineId)
    .maybeSingle();

  if (machineError) {
    throw new Error(`โหลดข้อมูลเครื่องจักรไม่สำเร็จ: ${machineError.message}`);
  }

  // An unknown code is a normal outcome of a stale bookmark, not a server fault.
  if (!machine) notFound();

  const [alarmResult, workResult] = await Promise.all([
    supabase
      .from('alarms')
      .select(
        'id, alarm_code, description, cause, status, created_at, voltage_peak, temperature_peak, current_peak',
      )
      .eq('machine_id', machine.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('maintenance_records')
      .select('id, alarm_id, action_taken, status, created_at, technician_id')
      .eq('machine_id', machine.id)
      .order('created_at', { ascending: false }),
  ]);

  const alarms: HistoryAlarm[] = (alarmResult.data ?? []).map((row) => ({
    id: row.id,
    alarmCode: row.alarm_code,
    description: row.description,
    cause: row.cause,
    status: row.status as AlarmStatus,
    createdAt: row.created_at,
    // numeric columns can arrive as strings depending on the PostgREST config.
    voltagePeak: row.voltage_peak === null ? null : Number(row.voltage_peak),
    temperaturePeak: row.temperature_peak === null ? null : Number(row.temperature_peak),
    currentPeak: row.current_peak === null ? null : Number(row.current_peak),
  }));

  const work: HistoryWork[] = (workResult.data ?? []).map((row) => ({
    id: row.id,
    alarmId: row.alarm_id,
    actionTaken: row.action_taken,
    status: row.status as MaintenanceStatus,
    createdAt: row.created_at,
    technicianId: row.technician_id,
    // Resolved below, once every technician id in the set is known.
    technicianName: null,
  }));

  // Technician names come from a second query rather than an embed, because
  // technician_id is ON DELETE SET NULL and an inner join would drop the whole
  // maintenance row when a profile is removed, hiding work that was really done.
  const technicianIds = [
    ...new Set(work.map((row) => row.technicianId).filter((id): id is string => id !== null)),
  ];

  const { data: profiles } = technicianIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', technicianIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  for (const item of work) {
    if (item.technicianId) {
      item.technicianName = nameById.get(item.technicianId) ?? 'ไม่ทราบชื่อ';
    }
  }

  const events = buildTimeline(alarms, work);
  const stats = historyStats(alarms, work);

  return (
    <div className="space-y-6">
      <Link
        href="/machines"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        กลับไปหน้าเครื่องจักร
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">
          ประวัติ {machine.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted dark:text-slate-400">
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-medium text-ink dark:bg-slate-800 dark:text-slate-200">
            {machine.machine_id}
          </code>
          <span>{machine.type}</span>
          {machine.location ? <span>· {machine.location}</span> : null}
          <StatusBadge status={machine.status as MachineStatus} />
        </div>
      </div>

      <MachineHistoryTimeline events={events} stats={stats} />
    </div>
  );
}
