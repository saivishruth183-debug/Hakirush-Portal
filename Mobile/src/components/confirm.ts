import { Alert } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button (iOS) — use for delete / sign out / irreversible actions. */
  destructive?: boolean;
}

/**
 * Native confirmation dialog. Resolves true on confirm, false on cancel / back / outside tap.
 *   if (await confirm({ title: 'Cancel leave?', confirmLabel: 'Cancel leave', destructive: true })) { ... }
 */
export function confirm({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => done(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => done(true) },
      ],
      { cancelable: true, onDismiss: () => done(false) },
    );
  });
}
