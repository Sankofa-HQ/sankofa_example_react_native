# Catch Crash Gallery

The **Crashes** tab (`app/(tabs)/crashes.tsx`) is a hands-on playground for the
Sankofa Catch React Native module. Each button on the screen triggers a
realistic RN failure mode so you can verify that events land in the Catch
dashboard with full context — stack, breadcrumbs, tags, user, and the active
Switch + Config snapshot.

## How it's wired

1. `SankofaCatch` is constructed in `app/_layout.tsx` right after
   `Sankofa.initialize(...)` — that's the single init point for the whole
   example. The instance is cached in `lib/sankofaClient.ts` via
   `setSankofaCatch()` / `getSankofaCatch()`.
2. When the Crashes screen mounts it seeds sticky context:
   - `catcher.setUser({ id: 'usr_demo_42', email: 'demo@sankofa.dev', ... })`
   - `catcher.setTags({ surface: 'crash-gallery', build_flavor: 'example' })`
   - `catcher.setExtra('crash_gallery_opened_at', ...)`
3. Each scenario button calls a handler that either throws (for unhandled
   paths — the global `ErrorUtils` hook picks them up) or uses
   `catcher.captureException(err, { tags, extra, fingerprint, level })`.

## Scenarios covered

| # | Title | SDK path |
|---|-------|----------|
| 1 | TypeError — null property access | unhandled (ErrorUtils) |
| 2 | ReferenceError — undeclared identifier | unhandled (ErrorUtils) |
| 3 | Unhandled promise rejection | unhandled (rejection polyfill) |
| 4 | Native fetch error — captured with context | `captureException` + tags/extra |
| 5 | JSON.parse on HTML — SyntaxError | `captureException` |
| 6 | RangeError — stack overflow | unhandled (ErrorUtils) |
| 7 | `CheckoutValidationError` — custom business error | `captureException` + fingerprint |
| 8 | setTimeout throw — async timer escape | unhandled (ErrorUtils) |
| 9 | AsyncStorage-style failure | `captureException` + storage context |
| 10 | Manual breadcrumb trail + captured throw | `addBreadcrumb` × 3 + `captureException` |
| 11 | captureMessage — warning signal | `captureMessage` |
| 12 | Native module error — missing method | `captureException` + module tags |

## Verifying on the dashboard

1. Run the example (`npm run ios` / `npm run android` — the JS bundle is
   configured to point at the dev server running on your machine's LAN IP;
   edit the `endpoint` in `app/_layout.tsx` if needed).
2. Open the **Crashes** tab and tap any scenario.
3. Watch the status ticker at the bottom of the screen flip from
   `🚀 Triggering…` to `✅ Dispatched`.
4. On the Catch dashboard, filter by `surface:crash-gallery` — every event
   dispatched from this screen carries that tag.

## Adding your own scenario

Open `app/(tabs)/crashes.tsx` and append to the list returned by
`buildScenarios()`:

```ts
{
  id: 'my-scenario',
  title: 'My scenario',
  description: 'What this does.',
  tone: 'danger', // 'danger' | 'warn' | 'info'
  run: () => {
    // either throw (global handler catches it) or captureException(...)
  },
},
```
