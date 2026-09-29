'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ALARM_STATUSES, ALARM_STATUS_LABEL } from '@/lib/constants';
import type { AlarmStatus } from '@/lib/supabase/types';
import {
  initialActionState,
  validateAlarm,
  type ActionState,
} from '@/lib/validation';

/**
 * Every action re-checks the role on the server before touching data. The
 * buttons hidden in the UI are convenience only; a crafted request still has to
 * clear this guard and the RLS policy.
 */

function revalidateAlarms() {
  revalidatePath('/alarms');
  revalidatePath('/maintenance');
  // Maintenance creation and the dashboard both read alarms.
  revalidatePath('/dashboard');
}

export async function createAlarm(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Raising an alarm is admin only. A Technician works the queue instead, which
  // is what manageAlarms covers. The insert policy in 02_rls.sql agrees.
  await requirePermission('editAlarmDetails');

  const parsed = validateAlarm(formData);
  if (!parsed.ok) {
    return {
      ...initialActionState,
      error: 'กรุณาตรวจสอบข้อมูลที่กรอก',
      fieldErrors: parsed.fieldErrors,
    };
  }

  const {
    machineId,
    alarmCode,
    description,
    cause,
    status,
    voltagePeak,
    temperaturePeak,
    currentPeak,
  } = parsed.value;
  const supabase = createClient();

  // RLS would reject an unknown machine, but the foreign key error arrives as a
  // generic constraint message. Checking first turns a confusing failure into a
  // message that names the actual problem.
  const { data: machine } = await supabase
    .from('machines')
    .select('id')
    .eq('id', machineId)
    .maybeSingle();

  if (!machine) {
    return {
      ...initialActionState,
      error: 'ไม่พบเครื่องจักรที่เลือก',
      fieldErrors: { machine_id: 'กรุณาเลือกเครื่องจักรที่มีอยู่จริง' },
    };
  }

  const { error } = await supabase.from('alarms').insert({
    machine_id: machineId,
    alarm_code: alarmCode,
    description,
    cause,
    status,
    voltage_peak: voltagePeak,
    temperature_peak: temperaturePeak,
    current_peak: currentPeak,
  });

  if (error) {
    console.error('createAlarm failed', error);
    return { ...initialActionState, error: `เพิ่มไม่สำเร็จ: ${error.message}` };
  }

  revalidateAlarms();
  return { ...initialActionState, ok: `เปิด Alarm ${alarmCode} แล้ว` };
}

export async function updateAlarm(
  alarmUuid: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Rewriting the record, not just its state, so admin only.
  await requirePermission('editAlarmDetails');

  if (!alarmUuid) return { ...initialActionState, error: 'ไม่พบ Alarm' };

  const parsed = validateAlarm(formData);
  if (!parsed.ok) {
    return {
      ...initialActionState,
      error: 'กรุณาตรวจสอบข้อมูลที่กรอก',
      fieldErrors: parsed.fieldErrors,
    };
  }

  const {
    machineId,
    alarmCode,
    description,
    cause,
    status,
    voltagePeak,
    temperaturePeak,
    currentPeak,
  } = parsed.value;
  const supabase = createClient();

  const { data: machine } = await supabase
    .from('machines')
    .select('id')
    .eq('id', machineId)
    .maybeSingle();

  if (!machine) {
    return {
      ...initialActionState,
      error: 'ไม่พบเครื่องจักรที่เลือก',
      fieldErrors: { machine_id: 'กรุณาเลือกเครื่องจักรที่มีอยู่จริง' },
    };
  }

  const { error } = await supabase
    .from('alarms')
    .update({
      machine_id: machineId,
      alarm_code: alarmCode,
      description,
      cause,
      status,
      // Written as explicit nulls: clearing a reading in the form has to remove
      // the stored value, otherwise an operator could never correct a typo back
      // to "not reported".
      voltage_peak: voltagePeak,
      temperature_peak: temperaturePeak,
      current_peak: currentPeak,
    })
    .eq('id', alarmUuid);

  if (error) {
    console.error('updateAlarm failed', error);
    return { ...initialActionState, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  revalidateAlarms();
  return { ...initialActionState, ok: `บันทึก Alarm ${alarmCode} แล้ว` };
}

/** Admin and Technician. The status select is the main Technician action. */
export async function setAlarmStatus(
  alarmUuid: string,
  status: AlarmStatus,
): Promise<ActionState> {
  await requirePermission('manageAlarms');

  if (!alarmUuid) return { ...initialActionState, error: 'ไม่พบ Alarm' };
  if (!ALARM_STATUSES.includes(status)) {
    return { ...initialActionState, error: 'สถานะไม่ถูกต้อง' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('alarms').update({ status }).eq('id', alarmUuid);

  if (error) {
    console.error('setAlarmStatus failed', error);
    return { ...initialActionState, error: `อัปเดตไม่สำเร็จ: ${error.message}` };
  }

  revalidateAlarms();
  return { ...initialActionState, ok: `เปลี่ยนสถานะเป็น ${ALARM_STATUS_LABEL[status]} แล้ว` };
}

/** Admin only. Technicians are redirected to /unauthorized by the guard. */
export async function deleteAlarm(alarmUuid: string): Promise<ActionState> {
  await requirePermission('deleteAlarms');

  if (!alarmUuid) return { ...initialActionState, error: 'ไม่พบ Alarm' };

  const supabase = createClient();
  const { error } = await supabase.from('alarms').delete().eq('id', alarmUuid);

  if (error) {
    // maintenance_records references alarms with ON DELETE RESTRICT, so an alarm
    // that is already logged against cannot be removed.
    if (error.code === '23503') {
      return {
        ...initialActionState,
        error: 'ลบไม่ได้ Alarm นี้มีงานซ่อมบำรุงผูกอยู่ กรุณาลบงานซ่อมบำรุงก่อน',
      };
    }
    console.error('deleteAlarm failed', error);
    return { ...initialActionState, error: `ลบไม่สำเร็จ: ${error.message}` };
  }

  revalidateAlarms();
  return { ...initialActionState, ok: 'ลบ Alarm แล้ว' };
}
