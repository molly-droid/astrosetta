# Project Status & Sequence

Living tracker for the Base44 → Supabase/Vercel/Capacitor migration.
Update this file as items move. Cutover mechanics live in
[DEPLOYMENT.md](./DEPLOYMENT.md); the parity protocol in
[NAVIGATOR_PARITY_TEST.md](./NAVIGATOR_PARITY_TEST.md).

_Last updated: 2026-09-24_

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
   AAB upload registers `com.astrosetta.app` (Phase 4). REMAINING: Stripe
   app/connection; products + offerings + packages (blocked on pricing);
   attach products to entitlements; webhook → Supabase; wire purchase flow +
   restore in app; Google developer notifications (Pub/Sub, Phase 4).

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
| **Launch pricing confirmation** (app shows Core $5.55/$55, Premium $7.77/$77; her Stripe had $9/$14; same on iOS?) | Apple subscriptions (ASC step 4) + RevenueCat products + Stripe live prices |
| Google Play + RevenueCat accounts (Apple done 2026-10-05) | Phases 3–4 |
| DNS access (or willingness to paste records) | DNS cutover |
| Vercel access (or new project under her account) | Phase 5 |
| Sign-off: AI daily limits + tier-gate map | closes the LLM-tasks item |
| At cutover: fresh Base44 export + interpretations export + active-subscriber list | Phase 5 |

Resolved: GitHub invite (push/merge done), Stripe team invite (sandbox configured
2026-10-01), Astrology-API.io key (2026-09-29), Google OAuth creds (verified
2026-10-01), Apple account + shared secret (2026-10-05).
