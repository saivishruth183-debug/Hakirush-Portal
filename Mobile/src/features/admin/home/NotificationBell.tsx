import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText, IconButton } from '@/components';
import { fetchNotificationPage } from '@/features/admin/ops/api';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import { useTheme } from '@/theme';

/** Header bell with the unseen count (GET /api/notifications?page=1&limit=1 → unseenCount). */
export function NotificationBell({ polling }: { polling: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const keys = useAdminOpsKeys();
  const q = useQuery({
    queryKey: keys.notificationBadge(),
    queryFn: ({ signal }) => fetchNotificationPage(1, 1, signal),
    select: (d) => d.unseenCount ?? 0,
    refetchInterval: polling ? 60_000 : false,
  });
  const count = q.data ?? 0;
  const label = count ? `Notifications, ${count} unread` : 'Notifications';
  return (
    <View>
      <IconButton
        icon={count ? 'notifications' : 'notifications-outline'}
        accessibilityLabel={label}
        onPress={() => router.push('/admin/notifications')}
        testID="notification-bell"
      />
      {count ? (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            top: 4,
            right: 2,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 10,
            backgroundColor: theme.colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="caption" style={{ color: theme.colors.onDanger, fontWeight: '700' }}>
            {count > 99 ? '99+' : String(count)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
