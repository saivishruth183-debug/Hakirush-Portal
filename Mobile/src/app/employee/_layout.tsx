import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/navigation/options';
import { useRoleGate } from '@/navigation/RoleGate';
import { useTheme } from '@/theme';

/**
 * Employee area (/employee/...). Guarded: only signed-in users with role "employee" get here.
 * The Stack holds the tab navigator plus detail screens pushed over the tabs.
 * Feature agents: add a detail screen as src/app/employee/<name>.tsx (e.g. payslips.tsx →
 * /employee/payslips) and, if it needs a title, a <Stack.Screen name="<name>" options={{ title }} /> here
 * (or set options from the screen with <Stack.Screen options={{...}} />).
 */
export default function EmployeeLayout() {
  const theme = useTheme();
  const gate = useRoleGate('employee');
  if (gate) return gate;
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
      <Stack.Screen name="expenses" options={{ title: 'Expense claims' }} />
      <Stack.Screen name="expense-apply" options={{ title: 'Claim an expense' }} />
      <Stack.Screen name="overtime" options={{ title: 'Overtime & comp-off' }} />
      <Stack.Screen name="assets" options={{ title: 'Company assets' }} />
    </Stack>
  );
}
