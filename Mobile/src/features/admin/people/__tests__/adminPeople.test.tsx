import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { SponsorDetailScreen } from '@/features/admin/entities/sponsors/SponsorScreens';
import { newRow, validateStandings } from '@/features/admin/entities/clients/standings';
import { DepartmentDetailScreen } from '@/features/admin/people/DepartmentScreens';
import { EmployeeDetailScreen } from '@/features/admin/people/EmployeeDetailScreen';
import { PayslipIssueScreen } from '@/features/admin/people/EmployeeRecordsScreens';
import { emptyPayslip, estimatePayslip, validatePayslip } from '@/features/admin/people/payslipMath';
import { fail, formFields, ok, renderAdmin } from '@/features/admin/people/testing/renderAdmin';
import { resetAuthWorld } from '@/testing/resetSession';

const params: { id: string } = { id: '' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => params,
  Stack: { Screen: () => null },
}));

const mockPickPdf = jest.fn();
jest.mock('@/features/shared/media/pickers', () => ({
  pickPdf: () => mockPickPdf(),
  pickImage: jest.fn(async () => ({ status: 'canceled' })),
  openAppSettings: jest.fn(),
}));

jest.setTimeout(20_000);

/** Answer every Alert-based confirm() with the given button index (1 = confirm, 0 = cancel). */
function answerConfirm(index: 0 | 1) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.[index]?.onPress?.();
  });
}

beforeEach(() => {
  resetAuthWorld();
  jest.restoreAllMocks();
});

const DEPT = {
  _id: 'dep-1',
  dep_name: 'Engineering',
  description: 'Builds things',
  managerEmployeeId: null,
  manager: null,
  managerStatus: 'unassigned',
  memberCount: 2,
  employeeCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};
const ELIGIBLE = [
  { employeeRecordId: 'emp-1', name: 'Asha Rao', employeeCode: 'HAKI0001', designation: 'Lead', profileImageUrl: null },
  { employeeRecordId: 'emp-2', name: 'Ravi Kumar', employeeCode: 'HAKI0002', designation: 'Engineer', profileImageUrl: null },
];

describe('department manager assignment', () => {
  it('assigns an eligible manager with expectedUpdatedAt, then handles a stale 409 with Reload', async () => {
    params.id = 'dep-1';
    let current: Record<string, unknown> = DEPT;
    const { apiCalls } = await renderAdmin(<DepartmentDetailScreen />, {
      'GET /api/department/dep-1': () => ok({ department: current }),
      'GET /api/department/dep-1/eligible-managers': () => ok({ employees: ELIGIBLE }),
      'PUT /api/department/dep-1': () => {
        if (current === DEPT) {
          current = { ...DEPT, managerEmployeeId: 'emp-2', manager: ELIGIBLE[1], managerStatus: 'assigned', updatedAt: '2026-09-02T10:00:00.000Z' };
          return ok({ department: current });
        }
        return fail(409, 'STALE_UPDATE', 'Department was changed by someone else; reload and try again');
      },
    });

    await fireEvent.press(await screen.findByTestId('department-manager'));
    await fireEvent.press(await screen.findByLabelText('Ravi Kumar, HAKI0002 · Engineer'));
    await fireEvent.press(screen.getByTestId('department-save'));
    await waitFor(() => expect(apiCalls('PUT', '/api/department/dep-1')).toHaveLength(1));
    expect(apiCalls('PUT', '/api/department/dep-1')[0].body).toEqual({
      dep_name: 'Engineering',
      description: 'Builds things',
      managerEmployeeId: 'emp-2',
      expectedUpdatedAt: '2026-09-01T10:00:00.000Z',
    });

    // After the refetch the form shows the new manager. Clearing sends null; a stale 409 offers Reload.
    expect(await screen.findByText('Manager: Ravi Kumar')).toBeTruthy();
    await fireEvent.press(await screen.findByTestId('department-manager'));
    await fireEvent.press(await screen.findByLabelText('No manager, Leave the department without a manager'));
    await fireEvent.press(screen.getByTestId('department-save'));
    await waitFor(() => expect(apiCalls('PUT', '/api/department/dep-1')).toHaveLength(2));
    expect(apiCalls('PUT', '/api/department/dep-1')[1].body).toMatchObject({ managerEmployeeId: null, expectedUpdatedAt: '2026-09-02T10:00:00.000Z' });
    expect(await screen.findByText(/Reload to see the latest version/)).toBeTruthy();
    expect(screen.getByText('Reload')).toBeTruthy();
  });

  it('shows the server message when deleting a non-empty department', async () => {
    params.id = 'dep-1';
    answerConfirm(1);
    await renderAdmin(<DepartmentDetailScreen />, {
      'GET /api/department/dep-1': () => ok({ department: DEPT }),
      'GET /api/department/dep-1/eligible-managers': () => ok({ employees: ELIGIBLE }),
      'DELETE /api/department/dep-1': () =>
        fail(409, 'DEPARTMENT_NOT_EMPTY', 'Department still has employees. Move or deactivate them before deleting it.', { employeeCount: 2 }),
    });
    await fireEvent.press(await screen.findByTestId('department-delete'));
    expect(await screen.findByText('Department still has employees. Move or deactivate them before deleting it.')).toBeTruthy();
  });
});

describe('employee deactivation', () => {
  it('on 409 MANAGER_REASSIGNMENT_REQUIRED lets the admin pick a replacement and resends', async () => {
    params.id = 'emp-1';
    answerConfirm(1);
    const employee = {
      _id: 'emp-1',
      employeeId: 'HAKI0001',
      designation: 'Lead',
      userId: { _id: 'user-1', name: 'Asha Rao', email: 'asha@example.com', role: 'employee' },
      department: { _id: 'dep-1', dep_name: 'Engineering' },
      isActive: true,
    };
    const { apiCalls } = await renderAdmin(<EmployeeDetailScreen />, {
      'GET /api/employee/emp-1': () => ok({ employee }),
      'GET /api/department/dep-1/eligible-managers': () => ok({ employees: ELIGIBLE }),
      'DELETE /api/employee/emp-1': (call) =>
        call.body
          ? ok({ deactivated: true })
          : fail(409, 'MANAGER_REASSIGNMENT_REQUIRED', 'This employee is the manager of Engineering. Choose a replacement manager or clear the assignment first.', {
              departmentId: 'dep-1',
              departmentName: 'Engineering',
            }),
    });

    await fireEvent.press(await screen.findByTestId('employee-deactivate'));
    expect(await screen.findByText(/This employee is the manager of Engineering/)).toBeTruthy();
    // The employee being deactivated is not offered as their own replacement.
    await fireEvent.press(await screen.findByTestId('replacement-manager'));
    expect(screen.queryByLabelText('Asha Rao, HAKI0001 · Lead')).toBeNull();
    await fireEvent.press(await screen.findByLabelText('Ravi Kumar, HAKI0002 · Engineer'));
    await fireEvent.press(screen.getByTestId('manager-reassign-confirm'));

    await waitFor(() => expect(apiCalls('DELETE', '/api/employee/emp-1')).toHaveLength(2));
    expect(apiCalls('DELETE', '/api/employee/emp-1')[0].body).toBeUndefined();
    expect(apiCalls('DELETE', '/api/employee/emp-1')[1].body).toEqual({ replacementManagerEmployeeId: 'emp-2' });
  });
});

describe('payslip issue', () => {
  it('validates amounts, shows a labelled estimate on review, then the server totals', async () => {
    params.id = 'emp-1';
    mockPickPdf.mockResolvedValue({ status: 'picked', file: { uri: 'file:///p.pdf', name: 'p.pdf', type: 'application/pdf', size: 1000 } });
    const { apiCalls } = await renderAdmin(<PayslipIssueScreen />, {
      'GET /api/employee/emp-1': () => ok({ employee: { _id: 'emp-1', employeeId: 'HAKI0001', designation: 'Lead', userId: { _id: 'u1', name: 'Asha Rao' } } }),
      'GET /api/payslip/employee/emp-1': () => ok({ payslips: [] }),
      'POST /api/payslip/add': () =>
        jsonCreated({
          _id: 'p1', employee: 'emp-1', month: '2026-09', basicSalary: 50000, hra: 10000, grossSalary: 60000, totalDeductions: 2000,
          netSalary: 58000, overtimePay: 0, paymentStatus: 'Paid', paymentDate: '2026-10-01T05:00:00.000Z', hasFile: true, fileMigrationRequired: false,
        }),
    });

    await fireEvent.press(await screen.findByTestId('payslip-review'));
    expect(await screen.findByText('Choose the payroll month.')).toBeTruthy();
    expect(screen.getByText('Enter basic salary.')).toBeTruthy();
    expect(screen.getByText('Attach the payslip PDF.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('payslip-month'));
    await fireEvent.press(await screen.findByLabelText('September 2026'));
    await fireEvent.changeText(screen.getByLabelText('Basic salary (required)'), '50000');
    await fireEvent.changeText(screen.getByLabelText('HRA'), '-5');
    await fireEvent.press(screen.getByText('Choose PDF'));
    await fireEvent.press(screen.getByTestId('payslip-review'));
    expect(await screen.findByText('HRA cannot be negative.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('HRA'), '10000');
    await fireEvent.changeText(screen.getByLabelText('Provident fund'), '2000');
    await fireEvent.press(screen.getByTestId('payslip-review'));
    expect(await screen.findByText('Estimate only')).toBeTruthy();
    expect(screen.getByText('The server calculates the final gross, deductions and net when the payslip is issued.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('payslip-confirm'));
    expect(await screen.findByTestId('payslip-result')).toBeTruthy();
    const fields = formFields(apiCalls('POST', '/api/payslip/add')[0].body);
    expect(fields).toMatchObject({ employeeId: 'emp-1', month: '2026-09', basicSalary: '50000', hra: '10000', providentFund: '2000', paymentStatus: 'Paid' });
    // Jest's spec FormData stringifies the RN file part; on device it is the {uri,name,type} object.
    expect(fields).toHaveProperty('payslip');
  });

  it('pure validation + estimate', () => {
    const v = { ...emptyPayslip(), month: '2026-08', basicSalary: '1000', overtimeHours: '800', overtimeRate: '10', bonus: 'abc' };
    const e = validatePayslip(v, true, ['2026-08']);
    expect(e.month).toBe('A payslip for this month already exists.');
    expect(e.overtimeHours).toMatch(/at most 744/);
    expect(e.bonus).toBe('Bonus must be a number.');
    const est = estimatePayslip({ ...emptyPayslip(), basicSalary: '1000', reimbursements: '100', overtimeHours: '2', overtimeRate: '50', incomeTax: '300' });
    expect(est).toEqual({ overtimePay: 100, gross: 1200, deductions: 300, net: 900 });
  });
});

describe('client standings + entity delete', () => {
  it('validates integers, unique names and won + lost ≤ played', () => {
    const rows = [
      { ...newRow(), teamName: 'Tigers', played: '5', won: '3', lost: '3', points: '9' },
      { ...newRow(), teamName: 'tigers', played: '1', won: '0', lost: '0', points: '-1' },
      { ...newRow(), teamName: 'Lions', played: '4', won: '2', lost: '2', points: '6' },
    ];
    const errors = validateStandings(rows);
    expect(errors[0].row).toBe('Won + lost cannot be more than played.');
    expect(errors[1].teamName).toBe('Duplicate of row 1.');
    expect(errors[1].points).toBe('Whole number, 0 or more.');
    expect(errors[2]).toBeUndefined();
  });

  it('deletes a sponsor only after confirmation', async () => {
    params.id = 'sp-1';
    const routes = {
      'GET /api/sponsors/sp-1': () => ok({ sponsor: { _id: 'sp-1', name: 'Acme', collaboration: 'Title Sponsor', eventsSponsored: 2, reach: '1M' } }),
      'DELETE /api/sponsors/sp-1': () => ok({ message: 'Sponsor deleted' }),
    };
    const cancel = answerConfirm(0);
    const { apiCalls } = await renderAdmin(<SponsorDetailScreen />, routes);
    await fireEvent.press(await screen.findByTestId('entity-delete'));
    expect(cancel).toHaveBeenCalled();
    expect(apiCalls('DELETE', '/api/sponsors/sp-1')).toHaveLength(0);

    cancel.mockRestore();
    answerConfirm(1);
    await fireEvent.press(screen.getByTestId('entity-delete'));
    await waitFor(() => expect(apiCalls('DELETE', '/api/sponsors/sp-1')).toHaveLength(1));
  });
});

function jsonCreated(payslip: Record<string, unknown>) {
  return { status: 201, ok: true, text: async () => JSON.stringify({ success: true, payslip }) };
}
