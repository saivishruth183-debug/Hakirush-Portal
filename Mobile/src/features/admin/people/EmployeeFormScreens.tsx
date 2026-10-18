import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, DateField, FormSection, Screen, SelectField, TextField, toast } from '@/components';
import type { PickedFile } from '@/features/shared/media/pickers';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { businessDate } from '@/utils/format';

import {
  createEmployee,
  employeeWriteKeys,
  managerConflictOf,
  updateEmployee,
  useDepartments,
  useEmployee,
  usePeopleKeys,
} from './api';
import { DetailLoader, ScreenTitle } from './common/DetailLoader';
import { FormBanner } from './common/FormBanner';
import { ImagePickField } from './common/ImagePickField';
import {
  isSilentError,
  isValidEmail,
  isoToYmd,
  numberText,
  serverFieldOf,
  validateNumber,
  writeErrorMessage,
  type FieldErrors,
} from './common/forms';
import { BLOOD_GROUPS, GENDERS, MARITAL_STATUSES, ROLE_OPTIONS, toOptions } from './common/options';
import { ManagerReassignDialog } from './ManagerReassignDialog';
import type { AdminEmployee, ManagerChoice, ManagerConflict } from './types';

const FIELDS = [
  'name', 'email', 'employeeId', 'dob', 'gender', 'maritalStatus', 'password', 'department', 'role',
  'designation', 'experience', 'salary', 'bloodGroup', 'aadharcard', 'pancard', 'pfNumber',
] as const;
type Field = (typeof FIELDS)[number];
export type EmployeeFormValues = Record<Field, string>;

const EMPTY: EmployeeFormValues = {
  name: '', email: '', employeeId: '', dob: '', gender: '', maritalStatus: '', password: '', department: '', role: 'employee',
  designation: '', experience: '', salary: '', bloodGroup: '', aadharcard: '', pancard: '', pfNumber: '',
};

/** Client-side validation mirroring the web form + backend validators. `mode` edit skips account fields. */
export function validateEmployee(v: EmployeeFormValues, mode: 'add' | 'edit'): FieldErrors<Field> {
  const e: FieldErrors<Field> = {};
  if (!v.name.trim()) e.name = 'Enter the full name.';
  if (!v.employeeId.trim()) e.employeeId = 'Enter the employee code.';
  if (!v.designation.trim()) e.designation = 'Enter the designation.';
  if (!v.department) e.department = 'Choose a department.';
  const salary = validateNumber(v.salary, { label: 'Salary', required: true, max: 1e12 });
  if (salary) e.salary = salary;
  const exp = validateNumber(v.experience, { label: 'Experience', required: mode === 'add', max: 80 });
  if (exp) e.experience = exp;
  if (v.dob && v.dob > businessDate()) e.dob = 'Date of birth cannot be in the future.';
  for (const f of ['aadharcard', 'pancard', 'pfNumber'] as const) if (v[f].trim().length > 50) e[f] = 'Use at most 50 characters.';
  if (mode === 'add') {
    if (!isValidEmail(v.email)) e.email = 'Enter a valid email address.';
    if (v.password.length < 8) e.password = 'Use at least 8 characters.';
    if (!v.dob) e.dob = 'Choose the date of birth.';
    if (!v.gender) e.gender = 'Choose a gender.';
    if (!v.maritalStatus) e.maritalStatus = 'Choose a marital status.';
    if (!v.bloodGroup) e.bloodGroup = 'Choose a blood group.';
  }
  return e;
}

function employeeErrors(e: unknown): { fields: FieldErrors<Field>; form: string | null } {
  const msg = writeErrorMessage(e);
  const lower = msg.toLowerCase();
  if (lower.includes('email')) return { fields: { email: msg }, form: null };
  if (lower.includes('employee id')) return { fields: { employeeId: msg }, form: null };
  if (lower.startsWith('department')) return { fields: { department: msg }, form: null };
  const field = serverFieldOf(e, FIELDS);
  return field ? { fields: { [field]: msg }, form: null } : { fields: {}, form: msg };
}

function EmployeeFields({ mode, values, set, errors }: { mode: 'add' | 'edit'; values: EmployeeFormValues; set: (f: Field, v: string) => void; errors: FieldErrors<Field> }) {
  const departments = useDepartments();
  const add = mode === 'add';
  return (
    <>
      <FormSection title="Identity">
        <TextField label="Full name" value={values.name} onChangeText={(t) => set('name', t)} required error={errors.name} maxLength={100} autoCapitalize="words" />
        {add ? (
          <TextField label="Email address" value={values.email} onChangeText={(t) => set('email', t)} required error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="off" />
        ) : null}
        <TextField label="Employee code" value={values.employeeId} onChangeText={(t) => set('employeeId', t)} required error={errors.employeeId} autoCapitalize="characters" helper="Unique code, e.g. HAKI0001." maxLength={50} />
        {add ? (
          <TextField label="Password" value={values.password} onChangeText={(t) => set('password', t)} secure required error={errors.password} helper="At least 8 characters. Share it with the employee securely." autoComplete="new-password" />
        ) : null}
      </FormSection>
      <FormSection title="Personal">
        <DateField label="Date of birth" value={values.dob || null} onChange={(d) => set('dob', d ?? '')} maximumDate={businessDate()} required={add} clearable={!add} error={errors.dob} />
        <SelectField label="Gender" value={values.gender} options={toOptions(GENDERS)} onChange={(v) => set('gender', v)} required={add} error={errors.gender} />
        <SelectField label="Marital status" value={values.maritalStatus} options={toOptions(MARITAL_STATUSES)} onChange={(v) => set('maritalStatus', v)} required={add} error={errors.maritalStatus} />
        <SelectField label="Blood group" value={values.bloodGroup} options={toOptions(BLOOD_GROUPS)} onChange={(v) => set('bloodGroup', v)} required={add} error={errors.bloodGroup} />
      </FormSection>
      <FormSection title="Work">
        <SelectField<string>
          label="Department"
          value={values.department}
          options={(departments.data ?? []).map((d) => ({ label: d.dep_name, value: d._id }))}
          onChange={(v) => set('department', v)}
          required
          error={errors.department}
          helper={departments.isPending ? 'Loading departments…' : departments.isError ? "Couldn't load departments." : undefined}
          testID="employee-department"
        />
        {add ? (
          <SelectField label="System role" value={values.role} options={ROLE_OPTIONS} onChange={(v) => set('role', v)} required helper="Admins get full HR access." />
        ) : null}
        <TextField label="Designation" value={values.designation} onChangeText={(t) => set('designation', t)} required error={errors.designation} maxLength={100} />
        <TextField label="Experience (years)" value={values.experience} onChangeText={(t) => set('experience', t)} required={add} error={errors.experience} keyboardType="decimal-pad" />
        <TextField label="Annual salary (₹)" value={values.salary} onChangeText={(t) => set('salary', t)} required error={errors.salary} keyboardType="decimal-pad" />
      </FormSection>
      <FormSection title="Statutory IDs">
        <TextField label="Aadhaar number" value={values.aadharcard} onChangeText={(t) => set('aadharcard', t)} error={errors.aadharcard} keyboardType="number-pad" maxLength={50} />
        <TextField label="PAN" value={values.pancard} onChangeText={(t) => set('pancard', t)} error={errors.pancard} autoCapitalize="characters" maxLength={50} />
        <TextField label="PF number" value={values.pfNumber} onChangeText={(t) => set('pfNumber', t)} error={errors.pfNumber} autoCapitalize="characters" maxLength={50} />
      </FormSection>
    </>
  );
}

function useFormState(initial: EmployeeFormValues) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const set = (f: Field, v: string) => {
    setValues((prev) => ({ ...prev, [f]: v }));
    setErrors((prev) => (prev[f] ? { ...prev, [f]: undefined } : prev));
  };
  return { values, set, errors, setErrors };
}

/** /admin/employees/new */
export function EmployeeAddScreen() {
  const k = usePeopleKeys();
  const { canWrite } = useSession();
  const { values, set, errors, setErrors } = useFormState(EMPTY);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const create = useApiMutation(
    (v: EmployeeFormValues) =>
      createEmployee(
        {
          name: v.name.trim(), email: v.email.trim(), employeeId: v.employeeId.trim(), dob: v.dob, gender: v.gender,
          maritalStatus: v.maritalStatus, password: v.password, department: v.department, role: v.role,
          designation: v.designation.trim(), experience: v.experience.trim(), salary: v.salary.trim(),
          bloodGroup: v.bloodGroup, aadharcard: v.aadharcard.trim(), pancard: v.pancard.trim(), pfNumber: v.pfNumber.trim(),
        },
        photo,
      ),
    { invalidate: employeeWriteKeys(k) },
  );

  const submit = async () => {
    setFormError(null);
    const v = validateEmployee(values, 'add');
    setErrors(v);
    if (Object.keys(v).length) {
      setFormError('Check the highlighted fields.');
      return;
    }
    try {
      const res = await create.mutateAsync(values);
      toast.success(`${values.name.trim()} was added.`);
      router.replace(`/admin/employees/${res.employee._id}`);
    } catch (e) {
      if (isSilentError(e)) return;
      const r = employeeErrors(e);
      setErrors(r.fields);
      setFormError(r.form ?? 'Check the highlighted fields.');
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Add employee" onPress={submit} disabled={!canWrite} testID="employee-add-submit" />}>
      <ScreenTitle title="Add employee" />
      <FormBanner error={formError} offline={!canWrite} />
      <ImagePickField label="Profile photo" name={values.name} value={photo} onChange={setPhoto} helper="Optional. JPEG, up to 5 MB." />
      <EmployeeFields mode="add" values={values} set={set} errors={errors} />
    </Screen>
  );
}

function toFormValues(e: AdminEmployee): EmployeeFormValues {
  return {
    ...EMPTY,
    name: e.userId?.name ?? '',
    email: e.userId?.email ?? '',
    employeeId: e.employeeId ?? '',
    dob: isoToYmd(e.dob) ?? '',
    gender: e.gender ?? '',
    maritalStatus: e.maritalStatus ?? '',
    department: e.department?._id ?? '',
    role: e.userId?.role ?? 'employee',
    designation: e.designation ?? '',
    experience: e.experience ?? '',
    salary: numberText(e.salary),
    bloodGroup: e.bloodGroup ?? '',
    aadharcard: e.aadharcard ?? '',
    pancard: e.pancard ?? '',
    pfNumber: e.pfNumber ?? '',
  };
}

const EDITABLE: Field[] = [
  'name', 'employeeId', 'dob', 'gender', 'maritalStatus', 'department', 'designation', 'experience', 'salary',
  'bloodGroup', 'aadharcard', 'pancard', 'pfNumber',
];

/** Only the fields that changed (the admin update endpoint applies what it receives). */
export function changedEmployeeFields(original: EmployeeFormValues, next: EmployeeFormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of EDITABLE) {
    const a = original[f].trim();
    const b = next[f].trim();
    if (a !== b) out[f] = b;
  }
  return out;
}

/** /admin/employees/[id]/edit */
export function EmployeeEditScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useEmployee(id);
  return <DetailLoader query={query} title="Edit employee">{(e) => <EmployeeEditor key={e._id} employee={e} />}</DetailLoader>;
}

function EmployeeEditor({ employee }: { employee: AdminEmployee }) {
  const k = usePeopleKeys();
  const { canWrite } = useSession();
  const [original] = useState(() => toFormValues(employee));
  const { values, set, errors, setErrors } = useFormState(original);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ManagerConflict | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const update = useApiMutation(
    (vars: { fields: Record<string, string>; choice?: ManagerChoice }) => updateEmployee(employee._id, vars.fields, photo, vars.choice),
    { invalidate: employeeWriteKeys(k) },
  );

  const send = async (choice?: ManagerChoice) => {
    const fields = changedEmployeeFields(original, values);
    try {
      await update.mutateAsync({ fields, choice });
      setConflict(null);
      toast.success('Employee saved.');
      router.back();
    } catch (e) {
      if (isSilentError(e)) return;
      const c = managerConflictOf(e);
      if (c && !choice) {
        setConflictError(null);
        setConflict(c);
        return;
      }
      if (choice) {
        setConflictError(writeErrorMessage(e));
        return;
      }
      const r = employeeErrors(e);
      setErrors(r.fields);
      setFormError(r.form ?? 'Check the highlighted fields.');
    }
  };

  const submit = async () => {
    setFormError(null);
    const v = validateEmployee(values, 'edit');
    setErrors(v);
    if (Object.keys(v).length) {
      setFormError('Check the highlighted fields.');
      return;
    }
    if (!photo && Object.keys(changedEmployeeFields(original, values)).length === 0) {
      setFormError('Nothing has changed yet.');
      return;
    }
    await send();
  };

  const name = employee.userId?.name ?? 'Employee';
  return (
    <Screen keyboardAvoiding footer={<Button label="Save changes" onPress={submit} disabled={!canWrite} testID="employee-edit-submit" />}>
      <ScreenTitle title={`Edit ${name}`} />
      <FormBanner error={formError} offline={!canWrite} />
      <ImagePickField label="Profile photo" name={name} currentUri={employee.userId?.profileImage} value={photo} onChange={setPhoto} />
      <EmployeeFields mode="edit" values={values} set={set} errors={errors} />
      <ManagerReassignDialog
        conflict={conflict}
        employeeRecordId={employee._id}
        employeeName={name}
        actionLabel="Save changes"
        error={conflictError}
        onCancel={() => setConflict(null)}
        onConfirm={(choice) => send(choice)}
      />
    </Screen>
  );
}
