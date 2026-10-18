import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

/** Groups related fields with consistent spacing and an optional heading. */
export function FormSection({ title, description, children }: FormSectionProps) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { gap: theme.spacing.lg, marginBottom: theme.spacing.xl }]}>
      {title || description ? (
        <View style={{ gap: theme.spacing.xs }}>
          {title ? <AppText variant="heading">{title}</AppText> : null}
          {description ? <AppText variant="secondary">{description}</AppText> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
});
