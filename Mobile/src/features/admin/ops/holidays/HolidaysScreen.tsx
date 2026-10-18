import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';

import { AppText, Button, Card, confirm, IconButton, QueryStateView, Screen, SearchBar, StatusPill, toast } from '@/components';
import { deleteHoliday } from '@/features/admin/ops/api';
import { matchesSearch } from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { HolidayItem, HolidaysResponse } from '@/features/admin/ops/types';
import { getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDateLong } from '@/utils/format';

/** /admin/holidays — upcoming and past holidays; add; delete upcoming ones (web parity). */
export function HolidaysScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { canWrite } = useSession();
  const keys = useAdminOpsKeys();
  const [search, setSearch] = useState('');
  const query = useApiQuery<HolidaysResponse>(keys.holidays(), '/api/holiday/all');
  const remove = useApiMutation((id: string) => deleteHoliday(id), { invalidate: [keys.holidays(), keys.attendanceAll(), keys.leavesAll()] });

  const sections = useMemo(() => {
    const list = (query.data?.holidays ?? []).filter((h) => matchesSearch(search, h.title));
    const upcoming = list.filter((h) => h.status === 'Upcoming').sort((a, b) => a.ymd.localeCompare(b.ymd));
    const past = list.filter((h) => h.status !== 'Upcoming').sort((a, b) => b.ymd.localeCompare(a.ymd));
    return [
      { title: `Upcoming (${upcoming.length})`, data: upcoming },
      { title: `Past (${past.length})`, data: past },
    ].filter((s) => s.data.length > 0);
  }, [query.data, search]);

  const onDelete = async (h: HolidayItem) => {
    const ok = await confirm({
      title: 'Delete holiday?',
      message: `${h.title} on ${formatDateLong(h.ymd)} will be removed. That day becomes a working day for attendance and leave.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(h._id);
      toast.success('Holiday deleted.');
    } catch (e) {
      if (!(isApiError(e) && e.kind === 'cancelled')) toast.error(getErrorMessage(e));
    }
  };

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Add holiday" icon="add" onPress={() => router.push('/admin/holidays/new')} disabled={!canWrite} />
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search holidays" />
        </View>
      }
    >
      <Stack.Screen options={{ title: 'Holidays' }} />
      <QueryStateView
        query={query}
        isEmpty={(d) => d.holidays.length === 0}
        emptyTitle="No holidays yet"
        emptyMessage="Add the company holiday calendar so attendance and leave skip those days."
      >
        {() => (
          <SectionList
            sections={sections}
            keyExtractor={(h) => h._id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            renderSectionHeader={({ section }) => (
              <AppText variant="heading" style={{ marginTop: theme.spacing.md }}>
                {section.title}
              </AppText>
            )}
            ListEmptyComponent={
              <AppText variant="body" color="textSecondary" align="center">
                No holidays match your search.
              </AppText>
            }
            renderItem={({ item }) => (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${item.title}, ${formatDateLong(item.ymd)}, ${item.status}`}>
                    <AppText variant="bodyStrong">{item.title}</AppText>
                    <AppText variant="secondary">{formatDateLong(item.ymd)}</AppText>
                    <StatusPill status={item.status} tone={item.status === 'Upcoming' ? 'success' : 'neutral'} />
                  </View>
                  {item.status === 'Upcoming' ? (
                    <IconButton
                      icon="trash-outline"
                      color="danger"
                      accessibilityLabel={`Delete ${item.title}`}
                      onPress={() => onDelete(item)}
                      disabled={!canWrite}
                    />
                  ) : null}
                </View>
              </Card>
            )}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}
