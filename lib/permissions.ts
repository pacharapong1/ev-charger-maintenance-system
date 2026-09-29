import type { Role } from './supabase/types';

/**
 * Single source of truth for what each role may do in the UI.
 *
 * This matrix is a UX layer only. It hides buttons and disables fields so users
 * do not see actions that would be rejected. It is deliberately NOT a security
 * boundary: every check is mirrored by an RLS policy in 02_rls.sql, and a
 * modified client cannot get past the database. Keep the two in sync when roles
 * change, and treat 02_rls.sql as the authoritative one.
 */
export const PERMISSIONS = {
  /** Anyone signed in can read machines, alarms and maintenance history. */
  read: ['Admin', 'Technician', 'Engineer', 'Viewer'] as const,

  /** Create, edit and delete machines. */
  manageMachines: ['Admin'] as const,

  /** Acknowledge or close an alarm. Technicians cannot delete alarms. */
  manageAlarms: ['Admin', 'Technician'] as const,
  deleteAlarms: ['Admin'] as const,

  /**
   * Rewriting an alarm's machine, code, description or cause, as opposed to
   * moving it through its states. Split out from manageAlarms so a Technician
   * works the queue without being able to rewrite history.
   *
   * Engineer is the one non-Admin role allowed here, and it is the reason this
   * permission exists as a separate flag: recording why a charger faulted is the
   * Engineer's job. They can write a diagnosis onto an alarm but cannot move it
   * between states and cannot open a new one.
   *
   * RLS cannot restrict this by column, so the policy still lets an Engineer
   * update any alarm column; this flag is the application-layer half of the
   * control.
   */
  editAlarmDetails: ['Admin', 'Engineer'] as const,

  /** Log maintenance work. Technicians may edit only their own entries. */
  manageMaintenance: ['Admin', 'Technician'] as const,
  deleteMaintenance: ['Admin'] as const,

  /**
   * Ask the AI analyzer to suggest a cause and a repair checklist.
   *
   * Admin, Technician and Engineer: a Viewer is read-only, and diagnosing a fault
   * is the work the other three roles are on shift to do.
   *
   * This is a UX gate, not a security boundary, and it is the only permission
   * here with no matching RLS policy. The route handler checks it, then reads
   * the alarm through the caller's own session, so any of the three can only ever
   * analyze an alarm they could already see. The real constraint is that the
   * call costs money, which the route's rate limit handles.
   */
  useAiAnalysis: ['Admin', 'Technician', 'Engineer'] as const,

  /** Only an Admin may change a role. */
  manageRoles: ['Admin'] as const,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * The permissions that put something on screen to change.
 *
 * Kept separate from PERMISSIONS because it answers a different question: not
 * "what may this role do" but "does this role have any reason to be shown a write
 * control at all". useAiAnalysis and manageRoles are missing on purpose. The
 * first is a button that reveals an answer rather than a change to the system,
 * and the second only ever appears on the Admin-only Team page, so including
 * either would have made a Viewer look like they had edit access.
 */
export const WRITE_PERMISSIONS = [
  'manageMachines',
  'manageAlarms',
  'editAlarmDetails',
  'manageMaintenance',
] as const satisfies readonly Permission[];

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/**
 * Narrows an unknown value to a Role.
 *
 * Used at the trust boundary, where a role arrives from the database and nothing
 * has checked it yet. Listing the values here rather than inline at each call
 * site is what keeps adding a role from silently leaving one of them behind.
 */
export function isRole(value: unknown): value is Role {
  return value === 'Admin' || value === 'Technician' || value === 'Engineer' || value === 'Viewer';
}

/**
 * The roles that hold a given permission, in ROLE_ORDER.
 *
 * For queries built at render time. The reason to derive these rather than
 * hardcode them is that a hardcoded list is a promise nobody re-checks: the
 * maintenance technician dropdown used to say ['Admin', 'Technician'] inline,
 * and adding a fourth role left it silently pointing at a set that no longer
 * matched the matrix. Reading it from PERMISSIONS means the query and the
 * buttons that lead to it can never disagree.
 */
export function rolesWith(permission: Permission): Role[] {
  return ROLE_ORDER.filter((role) => can(role, permission));
}

export const ROLE_LABEL: Record<Role, string> = {
  Admin: 'ผู้ดูแลระบบ',
  Technician: 'ช่างซ่อมบำรุง',
  Engineer: 'วิศวกร',
  Viewer: 'ผู้ดูข้อมูล',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  Admin: 'เข้าถึงทุกหน้า เพิ่ม แก้ไข และลบข้อมูลได้ครบถ้วน',
  Technician: 'ดูเครื่องจักร เปลี่ยนสถานะ Alarm และบันทึกงานซ่อมบำรุงของตนเอง',
  Engineer: 'วิเคราะห์สาเหตุการขัดข้อง บันทึกลงใน Alarm และใช้ AI ช่วยวิเคราะห์ โดยไม่แก้ข้อมูลเครื่องจักรหรือเปลี่ยนสถานะ',
  Viewer: 'ดูข้อมูลอย่างเดียว แก้ไขไม่ได้',
};

/** The order roles are presented in wherever they are listed. */
export const ROLE_ORDER: readonly Role[] = ['Admin', 'Engineer', 'Technician', 'Viewer'];
