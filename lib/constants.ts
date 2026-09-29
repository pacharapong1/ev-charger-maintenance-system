import type { AlarmStatus, MachineStatus, MaintenanceStatus } from './supabase/types';

export const MACHINE_STATUSES: MachineStatus[] = [
  'Running',
  'Stop',
  'Alarm',
  'Maintenance',
];

export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  Running: 'กำลังทำงาน',
  Stop: 'หยุดทำงาน',
  Alarm: 'มีสัญญาณเตือน',
  Maintenance: 'กำลังซ่อมบำรุง',
};

export const ALARM_STATUSES: AlarmStatus[] = ['Open', 'In Progress', 'Closed'];

export const ALARM_STATUS_LABEL: Record<AlarmStatus, string> = {
  Open: 'เปิด',
  'In Progress': 'กำลังดำเนินการ',
  Closed: 'ปิด',
};

export const MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  'In Progress',
  'Completed',
  'Waiting Part',
];

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  'In Progress': 'กำลังดำเนินการ',
  Completed: 'เสร็จสิ้น',
  'Waiting Part': 'รออะไหล่',
};
