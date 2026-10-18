/** Dashboard summary → CSV rows (Section, Metric, Value). Pure; birthdays are not exported (personal data). */
import { toCsv, type CsvCell } from '@/utils/csv';

import type { AdminAttendanceSummary, DashboardSummaryResponse } from '@/features/admin/ops/types';

export function buildSummaryCsvRows(
  summary: DashboardSummaryResponse,
  attendance: AdminAttendanceSummary | undefined,
  pending: { leaves?: number; corrections?: number },
  generatedOn: string,
): CsvCell[][] {
  const rows: CsvCell[][] = [['Report', 'Generated on', generatedOn]];
  if (attendance) {
    rows.push(['Attendance today', 'Business date', attendance.businessDate]);
    if (attendance.isHoliday) rows.push(['Attendance today', 'Off day', attendance.holidayName ?? 'Holiday']);
    rows.push(
      ['Attendance today', 'Present', attendance.presentToday ?? attendance.activeToday ?? 0],
      ['Attendance today', 'Half day', attendance.halfDayToday ?? 0],
      ['Attendance today', 'On leave', attendance.onLeaveToday ?? 0],
      ['Attendance today', 'Absent', attendance.absentToday ?? 0],
      ['Attendance today', 'Late logins', attendance.lateLogins ?? 0],
    );
  }
  rows.push(
    ['Organisation', 'Total employees', summary.totalEmployees],
    ['Organisation', 'Total departments', summary.totalDepartments],
    ['Organisation', 'Total clients', summary.totalClients],
    ['Organisation', 'Total sponsors', summary.totalSponsors],
    ['Client plans', 'Annual', summary.totalAnnual],
    ['Client plans', 'Quarterly', summary.totalQuarterly],
    ['Leave', 'Employees who applied', summary.leaveSummary?.appliedFor ?? 0],
    ['Leave', 'Pending', summary.leaveSummary?.pending ?? 0],
    ['Leave', 'Approved', summary.leaveSummary?.approved ?? 0],
    ['Leave', 'Rejected', summary.leaveSummary?.rejected ?? 0],
  );
  if (pending.leaves !== undefined) rows.push(['Pending review', 'Leave requests', pending.leaves]);
  if (pending.corrections !== undefined) rows.push(['Pending review', 'Attendance corrections', pending.corrections]);
  for (const d of summary.departmentSummary ?? []) rows.push(['Department staffing', d.department, d.employees]);
  rows.push(
    ['Sponsors', 'Total sponsors', summary.sponsorSummary?.totalSponsors ?? 0],
    ['Sponsors', 'Sponsored events', summary.sponsorSummary?.totalSponsoredEvents ?? 0],
  );
  for (const [k, v] of Object.entries(summary.sponsorSummary?.collaborationSummary ?? {})) rows.push(['Sponsor collaborations', k, v]);
  rows.push(
    ['Stalls', 'Total stalls', summary.stallSummary?.totalStalls ?? 0],
    ['Stalls', 'Stall events', summary.stallSummary?.totalStallEvents ?? 0],
  );
  for (const [k, v] of Object.entries(summary.stallSummary?.typeSummary ?? {})) rows.push(['Stall types', k, v]);
  return rows;
}

export function buildSummaryCsv(...args: Parameters<typeof buildSummaryCsvRows>): string {
  return toCsv(['Section', 'Metric', 'Value'], buildSummaryCsvRows(...args));
}
