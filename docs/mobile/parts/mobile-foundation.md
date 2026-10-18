# Mobile foundation (agent: mobile-foundation)

Scope: the native app shell in `Mobile/` (Expo SDK 57, TypeScript strict, Expo Router): config, theme,
UI kit, API client, session, React Query, types, routing/guards, shared account features, utilities,
tests and docs. Android is the release target; iOS must keep compiling but is not tuned or tested.
No git commands were run. Only `Mobile/**` and this file were written.

## Versions

| Package | Version | Notes |
|---|---|---|
| expo | 57.0.26 | `latest` dist-tag at the time of writing |
| react-native | 0.86.3 | |
| react / react-dom | 19.2.3 / 19.2.3 | react-dom is not used by the app; it is pinned only because expo-router's web-only deps need it as a peer |
| expo-router | 57.0.24 | `typedRoutes` is off, so typecheck does not depend on generated `.expo/types` |
| TypeScript | 6.0.3 | TS 6 defaults `types` to `[]`, so tsconfig sets `"types": ["jest"]` |
| @tanstack/react-query | 5.104.0 | |
| expo-secure-store 57.0.4, expo-file-system 57.0.7, expo-sharing 57.0.22, expo-image-picker 57.0.20, expo-document-picker 57.0.3, expo-image 57.0.5, expo-dev-client 57.0.19 | | installed with `npx expo install` |
| @react-native-community/netinfo 12.0.1, @react-native-community/datetimepicker 9.1.0 | | |
| react-native-safe-area-context 5.7.0, react-native-screens 4.26.2, react-native-gesture-handler 2.32.0, react-native-reanimated 4.5.1 (+ worklets 0.10.1) | | from the template |
| @expo/vector-icons | 15.1.1 | Ionicons only; SDK 57 no longer ships it in the template |
| jest 29.7.0, jest-expo 57.0.5, @testing-library/react-native 14.0.1, test-renderer 1.2.0, @types/jest 29.5.x | | see the test-renderer note below |
| eslint 9.39.5, eslint-config-expo 57.0.2 | | includes the React Compiler `react-hooks/*` rules |

Platform minimums. I read these from the installed packages; they are not assumptions.
- **Android: minSdk 24 (Android 7.0), targetSdk 36, compileSdk 36, buildTools 36.0.0, NDK 27.1.12297006.** Source: `node_modules/react-native/gradle/libs.versions.toml`, which Expo's gradle plugin uses as its version catalog.
- **iOS: deployment target 16.4.** Source: `node_modules/expo/Expo.podspec`. React Native alone allows 15.1, but Expo raises it.
- **test-renderer:** RNTL 14 needs `test-renderer`. Version 1.3 pulls `react-reconciler`, which requires React ^19.3, and that caused the "invalid react" peer warning. I pinned `test-renderer@~1.2.0` (reconciler 0.33, which accepts React ^19.2). No `--force` and no `--legacy-peer-deps`. `npm ls react` is clean.

## Files created (Mobile/)

- Config: `app.json`, `eas.json`, `.env.example`, `.gitignore`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `jest.setup.ts`, `README.md`. The template's `AGENTS.md` is kept. I deleted the template's example screens, components, hooks, assets, `scripts/reset-project.js`, `.vscode/` and `.claude/settings.json` (that last file was a plugin toggle from the template).
- Assets: `assets/images/icon.png` is 1024 px, logo on charcoal, opaque. `adaptive-icon.png` is the Android foreground with safe-zone padding. `splash-icon.png` is transparent. All three are generated from `Frontend/public/favicon.png` with the template's `jimp-compact`.
- `src/app/`: route files only (tree below).
- `src/navigation/`: `RoleGate.tsx` (`useRoleGate(role)`) and `options.tsx` (navigation theme, stack/tab options, `tabIcon`).
- `src/theme/`: `tokens.ts` (light/dark colours, spacing, radii, typography, `TOUCH_TARGET`=48, avatar palette, `toneColors`) and `index.ts` (`useTheme()`).
- `src/components/`: the UI kit (list below) plus the `index.ts` barrel.
- `src/services/api/`:
  - `client.ts`: `api`, `request`, `refreshSession`, `getValidAccessToken`, `toFormData`, `createIdempotencyKey`, `setAuthHandlers`.
  - `errors.ts`: `ApiError` and its helpers.
  - `config.ts`: base URL and `buildUrl`.
  - `authState.ts`: in-memory tokens and the session generation.
  - `download.ts`: `downloadToPrivateCache`, `shareFile`, `writePrivateTextFile`, `clearPrivateFiles`.
  - `index.ts`.
- `src/services/session/`:
  - `SessionProvider.tsx` (`useSession`).
  - `engine.ts`: boot, `clearSessionLocal`, reasons.
  - `persist.ts`: generation-checked writes.
  - `storage.ts`: SecureStore behind a serial queue, plus snapshot handling.
  - `index.ts`.
- `src/services/`:
  - `queryClient.ts`: client, retry policy, AppState/NetInfo wiring.
  - `queryKeys.ts`: `createQueryKeys`, `useQueryKeys`.
  - `cacheScope.ts`: department-scoped cache reconciliation.
  - `hooks.ts`: `useApiQuery`, `useApiMutation`.
- `src/types/api.ts`: contract and model types.
- `src/utils/`: `format.ts`, `attendanceTimer.ts`, `csv.ts`, `identity.ts` (initials, avatar colour, `homeHrefForRole`, `ROLE_LABELS`).
- `src/hooks/`: `useNow` (1 s tick only while the screen is focused and the app is active), `useNetworkStatus`, `useDebouncedValue`.
- `src/features/account/`: `ChangePasswordScreen`, `AccountMenu` (More/Account body), `ProfileHeader`, `useSignOut`, `api.ts`.
- `src/features/auth/`: `LoginScreen`, `loginErrors.ts`.
- `src/features/{employee,admin,client}/<area>/<Role><Area>Screen.tsx`: tab placeholders. The More and Account screens are already real (`AccountMenu`).
- `src/testing/`: `fetchMock.ts`, `resetSession.ts`, `renderWithProviders.tsx` (test-only helpers).
- Tests: `src/**/__tests__/*.test.ts(x)` (11 suites).

## Route tree and paths

```
src/app/_layout.tsx                 providers + root Stack (headerless) + splash gate + ErrorBoundary
src/app/index.tsx                   "/"  → routes by session status / role
src/app/(auth)/_layout.tsx          signed-in users are redirected to their home
src/app/(auth)/login.tsx            /login
src/app/access-denied.tsx           /access-denied
src/app/+not-found.tsx
src/app/employee/_layout.tsx        guard (role employee) + Stack
src/app/employee/(tabs)/_layout.tsx Tabs: index(Home) attendance team leave more
src/app/employee/change-password.tsx  /employee/change-password
src/app/admin/_layout.tsx           guard (role admin) + Stack
src/app/admin/(tabs)/_layout.tsx    Tabs: index(Home) people attendance requests more
src/app/admin/change-password.tsx
src/app/client/_layout.tsx          guard (role client) + Stack
src/app/client/(tabs)/_layout.tsx   Tabs: index(Home) relationship updates account
src/app/client/change-password.tsx
```

Paths:
- `/employee`, `/employee/attendance`, `/employee/team`, `/employee/leave`, `/employee/more`, `/employee/change-password`
- `/admin`, `/admin/people`, `/admin/attendance`, `/admin/requests`, `/admin/more`, `/admin/change-password`
- `/client`, `/client/relationship`, `/client/updates`, `/client/account`, `/client/change-password`
- `/login`, `/access-denied`

**Why real `employee/`, `admin/` and `client/` folders instead of `(employee)` groups.** With groups, all three Home tabs would map to `/`, both Attendance tabs to `/attendance`, and so on. Expo Router does not reject that, but deep links and `router.push('/attendance')` become ambiguous. Real segments give every screen a unique URL.

Guards (`useRoleGate`):

| Session state | Result |
|---|---|
| booting | loading state (the splash is still visible) |
| signedOut | `/login` |
| offlineUnverified with no cached user | `/`, which shows "Can't connect" with Retry and Sign out |
| wrong role | the user's own home, plus a toast saying the page isn't available. The other role's layout never renders its navigator. |

`/access-denied` exists for feature screens to use after a 403.

Android back:
- Tabs use `backBehavior="firstRoute"`. Back on a non-Home tab goes to Home. Back on Home leaves the app.
- Every guard uses `<Redirect>` (a replace), so the root stack never holds `index` or `login` underneath the tabs.

Splash: it stays up until session boot resolves. It is hidden when boot finishes, when boot errors (then `index` shows "Couldn't start" with Retry, via `bootError`/`retryBoot`), and after an 8-second safety timeout.

## Conventions for feature agents

### Where things go

- Route files in `src/app/` are thin, one line: `export default MyScreen`. Screens live in `src/features/<role>/<area>/`. Replace the placeholder component that the tab route imports. Keep the route file and its export name, or update the import.
- **To add a stack screen pushed over the tabs** (it gets a back button and no tab bar):
  1. Create `src/app/<role>/<name>.tsx`, e.g. `src/app/employee/payslips.tsx` → `/employee/payslips`. Dynamic routes work too: `src/app/admin/people/[id].tsx` → `/admin/people/123`.
  2. Give it a title with `<Stack.Screen name="payslips" options={{ title: 'Payslips' }} />` in `src/app/<role>/_layout.tsx`. Alternatively, render `<Stack.Screen options={{ title }} />` inside the screen.
  3. Navigate with `router.push('/employee/payslips')` from `expo-router`.
- Never put tests or non-route files under `src/app/`.
- Don't import another role's screens. Shared pieces go in `src/components` or `src/features/account`. If several roles share a feature, use `src/features/shared/<area>`.

### Screens and components

Import everything from `@/components`. Each screen should:
- Start with `<Screen>`.
- Use `QueryStateView` for loading, error, empty and offline states.
- Use `ListRow` and `Card` for lists.
- Use `TextField`, `SelectField`, `DateField` and `FormSection` for forms, with a `Button` as `footer`.
- Never set `allowFontScaling={false}` and never use `numberOfLines` on content the user must read.
- Use theme tokens (`useTheme()`) only. No raw hex colours.

| Component | Key props |
|---|---|
| `Screen` | `scroll` (default true; pass false when you render your own FlatList), `refreshing` + `onRefresh` (pull to refresh), `keyboardAvoiding` (forms; also needed on Android because of edge-to-edge), `edges` (default: bottom inset only outside tabs; headerless screens pass `['top','bottom']`), `header` (non-scrolling top, e.g. a SearchBar), `footer` (pinned, e.g. a submit Button), `padded`, `showOfflineBanner` (default true). Content is capped at 720 dp and centred on tablets. |
| `AppText` | `variant`: display, title, heading, subheading, body, bodyStrong, secondary, caption, label. `color`: a theme name. `align`. Title variants are announced as headers. |
| `Button` | `label`, `onPress` (if it returns a promise, a spinner shows and presses are ignored until it settles), `variant`: primary, secondary, ghost, destructive. `loading`, `disabled`, `icon`, `fullWidth`. |
| `IconButton` | `icon`, `accessibilityLabel` (**required**), `onPress`, `variant`: plain or tonal, `color`, `loading`. 48×48. |
| `TextField` | `label`, `value`, `onChangeText`, `helper`, `error`, `secure` (adds a show/hide toggle), `multiline`, `required`, `disabled`, `ref`, plus normal TextInput props. |
| `SelectField<T>` | `label`, `value`, `options` (`{label, value, description?}`), `onChange`, `searchable` (automatic above 8 options), `error`, `helper`, `required`, `disabled`. Opens a native full-screen Modal; Android back closes it. |
| `DateField` | `label`, `value` and `onChange` as `'YYYY-MM-DD'` or null, `minimumDate`/`maximumDate` (YYYY-MM-DD), `clearable`, `error`, `helper`. Uses the Android system dialog. |
| `Card` | `onPress` (makes the whole card a button; give it an `accessibilityLabel`), `padded`. |
| `ListRow` | `title`, `subtitle`, `meta`, `left` (`{icon}`, `{avatar:{uri,name,id}}`, or a node), `right` (accessory), `chevron`, `onPress`, `destructive`, `disabled`. |
| `Avatar` | `uri`, `name`, `id` (gives a stable colour), `size`. Falls back to initials. Label is "Photo of X" or "X initials". |
| `StatusPill` / `Badge` / `statusTone(s)` | `status` (backend string; the tone is chosen automatically), `label`, `tone`, `accessibilityPrefix`. |
| `SectionHeader` | `title`, `subtitle`, `actionLabel` + `onAction`. |
| `DetailRow` | `label`, `value`, `placeholder` (an empty value is read as "Not provided"). |
| `Divider` | `inset`. |
| `EmptyState` | `title`, `message`, `icon`, `actionLabel` + `onAction`. |
| `ErrorState` | `error` (ApiError-aware wording), `title`, `message`, `onRetry`. No retry is offered on a 403. |
| `LoadingState` | `label`, `variant`: spinner or skeleton, `rows`. |
| `OfflineBanner` | Rendered automatically by `Screen`. |
| `SearchBar` | `value`, `onChangeText`, `placeholder`, `accessibilityLabel`, `onSubmit`. Debounce with `useDebouncedValue`. |
| `SegmentedControl<T>` | `options`, `value`, `onChange`, `accessibilityLabel`. |
| `FormSection` | `title`, `description`. |
| `QueryStateView<T>` | `query`, `children(data)`, `isEmpty(data)`, `emptyTitle`, `emptyMessage`, `emptyActionLabel` + `onEmptyAction`, `loadingVariant`. |
| `confirm({title, message, confirmLabel, cancelLabel, destructive})` | Returns `Promise<boolean>`. Built on Alert; back or outside tap counts as false. |
| `toast` / `useToast()` | `.success(msg)`, `.error(msg)`, `.info(msg)`, `.show({message, tone, actionLabel, onAction, duration})`. The message is announced to screen readers. |
| `PlaceholderScreen` | Used only by the not-yet-implemented tabs. |

### Calling the API

- Paths always start with `/api/...`. The client adds the base URL, the bearer token, a 20 s timeout, the single 401 refresh-and-retry, and drops stale-generation responses.
- **Reads:**
  ```ts
  const keys = useQueryKeys();
  const q = useApiQuery<TeamResponse>(keys.team({ search }), '/api/employee/team/me', { query: { search } });
  ```
  Or call `useQuery({ queryKey, queryFn: ({ signal }) => api.get<T>(path, { signal, query }) })` yourself. Always pass `signal`.
- **Writes:**
  ```ts
  const m = useApiMutation((body) => api.post<R>('/api/leave/add', body), { invalidate: [keys.leaves(), keys.leaveBalance()] });
  ```
  The mutation refuses to run while `canWrite` is false, and never retries. Disable write buttons with `useSession().canWrite`. For attendance transitions, pass `idempotencyKey: createIdempotencyKey()` and create the key once per user action.
- **Uploads:**
  ```ts
  api.post(path, toFormData({ caption }, { image: { uri, name, type } }))
  ```
  Never set Content-Type yourself.
- **Errors:** everything throws `ApiError` with `{kind: 'network'|'timeout'|'http'|'config'|'cancelled', status?, code?, message, details?}`.
  - Show `getErrorMessage(e)`.
  - Ignore `kind === 'cancelled'`.
  - Field errors arrive as `details.field` (see ChangePasswordScreen).
  - The session handles 401s and `ACCOUNT_INACTIVE` itself. Don't sign the user out from a feature.
- **Files:**
  - `downloadToPrivateCache('/api/payslip/<id>/download', 'payslip-2026-09.pdf')`, then `shareFile(file, { mimeType: 'application/pdf' })`.
  - CSV: `writePrivateTextFile(name, toCsv(...))`, then `shareFile`.
  - Everything goes to `<cache>/private-downloads`, which is wiped on logout.
- **Dates:**
  - Business dates are `YYYY-MM-DD` and are shown with `formatDate`/`formatDateLong`.
  - Instants use `formatTime`/`formatDateTime`, always in Asia/Kolkata.
  - Money uses `formatCurrency` (INR). Durations use `formatDurationHM`.
  - The attendance timer is `computeWorkedMs(attendance, computeClockOffset(serverTime), useNow())`.

### Query keys

- Use the factory in `src/services/queryKeys.ts` through `useQueryKeys()`. Every key starts with `['u', userId]`.
- **Directory data** (team, department colleagues, birthdays, anniversaries, new joiners) is also scoped by department: `['u', userId, 'dept', departmentId|'none', ...]`.
  - When the server reports a different department, `SessionProvider` cancels and **removes** the old department's queries before it exposes the new user.
  - When the server reports a different user or role, the whole cache is cleared.
  - Render directory data only when `useSession().directoryVerified` is true. It is false while offlineUnverified.
- Add new domains to the factory, one line each, with filter params last. That way `keys.x()` with no params works as an invalidation prefix.

### Session

`useSession()` returns:
- `status`: `booting`, `signedOut`, `authenticated` or `offlineUnverified`
- `user`, `canWrite`, `directoryVerified`, `signOutReason`, `bootError`
- actions: `login`, `logout`, `endSession(reason)`, `refreshUser`, `retryVerification`, `retryBoot`

`refreshUser` also runs automatically on foreground and on reconnect, throttled to once every 60 s.

## Decisions

### Session

- **States.** The session moves between `booting`, `signedOut`, `authenticated` and `offlineUnverified`.
  - **Boot:**

    | Boot outcome | Result |
    |---|---|
    | No refresh token | signedOut |
    | Refresh succeeds | authenticated |
    | 400, 401 or 403 | storage cleared, signedOut with a reason (inactive, expired, or "signed out for security" on reuse or revocation) |
    | Network, timeout, 5xx, 429 or anything else | offlineUnverified. The cached snapshot gives the role shell and the refresh token is kept. |

  - **offlineUnverified:**
    - `canWrite` and `directoryVerified` are false and the banner shows.
    - It retries on reconnect and on foreground.
    - If there is no cached snapshot, `/` shows "Can't connect" with Retry and Sign out.
- **Where tokens live.**
  - The access token is in memory only.
  - SecureStore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) holds only the refresh token and a snapshot `{_id, name, role, employeeId, employeeRecordId, departmentId, departmentName, designation, clientId, profileImage}`. No email and no HR data.
  - `android.allowBackup=false`.
- **Refresh (single flight).**
  - One in-flight refresh per session generation. A request that gets a 401 joins the in-flight refresh. Boot and a 401 can never run two refreshes, and a test proves it.
  - The rotated refresh token is persisted to SecureStore *inside* the single-flight promise, before the lock is released.
  - If a request's token has already been rotated by another caller, it retries with the new token without refreshing again.
- **401 handling.**

  | Response | Action |
  |---|---|
  | 401 `SESSION_REVOKED` | signed out at once, no refresh attempt (backend update: logout or reuse revokes by `sid`) |
  | Any other 401 on an authenticated request | refresh once, then retry once |
  | 401 after that retry, or a failed refresh with 401/403 | the session is rejected |
  | 403 `ACCOUNT_INACTIVE` on any request | the session is rejected |
  | Transient refresh failure | the request fails, the session stays |

  No other write is ever replayed.
- **Race safety.**
  - `authState` has a session generation counter. Logout, login and account switch bump it.
  - Every request, refresh and persist checks the generation after each await, and stale results are dropped with `kind: 'cancelled'`.
  - Persistence follows "check → write → re-check". If the generation changed, it undoes only its own writes (compare-and-delete).
  - All SecureStore operations go through one serial queue, so an old session's slow write can never land after a logout's clear or a newer login's write.
  - A stale request can never sign out a newer session, because rejection callbacks are checked against the current generation.
- **Logout.**
  - The local half runs first: bump the generation, clear memory and SecureStore, set status to signedOut.
  - Then a best-effort `POST /api/auth/mobile/logout`.
  - Then `cancelQueries`, `queryClient.clear()`, `clearPrivateFiles()`, and clearing the expo-image memory and disk caches.
  - Login always starts from the same clean slate, which covers an account switch.
- **Change password.** On success the server revokes every session, so the app calls `endSession(SIGN_OUT_REASONS.passwordChanged, { revokeRemote: false })`. A wrong old password is a 400 `VALIDATION_ERROR` with `details.field` and is shown inline.

### React Query

- Retry: never on 4xx, config or cancelled; up to 2 times for transient errors.
- Mutations never retry.
- `focusManager` follows AppState, so queries refetch on foreground and polling pauses in the background.
- `onlineManager` follows NetInfo, so queries pause offline. `QueryStateView` shows an offline empty state when there is no cached data.

### Android

- **Edge-to-edge:** this is the default and is mandatory in RN 0.86 / SDK 57. Expo enables it; there is no flag to set.
  - Screens handle insets through `Screen`, react-navigation headers and the tab bar.
  - With edge-to-edge, `adjustResize` no longer resizes the window, so `Screen keyboardAvoiding` uses a KeyboardAvoidingView on Android too, offset by the header height.
- **Permissions:** least privilege.
  - The final manifest requests only INTERNET and ACCESS_NETWORK_STATE. I checked it with `npx expo config --type introspect`.
  - Blocked: CAMERA, RECORD_AUDIO, READ/WRITE_EXTERNAL_STORAGE, READ_MEDIA_IMAGES/VIDEO/AUDIO, fine/coarse/background LOCATION, SYSTEM_ALERT_WINDOW and VIBRATE.
  - expo-image-picker is configured with `cameraPermission: false` and `microphonePermission: false`. It uses the system photo picker, which needs no permission. The iOS photo usage string is set.
  - expo-secure-store has `faceIDPermission: false`.
- **Identifiers:** `com.provisional.hakirushportal`, provisional for both iOS and Android until the owner confirms. `versionCode` is 1 and `buildNumber` is "1".
- **iOS:** `ios.supportsTablet` is false. Layouts are capped at 720 dp, so Android tablets look fine, but iPad was not designed or tested.
- **EAS profiles:**

  | Profile | Build | Notes |
  |---|---|---|
  | `development` | dev-client APK | `expo-dev-client` is installed |
  | `preview` | release APK, JS embedded | runs without Metro |
  | `production` | AAB | `autoIncrement` with `appVersionSource: local` |

  `.env` is not uploaded to EAS, so set `EXPO_PUBLIC_API_URL` per environment with `eas env:create` (documented in the README).
- **API URL:** a missing `EXPO_PUBLIC_API_URL` raises a clear config error. Production builds require https.

### UI and dependencies

- **Theme:**
  - Ivory `#FBF8F3`, charcoal `#1C1A17`, garnet `#7A2233`, gold `#B8912E`. These were taken from the web app's most-used colours.
  - Dark-mode counterparts are lightened for contrast.
  - Every text/background pair is tested for WCAG AA (4.5:1) in both themes, along with white initials on every avatar colour.
- **expo-clipboard is not installed,** so the employee code in `ProfileHeader` is selectable text instead of having a copy button.
- **React Compiler** is enabled (template default). The lint runs its `react-hooks/*` rules with no suppressions. `useNow` uses `useSyncExternalStore` for AppState and only sets state inside timer callbacks.

## Test evidence (run in Mobile/, 2026-10-01)

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | exit 0, no errors |
| `npm run lint` (`expo lint`); also `npx eslint . --max-warnings=0` | exit 0, 0 problems |
| `npm test -- --runInBand` | **11 suites, 97 tests passed** |
| `npx expo-doctor` (1.20.4) | 21/21 checks passed |
| `EXPO_PUBLIC_API_URL=https://api.example.com npx expo export --platform android --output-dir /tmp/hakirush-export-android` | OK. Hermes bundle 4.2 MB; the URL is inlined. Output deleted. |
| `… --platform ios --output-dir /tmp/hakirush-export-ios` | OK. Bundle 4 MB. Output deleted. |
| `npx expo config --type introspect` | Android permissions: INTERNET kept, all blocked entries `tools:node="remove"` |

What the test suites cover:
- **API client:**
  - Error mapping: network, timeout, caller cancellation, 401, 5xx with no server text leaked, 4xx code/details and legacy `message`, `success:false` on 200, missing base URL.
  - Request format: JSON vs multipart headers, bearer token.
  - Refresh: two concurrent 401s → one refresh; boot refresh + a concurrent 401 → exactly one `/auth/mobile/refresh` call; `SESSION_REVOKED` → no refresh and a rejection; a failed refresh notifies once; a transient refresh failure keeps the session.
  - Generation: a stale response is discarded after logout; logout during an in-flight refresh persists nothing; a stale 401 does not sign out a new session.
- **Session:**
  - Boot: no token, OK, network, 5xx, 401, 403 ACCOUNT_INACTIVE.
  - Races: boot persistence vs logout, account switch during refresh, a stale persist vs a newer login.
  - Provider: a department change removes the old department's directory cache before exposing the user; offlineUnverified flags; logout clears storage and cache and revokes remotely.
- **Cache and keys:** key shape with user and department scope, `reconcileUserChange`, retry policy.
- **Routing** (real `src/app` tree via `expo-router/testing-library`): signed-out deep link → `/login`; employee → `/employee`; an employee deep link to `/admin/people` → `/employee`.
- **UI:** Avatar initials, photo-error fallback; LoginScreen validation, `INVALID_CREDENTIALS` message, network message; theme contrast.
- **Utilities:** csv RFC 4180, formula neutralisation, BOM; attendanceTimer math with clock offset; format (IST business date, months, durations, INR).

## Not done / follow-ups

- No native build was run (`prebuild`, `run:*`, gradle and xcodebuild are owned by the coordinator). The NDK is not installed on this machine.
- The role tab screens are placeholders, owned by the feature agents.
- `downloadToPrivateCache` maps native download failures by parsing "status: NNN" from the error message, because the SDK 57 `File.downloadFileAsync` does not expose the HTTP status. Verify this on a device with the payslip endpoint.
- A refresh request that times out on the client after the server has rotated the token will sign the user out on the next refresh (`REFRESH_REUSED`). This is inherent to rotation; the user simply signs in again.
