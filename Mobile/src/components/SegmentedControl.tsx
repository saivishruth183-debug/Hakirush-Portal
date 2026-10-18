import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Describes the group, e.g. "Leave status filter". */
  accessibilityLabel: string;
}

/** Tab-like switch between 2–4 options. Each segment is ≥48dp tall; labels wrap. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.md, padding: 3 }]}
    >
      {options.map((opt, index) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityLabel={`${opt.label}, ${index + 1} of ${options.length}`}
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              {
                minHeight: theme.touchTarget - 6,
                borderRadius: theme.radii.sm + 2,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderColor: selected ? theme.colors.borderStrong : 'transparent',
              },
            ]}
          >
            <AppText variant="label" align="center" color={selected ? 'primary' : 'textSecondary'}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 6, borderWidth: 1 },
});
