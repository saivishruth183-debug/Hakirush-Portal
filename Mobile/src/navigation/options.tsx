import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, type Theme as NavTheme } from 'expo-router';
import type { BottomTabNavigationOptions } from 'expo-router/build/react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from 'expo-router/build/react-navigation/native-stack';

import type { ColorValue } from 'react-native';

import type { IconName } from '@/components/Icon';
import type { Theme } from '@/theme';

/** React Navigation theme derived from our tokens (headers, tab bar, backgrounds). */
export function navigationTheme(theme: Theme): NavTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}

/** Options for role stacks (detail screens pushed over the tabs show a back button + title). */
export function stackScreenOptions(theme: Theme): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.primary,
    headerTitleStyle: { color: theme.colors.text, fontWeight: '600' },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

/** Options for role tab navigators. */
export function tabScreenOptions(theme: Theme): BottomTabNavigationOptions {
  return {
    headerShown: true,
    headerTitleAlign: 'left',
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
    headerShadowVisible: false,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.tabInactive,
    tabBarStyle: { backgroundColor: theme.colors.tabBar, borderTopColor: theme.colors.border },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarHideOnKeyboard: true,
    sceneStyle: { backgroundColor: theme.colors.background },
  };
}

/** Tab icon renderer: outline when inactive, filled when focused. */
export function tabIcon(name: IconName, focusedName?: IconName) {
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused && focusedName ? focusedName : name} size={size} color={color as string} />;
  }
  return TabIcon;
}
