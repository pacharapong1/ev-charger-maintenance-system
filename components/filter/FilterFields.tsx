'use client';

import { useEffect, useState } from 'react';
import { useFilter } from './FilterShell';
import { machineLabel, type MachineOption, type TechnicianOption } from '@/lib/options';
import type { AlarmStatus, MachineStatus, MaintenanceStatus } from '@/lib/supabase/types';

/**
 * Filter fields that plug into FilterShell. Each one writes straight to the URL
 * on change, so the page re-queries in Postgres rather than filtering an
 * already downloaded list.
 */

export function StatusFilter<T extends MachineStatus | AlarmStatus | MaintenanceStatus>({
  param,
  label,
  options,
  labels,
  width = 'w-44',
}: {
  param: string;
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  width?: string;
}) {
  const { values, setValue } = useFilter();

  return (
    <div className={width}>
      <label htmlFor={`filter-${param}`} className="field-label mb-1.5 block">
        {label}
      </label>
      <select
        id={`filter-${param}`}
        value={values[param] ?? ''}
        onChange={(event) => setValue(param, event.target.value)}
        className="field"
      >
        <option value="">ทั้งหมด</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Text filter that applies on Enter or blur rather than on every keystroke, so
 * typing "Rama IX" does not fire seven queries.
 */
export function TextFilter({
  param,
  label,
  placeholder,
  width = 'w-44',
}: {
  param: string;
  label: string;
  placeholder?: string;
  width?: string;
}) {
  const { values, commit } = useFilter();
  const [draft, setDraft] = useState(values[param] ?? '');

  // Follow the URL when it changes underneath us, e.g. the clear button or a
  // back navigation, otherwise the box keeps a value that is no longer applied.
  useEffect(() => setDraft(values[param] ?? ''), [values, param]);

  function apply() {
    if (draft.trim() === (values[param] ?? '').trim()) return;
    commit({ ...values, [param]: draft });
  }

  return (
    <div className={width}>
      <label htmlFor={`filter-${param}`} className="field-label mb-1.5 block">
        {label}
      </label>
      <input
        id={`filter-${param}`}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
        }}
        placeholder={placeholder}
        className="field"
      />
    </div>
  );
}

export function MachineFilter({
  options,
  width = 'w-56',
}: {
  options: MachineOption[];
  width?: string;
}) {
  const { values, setValue } = useFilter();

  return (
    <div className={width}>
      <label htmlFor="filter-machine_id" className="field-label mb-1.5 block">
        เครื่องจักร
      </label>
      <select
        id="filter-machine_id"
        value={values.machine_id ?? ''}
        onChange={(event) => setValue('machine_id', event.target.value)}
        className="field"
      >
        <option value="">ทุกเครื่อง</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {machineLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Filters by the technician who logged the job. The specification lists
 * Technician as one of the expected filter conditions, and it answers the
 * question the other filters cannot: whose queue is long.
 *
 * A profile with a blank name still gets an entry, labelled by its id, because
 * an unnamed technician would otherwise be invisible and unfilterable.
 */
export function TechnicianFilter({
  options,
  width = 'w-48',
}: {
  options: TechnicianOption[];
  width?: string;
}) {
  const { values, setValue } = useFilter();

  return (
    <div className={width}>
      <label htmlFor="filter-technician_id" className="field-label mb-1.5 block">
        ช่างซ่อม
      </label>
      <select
        id="filter-technician_id"
        value={values.technician_id ?? ''}
        onChange={(event) => setValue('technician_id', event.target.value)}
        className="field"
      >
        <option value="">ทุกคน</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.fullName?.trim() || 'ไม่ระบุชื่อ'}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Inclusive date range. The browser enforces max on the start date and min on
 * the end date so a reversed range cannot be picked at all, which is friendlier
 * than submitting one and being told it is invalid.
 */
export function DateRangeFilter() {
  const { values, setRange } = useFilter();
  const from = values.from ?? '';
  const to = values.to ?? '';

  return (
    <>
      <div className="w-40">
        <label htmlFor="filter-from" className="field-label mb-1.5 block">
          ตั้งแต่วันที่
        </label>
        <input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => setRange('from', event.target.value)}
          className="field"
        />
      </div>

      <div className="w-40">
        <label htmlFor="filter-to" className="field-label mb-1.5 block">
          ถึงวันที่
        </label>
        <input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => setRange('to', event.target.value)}
          className="field"
        />
      </div>
    </>
  );
}
