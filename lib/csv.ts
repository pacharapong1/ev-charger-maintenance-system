/**
 * CSV export helpers.
 *
 * Pure and framework free so the escaping rules can be tested directly. The
 * important part is not the quoting, it is `sanitizeCell`: every value in these
 * reports is free text typed by a person, and a cell beginning with = + - @ is
 * executed as a formula when the file is opened in Excel, LibreOffice or
 * Google Sheets (CWE-1236, "CSV injection"). A station named
 * `=HYPERLINK("http://evil.example","ดูสินค้า")` would otherwise turn a report
 * into a clickable link the reader is expected to trust, and `=cmd|'/C calc'!A0`
 * would run a command on some spreadsheet versions.
 */

/** A column header paired with the value function that produces its cells. */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

/** Characters that make a spreadsheet treat the cell as a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** The same characters, but after leading whitespace, which some readers strip. */
const FORMULA_LEAD_AFTER_SPACE = /^[\s]*[=+\-@]/;

/**
 * Makes a value safe to place in a cell.
 *
 * Prefixing a single quote is the standard mitigation: the spreadsheet stores the
 * text but does not evaluate it. Only a leading character is ever touched, so no
 * real data is altered, and a number that merely begins with a minus sign is
 * left alone because numbers are passed through as numbers, not strings.
 */
export function sanitizeCell(value: string | number | null | undefined): string {
  // A missing value is an empty cell. Writing "null" or "undefined" would be a
  // silent data error in a report someone is about to act on.
  if (value === null || value === undefined) return '';

  // Numbers and already-numeric values cannot be a formula, and passing numbers
  // through untouched keeps them sortable in the spreadsheet.
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

  if (FORMULA_LEAD.test(value) || FORMULA_LEAD_AFTER_SPACE.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Quotes a field per RFC 4180.
 *
 * Doubling an embedded quote is what makes a field containing `"` survive the
 * round trip; the surrounding quotes are only added when the value actually
 * contains a delimiter, quote or newline, because an unneeded pair shows up as
 * noise in single-value columns.
 */
export function escapeField(value: string | number | null | undefined): string {
  const safe = sanitizeCell(value);
  if (safe === '') return '';

  const needsQuoting = /[",\r\n]/.test(safe);
  if (!needsQuoting) return safe;

  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Builds a complete CSV document.
 *
 * Lines end with CRLF, which is what RFC 4180 specifies and what Excel on
 * Windows expects. `\n` alone makes Excel show the whole file on one row.
 */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [columns.map((column) => escapeField(column.header)).join(',')];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeField(column.value(row))).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Formats an ISO timestamp for a report at a given UTC offset.
 *
 * The instant is shifted by the offset and then read with the UTC getters. The
 * local getters (getHours, getDate) are deliberately avoided: they read the
 * machine's own timezone, which would put the browser's wall clock in the file
 * while labelling it with the operator's offset. On a laptop set to UTC, every
 * row would be seven hours wrong and still stamped +07:00.
 *
 * The offset is carried into the value so it is unambiguous, and because every
 * row in one export shares the same offset the text still sorts chronologically.
 *
 * A value that is not a parseable date is returned unchanged rather than becoming
 * "Invalid Date", so a bad row is visible instead of silently blank.
 */
export function formatCsvDate(
  iso: string | null | undefined,
  offsetMinutes: number,
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * Timestamp for the file name, e.g. 2026-09-29-1430.
 *
 * Built from local parts on purpose, so the name matches the date the operator
 * sees on screen rather than shifting across midnight in UTC.
 */
export function fileStamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

/**
 * Strips anything a filename should not contain.
 *
 * The report names include user-derived text, and a slash or a colon would
 * either create an unexpected path or be silently dropped by the browser. Keeping
 * the Thai characters is deliberate: the operator is reading the file list.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    // Path separators and the characters Windows rejects in a filename. Hyphens
    // are deliberately kept, because the report names already use them.
    .replace(/[\\/:*?"<>|]/g, '')
    // C0 and C1 control characters, which would otherwise land in the download
    // name and can even truncate it.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // Only once the unsafe set is gone can this match the spaces left behind.
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  return cleaned || 'export';
}

/**
 * Prefixes a UTF-8 BOM and hands the file to the browser.
 *
 * Without the BOM, Excel on Windows decodes the file as the system codepage and
 * every Thai character in the report turns into mojibake. This is the single
 * most common complaint about exported Thai spreadsheets, and it is invisible
 * until someone opens the file in the wrong program.
 */
export function downloadCsv(fileName: string, csv: string): void {
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(fileName)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoking immediately can cancel the download in some browsers; a short delay
  // is the widely used compromise.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
