/**
 * Admin-side response shapes for employees, departments, payslips and leave, read from the
 * backend controllers (Backend/controllers/{employee,department,payslip,leave}Controller.js).
 * Feature-local on purpose: src/types/api.ts is shared and only holds the cross-role contract.
 */
import type { DepartmentManagerSummary, Leave, LeaveBalanceBucket, Payslip, Role } from '@/types/api';

/** GET /api/employee and GET /api/employee/:id item (admin view, `withIsActive`). */
export interface AdminEmployee {
  _id: string;
  /** Populated login account (null when the account no longer exists). */
  userId: {
    _id: string;
    name: string;
    email?: string;
    role?: Role;
    profileImage?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  /** Business code, e.g. HAKI0001. */
  employeeId: string;
  dob?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  dateOfJoining?: string | null;
  bloodGroup?: string | null;
  designation: string;
  department: { _id: string; dep_name: string; description?: string; managerEmployeeId?: string | null } | null;
  salary?: number;
  experience?: string;
  aadharcard?: string;
  pancard?: string;
  pfNumber?: string;
  /** true/false from the account; null when the account is missing. */
  isActive: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeesResponse {
  success: true;
  employees: AdminEmployee[];
}

export interface EmployeeResponse {
  success: true;
  employee: AdminEmployee;
}

export type DepartmentManagerStatus = 'assigned' | 'unassigned' | 'invalid';

/** GET /api/department item (departmentController.buildItems). */
export interface DepartmentItem {
  _id: string;
  dep_name: string;
  description: string;
  managerEmployeeId: string | null;
  manager: DepartmentManagerSummary | null;
  /** `invalid` = the assigned person is inactive or moved to another department. */
  managerStatus: DepartmentManagerStatus;
  /** Active members. */
  memberCount: number;
  /** All employee records incl. inactive (governs delete). */
  employeeCount: number;
  createdAt?: string;
  updatedAt: string;
  /** Not returned by the current backend; rendered when present. */
  managerHistory?: { from?: string | null; to?: string | null; changedAt?: string; reason?: string }[];
}

export interface DepartmentsResponse {
  success: true;
  departments: DepartmentItem[];
}

export interface DepartmentResponse {
  success: true;
  department: DepartmentItem;
}

export interface EligibleManagersResponse {
  success: true;
  employees: DepartmentManagerSummary[];
}

/** GET /api/employee/department/:id/employees (admin: full records). */
export interface DepartmentMembersResponse {
  success: true;
  employees: AdminEmployee[];
}

/** 409 MANAGER_REASSIGNMENT_REQUIRED `details`. */
export interface ManagerConflict {
  message: string;
  departmentId: string;
  departmentName?: string;
}

/** How to resolve a manager conflict (sent with the retried request). */
export type ManagerChoice = { clearManager: true } | { replacementManagerEmployeeId: string };

/** Admin payslip item (GET /api/payslip/employee/:id, POST /api/payslip/add). */
export interface AdminPayslip extends Omit<Payslip, 'employee'> {
  employee: string;
  hasFile: boolean;
  /** Legacy public upload: download answers 409 LEGACY_FILE_NOT_MIGRATED. */
  fileMigrationRequired: boolean;
}

export interface PayslipsResponse {
  success: true;
  payslips: AdminPayslip[];
}

export interface PayslipCreateResponse {
  success: true;
  payslip: AdminPayslip;
}

export interface EmployeeLeavesResponse {
  success: true;
  leaves: Leave[];
}

/** GET /api/leave/balance/:employeeId */
export interface AdminLeaveBalance {
  success: true;
  casual: LeaveBalanceBucket;
  sick: LeaveBalanceBucket;
  total: LeaveBalanceBucket;
  period?: { basis?: string; start?: string | null; end?: string | null };
}
