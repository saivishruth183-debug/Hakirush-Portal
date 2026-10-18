import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, DetailRow, EmptyState, QueryStateView, Screen, StatusPill } from '@/components';
import { isApiError } from '@/services/api';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

import { useAnnouncement, useMarkAnnouncementRead, type ClientAnnouncement } from '../api';
import { formatAnnouncementDate, isUnread, resolveMediaUrl } from '../utils';

/** /client/update/[id] — one announcement; marks it read for this user when opened. */
export function UpdateDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const { user, canWrite } = useSession();
  const query = useAnnouncement(id);
  const markRead = useMarkAnnouncementRead();
  const requested = useRef<string | null>(null);
  const announcement = query.data?.announcement;
  const unread = announcement ? isUnread(announcement, user?._id) : false;

  useEffect(() => {
    if (!announcement || !unread || !canWrite || requested.current === announcement._id) return;
    requested.current = announcement._id;
    markRead.mutate(announcement._id, {
      onError: () => {
        // Allow another attempt (e.g. after reconnecting); nothing to show the user.
        requested.current = null;
      },
    });
  }, [announcement, unread, canWrite, markRead]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/client/updates');
  };

  const notFound = !query.data && isApiError(query.error) && (query.error.status === 404 || query.error.code === 'INVALID_ID');

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ title: 'Update' }} />
      {notFound ? (
        <EmptyState
          icon="megaphone-outline"
          title="This update is no longer available"
          message="It may have been completed or removed."
          actionLabel="Back to updates"
          onAction={goBack}
        />
      ) : (
        <QueryStateView query={query} loadingLabel="Loading update…">
          {(data) => <UpdateBody announcement={data.announcement} />}
        </QueryStateView>
      )}
    </Screen>
  );
}

function UpdateBody({ announcement: a }: { announcement: ClientAnnouncement }) {
  const theme = useTheme();
  const image = resolveMediaUrl(a.image);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <>
      {image && failed !== image ? (
        <View style={[styles.imageWrap, { borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt }]}>
          <Image
            source={{ uri: image }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            accessible
            accessibilityLabel={`Image for ${a.title}`}
            onError={() => setFailed(image)}
          />
        </View>
      ) : null}
      <AppText variant="title">{a.title}</AppText>
      <View style={[styles.pills, { gap: theme.spacing.sm }]}>
        {a.status ? <StatusPill status={a.status} accessibilityPrefix="Status" /> : null}
        {a.type ? <Badge label={a.type} tone="neutral" accessibilityPrefix="Type" /> : null}
      </View>
      <Card>
        <DetailRow label="Date" value={formatAnnouncementDate(a.date)} />
        <DetailRow label="Venue" value={a.venue} />
      </Card>
      <Card>
        <AppText variant="body" selectable>
          {a.description}
        </AppText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  imageWrap: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  pills: { flexDirection: 'row', flexWrap: 'wrap' },
});
