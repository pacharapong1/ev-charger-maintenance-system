'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsv, fileStamp, formatCsvDate, toCsv, type CsvColumn } from '@/lib/csv';
import { ALARM_STATUS_LABEL, MAINTENANCE_STATUS_LABEL } from '@/lib/constants';
import type { AlarmRow } from '@/components/alarms/AlarmTable';
import type { MaintenanceRow } from '@/components/maintenance/MaintenanceTable';

type BaseProps<T> = {
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
  fileName: string;
  /** Result count, so the operator knows the report is not silently truncated. */
  total: number;
  /** True when a filter is active, which the label calls out explicitly. */
  isFiltered: boolean;
  offsetMinutes: number | null;
};

/**
 * Resolves the offset for the report.
 *
 * The value from the URL wins so the timestamps match what is on screen. When no
 * `tz` is set the browser's own offset is used, expressed ahead of UTC to match
 * the convention the filters already use.
 */
function resolveOffset(offsetMinutes: number | null): number {
  if (offsetMinutes !== null) return offsetMinutes;
  return -new Date().getTimezoneOffset();
}

/**
 * Builds the report in the browser from the rows the table already holds.
 *
 * The table is a client component, so these rows are already in the page payload
 * and re-serialising them for an export would double it. Building here also means
 * the file cannot disagree with the table, and the file is a function of exactly
 * the rows that passed the RLS-scoped server query, so no additional query or
 * authorisation surface is introduced.
 */
function ExportCsvButton<T>({
  rows,
  columns,
  fileName,
  total,
  isFiltered,
  offsetMinutes,
  label,
}: BaseProps<T> & { label: string }) {
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    setBusy(true);
    try {
      // A dataset is small enough to serialise synchronously, but the yield
      // keeps the button from appearing frozen on a large export.
      const csv = toCsv(columns, rows);
      if (!csv) {
        toast.error('ไม่มีข้อมูลให้ส่งออก');
        return;
      }

      downloadCsv(`${fileName}-${fileStamp()}`, csv);

      // Stated explicitly, because "ส่งออกแล้ว" next to a filtered table is
      // otherwise read as a full log.
      toast.success(`ส่งออก ${rows.length} รายการ${rows.length < total ? ` จากทั้งหมด ${total}` : ''}`);
    } catch {
      toast.error('สร้างไฟล์ CSV ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const empty = rows.length === 0;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-sm"
        onClick={handleClick}
        disabled={empty || busy}
        title={
          empty
            ? 'ไม่มีข้อมูลให้ส่งออก'
            : isFiltered
              ? `ส่งออกเฉพาะ ${rows.length} แถวที่ตรงกับตัวกรอง`
              : 'ส่งออกข้อมูลทั้งหมด'
        }
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label}
        {!empty ? <span className="tabular-nums text-ink-subtle">({rows.length})</span> : null}
      </button>
      {isFiltered && !empty ? (
        <span className="text-xs text-ink-subtle dark:text-slate-500">เฉพาะแถวที่ตรงกับตัวกรอง</span>
      ) : null}
    </div>
  );
}

/**
 * Alarm log report.
 *
 * Peak telemetry is included because the trend across a range of rows is usually
 * the reason someone exports the log at all. A blank cell means the station did
 * not report that reading, which is different from a reading of zero.
 */
export function AlarmCsvButton({
  rows,
  total,
  isFiltered,
  offsetMinutes,
}: Omit<BaseProps<AlarmRow>, 'columns' | 'fileName'> & { fileName?: string }) {
  const offset = resolveOffset(offsetMinutes);

  const columns: readonly CsvColumn<AlarmRow>[] = [
    { header: 'รหัส Alarm', value: (row) => row.alarmCode },
    { header: 'รหัสเครื่อง', value: (row) => row.machineId },
    { header: 'ชื่อเครื่อง', value: (row) => row.machineName },
    { header: 'รายละเอียด', value: (row) => row.description },
    { header: 'สาเหตุ', value: (row) => row.cause },
    { header: 'สถานะ', value: (row) => ALARM_STATUS_LABEL[row.status] },
    { header: 'แรงดันสูงสุด (V)', value: (row) => row.voltagePeak },
    { header: 'อุณหภูมิสูงสุด (°C)', value: (row) => row.temperaturePeak },
    { header: 'กระแสสูงสุด (A)', value: (row) => row.currentPeak },
    { header: 'เวลาที่เกิด', value: (row) => formatCsvDate(row.createdAt, offset) },
  ];

  return (
    <ExportCsvButton
      rows={rows}
      columns={columns}
      fileName="alarm-log"
      label="ส่งออก CSV"
      total={total}
      isFiltered={isFiltered}
      offsetMinutes={offsetMinutes}
    />
  );
}

/** Maintenance report, carrying the technician so the work can be traced back. */
export function MaintenanceCsvButton({
  rows,
  total,
  isFiltered,
  offsetMinutes,
  fileName = 'maintenance-record',
}: Omit<BaseProps<MaintenanceRow>, 'columns' | 'fileName'> & { fileName?: string }) {
  const offset = resolveOffset(offsetMinutes);

  const columns: readonly CsvColumn<MaintenanceRow>[] = [
    { header: 'รหัสเครื่อง', value: (row) => row.machineId },
    { header: 'ชื่อเครื่อง', value: (row) => row.machineName },
    { header: 'รหัส Alarm', value: (row) => row.alarmCode },
    { header: 'ช่างผู้ซ่อม', value: (row) => row.technicianName },
    { header: 'รายละเอียดงาน', value: (row) => row.actionTaken },
    { header: 'สถานะ', value: (row) => MAINTENANCE_STATUS_LABEL[row.status] },
    { header: 'เวลาที่บันทึก', value: (row) => formatCsvDate(row.createdAt, offset) },
  ];

  return (
    <ExportCsvButton
      rows={rows}
      columns={columns}
      fileName={fileName}
      label="ส่งออก CSV"
      total={total}
      isFiltered={isFiltered}
      offsetMinutes={offsetMinutes}
    />
  );
}
