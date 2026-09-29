/**
 * Shapes for dropdown options.
 *
 * Kept in one place because the machine picker appears in several modules
 * (alarm forms, maintenance forms, filter bars) and two subtly different
 * definitions of it would let one of them silently accept the other's rows.
 *
 * `id` is the machines PK, which is what every foreign key stores. `machineId`
 * is the operator facing code, which is what people actually recognise.
 */
export type MachineOption = {
  id: string;
  machineId: string;
  name: string;
};

export type AlarmOption = {
  id: string;
  alarmCode: string;
  /**
   * UUID of the machine this alarm belongs to, not the operator facing code.
   * The maintenance form compares it against the selected machine's UUID, and
   * mixing the two up would let an operator pair an alarm with the wrong
   * station.
   */
  machineUuid: string;
};

/** "EVB-01 — ตู้ชาร์จ DC ชั้น 2", the form used wherever a machine is picked. */
export function machineLabel(option: MachineOption): string {
  return `${option.machineId} — ${option.name}`;
}

/**
 * A person who can be assigned a maintenance job. Only Admin and Technician
 * appear, because a Viewer never becomes a technician_id on a record.
 *
 * `fullName` may be null: the profiles table allows a blank name, so the UI
 * falls back to the id rather than rendering an empty dropdown entry.
 */
export type TechnicianOption = {
  id: string;
  fullName: string | null;
};
