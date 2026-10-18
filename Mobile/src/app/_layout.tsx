import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ErrorState';
import { ToastProvider } from '@/components/Toast';
import { navigationTheme } from '@/navigation/options';
import { queryClient, wireReactQueryToNative } from '@/services/queryClient';
import { SessionProvider, useSession } from '@/services/session';
import { useTheme } from '@/theme';

// Keep the native splash until the session boot resolves (see SplashGate).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Hides the splash once boot resolves (or fails), with a safety timeout. */
function SplashGate() {
  const { status, bootError } = useSession();
  const ready = status !== 'booting' || !!bootError;
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
      return;
    }
    // Never keep the splash forever (slow network): index.tsx shows a loading state instead.
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => undefined), 8000);
    return () => clearTimeout(t);
  }, [ready]);
  return null;
}

function RootNavigator() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="employee" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="client" />
      <Stack.Screen name="access-denied" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

/**
 * Provider order: GestureHandlerRootView → SafeAreaProvider → ThemeProvider/StatusBar →
 * QueryClientProvider → SessionProvider (uses the QueryClient) → ToastProvider → navigator.
 */
export default function RootLayout() {
  const theme = useTheme();
  useEffect(() => wireReactQueryToNative(), []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme(theme)}>
          <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <ToastProvider>
                <SplashGate />
                <RootNavigator />
              </ToastProvider>
            </SessionProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Last-resort error screen for render errors in the root layout (no providers available here). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 }}>
      <ErrorState error={error} title="Something went wrong" message="The app hit an unexpected problem." onRetry={retry} />
    </View>
  );
}
