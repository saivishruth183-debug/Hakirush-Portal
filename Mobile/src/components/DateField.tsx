import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { businessStringToLocalDate, dateToBusinessString, formatDateLong } from '@/utils/format';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD` or null. */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** `YYYY-MM-DD` bounds (inclusive). */
  minimumDate?: string;
  maximumDate?: string;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Show a "Clear" button when a value is set. */
  clearable?: boolean;
  testID?: string;
}

/**
 * Date input backed by the native picker (@react-native-community/datetimepicker).
 * Android: system dialog (DateTimePickerAndroid.open). iOS: inline calendar in a modal.
 * Values are calendar dates as `YYYY-MM-DD` strings — never Date objects in state.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = 'Select a date',
  helper,
  error,
  required,
  disabled,
  clearable,
  testID,
}: DateFieldProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const current = businessStringToLocalDate(value);
  const min = businessStringToLocalDate(minimumDate) ?? undefined;
  const max = businessStringToLocalDate(maximumDate) ?? undefined;
  const labelText = required ? `${label} (required)` : label;
  const display = value ? formatDateLong(value) : placeholder;

  const open = () => {
    const initial = current ?? clampDate(new Date(), min, max);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onValueChange: (_event, date) => {
          if (date) onChange(dateToBusinessString(date));
        },
      });
    } else {
      setIosDraft(initial);
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.container}>
      <AppText variant="label">{labelText}</AppText>
      <View style={styles.row}>
        <Pressable
          testID={testID}
          disabled={disabled}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${labelText}: ${value ? display : 'not set'}`}
          accessibilityHint={error ?? helper ?? 'Opens a date picker'}
          accessibilityState={{ disabled: !!disabled }}
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
          <Icon name="calendar-outline" size={20} color="textSecondary" />
          <AppText variant="body" color={value ? 'text' : 'textMuted'} style={styles.value}>
            {display}
          </AppText>
        </Pressable>
        {clearable && value && !disabled ? (
          <IconButton icon="close-circle-outline" accessibilityLabel={`Clear ${label}`} onPress={() => onChange(null)} color="textSecondary" />
        ) : null}
      </View>
      {error ? (
        <AppText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="secondary">{helper}</AppText>
      ) : null}

      {Platform.OS !== 'android' ? (
        <Modal visible={iosOpen} animationType="slide" transparent onRequestClose={() => setIosOpen(false)}>
          <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
            <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl }]}>
              <AppText variant="heading" style={{ padding: theme.spacing.lg }}>
                {label}
              </AppText>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                minimumDate={min}
                maximumDate={max}
                onValueChange={(_e, date) => setIosDraft(date)}
              />
              <View style={[styles.sheetActions, { padding: theme.spacing.lg, gap: theme.spacing.md }]}>
                <Button label="Cancel" variant="secondary" onPress={() => setIosOpen(false)} fullWidth={false} />
                <Button
                  label="Done"
                  onPress={() => {
                    onChange(dateToBusinessString(iosDraft));
                    setIosOpen(false);
                  }}
                  fullWidth={false}
                />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function clampDate(d: Date, min?: Date, max?: Date): Date {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1, paddingVertical: 10 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {},
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
