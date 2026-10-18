import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { toneColors, useTheme, type StatusTone } from '@/theme';

import { AppText } from './AppText';

const TONE_BY_STATUS: Record<string, StatusTone> = {
  present: 'success',
  approved: 'success',
  paid: 'success',
  active: 'success',
  completed: 'success',
  assigned: 'success',
  pending: 'warning',
  'half day': 'warning',
  upcoming: 'info',
  ongoing: 'info',
  working: 'info',
  paused: 'warning',
  absent: 'danger',
  rejected: 'danger',
  inactive: 'danger',
  failed: 'danger',
  leave: 'neutral',
  cancelled: 'neutral',
  unassigned: 'neutral',
};

/** Maps a backend status string (case-insensitive) to a tone. Unknown → neutral. */
export function statusTone(status: string | null | undefined): StatusTone {
  return TONE_BY_STATUS[(status ?? '').trim().toLowerCase()] ?? 'neutral';
}

export interface StatusPillProps {
  /** Backend status, e.g. "Approved", "Half Day". Used for the tone and default label. */
  status?: string | null;
  /** Visible text (defaults to `status`). */
  label?: string;
  /** Override the automatic tone. */
  tone?: StatusTone;
  /** Extra context for screen readers, e.g. "Leave status". */
  accessibilityPrefix?: string;
  style?: StyleProp<ViewStyle>;
}

/** Coloured status chip. Colour is never the only signal: the text label is always shown. */
export function StatusPill({ status, label, tone, accessibilityPrefix, style }: StatusPillProps) {
  const theme = useTheme();
  const t = tone ?? statusTone(status);
  const { fg, bg } = toneColors(theme.colors, t);
  const text = label ?? status ?? '—';
  return (
    <View
      accessible
      accessibilityLabel={accessibilityPrefix ? `${accessibilityPrefix}: ${text}` : text}
      style={[styles.pill, { backgroundColor: bg, borderRadius: theme.radii.pill }, style]}
    >
      <AppText variant="label" style={{ color: fg }}>
        {text}
      </AppText>
    </View>
  );
}

/** Generic badge = StatusPill with an explicit tone. */
export function Badge(props: Omit<StatusPillProps, 'status'> & { label: string; tone?: StatusTone }) {
  return <StatusPill {...props} tone={props.tone ?? 'neutral'} />;
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3 },
});
