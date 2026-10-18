import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { AppText, ListRow, SegmentedControl, StatusPill } from '@/components';

import { useDepartments, useEmployees } from './api';
import { includesAny, SearchList } from './common/SearchList';
import type { AdminEmployee, DepartmentItem } from './types';

type Segment = 'employees' | 'departments';
type ActiveFilter = 'active' | 'inactive' | 'all';

/** People tab: Employees | Departments. */
export function AdminPeopleScreen() {
  const [segment, setSegment] = useState<Segment>('employees');
  const switcher = (
    <SegmentedControl<Segment>
      accessibilityLabel="People section"
      value={segment}
      onChange={setSegment}
      options={[
        { label: 'Employees', value: 'employees' },
        { label: 'Departments', value: 'departments' },
      ]}
    />
  );
  return segment === 'employees' ? <EmployeesList headerExtra={switcher} /> : <DepartmentsList headerExtra={switcher} />;
}

export function EmployeeRow({ employee, onPress }: { employee: AdminEmployee; onPress?: () => void }) {
  const name = employee.userId?.name || 'Unnamed employee';
  return (
    <ListRow
      left={{ avatar: { uri: employee.userId?.profileImage, name, id: employee._id } }}
      title={name}
      subtitle={[employee.employeeId, employee.designation].filter(Boolean).join(' · ')}
      meta={employee.department?.dep_name ?? 'No department'}
      right={employee.isActive === false ? <StatusPill status="Inactive" accessibilityPrefix="Account" /> : undefined}
      chevron={!!onPress}
      onPress={onPress ?? (() => router.push(`/admin/employees/${employee._id}`))}
    />
  );
}

function EmployeesList({ headerExtra }: { headerExtra: ReactNode }) {
  const query = useEmployees();
  const [status, setStatus] = useState<ActiveFilter>('active');
  return (
    <SearchList<AdminEmployee>
      testID="employees-list"
      query={query}
      headerExtra={headerExtra}
      filters={
        <SegmentedControl<ActiveFilter>
          accessibilityLabel="Account status filter"
          value={status}
          onChange={setStatus}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
            { label: 'All', value: 'all' },
          ]}
        />
      }
      filter={(e) => (status === 'all' ? true : status === 'active' ? e.isActive !== false : e.isActive === false)}
      matches={(e, q) =>
        includesAny(q, e.userId?.name, e.employeeId, e.userId?.email, e.department?.dep_name, e.designation)
      }
      searchPlaceholder="Search name, code, email, department"
      keyExtractor={(e) => e._id}
      renderItem={(e) => <EmployeeRow employee={e} />}
      summary={(all) => (
        <AppText variant="secondary">
          {all.filter((e) => e.isActive !== false).length} active · {all.filter((e) => e.isActive === false).length} inactive
        </AppText>
      )}
      emptyTitle="No employees yet"
      emptyMessage="Add the first employee to get started."
      addLabel="Add employee"
      onAdd={() => router.push('/admin/employees/new')}
    />
  );
}

export function managerLine(d: DepartmentItem): string {
  if (!d.manager || d.managerStatus === 'unassigned') return 'Manager not assigned';
  if (d.managerStatus === 'invalid') return `${d.manager.name} — no longer eligible, reassign`;
  return `Manager: ${d.manager.name}`;
}

export function DepartmentsList({ headerExtra }: { headerExtra?: ReactNode }) {
  const query = useDepartments();
  return (
    <SearchList<DepartmentItem>
      testID="departments-list"
      query={query}
      headerExtra={headerExtra}
      matches={(d, q) => includesAny(q, d.dep_name, d.manager?.name, d.description)}
      searchPlaceholder="Search departments or managers"
      keyExtractor={(d) => d._id}
      renderItem={(d) => (
        <ListRow
          left={{ icon: 'business-outline' }}
          title={d.dep_name}
          subtitle={managerLine(d)}
          meta={`${d.memberCount} active ${d.memberCount === 1 ? 'member' : 'members'}`}
          onPress={() => router.push(`/admin/departments/${d._id}`)}
        />
      )}
      emptyTitle="No departments yet"
      emptyMessage="Create a department, add employees to it, then assign its manager."
      addLabel="Add department"
      onAdd={() => router.push('/admin/departments/new')}
    />
  );
}
