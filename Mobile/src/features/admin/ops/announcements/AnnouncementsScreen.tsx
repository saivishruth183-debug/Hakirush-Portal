import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { AppText, Badge, Button, Card, confirm, IconButton, QueryStateView, Screen, SearchBar, StatusPill, toast } from '@/components';
import { deleteAnnouncement, fetchAnnouncements } from '@/features/admin/ops/api';
import { matchesSearch } from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { AdminAnnouncement } from '@/features/admin/ops/types';
import { getErrorMessage, isApiError } from '@/services/api';
import { useApiMutation } from '@/services/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import { formatDateLong } from '@/utils/format';
import { useQuery } from '@tanstack/react-query';

/** Stored `date` is free text (usually YYYY-MM-DD); show it nicely when it parses. */
export function announcementDateLabel(date: string | undefined): string {
  if (!date) return '—';
  const ymd = /^\d{4}-\d{2}-\d{2}/.exec(date)?.[0];
  return ymd ? formatDateLong(ymd) : date;
}

/** /admin/announcements — list with type/status pills and seen counts; edit, delete, new. */
export function AnnouncementsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { canWrite } = useSession();
  const keys = useAdminOpsKeys();
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: keys.announcements(), queryFn: ({ signal }) => fetchAnnouncements(signal) });
  const remove = useApiMutation((id: string) => deleteAnnouncement(id), { invalidate: [keys.announcementsAll()] });
  const items = useMemo(
    () => (query.data?.announcements ?? []).filter((a) => matchesSearch(search, a.title, a.venue, a.type, a.status)),
    [query.data, search],
  );

  const onDelete = async (a: AdminAnnouncement) => {
    const ok = await confirm({ title: 'Delete announcement?', message: `“${a.title}” will be removed for everyone.`, confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await remove.mutateAsync(a._id);
      toast.success('Announcement deleted.');
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
          <Button label="New announcement" icon="add" onPress={() => router.push('/admin/announcements/new')} disabled={!canWrite} />
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search title, venue, type or status" />
        </View>
      }
    >
      <Stack.Screen options={{ title: 'Announcements' }} />
      <QueryStateView
        query={query}
        isEmpty={(d) => d.announcements.length === 0}
        emptyTitle="No announcements yet"
        emptyMessage="Create one to share events and notices with employees and clients."
      >
        {() => (
          <FlatList
            data={items}
            keyExtractor={(a) => a._id}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            ListEmptyComponent={
              <AppText variant="body" color="textSecondary" align="center">
                No announcements match your search.
              </AppText>
            }
            renderItem={({ item }) => (
              <Card
                onPress={() => router.push(`/admin/announcements/${item._id}/edit`)}
                accessibilityLabel={`${item.title}, ${item.type}, ${item.status}, ${announcementDateLabel(item.date)}, ${item.venue}, seen by ${item.seenBy?.length ?? 0}`}
                accessibilityHint="Opens the announcement for editing"
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceAlt }}
                    contentFit="cover"
                    accessibilityLabel={`Image for ${item.title}`}
                  />
                ) : null}
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <Badge label={item.type} tone="primary" />
                  <StatusPill status={item.status} accessibilityPrefix="Status" />
                </View>
                <AppText variant="heading">{item.title}</AppText>
                <AppText variant="body" color="textSecondary">
                  {item.description}
                </AppText>
                <AppText variant="secondary">
                  {announcementDateLabel(item.date)} · {item.venue}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AppText variant="caption" style={{ flex: 1 }}>
                    Seen by {item.seenBy?.length ?? 0}
                  </AppText>
                  <IconButton icon="trash-outline" color="danger" accessibilityLabel={`Delete ${item.title}`} onPress={() => onDelete(item)} disabled={!canWrite} />
                </View>
              </Card>
            )}
          />
        )}
      </QueryStateView>
    </Screen>
  );
}
