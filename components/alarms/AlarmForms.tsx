'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, X } from 'lucide-react';
import { createAlarm, updateAlarm } from '@/app/alarms/actions';
import { ALARM_STATUSES, ALARM_STATUS_LABEL } from '@/lib/constants';
import type { AlarmStatus } from '@/lib/supabase/types';
import { initialActionState, type ActionState } from '@/lib/validation';
import { Field } from '@/components/ui/Field';
import { SubmitButton, useActionToast } from '@/components/ui/SubmitButton';
import { machineLabel, type MachineOption } from '@/lib/options';

export type { MachineOption } from '@/lib/options';

export type AlarmValues = {
  machineId: string;
  alarmCode: string;
  description: string;
  cause: string;
  status: AlarmStatus;
  /**
   * Kept as strings because the inputs are uncontrolled (defaultValue) and a
   * null reading has to render as an empty box, not the text "null".
   */
  voltagePeak: string;
  temperaturePeak: string;
  currentPeak: string;
};

/**
 * The three peak telemetry inputs, shared by the create and edit forms.
 *
 * Deliberately optional: most rows predate the columns and not every station
 * reports all three channels, and a blank means "unknown" to the analyzer
 * rather than zero. min/max mirror the CHECK constraints so the browser catches
 * an out-of-range value before the round trip.
 */
function TelemetryFields({
  idPrefix,
  values,
  compact,
  fieldErrors,
}: {
  idPrefix: string;
  values?: AlarmValues;
  compact?: boolean;
  fieldErrors: Record<string, string> | null;
}) {
  const fields = [
    {
      name: 'voltage_peak',
      label: 'แรงดันสูงสุด (V)',
      placeholder: 'เช่น 402.5',
      step: '0.01',
      min: '0',
      max: '1500',
      value: values?.voltagePeak,
    },
    {
      name: 'temperature_peak',
      label: 'อุณหภูมิสูงสุด (°C)',
      placeholder: 'เช่น 68.4',
      step: '0.1',
      min: '-50',
      max: '250',
      value: values?.temperaturePeak,
    },
    {
      name: 'current_peak',
      label: 'กระแสสูงสุด (A)',
      placeholder: 'เช่น 63.0',
      step: '0.1',
      min: '0',
      max: '1000',
      value: values?.currentPeak,
    },
  ] as const;

  return (
    <>
      {fields.map((field) => {
        const inputId = `${idPrefix}-${field.name}`;
        const errorId = `${inputId}-error`;
        const hasError = Boolean(fieldErrors?.[field.name]);

        return (
          <Field
            key={field.name}
            label={field.label}
            name={field.name}
            htmlFor={inputId}
            errors={fieldErrors}
          >
            <input
              id={inputId}
              name={field.name}
              type="number"
              inputMode="decimal"
              step={field.step}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder}
              defaultValue={field.value}
              className={`field ${compact ? 'py-1.5 text-xs' : ''}`}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : undefined}
            />
          </Field>
        );
      })}
    </>
  );
}

/**
 * Machine picker, mirrored into a hidden input.
 *
 * A controlled <select> re-renders from state, and relying on its own name
 * attribute to reach FormData is fragile here because several rows can render
 * the same field at once. The selection lives in the form's state, which is not
 * remounted by a rejected submit, so the form still shows what was picked.
 */
function MachineSelect({
  value,
  onChange,
  options,
  compact,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  options: MachineOption[];
  compact?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`field ${compact ? 'py-1.5 text-xs' : ''}`}
      aria-invalid={invalid}
      aria-describedby={describedBy}
    >
      <option value="">เลือกเครื่องจักร</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {machineLabel(option)}
        </option>
      ))}
    </select>
  );
}

/** Admin only: raising a new alarm. */
export function CreateAlarmForm({ machines }: { machines: MachineOption[] }) {
  const notify = useActionToast();
  const [machineId, setMachineId] = useState('');

  const [state, formAction] = useFormState(
    async (prev: ActionState, formData: FormData) => notify(await createAlarm(prev, formData)),
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label="เครื่องจักร *" name="machine_id" errors={state.fieldErrors}>
        <MachineSelect
          value={machineId}
          onChange={setMachineId}
          options={machines}
          invalid={Boolean(state.fieldErrors?.machine_id)}
          describedBy={state.fieldErrors?.machine_id ? 'machine_id-error' : undefined}
        />
        <input type="hidden" name="machine_id" value={machineId} />
      </Field>

      <Field label="รหัส Alarm *" name="alarm_code" errors={state.fieldErrors}>
        <input
          id="create-alarm_code"
          name="alarm_code"
          placeholder="เช่น ERR-CABLE-01"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.alarm_code)}
          aria-describedby={state.fieldErrors?.alarm_code ? 'alarm_code-error' : undefined}
          required
        />
      </Field>

      <Field label="สถานะ *" name="status" errors={state.fieldErrors}>
        <select id="create-status" name="status" defaultValue="Open" className="field">
          {ALARM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ALARM_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="รายละเอียด *"
        name="description"
        errors={state.fieldErrors}
        className="sm:col-span-2"
      >
        <input
          id="create-description"
          name="description"
          placeholder="เช่น หัวต่อสายชาร์จไม่ล็อกกับหัวข้างรถ"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.description)}
          aria-describedby={state.fieldErrors?.description ? 'description-error' : undefined}
          required
        />
      </Field>

      <Field label="สาเหตุ" name="cause" errors={state.fieldErrors}>
        <input
          id="create-cause"
          name="cause"
          placeholder="เช่น หัวต่อชำรุด"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.cause)}
          aria-describedby={state.fieldErrors?.cause ? 'cause-error' : undefined}
        />
      </Field>

      <div className="sm:col-span-2 lg:col-span-3">
        <p className="mb-1 text-xs text-ink-subtle dark:text-slate-500">
          ค่าที่วัดได้ตอนเกิด Alarm (ไม่บังคับ) ใช้ประกอบการวิเคราะห์ด้วย AI
        </p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-3">
          <TelemetryFields
            idPrefix="create"
            fieldErrors={state.fieldErrors}
          />
        </div>
      </div>

      <div className="flex items-end gap-2 pb-0.5 sm:col-span-2 lg:col-span-3">
        <SubmitButton label="เปิด Alarm" pendingLabel="กำลังเพิ่ม..." icon={Plus} />
        {state.error ? (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Admin only. Technicians move an alarm through its states with the quick
 * select in the table, so the full editor is only for correcting the record.
 */
export function EditAlarmForm({
  alarmUuid,
  values,
  machines,
  onDone,
}: {
  alarmUuid: string;
  values: AlarmValues;
  machines: MachineOption[];
  onDone: () => void;
}) {
  const notify = useActionToast();
  const router = useRouter();
  const [machineId, setMachineId] = useState(values.machineId);

  const [state, formAction] = useFormState(
    async (prev: ActionState, formData: FormData) => {
      const result = notify(await updateAlarm(alarmUuid, prev, formData));
      if (result.ok) {
        onDone();
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="grid w-full grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-6"
    >
      <Field
        label="เครื่องจักร *"
        name="machine_id"
        errors={state.fieldErrors}
        className="lg:col-span-2"
      >
        <MachineSelect
          value={machineId}
          onChange={setMachineId}
          options={machines}
          compact
          invalid={Boolean(state.fieldErrors?.machine_id)}
          describedBy={
            state.fieldErrors?.machine_id ? `${alarmUuid}-machine_id-error` : undefined
          }
        />
        <input type="hidden" name="machine_id" value={machineId} />
      </Field>

      <Field
        label="รหัส *"
        name="alarm_code"
        htmlFor={`${alarmUuid}-alarm_code`}
        errors={state.fieldErrors}
      >
        <input
          id={`${alarmUuid}-alarm_code`}
          name="alarm_code"
          defaultValue={values.alarmCode}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.alarm_code)}
          aria-describedby={
            state.fieldErrors?.alarm_code ? `${alarmUuid}-alarm_code-error` : undefined
          }
          required
        />
      </Field>

      <Field
        label="รายละเอียด *"
        name="description"
        htmlFor={`${alarmUuid}-description`}
        errors={state.fieldErrors}
      >
        <input
          id={`${alarmUuid}-description`}
          name="description"
          defaultValue={values.description}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.description)}
          aria-describedby={
            state.fieldErrors?.description ? `${alarmUuid}-description-error` : undefined
          }
          required
        />
      </Field>

      <Field label="สาเหตุ" name="cause" htmlFor={`${alarmUuid}-cause`} errors={state.fieldErrors}>
        <input
          id={`${alarmUuid}-cause`}
          name="cause"
          defaultValue={values.cause}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.cause)}
          aria-describedby={state.fieldErrors?.cause ? `${alarmUuid}-cause-error` : undefined}
        />
      </Field>

      <Field label="สถานะ *" name="status" htmlFor={`${alarmUuid}-status`} errors={state.fieldErrors}>
        <select
          id={`${alarmUuid}-status`}
          name="status"
          defaultValue={values.status}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          {ALARM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ALARM_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      {/* The three readings travel with the form. Without them the action would
          write null over whatever was stored, and saving a description typo
          would silently destroy the telemetry the AI analyzer depends on. */}
      <div className="flex flex-wrap gap-x-3 sm:col-span-2 lg:col-span-6">
        <TelemetryFields
          idPrefix={alarmUuid}
          values={values}
          compact
          fieldErrors={state.fieldErrors}
        />
      </div>

      <div className="flex items-center gap-1.5 pb-0.5 sm:col-span-2 lg:col-span-6">
        <SubmitButton label="บันทึก" pendingLabel="กำลังบันทึก..." className="btn btn-sm" />
        <button type="button" className="btn btn-sm" onClick={onDone}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          ยกเลิก
        </button>
        {state.error ? (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
