import Link from 'next/link';
import { AlertCircle, Inbox } from 'lucide-react';
import type { AlarmStatus } from '@/lib/supabase/types';
import { ALARM_STATUS_COLOR, ALARM_STATUS_LABEL, formatCount } from '@/lib/dashboard';
import { formatDateTime } from '@/lib/format';

type RecentAlarm = {
  id: string;
  alarm_code: string;
  description: string;
  status: AlarmStatus;
  created_at: string;
  machines: { machine_id: string; name: string } | { machine_id: string; name: string }[] | null;
};

export default function RecentAlarmsTable({
  alarms,
  error,
}: {
  alarms: RecentAlarm[] | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
        <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
        <p className="text-sm font-medium text-ink dark:text-slate-200">โหลดข้อมูลไม่สำเร็จ</p>
        <p className="max-w-md text-xs text-ink-subtle dark:text-slate-500">{error}</p>
      </div>
    );
  }

  if (!alarms || alarms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
        <Inbox className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
        <p className="text-sm text-ink-muted dark:text-slate-400">ยังไม่มีรายการ Alarm</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line bg-surface-muted/60 dark:border-slate-800 dark:bg-slate-800/20">
          <tr>
            <th scope="col" className="table-head px-5 py-3">รหัส</th>
            <th scope="col" className="table-head px-5 py-3">เครื่องจักร</th>
            <th scope="col" className="table-head px-5 py-3">รายละเอียด</th>
            <th scope="col" className="table-head px-5 py-3">สถานะ</th>
            <th scope="col" className="table-head px-5 py-3">เวลา</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line dark:divide-slate-800">
          {alarms.map((alarm) => {
            // A one-to-many embed comes back as an array even when the join
            // yields a single row, so normalise before reading the name.
            const machine = Array.isArray(alarm.machines) ? alarm.machines[0] : alarm.machines;

            return (
              <tr
                key={alarm.id}
                className="transition-colors hover:bg-surface-muted/60 dark:hover:bg-slate-800/30"
              >
                <td className="whitespace-nowrap px-5 py-3">
                  <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-medium text-ink dark:bg-slate-800 dark:text-slate-200">
                    {alarm.alarm_code}
                  </code>
                </td>
                <td className="whitespace-nowrap px-5 py-3 font-medium text-ink dark:text-slate-200">
                  {machine?.name ?? '-'}
                </td>
                <td className="px-5 py-3 text-ink-muted dark:text-slate-400">
                  <span className="line-clamp-1">{alarm.description}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      color: ALARM_STATUS_COLOR[alarm.status],
                      backgroundColor: `${ALARM_STATUS_COLOR[alarm.status]}1a`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ALARM_STATUS_COLOR[alarm.status] }}
                    />
                    {ALARM_STATUS_LABEL[alarm.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-ink-subtle dark:text-slate-500">
                  {formatDateTime(alarm.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 dark:border-slate-800">
        <p className="text-xs text-ink-subtle dark:text-slate-500">
          แสดง {formatCount(alarms.length)} รายการล่าสุด
        </p>
        <Link
          href="/alarms"
          className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          ดูทั้งหมด →
        </Link>
      </div>
    </div>
  );
}
