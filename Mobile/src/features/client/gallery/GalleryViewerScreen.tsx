import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton, LoadingState, type TextColor } from '@/components';
import { getErrorMessage } from '@/services/api';
import { useTheme } from '@/theme';
import type { GalleryImage } from '@/types/api';

import { useGallery } from '../api';
import { resolveMediaUrl } from '../utils';
import { galleryImageLabel } from './GalleryThumb';
import { ZoomableImage } from './ZoomableImage';

/** Parses the `[index]` route param; anything invalid opens the first image. */
export function parseIndexParam(raw: string | string[] | undefined, count: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? '0', 10);
  if (!Number.isFinite(n) || n < 0 || count <= 0) return 0;
  return Math.min(n, count - 1);
}

/**
 * /client/gallery/[index] — full-screen viewer: swipe between images, pinch / double-tap to zoom,
 * Previous / Next buttons for screen-reader and switch users. Android back (or Close) returns.
 */
export function GalleryViewerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ index?: string }>();
  const query = useGallery();
  const images: GalleryImage[] = query.data?.images ?? [];

  // Viewer chrome is always light-on-dark: charcoal in the light theme, near-black in the dark one.
  const dark = theme.scheme === 'dark';
  const background = dark ? theme.colors.background : theme.colors.text;
  const foreground: TextColor = dark ? 'text' : 'textInverse';

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/client/gallery');
  };

  let body;
  if (images.length > 0) {
    body = (
      <Pager
        key={images.map((i) => i._id).join('|')}
        images={images}
        initialIndex={parseIndexParam(params.index, images.length)}
        foreground={foreground}
        bottomInset={insets.bottom}
      />
    );
  } else if (query.data) {
    body = (
      <ViewerMessage
        foreground={foreground}
        title="No gallery images yet"
        message="Photos that Hakirush shares with your company will appear here."
        actionLabel="Close"
        onAction={close}
      />
    );
  } else if (query.isError) {
    body = (
      <ViewerMessage
        foreground={foreground}
        title="Couldn't load the gallery"
        message={getErrorMessage(query.error)}
        actionLabel="Try again"
        onAction={() => query.refetch()}
      />
    );
  } else if (query.fetchStatus === 'paused') {
    body = (
      <ViewerMessage
        foreground={foreground}
        title="You're offline"
        message="Connect to the internet to load the gallery."
        actionLabel="Try again"
        onAction={() => query.refetch()}
      />
    );
  } else {
    body = <LoadingState label="Loading image…" />;
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]} testID="gallery-viewer">
      <Stack.Screen options={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: background } }} />
      <StatusBar style="light" />
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.xs, paddingHorizontal: theme.spacing.sm }]}>
        <IconButton icon="close" accessibilityLabel="Close gallery" onPress={close} color={foreground} />
      </View>
      {body}
    </View>
  );
}

interface PagerProps {
  images: GalleryImage[];
  initialIndex: number;
  foreground: TextColor;
  bottomInset: number;
}

function Pager({ images, initialIndex, foreground, bottomInset }: PagerProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GalleryImage>>(null);
  const [current, setCurrent] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const total = images.length;
  const image = images[current];
  const caption = image?.caption?.trim();

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(total - 1, index));
    setZoomed(false);
    setCurrent(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== current && next >= 0 && next < total) {
      setZoomed(false);
      setCurrent(next);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => setPageHeight(Math.floor(e.nativeEvent.layout.height));

  return (
    <View style={styles.flex}>
      <View style={styles.flex} onLayout={onLayout} testID="gallery-pager">
        {pageHeight > 0 ? (
          <FlatList
            ref={listRef}
            data={images}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={onMomentumEnd}
            keyExtractor={(item) => item._id}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            renderItem={({ item, index }) => (
              <ZoomableImage
                uri={resolveMediaUrl(item.url)}
                width={width}
                height={pageHeight}
                active={index === current}
                onZoomChange={index === current ? setZoomed : () => undefined}
                accessibilityLabel={galleryImageLabel(item, index, total)}
                foreground={foreground}
              />
            )}
          />
        ) : null}
      </View>
      <View style={[styles.bottomBar, { paddingBottom: bottomInset + theme.spacing.sm, paddingHorizontal: theme.spacing.sm }]}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Previous image"
          onPress={() => goTo(current - 1)}
          disabled={current <= 0}
          color={foreground}
        />
        <View style={styles.captionBox}>
          <AppText variant="label" color={foreground} align="center" accessibilityLiveRegion="polite" testID="gallery-counter">
            {`${current + 1} of ${total}`}
          </AppText>
          {caption ? (
            <AppText variant="body" color={foreground} align="center" testID="gallery-caption">
              {caption}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon="chevron-forward"
          accessibilityLabel="Next image"
          onPress={() => goTo(current + 1)}
          disabled={current >= total - 1}
          color={foreground}
        />
      </View>
    </View>
  );
}

function ViewerMessage({
  foreground,
  title,
  message,
  actionLabel,
  onAction,
}: {
  foreground: TextColor;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => unknown;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.message, { padding: theme.spacing.xl, gap: theme.spacing.md }]}>
      <AppText variant="heading" color={foreground} align="center">
        {title}
      </AppText>
      <AppText variant="body" color={foreground} align="center">
        {message}
      </AppText>
      <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8 },
  captionBox: { flex: 1, gap: 4, alignItems: 'center' },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
