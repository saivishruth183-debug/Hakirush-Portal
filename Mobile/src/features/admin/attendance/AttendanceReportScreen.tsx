import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  DateField,
  Icon,
  QueryStateView,
  Screen,
  SearchBar,
  SegmentedControl,
  SelectField,
  StatusPill,
  type SegmentOption,
} from '@/components';
import { InlineNotice } from '@/features/admin/ops/components';
import { buildAttendanceCsv, buildAttendanceSheetAoa, exportCsv, exportXlsx } from '@/features/admin/ops/export';
import { compareCodes, displayAttendanceStatus, formatHours, offDayLabel } from '@/features/admin/ops/format';
import { useAdminOpsKeys } from '@/features/admin/ops/keys';
import type { ReportResponse, ReportRow } from '@/features/admin/ops/types';
import { useDebouncedValue, useNow } from '@/hooks';
import { useApiQuery } from '@/services/hooks';
import { useTheme } from '@/theme';
import { computeWorkedMs } from '@/utils/attendanceTimer';
import { businessDate, formatDate, formatDateLong, formatMonth, formatTime, recentMonths } from '@/utils/format';

type Mode = 'day' | 'month' | 'range';
const MODES: readonly SegmentOption<Mode>[] = [
  { label: 'Day', value: 'day' },
  { label: 'Month', value: 'month' },
  { label: 'Date range', value: 'range' },
];
const MAX_SPAN_DAYS = 366;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export interface EmployeeGroup {
  employeeRecordId: string;
  code: string;
  name: string;
  department: string;
  rows: ReportRow[];
  counts: Record<string, number>;
  totalHours: number;
}

/** groupData (by date) → one group per employee, days ascending, groups by employee code. */
export function groupReportByEmployee(report: Pick<ReportResponse, 'groupData'>): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>();
  for (const date of Object.keys(report.groupData).sort()) {
    for (const r of report.groupData[date] ?? []) {
      let g = map.get(r.employeeRecordId);
      if (!g) {
        g = { employeeRecordId: r.employeeRecordId, code: r.employeeId, name: r.employeeName, department: r.departmentName, rows: [], counts: {}, totalHours: 0 };
        map.set(r.employeeRecordId, g);
      }
      g.rows.push(r);
      const label = displayAttendanceStatus(r).label;
      g.counts[label] = (g.counts[label] ?? 0) + 1;
      g.totalHours += Number(r.workedHours) || 0;
    }
  }
  return [...map.values()].sort((a, b) => compareCodes(a.code, b.code));
}

/** /admin/attendance-report — day / month / range report with XLSX and CSV export. */
export function AttendanceReportScreen() {
  const theme = useTheme();
  const opsKeys = useAdminOpsKeys();
  const today = useMemo(() => businessDate(), []);
  const months = useMemo(() => recentMonths(24), []);
  const [mode, setMode] = useState<Mode>('day');
  const [day, setDay] = useState<string | null>(today);
  const [month, setMonth] = useState(months[0]);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(today);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 400);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const now = useNow(30_000);

  let rangeError: string | null = null;
  let params: Record<string, string | undefined> | null = null;
  if (mode === 'day') params = day ? { date: day } : null;
  else if (mode === 'month') params = { month };
  else if (from && to) {
    if (to < from) rangeError = 'The end date must be on or after the start date.';
    else if (daysBetween(from, to) > MAX_SPAN_DAYS) rangeError = `Choose a range of at most ${MAX_SPAN_DAYS} days.`;
    else params = { from, to };
  }
  const queryParams = params ? { ...params, search: debounced || undefined } : null;

  const query = useApiQuery<ReportResponse>(opsKeys.attendanceReport(queryParams ?? {}), '/api/attendance/report', {
    query: queryParams ?? undefined,
    enabled: !!queryParams,
  });

  const groups = useMemo(() => (query.data ? groupReportByEmployee(query.data) : []), [query.data]);
  const dayRows = useMemo(() => {
    if (!query.data || mode !== 'day') return [];
    return Object.values(query.data.groupData)
      .flat()
      .sort((a, b) => compareCodes(a.employeeId, b.employeeId));
  }, [query.data, mode]);
  const rowCount = useMemo(() => (query.data ? Object.values(query.data.groupData).reduce((n, r) => n + r.length, 0) : 0), [query.data]);

  const fileBase = !query.data
    ? 'Attendance'
    : mode === 'month'
      ? `Attendance_${month}`
      : query.data.from === query.data.to
        ? `Attendance_${query.data.from}`
        : `Attendance_${query.data.from}_to_${query.data.to}`;

  const runExport = async (kind: 'xlsx' | 'csv') => {
    if (!query.data) return;
    setExporting(true);
    try {
      if (kind === 'xlsx') await exportXlsx(`${fileBase}.xlsx`, buildAttendanceSheetAoa(query.data));
      else await exportCsv(`${fileBase}.csv`, buildAttendanceCsv(query.data));
    } finally {
      setExporting(false);
    }
  };

  const liveWorked = (r: ReportRow) =>
    r.date === today && r.checkIn && !r.checkOut ? formatHours(computeWorkedMs(r, 0, now) / 3_600_000) : formatHours(r.workedHours);

  const header = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <SegmentedControl options={MODES} value={mode} onChange={setMode} accessibilityLabel="Report period" />
      {mode === 'day' ? <DateField label="Date" value={day} onChange={setDay} maximumDate={today} /> : null}
      {mode === 'month' ? (
        <SelectField label="Month" value={month} onChange={setMonth} options={months.map((m) => ({ label: formatMonth(m), value: m }))} />
      ) : null}
      {mode === 'range' ? (
        <>
          <DateField label="From" value={from} onChange={setFrom} maximumDate={to ?? today} required />
          <DateField label="To" value={to} onChange={setTo} minimumDate={from ?? undefined} maximumDate={today} required error={rangeError} />
        </>
      ) : null}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name or employee code" accessibilityLabel="Search the report" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <Button
          label="Export Excel"
          icon="download-outline"
          fullWidth={false}
          onPress={() => runExport('xlsx')}
          disabled={!query.data || rowCount === 0 || exporting}
          testID="export-xlsx"
        />
        <Button
          label="Export CSV"
          icon="document-outline"
          variant="secondary"
          fullWidth={false}
          onPress={() => runExport('csv')}
          disabled={!query.data || rowCount === 0 || exporting}
          testID="export-csv"
        />
      </View>
      {query.data ? (
        <AppText variant="secondary">
          {formatDate(query.data.from)}
          {query.data.from !== query.data.to ? ` – ${formatDate(query.data.to)}` : ''} · {rowCount} rows
          {mode !== 'day' ? ` · ${groups.length} employees` : ''}
        </AppText>
      ) : null}
      {mode === 'day' && query.data && day ? (() => {
        const off = offDayLabel(day, query.data.holidayMap);
        return off ? <InlineNotice icon="sunny-outline" message={`${off} — off day.`} /> : null;
      })() : null}
    </View>
  );

  const body = !queryParams ? (
    <FlatList
      data={[]}
      renderItem={null}
      contentContainerStyle={{ padding: theme.spacing.lg }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <AppText variant="body" color="textSecondary" align="center">
          {rangeError ?? 'Choose the dates for the report.'}
        </AppText>
      }
    />
  ) : mode === 'day' ? (
    <FlatList
      data={dayRows}
      keyExtractor={(r) => `${r.date}-${r.employeeRecordId}`}
      extraData={now}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      ListHeaderComponent={header}
      ListEmptyComponent={<ReportEmpty loading={query.isPending} />}
      renderItem={({ item }) => <DayRowCard row={item} worked={liveWorked(item)} holidayMap={query.data?.holidayMap} />}
    />
  ) : (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.employeeRecordId}
      extraData={expanded}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      ListHeaderComponent={header}
      ListEmptyComponent={<ReportEmpty loading={query.isPending} />}
      renderItem={({ item }) => (
        <EmployeeGroupCard
          group={item}
          expanded={!!expanded[item.employeeRecordId]}
          onToggle={() => setExpanded((e) => ({ ...e, [item.employeeRecordId]: !e[item.employeeRecordId] }))}
          holidayMap={query.data?.holidayMap}
          worked={liveWorked}
        />
      )}
    />
  );

  return (
    <Screen scroll={false} padded={false}>
      <Stack.Screen options={{ title: 'Attendance report' }} />
      {queryParams && query.isError && !query.data ? (
        <QueryStateView query={query}>{() => null}</QueryStateView>
      ) : (
        body
      )}
    </Screen>
  );
}

function ReportEmpty({ loading }: { loading: boolean }) {
  return (
    <AppText variant="body" color="textSecondary" align="center">
      {loading ? 'Loading report…' : 'No records found for this selection.'}
    </AppText>
  );
}

function statusFor(r: ReportRow, holidayMap: Record<string, string> | undefined) {
  const d = displayAttendanceStatus(r);
  if (d.filter === 'Holiday') return { ...d, label: offDayLabel(r.date, holidayMap) ?? 'Holiday' };
  return d;
}

function DayRowCard({ row, worked, holidayMap }: { row: ReportRow; worked: string; holidayMap?: Record<string, string> }) {
  const theme = useTheme();
  const s = statusFor(row, holidayMap);
  return (
    <Card>
      <View
        accessible
        accessibilityLabel={`${row.employeeName}, ${row.employeeId}, ${row.departmentName}, ${s.label}, check in ${formatTime(row.checkIn, 'none')}, check out ${formatTime(row.checkOut, 'none')}, worked ${worked}`}
        style={{ gap: 4 }}
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{row.employeeName}</AppText>
            <AppText variant="secondary">
              {row.employeeId} · {row.departmentName}
            </AppText>
          </View>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        <AppText variant="secondary">
          In {formatTime(row.checkIn)} · Out {formatTime(row.checkOut)} · Worked {worked}
        </AppText>
      </View>
    </Card>
  );
}

function EmployeeGroupCard({
  group,
  expanded,
  onToggle,
  holidayMap,
  worked,
}: {
  group: EmployeeGroup;
  expanded: boolean;
  onToggle: () => void;
  holidayMap?: Record<string, string>;
  worked: (r: ReportRow) => string;
}) {
  const theme = useTheme();
  const summary = Object.entries(group.counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
  return (
    <Card padded={false}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.name}, ${group.code}, ${group.department}. ${summary}. Total worked ${formatHours(group.totalHours)}`}
        accessibilityHint={expanded ? 'Hides the daily rows' : 'Shows the daily rows'}
        style={({ pressed }) => ({ padding: theme.spacing.lg, gap: 4, minHeight: theme.touchTarget, backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent', borderRadius: theme.radii.lg })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{group.name}</AppText>
            <AppText variant="secondary">
              {group.code} · {group.department}
            </AppText>
          </View>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color="textSecondary" />
        </View>
        <AppText variant="secondary">{summary}</AppText>
        <AppText variant="caption">Total worked {formatHours(group.totalHours)}</AppText>
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.sm }}>
          {group.rows.map((r) => {
            const s = statusFor(r, holidayMap);
            const w = worked(r);
            return (
              <View
                key={r.date}
                accessible
                accessibilityLabel={`${formatDateLong(r.date)}, ${s.label}, in ${formatTime(r.checkIn, 'none')}, out ${formatTime(r.checkOut, 'none')}, worked ${w}`}
                style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm, gap: 2 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {formatDateLong(r.date)}
                  </AppText>
                  <StatusPill label={s.label} tone={s.tone} />
                </View>
                <AppText variant="secondary">
                  In {formatTime(r.checkIn)} · Out {formatTime(r.checkOut)} · {w}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
