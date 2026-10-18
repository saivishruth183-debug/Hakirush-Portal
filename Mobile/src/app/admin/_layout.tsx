import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/navigation/options';
import { useRoleGate } from '@/navigation/RoleGate';
import { useTheme } from '@/theme';

/**
 * Admin area (/admin/...). Guarded: only signed-in users with role "admin" get here.
 * The Stack holds the tab navigator plus detail screens pushed over the tabs.
 * Feature agents: add a detail screen as src/app/admin/<name>.tsx (e.g. payslips.tsx →
 * /admin/payslips) and, if it needs a title, a <Stack.Screen name="<name>" options={{ title }} /> here
 * (or set options from the screen with <Stack.Screen options={{...}} />).
 */
export default function AdminLayout() {
  const theme = useTheme();
  const gate = useRoleGate('admin');
  if (gate) return gate;
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
    </Stack>
  );
}
