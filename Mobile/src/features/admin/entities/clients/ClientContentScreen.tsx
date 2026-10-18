import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  confirm,
  EmptyState,
  FormSection,
  IconButton,
  QueryStateView,
  Screen,
  SegmentedControl,
  TextField,
  toast,
} from '@/components';
import { ScreenTitle } from '@/features/admin/people/common/DetailLoader';
import { FormBanner } from '@/features/admin/people/common/FormBanner';
import { isSilentError, writeErrorMessage } from '@/features/admin/people/common/forms';
import { toUpload } from '@/features/admin/people/api';
import { openAppSettings, pickImage, type PickedFile } from '@/features/shared/media/pickers';
import { api, toFormData } from '@/services/api';
import { useApiMutation, useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';
import type { GalleryImage, PerformanceResponse } from '@/types/api';
import { formatDateTime } from '@/utils/format';

import { useClient } from './ClientScreens';
import { newRow, rowsFromStandings, rowsToPayload, STANDINGS_MAX_ROWS, STATS, validateStandings, type RowErrors, type StandingRow } from './standings';

const enc = encodeURIComponent;
type Tab = 'gallery' | 'standings';

/** /admin/clients/[id]/content — gallery upload/delete + performance standings editor. */
export function ClientContentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const client = useClient(id);
  const [tab, setTab] = useState<Tab>('gallery');
  const switcher = (
    <SegmentedControl<Tab>
      accessibilityLabel="Client content"
      value={tab}
      onChange={setTab}
      options={[
        { label: 'Gallery', value: 'gallery' },
        { label: 'Standings', value: 'standings' },
      ]}
    />
  );
  return (
    <>
      <ScreenTitle title={client.data?.userId?.name ? `${client.data.userId.name} content` : 'Client content'} />
      {tab === 'gallery' ? <Gallery clientId={id} header={switcher} /> : <StandingsLoader clientId={id} header={switcher} />}
    </>
  );
}

function Gallery({ clientId, header }: { clientId: string; header: ReactNode }) {
  const theme = useTheme();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const query = useApiQuery<{ images: GalleryImage[] }, GalleryImage[]>(keys.gallery(clientId), `/api/client/${enc(clientId)}/gallery`, {
    select: (r) => r.images ?? [],
  });
  const [file, setFile] = useState<PickedFile | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const upload = useApiMutation(
    () => api.post(`/api/client/${enc(clientId)}/gallery`, toFormData({ caption: caption.trim() || undefined }, { image: toUpload(file) })),
    { invalidate: [keys.gallery(clientId)] },
  );
  const remove = useApiMutation((imageId: string) => api.delete(`/api/client/${enc(clientId)}/gallery/${enc(imageId)}`), {
    invalidate: [keys.gallery(clientId)],
  });

  const choose = async () => {
    const r = await pickImage();
    if (r.status === 'canceled') return;
    setDenied(r.status === 'denied');
    if (r.status === 'picked') {
      setFile(r.file);
      setError(null);
    } else setError(r.message);
  };

  const submit = async () => {
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    if (caption.trim().length > 200) {
      setError('Captions can be at most 200 characters.');
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync(undefined);
      setFile(null);
      setCaption('');
      toast.success('Image uploaded.');
    } catch (e) {
      if (!isSilentError(e)) setError(writeErrorMessage(e));
    }
  };

  const onDelete = async (img: GalleryImage) => {
    const ok = await confirm({ title: 'Delete this image?', message: 'The client will no longer see it in their gallery.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await remove.mutateAsync(img._id);
      toast.success('Image deleted.');
    } catch (e) {
      if (!isSilentError(e)) setError(writeErrorMessage(e));
    }
  };

  return (
    <Screen onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      {header}
      <FormBanner error={error} offline={!canWrite} actionLabel={denied ? 'Open settings' : undefined} onAction={denied ? () => openAppSettings() : undefined} />
      <Card>
        <AppText variant="subheading">Upload an image</AppText>
        {file ? <Image source={{ uri: file.uri }} style={[styles.preview, { borderRadius: theme.radii.md }]} contentFit="cover" accessibilityLabel="Selected image" /> : null}
        <Button label={file ? 'Choose another image' : 'Choose image'} icon="image-outline" variant="secondary" onPress={choose} disabled={!canWrite} />
        <TextField label="Caption" value={caption} onChangeText={setCaption} maxLength={200} helper="Optional, up to 200 characters." />
        <Button label="Upload" icon="cloud-upload-outline" onPress={submit} disabled={!canWrite || !file} />
      </Card>
      <QueryStateView query={query} isEmpty={(d) => d.length === 0} emptyTitle="No images yet" emptyMessage="Images you upload appear in the client's gallery.">
        {(images) => (
          <View style={{ gap: theme.spacing.md }}>
            {images.map((img) => (
              <Card key={img._id} padded={false}>
                <Image source={{ uri: img.url }} style={[styles.image, { borderTopLeftRadius: theme.radii.lg, borderTopRightRadius: theme.radii.lg }]} contentFit="cover" accessibilityLabel={img.caption || 'Gallery image'} />
                <View style={[styles.row, { padding: theme.spacing.md }]}>
                  <View style={styles.flex}>
                    <AppText variant="body">{img.caption || 'No caption'}</AppText>
                    {img.createdAt ? <AppText variant="caption">Uploaded {formatDateTime(img.createdAt)}</AppText> : null}
                  </View>
                  <IconButton icon="trash-outline" color="danger" accessibilityLabel={`Delete image ${img.caption || ''}`.trim()} onPress={() => onDelete(img)} disabled={!canWrite} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryStateView>
    </Screen>
  );
}

function StandingsLoader({ clientId, header }: { clientId: string; header: ReactNode }) {
  const keys = useQueryKeys();
  const query = useApiQuery<PerformanceResponse>(keys.performance(clientId), `/api/client/${enc(clientId)}/performance`);
  if (!query.data) {
    return (
      <Screen>
        {header}
        <QueryStateView query={query}>{() => null}</QueryStateView>
      </Screen>
    );
  }
  return <StandingsEditor key={query.data.updatedAt ?? 'empty'} clientId={clientId} data={query.data} header={header} />;
}

export function StandingsEditor({ clientId, data, header }: { clientId: string; data: PerformanceResponse; header: ReactNode }) {
  const theme = useTheme();
  const keys = useQueryKeys();
  const { canWrite } = useSession();
  const [rows, setRows] = useState<StandingRow[]>(() => rowsFromStandings(data.standings ?? []));
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const save = useApiMutation((payload: ReturnType<typeof rowsToPayload>) => api.put<PerformanceResponse>(`/api/client/${enc(clientId)}/performance`, { standings: payload }), {
    invalidate: [keys.performance(clientId)],
  });

  const update = (i: number, field: keyof StandingRow, v: string) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: v } : r)));
    setRowErrors((e) => (e[i] ? { ...e, [i]: {} } : e));
  };

  const submit = async () => {
    setFormError(null);
    const errs = validateStandings(rows);
    setRowErrors(errs);
    if (Object.keys(errs).length) {
      setFormError('Fix the highlighted rows before saving.');
      return;
    }
    if (rows.length === 0 && (data.standings?.length ?? 0) > 0) {
      const ok = await confirm({ title: 'Clear the standings table?', message: 'The client will see no standings until you add teams again.', confirmLabel: 'Clear table', destructive: true });
      if (!ok) return;
    }
    try {
      await save.mutateAsync(rowsToPayload(rows));
      toast.success('Standings saved.');
    } catch (e) {
      if (!isSilentError(e)) setFormError(writeErrorMessage(e));
    }
  };

  return (
    <Screen keyboardAvoiding footer={<Button label="Save standings" onPress={submit} disabled={!canWrite} testID="standings-save" />}>
      {header}
      <FormBanner error={formError} offline={!canWrite} />
      <AppText variant="secondary">
        Saving replaces the whole table the client sees.{data.updatedAt ? ` Last saved ${formatDateTime(data.updatedAt)}.` : ''}
      </AppText>
      {rows.length === 0 ? <EmptyState icon="trophy-outline" title="No standings yet" message="Add a row for each team to publish a standings table." /> : null}
      {rows.map((r, i) => {
        const e = rowErrors[i] ?? {};
        return (
          <FormSection key={r.key} title={`Team ${i + 1}`}>
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <View style={styles.flex}>
                <TextField label="Team name" value={r.teamName} onChangeText={(t) => update(i, 'teamName', t)} required error={e.teamName} maxLength={80} />
              </View>
              <IconButton icon="trash-outline" color="danger" accessibilityLabel={`Remove team ${i + 1}`} onPress={() => {
                  setRows((rs) => rs.filter((_, j) => j !== i));
                  setRowErrors({});
                }} />
            </View>
            <View style={[styles.stats, { gap: theme.spacing.sm }]}>
              {STATS.map((s) => (
                <View key={s} style={styles.stat}>
                  <TextField label={s[0].toUpperCase() + s.slice(1)} value={r[s]} onChangeText={(t) => update(i, s, t)} keyboardType="number-pad" error={e[s]} accessibilityLabel={`Team ${i + 1} ${s}`} />
                </View>
              ))}
            </View>
            {e.row ? <AppText variant="secondary" color="danger" accessibilityRole="alert">{e.row}</AppText> : null}
          </FormSection>
        );
      })}
      <Button
        label="Add team"
        icon="add"
        variant="secondary"
        onPress={() => setRows((rs) => [...rs, newRow()])}
        disabled={rows.length >= STANDINGS_MAX_ROWS}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 16 / 9 },
  image: { width: '100%', aspectRatio: 16 / 9 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexBasis: '45%', flexGrow: 1 },
});
