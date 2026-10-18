// expo-router bundles React Navigation; these contexts tell us whether a tab bar / header is present.
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';
import { HeaderHeightContext } from 'expo-router/build/react-navigation/elements';
import { useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { OfflineBanner } from './OfflineBanner';

/** Content is centred with this max width on tablets / large screens. */
export const MAX_CONTENT_WIDTH = 720;

export interface ScreenProps {
  children: ReactNode;
  /**
   * Wrap content in the screen's single ScrollView (default true). Pass false when the screen
   * renders its own FlatList/SectionList (then that list is the one scroll area).
   */
  scroll?: boolean;
  /** Pull-to-refresh (scroll screens). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Avoid the keyboard (forms). Needed on Android too: with edge-to-edge the window is not
   * resized by adjustResize, so a KeyboardAvoidingView (offset by the header height) is used.
   */
  keyboardAvoiding?: boolean;
  /**
   * Safe-area edges to pad. Default: none on top (the navigation header handles it) and
   * bottom only when not inside a tab navigator (the tab bar handles it there).
   * Screens without a header (e.g. login) pass ['top', 'bottom'].
   */
  edges?: Edge[];
  /** Horizontal + vertical content padding (default true). */
  padded?: boolean;
  /** Content rendered above the scroll area (e.g. a SearchBar that should not scroll). */
  header?: ReactNode;
  /** Pinned footer (e.g. a form's submit button). */
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Show the offline / unverified-session banner at the top (default true). */
  showOfflineBanner?: boolean;
  testID?: string;
}

/** Standard screen container: background, safe areas, one scroll area, refresh and keyboard handling. */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  keyboardAvoiding = false,
  edges,
  padded = true,
  header,
  footer,
  contentContainerStyle,
  showOfflineBanner = true,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const inTabs = tabBarHeight !== undefined;
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const resolvedEdges: Edge[] = edges ?? (inTabs ? [] : ['bottom']);

  const padTop = resolvedEdges.includes('top') ? insets.top : 0;
  const padBottom = resolvedEdges.includes('bottom') ? insets.bottom : 0;
  const padLeft = resolvedEdges.includes('left') ? insets.left : 0;
  const padRight = resolvedEdges.includes('right') ? insets.right : 0;
  const contentPadding = padded ? theme.spacing.lg : 0;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        {
          padding: contentPadding,
          paddingBottom: contentPadding + (footer ? 0 : padBottom),
          gap: theme.spacing.md,
          flexGrow: 1,
          width: '100%',
          maxWidth: MAX_CONTENT_WIDTH,
          alignSelf: 'center',
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        styles.centered,
        { paddingBottom: footer ? 0 : padBottom },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const inner = (
    <>
      {showOfflineBanner ? <OfflineBanner /> : null}
      {header ? (
        <View style={[styles.centered, { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }]}>{header}</View>
      ) : null}
      {body}
      {footer ? (
        <View
          style={{
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: 'center',
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.lg + padBottom,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <View
      testID={testID}
      style={[
        styles.flex,
        { backgroundColor: theme.colors.background, paddingTop: padTop, paddingLeft: padLeft, paddingRight: padRight },
      ]}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={headerHeight}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
