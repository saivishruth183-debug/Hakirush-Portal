import { Tabs } from 'expo-router/js-tabs';

import { tabIcon, tabScreenOptions } from '@/navigation/options';
import { useTheme } from '@/theme';

/**
 * Client bottom tabs. backBehavior="firstRoute": Android back on a non-Home tab returns to Home;
 * back on Home leaves the app (moves it to the background) as usual.
 */
export default function ClientTabs() {
  const theme = useTheme();
  return (
    <Tabs backBehavior="firstRoute" screenOptions={tabScreenOptions(theme)}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="relationship"
        options={{ title: 'Relationship', tabBarIcon: tabIcon('people-circle-outline', 'people-circle') }}
      />
      <Tabs.Screen
        name="updates"
        options={{ title: 'Updates', tabBarIcon: tabIcon('megaphone-outline', 'megaphone') }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: tabIcon('person-circle-outline', 'person-circle') }}
      />
    </Tabs>
  );
}
