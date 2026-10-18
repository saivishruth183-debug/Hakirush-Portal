# Mobile admin operations (agent: mobile-admin-ops)

Scope: admin Home, Attendance, Requests and More tabs, plus the attendance report, holidays,
announcements and notifications screens in `Mobile/`. Every screen calls the real backend; there are no placeholders and no fake data.
No git commands were run, no packages were installed, and no shared files were edited (`queryKeys.ts`, `types/api.ts`, `components/`, `admin/_layout.tsx`).

## Files

- `src/features/admin/ops/`
  - `types.ts`: response shapes, taken from the controllers.
  - `keys.ts`: feature-local keys derived from `useQueryKeys()`.
  - `api.ts`: calls.
  - `format.ts`: status, employee and date helpers.
  - `export.ts`: XLSX/CSV row builders, base64 file write, and share.
  - `components.tsx`: FilterChips, StatTile, View-based BarChart, LoadMoreFooter, InlineNotice.
  - `notifications/NotificationsScreen.tsx`.
  - `holidays/{HolidaysScreen,HolidayFormScreen}.tsx`.
  - `announcements/{AnnouncementsScreen,AnnouncementFormScreen}.tsx`.
- `src/features/admin/home/`: `AdminHomeScreen.tsx`, `NotificationBell.tsx`, `summaryCsv.ts`.
- `src/features/admin/attendance/`: `AdminAttendanceScreen.tsx`, `AttendanceEmployeeScreen.tsx`, `AttendanceReportScreen.tsx`.
- `src/features/admin/requests/`: `AdminRequestsScreen.tsx`, `hooks.ts`, `LeaveDetailScreen.tsx`, `CorrectionDetailScreen.tsx`, `reviewErrors.ts`, `__tests__/adminOps.test.tsx`.
- `src/features/admin/more/AdminMoreScreen.tsx`.
- Routes (thin):
  - `src/app/admin/attendance-report.tsx`
  - `attendance/[employeeId].tsx`
  - `leaves/[id].tsx`
  - `corrections/[id].tsx`
  - `holidays/{index,new}.tsx`
  - `announcements/{index,new}.tsx` and `announcements/[id]/edit.tsx`
  - `notifications.tsx`

  The existing tab routes are unchanged and now render the real screens.

## Parity

| Web (component → action) | Native route | Endpoint | Status | Test evidence |
|---|---|---|---|---|
| AdminSummary: attendance counters | /admin (Home) | GET /attendance/admin/summary (refetched every 60 s while focused) | Done (+ late logins, off-day banner) | typecheck/lint |
| AdminSummary: totals, birthdays, 5 pie charts (plans, sponsors, stalls, departments, leave) | /admin | GET /dashboard/summary | Done; the pie charts became horizontal bars built from Views, each with a text value and percentage | — |
| AdminSummary: Export CSV | /admin | toCsv → writePrivateTextFile → shareFile | Done; the export covers more metrics than the web's 3 rows (birthdays are left out because they are personal data) | — |
| AdminSummary: notification bell, mark seen, deep link | Home header bell → /admin/notifications | GET /notifications, PATCH /:id/seen, PATCH /seen-all | Done (+ mark all, pagination) | — |
| Pending leave / correction counts | Home, Requests segments, Attendance button | GET /leave?status=Pending&limit=1, GET /attendance-request?status=Pending&limit=1 (`total`) | Done | — |
| AdminAttendance: today list, search, counts, live timer | /admin/attendance | GET /attendance | Done; the status filter chips show counts, and the live time refreshes every 30 s | — |
| AttendanceHelper: manual status | /admin/attendance/[employeeId] | PUT /attendance/update/:employeeId `{status, date}` | Done; asks for confirmation, accepts a date up to today, shows the audit fields | adminOps.test (confirm + body) |
| Employee monthly attendance | /admin/attendance/[employeeId] | GET /attendance/user/:id/monthly?month=YYYY-MM | Done | covered by the same test (load) |
| AdminAttendanceReport: day view, search | /admin/attendance-report | GET /attendance/report?date / month / from&to, search | Done (+ month and date-range modes, grouped by employee) | — |
| AdminAttendanceReport: Download Excel | /admin/attendance-report | SheetJS aoa_to_sheet → base64 → File.write(base64) → share (xlsx MIME) | Done (+ CSV) | adminOps.test (rows, XLSX read-back, CSV) |
| AdminLeaveTable: list, status filter, search | /admin/requests (Leave) | GET /leave?status&page&limit | Done; uses pagination, and search runs on the pages already loaded | — |
| LeaveDetails: detail, balance, approve/reject | /admin/leaves/[id] | GET /leave/detail/:id, GET /leave/balance/:employeeId, PUT /leave/:id `{status}` | Done (+ confirmation, 409 ALREADY_REVIEWED → refetch, over-balance warning) | adminOps.test (approve, cancel, 409) |
| AdminAttendanceRequests: tabs, search, review with remarks | /admin/requests (Corrections) → /admin/corrections/[id] | GET /attendance-request?status&page&limit, PUT /:id/review `{decision, remarks?}` | Done (+ confirmation, reviewer/audit fields, 409 → refetch) | adminOps.test (remarks, 409) |
| HolidayList / AddHolidays | /admin/holidays, /admin/holidays/new | GET /holiday/all, POST /holiday/add, DELETE /holiday/:id | Done; holidays are grouped into upcoming and past, and only upcoming ones can be deleted (same as the web) | adminOps.test (validation) |
| AdminAnnouncement / EditAnnouncement | /admin/announcements, /new, /[id]/edit | GET /announcements, GET /:id, POST /add, PUT /:id (multipart `image`), DELETE /:id | Done (+ seen counts, image preview, pickImage converts to JPEG) | — |
| Sidebar links | /admin/more | — | Links to /admin/departments, /admin/clients, /admin/sponsors and /admin/stalls (built by the mobile-admin-people agent), the report, holidays, announcements, notifications, change password and sign out | — |

## Decisions

- **Leave days.** The server-computed `days` is shown as is. The web recomputes days on the client.
- **Report exports.**
  - Exports use the same 8 columns as the web.
  - Day rows that are synthesized as `Holiday` show the holiday or weekend label.
  - Real records on off days keep their real status. The web replaced all of them with the label.
  - Formula prefixes are neutralised with `'`. Numbers stay numbers.
- **Correction detail.** There is no GET-by-id endpoint for corrections, so the detail screen looks the request up in `GET /attendance-request?employeeId=` (the list passes `employeeId`). It falls back to the full list when `employeeId` is missing.
- **Announcement titles.** Titles are not forced to uppercase (the web does this). An image can be replaced but not removed; the backend has no endpoint for removing it.
- **Reviewer display.** `reviewedBy` is an id that the server does not populate, so the screen shows "You" or "Another admin".

## Open issues

- The leave list has no server-side search, so search only covers the pages already loaded. The footer says so and offers "Load more".
- The web's month filter on the leave table is not reproduced. The list is ordered newest first instead.
- `GET /attendance` has no `serverTime`, so live worked time uses the device clock.
- I have not verified the XLSX share on a device. `File.write(base64, {encoding: 'base64'})` matches the SDK 57 typings.

## Test evidence (Mobile/)

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors. 1 warning, in another agent's `src/features/client/__tests__/ClientScreens.test.tsx` (unused eslint-disable). |
| `npx jest src/features/admin --runInBand` | 2 suites, 17 tests passed; 10 of them are mine in `adminOps.test.tsx` |
| `npx jest src/navigation --runInBand` | 3 tests passed against the real route tree, including the new routes |
