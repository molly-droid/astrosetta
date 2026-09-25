# E2E smoke drives

Browser smoke tests for the migrated app against the local Supabase stack.
They drive the real UI headlessly (playwright-core + installed Chrome) and
screenshot each step.

Prereqs:
- `supabase start` and `supabase functions serve` running (see CLAUDE.md)
- `apps/web/.env` pointing at the local stack (copy `.env.example`, use the
  publishable key from `supabase start` output)
- `corepack pnpm --filter web dev` running on :5173
- `npm i playwright-core` next to these scripts (not a repo dependency)

Run:
    node 01-signup.mjs                     # landing -> login -> signup -> onboarding
    node 02-onboarding-chart.mjs           # full onboarding -> chart calculation -> /home
    node 03-app-pages.mjs <email>          # sign back in; chart/planner/learn/profile

Expected local failures (missing secrets, not bugs): send-chart-recap-email
and welcome-email 500 without RESEND_API_KEY; LLM synthesis panels error
without ANTHROPIC_API_KEY.
