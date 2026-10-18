import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { Badge, Button, Divider, ListRow, QueryStateView, Screen, toast } from '@/components';
import { api, getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { Notification } from '@/types/api';
import { formatDateTime } from '@/utils/format';

import type { NotificationsResponse } from '../types';

export function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const q = useInfiniteQuery({
    queryKey: [...keys.notifications(), 'list'],
    queryFn: ({ pageParam, signal }) =>
      api.get<NotificationsResponse>('/api/notifications', { query: { page: pageParam, limit: 30 }, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const markOne = useApiMutation((id: string) => api.patch(`/api/notifications/${id}/seen`), { invalidate: [keys.notifications()] });
  const markAll = useApiMutation(() => api.patch<{ modified: number }>('/api/notifications/seen-all'), { invalidate: [keys.notifications()] });
  const unseen = q.data?.pages[0]?.unseenCount ?? 0;

  const open = async (n: Notification) => {
    if (!n.seen && canWrite) await markOne.mutateAsync(n._id).catch(() => undefined);
    if (n.type === 'leave-status') {
      const leaveId = typeof n.data?.leaveId === 'string' ? n.data.leaveId : null;
      router.push(leaveId ? `/employee/leave-detail/${leaveId}` : '/employee/leave');
    } else if (n.type === 'attendance-request-status') {
      router.navigate('/employee/attendance');
    }
  };

  const onMarkAll = async () => {
    try {
      await markAll.mutateAsync(undefined);
      toast.success('All notifications marked as read.');
    } catch (e) {
      if (!(isApiError(e) && e.kind === 'cancelled')) toast.error(getErrorMessage(e));
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <QueryStateView query={q} isEmpty={(d) => d.pages.every((p) => p.notifications.length === 0)} emptyTitle="No notifications" emptyMessage="Leave and attendance updates appear here.">
        {(d) => (
          <FlatList
            data={d.pages.flatMap((p) => p.notifications)}
            keyExtractor={(n) => n._id}
            ItemSeparatorComponent={() => <Divider inset={68} />}
            ListHeaderComponent={
              unseen ? (
                <View style={{ padding: theme.spacing.lg }}>
                  <Button label={`Mark all as read (${unseen})`} variant="secondary" disabled={!canWrite} onPress={onMarkAll} />
                </View>
              ) : null
            }
            renderItem={({ item: n }) => (
              <ListRow
                title={n.message}
                subtitle={formatDateTime(n.createdAt)}
                left={{ icon: n.type === 'leave-status' ? 'calendar-outline' : 'time-outline' }}
                right={n.seen ? undefined : <Badge label="New" tone="primary" />}
                accessibilityLabel={`${n.seen ? '' : 'Unread. '}${n.message}`}
                onPress={() => open(n)}
              />
            )}
            onEndReached={() => {
              if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
            }}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={{ padding: 16 }} color={theme.colors.primary} /> : null}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void q.refetch()} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}
