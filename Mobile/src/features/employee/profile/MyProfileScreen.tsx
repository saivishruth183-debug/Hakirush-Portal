import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Card, DetailRow, IconButton, QueryStateView, Screen, SectionHeader } from '@/components';
import { useApiQuery } from '@/services/hooks';
import { useQueryKeys } from '@/services/queryKeys';
import type { OwnEmployeeResponse } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

import { maskId, mediaUrl } from '../format';

export function useMyEmployee() {
  const keys = useQueryKeys();
  return useApiQuery<OwnEmployeeResponse>(keys.myEmployee(), '/api/employee/me');
}

/** GET /api/employee/me — own HR record (fields the web own-profile shows, incl. salary). */
export function MyProfileScreen() {
  const router = useRouter();
  const q = useMyEmployee();
  const [reveal, setReveal] = useState(false);
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: 'My profile' }} />
      <QueryStateView query={q} errorTitle="Couldn't load your profile">
        {({ employee: e }) => {
          const id = (v?: string) => (reveal ? v : maskId(v));
          return (
            <>
              <Card>
                <View style={styles.row}>
                  <Avatar uri={mediaUrl(e.userId?.profileImage)} name={e.userId?.name ?? ''} id={e._id} size={72} />
                  <View style={styles.flex}>
                    <AppText variant="title">{e.userId?.name}</AppText>
                    <AppText variant="secondary">{[e.designation, e.department?.dep_name].filter(Boolean).join(' · ')}</AppText>
                    {e.managerOfDepartment ? <Badge label="Department manager" tone="primary" /> : null}
                  </View>
                </View>
                <Button label="Edit profile" variant="secondary" icon="create-outline" onPress={() => router.push('/employee/profile-edit')} />
              </Card>
              <SectionHeader title="Personal" />
              <Card>
                <DetailRow label="Email" value={e.userId?.email} />
                <DetailRow label="Date of birth" value={e.dob ? formatDate(e.dob) : ''} />
                <DetailRow label="Gender" value={e.gender} />
                <DetailRow label="Marital status" value={e.maritalStatus} />
                <DetailRow label="Blood group" value={e.bloodGroup ?? ''} />
                <DetailRow label="Experience" value={e.experience ? `${e.experience} years` : ''} />
              </Card>
              <SectionHeader title="Job" />
              <Card>
                <DetailRow label="Department" value={e.department?.dep_name} />
                <DetailRow label="Designation" value={e.designation} />
                <DetailRow label="Employee code" value={e.employeeId} />
                <DetailRow label="Joining date" value={e.dateOfJoining ? formatDate(e.dateOfJoining) : ''} />
              </Card>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <SectionHeader title="Identity" />
                </View>
                <IconButton
                  icon={reveal ? 'eye-off-outline' : 'eye-outline'}
                  accessibilityLabel={reveal ? 'Hide identity numbers' : 'Show identity numbers'}
                  onPress={() => setReveal((r) => !r)}
                />
              </View>
              <Card>
                <DetailRow label="Aadhaar" value={id(e.aadharcard)} />
                <DetailRow label="PAN" value={id(e.pancard)} />
                <DetailRow label="PF number" value={id(e.pfNumber)} />
              </Card>
              <SectionHeader title="Compensation" />
              <Card>
                <DetailRow label="Annual salary" value={typeof e.salary === 'number' ? formatCurrency(e.salary, { whole: true }) : ''} />
                <AppText variant="caption">Salary, department and designation are managed by HR.</AppText>
              </Card>
            </>
          );
        }}
      </QueryStateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1, gap: 4 },
});
