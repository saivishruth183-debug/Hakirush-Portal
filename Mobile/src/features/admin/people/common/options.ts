import type { SelectOption } from '@/components';

/** Enums mirrored from Backend/models/Employee.js and the web forms. */
export const GENDERS = ['Male', 'Female', 'Other'] as const;
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const ROLES = ['employee', 'admin'] as const;
export const PLAN_TYPES = ['Annual', 'Quarterly'] as const;
export const COLLABORATIONS = ['Title Sponsor', 'Associate Sponsor', 'Event Sponsor', 'Media Partner'] as const;

export function toOptions<T extends string>(values: readonly T[]): SelectOption<T>[] {
  return values.map((v) => ({ label: v, value: v }));
}

export const ROLE_OPTIONS: SelectOption<(typeof ROLES)[number]>[] = [
  { label: 'Employee', value: 'employee', description: 'Uses the employee app' },
  { label: 'Admin', value: 'admin', description: 'Full HR and admin access' },
];
