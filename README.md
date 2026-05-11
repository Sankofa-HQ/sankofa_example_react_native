# Sankofa React Native example

A runnable Expo Router app that exercises every product the React Native SDK ships — Analytics, Catch (Crashlytics + Sentry merged), Switch, Config, Pulse, Replay, Deploy (OTA) — against a local or remote Sankofa engine.

## Run

```bash
npm install

# iOS
npx expo run:ios

# Android
npx expo run:android
```

> ⚠️ Requires a **development build** — Expo Go can't load the native Sankofa module. The native bridges for session replay, heatmaps, and native crash capture only exist in dev / prod builds.

## Point at your engine

Edit `app/_layout.tsx`:

```tsx
Sankofa.initialize('', {
  endpoint: 'http://192.168.1.241:8080',   // or your local IP / staging URL
  // ...
});
```

The default `http://192.168.1.241:8080` points at a developer-local Sankofa engine.

## What it demonstrates

### Crashes tab (`app/(tabs)/crashes.tsx`)

13+ scenarios across the Catch API surface:

- TypeError on null property
- Fetch error + manual `captureException` with context
- Out-of-bounds + custom error with fingerprint
- Native storage write failure
- `captureMessage` (warning, non-error)
- Native-module method-missing (bridge drift symptom)
- Manual breadcrumb trail
- **Phase A** — `Sankofa.log()` Crashlytics-style breadcrumb riding on a captured exception
- **Phase B** — `Sankofa.withScope` single + nested scope overlays
- **Phase B** — `beforeSend` demo events (the hook drops one, scrubs `user_email` from another)

### Phase B `beforeSend` (`app/_layout.tsx`)

`Sankofa.initialize(_, { beforeSend: ... })` is wired at init:

- Drops messages containing `"[noise]"`.
- Scrubs `user_email` from `extra`.

### Lab tab (`app/(tabs)/lab.tsx`)

Live preview of flags + config decisions powered by `SankofaSwitch` + `SankofaConfig`, with onChange listeners that re-render the UI when the dashboard updates a value.

### Replay tab (`app/(tabs)/replay.tsx`)

Drives a stress-test view that exercises the native screenshot capture + masking pipeline.

### Pulse tab (`app/(tabs)/pulse.tsx`)

Triggers the in-app survey runtime via `SankofaPulse`.

### Identify tab (`app/(tabs)/identify.tsx`)

Demonstrates `Sankofa.identify` → analytics + Catch + replay events all carry the new `distinct_id`.

### Update modal (`UpdateModal.tsx`)

Live OTA update flow — checks for a Deploy update on launch and prompts the user to install.

## Screen tagging pattern

This example uses Expo Router, which owns the `NavigationContainer` internally. Each tab calls `useSankofaScreen("Name")` per screen — see `app/(tabs)/crashes.tsx` for an example.

For **non-Expo-Router** apps that hold a `NavigationContainer` directly, drop `useSankofaNavigationTracking(navRef)` once in your app shell. `app/_layout.tsx` has a comment block with the exact pattern.

## Documentation

Full RN SDK reference: [docs.sankofa.dev/sdks/react-native](https://docs.sankofa.dev/sdks/react-native/overview).
