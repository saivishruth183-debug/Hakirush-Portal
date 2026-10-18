import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ErrorState, LoadingState, StatusPill } from '@/components';
import { useNow } from '@/hooks';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useTheme } from '@/theme';
import type { AttendanceAction } from '@/types/api';
import { computeClockOffset, computeWorkedMs } from '@/utils/attendanceTimer';
import { durationAccessibilityLabel, formatDateLong, formatDurationHMS, formatTime } from '@/utils/format';

import { weekdayOf } from '../format';
import type { HolidaysResponse } from '../types';
import { ACTION_LABELS, useTodayAttendance } from './useTodayAttendance';

const PHASE_LABEL = { notStarted: 'Not checked in', working: 'Working', paused: 'On a break', finished: 'Checked out' } as const;

/** Today's attendance with the check-in / pause / resume / check-out actions (server-derived timer). */
export function TodayAttendanceCard() {
  const theme = useTheme();
  const keys = useQueryKeys();
  const t = useTodayAttendance();
  const holidays = useApiQuery<HolidaysResponse>(keys.holidays('upcoming'), '/api/holiday/upcoming');
  const ticking = t.phase === 'working' || t.phase === 'paused';
  const now = useNow(1000, ticking);

  if (!t.data) {
    return (
      <Card>
        <AppText variant="heading">Today</AppText>
        {t.query.isError ? (
          <ErrorState error={t.query.error} onRetry={t.recheck} />
        ) : (
          <LoadingState label="Loading today's attendance…" />
        )}
      </Card>
    );
  }

  const { attendance, businessDate, timezone, serverTime } = t.data;
  const offset = computeClockOffset(serverTime, t.query.dataUpdatedAt);
  const workedMs = computeWorkedMs(attendance, offset, ticking ? now : t.query.dataUpdatedAt);
  const holidayToday = holidays.data?.holidays.find((h) => h.ymd === businessDate);
  const wd = weekdayOf(businessDate);
  const offDayReason = holidayToday ? holidayToday.title : wd === 0 ? 'Sunday' : wd === 6 ? 'Saturday' : null;
  const checkInBlocked = t.phase === 'notStarted' && !!offDayReason;
  const statusLabel = t.phase === 'finished' && attendance?.status ? attendance.status : PHASE_LABEL[t.phase];
  const disabled = !t.canWrite || t.mutating || t.reconciling;

  return (
    <Card testID="today-attendance">
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="heading">Today</AppText>
          <AppText variant="secondary">
            {formatDateLong(businessDate)} · {timezone}
          </AppText>
        </View>
        <StatusPill status={t.phase === 'working' ? 'Working' : t.phase === 'paused' ? 'Paused' : statusLabel} label={statusLabel} accessibilityPrefix="Attendance" />
      </View>
      <AppText variant="display" accessibilityLabel={`Worked ${durationAccessibilityLabel(workedMs)}`}>
        {formatDurationHMS(workedMs)}
      </AppText>
      <AppText variant="secondary">
        Check in {formatTime(attendance?.checkIn)} · Check out {formatTime(attendance?.checkOut)}
        {attendance?.isPaused && attendance.pauseStartedAt ? ` · Break since ${formatTime(attendance.pauseStartedAt)}` : ''}
      </AppText>

      {checkInBlocked ? (
        <AppText variant="body" color="textSecondary">
          Today is {offDayReason}. Check-in isn&apos;t available on weekends and holidays.
        </AppText>
      ) : null}
      {t.reconciling ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="secondary" color="warning" accessibilityLiveRegion="polite">
            Checking your latest attendance before allowing another change…
          </AppText>
          {t.query.isError ? <Button label="Check again" variant="secondary" onPress={t.recheck} icon="refresh" /> : null}
        </View>
      ) : null}
      {!t.canWrite ? (
        <AppText variant="secondary" color="warning">
          Attendance changes are paused until you are back online.
        </AppText>
      ) : null}
      {t.phase === 'finished' ? (
        <AppText variant="secondary">You have checked out for today. See your history in the Attendance tab.</AppText>
      ) : null}

      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        {t.actions
          .filter((a: AttendanceAction) => !(a === 'check-in' && checkInBlocked))
          .map((a) => (
            <View key={a} style={styles.flex}>
              <Button
                testID={`attendance-${a}`}
                label={ACTION_LABELS[a]}
                variant={a === 'check-out' ? 'secondary' : a === 'pause' ? 'secondary' : 'primary'}
                icon={a === 'check-in' ? 'play' : a === 'pause' ? 'cafe-outline' : a === 'resume' ? 'play' : 'stop'}
                loading={t.busyAction === a}
                disabled={disabled}
                onPress={() => t.run(a)}
              />
            </View>
          ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
