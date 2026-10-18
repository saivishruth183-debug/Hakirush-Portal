# Mobile: admin people, organisation and entities (agent: mobile-admin-people)

Scope: the admin People tab and every employee, department, payslip, client, sponsor and stall workflow
of the native app (`Mobile/`). Only real API calls, coded against the backend controllers (trusted over the
contract where they differ). No git commands, no installs, no native builds.

## Files

Routes (`Mobile/src/app/admin/`, thin re-exports):
- `(tabs)/people.tsx` (existing) → `AdminPeopleScreen`
- `employees/new.tsx`, `employees/[id]/{index,edit,payslips,payslip-new,leaves}.tsx`
- `departments/{index,new}.tsx`, `departments/[id]/{index,members}.tsx`
- `clients/{index,new}.tsx`, `clients/[id]/{index,edit,content}.tsx`
- `sponsors/{index,new}.tsx`, `sponsors/[id]/{index,edit}.tsx`
- `stalls/{index,new}.tsx`, `stalls/[id]/{index,edit}.tsx`

Features (`Mobile/src/features/admin/`):
- `people/AdminPeopleScreen.tsx`: tab (Employees | Departments), `EmployeeRow`, `DepartmentsList`, `managerLine`.
- `people/DepartmentScreens.tsx`: list, new, detail (edit + manager assignment + delete), members.
- `people/EmployeeFormScreens.tsx`: add, edit (changed fields only, manager 409 flow), `validateEmployee`.
- `people/EmployeeDetailScreen.tsx`: view, deactivate (+ manager 409 flow), reactivate, links.
- `people/EmployeeRecordsScreens.tsx`: issue payslip (form → review → server result), payslip history (breakdown, open/share PDF), leave history + balance.
- `people/ManagerReassignDialog.tsx`: replacement manager / clear choice after 409 `MANAGER_REASSIGNMENT_REQUIRED`.
- `people/api.ts` (queries, writes, keys from `useQueryKeys()`), `people/types.ts`, `people/payslipMath.ts`.
- `people/common/`: `SearchList` (searchable FlatList screen used by every list), `DetailLoader`/`ScreenTitle`, `FormBanner`, `ImagePickField`, `forms.ts`, `options.ts`.
- `people/testing/renderAdmin.tsx`: test helper (real admin session boot over a fetch mock).
- `entities/shared.tsx` (`DeleteEntityButton`, `useEntityForm`), `entities/clients/{ClientScreens,ClientContentScreen}.tsx`, `entities/clients/standings.ts`, `entities/sponsors/SponsorScreens.tsx`, `entities/stalls/StallScreens.tsx`.
- Tests: `people/__tests__/adminPeople.test.tsx`.

Shared files edited: none (keys come from the existing factory; titles via `<Stack.Screen options>` inside screens).

## Feature parity

| Web (route / component / action) | Native route | Endpoint | Status | Test evidence |
|---|---|---|---|---|
| EmployeeList: search, active/inactive chip, view | /admin/people (Employees) | GET /api/employee | Done (search name/code/email/dept/designation; Active/Inactive/All) | typecheck/lint |
| EmployeeAdd (all fields, role, photo) | /admin/employees/new | POST /api/employee/add (multipart `profileImage`) | Done; `manager` never sent | – |
| EmployeeView | /admin/employees/[id] | GET /api/employee/:id | Done (all fields grouped) | adminPeople.test |
| EmployeeEdit (+ clearManager confirm) | /admin/employees/[id]/edit | PUT /api/employee/:id | Done; also dob/gender/blood group/experience/IDs (backend admin set); 409 → replacement or clear | – |
| EmployeeButtons: deactivate (+ manager 409) | /admin/employees/[id] | DELETE /api/employee/:id (JSON body `clearManager` / `replacementManagerEmployeeId`) | Done; web only offered "clear", native offers replacement too | adminPeople.test (409 → replacement → resend) |
| (new) reactivate | /admin/employees/[id] | PATCH /api/employee/:id/status `{isActive:true}` | Done | – |
| AddPayslip: form + history | /admin/employees/[id]/payslip-new, /payslips | POST /api/payslip/add, GET /api/payslip/employee/:id | Done (review step with labelled estimate; server totals shown) | adminPeople.test (validation, review, multipart) |
| AddPayslip / ViewPayslip: open PDF | /admin/employees/[id]/payslips | GET /api/payslip/:id/download → share sheet | Done; legacy files show the migration message | – |
| EmployeeLeaveList (admin) | /admin/employees/[id]/leaves → /admin/leaves/[id] | GET /api/leave/:id/admin, GET /api/leave/balance/:id | Done (detail screen owned by mobile-admin-ops) | – |
| DepartmentList | /admin/people (Departments), /admin/departments | GET /api/department | Done (manager / "Manager not assigned" / "no longer eligible", member count) | – |
| AddDepartments | /admin/departments/new | POST /api/department/add | Done | – |
| EditDepartment (manager, expectedUpdatedAt, STALE) | /admin/departments/[id] | GET /:id, GET /:id/eligible-managers, PUT /:id | Done ("No manager" clears; stale 409 → Reload) | adminPeople.test |
| DepartmentHelper delete (NOT_EMPTY) | /admin/departments/[id] | DELETE /api/department/:id | Done | adminPeople.test |
| DepartmentEmployees | /admin/departments/[id]/members | GET /api/employee/department/:id/employees | Done (manager first, Manager badge, inactive pill) | – |
| ClinetList / ClientView / ClientAdd / ClientEdit / delete | /admin/clients, /new, /[id], /[id]/edit | GET/POST/PUT/DELETE /api/client… | Done (edit: plan, budget, logo; name read-only — backend ignores it) | – |
| ClientMediaAdmin: gallery + standings | /admin/clients/[id]/content | GET/POST /:id/gallery, DELETE /:id/gallery/:imageId, GET/PUT /:id/performance | Done (no prefilled data; validation mirrors server) | adminPeople.test (standings validation) |
| Sponsor list/add/view/edit/delete | /admin/sponsors… | /api/sponsors… (multipart `logo`) | Done | adminPeople.test (delete confirm) |
| Stall list/add/view/edit/delete | /admin/stalls… | /api/stalls… (multipart `logo`, repeated `plans`) | Done | – |

## Decisions

- Lists replace the web tables with `SearchList` (FlatList, search, filters, pull to refresh, pinned Add button disabled while `!canWrite`).
- Edit forms are initialised from loaded data by mounting a child keyed on the record (no state-in-effect); the department editor key includes `updatedAt`, so Reload after `STALE_UPDATE` shows the latest version.
- Employee edit sends only changed fields (multipart because of the photo).
- Payslip `paymentDate` is not collected: the server ignores it and sets it when status is Paid (stated in the form).
- Payroll month is a picker of next month back to 24 months; months already issued are marked and rejected client-side (the server's 409 is still handled).
- Stall plans: an empty list is sent as a single empty `plans` field so an edit can clear all plans.
- Client edit cannot change name/email (the backend accepts only budget, planType and logo).

## Open issues

- Department manager history is not returned by `GET /api/department/:id`; the screen renders it only if present.
- `downloadToPrivateCache` cannot read the 409 body; a 409 on download is shown as the legacy-migration message (and `fileMigrationRequired` items never offer the download).
- Deactivate sends its manager choice as a DELETE JSON body (supported by RN fetch/OkHttp; the backend also accepts the query string).

## Test evidence (Mobile/, 2026-10-01)

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | 0 errors; 1 warning in another agent's file (`src/features/client/__tests__/ClientScreens.test.tsx`, unused eslint-disable) |
| `npx jest src/features/admin/people --runInBand` | 1 suite, 7 tests passed; exits cleanly |
| `npm test -- --runInBand` | 15 suites: 14 passed, 1 failed (`src/features/admin/requests/__tests__/adminOps.test.tsx`, mobile-admin-ops in progress: dynamic `import('xlsx')` needs `--experimental-vm-modules` in Jest); 127/128 tests passed. "Jest did not exit" comes from another suite. |

`adminPeople.test.tsx` covers: department manager assignment (eligible list, `expectedUpdatedAt`, clearing with "No manager" → `null`, stale 409 → Reload), delete of a non-empty department (409 message), employee deactivation 409 `MANAGER_REASSIGNMENT_REQUIRED` → replacement picker (excludes the employee) → resend with `replacementManagerEmployeeId`, payslip form validation + labelled estimate review + multipart submit + server totals, pure payslip validation/estimate, standings validation (integers, duplicate names, won + lost ≤ played), sponsor delete only after confirm.
