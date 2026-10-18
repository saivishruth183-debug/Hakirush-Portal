import { Tabs } from 'expo-router/js-tabs';

import { tabIcon, tabScreenOptions } from '@/navigation/options';
import { useTheme } from '@/theme';

/**
 * Employee bottom tabs. backBehavior="firstRoute": Android back on a non-Home tab returns to Home;
 * back on Home leaves the app (moves it to the background) as usual.
 */
export default function EmployeeTabs() {
  const theme = useTheme();
  return (
    <Tabs backBehavior="firstRoute" screenOptions={tabScreenOptions(theme)}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attendance', tabBarIcon: tabIcon('time-outline', 'time') }}
      />
      <Tabs.Screen
        name="team"
        options={{ title: 'Team', tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="leave"
        options={{ title: 'Leave', tabBarIcon: tabIcon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }}
      />
    </Tabs>
  );
}
