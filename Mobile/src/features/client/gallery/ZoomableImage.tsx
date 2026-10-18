import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText, Icon, type TextColor } from '@/components';

export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;
const ZOOMED_EPSILON = 1.01;

export interface ZoomableImageProps {
  uri: string | null;
  width: number;
  height: number;
  /** Screen-reader name (caption or "Image n of m"). */
  accessibilityLabel: string;
  /** False when another page is showing: zoom is reset so every page opens at 100 %. */
  active: boolean;
  /** Reports whether the image is zoomed in (the pager disables swiping while it is). */
  onZoomChange: (zoomed: boolean) => void;
  /** Theme colour name for the "couldn't load" text on the viewer background. */
  foreground: TextColor;
}

/** Keeps a translation inside the bounds of the scaled image. */
function clampTranslate(value: number, scale: number, size: number): number {
  'worklet';
  const max = Math.max(0, ((scale - 1) * size) / 2);
  return Math.min(max, Math.max(-max, value));
}

/**
 * Full-screen image with pinch-to-zoom (1×–4×), pan while zoomed and double-tap to zoom in/out
 * around the tapped point. Gestures run on the UI thread (gesture-handler + reanimated).
 */
export function ZoomableImage({ uri, width, height, accessibilityLabel, active, onZoomChange, foreground }: ZoomableImageProps) {
  const [zoomed, setZoomed] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reportZoom = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };

  // Leaving this page resets its zoom.
  useEffect(() => {
    if (active) return;
    scale.set(1);
    savedScale.set(1);
    tx.set(0);
    ty.set(0);
    savedTx.set(0);
    savedTy.set(0);
  }, [active, scale, savedScale, tx, ty, savedTx, savedTy]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(0.8, savedScale.get() * e.scale));
      scale.set(next);
      tx.set(clampTranslate(savedTx.get(), next, width));
      ty.set(clampTranslate(savedTy.get(), next, height));
    })
    .onEnd(() => {
      const current = scale.get();
      if (current < ZOOMED_EPSILON) {
        scale.set(withTiming(1));
        tx.set(withTiming(0));
        ty.set(withTiming(0));
        savedScale.set(1);
        savedTx.set(0);
        savedTy.set(0);
        scheduleOnRN(reportZoom, false);
        return;
      }
      savedScale.set(current);
      savedTx.set(tx.get());
      savedTy.set(ty.get());
      scheduleOnRN(reportZoom, true);
    });

  // Only active while zoomed, so a plain horizontal swipe still pages through the gallery.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(1)
    .onUpdate((e) => {
      const s = scale.get();
      tx.set(clampTranslate(savedTx.get() + e.translationX, s, width));
      ty.set(clampTranslate(savedTy.get() + e.translationY, s, height));
    })
    .onEnd(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.get() > ZOOMED_EPSILON) {
        scale.set(withTiming(1));
        tx.set(withTiming(0));
        ty.set(withTiming(0));
        savedScale.set(1);
        savedTx.set(0);
        savedTy.set(0);
        scheduleOnRN(reportZoom, false);
        return;
      }
      // Keep the tapped point under the finger: t = (1 - s) · (p - centre).
      const nextX = clampTranslate((1 - DOUBLE_TAP_ZOOM) * (e.x - width / 2), DOUBLE_TAP_ZOOM, width);
      const nextY = clampTranslate((1 - DOUBLE_TAP_ZOOM) * (e.y - height / 2), DOUBLE_TAP_ZOOM, height);
      scale.set(withTiming(DOUBLE_TAP_ZOOM));
      tx.set(withTiming(nextX));
      ty.set(withTiming(nextY));
      savedScale.set(DOUBLE_TAP_ZOOM);
      savedTx.set(nextX);
      savedTy.set(nextY);
      scheduleOnRN(reportZoom, true);
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const failed = !uri || failedUri === uri;

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.fill, animatedStyle]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={failed ? undefined : 'Pinch or double-tap to zoom'}
        >
          {failed ? (
            <View style={styles.center}>
              <Icon name="image-outline" size={40} color={foreground} />
              <AppText variant="body" color={foreground} align="center">
                This image couldn&apos;t be loaded.
              </AppText>
            </View>
          ) : (
            <Image
              source={{ uri }}
              style={styles.fill}
              contentFit="contain"
              cachePolicy="memory-disk"
              recyclingKey={uri}
              transition={150}
              accessible={false}
              onError={() => setFailedUri(uri)}
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
});
