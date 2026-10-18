import { Stack } from 'expo-router';
import { RefreshControl, SectionList } from 'react-native';

import { AppText, Divider, ListRow, QueryStateView, Screen } from '@/components';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useTheme } from '@/theme';
import { formatDateLong } from '@/utils/format';

import type { HolidaysResponse } from '../types';

/** GET /api/holiday/all grouped into upcoming (soonest first) and past (latest first). */
export function HolidaysScreen() {
  const theme = useTheme();
  const keys = useQueryKeys();
  const q = useApiQuery<HolidaysResponse>(keys.holidays('all'), '/api/holiday/all');
  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: 'Holidays' }} />
      <QueryStateView query={q} isEmpty={(d) => d.holidays.length === 0} emptyTitle="No holidays published yet">
        {(d) => {
          const upcoming = d.holidays.filter((h) => h.status !== 'Past');
          const past = d.holidays.filter((h) => h.status === 'Past').reverse();
          const sections = [
            { title: 'Upcoming', data: upcoming },
            { title: 'Past', data: past },
          ].filter((s) => s.data.length);
          return (
            <SectionList
              sections={sections}
              keyExtractor={(h) => h._id}
              stickySectionHeadersEnabled={false}
              ItemSeparatorComponent={() => <Divider inset={68} />}
              renderSectionHeader={({ section }) => (
                <AppText variant="label" color="textSecondary" accessibilityRole="header" style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xs }}>
                  {section.title}
                </AppText>
              )}
              renderItem={({ item }) => <ListRow title={item.title} subtitle={formatDateLong(item.ymd)} left={{ icon: 'sunny-outline' }} />}
              refreshControl={<RefreshControl refreshing={false} onRefresh={() => void q.refetch()} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
            />
          );
        }}
      </QueryStateView>
    </Screen>
  );
}
