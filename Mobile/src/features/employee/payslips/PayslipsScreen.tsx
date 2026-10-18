import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, DetailRow, Divider, QueryStateView, Screen, StatusPill, toast } from '@/components';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useTheme } from '@/theme';
import { formatCurrency, formatDate } from '@/utils/format';

import { payslipMonthLabel } from '../format';
import type { PayslipItem, PayslipsResponse } from '../types';
import { sharePayslipPdf } from './payslipFile';

function usePayslips() {
  const keys = useQueryKeys();
  return useApiQuery<PayslipsResponse>(keys.payslips(), '/api/payslip/me');
}

export function PayslipsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const q = usePayslips();
  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: 'Payslips' }} />
      <QueryStateView query={q} isEmpty={(d) => d.payslips.length === 0} emptyTitle="No payslips yet" emptyMessage="Your payslips appear here once HR publishes them.">
        {(d) => (
          <FlatList
            data={d.payslips}
            keyExtractor={(p) => p._id}
            contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.lg }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void q.refetch()} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
            renderItem={({ item: p }) => (
              <Card onPress={() => router.push(`/employee/payslip/${p._id}`)} accessibilityLabel={`${payslipMonthLabel(p.month)}, net pay ${formatCurrency(p.netSalary)}`}>
                <View style={styles.row}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {payslipMonthLabel(p.month)}
                  </AppText>
                  {p.paymentStatus ? <StatusPill status={p.paymentStatus} accessibilityPrefix="Payment" /> : null}
                </View>
                <AppText variant="title">{formatCurrency(p.netSalary)}</AppText>
                <AppText variant="secondary">
                  Gross {formatCurrency(p.grossSalary)} · Deductions {formatCurrency(p.totalDeductions)}
                </AppText>
              </Card>
            )}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}

const EARNINGS: [keyof PayslipItem, string][] = [
  ['basicSalary', 'Basic salary'],
  ['hra', 'HRA'],
  ['conveyanceAllowance', 'Conveyance allowance'],
  ['medicalAllowance', 'Medical allowance'],
  ['otherAllowances', 'Other allowances'],
  ['bonus', 'Bonus'],
  ['overtimePay', 'Overtime pay'],
  ['reimbursements', 'Reimbursements'],
];
const DEDUCTIONS: [keyof PayslipItem, string][] = [
  ['providentFund', 'Provident fund'],
  ['professionalTax', 'Professional tax'],
  ['incomeTax', 'Income tax'],
  ['lossOfPay', 'Loss of pay'],
  ['otherDeductions', 'Other deductions'],
];

export function PayslipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = usePayslips();
  const money = (p: PayslipItem, k: keyof PayslipItem) => formatCurrency(Number(p[k] ?? 0));

  const share = async (p: PayslipItem) => {
    const r = await sharePayslipPdf(p);
    if (!r.ok) toast.error(r.message);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Payslip' }} />
      <QueryStateView query={q}>
        {(d) => {
          const p = d.payslips.find((x) => x._id === id);
          if (!p) return <AppText variant="body">This payslip could not be found. It may have been removed.</AppText>;
          return (
            <>
              <Card>
                <AppText variant="heading">{payslipMonthLabel(p.month)}</AppText>
                <AppText variant="display">{formatCurrency(p.netSalary)}</AppText>
                <AppText variant="secondary">Net pay</AppText>
                {p.paymentStatus ? <StatusPill status={p.paymentStatus} accessibilityPrefix="Payment" /> : null}
                {p.paymentDate ? <AppText variant="secondary">Paid on {formatDate(p.paymentDate)}</AppText> : null}
                <Button label="Open or share PDF" icon="document-attach-outline" onPress={() => share(p)} testID="payslip-share" />
                {p.fileMigrationRequired ? <AppText variant="secondary" color="warning">This older payslip file is being migrated; contact HR.</AppText> : null}
              </Card>
              <Card>
                <AppText variant="heading">Earnings</AppText>
                {EARNINGS.map(([k, label]) => (
                  <DetailRow key={k} label={label} value={money(p, k)} />
                ))}
                {p.overtimeHours ? <AppText variant="caption">Overtime: {p.overtimeHours} h × {formatCurrency(p.overtimeRate ?? 0)}</AppText> : null}
                <Divider />
                <DetailRow label="Gross salary" value={formatCurrency(p.grossSalary)} />
              </Card>
              <Card>
                <AppText variant="heading">Deductions</AppText>
                {DEDUCTIONS.map(([k, label]) => (
                  <DetailRow key={k} label={label} value={money(p, k)} />
                ))}
                <Divider />
                <DetailRow label="Total deductions" value={formatCurrency(p.totalDeductions)} />
              </Card>
            </>
          );
        }}
      </QueryStateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
