/** Small UI pieces shared by the admin operations screens (theme tokens only, ≥48dp targets). */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, type IconName } from '@/components';
import { toneColors, useTheme, type StatusTone } from '@/theme';
import { formatNumber } from '@/utils/format';

// ---------- Filter chips (horizontal, for > 4 options) ----------
export interface ChipOption<T extends string> {
  label: string;
  value: T;
  count?: number;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const label = o.count !== undefined ? `${o.label} (${o.count})` : o.label;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityLabel={`${label} filter`}
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                minHeight: theme.touchTarget,
                borderRadius: theme.radii.pill,
                paddingHorizontal: theme.spacing.lg,
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
              },
            ]}
          >
            <AppText variant="label" color={selected ? 'primary' : 'textSecondary'}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------- Stat tile ----------
export function StatTile({
  label,
  value,
  icon,
  tone = 'primary',
  onPress,
  hint,
}: {
  label: string;
  value: number | string | null | undefined;
  icon: IconName;
  tone?: StatusTone;
  onPress?: () => void;
  hint?: string;
}) {
  const theme = useTheme();
  const { fg, bg } = toneColors(theme.colors, tone);
  const shown = typeof value === 'number' ? formatNumber(value) : (value ?? '—');
  return (
    <Card
      style={styles.tile}
      onPress={onPress}
      accessibilityLabel={`${label}: ${shown}`}
      accessibilityHint={hint}
    >
      <View style={[styles.tileIcon, { backgroundColor: bg, borderRadius: theme.radii.md }]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <AppText variant="title">{shown}</AppText>
      <AppText variant="secondary">{label}</AppText>
    </Card>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.grid, { gap: theme.spacing.md }]}>{children}</View>;
}

// ---------- Horizontal bar chart (plain Views, accessible text values) ----------
export interface BarDatum {
  label: string;
  value: number;
  tone?: StatusTone;
}

const DEFAULT_TONES: StatusTone[] = ['primary', 'info', 'success', 'warning', 'neutral', 'danger'];

export function BarChart({ title, subtitle, data, unit }: { title: string; subtitle?: string; data: BarDatum[]; unit: string }) {
  const theme = useTheme();
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  return (
    <Card>
      <AppText variant="heading">{title}</AppText>
      {subtitle ? <AppText variant="secondary">{subtitle}</AppText> : null}
      {data.length === 0 || total === 0 ? (
        <AppText variant="secondary" color="textMuted">
          No data yet.
        </AppText>
      ) : (
        <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
          {data.map((d, i) => {
            const { fg } = toneColors(theme.colors, d.tone ?? DEFAULT_TONES[i % DEFAULT_TONES.length]);
            const pct = total ? Math.round((d.value / total) * 100) : 0;
            const width = `${Math.max(2, (d.value / max) * 100)}%` as const;
            return (
              <View
                key={`${d.label}-${i}`}
                accessible
                accessibilityLabel={`${d.label}: ${formatNumber(d.value)} ${unit}, ${pct} percent`}
                style={{ gap: theme.spacing.xs }}
              >
                <View style={styles.barLabelRow}>
                  <AppText variant="body" style={styles.flex}>
                    {d.label}
                  </AppText>
                  <AppText variant="bodyStrong">
                    {formatNumber(d.value)} <AppText variant="secondary">({pct}%)</AppText>
                  </AppText>
                </View>
                <View style={[styles.barTrack, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.pill }]}>
                  <View style={[styles.barFill, { width, backgroundColor: fg, borderRadius: theme.radii.pill }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ---------- Pagination footer ----------
export function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  note,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => unknown;
  note?: string;
}) {
  const theme = useTheme();
  if (!hasNextPage && !note) return <View style={{ height: theme.spacing.xl }} />;
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm, alignItems: 'center' }}>
      {note ? (
        <AppText variant="caption" align="center">
          {note}
        </AppText>
      ) : null}
      {isFetchingNextPage ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Loading more" />
      ) : hasNextPage ? (
        <Button label="Load more" variant="secondary" fullWidth={false} onPress={onLoadMore} />
      ) : null}
    </View>
  );
}

export function InlineNotice({ message, tone = 'info', icon = 'information-circle-outline' }: { message: string; tone?: StatusTone; icon?: IconName }) {
  const theme = useTheme();
  const { fg, bg } = toneColors(theme.colors, tone);
  return (
    <View
      accessible
      accessibilityLabel={message}
      style={[styles.notice, { backgroundColor: bg, borderRadius: theme.radii.md, padding: theme.spacing.md, gap: theme.spacing.sm }]}
    >
      <Icon name={icon} size={20} color={fg} />
      <AppText variant="secondary" style={[styles.flex, { color: fg }]}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chip: { borderWidth: 1, justifyContent: 'center' },
  tile: { flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: 4 },
  tileIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  barLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  barTrack: { height: 12, width: '100%', overflow: 'hidden' },
  barFill: { height: 12 },
  notice: { flexDirection: 'row', alignItems: 'flex-start' },
});
