'use client';

import { AlertTriangle, CalendarCheck, Wrench, WrenchIcon, Users } from 'lucide-react';
import type { HistoryEvent, HistoryStats } from '@/lib/history';
import KpiCard from '@/components/dashboard/KpiCard';
import StatusBadge from '@/components/ui/StatusBadge';

/**
 * Timestamps are formatted in the browser rather than on the server, which keeps
 * them in the reader's own timezone and identical to the times shown in the
 * Alarm and Maintenance tables. A server render would have no way to know that
 * timezone and would fall back to UTC.
 */
function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function Telemetry({ alarm }: { alarm: NonNullable<HistoryEvent['alarm']> }) {
  const readings = [
    { label: 'V', value: alarm.voltagePeak },
    { label: '°C', value: alarm.temperaturePeak },
    { label: 'A', value: alarm.currentPeak },
  ].filter((reading) => reading.value !== null);

  // Absent entirely when the station reported nothing, which is different from
  // a reading of zero and should not be padded with misleading blanks.
  if (readings.length === 0) return null;

  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {readings.map((reading) => (
        <div key={reading.label} className="flex items-baseline gap-1">
          <dt className="text-ink-subtle dark:text-slate-500">{reading.label}</dt>
          <dd className="font-medium tabular-nums text-ink-muted dark:text-slate-300">
            {reading.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One maintenance entry: what was done, by whom, and whether it is finished. */
function WorkItem({ item, nested }: { item: HistoryEvent['work'][number]; nested: boolean }) {
  return (
    <li
      className={
        nested
          ? 'ml-5 border-l-2 border-line pl-4 dark:border-slate-700'
          : 'ml-5 border-l-2 border-emerald-500/40 pl-4'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <WrenchIcon
          className="h-3.5 w-3.5 shrink-0 text-ink-subtle dark:text-slate-500"
          aria-hidden="true"
        />
        {/* The question this screen exists to answer: who did the work. */}
        <span className="text-sm font-medium text-ink dark:text-slate-200">
          {item.technicianName ?? 'ไม่ระบุผู้ดำเนินการ'}
        </span>
        <StatusBadge status={item.status} />
        <span className="text-xs text-ink-subtle dark:text-slate-500">
          {formatTime(item.createdAt)}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-ink-muted dark:text-slate-400">
        {item.actionTaken}
      </p>
    </li>
  );
}

export default function MachineHistoryTimeline({
  events,
  stats,
}: {
  events: readonly HistoryEvent[];
  stats: HistoryStats;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Alarm ทั้งหมด"
          value={stats.alarmCount}
          icon={AlertTriangle}
          tone="amber"
          hint={stats.lastAlarmAt ? `ล่าสุด ${formatDay(stats.lastAlarmAt)}` : 'ยังไม่เคยมี Alarm'}
        />
        <KpiCard
          label="Alarm ที่ยังไม่ปิด"
          value={stats.openAlarmCount}
          icon={AlertTriangle}
          tone={stats.openAlarmCount > 0 ? 'red' : 'emerald'}
        />
        <KpiCard
          label="งานซ่อมบำรุง"
          value={stats.workCount}
          icon={Wrench}
          tone="blue"
          hint={stats.lastServiceAt ? `ซ่อมเสร็จล่าสุด ${formatDay(stats.lastServiceAt)}` : 'ยังไม่มีงานที่ซ่อมเสร็จ'}
        />
        <KpiCard
          label="ช่างผู้ดูแล"
          value={stats.technicianCount}
          icon={Users}
          tone="emerald"
        />
      </div>

      <section className="card">
        <header className="card-header">
          <h2 className="card-title">ประวัติการซ่อมและแจ้งเหตุ</h2>
          <CalendarCheck className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
        </header>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Wrench className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
            <p className="text-sm font-medium text-ink dark:text-slate-200">
              ยังไม่มีประวัติสำหรับเครื่องจักรนี้
            </p>
            <p className="text-xs text-ink-subtle dark:text-slate-500">
              เมื่อมีการเปิด Alarm หรือบันทึกงานซ่อมบำรุง รายการจะปรากฏที่นี่เรียงจากใหม่ไปเก่า
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-line dark:divide-slate-800">
            {events.map((event) => (
              <li key={event.key} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {event.alarm ? (
                    <>
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-amber-500"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-sm font-medium text-ink dark:text-slate-100">
                        {event.alarm.alarmCode}
                      </span>
                      <StatusBadge status={event.alarm.status} />
                    </>
                  ) : (
                    <>
                      <Wrench className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                      <span className="text-sm font-medium text-ink dark:text-slate-200">
                        งานซ่อมบำรุงตามรอบ
                      </span>
                    </>
                  )}
                  <span className="ml-auto text-xs text-ink-subtle dark:text-slate-500">
                    {formatDay(event.at)} {formatTime(event.at)}
                  </span>
                </div>

                {event.alarm ? (
                  <>
                    <p className="mt-1.5 text-sm text-ink-muted dark:text-slate-300">
                      {event.alarm.description}
                    </p>
                    {event.alarm.cause ? (
                      <p className="mt-1 text-sm text-ink-subtle dark:text-slate-400">
                        <span className="font-medium">สาเหตุ:</span> {event.alarm.cause}
                      </p>
                    ) : null}
                    <Telemetry alarm={event.alarm} />
                  </>
                ) : null}

                {event.work.length > 0 ? (
                  <ul className="mt-3 space-y-3">
                    {event.work.map((item) => (
                      <WorkItem key={item.id} item={item} nested={event.alarm !== null} />
                    ))}
                  </ul>
                ) : event.alarm ? (
                  <p className="mt-2 text-xs text-ink-subtle dark:text-slate-500">
                    ยังไม่มีการบันทึกงานซ่อมบำรุง
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
