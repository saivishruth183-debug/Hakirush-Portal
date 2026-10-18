/**
 * CSV builder (RFC 4180) with spreadsheet formula-injection protection.
 *
 * - Fields containing `"`, `,`, CR or LF are quoted; quotes are doubled.
 * - Cells starting with = + - @ (or TAB / CR, which some spreadsheets also treat as formula
 *   prefixes) are prefixed with a single quote so Excel/Sheets show them as text.
 * - Rows are joined with CRLF; output starts with a UTF-8 BOM so Excel detects UTF-8 (₹, names).
 *
 * Write the result with `writePrivateTextFile(name, csv)` and share it with `shareFile`.
 */

export type CsvCell = string | number | boolean | null | undefined | Date;

export const UTF8_BOM = '﻿';
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Neutralise formula prefixes. Plain negative numbers passed as `number` are left intact. */
export function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';
  let value: string;
  if (cell instanceof Date) value = Number.isNaN(cell.getTime()) ? '' : cell.toISOString();
  else if (typeof cell === 'number') value = Number.isFinite(cell) ? String(cell) : '';
  else if (typeof cell === 'boolean') value = cell ? 'true' : 'false';
  else value = neutralizeFormula(cell);
  if (/[",\r\n]/.test(value)) value = `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsvRow(cells: readonly CsvCell[]): string {
  return cells.map(escapeCsvCell).join(',');
}

/** Build a full CSV document (with BOM by default). */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[], opts: { bom?: boolean } = {}): string {
  const lines = [toCsvRow(header), ...rows.map(toCsvRow)];
  return (opts.bom === false ? '' : UTF8_BOM) + lines.join('\r\n') + '\r\n';
}

/** Convenience: objects + column definitions. */
export function objectsToCsv<T>(
  items: readonly T[],
  columns: readonly { header: string; value: (item: T) => CsvCell }[],
  opts?: { bom?: boolean },
): string {
  return toCsv(
    columns.map((c) => c.header),
    items.map((item) => columns.map((c) => c.value(item))),
    opts,
  );
}
