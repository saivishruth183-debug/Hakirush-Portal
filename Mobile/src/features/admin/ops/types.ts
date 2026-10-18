/**
 * Response shapes of the admin operations endpoints, taken from the backend controllers
 * (Backend/controllers/{dashboard,attendance,attendanceRequest,leave,holiday,announcement}Controller.js,
 * Backend/services/attendanceService.js, Backend/routes/notificationRoute.js).
 * Shared model types live in src/types/api.ts; these are the admin-only projections.
 */
import type { Announcement, LeaveBalanceBucket, Notification } from '@/types/api';

/** Employee populated with `userId{name,email,profileImage,isActive}` and `department{dep_name}`. */
export interface PopulatedEmployee {
  _id: string;
  /** Business code, e.g. HAKI0001. */
  employeeId?: string;
  designation?: string;
  userId?: { _id: string; name?: string; email?: string; profileImage?: string; isActive?: boolean } | null;
  department?: { _id: string; dep_name?: string } | null;
}

/** Audit fields on an Attendance record (Backend/models/Attendance.js). */
export interface AttendanceAudit {
  source?: 'punch' | 'admin' | 'correction' | 'system' | null | string;
  hoursSource?: string | null;
  punchedHours?: number | null;
  updatedBy?: string | null;
  adminUpdatedAt?: string | null;
  correctionRequestId?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  autoClosedAt?: string | null;
}

/** One row of GET /api/attendance (today, org timezone). Synthesized rows have `_id: null`. */
export interface TodayAttendanceRow extends AttendanceAudit {
  _id: string | null;
  date: string;
  /** Present | Half Day | Absent | Leave | Holiday | '' (open punch session). */
  status: string;
  workedHours?: number;
  checkIn: string | null;
  checkOut: string | null;
  isPaused?: boolean;
  pauseStartedAt?: string | null;
  totalPausedMs?: number;
  employeeId: PopulatedEmployee;
}

export interface TodayAttendanceResponse {
  success: true;
  attendance: TodayAttendanceRow[];
  isOffDay: boolean;
  reason: string;
  businessDate: string;
  timezone: string;
}

/** GET /api/attendance/admin/summary */
export interface AdminAttendanceSummary {
  success: true;
  isHoliday?: boolean;
  holidayName?: string;
  presentToday: number;
  activeToday: number;
  halfDayToday: number;
  onLeaveToday: number;
  absentToday: number;
  lateLogins: number;
  businessDate: string;
}

/** One day of GET /api/attendance/user/:id/monthly. */
export interface MonthlyAttendanceDay extends AttendanceAudit {
  _id: string | null;
  date: string;
  status: string;
  workedHours?: number;
  checkIn: string | null;
  checkOut: string | null;
  isPaused?: boolean;
  pauseStartedAt?: string | null;
  totalPausedMs?: number;
  dayType?: 'working' | 'weekend' | 'holiday';
  holidayName?: string;
}

export interface MonthlyAttendanceResponse {
  success: true;
  attendance: MonthlyAttendanceDay[];
  month: string;
  businessDate: string;
  timezone: string;
}

/** PUT /api/attendance/update/:employeeId */
export interface UpdateAttendanceResponse {
  success: true;
  attendance: TodayAttendanceRow;
}

export type ManualStatus = 'Present' | 'Half Day' | 'Absent' | 'Leave';

/** One row of GET /api/attendance/report → groupData[date][]. */
export interface ReportRow {
  _id: string | null;
  date: string;
  employeeRecordId: string;
  /** Employee business code ("N/A" when missing). */
  employeeId: string;
  employeeName: string;
  departmentName: string;
  status: string;
  workedHours: number;
  checkIn: string | null;
  checkOut: string | null;
  isPaused: boolean;
  pauseStartedAt: string | null;
  totalPausedMs: number;
}

export interface ReportResponse {
  success: true;
  groupData: Record<string, ReportRow[]>;
  holidayMap: Record<string, string>;
  from: string;
  to: string;
}

// ---------- Leave ----------
export interface AdminLeave {
  _id: string;
  employeeId: PopulatedEmployee | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | string;
  days: number;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PagedFields {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

export interface LeaveListResponse extends PagedFields {
  success: true;
  leaves: AdminLeave[];
}

export interface LeaveDetailResponse {
  success: true;
  leave: AdminLeave;
}

export interface LeaveReviewResponse {
  success: true;
  leave: AdminLeave;
}

/** GET /api/leave/balance/:employeeId */
export interface LeaveBalanceResponse {
  success: true;
  casual: LeaveBalanceBucket;
  sick: LeaveBalanceBucket;
  total: LeaveBalanceBucket;
  period: { basis: string; start: string | null; end: string | null };
}

// ---------- Attendance corrections ----------
export interface CorrectionRequest {
  _id: string;
  employeeId: PopulatedEmployee | null;
  date: string;
  currentStatus: string;
  requestedStatus: 'Present' | 'Half Day' | string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  reviewedBy?: string | null;
  reviewRemarks?: string;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CorrectionsResponse extends PagedFields {
  success: true;
  requests: CorrectionRequest[];
}

export interface CorrectionReviewResponse {
  success: true;
  request: CorrectionRequest;
  attendance: (TodayAttendanceRow & { employeeId: string }) | null;
}

// ---------- Holidays ----------
export interface HolidayItem {
  _id: string;
  title: string;
  date: string;
  /** Business date computed by the server in ORG_TIMEZONE. */
  ymd: string;
  status: 'Past' | 'Upcoming';
  createdAt?: string;
}

export interface HolidaysResponse {
  success: true;
  holidays: HolidayItem[];
}

// ---------- Announcements ----------
export type AdminAnnouncement = Announcement & { seen?: boolean };

export interface AnnouncementsResponse {
  success: true;
  announcements: AdminAnnouncement[];
}

export interface AnnouncementResponse {
  success: true;
  announcement: AdminAnnouncement;
  message?: string;
}

// ---------- Notifications ----------
export interface NotificationsResponse {
  success: true;
  notifications: Notification[];
  page: number;
  limit: number;
  hasMore: boolean;
  unseenCount: number;
}

// ---------- Dashboard ----------
export interface DashboardBirthday {
  _id: string;
  name?: string;
  profileImage?: string;
  department?: string;
  age?: number;
  /** ISO instant of the date of birth. */
  dob?: string;
}

export interface DashboardSummaryResponse {
  success: true;
  totalEmployees: number;
  totalDepartments: number;
  totalClients: number;
  totalSponsors: number;
  totalAnnual: number;
  totalQuarterly: number;
  leaveSummary: { appliedFor: number; approved: number; rejected: number; pending: number };
  departmentSummary: { _id: string; department: string; employees: number }[];
  sponsorSummary: { totalSponsors: number; totalSponsoredEvents: number; collaborationSummary: Record<string, number> };
  stallSummary: { totalStalls: number; totalStallEvents: number; typeSummary: Record<string, number> };
  birthdaySummary: { today: DashboardBirthday[]; upcoming: DashboardBirthday[] };
}
