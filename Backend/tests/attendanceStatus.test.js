import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendanceForEmployee } from '../utils/attendanceStatus.js';

test('returns Leave when an approved leave exists for the employee', () => {
  const result = buildAttendanceForEmployee({
    employee: { _id: 'emp-1', userId: { name: 'Alice' }, department: { dep_name: 'HR' } },
    record: null,
    isOffDay: false,
    leaveByEmployeeId: new Map([['emp-1', { _id: 'leave-1' }]]),
    todayStr: '2026-08-06'
  });

  assert.equal(result.status, 'Leave');
  assert.equal(result.workedHours, 0);
  assert.equal(result.checkIn, null);
  assert.equal(result.checkOut, null);
});

test('preserves existing attendance record when no leave exists', () => {
  const record = {
    _id: 'att-1',
    status: 'Present',
    workedHours: 8,
    checkIn: '2026-08-06T08:00:00.000Z',
    checkOut: '2026-08-06T16:00:00.000Z',
    employeeId: { _id: 'emp-2' }
  };

  const result = buildAttendanceForEmployee({
    employee: { _id: 'emp-2', userId: { name: 'Bob' }, department: { dep_name: 'Engineering' } },
    record,
    isOffDay: false,
    leaveByEmployeeId: new Map(),
    todayStr: '2026-08-06'
  });

  assert.equal(result.status, 'Present');
  assert.equal(result.workedHours, 8);
  assert.equal(result._id, 'att-1');
});

test('marks a past incomplete checkout as Present with nominal hours', () => {
  const result = buildAttendanceForEmployee({
    employee: { _id: 'emp-3', userId: { name: 'Carol' }, department: { dep_name: 'Finance' } },
    record: {
      _id: 'att-2',
      date: '2026-08-05',
      status: '',
      workedHours: 0,
      checkIn: '2026-08-05T08:00:00.000Z',
      checkOut: null,
      employeeId: { _id: 'emp-3' }
    },
    isOffDay: false,
    leaveByEmployeeId: new Map(),
    todayStr: '2026-08-06'
  });

  assert.equal(result.status, 'Present');
  assert.equal(result.workedHours, 8);
  assert.equal(result.checkOut, null);
});

/* ===== Shared rule helpers (added with the attendance hardening) ===== */
import {
  getStatusFromHours,
  isIncompleteCheckout,
  workedMsAt,
  pausedMsAt,
  msToHours,
  NOMINAL_HOURS,
} from '../utils/attendanceStatus.js';

test('status thresholds stay Present >= 8h, Half Day >= 4h, else Absent', () => {
  assert.equal(getStatusFromHours(8), 'Present');
  assert.equal(getStatusFromHours(9.5), 'Present');
  assert.equal(getStatusFromHours(7.99), 'Half Day');
  assert.equal(getStatusFromHours(4), 'Half Day');
  assert.equal(getStatusFromHours(3.99), 'Absent');
  assert.equal(getStatusFromHours(0), 'Absent');
  assert.deepEqual(NOMINAL_HOURS, { Present: 8, 'Half Day': 4, Absent: 0, Leave: 0 });
});

test('worked time subtracts closed and still-open pauses', () => {
  const rec = {
    checkIn: '2026-08-06T03:30:00.000Z',
    totalPausedMs: 30 * 60 * 1000,
    isPaused: true,
    pauseStartedAt: '2026-08-06T08:00:00.000Z',
  };
  const end = '2026-08-06T09:00:00.000Z';
  assert.equal(pausedMsAt(rec, end), 90 * 60 * 1000);
  assert.equal(msToHours(workedMsAt(rec, end)), 4);
  assert.equal(workedMsAt({ checkIn: null }, end), 0);
});

test('explicit statuses are never treated as an incomplete checkout', () => {
  const base = { checkIn: '2026-08-05T03:30:00.000Z', checkOut: null };
  assert.equal(isIncompleteCheckout({ ...base, status: '' }), true);
  assert.equal(isIncompleteCheckout({ ...base, status: 'Absent' }), true);
  for (const status of ['Present', 'Half Day', 'Leave']) {
    assert.equal(isIncompleteCheckout({ ...base, status }), false, status);
  }
  assert.equal(isIncompleteCheckout({ ...base, checkOut: '2026-08-05T12:00:00.000Z', status: '' }), false);
});

test("keeps today's open check-in as is and marks off days without a record as Holiday", () => {
  const open = buildAttendanceForEmployee({
    employee: { _id: 'emp-4' },
    record: { _id: 'att-3', date: '2026-08-06', status: '', checkIn: '2026-08-06T03:30:00.000Z', checkOut: null },
    isOffDay: false,
    leaveByEmployeeId: new Map(),
    todayStr: '2026-08-06',
  });
  assert.equal(open.status, '');
  assert.equal(open._id, 'att-3');

  const off = buildAttendanceForEmployee({
    employee: { _id: 'emp-5' },
    record: null,
    isOffDay: true,
    leaveByEmployeeId: new Map(),
    todayStr: '2026-08-08',
  });
  assert.equal(off.status, 'Holiday');
  assert.equal(off.workedHours, 0);
});
