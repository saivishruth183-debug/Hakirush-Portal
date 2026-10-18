# Mobile client experience (agent: mobile-client)

Scope: the CLIENT role in `Mobile/` (tabs Home, Relationship, Updates, Account; route base `/client`).
Every screen reads and writes real API data. Nothing is hardcoded: no sample standings, teams or stock images.
No git commands were run, no packages were installed, and no shared files were edited.

## Files

- `src/features/client/api.ts`: response types, the hooks `useMyClient`, `useRoster`, `useGallery`, `usePerformance`, `useClientAnnouncements`, `useAnnouncement`, and the mutations `useAddRosterEntry`, `useDeleteRosterEntry`, `useMarkAnnouncementRead`. It also holds the server limits (`JERSEY_SIZES`, name ≤ 80 characters, 200 entries). It uses the keys already in the factory (`myClient`, `roster`, `gallery`, `performance`, `announcements`, `announcement`).
- `src/features/client/utils.ts`: helpers for media URLs (relative → base URL; ImageKit `?tr=w-,h-` thumbnails), the standings sort (points desc, then won desc, as on the web) and its accessibility label, roster validation and the server-error → field mapping, size counts, the announcement date format, and `isUnread`.
- `home/ClientHomeScreen.tsx`: plan card, latest update, gallery preview (6 thumbnails) and standings, with pull-to-refresh.
- `gallery/GalleryThumb.tsx`, `gallery/ClientGalleryScreen.tsx` (grid), `gallery/GalleryViewerScreen.tsx` (pager), `gallery/ZoomableImage.tsx` (pinch, pan, double-tap).
- `relationship/ClientRelationshipScreen.tsx`: add form, apparel size summary, roster list with delete.
- `updates/ClientUpdatesScreen.tsx` (list) and `updates/UpdateDetailScreen.tsx` (detail; marks the update read).
- `account/ClientAccountScreen.tsx`.
- Routes:
  - `src/app/client/gallery/index.tsx` → `/client/gallery`
  - `src/app/client/gallery/[index].tsx` → `/client/gallery/:index`
  - `src/app/client/update/[id].tsx` → `/client/update/:id`
  - The tab route files are unchanged.
- Tests: `src/features/client/__tests__/ClientScreens.test.tsx` (9 tests). They mock fetch and expo-router and use a real SessionProvider booted as a client.

## Feature parity

| Web (component → action) | Native route | Endpoint | Status | Test evidence |
|---|---|---|---|---|
| ClientSummary header: org name, plan tier, budget (INR) | `/client` plan card (adds logo/initials and member since) | GET /api/client/me | Done | "shows the own plan and honest empty states" |
| ClientSummary "Access Pending" (404) | `/client` | GET /api/client/me → 404 | Done | "Access pending … (404)" |
| PerformanceLeaderboard (sorted points/won, updated date, empty) | `/client` standings rows | GET /api/client/me/performance | Done | "lists standings by points…"; empty state test |
| Gallery panel + zoom modal | `/client` preview → `/client/gallery` grid → `/client/gallery/[index]` viewer (swipe, pinch, double-tap, prev/next, close/back) | GET /api/client/me/gallery | Done | "opens the tapped gallery image", "opens at the tapped index" |
| Updates feed + announcement modal | `/client/updates` → `/client/update/[id]` (image, status/type pills, date, venue, description) | GET /api/announcements/public, GET /api/announcements/:id | Done | "marks an unread update as read" |
| (new) mark read | opening detail | PUT /api/announcements/:id/read | Done (only when unread, online) | mark-read tests (called / not called) |
| ClientRelationship list | `/client/relationship` | GET /api/client/me/roster | Done | "lists entries with a size summary…" |
| ClientRelationship add (name + size enum) | same | POST /api/client/me/roster | Done (client validation, server 400/409 mapped, values kept on error) | "adds an entry, keeps the form after a server error…" |
| ClientRelationship delete (confirm) | same | DELETE /api/client/me/roster/:entryId | Done (confirm; a 404 counts as already removed) | "deletes only after confirmation" |
| Settings (change password) / logout | `/client/account` → `/client/change-password`, Sign out | PUT /api/setting/change-password, logout | Done (shared foundation screens) | foundation tests |

## Decisions

- **Home uses one ScrollView.** Standings are capped at 50 rows by the server and the preview at 6 images. Long lists (roster up to 200, gallery grid, updates) use a FlatList inside `<Screen scroll={false}>`.
- **Viewer colours.** The viewer is always light-on-dark using theme tokens: charcoal `text` in the light theme and `background` in the dark one. It has no header and uses a light status bar. Swiping between pages is disabled while an image is zoomed in; double-tap or pinching back out re-enables it. Previous/Next buttons serve screen-reader and switch users.
- **Thumbnails.** These try an ImageKit-resized URL first, then fall back to the original, then to a neutral icon tile.
- **Account screen.** It is composed from `ProfileHeader` and `useSignOut` instead of `AccountMenu`, so the header can show the company logo from `/client/me`. The placeholder text is gone and there is no directory.
- **Update detail.** It shows the cached list row as `placeholderData`, so it opens instantly and also works offline. It marks the update read only when it is unread and `canWrite` is true. A failed mark-read is retried on the next open.
- **Worklets.** `scheduleOnRN` from react-native-worklets is used, because `runOnJS` is deprecated in Reanimated 4.

## Open issues

- **Global Jest mock (coordinator).** The global `jest.mock('react-native-reanimated', … 'react-native-reanimated/mock')` in `jest.setup.ts` crashes as soon as any screen really imports reanimated: it needs the native worklets module. My test file adds `jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'))`. Consider moving that line into `jest.setup.ts`.
- **Gestures.** Pinch, pan and double-tap behaviour inside the horizontal FlatList has not been tried on a device (no native build was run).
- **No unread badge on the Updates tab.** The unread count shows on Home ("n unread") and in the Updates list header.
- **Thumbnails.** If the ImageKit account restricts unsigned transformations, thumbnails fall back to the full-size URL. That still works but uses more data.
- **Other agents' errors.** `npm run typecheck` currently fails only in another agent's in-progress file: `src/features/employee/attendance/EmployeeAttendanceScreen.tsx` (TS2367 'Holiday' vs `AttendanceStatus`). The client files are clean, and `npm run lint` is clean.
