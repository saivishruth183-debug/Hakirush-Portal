import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toneColors, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** ms; default 4000 (6000 when there is an action). */
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let imperative: ToastApi | null = null;

/** Imperative access for non-React code (no-op before the provider mounts). */
export const toast: ToastApi = {
  show: (o) => imperative?.show(o),
  success: (m) => imperative?.success(m),
  error: (m) => imperative?.error(m),
  info: (m) => imperative?.info(m),
  hide: () => imperative?.hide(),
};

const ICONS: Record<ToastTone, IconName> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

/** Bottom snackbar. Mount once near the root (done in src/app/_layout.tsx). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      seq.current += 1;
      setCurrent({ ...opts, id: seq.current });
      AccessibilityInfo.announceForAccessibility(opts.message);
      timer.current = setTimeout(hide, opts.duration ?? (opts.actionLabel ? 6000 : 4000));
    },
    [hide],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      hide,
      success: (message) => show({ message, tone: 'success' }),
      error: (message) => show({ message, tone: 'error' }),
      info: (message) => show({ message, tone: 'info' }),
    }),
    [show, hide],
  );

  useEffect(() => {
    imperative = api;
    return () => {
      if (imperative === api) imperative = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [api]);

  const tone = current?.tone ?? 'info';
  const colors = toneColors(theme.colors, tone === 'error' ? 'danger' : tone);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 72, paddingHorizontal: theme.spacing.lg }]}>
          <View
            key={current.id}
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              {
                backgroundColor: theme.colors.surface,
                borderColor: colors.fg,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
              },
            ]}
          >
            <Icon name={ICONS[tone]} color={colors.fg} />
            <AppText variant="body" style={styles.message}>
              {current.message}
            </AppText>
            {current.actionLabel && current.onAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={current.actionLabel}
                onPress={() => {
                  current.onAction?.();
                  hide();
                }}
                style={styles.action}
              >
                <AppText variant="bodyStrong" color="primary">
                  {current.actionLabel}
                </AppText>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={hide} style={styles.action}>
                <Icon name="close" color="textSecondary" />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  message: { flex: 1 },
  action: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
