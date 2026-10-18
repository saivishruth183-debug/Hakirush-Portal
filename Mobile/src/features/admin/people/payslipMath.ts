/**
 * Payslip form fields, validation and the client-side ESTIMATE (the server recomputes and stores
 * the real totals: Backend/controllers/payslipController.js computePayslipFigures).
 */
import { addMonths, monthKey } from '@/utils/format';

import { parseNumber, validateNumber } from './common/forms';

export const EARNINGS = [
  ['basicSalary', 'Basic salary'],
  ['hra', 'HRA'],
  ['conveyanceAllowance', 'Conveyance allowance'],
  ['medicalAllowance', 'Medical allowance'],
  ['otherAllowances', 'Other allowances'],
  ['bonus', 'Bonus'],
] as const;
export const OVERTIME = [
  ['overtimeHours', 'Overtime hours'],
  ['overtimeRate', 'Overtime rate (₹ per hour)'],
] as const;
export const DEDUCTIONS = [
  ['providentFund', 'Provident fund'],
  ['professionalTax', 'Professional tax'],
  ['incomeTax', 'Income tax'],
  ['lossOfPay', 'Loss of pay'],
  ['otherDeductions', 'Other deductions'],
] as const;
export const REIMBURSEMENTS = [['reimbursements', 'Reimbursements']] as const;

export const AMOUNT_FIELDS = [...EARNINGS, ...OVERTIME, ...DEDUCTIONS, ...REIMBURSEMENTS].map(([k]) => k);
export type AmountField = (typeof AMOUNT_FIELDS)[number];
export type PayslipValues = Record<AmountField, string> & { month: string; paymentStatus: 'Paid' | 'Pending' };
export type PayslipErrors = Partial<Record<AmountField | 'month' | 'file', string>>;

const MAX_AMOUNT = 1e9;
const MAX_OVERTIME_HOURS = 744;

export function emptyPayslip(): PayslipValues {
  const amounts = Object.fromEntries(AMOUNT_FIELDS.map((k) => [k, ''])) as Record<AmountField, string>;
  return { ...amounts, month: '', paymentStatus: 'Paid' };
}

const LABELS: Record<AmountField, string> = Object.fromEntries(
  [...EARNINGS, ...OVERTIME, ...DEDUCTIONS, ...REIMBURSEMENTS].map(([k, l]) => [k, l]),
) as Record<AmountField, string>;

/** Finite non-negative numbers, basic salary > 0, overtime hours ≤ 744, month YYYY-MM, PDF required. */
export function validatePayslip(v: PayslipValues, hasFile: boolean, issuedMonths: readonly string[] = []): PayslipErrors {
  const e: PayslipErrors = {};
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v.month)) e.month = 'Choose the payroll month.';
  else if (issuedMonths.includes(v.month)) e.month = 'A payslip for this month already exists.';
  for (const f of AMOUNT_FIELDS) {
    const err = validateNumber(v[f], {
      label: LABELS[f],
      required: f === 'basicSalary',
      positive: f === 'basicSalary',
      max: f === 'overtimeHours' ? MAX_OVERTIME_HOURS : MAX_AMOUNT,
    });
    if (err) e[f] = err;
  }
  if (!hasFile) e.file = 'Attach the payslip PDF.';
  return e;
}

const n = (t: string) => parseNumber(t) ?? 0;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Same formula as the server; shown only as an estimate. */
export function estimatePayslip(v: PayslipValues) {
  const overtimePay = round2(n(v.overtimeHours) * n(v.overtimeRate));
  const gross = round2(
    EARNINGS.reduce((s, [k]) => s + n(v[k]), 0) + n(v.reimbursements) + overtimePay,
  );
  const deductions = round2(DEDUCTIONS.reduce((s, [k]) => s + n(v[k]), 0));
  return { overtimePay, gross, deductions, net: round2(gross - deductions) };
}

/** Multipart fields for POST /api/payslip/add (empty amounts → "0"). */
export function payslipFormFields(employeeId: string, v: PayslipValues): Record<string, string> {
  const out: Record<string, string> = { employeeId, month: v.month, paymentStatus: v.paymentStatus };
  for (const f of AMOUNT_FIELDS) out[f] = String(parseNumber(v[f]) ?? 0);
  return out;
}

/** Month choices: next month back to 24 months ago (newest first). */
export function payrollMonthChoices(now = monthKey()): string[] {
  return Array.from({ length: 26 }, (_, i) => addMonths(now, 1 - i));
}
