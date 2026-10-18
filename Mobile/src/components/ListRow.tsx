import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';

export type ListRowLeft =
  | { icon: IconName; tone?: 'primary' | 'neutral' | 'danger' }
  | { avatar: { uri?: string | null; name: string; id?: string | null } }
  | ReactNode;

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Third line / extra detail (secondary text). */
  meta?: string;
  /** Leading visual: `{ icon }`, `{ avatar: { uri, name, id } }` or any node. */
  left?: ListRowLeft;
  /** Trailing accessory (e.g. <StatusPill/>). */
  right?: ReactNode;
  /** Show a chevron (default: true when onPress is set and no `right`). */
  chevron?: boolean;
  onPress?: () => void;
  /** Defaults to "title, subtitle, meta". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

function isIconLeft(v: unknown): v is { icon: IconName; tone?: 'primary' | 'neutral' | 'danger' } {
  return !!v && typeof v === 'object' && 'icon' in (v as object);
}
function isAvatarLeft(v: unknown): v is { avatar: { uri?: string | null; name: string; id?: string | null } } {
  return !!v && typeof v === 'object' && 'avatar' in (v as object);
}

/** Tappable list row, ≥56dp tall; text wraps (no truncation). */
export function ListRow({
  title,
  subtitle,
  meta,
  left,
  right,
  chevron,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  destructive,
  disabled,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const showChevron = chevron ?? (!!onPress && !right);
  const label = accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ');

  let leftNode: ReactNode = null;
  if (isIconLeft(left)) {
    const color = left.tone === 'danger' ? 'danger' : left.tone === 'neutral' ? 'textSecondary' : 'primary';
    leftNode = (
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md }]}>
        <Icon name={left.icon} color={color} />
      </View>
    );
  } else if (isAvatarLeft(left)) {
    leftNode = <Avatar uri={left.avatar.uri} name={left.avatar.name} id={left.avatar.id} size={44} />;
  } else if (left) {
    leftNode = left as ReactNode;
  }

  const content = (
    <>
      {leftNode}
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={destructive ? 'danger' : 'text'}>
          {title}
        </AppText>
        {subtitle ? <AppText variant="secondary">{subtitle}</AppText> : null}
        {meta ? <AppText variant="caption">{meta}</AppText> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {showChevron ? <Icon name="chevron-forward" size={20} color="textMuted" /> : null}
    </>
  );

  const rowStyle = [styles.row, { minHeight: 56, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg }];

  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: theme.colors.surfaceAlt }, disabled && { opacity: 0.5 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  right: { flexShrink: 0, maxWidth: '45%' },
});
