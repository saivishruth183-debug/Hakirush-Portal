import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  LoadingState,
  QueryStateView,
  Screen,
  SectionHeader,
  StatusPill,
} from '@/components';
import { isApiError } from '@/services/api';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { Client, Standing } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

import { useClientAnnouncements, useGallery, useMyClient, usePerformance } from '../api';
import { GalleryThumb } from '../gallery/GalleryThumb';
import { formatAnnouncementDate, isUnread, resolveMediaUrl, sortStandings, standingAccessibilityLabel } from '../utils';

const PREVIEW_COUNT = 6;
const GAP = 8;

/** Client Home: own plan, latest update, gallery preview and performance standings. */
export function ClientHomeScreen() {
  const me = useMyClient();
  const performance = usePerformance();
  const gallery = useGallery();
  const announcements = useClientAnnouncements();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([me.refetch(), performance.refetch(), gallery.refetch(), announcements.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <PlanSection query={me} />
      <LatestUpdateSection query={announcements} />
      <GallerySection query={gallery} />
      <StandingsSection query={performance} />
    </Screen>
  );
}

function PlanSection({ query }: { query: ReturnType<typeof useMyClient> }) {
  if (!query.data && isApiError(query.error) && query.error.status === 404) {
    // No client record linked to this login yet (web: "Access Pending").
    return (
      <Card>
        <EmptyState
          icon="shield-checkmark-outline"
          title="Access pending"
          message="Your company profile hasn't been set up yet. Please contact Hakirush."
        />
      </Card>
    );
  }
  return (
    <QueryStateView query={query} loadingVariant="skeleton" errorTitle="Couldn't load your plan">
      {(data) => <PlanCard client={data.client} />}
    </QueryStateView>
  );
}

export function PlanCard({ client }: { client: Client }) {
  const theme = useTheme();
  const { user } = useSession();
  const name = client.userId?.name || user?.name || 'Your company';
  return (
    <Card testID="plan-card">
      <View style={[styles.row, { gap: theme.spacing.lg }]}>
        <Avatar uri={resolveMediaUrl(client.companyLogo)} name={name} id={client._id} size={64} />
        <View style={styles.flex}>
          <AppText variant="title">{name}</AppText>
          {client.planType ? <Badge label={`${client.planType} plan`} tone="primary" accessibilityPrefix="Plan" /> : null}
        </View>
      </View>
      <View style={[styles.stats, { gap: theme.spacing.md, marginTop: theme.spacing.sm }]}>
        <Stat label="Member since" value={formatDate(client.dateOfJoining)} />
        <Stat label="Budget" value={formatCurrency(client.budget, { whole: true })} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.stat, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md, padding: theme.spacing.md }]}
    >
      <AppText variant="caption">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function LatestUpdateSection({ query }: { query: ReturnType<typeof useClientAnnouncements> }) {
  const router = useRouter();
  const { user } = useSession();
  const list = query.data?.announcements ?? [];
  const latest = list[0];
  const unread = list.filter((a) => isUnread(a, user?._id)).length;
  return (
    <>
      <SectionHeader
        title="Latest update"
        subtitle={unread > 0 ? `${unread} unread` : undefined}
        actionLabel={list.length > 0 ? 'All updates' : undefined}
        onAction={() => router.navigate('/client/updates')}
      />
      {query.data === undefined && query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : query.data === undefined ? (
        <LoadingState variant="skeleton" rows={1} />
      ) : latest ? (
        <Card padded={false}>
          <ListRow
            title={latest.title}
            subtitle={[formatAnnouncementDate(latest.date), latest.venue].filter(Boolean).join(' · ')}
            left={{ icon: 'megaphone-outline' }}
            right={isUnread(latest, user?._id) ? <Badge label="New" tone="primary" /> : undefined}
            chevron
            onPress={() => router.push(`/client/update/${latest._id}`)}
            accessibilityHint="Opens the update"
          />
        </Card>
      ) : (
        <Card>
          <AppText variant="secondary">No updates yet. Announcements from Hakirush will appear here.</AppText>
        </Card>
      )}
    </>
  );
}

function GallerySection({ query }: { query: ReturnType<typeof useGallery> }) {
  const router = useRouter();
  const [width, setWidth] = useState(0);
  const images = query.data?.images ?? [];
  const size = width > 0 ? Math.floor((width - GAP * 2) / 3) : 0;
  return (
    <>
      <SectionHeader
        title="Gallery"
        actionLabel={images.length > 0 ? `See all (${images.length})` : undefined}
        onAction={() => router.push('/client/gallery')}
      />
      <QueryStateView
        query={query}
        isEmpty={(d) => (d.images ?? []).length === 0}
        emptyTitle="No gallery images yet"
        emptyMessage="Photos that Hakirush shares with your company will appear here."
        loadingVariant="skeleton"
      >
        {(data) => (
          <View
            style={[styles.grid, { gap: GAP }]}
            onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
            testID="gallery-preview"
          >
            {size > 0
              ? data.images.slice(0, PREVIEW_COUNT).map((img, index) => (
                  <GalleryThumb
                    key={img._id}
                    testID={`home-gallery-thumb-${index}`}
                    image={img}
                    index={index}
                    total={data.images.length}
                    size={size}
                    onPress={() => router.push(`/client/gallery/${index}`)}
                  />
                ))
              : null}
          </View>
        )}
      </QueryStateView>
    </>
  );
}

function StandingsSection({ query }: { query: ReturnType<typeof usePerformance> }) {
  const updatedAt = query.data?.updatedAt;
  return (
    <>
      <SectionHeader title="Performance" subtitle={updatedAt ? `Standings · Updated ${formatDate(updatedAt)}` : 'Standings'} />
      <QueryStateView
        query={query}
        isEmpty={(d) => (d.standings ?? []).length === 0}
        emptyTitle="No standings published yet"
        emptyMessage="Standings appear here once Hakirush publishes them."
        loadingVariant="skeleton"
      >
        {(data) => (
          <Card padded={false} testID="standings">
            {sortStandings(data.standings).map((row, i) => (
              <StandingRow key={row._id ?? `${row.teamName}-${i}`} row={row} rank={i + 1} last={i === data.standings.length - 1} />
            ))}
          </Card>
        )}
      </QueryStateView>
    </>
  );
}

function StandingRow({ row, rank, last }: { row: Standing; rank: number; last: boolean }) {
  const theme = useTheme();
  const podium = rank <= 3;
  return (
    <View
      accessible
      accessibilityLabel={standingAccessibilityLabel(row, rank)}
      style={[
        styles.row,
        {
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          minHeight: 56,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.rank,
          { backgroundColor: podium ? theme.colors.primarySoft : theme.colors.surfaceAlt, borderRadius: theme.radii.md },
        ]}
      >
        {rank === 1 ? <Icon name="trophy" size={14} color="primary" /> : null}
        <AppText variant="bodyStrong" color={podium ? 'primary' : 'textSecondary'}>
          {rank}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{row.teamName}</AppText>
        <AppText variant="secondary">{`Played ${row.played} · Won ${row.won} · Lost ${row.lost}`}</AppText>
      </View>
      <StatusPill label={`${row.points} pts`} tone="neutral" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexGrow: 1, flexBasis: 140, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  rank: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2, paddingHorizontal: 6 },
});
