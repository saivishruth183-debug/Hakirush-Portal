import { getApiBaseUrl } from '@/services/api/config';
import { formatDate, formatMonth } from '@/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "MM-DD" → "3 Oct" (no year, no age). */
export function formatMonthDay(md: string | undefined | null): string {
  const m = /^(\d{2})-(\d{2})$/.exec(md ?? '');
  if (!m) return '';
  return `${Number(m[2])} ${MONTHS[Number(m[1]) - 1] ?? ''}`.trim();
}

/** Decimal hours → "7h 30m". */
export function formatHours(hours: number | null | undefined): string {
  const total = Math.max(0, Math.round((hours ?? 0) * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Stored ISO date (UTC midnight) or YYYY-MM-DD → YYYY-MM-DD. */
export function ymdOf(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10);
}

export function formatRange(start: string, end: string): string {
  const s = ymdOf(start);
  const e = ymdOf(end);
  return s === e ? formatDate(s) : `${formatDate(s)} – ${formatDate(e)}`;
}

/** Payslip month as stored ("2026-09" or legacy text). */
export function payslipMonthLabel(month: string): string {
  return /^\d{4}-\d{2}$/.test(month) ? formatMonth(month) : month;
}

/** Only http(s) URLs (relative legacy paths are resolved against the API host). */
export function mediaUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.includes(':')) return null;
  try {
    return `${getApiBaseUrl()}/${u.replace(/^\/+/, '')}`;
  } catch {
    return null;
  }
}

/** Masks all but the last 4 characters. */
export function maskId(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  if (s.length <= 4) return '•'.repeat(s.length);
  return `${'•'.repeat(Math.min(8, s.length - 4))}${s.slice(-4)}`;
}

/** Weekday (0=Sun) of a YYYY-MM-DD business date. */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}
