import type { SafePerson, TeamResponse } from '@/types/api';

export type TeamRow =
  | { kind: 'person'; key: string; person: SafePerson; isManager: boolean; isSelf: boolean }
  | { kind: 'unassigned'; key: string }
  | { kind: 'empty'; key: string; message: string };

export interface TeamSection {
  key: 'manager' | 'members';
  title: string;
  data: TeamRow[];
}

export interface TeamView {
  department: { id: string; name: string } | null;
  managerStatus: TeamResponse['managerStatus'];
  totalMembers: number;
  matchedMembers: number;
  hasMore: boolean;
  sections: TeamSection[];
}

/**
 * Builds manager-first sections from TeamResponse pages.
 * - The manager is its own section and never part of member pages (deduped defensively).
 * - The viewer ("You") appears once: if they are the manager, they are removed from members.
 * - Members keep server order (name, then id) and are deduped across pages.
 */
export function buildTeamView(pages: TeamResponse[], viewerUserId: string | undefined, search: string): TeamView {
  const first = pages[0];
  const last = pages[pages.length - 1];
  const manager = first?.manager ?? null;
  const isSelf = (p: SafePerson) => p.isSelf || (!!viewerUserId && p.userId === viewerUserId);
  const managerIsSelf = !!manager && isSelf(manager);

  const seen = new Set<string>();
  if (manager) seen.add(manager.employeeRecordId);
  const members: TeamRow[] = [];
  for (const page of pages) {
    for (const m of page.members ?? []) {
      if (seen.has(m.employeeRecordId)) continue;
      if (managerIsSelf && isSelf(m)) continue;
      seen.add(m.employeeRecordId);
      members.push({ kind: 'person', key: m.employeeRecordId, person: m, isManager: false, isSelf: isSelf(m) });
    }
  }
  // "You" only once among members.
  let selfShown = managerIsSelf;
  const memberRows = members.map((r) => {
    if (r.kind === 'person' && r.isSelf) {
      if (selfShown) return { ...r, isSelf: false };
      selfShown = true;
    }
    return r;
  });

  const managerRows: TeamRow[] = manager
    ? [{ kind: 'person', key: `mgr-${manager.employeeRecordId}`, person: manager, isManager: true, isSelf: managerIsSelf }]
    : [{ kind: 'unassigned', key: 'mgr-unassigned' }];

  if (memberRows.length === 0) {
    memberRows.push({
      kind: 'empty',
      key: 'members-empty',
      message: search ? `No colleagues match “${search}”.` : 'No other colleagues in your department yet.',
    });
  }

  return {
    department: first?.department ?? null,
    managerStatus: first?.managerStatus ?? 'no_department',
    totalMembers: first?.totalMembers ?? 0,
    matchedMembers: first?.matchedMembers ?? 0,
    hasMore: !!last?.hasMore,
    sections: [
      { key: 'manager', title: 'Manager', data: managerRows },
      { key: 'members', title: 'Team members', data: memberRows },
    ],
  };
}
