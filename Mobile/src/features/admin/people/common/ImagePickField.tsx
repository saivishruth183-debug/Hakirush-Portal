import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button } from '@/components';
import { openAppSettings, pickImage, type PickedFile } from '@/features/shared/media/pickers';
import { useTheme } from '@/theme';

export interface ImagePickFieldProps {
  label: string;
  /** Name used for the preview's initials fallback and accessibility label. */
  name: string;
  /** Image already stored on the server (shown until a new file is picked). */
  currentUri?: string | null;
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  required?: boolean;
  error?: string | null;
  helper?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Photo/logo field: preview + "Choose image". Uses the shared picker (JPEG ≤ 5 MB, HEIC converted).
 * Cancel does nothing; a permission denial shows a message with an "Open settings" action.
 */
export function ImagePickField({ label, name, currentUri, value, onChange, required, error, helper, disabled, testID }: ImagePickFieldProps) {
  const theme = useTheme();
  const [notice, setNotice] = useState<{ kind: 'denied' | 'error'; message: string } | null>(null);
  const previewUri = value?.uri ?? currentUri ?? null;
  const labelText = required ? `${label} (required)` : label;

  const choose = async () => {
    const result = await pickImage();
    if (result.status === 'canceled') return;
    if (result.status === 'picked') {
      setNotice(null);
      onChange(result.file);
      return;
    }
    setNotice({ kind: result.status, message: result.message });
  };

  return (
    <View style={{ gap: theme.spacing.sm }} testID={testID}>
      <AppText variant="label">{labelText}</AppText>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <Avatar uri={previewUri} name={name || label} size={72} />
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>
          <Button
            label={previewUri ? 'Change image' : 'Choose image'}
            icon="image-outline"
            variant="secondary"
            onPress={choose}
            disabled={disabled}
            accessibilityLabel={`${previewUri ? 'Change' : 'Choose'} ${label.toLowerCase()}`}
          />
          {value ? (
            <Button label="Undo selection" variant="ghost" onPress={() => onChange(null)} disabled={disabled} />
          ) : null}
        </View>
      </View>
      {value ? <AppText variant="caption">New image selected: {value.name}</AppText> : null}
      {notice ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="secondary" color={notice.kind === 'denied' ? 'warning' : 'danger'} accessibilityRole="alert">
            {notice.message}
          </AppText>
          {notice.kind === 'denied' ? (
            <Button label="Open settings" variant="ghost" fullWidth={false} onPress={() => openAppSettings()} />
          ) : null}
        </View>
      ) : null}
      {error ? (
        <AppText variant="secondary" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="secondary">{helper}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flex: 1 },
});
