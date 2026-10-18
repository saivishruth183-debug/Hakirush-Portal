import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import * as XLSX from 'xlsx';

import { AttendanceEmployeeScreen, manualStatusMessage } from '@/features/admin/attendance/AttendanceEmployeeScreen';
import { buildAttendanceCsv, buildAttendanceExportRows, buildAttendanceSheetAoa, buildXlsxBase64 } from '@/features/admin/ops/export';
import { validateHoliday } from '@/features/admin/ops/holidays/HolidayFormScreen';
import type { ReportResponse } from '@/features/admin/ops/types';
import { CorrectionDetailScreen } from '@/features/admin/requests/CorrectionDetailScreen';
import { LeaveDetailScreen } from '@/features/admin/requests/LeaveDetailScreen';
import { useSession } from '@/services/session';
import { SESSION_STORAGE_KEYS, toSnapshot } from '@/services/session/storage';
import { authResponse, jsonResponse, mockFetch, type RecordedCall } from '@/testing/fetchMock';
import { renderWithProviders } from '@/testing/renderWithProviders';
import { resetAuthWorld, secureStore } from '@/testing/resetSession';
import { businessDate } from '@/utils/format';

let mockParams: Record<string, string> = {};
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

const ADMIN = { _id: 'admin-1', name: 'Asha Admin', email: 'admin@example.com', role: 'admin' as const };

/** Mutations get gcTime Infinity too, so no 5-minute GC timer keeps Jest alive after the run. */
function testClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
}

type Handler = (call: RecordedCall) => ReturnType<typeof jsonResponse> | undefined;

/** Admin session + routed API mock (refresh answered here; anything unhandled → 404). */
function mockAdminApi(handler: Handler): RecordedCall[] {
  secureStore().set(SESSION_STORAGE_KEYS.refreshToken, 'refresh-0');
  secureStore().set(SESSION_STORAGE_KEYS.snapshot, JSON.stringify(toSnapshot({ ...ADMIN })));
  return mockFetch((call) => {
    if (call.path === '/api/auth/mobile/refresh') return jsonResponse(200, authResponse('1', { ...ADMIN, departmentId: null }));
    if (call.path === '/api/auth/verify') return jsonResponse(200, { success: true, user: ADMIN });
    return handler(call) ?? jsonResponse(404, { success: false, error: 'Not found', code: 'NOT_FOUND' });
  });
}

function WhenSignedIn({ children }: { children: ReactNode }) {
  const { user, canWrite } = useSession();
  return user && canWrite ? <>{children}</> : null;
}

/** confirm() is built on Alert.alert: answer with the confirm (true) or cancel (false) button. */
function answerConfirm(accept: boolean) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    const b = buttons?.[accept ? 1 : 0];
    b?.onPress?.();
  });
}

const employee = {
  _id: 'E1',
  employeeId: 'HAKI0007',
  designation: 'Designer',
  userId: { _id: 'U1', name: 'Ananya Rao', email: 'ananya@example.com' },
  department: { _id: 'D1', dep_name: 'Design' },
};

const pendingLeave = {
  _id: 'L1',
  employeeId: employee,
  leaveType: 'Casual Leave',
  startDate: '2026-10-05T00:00:00.000Z',
  endDate: '2026-10-06T00:00:00.000Z',
  reason: 'Family function',
  status: 'Pending',
  days: 2,
  createdAt: '2026-09-30T10:00:00.000Z',
};
const balance = {
  success: true,
  casual: { total: 12, used: 3, balance: 9 },
  sick: { total: 12, used: 0, balance: 12 },
  total: { total: 24, used: 3, balance: 21 },
  period: { basis: 'calendar-year', start: '2026-01-01', end: '2026-12-31' },
};

beforeEach(() => {
  resetAuthWorld();
  mockParams = {};
  jest.restoreAllMocks();
  mockRouter.push.mockReset();
  mockRouter.back.mockReset();
});

describe('Leave review (/admin/leaves/[id])', () => {
  function leaveApi(review: () => ReturnType<typeof jsonResponse>, state = { status: 'Pending' }) {
    return mockAdminApi((call) => {
      if (call.method === 'GET' && call.path === '/api/leave/detail/L1') {
        return jsonResponse(200, { success: true, leave: { ...pendingLeave, status: state.status } });
      }
      if (call.method === 'GET' && call.path === '/api/leave/balance/E1') return jsonResponse(200, balance);
      if (call.method === 'PUT' && call.path === '/api/leave/L1') return review();
      return undefined;
    });
  }

  it('approves after confirmation with the body the controller expects', async () => {
    mockParams = { id: 'L1' };
    const calls = leaveApi(() => jsonResponse(200, { success: true, leave: { ...pendingLeave, employeeId: 'E1', status: 'Approved' } }));
    const alert = answerConfirm(true);
    await renderWithProviders(
      <WhenSignedIn>
        <LeaveDetailScreen />
      </WhenSignedIn>,
      testClient(),
    );
    expect(await screen.findByText('Ananya Rao')).toBeTruthy();
    expect(await screen.findByText('9 of 12 days left (3 used)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('leave-approve'));
    expect(await screen.findByText('Leave approved.')).toBeTruthy();
    expect(alert).toHaveBeenCalledWith('Approve leave?', expect.stringContaining('Ananya Rao'), expect.any(Array), expect.any(Object));
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('/api/leave/L1');
    expect(puts[0].body).toEqual({ status: 'Approved' });
    // The detail now shows the reviewed status and no more review buttons.
    await waitFor(() => expect(screen.queryByTestId('leave-approve')).toBeNull());
  });

  it('does nothing when the rejection is cancelled in the dialog', async () => {
    mockParams = { id: 'L1' };
    const calls = leaveApi(() => jsonResponse(200, { success: true, leave: pendingLeave }));
    answerConfirm(false);
    await renderWithProviders(
      <WhenSignedIn>
        <LeaveDetailScreen />
      </WhenSignedIn>,
      testClient(),
    );
    await fireEvent.press(await screen.findByTestId('leave-reject'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
    expect(screen.getByTestId('leave-reject')).toBeTruthy();
  });

  it('409 ALREADY_REVIEWED: explains, refetches and shows the latest status', async () => {
    mockParams = { id: 'L1' };
    const state = { status: 'Pending' };
    const calls = leaveApi(() => {
      state.status = 'Rejected';
      return jsonResponse(409, {
        success: false,
        error: 'Leave request has already been reviewed',
        code: 'ALREADY_REVIEWED',
        details: { status: 'Rejected' },
      });
    }, state);
    answerConfirm(true);
    await renderWithProviders(
      <WhenSignedIn>
        <LeaveDetailScreen />
      </WhenSignedIn>,
      testClient(),
    );
    await fireEvent.press(await screen.findByTestId('leave-reject'));
    expect(await screen.findByText(/already reviewed \(now Rejected\)/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('leave-reject')).toBeNull());
    expect(calls.filter((c) => c.method === 'PUT')[0].body).toEqual({ status: 'Rejected' });
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/leave/detail/L1').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Correction review (/admin/corrections/[id])', () => {
  const pendingRequest = {
    _id: 'R1',
    employeeId: employee,
    date: '2026-09-29',
    currentStatus: 'Absent',
    requestedStatus: 'Present',
    reason: 'Forgot to check in',
    status: 'Pending',
    createdAt: '2026-09-30T05:00:00.000Z',
  };

  it('sends the decision with trimmed remarks after confirmation', async () => {
    mockParams = { id: 'R1', employeeId: 'E1' };
    const calls = mockAdminApi((call) => {
      if (call.method === 'GET' && call.path === '/api/attendance-request') {
        return jsonResponse(200, { success: true, requests: [pendingRequest] });
      }
      if (call.method === 'PUT' && call.path === '/api/attendance-request/R1/review') {
        return jsonResponse(200, {
          success: true,
          request: { ...pendingRequest, employeeId: 'E1', status: 'Approved', reviewedBy: 'admin-1', reviewRemarks: 'Verified', reviewedAt: '2026-10-01T06:00:00.000Z' },
          attendance: null,
        });
      }
      return undefined;
    });
    answerConfirm(true);
    await renderWithProviders(
      <WhenSignedIn>
        <CorrectionDetailScreen />
      </WhenSignedIn>,
      testClient(),
    );
    expect(await screen.findByText('Forgot to check in')).toBeTruthy();
    expect(calls.find((c) => c.path === '/api/attendance-request')?.url).toContain('employeeId=E1');
    await fireEvent.changeText(screen.getByLabelText('Remarks for the employee'), '  Verified  ');
    await fireEvent.press(screen.getByTestId('correction-approve'));
    expect(await screen.findByText('Correction approved.')).toBeTruthy();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({ decision: 'Approved', remarks: 'Verified' });
    expect(Alert.alert).toHaveBeenCalledWith('Approve correction?', expect.stringContaining('Remarks: Verified'), expect.any(Array), expect.any(Object));
    // Reviewer/audit fields are shown once reviewed.
    expect(await screen.findByText('You')).toBeTruthy();
  });

  it('409 ALREADY_REVIEWED keeps the remarks out of a second request and refetches', async () => {
    mockParams = { id: 'R1', employeeId: 'E1' };
    let reviewed = false;
    const calls = mockAdminApi((call) => {
      if (call.method === 'GET' && call.path === '/api/attendance-request') {
        return jsonResponse(200, {
          success: true,
          requests: [reviewed ? { ...pendingRequest, status: 'Rejected', reviewedBy: 'admin-2', reviewRemarks: 'No proof' } : pendingRequest],
        });
      }
      if (call.method === 'PUT') {
        reviewed = true;
        return jsonResponse(409, { success: false, error: 'Request has already been reviewed', code: 'ALREADY_REVIEWED', details: { status: 'Rejected' } });
      }
      return undefined;
    });
    answerConfirm(true);
    await renderWithProviders(
      <WhenSignedIn>
        <CorrectionDetailScreen />
      </WhenSignedIn>,
      testClient(),
    );
    await fireEvent.press(await screen.findByTestId('correction-reject'));
    expect(await screen.findByText(/already reviewed \(now Rejected\)/)).toBeTruthy();
    expect(await screen.findByText('Another admin')).toBeTruthy();
    expect(screen.getByText('No proof')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'PUT')[0].body).toEqual({ decision: 'Rejected' });
  });
});

describe('Manual attendance status (/admin/attendance/[employeeId])', () => {
  it('confirms, then PUTs {status, date} for the Employee._id', async () => {
    mockParams = { employeeId: 'E1' };
    const today = businessDate();
    const calls = mockAdminApi((call) => {
      if (call.method === 'GET' && call.path === '/api/attendance') {
        return jsonResponse(200, {
          success: true,
          attendance: [{ _id: null, date: today, status: 'Absent', workedHours: 0, checkIn: null, checkOut: null, employeeId: employee }],
          isOffDay: false,
          reason: '',
          businessDate: today,
          timezone: 'Asia/Kolkata',
        });
      }
      if (call.method === 'GET' && call.path === '/api/attendance/user/E1/monthly') {
        return jsonResponse(200, { success: true, attendance: [], month: today.slice(0, 7), businessDate: today, timezone: 'Asia/Kolkata' });
      }
      if (call.method === 'PUT' && call.path === '/api/attendance/update/E1') {
        return jsonResponse(200, {
          success: true,
          attendance: { _id: 'A1', date: today, status: 'Half Day', workedHours: 4, checkIn: null, checkOut: null, source: 'admin', adminUpdatedAt: '2026-10-01T06:00:00.000Z', employeeId: employee },
        });
      }
      return undefined;
    });
    const alert = answerConfirm(true);
    await renderWithProviders(
      <WhenSignedIn>
        <AttendanceEmployeeScreen />
      </WhenSignedIn>,
      testClient(),
    );
    expect(await screen.findByText('Ananya Rao')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Half Day, 2 of 4'));
    await fireEvent.press(screen.getByTestId('manual-submit'));
    expect(await screen.findByText(/marked Half Day/)).toBeTruthy();
    expect(alert).toHaveBeenCalledWith('Update attendance?', manualStatusMessage('Ananya Rao', 'Half Day', today), expect.any(Array), expect.any(Object));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({ status: 'Half Day', date: today });
    expect(await screen.findByText('Set manually by an admin')).toBeTruthy();
  });
});

describe('Attendance export builders', () => {
  const report: Pick<ReportResponse, 'groupData' | 'holidayMap'> = {
    holidayMap: {},
    groupData: {
      // 2026-10-04 is a Sunday: synthesized off-day rows read "Holiday" → weekend label.
      '2026-10-04': [
        { _id: null, date: '2026-10-04', employeeRecordId: 'E2', employeeId: 'HAKI10', employeeName: 'राहुल शर्मा', departmentName: 'Ops', status: 'Holiday', workedHours: 0, checkIn: null, checkOut: null, isPaused: false, pauseStartedAt: null, totalPausedMs: 0 },
      ],
      '2026-10-01': [
        { _id: 'a', date: '2026-10-01', employeeRecordId: 'E2', employeeId: 'HAKI10', employeeName: 'राहुल शर्मा', departmentName: '+Ops', status: 'Present', workedHours: 8.256, checkIn: '2026-10-01T03:35:00.000Z', checkOut: '2026-10-01T12:00:00.000Z', isPaused: false, pauseStartedAt: null, totalPausedMs: 0 },
        { _id: 'b', date: '2026-10-01', employeeRecordId: 'E1', employeeId: 'HAKI2', employeeName: '=HYPERLINK("http://evil","x")', departmentName: '@Design', status: 'Halfday', workedHours: 4, checkIn: null, checkOut: null, isPaused: false, pauseStartedAt: null, totalPausedMs: 0 },
        { _id: 'c', date: '2026-10-01', employeeRecordId: 'E3', employeeId: '-HAKI3', employeeName: 'Zoë Ånström', departmentName: 'QA', status: '', workedHours: 0, checkIn: '2026-10-01T04:00:00.000Z', checkOut: null, isPaused: true, pauseStartedAt: null, totalPausedMs: 0 },
      ],
    },
  };

  it('sorts by date then employee code, neutralises formulas, keeps numbers and Unicode', () => {
    const rows = buildAttendanceExportRows(report);
    expect(rows.map((r) => [r[0], r[1]])).toEqual([
      ['2026-10-01', "'-HAKI3"],
      ['2026-10-01', 'HAKI2'],
      ['2026-10-01', 'HAKI10'],
      ['2026-10-04', 'HAKI10'],
    ]);
    const [paused, formula, unicode, sunday] = rows;
    expect(formula[2]).toBe('\'=HYPERLINK("http://evil","x")');
    expect(formula[3]).toBe("'@Design");
    expect(formula[4]).toBe('Half Day');
    expect(formula[5]).toBe(4);
    expect(unicode[2]).toBe('राहुल शर्मा');
    expect(unicode[3]).toBe("'+Ops");
    expect(unicode[5]).toBe(8.26);
    expect(typeof unicode[6]).toBe('string');
    expect(unicode[6]).not.toBe('');
    expect(paused[2]).toBe('Zoë Ånström');
    expect(paused[4]).toBe('On break');
    expect(sunday[4]).toBe('Sunday (Weekend)');
    expect(sunday[5]).toBe(0);
  });

  it('XLSX: header row, numeric cells stay numbers, text cells are neutralised strings', () => {
    const base64 = buildXlsxBase64(buildAttendanceSheetAoa(report));
    const wb = XLSX.read(base64, { type: 'base64' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    expect(wb.SheetNames[0]).toBe('Attendance');
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    expect(aoa[0]).toEqual(['Date', 'Employee ID', 'Name', 'Department', 'Status', 'Worked Hours', 'Check In', 'Check Out']);
    expect(sheet.F3.t).toBe('n');
    expect(sheet.F3.v).toBe(4);
    expect(sheet.C3.t).toBe('s');
    expect(sheet.C3.v).toBe('\'=HYPERLINK("http://evil","x")');
    expect(sheet.C3.f).toBeUndefined();
    expect(sheet.C4.v).toBe('राहुल शर्मा');
  });

  it('CSV: BOM, quoted/neutralised formula cells, Unicode preserved', () => {
    const csv = buildAttendanceCsv(report);
    expect(csv.startsWith('﻿Date,Employee ID,Name,Department,Status,Worked Hours,Check In,Check Out\r\n')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csv).toContain("'@Design");
    expect(csv).toContain('राहुल शर्मा');
    expect(csv).toContain(',8.26,');
  });
});

describe('Holiday form validation', () => {
  it('requires a trimmed title (≤200) and a date', () => {
    expect(validateHoliday({ title: '   ', date: null })).toEqual({ title: 'Enter the holiday name.', date: 'Choose the date.' });
    expect(validateHoliday({ title: 'x'.repeat(201), date: '2026-12-25' })).toEqual({ title: 'Use at most 200 characters.' });
    expect(validateHoliday({ title: 'Diwali', date: '2026-11-08' })).toEqual({});
  });
});
