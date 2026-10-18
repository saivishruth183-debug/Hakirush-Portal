import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Card, IconButton, LoadingState, SegmentedControl, SelectField } from '@/components';
import { useTheme } from '@/theme';

import { useEligibleManagers } from './api';
import { FormBanner } from './common/FormBanner';
import type { ManagerChoice, ManagerConflict } from './types';

export interface ManagerReassignDialogProps {
  /** Non-null while the dialog is open. */
  conflict: ManagerConflict | null;
  /** The employee being moved/deactivated (excluded from the replacement list). */
  employeeRecordId: string;
  employeeName: string;
  /** Verb for the confirm button, e.g. "Deactivate" or "Save changes". */
  actionLabel: string;
  /** Error from the last retry (e.g. replacement no longer eligible). */
  error?: string | null;
  onCancel: () => void;
  /** Resend the original request with the choice. */
  onConfirm: (choice: ManagerChoice) => Promise<unknown> | unknown;
}

type Mode = 'replace' | 'clear';

/**
 * Shown after 409 MANAGER_REASSIGNMENT_REQUIRED: the employee manages a department, so the admin
 * must either pick a replacement manager (an active member of that department) or clear the assignment.
 */
export function ManagerReassignDialog(props: ManagerReassignDialogProps) {
  const { conflict, onCancel } = props;
  const theme = useTheme();
  return (
    <Modal visible={!!conflict} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
          <IconButton icon="close" accessibilityLabel="Cancel" onPress={onCancel} />
          <AppText variant="heading" style={styles.flex}>
            Department manager
          </AppText>
        </View>
        {conflict ? <DialogBody {...props} conflict={conflict} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

function DialogBody({ conflict, employeeRecordId, employeeName, actionLabel, error, onCancel, onConfirm }: ManagerReassignDialogProps & { conflict: ManagerConflict }) {
  const theme = useTheme();
  const eligibleQuery = useEligibleManagers(conflict.departmentId);
  const candidates = (eligibleQuery.data ?? []).filter((m) => String(m.employeeRecordId) !== String(employeeRecordId));
  const [mode, setMode] = useState<Mode>('replace');
  const [replacement, setReplacement] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const noCandidates = eligibleQuery.isSuccess && candidates.length === 0;
  const effectiveMode: Mode = noCandidates ? 'clear' : mode;
  const department = conflict.departmentName ?? 'their department';

  const confirmChoice = async () => {
    setLocalError(null);
    if (effectiveMode === 'replace') {
      if (!replacement) {
        setLocalError('Choose the new manager, or switch to "No manager".');
        return;
      }
      await onConfirm({ replacementManagerEmployeeId: replacement });
    } else {
      await onConfirm({ clearManager: true });
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }} keyboardShouldPersistTaps="handled">
        <Card>
          <AppText variant="body">{conflict.message}</AppText>
          <AppText variant="secondary">
            {employeeName} currently manages {department}. Decide who manages {department} before continuing.
          </AppText>
        </Card>
        <FormBanner error={error ?? localError} />
        {eligibleQuery.isPending ? <LoadingState label="Loading eligible managers…" /> : null}
        {eligibleQuery.isError ? (
          <AppText variant="secondary" color="danger" accessibilityRole="alert">
            Couldn&apos;t load the people who can manage {department}. You can still clear the assignment.
          </AppText>
        ) : null}
        {!noCandidates && !eligibleQuery.isError ? (
          <SegmentedControl<Mode>
            accessibilityLabel="Manager decision"
            value={mode}
            onChange={setMode}
            options={[
              { label: 'Pick a replacement', value: 'replace' },
              { label: 'No manager', value: 'clear' },
            ]}
          />
        ) : null}
        {noCandidates ? (
          <AppText variant="secondary">
            Nobody else in {department} can take over (only active members are eligible). The assignment will be cleared.
          </AppText>
        ) : null}
        {effectiveMode === 'replace' && eligibleQuery.isSuccess && candidates.length > 0 ? (
          <SelectField<string>
            label="New manager"
            value={replacement}
            onChange={setReplacement}
            required
            searchable
            testID="replacement-manager"
            options={candidates.map((m) => ({
              label: m.name || m.employeeCode,
              value: String(m.employeeRecordId),
              description: [m.employeeCode, m.designation].filter(Boolean).join(' · '),
            }))}
          />
        ) : null}
        {effectiveMode === 'clear' ? (
          <AppText variant="secondary">
            {department} will show &quot;Manager not assigned&quot; until you assign someone from the department screen.
          </AppText>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { padding: theme.spacing.lg, gap: theme.spacing.sm, borderTopColor: theme.colors.border }]}>
        <Button
          label={effectiveMode === 'replace' ? `Assign and ${actionLabel.toLowerCase()}` : `Clear manager and ${actionLabel.toLowerCase()}`}
          onPress={confirmChoice}
          disabled={eligibleQuery.isPending && effectiveMode === 'replace'}
          testID="manager-reassign-confirm"
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
