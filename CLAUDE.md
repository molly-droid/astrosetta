# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Astrosetta is a live astrology education app (astrosetta.com, operated by Sharp Energetics LLC) being migrated **off Base44** to Supabase + Vercel, with Capacitor mobile apps to follow. This is fixed-scope client work: the migration target is an **exact replica** of the Base44 app — parity, not redesign. See `~/Downloads/Astrosetta/SCOPE_DRAFTING_HANDOFF.md` for the agreed scope.

pnpm workspace + Turborepo monorepo (Node ≥20, pnpm 9). The migration work happens on the `migration/base44-to-supabase` branch.

## Layout

- **`apps/web`** — the real product: the complete React/Vite/Tailwind/shadcn frontend from the client's Base44 export (JSX, not TS). This is what gets migrated and shipped.
- **`base44/`** — the exported Base44 backend, kept as the porting source of truth: 34 Deno function implementations (`functions/*/entry.ts`), 29 entity schemas (`entities/*.jsonc`), 9 scheduled workflows, the `chart_navigator` agent persona, shared server utils.
- **`supabase/`** — migrations and Edge Functions (the porting target).
- **`packages/core`** — pre-scope chart engine (astronomy-engine); kept as a potential chart-parity test harness for the astrology-API validation. The other pre-scope experiments (Expo `apps/mobile`, Fastify `apps/api`, `packages/shared`, `packages/ui`) were deleted — in git history if ever needed; mobile is Capacitor inside `apps/web` (see `docs/MOBILE.md`). `ARCHITECTURE_PLAN_V2.md` and the old README describe this superseded direction — don't follow them.

## Commands

```bash
corepack pnpm install                 # pnpm via corepack (no global pnpm on this machine)
cd apps/web && corepack pnpm dev      # Vite dev server (needs .env — see .env.example)
cd apps/web && corepack pnpm build    # production build
cd apps/web && corepack pnpm lint
```

Avoid root `pnpm build`/`test` (turbo) for now — the parked workspaces are not maintained.

## Migration architecture (the important part)

October 8 completion pass: annual prices confirmed $55/$77 (not original
$66/$88). Apply all FIVE October 8 migrations before deploying. Calendar uses
`calendar-connection` OAuth and private feed keys, not Base44 connectors/UIDs.
Interpretations are now local-only: import that content BEFORE deploying its
function. Signup founding eligibility is controlled by
`launch_configuration.founding_ends_at` (null preserves beta), not LAUNCH_DATE.
AI metrics are service-owned and record no prompt/response text. See the top of
STATUS.md and DEPLOYMENT.md for the current local-vs-hosted distinction; older
notes below are historical. No code from this completion pass is deployed.

October 8 billing/access patch: apply the two `20261008` migrations before
deploying the updated functions/web. `reserveAiUsage` is shared by llm-task
and Navigator; quota rows are server-owned and reservations serialized.
Billing webhooks refresh provider state into `billing_snapshots` and atomically
project the highest active tier. RevenueCat requires `REVENUECAT_SECRET_API_KEY`.
`validate-iap-receipt` is now a compatibility reconciliation endpoint, not a
second receipt/tier writer. See DEPLOYMENT.md for deployment order and tests.

All 103 feature files import one object: `import { base44 } from '@/api/base44Client'`. That file is now a **Supabase-backed shim** reproducing the Base44 SDK surface, so feature code stays untouched. Mappings live in `apps/web/src/api/shim/`:

- `entities.js` — `base44.entities.<Name>.list/filter/create/update/delete/deleteMany/subscribe` → Postgres tables. Table names in `shim/tables.js` (snake_case; `User` → `users`). Tables replicate Base44's record shape: `id`, `created_date`, `updated_date`, `created_by` + fields from `base44/entities/<Name>.jsonc`. Sort strings are Base44-style (`'-created_date'` = desc); filters are plain equality maps.
- `auth.js` — Base44's single user object = Supabase Auth session + `public.users` row merged. `me()` throws `{status: 401}` (no session) or `{status: 403}` (no users row → "user_not_registered" screen).
- `functions.js` — `base44.functions.invoke('chartCalculator', payload)` → Edge Function at the **kebab-case slug** (`chart-calculator`); returns axios-like `{data}`.
- `integrations.js` — `SendEmail` → `send-email` Edge Function; `UploadPublicFile` → Storage `public` bucket. Client-side `InvokeLLM` is **retired** (the stub throws): every former call site now goes through `apps/web/src/api/llmTasks.js` → the `llm-task` Edge Function — 37 named tasks whose prompt templates, tier gates, and daily quotas live in `supabase/functions/_shared/llm_tasks/` (the client sends only structured astrological facts). Usage is logged one `llm_usage_log` row per user per UTC day via the service-only `increment_llm_usage` RPC. `invoke-llm` is service-role only now. **Keep in sync:** `effectiveTier` in `_shared/llm_tasks/core.ts` mirrors `apps/web/src/lib/permissions.js` `getEffectiveTier` — the `GATING_ADMIN_ONLY` launch flag must be flipped in BOTH files at launch. Per-tier daily limits (`DAILY_LIMITS` in core.ts: free 50 / Core 300 / Premium 600, admins unlimited) are proposals pending client confirmation.
- `agents.js` — Navigator conversations: `agent_conversation` rows with a jsonb `messages` array + realtime UPDATE subscription; `addMessage` posts to the `navigator-chat` Edge Function (planned backend: Astrology-API.io hosted chat, pending validation — not Claude).

All 34 backend functions are ported to `supabase/functions/` (camelCase→kebab-case slugs, e.g. `chartCalculator` → `chart-calculator` — the shim relies on this mapping). Function bodies are unchanged from `base44/functions/*`; the platform seams live in `supabase/functions/_shared/`:

- `base44Compat.ts` — server-side Base44 SDK stand-in (`compatClient(req)` replaces `createClientFromRequest(req)`): auth.me/updateMe, entities CRUD incl. `deleteMany`/`updateMany` (Mongo-style `$set`/`$inc`/`$gt`, atomic path via the service-only `compat_update_many` RPC), `asServiceRole`, `integrations.Core` (InvokeLLM→Claude via `llm.ts`, SendEmail→Resend), `functions.invoke` with JWT forwarding.
- `edge.ts` — CORS (`json()`, `handleOptions`) and auth helpers (`getAuthUser`, `isServiceRole`, `serviceClient`). Every function does in-function auth; `verify_jwt = false` for all functions in `config.toml` (webhooks/ICS/email-link/service-key callers can't present user JWTs).
- Scheduled workflows + entity automations are pg_cron jobs and DB triggers (migration `..._scheduled_jobs.sql`) posting through `invoke_edge_function()`; it needs vault secrets `edge_base_url` + `edge_service_key` seeded per environment (unseeded = warn + no-op).
- `navigator-chat` is the Navigator backend; `generateReply()` is the provider seam (interim: Claude; planned: Astrology-API.io hosted chat pending validation).
- Function secrets: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STRIPE_*`, `APPLE_SHARED_SECRET`; optional `LLM_MODEL`/`NAVIGATOR_MODEL`.

Local testing: `supabase start` (ports shifted to 5434x to coexist with another local project), `supabase functions serve` (restart it after adding a function directory — it only discovers functions present at startup).

## Key facts and decisions (confirmed with the client)

- Tiers: internal IDs stay `free`/`interpret`/`calendar`; Core/Premium are display names (interpret=Core, calendar=Premium). Tier enforcement must be server-side.
- Founding members: `LAUNCH_DATE = null` in `stampFoundingMember` — every signup is stamped `is_founding_member` until launch is declared. This cohort and behavior must survive migration.
- Auth cutover: pre-created Supabase accounts; existing users get reset/magic-link on first login. A `/login` page must be built (`shim/auth.js` `redirectToLogin` points at it).
- Charts: `base44/functions/chartCalculator` is a hand-rolled ephemeris (fixed TZ offsets, known accuracy issues) — port it as-is behind a stable adapter first; swap to Astrology-API.io once the client has credentials. All cached chart data gets recalculated at cutover.
- The old `supabase/migrations/20260724000001_initial_schema.sql` is the superseded V2-plan schema, **not** the replica schema the shim expects — the replica schema is generated from `base44/entities/*.jsonc`.
- Media on `media.base44.com` (referenced in `index.html`, `src/lib/moduleImages.js`, and inside data) must be re-hosted before Base44 is decommissioned.

## Conventions

- `apps/web` is JavaScript/JSX with `@/` → `src/` alias (see `vite.config.js`); match the existing style — don't convert files to TypeScript.
- `base44/` is reference material: read it, port from it, but don't edit it.
