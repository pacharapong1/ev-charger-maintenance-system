import type { AlarmStatus, MachineStatus, MaintenanceStatus } from './supabase/types';
import { ALARM_STATUSES, MAINTENANCE_STATUSES, MACHINE_STATUSES } from './constants';
import { isIsoDate } from './validation';

/**
 * Filtering runs on the server, driven by URL search params, rather than in the
 * browser over a fully loaded list.
 *
 * Two reasons. The data set stays correct no matter how large it grows, because
 * the query is narrowed in Postgres instead of after fetching every row. And a
 * filtered view becomes a shareable link: an operator can paste the URL of
 * "faulted stations at Rama IX this week" into chat and the recipient sees
 * exactly the same rows.
 *
 * Every value read from the URL is validated against a known enum or a date
 * pattern before it reaches a PostgREST filter string, so a hand-edited query
 * cannot inject filter syntax.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/** Collapses Next's string|string[] search param shape to a single string. */
export function readParam(params: SearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return typeof value === 'string' ? value.trim() : '';
}

function readEnum<T extends string>(
  params: SearchParams,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = readParam(params, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function readDate(params: SearchParams, key: string): string | null {
  const value = readParam(params, key);
  return isIsoDate(value) ? value : null;
}

/**
 * Reads the operator's UTC offset in minutes, expressed as minutes *ahead* of
 * UTC (the same convention as an ISO 8601 offset and the PostgREST `tz`
 * param), so UTC+7 is 420. Bounded to UTC-14..UTC+14 so a hand edited query
 * cannot ask for an offset that no real zone uses.
 */
export function readTimezoneOffset(params: SearchParams): number | null {
  const raw = readParam(params, 'tz');
  if (!/^-?\d{1,3}$/.test(raw)) return null;
  const minutes = Number(raw);
  if (minutes < -840 || minutes > 840) return null;
  return minutes;
}

/* -------------------------------------------------------------------------- */
/* Machines                                                                    */
/* -------------------------------------------------------------------------- */

export type MachineFilters = {
  /** Free text across machine_id, name and location. */
  search: string;
  status: MachineStatus | null;
  location: string;
  type: string;
};

export function readMachineFilters(params: SearchParams): MachineFilters {
  return {
    search: readParam(params, 'search').slice(0, 80),
    status: readEnum(params, 'status', MACHINE_STATUSES),
    location: readParam(params, 'location').slice(0, 200),
    type: readParam(params, 'type').slice(0, 120),
  };
}

export function machineFilterCount(filters: MachineFilters): number {
  return [filters.search, filters.status, filters.location, filters.type].filter(Boolean).length;
}

/**
 * ilike needs the caller's text escaped, otherwise a literal % or _ becomes a
 * wildcard and the filter matches far more than the operator asked for.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/* -------------------------------------------------------------------------- */
/* Alarms                                                                      */
/* -------------------------------------------------------------------------- */

export type AlarmFilters = {
  search: string;
  status: AlarmStatus | null;
  /** Machine UUID, from the dropdown. */
  machineId: string;
  from: string | null;
  to: string | null;
};

export function readAlarmFilters(params: SearchParams): AlarmFilters {
  return {
    search: readParam(params, 'search').slice(0, 80),
    status: readEnum(params, 'status', ALARM_STATUSES),
    // A uuid is 36 chars; rejecting anything else keeps odd values out of the
    // equality filter.
    machineId: /^[0-9a-f-]{36}$/i.test(readParam(params, 'machine_id'))
      ? readParam(params, 'machine_id')
      : '',
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

export function alarmFilterCount(filters: AlarmFilters): number {
  return [filters.search, filters.status, filters.machineId, filters.from, filters.to].filter(
    Boolean,
  ).length;
}

/**
 * Inclusive on both ends, widened to cover the whole of the `to` day.
 *
 * `tz` is the operator's UTC offset in minutes, measured *ahead* of UTC (so
 * UTC+7 is 420), which is what the client sends as `-getTimezoneOffset()`.
 * It is sent because the date inputs mean a calendar day in the operator's own
 * timezone: without it, a Bangkok operator filtering 29 Sep would silently get
 * 07:00 on the 29th through 07:00 on the 30th, which is seven hours wrong on
 * both ends. When it is absent the bounds fall back to UTC.
 */
function offsetSuffix(tz: number | null): string {
  if (tz === null) return 'Z';
  // Positive is east of UTC, so the sign maps straight through.
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

export function rangeStart(from: string | null, tz: number | null = null): string | null {
  return from ? `${from}T00:00:00${offsetSuffix(tz)}` : null;
}

export function rangeEnd(to: string | null, tz: number | null = null): string | null {
  return to ? `${to}T23:59:59.999${offsetSuffix(tz)}` : null;
}

/* -------------------------------------------------------------------------- */
/* Maintenance                                                                 */
/* -------------------------------------------------------------------------- */

export type MaintenanceFilters = {
  search: string;
  status: MaintenanceStatus | null;
  machineId: string;
  /** Technician UUID, from the dropdown. */
  technicianId: string;
  from: string | null;
  to: string | null;
};

export function readMaintenanceFilters(params: SearchParams): MaintenanceFilters {
  return {
    search: readParam(params, 'search').slice(0, 80),
    status: readEnum(params, 'status', MAINTENANCE_STATUSES),
    machineId: /^[0-9a-f-]{36}$/i.test(readParam(params, 'machine_id'))
      ? readParam(params, 'machine_id')
      : '',
    technicianId: /^[0-9a-f-]{36}$/i.test(readParam(params, 'technician_id'))
      ? readParam(params, 'technician_id')
      : '',
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

export function maintenanceFilterCount(filters: MaintenanceFilters): number {
  return [
    filters.search,
    filters.status,
    filters.machineId,
    filters.technicianId,
    filters.from,
    filters.to,
  ].filter(Boolean).length;
}

/** Serialises filters back to a query string, dropping empty values. */
export function toQueryString(filters: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
