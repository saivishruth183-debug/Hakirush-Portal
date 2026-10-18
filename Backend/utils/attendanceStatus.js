export const buildAttendanceForEmployee = ({ employee, record, isOffDay, leaveByEmployeeId, todayStr }) => {
  const employeeId = String(employee?._id || '');
  const leaveRecord = leaveByEmployeeId?.get(employeeId);

  if (leaveRecord) {
    return {
      _id: null,
      date: todayStr,
      status: 'Leave',
      workedHours: 0,
      checkIn: null,
      checkOut: null,
      isPaused: false,
      totalPausedMs: 0,
      employeeId: employee,
    };
  }

  if (record) {
    const recordData = record?._doc || record;
    const isIncompleteCheckout = Boolean(recordData?.checkIn && !recordData?.checkOut && recordData?.date && recordData.date < todayStr && !['Present', 'Half Day', 'Leave'].includes(recordData?.status));

    if (isIncompleteCheckout) {
      return {
        ...recordData,
        status: 'Present',
        workedHours: recordData?.workedHours && recordData.workedHours > 0 ? recordData.workedHours : NOMINAL_HOURS.Present,
        checkOut: null,
        employeeId: employee,
      };
    }

    return { ...recordData, employeeId: employee };
  }

  return {
    _id: null,
    date: todayStr,
    status: isOffDay ? 'Holiday' : 'Absent',
    workedHours: 0,
    checkIn: null,
    checkOut: null,
    isPaused: false,
    totalPausedMs: 0,
    employeeId: employee,
  };
};

/* ================= SHARED STATUS RULES =================
 * Status thresholds kept exactly as the original backend implemented them
 * (pending an owner decision): worked >= 8h => Present, >= 4h => Half Day,
 * otherwise Absent.
 */
export const PRESENT_MIN_HOURS = 8;
export const HALF_DAY_MIN_HOURS = 4;

export const ATTENDANCE_STATUSES = ['Present', 'Half Day', 'Absent', 'Leave'];

// Nominal hours recorded when a status is assigned without measured punches
// (admin manual status, approved correction). Same values the original code used.
export const NOMINAL_HOURS = { Present: PRESENT_MIN_HOURS, 'Half Day': HALF_DAY_MIN_HOURS, Absent: 0, Leave: 0 };

export const getStatusFromHours = (hours) => {
  if (hours >= PRESENT_MIN_HOURS) return 'Present';
  if (hours >= HALF_DAY_MIN_HOURS) return 'Half Day';
  return 'Absent';
};

// An open check-in that was never closed and whose status was not assigned explicitly.
export const isIncompleteCheckout = (rec) =>
  Boolean(rec?.checkIn && !rec?.checkOut && !['Present', 'Half Day', 'Leave'].includes(rec?.status));

export const msToHours = (ms) => Number((Math.max(0, ms) / 3600000).toFixed(2));

/**
 * Paused milliseconds including a still-open pause (at `at`).
 */
export const pausedMsAt = (rec, at) => {
  const base = Number(rec?.totalPausedMs) || 0;
  if (rec?.isPaused && rec?.pauseStartedAt) {
    return base + Math.max(0, new Date(at).getTime() - new Date(rec.pauseStartedAt).getTime());
  }
  return base;
};

/**
 * Worked milliseconds between checkIn and `end` (checkOut or now), minus paused time.
 */
export const workedMsAt = (rec, end) => {
  if (!rec?.checkIn) return 0;
  const stop = new Date(end).getTime();
  return Math.max(0, stop - new Date(rec.checkIn).getTime() - pausedMsAt(rec, stop));
};
