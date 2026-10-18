import { useRouter } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom']} contentContainerStyle={{ justifyContent: 'center' }}>
      <EmptyState icon="help-circle-outline" title="Page not found" message="The link you opened doesn't exist in this app." />
      <Button label="Go to home" onPress={() => router.replace('/')} />
    </Screen>
  );
}
