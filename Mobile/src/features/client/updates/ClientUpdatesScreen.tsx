import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, QueryStateView, Screen, StatusPill } from '@/components';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

import { useClientAnnouncements, type ClientAnnouncement } from '../api';
import { formatAnnouncementDate, isUnread } from '../utils';

/** Updates tab: announcements visible to clients (GET /api/announcements/public). */
export function ClientUpdatesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const query = useClientAnnouncements();

  return (
    <Screen scroll={false}>
      <QueryStateView
        query={query}
        isEmpty={(d) => (d.announcements ?? []).length === 0}
        emptyTitle="No updates yet"
        emptyMessage="Announcements from Hakirush will appear here."
        loadingLabel="Loading updates…"
      >
        {(data) => {
          const unread = data.announcements.filter((a) => isUnread(a, user?._id)).length;
          return (
            <FlatList
              data={data.announcements}
              keyExtractor={(a) => a._id}
              contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
              ListHeaderComponent={
                <AppText variant="secondary">
                  {unread > 0 ? `${unread} unread of ${data.announcements.length}` : 'You are all caught up'}
                </AppText>
              }
              refreshControl={
                <RefreshControl
                  refreshing={query.isRefetching}
                  onRefresh={() => void query.refetch()}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                  progressBackgroundColor={theme.colors.surface}
                />
              }
              renderItem={({ item }) => (
                <AnnouncementCard
                  item={item}
                  unread={isUnread(item, user?._id)}
                  onPress={() => router.push(`/client/update/${item._id}`)}
                />
              )}
            />
          );
        }}
      </QueryStateView>
    </Screen>
  );
}

function AnnouncementCard({ item, unread, onPress }: { item: ClientAnnouncement; unread: boolean; onPress: () => void }) {
  const theme = useTheme();
  const date = formatAnnouncementDate(item.date);
  const label = [unread ? 'Unread' : null, item.title, item.status, item.type ? `${item.type}` : null, date, item.venue]
    .filter(Boolean)
    .join(', ');
  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint="Opens the update" testID={`update-${item._id}`}>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {unread ? <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /> : null}
        <AppText variant={unread ? 'heading' : 'subheading'} style={styles.flex}>
          {item.title}
        </AppText>
      </View>
      <View style={[styles.pills, { gap: theme.spacing.sm }]}>
        {unread ? <Badge label="New" tone="primary" /> : null}
        {item.status ? <StatusPill status={item.status} /> : null}
        {item.type ? <Badge label={item.type} tone="neutral" /> : null}
      </View>
      {date || item.venue ? <AppText variant="secondary">{[date, item.venue].filter(Boolean).join(' · ')}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap' },
});
