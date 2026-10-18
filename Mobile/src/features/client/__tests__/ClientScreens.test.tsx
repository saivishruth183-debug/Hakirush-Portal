import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { ClientHomeScreen } from '@/features/client/home/ClientHomeScreen';
import { GalleryViewerScreen } from '@/features/client/gallery/GalleryViewerScreen';
import { ClientRelationshipScreen } from '@/features/client/relationship/ClientRelationshipScreen';
import { UpdateDetailScreen } from '@/features/client/updates/UpdateDetailScreen';
import { useSession } from '@/services/session';
import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import { authResponse, jsonResponse, mockFetch, type FakeResponse, type RecordedCall } from '@/testing/fetchMock';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { resetAuthWorld, secureStore } from '@/testing/resetSession';
import type { SessionUser } from '@/types/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

jest.setTimeout(20_000);

const CLIENT_USER: SessionUser = {
  _id: 'client-user-1',
  name: 'Acme Sports',
  email: 'ops@acme.test',
  role: 'client',
  clientId: 'client-1',
  departmentId: null,
};

const CLIENT = {
  _id: 'client-1',
  userId: { _id: 'client-user-1', name: 'Acme Sports', email: 'ops@acme.test', profileImage: '' },
  dateOfJoining: '2026-01-15T00:00:00.000Z',
  companyLogo: '',
  budget: 500000,
  planType: 'Annual',
};

type Routes = Record<string, (call: RecordedCall) => FakeResponse>;

function mockClientApi(routes: Routes): RecordedCall[] {
  return mockFetch((call) => {
    if (call.path === '/api/auth/mobile/refresh') return jsonResponse(200, authResponse('1', CLIENT_USER));
    const handler = routes[`${call.method} ${call.path}`];
    return handler ? handler(call) : jsonResponse(404, { success: false, error: 'Not found', code: 'NOT_FOUND' });
  });
}

/** Renders children only once the (mocked) client session is verified, like the role layout does. */
function SignedIn({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  return user && status === 'authenticated' ? <>{children}</> : null;
}

async function renderClient(ui: ReactNode) {
  secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
  secureStore().set(SESSION_STORAGE_KEYS.snapshot, JSON.stringify(toSnapshot(CLIENT_USER)));
  return renderWithProviders(<SignedIn>{ui}</SignedIn>);
}

/** Make confirm() resolve with the given choice (button 0 = Cancel, 1 = confirm). */
function answerConfirm(choice: boolean) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.[choice ? 1 : 0]?.onPress?.();
  });
}

beforeEach(() => {
  resetAuthWorld();
  jest.clearAllMocks();
  mockParams = {};
});

afterEach(() => jest.restoreAllMocks());

describe('Client Home', () => {
  it('shows the own plan and honest empty states (no sample standings, gallery or updates)', async () => {
    mockClientApi({
      'GET /api/client/me': () => jsonResponse(200, { success: true, client: CLIENT }),
      'GET /api/client/me/performance': () => jsonResponse(200, { success: true, standings: [], updatedAt: null }),
      'GET /api/client/me/gallery': () => jsonResponse(200, { success: true, images: [] }),
      'GET /api/announcements/public': () => jsonResponse(200, { success: true, announcements: [] }),
    });
    await renderClient(<ClientHomeScreen />);
    expect(await screen.findByText('Acme Sports')).toBeTruthy();
    expect(screen.getByText('Annual plan')).toBeTruthy();
    expect(screen.getByLabelText('Budget: ₹5,00,000')).toBeTruthy();
    expect(screen.getByLabelText('Member since: 15 Jan 2026')).toBeTruthy();
    expect(await screen.findByText('No standings published yet')).toBeTruthy();
    expect(await screen.findByText('No gallery images yet')).toBeTruthy();
    expect(await screen.findByText(/No updates yet/)).toBeTruthy();
    expect(screen.queryByTestId('standings')).toBeNull();
  });

  it('lists standings by points and opens the tapped gallery image', async () => {
    mockClientApi({
      'GET /api/client/me': () => jsonResponse(200, { success: true, client: CLIENT }),
      'GET /api/client/me/performance': () =>
        jsonResponse(200, {
          success: true,
          standings: [
            { _id: 's1', teamName: 'Blue Whales', played: 4, won: 1, lost: 3, points: 2 },
            { _id: 's2', teamName: 'Red Hawks', played: 4, won: 3, lost: 1, points: 6 },
          ],
          updatedAt: '2026-09-20T10:00:00.000Z',
        }),
      'GET /api/client/me/gallery': () =>
        jsonResponse(200, {
          success: true,
          images: [
            { _id: 'g1', url: 'https://cdn.test/1.jpg', caption: 'Opening' },
            { _id: 'g2', url: 'https://cdn.test/2.jpg', caption: 'Final' },
          ],
        }),
      'GET /api/announcements/public': () => jsonResponse(200, { success: true, announcements: [] }),
    });
    await renderClient(<ClientHomeScreen />);
    expect(await screen.findByLabelText('Rank 1. Red Hawks. Played 4, won 3, lost 1. 6 points.')).toBeTruthy();
    expect(screen.getByLabelText('Rank 2. Blue Whales. Played 4, won 1, lost 3. 2 points.')).toBeTruthy();
    const preview = await screen.findByTestId('gallery-preview');
    await fireEvent(preview, 'layout', { nativeEvent: { layout: { width: 330, height: 120 } } });
    await fireEvent.press(await screen.findByLabelText('Final, image 2 of 2'));
    expect(mockRouter.push).toHaveBeenCalledWith('/client/gallery/1');
  });

  it('shows "Access pending" when no client record is linked (404)', async () => {
    mockClientApi({
      'GET /api/client/me': () => jsonResponse(404, { success: false, error: 'Client profile not found', code: 'NOT_FOUND' }),
      'GET /api/client/me/performance': () => jsonResponse(200, { success: true, standings: [], updatedAt: null }),
      'GET /api/client/me/gallery': () => jsonResponse(200, { success: true, images: [] }),
      'GET /api/announcements/public': () => jsonResponse(200, { success: true, announcements: [] }),
    });
    await renderClient(<ClientHomeScreen />);
    expect(await screen.findByText('Access pending')).toBeTruthy();
  });
});

describe('Gallery viewer', () => {
  it('opens at the tapped index', async () => {
    mockParams = { index: '1' };
    mockClientApi({
      'GET /api/client/me/gallery': () =>
        jsonResponse(200, {
          success: true,
          images: [
            { _id: 'g1', url: 'https://cdn.test/1.jpg', caption: 'Opening' },
            { _id: 'g2', url: 'https://cdn.test/2.jpg', caption: 'Final' },
            { _id: 'g3', url: 'https://cdn.test/3.jpg', caption: '' },
          ],
        }),
    });
    await renderClient(<GalleryViewerScreen />);
    expect(await screen.findByText('2 of 3')).toBeTruthy();
    expect(screen.getByTestId('gallery-caption').props.children).toBe('Final');
    await fireEvent(screen.getByTestId('gallery-pager'), 'layout', { nativeEvent: { layout: { width: 400, height: 700 } } });
    // The pager starts at the tapped image (initialScrollIndex) and renders that page first.
    expect(await screen.findByLabelText('Final, image 2 of 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close gallery'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('Relationship (roster)', () => {
  const entries = [
    { _id: 'e1', name: 'Rahul Sharma', jerseySize: 'L', createdAt: '2026-09-30T05:00:00.000Z' },
    { _id: 'e2', name: 'Priya Nair', jerseySize: 'M', createdAt: '2026-09-29T05:00:00.000Z' },
  ];

  it('lists entries with a size summary and validates before posting', async () => {
    const calls = mockClientApi({
      'GET /api/client/me/roster': () => jsonResponse(200, { success: true, entries }),
    });
    await renderClient(<ClientRelationshipScreen />);
    expect(await screen.findByText('Rahul Sharma')).toBeTruthy();
    expect(screen.getByText('Roster (2)')).toBeTruthy();
    expect(screen.getByLabelText(/Jersey sizes for ordering: XS 0, S 0, M 1, L 1, XL 0, XXL 0\. Total 2\./)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('roster-submit'));
    expect(await screen.findByText('Enter a name.')).toBeTruthy();
    expect(screen.getByText('Choose a jersey size.')).toBeTruthy();
    expect(calls.filter((c) => c.path === '/api/client/me/roster' && c.method === 'POST')).toHaveLength(0);
  });

  it('adds an entry, keeps the form after a server error, and clears it after success', async () => {
    let attempt = 0;
    const calls = mockClientApi({
      'GET /api/client/me/roster': () => jsonResponse(200, { success: true, entries }),
      'POST /api/client/me/roster': (call) => {
        attempt += 1;
        if (attempt === 1) return jsonResponse(409, { success: false, error: 'Roster is limited to 200 entries', code: 'CONFLICT' });
        return jsonResponse(201, { success: true, entry: { _id: 'e3', ...(call.body as object), createdAt: '2026-10-01T05:00:00.000Z' } });
      },
    });
    await renderClient(<ClientRelationshipScreen />);
    await screen.findByText('Rahul Sharma');
    await fireEvent.changeText(screen.getByLabelText('Name (required)'), '  Asha Rao ');
    await fireEvent.press(screen.getByTestId('roster-size'));
    await fireEvent.press(await screen.findByLabelText('XL - Extra Large'));
    await fireEvent.press(screen.getByTestId('roster-submit'));

    expect(await screen.findByText('Roster is limited to 200 entries')).toBeTruthy();
    expect(screen.getByLabelText('Name (required)').props.value).toBe('  Asha Rao ');

    await fireEvent.press(screen.getByTestId('roster-submit'));
    await waitFor(() => expect(screen.getByLabelText('Name (required)').props.value).toBe(''));
    const posts = calls.filter((c) => c.method === 'POST' && c.path === '/api/client/me/roster');
    expect(posts).toHaveLength(2);
    expect(posts[1].body).toEqual({ name: 'Asha Rao', jerseySize: 'XL' });
  });

  it('deletes only after confirmation', async () => {
    let current = [...entries];
    const calls = mockClientApi({
      'GET /api/client/me/roster': () => jsonResponse(200, { success: true, entries: current }),
      'DELETE /api/client/me/roster/e1': () => {
        current = current.filter((e) => e._id !== 'e1');
        return jsonResponse(200, { success: true });
      },
    });
    await renderClient(<ClientRelationshipScreen />);
    await screen.findByText('Rahul Sharma');

    answerConfirm(false);
    await fireEvent.press(screen.getByLabelText('Remove Rahul Sharma'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);

    jest.restoreAllMocks();
    answerConfirm(true);
    await fireEvent.press(screen.getByLabelText('Remove Rahul Sharma'));
    await waitFor(() => expect(screen.queryByText('Rahul Sharma')).toBeNull());
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual(['/api/client/me/roster/e1']);
    expect(screen.getByText('Roster (1)')).toBeTruthy();
  });
});

describe('Update detail', () => {
  const base = {
    _id: 'a1',
    title: 'Annual sports day',
    description: 'Join us for the finals.',
    type: 'Annual',
    date: '2026-10-10',
    venue: 'City Stadium',
    status: 'Upcoming',
  };

  it('marks an unread update as read when opened', async () => {
    mockParams = { id: 'a1' };
    const calls = mockClientApi({
      'GET /api/announcements/a1': () => jsonResponse(200, { success: true, announcement: { ...base, seen: false, seenBy: [] } }),
      'PUT /api/announcements/a1/read': () =>
        jsonResponse(200, { success: true, message: 'Marked as read', announcementId: 'a1', seen: true }),
    });
    await renderClient(<UpdateDetailScreen />);
    expect(await screen.findByText('Annual sports day')).toBeTruthy();
    expect(screen.getByLabelText('Venue: City Stadium')).toBeTruthy();
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1));
    expect(calls.find((c) => c.method === 'PUT')?.path).toBe('/api/announcements/a1/read');
  });

  it('does not call mark-read for an update already seen', async () => {
    mockParams = { id: 'a1' };
    const calls = mockClientApi({
      'GET /api/announcements/a1': () =>
        jsonResponse(200, { success: true, announcement: { ...base, seen: true, seenBy: ['client-user-1'] } }),
    });
    await renderClient(<UpdateDetailScreen />);
    expect(await screen.findByText('Annual sports day')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });
});
