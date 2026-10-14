import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, confirm, EmptyState, Icon, LoadingState, Screen, StatusPill, toast, type StatusPillProps } from '@/components';
import { api, getErrorMessage } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatCurrency, formatDate } from '@/utils/format';

import type { ExpenseClaimItem, ExpensesResponse } from '../types';

type Filter = 'All' | 'Pending' | 'Approved' | 'Reimbursed' | 'Rejected';
const FILTERS: Filter[] = ['All', 'Pending', 'Approved', 'Reimbursed', 'Rejected'];

function statusToTone(status: ExpenseClaimItem['status']): StatusPillProps['tone'] {
  switch (status) {
    case 'Approved':
      return 'success';
    case 'Reimbursed':
      return 'primary';
    case 'Rejected':
      return 'danger';
    case 'Pending':
    default:
      return 'warning';
  }
}

export function EmployeeExpensesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const [filter, setFilter] = useState<Filter>('All');

  const query = useApiQuery<ExpensesResponse>(keys.expenses(), '/api/expenses/me');
  const claims = query.data?.claims ?? [];
  const filtered = claims.filter((c) => filter === 'All' || c.status === filter);

  const deleteMutation = useApiMutation(
    (claimId: string) => api.delete<{ success: boolean; message: string }>(`/api/expenses/${claimId}`),
    {
      invalidate: [keys.expenses()],
      onSuccess: () => {
        toast.success('Expense claim deleted successfully.');
      },
    },
  );

  const handleDelete = async (claim: ExpenseClaimItem) => {
    if (claim.status === 'Reimbursed') {
      toast.error('Reimbursed claims cannot be deleted.');
      return;
    }
    const confirmed = await confirm({
      title: 'Delete Expense Claim?',
      message: `Are you sure you want to delete "${claim.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(claim._id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete expense claim.'));
    }
  };

  const totalClaimed = claims.reduce((s, c) => s + (c.amount || 0), 0);
  const totalApproved = claims
    .filter((c) => c.status === 'Approved' || c.status === 'Reimbursed')
    .reduce((s, c) => s + (c.amount || 0), 0);
  const totalPending = claims
    .filter((c) => c.status === 'Pending')
    .reduce((s, c) => s + (c.amount || 0), 0);

  const header = (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg, paddingBottom: 0 }}>
      {/* KPI Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <AppText variant="secondary" style={styles.statLabel}>Total Claimed</AppText>
          <AppText variant="title" style={{ color: theme.colors.text }}>{formatCurrency(totalClaimed)}</AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="secondary" style={styles.statLabel}>Approved</AppText>
          <AppText variant="title" style={{ color: theme.colors.success }}>{formatCurrency(totalApproved)}</AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="secondary" style={styles.statLabel}>Pending</AppText>
          <AppText variant="title" style={{ color: theme.colors.warning }}>{formatCurrency(totalPending)}</AppText>
        </Card>
      </View>

      <Button
        label="Claim an expense"
        icon="add"
        disabled={!canWrite}
        onPress={() => router.push('/employee/expense-apply')}
      />

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm }}
        accessibilityRole="tablist"
      >
        {FILTERS.map((f) => {
          const selected = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${f.toLowerCase()} claims`}
              style={[
                styles.chip,
                {
                  borderRadius: theme.radii.pill,
                  borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
                  backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                },
              ]}
            >
              <AppText variant="label" color={selected ? 'primary' : 'textSecondary'}>
                {f}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Screen scroll={false} padded={false}>
      {query.isPending && !query.data ? (
        <LoadingState label="Loading your expense claims…" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c._id}
          ListHeaderComponent={header}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
          renderItem={({ item }) => (
            <ExpenseCard
              claim={item}
              canDelete={canWrite && item.status !== 'Reimbursed'}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === item._id}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={filter === 'All' ? 'No expense claims yet' : `No ${filter.toLowerCase()} claims`}
              message="Submit travel bills, equipment receipts, and client lunch expenses for reimbursement."
            />
          }
        />
      )}
    </Screen>
  );
}

function ExpenseCard({
  claim,
  canDelete,
  isDeleting,
  onDelete,
}: {
  claim: ExpenseClaimItem;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const theme = useTheme();

  const openReceipt = () => {
    if (claim.receiptUrl) {
      Linking.openURL(claim.receiptUrl).catch(() => undefined);
    }
  };

  return (
    <Card style={{ marginHorizontal: theme.spacing.lg }}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <AppText variant="bodyStrong">{claim.title}</AppText>
          <AppText variant="secondary" style={styles.categorySub}>
            {claim.category} • {formatDate(claim.date)}
          </AppText>
        </View>
        <StatusPill label={claim.status} tone={statusToTone(claim.status)} />
      </View>

      <View style={styles.amountRow}>
        <AppText variant="title" style={{ color: theme.colors.primary }}>
          {formatCurrency(claim.amount)}
        </AppText>
        <View style={styles.actionButtonsRow}>
          {claim.receiptUrl ? (
            <Pressable
              onPress={openReceipt}
              style={[styles.receiptBtn, { borderColor: theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="View receipt attachment"
            >
              <Icon name="document-attach-outline" size={16} color={theme.colors.primary} />
              <AppText variant="label" color="primary">Receipt</AppText>
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable
              onPress={onDelete}
              disabled={isDeleting}
              style={[
                styles.deleteBtn,
                {
                  borderColor: theme.colors.dangerBg,
                  backgroundColor: theme.colors.dangerBg,
                  opacity: isDeleting ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Delete claim ${claim.title}`}
            >
              <Icon name="trash-outline" size={15} color={theme.colors.danger} />
              <AppText variant="label" style={{ color: theme.colors.danger }}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {claim.description ? (
        <AppText variant="secondary" style={styles.descText}>{claim.description}</AppText>
      ) : null}

      {claim.status === 'Reimbursed' && claim.reimbursedInPayslipMonth ? (
        <View style={[styles.reimbursedBanner, { backgroundColor: theme.colors.primarySoft }]}>
          <Icon name="checkmark-circle-outline" size={16} color={theme.colors.primary} />
          <AppText variant="label" color="primary">
            Reimbursed in {claim.reimbursedInPayslipMonth} payslip
          </AppText>
        </View>
      ) : null}

      {claim.reviewRemarks ? (
        <AppText variant="caption" style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
          Note: {claim.reviewRemarks}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  categorySub: {
    fontSize: 12,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  descText: {
    fontSize: 13,
    marginTop: 4,
  },
  reimbursedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
});
