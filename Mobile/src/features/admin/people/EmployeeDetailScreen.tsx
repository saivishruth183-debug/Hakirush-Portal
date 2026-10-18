import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Card, confirm, DetailRow, Screen, SectionHeader, StatusPill, toast } from '@/components';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { ROLE_LABELS } from '@/utils/identity';

import { deactivateEmployee, employeeWriteKeys, managerConflictOf, reactivateEmployee, useEmployee, usePeopleKeys } from './api';
import { DetailLoader, ScreenTitle } from './common/DetailLoader';
import { FormBanner } from './common/FormBanner';
import { isoToYmd, isSilentError, writeErrorMessage } from './common/forms';
import { ManagerReassignDialog } from './ManagerReassignDialog';
import type { AdminEmployee, ManagerChoice, ManagerConflict } from './types';

/** /admin/employees/[id] */
export function EmployeeDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useEmployee(id);
  return <DetailLoader query={query} title="Employee">{(e) => <EmployeeDetail employee={e} onRefresh={() => query.refetch()} refreshing={query.isRefetching} />}</DetailLoader>;
}

function EmployeeDetail({ employee: e, onRefresh, refreshing }: { employee: AdminEmployee; onRefresh: () => unknown; refreshing: boolean }) {
  const theme = useTheme();
  const k = usePeopleKeys();
  const { canWrite } = useSession();
  const name = e.userId?.name || 'Unnamed employee';
  const inactive = e.isActive === false;
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ManagerConflict | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const deactivate = useApiMutation((choice: ManagerChoice | undefined) => deactivateEmployee(e._id, choice), { invalidate: employeeWriteKeys(k) });
  const reactivate = useApiMutation(() => reactivateEmployee(e._id), { invalidate: employeeWriteKeys(k) });

  const runDeactivate = async (choice?: ManagerChoice) => {
    setError(null);
    try {
      await deactivate.mutateAsync(choice);
      setConflict(null);
      toast.success(`${name} was deactivated.`);
    } catch (err) {
      if (isSilentError(err)) return;
      const c = managerConflictOf(err);
      if (c && !choice) {
        setConflictError(null);
        setConflict(c);
      } else if (choice) {
        setConflictError(writeErrorMessage(err));
      } else {
        setError(writeErrorMessage(err));
      }
    }
  };

  const onDeactivate = async () => {
    const ok = await confirm({
      title: `Deactivate ${name}?`,
      message:
        'They are signed out on every device and can no longer sign in. Attendance, leave and payroll history is kept, and you can reactivate the account later.',
      confirmLabel: 'Deactivate',
      destructive: true,
    });
    if (ok) await runDeactivate();
  };

  const onReactivate = async () => {
    const ok = await confirm({ title: `Reactivate ${name}?`, message: 'They will be able to sign in again.', confirmLabel: 'Reactivate' });
    if (!ok) return;
    setError(null);
    try {
      await reactivate.mutateAsync(undefined);
      toast.success(`${name} was reactivated.`);
    } catch (err) {
      if (!isSilentError(err)) setError(writeErrorMessage(err));
    }
  };

  const go = (suffix: string) => router.push(`/admin/employees/${e._id}${suffix}`);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <ScreenTitle title={name} />
      <FormBanner error={error} offline={!canWrite} />
      <Card>
        <View style={[styles.head, { gap: theme.spacing.md }]}>
          <Avatar uri={e.userId?.profileImage} name={name} id={e._id} size={72} />
          <View style={styles.flex}>
            <AppText variant="title">{name}</AppText>
            <AppText variant="secondary">{[e.employeeId, e.designation].filter(Boolean).join(' · ')}</AppText>
            <StatusPill status={inactive ? 'Inactive' : 'Active'} accessibilityPrefix="Account" />
          </View>
        </View>
      </Card>
      <View style={{ gap: theme.spacing.sm }}>
        <Button label="Edit details" icon="create-outline" onPress={() => go('/edit')} disabled={!canWrite} />
        <Button label="Issue payslip" icon="receipt-outline" variant="secondary" onPress={() => go('/payslip-new')} disabled={!canWrite} />
        <Button label="Payslip history" icon="documents-outline" variant="secondary" onPress={() => go('/payslips')} />
        <Button label="Leave history" icon="airplane-outline" variant="secondary" onPress={() => go('/leaves')} />
      </View>
      <SectionHeader title="Work" />
      <Card>
        <DetailRow label="Employee code" value={e.employeeId} />
        <DetailRow label="Department" value={e.department?.dep_name} />
        <DetailRow label="Designation" value={e.designation} />
        <DetailRow label="Annual salary" value={e.salary === undefined ? null : formatCurrency(e.salary)} />
        <DetailRow label="Experience" value={e.experience ? `${e.experience} years` : null} />
        <DetailRow label="Date of joining" value={e.dateOfJoining ? formatDate(isoToYmd(e.dateOfJoining)) : null} />
      </Card>
      <SectionHeader title="Personal" />
      <Card>
        <DetailRow label="Date of birth" value={e.dob ? formatDate(isoToYmd(e.dob)) : null} />
        <DetailRow label="Gender" value={e.gender} />
        <DetailRow label="Marital status" value={e.maritalStatus} />
        <DetailRow label="Blood group" value={e.bloodGroup} />
      </Card>
      <SectionHeader title="Statutory IDs" />
      <Card>
        <DetailRow label="Aadhaar" value={e.aadharcard} />
        <DetailRow label="PAN" value={e.pancard} />
        <DetailRow label="PF number" value={e.pfNumber} />
      </Card>
      <SectionHeader title="Account" />
      <Card>
        <DetailRow label="Email" value={e.userId?.email} />
        <DetailRow label="Role" value={e.userId?.role ? ROLE_LABELS[e.userId.role] : null} />
        <DetailRow label="Status" value={inactive ? 'Inactive (sign-in blocked)' : 'Active'} />
        <DetailRow label="Record created" value={e.createdAt ? formatDateTime(e.createdAt) : null} />
        <DetailRow label="Last updated" value={e.updatedAt ? formatDateTime(e.updatedAt) : null} />
      </Card>
      {inactive ? (
        <Button label="Reactivate account" icon="refresh-outline" onPress={onReactivate} disabled={!canWrite} testID="employee-reactivate" />
      ) : (
        <Button label="Deactivate account" icon="person-remove-outline" variant="destructive" onPress={onDeactivate} disabled={!canWrite} testID="employee-deactivate" />
      )}
      <ManagerReassignDialog
        conflict={conflict}
        employeeRecordId={e._id}
        employeeName={name}
        actionLabel="Deactivate"
        error={conflictError}
        onCancel={() => setConflict(null)}
        onConfirm={(choice) => runDeactivate(choice)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
});
