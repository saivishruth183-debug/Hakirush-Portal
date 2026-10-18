import { useRouter, type Href } from 'expo-router';
import { Fragment } from 'react';

import { Card, Divider, ListRow, SectionHeader, type IconName } from '@/components';
import { AccountMenu } from '@/features/account/AccountMenu';

interface MenuItem {
  title: string;
  subtitle: string;
  icon: IconName;
  href: Href;
}

const ORGANISATION: MenuItem[] = [
  { title: 'Departments', subtitle: 'Teams, managers and members', icon: 'business-outline', href: '/admin/departments' },
  { title: 'Clients', subtitle: 'Client accounts, plans and content', icon: 'briefcase-outline', href: '/admin/clients' },
  { title: 'Sponsors', subtitle: 'Sponsors and collaborations', icon: 'ribbon-outline', href: '/admin/sponsors' },
  { title: 'Stalls', subtitle: 'Stalls, types and plans', icon: 'storefront-outline', href: '/admin/stalls' },
];

const OPERATIONS: MenuItem[] = [
  { title: 'Attendance report', subtitle: 'Day, month or date range · Excel and CSV export', icon: 'document-text-outline', href: '/admin/attendance-report' },
  { title: 'Holidays', subtitle: 'Company holiday calendar', icon: 'calendar-outline', href: '/admin/holidays' },
  { title: 'Announcements', subtitle: 'Events and notices for everyone', icon: 'megaphone-outline', href: '/admin/announcements' },
  { title: 'Notifications', subtitle: 'Leave and correction alerts', icon: 'notifications-outline', href: '/admin/notifications' },
];

function Menu({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  return (
    <Card padded={false}>
      {items.map((item, i) => (
        <Fragment key={item.title}>
          {i > 0 ? <Divider inset={68} /> : null}
          <ListRow title={item.title} subtitle={item.subtitle} left={{ icon: item.icon }} onPress={() => router.push(item.href)} />
        </Fragment>
      ))}
    </Card>
  );
}

/** Admin "More" tab: profile, organisation + operations links, then Change password / Sign out. */
export function AdminMoreScreen() {
  return (
    <AccountMenu changePasswordHref="/admin/change-password">
      <SectionHeader title="Organisation" />
      <Menu items={ORGANISATION} />
      <SectionHeader title="Operations" />
      <Menu items={OPERATIONS} />
    </AccountMenu>
  );
}
