# Hakirush API Contract (shared by Web and Mobile)

Status legend: **Existing** (unchanged), **Fixed** (same path, authorization/validation tightened), **Added** (new endpoint).
Backend agents must implement exactly this, or update this file (and note it in their parts/*.md) if they must deviate.

## Conventions
- Base URL: `EXPO_PUBLIC_API_URL` (mobile) / `VITE_BACKEND_URL` (web). All paths below start with `/api`. Production must be HTTPS.
- Auth header: `Authorization: Bearer <accessToken>`. Tokens never go in URLs.
- Success: `{ "success": true, ... }`. Error: `{ "success": false, "error": "<human message>", "code": "<CODE>", "details"?: any }`.
- Error codes: `AUTH_REQUIRED`(401) `TOKEN_EXPIRED`(401) `TOKEN_INVALID`(401) `SESSION_REVOKED`(401) `INVALID_CREDENTIALS`(401) `REFRESH_INVALID`(401) `REFRESH_REUSED`(401) `ACCOUNT_INACTIVE`(403) `FORBIDDEN`(403) `FIELD_NOT_EDITABLE`(403) `NOT_FOUND`(404) `VALIDATION_ERROR`(400) `INVALID_ID`(400) `CONFLICT`(409) `INVALID_TRANSITION`(409) `ALREADY_REVIEWED`(409) `STALE_UPDATE`(409) `DEPARTMENT_NOT_EMPTY`(409) `LEGACY_FILE_NOT_MIGRATED`(409, payslip stored as a legacy public upload; not served until migrated) `MANAGER_REASSIGNMENT_REQUIRED`(409) `FILE_TOO_LARGE`(413) `UNSUPPORTED_FILE`(415) `RATE_LIMITED`(429) `INTERNAL`(500) `UPLOAD_FAILED`(502, image storage upload failed) `FILE_UNAVAILABLE`(502, stored payslip file could not be fetched) `AUTH_UNAVAILABLE`(503) `JOB_DISABLED`(503, scheduled-job endpoint without `CRON_SECRET`).
- Client session rule: 401 (any code) after a failed refresh, or 403 `ACCOUNT_INACTIVE` ⇒ sign out & clear private state. Network errors, timeouts and 5xx ⇒ keep the saved session (offline-unverified).
- Pagination: `?page=1&limit=20` (limit capped server-side, usually 100). Paged responses include `page`, `limit`, `total` (or `hasMore`).
- Business dates are `YYYY-MM-DD` in the organization timezone (`ORG_TIMEZONE`, default `Asia/Kolkata`). Instants are ISO-8601 UTC.

## ID glossary (never mix these)
| Name in API | Meaning |
|---|---|
| `userId` / `User._id` | Login account id |
| `employeeRecordId` / `Employee._id` | Employee HR record id |
| `employeeCode` / `Employee.employeeId` | Human-readable code, e.g. `HAKI0001` |
| `departmentId` / `Department._id` | Department id; `Employee.department` is the membership source of truth |
| `clientId` / `Client._id` | Client record id (linked to its own `User._id` via `Client.userId`) |
| `clientCode` / `Client.clientId` | Client-entered business identifier; display-only, distinct from `Client._id` |

Legacy routes that accept "employee id or user id" in `:id` keep doing so, but authority always comes from the authenticated user, never from ids in the body/query/path.

## SessionUser
```json
{ "_id": "userId", "name": "", "email": "", "role": "admin|employee|client", "profileImage": "", "isActive": true,
  "employeeId": "HAKI0001 (employee only, business code)", "designation": "(employee)", "employeeRecordId": "(employee)",
  "departmentId": "(employee, may be null)", "departmentName": "(employee)", "clientId": "(client)",
  "clientCode": "(client, user-entered business ID)" }
```

## Auth & session
| Method | Path | Role | Status | Contract |
|---|---|---|---|---|
| POST | /auth/login | public | Fixed | Web login. Body `{email,password}` → `{success, token, user: SessionUser}`. Token = legacy access JWT (`WEB_TOKEN_TTL`, default 10d) carrying `tv`. Uniform 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_INACTIVE` (only revealed after a correct password); rate-limited (429 `RATE_LIMITED`, shared with mobile/login: 10 failed attempts / 15 min per IP+email, 100 failed / 15 min per IP; successful logins don't count; `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_IP_MAX`). |
| POST | /auth/verify | any | Fixed | `{success, user: SessionUser}` |
| POST | /auth/mobile/login | public | Added | Body `{email,password,deviceName?}` → `{success, accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user}`. Access token 15 min (`ACCESS_TOKEN_TTL`) carrying `sid` (= session/family id), refresh 30 days (`REFRESH_TOKEN_TTL_DAYS`, sliding on each refresh). |
| POST | /auth/mobile/refresh | public | Added | Body `{refreshToken}` → same shape as mobile/login (rotated refresh token). Reuse of a rotated token revokes the whole family → 401 `REFRESH_REUSED`. Expired/unknown → 401 `REFRESH_INVALID`. Deactivated → 403 `ACCOUNT_INACTIVE`. tokenVersion mismatch → 401 `SESSION_REVOKED`. Concurrent refreshes with the same token: at most one request can claim it; any other presentation is reuse (401 `REFRESH_REUSED`) and revokes the family, which also invalidates the claimant's new tokens (it may itself get 401) — clients must single-flight refresh. Token from a logged-out family (incl. a refresh racing a logout) → 401 `REFRESH_INVALID`; after logout-all/password change → 401 `SESSION_REVOKED`. If the server fails between consuming the token and issuing the new one → 500, and the old token no longer works (sign in again). |
| POST | /auth/mobile/logout | public | Added | Body `{refreshToken}` → `{success}`; idempotent; revokes that refresh family. That device's access tokens stop working immediately (401 `SESSION_REVOKED`); other devices and web tokens are unaffected. |
| POST | /auth/logout-all | any | Added | Bumps `User.tokenVersion` and revokes all refresh tokens of the caller → `{success, reauthRequired: true}`. |
| PUT | /setting/change-password | any | Fixed | Body `{oldPassword,newPassword}`; target = authenticated user (body `userId` ignored). Min length 8 (max 72 bytes), must differ from old, optional `confirmPassword` must match; wrong old password → 400 `VALIDATION_ERROR` (not 401, so clients don't sign out). Bumps tokenVersion + revokes refresh tokens → `{success, reauthRequired: true}`. Never logs the body. |

Refresh tokens are opaque random strings; only their SHA-256 hash is stored (`RefreshToken` collection: userId, familyId, tokenHash, tokenVersion, expiresAt, revokedAt, revokedReason, replacedByHash, deviceName, lastUsedAt). Each mobile sign-in is a `RefreshSession` document (`_id` = familyId = access-token `sid`; userId, deviceName, revokedAt, revokedReason, lastUsedAt, expiresAt) that is **authoritative**: a refresh token or an access token with `sid` is valid only while its session is unrevoked (checked on every refresh and by the auth middleware on every request). Revocation sets the session's `revokedAt` first, then marks its tokens; a refresh inserts its child token and then re-checks the session, so no ordering leaves a usable token in a revoked session (no transactions needed). Mobile logout and reuse detection revoke one session; logout-all, password change and deactivation bump `tokenVersion` and revoke all sessions. Web tokens have no `sid` and are governed by `tokenVersion` only.

## Employees & team
| Method | Path | Role | Status | Contract |
|---|---|---|---|---|
| GET | /employee/team/me | employee | Added | See TeamResponse. Query: `search`, `page`, `limit` (≤100). Any department/user scope params are ignored. |
| GET | /employee/me | employee | Added | `{success, employee}` own full HR record (own salary etc. allowed), populated `userId{name,email,profileImage}`, `department{_id,dep_name}`, plus `managerOfDepartment` boolean. |
| GET | /employee/ | admin | Fixed | All employees (admin HR view). Adds `isActive`. Without `?page` returns the full array (web paginates client-side); with `?page&limit` (≤100) adds `page, limit, total`. |
| GET | /employee/:id | admin, self | Fixed | Admin any; employee only own record (`:id` = own Employee._id or own userId) else 403. |
| POST | /employee/add | admin | Fixed | Multipart `profileImage`. `role` forced to `employee` unless admin explicitly passes an allowed role; `manager` body field is ignored (manager is a Department assignment). Validated: email format (normalized, duplicate → 409 `CONFLICT`), `employeeId` unique (409), `department` must exist, `salary` finite ≥ 0, `password` ≥ 8 chars, enums `gender` (Male/Female/Other), `maritalStatus` (Single/Married/Divorced/Widowed), `bloodGroup`. `experience` is now saved. |
| PUT | /employee/:id | admin | Fixed | Department change of a department's current manager → 409 `MANAGER_REASSIGNMENT_REQUIRED` unless body has `clearManager: true` or `replacementManagerEmployeeId` (eligible, same old dept) — applied as one operation. |
| PUT | /employee/update-profile/:id | self, admin | Fixed | Self allowlist: `name, experience, dob, bloodGroup, maritalStatus, aadharcard, pancard, pfNumber` + file `profileImage`. Attempting to change `salary, department, designation, role, manager, employeeId, email, userId` → 403 `FIELD_NOT_EDITABLE` with `details.fields` (also `isActive`, `password`; unchanged values are ignored for web compatibility). Other employees' records → 403. Admin callers get the admin field set (same rules as `PUT /employee/:id`). |
| DELETE | /employee/:id | admin | Fixed | Retention-safe: deactivates (User.isActive=false, tokenVersion++, refresh revoked); payroll/attendance/leave history kept. Same manager rule as above (options may be sent in the JSON body or query string). Admin cannot deactivate their own account. → `{success, deactivated: true}` |
| PATCH | /employee/:id/status | admin | Added | Body `{isActive, clearManager?, replacementManagerEmployeeId?}` |
| GET | /employee/by-department/me | employee | Fixed | Legacy shape, safe fields only, same department, excludes caller: `{success, department:{_id,dep_name}, employees:[{_id, employeeId, designation, isManager, userId:{_id,name,profileImage}, department:{_id,dep_name}}]}` |
| GET | /employee/department/:id/employees | admin, same-dept employee | Fixed | Admin: full list. Employee: only own department id (else 403), safe fields. |
| GET | /employee/birthdays | any employee/admin | Fixed | Employee: own department only; items `{_id, name, profileImage, department, monthDay:"MM-DD"}` (no year/age/dob). Admin: org-wide, adds `age`. Window: today + next 7 days (ORG_TIMEZONE); active accounts only. |
| GET | /employee/anniversaries | employee/admin | Fixed | Employee: own department only; `{_id,name,profileImage,department,years,monthDay,joiningDate}` (`joiningDate` kept for the existing web widget). Admin: org-wide. |
| GET | /employee/new/recent | employee/admin | Fixed | Employee: own department only; no email. |
| GET | /employee/leave/balance/me | employee | Fixed | Alias of `/leave/balance/me`. |

### TeamResponse (version 1)
```json
{ "success": true, "version": 1,
  "department": { "id": "departmentId", "name": "IT" } | null,
  "managerStatus": "assigned | unassigned | no_department",
  "manager": SafePerson | null,
  "members": [SafePerson],
  "totalMembers": 7, "matchedMembers": 6,
  "page": 1, "limit": 50, "hasMore": false,
  "updatedAt": "ISO" }
```
SafePerson: `{ employeeRecordId, userId, employeeCode, name, designation, profileImageUrl|null, isSelf, isManager }` — nothing else.
Rules: manager is resolved separately from member pagination and is never filtered out by `search`; `members` excludes the manager; the caller appears once (with `isSelf`) — if the caller is the manager they appear only as `manager`; members sorted by name (case-insensitive) then `employeeRecordId`; only active accounts; inactive/deleted/other-department manager ⇒ `managerStatus:"unassigned"`, `manager:null`; `totalMembers` counts every active person in the department once (manager + self included), independent of search.

## Departments
`Department` gains `managerEmployeeId: ObjectId|null` (ref Employee) and `managerHistory: [{from, to, changedBy, changedAt, reason}]`; `updatedAt` is maintained automatically (timestamps).
| Method | Path | Role | Status | Contract |
|---|---|---|---|---|
| GET | /department | admin | Fixed | `{success, departments:[{_id, dep_name, description, managerEmployeeId, manager: {employeeRecordId,name,employeeCode,designation,profileImageUrl}|null, memberCount, updatedAt}]}`. Also returns `managerStatus` (`assigned`/`unassigned`/`invalid` = assigned person inactive or moved), `employeeCount` (all employee records incl. inactive; governs delete) and `createdAt`. `memberCount` = active members. Sorted by name. |
| POST | /department/add | admin | Fixed | `{dep_name, description?, managerEmployeeId?}`; a non-null `managerEmployeeId` → 400 (a new department has no members yet; assign later). Duplicate name (case-insensitive) → 409 `CONFLICT`. |
| GET | /department/:id | admin | Fixed | single department, same item shape |
| PUT | /department/:id | admin | Fixed | `{dep_name?, description?, managerEmployeeId?: id|null, expectedUpdatedAt?}`; manager must be an active employee of this department; stale `expectedUpdatedAt` → 409 `STALE_UPDATE`; history entry appended on change. Unknown keys (web echoes the whole object) are ignored; echoing the current `managerEmployeeId` is not a change. The write is also compare-and-set on `updatedAt`, so a concurrent edit → 409 `STALE_UPDATE` even without `expectedUpdatedAt`. Never changes `User.role`. |
| GET | /department/:id/eligible-managers | admin | Added | `{success, employees:[{employeeRecordId,name,employeeCode,designation,profileImageUrl}]}` active members only |
| DELETE | /department/:id | admin | Fixed | 409 `DEPARTMENT_NOT_EMPTY` if any employee references it; no cascade deletion of people/leave |

## Clients
| Method | Path | Role | Status | Contract |
|---|---|---|---|---|
| GET | /client/me | client | Fixed | `{success, client:{_id, userId:{_id,name,email,profileImage}, dateOfJoining, companyLogo, budget, planType}}` |
| GET/POST | /client/me/roster | client | Added | GET `{success, entries:[{_id,name,jerseySize,createdAt,updatedAt}]}`; POST `{name (1-80 chars), jerseySize: XS|S|M|L|XL|XXL}` (ClientRelationship.jsx fields) → 201 `{success, entry}`; max 200 entries per client (409 `CONFLICT`) |
| DELETE | /client/me/roster/:entryId | client | Added | owner only (another client's entry → 404) |
| GET | /client/me/gallery | client | Added | `{success, images:[{_id,url,caption,createdAt}], sharedImages:[{_id,url,caption,createdAt}], galleryMonth}`; shared images are identical for all clients and limited to the previous calendar month |
| GET | /client/me/performance | client | Added | `{success, standings:[{_id,teamName,played,won,lost,points}], updatedAt|null}` (empty until admin enters data) |
| GET | /client/images, /client/performance | client, admin | Fixed | Legacy: client → own data (query `userId` ignored); admin → `?userId=` (required). `/client/images` → `{success, images:[url], items:[{_id,url,caption,createdAt}]}`; `/client/performance` → `{success, performance:[standings rows], updatedAt}` (no sample data: `[]` until entered) |
| GET | /client | admin | Fixed | list `{success, clients:[{_id, userId:{_id,name,email,profileImage}, dateOfJoining, companyLogo, budget, planType, createdAt, updatedAt}]}`; clients/employees → 403 |
| GET | /client/:id | admin, owner | Fixed | another client's id → 404 |
| POST/PUT/DELETE | /client/add, /client/:id | admin | Fixed | multipart `companyLogo`; add validates `name, email, password (8-128), planType (Annual|Quarterly), budget ≥ 0, dateOfJoining`, logo required, duplicate email → 409; PUT accepts `budget, planType` (+ logo); delete also removes that client's roster/gallery/performance |
| GET | /client/:id/gallery/upload-auth | admin | Added | Short-lived ImageKit upload credentials for client-gallery uploads (max 50 MB) |
| GET/POST | /client/:id/gallery | admin | Added | POST `{fileId, caption?}` after direct-to-ImageKit upload; backend verifies file type, folder and size before saving |
| GET | /client/gallery/shared/upload-auth | admin | Added | Short-lived credentials to upload shared client images directly to ImageKit |
| GET/POST/DELETE | /client/gallery/shared | admin | Added | GET by `?month=YYYY-MM`; POST `{fileId, month, caption?}` publishes images to all clients for that month |
| DELETE | /client/:id/gallery/:imageId | admin | Added | |
| GET/PUT | /client/:id/performance | admin | Added | Persisted per-client standings; PUT `{standings:[{teamName,played,won,lost,points}]}` replaces the table (validated non-negative integers; `[]` clears it) |

## Attendance
| Method | Path | Role | Status | Contract |
|---|---|---|---|---|
| POST | /attendance/check-in, /pause, /resume, /check-out | employee | Fixed | Optional `Idempotency-Key` header (8-128 chars `[A-Za-z0-9_.:-]`; 2xx responses replayed for 48 h with header `Idempotent-Replayed: true`; same key for a different action → 409 `CONFLICT`). Atomic, state-guarded transitions on today's business date. Response `{success, attendance, alreadyApplied:boolean, serverTime, businessDate, timezone}`. Invalid → 409 `INVALID_TRANSITION` with `details.attendance` (+ `details.serverTime`). Repeat check-in (also after check-out) returns the existing record; repeat pause keeps original `pauseStartedAt`; repeat resume does not double count; repeat check-out keeps original `checkOut`. Check-out sets `workedHours` = (checkOut − checkIn − paused incl. an open pause) and `status` (≥ 8 h Present, ≥ 4 h Half Day, else Absent). |
| GET | /attendance/today/me | employee | Fixed | `{success, attendance|null, serverTime, businessDate, timezone}` |
| GET | /attendance/me/monthly?month=YYYY-MM | employee | Added | `{success, attendance:[day], month, businessDate, timezone}`; one entry per day up to today from the joining date. Days without a record are synthesized: approved leave → `Leave`, weekend/holiday → `Holiday`, else `Absent` (synthesized entries have `_id:null`); a past open check-in reads `Absent`. Entries add `dayType` (`working|weekend|holiday`) and `holidayName`. Default month = current business month. |
| GET | /attendance/user/:userId/monthly | admin, self | Fixed | Same shape as `/me/monthly`; `:userId` = userId or Employee._id; query `month=M&year=YYYY` (legacy) or `month=YYYY-MM`; another employee → 403 |
| GET | /attendance, /attendance/admin/summary, /attendance/report | admin | Fixed | Org timezone; active employees only (report keeps deactivated employees on days with real records). `/attendance` adds `businessDate, timezone`. `/report` accepts `date`, `month&year` (or `month=YYYY-MM`), or `from&to`; span ≤ 366 days (none given ⇒ last ≤ 366 days from the earliest joining date); rows add `date, employeeRecordId, isPaused, pauseStartedAt, totalPausedMs`; off days without a record read `Holiday`, approved leave `Leave`. |
| PUT | /attendance/update/:employeeId | admin | Fixed | The single admin manual-status contract (`POST /attendance/admin-mark` does not exist and is not added). Body `{status: Present|Half Day|Absent|Leave ("Halfday" accepted), date?: YYYY-MM-DD ≤ today (default today)}`; `:employeeId` = Employee._id. Sets nominal `workedHours` (8/4/0/0), `source:"admin"`, `updatedBy`, `adminUpdatedAt`; Absent/Leave clear the punch session (original behaviour). |
| POST, GET | /attendance/jobs/close-day | cron | Added | `Authorization: Bearer $CRON_SECRET` (GET because Vercel Cron sends GET); 401 `AUTH_REQUIRED` if missing/wrong; 503 `JOB_DISABLED` if `CRON_SECRET` is unset or < 16 chars. Idempotent day-close job (also run in-process at 00:30 ORG_TIMEZONE on long-lived hosts) → `{success, job, businessDate, range, closedOpenSessions, absentCreated, employeesConsidered}`. |

## Attendance correction requests
`POST /attendance-request` (employee; body `{date: YYYY-MM-DD ≤ today, requestedStatus: Present|Half Day, reason ≤ 500}`; `currentStatus` is derived server-side; a second Pending request for the same date → 409 `CONFLICT`; → 201 `{success, request}`), `GET /attendance-request/me` (employee), `GET /attendance-request` (admin; filters `status`, `employeeId`, `from`, `to`; pagination only when `page`/`limit` given → adds `page, limit, total, hasMore`), `DELETE /attendance-request/:requestId` (owner, Pending only; other owner → 404; reviewed → 409 `INVALID_TRANSITION`), `PUT /attendance-request/:requestId/review` (admin; `{decision: Approved|Rejected, remarks?}`; atomic; second review → 409 `ALREADY_REVIEWED`; → `{success, request, attendance|null}`). Approved corrections write audit fields on Attendance (`source:"correction"`, `hoursSource:"correction"`, `correctionRequestId`, `correctedBy`, `correctedAt`), set nominal `workedHours` (Present 8 / Half Day 4), keep real punches untouched (`punchedHours` records measured hours) and never fabricate punch timestamps.

## Leave
`POST /leave/add` (employee; body `{leaveType: Casual Leave|Sick Leave, startDate, endDate (YYYY-MM-DD, end ≥ start, ≤ 60 days), reason?}`; server computes `days` = working days excluding weekends + holidays, client `days` ignored; 0 working days → 400; overlapping Pending/Approved leave → 409 `CONFLICT`; → `{success, leave, exceedsBalance}` — balance is reported, not enforced), `GET /leave/me` (Added, own list), `GET /leave/balance/me` and `GET /leave/balance/:employeeId` (admin, self) → `{success, casual:{total,used,balance}, sick:{...}, total:{total:24,used,balance}, period:{basis,start,end}}` (approved days in the entitlement period, default calendar year), `GET /leave/detail/:id` (admin, owner; other → 404), `GET /leave/:id/:role` (legacy; `:role` ignored, `:id` = userId or Employee._id; employee → own only else 403), `GET /leave` (admin; optional `status`, `page`/`limit`), `PUT /leave/:id` (admin review `{status: Approved|Rejected}`; atomic, Pending only, else 409 `ALREADY_REVIEWED`), `PUT /leave/cancel/:id` (owner employee; Pending, or Approved whose start date is after today; else 409 `INVALID_TRANSITION`; other owner → 404).

## Payslips
| Method | Path | Role | Status | Contract |
|---|---|---|---|---|
| POST | /payslip/add | admin | Fixed | multipart `payslip` (PDF, ≤5 MB → else 413 `FILE_TOO_LARGE`; `%PDF-` signature checked → else 415 `UNSUPPORTED_FILE`) + `employeeId` (Employee._id or userId; unknown → 404), `month` (YYYY-MM), `paymentStatus?` (Paid default|Pending) and finite non-negative numbers (`basicSalary` > 0); server computes `overtimePay, grossSalary, totalDeductions, netSalary` (client totals ignored); duplicate employee+month → 409 `CONFLICT`; stored as a private ImageKit file → 201. |
| GET | /payslip/me | employee | Added | own list; items have `hasFile` and `fileMigrationRequired` instead of a file URL |
| GET | /payslip/employee/:id | admin, self | Fixed | `:id` = Employee._id or userId; other employee → 403. Items have `hasFile` and `fileMigrationRequired`; employees never get `payslipFile`/storage ids; admin items carry `payslipFile` as a ≤5-min signed URL (+ `fileUrlExpiresAt`) only for private files — legacy stored URLs are never returned. |
| GET | /payslip/:payslipId/download | admin, owner | Added | `application/pdf` attachment (`payslip-YYYY-MM.pdf`, `Cache-Control: private, no-store`) fetched server-side via a signed URL after the ownership check (exact `IMAGEKIT_URL_ENDPOINT` origin + path only, redirects not followed, 5 MB streaming cap, `%PDF-` check); other employee → 404; legacy public upload → 409 `LEGACY_FILE_NOT_MIGRATED`; storage failure → 502 `FILE_UNAVAILABLE` |
| GET | /payslip/:payslipId/link | admin, owner | Added | `{success, url, expiresAt}` signed URL valid ≤5 min, private files only; other employee → 404; legacy public upload → 409 `LEGACY_FILE_NOT_MIGRATED` (run `Backend/scripts/migrateLegacyPayslips.js`) |

## Notifications & announcements
`GET /notifications` (own; admin = `data.adminId`, employee = `data.userId`, client = `[]`; newest first, `?page&limit` ≤100, default 100; adds `page, limit, hasMore, unseenCount`), `PATCH /notifications/:id/seen` (recipient only; else 404), `PATCH /notifications/seen-all` (Added; `{success, modified}`).
Announcements: `GET /announcements` (admin), `GET /announcements/public` (all roles), `GET /announcements/:id`, `POST /announcements/add`, `PUT /announcements/:id`, `DELETE /announcements/:id` (admin; multipart `image`), `PUT /announcements/:id/read` (any; only adds the caller → `{success, message, announcementId, seen:true}`). Non-admins only see/mark announcements whose status is not `Completed` (`GET /:id` of a Completed one → 404); for non-admins `seenBy` contains only the caller's id (if seen) and a `seen` boolean is added. Body fields are allowlisted (`title, description, type, date, venue, status`).

## Other admin resources
Holidays: `GET /holiday/upcoming`, `GET /holiday/all` (any role; items add `ymd` and `status` computed in ORG_TIMEZONE), `POST /holiday/add` (`{title, date:"YYYY-MM-DD"}`), `DELETE /holiday/:id` (admin).
Sponsors: `/sponsors` CRUD incl. reads (admin; multipart `logo`). Stalls: `/stalls` CRUD incl. reads (now authenticated; admin; multipart `logo`). Bodies are allowlisted/validated; `logo` can only change via upload.
Image uploads (`profileImage`, `companyLogo`, `logo`, `image`): one file ≤ 5 MB (413 `FILE_TOO_LARGE`); actual bytes must be JPEG/PNG/WebP/GIF (else 415 `UNSUPPORTED_FILE`; HEIC/HEIF/AVIF → 415 with a conversion hint); wrong field name → 400 `VALIDATION_ERROR`; storage failure → 502 `UPLOAD_FAILED`. Dashboard: `GET /dashboard/summary` (admin).
