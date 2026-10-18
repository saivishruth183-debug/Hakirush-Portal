import { useColorScheme } from 'react-native';

import {
  avatarPalette,
  darkColors,
  lightColors,
  radii,
  spacing,
  toneColors,
  TOUCH_TARGET,
  typography,
  type ColorScheme,
  type StatusTone,
  type TextVariant,
  type ThemeColors,
} from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  touchTarget: number;
}

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  spacing,
  radii,
  typography,
  touchTarget: TOUCH_TARGET,
};

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  spacing,
  radii,
  typography,
  touchTarget: TOUCH_TARGET,
};

/** Current theme, following the system colour scheme (light when unknown). */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export {
  avatarPalette,
  darkColors,
  lightColors,
  radii,
  spacing,
  toneColors,
  TOUCH_TARGET,
  typography,
  type ColorScheme,
  type StatusTone,
  type TextVariant,
  type ThemeColors,
};
