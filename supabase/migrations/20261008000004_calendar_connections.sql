-- OAuth credentials and bearer feed keys must never be exposed through CRUD.
create table public.google_calendar_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create table public.google_calendar_states (
  user_id uuid primary key references public.users(id) on delete cascade,
  state_hash text not null unique,
  code_verifier text not null,
  native boolean not null default false,
  expires_at timestamptz not null
);
create table public.calendar_feed_keys (
  user_id uuid primary key references public.users(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_states enable row level security;
alter table public.calendar_feed_keys enable row level security;
revoke all on public.google_calendar_connections, public.google_calendar_states, public.calendar_feed_keys from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_connections, public.google_calendar_states, public.calendar_feed_keys to service_role;
