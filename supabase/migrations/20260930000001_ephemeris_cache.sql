-- ephemeris_cache — permanent cache of Astrology-API.io position fetches for
-- the chart-calculator's remote engine. Ephemeris data for a fixed instant
-- never changes, so entries have no TTL; one row serves every user who asks
-- about the same moment (sky positions for a given date are user-independent,
-- which makes the planner's per-day transit calls nearly free in credits).
create table public.ephemeris_cache (
  key text primary key,
  payload jsonb not null,
  created_date timestamptz not null default now()
);

-- Service-role only (read/written inside Edge Functions; never client-facing).
alter table public.ephemeris_cache enable row level security;
