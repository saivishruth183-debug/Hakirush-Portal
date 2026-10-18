import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Stack, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { AppText, Button, Icon, QueryStateView, Screen, toast } from '@/components';
import { fetchNotificationPage, markAllNotificationsSeen, markNotificationSeen } from '@/features/admin/ops/api';
import { LoadMoreFooter } from '@/features/admin/ops/components';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { NotificationsResponse } from '@/features/admin/ops/types';
import { getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { Notification } from '@/types/api';
import { formatDateTime } from '@/utils/format';

const PAGE = 30;

/** Where an admin notification leads (types from leaveController / attendanceRequestController). */
export function notificationTarget(n: Notification): Href | null {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  if (n.type === 'leave-request') {
    const leaveId = str(data.leaveId);
    return leaveId ? `/admin/leaves/${leaveId}` : { pathname: '/admin/requests', params: { segment: 'leave' } };
  }
  if (n.type === 'attendance-request') {
    const requestId = str(data.requestId);
    const employeeId = str(data.employeeId);
    return requestId
      ? { pathname: '/admin/corrections/[id]', params: { id: requestId, ...(employeeId ? { employeeId } : {}) } }
      : { pathname: '/admin/requests', params: { segment: 'corrections' } };
  }
  return null;
}

/** /admin/notifications — own notifications, newest first; tap marks seen and opens the request. */
export function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { canWrite } = useSession();
  const keys = useAdminOpsKeys();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: keys.notificationList(),
    queryFn: ({ pageParam, signal }) => fetchNotificationPage(pageParam, PAGE, signal),
    initialPageParam: 1,
    getNextPageParam: (last: NotificationsResponse) => (last.hasMore ? last.page + 1 : undefined),
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.notifications) ?? [], [query.data]);
  const unseen = query.data?.pages[0]?.unseenCount ?? 0;

  const setSeenLocally = (id: string | null) => {
    queryClient.setQueryData<InfiniteData<NotificationsResponse>>(keys.notificationList(), (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p, i) => ({
              ...p,
              unseenCount: i === 0 ? (id ? Math.max(0, p.unseenCount - 1) : 0) : p.unseenCount,
              notifications: p.notifications.map((n) => (id === null || n._id === id ? { ...n, seen: true } : n)),
            })),
          }
        : old,
    );
  };

  const markOne = useApiMutation((id: string) => markNotificationSeen(id), { invalidate: [keys.notificationBadge()] });
  const markAll = useApiMutation(() => markAllNotificationsSeen(), { invalidate: [keys.notificationsAll()] });

  const open = async (n: Notification) => {
    if (!n.seen && canWrite) {
      setSeenLocally(n._id);
      markOne.mutateAsync(n._id).catch((e) => {
        if (!(isApiError(e) && e.kind === 'cancelled')) void query.refetch();
      });
    }
    const target = notificationTarget(n);
    if (target) router.push(target);
  };

  const onMarkAll = async () => {
    try {
      await markAll.mutateAsync(undefined);
      setSeenLocally(null);
      toast.success('All notifications marked as read.');
    } catch (e) {
      if (!(isApiError(e) && e.kind === 'cancelled')) toast.error(getErrorMessage(e));
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <QueryStateView
        query={query}
        isEmpty={(d) => d.pages.every((p) => p.notifications.length === 0)}
        emptyTitle="No notifications"
        emptyMessage="Leave applications and attendance-correction requests will appear here."
      >
        {() => (
          <FlatList
            data={items}
            keyExtractor={(n) => n._id}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
            refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} />}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingBottom: theme.spacing.sm, flexWrap: 'wrap' }}>
                <AppText variant="secondary" style={{ flex: 1 }}>
                  {unseen ? `${unseen} unread` : 'All caught up'}
                </AppText>
                <Button label="Mark all as read" variant="secondary" fullWidth={false} onPress={onMarkAll} disabled={!unseen || !canWrite} />
              </View>
            }
            renderItem={({ item }) => <NotificationRow n={item} onPress={() => open(item)} />}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
            }}
            ListFooterComponent={
              <LoadMoreFooter hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} onLoadMore={() => query.fetchNextPage()} />
            }
          />
        )}
      </QueryStateView>
    </Screen>
  );
}

function NotificationRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  const theme = useTheme();
  const hasTarget = notificationTarget(n) !== null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.seen ? '' : 'Unread. '}${n.message}. ${formatDateTime(n.createdAt)}`}
      accessibilityHint={hasTarget ? 'Marks as read and opens the request' : 'Marks as read'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        minHeight: theme.touchTarget,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: n.seen ? theme.colors.border : theme.colors.primary,
        backgroundColor: pressed ? theme.colors.surfaceAlt : n.seen ? theme.colors.surface : theme.colors.primarySoft,
      })}
    >
      <Icon name={n.seen ? 'mail-open-outline' : 'mail-unread-outline'} color={n.seen ? 'textSecondary' : 'primary'} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant={n.seen ? 'body' : 'bodyStrong'}>{n.message}</AppText>
        <AppText variant="caption">{formatDateTime(n.createdAt)}</AppText>
      </View>
      {hasTarget ? <Icon name="chevron-forward" size={20} color="textMuted" /> : null}
    </Pressable>
  );
}
