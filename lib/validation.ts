import {
  ALARM_STATUSES,
  MAINTENANCE_STATUSES,
  MACHINE_STATUSES,
} from './constants';
import type { AlarmStatus, MachineStatus, MaintenanceStatus } from './supabase/types';

/**
 * Shared form validation and the result shape returned by every server action.
 *
 * IMPORTANT: this is a UX layer. It exists so the operator gets a specific,
 * actionable message before a round trip, and so the form can highlight the
 * offending field. It is never the security boundary: the NOT NULL, UNIQUE and
 * CHECK constraints in 01_schema.sql are, and the action code still handles
 * their error codes because a concurrent request can slip past any pre-check.
 */

export type FieldErrors = Record<string, string>;

export type ActionState = {
  /** Human readable message, shown in a toast. */
  error: string | null;
  /** Human readable success message, shown in a toast. */
  ok: string | null;
  /** Per-field messages, shown inline next to the input. */
  fieldErrors: FieldErrors | null;
};

export const initialActionState: ActionState = {
  error: null,
  ok: null,
  fieldErrors: null,
};

/**
 * text columns have no length limit in Postgres, so these caps are a guard
 * against pasting an entire log file into a name field rather than a schema
 * requirement. They are deliberately generous.
 */
const MAX = {
  machineId: 40,
  name: 120,
  type: 120,
  location: 200,
  alarmCode: 60,
  description: 500,
  cause: 500,
  actionTaken: 2000,
};

/**
 * Station codes are operator-facing labels, so restrict them to a predictable
 * alphabet. This also stops two stations being named "EVB-01" and "EVB 01",
 * which look identical on a dashboard and are impossible to tell apart later.
 */
const MACHINE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function required(
  errors: FieldErrors,
  key: string,
  value: string,
  label: string,
  max: number,
): boolean {
  if (!value) {
    errors[key] = `กรุณากรอก${label}`;
    return false;
  }
  if (value.length > max) {
    errors[key] = `${label}ต้องไม่เกิน ${max} ตัวอักษร`;
    return false;
  }
  return true;
}

export type MachineInput = {
  machineId: string;
  name: string;
  type: string;
  location: string | null;
  status: MachineStatus;
};

export function validateMachine(
  formData: FormData,
  { requireStatus = true }: { requireStatus?: boolean } = {},
): { ok: true; value: MachineInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};

  const machineId = text(formData, 'machine_id');
  const name = text(formData, 'name');
  const type = text(formData, 'type');
  const location = text(formData, 'location');
  const status = text(formData, 'status') as MachineStatus;

  const idOk = required(errors, 'machine_id', machineId, 'รหัสเครื่องจักร', MAX.machineId);
  if (idOk && !MACHINE_ID_PATTERN.test(machineId)) {
    errors.machine_id =
      'รหัสเตรื่องจักรใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ . _ - (ห้ามมีช่องว่าง)';
  }

  required(errors, 'name', name, 'ชื่อเครื่องจักร', MAX.name);
  required(errors, 'type', type, 'ประเภทเครื่องจักร', MAX.type);

  if (location.length > MAX.location) {
    errors.location = `สถานที่ตั้งต้องไม่เกิน ${MAX.location} ตัวอักษร`;
  }

  if (requireStatus && !MACHINE_STATUSES.includes(status)) {
    errors.status = 'กรุณาเลือกสถานะที่ถูกต้อง';
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    value: {
      machineId,
      name,
      type,
      // Empty string is stored as NULL, not '', so "no location" and "a location
      // that happens to be blank" cannot become two different states.
      location: location || null,
      status,
    },
  };
}

/**
 * Peak telemetry ranges, matching the CHECK constraints in 01_schema.sql.
 *
 * These are duplicated on purpose. The database is the authority, but catching a
 * typo here means the operator is told which reading is impossible instead of
 * getting a generic constraint error after a round trip.
 */
const TELEMETRY_RANGE = {
  voltage_peak: { min: 0, max: 1500, label: 'แรงดันสูงสุด', unit: 'โวลต์' },
  temperature_peak: { min: -50, max: 250, label: 'อุณหภูมิสูงสุด', unit: 'องศาเซลเซียส' },
  current_peak: { min: 0, max: 1000, label: 'กระแสสูงสุด', unit: 'แอมป์' },
} as const;

type TelemetryKey = keyof typeof TELEMETRY_RANGE;

const TELEMETRY_KEYS = Object.keys(TELEMETRY_RANGE) as TelemetryKey[];

export type AlarmInput = {
  machineId: string;
  alarmCode: string;
  description: string;
  cause: string | null;
  status: AlarmStatus;
  voltagePeak: number | null;
  temperaturePeak: number | null;
  currentPeak: number | null;
};

/**
 * Parses an optional telemetry reading.
 *
 * A blank field is a legitimate "not reported" state, not a zero, so it becomes
 * null and the analyzer reports the channel as unknown. Rejecting rather than
 * silently coercing matters here: Number('') is 0 and Number('abc') is NaN, and
 * a 0 V peak would read as a dead station to the model.
 */
function optionalNumber(
  errors: FieldErrors,
  key: TelemetryKey,
  raw: string,
): number | null {
  if (!raw) return null;

  // Reject '12abc' and '1e5', which Number() would happily accept.
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    errors[key] = `${TELEMETRY_RANGE[key].label}ต้องเป็นตัวเลข`;
    return null;
  }

  const value = Number(raw);
  const { min, max, label, unit } = TELEMETRY_RANGE[key];
  if (value < min || value > max) {
    errors[key] = `${label}ต้องอยู่ระหว่าง ${min} ถึง ${max} ${unit}`;
    return null;
  }
  return value;
}

export function validateAlarm(
  formData: FormData,
): { ok: true; value: AlarmInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};

  const machineId = text(formData, 'machine_id');
  const alarmCode = text(formData, 'alarm_code');
  const description = text(formData, 'description');
  const cause = text(formData, 'cause');
  const status = text(formData, 'status') as AlarmStatus;

  if (required(errors, 'machine_id', machineId, 'เครื่องจักร', 64)) {
    // A uuid is 36 chars, so anything much longer is not a real id.
    if (machineId.length > 64) errors.machine_id = 'รหัสเครื่องจักรไม่ถูกต้อง';
  }

  if (required(errors, 'alarm_code', alarmCode, 'รหัส Alarm', MAX.alarmCode)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(alarmCode)) {
      errors.alarm_code = 'รหัส Alarm ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ . _ -';
    }
  }

  required(errors, 'description', description, 'รายละเอียด', MAX.description);

  if (cause.length > MAX.cause) {
    errors.cause = `สาเหตุต้องไม่เกิน ${MAX.cause} ตัวอักษร`;
  }

  if (!ALARM_STATUSES.includes(status)) {
    errors.status = 'กรุณาเลือกสถานะที่ถูกต้อง';
  }

  const telemetry = {} as Record<TelemetryKey, number | null>;
  for (const key of TELEMETRY_KEYS) {
    telemetry[key] = optionalNumber(errors, key, text(formData, key));
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    value: {
      machineId,
      alarmCode,
      description,
      cause: cause || null,
      status,
      voltagePeak: telemetry.voltage_peak,
      temperaturePeak: telemetry.temperature_peak,
      currentPeak: telemetry.current_peak,
    },
  };
}

export type MaintenanceInput = {
  alarmId: string | null;
  machineId: string;
  actionTaken: string;
  status: MaintenanceStatus;
};

export function validateMaintenance(
  formData: FormData,
): { ok: true; value: MaintenanceInput } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};

  const machineId = text(formData, 'machine_id');
  const alarmId = text(formData, 'alarm_id');
  const actionTaken = text(formData, 'action_taken');
  const status = text(formData, 'status') as MaintenanceStatus;

  if (required(errors, 'machine_id', machineId, 'เครื่องจักร', 64)) {
    if (machineId.length > 64) errors.machine_id = 'รหัสเครื่องจักรไม่ถูกต้อง';
  }

  if (alarmId.length > 64) {
    errors.alarm_id = 'รหัส Alarm ไม่ถูกต้อง';
  }

  if (!MAINTENANCE_STATUSES.includes(status)) {
    errors.status = 'กรุณาเลือกสถานะที่ถูกต้อง';
  }

  required(errors, 'action_taken', actionTaken, 'รายละเอียดงาน', MAX.actionTaken);

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    value: {
      // An empty select means "not linked to an alarm", which is a legitimate
      // state, so this is nullable rather than required.
      alarmId: alarmId || null,
      machineId,
      actionTaken,
      status,
    },
  };
}

/** Rejects a range whose end precedes its start, which would silently match nothing. */
export function validateDateRange(from: string, to: string): string | null {
  if (!from || !to) return null;
  if (from > to) return 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด';
  return null;
}

/** yyyy-mm-dd, validated before it is interpolated into a PostgREST filter. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
