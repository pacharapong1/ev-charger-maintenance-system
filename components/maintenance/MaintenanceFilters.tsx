'use client';

import FilterShell from '@/components/filter/FilterShell';
import {
  DateRangeFilter,
  MachineFilter,
  StatusFilter,
  TechnicianFilter,
} from '@/components/filter/FilterFields';
import { MAINTENANCE_STATUSES, MAINTENANCE_STATUS_LABEL } from '@/lib/constants';
import type { MachineOption, TechnicianOption } from '@/lib/options';

/**
 * Six conditions combined with AND: status, machine, technician, an inclusive
 * date range on created_at, and a free text search across the job notes and
 * alarm code. The specification asks for at least two; having one per column an
 * operator actually reasons about is what makes the list usable at a glance.
 */
const FIELDS = ['search', 'status', 'machine_id', 'technician_id', 'from', 'to'] as const;

export default function MaintenanceFilters({
  machines,
  technicians,
  activeCount,
  shown,
  total,
}: {
  machines: MachineOption[];
  technicians: TechnicianOption[];
  activeCount: number;
  shown: number;
  total: number;
}) {
  return (
    <FilterShell
      fields={FIELDS}
      activeCount={activeCount}
      searchPlaceholder="ค้นหาจากรายละเอียดงานหรือรหัส Alarm..."
      resultSummary={
        activeCount > 0
          ? `แสดง ${shown} จาก ${total} รายการ (ใช้เงื่อนไขกรอง ${activeCount} ข้อ)`
          : `แสดงทั้งหมด ${total} รายการ`
      }
    >
      <StatusFilter
        param="status"
        label="สถานะ"
        options={MAINTENANCE_STATUSES}
        labels={MAINTENANCE_STATUS_LABEL}
      />
      <MachineFilter options={machines} />
      <TechnicianFilter options={technicians} />
      <DateRangeFilter />
    </FilterShell>
  );
}
