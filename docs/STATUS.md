# Project Status & Sequence

Living tracker for the Base44 → Supabase/Vercel/Capacitor migration.
Update this file as items move. Cutover mechanics live in
[DEPLOYMENT.md](./DEPLOYMENT.md); the parity protocol in
[NAVIGATOR_PARITY_TEST.md](./NAVIGATOR_PARITY_TEST.md).

_Completion-pass update: 2026-10-08. Historical notes below describe Tony's
earlier hosted setup._

_2026-10-09 (Tony): the completion pass IS deployed — all five 20261008
migrations applied and every function redeployed 2026-10-09 14:32 UTC
(including get-interpretations, ahead of the interpretations import — panels
read empty until cutover; only test users exist so no user impact).
`REVENUECAT_SECRET_API_KEY` set (v1 key) and the new reconciliation verified
end-to-end: webhook auth → RC /v1/subscribers fetch → snapshot → tier
projection (expired sandbox sub correctly projects to free). Still
unconfigured: `GOOGLE_CALENDAR_CLIENT_ID/SECRET` (calendar features fail
closed; needs Calendar API + redirect URI in the Google project that owns
the OAuth client), optional `AI_MODEL_RATES_JSON`, and the standard-monthly
Stripe/RevenueCat products (fail closed until the founding window ends)._

_2026-10-09 (Tony): Molly ACKNOWLEDGED the iOS prices ($5.59/$7.79 monthly,
$55/$77 yearly) — pricing is settled. AI daily limits stay at the implemented
values (free 50 / Core 300 / Premium 600, admins unlimited) per Tony's call;
no further sign-off gate. LLM_THINKING stays default-off. Next: TestFlight
build for Molly (in progress)._

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
16. Decommission Base44 (only after media + interpretations confirmed
    independent); delete orphaned V2 functions from the Supabase project
    (test-ephemeris, calculate-chart, generate-synthesis)

## Waiting on Molly (consolidated ask list)

| Item | Unblocks |
|---|---|
| ~~Launch pricing confirmation~~ **DECIDED 2026-10-07 (Tony): go with app-displayed prices** — Core $5.55/mo $55/yr, Premium $7.77/mo $77/yr; the $9/$14 Stripe products treated as old leftovers. Molly asked; flag if she answers differently. | unblocked ASC step 4 + RevenueCat products |
| Google Play + RevenueCat accounts (Apple done 2026-10-05) | Phases 3–4 |
| DNS access (or willingness to paste records) | DNS cutover |
| Vercel access (or new project under her account) | Phase 5 |
| Sign-off: AI daily limits + tier-gate map | closes the LLM-tasks item |
| At cutover: fresh Base44 export + interpretations export + active-subscriber list | Phase 5 |

Resolved: GitHub invite (push/merge done), Stripe team invite (sandbox configured
2026-10-01), Astrology-API.io key (2026-09-29), Google OAuth creds (verified
2026-10-01), Apple account + shared secret (2026-10-05).
