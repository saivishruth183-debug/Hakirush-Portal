/**
 * Admin people API: employees, departments, payslips and per-employee leave.
 * Endpoints and shapes follow Backend/routes/{employee,department,payslip,leave}Route.js.
 */
import type { QueryKey } from '@tanstack/react-query';

import type { PickedFile } from '@/features/shared/media/pickers';
import { api, isApiError, toFormData, type UploadFile } from '@/services/api';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';

import type {
  AdminLeaveBalance,
  DepartmentMembersResponse,
  DepartmentResponse,
  DepartmentsResponse,
  EligibleManagersResponse,
  EmployeeLeavesResponse,
  EmployeeResponse,
  EmployeesResponse,
  ManagerChoice,
  ManagerConflict,
  PayslipCreateResponse,
  PayslipsResponse,
} from './types';

// ---------- keys ----------

/** Query keys for the admin people area, all built from the shared factory (user-scoped). */
export function usePeopleKeys() {
  const keys = useQueryKeys();
  return {
    employees: (): QueryKey => keys.employees(),
    /** Prefix of every single-employee key. */
    employeeAll: (): QueryKey => [...keys.all(), 'employee'],
    employee: (id: string): QueryKey => keys.employee(id),
    departments: (): QueryKey => keys.departments(),
    /** Prefix of every single-department key (detail, eligible managers, members). */
    departmentAll: (): QueryKey => [...keys.all(), 'department'],
    department: (id: string): QueryKey => keys.department(id),
    eligibleManagers: (id: string): QueryKey => keys.eligibleManagers(id),
    departmentMembers: (id: string): QueryKey => [...keys.department(id), 'members'],
    payslips: (employeeId: string): QueryKey => keys.payslips({ employeeRecordId: employeeId }),
    leaves: (employeeId: string): QueryKey => keys.leaves({ employeeRecordId: employeeId }),
    leaveBalance: (employeeId: string): QueryKey => keys.leaveBalance(employeeId),
  };
}

export type PeopleKeys = ReturnType<typeof usePeopleKeys>;

/** Everything an employee write can affect (lists, details, department manager/member counts). */
export function employeeWriteKeys(k: PeopleKeys): QueryKey[] {
  return [k.employees(), k.employeeAll(), k.departments(), k.departmentAll()];
}

// ---------- queries ----------

const enc = encodeURIComponent;

export function useEmployees() {
  const k = usePeopleKeys();
  return useApiQuery<EmployeesResponse, EmployeesResponse['employees']>(k.employees(), '/api/employee', {
    select: (r) => r.employees ?? [],
  });
}

export function useEmployee(id: string) {
  const k = usePeopleKeys();
  return useApiQuery<EmployeeResponse, EmployeeResponse['employee']>(k.employee(id), `/api/employee/${enc(id)}`, {
    select: (r) => r.employee,
    enabled: !!id,
  });
}

export function useDepartments() {
  const k = usePeopleKeys();
  return useApiQuery<DepartmentsResponse, DepartmentsResponse['departments']>(k.departments(), '/api/department', {
    select: (r) => r.departments ?? [],
  });
}

export function useDepartment(id: string) {
  const k = usePeopleKeys();
  return useApiQuery<DepartmentResponse, DepartmentResponse['department']>(k.department(id), `/api/department/${enc(id)}`, {
    select: (r) => r.department,
    enabled: !!id,
  });
}

export function useEligibleManagers(departmentId: string | null | undefined, enabled = true) {
  const k = usePeopleKeys();
  const id = departmentId ?? '';
  return useApiQuery<EligibleManagersResponse, EligibleManagersResponse['employees']>(
    k.eligibleManagers(id),
    `/api/department/${enc(id)}/eligible-managers`,
    { select: (r) => r.employees ?? [], enabled: enabled && !!id },
  );
}

export function useDepartmentMembers(departmentId: string) {
  const k = usePeopleKeys();
  return useApiQuery<DepartmentMembersResponse, DepartmentMembersResponse['employees']>(
    k.departmentMembers(departmentId),
    `/api/employee/department/${enc(departmentId)}/employees`,
    { select: (r) => r.employees ?? [], enabled: !!departmentId },
  );
}

export function useEmployeePayslips(employeeId: string) {
  const k = usePeopleKeys();
  return useApiQuery<PayslipsResponse, PayslipsResponse['payslips']>(k.payslips(employeeId), `/api/payslip/employee/${enc(employeeId)}`, {
    select: (r) => r.payslips ?? [],
    enabled: !!employeeId,
  });
}

/** Leave history of one employee: GET /api/leave/:id/:role (the `:role` segment is ignored by the server). */
export function useEmployeeLeaves(employeeId: string) {
  const k = usePeopleKeys();
  return useApiQuery<EmployeeLeavesResponse, EmployeeLeavesResponse['leaves']>(k.leaves(employeeId), `/api/leave/${enc(employeeId)}/admin`, {
    select: (r) => r.leaves ?? [],
    enabled: !!employeeId,
  });
}

export function useLeaveBalance(employeeId: string) {
  const k = usePeopleKeys();
  return useApiQuery<AdminLeaveBalance>(k.leaveBalance(employeeId), `/api/leave/balance/${enc(employeeId)}`, {
    enabled: !!employeeId,
  });
}

// ---------- writes ----------

export function toUpload(file: PickedFile | null | undefined): UploadFile | null {
  return file ? { uri: file.uri, name: file.name, type: file.type } : null;
}

type FormFields = Record<string, string | number | boolean | null | undefined>;

function choiceFields(choice?: ManagerChoice): FormFields {
  if (!choice) return {};
  return 'clearManager' in choice ? { clearManager: 'true' } : { replacementManagerEmployeeId: choice.replacementManagerEmployeeId };
}

export function createEmployee(fields: FormFields, photo: PickedFile | null) {
  return api.post<{ success: true; employee: { _id: string } }>(
    '/api/employee/add',
    toFormData(fields, { profileImage: toUpload(photo) }),
  );
}

/** PUT /api/employee/:id (multipart; only changed fields are sent). */
export function updateEmployee(id: string, fields: FormFields, photo: PickedFile | null, choice?: ManagerChoice) {
  return api.put<{ success: true }>(
    `/api/employee/${enc(id)}`,
    toFormData({ ...fields, ...choiceFields(choice) }, { profileImage: toUpload(photo) }),
  );
}

/** DELETE /api/employee/:id = retention-safe deactivation (history is kept). */
export function deactivateEmployee(id: string, choice?: ManagerChoice) {
  return api.delete<{ success: true; deactivated: true }>(`/api/employee/${enc(id)}`, choice ? { body: choice } : undefined);
}

export function reactivateEmployee(id: string) {
  return api.patch<{ success: true; isActive: boolean }>(`/api/employee/${enc(id)}/status`, { isActive: true });
}

export function createDepartment(body: { dep_name: string; description: string }) {
  return api.post<DepartmentResponse>('/api/department/add', body);
}

export function updateDepartment(
  id: string,
  body: { dep_name: string; description: string; managerEmployeeId?: string | null; expectedUpdatedAt?: string },
) {
  return api.put<DepartmentResponse>(`/api/department/${enc(id)}`, body);
}

export function deleteDepartment(id: string) {
  return api.delete<{ success: true }>(`/api/department/${enc(id)}`);
}

export function issuePayslip(fields: FormFields, pdf: PickedFile) {
  return api.post<PayslipCreateResponse>('/api/payslip/add', toFormData(fields, { payslip: toUpload(pdf) }));
}

// ---------- error helpers ----------

/** Parses a 409 MANAGER_REASSIGNMENT_REQUIRED into the info the reassignment dialog needs. */
export function managerConflictOf(e: unknown): ManagerConflict | null {
  if (!isApiError(e) || e.code !== 'MANAGER_REASSIGNMENT_REQUIRED') return null;
  const d = (e.details ?? {}) as { departmentId?: unknown; departmentName?: unknown };
  if (typeof d.departmentId !== 'string' || !d.departmentId) return null;
  return {
    message: e.message,
    departmentId: d.departmentId,
    departmentName: typeof d.departmentName === 'string' ? d.departmentName : undefined,
  };
}

export function isApiCode(e: unknown, code: string): boolean {
  return isApiError(e) && e.code === code;
}
