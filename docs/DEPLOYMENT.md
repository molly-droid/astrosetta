# Deployment & Cutover Runbook

The migration target: astrosetta.com served from Vercel (apps/web), backed by
Supabase (project `sqdpawyqvgqadflezxxk` unless the client designates another),
fully independent of Base44. This runbook lists every environment input and the
cutover order. Items marked **[client]** need Molly's accounts/credentials.

## 1. Supabase project setup

```bash
supabase link --project-ref <ref>
supabase db push                      # apply ALL migrations before deploying functions/web
supabase functions deploy             # only at cutover AFTER content import; see staged order below
```

Secrets (`supabase secrets set NAME=value`):

| Secret | Used by | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` **[client]** | invoke-llm, navigator-chat, all synthesis/quiz/email functions | Anthropic Console |
| `LLM_MODEL` (optional) | default `claude-sonnet-5` | — |
| `NAVIGATOR_MODEL` (optional) | default `claude-sonnet-5` (interim until Astrology-API.io decision) | — |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` **[client]** | all email paths | Resend; domain must be verified |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` **[client]** | stripe-webhook, checkout, portal | Stripe dashboard |
| `STRIPE_INTERPRET_PRICE_ID`, `STRIPE_CALENDAR_PRICE_ID`, `STRIPE_INTERPRET_YEARLY_PRICE_ID`, `STRIPE_CALENDAR_YEARLY_PRICE_ID` **[client]** | checkout + webhook tier mapping | Stripe products |
| `STRIPE_INTERPRET_STANDARD_PRICE_ID`, `STRIPE_CALENDAR_STANDARD_PRICE_ID` **[client]** | non-founding monthly checkout ($8/$10) | live Stripe standard monthly prices |
| `STRIPE_INTERPRET_FOUNDING_PRICE_ID`, `STRIPE_CALENDAR_FOUNDING_PRICE_ID` (optional) | explicit founding monthly prices ($5.55/$7.77); falls back to existing monthly IDs | Stripe products |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` **[client]** | calendar authorization and refresh | Google Cloud web OAuth client with Calendar API enabled |
| `AI_MODEL_RATES_JSON` (optional) | model-specific USD estimates per million tokens; omit for unknown cost | operator-approved provider rates, not hardcoded tariffs |
| `REVENUECAT_WEBHOOK_AUTH` **[client]** | revenuecat-webhook; configure matching `Bearer <value>` Authorization header in RevenueCat | RevenueCat webhook configuration |
| `REVENUECAT_SECRET_API_KEY` **[client]** | authoritative subscriber lookup for RevenueCat webhook + legacy receipt reconciliation | RevenueCat server secret key with subscriber-read access; never use a public SDK key |
| `ASTROLOGY_API_KEY` **[client]** | navigator-chat (hosted chat), chart-calculator (Swiss Ephemeris positions) | dashboard.astrology-api.io (Ultra tier) |
| `NAVIGATOR_PROVIDER` = `astrology-api` | navigator-chat provider switch (unset/`claude` = Anthropic fallback) | — |
| `CHART_ENGINE` = `astrology-api` | chart-calculator position engine (unset = builtin ephemeris) | — |
| `APP_URL` | account-deletion, customer portal return URL | `https://astrosetta.com` |

Vault seeds (SQL editor, once):

```sql
select vault.create_secret('https://<ref>.supabase.co', 'edge_base_url');
select vault.create_secret('<service role / secret key>', 'edge_service_key');
```

Auth configuration (dashboard): site URL `https://astrosetta.com`; enable
email confirmations for production; enable the Google provider **[client:
Google OAuth client id/secret]**; SMTP for auth emails (Resend SMTP works).

Storage: the migration creates the `public` bucket.

Stripe webhook endpoint: `https://<ref>.supabase.co/functions/v1/stripe-webhook`
(events: `checkout.session.completed`, `invoice.paid`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`) → put its signing secret in `STRIPE_WEBHOOK_SECRET`.

### Account, AI quota and billing fixes (2026-10-08)

Deploy migrations `20261008000001_protect_accounts_and_usage.sql` and
`20261008000002_billing_snapshots.sql` first, then the changed Edge Functions
(`llm-task`, `navigator-chat`, `stripe-webhook`, `revenuecat-webhook`,
`validate-iap-receipt`) and the web app. These changes have NOT been deployed
by the code-review task. Set the RevenueCat server key before replacing its
webhook; without it reconciliation fails closed with HTTP 500 for retry.

### Completion-pass deployment order (also 2026-10-08, NOT deployed)

1. Apply **all five** `20261008` migrations, including
   `launch_configuration`, `calendar_connections` and `ai_request_metrics`.
2. Configure the secrets above. Existing monthly Stripe IDs are treated as
   founding prices; standard monthly checkout requires its explicit standard
   ID and fails closed when missing. Annual prices are **$55 Core / $77 Premium**
   for both cohorts, as confirmed by Jacob. No additional founding coupon is
   applied to these prices, and no existing provider subscription is repriced.
3. Configure RevenueCat `core` / `premium` offerings for founding monthly and
   shared annual packages; add `core_standard` / `premium_standard` with their
   standard `$rc_monthly` packages before ending the founding window. Real
   localized store prices are authoritative. Store eligibility/offer rules and
   cancellation/rejoining policy still require confirmation and sandbox QA.
4. Enable Google Calendar API. Add
   `https://<ref>.supabase.co/functions/v1/calendar-connection` as the exact web
   OAuth redirect URI. Allow the `calendar.events` scope; complete consent-screen
   publishing/verification as required by Google. Do not reuse Google sign-in as
   evidence that Calendar access is configured. Server flow follows
   [Google's web OAuth guidance](https://developers.google.com/identity/protocols/oauth2/web-server).
5. Deploy `calendar-connection`, `calendar-icsfeed`, `sync-astro-to-calendar`,
   `account-deletion`, `stamp-founding-member`, the billing/AI functions above, and every function
   importing `_shared/llm.ts` or `_shared/base44Compat.ts` for telemetry. Import
   interpretations from the second Base44 app BEFORE deploying
   `get-interpretations` (it is now deliberately Supabase-only). Deploy the web
   app with `VITE_APP_URL=https://astrosetta.com` and the appropriate public keys.
6. Test Calendar consent, denial, reconnect, disconnect and refresh, plus native
   browser return. Old `?uid=`/Base44 feeds must be resubscribed with the new
   private URL from Profile. Feed URLs expose calendar/journal content to their
   holder; keep them private. Revoke a lost link by deleting that user's
   `calendar_feed_keys` row as an authorized operator; the next request creates
   a new link. Do not publish feed links or OAuth tokens in logs/reports.
7. Verify purchase/restore after signing out and into a second account, along
   with the cross-provider tests below. SDK identity changes follow
   [RevenueCat's customer identity guidance](https://www.revenuecat.com/docs/customers/identifying-customers).
8. Only after client approval, set `launch_configuration.founding_ends_at` to
   the agreed UTC cutoff. Null means beta; eligibility is based on original
   signup time and existing explicit flags are preserved. Do NOT merely edit
   the retired `LAUNCH_DATE` constant. Both `GATING_ADMIN_ONLY` flags still need
   the separately approved launch change.

Telemetry: `ai_request_metrics` is service-only. Named tasks, scheduled function
names and Navigator record outcome/latency/provider/model. Anthropic usage is
recorded when available. Hosted Navigator's 25-credit base turn is an estimate,
excluding vendor tools; unavailable usage/cost stays unknown, not zero.
`AI_MODEL_RATES_JSON` maps exact model IDs to numeric `input`, `output`,
`cache_read`, `cache_write` USD-per-million-token rates. Cost estimates are not
vendor invoices. Metrics do not retain prompts, chart context or responses.
Model-billing reconciliation and a retention policy remain operational tasks.

- Profile preferences remain editable; role, identity, billing IDs/tier and
  founding status are protected in the database. Existing admins retain their
  tier-preview controls (including impersonated learners) and service-role
  imports remain supported. Admin previews survive reads/AI calls until the
  next fresh provider sync; stale deliveries do not clear them. Legacy null
  founding flags are repaired during the trusted profile refresh; explicit
  false flags remain false.
- Navigator now uses the same atomic daily quota and server-side Core gate as
  other named AI tasks. The existing beta preview flag and proposed quota
  amounts are unchanged; confirm limits and flip BOTH launch flags as below.
- Stripe snapshots include all four monthly/annual price IDs and all current
  subscriptions. RevenueCat refreshes current subscriber data for both sides
  of transfers and known UUID aliases. Provider failures preserve existing
  access and return an error for webhook retry.
- Each provider replaces only its own `billing_snapshots` entry; an atomic
  projection selects the highest unexpired tier across providers. Profile
  reads refresh expiry, including fallback from expired Premium to valid Core.
  Direct Stripe billing remains the authority for Stripe subscriptions, even
  if RevenueCat also reports them. Apple/Google are reconciled by RevenueCat.
- Existing paid profile data is seeded lazily on first refresh, including
  accounts imported after the migrations. Complete the final import BEFORE
  enabling live billing; if re-importing over already-reconciled users, refresh
  both providers afterward rather than expecting imports to overwrite their
  authoritative snapshots. Imported active subscriptions in both providers
  need both provider snapshots refreshed; a single legacy profile only records
  one subscription source.
- The legacy `validate-iap-receipt` route now refreshes the authenticated
  user's RevenueCat state; it never trusts a submitted tier/receipt. Native
  purchases/restores already use RevenueCat and keep the same workflow.
- Keep sandbox testing in designated test accounts/projects; the existing
  policy of accepting sandbox purchases has not been changed by this patch.

Before release: replay a monthly and yearly Stripe renewal, a native purchase,
an account transfer/restore, and an expiration while the other platform still
has paid access. Check the provider snapshots and final user tier. Also confirm
an ordinary user cannot change role/tier/counters, while profile edits and
admin tier previews still work. No production replay is part of local tests.

Offline regression checks:

```bash
node --test scripts/tests/*.test.cjs
# Use an existing disposable absolute directory; requires local PostgreSQL binaries.
ASTROSETTA_TEST_TMP=/absolute/disposable/directory node scripts/tests/run-database-tests.mjs
```

## 2. Web deploy (Vercel) **[client: Vercel + DNS access]**

- Project root `apps/web`, build `pnpm build` (or `vite build`), output `dist/`,
  SPA rewrite: all routes → `/index.html`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key),
  `VITE_APP_URL=https://astrosetta.com`.

## 3. Data cutover (see scripts/import/README.md)

1. Announce a short content freeze; pause Base44 scheduled workflows so digests
   don't double-send during the overlap.
2. Fresh full Base44 data export (all 28 entities + User).
3. `rehost-media.mjs` (media → Storage; rewrite code references with the map,
   commit that change).
4. `import-base44.mjs --dry-run`, review, then real run.
5. Also export/import the interpretations content served by the second Base44
   app (`astrosetta-api.base44.app`) into the `interpretation` table —
   get-interpretations now reads ONLY the local table; import before deploying it.
6. Spot-check per acceptance criteria: founding cohort intact
   (`is_founding_member`), tiers/Stripe ids on `users`, chart counts.
7. `recalc-all-charts` (admin) — regenerates cached chart data on the new
   engine path.

## 4. DNS cutover **[client: DNS access]**

Point astrosetta.com at Vercel. Keep Base44 read-only until the smoke pass
completes, then decommission (only after §3.3/3.5 confirm no media or
interpretation dependency remains).

## 5. Post-cutover smoke (production)

- Sign in via password reset (migrated account) and via Google.
- New signup → onboarding → chart calculation → /home.
- A planner day view (transit calculation) + one LLM synthesis panel.
- Navigator conversation round-trip.
- Stripe test-mode checkout → webhook updates `users.subscription_tier`.
- **Live-Stripe coupon smoke (run once, right after swapping the hosted
  secrets to the staged live values — see the STRIPE_LIVE_* block +
  cutover mapping in supabase/functions/.env):**
  1. In the live Astrosetta Stripe account, create a coupon: **100% off,
     duration `forever`**, and a promotion code only we know.
  2. Run one real web checkout for Core monthly using that code →
     confirm checkout completes, the live webhook delivers (Stripe
     dashboard → webhook endpoint `we_1UOpty9W9ZFmhq7a6rsKYwnm` shows
     2xx), and `users.subscription_tier` flips to `interpret`.
  3. Cancel that subscription immediately, archive the coupon/promo
     code, and delete the test customer in Stripe.
  Keep it brief and supervised: while live keys are set, every checkout
  without the code charges real cards.
- Emails: welcome (create a chart), one digest via manual
  `select public.invoke_edge_function('send-daily-email', '{"scheduled": true, "appUrl": "https://astrosetta.com"}'::jsonb);`
- Cron jobs listed: `select jobname, schedule from cron.job;`

## Known deferred items

- Navigator and chart-provider switches were recorded as deployed by Tony on
  September 30 (see STATUS.md). Preserve those hosted secrets on redeploy;
  remaining acceptance checks include relationship/saved-chart coverage, Tyche
  fallback, timezone/house-system parity and cache/license terms.
- Per-tier daily LLM limits: `DAILY_LIMITS` in
  supabase/functions/_shared/llm_tasks/core.ts proposes free 50 / Core 300 /
  Premium 600 calls per day (admins unlimited) — **[client]** confirm or
  supply the desired numbers, along with the task→tier map (each task in
  _shared/llm_tasks/tasks_*.ts declares its gate) as part of the final
  feature-entitlement matrix.
- At launch, flip `GATING_ADMIN_ONLY` to false in BOTH
  apps/web/src/lib/permissions.js and _shared/llm_tasks/core.ts (the
  soft-launch flag currently grants non-admins full access on web and in
  the llm-task tier gate alike).
- Mobile/RevenueCat: implementations exist; Android product setup, live billing,
  device QA, signed builds and submissions remain (see STATUS.md).
