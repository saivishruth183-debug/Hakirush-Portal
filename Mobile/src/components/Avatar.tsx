import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { avatarColorFor, getInitials } from '@/utils/identity';

export interface AvatarProps {
  /** Remote image URL. When missing or failing to load, initials are shown. */
  uri?: string | null;
  /** Person/company display name (used for initials and the accessibility label). */
  name: string;
  /** Stable id (userId / employeeRecordId) → deterministic background colour. Falls back to name. */
  id?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Circular avatar. accessibilityLabel: "Photo of <name>" when the photo is shown,
 * "<name> initials" for the fallback.
 */
export function Avatar({ uri, name, id, size = 44, style, testID }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && failedUri !== uri;
  const initials = getInitials(name);
  const radius = size / 2;

  if (showImage) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Photo of ${name}`}
        style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailedUri(uri)}
          accessible={false}
        />
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} initials`}
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: avatarColorFor(id || name) },
        style,
      ]}
    >
      <Text
        style={[styles.initials, { fontSize: Math.max(12, Math.round(size * 0.38)) }]}
        maxFontSizeMultiplier={1.2}
        importantForAccessibility="no"
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '700' },
});
