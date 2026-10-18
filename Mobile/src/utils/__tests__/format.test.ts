import { addMonths, businessDate, formatCurrency, formatDurationHM, monthKey } from '@/utils/format';
import { getInitials as getInitialsSafe } from '@/utils/identity';

describe('format', () => {
  it('business date / month in Asia/Kolkata regardless of device timezone', () => {
    // 2026-09-30T20:00Z is 2026-10-01 01:30 IST
    expect(businessDate('2026-09-30T20:00:00.000Z')).toBe('2026-10-01');
    expect(businessDate('2026-09-30T18:00:00.000Z')).toBe('2026-09-30');
    expect(monthKey('2026-09-30T20:00:00.000Z')).toBe('2026-10');
  });

  it('month arithmetic', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('durations as hh:mm', () => {
    expect(formatDurationHM(0)).toBe('00:00');
    expect(formatDurationHM((7 * 60 + 5) * 60_000 + 59_000)).toBe('07:05');
    expect(formatDurationHM(-5)).toBe('00:00');
  });

  it('INR currency', () => {
    expect(formatCurrency(123456)).toMatch(/1,23,456/);
    expect(formatCurrency(null)).toBe('—');
  });

  it('initials', () => {
    expect(getInitialsSafe('Asha Rao')).toBe('AR');
    expect(getInitialsSafe('  madonna ')).toBe('M');
    expect(getInitialsSafe('')).toBe('?');
  });
});
