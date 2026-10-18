import { FlatList, StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  EmptyState,
  Icon,
  LoadingState,
  Screen,
  SectionHeader,
  StatusPill,
  type IconName,
} from '@/components';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

import type { AssetItem, MyAssetsResponse } from '../types';

function assetIcon(type: AssetItem['assetType']): IconName {
  switch (type) {
    case 'Laptop':
      return 'laptop-outline';
    case 'Monitor':
      return 'tv-outline';
    case 'Mobile':
      return 'phone-portrait-outline';
    case 'ID Card':
      return 'card-outline';
    case 'Keys':
      return 'key-outline';
    case 'Other':
    default:
      return 'cube-outline';
  }
}

export function EmployeeAssetsScreen() {
  const theme = useTheme();
  const keys = useQueryKeys();

  const query = useApiQuery<MyAssetsResponse>(keys.myAssets(), '/api/asset/me');
  const assets = query.data?.assets ?? [];

  return (
    <Screen scroll={false} padded={false}>
      {query.isPending && !query.data ? (
        <LoadingState label="Loading your assigned company assets…" />
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.lg }}
          ListHeaderComponent={
            <View style={{ marginBottom: 8 }}>
              <SectionHeader
                title="Assigned Equipment"
                subtitle="Company assets, hardware, and accessories currently checked out to you."
              />
            </View>
          }
          renderItem={({ item }) => <AssetCard asset={item} />}
          ListEmptyComponent={
            <EmptyState
              title="No company assets assigned"
              message="When your IT department or HR assigns laptops, monitors, or equipment to you, they will appear here."
            />
          }
        />
      )}
    </Screen>
  );
}

function AssetCard({ asset }: { asset: AssetItem }) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
          <Icon name={assetIcon(asset.assetType)} size={26} color={theme.colors.primary} />
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong">{asset.name}</AppText>
            <StatusPill
              label={asset.status}
              tone={asset.status === 'Assigned' ? 'success' : 'neutral'}
            />
          </View>

          <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            Type: {asset.assetType}
            {asset.serialNumber ? ` • S/N: ${asset.serialNumber}` : ''}
          </AppText>

          {asset.issueDate ? (
            <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              Issued: {formatDate(asset.issueDate)}
            </AppText>
          ) : null}

          {asset.notes ? (
            <AppText variant="caption" style={{ marginTop: 6, fontStyle: 'italic', color: theme.colors.textSecondary }}>
              Note: {asset.notes}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
