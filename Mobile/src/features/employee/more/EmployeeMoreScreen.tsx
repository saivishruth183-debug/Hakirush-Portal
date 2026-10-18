import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { Fragment } from 'react';

import { Badge, Card, Divider, ListRow, SectionHeader, toast, type IconName } from '@/components';
import { AccountMenu } from '@/features/account/AccountMenu';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';

import type { NotificationsResponse } from '../types';

export function EmployeeMoreScreen() {
  const router = useRouter();
  const keys = useQueryKeys();
  const { user } = useSession();
  const notifications = useApiQuery<NotificationsResponse>([...keys.notifications(), 'summary'], '/api/notifications', {
    query: { page: 1, limit: 1 },
  });
  const unseen = notifications.data?.unseenCount ?? 0;

  const items: { title: string; icon: IconName; href: Href; badge?: number }[] = [
    { title: 'My profile', icon: 'person-circle-outline', href: '/employee/profile' },
    { title: 'Edit profile', icon: 'create-outline', href: '/employee/profile-edit' },
    { title: 'Payslips', icon: 'document-text-outline', href: '/employee/payslips' },
    { title: 'Expense claims', icon: 'receipt-outline', href: '/employee/expenses' },
    { title: 'Overtime & comp-off', icon: 'time-outline', href: '/employee/overtime' },
    { title: 'Company assets', icon: 'laptop-outline', href: '/employee/assets' },
    { title: 'Notices', icon: 'megaphone-outline', href: '/employee/notices' },
    { title: 'Holidays', icon: 'sunny-outline', href: '/employee/holidays' },
    { title: 'Notifications', icon: 'notifications-outline', href: '/employee/notifications', badge: unseen },
  ];

  const copyCode = async () => {
    if (!user?.employeeId) return;
    try {
      await Clipboard.setStringAsync(user.employeeId);
      toast.success('Employee code copied.');
    } catch {
      toast.error("Couldn't copy the employee code.");
    }
  };

  return (
    <AccountMenu changePasswordHref="/employee/change-password">
      <SectionHeader title="My workspace" />
      <Card padded={false}>
        {items.map((it, i) => (
          <Fragment key={it.title}>
            {i ? <Divider inset={68} /> : null}
            <ListRow
              title={it.title}
              left={{ icon: it.icon }}
              right={it.badge ? <Badge label={`${it.badge} new`} tone="primary" /> : undefined}
              chevron
              onPress={() => router.push(it.href)}
            />
          </Fragment>
        ))}
        <Divider inset={68} />
        <ListRow
          title="Copy employee code"
          subtitle={user?.employeeId ?? 'No employee code on your account'}
          left={{ icon: 'copy-outline' }}
          disabled={!user?.employeeId}
          chevron={false}
          onPress={copyCode}
        />
      </Card>
    </AccountMenu>
  );
}
