# Project Status & Sequence

Living tracker for the Base44 → Supabase/Vercel/Capacitor migration.
Update this file as items move. Cutover mechanics live in
[DEPLOYMENT.md](./DEPLOYMENT.md); the parity protocol in
[NAVIGATOR_PARITY_TEST.md](./NAVIGATOR_PARITY_TEST.md).

_Completion-pass update: 2026-10-08. Historical notes below describe Tony's
earlier hosted setup._

_2026-10-14: **First Android release bundle built** (`app-release.aab`, 44MB,
versionCode 1 / versionName 1.0). Toolchain: JDK 21 bundled with Android
Studio (no system Java on this machine), SDK android-36; targetSdk 36 already
meets Play's floor. Merged manifest confirmed to carry
`com.android.vending.BILLING` from the RevenueCat plugin, plus the
astrosetta:// deep links and the Share FileProvider. Signing: 4096-bit RSA
UPLOAD key at `~/.astrosetta-keys/astrosetta-upload.jks` (dir 700, file 600),
credentials in the gitignored `apps/web/android/keystore.properties`;
`app/build.gradle` falls back to unsigned when that file is absent so a fresh
clone still builds. Upload-key SHA1
`FC:3D:55:C4:73:06:7D:08:4C:32:21:FD:FA:B8:EC:6C:50:57:4B:2D` — NOTE this is
the upload cert, NOT the app-signing cert; anything needing a SHA1 (Google
Sign-In on Android, app links assetlinks.json) must use the Play App Signing
fingerprint from Play Console AFTER the first upload. **Handover item: the
upload key is under silexdev and transfers to Molly at cutover, same as the
astrosetta-revenuecat GCP project.** Uploaded to Play internal testing
2026-10-14; Play App Signing enrolled, and Google generated its own app
signing key distinct from our upload key.

**Play APP SIGNING certificate** (public values, safe in the repo; this is
what external services must be given, NOT the upload-key fingerprint above):
- SHA-1:   `07:37:B0:69:73:F0:DF:8B:AC:15:2A:63:89:08:8D:D2:C9:B9:56:60`
- SHA-256: `A9:24:61:B3:A9:4C:42:C6:3E:7A:55:5B:36:F7:E9:5C:C0:29:81:1F:DA:E0:FA:2A:6E:AE:5C:4F:68:04:DB:BB`

Uses: SHA-256 goes in `assetlinks.json` at cutover (Digital Asset Links takes
SHA-256 only). SHA-1 is needed ONLY if Android moves to the native Google
Sign-In SDK; today's auth path is @capacitor/browser plus an astrosetta://
deep link, which is the WEB OAuth client flow and uses no fingerprint.

assetlinks.json to serve at https://astrosetta.com/.well-known/assetlinks.json
at cutover, alongside adding the https app-link intent-filter to the manifest:

    [{
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.astrosetta.app",
        "sha256_cert_fingerprints": ["A9:24:61:B3:A9:4C:42:C6:3E:7A:55:5B:36:F7:E9:5C:C0:29:81:1F:DA:E0:FA:2A:6E:AE:5C:4F:68:04:DB:BB"]
      }
    }]
_

_2026-10-14: **TestFlight build 1.0 (7) UPLOADED** (same xcodebuild path as 6).
Carries PF-01/PF-02 plus the tab-refocus fix: chart points generate when their
Chart Display toggle is switched on; synastry calculations AND the LLM
relationship reading are cached per partner and warmed on save; returning to
the app no longer unmounts the page, resets the tab or jumps the scroll. All
verified live against tony.tamer21@gmail.com — see FEEDBACK_ROUND1.md §H/§I.
Round 1 now 42/44: B-13, C-01 and E-02 are blocked on Molly._

_2026-10-13: **TestFlight build 1.0 (6) UPLOADED** (archive + export via
xcodebuild, ASC key 5W8QPDGB55, issuer 8f6d7d87-…; ExportOptions keeps
`manageAppVersionAndBuildNumber: true`, which is why the repo sat at
CURRENT_PROJECT_VERSION 1 through builds 2-5 — now set to 6 explicitly).
Build 6 carries the five defects found walking the build-5 test plan on a
physical device: input zoom on the feedback form, bottom nav over the
keyboard, interpretation headings rendering as plain body text
(@tailwindcss/typography is NOT installed, so every `prose-*` class in the
codebase is a no-op — 7 other files still rely on them), bonus rounds not
feeding the tier accuracy counters, and the new transit quiz questions
missing their aspect verb and learn links. Round 1 is 41/44 done; B-13
(needs Molly's repro), C-01 (pricing decision) and E-02 (her notes) are the
remainder. PF-01/PF-02 closed 2026-10-13 — see FEEDBACK_ROUND1.md §H._

_2026-10-09 (Tony): the completion pass IS deployed — all five 20261008
migrations applied and every function redeployed 2026-10-09 14:32 UTC
(including get-interpretations, ahead of the interpretations import — panels
read empty until cutover; only test users exist so no user impact).
`REVENUECAT_SECRET_API_KEY` set (v1 key) and the new reconciliation verified
end-to-end: webhook auth → RC /v1/subscribers fetch → snapshot → tier
projection (expired sandbox sub correctly projects to free). Still
unconfigured: optional `AI_MODEL_RATES_JSON`, and the standard-monthly
Stripe/RevenueCat products (fail closed until the founding window ends).
(`GOOGLE_CALENDAR_CLIENT_ID/SECRET` were set 2026-10-15 — see below.)_

_2026-10-16 (Tony): **Google Calendar OAuth configured and verified end to
end.** Molly granted access to her `Astrosetta` Google Cloud project via
Workspace customer ID C042spbhq. Calendar API was already enabled. Created a
**new Web-application OAuth client** there rather than reusing the existing
one, which serves Base44 production — verification is per consent screen, not
per client, so a second client costs nothing and keeps the live site isolated.
Redirect URI `https://sqdpawyqvgqadflezxxk.supabase.co/functions/v1/calendar-connection`;
both secrets set on Supabase 2026-10-15 14:07 UTC.

Verified on 2026-10-16 against the live DB, not by eye: authorize → consent →
callback stored a 102-char **refresh token** (offline access granted) →
`Sync Google Calendar` wrote real events → disconnect revoked at Google and
left `google_calendar_connections` and `google_calendar_states` empty.
`calendar_feed_keys` correctly survives a disconnect (the ICS path is
independent of OAuth).

Two fixes this took (both in this commit):
- `sync-astro-to-calendar` referenced `PLANET_GLYPHS`, which the v3
  engine rewrite never carried over from `calendar-icsfeed`. Base44's
  original defines it (`entry.ts:91`), so this was **our regression**. Edge
  deploys don't type-check, so it shipped and threw `ReferenceError` at the
  first in-orb transit — the sync aborted after fetching engine data and
  before posting a single event. Restored the map.
- `GoogleCalendarConnect` rendered its status line at the top of the panel
  while the buttons sit at the bottom, so every success AND error message was
  off-screen. Moved it under the buttons; buttons now show "Syncing…" /
  "Opening Google…" while busy.

**Open, needs Molly:**
- **Branding page must be completed** before the consent screen can leave
  Testing ("Publish app" is disabled until it is), and verification must
  follow — `calendar.events` is a sensitive scope. While in Testing, every
  user's refresh token **expires after 7 days** and there is a 100-user
  lifetime cap. If calendar sync must work at launch, this review needs to
  start now; it takes weeks.
- **Transit event volume is a product question, not a bug.** Both this
  function and the ICS feed emit one event per day for every transit in orb,
  and slow planets stay in orb for weeks — a 28-day sync created ~200 events
  on one test account. The per-day `seen` scoping and the date-keyed
  idempotency key are identical in Base44's original, so this is her app's
  existing, apparently deliberate behaviour. Changing it would be a parity
  deviation. Ask before touching it.
- Disconnect deliberately leaves events in the calendar and there is no
  bulk removal. Every description ends "Added by Astrosetta", so a cleanup
  action is cheap to add — proposed, not built (new scope).

**Deferred, do not lose:** the Google client secret was exposed in a session
transcript on 2026-10-15 and must be **rotated**; Tony's call to defer._

_2026-10-09 (Tony): Molly ACKNOWLEDGED the iOS prices ($5.59/$7.79 monthly,
$55/$77 yearly) — pricing is settled. AI daily limits stay at the implemented
values (free 50 / Core 300 / Premium 600, admins unlimited) per Tony's call;
no further sign-off gate. LLM_THINKING stays default-off._

_2026-10-09 (Tony): **TestFlight build 1.0 (1) UPLOADED** — archived and
uploaded via xcodebuild with an ASC API key (Admin role required once to
mint the team's cloud-managed iOS Distribution cert; key `5W8QPDGB55`, .p8
in `~/.appstoreconnect/private_keys/`). `ITSAppUsesNonExemptEncryption=false`
set. Plan: Tony tests via internal group first, then Molly. Known gap in
build: interpretation panels empty until the content import. Next after
TestFlight: stage LIVE Stripe (create live prices + register live webhook,
record IDs — but keep hosted secrets on sandbox until cutover) and grab the
active-subscriber export while live-Stripe access is fresh._

_2026-10-09 (Tony): **Content import done early** — 97 learning modules +
20 interpretations imported to prod via import-base44.mjs (first real run;
it caught and we fixed an importer bug: unmapped Base44 user refs now null
instead of crashing uuid columns). Verified serving via REST + the
get-interpretations function. **Second-app finding:** the interpretation
"library" app (astrosetta-api.base44.app) returns App-not-found — the LIVE
app has been running on the ~20 local fallback rows already, so we are at
parity. Main placement interpretations are LLM-generated (llm-task) and
unaffected. DECISION (Tony, 2026-10-09): don't chase it —
the library hasn't been live, so parity needs nothing more; cutover step
12 (interpretations import) is DONE. If Molly ever resurfaces a library
export, the idempotent importer can top the table up anytime. TestFlight build 2 uploaded
(tour-card fix). Build 3 uploaded later that evening: safe-area fixes for
the ModulePlayer/MasteryChallenge fullscreen overlays + landing top bar
(device findings from Tony's test pass) — this is the Molly candidate.
**Known parity quirk (kept by decision, Tony 2026-10-09):** during beta,
Subscribe computes isCurrent from the effective tier, so every non-admin
shows "You're on this plan" for Premium — beta users can lock in the Core
founding rate but CANNOT buy/lock Premium. Identical in Molly's live app
(her Subscribe.jsx:213). Flag to Molly alongside the lapse-rejoin policy
question; the fix (drive isCurrent off the stored tier during beta) is
one line if she wants it._

_2026-10-09 (Tony): **Live Stripe STAGED** — Molly's real live account is a
separate, previously-empty "Astrosetta" account (acct_1Tf0OG9W9ZFmhq7a; NOT
Workforce Energetics — that other account's dead webhook/33 events remain
unexplained but moot: zero customers/subscriptions here means NO
active-subscriber export is needed at cutover). Created: products
Astrosetta Core/Premium + 4 founding/yearly prices ($5.55 & $55 Core,
$7.77 & $77 Premium; standard-monthly deferred by design) + webhook
endpoint for our stripe-webhook (5 events). All IDs + live signing secret
recorded as STRIPE_LIVE_* in supabase/functions/.env (gitignored),
STAGED ONLY — hosted secrets stay on sandbox until cutover, when the
flip is a two-minute secrets swap._

## Current completion pass — local code, not launch sign-off

Confirmed by Jacob: annual prices are **Core $55 / Premium $77**, superseding
the original handoff's $66/$88. Monthly founding prices remain $5.55/$7.77;
the original standard monthly rates remain $8/$10 pending any explicit change.

Implemented locally:

- Account authority, shared AI quotas, annual renewals, RevenueCat transfers
  and cross-provider billing snapshots; regression tests cover all six findings.
- Google Calendar OAuth (offline access, PKCE, single-use expiring state),
  refresh/disconnect and direct sync; replaces the missing Base44 connector.
- Private, backend-hosted calendar feeds. Existing Base44 feed subscriptions
  must be replaced with new links; a plain user ID no longer grants access.
- Purchase-platform billing management, RevenueCat identity changes on account
  switches/sign-out, restore for Free users and explicit server reconciliation.
- Founding/standard monthly product selection; shared $55/$77 annual products.
  Native standard-monthly offerings fail closed until configured.
- A database founding-window cutoff shared by signup and legacy repairs.
  Cutoff remains null (beta); no existing cohort flags were changed.
- Supabase-only interpretations, public native deletion URLs and migrated
  frontend error reporting. Interpretation content must be imported BEFORE
  deploying that function.
- Per-request AI outcomes, provider/model, latency, available token usage and
  optional operator-configured cost estimates; no prompt/response text stored.
- Web SPA routing; lint errors cleared with mechanical unused-import cleanup.
  Legacy type-check errors remain (see verification below).

Remaining decisions/configuration — do not mistake these for completed work:

1. Confirm whether a founding subscriber who lapses may rejoin at the founding
   price. Existing cohort eligibility is preserved until that policy is decided;
   enforcing loss of a discount after lapse is NOT implemented by this pass.
2. Confirm launch/founding cutoff, final feature gates and AI quotas. Neither
   beta gate flag has been flipped.
3. Set Google Calendar credentials/redirect URI, RevenueCat server key and live
   Stripe products. Configure native standard offerings, Google products/base
   plans, developer notifications, restore/transfer policy and store price rules.
4. Validate the native pricing/cohort rules in both stores; linking entitlements
   does not itself configure store offers or prevent unsupported promotions.
5. Deploy the five October 8 migrations and affected functions/web in the order
   in DEPLOYMENT.md. Live receipt/webhook/OAuth tests have NOT been run here.
6. Device QA, native auth, associated HTTPS links, release signing and the two
   store submissions remain. No store uploads/submissions were performed.
7. Final export freeze, production import/media/interpretations, chart recalc,
   Vercel/domain cutover and end-to-end smoke tests remain.
8. Close chart/API acceptance coverage (saved-person/synastry/composite,
   traditions/house systems/timezones, Tyche fallback and cache/license terms).
   No paid provider calls were made in this pass.

Local verification: web build, lint and Android debug compilation pass; 25 offline regression tests and
real disposable-PostgreSQL permission/launch/billing/concurrency checks pass.
The frontend typecheck has 245 legacy errors (81 fewer than the baseline,
with no new diagnostics); this is not a clean full-repo sign-off.
Xcode is unavailable on this checkout's host, so iOS build/device
validation cannot be repeated here. Native and live-provider QA remain gates.

## Historical implementation and account notes

## Done

- [x] Web app imported from Base44 export; standalone Vite build; Base44 SDK
      replaced by the Supabase shim (103 feature files untouched)
- [x] Replica schema (from `base44/entities/*.jsonc`) + compat RPC applied to
      Molly's project (`sqdpawyqvgqadflezxxk`)
- [x] All 34 backend functions ported to Edge Functions and deployed; scheduled
      workflows → pg_cron; entity automations → DB triggers
- [x] `/login` page (replaces Base44 hosted login); e2e smoke drives
- [x] Data import + media re-hosting **scripts** written (execution happens at
      cutover, not before)
- [x] Deployment & cutover runbook
- [x] Capacitor iOS/Android scaffolded
- [x] **Client InvokeLLM → 37 named server-side tasks** (`llm-task` function,
      tier gates, daily quotas, usage logging) — smoke-tested 7/7 locally
- [x] Navigator parity test: protocol, harness, and the frozen Claude baseline
      transcript (`scripts/navigator-parity/results/`)
- [x] Mobile groundwork (no accounts needed): native runtime plugins wired
      (status bar, splash, keyboard, back nav), `astrosetta://` deep links on
      both platforms incl. Supabase auth callback handling, safe-area shell,
      RevenueCat SDK staged behind a flag — iOS simulator + Android debug
      builds verified compiling (see docs/MOBILE.md)
- [x] Local dev sandbox proven (ports 5434x; Tony's Anthropic key local-only)

## In progress / partially unblocked

- [x] **Pushed to GitHub and merged to `main`** (2026-09-25) — `main` is now
      the trunk; work continues there. Go-live remains gated by the cutover
      steps (data import + DNS), not by the merge.
- [x] **Resend fully ready (confirmed 2026-10-02)**: send-only key installed
      as hosted secret, and astrosetta.com was ALREADY verified in Molly's
      Resend account (done ~2mo ago for the Base44 app) — @astrosetta.com
      sends work now. Email round-trip test happens in the cutover smoke
      pass (welcome email + one manual digest, per DEPLOYMENT.md §5).
- [x] **Google OAuth verified working on web (2026-10-01)** — redirect URI
      added, sign-in round-trip confirmed. Follow-ups: (1) secret pinning
      DEFERRED by choice (2026-10-01) — if sign-in breaks when Molly deletes
      her old client secret, paste the 9/18 secret into Supabase Auth →
      Providers → Google and retest; (2) add `astrosetta://login` to Supabase
      Auth → Redirect URLs for native Google sign-in (mobile phase).
- [x] **Stripe sandbox configured (2026-10-01)**: four app-matching prices
      (Core $5.55/mo+$55/yr, Premium $7.77/mo+$77/yr) on her existing
      products, webhook registered (checkout.session.completed, invoice.paid,
      customer.subscription.deleted), all six secrets set on the hosted
      project. ⚠️ Ask Molly: her sandbox had $9/$14 prices — if that's
      intended launch pricing, the app's UI copy + our price IDs need
      updating; we matched what the app displays. Repeat the whole setup in
      LIVE mode at cutover (runbook), incl. active-subscriber export.
- [x] **Apple App Store Connect set up, steps 1–3 (2026-10-05)**: App ID
      `com.astrosetta.app` registered with In-App Purchase capability, app
      "Astrosetta" created in ASC (SKU `astrosetta-ios`), App-Specific Shared
      Secret generated and set as hosted `APPLE_SHARED_SECRET` (verified via
      `secrets list`). Remaining: subscription group + 4 auto-renewables
      (`com.astrosetta.{interpret,calendar}.{monthly,yearly}`) once pricing
      is settled, then wire real product IDs into `lib/entitlements.js`.
- [x] **App-code media re-hosted off media.base44.com (2026-10-05)**: all 57
      assets referenced in code (module/sign/planet images, logos, favicon,
      og/social images — 35MB) downloaded to `apps/web/public/media/` and all
      refs switched to `/media/...` (index.html social tags use absolute
      `https://astrosetta.com/media/...`). Build + `cap sync` done — zero
      `media.base44.com` refs remain in src/dist/ios/android. Assets kept
      byte-identical (no recompression). REMAINING for Base44 decommission:
      media URLs living *inside data* (entity records) — handled at cutover
      import (Phase 5.11).
- [x] **Molly's post-export Base44 changes ported (2026-10-07)**: fresh export
      (`~/Downloads/Astrosetta/astrosetta copy.zip`) diffed against the Sept 14
      original — 22 changed files: unknown-birth-time support (end-to-end),
      day-synthesis shared-generator refactor (period key day-v20), email
      light theme, sendDailyEmail TDZ crash fix. Ported to base44/ reference +
      supabase functions (11 deployed) + apps/web; LLM prompt changes landed
      in `llm_tasks/tasks_planner.ts` (prompts live server-side here).
      **Process note:** every Base44 change Molly makes after an export is
      re-migration work — the export-diff procedure above is the repeatable
      way to catch up; ask Molly to flag app changes and agree a change
      freeze date before cutover. Re-diff once more at cutover (Phase 5).
      **Tested 2026-10-07**: chart-calculator unknown_time round-trip ✓;
      pre-generate-synthesis E2E ✓ (ok, 4 items, ~88s/chart); send-daily-email
      E2E ✓ (sent:1 in 16.6s via cached day-v20 synthesis). Testing surfaced
      and fixed a REAL bug: sonnet-5 adaptive thinking truncated invokeLLM's
      JSON (llm.ts now streams, disables thinking, max_tokens 32000 — see
      commit). NOT yet tested: unknown-birth-time UI flow in the browser/app
      (mechanical patches; cover in Phase 4 device QA) and the
      weekly/monthly/recap emails (same template pattern as daily).

- [x] **Feedback round 1, Batch D + PF items (2026-10-12)** — uncommitted in
      the working tree pending Tony's commit; server pieces deployed:
      - **PF-04 root cause found: NO scheduled job has ever run in prod.**
        The vault was mis-seeded (args swapped — a secret NAMED the legacy
        service JWT instead of one named `edge_service_key`), so
        `invoke_edge_function()` warn+no-op'd on every cron tick while
        pg_cron reported "succeeded". Every first open of the day generated
        the reading live (= Molly's "reloads after a while"); daily/weekly/
        monthly digests never sent. Client cache logic was already correct
        (verified: user-JWT insert 201, save-back updates in place).
      - **Vault fix needs Tony** (secret-store write blocked for Claude):
        command below under "Tony to run". ALSO discovered: the Edge runtime
        injects the NEW `sb_secret_...` key as SUPABASE_SERVICE_ROLE_KEY, so
        `edge_service_key` must be the sb_secret key — the legacy JWT would
        pass the gateway but fail `isServiceRole()` (verified live: legacy →
        403, sb_secret → 200).
      - **PF-03 shipped**: interpretations persist per account in
        `calendar_synthesis` (period_type `interpretation`, period_key =
        djb2 hash of the task params, so birth-data edits self-invalidate).
        Client: `lib/interpretationStore.js` + wired into
        InterpretationDrawer (deep-dives) and NatalInterpretation (natal
        kinds only). Server: new `pre-generate-interpretations` function
        (classic 10 placements + 12 houses per chart, 8 per run) + 10-min
        cron (migration 20261012000001). Deployed, loop-run until all charts
        covered; client/server key parity verified (8/8 exact match on
        Molly's chart).
      - **F-01 shipped**: plan selection inside onboarding (Molly's final
        copy) — new shared `components/plans/PlanSelection.jsx` used by BOTH
        the new onboarding `plan` step (+ "You're in." confirmation slide)
        and Subscribe.jsx (rewritten around it), so upgrades use one flow.
        Platform routing unchanged (StoreKit/Play via RevenueCat, Stripe on
        web); restore-purchases link in fine print on native.
      - **UX-01 shipped**: TraditionSelector replaced by
        `ZodiacHousesSelector` — two labeled settings (Zodiac:
        Tropical/Sidereal · Houses: Whole Sign/Placidus) with Molly's
        tooltip copy; tradition key derived from the pair (sidereal→vedic,
        tropical+placidus→modern, tropical+whole_sign→hellenistic).
        `HIDE_SIDEREAL` flag ready if Molly says hold Sidereal back.
      - Deploy gotcha recorded: `functions deploy` hangs without `--use-api`
        (Docker); use `--use-api`.
      - **Vault seeded by Tony (2026-10-12)** — verified: secrets are exactly
        edge_base_url + edge_service_key (sb_secret), manual
        invoke_edge_function accepted. Scheduled jobs are LIVE from now,
        including the real daily digest (12:00 UTC) to opted-in beta users.
      - **TestFlight build 4 uploaded (2026-10-12)** with this whole batch —
        the Molly candidate for feedback round 1 verification.

- [x] **Feedback round 1, Batch E — the 11 P1 bugs (2026-10-12)** — client
      changes uncommitted; the four edge functions are deployed. Per-bug root
      causes in `docs/FEEDBACK_ROUND1.md` §E. Highlights worth knowing:
      - B-03 share-card save could never have worked in the app (`<a download>`
        of a data: URL is ignored by WKWebView). Now writes to the app cache
        and opens the iOS share sheet — **new native deps**
        `@capacitor/share` + `@capacitor/filesystem` (pods change; `cap sync`
        done) and `NSPhotoLibraryAddUsageDescription` added to Info.plist.
      - B-05/B-06 had a genuine server bug: accuracy counters were gated on
        "new day", so a second quiz the same day scored nothing. Molly's own
        row shows it (`total_answered` 10 vs `apprentice_questions_total` 5).
      - B-11 required converting every px-literal Tailwind text size to rem
        (132 files) — `--app-font-scale` only rescales the root rem.
      - B-13 is NOT fixed: the card renders full-width in code and her doc has
        no screenshot for it; needs a repro from Molly.
      - **Deploy flakiness (new, important):** `functions deploy` currently
        returns `500 Function deploy failed due to an internal error` on
        roughly one call in three, for unmodified functions too (verified by
        deploying a pristine git copy). It is Supabase-side, not our code —
        just retry; don't go hunting for a syntax error like I did.

- [x] **Feedback round 1, Batches F + G (2026-10-12)** — UX polish and the
      AI/content/email items. Client uncommitted; 11 edge functions deployed;
      migration `20261012000002_chart_display_defaults_off.sql` applied.
      Details per item in `docs/FEEDBACK_ROUND1.md` §F/§G. Things to know:
      - **Chart display toggles now default OFF for NEW accounts only.** The
        migration deliberately does not reset existing rows (that would
        silently overwrite real choices); the one-line SQL to flip beta
        accounts too is in the migration's comment if Molly wants it.
      - **Em-dash removal is central**, in `_shared/llm.ts` `invokeLLM` —
        every function's output passes through it, structured JSON included.
        Molly's five style rules live in `STYLE_RULES` inside the shared
        PERSONA (plus the two local PERSONA copies). Verified live: a fresh
        generation came back with zero dashes, and the share-card summary
        came in at 187 characters.
      - **The daily quiz never computed transit-to-natal aspects** — its
        `mundaneAspects` is transit×transit despite the field names. Added
        that computation plus three generators that ask about real hits to
        the user's own chart, offered ahead of the generic trivia (AI-03).
      - AI-02 needed no work: the bonus round is a deterministic template,
        fixed under B-04.
      - Verification used a temporary account (`ai-verify-20261012@…`),
        deleted afterwards along with its test cache row; the three real
        accounts were confirmed intact.

### Tony to run (blocked for Claude by permissions)

Seed the vault so ALL scheduled jobs start working (paste as one `!` command):

```
! cd /Users/tonyt/Projects/astrosetta && TOKEN=$(cat ~/.supabase/access-token) && SB=$(curl -s "https://api.supabase.com/v1/projects/sqdpawyqvgqadflezxxk/api-keys?reveal=true" -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; print([k['api_key'] for k in json.load(sys.stdin) if k.get('type')=='secret'][0])") && curl -s -X POST "https://api.supabase.com/v1/projects/sqdpawyqvgqadflezxxk/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"query\":\"select vault.create_secret('$SB','edge_service_key'); delete from vault.secrets where name like 'eyJ%';\"}"
```

Then verify (should show day-v20 rows appearing for today within ~20 min):
`select jobname, status, return_message from cron.job_run_details order by start_time desc limit 5;`
⚠️ Arming the vault turns on the real email digests (daily 12:00 UTC) for
opted-in beta users — expected, but know it's live.

## Remaining work, in order

**Phase 1 — parallel, no dependencies (now):**
1. ~~Mobile groundwork needing no accounts~~ done (see above); an on-device
   polish pass (safe areas/status bar/keyboard on real hardware) remains
2. Wire Google OAuth into Supabase Auth (when creds arrive) — also add
   `astrosetta://login` to the Auth redirect allowlist for native
3. Stripe setup once team invite lands (products, webhook → secrets)
4. Molly sign-off: AI daily limits + tier-gate map (proposal in DEPLOYMENT.md)

**Phase 2 — Astrology-API.io (key received 2026-09-29):**
5. ~~Provider + parity run~~ **done — candidate passed, client approved, and
   the switch is LIVE in production (2026-09-30)**: `ASTROLOGY_API_KEY` +
   `NAVIGATOR_PROVIDER=astrology-api` hosted secrets set, navigator-chat
   redeployed. Navigator now runs on the client's Astrology-API.io
   subscription (no per-message Anthropic bill); Claude remains the instant
   rollback (`NAVIGATOR_PROVIDER=claude` + redeploy). See
   docs/NAVIGATOR_PARITY_RESULTS.md.
6. ~~Chart engine swap~~ **done & LIVE (2026-09-30)**: chart-calculator's
   position layer (planet longitudes, retrogrades, angles, cusps) now comes
   from Astrology-API.io (Swiss Ephemeris) with the builtin ephemeris as
   automatic fallback; all downstream math/response shape unchanged.
   Cross-check over 5 charts: majors/angles agree ≤0.3°; the builtin's
   asteroid errors (up to 5.7°, incl. a wrong-sign Pallas) are what the swap
   fixes. Tyche stays builtin (not served by their deployment). Positions are
   cached permanently in `ephemeris_cache` (~1 credit per unique moment,
   shared across all users). Rollback: unset `CHART_ENGINE` secret. (Full
   recalc of cached charts still happens at cutover.)

**Phase 3 — subscriptions:**
7. RevenueCat project + entitlements; Stripe/Apple/Google products mapped;
   webhooks, restore, reconciliation (needs Apple/Play/RevenueCat accounts +
   Apple shared secret)
   — **Started 2026-10-05 via RevenueCat MCP**: project `proj2fbc6d7c`
   (Molly's, Tony admin) already existed; created App Store app
   `appe1bdbb0fac` (bundle `com.astrosetta.app`) + entitlements
   `interpret`/"Core" and `calendar`/"Premium"; iOS public SDK key
   (`appl_EnZ...`) wired into `apps/web/.env` as `VITE_REVENUECAT_IOS_KEY`
   (+ placeholders in `.env.example`). Molly's old "Astrosetta Pro"
   entitlement left untouched — confirm with her before archiving.
   2026-10-05 later: ASC In-App Purchase key uploaded
   (`subscription_key_configured: true` — Apple link live); Play Store app
   `appd3e40d25f4` created (package `com.astrosetta.app`), Android SDK key
   wired into `.env`.
   2026-10-07: Play side done — Play Console app "Astrosetta" created;
   service account `revenuecat@astrosetta-revenuecat.iam.gserviceaccount.com`
   (GCP project `astrosetta-revenuecat`, **lives under the silexdev.com org —
   handoff item: add Molly as Owner or migrate**; org-policy
   `iam.managed.disableServiceAccountKeyCreation` overridden at project level
   to mint the key) invited to Play Console + JSON saved in RevenueCat
   (`play_service_account_credentials_configured: true`). RevenueCat's
   "package name not found" validation warning is expected until the first
   AAB upload registers `com.astrosetta.app` (Phase 4).
   2026-10-07 later (pricing decided): 4 Apple products created in RevenueCat
   (`com.astrosetta.{interpret,calendar}.{monthly,yearly}`) and attached to
   their entitlements; `entitlements.js` extended to monthly+yearly per
   platform (`getProductId` gained an optional `period` param, defaults
   monthly — call sites unchanged).
   2026-10-07 later: ASC subscription group "Astrosetta" + all 4
   auto-renewables created with localizations. **Actual Apple prices (Apple's
   price points didn't offer $5.55/$7.77): Core $5.59/mo $55/yr, Premium
   $7.79/mo $77/yr — monthly prices are ABOVE the app's displayed
   $5.55/$7.77 copy, so the native Subscribe screen MUST show the store's
   real localized price (via RevenueCat) before launch — required Phase-4
   wiring, App Review risk otherwise. Molly may still adjust pricing.**
   2026-10-07 later: **purchase flow wired and VERIFIED END-TO-END on a real
   device.** RevenueCat offerings `core`/`premium` ($rc_monthly+$rc_annual,
   products attached); client purchases via offerings (purchases.js), native
   Subscribe/PaywallModal/SubscriptionSection show the store's localized
   price; restore rewired to RevenueCat; `revenuecat-webhook` Edge Function
   deployed (auth: REVENUECAT_WEBHOOK_AUTH secret + matching Authorization
   header in the RevenueCat webhook settings — BOTH must be set, a missing
   header 401s silently). E2E proof (sandbox, Tony's iPhone): purchase →
   RC entitlement `interpret` active → RENEWAL webhook → users row
   `tier=interpret, source=apple, expires set`. Test account
   `iap-sandbox-20261007@silexdev.com` (role=admin to bypass
   GATING_ADMIN_ONLY full-access; delete or demote before launch).
   `Astrosetta.storekit` + shared scheme committed for simulator testing.
   REMAINING: Play products after first AAB (format `productId:basePlanId`
   in RevenueCat) + Android purchase QA; Stripe app/connection (decide:
   web stays on our stripe-webhook vs routing through RevenueCat);
   Google developer notifications (Phase 4); Apple App Store Server
   Notifications are NOT needed (RevenueCat polls receipts + notifies us).

**Phase 4 — mobile release:**
8. Release-candidate builds, signed store builds, one submission each
   (needs bundle-ID sign-off + store accounts)

**Phase 5 — cutover (the LAST phase; per DEPLOYMENT.md §3–5):**
9. Vercel deploy + env (needs Vercel access)
10. Content freeze; pause Base44 scheduled workflows
11. **Fresh full Base44 data export → media re-host → `import-base44.mjs`
    (dry-run, then real)** ← the data transfer deliberately happens here, at
    the end, so nothing drifts between copy and switch
12. Interpretations import from the second Base44 app
13. Spot-checks: founding cohort, tiers/Stripe IDs, chart counts; then
    `recalc-all-charts`
14. DNS cutover to Vercel (needs DNS access); production smoke pass
15. Launch flips: `GATING_ADMIN_ONLY` → false in BOTH `permissions.js` and
    `llm_tasks/core.ts`; declare `LAUNCH_DATE` in stamp-founding-member when
    Molly ends the founding window
    **SEQUENCING (noted 2026-10-19): the client half of this flag is baked
    into the native binary.** The store-submitted builds (Phase 4) must
    already carry `GATING_ADMIN_ONLY = false`, or (a) every app user keeps
    free Premium at launch until an app update clears review, and (b) the
    App Review demo account can't see the paywalls, so Apple can't locate
    the subscriptions it is reviewing. Flip the client constant in the
    release-candidate build; the server-side flip in `llm_tasks/core.ts`
    can stay a cutover-day deploy.
16. Decommission Base44 (only after media + interpretations confirmed
    independent); delete orphaned V2 functions from the Supabase project
    (test-ephemeris, calculate-chart, generate-synthesis)

_2026-10-14 (Tony, decided): **Play prices match Apple** — Core $5.59/mo
$55/yr, Premium $7.79/mo $77/yr. Play could hit $5.55/$7.77 exactly, but
matching keeps both native stores consistent and lets the existing
"show the store's real localized price" path behave the same on Android as
iOS. Does not resolve C-01: Molly's $5.55/$7.77 remains open for the WEB
(Stripe) price and for the displayed copy. BLOCKED until Molly attaches a
Google Payments merchant profile to the Play developer account (her account,
owner-only action, verification takes days) — no Play subscriptions, no
RevenueCat Play products, and no Android purchase QA until it clears._

_2026-10-19 later (Tony): **iOS build 9 (1.0) uploaded to TestFlight —
first fully headless upload.** Carries the B-26 Bonus Round reorder (the
only client-side change since build 8). Recipe now hands-off end to end:
`xcodebuild -project apps/web/ios/App/App.xcodeproj` archive (NO workspace —
SPM layout), export with teamID H3Y82CW5LH, then `xcrun altool --upload-app
--apiKey 5W8QPDGB55 --apiIssuer 8f6d7d87-2614-4c65-b4d6-d1891124db57` (that
issuer pairs only with key 5W8QPDGB55; the other .p8 keys on this Mac are
other teams'). Also created the **Apple review demo account**
apple.review@silexdev.com (Supabase dashboard Add-user + Auto Confirm — the
handle_new_user trigger builds the profile row; free tier, learner role,
founding-stamped, chart Jan 15 1990 New York, Cap/Virgo/Sag) — goes into
App Review Information at submission; password with Tony/Molly privately._

_2026-10-19 (Tony): **Molly answered B-26 and the pre-generation question;
both implemented — pre-gen DEPLOYED and VERIFIED, B-26 verified in a local
iOS build (ships in build 9).** B-26: she likely couldn't see the
Bonus Round because it rendered below the Practitioner's Lens and Path to
Adept — per her "let's move it up", `DailyQuizCard.jsx` now renders
BonusQuizCard first in both completed-state branches. Pre-generation: she
chose **3 days ahead** "but also all the chart elements if possible" —
`pre-generate-synthesis` now generates day syntheses (plus any lunar/ingress
readings) for today **through D+3** instead of today only; each day's
chartCalculator call permanently warms `ephemeris_cache`, so those days'
transit/chart elements also render instantly (her "chart elements"). The
scheduled path now only fills missing period_keys — it no longer re-runs
the LLM daily on existing week/month rows (cost saving funds the extra
days); explicit `chart_id`/`process_all` calls still force a full refresh.
Gap-filling capped at 3 day syntheses per invocation (~51s each) to stay
inside the edge-function wall clock; the 10-min cron picks up the rest. No
cron or client changes needed — DaySynthesis already looks up
`day-v20-<date>-<depth>`. HARD LESSON from the first deploy: the inherited
design stored ALL rows at the END of the run, and the runtime hard-kills a
worker at ~400s wall clock — a forced 4-day refresh generated ~7 min of
readings and lost every one. Fixed same day: each synthesis is now stored
the moment it's generated (a killed run keeps its completed work), and
`chart_id`/`process_all` no longer force-regenerate days — every path fills
gaps only (delete a row to force a day's regen); force still refreshes
week/month. Verified live: targeted run stored D+3 ~1 min after trigger,
then week + month; cron tick independently filled another chart's 3 days;
Planner on device opened Oct 20/21/22 instantly, Oct 23 (outside window)
streamed live. Closes B-23's remaining latency and PF-05/PF-06 lever 3.
Remaining ship item: web/native build for the B-26 quiz-card reorder (build
9 / versionCode 3)._

_2026-10-18 pm (Tony): **Android purchase flow VERIFIED end to end on real
hardware.** Premium monthly purchased on a physical Pixel (BrowserStack App
Live, Play-delivered build, license-tester test card, purchaser
admin@silexdev.com): Play -> RevenueCat -> revenuecat-webhook ->
billing_snapshots (entitlement calendar/google) -> users.subscription_tier
projected to calendar over an older Apple-sandbox interpret entitlement.
Notes: the license-tester test card took ~16h to appear after the account
was added (fresh merchant profile; not misconfiguration). Play's price
dialog had silently rounded all four base plans to suggested price points
(5.49/54.99/7.99/74.99) — fixed 2026-10-18 by editing each United States
row directly (the top field only sets the new-countries default), and
verified live via Play's API: 5.59/55/7.79/77, exact iOS parity. License-tester subs renew every ~5min
and auto-cancel — the expiry path exercises the webhook for free. Purchase
QA for Android is CLOSED._

_2026-10-18 (Tony): **iOS build 8 (1.0) uploaded to TestFlight** — the first
build carrying the round-2 fixes Molly reported on build 7: B-22 transit
dates, B-23 hang fix + streaming (PF-06 lever 1), UX-09 hub tap-to-clear,
B-13/B-21 full-width interpretation text, B-11 14px bodies, B-07 Big Three
ascendant, wheel-skeleton CLS fix. Uploaded via Xcode Organizer; the CLI
path needs the ASC API key issuer ID (keys exist in
~/.appstoreconnect/private_keys, team H3Y82CW5LH) — capture the issuer ID to
make build 9 hands-off. NOTE for future uploads: this Mac's Xcode Organizer
holds archives of OTHER apps (arcservicepro, caddieai, hisvoiceapp) — verify
the archive's bundle id is com.astrosetta.app before Distribute; tonight's
first attempt accidentally pushed an old arcservicepro archive (rejected by
Apple, no harm done)._

_2026-10-17 night (Tony): **Play billing unblocked and fully configured.**
Molly's Google Payments merchant profile cleared. Tony created the two Play
subscriptions — product IDs `interpret` (Core) and `calendar` (Premium),
matching the internal tier IDs — each with `monthly`/`yearly` base plans at
the STORE prices $5.59/$55 and $7.79/$77. Store prices intentionally differ
from web/Stripe ($5.55/$7.77): Apple's price points forced 5.59/7.79 on iOS
and Play copies iOS for store parity. KNOWN COSMETIC GAP: shared components
hardcode "$5.55/mo" in upsell CTAs that also render natively (DaySynthesis /
WeekSynthesis / MonthSynthesis, StreakBonusCard, ZodiacHousesSelector,
UpgradeTab, SubscriptionSection, permissions.js) — PaywallModal already shows
the live store price on native, so checkout is honest; fix is to drop prices
from native CTA copy if we care about the 4¢. RevenueCat fully wired (Claude,
via API): Android products `interpret:monthly|yearly`, `calendar:monthly|yearly`
created on app appd3e40d25f4, attached to entitlements `interpret`/`calendar`
and to offerings `core`/`premium` $rc_monthly/$rc_annual packages beside the
iOS products; Play service-account credentials were already configured.
Signed AAB (upload key ~/.astrosetta-keys/astrosetta-upload.jks) built as
versionCode 2 (versionCode 1 was burned by our earlier upload) and rolled out
to the Internal testing track; tony.tamer21@gmail.com added as tester +
license tester. NEXT: once the opt-in link propagates (~1h), install from
Play Store on the Play-image emulator signed into that account, purchase
Core monthly, verify billing_snapshots + tier projection server-side._

_2026-10-17 evening (Tony): **Android Home "ghosting" closed as an emulator
artifact — the app is clean on real hardware.** The ghost gauges/tab-row over
the Home header (originally finding A2) reproduced on two AVDs and both GPU
modes, but in-WebView CDP captures were pixel-perfect every single time while
the emulator's displayed frame ghosted/froze — and a real Pixel 7
(BrowserStack App Live) rendered Home correctly. Verdict: the Intel-Mac
emulator mangles frame presentation; it is for functional QA only, visual
sign-off needs a real device. The `LazyChartWheel` skeleton-footprint fix is
kept on merit (removes mount CLS on all platforms). Full evidence chain in
ANDROID_QA.md finding A2. BrowserStack free-trial minutes are now exhausted;
future hardware checks: Samsung Remote Test Lab (free), Firebase Test Lab
(free, would need a flag-gated QA auto-login APK), or Jacob's phone if he
has an Android._

_2026-10-17 (Tony): **Copy decisions settled without further asks to Molly.**
- **Founding-rate wording ACCEPTED by Tony as-is**: "for as long as your
  subscription stays active" (Subscribe page, Plan tab banner, plan cards).
  No longer pending her sign-off; if she rewords later it is a copy tweak,
  not a reopened item.
- **Parked deliberately, DO NOT ask her** (Tony's call — but keep this
  context handy if she raises either herself):
  1. *E-02 scope*: we removed only the "✨ Your Daily Synthesis" overview
     block from the paid daily email and kept Personal Reading,
     Maximize/Focus/Watch and Collective Reading. If she ever says the daily
     email still shows "the synthesis", she means the whole personalised
     block — removing the rest is a two-line change in
     send-daily-email's `synthesisSection`.
  2. *Onboarding emails name hidden points*: welcome + chart-recap emails
     still list Lots/asteroids/Lilith, which UX-02 hides by default for new
     users. If she reports "my welcome email mentions things I can't find",
     the ready fix is filtering both house sections to the ten classic
     planets (~2 lines per function).
Also sent to her today: the B-26 buried-or-missing question and the
pre-generate-the-week decision (PF-05 / PF-06 lever 3 / B-23 latency)._

_2026-10-17 (Tony): **Round 2 engineering day — B-22 ✅, UX-09 ✅, B-23 hang
✅, PF-06 measured + streaming shipped, B-26 cannot-reproduce.** Details and
verification evidence in FEEDBACK_ROUND2.md (updated in place). Highlights:
B-22 was NOT the ephemeris — seven Planner sites rendered `approaching`
stations/ingresses as happening today, including in LLM context; fixed with
`lib/transitEvents.js` and verified before/after at device width. PF-06 is
quantified: LLM latency is 10–15ms per output token, day-synthesis = 4,779
tokens = ~52s, chart math ~400ms and cached; prompt is byte-identical to
Base44's. Streaming shipped end to end (llm-task `stream: true` → NDJSON;
Daily Reading renders the overview as it arrives): first text 3.0s vs 52s.
`llm-task` redeployed with the streaming branch (backward-compatible; only
clients sending `stream: true` get NDJSON). Remaining PF-06 levers need
Molly: cut the duplicated `personal_reading_core` (content), pre-generate the
week (cost; closes B-23/PF-05). B-26: her exact repro passes on web — bonus
round IS offered after a retake; likely buried below the Practitioner's Lens
on a phone; ask her. Verification now runs through authenticated puppeteer
against the dev server (test passwords set on both tony accounts via the
auth admin API; scripts in the session scratchpad)._

_2026-10-16 (Tony): **Molly's round 2 landed — see `docs/FEEDBACK_ROUND2.md`.**
Her doc was updated Oct 16 8:00 PM against build 1.0 (7): 14 round-1 items
verified fixed, 3 reported still failing, 10 new (B-21–B-26, UX-09, PF-05,
PF-06, AI-05). Triaged in full in that file; the three retests were all
investigated and closed the same day.

- **B-07 was genuinely still broken and our ✅ was premature.** The round-1
  fix went into `DaySynthesis.jsx` only; the Learn curriculum
  (`PlacementSlide.jsx`) is a separate surface with the same single-source
  read. Every chart in this project has `raw_data.ascendant_sign` null — the
  value lives in `raw_data.angles.ascendant.sign` and the `chart` column — so
  the Big Three card showed a dash for EVERY user. Fixed and verified on
  device.
- **B-13 + B-21 are one component**, as she guessed. `PillShell`'s
  `✦ Interpret` / `✕` column was a `shrink-0` flex sibling reserving ~90px
  down the full card height. Floated it; verified at 393px.
- **B-11 was not a bug.** The rem conversion is sound. Her `font_scale` is
  1.1, and 10% of 11px is invisible. Base size was the problem: six
  interpretation bodies raised 11px → 14px. **14px is a proposal — Molly
  signs off before it is settled.**

**The item that matters most is PF-06**, her top concern: app-wide slowness
*after* PF-01/PF-02 caching shipped in build 7. That is a verdict on work
already done, so the next performance pass starts with measurement. Nothing
in the loading cluster (PF-05, B-23, PF-04) should be touched until a profile
says where the time goes.

Two accounts to note: a fifth user `molly.sharp2@gmail.com` appeared today,
and the digest cron sends to every opted-in account — check its opt-in before
the next 12:00 UTC run. Also still committed and stale:
`DaySynthesis.jsx.orig`, `MonthSynthesis.jsx.orig`, `WeekSynthesis.jsx.orig`._

_2026-10-16 (Tony): **Launch flag found: `BETA_ALL_PAID`.** `send-daily-email`
line 234 hardcodes `const BETA_ALL_PAID = true`, so EVERY recipient gets the
paid digest regardless of tier and the free teaser branch is unreachable.
This is a third beta flag to flip at launch, alongside `GATING_ADMIN_ONLY` in
`apps/web/src/lib/permissions.js` and `_shared/llm_tasks/core.ts` — CLAUDE.md
documents those two as a pair and does not mention this one. Failure mode if
missed: free users receive paid digests forever. Consequence for testing: the
free email branch cannot be exercised in this environment; it was verified
textually instead (the E-02 diff touches zero lines inside it)._

_2026-10-16 (Tony): **SECURITY — four scheduled endpoints were unauthenticated.**
Found while testing the E-02 email change, not reported by anyone.

`send-daily-email`, `send-weekly-email`, `send-monthly-email` and
`send-feedback-digest` treated `scheduled: true` — a flag the CALLER puts in
the request body — as authorisation. Every function runs `verify_jwt = false`
(required: webhooks, the ICS feed and email links cannot present a user JWT),
so nothing else gated them. Proven against production with no Authorization
header at all, scoped to a non-existent UUID so nothing was sent:
`HTTP 200 {"success":true,"sent":0}`. An unauthenticated caller who knew the
URL could have triggered a digest to all 500 chart-owning users — inbox spam,
LLM spend per recipient, and Resend domain reputation damage.
`send-feedback-digest` was the plainest case: its own comment said "admin or
scheduled", and `if (!body.scheduled)` skipped the admin check outright.

**Not a porting error.** Base44's original has the identical shape
(`sendDailyEmail/entry.ts:953`), so the code is faithful; the exposure came
from the platform change. Base44 gated invocation before the handler ran, and
`verify_jwt = false` does not.

Fixed by requiring `isServiceRole(req)` inside each scheduled branch. pg_cron
already authenticates through `invoke_edge_function` with the vault's
`edge_service_key`, so the scheduled runs are unaffected **provided that key
equals the runtime `SUPABASE_SERVICE_ROLE_KEY`** — verify before deploying, or
the digests start failing 401 silently and only test accounts would notice.

**Key format note.** The vault's `edge_service_key` is 41 chars, i.e. the new
`sb_secret_…` format. The legacy 219-char `service_role` JWT shown under
Settings → API does NOT match and fails `isServiceRole`'s exact comparison.
Use the key from Settings → API Keys for any manual service-role call._

_2026-10-16 (Tony): **Molly answered five open items.** All four code
decisions are implemented; none are deployed. Round 1 is now **43/44** —
E-02 closed, B-13 (needs her repro) and C-01 (pricing) remain.

- **E-02 Daily Digest (closed).** "Remove Daily Synthesis, it is largely
  repeated in the Daily Reading and I prefer the formatting there." The
  `✨ Your Daily Synthesis` block — overview paragraph and best-area chips —
  is gone from the paid daily email. The labelled Personal Reading,
  Maximize/Focus/Watch and Collective Reading sections stay, because removing
  those too would leave a paid subscriber an email with no reading in it.
  **If she meant the whole personalised block, say so and it is a two-line
  change.** `synthesis_overview` is still generated: the PERSONALIZATION LOCK
  in the prompt names that field to force chart-specific prose, so dropping it
  from the schema would change the tone of everything else in the email.
- **Welcome email em dashes (closed).** All three were in copy, not comments:
  "your own chart, not someone else's"; "Welcome to Astrosetta. The sky is
  happening right now."; subject "✦ Welcome to Astrosetta: Your Chart Awaits".
  Comma / full stop / colon respectively — her copy, so her call to reword.
- **Calendar cleanup action (closed, built).** New `cleanup` action on
  `calendar-connection` plus a two-click "Remove synced events" button beside
  Sync and Disconnect. Deletion is irreversible, so it matches twice: Google's
  `q=Astrosetta` narrows the calendar, then each candidate must ALSO carry our
  `extendedProperties.private.astrosetta` tag or end with the "Added by
  Astrosetta" footer, so a user's own event that merely names the app
  survives. `sync-astro-to-calendar` now writes that tag; events written
  before today match on the footer text only. The sweep runs under a 45s
  budget and reports `more`, and the client re-runs until a pass finds
  nothing. **It must be used before disconnecting** — revoking the token first
  removes the access needed to delete anything, and the UI says so.
- **Lapse-rejoin policy (closed).** "If founding members cancel and later
  subscribe, they would lose founding rates." Cohort membership is permanent
  (the Founding Patron badge is unchanged); the discount is not. Migration
  `20261016000001` adds `users.founding_rate_forfeited_at`, stamped inside
  `project_billing_access` — the single place a tier can fall to free, and it
  already holds the row locked and knows the old tier. Stamping in a webhook
  handler instead would miss lapse-by-expiry, which is how most lapses happen.
  Forfeiture additionally requires `subscription_expires <= now()`: a provider
  can send an empty entitlement array as a tombstone, and this stamp is
  irreversible, so a webhook glitch must not burn a paying member's rate.
  Pricing now reads `hasFoundingRate(user)` (`lib/permissions.js`), mirrored
  server-side in `create-checkout-session` and in `purchases.js` offering
  selection. Only MONTHLY prices differ by cohort; annual is $55/$77 for
  everyone, so forfeiture changes nothing for annual subscribers.
  **Verified 2026-10-16** against the live DB in a self-rolling-back DO block
  (`scratchpad/forfeit_test.sql`): a real lapse stamps; an empty-entitlement
  tombstone arriving while the paid window is still open does NOT; an existing
  stamp is never moved; a non-founder is never stamped. Rollback confirmed
  afterwards — 0 of 4 users stamped, the test account's tier, expiry and
  billing snapshot all untouched. Note the tombstone case still drops
  `subscription_tier` to free until the next good snapshot; that is existing
  `project_billing_access` behaviour and is reversible. The guard protects only
  the part that is not.
- **Copy conflict this created, needs her eye.** Three places promised the
  founding rate "locked in **forever**" / "stays with you **for life**"
  (`Subscribe.jsx`, `SubscriptionSection.jsx`, `PlanSelection.jsx`). That is
  now false. Changed to "for as long as your subscription stays active" so we
  are not shipping a promise the billing code breaks. Wording is hers to
  adjust; the claim it replaces cannot come back.

**Authorized domains (her question).** Answer: `astrosetta.com` only, and
**do not remove the Base44 entries yet.** Google auto-adds the domains of
authorized redirect URIs and JavaScript origins, so the Supabase callback host
never needs listing — which is just as well, since authorized domains must be
ownership-verified in Search Console by an owner/editor on the GCP project and
she does not own `supabase.co`. The Base44 entries matter because the consent
screen is shared by every OAuth client in that project, including the one
serving the LIVE site: pulling them before DNS moves risks breaking Google
sign-in in production for no gain (the cap is 10 domains and she is nowhere
near it). Remove them at DEPLOYMENT.md §4, once astrosetta.com points at
Vercel and Base44 is decommissioned. The App domain fields on the Branding
page — home page, privacy policy, terms — should be the astrosetta.com URLs
now (`/privacy` and `/terms` both exist); those are what verification reviews._

## Waiting on Molly (consolidated ask list)

_Rebuilt 2026-10-16. Ordered by what it blocks, not by size._

### 1. Blocks the Nov 13 demo or launch — needs to start now

| Ask | Why it can't wait | Blocks |
|---|---|---|
| **Confirm the Google Payments merchant profile cleared verification** — she reported creating it 2026-10-16, but Google verifies over several days and nothing can be priced until it shows Approved in Play Console → Settings → Payments profile | Nothing on Android can be priced or tested until it clears | Play subscriptions → RevenueCat Play products → Android purchase QA |
| **Complete the Branding page** in Google Auth Platform (app name, logo, support email, home page, privacy policy + terms URLs, authorised domain), then **submit the consent screen for verification** | "Publish app" is disabled until Branding is done, and `calendar.events` is a sensitive scope, so review takes weeks | Calendar sync for real users. While in Testing: every refresh token dies after **7 days**, 100-user lifetime cap, and testers see an "unverified app" warning |
| **C-01 pricing decision** — $5.55/$7.77 display vs the real store prices ($5.59/$7.79) | Gates the plan page copy and the web/Stripe price | Plan page, Stripe products. Three options in FEEDBACK_ROUND1.md §B |

### 2. Decisions — each one is small, each one blocks a change

| Ask | Note |
|---|---|
| **Free trial (F-01): yes or no?** | None implemented |
| **Sidereal: ship or hold?** | Her "Tropical only at launch" predates knowing the engine supports sidereal. `HIDE_SIDEREAL` ready either way |
| ~~Onboarding emails name points the app now hides~~ | PARKED 2026-10-17 by Tony — deliberately not asking her. Context and ready fix recorded in the 2026-10-17 copy-decisions entry above |
| **Calendar sync event volume** (new 2026-10-16) | One event per day per in-orb transit — a 28-day sync wrote ~200 events on a test account. **Identical in her Base44 app**, so this is existing, apparently deliberate behaviour, not a defect. Keep, or emit each transit once on its peak day? |
| **Old "Astrosetta Pro" RevenueCat entitlement** | Left untouched; confirm before archiving |

### 3. Information we need from her

| Ask | Note |
|---|---|
| **B-13 repro** — planner transit card blank on the right | Renders full-width in code and her doc has no screenshot. Need: which card, portrait or landscape, which device. Last unresolved Round 1 bug |
| **Flag any Base44 changes she makes**, and agree a change freeze | Every post-export change to the live app has to be re-ported by hand |

### 4. Access and accounts

| Ask | Unblocks |
|---|---|
| DNS access, or willingness to paste records | DNS cutover |
| Vercel access, or a new project under her account | Phase 5 |
| At cutover: fresh Base44 export + interpretations export + active-subscriber list | Phase 5 |

### 5. Ownership handoffs (one conversation, three items)

Things built under silexdev that should end up hers:

- **GCP project `astrosetta-revenuecat`** — holds the service account Play Console uses for RevenueCat. Add her as Owner or migrate the project.
- **Android upload keystore** — currently ours; transfers at cutover. Play App Signing means a lost upload key is recoverable, but she should own it.
- **Play merchant account** — hers already, pending setup (see §1).

Resolved and no longer needed: GitHub invite, Stripe team invite (sandbox
configured 2026-10-01), Astrology-API.io key (2026-09-29), Google OAuth creds
(2026-10-01), Apple account + shared secret (2026-10-05), Google Play +
RevenueCat accounts, Google Cloud project access (2026-10-15, via Workspace
customer ID C042spbhq), launch pricing confirmation (decided 2026-10-07), AI
daily-limit sign-off (closed by Tony's call 2026-10-09 — no further gate).

### Scope conversation worth having alongside this

Round 1 mixes migration parity fixes (ours under the fixed scope) with new
product work — F-01 onboarding checkout, UX-01 redesign, AI prompt changes,
E-01, F-02/03, and B-14/B-18 fixing things that were broken in Base44 too.
About a third of the round is new product work. Worth a friendly line
distinguishing "migration fixes" from "Round 1 product improvements" before
absorbing it silently.
