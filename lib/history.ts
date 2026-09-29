/**
 * Machine history assembly.
 *
 * Pure functions, kept out of the page so the merge rules can be tested without
 * a database. The interesting case is a maintenance record that references an
 * alarm: it belongs under that alarm in the timeline rather than beside it,
 * because the question a reader is answering is "which alarm, and who fixed it".
 */

import type { AlarmStatus, MaintenanceStatus } from '@/lib/supabase/types';

export type HistoryAlarm = {
  id: string;
  alarmCode: string;
  description: string;
  cause: string | null;
  status: AlarmStatus;
  createdAt: string;
  voltagePeak: number | null;
  temperaturePeak: number | null;
  currentPeak: number | null;
};

export type HistoryWork = {
  id: string;
  /** null for preventive or standalone work that was not raised against an alarm. */
  alarmId: string | null;
  actionTaken: string;
  status: MaintenanceStatus;
  createdAt: string;
  technicianId: string | null;
  /** null when technician_id was cleared by ON DELETE SET NULL. */
  technicianName: string | null;
};

export type HistoryEvent = {
  key: string;
  /** Sort key, taken from the event itself rather than the newest child. */
  at: string;
  alarm: HistoryAlarm | null;
  /** Empty for an alarm that nobody has touched yet. */
  work: HistoryWork[];
};

function timeOf(value: string): number {
  const parsed = new Date(value).getTime();
  // An unparseable timestamp sorts *last*, so it is treated as the smallest
  // possible time: the lists are newest first, where the largest value leads.
  // NaN would be worse than either, because every `>` comparison against it is
  // false and the sort silently stops reordering the rest of the list.
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Merges alarms and maintenance into one newest-first timeline.
 *
 * Work carrying an alarm id is nested under that alarm. The composite foreign
 * key (alarm_id, machine_id) guarantees the work and the alarm share a machine,
 * so the id is enough to pair them. Work whose alarm is missing from the input,
 * which happens when the caller passes a narrowed alarm set, is kept as its own
 * entry rather than dropped, so the technician's hours are never lost.
 */
export function buildTimeline(alarms: readonly HistoryAlarm[], work: readonly HistoryWork[]): HistoryEvent[] {
  const workByAlarm = new Map<string, HistoryWork[]>();
  const orphanWork: HistoryWork[] = [];

  for (const item of work) {
    if (item.alarmId) {
      const bucket = workByAlarm.get(item.alarmId);
      if (bucket) bucket.push(item);
      else workByAlarm.set(item.alarmId, [item]);
    } else {
      orphanWork.push(item);
    }
  }

  const events: HistoryEvent[] = alarms.map((alarm) => {
    const nested = workByAlarm.get(alarm.id) ?? [];
    // Deleted rather than left behind, so a later lookup cannot attach the same
    // work to a second event.
    workByAlarm.delete(alarm.id);

    return {
      key: `alarm-${alarm.id}`,
      at: alarm.createdAt,
      alarm,
      // Oldest first inside an incident: a repair log reads as a sequence.
      work: nested.sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt)),
    };
  });

  // Work referencing an alarm that is not in this machine's set.
  for (const leftover of workByAlarm.values()) {
    for (const item of leftover) orphanWork.push(item);
  }

  for (const item of orphanWork) {
    events.push({
      key: `work-${item.id}`,
      at: item.createdAt,
      alarm: null,
      work: [item],
    });
  }

  return events.sort((a, b) => timeOf(b.at) - timeOf(a.at));
}

export type HistoryStats = {
  alarmCount: number;
  openAlarmCount: number;
  workCount: number;
  /** Distinct technicians, for "how many people have touched this station". */
  technicianCount: number;
  lastServiceAt: string | null;
  lastAlarmAt: string | null;
};

export function historyStats(alarms: readonly HistoryAlarm[], work: readonly HistoryWork[]): HistoryStats {
  const technicians = new Set(
    work.map((item) => item.technicianId).filter((id): id is string => id !== null),
  );

  // Only completed work counts as "last service"; an in-progress job is a
  // promise, not a history entry, and reporting it would overstate uptime.
  // Unparseable timestamps are dropped first, because an -Infinity reaching
  // new Date(...).toISOString() throws a RangeError and takes the page down.
  const completedTimes = work
    .filter((item) => item.status === 'Completed')
    .map((item) => timeOf(item.createdAt))
    .filter((time) => Number.isFinite(time));

  const alarmTimes = alarms
    .map((alarm) => timeOf(alarm.createdAt))
    .filter((time) => Number.isFinite(time));

  return {
    alarmCount: alarms.length,
    openAlarmCount: alarms.filter((alarm) => alarm.status !== 'Closed').length,
    workCount: work.length,
    technicianCount: technicians.size,
    lastServiceAt: completedTimes.length
      ? new Date(Math.max(...completedTimes)).toISOString()
      : null,
    lastAlarmAt: alarmTimes.length ? new Date(Math.max(...alarmTimes)).toISOString() : null,
  };
}
