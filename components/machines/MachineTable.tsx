'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, History, Inbox, Loader2, Pencil, Trash2 } from 'lucide-react';
import { deleteMachine, setMachineStatus } from '@/app/machines/actions';
import { MACHINE_STATUSES, MACHINE_STATUS_LABEL } from '@/lib/constants';
import type { MachineStatus } from '@/lib/supabase/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { EditMachineForm } from './MachineForms';
import { useActionToast } from '@/components/ui/SubmitButton';

export type MachineRow = {
  id: string;
  machineId: string;
  name: string;
  type: string;
  location: string | null;
  status: MachineStatus;
};

/** Inline status change, available to anyone who can manage machines. */
function StatusSelect({ row }: { row: MachineRow }) {
  const [pending, startTransition] = useTransition();
  const notify = useActionToast();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={row.status}
        disabled={pending}
        aria-label={`เปลี่ยนสถานะ ${row.machineId}`}
        className="field w-auto py-1.5 text-xs"
        onChange={(event) => {
          const next = event.target.value as MachineStatus;
          const previous = row.status;

          // Put the DOM back first. The server render is the source of truth,
          // so an optimistic value would be overwritten on the next refresh
          // anyway, and this avoids a flash of the wrong status on failure.
          event.target.value = previous;

          startTransition(async () => {
            const result = await setMachineStatus(row.id, next);
            if (result.ok) router.refresh();
            else notify(result);
          });
        }}
      >
        {MACHINE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {MACHINE_STATUS_LABEL[status]}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-subtle" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function DeleteButton({ row }: { row: MachineRow }) {
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
          `ยืนยันการลบ ${row.machineId} หรือไม่?\n\nการลบถาวร และ Alarm กับงานซ่อมบำรุงที่ผูกกับเครื่องนี้จะหายไปด้วย`,
        );
        if (!confirmed) return;

        startTransition(async () => {
          const result = await deleteMachine(row.id);
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

export default function MachineTable({
  rows,
  canManage,
  isFiltered,
}: {
  rows: MachineRow[];
  canManage: boolean;
  isFiltered: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
        {isFiltered ? (
          <Inbox className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
        )}
        <p className="text-sm font-medium text-ink dark:text-slate-200">
          {isFiltered ? 'ไม่พบเครื่องจักรที่ตรงกับเงื่อนไข' : 'ยังไม่มีเครื่องจักรในระบบ'}
        </p>
        <p className="text-xs text-ink-subtle dark:text-slate-500">
          {isFiltered ? 'ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา' : 'เริ่มด้วยการเพิ่มเครื่องจักรตู้แรกด้านบน'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="border-b border-line bg-surface-muted/60 dark:border-slate-800 dark:bg-slate-800/20">
          <tr>
            <th scope="col" className="table-head px-5 py-3">รหัส</th>
            <th scope="col" className="table-head px-5 py-3">ชื่อ</th>
            <th scope="col" className="table-head px-5 py-3">ประเภท</th>
            <th scope="col" className="table-head px-5 py-3">สถานที่ตั้ง</th>
            <th scope="col" className="table-head px-5 py-3">สถานะ</th>
            {/* Shown to every role, not just managers: reading a station's history
                is a read action, and hiding the link from a Viewer would make
                the page unreachable for exactly the people who most often need
                to look something up. */}
            <th scope="col" className="table-head px-5 py-3">จัดการ</th>
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
                  // The editor needs the full row width, so it replaces every
                  // cell rather than being crammed into the actions column.
                  <td colSpan={6} className="bg-surface-muted/40 px-4 py-4 dark:bg-slate-800/20">
                    <EditMachineForm
                      machineUuid={row.id}
                      values={{
                        machineId: row.machineId,
                        name: row.name,
                        type: row.type,
                        location: row.location ?? '',
                        status: row.status,
                      }}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-5 py-3">
                      <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-medium text-ink dark:bg-slate-800 dark:text-slate-200">
                        {row.machineId}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-ink dark:text-slate-200">
                      {row.name}
                    </td>
                    <td className="px-5 py-3 text-ink-muted dark:text-slate-400">{row.type}</td>
                    <td className="px-5 py-3 text-ink-muted dark:text-slate-400">
                      {row.location ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={row.status} />
                        {canManage ? <StatusSelect row={row} /> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/machines/${encodeURIComponent(row.machineId)}`}
                          className="btn btn-sm"
                          prefetch={false}
                        >
                          <History className="h-3.5 w-3.5" aria-hidden="true" />
                          ประวัติ
                        </Link>
                        {canManage ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setEditingId(row.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              แก้ไข
                            </button>
                            <DeleteButton row={row} />
                          </>
                        ) : null}
                      </div>
                    </td>
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
