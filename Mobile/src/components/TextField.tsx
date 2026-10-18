import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry' | 'editable'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helper?: string;
  /** Error message; shown in red and announced. */
  error?: string | null;
  /** Password field with a show/hide toggle. */
  secure?: boolean;
  multiline?: boolean;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
}

/** Labelled text input with helper/error text, password toggle and multiline support. */
export function TextField({
  label,
  value,
  onChangeText,
  helper,
  error,
  secure = false,
  multiline = false,
  required = false,
  disabled = false,
  containerStyle,
  ref,
  accessibilityHint,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasError = !!error;
  const borderColor = hasError ? colors.danger : focused ? colors.primary : colors.borderStrong;
  const labelText = required ? `${label} (required)` : label;

  return (
    <View style={[styles.container, containerStyle]}>
      <AppText variant="label" color="text" style={styles.label}>
        {labelText}
      </AppText>
      <View
        style={[
          styles.inputRow,
          {
            minHeight: multiline ? 112 : theme.touchTarget,
            borderColor,
            borderWidth: focused || hasError ? 2 : 1,
            borderRadius: theme.radii.md,
            backgroundColor: disabled ? colors.surfaceAlt : colors.surface,
          },
        ]}
      >
        <TextInput
          {...inputProps}
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          secureTextEntry={secure && !revealed}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel={labelText}
          accessibilityHint={error ?? accessibilityHint ?? helper}
          accessibilityState={{ disabled }}
          autoCapitalize={secure ? 'none' : inputProps.autoCapitalize}
          autoCorrect={secure ? false : inputProps.autoCorrect}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[
            styles.input,
            theme.typography.body,
            {
              color: colors.text,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: multiline ? theme.spacing.md : theme.spacing.sm,
            },
          ]}
        />
        {secure ? (
          <IconButton
            icon={revealed ? 'eye-off-outline' : 'eye-outline'}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((r) => !r)}
            color="textSecondary"
          />
        ) : null}
      </View>
      {hasError ? (
        <AppText variant="secondary" color="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="secondary" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {},
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, alignSelf: 'stretch' },
});
