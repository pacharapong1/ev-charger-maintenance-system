'use client';

import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, X } from 'lucide-react';
import { createMaintenance, updateMaintenance } from '@/app/maintenance/actions';
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABEL } from '@/lib/constants';
import type { MaintenanceStatus } from '@/lib/supabase/types';
import {
  initialActionState,
  type ActionState,
  type FieldErrors,
} from '@/lib/validation';
import { machineLabel, type AlarmOption, type MachineOption } from '@/lib/options';
import { Field } from '@/components/ui/Field';
import { SubmitButton, useActionToast } from '@/components/ui/SubmitButton';

export type MaintenanceValues = {
  machineId: string;
  alarmId: string;
  actionTaken: string;
  status: MaintenanceStatus;
};

/**
 * The two linked selects.
 *
 * Picking a machine narrows the alarm list to that machine's own alarms, which
 * is not just convenience: maintenance_records references alarms (id, machine_id)
 * as a composite key, so a mismatched pair is rejected by the database. Making
 * the mismatch impossible to pick removes a whole class of confusing errors.
 *
 * Both values are mirrored into hidden inputs, since controlled selects are
 * re-rendered from state and the state is what actually gets posted.
 */
function LinkFields({
  machines,
  alarms,
  machineId,
  alarmId,
  compact,
  fieldErrors,
  alarmErrorId,
  machineErrorId,
  onChange,
}: {
  machines: MachineOption[];
  alarms: AlarmOption[];
  machineId: string;
  alarmId: string;
  compact?: boolean;
  fieldErrors: FieldErrors | null;
  machineErrorId: string;
  alarmErrorId: string;
  onChange: (field: 'machine_id' | 'alarm_id', value: string) => void;
}) {
  const machineAlarms = useMemo(
    () => alarms.filter((alarm) => alarm.machineUuid === machineId),
    [alarms, machineId],
  );

  const size = compact ? 'py-1.5 text-xs' : '';

  return (
    <>
      <Field
        label="เครื่องจักร *"
        name="machine_id"
        errors={fieldErrors}
        className={compact ? 'lg:col-span-2' : undefined}
      >
        <select
          value={machineId}
          onChange={(event) => onChange('machine_id', event.target.value)}
          className={`field ${size}`}
          aria-invalid={Boolean(fieldErrors?.machine_id)}
          aria-describedby={fieldErrors?.machine_id ? machineErrorId : undefined}
        >
          <option value="">เลือกเครื่องจักร</option>
          {machines.map((option) => (
            <option key={option.id} value={option.id}>
              {machineLabel(option)}
            </option>
          ))}
        </select>
        <input type="hidden" name="machine_id" value={machineId} />
      </Field>

      <Field
        label="Alarm ที่เกี่ยวข้อง"
        name="alarm_id"
        errors={fieldErrors}
        className={compact ? 'lg:col-span-2' : undefined}
      >
        <select
          value={alarmId}
          onChange={(event) => onChange('alarm_id', event.target.value)}
          // Disabled once a machine is chosen with no alarms, because the only
          // valid thing to pick is "no alarm" and the blank option says that.
          disabled={!machineId}
          className={`field ${size}`}
          aria-invalid={Boolean(fieldErrors?.alarm_id)}
          aria-describedby={fieldErrors?.alarm_id ? alarmErrorId : undefined}
        >
          <option value="">ไม่ผูกกับ Alarm</option>
          {machineAlarms.map((alarm) => (
            <option key={alarm.id} value={alarm.id}>
              {alarm.alarmCode}
            </option>
          ))}
        </select>
        <input type="hidden" name="alarm_id" value={alarmId} />
      </Field>
    </>
  );
}

/** Admin and Technician. A log entry is attributed to the signed-in user. */
export function CreateMaintenanceForm({
  machines,
  alarms,
}: {
  machines: MachineOption[];
  alarms: AlarmOption[];
}) {
  const notify = useActionToast();
  const [machineId, setMachineId] = useState('');
  const [alarmId, setAlarmId] = useState('');

  function handleChange(field: 'machine_id' | 'alarm_id', value: string) {
    if (field === 'machine_id') {
      setMachineId(value);
      // The old alarm belonged to the previous machine, so it cannot stay
      // selected; the server would reject the pair.
      setAlarmId('');
      return;
    }
    setAlarmId(value);
  }

  const [state, formAction] = useFormState(
    async (prev: ActionState, formData: FormData) =>
      notify(await createMaintenance(prev, formData)),
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <LinkFields
        machines={machines}
        alarms={alarms}
        machineId={machineId}
        alarmId={alarmId}
        fieldErrors={state.fieldErrors}
        machineErrorId="machine_id-error"
        alarmErrorId="alarm_id-error"
        onChange={handleChange}
      />

      <Field label="สถานะ *" name="status" errors={state.fieldErrors}>
        <select id="create-status" name="status" defaultValue="In Progress" className="field">
          {MAINTENANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {MAINTENANCE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="รายละเอียดงาน *"
        name="action_taken"
        errors={state.fieldErrors}
        className="sm:col-span-2"
      >
        <textarea
          id="create-action_taken"
          name="action_taken"
          rows={2}
          placeholder="เช่น ถอดชุดล็อกหัวต่อ ทำความสะอาดราง และใส่น้ำมันใหม่"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.action_taken)}
          aria-describedby={state.fieldErrors?.action_taken ? 'action_taken-error' : undefined}
          required
        />
      </Field>

      <div className="flex items-end gap-2 pb-0.5 sm:col-span-2 lg:col-span-3">
        <SubmitButton label="บันทึกงาน" pendingLabel="กำลังบันทึก..." icon={Plus} />
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

/** Expands in place of the table row it edits. */
export function EditMaintenanceForm({
  recordUuid,
  values,
  machines,
  alarms,
  onDone,
}: {
  recordUuid: string;
  values: MaintenanceValues;
  machines: MachineOption[];
  alarms: AlarmOption[];
  onDone: () => void;
}) {
  const notify = useActionToast();
  const router = useRouter();
  const [machineId, setMachineId] = useState(values.machineId);
  const [alarmId, setAlarmId] = useState(values.alarmId);

  function handleChange(field: 'machine_id' | 'alarm_id', value: string) {
    if (field === 'machine_id') {
      setMachineId(value);
      setAlarmId('');
      return;
    }
    setAlarmId(value);
  }

  const [state, formAction] = useFormState(
    async (prev: ActionState, formData: FormData) => {
      const result = notify(await updateMaintenance(recordUuid, prev, formData));
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
      <LinkFields
        machines={machines}
        alarms={alarms}
        machineId={machineId}
        alarmId={alarmId}
        compact
        fieldErrors={state.fieldErrors}
        machineErrorId={`${recordUuid}-machine_id-error`}
        alarmErrorId={`${recordUuid}-alarm_id-error`}
        onChange={handleChange}
      />

      <Field
        label="สถานะ *"
        name="status"
        htmlFor={`${recordUuid}-status`}
        errors={state.fieldErrors}
      >
        <select
          id={`${recordUuid}-status`}
          name="status"
          defaultValue={values.status}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          {MAINTENANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {MAINTENANCE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="รายละเอียดงาน *"
        name="action_taken"
        htmlFor={`${recordUuid}-action_taken`}
        errors={state.fieldErrors}
        className="sm:col-span-2 lg:col-span-6"
      >
        <textarea
          id={`${recordUuid}-action_taken`}
          name="action_taken"
          rows={2}
          defaultValue={values.actionTaken}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.action_taken)}
          aria-describedby={
            state.fieldErrors?.action_taken ? `${recordUuid}-action_taken-error` : undefined
          }
          required
        />
      </Field>

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
