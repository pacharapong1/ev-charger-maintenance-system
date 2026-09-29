import type { AlarmStatus, MachineStatus, MaintenanceStatus } from './supabase/types';
import { ALARM_STATUS_LABEL, MACHINE_STATUS_LABEL, MACHINE_STATUSES } from './constants';

/**
 * Series colours for the charts.
 *
 * These are fixed hex values rather than theme-aware tokens on purpose. A donut
 * slice is an area of saturated colour, and swapping it between themes makes the
 * chart look like the data changed. The four hues are picked to stay legible on
 * both the white card and the dark card, and to remain distinguishable for the
 * most common forms of colour vision deficiency: the set varies in both
 * lightness and hue, and every chart also carries a text legend with labels and
 * counts, so colour is never the only carrier of meaning.
 */
export const MACHINE_STATUS_COLOR: Record<MachineStatus, string> = {
  Running: '#10b981',
  Stop: '#3b82f6',
  Alarm: '#ef4444',
  Maintenance: '#f59e0b',
};

export const ALARM_STATUS_COLOR: Record<AlarmStatus, string> = {
  Open: '#ef4444',
  'In Progress': '#f59e0b',
  Closed: '#10b981',
};

export const MAINTENANCE_STATUS_COLOR: Record<MaintenanceStatus, string> = {
  'In Progress': '#3b82f6',
  'Waiting Part': '#f59e0b',
  Completed: '#10b981',
};

export const ALARM_BAR_COLOR = '#20b364';

export type StatusRow = {
  status: MachineStatus;
  label: string;
  color: string;
  count: number;
  percent: number;
};

/**
 * Turns the sparse rows returned by the machine_status_summary view into one row
 * per known status, in a fixed order.
 *
 * The view only returns statuses that exist, so a status with no stations is
 * absent. Left alone that would drop the slice from the donut and hide the
 * status from the legend entirely, which reads as missing data. Filling it with
 * an explicit zero keeps the chart shape stable as the fleet changes.
 */
export function buildStatusRows(counts: Partial<Record<MachineStatus, number>>): StatusRow[] {
  const total = MACHINE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

  return MACHINE_STATUSES.map((status) => {
    const count = counts[status] ?? 0;
    return {
      status,
      label: MACHINE_STATUS_LABEL[status],
      color: MACHINE_STATUS_COLOR[status],
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

/** Thai digit grouping, so counts read naturally to a Thai-speaking operator. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('th-TH').format(value);
}

export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export { ALARM_STATUS_LABEL };
