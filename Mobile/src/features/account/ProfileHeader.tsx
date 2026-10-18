import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Card } from '@/components';
import { useTheme } from '@/theme';
import type { SessionUser } from '@/types/api';
import { ROLE_LABELS } from '@/utils/identity';

export interface ProfileHeaderProps {
  user: Pick<SessionUser, '_id' | 'name' | 'role' | 'profileImage' | 'employeeId' | 'designation' | 'departmentName' | 'email'>;
}

/**
 * Avatar + name + role/code. (Copy-to-clipboard for the employee code is intentionally omitted:
 * expo-clipboard is not installed; the code is selectable text instead.)
 */
export function ProfileHeader({ user }: ProfileHeaderProps) {
  const theme = useTheme();
  const roleLine = [user.designation, user.departmentName].filter(Boolean).join(' · ') || ROLE_LABELS[user.role];
  return (
    <Card>
      <View style={[styles.row, { gap: theme.spacing.lg }]}>
        <Avatar uri={user.profileImage} name={user.name} id={user._id} size={64} />
        <View style={styles.text}>
          <AppText variant="title">{user.name}</AppText>
          <AppText variant="secondary">{roleLine}</AppText>
          {user.employeeId ? (
            <AppText variant="secondary" selectable accessibilityLabel={`Employee code ${user.employeeId.split('').join(' ')}`}>
              Employee code: {user.employeeId}
            </AppText>
          ) : null}
          {user.email ? (
            <AppText variant="secondary" selectable>
              {user.email}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
