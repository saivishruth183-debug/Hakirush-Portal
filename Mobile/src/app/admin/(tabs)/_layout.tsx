import { Tabs } from 'expo-router/js-tabs';

import { tabIcon, tabScreenOptions } from '@/navigation/options';
import { useTheme } from '@/theme';

/**
 * Admin bottom tabs. backBehavior="firstRoute": Android back on a non-Home tab returns to Home;
 * back on Home leaves the app (moves it to the background) as usual.
 */
export default function AdminTabs() {
  const theme = useTheme();
  return (
    <Tabs backBehavior="firstRoute" screenOptions={tabScreenOptions(theme)}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('grid-outline', 'grid') }}
      />
      <Tabs.Screen
        name="people"
        options={{ title: 'People', tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attendance', tabBarIcon: tabIcon('time-outline', 'time') }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Requests', tabBarIcon: tabIcon('checkmark-done-outline', 'checkmark-done') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }}
      />
    </Tabs>
  );
}
