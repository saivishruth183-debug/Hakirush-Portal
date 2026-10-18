# Hakirush Portal — mobile app

Native Android app (iOS kept compiling, not a release target yet) for Hakirush employees,
admins and clients. Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router · TypeScript (strict).
Not a WebView: every screen is a native React Native screen talking to the Hakirush backend API
(`docs/mobile/API_CONTRACT.md`).

Developer conventions (components, API client, query keys, routes) live in
`docs/mobile/parts/mobile-foundation.md` — read it before adding screens.

## Prerequisites

- Node 20+ (tested with Node 26) and npm.
- Android: Android Studio / Android SDK (platform 36, build-tools 36.0.0, NDK 27.1.12297006 is
  installed by Gradle on first native build), an emulator or a device with USB debugging.
- Optional: an Expo account + `npx eas-cli@latest` for cloud builds.

## Setup

```bash
cd Mobile
npm install
cp .env.example .env        # then edit EXPO_PUBLIC_API_URL
```

`EXPO_PUBLIC_API_URL` is the only configuration and is **public** (it is compiled into the app).
Never put secrets in `Mobile/.env`. Production builds refuse a non-https URL.

### Pointing the app at a local backend

The backend listens on `http://localhost:<port>` on your computer (see `Backend/README.md`).
What the app must use depends on where it runs:

| App runs on | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:<port>` (the emulator's alias for your computer) |
| iOS simulator | `http://localhost:<port>` |
| Physical device (same Wi-Fi) | `http://<your computer's LAN IP>:<port>`, e.g. `http://192.168.1.20:5000` |

Plain `http` is only acceptable in development builds. Restart Metro after changing `.env`
(`npx expo start -c`).

## Running

The app uses native modules that are not in Expo Go (secure store, date picker, …), so use a
**development build**:

```bash
npx expo run:android        # builds & installs a debug/dev build on the emulator/device, starts Metro
npm start                   # later: just start Metro and open the installed dev build
```

(`npx expo run:ios` works the same way on a Mac with a working Xcode.)

## Checks

```bash
npm run typecheck           # tsc --noEmit
npm run lint                # expo lint (eslint-config-expo + React Compiler rules), must be clean
npm test                    # jest (jest-expo preset + @testing-library/react-native)
npx expo-doctor             # dependency / config sanity
npx expo export --platform android --output-dir /tmp/hakirush-export   # JS bundle check (delete afterwards)
```

## Builds (EAS)

`eas.json` profiles:

| Profile | Output | Use |
|---|---|---|
| `development` | Android APK with `expo-dev-client` (needs Metro) | day-to-day development on devices |
| `preview` | Android APK, JS bundled (runs without Metro) | internal testing / QA sideload |
| `production` | Android App Bundle (AAB), `versionCode` auto-incremented | Play Store |

```bash
npx eas-cli@latest build -p android --profile preview
```

`.env` is git-ignored, so cloud builds do **not** see it: define `EXPO_PUBLIC_API_URL` for each
EAS environment (`npx eas-cli@latest env:create`) or add an `env` block to the profile before
building. Local release builds (`npx expo run:android --variant release`) read `.env`.

Application id / bundle identifier are **provisional** (`com.provisional.hakirushportal`) until the
owner confirms the final id — change `app.json` → `android.package` / `ios.bundleIdentifier`
before the first Play Store upload (it cannot be changed afterwards).

## Permissions (Android, least privilege)

Only `INTERNET` and `ACCESS_NETWORK_STATE` are requested. Photos are chosen with the system
photo picker (no storage permission). `app.json` explicitly blocks CAMERA, RECORD_AUDIO, storage /
media, location, SYSTEM_ALERT_WINDOW and VIBRATE so no library can add them silently.
`android.allowBackup` is false (tokens must not be restored onto another device).

## Project layout

```
src/app/            routes only (thin files): _layout, index, (auth)/login, employee|admin|client/(tabs)/...
src/features/       screens per role + shared account/auth features
src/components/     UI kit (Screen, Button, TextField, ListRow, QueryStateView, …)
src/services/       api client, session, react-query setup, query keys
src/theme/          colour/spacing/typography tokens, useTheme()
src/types/api.ts    backend contract types
src/utils/          format (Asia/Kolkata), attendanceTimer, csv, identity helpers
```
