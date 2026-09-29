'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Loader2, Pencil, Trash2 } from 'lucide-react';
import { deleteMaintenance, setMaintenanceStatus } from '@/app/maintenance/actions';
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABEL } from '@/lib/constants';
import type { MaintenanceStatus } from '@/lib/supabase/types';
import type { AlarmOption, MachineOption } from '@/lib/options';
import StatusBadge from '@/components/ui/StatusBadge';
import { useActionToast } from '@/components/ui/SubmitButton';
import { EditMaintenanceForm, type MaintenanceValues } from './MaintenanceForms';

export type MaintenanceRow = {
  id: string;
  machineId: string;
  machineName: string;
  /** UUID of the linked alarm, or null when the log is not alarm specific. */
  alarmId: string | null;
  alarmCode: string | null;
  /** Who the log is attributed to; the update policy keys off this. */
  technicianId: string | null;
  technicianName: string;
  actionTaken: string;
  status: MaintenanceStatus;
  createdAt: string;
};

/** The main Technician action: advance a job without opening the row. */
function StatusSelect({ row }: { row: MaintenanceRow }) {
  const [pending, startTransition] = useTransition();
  const notify = useActionToast();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={row.status}
        disabled={pending}
        aria-label={`เปลี่ยนสถานะงานของ ${row.machineId}`}
        className="field w-auto py-1.5 text-xs"
        onChange={(event) => {
          const next = event.target.value as MaintenanceStatus;
          event.target.value = row.status;

          startTransition(async () => {
            const result = await setMaintenanceStatus(row.id, next);
            notify(result);
            if (result.ok) router.refresh();
          });
        }}
      >
        {MAINTENANCE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {MAINTENANCE_STATUS_LABEL[status]}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-subtle" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function DeleteButton({ row }: { row: MaintenanceRow }) {
  const [pending, startTransition] = useTransition();
  const notify = useActionToast();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn btn-sm btn-danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`ยืนยันการลบงานซ่อมบำรุงของ ${row.machineId} หรือไม่?`)) return;

        startTransition(async () => {
          const result = await deleteMaintenance(row.id);
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

export default function MaintenanceTable({
  rows,
  machines,
  alarms,
  canEdit,
  canDelete,
  currentUserId,
  isAdmin,
  isFiltered,
}: {
  rows: MaintenanceRow[];
  machines: MachineOption[];
  alarms: AlarmOption[];
  /** Whether the role may edit maintenance at all. */
  canEdit: boolean;
  canDelete: boolean;
  /** The signed-in user, for the "own rows only" rule a Technician is subject to. */
  currentUserId: string;
  isAdmin: boolean;
  isFiltered: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const columnCount = canDelete ? 7 : 6;

  /**
   * A Technician may only change their own log entries, which is what the
   * maintenance_records_update policy enforces. Checking it here as well means
   * the editor never appears on a row the server would refuse to save.
   */
  function canEditRow(row: MaintenanceRow) {
    if (!canEdit) return false;
    if (isAdmin) return true;
    return row.technicianId === currentUserId;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
        <Inbox className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
        <p className="text-sm font-medium text-ink dark:text-slate-200">
          {isFiltered ? 'ไม่พบงานซ่อมบำรุงที่ตรงกับเงื่อนไข' : 'ยังไม่มีงานซ่อมบำรุง'}
        </p>
        <p className="text-xs text-ink-subtle dark:text-slate-500">
          {isFiltered ? 'ลองล้างตัวกรองหรือเปลี่ยนช่วงวันที่' : 'บันทึกงานแรกด้านบน'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="border-b border-line bg-surface-muted/60 dark:border-slate-800 dark:bg-slate-800/20">
          <tr>
            <th scope="col" className="table-head px-5 py-3">เครื่องจักร</th>
            <th scope="col" className="table-head px-5 py-3">Alarm</th>
            <th scope="col" className="table-head px-5 py-3">รายละเอียดงาน</th>
            <th scope="col" className="table-head px-5 py-3">ผู้ดำเนินการ</th>
            <th scope="col" className="table-head px-5 py-3">บันทึกเมื่อ</th>
            <th scope="col" className="table-head px-5 py-3">สถานะ</th>
            {canDelete ? <th scope="col" className="table-head px-5 py-3">จัดการ</th> : null}
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
                    <EditMaintenanceForm
                      recordUuid={row.id}
                      values={
                        {
                          machineId: row.machineId,
                          alarmId: row.alarmId ?? '',
                          actionTaken: row.actionTaken,
                          status: row.status,
                        } satisfies MaintenanceValues
                      }
                      machines={machines}
                      alarms={alarms}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="block font-medium text-ink dark:text-slate-200">
                        {row.machineId}
                      </span>
                      <span className="block text-xs text-ink-subtle dark:text-slate-500">
                        {row.machineName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {row.alarmCode ? (
                        <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-ink dark:bg-slate-800 dark:text-slate-200">
                          {row.alarmCode}
                        </code>
                      ) : (
                        <span className="text-xs text-ink-subtle dark:text-slate-500">ไม่ผูก</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-muted dark:text-slate-400">
                      {row.actionTaken}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-muted dark:text-slate-400">
                      {row.technicianName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-muted dark:text-slate-400">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={row.status} />
                        {canEditRow(row) ? <StatusSelect row={row} /> : null}
                      </div>
                    </td>
                    {canDelete ? (
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {canEditRow(row) ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setEditingId(row.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              แก้ไข
                            </button>
                          ) : null}
                          <DeleteButton row={row} />
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
