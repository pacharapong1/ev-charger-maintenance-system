'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MACHINE_STATUSES, MACHINE_STATUS_LABEL } from '@/lib/constants';
import type { MachineStatus } from '@/lib/supabase/types';
import {
  initialActionState,
  validateMachine,
  type ActionState,
} from '@/lib/validation';

/**
 * Every action re-checks the role on the server before touching data. The
 * buttons hidden in the UI are convenience only, never the enforcement point: a
 * crafted request still has to clear this guard and the RLS policy.
 *
 * Each returns ActionState rather than throwing, so the client can surface the
 * message as both a toast and an inline field error.
 */

function revalidateMachines() {
  revalidatePath('/machines');
  revalidatePath('/alarms');
  revalidatePath('/maintenance');
  // The dashboard aggregates these tables, so its counts and charts go stale too.
  revalidatePath('/dashboard');
}

/** Postgres unique violation. */
const UNIQUE_VIOLATION = '23505';

export async function createMachine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission('manageMachines');

  const parsed = validateMachine(formData);
  if (!parsed.ok) {
    return { ...initialActionState, error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fieldErrors: parsed.fieldErrors };
  }

  const { machineId, name, type, location, status } = parsed.value;
  const supabase = createClient();

  // Friendly pre-check. The UNIQUE constraint below is still the real guarantee,
  // because two admins submitting the same new id at the same moment can both
  // pass this lookup and then race to the insert. This check only exists to turn
  // the common case into a clear message instead of a raw constraint error.
  const { data: existing } = await supabase
    .from('machines')
    .select('machine_id')
    .eq('machine_id', machineId)
    .maybeSingle();

  if (existing) {
    return {
      ...initialActionState,
      error: `รหัสเครื่องจักร ${machineId} ถูกใช้งานแล้ว`,
      fieldErrors: { machine_id: 'รหัสนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
    };
  }

  const { error } = await supabase.from('machines').insert({
    machine_id: machineId,
    name,
    type,
    location,
    status,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      // The race described above landed here.
      return {
        ...initialActionState,
        error: `รหัสเครื่องจักร ${machineId} ถูกใช้งานแล้ว`,
        fieldErrors: { machine_id: 'รหัสนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
      };
    }
    console.error('createMachine failed', error);
    return { ...initialActionState, error: `เพิ่มไม่สำเร็จ: ${error.message}` };
  }

  revalidateMachines();
  return { ...initialActionState, ok: `เพิ่มเครื่องจักร ${machineId} แล้ว` };
}

export async function updateMachine(
  machineUuid: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission('manageMachines');

  if (!machineUuid) {
    return { ...initialActionState, error: 'ไม่พบเครื่องจักร' };
  }

  const parsed = validateMachine(formData);
  if (!parsed.ok) {
    return { ...initialActionState, error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fieldErrors: parsed.fieldErrors };
  }

  const { machineId, name, type, location, status } = parsed.value;
  const supabase = createClient();

  // Changing the id is allowed, but it must not collide with a different row.
  // The is('id', machineUuid) clause pins the check to this machine, so a save
  // that does not rename never trips it.
  const { data: clash } = await supabase
    .from('machines')
    .select('machine_id')
    .eq('machine_id', machineId)
    .neq('id', machineUuid)
    .maybeSingle();

  if (clash) {
    return {
      ...initialActionState,
      error: `รหัสเครื่องจักร ${machineId} ถูกใช้งานแล้ว`,
      fieldErrors: { machine_id: 'รหัสนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
    };
  }

  const { error } = await supabase
    .from('machines')
    .update({ machine_id: machineId, name, type, location, status })
    .eq('id', machineUuid);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ...initialActionState,
        error: `รหัสเครื่องจักร ${machineId} ถูกใช้งานแล้ว`,
        fieldErrors: { machine_id: 'รหัสนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น' },
      };
    }
    console.error('updateMachine failed', error);
    return { ...initialActionState, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  revalidateMachines();
  return { ...initialActionState, ok: `บันทึกเครื่องจักร ${machineId} แล้ว` };
}

export async function setMachineStatus(
  machineUuid: string,
  status: MachineStatus,
): Promise<ActionState> {
  await requirePermission('manageMachines');

  if (!machineUuid) return { ...initialActionState, error: 'ไม่พบเครื่องจักร' };
  if (!MACHINE_STATUSES.includes(status)) {
    return { ...initialActionState, error: 'สถานะไม่ถูกต้อง' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('machines')
    .update({ status })
    .eq('id', machineUuid);

  if (error) {
    console.error('setMachineStatus failed', error);
    return { ...initialActionState, error: `อัปเดตไม่สำเร็จ: ${error.message}` };
  }

  revalidateMachines();
  return { ...initialActionState, ok: `เปลี่ยนสถานะเป็น ${MACHINE_STATUS_LABEL[status]} แล้ว` };
}

export async function deleteMachine(machineUuid: string): Promise<ActionState> {
  await requirePermission('manageMachines');

  if (!machineUuid) return { ...initialActionState, error: 'ไม่พบเครื่องจักร' };

  const supabase = createClient();
  const { error } = await supabase.from('machines').delete().eq('id', machineUuid);

  if (error) {
    // machines -> alarms is ON DELETE CASCADE, but maintenance_records holds a
    // composite FK to alarms ON DELETE RESTRICT, so a machine that still has
    // alarms cannot be removed. Explain that instead of leaking the constraint
    // name, which means nothing to an operator.
    if (error.code === '23503') {
      return {
        ...initialActionState,
        error: 'ลบไม่ได้ เครื่องจักรนี้ยังมี Alarm ผูกอยู่ กรุณาลบ Alarm ก่อน',
      };
    }
    console.error('deleteMachine failed', error);
    return { ...initialActionState, error: `ลบไม่สำเร็จ: ${error.message}` };
  }

  revalidateMachines();
  return { ...initialActionState, ok: 'ลบเครื่องจักรแล้ว' };
}
