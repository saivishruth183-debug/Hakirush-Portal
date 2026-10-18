# Test Evidence

Only results actually observed are listed. Scope: Android-first delivery (owner decision 2026-10-01); iOS is out of scope for this release and every iOS column is **Not run**.

## Environment
- macOS (Apple M3 Pro), Node 26.4.0, npm 11.17.0, JDK 21.0.12 (Gradle), Android SDK 36 / build-tools 36.0.0 / NDK 27.1.12297006 / CMake 3.22.1.
- Emulator `hakirush_api36`: Pixel 6 profile, Android 16 (API 36), arm64-v8a, 1080×2400.
- Test backend: `Backend/scripts/devServer.js` = real Express app on in-memory MongoDB with synthetic fixtures (no production DB, no `.env`).
- APK under test: local release build, `assembleRelease -PreactNativeArchitectures=arm64-v8a`, `HAKIRUSH_LOCAL_TEST_BUILD=1`, API `http://10.0.2.2:5050` (cleartext allowed only in this local-test variant), debug-signed.

## Automated suites
| Suite | Command | Result |
|---|---|---|
| Backend integration (isolated in-memory MongoDB) | `cd Backend && npm test` | **141/141 pass** (24 suites) — auth, sessions/races, team isolation, departments/manager, employees, admin resources, attendance, corrections, leave, payslips, payslip migration, client isolation |
| Session race regressions | `node --test tests/sessionRevocation.test.js` | 9/9 pass (paused-insert reuse, refresh vs logout, crash after claim, access revoked after logout) |
| Web build | `cd Frontend && npm run build` | Pass |
| Web lint | `cd Frontend && npm run lint` | 19 errors, 1 warning (original debt was 38 errors, 3 warnings; remaining items are in untouched files / `only-export-components`) |
| Mobile typecheck | `cd Mobile && npm run typecheck` | Pass |
| Mobile lint | `cd Mobile && npm run lint` | Pass (0 errors) |
| Mobile unit/component | `npm test -- --runInBand` | Foundation 97/97; client 9/9; employee Team 5/5 (final full-suite count recorded in STATUS.md) |
| Expo doctor | `npx expo-doctor` | 21/21 |
| JS bundle export | `npx expo export --platform android` / `ios` | Pass (bundling check only — not a native build) |

## Native Android build
| Build | Result | Artifact |
|---|---|---|
| First release build (cold Gradle) | BUILD SUCCESSFUL in 9m 19s, 910 tasks | `Mobile/android/app/build/outputs/apk/release/app-release.apk` (47 MB, arm64-v8a) |
| Incremental rebuild with employee + client screens | BUILD SUCCESSFUL in 37s | same path; installed with `adb install -r` → Success |

## Installed-app journeys on the Android emulator (release APK, no Metro)
| ID | Journey | Result | Evidence |
|---|---|---|---|
| AUTH-01a | Cold start → login screen (brand, theme) | Pass | screenshot s1 |
| AUTH-01b | Wrong password → uniform "email or password is incorrect" | Pass | s3 |
| AUTH-01c | Keyboard open: form + Sign in stay visible; password show/hide toggle | Pass | s4, s5 |
| AUTH-01d | Employee sign-in (IT developer) → employee tabs | Pass | s7 |
| TEAM-01 | IT employee Team tab: "IT team", **Manager Asha Rao first** with Manager label, members sorted, **"You" once**, initials avatars, separators, no Operations people, deactivated IT user excluded | Pass | s8 + live API check (`totalMembers: 3`) |
| TEAM-H | Home team preview manager-first + View all; department-only highlights | Pass | s7 |
| ATT-01a | Check in → server timestamp (8:25 pm IST), timer from server time, Pause/Check out offered, history "In progress" | Pass | s10 |
| NOTICE-01 | Open announcement → detail; unread "New" badge cleared after opening | Pass | s13 |
| NAV-01 | Android back from a pushed screen returns to the tab | Pass | s11 |
| AUTH-02 | Sign out confirmation ("saved data on this device will be removed") → login screen | Pass | s15, s16 |
| AUTH-03 | Account switch employee → client: no employee data shown, client tabs only | Pass | s20 |
| CLIENT-01a | Client home: own plan/budget, unread update, honest empty gallery (no fake images) | Pass | s20 |
| CLIENT-01b | Roster add (name + jersey size picker) → saved to server, apparel summary updated | Pass | s21–s23 |
| DEACT-01 | Deactivated account cannot sign in (API 403 ACCOUNT_INACTIVE) | Pass (API) | curl against test backend |

Screenshots were captured with `adb exec-out screencap` during the session (synthetic data only).

## Not run / blocked
| Item | Status | Reason / next step |
|---|---|---|
| iOS build, simulator, device | Not run (out of scope) | Android-first scope; local Xcode is 16.2 (SDK 57 requires 26.4+) and fails to load CoreDevice |
| Physical Android phone | Not run | No device connected; `adb install` the APK on a phone with USB debugging |
| Photo/PDF upload to real ImageKit | Not run | Test backend uses placeholder ImageKit keys by design |
| Production/staging backend | Not run | New endpoints are not deployed yet; owner must deploy Backend to an HTTPS host |
| Store-signed AAB | Not run | Needs owner's upload keystore / Play Console account |
