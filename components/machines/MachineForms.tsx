'use client';

import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createMachine, updateMachine } from '@/app/machines/actions';
import { MACHINE_STATUSES, MACHINE_STATUS_LABEL } from '@/lib/constants';
import type { MachineStatus } from '@/lib/supabase/types';
import { initialActionState, type ActionState } from '@/lib/validation';
import { Field } from '@/components/ui/Field';
import { SubmitButton, useActionToast } from '@/components/ui/SubmitButton';

export type MachineValues = {
  machineId: string;
  name: string;
  type: string;
  location: string;
  status: MachineStatus;
};

/** Admin only: the create form, rendered above the table. */
export function CreateMachineForm() {
  const notify = useActionToast();
  const [state, formAction] = useFormState(
    async (prev: ActionState, formData: FormData) => notify(await createMachine(prev, formData)),
    initialActionState,
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label="รหัสเครื่องจักร *" name="machine_id" errors={state.fieldErrors}>
        <input
          id="machine_id"
          name="machine_id"
          placeholder="เช่น EVB-01"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.machine_id)}
          aria-describedby={state.fieldErrors?.machine_id ? 'machine_id-error' : undefined}
          required
        />
      </Field>

      <Field label="ชื่อเครื่องจักร *" name="name" errors={state.fieldErrors}>
        <input
          id="name"
          name="name"
          placeholder="เช่น ตู้ชาร์จ DC ชั้น 2"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={state.fieldErrors?.name ? 'name-error' : undefined}
          required
        />
      </Field>

      <Field label="ประเภท *" name="type" errors={state.fieldErrors}>
        <input
          id="type"
          name="type"
          placeholder="เช่น DC Fast Charger 150kW"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.type)}
          aria-describedby={state.fieldErrors?.type ? 'type-error' : undefined}
          required
        />
      </Field>

      <Field label="สถานที่ตั้ง" name="location" errors={state.fieldErrors}>
        <input
          id="location"
          name="location"
          placeholder="เช่น ห้างเซ็นทรัล รัชดา ชั้น 3"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.location)}
          aria-describedby={state.fieldErrors?.location ? 'location-error' : undefined}
        />
      </Field>

      <Field label="สถานะ *" name="status" errors={state.fieldErrors}>
        <select
          id="status"
          name="status"
          defaultValue="Stop"
          className="field"
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          {MACHINE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {MACHINE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-end pb-0.5">
        <SubmitButton label="เพิ่มเครื่องจักร" pendingLabel="กำลังเพิ่ม..." icon={Plus} />
      </div>
    </form>
  );
}

/** Admin only. Expands in place of the table row it edits. */
export function EditMachineForm({
  machineUuid,
  values,
  onDone,
}: {
  machineUuid: string;
  values: MachineValues;
  onDone: () => void;
}) {
  const notify = useActionToast();
  const router = useRouter();
  // Unique per row so the DOM ids used by htmlFor and aria-describedby never
  // collide when several editors are open at once.
  const uid = machineUuid;

  const [state, formAction] = useFormState(
    async (prev: ActionState, formData: FormData) => {
      const result = notify(await updateMachine(machineUuid, prev, formData));
      if (result.ok) {
        onDone();
        // The row contents come from the server, so pull a fresh copy of the
        // list rather than trying to patch it locally.
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
      <Field label="รหัส *" name="machine_id" htmlFor={`${uid}-machine_id`} errors={state.fieldErrors}>
        <input
          id={`${uid}-machine_id`}
          name="machine_id"
          defaultValue={values.machineId}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.machine_id)}
          aria-describedby={state.fieldErrors?.machine_id ? `${uid}-machine_id-error` : undefined}
          required
        />
      </Field>

      <Field label="ชื่อ *" name="name" htmlFor={`${uid}-name`} errors={state.fieldErrors}>
        <input
          id={`${uid}-name`}
          name="name"
          defaultValue={values.name}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={state.fieldErrors?.name ? `${uid}-name-error` : undefined}
          required
        />
      </Field>

      <Field label="ประเภท *" name="type" htmlFor={`${uid}-type`} errors={state.fieldErrors}>
        <input
          id={`${uid}-type`}
          name="type"
          defaultValue={values.type}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.type)}
          aria-describedby={state.fieldErrors?.type ? `${uid}-type-error` : undefined}
          required
        />
      </Field>

      <Field label="สถานที่ตั้ง" name="location" htmlFor={`${uid}-location`} errors={state.fieldErrors}>
        <input
          id={`${uid}-location`}
          name="location"
          defaultValue={values.location}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.location)}
          aria-describedby={state.fieldErrors?.location ? `${uid}-location-error` : undefined}
        />
      </Field>

      <Field label="สถานะ *" name="status" htmlFor={`${uid}-status`} errors={state.fieldErrors}>
        <select
          id={`${uid}-status`}
          name="status"
          defaultValue={values.status}
          className="field py-1.5 text-xs"
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          {MACHINE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {MACHINE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-end gap-1.5 pb-0.5">
        <SubmitButton label="บันทึก" pendingLabel="กำลังบันทึก..." className="btn btn-sm" />
        <button type="button" className="btn btn-sm" onClick={onDone}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          ยกเลิก
        </button>
        {state.error ? (
          <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
