'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABEL } from '@/lib/constants';
import type { MaintenanceStatus } from '@/lib/supabase/types';
import {
  initialActionState,
  validateMaintenance,
  type ActionState,
  type FieldErrors,
} from '@/lib/validation';

/**
 * Maintenance records are the one place where two tables have to agree.
 *
 * maintenance_records carries a composite FK (alarm_id, machine_id) referencing
 * alarms (id, machine_id) ON DELETE RESTRICT. In plain terms: an alarm can only
 * be attached to a record if that alarm actually belongs to the same machine.
 * The database enforces it, but its error is an opaque constraint violation, so
 * the pair is validated here first to give the operator a message they can act
 * on.
 */

function revalidateMaintenance() {
  revalidatePath('/maintenance');
  revalidatePath('/alarms');
  revalidatePath('/machines');
  revalidatePath('/dashboard');
}

/**
 * Resolves the machine and, when an alarm is linked, checks the two agree.
 * Returns a ready to render ActionState error, or null when the pair is sound.
 */
async function validateLink(
  machineId: string,
  alarmId: string | null,
): Promise<ActionState | null> {
  const supabase = createClient();
  const fail = (error: string, fieldErrors: FieldErrors): ActionState => ({
    ...initialActionState,
    error,
    fieldErrors,
  });

  const { data: machine } = await supabase
    .from('machines')
    .select('id, machine_id')
    .eq('id', machineId)
    .maybeSingle();

  if (!machine) {
    return fail('ไม่พบเครื่องจักรที่เลือก', {
      machine_id: 'กรุณาเลือกเครื่องจักรที่มีอยู่จริง',
    });
  }

  if (!alarmId) return null;

  const { data: alarm } = await supabase
    .from('alarms')
    .select('id, machine_id, alarm_code')
    .eq('id', alarmId)
    .maybeSingle();

  if (!alarm) {
    return fail('ไม่พบ Alarm ที่เลือก', { alarm_id: 'กรุณาเลือก Alarm ที่มีอยู่จริง' });
  }

  if (alarm.machine_id !== machineId) {
    return fail(`Alarm ${alarm.alarm_code} ไม่ได้เกิดกับเครื่อง ${machine.machine_id} กรุณาเลือกให้ตรงกัน`, {
      alarm_id: 'Alarm นี้ไม่ได้เกิดกับเครื่องจักรที่เลือก',
    });
  }

  return null;
}

/** A log entry always has a technician, so the profile must exist. */
async function resolveTechnician(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  return profile?.id ?? null;
}

export async function createMaintenance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requirePermission('manageMaintenance');

  const parsed = validateMaintenance(formData);
  if (!parsed.ok) {
    return {
      ...initialActionState,
      error: 'กรุณาตรวจสอบข้อมูลที่กรอก',
      fieldErrors: parsed.fieldErrors,
    };
  }

  const { alarmId, machineId, actionTaken, status } = parsed.value;

  const linkError = await validateLink(machineId, alarmId);
  if (linkError) return linkError;

  const supabase = createClient();
  const technicianId = await resolveTechnician(supabase, user.id);
  if (!technicianId) {
    return { ...initialActionState, error: 'ไม่พบข้อมูลผู้ใช้ของคุณ กรุณาออกจากระบบแล้วเข้าใหม่' };
  }

  const { error } = await supabase.from('maintenance_records').insert({
    machine_id: machineId,
    alarm_id: alarmId,
    technician_id: technicianId,
    action_taken: actionTaken,
    status,
  });

  if (error) {
    if (error.code === '23503') {
      return {
        ...initialActionState,
        error: 'บันทึกไม่ได้ ข้อมูลที่เลือกไม่สอดคล้องกัน กรุณาตรวจสอบเครื่องจักรและ Alarm อีกครั้ง',
      };
    }
    console.error('createMaintenance failed', error);
    return { ...initialActionState, error: `เพิ่มไม่สำเร็จ: ${error.message}` };
  }

  revalidateMaintenance();
  return { ...initialActionState, ok: 'บันทึกงานซ่อมบำรุงแล้ว' };
}

export async function updateMaintenance(
  recordUuid: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission('manageMaintenance');

  if (!recordUuid) return { ...initialActionState, error: 'ไม่พบรายการ' };

  const parsed = validateMaintenance(formData);
  if (!parsed.ok) {
    return {
      ...initialActionState,
      error: 'กรุณาตรวจสอบข้อมูลที่กรอก',
      fieldErrors: parsed.fieldErrors,
    };
  }

  const { alarmId, machineId, actionTaken, status } = parsed.value;

  const linkError = await validateLink(machineId, alarmId);
  if (linkError) return linkError;

  const supabase = createClient();
  const { error } = await supabase
    .from('maintenance_records')
    .update({ machine_id: machineId, alarm_id: alarmId, action_taken: actionTaken, status })
    .eq('id', recordUuid);

  if (error) {
    if (error.code === '23503') {
      return {
        ...initialActionState,
        error: 'บันทึกไม่ได้ Alarm ที่เลือกไม่ได้เกิดกับเครื่องจักรนี้',
      };
    }
    console.error('updateMaintenance failed', error);
    return { ...initialActionState, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  revalidateMaintenance();
  return { ...initialActionState, ok: `บันทึกงานซ่อมบำรุงแล้ว (${MAINTENANCE_STATUS_LABEL[status]})` };
}

/** The main Technician action for maintenance. */
export async function setMaintenanceStatus(
  recordUuid: string,
  status: MaintenanceStatus,
): Promise<ActionState> {
  await requirePermission('manageMaintenance');

  if (!recordUuid) return { ...initialActionState, error: 'ไม่พบรายการ' };
  if (!MAINTENANCE_STATUSES.includes(status)) {
    return { ...initialActionState, error: 'สถานะไม่ถูกต้อง' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('maintenance_records')
    .update({ status })
    .eq('id', recordUuid);

  if (error) {
    console.error('setMaintenanceStatus failed', error);
    return { ...initialActionState, error: `อัปเดตไม่สำเร็จ: ${error.message}` };
  }

  revalidateMaintenance();
  return { ...initialActionState, ok: `เปลี่ยนสถานะเป็น ${MAINTENANCE_STATUS_LABEL[status]} แล้ว` };
}

export async function deleteMaintenance(recordUuid: string): Promise<ActionState> {
  await requirePermission('deleteMaintenance');

  if (!recordUuid) return { ...initialActionState, error: 'ไม่พบรายการ' };

  const supabase = createClient();
  const { error } = await supabase
    .from('maintenance_records')
    .delete()
    .eq('id', recordUuid);

  if (error) {
    console.error('deleteMaintenance failed', error);
    return { ...initialActionState, error: `ลบไม่สำเร็จ: ${error.message}` };
  }

  revalidateMaintenance();
  return { ...initialActionState, ok: 'ลบรายการซ่อมบำรุงแล้ว' };
}
