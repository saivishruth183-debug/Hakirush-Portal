import { attendancePhase, computeClockOffset, computeCurrentPauseMs, computeWorkedMs } from '@/utils/attendanceTimer';

const T0 = Date.parse('2026-10-01T03:30:00.000Z'); // 09:00 IST
const iso = (msFromT0: number) => new Date(T0 + msFromT0).toISOString();
const H = 3_600_000;
const M = 60_000;

describe('attendanceTimer', () => {
  it('not started → 0', () => {
    expect(computeWorkedMs(null)).toBe(0);
    expect(computeWorkedMs({ checkIn: null, checkOut: null })).toBe(0);
    expect(attendancePhase(null)).toBe('notStarted');
  });

  it('working: now − checkIn − totalPausedMs', () => {
    const a = { checkIn: iso(0), checkOut: null, totalPausedMs: 15 * M, isPaused: false, pauseStartedAt: null };
    expect(computeWorkedMs(a, 0, T0 + 2 * H)).toBe(2 * H - 15 * M);
    expect(attendancePhase(a)).toBe('working');
  });

  it('paused: ongoing pause is excluded and the value is frozen', () => {
    const a = { checkIn: iso(0), checkOut: null, totalPausedMs: 0, isPaused: true, pauseStartedAt: iso(H) };
    expect(computeWorkedMs(a, 0, T0 + H + 20 * M)).toBe(H);
    expect(computeWorkedMs(a, 0, T0 + 3 * H)).toBe(H);
    expect(computeCurrentPauseMs(a, 0, T0 + H + 20 * M)).toBe(20 * M);
    expect(attendancePhase(a)).toBe('paused');
  });

  it('finished: uses checkOut regardless of the clock', () => {
    const a = { checkIn: iso(0), checkOut: iso(8 * H), totalPausedMs: 30 * M, isPaused: false, pauseStartedAt: null };
    expect(computeWorkedMs(a, 0, T0 + 20 * H)).toBe(8 * H - 30 * M);
    expect(attendancePhase(a)).toBe('finished');
  });

  it('corrects a wrong device clock with the server time offset', () => {
    // Device clock is 10 minutes slow.
    const deviceNow = T0 + H - 10 * M;
    const offset = computeClockOffset(iso(H), deviceNow);
    expect(offset).toBe(10 * M);
    const a = { checkIn: iso(0), checkOut: null, totalPausedMs: 0 };
    expect(computeWorkedMs(a, offset, deviceNow)).toBe(H);
  });

  it('never negative (clock behind checkIn, bogus paused total)', () => {
    expect(computeWorkedMs({ checkIn: iso(H), checkOut: null }, 0, T0)).toBe(0);
    expect(computeWorkedMs({ checkIn: iso(0), checkOut: iso(H), totalPausedMs: 5 * H })).toBe(0);
    expect(computeClockOffset('not a date', T0)).toBe(0);
  });
});
