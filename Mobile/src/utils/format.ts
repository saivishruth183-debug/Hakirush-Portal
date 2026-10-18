/**
 * Formatting helpers. All calendar output is in the organisation timezone (Asia/Kolkata)
 * regardless of the device timezone, matching the backend's business dates.
 */

export const ORG_TIMEZONE = 'Asia/Kolkata';
export const LOCALE = 'en-IN';

const BUSINESS_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

type DateInput = string | number | Date | null | undefined;

/**
 * Parses an ISO instant, epoch ms, Date, or a `YYYY-MM-DD` business date.
 * Business dates become midday UTC of that day so formatting in Asia/Kolkata keeps the same day.
 */
export function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') return new Date(input);
  const m = BUSINESS_DATE_RE.exec(input);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: ORG_TIMEZONE, ...options });
    cache.set(key, f);
  }
  return f;
}

/** "1 Oct 2026" */
export function formatDate(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  return d ? dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(d) : fallback;
}

/** "Thu, 1 Oct 2026" */
export function formatDateLong(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  return d ? dtf({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d) : fallback;
}

/** "9:05 am" in org time. */
export function formatTime(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  return d ? dtf({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d) : fallback;
}

/** "1 Oct 2026, 9:05 am" */
export function formatDateTime(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  return d
    ? dtf({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
    : fallback;
}

/**
 * Asia/Kolkata is a fixed UTC+05:30 offset (no DST), so business dates are computed
 * arithmetically — this avoids depending on Intl.formatToParts support in Hermes.
 * If ORG_TIMEZONE ever changes to a DST zone, replace this with an Intl-based implementation.
 */
const ORG_UTC_OFFSET_MS = 330 * 60_000;

/** Today's business date (YYYY-MM-DD) in the org timezone. Pass a server time when you have one. */
export function businessDate(now: DateInput = Date.now()): string {
  const d = toDate(now) ?? new Date();
  const shifted = new Date(d.getTime() + ORG_UTC_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Current month key (YYYY-MM) in the org timezone. */
export function monthKey(now: DateInput = Date.now()): string {
  return businessDate(now).slice(0, 7);
}

/** "September 2026" from "2026-09" (or any parseable date). */
export function formatMonth(input: string | DateInput, fallback = '—'): string {
  if (typeof input === 'string') {
    const m = MONTH_KEY_RE.exec(input);
    if (m) {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15, 12));
      return dtf({ month: 'long', year: 'numeric' }).format(d);
    }
  }
  const d = toDate(input as DateInput);
  return d ? dtf({ month: 'long', year: 'numeric' }).format(d) : fallback;
}

/** Shift a YYYY-MM month key by `delta` months. */
export function addMonths(key: string, delta: number): string {
  const m = MONTH_KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid month key: ${key}`);
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

/** Last `count` month keys ending at `fromKey` (inclusive), newest first. */
export function recentMonths(count: number, fromKey: string = monthKey()): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(fromKey, -i));
}

/** "hh:mm" from milliseconds (negative → 00:00). Hours can exceed 24. */
export function formatDurationHM(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "hh:mm:ss" from milliseconds. */
export function formatDurationHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Spoken form for screen readers: "7 hours 5 minutes". */
export function durationAccessibilityLabel(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hs = `${h} ${h === 1 ? 'hour' : 'hours'}`;
  const mins = `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  return h ? `${hs} ${mins}` : mins;
}

const inr = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inrWhole = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** "₹1,23,456.5" (Indian digit grouping). */
export function formatCurrency(amount: number | null | undefined, opts: { whole?: boolean; fallback?: string } = {}): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return opts.fallback ?? '—';
  return (opts.whole ? inrWhole : inr).format(amount);
}

const numberFormat = new Intl.NumberFormat(LOCALE);
export function formatNumber(n: number | null | undefined, fallback = '—'): string {
  return n === null || n === undefined || Number.isNaN(n) ? fallback : numberFormat.format(n);
}

/** "1 day" / "2.5 days" */
export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

/** Converts a local Date picked in a date picker into YYYY-MM-DD (device calendar day). */
export function dateToBusinessString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD → local Date at midnight (for date pickers). Returns null when invalid. */
export function businessStringToLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = BUSINESS_DATE_RE.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
