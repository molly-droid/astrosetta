create table public.ai_request_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  task text not null,
  provider text not null,
  model text,
  outcome text not null check(outcome in ('success','error')),
  latency_ms integer not null,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint,
  cache_write_tokens bigint,
  estimated_credits numeric,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now()
);
create index ai_request_metrics_created_idx on public.ai_request_metrics(created_at);
alter table public.ai_request_metrics enable row level security;
revoke all on public.ai_request_metrics from public, anon, authenticated;
grant select, insert, delete on public.ai_request_metrics to service_role;
-- Deliberately no prompts, birth details, journal content, or model output.
