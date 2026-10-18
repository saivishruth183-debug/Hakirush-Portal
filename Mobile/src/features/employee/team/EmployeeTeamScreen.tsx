import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { AppText, Button, Divider, EmptyState, Icon, QueryStateView, Screen, SearchBar } from '@/components';
import { useDebouncedValue } from '@/hooks';
import { api } from '@/services/api';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { TeamResponse } from '@/types/api';

import { PersonRow } from './PersonRow';
import { buildTeamView, type TeamRow } from './teamSections';

export const TEAM_PAGE_SIZE = 50;

/** My team: department heading, manager first, then members (server order), search + pagination. */
export function EmployeeTeamScreen() {
  const { directoryVerified, retryVerification } = useSession();
  if (!directoryVerified) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Connect to load your team"
          message="Your team is shown only after your account is verified with the server. Check your connection and try again."
          actionLabel="Try again"
          onAction={retryVerification}
        />
      </Screen>
    );
  }
  return <TeamDirectory />;
}

function TeamDirectory() {
  const theme = useTheme();
  const keys = useQueryKeys();
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 350);

  const query = useInfiniteQuery({
    queryKey: [...keys.team({ search: term }), 'pages'],
    queryFn: ({ pageParam, signal }) =>
      api.get<TeamResponse>('/api/employee/team/me', {
        query: { search: term || undefined, page: pageParam, limit: TEAM_PAGE_SIZE },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const noDepartment = query.data?.pages[0]?.managerStatus === 'no_department';
  const header =
    query.data && !noDepartment ? (
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search colleagues" accessibilityLabel="Search colleagues by name or designation" />
    ) : null;

  return (
    <Screen scroll={false} padded={false} header={header}>
      <QueryStateView query={query} loadingVariant="skeleton" loadingLabel="Loading your team…">
        {(data) => {
          if (data.pages[0]?.managerStatus === 'no_department') {
            return (
              <EmptyState
                icon="people-outline"
                title="Department not assigned"
                message="You haven't been added to a department yet, so there is no team to show. Contact HR to be assigned."
              />
            );
          }
          const view = buildTeamView(data.pages, user?._id, term);
          const renderItem = ({ item }: { item: TeamRow }) => {
            if (item.kind === 'person') return <PersonRow person={item.person} isManager={item.isManager} isSelf={item.isSelf} />;
            if (item.kind === 'unassigned') {
              return (
                <View style={[styles.notice, { padding: theme.spacing.lg, gap: theme.spacing.md }]} accessible>
                  <Icon name="person-outline" color="textSecondary" />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">Manager not assigned</AppText>
                    <AppText variant="secondary">Your department doesn&apos;t have a manager assigned yet.</AppText>
                  </View>
                </View>
              );
            }
            return (
              <AppText variant="body" color="textSecondary" style={{ padding: theme.spacing.lg }}>
                {item.message}
              </AppText>
            );
          };
          return (
            <SectionList
              testID="team-list"
              sections={view.sections}
              keyExtractor={(row) => row.key}
              renderItem={renderItem}
              stickySectionHeadersEnabled={false}
              ItemSeparatorComponent={() => <Divider inset={72} />}
              ListHeaderComponent={
                <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: 2 }}>
                  <AppText variant="title">{view.department ? `${view.department.name} team` : 'My team'}</AppText>
                  <AppText variant="secondary">
                    {view.totalMembers === 1 ? '1 person' : `${view.totalMembers} people`}
                    {query.isPlaceholderData ? ' · Searching…' : ''}
                  </AppText>
                </View>
              }
              renderSectionHeader={({ section }) => (
                <AppText
                  variant="label"
                  color="textSecondary"
                  accessibilityRole="header"
                  style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.xs }}
                >
                  {section.key === 'members' && term ? `${section.title} · ${view.matchedMembers} found` : section.title}
                </AppText>
              )}
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) void query.fetchNextPage();
              }}
              ListFooterComponent={
                query.isFetchingNextPage ? (
                  <ActivityIndicator style={{ padding: theme.spacing.lg }} color={theme.colors.primary} accessibilityLabel="Loading more colleagues" />
                ) : query.isFetchNextPageError ? (
                  <View style={{ padding: theme.spacing.lg }}>
                    <Button label="Couldn't load more. Try again" variant="secondary" onPress={() => query.fetchNextPage()} />
                  </View>
                ) : (
                  <View style={{ height: theme.spacing.xl }} />
                )
              }
              refreshControl={
                <RefreshControl
                  refreshing={query.isRefetching && !query.isFetchingNextPage && !query.isPlaceholderData}
                  onRefresh={() => void query.refetch()}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          );
        }}
      </QueryStateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
