'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Loader2, Pencil, Trash2 } from 'lucide-react';
import { deleteAlarm, setAlarmStatus } from '@/app/alarms/actions';
import { ALARM_STATUSES, ALARM_STATUS_LABEL } from '@/lib/constants';
import type { AlarmStatus } from '@/lib/supabase/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { useActionToast } from '@/components/ui/SubmitButton';
import AiAnalyzeButton from '@/components/ai/AiAnalyzeButton';
import { EditAlarmForm, type AlarmValues, type MachineOption } from './AlarmForms';

export type AlarmRow = {
  id: string;
  alarmCode: string;
  machineId: string;
  machineName: string;
  description: string;
  cause: string | null;
  status: AlarmStatus;
  createdAt: string;
  /** Peak telemetry for the AI analyzer; null when the station did not report it. */
  voltagePeak: number | null;
  temperaturePeak: number | null;
  currentPeak: number | null;
};

/** The main Technician action: move an alarm between states without opening it. */
function StatusSelect({ row }: { row: AlarmRow }) {
  const [pending, startTransition] = useTransition();
  const notify = useActionToast();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={row.status}
        disabled={pending}
        aria-label={`เปลี่ยนสถานะ ${row.alarmCode}`}
        className="field w-auto py-1.5 text-xs"
        onChange={(event) => {
          const next = event.target.value as AlarmStatus;
          // Snap the control back immediately. The row is rendered by the
          // server, so holding an unconfirmed value would show a status that a
          // failed request never applied.
          event.target.value = row.status;

          startTransition(async () => {
            const result = await setAlarmStatus(row.id, next);
            notify(result);
            if (result.ok) router.refresh();
          });
        }}
      >
        {ALARM_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ALARM_STATUS_LABEL[status]}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-subtle" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function DeleteButton({ row }: { row: AlarmRow }) {
  const [pending, startTransition] = useTransition();
  const notify = useActionToast();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-sm btn-danger"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          `ยืนยันการลบ Alarm ${row.alarmCode} หรือไม่?\n\nหาก Alarm นี้ถูกผูกกับงานซ่อมบำรุงอยู่ ระบบจะไม่อนุญาตให้ลบ`,
        );
        if (!confirmed) return;

        startTransition(async () => {
          const result = await deleteAlarm(row.id);
          notify(result);
          if (result.ok) router.refresh();
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      ลบ
    </button>
  );
}

/** yyyy-mm-dd in local time; the raw value is UTC and can fall on the wrong day. */
function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AlarmTable({
  rows,
  machines,
  canManage,
  canEditDetails,
  canDelete,
  canAnalyze,
  isFiltered,
}: {
  rows: AlarmRow[];
  machines: MachineOption[];
  /** Technician level: may move an alarm between states. */
  canManage: boolean;
  /** Admin level: may rewrite the whole record. */
  canEditDetails: boolean;
  canDelete: boolean;
  /** Technician level: may ask the AI for a suggested cause and checklist. */
  canAnalyze: boolean;
  isFiltered: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // The actions column only exists when there is something to put in it. A Viewer
  // has none of the three, so they get a five column table.
  const showActions = canAnalyze || canEditDetails || canDelete;
  const columnCount = showActions ? 6 : 5;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
        <Inbox className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
        <p className="text-sm font-medium text-ink dark:text-slate-200">
          {isFiltered ? 'ไม่พบ Alarm ที่ตรงกับเงื่อนไข' : 'ยังไม่มี Alarm ในระบบ'}
        </p>
        <p className="text-xs text-ink-subtle dark:text-slate-500">
          {isFiltered ? 'ลองล้างตัวกรองหรือเปลี่ยนช่วงวันที่' : 'Alarm ใหม่จะปรากฏที่นี่'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-line bg-surface-muted/60 dark:border-slate-800 dark:bg-slate-800/20">
          <tr>
            <th scope="col" className="table-head px-5 py-3">รหัส Alarm</th>
            <th scope="col" className="table-head px-5 py-3">เครื่องจักร</th>
            <th scope="col" className="table-head px-5 py-3">รายละเอียด</th>
            <th scope="col" className="table-head px-5 py-3">สาเหตุ</th>
            <th scope="col" className="table-head px-5 py-3">เกิดเมื่อ</th>
            <th scope="col" className="table-head px-5 py-3">สถานะ</th>
            {showActions ? <th scope="col" className="table-head px-5 py-3">จัดการ</th> : null}
          </tr>
        </thead>

        <tbody className="divide-y divide-line dark:divide-slate-800">
          {rows.map((row) => {
            const isEditing = editingId === row.id;

            return (
              <tr
                key={row.id}
                className="align-top transition-colors hover:bg-surface-muted/60 dark:hover:bg-slate-800/30"
              >
                {isEditing ? (
                  <td colSpan={columnCount} className="bg-surface-muted/40 px-4 py-4 dark:bg-slate-800/20">
                    <EditAlarmForm
                      alarmUuid={row.id}
                      values={
                        {
                          machineId: row.machineId,
                          alarmCode: row.alarmCode,
                          description: row.description,
                          cause: row.cause ?? '',
                          status: row.status,
                          // Carried through so an edit does not clear the readings.
                          voltagePeak: row.voltagePeak === null ? '' : String(row.voltagePeak),
                          temperaturePeak:
                            row.temperaturePeak === null ? '' : String(row.temperaturePeak),
                          currentPeak: row.currentPeak === null ? '' : String(row.currentPeak),
                        } satisfies AlarmValues
                      }
                      machines={machines}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-5 py-3">
                      <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-medium text-ink dark:bg-slate-800 dark:text-slate-200">
                        {row.alarmCode}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="block font-medium text-ink dark:text-slate-200">
                        {row.machineId}
                      </span>
                      <span className="block text-xs text-ink-subtle dark:text-slate-500">
                        {row.machineName}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted dark:text-slate-400">
                      {row.description}
                    </td>
                    <td className="px-5 py-3 text-ink-muted dark:text-slate-400">
                      {row.cause ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-muted dark:text-slate-400">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={row.status} />
                        {canManage ? <StatusSelect row={row} /> : null}
                      </div>
                    </td>
                    {showActions ? (
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canEditDetails ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setEditingId(row.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              แก้ไข
                            </button>
                          ) : null}
                          {canDelete ? <DeleteButton row={row} /> : null}
                          {canAnalyze ? (
                            <AiAnalyzeButton alarmId={row.id} alarmCode={row.alarmCode} />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t border-line px-5 py-3 text-xs text-ink-subtle dark:border-slate-500 dark:border-slate-800">
        แสดง {rows.length} รายการ
      </p>
    </div>
  );
}
