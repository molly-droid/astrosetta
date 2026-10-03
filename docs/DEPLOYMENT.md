# Deployment & Cutover Runbook

The migration target: astrosetta.com served from Vercel (apps/web), backed by
Supabase (project `sqdpawyqvgqadflezxxk` unless the client designates another),
fully independent of Base44. This runbook lists every environment input and the
cutover order. Items marked **[client]** need Molly's accounts/credentials.

## 1. Supabase project setup

```bash
supabase link --project-ref <ref>
supabase db push                      # applies the four migrations
supabase functions deploy             # all 38 functions (config.toml sets verify_jwt=false)
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
| `APPLE_SHARED_SECRET` **[client]** | validate-iap-receipt | App Store Connect |
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
(events: checkout.session.completed, customer.subscription.updated/deleted —
match the handler) → put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## 2. Web deploy (Vercel) **[client: Vercel + DNS access]**

- Project root `apps/web`, build `pnpm build` (or `vite build`), output `dist/`,
  SPA rewrite: all routes → `/index.html`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key).

## 3. Data cutover (see scripts/import/README.md)

1. Announce a short content freeze; pause Base44 scheduled workflows so digests
   don't double-send during the overlap.
2. Fresh full Base44 data export (all 28 entities + User).
3. `rehost-media.mjs` (media → Storage; rewrite code references with the map,
   commit that change).
4. `import-base44.mjs --dry-run`, review, then real run.
5. Also export/import the interpretations content served by the second Base44
   app (`astrosetta-api.base44.app`) into the `interpretation` table —
   get-interpretations falls back to the local table once that app dies.
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
- Emails: welcome (create a chart), one digest via manual
  `select public.invoke_edge_function('send-daily-email', '{"scheduled": true, "appUrl": "https://astrosetta.com"}'::jsonb);`
- Cron jobs listed: `select jobname, schedule from cron.job;`

## Known deferred items

- Navigator provider decision: Astrology-API.io hosted chat validation
  (~30-question parity test) — swap point is `generateReply()` in
  supabase/functions/navigator-chat.
- Chart engine: Astrology-API.io behind the adapter once the client
  subscribes; then recalc all charts again.
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
- Mobile (Capacitor) + RevenueCat: separate phase per the scope.
