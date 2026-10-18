import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Screen } from './Screen';

export interface PlaceholderScreenProps {
  title: string;
  /** What this screen will contain once implemented. */
  description: string;
  icon?: IconName;
  /** Feature folder that owns the implementation, e.g. "src/features/employee/attendance". */
  owner?: string;
}

/** Temporary content for routes a feature agent has not implemented yet. */
export function PlaceholderScreen({ title, description, icon = 'construct-outline', owner }: PlaceholderScreenProps) {
  const theme = useTheme();
  return (
    <Screen>
      <Card>
        <View style={[styles.row, { gap: theme.spacing.md }]}>
          <Icon name={icon} size={28} color="accentText" />
          <AppText variant="title" style={styles.flex}>
            {title}
          </AppText>
        </View>
        <AppText variant="body" color="textSecondary">
          {description}
        </AppText>
        <AppText variant="secondary">This screen will be implemented in a later step.</AppText>
        {owner ? <AppText variant="caption">Implementation: {owner}</AppText> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
