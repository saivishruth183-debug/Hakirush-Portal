import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Defaults to the placeholder. */
  accessibilityLabel?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  testID?: string;
}

/** Search input with a clear button. Debounce in the caller with useDebouncedValue. */
export function SearchBar({ value, onChangeText, placeholder = 'Search', accessibilityLabel, onSubmit, autoFocus, testID }: SearchBarProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          minHeight: theme.touchTarget,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          borderRadius: theme.radii.pill,
          paddingLeft: theme.spacing.md,
        },
      ]}
    >
      <Icon name="search" size={20} color="textSecondary" />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityRole="search"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        selectionColor={theme.colors.primary}
        style={[styles.input, theme.typography.body, { color: theme.colors.text }]}
      />
      {value ? (
        <IconButton icon="close-circle" accessibilityLabel="Clear search" onPress={() => onChangeText('')} color="textSecondary" size={20} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, gap: 8 },
  input: { flex: 1, paddingVertical: 8 },
});
