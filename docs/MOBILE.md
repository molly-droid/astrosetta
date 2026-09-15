# Mobile (Capacitor)

The iOS and Android apps wrap the web app in `apps/web` with Capacitor 8
(per the scope: no React Native rewrite — the old `apps/mobile` Expo
experiment is parked and superseded).

## Layout

- `apps/web/capacitor.config.ts` — appId `com.astrosetta.app` is a
  **placeholder: confirm the final bundle/application id with the client
  before store submission** (existing IAP products follow `com.astrosetta.*`).
- `apps/web/ios/`, `apps/web/android/` — committed native projects
  (generated/synced artifacts are gitignored; regenerate with `cap sync`).
- `apps/web/assets/logo.png` — icon/splash source (gold emblem); icons were
  generated with:
  `npx @capacitor/assets generate --iconBackgroundColor '#0f1a2e' --iconBackgroundColorDark '#0f1a2e' --splashBackgroundColor '#0f1a2e' --splashBackgroundColorDark '#0f1a2e'`

## Workflow

```bash
cd apps/web
corepack pnpm build && npx cap sync   # rebuild web + copy into both platforms
npx cap open ios                      # Xcode
npx cap open android                  # Android Studio
```

iOS builds with Xcode (SPM-based, no CocoaPods). Android needs a JDK —
none is installed on this machine; Android Studio's bundled runtime is the
easiest path.

## Remaining for the mobile milestone

- Confirm bundle id / application id with the client; set display name,
  version, and build numbers.
- Deep links + auth redirects (Supabase OAuth return): add the custom URL
  scheme / applinks once the production domain is live.
- RevenueCat Capacitor SDK + purchase/restore flows (**client:** RevenueCat,
  App Store Connect, Play Console accounts).
- Safe-area/status-bar/keyboard polish pass on-device.
- Signed release builds + one submission pass per store (**client** accounts).
