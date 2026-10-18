import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { AppText, Badge, Card, DetailRow, Divider, ListRow, QueryStateView, Screen, StatusPill } from '@/components';
import { api } from '@/services/api';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

import { mediaUrl } from '../format';
import type { AnnouncementItem, AnnouncementsResponse } from '../types';

export function NoticesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const q = useApiQuery<AnnouncementsResponse>(keys.announcements(), '/api/announcements/public');
  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: 'Notices' }} />
      <QueryStateView query={q} isEmpty={(d) => d.announcements.length === 0} emptyTitle="No notices">
        {(d) => (
          <FlatList
            data={d.announcements}
            keyExtractor={(a) => a._id}
            ItemSeparatorComponent={() => <Divider inset={68} />}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void q.refetch()} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
            renderItem={({ item: a }) => (
              <ListRow
                title={a.title}
                subtitle={[a.type, a.date ? formatDate(a.date) : null, a.status].filter(Boolean).join(' · ')}
                meta={a.venue}
                left={{ icon: 'megaphone-outline' }}
                right={a.seen ? undefined : <Badge label="New" tone="primary" />}
                accessibilityLabel={`${a.title}, ${a.status}${a.seen ? '' : ', unread'}`}
                onPress={() => router.push(`/employee/notice/${a._id}`)}
              />
            )}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}

/** GET /api/announcements/:id; marks it read (PUT /:id/read) once when opened. */
export function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();
  const q = useApiQuery<{ announcement: AnnouncementItem }>(keys.announcement(String(id)), `/api/announcements/${id}`);
  const marked = useRef(false);
  const unseen = !!q.data && !q.data.announcement.seen;

  useEffect(() => {
    if (!unseen || !canWrite || marked.current) return;
    marked.current = true;
    api
      .put(`/api/announcements/${id}/read`)
      .then(() => {
        queryClient.setQueryData<AnnouncementsResponse>(keys.announcements(), (old) =>
          old ? { ...old, announcements: old.announcements.map((a) => (a._id === id ? { ...a, seen: true } : a)) } : old,
        );
        queryClient.setQueryData<{ announcement: AnnouncementItem }>(keys.announcement(String(id)), (old) =>
          old ? { announcement: { ...old.announcement, seen: true } } : old,
        );
      })
      .catch(() => {
        marked.current = false;
      });
  }, [unseen, canWrite, id, keys, queryClient]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notice' }} />
      <QueryStateView query={q} errorTitle="Couldn't load this notice">
        {({ announcement: a }) => {
          const img = mediaUrl(a.image);
          return (
            <Card>
              {img ? (
                <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10 }} contentFit="cover" accessibilityLabel={`Image for ${a.title}`} />
              ) : null}
              <AppText variant="title">{a.title}</AppText>
              <StatusPill status={a.status} accessibilityPrefix="Status" />
              <DetailRow label="Type" value={a.type} />
              <DetailRow label="Date" value={a.date ? formatDate(a.date) : ''} />
              <DetailRow label="Venue" value={a.venue} />
              <AppText variant="body" selectable>
                {a.description}
              </AppText>
            </Card>
          );
        }}
      </QueryStateView>
    </Screen>
  );
}
