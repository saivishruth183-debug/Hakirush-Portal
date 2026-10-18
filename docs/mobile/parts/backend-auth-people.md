# Backend: auth, sessions, people, departments (agent: backend-auth-people)

Scope: server authorization, native session lifecycle (mobile refresh tokens), department manager assignment,
the manager-first team endpoint, legacy people endpoints, admin resources (holidays, sponsors, stalls,
announcements, notifications, dashboard) and image uploads. Express 5 + Mongoose 9 (ESM). No packages installed.
Coded against `docs/mobile/API_CONTRACT.md`; the rows I touched were updated in place (see "Contract changes").

## Files changed

New
- `Backend/models/RefreshToken.js`: hashed refresh tokens (userId, familyId, tokenHash unique, tokenVersion, expiresAt with a TTL index, revokedAt, revokedReason, replacedByHash, deviceName, lastUsedAt).
- `Backend/models/RefreshSession.js` (review follow-up): one document per mobile sign-in (`_id` = familyId = access-token `sid`; userId, deviceName, revokedAt, revokedReason, lastUsedAt, sliding `expiresAt` with a TTL index). Authoritative for revocation.
- `Backend/services/sessionService.js`: web/access JWT signing, mobile session creation, rotation with reuse detection, family-first revocation, `isSessionActive()` for the auth middleware, and the test-only `__testHooks.beforeInsertChild` (inert unless `NODE_ENV=test`).
- `Backend/services/teamService.js`: TeamResponse v1 aggregation, manager resolution, eligibility checks, SafePerson builder.
- `Backend/services/employeeLifecycle.js`: deactivate/reactivate, manager hand-off planning, ordered writes with rollback for transfer and deactivation.
- `Backend/middleware/loginRateLimit.js`: express-rate-limit limiters (per IP+email and per IP) plus the `createLoginLimiters()` factory. This file is not on my ownership list; it is new and only used by `authRoute.js`.
- `Backend/scripts/assignDepartmentManagers.js`: dry run by default, `--apply` to write. **Not run against any real DB.**
- Tests: `Backend/tests/auth.test.js`, `sessionRevocation.test.js` (review follow-up), `team.test.js`, `departments.test.js`, `employees.test.js`, `adminResources.test.js`.

Modified
- Controllers: `authController`, `settingController`, `departmentController`, `employeeController`, `dashboardController` (error normalization only), `holidayController`, `sponsorController`, `stallController`, `announcementController`.
- Routes: `authRoute`, `settingRoute`, `departmentRoute`, `employeeRoute`, `dashboardRoute`, `holidayRoute`, `sponsorRoutes`, `stallRoutes`, `announcementRoutes`, `notificationRoute`.
- Models: `Department` (manager fields and timestamps; cascade hook removed), `Employee` (exported enums, `bloodGroup` accepts null, indexes on userId and department), `Notification` (recipient indexes). `User`, `Holiday`, `Sponsor`, `Stall` and `Announcement` are unchanged.
- Middleware: `upload.js` (rewritten), `multerErrorHandler.js` (normalized), `authMiddleware.js` (review follow-up, edit authorized by the coordinator: tokens with `sid` must belong to an existing, unrevoked session of that user, else 401 `SESSION_REVOKED`).
- `Backend/utils/validate.js`: additive only (`normalizeEmail`, `parseBoolean`, `parseDateInput`, `optionalEnum`, `sameId`).
- `docs/mobile/API_CONTRACT.md`: rows annotated (see below).
- Not touched: `testEnv.js` (my extra fixtures are created inside my own tests), `leaveController.js` (only imported), and all attendance, leave, payslip and client files.

## Decisions (with reasons)

**Login**
- Unknown email and wrong password both return 401 `INVALID_CREDENTIALS` with the same message.
- A dummy bcrypt compare runs for unknown emails so response timing does not reveal which emails exist.
- `ACCOUNT_INACTIVE` (403) is only returned after a correct password, so inactive accounts cannot be enumerated either.
- Email is trimmed and lowercased.

**Rate limiting**
- Two limiters are shared by `/auth/login` and `/auth/mobile/login`:
  - per IP + normalized email: 10 failed attempts per 15 minutes (`LOGIN_RATE_LIMIT_MAX`)
  - per IP: 100 failed attempts per 15 minutes (`LOGIN_RATE_LIMIT_IP_MAX`)
- `skipSuccessfulRequests`, so legitimate logins never use up the budget.
- The IP key uses `ipKeyGenerator`, which groups IPv6 addresses by subnet.
- Under `NODE_ENV=test` the defaults are 10000. A test builds a limiter with a low limit and proves it returns 429 `RATE_LIMITED`.
- The store is in memory per process, which means per instance on serverless hosts. A shared store (e.g. Redis) would be needed for a global limit.

**SessionUser**
- Built by `buildSessionUser()` and used by login, verify, mobile login and refresh.
- Removes `password`, `tokenVersion` and `__v`. Keeps `createdAt` and `updatedAt`.
- Employee fields (`employeeId` code, `designation`, `employeeRecordId`, `departmentId`, `departmentName`) are added for employees, and for admins who have an Employee record.
- Clients get `clientId`, and `profileImage` falls back to the company logo (as before).

**Refresh tokens and sessions** (reworked after the external review: two P1 issues)
- Token: `randomBytes(48)` encoded as base64url (64 characters). Only its SHA-256 hash is stored.
- Each mobile sign-in creates a `RefreshSession` document (the "family"). Its `_id` is the access token's `sid`.
- **The session document is authoritative.** A refresh token, or an access token carrying `sid`, is valid only while `session.revokedAt` is null. Refresh checks this, and so does `authMiddleware` on every request with a `sid`.
- **Revocation order:** set `session.revokedAt` first (one atomic single-document update; the first reason wins), then mark the family's refresh tokens.
- **Refresh order:**
  1. The session must exist and be unrevoked.
  2. A presented token that was already rotated means reuse: revoke the family → `REFRESH_REUSED`.
  3. Expiry and user checks (active, tokenVersion).
  4. Atomic single-winner claim `findOneAndUpdate({_id, revokedAt: null})`.
  5. Insert the child token.
  6. Conditional touch of the session `findOneAndUpdate({_id: sid, revokedAt: null}, {lastUsedAt, expiresAt})`. If that matches nothing, the refresher revokes its own child and fails with the session's code.
- **Why no ordering can leave a usable child (no transactions needed):**
  - If the revocation lands before step 6, the refresher sees it and kills its own child.
  - If it lands after step 6, the child already exists, so the revoker's token sweep kills it.
  - Either way, every later use re-checks the session.
- **Fix for P1 #1 (refresh race).** Previously: claim, then a separate insert. A competing reuse could revoke the family before the child was inserted, leaving one active child. A deterministic test now pauses the child insert through `__testHooks.beforeInsertChild`. With the post-insert check disabled, that test fails with "the paused refresh must not hand out a usable child" (verified, then the code was restored byte-identical).
- **Fix for P1 #2 (access token after logout).**
  - Mobile logout and reuse detection revoke one session, and its access tokens stop working immediately: 401 `SESSION_REVOKED`, at the cost of one indexed `findById` per mobile request.
  - Other devices' sessions are unaffected. Web tokens have no `sid` and still depend only on `tokenVersion`.
  - logout-all, password change and deactivation still bump `tokenVersion` and also revoke all sessions.
- **Concurrent refresh with one token.** Only one request can claim it. Any other presentation is reuse, which revokes the family, so the claimant's new tokens die too. Depending on timing the claimant gets 401 itself, or a 200 whose tokens are already dead. The invariant tested is: at most one 200, exactly one claim, and zero usable tokens afterwards. **The mobile client must single-flight refresh.**
- **Crash between claim and child insert.**
  - If the insert throws, the server revokes the session (`rotation_failed`, best effort) and returns 500.
  - If the process dies with no cleanup, the next presentation of the consumed token counts as reuse and revokes the session.
  - Either way the user must sign in again; the client keeps its session through the 5xx, then signs out on the following 401.
- **Codes for a revoked session:**
  - `reuse_detected` → `REFRESH_REUSED`
  - `logout` → `REFRESH_INVALID`
  - `deactivated` → `ACCOUNT_INACTIVE`
  - `logout_all` / `password_change` / `session_revoked` / `rotation_failed` → `SESSION_REVOKED`
- Each token row stores `tokenVersion` at issue time, so a mismatch at refresh gives `SESSION_REVOKED`.
- Refresh and session expiry slide forward 30 days on each rotation. There is no absolute family lifetime.
- Refresh tokens without a session document (none exist in production; the feature is new) → `REFRESH_INVALID`.

**Change password**
- The target is always `req.user._id`; `body.userId` is ignored. The body is never logged (a test asserts this).
- Rules: at least 8 characters and at most 72 bytes (the bcrypt limit); must differ from the old password; an optional `confirmPassword` must match.
- A wrong old password returns **400** `VALIDATION_ERROR`, with the message "Wrong old password" kept for the web. It is not a 401, because a 401 would trigger the client sign-out rule.
- The password and the `tokenVersion` increment are written in one update, then all refresh tokens are revoked.

**Departments**
- Removed the document `deleteOne` cascade hook. It never fired for `findOneAndDelete`, and if it had, it would have deleted people and leave history.
- DELETE now returns 409 `DEPARTMENT_NOT_EMPTY` while any Employee (active or not) references the department.
- `timestamps: true` maintains `updatedAt`.
- PUT checks `expectedUpdatedAt` when it is sent. The write itself is also compare-and-set on `updatedAt`, so a concurrent edit gets 409 `STALE_UPDATE` either way.
- Echoing the current `managerEmployeeId` is not a change, even if that person is no longer eligible. This keeps the web form's "echo the whole object" PUT working.
- Department names are unique, case-insensitive (409 `CONFLICT`).
- `POST /add` with a non-null manager → 400, because a new department has no members yet.

**Manager rule (transfer / deactivation)**
- Implemented in `employeeLifecycle.js`.
- No transactions: mongodb-memory-server runs standalone, and the deployment is not guaranteed to be a replica set. Writes are ordered instead:
  1. Department compare-and-set (`{_id, managerEmployeeId: from}`) plus a history entry with its own `_id`.
  2. The employee write (transfer is compare-and-set on the old department) or the user deactivation.
  3. If step 2 throws, step 1 is rolled back: compare-and-set back, and the history entry is `$pull`ed.
- A test injects a failure into step 2 and verifies the rollback.
- The replacement manager must be an active member of the old department and must not be the same person.
- History reasons recorded: `assignment`, `transfer`, `deactivation`, `bulk-script`.
- Assigning a manager never changes `User.role`.

**Deactivation**
- `DELETE /employee/:id` now deactivates: `isActive=false`, `tokenVersion++`, all refresh tokens revoked.
- Employee, payroll, attendance and leave records are retained.
- An admin cannot deactivate their own account.
- DELETE accepts `clearManager` / `replacementManagerEmployeeId` in the JSON body or the query string.

**Team (`GET /employee/team/me`)**
- Declared before `/:id`.
- Scope comes only from the caller's Employee record; every query parameter except `search`, `page` and `limit` is ignored.
- The manager is resolved separately and must exist, be in the same department and be active.
- Members come from one aggregation:
  - `$lookup` to users with `isActive != false`; the manager is excluded.
  - `$facet` produces total, matched and page counts.
  - Sorted by name then id, with collation `{locale:"en", strength:2}`.
- Search uses an escaped, case-insensitive regex over name, designation and employee code, capped at 100 characters.
- `limit` defaults to 50, max 100.
- Output is built by `toSafePerson()`, which produces exactly the 8 keys.
- A missing Employee record or missing Department gives a 200 `no_department` response, with no fallback to other employees.

**Legacy directory endpoints**
- `by-department/me` and the employee view of `department/:id/employees` return only `{_id, employeeId, designation, isManager, userId{_id,name,profileImage}, department{_id,dep_name}}`, active members only.
- `by-department/me` keeps returning the full department list without pagination. The web expects the full array, and the list is department-scoped.

**`GET /employee/:id`**
- For non-admins, ownership is checked before any lookup: an id that is neither their own Employee id nor their own user id gets 403, whether or not it exists. This prevents id probing.

**Birthdays, anniversaries, new joiners**
- Computed in `ORG_TIMEZONE` with `utils/orgTime.js`.
- Year wrap is handled correctly; the old code missed Dec→Jan. Feb 29 falls on Feb 28 in non-leap years.
- Window is today plus 7 days. New joiners cover 30 days and return at most 100 items.
- Only active accounts are included.
- Employees: own department only.
  - Birthday items carry `monthDay` only (no dob, age or year).
  - Anniversary items keep `joiningDate` because the current web widget reads it; date of joining is not HR-sensitive and `new/recent` already exposes `dateOfJoining`.
- Admins: org-wide. Birthdays add `age`; new joiners add `email`.

**Self profile edit**
- Allowlist per the contract.
- Forbidden fields: the contract's list plus `isActive` and `password`. A forbidden field is only rejected when its value differs from the current one (salary compared as a number, email normalized, ids compared as strings). This is because the web form posts unchanged values.
- `""` clears `dob`, `bloodGroup` and `maritalStatus`. The dob must be a real calendar date and not in the future.
- Admin callers of `update-profile` go through the same admin update path as `PUT /employee/:id`, including the manager rule.

**Add employee**
- `role` defaults to `employee`. Only an explicit `"admin"` is accepted as an alternative; anything else → 400.
- The `manager` body field is ignored.
- `password` must be at least 8 characters. This is a new rule the admin form will surface as a 400 message.
- `experience` is now saved; it was previously dropped.
- If the Employee create fails, the User is deleted so the add is all-or-nothing.
- Duplicate email or employee code → 409 `CONFLICT`. Previously this was a 400.

**Admin employee edit (`PUT /employee/:id`)**
- A `""` salary means "no change". The web form turns a 0 salary into `""`.
- `employeeId` can be changed, with a uniqueness check.

**Uploads (`middleware/upload.js`)**
- `upload.single(field)` keeps the multer-style call but returns `[parse, verify]`. Express flattens the array, so `clientRoute.js` (another agent's file) keeps working unchanged.
- Multer errors are converted to normalized JSON inside the middleware:
  - 413 `FILE_TOO_LARGE`
  - 400 `VALIDATION_ERROR` for an unexpected field, too many files or a malformed form
- The real bytes must be JPEG, PNG, WebP or GIF; anything else → 415 `UNSUPPORTED_FILE`.
- HEIC/HEIF/AVIF is detected by mimetype, file name or `ftyp` brand → 415 with a conversion hint.
- `mimetype` and `originalname` are rewritten from the detected type, so the client-supplied file name never reaches ImageKit.
- Limit is now 5 MB; it was 10 MB.
- An ImageKit failure → 502 `UPLOAD_FAILED`. This is a new error code, added to the contract.

**Admin resources**
- Holidays: reads are open to any role; writes are admin-only. Dates must be `YYYY-MM-DD`; status is computed in the org timezone.
- Sponsors and stalls: every route is admin-only, reads included, because no non-admin web screen uses them. Stalls were previously **unauthenticated**.
- Bodies for holidays, sponsors, stalls and announcements are allowlisted, which closes mass assignment (e.g. `seenBy`, `logo`, `createdAt`).
- Dashboard summary: admin-only.

**Announcements**
- Route-level `requireAdmin` on admin list and all mutations. The controller's own admin checks are kept.
- Non-admins see only non-Completed announcements (`/public`, `GET /:id`, `/:id/read`).
- For non-admins, `seenBy` is reduced to the caller's own id (if seen) and a `seen` flag is added. This keeps the web's `seenBy.includes(me)` logic working without exposing who else has read it.
- `markAsRead` no longer returns the full document (`updated`); the web does not read it.

**Notifications**
- Recipient semantics unchanged: admin by `data.adminId`, employee by `data.userId`, client gets `[]`. Both ObjectId and string forms of the id are matched.
- `PATCH /:id/seen` only works for the recipient; anyone else gets 404.
- Added `PATCH /seen-all`.
- `GET` returns at most 100 per page and adds `page`, `limit`, `hasMore` and `unseenCount`.

**Logging and errors**
- Removed the `EMPLOYEE ROUTE` request logger, the change-password `console.log(req.body)`, and the department delete logs.
- All handlers use `asyncHandler`/`sendError`: no stack traces or internal messages in responses (a test asserts an injected error message is not leaked).

**Bounded lists**
- Team: 100. Notifications: 100. Public announcements: 200. Admin announcements: 500. New joiners: 100.
- `GET /employee` (admin) returns the full array unless `?page` is given, because the web list paginates client-side.

## Contract changes (`docs/mobile/API_CONTRACT.md`, updated in place)

Additions and clarifications only; no paths were changed.
- New error code `UPLOAD_FAILED` (502).
- Login lockout numbers and the env names that control them.
- Concurrent refresh produces `REFRESH_REUSED` for the loser; clients must single-flight refresh.
- `logout-all` returns `reauthRequired`.
- Change-password validation, and wrong old password → 400.
- Employee add validation and 409 for duplicates.
- Optional paging on `GET /employee`.
- `update-profile` returns `details.fields`, and its forbidden list adds `isActive` and `password`.
- DELETE accepts the manager options in the query string; an admin cannot deactivate themselves.
- Birthdays (admin `age`, window) and anniversaries (`joiningDate`).
- Department list/item adds `managerStatus`, `employeeCount` and `createdAt`; `memberCount` counts active members only.
- Department create: duplicate name → 409, non-null manager → 400.
- Department update: ignores unknown keys, implicit compare-and-set.
- Notifications paging fields; seen-all returns `{success, modified}`.
- Announcement visibility and `seenBy` filtering.
- Holiday `ymd`.
- Sponsor/stall reads are admin-only.
- Image upload rules.

## Test evidence

Run from `Backend/`:

```
node --test --test-concurrency=1 tests/*.test.js
```

Result after the review follow-up: **140 tests, 140 pass, 0 fail**. Earlier runs had 113/113, then 125/125; the count grew as other agents added tests. The total includes the other agents' test files present at that moment: `attendance`, `attendanceStatus`, `client`, `corrections`, `leave`, `payslip`, `payslipMigration` and `smoke`. They all passed in that run; I did not modify them.

My files, run individually with `node --test --test-concurrency=1 tests/<file>`:

| File | Tests | Pass | Fail |
|---|---|---|---|
| `auth.test.js` | 19 | 19 | 0 |
| `sessionRevocation.test.js` | 9 | 9 | 0 |
| `team.test.js` | 16 | 16 | 0 |
| `departments.test.js` | 12 | 12 | 0 |
| `employees.test.js` | 23 | 23 | 0 |
| `adminResources.test.js` | 10 | 10 | 0 |

`smoke.test.js` passes (1/1).

**Note:** `node --test --test-concurrency=1 tests/` (the directory form, also used by `npm test` in `Backend/package.json`) **fails on Node 26.4**. Node treats `tests/` as a module path ("Cannot find module …/tests"), so the run reports 1 test, 0 pass, 1 fail. Use `tests/*.test.js`. `package.json` is not my file, so I did not change the script.

Covered:

**Auth**
- Web login shape and JWT claims (`_id`, `role`, `tv`, 10-day TTL); email normalization.
- Uniform 401 for unknown email and wrong password; inactive account 403 only with the correct password.
- `verify` returns SessionUser for employee and client.
- Mobile login: 15-minute access token with `sid`; refresh token stored only as a hash.
- Refresh rotation; reuse revokes the family.
- Concurrent refresh (3 parallel requests): at most one 200, exactly one claim, at most one child, zero live tokens afterwards, and any returned tokens are dead.
- Mobile login creates a session document whose `_id` equals `sid`.
- Expired, unknown or missing refresh token → `REFRESH_INVALID`; tokenVersion mismatch → `SESSION_REVOKED`; deactivated → 403.
- Logout is idempotent.
- logout-all kills access and refresh tokens on every device.
- Change password: ignores `body.userId`, revokes web and mobile sessions, logs nothing (console captured).
- Rate limit returns 429 after the limit, is per account, successful logins don't count, and is disabled in the test env.

**Session revocation (`sessionRevocation.test.js`)**
- Reuse finishes while the claimant is paused before inserting its child: the claimant gets 401 `REFRESH_REUSED`; the child exists but is revoked; refreshing with the child or the old token fails; an access token for that `sid` gets 401 `SESSION_REVOKED`.
- Refresh vs logout, same pause technique: 401 `REFRESH_INVALID` and nothing usable.
- Insert failure after the claim: 500 with no leaked message; the old token gets 401; the session is revoked (`rotation_failed`); exactly one token row remains.
- Hard crash after the claim (no cleanup ran): the next presentation of the old token → `REFRESH_REUSED`, session revoked.
- A normal refresh slides the session expiry.
- After mobile logout, the same access token gets 401 `SESSION_REVOKED` on `/api/employee/team/me`; a second device keeps working (access token and refresh); a web token without `sid` keeps working.
- After reuse detection, the winner's access token is rejected.
- An unknown `sid`, or another user's `sid`, is rejected.
- logout-all and deactivation still apply (`SESSION_REVOKED`; `ACCOUNT_INACTIVE` on both access and refresh).

**Team**
- IT and Ops members are isolated from each other.
- The two "Sam Same" people stay separate.
- A manager viewing their own team appears once, as manager, with `isSelf`.
- Unassigned cases: no manager, inactive manager, and an assignment pointing at another department's employee.
- No department, and no Employee record: no fallback to other employees.
- Pagination across 3 pages always includes the manager and never crosses departments.
- Search by name, code and designation; a cross-department name returns nothing; regex metacharacters are safe; `limit` capped at 100.
- Case-insensitive sort; scope params such as `?departmentId=` are ignored.
- Admin and client get 403.
- `findSensitiveKeys` returns nothing on every directory response.

**Legacy directory**
- `by-department/me`: safe shape and key set.
- `department/:opsId/employees` as an IT employee → 403.
- `/employee/:opsId`, `/employee/:opsUserId` and `/employee/:randomId` as an employee → 403; own record by Employee id and by user id → 200.
- `GET /employee` is admin-only, with `isActive` and paging.
- Birthdays, anniversaries and new joiners are scoped to the department and use safe keys (exact key set asserted); admin is org-wide.

**Departments**
- Admin-only.
- List shape and counts.
- Create validation (name, duplicate, manager).
- Invalid id → 400 `INVALID_ID`; unknown → 404.
- Eligible managers.
- Delete of a non-empty department → 409 with no cascade; empty department is deleted, then 404.
- Manager rejected for wrong department, inactive, unknown or invalid id.
- Valid manager change writes history, keeps `User.role` unchanged and moves `updatedAt`.
- Clearing the manager works.
- Stale `expectedUpdatedAt` → 409.
- The web echo body is accepted without a history entry.
- Assignment script: dry-run plan validates; `--apply` writes with history (in-memory DB).

**Employees**
- Transfer of a manager: 409 without a decision; `clearManager` works; replacement works (rejected when it is the same person, from another department, inactive, or a bad id); a non-manager needs no decision.
- Rollback on an injected write failure, with a 500 that does not leak the message.
- DELETE of a manager: 409, then deactivation kills access and refresh tokens and keeps the record; `clearManager` via the query string works.
- PATCH status with a replacement, and reactivation.
- Employee callers are blocked from these actions.
- Self-edit: forbidden fields → 403 with `details.fields`; allowed fields and unchanged protected values → 200; clearing fields works; enum, date and ownership validation; admin can use `update-profile`.
- Add employee: role defaulting and the "client" role rejected; `manager` ignored; validation matrix (400s and 409s).
- `/employee/me` and `managerOfDepartment`; leave balance alias.
- Uploads: HEIC by name and by bytes → 415; fake PNG, SVG and PDF → 415; >5 MB → 413; wrong field → 400; signature detection unit tests.

**Admin resources**
- Stalls: unauthenticated → 401; employee and client → 403 (read and write); admin CRUD over multipart with repeated `plans`; `logo` cannot be set from the body.
- Sponsors: role checks and validation.
- Holidays: readable by all roles; past/upcoming in the org timezone; write validation.
- Dashboard: admin-only.
- Announcements: mutations admin-only; `seenBy` mass assignment blocked; Completed hidden; markAsRead adds only the caller; `seenBy` filtered.
- Notifications: only own; non-recipient (employee, admin, client) → 404; `seen-all` only marks own; bad id → 400 without a stack.

**Not run**
- Real ImageKit uploads: no network, and the tests use fake keys. The "valid image is stored" path is not exercised; signature acceptance is covered by unit tests.
- The web build: owned by the web agent.
- `assignDepartmentManagers.js` against any real database: intentionally not run.

## Feature parity (web screen/action → endpoint → role → status → validation)

| Web screen / action | Endpoint | Role | Status | Validation / notes |
|---|---|---|---|---|
| Login.jsx: sign in | POST /auth/login | public | Fixed | email normalized; uniform 401; 403 inactive; 429 |
| authContext: restore session | POST /auth/verify | any | Fixed | SessionUser |
| Mobile sign in / refresh / sign out | POST /auth/mobile/login, /refresh, /logout | public | Added | rotation, reuse detection, idempotent logout |
| "Log out everywhere" | POST /auth/logout-all | any | Added | tokenVersion++, refresh revoked |
| Setting.jsx: change password | PUT /setting/change-password | any | Fixed | ≥8 chars, ≤72 bytes, differs, confirm; `reauthRequired` |
| DepartmentList | GET /department | admin | Fixed | adds manager, managerStatus, counts |
| AddDepartments | POST /department/add | admin | Fixed | name required and unique |
| EditDepartment: load / save / pick manager | GET/PUT /department/:id, GET /:id/eligible-managers | admin | Fixed/Added | active same-department manager; `expectedUpdatedAt`; history |
| DepartmentButtons: delete | DELETE /department/:id | admin | Fixed | 409 `DEPARTMENT_NOT_EMPTY` |
| DepartmentEmployees | GET /employee/department/:id/employees | admin (full), own-dept employee (safe) | Fixed | ObjectId check; 403 for other departments |
| EmployeeList | GET /employee | admin | Fixed | `isActive`; optional paging |
| EmployeeAdd | POST /employee/add | admin | Fixed | enums, email, unique code/email (409), salary ≥0, password ≥8, role |
| EmployeeView / EmployeeEdit (load) | GET /employee/:id | admin | Fixed | INVALID_ID / 404 |
| EmployeeEdit (save) | PUT /employee/:id | admin | Fixed | manager rule (409), clearManager/replacement |
| EmployeeButtons: delete | DELETE /employee/:id | admin | Fixed | deactivates; manager rule |
| (new) activate / deactivate toggle | PATCH /employee/:id/status | admin | Added | boolean `isActive` |
| EmployeeProfile / ViewPayslip (employee) | GET /employee/:id | self | Fixed | 403 for other ids |
| EditEmployeeProfile | PUT /employee/update-profile/:id | self (allowlist), admin | Fixed | `FIELD_NOT_EDITABLE`; enums/dates; image ≤5 MB, signature |
| EmployeeSummary: team widget | GET /employee/team/me | employee | Added | TeamResponse v1 |
| EmployeeSummary: legacy team list | GET /employee/by-department/me | employee | Fixed | safe fields, same department |
| EmployeeSummary: birthdays / anniversaries / new joiners | GET /employee/birthdays, /anniversaries, /new/recent | employee (own dept), admin | Fixed | `monthDay`; org timezone |
| (mobile) own HR record | GET /employee/me | employee | Added | `managerOfDepartment` |
| Leave balance (alias) | GET /employee/leave/balance/me | employee | Fixed | delegates to leaveController.getLeaveBalance |
| HolidayList / AddHolidays / delete | GET /holiday/upcoming, /all; POST /add; DELETE /:id | any (read), admin (write) | Fixed | `YYYY-MM-DD`; INVALID_ID; 404 |
| EmployeePunch / leave screens: holidays | GET /holiday/upcoming, /all | any | Existing | status computed in org timezone |
| Sponsor list/add/edit/view/delete | /sponsors | admin | Fixed | enum, non-negative counts, allowlist |
| Stall list/add/edit/view/delete | /stalls | admin | Fixed | **auth added**; plans array; allowlist |
| AdminSummary: dashboard | GET /dashboard/summary | admin | Fixed | admin gate |
| AdminAnnouncement / EditAnnouncement | GET /announcements, GET/PUT/DELETE /:id, POST /add | admin | Fixed | enums, allowlist, image rules |
| EmployeeSummary / ClientSummary: notices | GET /announcements/public, PUT /:id/read | any | Fixed | Completed hidden; only self added to `seenBy` |
| Notification bells (admin and employee) | GET /notifications, PATCH /:id/seen | admin, employee (client gets []) | Fixed | recipient only, else 404 |
| (new) "mark all read" | PATCH /notifications/seen-all | any | Added | own only |

## Migration / backfill note

- All new fields are additive:
  - `Department.managerEmployeeId` (default null), `managerHistory` (default []), timestamps.
  - `User.tokenVersion` (default 0; already in the model).
  - The new `RefreshToken` and `RefreshSession` collections (both new, with TTL indexes).
- **No backfill was run.** Existing departments therefore show `managerStatus: "unassigned"` until an admin assigns a manager.
- Existing web tokens without `tv` are treated as version 0 by `authMiddleware`, so current users stay signed in.
- Manager assignments must come from an **owner-supplied** department→employee mapping:
  1. Create `mapping.json` in the form `{ "<departmentId>": "<employeeRecordId>" | null }`.
  2. Dry run (the default; validates and prints the plan): `node --env-file=.env scripts/assignDepartmentManagers.js mapping.json`
  3. Apply: add `--apply`. Nothing is written unless every entry is valid; each change is compare-and-set and records history (`reason: "bulk-script"`).
- **Do not run the script against production without the owner's explicit approval.** It was only exercised against the in-memory test database.
- New indexes will be built by Mongoose `autoIndex` at startup:
  - `RefreshToken`: `tokenHash` unique and an `expiresAt` TTL index (a new collection, so this is safe).
  - `Employee`: `userId` and `department` (non-unique).
  - `Department`: `managerEmployeeId`.
  - `Notification`: recipient indexes.
- Behaviour changes for existing data:
  - DELETE employee no longer hard-deletes.
  - Department delete no longer cascades; it is refused while the department has employees.

## Credentials needing rotation (names only)

- None were seen or used by this agent: `Backend/.env` was not opened.
- The token model changes do not require rotating `JWT_KEY`. If the coordinator's audit found `JWT_KEY` exposed, rotating it signs everyone out (acceptable).
- Env names introduced or used, without values:
  - `WEB_TOKEN_TTL`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`
  - `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_IP_MAX`
  - `ORG_TIMEZONE`, `MONGODB_URL` (script only)

## Open issues / owner inputs

1. **`npm test` fails on Node 26.** The script is `node --test … tests/` (directory form). Suggest changing it to `node --test --test-concurrency=1 "tests/*.test.js"`. `Backend/package.json` is not my file; owner: coordinator.
2. **Web follow-ups (web agent).**
   - Client-side `MAX_FILE_SIZE` is still 10 MB in 9 forms: EmployeeAdd, EmployeeEdit, EditEmployeeProfile, SponsorAdd, SponsorEdit, StallAdd, StallEdit, ClientAdd, ClientEdit. The server now rejects anything over 5 MB with 413 `FILE_TOO_LARGE`, and HEIC with 415.
   - Login errors are in `error`, not `message`.
   - `markAsRead` no longer returns `updated`.
   - Already handled by the web agent (checked 2026-10-01): EmployeeList shows `isActive`; delete, edit and department screens use the manager rule, `clearManager`, `STALE_UPDATE`, `DEPARTMENT_NOT_EMPTY` and `FIELD_NOT_EDITABLE`; Setting.jsx handles `reauthRequired`; the dashboard uses `monthDay`.
3. **Rate-limit store is per instance.** On Vercel or with multiple instances the effective limit multiplies. A shared store (Redis or Upstash) is an owner decision.
4. **Strict refresh reuse.** Any second presentation of a refresh token, including an accidental concurrent refresh, revokes that session. The mobile agent must serialize refresh calls (single-flight) and treat 401 as sign-out.
   - Every mobile request now costs one extra indexed session lookup.
   - The design assumes reads go to the primary (the Mongoose default). A rollback on replica-set failover could, in theory, undo a just-acknowledged revocation write. Use `w: "majority"` (the Atlas default) to avoid that.
5. **Optimistic concurrency on `updatedAt` has millisecond granularity.** Two writes in the same millisecond would not be detected. This is acceptable for admin edits; a version counter would be stricter.
6. **Delete-department race.** Between the "is empty" check and the delete, a newly created employee could be orphaned. That employee's team view would show `no_department` and never fall back. Low risk.
7. **Manager rule with stale or multiple assignments.** If one employee were (through data drift) manager of several departments, transfer and deactivation hand off only the first; the remaining assignments show as `managerStatus: "invalid"` / `"unassigned"` until an admin fixes them.
8. **Hash cost for new passwords.** New passwords are hashed with bcrypt cost 10 (unchanged). The owner may want 12.
9. **Org timezone.** `ORG_TIMEZONE` defaults to `Asia/Kolkata`. Confirm before release; it affects birthdays, anniversaries and holiday status.
10. **Other agents' code.** Now that deactivated employee records are retained, other agents' code that loops over employees should filter out inactive accounts. The attendance cron already does (it populates `userId.isActive`).
