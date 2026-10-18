import { Stack, useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, QueryStateView, Screen } from '@/components';
import { MAX_CONTENT_WIDTH } from '@/components/Screen';
import { useTheme } from '@/theme';
import type { GalleryImage } from '@/types/api';

import { useGallery } from '../api';
import { GalleryThumb } from './GalleryThumb';

const GAP = 8;

/** Grid thumbnail size and column count for the current window width. */
export function useGalleryGrid(horizontalPadding: number): { columns: number; size: number } {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - horizontalPadding * 2;
  const columns = contentWidth >= 560 ? 4 : 3;
  const size = Math.floor((contentWidth - GAP * (columns - 1)) / columns);
  return { columns, size: Math.max(64, size) };
}

/** /client/gallery — every image the admin published for this client, newest first. */
export function ClientGalleryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const query = useGallery();
  const { columns, size } = useGalleryGrid(theme.spacing.lg);

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: 'Gallery' }} />
      <QueryStateView
        query={query}
        isEmpty={(d) => (d.images ?? []).length === 0}
        emptyTitle="No gallery images yet"
        emptyMessage="Photos that Hakirush shares with your company will appear here."
        loadingLabel="Loading gallery…"
      >
        {(data) => {
          const images: GalleryImage[] = data.images ?? [];
          return (
            <FlatList
              key={`cols-${columns}`}
              data={images}
              numColumns={columns}
              keyExtractor={(img) => img._id}
              contentContainerStyle={{ padding: theme.spacing.lg, gap: GAP }}
              columnWrapperStyle={{ gap: GAP }}
              ListHeaderComponent={
                <View style={styles.header}>
                  <AppText variant="secondary">
                    {images.length === 1 ? '1 image' : `${images.length} images`} · Tap an image to view it full screen
                  </AppText>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={query.isRefetching}
                  onRefresh={() => void query.refetch()}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                  progressBackgroundColor={theme.colors.surface}
                />
              }
              renderItem={({ item, index }) => (
                <GalleryThumb
                  testID={`gallery-thumb-${index}`}
                  image={item}
                  index={index}
                  total={images.length}
                  size={size}
                  onPress={() => router.push(`/client/gallery/${index}`)}
                />
              )}
            />
          );
        }}
      </QueryStateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 4 },
});
