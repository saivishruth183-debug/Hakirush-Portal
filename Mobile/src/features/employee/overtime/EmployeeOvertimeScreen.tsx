import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  confirm,
  Divider,
  Icon,
  LoadingState,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatusPill,
  TextField,
  toast,
  type StatusPillProps,
} from '@/components';
import { api, getErrorMessage } from '@/services/api';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

import type { OvertimeRequestItem, OvertimeSummaryResponse } from '../types';

function requestStatusTone(status: OvertimeRequestItem['status']): StatusPillProps['tone'] {
  switch (status) {
    case 'Approved':
      return 'success';
    case 'Rejected':
      return 'danger';
    case 'Pending':
    default:
      return 'warning';
  }
}

export function EmployeeOvertimeScreen() {
  const theme = useTheme();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();

  const [modalVisible, setModalVisible] = useState(false);
  const [conversionType, setConversionType] = useState<'Comp-Off' | 'Payout'>('Comp-Off');
  const [hoursToConvert, setHoursToConvert] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const query = useApiQuery<OvertimeSummaryResponse>(keys.overtimeSummary(), '/api/overtime/summary/me');
  const data = query.data;

  const availableHours = data?.availableHours ?? 0;
  const totalEarned = data?.totalEarnedHours ?? 0;
  const claimedHours = data?.claimedHours ?? 0;
  const recentDays = data?.recentOvertimeDays ?? [];
  const requests = data?.requests ?? [];

  const handleOpenModal = () => {
    if (availableHours <= 0) {
      toast.error('You do not have any available overtime hours to convert.');
      return;
    }
    setHoursToConvert(String(Math.min(availableHours, 8)));
    setReason('');
    setModalVisible(true);
  };

  const handleConvertSubmit = async () => {
    const numHours = parseFloat(hoursToConvert);
    if (!numHours || numHours <= 0) {
      toast.error('Please enter a valid number of hours.');
      return;
    }
    if (numHours > availableHours) {
      toast.error(`You can only convert up to ${availableHours} hours.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/overtime/apply', {
        type: conversionType,
        hours: numHours,
        reason: reason.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: keys.overtimeSummary() });
      toast.success(`Request for ${numHours}h ${conversionType} submitted!`);
      setModalVisible(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to submit conversion request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const handleWithdrawRequest = async (request: OvertimeRequestItem) => {
    const confirmed = await confirm({
      title: 'Withdraw Overtime Request?',
      message: `Withdraw your ${request.hours}h ${request.type} request? The hours will be returned to your available overtime balance.`,
      confirmLabel: 'Withdraw',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      setWithdrawingId(request._id);
      await api.delete(`/api/overtime/${request._id}`);
      await queryClient.invalidateQueries({ queryKey: keys.overtimeSummary() });
      toast.success('Overtime request withdrawn successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to withdraw request.'));
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <Screen scroll={true} padded={false}>
      {query.isPending && !data ? (
        <LoadingState label="Loading your overtime records…" />
      ) : (
        <View style={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}>
          {/* KPI Stat Cards */}
          <View style={styles.statsRow}>
            <Card style={[styles.statCard, { borderColor: theme.colors.primary, borderWidth: 1.5 }]}>
              <AppText variant="secondary" style={styles.statLabel}>Available OT</AppText>
              <AppText variant="title" style={{ color: theme.colors.primary, fontSize: 24 }}>
                {availableHours} hrs
              </AppText>
            </Card>
            <Card style={styles.statCard}>
              <AppText variant="secondary" style={styles.statLabel}>Total Earned</AppText>
              <AppText variant="title" style={{ color: theme.colors.text }}>{totalEarned} hrs</AppText>
            </Card>
            <Card style={styles.statCard}>
              <AppText variant="secondary" style={styles.statLabel}>Claimed</AppText>
              <AppText variant="title" style={{ color: theme.colors.textSecondary }}>{claimedHours} hrs</AppText>
            </Card>
          </View>

          <Button
            label="Convert overtime hours"
            icon="swap-horizontal"
            disabled={!canWrite || availableHours <= 0}
            onPress={handleOpenModal}
          />

          {/* Conversion Requests */}
          <SectionHeader
            title="Conversion Requests"
            subtitle="Track your Comp-off and Payout claims"
          />
          <Card padded={false}>
            {requests.length === 0 ? (
              <View style={{ padding: 16 }}>
                <AppText variant="secondary" style={{ textAlign: 'center' }}>
                  No conversion requests submitted yet.
                </AppText>
              </View>
            ) : (
              requests.map((r, i) => (
                <View key={r._id}>
                  {i ? <Divider inset={16} /> : null}
                  <View style={styles.requestRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AppText variant="bodyStrong">{r.type}</AppText>
                        <AppText variant="body" color="primary">{r.hours} hrs</AppText>
                      </View>
                      <AppText variant="caption" color="textSecondary">
                        Applied on {formatDate(r.createdAt)}
                      </AppText>
                      {r.reason ? (
                        <AppText variant="caption" style={{ marginTop: 2 }}>{r.reason}</AppText>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <StatusPill label={r.status} tone={requestStatusTone(r.status)} />
                      {canWrite && r.status === 'Pending' ? (
                        <Pressable
                          onPress={() => handleWithdrawRequest(r)}
                          disabled={withdrawingId === r._id}
                          style={[
                            styles.withdrawBtn,
                            {
                              borderColor: theme.colors.dangerBg,
                              backgroundColor: theme.colors.dangerBg,
                              opacity: withdrawingId === r._id ? 0.6 : 1,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Withdraw request"
                        >
                          <Icon name="trash-outline" size={13} color={theme.colors.danger} />
                          <AppText variant="caption" style={{ color: theme.colors.danger, fontWeight: '600' }}>
                            {withdrawingId === r._id ? 'Withdrawing…' : 'Withdraw'}
                          </AppText>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))
            )}
          </Card>

          {/* Recent OT Earned Days */}
          <SectionHeader
            title="Recent Overtime Days"
            subtitle="Days worked beyond standard 8-hour shift"
          />
          <Card padded={false}>
            {recentDays.length === 0 ? (
              <View style={{ padding: 16 }}>
                <AppText variant="secondary" style={{ textAlign: 'center' }}>
                  No overtime hours logged yet. Extra hours beyond 8h auto-credit on checkout.
                </AppText>
              </View>
            ) : (
              recentDays.map((d, i) => (
                <View key={d.date}>
                  {i ? <Divider inset={16} /> : null}
                  <View style={styles.dayRow}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{formatDate(d.date)}</AppText>
                      <AppText variant="caption" color="textSecondary">
                        {d.checkIn ? `${d.checkIn} - ${d.checkOut || 'Active'}` : 'Recorded'}
                      </AppText>
                    </View>
                    <View style={styles.hoursBadge}>
                      <AppText variant="label" color="primary">+{d.overtimeHours} hrs OT</AppText>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>
      )}

      {/* Conversion Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <AppText variant="title">Convert Overtime</AppText>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <AppText variant="secondary" style={{ marginBottom: 12 }}>
              Convert your accrued overtime hours into Compensatory Off (Comp-off) leave credit or financial OT payout.
            </AppText>

            <SegmentedControl
              accessibilityLabel="Overtime conversion type"
              options={[
                { label: 'Comp-Off Leave', value: 'Comp-Off' },
                { label: 'OT Cash Payout', value: 'Payout' },
              ]}
              value={conversionType}
              onChange={(v) => setConversionType(v as 'Comp-Off' | 'Payout')}
            />

            <View style={{ marginTop: 12 }}>
              <TextField
                label={`Hours to convert (Max: ${availableHours}h) *`}
                value={hoursToConvert}
                onChangeText={setHoursToConvert}
                keyboardType="numeric"
                placeholder="e.g. 8"
              />

              <TextField
                label="Reason / Remarks (Optional)"
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Weekend sprint delivery"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={submitting ? 'Submitting…' : 'Confirm'}
                disabled={submitting}
                onPress={handleConvertSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
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
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  hoursBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FAF5EE',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
});
