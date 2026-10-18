/**
 * Form helpers shared by the admin people + entities screens (employees, departments,
 * payslips, clients, sponsors, stalls). Pure functions: unit-testable, no React.
 */
import { getErrorMessage, isApiError } from '@/services/api';

/** True for errors that must never be shown (request aborted / stale session). */
export function isSilentError(e: unknown): boolean {
  return isApiError(e) && e.kind === 'cancelled';
}

/**
 * User-facing message for a failed write. Server messages are shown as-is (4xx); a few
 * codes whose 5xx text is replaced by the API client get a specific explanation.
 */
export function writeErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(e)) {
    switch (e.code) {
      case 'UPLOAD_FAILED':
        return 'The image could not be stored. Please try again.';
      case 'FILE_UNAVAILABLE':
        return 'The stored file could not be fetched. Please try again later.';
      case 'FILE_TOO_LARGE':
        return e.message || 'The file is too large (limit 5 MB).';
      case 'UNSUPPORTED_FILE':
        return e.message || 'This file type is not supported.';
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

/**
 * Which form field a server validation error refers to: `details.field` first, then the
 * leading word of the message (the backend validators say e.g. "salary must be a valid number",
 * "dep_name is required"). Returns null when the error is not about one known field.
 */
export function serverFieldOf<F extends string>(e: unknown, fields: readonly F[]): F | null {
  if (!isApiError(e) || e.kind !== 'http' || (e.status !== 400 && e.status !== 409)) return null;
  const details = e.details as { field?: unknown } | undefined;
  if (details && typeof details.field === 'string' && (fields as readonly string[]).includes(details.field)) {
    return details.field as F;
  }
  const lead = /^([A-Za-z_]+)\b/.exec(e.message ?? '')?.[1];
  if (lead && (fields as readonly string[]).includes(lead)) return lead as F;
  return null;
}

export interface NumberRule {
  /** Field label used in messages, e.g. "Salary". */
  label: string;
  required?: boolean;
  /** Inclusive minimum (default 0). */
  min?: number;
  /** Must be strictly greater than 0. */
  positive?: boolean;
  max?: number;
  integer?: boolean;
}

/** Parses a numeric text input. '' → null, invalid → NaN. Accepts "1,20,000" style grouping. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!t) return null;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Validates a numeric text input; returns an error message or null. */
export function validateNumber(text: string, rule: NumberRule): string | null {
  const n = parseNumber(text);
  if (n === null) return rule.required ? `Enter ${rule.label.toLowerCase()}.` : null;
  if (!Number.isFinite(n)) return `${rule.label} must be a number.`;
  if (rule.integer && !Number.isInteger(n)) return `${rule.label} must be a whole number.`;
  const min = rule.min ?? 0;
  if (n < min) return min === 0 ? `${rule.label} cannot be negative.` : `${rule.label} must be at least ${min}.`;
  if (rule.positive && n <= 0) return `${rule.label} must be greater than 0.`;
  if (rule.max !== undefined && n > rule.max) return `${rule.label} must be at most ${rule.max.toLocaleString('en-IN')}.`;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** Number → text for prefilled inputs (null/undefined → ''). */
export function numberText(n: number | null | undefined): string {
  return n === null || n === undefined || Number.isNaN(n) ? '' : String(n);
}

/** ISO instant or YYYY-MM-DD → YYYY-MM-DD (UTC calendar day, which is how the backend stores dates). */
export function isoToYmd(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export function hasErrors<F extends string>(errors: FieldErrors<F>): boolean {
  return Object.values(errors).some(Boolean);
}
