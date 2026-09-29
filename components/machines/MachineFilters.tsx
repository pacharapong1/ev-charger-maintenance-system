'use client';

import FilterShell from '@/components/filter/FilterShell';
import { StatusFilter, TextFilter } from '@/components/filter/FilterFields';
import { MACHINE_STATUSES, MACHINE_STATUS_LABEL } from '@/lib/constants';

/**
 * Four independent conditions, combined with AND. Any combination may be used
 * together, e.g. Status = Alarm AND Location contains "รัชดา" AND search "EVB-02".
 */
const FIELDS = ['search', 'status', 'location', 'type'] as const;

export default function MachineFilters({
  activeCount,
  shown,
  total,
}: {
  activeCount: number;
  shown: number;
  total: number;
}) {
  return (
    <FilterShell
      fields={FIELDS}
      activeCount={activeCount}
      searchPlaceholder="ค้นหาจากรหัส ชื่อ หรือสถานที่..."
      resultSummary={
        activeCount > 0
          ? `แสดง ${shown} จาก ${total} เครื่อง (ใช้เงื่อนไขกรอง ${activeCount} ข้อ)`
          : `แสดงทั้งหมด ${total} เครื่อง`
      }
    >
      <StatusFilter
        param="status"
        label="สถานะ"
        options={MACHINE_STATUSES}
        labels={MACHINE_STATUS_LABEL}
      />
      <TextFilter param="location" label="สถานที่ตั้ง" placeholder="เช่น รัชดา" />
      <TextFilter param="type" label="ประเภท" placeholder="เช่น DC Fast" />
    </FilterShell>
  );
}
