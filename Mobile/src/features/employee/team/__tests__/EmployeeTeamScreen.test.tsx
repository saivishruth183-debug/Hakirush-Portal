import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { EmployeeTeamScreen } from '@/features/employee/team/EmployeeTeamScreen';
import { buildTeamView } from '@/features/employee/team/teamSections';
import { useSession } from '@/services/session';
import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import { authResponse, jsonResponse, mockFetch, type RecordedCall } from '@/testing/fetchMock';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { resetAuthWorld, secureStore } from '@/testing/resetSession';
import type { SafePerson, TeamResponse } from '@/types/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('@/features/employee/testing/routerMock').createExpoRouterMock());

const person = (id: string, name: string, extra: Partial<SafePerson> = {}): SafePerson => ({
  employeeRecordId: `emp-${id}`,
  userId: `user-${id}`,
  employeeCode: `HAKI${id}`,
  name,
  designation: 'Developer',
  profileImageUrl: null,
  isSelf: false,
  isManager: false,
  ...extra,
});

const team = (over: Partial<TeamResponse> = {}): TeamResponse => ({
  success: true,
  version: 1,
  department: { id: 'dep-1', name: 'IT' },
  managerStatus: 'assigned',
  manager: person('m', 'Iris Manager', { isManager: true, designation: 'Engineering Manager' }),
  members: [person('al', 'Alan Dev'), person('me', 'Asha Rao', { userId: 'user-a', isSelf: true }), person('s', 'Sam Same')],
  totalMembers: 4,
  matchedMembers: 3,
  page: 1,
  limit: 50,
  hasMore: false,
  updatedAt: new Date().toISOString(),
  ...over,
});

function Gate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  return status === 'authenticated' ? <>{children}</> : null;
}

function setup(handler: (call: RecordedCall) => TeamResponse) {
  secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
  secureStore().set(
    SESSION_STORAGE_KEYS.snapshot,
    JSON.stringify(toSnapshot({ _id: 'user-a', name: 'Asha Rao', email: '', role: 'employee', departmentId: 'dep-1' })),
  );
  const calls = mockFetch((call) => {
    if (call.path === '/api/auth/mobile/refresh') return jsonResponse(200, authResponse('1'));
    if (call.path === '/api/employee/team/me') return jsonResponse(200, handler(call));
    return jsonResponse(404, { success: false });
  });
  return calls;
}

beforeEach(() => resetAuthWorld());

describe('EmployeeTeamScreen', () => {
  it('shows the department heading, the manager first with a Manager label, then members with "You" once', async () => {
    setup(() => team());
    await renderWithProviders(
      <Gate>
        <EmployeeTeamScreen />
      </Gate>,
    );
    expect(await screen.findByText('IT team')).toBeTruthy();
    const labels = screen.getAllByLabelText(/^[^,]+, (Developer|Engineering Manager)/).map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toBe('Iris Manager, Engineering Manager, Manager');
    expect(labels.slice(1)).toEqual(['Alan Dev, Developer', 'Asha Rao, Developer, You', 'Sam Same, Developer']);
    expect(screen.getAllByText('You')).toHaveLength(1);
    expect(screen.getAllByText('Manager').length).toBeGreaterThanOrEqual(1);
  });

  it('when the viewer is the manager they appear only once, in the manager section', () => {
    const me = person('me', 'Asha Rao', { userId: 'user-a', isSelf: true, isManager: true });
    const view = buildTeamView([team({ manager: me, members: [person('al', 'Alan Dev'), { ...me, isManager: false }] })], 'user-a', '');
    const rows = view.sections.flatMap((s) => s.data);
    const selfRows = rows.filter((r) => r.kind === 'person' && r.isSelf);
    expect(selfRows).toHaveLength(1);
    expect(view.sections[0].data[0]).toMatchObject({ kind: 'person', isManager: true, isSelf: true });
    expect(view.sections[1].data.map((r) => (r.kind === 'person' ? r.person.name : r.kind))).toEqual(['Alan Dev']);
  });

  it('shows "Manager not assigned" when the department has no manager', async () => {
    setup(() => team({ managerStatus: 'unassigned', manager: null }));
    await renderWithProviders(
      <Gate>
        <EmployeeTeamScreen />
      </Gate>,
    );
    expect(await screen.findByText('Manager not assigned')).toBeTruthy();
    expect(screen.getByText('Alan Dev')).toBeTruthy();
  });

  it('no department: explains it and renders no list', async () => {
    setup(() => team({ department: null, managerStatus: 'no_department', manager: null, members: [], totalMembers: 0, matchedMembers: 0 }));
    await renderWithProviders(
      <Gate>
        <EmployeeTeamScreen />
      </Gate>,
    );
    expect(await screen.findByText('Department not assigned')).toBeTruthy();
    expect(screen.queryByTestId('team-list')).toBeNull();
    expect(screen.queryByLabelText('Search colleagues by name or designation')).toBeNull();
  });

  it('search is sent to the server and keeps the manager section when no members match', async () => {
    const calls = setup((call) =>
      call.url.includes('search=zzz') ? team({ members: [], matchedMembers: 0 }) : team(),
    );
    await renderWithProviders(
      <Gate>
        <EmployeeTeamScreen />
      </Gate>,
    );
    await screen.findByText('IT team');
    await fireEvent.changeText(screen.getByLabelText('Search colleagues by name or designation'), 'zzz');
    expect(await screen.findByText('No colleagues match “zzz”.', {}, { timeout: 3000 })).toBeTruthy();
    const list = screen.getByTestId('team-list');
    expect(within(list).getByText('Iris Manager')).toBeTruthy();
    expect(within(list).queryByText('Alan Dev')).toBeNull();
    await waitFor(() => expect(calls.some((c) => c.path === '/api/employee/team/me' && c.url.includes('search=zzz'))).toBe(true));
  });
});
