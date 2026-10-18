/** Standings editor rows + validation (mirrors putClientPerformance in Backend/controllers/clientController.js). */
import type { Standing } from '@/types/api';

export const STANDINGS_MAX_ROWS = 50;
export const TEAM_NAME_MAX = 80;
const MAX_STAT = 100000;

export interface StandingRow {
  key: string;
  teamName: string;
  played: string;
  won: string;
  lost: string;
  points: string;
}

export type StandingStat = 'played' | 'won' | 'lost' | 'points';
export const STATS: StandingStat[] = ['played', 'won', 'lost', 'points'];
export type RowErrors = Partial<Record<'teamName' | StandingStat | 'row', string>>;

let seq = 0;
export function newRow(): StandingRow {
  seq += 1;
  return { key: `new-${seq}`, teamName: '', played: '', won: '', lost: '', points: '' };
}

export function rowsFromStandings(standings: Standing[]): StandingRow[] {
  return standings.map((s, i) => ({
    key: s._id ?? `row-${i}`,
    teamName: s.teamName,
    played: String(s.played),
    won: String(s.won),
    lost: String(s.lost),
    points: String(s.points),
  }));
}

function intOf(t: string): number | null {
  const s = t.trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** Returns per-row errors (index → errors); empty object when valid. */
export function validateStandings(rows: StandingRow[]): Record<number, RowErrors> {
  const out: Record<number, RowErrors> = {};
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const e: RowErrors = {};
    const name = r.teamName.trim();
    if (!name) e.teamName = 'Enter the team name.';
    else if (name.length > TEAM_NAME_MAX) e.teamName = `Use at most ${TEAM_NAME_MAX} characters.`;
    else if (seen.has(name.toLowerCase())) e.teamName = `Duplicate of row ${(seen.get(name.toLowerCase()) ?? 0) + 1}.`;
    else seen.set(name.toLowerCase(), i);
    for (const s of STATS) {
      const n = intOf(r[s]);
      if (n === null) e[s] = 'Whole number, 0 or more.';
      else if (n > MAX_STAT) e[s] = `At most ${MAX_STAT}.`;
    }
    const played = intOf(r.played);
    const won = intOf(r.won);
    const lost = intOf(r.lost);
    if (played !== null && won !== null && lost !== null && won + lost > played) e.row = 'Won + lost cannot be more than played.';
    if (Object.keys(e).length) out[i] = e;
  });
  return out;
}

export function rowsToPayload(rows: StandingRow[]): Omit<Standing, '_id'>[] {
  return rows.map((r) => ({
    teamName: r.teamName.trim(),
    played: Number(r.played.trim()),
    won: Number(r.won.trim()),
    lost: Number(r.lost.trim()),
    points: Number(r.points.trim()),
  }));
}
