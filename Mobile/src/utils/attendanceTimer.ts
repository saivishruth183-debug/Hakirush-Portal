/**
 * Attendance timer math (pure; no background stopwatch).
 *
 * The server is the source of truth: checkIn / checkOut / totalPausedMs / isPaused /
 * pauseStartedAt come from the Attendance record, and `serverTime` from the same response
 * lets us correct for a wrong device clock:
 *
 *   clockOffsetMs = Date.parse(serverTime) - deviceNowAtResponse
 *   serverNow     = deviceNow + clockOffsetMs
 *
 * Re-render on an interval (e.g. every second while the screen is focused & app active) and
 * call `computeWorkedMs` each time — nothing accumulates on the device.
 */

export interface AttendanceTimerInput {
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  totalPausedMs?: number | null;
  isPaused?: boolean | null;
  pauseStartedAt?: string | null;
}

export type AttendancePhase = 'notStarted' | 'working' | 'paused' | 'finished';

/** Offset to add to the device clock to get server time. */
export function computeClockOffset(serverTimeIso: string | null | undefined, deviceNowMs: number = Date.now()): number {
  if (!serverTimeIso) return 0;
  const server = Date.parse(serverTimeIso);
  return Number.isFinite(server) ? server - deviceNowMs : 0;
}

export function attendancePhase(a: AttendanceTimerInput | null | undefined): AttendancePhase {
  if (!a || !a.checkIn) return 'notStarted';
  if (a.checkOut) return 'finished';
  return a.isPaused ? 'paused' : 'working';
}

/**
 * Worked milliseconds = (end − checkIn) − totalPausedMs − (ongoing pause),
 * where end = checkOut if checked out, else server "now".
 * Never negative; never counts time in the future.
 */
export function computeWorkedMs(
  a: AttendanceTimerInput | null | undefined,
  clockOffsetMs = 0,
  deviceNowMs: number = Date.now(),
): number {
  if (!a || !a.checkIn) return 0;
  const checkIn = Date.parse(a.checkIn);
  if (!Number.isFinite(checkIn)) return 0;
  const serverNow = deviceNowMs + clockOffsetMs;

  const checkOut = a.checkOut ? Date.parse(a.checkOut) : NaN;
  const end = Number.isFinite(checkOut) ? checkOut : serverNow;

  let paused = Math.max(0, a.totalPausedMs ?? 0);
  if (!Number.isFinite(checkOut) && a.isPaused && a.pauseStartedAt) {
    const pauseStart = Date.parse(a.pauseStartedAt);
    if (Number.isFinite(pauseStart)) paused += Math.max(0, end - pauseStart);
  }
  return Math.max(0, end - checkIn - paused);
}

/** Current pause duration (0 when not paused). */
export function computeCurrentPauseMs(
  a: AttendanceTimerInput | null | undefined,
  clockOffsetMs = 0,
  deviceNowMs: number = Date.now(),
): number {
  if (!a || !a.isPaused || !a.pauseStartedAt || a.checkOut) return 0;
  const start = Date.parse(a.pauseStartedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, deviceNowMs + clockOffsetMs - start);
}
