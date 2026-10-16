# Android QA pass — first run on real hardware

The app has never run on an Android device. Everything below was built and
verified on iOS only, so this pass is about finding where Android differs,
not re-testing product logic.

Build: internal testing track, versionCode 1 (`com.astrosetta.app`).
Billing is **not** testable yet — the Play merchant account is pending, so
every purchase path is expected to fail. Skip those and note nothing.

Record each as pass / fail / N-A with device model and Android version. A
failure needs: screen, what you did, what happened, and a screenshot.

---

## 1. Edge-to-edge and safe areas — HIGHEST RISK

`targetSdk 36`. Android 15 and above **force edge-to-edge** for apps
targeting SDK 35+, which means content draws behind the status bar and the
navigation bar unless insets are handled. It also makes
`StatusBar.setBackgroundColor` a no-op, and `native.jsx` calls exactly that
for Android. The iOS equivalent is handled in CSS
(`viewport-fit=cover` + `env(safe-area-inset-*)`), which Chrome's WebView
does support, but it has never been checked here.

- [ ] Status bar: is any content hidden behind the clock/battery row?
- [ ] Navigation bar: is the bottom nav sitting under the gesture pill or the
      three-button bar? Check on **both** gesture navigation and three-button
      navigation (Settings → System → Navigation mode) — they reserve
      different amounts of space.
- [ ] Status bar icon contrast: dark app pages need light icons; the light
      pages (`/login`, `/delete-account`) need dark ones.
- [ ] Any device with a display cutout or punch-hole: nothing clipped in
      portrait or landscape.
- [ ] Full-screen overlays (paywall, chart manager, tour) reach the real edges
      without content under the system bars.

## 2. Hardware back button and predictive back

iOS has no equivalent, so this logic (`NativeBridge` in `lib/native.jsx`) has
never been exercised. It currently minimises the app on root routes
(`/`, `/home`, `/login`) and otherwise calls `history.back()`.

- [ ] Back on Home: minimises the app, does not close it.
- [ ] Back on a non-root page: goes back one page.
- [ ] **Back with a modal open** — paywall, Saved Chart manager, interpretation
      drawer, the tour. Expected product behaviour is that back closes the
      overlay. The current code does not special-case overlays, so this may
      navigate away or minimise with the modal still mounted. Test each one.
- [ ] Back during onboarding: does not skip a step or escape the flow.
- [ ] Android 14+ predictive back gesture: swipe slowly from the edge and
      check the preview animation does not leave the app in a broken state.

## 3. Keyboard

The bottom-nav-over-keyboard fix uses `keyboardWillShow` / `keyboardWillHide`
plus `html.keyboard-open`. Those events fire on Android too, but Android
resizes the WebView for the keyboard rather than overlaying it, so the fix may
be unnecessary or may double up. `resizeOnFullScreen: true` is set.

- [ ] Feedback form: tap Subject. Field stays visible, nothing jumps.
- [ ] Bottom nav while typing: hidden, or at minimum not covering the field.
- [ ] Dismiss the keyboard: nav returns, layout settles with no gap left behind.
- [ ] Birth-data form and the Navigator chat: same checks.
- [ ] No input zoom (an iOS-only behaviour — confirm Android does not do
      something equivalent).

## 4. App background and resume

Today's `AuthContext` fix stops a refocus tearing the page down. It was
verified in a desktop browser and on iOS; Android fires visibility changes on
a different lifecycle.

- [ ] Open Relationships, scroll down, switch apps, return: same view, same
      scroll, no full-screen spinner.
- [ ] Planner on a non-today date: date survives a background/resume.
- [ ] Leave the app backgrounded for several minutes, return: still signed in,
      no spinner flash, no reset.
- [ ] Kill the app from recents and relaunch: session persists.

## 5. Share card

`shareCard.js` writes a PNG to the cache directory and opens the system share
sheet via `FileProvider`. `file_paths.xml` exposes `cache-path`, so the plumbing
looks right, but the Android share sheet behaves differently from iOS.

- [ ] Transit → Share → Save or Share: the sheet opens.
- [ ] Save to Photos / Files: the image lands, and is not corrupt or 0 bytes.
- [ ] Share to another app (Messages, Gmail): the image attaches.
- [ ] Cancel the sheet: no error wall, no stuck spinner.

## 6. Deep links

- [ ] `adb shell am start -a android.intent.action.VIEW -d "astrosetta://home"`
      opens the app on Home.
- [ ] Same with a path that needs auth while signed out: lands somewhere sane.
- [ ] Magic-link sign-in end to end, if the email flow is reachable.

Note: `https://astrosetta.com` app links are **not** wired yet. They need the
`assetlinks.json` from `STATUS.md` served at cutover plus an https
intent-filter in the manifest. Expected to open in a browser for now.

## 7. Splash and first paint

`launchAutoHide: false`, hidden manually once React paints. Android 12+ uses
its own splash API, which can interact badly with this.

- [ ] Cold start: no white flash between splash and first render.
- [ ] Splash does not linger after the UI is ready.
- [ ] Background colour matches `#0f1a2e` throughout, with no pale frame.

## 8. Rendering and layout

Android System WebView is a different engine version from iOS WKWebView.

- [ ] Chart wheel: renders, is legible, no clipping at 360dp width.
- [ ] Starfield background reaches every edge, including after rotation and
      keyboard open/close (this was B-08 on iOS; the fix sizes the canvas from
      `visualViewport`, which Android supports).
- [ ] Interpretation markdown: gold headers, bold, lists all styled.
- [ ] Custom fonts load — no fallback serif/sans flash.
- [ ] Rotate to landscape and back on Chart, Planner and Learn. The activity
      handles `orientation` in `configChanges`, so it should not recreate.
- [ ] System font size set to Large (Settings → Display → Font size): the app
      stays usable and does not collide with its own text-size setting.

## 9. Core flows (smoke, not re-test)

- [ ] Sign in.
- [ ] Chart tabs: Placements, Houses, Aspects, Dynamics all load.
- [ ] Tap a placement: interpretation appears.
- [ ] Planner: day, week, month.
- [ ] Learn: open a module, take the daily quiz.
- [ ] Profile: change a Chart Display toggle, confirm the wheel updates.

## 10. Performance

The AAB is 44MB and Play will serve a smaller per-device split, but check on
the weakest device available.

- [ ] Cold start time is tolerable.
- [ ] Scrolling the chart and planner is not visibly janky.
- [ ] No crash or reload under memory pressure (open several other apps, return).

---

## Known not-testable yet

- Purchases, restore, and all RevenueCat flows — blocked on the Play merchant
  account.
- `https://` app links — need `assetlinks.json` at cutover.
- Google Sign-In via the native SDK — not implemented; auth uses the browser
  flow, which needs no SHA-1.
