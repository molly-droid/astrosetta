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

iOS builds with Xcode (SPM-based, no CocoaPods). Android: no standalone JDK
on this machine — build with Android Studio's bundled runtime:

```bash
cd apps/web/android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

Both platforms verified compiling with all plugins (2026-09-24).

## Native runtime wiring (done)

- **Plugins**: `@capacitor/app`, `status-bar`, `splash-screen`, `keyboard`,
  `browser`, plus `@revenuecat/purchases-capacitor` (staged, see below).
- **`src/lib/native.jsx`** — `initNative()` (status-bar style, manual splash
  hide after first paint, `html.native`/`html.native-<platform>` CSS hooks)
  called from main.jsx; `<NativeBridge />` inside the Router handles Android
  hardware back (minimize at root routes) and `appUrlOpen` deep links,
  including Supabase auth callbacks (`?code=` PKCE exchange or implicit
  `#access_token` fragment).
- **Deep links**: `astrosetta://` scheme registered in Info.plist and
  AndroidManifest. `https://astrosetta.com` universal/app links get added at
  cutover (need AASA + assetlinks.json served from the live domain).
- **Auth**: Google OAuth on native opens the system browser
  (`skipBrowserRedirect` + `@capacitor/browser`) and returns via
  `astrosetta://login` — **that URL must be added to Supabase Auth →
  Redirect URLs** when Google sign-in is configured.
- **Safe areas**: `viewport-fit=cover` + `env(safe-area-inset-top)` on the
  AppLayout shell; bottom nav already inset. Needs the on-device polish pass.
- **RevenueCat (staged behind a flag)**: `src/lib/purchases.js` no-ops until
  `VITE_REVENUECAT_IOS_KEY` / `VITE_REVENUECAT_ANDROID_KEY` exist;
  `initPurchases(userId)` is already called after sign-in so customers will
  identify as the Supabase user id.

## Remaining for the mobile milestone

- Confirm bundle id / application id with the client; set display name,
  version, and build numbers.
- On-device pass: safe areas, status bar, keyboard, splash on real hardware.
- Android 12+ shows the SYSTEM splash (app icon on a light background) before
  Capacitor's navy one — theme `windowSplashScreenBackground` in
  android/app/src/main/res/values/styles.xml to #0f1a2e for a seamless boot.
- RevenueCat phase (**client accounts**): keys into the env, offerings on the
  Subscribe page, rewire lib/restorePurchases.js to Purchases.restorePurchases.
- Universal/app links for astrosetta.com at cutover; add astrosetta://login to
  Supabase Auth redirect allowlist with the Google provider setup.
- Signed release builds + one submission pass per store (**client** accounts).
