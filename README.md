# Tyagi's Home

An offline-first React Native (Expo) app for tracking daily household essentials:
milk deliveries and domestic staff attendance.

All data is stored locally in SQLite on the device. There is no backend and no
network dependency — the app works fully offline.

## Features

**Milk tracker** — record daily buffalo and cow milk in litres on a month
calendar. Per-litre prices are configured once as defaults and applied to new
entries automatically; monthly totals (litres and ₹) are calculated per milk
type. Any month's record can be shared as an image.

**Attendance** — manage employees on either a daily or monthly salary basis,
each with a monthly allowed-leave quota. Mark full day, first half, second half,
or leave on a calendar, with a running summary of working days and excess leaves.

**Automatic daily entries** — a background task seeds each new day with the
configured milk defaults and marks active employees present, so the common case
requires no interaction.

Only the current and previous month are editable; older months are read-only.

## Stack

- Expo SDK 54 / React Native 0.81
- expo-sqlite for local persistence
- React Navigation (bottom tabs + native stack)
- expo-background-fetch + expo-task-manager for the daily auto-entry
- react-native-view-shot + expo-sharing for exporting a month as an image

## Running locally

```bash
npm install
npx expo start
```

Then open the project in **Expo Go** on your phone — scan the QR code, or enter
the `exp://<your-lan-ip>:8081` URL manually. The phone and computer must be on
the same network.

## Project layout

```
App.js                     root component; DB init + foreground reconnect
src/database/database.js   all SQLite access (schema, queries, reconnect logic)
src/screens/               Home, MilkCalendar, EmployeeList, EmployeeAttendance
src/components/            CalendarGrid, MonthSelector, ErrorBoundary
src/utils/                 date helpers, share/capture, background task
src/constants/             theme colors, attendance statuses
```

### Database resilience

Android may close the native SQLite connection while the JS context survives
(app backgrounded, OS reclaiming resources), which leaves a cached handle
pointing at a dead connection. `src/database/database.js` handles this in three
ways: the connection handle is only cached after a successful init, every query
runs through a wrapper that reopens and retries once on a connection-level
error, and `App.js` proactively reconnects when the app returns to the
foreground. Screens surface load failures with a retry action rather than
rendering an empty state.

## Branding

Icons and the in-app logo are generated from the Claude Design logo mark. See
`scripts/build_icons_from_design.py` and `scripts/logo_source.html`.

Theme colors: `#4A6741` (sage green), `#D4A843` (gold).

> `scripts/generate_icons_legacy.py` produces the older pre-2026 branding and
> will overwrite the current assets if run. It is kept for reference only.

## Building

```bash
# APK for direct install / testing
npx eas-cli build --platform android --profile preview

# AAB for Play Store submission
npx eas-cli build --platform android --profile production
```

## CI/CD

Pushes and pull requests are built automatically on EAS:

| Event | Result |
|---|---|
| Pull request | Preview APK |
| Merge to `main` | Production AAB, submitted to the Play Store internal track as a draft |
| Manual dispatch | Choose the profile, and whether to submit |

Setup (the `EXPO_TOKEN` and `GOOGLE_SERVICE_ACCOUNT_KEY` secrets, and the
one-time manual first upload Google requires) is documented in
[docs/ci-setup.md](docs/ci-setup.md).
