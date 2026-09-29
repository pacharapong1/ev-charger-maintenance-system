'use client';

import FilterShell from '@/components/filter/FilterShell';
import { DateRangeFilter, MachineFilter, StatusFilter } from '@/components/filter/FilterFields';
import { ALARM_STATUSES, ALARM_STATUS_LABEL } from '@/lib/constants';
import type { MachineOption } from '@/lib/options';

/**
 * Five conditions combined with AND: status, machine, an inclusive date range
 * on created_at, and a free text search. Any subset can be combined, e.g.
 * status=In Progress AND machine=EV-DC-01 AND 1 Sep..7 Sep.
 */
const FIELDS = ['search', 'status', 'machine_id', 'from', 'to'] as const;

export default function AlarmFilters({
  machines,
  activeCount,
  shown,
  total,
}: {
  machines: MachineOption[];
  activeCount: number;
  shown: number;
  total: number;
}) {
  return (
    <FilterShell
      fields={FIELDS}
      activeCount={activeCount}
      searchPlaceholder="ค้นหาจากรหัส Alarm หรือรายละเอียด..."
      resultSummary={
        activeCount > 0
          ? `แสดง ${shown} จาก ${total} รายการ (ใช้เงื่อนไขกรอง ${activeCount} ข้อ)`
          : `แสดงทั้งหมด ${total} รายการ`
      }
    >
      <StatusFilter param="status" label="สถานะ" options={ALARM_STATUSES} labels={ALARM_STATUS_LABEL} />
      <MachineFilter options={machines} />
      <DateRangeFilter />
    </FilterShell>
  );
}
