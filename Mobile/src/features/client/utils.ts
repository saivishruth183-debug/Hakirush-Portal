import { getErrorMessage, isApiError } from '@/services/api/errors';
import { getApiBaseUrl } from '@/services/api/config';
import type { Standing } from '@/types/api';
import { formatDate } from '@/utils/format';

import {
  JERSEY_SIZES,
  ROSTER_MAX_ENTRIES,
  ROSTER_NAME_MAX,
  type ClientAnnouncement,
  type JerseySizeValue,
} from './api';

// ---------- Media ----------

/**
 * Gallery / logo URLs are absolute (ImageKit) but older records may be backend-relative
 * (the web resolves them the same way). Returns null for anything unusable.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return `${getApiBaseUrl()}/${trimmed.replace(/^\/+/, '')}`;
  } catch {
    return null;
  }
}

/**
 * Smaller variant for grid thumbnails. Only ImageKit URLs without an existing transformation are
 * rewritten (`?tr=w-…,h-…` is ImageKit's URL transformation API); everything else is returned as is.
 * Callers fall back to the original URL if the thumbnail fails to load.
 */
export function thumbnailUrl(url: string, sizePx: number): string {
  const px = Math.max(64, Math.min(1024, Math.round(sizePx)));
  if (!/^https:\/\/ik\.imagekit\.io\//i.test(url) || /[?&]tr=/.test(url) || /\/tr:/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}tr=w-${px},h-${px}`;
}

// ---------- Standings ----------

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Same order as the web leaderboard: points desc, then wins desc; otherwise the server's order. */
export function sortStandings(rows: readonly Standing[]): Standing[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => num(b.row.points) - num(a.row.points) || num(b.row.won) - num(a.row.won) || a.i - b.i)
    .map(({ row }) => row);
}

export function standingAccessibilityLabel(row: Standing, rank: number): string {
  return `Rank ${rank}. ${row.teamName}. Played ${num(row.played)}, won ${num(row.won)}, lost ${num(row.lost)}. ${num(row.points)} points.`;
}

// ---------- Roster ----------

export type SizeCounts = Record<JerseySizeValue, number> & { other: number; total: number };

/** Jersey counts per size (for apparel ordering). Unknown sizes are counted under `other`. */
export function countBySize(entries: readonly { jerseySize?: string | null }[]): SizeCounts {
  const counts = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0, other: 0, total: 0 } as SizeCounts;
  for (const e of entries) {
    const size = String(e.jerseySize ?? '').toUpperCase() as JerseySizeValue;
    if ((JERSEY_SIZES as readonly string[]).includes(size)) counts[size] += 1;
    else counts.other += 1;
    counts.total += 1;
  }
  return counts;
}

export interface RosterFormErrors {
  name?: string;
  jerseySize?: string;
}

/** Mirrors the server rules in addMyRosterEntry (trimmed name 1–80 chars, size from the enum). */
export function validateRosterEntry(v: { name: string; jerseySize: string | null }): RosterFormErrors {
  const errors: RosterFormErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'Enter a name.';
  else if (name.length > ROSTER_NAME_MAX) errors.name = `Use ${ROSTER_NAME_MAX} characters or fewer.`;
  if (!v.jerseySize) errors.jerseySize = 'Choose a jersey size.';
  else if (!(JERSEY_SIZES as readonly string[]).includes(v.jerseySize)) errors.jerseySize = 'Choose one of the listed sizes.';
  return errors;
}

/**
 * Maps a failed POST /api/client/me/roster to field or form errors.
 * The server answers 400 VALIDATION_ERROR with messages that start with the field name
 * ("name is too long", "jerseySize must be one of: …") and 409 CONFLICT when the roster is full.
 */
export function rosterErrorFromServer(e: unknown): { fields: RosterFormErrors; form: string | null } {
  if (isApiError(e) && e.kind === 'http' && e.status === 400) {
    const message = e.message ?? '';
    if (/^name\b/i.test(message)) {
      return {
        fields: { name: /too long/i.test(message) ? `Use ${ROSTER_NAME_MAX} characters or fewer.` : 'Enter a name.' },
        form: null,
      };
    }
    if (/^jerseySize\b/i.test(message)) {
      return { fields: { jerseySize: `Choose one of ${JERSEY_SIZES.join(', ')}.` }, form: null };
    }
  }
  if (isApiError(e) && e.kind === 'http' && e.status === 409) {
    return {
      fields: {},
      form: e.message || `Your roster is limited to ${ROSTER_MAX_ENTRIES} people. Remove someone to add more.`,
    };
  }
  return { fields: {}, form: getErrorMessage(e, "Couldn't add this person to the roster.") };
}

// ---------- Announcements ----------

/** The backend stores `date` as free text (usually YYYY-MM-DD). Format real dates, show the rest as typed. */
export function formatAnnouncementDate(date: string | null | undefined): string {
  const value = (date ?? '').trim();
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value, value) : value;
}

/** Unread for this viewer: prefers the server's `seen` flag, falls back to `seenBy`. */
export function isUnread(a: Pick<ClientAnnouncement, 'seen' | 'seenBy'>, userId: string | undefined): boolean {
  if (typeof a.seen === 'boolean') return !a.seen;
  if (!userId) return false;
  return !(a.seenBy ?? []).some((id) => String(id) === userId);
}
