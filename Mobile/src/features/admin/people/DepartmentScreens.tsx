import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  confirm,
  DetailRow,
  Divider,
  FormSection,
  ListRow,
  QueryStateView,
  Screen,
  SelectField,
  StatusPill,
  TextField,
  toast,
  type SelectOption,
} from '@/components';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

import { DepartmentsList, managerLine } from './AdminPeopleScreen';
import {
  createDepartment,
  deleteDepartment,
  isApiCode,
  updateDepartment,
  useDepartment,
  useDepartmentMembers,
  useEligibleManagers,
  usePeopleKeys,
} from './api';
import { DetailLoader, ScreenTitle } from './common/DetailLoader';
import { FormBanner } from './common/FormBanner';
import { isSilentError, serverFieldOf, writeErrorMessage, type FieldErrors } from './common/forms';
import type { DepartmentItem } from './types';

/** /admin/departments */
export function DepartmentsScreen() {
  return (
    <>
      <ScreenTitle title="Departments" />
      <DepartmentsList />
    </>
  );
}

type DeptField = 'dep_name' | 'description';

function validateDepartment(name: string, description: string): FieldErrors<DeptField> {
  const e: FieldErrors<DeptField> = {};
  if (!name.trim()) e.dep_name = 'Enter the department name.';
  else if (name.trim().length > 100) e.dep_name = 'Use at most 100 characters.';
  if (description.length > 1000) e.description = 'Use at most 1000 characters.';
  return e;
}

function departmentErrors(e: unknown): { fields: FieldErrors<DeptField>; form: string | null } {
  if (isApiCode(e, 'CONFLICT')) return { fields: { dep_name: writeErrorMessage(e) }, form: null };
  const field = serverFieldOf(e, ['dep_name', 'description'] as const);
  return field ? { fields: { [field]: writeErrorMessage(e) }, form: null } : { fields: {}, form: writeErrorMessage(e) };
}

/** /admin/departments/new */
export function DepartmentNewScreen() {
  const k = usePeopleKeys();
  const { canWrite } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors<DeptField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useApiMutation(createDepartment, { invalidate: [k.departments()] });

  const submit = async () => {
    setFormError(null);
    const v = validateDepartment(name, description);
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      await create.mutateAsync({ dep_name: name.trim(), description: description.trim() });
      toast.success('Department created.');
      router.back();
    } catch (e) {
      if (isSilentError(e)) return;
      const r = departmentErrors(e);
      setErrors(r.fields);
      setFormError(r.form);
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Create department" onPress={submit} disabled={!canWrite} testID="department-create" />}>
      <ScreenTitle title="New department" />
      <FormBanner error={formError} offline={!canWrite} />
      <FormSection description="A manager is assigned after employees have joined the department (open the department to assign one).">
        <TextField label="Department name" value={name} onChangeText={setName} required error={errors.dep_name} maxLength={100} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline error={errors.description} maxLength={1000} />
      </FormSection>
    </Screen>
  );
}

/** /admin/departments/[id] — edit + manager assignment + delete. */
export function DepartmentDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useDepartment(id);
  const [nonce, setNonce] = useState(0);
  return (
    <DetailLoader query={query} title="Department">
      {(d) => (
        <DepartmentEditor
          key={`${d._id}:${d.updatedAt}:${nonce}`}
          department={d}
          onReload={async () => {
            await query.refetch();
            setNonce((n) => n + 1);
          }}
        />
      )}
    </DetailLoader>
  );
}

function DepartmentEditor({ department: d, onReload }: { department: DepartmentItem; onReload: () => Promise<void> }) {
  const theme = useTheme();
  const k = usePeopleKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();
  const eligible = useEligibleManagers(d._id);
  const originalManager = d.managerEmployeeId ? String(d.managerEmployeeId) : '';
  const [name, setName] = useState(d.dep_name);
  const [description, setDescription] = useState(d.description ?? '');
  const [managerId, setManagerId] = useState(originalManager);
  const [errors, setErrors] = useState<FieldErrors<DeptField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const invalidate = [k.departments(), k.departmentAll(), k.employees(), k.employeeAll()];
  const save = useApiMutation((body: Parameters<typeof updateDepartment>[1]) => updateDepartment(d._id, body), { invalidate });
  const remove = useApiMutation(() => deleteDepartment(d._id), { invalidate: [k.departments()] });

  const managerOptions: SelectOption<string>[] = [
    { label: 'No manager', value: '', description: 'Leave the department without a manager' },
    ...(eligible.data ?? []).map((m) => ({
      label: m.name || m.employeeCode,
      value: String(m.employeeRecordId),
      description: [m.employeeCode, m.designation].filter(Boolean).join(' · '),
    })),
  ];
  if (originalManager && !managerOptions.some((o) => o.value === originalManager)) {
    managerOptions.push({
      label: `${d.manager?.name ?? 'Current manager'} (current — no longer eligible)`,
      value: originalManager,
      description: 'Inactive or moved to another department. Choose someone else or No manager.',
    });
  }

  const submit = async () => {
    setFormError(null);
    setStale(false);
    const v = validateDepartment(name, description);
    setErrors(v);
    if (Object.keys(v).length) return;
    const body: Parameters<typeof updateDepartment>[1] = {
      dep_name: name.trim(),
      description: description.trim(),
      expectedUpdatedAt: d.updatedAt,
    };
    if (managerId !== originalManager) body.managerEmployeeId = managerId || null;
    try {
      await save.mutateAsync(body);
      toast.success('Department saved.');
    } catch (e) {
      if (isSilentError(e)) return;
      if (isApiCode(e, 'STALE_UPDATE')) {
        setStale(true);
        setFormError(`${writeErrorMessage(e)} Reload to see the latest version, then make your change again.`);
        return;
      }
      const r = departmentErrors(e);
      setErrors(r.fields);
      setFormError(r.form);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${d.dep_name}?`,
      message: 'This permanently removes the department. It is only possible when no employee records (active or inactive) belong to it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(undefined);
      queryClient.removeQueries({ queryKey: k.department(d._id) });
      toast.success('Department deleted.');
      router.back();
    } catch (e) {
      if (!isSilentError(e)) setFormError(writeErrorMessage(e));
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Save changes" onPress={submit} disabled={!canWrite} testID="department-save" />}>
      <ScreenTitle title={d.dep_name} />
      <FormBanner
        error={formError}
        offline={!canWrite}
        actionLabel={stale ? 'Reload' : undefined}
        onAction={stale ? onReload : undefined}
        testID="department-error"
      />
      <Card>
        <DetailRow label="Manager" value={managerLine(d)} />
        <StatusPill status={d.managerStatus === 'invalid' ? 'Needs reassignment' : d.managerStatus === 'assigned' ? 'Assigned' : 'Unassigned'} tone={d.managerStatus === 'invalid' ? 'danger' : undefined} accessibilityPrefix="Manager status" />
        <DetailRow label="Active members" value={d.memberCount} />
        <DetailRow label="Employee records (incl. inactive)" value={d.employeeCount} />
        <DetailRow label="Created" value={d.createdAt ? formatDateTime(d.createdAt) : null} />
        <DetailRow label="Last updated" value={formatDateTime(d.updatedAt)} />
        <Button label={`View members (${d.memberCount})`} variant="secondary" icon="people-outline" onPress={() => router.push(`/admin/departments/${d._id}/members`)} />
      </Card>
      <FormSection title="Details">
        <TextField label="Department name" value={name} onChangeText={setName} required error={errors.dep_name} maxLength={100} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline error={errors.description} maxLength={1000} />
      </FormSection>
      <FormSection title="Manager" description="Only active members of this department can be assigned.">
        <SelectField<string>
          label="Department manager"
          value={managerId}
          options={managerOptions}
          onChange={setManagerId}
          searchable
          testID="department-manager"
          disabled={eligible.isPending}
          helper={
            eligible.isPending
              ? 'Loading eligible employees…'
              : eligible.isError
                ? "Couldn't load eligible employees. Pull back and open the department again."
                : (eligible.data?.length ?? 0) === 0
                  ? 'No active members yet. Add employees to this department first.'
                  : undefined
          }
        />
      </FormSection>
      {d.managerHistory?.length ? (
        <FormSection title="Manager history">
          {d.managerHistory.map((h, i) => (
            <AppText key={i} variant="secondary">
              {formatDateTime(h.changedAt)} · {h.reason || 'change'}
            </AppText>
          ))}
        </FormSection>
      ) : null}
      <FormSection title="Danger zone">
        {d.employeeCount > 0 ? (
          <AppText variant="secondary">
            {d.employeeCount} employee {d.employeeCount === 1 ? 'record belongs' : 'records belong'} to this department. Move them to another
            department before deleting it.
          </AppText>
        ) : null}
        <Button label="Delete department" variant="destructive" icon="trash-outline" onPress={onDelete} disabled={!canWrite} testID="department-delete" />
      </FormSection>
      <Divider />
      <AppText variant="caption" style={{ paddingBottom: theme.spacing.md }}>
        Saving checks that nobody else changed this department since you opened it.
      </AppText>
    </Screen>
  );
}

/** /admin/departments/[id]/members — manager first. */
export function DepartmentMembersScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const dept = useDepartment(id);
  const members = useDepartmentMembers(id);
  const managerId = dept.data?.managerEmployeeId ? String(dept.data.managerEmployeeId) : null;
  return (
    <Screen scroll={false}>
      <ScreenTitle title={dept.data ? `${dept.data.dep_name} members` : 'Members'} />
      <QueryStateView query={members} isEmpty={(m) => m.length === 0} emptyTitle="No members yet" emptyMessage="Employees added to this department appear here.">
        {(list) => {
          const sorted = [...list].sort((a, b) => {
            const am = String(a._id) === managerId ? 0 : 1;
            const bm = String(b._id) === managerId ? 0 : 1;
            return am - bm || (a.userId?.name ?? '').localeCompare(b.userId?.name ?? '');
          });
          return (
            <FlatList
              data={sorted}
              keyExtractor={(e) => e._id}
              ItemSeparatorComponent={() => <Divider inset={theme.spacing.lg} />}
              renderItem={({ item: e }) => {
                const isManager = String(e._id) === managerId;
                const name = e.userId?.name || 'Unnamed employee';
                return (
                  <ListRow
                    left={{ avatar: { uri: e.userId?.profileImage, name, id: e._id } }}
                    title={name}
                    subtitle={[e.employeeId, e.designation].filter(Boolean).join(' · ')}
                    meta={isManager ? 'Department manager' : undefined}
                    right={
                      isManager ? (
                        <Badge label="Manager" tone="primary" />
                      ) : e.isActive === false ? (
                        <StatusPill status="Inactive" accessibilityPrefix="Account" />
                      ) : undefined
                    }
                    onPress={() => router.push(`/admin/employees/${e._id}`)}
                  />
                );
              }}
            />
          );
        }}
      </QueryStateView>
    </Screen>
  );
}
