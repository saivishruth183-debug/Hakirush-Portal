/** Feature-local response shapes (from Backend controllers; see docs/mobile/parts/mobile-employee.md). */
import type {
  Announcement,
  Attendance,
  AttendanceRequest,
  Holiday,
  Leave,
  LeaveBalanceBucket,
  Notification,
  Payslip,
} from '@/types/api';

export type MonthlyDay = Omit<Attendance, 'status' | '_id'> & {
  _id: string | null;
  status: Attendance['status'] | 'Holiday';
  dayType?: 'working' | 'weekend' | 'holiday';
  holidayName?: string;
};

export interface MonthlyAttendanceResponse {
  attendance: MonthlyDay[];
  month: string;
  businessDate: string;
  timezone: string;
}

export interface AttendanceRequestsResponse {
  requests: AttendanceRequest[];
}

export interface LeavesResponse {
  leaves: Leave[];
}

export interface LeaveBalanceResponse {
  casual: LeaveBalanceBucket;
  sick: LeaveBalanceBucket;
  total: LeaveBalanceBucket;
  period: { basis: string; start: string | null; end: string | null };
}

export interface LeaveAddResponse {
  leave: Leave;
  exceedsBalance: boolean;
}

export type PayslipItem = Payslip & { fileMigrationRequired?: boolean };

export interface PayslipsResponse {
  payslips: PayslipItem[];
}

export type HolidayItem = Holiday & { ymd: string; status: 'Past' | 'Upcoming' };

export interface HolidaysResponse {
  holidays: HolidayItem[];
}

export type AnnouncementItem = Announcement & { seen?: boolean };

export interface AnnouncementsResponse {
  announcements: AnnouncementItem[];
}

export interface NotificationsResponse {
  notifications: Notification[];
  page: number;
  limit: number;
  hasMore: boolean;
  unseenCount: number;
}

export interface CelebrationItem {
  _id: string;
  name: string;
  profileImage?: string;
  department?: string | null;
  monthDay?: string;
  years?: number;
}

export interface CelebrationsResponse {
  today: CelebrationItem[];
  upcoming: CelebrationItem[];
}

export interface NewJoinersResponse {
  employees: { _id: string; name: string; profileImage?: string; dateOfJoining?: string; joinedDaysAgo?: number }[];
}

export interface ExpenseClaimItem {
  _id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  receiptUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Reimbursed';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  reimbursedInPayslipMonth?: string;
  createdAt: string;
}

export interface ExpensesResponse {
  success: boolean;
  claims: ExpenseClaimItem[];
}

export interface OvertimeDayItem {
  date: string;
  checkIn?: string;
  checkOut?: string;
  workedHours?: number;
  overtimeHours: number;
  status: string;
}

export interface OvertimeRequestItem {
  _id: string;
  type: 'Comp-Off' | 'Payout';
  hours: number;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewRemarks?: string;
  createdAt: string;
}

export interface OvertimeSummaryResponse {
  success: boolean;
  totalEarnedHours: number;
  claimedHours: number;
  availableHours: number;
  recentOvertimeDays: OvertimeDayItem[];
  requests: OvertimeRequestItem[];
}

export interface AssetItem {
  _id: string;
  name: string;
  assetType: 'Laptop' | 'Monitor' | 'Mobile' | 'ID Card' | 'Keys' | 'Other';
  serialNumber?: string;
  status: 'Available' | 'Assigned' | 'Maintenance' | 'Retired';
  notes?: string;
  issueDate?: string;
  returnDate?: string;
}

export interface MyAssetsResponse {
  success: boolean;
  assets: AssetItem[];
}

