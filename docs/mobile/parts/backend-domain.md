# Backend: attendance, corrections, leave, payslips, client content, scheduled jobs (agent: backend-domain)

Scope: authorization and correctness for the attendance punch clock, attendance correction requests, leave, payslips
(private PDF storage), client self-service content and the day-close job. Express 5 + Mongoose 9 (ESM), Node 26.4.0.
No packages installed. Coded against `docs/mobile/API_CONTRACT.md`; every row I touched was updated in place.
Nothing was run against a real database, ImageKit account or Vercel project.

## Files changed

New
- `Backend/services/clock.js`: server clock (`now()`); tests pin it with `setClock()`.
- `Backend/services/businessCalendar.js`: org-timezone calendar helpers (stored date → `YYYY-MM-DD`, holiday map, working days, approved-leave lookup, off-day labels).
- `Backend/services/employeeScope.js`: `getEmployeeForUser`, `findEmployeeByAnyId`, `resolveEmployeeForCaller` (admin any / employee self, legacy ids = Employee._id or userId).
- `Backend/services/idempotency.js`: `Idempotency-Key` claim/replay.
- `Backend/services/attendanceService.js`: punch state machine, monthly/today/summary/report builders.
- `Backend/services/leaveService.js`: day calculation, entitlement period, balance, overlap lookup.
- `Backend/services/payslipFiles.js`: private upload, fail-closed signed link, hardened PDF fetch, test hooks.
- `Backend/middleware/pdfUpload.js`: PDF upload guard (memory, 5 MB, single `payslip` field, `%PDF-` signature).
- `Backend/models/IdempotencyRecord.js` (TTL 48 h, unique userId+key), `ClientRosterEntry.js`, `ClientGalleryImage.js`, `ClientStanding.js`.
- `Backend/scripts/migrateLegacyPayslips.js`: legacy payslip inventory/dry run, `--apply`, `--apply --retire-public`. **Not run against any real DB/ImageKit.**
- Tests: `Backend/tests/attendance.test.js`, `corrections.test.js`, `leave.test.js`, `payslip.test.js`, `payslipMigration.test.js`, `client.test.js`, helper `Backend/tests/helpers/domain.js`.

Modified
- Controllers: `attendanceController`, `attendanceRequestController`, `leaveController` (export `getLeaveBalance` kept), `payslipController`, `clientController`.
- Routes: `attendanceRoute`, `attendanceRequestRoutes`, `leaveRoute`, `payslipRoutes`, `clientRoute`.
- Models (additive only): `Attendance`, `AttendanceRequest`, `Leave`, `Payslip`. `Client` unchanged.
- `Backend/middleware/defaultAttendance.js`: now a no-op (see decisions); no longer mounted.
- `Backend/utils/attendanceCron.js` (`closeAttendanceDay`, `requireCronSecret`, `startAttendanceCron` default export kept), `utils/attendanceStatus.js` (helpers appended; `buildAttendanceForEmployee` unchanged), `utils/uploadToImageKit.js` (options param + injectable client; default return unchanged).
- `Backend/vercel.json`: `crons` entry.
- `Backend/tests/attendanceStatus.test.js`: 4 tests appended (original 3 untouched).
- `docs/mobile/API_CONTRACT.md`: Clients, Attendance, Corrections, Leave, Payslips rows; error codes `FILE_UNAVAILABLE`(502), `JOB_DISABLED`(503), `LEGACY_FILE_NOT_MIGRATED`(409).
- Outside my list (minimal, reported): `Backend/utils/validate.js` `requireYmd` now rejects impossible dates such as `2026-02-30` (2 lines; it was included in commit 4878a0e by the coordinator). `Backend/app.js` was **not** touched (the job route lives in the attendance router).

## Decisions (with reasons)

**Attendance punch clock**
- Server owns every timestamp (`services/clock.js`); business date = `utils/orgTime.businessDate(now)` in `ORG_TIMEZONE` — never server-local or the UTC date string.
- Transitions are `findOneAndUpdate` with preconditions (compare-and-swap); concurrent requests/devices produce exactly one transition:
  - check-in: placeholder upsert (unique `{employeeId,date}` absorbs races), then `checkIn:null, checkOut:null` → set. Repeat (also after check-out) → existing record, `alreadyApplied:true`.
  - pause: `checkIn≠null, checkOut=null, isPaused≠true`. Repeat → keeps original `pauseStartedAt`.
  - resume: CAS on the exact `pauseStartedAt`; adds `now − pauseStartedAt` once. Repeat/not paused → `alreadyApplied:true`, no double count.
  - check-out: CAS on `checkOut=null` + pause state; worked = checkOut − checkIn − totalPausedMs − open pause. Repeat → original `checkOut`.
  - Invalid → 409 `INVALID_TRANSITION`, `details: {attendance, serverTime}`.
- Check-in over a pre-filled row for today (e.g. an `Absent` row created by the old cron at 00:30) starts a live session and resets status to `""`; status is decided at check-out. Reason: the old cron pre-marked everyone Absent for the current day, so working employees showed as Absent.
- Status thresholds kept exactly: ≥ 8 h Present, ≥ 4 h Half Day, else Absent (`getStatusFromHours`). Admin/correction statuses store nominal hours 8/4/0/0 (same values the original code used).
- `Idempotency-Key` (optional): first request claims `{userId,key}` (unique), 2xx responses are stored 48 h (TTL) and replayed with `Idempotent-Replayed: true`; same key for a different action → 409 `CONFLICT`; non-2xx results are not stored (transitions are idempotent anyway); a concurrent duplicate waits ≤ 2 s for the first to finish; a pending claim older than 30 s is treated as abandoned.
- `defaultAttendance` removed from `GET /attendance`: it wrote placeholder rows on a GET (misspelled `staus`, UTC date). Verified that `getAttendance` already synthesizes missing records via `buildAttendanceForEmployee`; the file is kept as a no-op for any stale import.
- Views (`/attendance`, `/me/monthly`, `/user/:userId/monthly`, `/report`) use the same rules as `buildAttendanceForEmployee`: approved leave → Leave; record as stored (past open check-in → Absent); no record → Holiday on weekend/holiday, else Absent. Monthly entries add `dayType`/`holidayName`; synthesized entries carry their own `date`. Previously monthly synthesized Absent on weekends and the report ignored leave (the web handles off days itself, so this is additive for it).
- Admin today list/summary exclude deactivated accounts (they are former employees after retention-safe deactivation); the report keeps them only on days with real records. Populated users expose `name email profileImage isActive` only.
- Late login = check-in at/after 10:00 **org time** (was server-local hour).
- Admin manual status: `PUT /attendance/update/:employeeId` only (no `admin-mark`). Accepts `Halfday`/`half day` aliases because the web `AttendanceHelper` still sends `Halfday` (previously stored an invalid enum value with no hours). Optional `date` ≤ today. Audit: `source:"admin"`, `hoursSource:"admin"`, `updatedBy`, `adminUpdatedAt`. Absent/Leave still clear the punch session (original behaviour).
- Report span bounded to 366 days; with no range it covers the last ≤ 366 days from the earliest joining date (was unbounded since joining).

**Corrections**
- `currentStatus` is derived on the server from the attendance record (client value ignored). Date must be `YYYY-MM-DD` and not in the future (org date). Reason ≤ 500.
- One Pending request per employee/date: app check + DB partial unique index `uniq_pending_request_per_employee_date` (`{employeeId,date,status}` where `status:"Pending"`, a different key pattern so it coexists with the old `{employeeId,date}` index). Concurrent duplicates → one 201, rest 409.
- Review is an atomic `Pending → Approved|Rejected` update; a second review → 409 `ALREADY_REVIEWED`. Approval sets `status`, nominal `workedHours`, `source/hoursSource:"correction"`, `correctionRequestId`, `correctedBy`, `correctedAt`; real punches are untouched (`punchedHours` records measured hours); no 09:00–17:00 timestamps are fabricated (the old code wrote an 8 h interval even for Half Day). If the attendance write fails the request is reverted to Pending (no transactions: tests use a standalone mongod).
- Delete: owner + Pending only (atomic `findOneAndDelete`); other owner → 404, reviewed → 409 `INVALID_TRANSITION`.
- Notifications keep the existing recipient fields: admins `data.adminId` (one per active admin, type `attendance-request`), employee `data.userId` (type `attendance-request-status`); `requestId`/`employeeId`/`status` added.

**Leave**
- Days computed server-side only (client `days` ignored): inclusive working days excluding Saturday, Sunday and Holiday dates — the same rule as `EmployeeLeaveAdd.jsx`, `LeaveDetails.jsx` and the old `calculateNetWorkDays`, now in org calendar dates instead of server-local time. A range with 0 working days → 400. Max 60 calendar days per application. Days are recomputed on approval with the current holiday calendar (original behaviour).
- Overlap: a new application overlapping the employee's Pending/Approved leave → 409 `CONFLICT` (new; the original allowed double-booking).
- Balance: 12 Casual + 12 Sick = 24 (original constants) minus approved days in the entitlement period. Default period = calendar year of the current org date (`LEAVE_ENTITLEMENT_PERIOD=calendar-year`); `LEAVE_ENTITLEMENT_PERIOD=all-time` reproduces the original all-time sum. Leaves crossing the period boundary count only their in-period working days. No carry-forward. Response adds `total` and `period` (existing `casual`/`sick` shape kept).
- Balance is reported (`exceedsBalance` on apply), **not enforced** (the web blocks client-side; enforcement is a policy decision).
- Cancel (employee owner only): Pending always; Approved only if the start date is after today's org date; otherwise 409 `INVALID_TRANSITION`. Admin cancel via this route was removed (admins review with `PUT /leave/:id`). Cancellation notifies the employee (`leave-status`, as before) and admins (`leave-request`, `data.status:"Cancelled"`).
- Review: atomic Pending-only, `{status: Approved|Rejected}`; second → 409 `ALREADY_REVIEWED`; audit `reviewedBy/reviewedAt`.
- Legacy `GET /leave/:id/:role`: the `:role` segment is ignored; authority from `req.user`.

**Payslips**
- `pdfUpload("payslip")`: memory storage, 5 MB (413 `FILE_TOO_LARGE`), single file in `payslip` (other field → 400), `%PDF-` signature (415 `UNSUPPORTED_FILE`). Auth + admin role run before parsing.
- Totals computed on the server from validated finite non-negative numbers (`basicSalary` > 0, overtime hours ≤ 744): `overtimePay = overtimeHours × overtimeRate`, gross = basic + hra + conveyance + medical + other allowances + bonus + reimbursements + overtimePay, deductions = PF + PT + income tax + LOP + other (same formula as before); client totals ignored. Month `YYYY-MM`; employee must exist (Employee._id or userId); duplicate employee+month → 409 (app check + unique index `uniq_payslip_employee_month`).
- New uploads: private ImageKit files (`isPrivateFile:true`), record marked `storage:"private"` with `fileId/filePath`; if the DB write fails the upload is deleted.
- **Fail closed** (external review): only `storage:"private"` records with a `filePath` get a signed link/download. Legacy records (public URL, no marker — including records with a `filePath` but no marker) → 409 `LEGACY_FILE_NOT_MIGRATED` on `/link` and `/download`; the stored URL is never returned or fetched. Lists add `fileMigrationRequired`.
- Responses never include `fileId/filePath/legacyUrl/storage`. Employees never get `payslipFile`; admin items get `payslipFile` only as a ≤ 5-min signed URL for private files (keeps the admin history link working).
- `/download` fetch hardening: only the exact `IMAGEKIT_URL_ENDPOINT` origin + path prefix (no `*.imagekit.io` fallback, https, no credentials), `redirect:"manual"` with any 3xx treated as an error, 5 MB enforced while streaming (reader aborted once the running count passes the limit; `content-length` only used for early rejection), `%PDF-` check, 15 s timeout → 502 `FILE_UNAVAILABLE`. Ownership is checked before any network call (other employee → 404).
- `uploadToImageKit(file, folder, options)`: `options.isPrivateFile`, `options.fileName`, `options.returnDetails` → `{url, fileId, filePath}`; default return (URL string, `""` without a file) unchanged; failures throw `ApiError(502, "Image upload failed", "UPLOAD_FAILED")` (same message as before). `setImageKitClient()` swaps the SDK in tests.

**Client content**
- `GET /client/me` fixed (uses `req.user._id`, safe populated fields). `GET /client` is admin-only (the web ClientSummary now uses `/client/me`). `GET /client/:id`: admin or owner (another client → 404).
- Roster (`ClientRelationship.jsx` fields): `name` 1–80 chars, `jerseySize` ∈ XS/S/M/L/XL/XXL (case-insensitive), ≤ 200 entries per client (409).
- Gallery: admin uploads multipart `image` with the shared `middleware/upload.js` (used as-is) to ImageKit folder `client-gallery`; caption ≤ 200; ≤ 200 images; delete removes the ImageKit file best-effort.
- Standings: admin PUT replaces the table; ≤ 50 rows, non-negative integers ≤ 100000, `won + lost ≤ played`, unique team names (case-insensitive). The hardcoded sample standings were removed — `[]` until data is entered.
- Legacy `/client/images` and `/client/performance`: client → own data (`?userId` ignored); admin → `?userId` required. `/client/images` keeps `images` as an array of URLs (web shape) plus `items`.
- Client delete removes the user, client, roster, gallery (+ files) and standings.

**Scheduler**
- `closeAttendanceDay({now, lookbackDays=7})` (idempotent): closes open check-ins from previous business days that have no explicit Present/Half Day/Leave status (Absent, 0 h, pause cleared, checkIn kept, `source:"system"`, `autoClosedAt`), and upserts Absent rows for the previous `lookbackDays` working days (not weekend/holiday) for active employees who had joined, are not on approved leave and have no record. Upserts on the unique `{employeeId,date}` index ⇒ re-runs and concurrent runs create no duplicates.
- Differences from the original cron (documented): it used the server-local date; created Absent rows for **today** at 00:30 (before anyone could check in), including weekends, holidays, approved leave and deactivated users; and re-reset days whose status had been set explicitly (e.g. by an approved correction) on every run.
- `startAttendanceCron()` (long-lived hosts; `index.js` unchanged): `30 0 * * *` with node-cron `timezone: ORG_TIMEZONE`, `noOverlap`.
- `POST|GET /api/attendance/jobs/close-day` guarded by `Authorization: Bearer $CRON_SECRET` (timing-safe compare); 401 if missing/wrong; 503 `JOB_DISABLED` if `CRON_SECRET` is unset or shorter than 16 chars. GET is supported because Vercel Cron sends GET with that bearer header.
- `vercel.json`: `"crons": [{"path": "/api/attendance/jobs/close-day", "schedule": "0 19 * * *"}]` — Vercel schedules are UTC; 19:00 UTC = 00:30 IST. Must be changed if `ORG_TIMEZONE` changes.

## Business-policy gaps that need the owner
1. **Leave entitlement period**: provisional calendar year (Jan–Dec, org timezone). Alternatives: financial year (Apr–Mar), joining anniversary, all-time (original behaviour, env switch available).
2. **Carry-forward / encashment**: none applied.
3. **Balance enforcement**: server reports `exceedsBalance` but does not block; negative balances are possible (as before).
4. **Overlap**: Pending/Approved overlap now rejected (new rule). Confirm half-day leave is not needed (days are whole working days).
5. **Cancellation**: Approved leave cancellable only before its start date; no partial cancellation of an ongoing leave.
6. **Overnight shifts**: a session belongs to the business date of its check-in. After midnight (org time) pause/resume/check-out target the new date and return 409; the open session is closed as Absent by the day-close job. Needs a policy (e.g. allow closing yesterday's session until a cutoff).
7. **Present 8 h / Half Day 4 h thresholds** kept pending decision; nominal 8/4 h for admin/correction statuses.
8. **Check-in on weekends/holidays/approved leave**: the server allows it (as before); the web blocks weekends/holidays client-side only.
9. **Late login** threshold 10:00 org time (original value).
10. **Admin Absent/Leave** clears that day's punches (original behaviour) — confirm or switch to keeping punches with an override.
11. **Corrections**: allowed for any past date (including weekends/holidays and before the joining date); only Present/Half Day can be requested.
12. **ORG_TIMEZONE** `Asia/Kolkata` provisional; the Vercel cron time is tied to it.
13. **Day-close lookback** 7 days (max 31) — confirm how far back Absent rows should be back-filled.
14. **Leave span** max 60 days; past-dated applications allowed (retroactive sick leave).

## Test evidence
All runs on this machine, Node v26.4.0, in-memory MongoDB (`tests/helpers/testEnv.js`), ImageKit and fetch mocked.

| Command (from `Backend/`) | Result |
|---|---|
| `npm test` (= `node --test --test-concurrency=1 tests/*.test.js`) | **tests 141, suites 24, pass 141, fail 0, cancelled 0, skipped 0** (whole backend suite incl. other agents' tests) |
| `node --test --test-concurrency=1 tests/attendanceStatus.test.js` | 7 pass / 0 fail (original 3 + 4 new) |
| `node --test --test-concurrency=1 tests/attendance.test.js` | 15 pass / 0 fail |
| `node --test --test-concurrency=1 tests/corrections.test.js` | 6 pass / 0 fail |
| `node --test --test-concurrency=1 tests/leave.test.js` | 6 pass / 0 fail |
| `node --test --test-concurrency=1 tests/payslip.test.js` | 7 pass / 0 fail |
| `node --test --test-concurrency=1 tests/payslipMigration.test.js` | 4 pass / 0 fail |
| `node --test --test-concurrency=1 tests/client.test.js` | 6 pass / 0 fail |

My tests: 51 (7 + 15 + 6 + 6 + 7 + 4 + 6). Note: the original script form `node --test tests/` fails on Node 26 ("Cannot find module …/tests"); the coordinator changed the script to the glob form.

Covered: full journey check-in → pause → resume → check-out (45 min pause, 8.00 h Present); double pause keeps `pauseStartedAt`; double resume no double count; double check-out keeps original; check-out while paused; Half Day / Absent thresholds; invalid transitions 409 with details; concurrent check-in (8×) / pause / resume / check-out (5×) → one transition; Idempotency-Key replay, cross-action reuse 409, invalid key 400, concurrent same key, abandoned/fresh pending claims; 23:30 vs 00:30 IST business dates (same UTC date); monthly ownership (403 for another user by userId and by Employee._id), validation, leave/holiday/weekend/open-check-in statuses; role gates; admin list/summary org date, inactive excluded, late logins, weekend; admin manual status incl. `Halfday`, future date, bad ids; report bounds; close-day rules + idempotency + concurrent runs; CRON_SECRET guard (503/401/200, POST and GET); legacy placeholder row + missing `totalPausedMs`. Corrections: validation, derived status, duplicate 409 (sequential + concurrent), approve audit with null punches and 8 h, Half Day keeps real punches (4 h, `punchedHours` 2), second/concurrent review 409, scoped lists/pagination, delete rules, notifications. Leave: server days (holiday + weekend excluded, client days/userId ignored), invalid inputs incl. `2026-02-30`, overlap 409, atomic/concurrent review, notifications, calendar-year balance vs all-time, scoped balance, cancel rules, legacy role segment ignored, detail ownership. Payslips: 415/413/field/auth-before-parse, server totals, numeric/month/employee/duplicate validation, own vs other (403 list, 404 link/download), signed link TTL ≤ 300 s, download headers + `redirect:"manual"`, upstream 404 / non-PDF → 502, legacy fail-closed 409 for link and download (employee and admin, URL never returned or fetched), redirect to unapproved host rejected, chunked > 5 MB body aborted (≤ 7 MB read), declared oversize rejected, exactly 5 MB accepted, origin allowlist unit checks. Migration: dry run (no writes/network, no URLs in report), apply (private re-upload, `legacyUrl` kept, foreign/broken untouched, served afterwards, idempotent), oversized/redirected downloads rejected, `--retire-public` requires `--apply` and deletes only an exact single public match, once. Client: `/me`, admin-only list, cross-client 404, admin-only mutations, roster validation/persistence/isolation/cap, gallery upload (folder, 415 non-image, 403 client), `?userId` ignored for clients, standings empty → validated replace → isolation, add-client validation, cascade delete leaving client B intact.

Not run: web build/lint, mobile app, any real MongoDB/ImageKit/Vercel, the migration CLI, the in-process node-cron schedule firing (only the job function and HTTP trigger are tested).

## Feature parity (original web screen/action → endpoint → role → status → validation)
| Web screen / action | Endpoint | Role | Status | Validation |
|---|---|---|---|---|
| EmployeePunch: load today | GET /attendance/today/me | employee | Fixed | attendance.test.js (journey, IST boundary) |
| EmployeePunch: check-in / pause / resume / check-out | POST /attendance/{check-in,pause,resume,check-out} | employee | Fixed | attendance.test.js (journey, concurrency, idempotency, 409s) |
| EmployeeSummary: calendar | GET /attendance/user/:userId/monthly?month&year | employee (self), admin | Fixed | attendance.test.js (monthly) |
| Mobile: own month | GET /attendance/me/monthly?month=YYYY-MM | employee | Added | attendance.test.js (monthly) |
| AdminAttendance: today list | GET /attendance | admin | Fixed | attendance.test.js (role gates, admin list) |
| AttendanceHelper: mark status | PUT /attendance/update/:employeeId | admin | Fixed | attendance.test.js (manual status) |
| AdminAttendance: dead admin-mark | POST /attendance/admin-mark | — | Blocked (not added, per contract) | route absent |
| AdminSummary: today counters | GET /attendance/admin/summary | admin | Fixed | attendance.test.js (summary) |
| AdminAttendanceReport: day view / month export | GET /attendance/report?date / ?month&year | admin | Fixed | attendance.test.js (report) |
| Day-close job | POST/GET /attendance/jobs/close-day (+ in-process cron) | cron secret | Added | attendance.test.js (close-day ×2) |
| EmployeeSummary: request correction | POST /attendance-request | employee | Fixed | corrections.test.js |
| EmployeeSummary: my requests / withdraw | GET /attendance-request/me, DELETE /attendance-request/:id | employee | Fixed | corrections.test.js |
| AdminAttendance(Requests): list / pending count | GET /attendance-request[?status] | admin | Fixed | corrections.test.js |
| AdminAttendanceRequests: approve/reject | PUT /attendance-request/:id/review | admin | Fixed | corrections.test.js |
| EmployeeLeaveAdd: apply | POST /leave/add | employee | Fixed | leave.test.js |
| EmployeeLeaveAdd / EmployeeSummary / EmployeeLeaveList: history | GET /leave/:id/:role | employee (self), admin | Fixed | leave.test.js (reads scoped) |
| Mobile: own leaves | GET /leave/me | employee | Added | leave.test.js |
| EmployeeLeaveList: cancel | PUT /leave/cancel/:id | employee (owner) | Fixed | leave.test.js (cancel) |
| AdminLeaveTable | GET /leave | admin | Fixed | leave.test.js |
| LeaveDetails: detail / balance / approve-reject | GET /leave/detail/:id, GET /leave/balance/:employeeId, PUT /leave/:id | admin (detail/balance also owner) | Fixed | leave.test.js |
| Balance (me + employee alias) | GET /leave/balance/me, /employee/leave/balance/me | employee | Fixed | leave.test.js (balance) |
| AddPayslip: post + history | POST /payslip/add, GET /payslip/employee/:id | admin | Fixed | payslip.test.js |
| ViewPayslip / AddPayslip: view / download | GET /payslip/:id/link, GET /payslip/:id/download | admin, owner | Added | payslip.test.js |
| Mobile: own payslips | GET /payslip/me | employee | Added | payslip.test.js |
| Legacy payslip files | scripts/migrateLegacyPayslips.js | operator | Added | payslipMigration.test.js (not run on real data) |
| ClientSummary: profile | GET /client/me | client | Fixed | client.test.js |
| ClientSummary: performance / gallery | GET /client/me/performance, /client/me/gallery (legacy /client/performance, /client/images) | client (admin for legacy ?userId) | Added / Fixed | client.test.js |
| ClientRelationship: roster | GET/POST /client/me/roster, DELETE /client/me/roster/:entryId | client | Added | client.test.js |
| ClientList / ClientAdd / ClientEdit / delete | GET /client, POST /client/add, GET/PUT/DELETE /client/:id | admin (GET /:id also owner) | Fixed | client.test.js |
| ClientView + ClientMediaAdmin | GET/POST /client/:id/gallery, DELETE /client/:id/gallery/:imageId, GET/PUT /client/:id/performance | admin | Added | client.test.js |

## Migration / rollback notes
- All schema changes are additive (new optional fields, new collections, new indexes). Old documents keep working: missing audit fields read as null; missing `totalPausedMs` is handled by the check-out CAS.
- New fields: Attendance `source, hoursSource, punchedHours, updatedBy, adminUpdatedAt, correctionRequestId, correctedBy, correctedAt, autoClosedAt` (+ `""` allowed in the status enum, which is what the old upserts already stored); Leave `reviewedBy, reviewedAt, cancelledBy, cancelledAt`; Payslip `storage, fileId, filePath, isPrivateFile, legacyUrl, migratedAt, legacyRetiredAt, createdBy`.
- New collections: `idempotencyrecords` (TTL 48 h), `clientrosterentries`, `clientgalleryimages`, `clientstandings`.
- New indexes (built by Mongoose autoIndex on start): `uniq_pending_request_per_employee_date` (AttendanceRequest, partial unique), `uniq_payslip_employee_month` (Payslip, unique), Leave `{employeeId,status,startDate}`, Idempotency `{userId,key}` unique + TTL, ClientStanding `clientId` unique. **Before deploy**, check for existing duplicates, otherwise those two unique indexes fail to build (Mongoose logs the error; the app-level 409 checks still work):
  - `db.attendancerequests.aggregate([{$match:{status:"Pending"}},{$group:{_id:{e:"$employeeId",d:"$date"},n:{$sum:1}}},{$match:{n:{$gt:1}}}])`
  - `db.payslips.aggregate([{$group:{_id:{e:"$employee",m:"$month"},n:{$sum:1}}},{$match:{n:{$gt:1}}}])`
- **Legacy payslips** become unreadable through the API (409 `LEGACY_FILE_NOT_MIGRATED`) until migrated. Run `node --env-file=.env scripts/migrateLegacyPayslips.js` (dry run), then `--apply`, verify a few downloads, then `--apply --retire-public`. Retirement deletes the old public object only when exactly one public file has the exact same path. Output never prints URLs.
- Vercel: set `CRON_SECRET` (≥ 16 random chars) in the project; Vercel Cron then sends `GET /api/attendance/jobs/close-day` with the bearer header. Without it the endpoint answers 503 and nothing runs. Vercel Hobby runs crons once a day within the scheduled hour; the job is idempotent and back-fills 7 days, so timing drift is harmless.
- Rollback: reverting code is safe for attendance/leave/client (old code ignores new fields; drop new collections/indexes if desired). **Payslip caveat:** migrated records have `payslipFile` pointing at the private copy, which old code cannot open; restore with `payslipFile = legacyUrl` for records where `legacyRetiredAt` is null (do not run `--retire-public` until rollback is no longer needed). Uploads made by the new code are private and would also be unreadable by old code.
- Existing `Absent` rows for "today" created by the old cron are overridden by a check-in.

## Open issues / owner inputs
- Policy items 1–14 above.
- The correction approval updates two documents without a transaction (compensating revert instead); MongoDB Atlas supports transactions if stronger guarantees are wanted.
- Leave overlap and roster/gallery caps are app-level checks; two truly simultaneous requests could slip past them (low risk).
- `GET /leave` and `GET /attendance-request` without `page`/`limit` return up to 2000/1000 rows (web compatibility); mobile should paginate.
- Web: `AttendanceHelper` still sends `"Halfday"` (accepted). The web should show the 409 `LEGACY_FILE_NOT_MIGRATED` message (and may use `fileMigrationRequired` to label legacy rows).
- `utils/validate.js` stricter `requireYmd` (impossible dates rejected) affects every caller — intended.
- Not verified: real ImageKit private-file signing/upload behaviour, Vercel cron delivery, production index builds.
