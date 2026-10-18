/** Display helpers shared by the admin operations screens (pure functions, unit-testable). */
import type { StatusTone } from '@/theme';
import { businessDate, durationAccessibilityLabel } from '@/utils/format';

import type { PopulatedEmployee } from './types';

export function employeeName(e: PopulatedEmployee | null | undefined): string {
  return e?.userId?.name?.trim() || 'Unknown employee';
}

export function employeeCode(e: PopulatedEmployee | null | undefined): string {
  return e?.employeeId || 'N/A';
}

export function departmentName(e: PopulatedEmployee | null | undefined): string {
  return e?.department?.dep_name || 'No department';
}

/**
 * Stored calendar dates (leave start/end, holidays) are saved as UTC midnight of the business
 * date; read them back as that UTC day (same rule as Backend/services/businessCalendar.js).
 */
export function storedDateToYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return d.toISOString().slice(0, 10);
  }
  return businessDate(d);
}

/** Decimal hours → "7h 30m" ("0h 00m" for 0 / missing). */
export function formatHours(hours: number | null | undefined): string {
  const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function hoursAccessibilityLabel(hours: number | null | undefined): string {
  return durationAccessibilityLabel(Math.max(0, Number(hours) || 0) * 3_600_000);
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD business date. */
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Off-day label used by the web report: holiday title, "Saturday (Weekend)" / "Sunday (Weekend)", or null. */
export function offDayLabel(ymd: string, holidayMap: Record<string, string> | undefined): string | null {
  const holiday = holidayMap?.[ymd];
  if (holiday) return holiday;
  const wd = weekdayOf(ymd);
  if (wd === 0) return 'Sunday (Weekend)';
  if (wd === 6) return 'Saturday (Weekend)';
  return null;
}

export type AttendanceFilterKey = 'All' | 'Present' | 'Half Day' | 'Absent' | 'Leave' | 'Working' | 'Holiday' | 'Not marked';

export interface DisplayStatus {
  label: string;
  tone: StatusTone;
  filter: AttendanceFilterKey;
}

interface StatusInput {
  status?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  isPaused?: boolean | null;
}

/** Normalises backend attendance status (incl. legacy "Halfday" and open sessions) for display. */
export function displayAttendanceStatus(row: StatusInput): DisplayStatus {
  const raw = (row.status ?? '').toString().trim();
  const key = raw.toLowerCase().replace(/\s+/g, '');
  if (key === 'present') return { label: 'Present', tone: 'success', filter: 'Present' };
  if (key === 'halfday') return { label: 'Half Day', tone: 'warning', filter: 'Half Day' };
  if (key === 'absent') return { label: 'Absent', tone: 'danger', filter: 'Absent' };
  if (key === 'leave') return { label: 'Leave', tone: 'neutral', filter: 'Leave' };
  if (key === 'holiday') return { label: 'Holiday', tone: 'info', filter: 'Holiday' };
  if (!raw && row.checkIn && !row.checkOut) {
    return row.isPaused
      ? { label: 'On break', tone: 'warning', filter: 'Working' }
      : { label: 'Working', tone: 'info', filter: 'Working' };
  }
  if (raw) return { label: raw, tone: 'neutral', filter: 'Not marked' };
  return { label: 'Not marked', tone: 'neutral', filter: 'Not marked' };
}

const SOURCE_LABELS: Record<string, string> = {
  punch: 'Employee check-in/out',
  admin: 'Set manually by an admin',
  correction: 'Approved correction request',
  system: 'Closed automatically (day-close job)',
};

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source] ?? source;
}

/** Numeric-aware compare for employee codes (HAKI2 < HAKI10), like the web tables. */
export function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Case-insensitive "contains" over several fields. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}
