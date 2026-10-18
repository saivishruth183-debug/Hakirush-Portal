import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge } from '@/components';
import { useTheme } from '@/theme';
import type { SafePerson } from '@/types/api';

import { mediaUrl } from '../format';

/** Directory entry (not tappable: a directory entry is not a profile). */
export function PersonRow({ person, isManager, isSelf }: { person: SafePerson; isManager: boolean; isSelf: boolean }) {
  const theme = useTheme();
  const tags = [isManager ? 'Manager' : null, isSelf ? 'You' : null].filter(Boolean) as string[];
  const label = [person.name, person.designation, ...tags].filter(Boolean).join(', ');
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.row, { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }]}
    >
      <Avatar uri={mediaUrl(person.profileImageUrl)} name={person.name} id={person.employeeRecordId} size={44} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{person.name}</AppText>
        {person.designation ? <AppText variant="secondary">{person.designation}</AppText> : null}
      </View>
      {tags.length ? (
        <View style={styles.tags}>
          {tags.map((t) => (
            <Badge key={t} label={t} tone={t === 'Manager' ? 'primary' : 'info'} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  text: { flex: 1, gap: 2 },
  tags: { gap: 4, alignItems: 'flex-end' },
});
