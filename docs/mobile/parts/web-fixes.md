# Web fixes (agent: web-fixes)

Scope: `Frontend/**` only (React 19 + Vite + React Router). No dependencies added, app structure unchanged.
Coded against `docs/mobile/API_CONTRACT.md`; response shapes were spot-checked (read-only) against the in-progress
`Backend/` controllers on 2026-10-01 (team/me, eligible-managers, client me/roster|gallery|performance, admin
gallery/performance, payslip link/download, employee deactivate `clearManager`) and matched.

## Files changed

New
- `Frontend/.env.example` — placeholder `VITE_BACKEND_URL=https://api.example.com`.
- `Frontend/src/utils/apiError.js` — reads the `{error, code, details}` envelope (`apiErrorMessage`, `apiErrorCode`, `isNetworkError`, `isConfirmedAuthFailure`, `SESSION_ENDING_CODES`).
- `Frontend/src/utils/SessionUnavailable.jsx` — "can't verify session" screen (token kept, Retry / Sign out).
- `Frontend/src/utils/payslipFiles.js` — `openPayslip` (GET `/payslip/:id/link`), `downloadPayslip` (GET `/payslip/:id/download` as blob), `payslipHasFile`.
- `Frontend/src/components/client/ClientMediaAdmin.jsx` — admin gallery manager + standings editor.

Modified
- `src/context/authContext.jsx`, `src/utils/PrivateRoutes.jsx`, `src/utils/RootRedirect.jsx`, `src/utils/RoleBaseRoutes.jsx` (removed `console.log` of the user object)
- `src/pages/Login.jsx`, `src/pages/Setting.jsx`
- `src/components/EmpolyeeDashboard/EmployeeSummary.jsx`, `EditEmployeeProfile.jsx`
- `src/components/attendance/AdminAttendance.jsx`, `AdminAttendanceRequests.jsx`, `EmployeePunch.jsx`, `src/utils/AttendanceHelper.jsx`
- `src/components/departments/AddDepartments.jsx`, `EditDepartment.jsx`, `DepartmentList.jsx`, `DepartmentEmployees.jsx`, `src/utils/DepartmentHelper.jsx`
- `src/components/employee/EmployeeList.jsx`, `EmployeeEdit.jsx`, `EmployeeAdd.jsx`, `src/utils/EmployeeHelper.jsx`
- `src/components/ClientDashboard/ClientSummary.jsx`, `ClientRelationship.jsx`
- `src/components/client/ClientView.jsx`
- `src/components/payslips/ViewPayslip.jsx`, `AddPayslip.jsx`
- `src/utils/StallHelper.jsx`, `SponsorHelper.jsx`, `ClientHelper.jsx` (delete errors now show `response.data.error`)

## Decisions

1. **Session handling (web).** Token stays in `localStorage` (`token`). A non-sensitive snapshot of the verified user
   (`_id, name, role, profileImage, isActive, employeeId, designation, employeeRecordId, departmentId, departmentName, clientId`;
   no email) is cached under `hakirush_user_snapshot`.
   - `/auth/verify` 401 (any code) or 403 `ACCOUNT_INACTIVE` → clear token + snapshot, sign out, message shown on /login.
   - Network error / timeout (15 s) / 5xx / 503 → keep token, use cached snapshot, `offline=true`, `sessionError` set,
     a small "Retry" banner is shown; re-verifies on the browser `online` event. With no snapshot, protected routes show
     `SessionUnavailable` instead of redirecting to /login.
   - Context exposes `user, login, logout(message?), loading, offline, sessionError, retryVerify`.
   - Axios **response** interceptor: an authenticated backend call that returns 401 `SESSION_REVOKED|TOKEN_EXPIRED|TOKEN_INVALID`
     or 403 `ACCOUNT_INACTIVE` signs out (only if the request carried the *current* token; `/api/auth/*` excluded so a wrong
     password never logs anyone out). Other 401 codes (e.g. a component that forgot the header → `AUTH_REQUIRED`) do not.
   - Axios **request** interceptor: attaches `Authorization: Bearer` to requests whose URL starts with `VITE_BACKEND_URL` and
     lack it (never to other hosts, never in URLs; login excluded). Every existing call already sends the header explicitly.
2. **RootRedirect**: role map admin/employee/client; unknown role → /login.
3. **Login**: shows `response.data.error` for `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `RATE_LIMITED`/429; distinct
   network-error and 5xx messages; `login(user, token)` only on success; double-submit guarded.
4. **Setting**: body is only `{oldPassword, newPassword}` (no `userId`); min length 8 client-side; on `reauthRequired:true`
   calls `logout("Password changed…")` and navigates to /login, where the message is displayed.
5. **EmployeeSummary**: `fetchData` deps are now `[userId, calendarMonth]` (was `[user, calendarMonth, deptEmployees]` →
   self-retriggering loop); widgets load with `Promise.allSettled` so one failing endpoint no longer blanks the dashboard.
   Team widget is a separate `fetchTeam` (GET `/employee/team/me?page=1&limit=100`): manager row first with "Manager" badge,
   members with "You" badge (`isSelf`), `managerStatus` `unassigned` → "Manager not assigned", `no_department` →
   "Department not assigned", loading / error+Retry states, "Showing the first N" when `hasMore`. Birthdays/anniversaries
   use `monthDay` ("MM-DD") with fallback to legacy `dob`/`joiningDate`; `years` used when present; names fall back safely.
6. **AdminAttendance**: removed the dead `handleStatusChange` (POST `/attendance/admin-mark`). Active workflow remains
   `AttendanceHelper` → PUT `/attendance/update/:employeeId` (wired at both desktop and mobile rows); it now alerts the server
   error instead of failing silently. Removed unused `checkIn/checkOut` props from the helper signature.
7. **Departments**: Create sends only `{dep_name, description}` with a note that the manager is assigned later.
   Edit loads `/department/:id` + `/department/:id/eligible-managers`; `<select>` with "No manager" + options
   "name · employeeCode · designation" (+ the current manager labelled "no longer eligible" if it is not in the list).
   PUT sends `expectedUpdatedAt` (the loaded `updatedAt`) always and `managerEmployeeId` (id or `null`) **only when the
   admin changed it** (contract field is optional; avoids re-validating an unchanged, now-invalid manager).
   409 `STALE_UPDATE` shows the server message + Reload button; other errors show `error` (+ string `details`).
   List shows a Manager column ("Not assigned", or "No longer eligible – reassign" when `managerStatus:"invalid"`) and member
   count; delete 409 `DEPARTMENT_NOT_EMPTY` shows the server message. Department roster marks the manager (from
   `isManager` or the department's `managerEmployeeId`), sorts the manager first, shows "Inactive" when reported.
8. **Employees**: action relabelled "Deactivate" (UserX icon) with confirmation text "…no longer able to sign in… Payroll,
   attendance and leave history are retained"; hidden when the row is already inactive. 409
   `MANAGER_REASSIGNMENT_REQUIRED` → `window.confirm` → resend `DELETE` with JSON body `{clearManager:true}` (backend also
   accepts query). EmployeeEdit: same 409 handling, resend multipart with `clearManager="true"` (backend `parseBoolean`
   accepts the string). Active/Inactive chip + status dot when `isActive`/`userId.isActive` is present. List refreshes after
   deactivation (refresh callback was previously never passed). EmployeeAdd never sends `manager`.
9. **Self-service profile**: sends only the allowlist (name, experience, dob, bloodGroup, maritalStatus, aadharcard,
   pancard, pfNumber, profileImage) — it already did; Employee ID / Department / Designation rendered read-only with an
   explanatory note; 403 `FIELD_NOT_EDITABLE` shown inline; load failure (e.g. 403) shows a message instead of a blank page.
10. **Client dashboard**: no longer downloads `GET /client` (admin list). Uses `/client/me`, `/client/me/performance`,
    `/client/me/gallery`, `/announcements/public` (allSettled). 404 on `/client/me` → existing "Access Pending"; other
    errors → Retry. Header shows plan + budget (removed fake "Status: Online"). Gallery shows real images with captions or
    "No gallery images yet". Standings sorted by points then wins, or "No standings published yet". Removed the
    hard-coded "Last Month Tournament Images" / "March Highlights" carousels that displayed `cricket.png` as data; the
    asset is no longer imported anywhere (bundle no longer ships the 1.7 MB PNG).
11. **Client roster** (`ClientRelationship`): persisted via GET/POST `/client/me/roster`, DELETE `/client/me/roster/:entryId`;
    loading/error/Retry states, submit + delete disabled while in flight, server errors shown. Fields kept: `name`,
    `jerseySize`. The original form had the jersey-size `<select>` duplicated (two selects bound to the same field, one
    mislabelled "Event Type"); the duplicate was removed.
12. **Admin client detail** (`ClientView` → `ClientMediaAdmin`): client-only gallery upload (short-lived ImageKit upload credentials, direct upload up to 50 MB, then backend-verified `fileId` + optional `caption`,
    JPEG/PNG/WebP/GIF), list, delete (confirm); shared month-tagged gallery management (visible to all clients for the previous calendar month); standings table editor (add/remove rows; teamName/played/won/lost/points;
    client-side checks mirror the server: required name, non-negative integers, unique names, won+lost ≤ played) →
    PUT `/client/:id/performance`; shows `updatedAt`.
13. **Payslips**: ViewPayslip and the AddPayslip history no longer open `payslipFile`. View = GET `/payslip/:id/link` then open
    the signed URL (tab opened synchronously first to avoid popup blockers, `opener` nulled); Download = GET
    `/payslip/:id/download` with the Authorization header as a blob. Buttons disabled when `hasFile` is false. The row is no
    longer a `<button>` containing pseudo-buttons. AddPayslip now has inputs for every model input field (basicSalary, hra,
    conveyanceAllowance, medicalAllowance, otherAllowances, bonus, reimbursements, overtimeHours, overtimeRate,
    providentFund, professionalTax, incomeTax, lossOfPay, otherDeductions, paymentStatus [default "Paid" = previous
    server default], optional paymentDate) — previously conveyance/medical/professionalTax were in state with no input and
    otherAllowances/overtime/otherDeductions/reimbursements/paymentStatus were never sent. `month` is `YYYY-MM`. PDF only
    (MIME `application/pdf` or empty + `.pdf` extension), ≤ 5 MB. The live panel is labelled "Estimate (preview)" and now
    uses the server formula; after posting, the server-returned `overtimePay/grossSalary/totalDeductions/netSalary` are shown.
14. **Other components** (item 12): every `axios` call to `/api/*` sends `Authorization` (verified by a script that scans each
    call; AdminSummary uses a shared `config`; stalls already did). Error alerts in Stall/Sponsor/Client delete, attendance
    request review (409 `ALREADY_REVIEWED` also refreshes the list) and punch actions (409 `INVALID_TRANSITION` resyncs from
    `details.attendance`) now show `response.data.error` instead of generic text.

## Test evidence

All commands run in `/Users/saitejaveeramalla/hakirushportal/Frontend`.

| Command | Result |
|---|---|
| `npm run lint` (baseline, before changes) | `✖ 41 problems (38 errors, 3 warnings)` |
| `npm run lint` (after) | `✖ 20 problems (19 errors, 1 warning)` — remaining items are in files not touched (AdminAnnouncement, AdminSummary, HolidayList, EmployeeLeaveAdd, EmployeeLeaveList, SponsorView, AdminDashboard, sidebarContext) or pre-existing `react-refresh/only-export-components` on exported helpers/hooks (authContext `useAuth`, Client/Employee/Sponsor/StallHelper). No new lint problem introduced. |
| `npx eslint <each touched file>` | clean except the pre-existing `only-export-components` items above |
| `npm run build` | `✓ built in ~0.55s`; `dist/assets/index-*.js 1,566.69 kB` (gzip 432 kB), CSS 112.68 kB; cricket.png no longer emitted. Only the pre-existing >500 kB chunk-size warning. |
| `npx vite --port 5179 --strictPort` (spawned by a small node script, then killed) | `ROLLDOWN-VITE v7.2.5 ready in 145 ms`; `GET /` 200 (has `#root`), `GET /src/main.jsx` 200, `GET /src/components/client/ClientMediaAdmin.jsx` 200, `GET /src/components/EmpolyeeDashboard/EmployeeSummary.jsx` 200; port 5179 free afterwards. |

Not done: no browser/E2E testing and no run against a live backend (none was required); behaviour against the new
endpoints is verified by reading the contract and the in-progress backend controllers only.

## Feature parity (web routes in `Frontend/src/App.jsx`)

Status: **Existing** = behaviour unchanged by this agent; **Fixed** = changed here. Validation: L = lint clean for the file
(excluding pre-existing only-export-components), B = included in passing production build, C = endpoints/shapes checked
against contract (+ backend source where noted above). No route was browser-tested.

| Route | Component | Endpoints used | Role | Status | Validation |
|---|---|---|---|---|---|
| `/` | RootRedirect | (auth context) | any | Fixed (employee + unknown role) | L B |
| `/login` | Login | POST /auth/login | public | Fixed | L B C |
| (all guarded routes) | PrivateRoutes / RoleBaseRoutes / authContext | POST /auth/verify (+ interceptors) | any | Fixed | L B C |
| `/admin-dashboard` | AdminSummary | GET /dashboard/summary, /attendance/admin/summary, /notifications; PATCH /notifications/:id/seen | admin | Existing | B |
| `/admin-dashboard/departments` | DepartmentList (+DepartmentHelper) | GET /department; DELETE /department/:id | admin | Fixed | L B C |
| `/admin-dashboard/add-department` | AddDepartments | POST /department/add | admin | Fixed | L B C |
| `/admin-dashboard/department/:id` | EditDepartment | GET /department/:id, GET /department/:id/eligible-managers, PUT /department/:id | admin | Fixed | L B C |
| `/admin-dashboard/department/:id/employees` | DepartmentEmployees | GET /employee/department/:id/employees, GET /department/:id | admin | Fixed | L B C |
| `/admin-dashboard/employees` | EmployeeList (+EmployeeHelper) | GET /employee; DELETE /employee/:id (deactivate, `clearManager`) | admin | Fixed | L B C |
| `/admin-dashboard/add-employee` | EmployeeAdd | GET /department; POST /employee/add | admin | Fixed (no `manager`) | L B C |
| `/admin-dashboard/employees/:id` | EmployeeView | GET /employee/:id | admin | Existing | B |
| `/admin-dashboard/employees/edit/:id` | EmployeeEdit | GET /department, GET /employee/:id, PUT /employee/:id (`clearManager`) | admin | Fixed | L B C |
| `/admin-dashboard/employees/payslip/:id` | AddPayslip | GET /payslip/employee/:id, POST /payslip/add, GET /payslip/:id/link | admin | Fixed | L B C |
| `/admin-dashboard/clients` | ClientList (+ClientHelper) | GET /client; DELETE /client/:id | admin | Existing (delete error text Fixed) | B |
| `/admin-dashboard/add-client` | ClientAdd | POST /client/add | admin | Existing | B |
| `/admin-dashboard/clients/:id` | ClientView + ClientMediaAdmin | GET /client/:id; GET/POST /client/:id/gallery; DELETE /client/:id/gallery/:imageId; GET/PUT /client/:id/performance | admin | Fixed (gallery + standings added) | L B C |
| `/admin-dashboard/clients/edit/:id` | ClientEdit | GET/PUT /client/:id | admin | Existing | B |
| `/admin-dashboard/leaves` | AdminLeaveTable | GET /leave, GET /holiday/all | admin | Existing | B |
| `/admin-dashboard/leaves/:id` | LeaveDetails | GET /leave/detail/:id, /holiday/all, /leave/balance/:employeeId; PUT /leave/:id | admin | Existing | B |
| `/admin-dashboard/employees/leaves/:id` | EmployeeLeaveList | GET /leave/:id/:role, /holiday/all; PUT /leave/cancel/:id | admin | Existing | B |
| `/admin-dashboard/attendance` | AdminAttendance (+AttendanceHelper) | GET /attendance, GET /attendance-request?status=Pending, PUT /attendance/update/:employeeId | admin | Fixed (dead admin-mark removed) | L B C |
| `/admin-dashboard/attendance-report` | AdminAttendanceReport | GET /attendance/report | admin | Existing | B |
| `/admin-dashboard/attendance-requests` | AdminAttendanceRequests | GET /attendance-request, PUT /attendance-request/:id/review | admin | Fixed (error/409 handling) | L B C |
| `/admin-dashboard/holidays` | HolidayList | GET /holiday/upcoming, DELETE /holiday/:id | admin | Existing | B |
| `/admin-dashboard/add-holiday` | AddHoliday | POST /holiday/add | admin | Existing | B |
| `/admin-dashboard/sponsors` | SponsorList (+SponsorHelper) | GET /sponsors, DELETE /sponsors/:id | admin | Existing (delete error text Fixed) | B |
| `/admin-dashboard/add-sponsor` | SponsorAdd | POST /sponsors/add | admin | Existing | B |
| `/admin-dashboard/sponsors/:id` | SponsorView | GET /sponsors/:id | admin | Existing | B |
| `/admin-dashboard/sponsors/edit/:id` | SponsorEdit | GET/PUT /sponsors/:id | admin | Existing | B |
| `/admin-dashboard/stalls` | StallList (+StallHelper) | GET /stalls, DELETE /stalls/:id (auth header sent) | admin | Existing (delete error text Fixed) | B C |
| `/admin-dashboard/add-stall` | StallAdd | POST /stalls (auth header sent) | admin | Existing | B C |
| `/admin-dashboard/stalls/:id` | StallView | GET /stalls/:id (auth header sent) | admin | Existing | B C |
| `/admin-dashboard/stalls/edit/:id` | StallEdit | GET/PUT /stalls/:id (auth header sent) | admin | Existing | B C |
| `/admin-dashboard/announcement` | AdminAnnouncement | GET /announcements, POST /announcements/add, DELETE /announcements/:id | admin | Existing | B |
| `/admin-dashboard/announcement/edit/:id` | EditAnnouncement | GET/PUT /announcements/:id | admin | Existing | B |
| `/employee-dashboard` | EmployeeSummary (+EmployeePunch) | GET /employee/team/me, /holiday/all, /announcements/public, /leave/:userId/employee, /employee/birthdays, /attendance/user/:userId/monthly, /employee/anniversaries, /employee/new/recent, /notifications, /attendance-request/me, /attendance/today/me, /holiday/upcoming; POST /attendance/{check-in,pause,resume,check-out}, /attendance-request; DELETE /attendance-request/:id; PUT /announcements/:id/read; PATCH /notifications/:id/seen | employee, admin | Fixed | L B C |
| `/employee-dashboard/profile/:id` | EmployeeProfile | GET /employee/:id | employee (self), admin | Existing | B |
| `/employee-dashboard/profile/:id/edit` | EditEmployeeProfile | GET /employee/:id, PUT /employee/update-profile/:id | employee (self), admin | Fixed | L B C |
| `/employee-dashboard/leaves/:id` | EmployeeLeaveList | GET /leave/:id/:role, /holiday/all; PUT /leave/cancel/:id | employee | Existing | B |
| `/employee-dashboard/add-leave` | EmployeeLeaveAdd | GET /holiday/all, /leave/:userId/employee; POST /leave/add | employee | Existing | B |
| `/employee-dashboard/payslips/:id` | ViewPayslip | GET /employee/:id, GET /payslip/employee/:employeeRecordId, GET /payslip/:id/link, GET /payslip/:id/download | employee (self), admin | Fixed | L B C |
| `/employee-dashboard/setting` | Setting | PUT /setting/change-password | employee, admin | Fixed | L B C |
| `/client-dashboard` | ClientSummary | GET /client/me, /client/me/performance, /client/me/gallery, /announcements/public | client | Fixed | L B C |
| `/client-dashboard/ourrelationship/:id` | ClientRelationship | GET/POST /client/me/roster, DELETE /client/me/roster/:entryId (`:id` param unused) | client | Fixed (now persisted) | L B C |
| `/client-dashboard/setting` | Setting | PUT /setting/change-password | client | Fixed | L B C |
| `/unauthorized` | Unauthorized | — | any | Existing | B |

## Open issues

- No browser/E2E verification and no run against a live backend; all new-endpoint behaviour is contract-based.
- Remaining lint debt (19 errors, 1 warning) is original; the `react-refresh/only-export-components` errors need hooks/helpers
  split into separate files (would touch many imports, left as is).
- Bundle is still a single ~1.57 MB JS chunk (pre-existing; no code-splitting added).
- Web stays on the legacy long-lived web token (`WEB_TOKEN_TTL`, default 10 d) in `localStorage`; there is no refresh flow on
  web, so `TOKEN_EXPIRED` signs the user out.
- `ViewPayslip` resolves the employee via GET `/employee/:id` before listing payslips (works for self and admin); it does not
  use the new GET `/payslip/me`.
- Department manager selector loads all eligible managers in one list (no search); fine for small departments.
- The employee team widget requests `limit=100` and shows "Showing the first N members" if `hasMore`; no pagination UI.
- `EmployeeView` (admin) does not yet show active/inactive or offer reactivation (PATCH `/employee/:id/status` exists in the
  contract but has no web UI).
- `EmployeeEdit` department change offers only "clear manager assignment", not `replacementManagerEmployeeId`.
