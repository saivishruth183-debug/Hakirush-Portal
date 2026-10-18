# Mobile employee experience (agent: mobile-employee)

Scope: `Mobile/src/features/employee/**` and `Mobile/src/app/employee/**`. No shared files were edited (only existing query keys from `useQueryKeys()` are used, plus feature-local suffixes). No git, installs or native builds.

## Files
- `features/employee/types.ts`: feature-local response types. `format.ts`: monthDay, hours, ranges, `mediaUrl` (http(s) only), `maskId`.
- `team/EmployeeTeamScreen.tsx`, `team/teamSections.ts` (pure manager-first builder), `team/PersonRow.tsx`, `team/TeamPreviewCard.tsx`.
- `attendance/useTodayAttendance.ts` (shared hook: state machine, idempotent transitions, reconcile lock), `attendance/TodayAttendanceCard.tsx`, `attendance/EmployeeAttendanceScreen.tsx`, `attendance/CorrectionRequestScreen.tsx`.
- `home/EmployeeHomeScreen.tsx`.
- `leave/EmployeeLeaveScreen.tsx`, `leave/LeaveApplyScreen.tsx` (`validateLeave`), `leave/LeaveDetailScreen.tsx` (`canCancelLeave`).
- `more/EmployeeMoreScreen.tsx`, `profile/MyProfileScreen.tsx`, `profile/EditProfileScreen.tsx`.
- `payslips/PayslipsScreen.tsx` (list + detail), `payslips/payslipFile.ts` (download + share + error mapping).
- `notices/NoticesScreen.tsx` (list + detail), `holidays/HolidaysScreen.tsx`, `notifications/NotificationsScreen.tsx`.
- `testing/routerMock.ts` (test-only expo-router stub), `team/__tests__/EmployeeTeamScreen.test.tsx`.
- Routes (`app/employee/`): `attendance-request`, `leave-apply`, `leave-detail/[id]`, `profile`, `profile-edit`, `payslips`, `payslip/[id]`, `notices`, `notice/[id]`, `holidays`, `notifications`. Titles are set with `<Stack.Screen options>` inside the screens; `_layout.tsx` was not changed.

## Feature parity
| Web (route / component / action) | Native route / component | Endpoint | Status | Test evidence |
|---|---|---|---|---|
| EmployeeSummary team widget | `/employee/team` EmployeeTeamScreen; Home TeamPreviewCard | GET /api/employee/team/me (`search`, `page`, `limit`) | Implemented | EmployeeTeamScreen.test (5 tests) |
| EmployeePunch check-in/pause/resume/check-out | TodayAttendanceCard (Home and Attendance tab) | POST /api/attendance/{check-in,pause,resume,check-out} + Idempotency-Key; GET /api/attendance/today/me | Implemented | typecheck/lint only (follow-up) |
| EmployeeSummary calendar (monthly) | Attendance tab "History" | GET /api/attendance/me/monthly?month=YYYY-MM | Implemented | — |
| Correction request create / list / delete | `/employee/attendance-request`; Attendance tab "My requests" | POST, GET /me, DELETE /api/attendance-request/:id | Implemented | — |
| EmployeeLeaveList (list, cancel) | Leave tab, `/employee/leave-detail/[id]` | GET /api/leave/me, GET /api/leave/detail/:id, PUT /api/leave/cancel/:id | Implemented | — |
| Leave balance | Leave tab balance card | GET /api/leave/balance/me | Implemented | — |
| EmployeeLeaveAdd | `/employee/leave-apply` | POST /api/leave/add (server days + exceedsBalance shown after submit; 409 overlap message) | Implemented | — |
| EmployeeProfile | `/employee/profile` | GET /api/employee/me | Implemented (identity numbers masked, reveal toggle; salary shown as on web) | — |
| EditEmployeeProfile | `/employee/profile-edit` | PUT /api/employee/update-profile/:employeeRecordId (multipart `profileImage`, changed fields only) | Implemented (403 FIELD_NOT_EDITABLE explained; refreshUser + invalidations) | — |
| ViewPayslip (list, download) | `/employee/payslips`, `/employee/payslip/[id]` | GET /api/payslip/me; GET /api/payslip/:id/download → share sheet | Implemented (409 → "being migrated; contact HR") | — |
| Announcements widget + read marker | Home card, `/employee/notices`, `/employee/notice/[id]` | GET /api/announcements/public, GET /:id, PUT /:id/read | Implemented | — |
| Holidays | Home card, `/employee/holidays` | GET /api/holiday/upcoming, /api/holiday/all | Implemented | — |
| Notification bell | Home bell (unseen count), `/employee/notifications` | GET /api/notifications, PATCH /:id/seen, PATCH /seen-all | Implemented | — |
| Birthdays / anniversaries / new joiners | Home "Team highlights" (only when `directoryVerified`) | GET /api/employee/birthdays, /anniversaries, /new/recent | Implemented | — |
| Copy employee code | More tab | expo-clipboard | Implemented | — |
| Settings (change password, sign out) | More tab (existing AccountMenu) | existing | Implemented (foundation) | foundation tests |

## Decisions
- Team uses `useInfiniteQuery` keyed `[...keys.team({ search }), 'pages']`, so it stays under the department-scoped prefix and `keys.team()` still invalidates it. The page number is the page param, not part of the key. The Home preview uses `keys.team({ limit: 5 })`.
- The client also dedupes the team: the manager is never in the members list, and "You" appears once (only as the manager when the viewer is the manager). Rows can't be tapped and there are no call or chat buttons.
- Attendance: one idempotency key per tap. After a 409 or an uncertain failure (network, timeout, 5xx), a shared lock blocks every write until GET /today/me succeeds; if that refetch fails, "Check again" is shown. Nothing is replayed. The timer is `computeWorkedMs(server record, clock offset from serverTime)`, it only ticks while the screen is focused, and the record is refetched on focus, foreground and reconnect (`staleTime: 0`). Check-out asks for confirmation; check-in does not. Following the web, check-in is hidden on weekends and holidays, computed from the server business date and `/holiday/upcoming`.
- Correction date: today or earlier, which is the server rule (`date ≤ today`).
- Leave start date: today or later (web parity). The reason is required (web parity). Days are computed only by the server.
- Payslip "Open or share" downloads to the private cache and opens the share sheet. A cancelled share is not an error. If no app can take the PDF, the screen explains how to install a viewer.

## Open issues / follow-ups
- RNTL tests are still missing for: attendance state machine and 409 refetch, leave apply validation, and payslip share error mapping. The pure helpers they need already exist: `actionsForPhase`, `validateLeave`, `canCancelLeave`, `payslipErrorMessage`, `sharePayslipPdf`.
- `downloadToPrivateCache` returns only the HTTP status, so a 409 from the download is treated as LEGACY_FILE_NOT_MIGRATED. The list's `fileMigrationRequired` flag is checked before downloading.
- Not verified on a device yet: the Android share sheet with a PDF, the photo picker upload, and the DateField dialogs.
