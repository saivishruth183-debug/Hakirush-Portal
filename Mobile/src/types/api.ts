/**
 * Types for the Hakirush backend contract (docs/mobile/API_CONTRACT.md) and the
 * Mongoose models in Backend/models/*.js.
 *
 * Conventions
 * - Ids are strings (Mongo ObjectIds serialised). NEVER mix the id kinds — see `UserId` etc.
 * - Business dates are `YYYY-MM-DD` strings in the org timezone (Asia/Kolkata).
 * - Instants are ISO-8601 UTC strings (`IsoDateTime`).
 * - Fields that the contract does not guarantee, or that legacy endpoints may omit, are optional.
 */

// ---------- Primitive aliases (documentation only; all are strings at runtime) ----------
/** Login account id (`User._id`). */
export type UserId = string;
/** Employee HR record id (`Employee._id`). */
export type EmployeeRecordId = string;
/** Human-readable employee code, e.g. `HAKI0001` (`Employee.employeeId`). */
export type EmployeeCode = string;
/** `Department._id`. */
export type DepartmentId = string;
/** `Client._id` (linked to its own `User._id` via `Client.userId`). */
export type ClientId = string;
/** `YYYY-MM-DD` business date in the organisation timezone. */
export type BusinessDate = string;
/** `YYYY-MM` month key. */
export type MonthKey = string;
/** ISO-8601 UTC instant. */
export type IsoDateTime = string;

export type Role = 'admin' | 'employee' | 'client';

// ---------- Envelope & errors ----------
export interface ApiSuccess {
  success: true;
}

export interface ApiErrorBody {
  success: false;
  /** Human readable message (legacy endpoints may use `message`). */
  error?: string;
  message?: string;
  code?: ApiErrorCode | string;
  details?: unknown;
}

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'SESSION_REVOKED'
  | 'INVALID_CREDENTIALS'
  | 'REFRESH_INVALID'
  | 'REFRESH_REUSED'
  | 'ACCOUNT_INACTIVE'
  | 'FORBIDDEN'
  | 'FIELD_NOT_EDITABLE'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_ID'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'ALREADY_REVIEWED'
  | 'STALE_UPDATE'
  | 'DEPARTMENT_NOT_EMPTY'
  | 'MANAGER_REASSIGNMENT_REQUIRED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'AUTH_UNAVAILABLE';

export interface Paged {
  page: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
}

// ---------- Session / auth ----------
export interface SessionUser {
  _id: UserId;
  name: string;
  email: string;
  role: Role;
  profileImage?: string;
  isActive?: boolean;
  /** Employee only: business code e.g. HAKI0001. */
  employeeId?: EmployeeCode;
  designation?: string;
  employeeRecordId?: EmployeeRecordId;
  departmentId?: DepartmentId | null;
  departmentName?: string;
  /** Client only. */
  clientId?: ClientId;
  /** Client only: user-entered business identifier, distinct from Client._id. */
  clientCode?: string | null;
}

/** Response of POST /api/auth/mobile/login and /api/auth/mobile/refresh. */
export interface MobileAuthResponse extends ApiSuccess {
  accessToken: string;
  accessTokenExpiresAt: IsoDateTime;
  refreshToken: string;
  refreshTokenExpiresAt: IsoDateTime;
  user: SessionUser;
}

export interface VerifyResponse extends ApiSuccess {
  user: SessionUser;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse extends ApiSuccess {
  reauthRequired?: boolean;
  message?: string;
}

// ---------- People ----------
/** Safe projection of a colleague (TeamResponse). Nothing else is exposed. */
export interface SafePerson {
  employeeRecordId: EmployeeRecordId;
  userId: UserId;
  employeeCode: EmployeeCode;
  name: string;
  designation: string;
  profileImageUrl: string | null;
  isSelf: boolean;
  isManager: boolean;
}

export type ManagerStatus = 'assigned' | 'unassigned' | 'no_department';

/** GET /api/employee/team/me (version 1). */
export interface TeamResponse extends ApiSuccess {
  version: 1;
  department: { id: DepartmentId; name: string } | null;
  managerStatus: ManagerStatus;
  manager: SafePerson | null;
  members: SafePerson[];
  totalMembers: number;
  matchedMembers: number;
  page: number;
  limit: number;
  hasMore: boolean;
  updatedAt: IsoDateTime;
}

export interface DepartmentManagerSummary {
  employeeRecordId: EmployeeRecordId;
  name: string;
  employeeCode: EmployeeCode;
  designation: string;
  profileImageUrl: string | null;
}

/** GET /api/department item. */
export interface Department {
  _id: DepartmentId;
  dep_name: string;
  description?: string;
  managerEmployeeId?: EmployeeRecordId | null;
  manager?: DepartmentManagerSummary | null;
  memberCount?: number;
  managerHistory?: { from?: EmployeeRecordId | null; to?: EmployeeRecordId | null; changedBy?: UserId; changedAt?: IsoDateTime }[];
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

/** Populated `userId` on an Employee. */
export interface EmployeeUserRef {
  _id: UserId;
  name: string;
  email?: string;
  profileImage?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * Employee HR record. Admin view (GET /api/employee, /api/employee/:id) and own profile
 * (GET /api/employee/me) share this shape; sensitive fields are optional because other
 * endpoints project them away.
 */
export interface Employee {
  _id: EmployeeRecordId;
  userId: EmployeeUserRef;
  /** Business code (HAKI0001). */
  employeeId: EmployeeCode;
  dob?: IsoDateTime | null;
  gender?: string;
  maritalStatus?: string;
  dateOfJoining?: IsoDateTime;
  bloodGroup?: BloodGroup | null;
  designation: string;
  department?: { _id: DepartmentId; dep_name: string } | null;
  salary?: number;
  experience?: string;
  aadharcard?: string;
  pancard?: string;
  pfNumber?: string;
  /** Admin list adds this. */
  isActive?: boolean;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

/** GET /api/employee/me */
export interface OwnEmployeeResponse extends ApiSuccess {
  employee: Employee & { managerOfDepartment?: boolean };
}

/** Fields an employee may change on PUT /api/employee/update-profile/:id. */
export interface EmployeeSelfEditable {
  name?: string;
  experience?: string;
  dob?: BusinessDate;
  bloodGroup?: BloodGroup;
  maritalStatus?: string;
  aadharcard?: string;
  pancard?: string;
  pfNumber?: string;
}

export interface BirthdayItem {
  _id: string;
  name: string;
  profileImage?: string;
  department?: string;
  /** `MM-DD` */
  monthDay?: string;
  age?: number;
}

export interface AnniversaryItem {
  _id: string;
  name: string;
  profileImage?: string;
  department?: string;
  years: number;
  monthDay?: string;
}

// ---------- Clients ----------
export type PlanType = 'Annual' | 'Quarterly';

export interface Client {
  _id: ClientId;
  userId: { _id: UserId; name: string; email?: string; profileImage?: string };
  dateOfJoining: IsoDateTime;
  companyLogo?: string;
  budget: number;
  planType: PlanType;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export type JerseySize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | string;

/** GET/POST /api/client/me/roster */
export interface RosterEntry {
  _id: string;
  name: string;
  jerseySize: JerseySize;
  createdAt?: IsoDateTime;
  [extra: string]: unknown;
}

export interface GalleryImage {
  _id: string;
  url: string;
  caption?: string;
  createdAt?: IsoDateTime;
}

export interface Standing {
  _id?: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  points: number;
}

export interface PerformanceResponse extends ApiSuccess {
  standings: Standing[];
  updatedAt: IsoDateTime | null;
}

// ---------- Attendance ----------
export type AttendanceStatus = 'Present' | 'Half Day' | 'Absent' | 'Leave' | '';

export interface Attendance {
  _id: string;
  /** Business date YYYY-MM-DD. */
  date: BusinessDate;
  /** Employee._id (may be populated on admin endpoints). */
  employeeId: EmployeeRecordId | (Partial<Employee> & { _id: EmployeeRecordId });
  checkIn: IsoDateTime | null;
  checkOut: IsoDateTime | null;
  workedHours?: number;
  status: AttendanceStatus;
  isPaused: boolean;
  pauseStartedAt: IsoDateTime | null;
  totalPausedMs: number;
  /** Correction audit fields (set when an approved correction changed the record). */
  source?: 'punch' | 'correction' | 'admin' | 'system' | string;
  correctionRequestId?: string | null;
  correctedBy?: UserId | null;
  correctedAt?: IsoDateTime | null;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

/** GET /api/attendance/today/me */
export interface TodayAttendanceResponse extends ApiSuccess {
  attendance: Attendance | null;
  serverTime: IsoDateTime;
  businessDate: BusinessDate;
  timezone: string;
}

/** POST /api/attendance/check-in | pause | resume | check-out */
export interface AttendanceTransitionResponse extends ApiSuccess {
  attendance: Attendance;
  alreadyApplied: boolean;
  serverTime: IsoDateTime;
}

export type AttendanceAction = 'check-in' | 'pause' | 'resume' | 'check-out';

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface AttendanceRequest {
  _id: string;
  employeeId: EmployeeRecordId | (Partial<Employee> & { _id: EmployeeRecordId });
  date: BusinessDate;
  currentStatus: string;
  requestedStatus: 'Present' | 'Half Day';
  reason: string;
  status: RequestStatus;
  reviewedBy?: UserId | { _id: UserId; name?: string } | null;
  reviewRemarks?: string;
  reviewedAt?: IsoDateTime | null;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

// ---------- Leave ----------
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface Leave {
  _id: string;
  employeeId: EmployeeRecordId | (Partial<Employee> & { _id: EmployeeRecordId });
  leaveType: string;
  startDate: IsoDateTime;
  endDate: IsoDateTime;
  reason?: string;
  status: LeaveStatus;
  /** Computed by the server. */
  days: number;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export interface LeaveBalanceBucket {
  total: number;
  used: number;
  balance: number;
}

/** GET /api/leave/balance/me (legacy shape; extra buckets may be added). */
export interface LeaveBalance {
  success?: boolean;
  casual: LeaveBalanceBucket;
  sick: LeaveBalanceBucket;
  [bucket: string]: LeaveBalanceBucket | boolean | undefined;
}

// ---------- Payslips ----------
export type PaymentStatus = 'Pending' | 'Paid';

export interface Payslip {
  _id: string;
  employee: EmployeeRecordId | (Partial<Employee> & { _id: EmployeeRecordId });
  /** Month label as stored (e.g. `2026-09` or `September 2026`). */
  month: string;
  basicSalary: number;
  hra?: number;
  conveyanceAllowance?: number;
  medicalAllowance?: number;
  otherAllowances?: number;
  bonus?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  overtimePay?: number;
  providentFund?: number;
  professionalTax?: number;
  incomeTax?: number;
  lossOfPay?: number;
  otherDeductions?: number;
  reimbursements?: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  paymentStatus?: PaymentStatus;
  paymentDate?: IsoDateTime | null;
  /** /payslip/me returns `hasFile` instead of the raw file URL. */
  hasFile?: boolean;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export interface PayslipLinkResponse extends ApiSuccess {
  url: string;
  expiresAt: IsoDateTime;
}

// ---------- Org content ----------
export interface Holiday {
  _id: string;
  title: string;
  date: IsoDateTime;
  createdAt?: IsoDateTime;
}

export type AnnouncementType = 'Annual' | 'Quarterly' | 'Celebration';
export type AnnouncementStatus = 'Upcoming' | 'Ongoing' | 'Completed';

export interface Announcement {
  _id: string;
  title: string;
  description: string;
  image?: string;
  type: AnnouncementType;
  /** Stored as a string by the backend (usually YYYY-MM-DD). */
  date: string;
  venue: string;
  status: AnnouncementStatus;
  seenBy?: UserId[];
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export interface Notification {
  _id: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  seen: boolean;
  createdAt: IsoDateTime;
}

export type SponsorCollaboration = 'Title Sponsor' | 'Associate Sponsor' | 'Event Sponsor' | 'Media Partner';

export interface Sponsor {
  _id: string;
  name: string;
  collaboration: SponsorCollaboration;
  eventsSponsored: number;
  reach: string;
  upcomingEvents?: string;
  logo?: string;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

export interface Stall {
  _id: string;
  name: string;
  number: string;
  type: string;
  eventCount: number;
  plans: string[];
  logo?: string;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
}

/** GET /api/dashboard/summary (admin). */
export interface DashboardSummary extends ApiSuccess {
  totalEmployees: number;
  totalDepartments: number;
  totalClients: number;
  totalSponsors: number;
  totalAnnual: number;
  totalQuarterly: number;
  leaveSummary: { appliedFor: number; approved: number; rejected: number; pending: number };
  departmentSummary: { _id: DepartmentId; department: string; employees: number }[];
  sponsorSummary: {
    totalSponsors: number;
    totalSponsoredEvents: number;
    collaborationSummary: Record<string, number>;
  };
  stallSummary: { totalStalls: number; totalStallEvents: number; typeSummary: Record<string, number> };
  birthdaySummary: {
    today: BirthdayItem[];
    upcoming: BirthdayItem[];
  };
}
