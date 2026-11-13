-- At most one automatic delivery per digest, recipient and local period.
-- No FK: delivery history must survive account deletion and block replays.
create table public.email_digest_delivery (
  kind text not null check (kind in ('daily','weekly','monthly','feedback')),
  period_key text not null,
  recipient text not null,
  status text not null check (status in ('processing','sent','skipped','failed')),
  provider_id text,
  created_at timestamptz not null default now(),
  primary key (kind, period_key, recipient)
);
alter table public.email_digest_delivery enable row level security;
revoke all on public.email_digest_delivery from public, anon, authenticated;
grant select, insert, update on public.email_digest_delivery to service_role;
