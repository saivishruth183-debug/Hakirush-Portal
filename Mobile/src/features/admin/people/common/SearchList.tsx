import type { UseQueryResult } from '@tanstack/react-query';
import { useState, type ReactElement, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';

import { Button, Divider, EmptyState, QueryStateView, Screen, SearchBar } from '@/components';
import { useDebouncedValue } from '@/hooks';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

export interface SearchListProps<T> {
  query: UseQueryResult<T[], Error>;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  /** Case-insensitive search over the item (lower-cased query passed). */
  matches: (item: T, q: string) => boolean;
  searchPlaceholder: string;
  /** Extra filter (e.g. Active/Inactive). */
  filter?: (item: T) => boolean;
  /** Rendered above the search bar (segmented controls, filters). */
  headerExtra?: ReactNode;
  /** Rendered between the search bar and the filters/list (filter controls). */
  filters?: ReactNode;
  /** List header (summary) computed from all items. */
  summary?: (items: T[]) => ReactNode;
  emptyTitle: string;
  emptyMessage?: string;
  addLabel?: string;
  onAdd?: () => void;
  testID?: string;
}

/** Searchable FlatList screen (replaces the web tables): search, optional filters, pull to refresh, pinned Add button. */
export function SearchList<T>({
  query,
  keyExtractor,
  renderItem,
  matches,
  searchPlaceholder,
  filter,
  headerExtra,
  filters,
  summary,
  emptyTitle,
  emptyMessage,
  addLabel,
  onAdd,
  testID,
}: SearchListProps<T>) {
  const theme = useTheme();
  const { canWrite } = useSession();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 200).trim().toLowerCase();
  const [pulling, setPulling] = useState(false);

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  return (
    <Screen
      scroll={false}
      testID={testID}
      header={
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
          {headerExtra}
          <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder} />
          {filters}
        </View>
      }
      footer={addLabel && onAdd ? <Button label={addLabel} icon="add" onPress={onAdd} disabled={!canWrite} /> : undefined}
    >
      <QueryStateView
        query={query}
        isEmpty={(d) => d.length === 0}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
      >
        {(items) => {
          const visible = items.filter((i) => (!filter || filter(i)) && (!debounced || matches(i, debounced)));
          return (
            <FlatList
              data={visible}
              keyExtractor={keyExtractor}
              renderItem={({ item }) => renderItem(item)}
              ItemSeparatorComponent={() => <Divider inset={theme.spacing.lg} />}
              ListHeaderComponent={summary ? <View style={{ padding: theme.spacing.lg, paddingBottom: 0 }}>{summary(items)}</View> : null}
              ListEmptyComponent={<EmptyState icon="search" title="No matches" message="Try a different search or filter." />}
              refreshing={pulling}
              onRefresh={refresh}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
            />
          );
        }}
      </QueryStateView>
    </Screen>
  );
}

/** Lower-cased haystack helper for `matches`. */
export function includesAny(q: string, ...values: (string | number | null | undefined)[]): boolean {
  return values.some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
}
