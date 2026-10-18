import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Divider } from './Divider';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { SearchBar } from './SearchBar';

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
  /** Optional second line. */
  description?: string;
}

export interface SelectFieldProps<T extends string | number> {
  label: string;
  value: T | null | undefined;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Show a search box in the picker (default: automatically when more than 8 options). */
  searchable?: boolean;
  testID?: string;
}

/** Field that opens a native full-screen Modal list (with search for long lists). Android back closes it. */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  helper,
  error,
  required,
  disabled,
  searchable,
  testID,
}: SelectFieldProps<T>) {
  const theme = useTheme();
  const { colors } = theme;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 8;
  const labelText = required ? `${label} (required)` : label;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <AppText variant="label">{labelText}</AppText>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${labelText}: ${selected ? selected.label : 'not selected'}`}
        accessibilityHint={error ?? helper ?? 'Opens a list of options'}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        style={[
          styles.field,
          {
            minHeight: theme.touchTarget,
            borderRadius: theme.radii.md,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderWidth: error ? 2 : 1,
            backgroundColor: disabled ? colors.surfaceAlt : colors.surface,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        <AppText variant="body" color={selected ? 'text' : 'textMuted'} style={styles.value}>
          {selected ? selected.label : placeholder}
        </AppText>
        <Icon name="chevron-down" size={20} color="textSecondary" />
      </Pressable>
      {error ? (
        <AppText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="secondary">{helper}</AppText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { paddingHorizontal: theme.spacing.sm }]}>
            <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
            <AppText variant="heading" style={styles.modalTitle}>
              {label}
            </AppText>
          </View>
          {showSearch ? (
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
              <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}`} autoFocus />
            </View>
          ) : null}
          <FlatList
            data={filtered as SelectOption<T>[]}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <Divider inset={theme.spacing.lg} />}
            ListEmptyComponent={<EmptyState title="No matches" message="Try a different search." icon="search" />}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.description ? `${item.label}, ${item.description}` : item.label}
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      minHeight: 56,
                      paddingHorizontal: theme.spacing.lg,
                      backgroundColor: pressed ? colors.surfaceAlt : isSelected ? colors.primarySoft : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.optionText}>
                    <AppText variant={isSelected ? 'bodyStrong' : 'body'}>{item.label}</AppText>
                    {item.description ? <AppText variant="secondary">{item.description}</AppText> : null}
                  </View>
                  {isSelected ? <Icon name="checkmark" color="primary" /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1, paddingVertical: 10 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56 },
  modalTitle: { flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  optionText: { flex: 1, gap: 2 },
});
