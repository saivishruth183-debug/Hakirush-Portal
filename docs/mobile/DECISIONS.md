# Decisions

Each entry: decision, reason, consequence. Agent-level decisions are appended from `docs/mobile/parts/*.md` (see "Detailed decisions by area").

## Platform & structure
- **D1 — Expo SDK 57 + TypeScript + Expo Router, in `Mobile/`.** Latest stable SDK on 2026-10-01 (`npm view expo dist-tags`: latest 57.0.26). SDK-managed packages installed with `npx expo install`. Frontend (web) and Backend stay where they are; no restructuring.
- **D2 — Native UI only.** Screens use View/Text/Pressable/TextInput/Image/FlatList/SectionList. No WebView/Capacitor, no react-dom, react-router-dom, DOM Recharts, lucide-react, framer-motion, localStorage or `import.meta.env` in Mobile.
- **D3 — Styling with StyleSheet + shared theme tokens** (ivory/charcoal/garnet/gold, light+dark). NativeWind not used.
- **D4 — Data layer: @tanstack/react-query** with user-scoped query keys (`['u', userId, ...]`) so caches never leak across accounts; cleared on logout/account switch; focus/online managers wired to AppState/NetInfo (no background polling).
- **D5 — Provisional identifiers** `com.provisional.hakirushportal` (iOS bundle id and Android package) until the owner confirms final ids. Version 1.0.0 / build 1.

## Security & sessions
- **D6 — Two token flows on one backend.** Web keeps `POST /api/auth/login` (legacy JWT in localStorage, now revocable via `tokenVersion` and blocked when `isActive=false`). Mobile uses new `/api/auth/mobile/*` endpoints: 15-minute access token in memory + 30-day rotating opaque refresh token stored only in Expo SecureStore and only as a SHA-256 hash on the server, reuse detection revokes the family, single-flight refresh on the client. Reason: renewable native sessions without putting refresh tokens in web-readable storage.
- **D7 — Revocation.** Password change, deactivation and "log out everywhere" bump `User.tokenVersion` and revoke refresh tokens; `authMiddleware` rejects mismatched `tv` (401 `SESSION_REVOKED`) and inactive users (403 `ACCOUNT_INACTIVE`).
- **D8 — Session states on mobile:** `booting | authenticated | offlineUnverified | signedOut`. Network errors/timeouts/5xx never erase a saved session; confirmed 401 after failed refresh or 403 `ACCOUNT_INACTIVE` signs out and clears private caches/files.
- **D9 — Authorization lives on the server.** Role gates (`authorizeRoles`) on routes plus ownership checks in controllers. IDs in bodies/paths/queries never prove authority.
- **D10 — Secrets.** `Backend/.env` and `Frontend/.env` were found populated in the archive. They are excluded from git (the original `.gitignore` used `.env/`, a directory pattern that did not match the files — fixed). Values were never printed or copied. Owner should rotate: `MONGODB_URL` credentials, `JWT_KEY`, `IMAGEKIT_PRIVATE_KEY` (and review `IMAGEKIT_PUBLIC_KEY`/`IMAGEKIT_URL_ENDPOINT` exposure). Rotating `JWT_KEY` invalidates all existing sessions (expected).

## Organization model
- **D11 — One manager per department**: `Department.managerEmployeeId` (nullable) + `managerHistory`. Membership stays `Employee.department`. Manager is an organizational assignment, not a role, and grants no admin rights. Assignments come only from the owner; nothing is inferred from names, designations, salary, screenshots or creation order. Multiple reporting managers would be a separate future model.
- **D12 — Team directory scope is derived on the server** from the caller's own Employee record (`GET /api/employee/team/me`); older colleague endpoints were tightened to the same boundary and return only directory-safe fields.
- **D13 — Retention-safe deletion.** Employee "delete" deactivates (keeps payroll/attendance/leave history). Department delete is refused while employees reference it (the old cascade hook never ran because the controller used `findOneAndDelete`). Manager transfer/deactivation requires a replacement or explicit clearing in the same operation.

## Time & attendance
- **D14 — Organization timezone** `ORG_TIMEZONE` default `Asia/Kolkata` (provisional; confirm before release). Instants stored in UTC; business dates derived in the org timezone, never from the phone's timezone.
- **D15 — Server owns attendance state**; transitions are atomic and idempotent (state-guarded updates + optional `Idempotency-Key`). The app timer is display-only, derived from server timestamps; no auto check-out on app close; refetch on foreground/connectivity regain; uncertain writes are never auto-replayed.
- **D16 — Thresholds kept**: Present ≥ 8h, Half Day ≥ 4h (pending owner decision).
- **D17 — Scheduler**: Backend is configured for Vercel (serverless), where in-process `node-cron` is unreliable. The day-close job is idempotent and exposed at `/api/attendance/jobs/close-day` guarded by `CRON_SECRET` (Vercel Cron); in-process cron runs only on long-lived hosts.

## Files & notifications
- **D18 — Payslips are private files**: new uploads use ImageKit private files; access via ownership-checked `/download` (stream) or short-lived signed `/link`. PDFs validated by signature and size.
- **D19 — No push notifications in this release.** In-app notifications refresh on foreground. Background push (APNs/FCM/Expo push) is an optional enhancement requiring credentials and device tests; it is not labelled as working.

## Client content
- **D20 — No fabricated business data.** Hardcoded standings removed; roster, gallery and standings are persisted per client with admin management; empty states until real data exists.

## Builds
- **D21 — Android-only release scope (owner decision 2026-10-01).** The owner asked for the app "in Android (React Native) only". The Expo/React Native code stays cross-platform-safe, but iOS builds, iOS device testing and App Store preparation are out of scope for this delivery. (Local Xcode is also broken — xcodebuild fails to load CoreDevice — and no iOS runtime is installed.) iOS gates are marked Out of scope / Not run; the steps to add iOS later are documented in the build guide.
- **D22 — Disk space.** Owner approved clearing npm and Homebrew caches to make room for the Android build.
