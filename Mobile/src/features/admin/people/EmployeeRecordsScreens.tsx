import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  DetailRow,
  Divider,
  FormSection,
  ListRow,
  QueryStateView,
  Screen,
  SegmentedControl,
  SelectField,
  StatusPill,
  TextField,
  toast,
} from '@/components';
import { pickPdf, type PickedFile } from '@/features/shared/media/pickers';
import { downloadToPrivateCache, isApiError, shareFile } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatCurrency, formatDate, formatDateTime, formatMonth, formatNumber } from '@/utils/format';

import { issuePayslip, isApiCode, useEmployee, useEmployeeLeaves, useEmployeePayslips, useLeaveBalance, usePeopleKeys } from './api';
import { ScreenTitle } from './common/DetailLoader';
import { FormBanner } from './common/FormBanner';
import { isoToYmd, isSilentError, writeErrorMessage } from './common/forms';
import {
  DEDUCTIONS,
  EARNINGS,
  emptyPayslip,
  estimatePayslip,
  OVERTIME,
  payrollMonthChoices,
  payslipFormFields,
  REIMBURSEMENTS,
  validatePayslip,
  type AmountField,
  type PayslipErrors,
  type PayslipValues,
} from './payslipMath';
import type { AdminPayslip } from './types';

const LEGACY_MESSAGE =
  'This payslip PDF was stored with the old public upload method and has not been migrated yet, so it cannot be opened. Ask the server administrator to run the payslip migration.';

function useEmployeeName(id: string): string {
  const q = useEmployee(id);
  return q.data?.userId?.name ?? 'Employee';
}

// ---------------- Issue payslip ----------------

type Step = 'form' | 'review' | 'done';

/** /admin/employees/[id]/payslip-new */
export function PayslipIssueScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const k = usePeopleKeys();
  const { canWrite } = useSession();
  const name = useEmployeeName(id);
  const history = useEmployeePayslips(id);
  const issued = (history.data ?? []).map((p) => p.month);
  const [values, setValues] = useState<PayslipValues>(emptyPayslip);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<PayslipErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [result, setResult] = useState<AdminPayslip | null>(null);
  const submit = useApiMutation((v: PayslipValues) => issuePayslip(payslipFormFields(id, v), pdf as PickedFile), {
    invalidate: [k.payslips(id)],
  });

  const set = (f: AmountField | 'month', t: string) => {
    setValues((p) => ({ ...p, [f]: t }));
    setErrors((p) => (p[f] ? { ...p, [f]: undefined } : p));
  };

  const choosePdf = async () => {
    const r = await pickPdf();
    if (r.status === 'canceled') return;
    if (r.status === 'picked') {
      setPdf(r.file);
      setPdfNotice(null);
      setErrors((p) => ({ ...p, file: undefined }));
    } else setPdfNotice(r.message);
  };

  // async so the press guard releases as soon as validation finishes (no 400 ms cooldown).
  const toReview = async () => {
    setFormError(null);
    const e = validatePayslip(values, !!pdf, issued);
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError('Check the highlighted fields.');
      return;
    }
    setStep('review');
  };

  const confirmSubmit = async () => {
    setFormError(null);
    try {
      const res = await submit.mutateAsync(values);
      setResult(res.payslip);
      setStep('done');
      toast.success('Payslip issued.');
    } catch (e) {
      if (isSilentError(e)) return;
      setFormError(
        isApiCode(e, 'CONFLICT') ? `${writeErrorMessage(e)} Choose another month or check the payslip history.` : writeErrorMessage(e),
      );
      setStep('form');
    }
  };

  const amountInput = (f: AmountField, label: string) => (
    <TextField key={f} label={label} value={values[f]} onChangeText={(t) => set(f, t)} keyboardType="decimal-pad" error={errors[f]} required={f === 'basicSalary'} />
  );

  if (step === 'done' && result) {
    return (
      <Screen footer={<Button label="View payslip history" onPress={() => router.replace(`/admin/employees/${id}/payslips`)} />}>
        <ScreenTitle title="Payslip issued" />
        <Card testID="payslip-result">
          <AppText variant="heading">{formatMonth(result.month)} payslip for {name}</AppText>
          <AppText variant="secondary">Amounts calculated and stored by the server:</AppText>
          <DetailRow label="Overtime pay" value={formatCurrency(result.overtimePay ?? 0)} />
          <DetailRow label="Gross salary" value={formatCurrency(result.grossSalary)} />
          <DetailRow label="Total deductions" value={formatCurrency(result.totalDeductions)} />
          <DetailRow label="Net salary" value={formatCurrency(result.netSalary)} />
          <DetailRow label="Payment status" value={result.paymentStatus} />
          <DetailRow label="Payment date" value={result.paymentDate ? formatDateTime(result.paymentDate) : 'Not paid yet'} />
        </Card>
        <Button label="Done" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (step === 'review') {
    const est = estimatePayslip(values);
    const rows = [...EARNINGS, ...OVERTIME, ...REIMBURSEMENTS, ...DEDUCTIONS].filter(([f]) => values[f].trim() !== '');
    return (
      <Screen
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button label="Issue payslip" onPress={confirmSubmit} disabled={!canWrite} testID="payslip-confirm" />
            <Button label="Back to edit" variant="secondary" onPress={() => setStep('form')} />
          </View>
        }
      >
        <ScreenTitle title="Review payslip" />
        <FormBanner error={formError} offline={!canWrite} />
        <Card>
          <AppText variant="heading">{name} · {formatMonth(values.month)}</AppText>
          <DetailRow label="Payment status" value={values.paymentStatus} />
          <DetailRow label="PDF" value={pdf?.name} />
          {rows.map(([f, label]) => (
            <DetailRow key={f} label={label} value={f === 'overtimeHours' ? formatNumber(Number(values[f])) : formatCurrency(Number(values[f]))} />
          ))}
        </Card>
        <Card testID="payslip-estimate">
          <AppText variant="subheading">Estimate only</AppText>
          <AppText variant="secondary">The server calculates the final gross, deductions and net when the payslip is issued.</AppText>
          <DetailRow label="Estimated overtime pay" value={formatCurrency(est.overtimePay)} />
          <DetailRow label="Estimated gross" value={formatCurrency(est.gross)} />
          <DetailRow label="Estimated deductions" value={formatCurrency(est.deductions)} />
          <DetailRow label="Estimated net" value={formatCurrency(est.net)} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboardAvoiding footer={<Button label="Review" onPress={toReview} disabled={!canWrite} testID="payslip-review" />}>
      <ScreenTitle title={`Payslip for ${name}`} />
      <FormBanner error={formError} offline={!canWrite} />
      <FormSection title="Period and payment">
        <SelectField<string>
          label="Payroll month"
          value={values.month || null}
          required
          error={errors.month}
          onChange={(m) => set('month', m)}
          testID="payslip-month"
          options={payrollMonthChoices().map((m) => ({
            label: formatMonth(m),
            value: m,
            description: issued.includes(m) ? 'Already issued' : undefined,
          }))}
        />
        <SegmentedControl<'Paid' | 'Pending'>
          accessibilityLabel="Payment status"
          value={values.paymentStatus}
          onChange={(s) => setValues((p) => ({ ...p, paymentStatus: s }))}
          options={[
            { label: 'Paid', value: 'Paid' },
            { label: 'Pending', value: 'Pending' },
          ]}
        />
        <AppText variant="secondary">The payment date is recorded automatically by the server when the status is Paid.</AppText>
      </FormSection>
      <FormSection title="Earnings">{EARNINGS.map(([f, l]) => amountInput(f, l))}</FormSection>
      <FormSection title="Overtime" description="Overtime pay = hours × rate.">{OVERTIME.map(([f, l]) => amountInput(f, l))}</FormSection>
      <FormSection title="Deductions">{DEDUCTIONS.map(([f, l]) => amountInput(f, l))}</FormSection>
      <FormSection title="Reimbursements">{REIMBURSEMENTS.map(([f, l]) => amountInput(f, l))}</FormSection>
      <FormSection title="Payslip PDF" description="PDF only, up to 5 MB.">
        {pdf ? <AppText variant="body">Selected: {pdf.name}</AppText> : null}
        <Button label={pdf ? 'Choose another PDF' : 'Choose PDF'} icon="document-attach-outline" variant="secondary" onPress={choosePdf} />
        {errors.file || pdfNotice ? (
          <AppText variant="secondary" color="danger" accessibilityRole="alert">
            {errors.file ?? pdfNotice}
          </AppText>
        ) : null}
      </FormSection>
    </Screen>
  );
}

// ---------------- Payslip history ----------------

/** /admin/employees/[id]/payslips */
export function EmployeePayslipsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { canWrite } = useSession();
  const name = useEmployeeName(id);
  const query = useEmployeePayslips(id);
  return (
    <Screen
      scroll={false}
      footer={<Button label="Issue payslip" icon="add" onPress={() => router.push(`/admin/employees/${id}/payslip-new`)} disabled={!canWrite} />}
    >
      <ScreenTitle title={`${name} · Payslips`} />
      <QueryStateView query={query} isEmpty={(d) => d.length === 0} emptyTitle="No payslips yet" emptyMessage="Issued payslips appear here.">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(p) => p._id}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
            renderItem={({ item }) => <PayslipCard payslip={item} />}
            onRefresh={() => query.refetch()}
            refreshing={query.isRefetching}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}

function PayslipCard({ payslip: p }: { payslip: AdminPayslip }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const amount = (v: number | undefined) => formatCurrency(v ?? 0);

  const openPdf = async () => {
    setNotice(null);
    try {
      const file = await downloadToPrivateCache(`/api/payslip/${encodeURIComponent(p._id)}/download`, `payslip-${p.month}.pdf`);
      const shared = await shareFile(file, { mimeType: 'application/pdf', dialogTitle: `Payslip ${formatMonth(p.month)}` });
      if (!shared) setNotice('Sharing is not available on this device.');
    } catch (e) {
      if (isSilentError(e)) return;
      setNotice(isApiError(e) && e.status === 409 ? LEGACY_MESSAGE : writeErrorMessage(e, 'The PDF could not be downloaded.'));
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="subheading">{formatMonth(p.month)}</AppText>
          <AppText variant="secondary">Net {amount(p.netSalary)} · Gross {amount(p.grossSalary)}</AppText>
        </View>
        <StatusPill status={p.paymentStatus ?? 'Pending'} accessibilityPrefix="Payment" />
      </View>
      {open ? (
        <View>
          <DetailRow label="Basic salary" value={amount(p.basicSalary)} />
          <DetailRow label="HRA" value={amount(p.hra)} />
          <DetailRow label="Conveyance allowance" value={amount(p.conveyanceAllowance)} />
          <DetailRow label="Medical allowance" value={amount(p.medicalAllowance)} />
          <DetailRow label="Other allowances" value={amount(p.otherAllowances)} />
          <DetailRow label="Bonus" value={amount(p.bonus)} />
          <DetailRow label="Overtime" value={`${formatNumber(p.overtimeHours ?? 0)} h × ${amount(p.overtimeRate)} = ${amount(p.overtimePay)}`} />
          <DetailRow label="Reimbursements" value={amount(p.reimbursements)} />
          <Divider />
          <DetailRow label="Provident fund" value={amount(p.providentFund)} />
          <DetailRow label="Professional tax" value={amount(p.professionalTax)} />
          <DetailRow label="Income tax" value={amount(p.incomeTax)} />
          <DetailRow label="Loss of pay" value={amount(p.lossOfPay)} />
          <DetailRow label="Other deductions" value={amount(p.otherDeductions)} />
          <Divider />
          <DetailRow label="Gross salary" value={amount(p.grossSalary)} />
          <DetailRow label="Total deductions" value={amount(p.totalDeductions)} />
          <DetailRow label="Net salary" value={amount(p.netSalary)} />
          <DetailRow label="Payment date" value={p.paymentDate ? formatDateTime(p.paymentDate) : null} />
          <DetailRow label="Issued" value={p.createdAt ? formatDateTime(p.createdAt) : null} />
        </View>
      ) : null}
      <Button label={open ? 'Hide breakdown' : 'Show breakdown'} variant="ghost" onPress={() => setOpen((o) => !o)} />
      {p.fileMigrationRequired ? (
        <AppText variant="secondary" color="warning">{LEGACY_MESSAGE}</AppText>
      ) : p.hasFile ? (
        <Button label="Open / share PDF" icon="share-outline" variant="secondary" onPress={openPdf} accessibilityLabel={`Open payslip PDF for ${formatMonth(p.month)}`} />
      ) : (
        <AppText variant="secondary">No PDF attached.</AppText>
      )}
      {notice ? (
        <AppText variant="secondary" color="danger" accessibilityRole="alert">
          {notice}
        </AppText>
      ) : null}
    </Card>
  );
}

// ---------------- Leave history ----------------

/** /admin/employees/[id]/leaves */
export function EmployeeLeavesScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const name = useEmployeeName(id);
  const leaves = useEmployeeLeaves(id);
  const balance = useLeaveBalance(id);
  const b = balance.data;
  const header = (
    <Card style={{ margin: theme.spacing.lg }}>
      <AppText variant="subheading">Leave balance</AppText>
      {b ? (
        <>
          <DetailRow label="Casual" value={`${formatNumber(b.casual.balance)} left of ${formatNumber(b.casual.total)} (${formatNumber(b.casual.used)} used)`} />
          <DetailRow label="Sick" value={`${formatNumber(b.sick.balance)} left of ${formatNumber(b.sick.total)} (${formatNumber(b.sick.used)} used)`} />
          <DetailRow label="Total" value={`${formatNumber(b.total.balance)} left of ${formatNumber(b.total.total)}`} />
          {b.period?.start ? <AppText variant="caption">Period {formatDate(b.period.start)} – {formatDate(b.period.end)}</AppText> : null}
        </>
      ) : balance.isError ? (
        <AppText variant="secondary" color="danger">Couldn&apos;t load the balance.</AppText>
      ) : (
        <AppText variant="secondary">Loading…</AppText>
      )}
    </Card>
  );
  return (
    <Screen scroll={false}>
      <ScreenTitle title={`${name} · Leave`} />
      <QueryStateView query={leaves}>
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(l) => l._id}
            ListHeaderComponent={header}
            ListEmptyComponent={<AppText variant="secondary" align="center">No leave requests yet.</AppText>}
            ItemSeparatorComponent={() => <Divider inset={theme.spacing.lg} />}
            onRefresh={() => {
              void leaves.refetch();
              void balance.refetch();
            }}
            refreshing={leaves.isRefetching}
            renderItem={({ item: l }) => (
              <ListRow
                left={{ icon: 'airplane-outline' }}
                title={l.leaveType}
                subtitle={`${formatDate(isoToYmd(l.startDate))} – ${formatDate(isoToYmd(l.endDate))} · ${l.days} ${l.days === 1 ? 'day' : 'days'}`}
                meta={l.reason || undefined}
                right={<StatusPill status={l.status} accessibilityPrefix="Leave" />}
                onPress={() => router.push(`/admin/leaves/${l._id}`)}
              />
            )}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
