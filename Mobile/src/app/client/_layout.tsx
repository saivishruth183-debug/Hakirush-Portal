import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/navigation/options';
import { useRoleGate } from '@/navigation/RoleGate';
import { useTheme } from '@/theme';

/**
 * Client area (/client/...). Guarded: only signed-in users with role "client" get here.
 * The Stack holds the tab navigator plus detail screens pushed over the tabs.
 * Feature agents: add a detail screen as src/app/client/<name>.tsx (e.g. payslips.tsx →
 * /client/payslips) and, if it needs a title, a <Stack.Screen name="<name>" options={{ title }} /> here
 * (or set options from the screen with <Stack.Screen options={{...}} />).
 */
export default function ClientLayout() {
  const theme = useTheme();
  const gate = useRoleGate('client');
  if (gate) return gate;
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
    </Stack>
  );
}
