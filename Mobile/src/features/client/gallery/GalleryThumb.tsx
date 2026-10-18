import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components';
import { useTheme } from '@/theme';
import type { GalleryImage } from '@/types/api';

import { resolveMediaUrl, thumbnailUrl } from '../utils';

export interface GalleryThumbProps {
  image: GalleryImage;
  index: number;
  total: number;
  size: number;
  onPress: () => void;
  testID?: string;
}

/** Accessible name of a gallery image: its caption, or its position. */
export function galleryImageLabel(image: Pick<GalleryImage, 'caption'>, index: number, total: number): string {
  const caption = image.caption?.trim();
  return caption ? `${caption}, image ${index + 1} of ${total}` : `Gallery image ${index + 1} of ${total}`;
}

/**
 * Square, cached thumbnail. Tries a resized ImageKit variant first, then the original URL,
 * then shows a neutral "image unavailable" tile (never a stock picture).
 */
export function GalleryThumb({ image, index, total, size, onPress, testID }: GalleryThumbProps) {
  const theme = useTheme();
  const original = resolveMediaUrl(image.url);
  const candidates = original ? Array.from(new Set([thumbnailUrl(original, size * 2), original])) : [];
  // Index into `candidates`, remembered per URL so a recycled cell never inherits a failure.
  const [failed, setFailed] = useState<{ url: string | null; step: number }>({ url: original, step: 0 });
  const step = failed.url === original ? failed.step : 0;
  const uri = candidates[step];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={galleryImageLabel(image, index, total)}
      accessibilityHint="Opens the image full screen"
      style={({ pressed }) => [
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surfaceAlt,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          transition={120}
          accessible={false}
          onError={() => setFailed({ url: original, step: step + 1 })}
        />
      ) : (
        <View style={styles.fallback}>
          <Icon name="image-outline" size={28} color="textMuted" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
