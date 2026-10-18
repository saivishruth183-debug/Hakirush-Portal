import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  confirm,
  Divider,
  EmptyState,
  ErrorState,
  FormSection,
  IconButton,
  ListRow,
  LoadingState,
  Screen,
  SectionHeader,
  SelectField,
  TextField,
  useToast,
  type SelectOption,
} from '@/components';
import { getErrorMessage, isApiError } from '@/services/api';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { RosterEntry } from '@/types/api';
import { formatDateTime } from '@/utils/format';

import {
  JERSEY_SIZE_LABELS,
  JERSEY_SIZES,
  ROSTER_MAX_ENTRIES,
  ROSTER_NAME_MAX,
  useAddRosterEntry,
  useDeleteRosterEntry,
  useRoster,
  type JerseySizeValue,
} from '../api';
import { countBySize, rosterErrorFromServer, validateRosterEntry, type RosterFormErrors } from '../utils';

const SIZE_OPTIONS: SelectOption<JerseySizeValue>[] = JERSEY_SIZES.map((s) => ({ value: s, label: JERSEY_SIZE_LABELS[s] }));

/** Relationship tab: roster & apparel (GET/POST/DELETE /api/client/me/roster). */
export function ClientRelationshipScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { canWrite } = useSession();
  const query = useRoster();
  const del = useDeleteRosterEntry();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const entries = query.data?.entries ?? [];

  const remove = async (entry: RosterEntry) => {
    if (deletingId) return;
    const ok = await confirm({
      title: 'Remove from roster?',
      message: `${entry.name} (size ${entry.jerseySize}) will be removed from your roster.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(entry._id);
    try {
      await del.mutateAsync(entry._id);
      toast.success(`${entry.name} removed from the roster.`);
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      if (isApiError(e) && e.status === 404) {
        toast.info('That person was already removed.');
        void query.refetch();
      } else {
        toast.error(getErrorMessage(e, "Couldn't remove this roster entry."));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const header = (
    <View style={{ gap: theme.spacing.md }}>
      <RosterForm count={entries.length} canWrite={canWrite} />
      {query.data && entries.length > 0 ? <SizeSummary entries={entries} /> : null}
      <SectionHeader title={`Roster (${entries.length})`} subtitle="Saved to your account" />
    </View>
  );

  let listEmpty;
  if (query.data) {
    listEmpty = (
      <EmptyState icon="shirt-outline" title="No one on the roster yet" message="Add people above with their jersey size." />
    );
  } else if (query.isError) {
    listEmpty = <ErrorState error={query.error} title="Couldn't load your roster" onRetry={() => query.refetch()} />;
  } else if (query.fetchStatus === 'paused') {
    listEmpty = (
      <EmptyState
        icon="cloud-offline-outline"
        title="You're offline"
        message="Connect to the internet to load your roster."
        actionLabel="Try again"
        onAction={() => query.refetch()}
      />
    );
  } else {
    listEmpty = <LoadingState label="Loading roster…" />;
  }

  return (
    <Screen scroll={false} keyboardAvoiding>
      <FlatList
        data={entries}
        keyExtractor={(e) => e._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.spacing.lg, gap: 0 }}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        ItemSeparatorComponent={() => <Divider inset={theme.spacing.lg} />}
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
          <View style={{ backgroundColor: theme.colors.surface }}>
            <ListRow
              testID={`roster-row-${item._id}`}
              title={item.name}
              subtitle={`Jersey size: ${item.jerseySize}`}
              meta={item.createdAt ? `Added ${formatDateTime(item.createdAt)}` : undefined}
              left={{ icon: 'shirt-outline' }}
              right={
                <IconButton
                  icon="trash-outline"
                  accessibilityLabel={`Remove ${item.name}`}
                  color="danger"
                  onPress={() => remove(item)}
                  loading={deletingId === item._id}
                  disabled={!canWrite || (!!deletingId && deletingId !== item._id)}
                />
              }
            />
          </View>
        )}
      />
    </Screen>
  );
}

function RosterForm({ count, canWrite }: { count: number; canWrite: boolean }) {
  const toast = useToast();
  const add = useAddRosterEntry();
  const [name, setName] = useState('');
  const [jerseySize, setJerseySize] = useState<JerseySizeValue | null>(null);
  const [errors, setErrors] = useState<RosterFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const full = count >= ROSTER_MAX_ENTRIES;

  const submit = async () => {
    setFormError(null);
    const v = validateRosterEntry({ name, jerseySize });
    setErrors(v);
    if (Object.keys(v).length || !jerseySize) return;
    try {
      const res = await add.mutateAsync({ name: name.trim(), jerseySize });
      setName('');
      setJerseySize(null);
      toast.success(`${res.entry?.name ?? name.trim()} added to the roster.`);
    } catch (e) {
      if (isApiError(e) && e.kind === 'cancelled') return;
      // Keep what was typed so the user can fix it and retry.
      const mapped = rosterErrorFromServer(e);
      setErrors(mapped.fields);
      setFormError(mapped.form);
    }
  };

  return (
    <Card>
      <FormSection title="Add to roster" description="Names and jersey sizes for apparel orders.">
        {!canWrite ? (
          <AppText variant="secondary" color="warning">
            You are offline. Connect to the internet to change your roster.
          </AppText>
        ) : null}
        {full ? (
          <AppText variant="secondary" color="warning">
            {`Your roster is full (${ROSTER_MAX_ENTRIES} people). Remove someone to add more.`}
          </AppText>
        ) : null}
        {formError ? (
          <AppText variant="body" color="danger" accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {formError}
          </AppText>
        ) : null}
        <TextField
          label="Name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          placeholder="e.g. Priya Sharma"
          autoCapitalize="words"
          autoComplete="off"
          maxLength={ROSTER_NAME_MAX + 20}
          helper={`Up to ${ROSTER_NAME_MAX} characters.`}
          error={errors.name}
          required
          testID="roster-name"
        />
        <SelectField
          label="Jersey size"
          value={jerseySize}
          options={SIZE_OPTIONS}
          onChange={(v) => {
            setJerseySize(v);
            if (errors.jerseySize) setErrors((prev) => ({ ...prev, jerseySize: undefined }));
          }}
          placeholder="Select size"
          error={errors.jerseySize}
          required
          testID="roster-size"
        />
        <Button
          label="Add to roster"
          icon="add-circle-outline"
          onPress={submit}
          loading={add.isPending}
          disabled={!canWrite || full}
          testID="roster-submit"
        />
      </FormSection>
    </Card>
  );
}

function SizeSummary({ entries }: { entries: RosterEntry[] }) {
  const theme = useTheme();
  const counts = countBySize(entries);
  const label = `Jersey sizes for ordering: ${JERSEY_SIZES.map((s) => `${s} ${counts[s]}`).join(', ')}${
    counts.other ? `, other ${counts.other}` : ''
  }. Total ${counts.total}.`;
  return (
    <Card testID="size-summary">
      <AppText variant="heading">Apparel summary</AppText>
      <View accessible accessibilityLabel={label} style={[styles.sizes, { gap: theme.spacing.sm }]}>
        {JERSEY_SIZES.map((s) => (
          <View
            key={s}
            style={[styles.size, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md, padding: theme.spacing.sm }]}
          >
            <AppText variant="label">{s}</AppText>
            <AppText variant="title">{String(counts[s])}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="secondary">{`Total ${counts.total}${counts.other ? ` (${counts.other} with another size)` : ''}`}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  sizes: { flexDirection: 'row', flexWrap: 'wrap' },
  size: { minWidth: 64, flexGrow: 1, alignItems: 'center' },
});
