/**
 * Attendance report / dashboard exports (XLSX + CSV) and the write → share step.
 *
 * - Rows are built by pure functions (unit-tested): text cells that start with = + - @ (or TAB/CR)
 *   are prefixed with ' (formula-injection neutralisation, same rule as utils/csv.ts); numbers stay
 *   numbers; Unicode names are kept as-is.
 * - XLSX uses SheetJS 0.18.5 (write-only use; a static import because Jest cannot run dynamic import()): aoa_to_sheet → XLSX.write({type:'base64'}) → expo-file-system
 *   `File.write(base64, {encoding:'base64'})` in <cache>/private-downloads (wiped on logout).
 * - Sharing: a dismissed share sheet is not an error.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as XLSX from 'xlsx';

import { toast } from '@/components';
import { sanitizeFileName, shareFile, writePrivateTextFile } from '@/services/api';
import { neutralizeFormula, toCsv, type CsvCell } from '@/utils/csv';
import { formatTime } from '@/utils/format';

import { compareCodes, displayAttendanceStatus, offDayLabel } from './format';
import type { ReportResponse } from './types';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv';

export type SheetCell = string | number;

/** Same 8 columns as the web AdminAttendanceReport "Download Excel". */
export const ATTENDANCE_EXPORT_HEADER = [
  'Date',
  'Employee ID',
  'Name',
  'Department',
  'Status',
  'Worked Hours',
  'Check In',
  'Check Out',
] as const;

/** Text cell with formula prefixes neutralised; numbers are returned unchanged. */
export function safeCell(value: string | number | null | undefined): SheetCell {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return neutralizeFormula(value);
}

/**
 * Report → rows (without header): dates ascending, then employee code (numeric aware).
 * Off days without a record ("Holiday") show the holiday / weekend label; worked hours are numbers.
 */
export function buildAttendanceExportRows(report: Pick<ReportResponse, 'groupData' | 'holidayMap'>): SheetCell[][] {
  const rows: SheetCell[][] = [];
  for (const date of Object.keys(report.groupData).sort()) {
    const records = [...(report.groupData[date] ?? [])].sort((a, b) => compareCodes(a.employeeId ?? '', b.employeeId ?? ''));
    const offLabel = offDayLabel(date, report.holidayMap);
    for (const r of records) {
      const isOffPlaceholder = (r.status ?? '').toLowerCase() === 'holiday';
      const status = isOffPlaceholder ? (offLabel ?? 'Holiday') : displayAttendanceStatus(r).label;
      const hours = Number(r.workedHours) || 0;
      rows.push([
        date,
        safeCell(r.employeeId),
        safeCell(r.employeeName),
        safeCell(r.departmentName),
        safeCell(status),
        Math.round(hours * 100) / 100,
        r.checkIn ? formatTime(r.checkIn, '') : '',
        r.checkOut ? formatTime(r.checkOut, '') : '',
      ]);
    }
  }
  return rows;
}

/** Header + rows as an array-of-arrays (input of XLSX.utils.aoa_to_sheet). */
export function buildAttendanceSheetAoa(report: Pick<ReportResponse, 'groupData' | 'holidayMap'>): SheetCell[][] {
  return [[...ATTENDANCE_EXPORT_HEADER], ...buildAttendanceExportRows(report)];
}

export function buildAttendanceCsv(report: Pick<ReportResponse, 'groupData' | 'holidayMap'>): string {
  return toCsv(ATTENDANCE_EXPORT_HEADER, buildAttendanceExportRows(report) as CsvCell[][]);
}

/** Builds an .xlsx workbook (one sheet) and returns it base64-encoded. */
export function buildXlsxBase64(aoa: SheetCell[][], sheetName = 'Attendance'): string {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = (aoa[0] ?? []).map((_, i) => ({
    wch: Math.min(40, Math.max(10, ...aoa.slice(0, 200).map((row) => String(row[i] ?? '').length + 2))),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
}

/** Writes base64 bytes into the private cache (overwrites) and returns the File. */
export function writePrivateBase64File(fileName: string, base64: string): File {
  const dir = new Directory(Paths.cache, 'private-downloads');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, sanitizeFileName(fileName));
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file;
}

function isShareCancel(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? '');
  return /cancel|dismiss/i.test(message);
}

/** Opens the share sheet; a cancelled/dismissed sheet is silently ignored. */
export async function shareExport(file: File, mimeType: string, dialogTitle: string): Promise<void> {
  try {
    const shared = await shareFile(file, { mimeType, dialogTitle });
    if (!shared) toast.error('Sharing is not available on this device.');
  } catch (e) {
    if (isShareCancel(e)) return;
    toast.error('The file could not be shared. Please try again.');
  }
}

export async function exportXlsx(fileName: string, aoa: SheetCell[][], sheetName?: string): Promise<void> {
  let file: File;
  try {
    file = writePrivateBase64File(fileName, buildXlsxBase64(aoa, sheetName));
  } catch {
    toast.error('The Excel file could not be created. Please try again.');
    return;
  }
  await shareExport(file, XLSX_MIME, 'Share Excel report');
}

export async function exportCsv(fileName: string, csv: string): Promise<void> {
  let file: File;
  try {
    file = writePrivateTextFile(fileName, csv);
  } catch {
    toast.error('The CSV file could not be created. Please try again.');
    return;
  }
  await shareExport(file, CSV_MIME, 'Share CSV report');
}
