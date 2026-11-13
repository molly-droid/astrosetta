-- Future events only. Existing users are deliberately NOT enrolled/backfilled.
create table public.subscriber_notice_configuration (
  id boolean primary key default true check(id),
  enabled boolean not null default false
);
insert into public.subscriber_notice_configuration(id,enabled) values(true,false);
create table public.subscriber_signup_watch (
  user_id uuid primary key references public.users(id) on delete cascade
);
create table public.subscriber_notice_delivery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check(kind in ('signup','subscription')),
  status text not null default 'queued' check(status in ('queued','processing','sent','skipped','failed')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now()+interval '2 minutes',
  claimed_at timestamptz,
  completed_at timestamptz,
  provider_id text,
  detail text,
  unique(user_id,kind)
);
create index subscriber_notice_queue_idx on public.subscriber_notice_delivery(available_at) where status='queued';
alter table public.subscriber_notice_configuration enable row level security;
alter table public.subscriber_signup_watch enable row level security;
alter table public.subscriber_notice_delivery enable row level security;
revoke all on public.subscriber_notice_configuration,public.subscriber_signup_watch,public.subscriber_notice_delivery from public,anon,authenticated;
grant select,insert,update,delete on public.subscriber_notice_configuration,public.subscriber_signup_watch,public.subscriber_notice_delivery to service_role;

create function public.queue_subscriber_notice(p_user_id uuid,p_kind text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not coalesce((select enabled from public.subscriber_notice_configuration where id),false) then return; end if;
  insert into public.subscriber_notice_delivery(user_id,kind) values(p_user_id,p_kind) on conflict(user_id,kind) do nothing;
end $$;
revoke all on function public.queue_subscriber_notice(uuid,text) from public,anon,authenticated;

create function public.watch_new_subscriber_signup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.subscriber_signup_watch(user_id) values(new.id) on conflict do nothing;
  return new;
end $$;
create trigger users_watch_new_signup after insert on public.users for each row execute function public.watch_new_subscriber_signup();

-- Both existing native builds and web save this field at onboarding completion.
create function public.notice_completed_signup()
returns trigger language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
  if new.recommended_start_section is null then return new; end if;
  select user_id into uid from public.subscriber_signup_watch where user_id::text=new.user_id;
  if uid is not null then perform public.queue_subscriber_notice(uid,'signup'); end if;
  return new;
end $$;
create trigger user_progress_signup_notice after insert or update of recommended_start_section on public.user_progress
  for each row execute function public.notice_completed_signup();

-- Renewals, plan switches while paid, profile edits and metadata backfills do
-- not create notices. A unique key also suppresses duplicate provider events
-- and repeat subscriptions for someone who has already been announced.
create function public.notice_first_subscription()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.subscription_tier='free' and new.subscription_tier in ('interpret','calendar')
    and new.subscription_source in ('stripe','apple','google')
    and not new.subscription_admin_override
    and exists(select 1 from public.billing_snapshots where user_id=new.id) then
    perform public.queue_subscriber_notice(new.id,'subscription');
  end if;
  return new;
end $$;
create trigger users_first_subscription_notice after update of subscription_tier on public.users
  for each row execute function public.notice_first_subscription();

-- A claim is one attempt. A timeout may mean Resend accepted the message, so
-- processing/failed notices need manual review, never an automatic retry.
create function public.claim_subscriber_notice()
returns setof public.subscriber_notice_delivery language sql security definer set search_path=public as $$
  with candidate as (
    select n.id from public.subscriber_notice_delivery n
    where n.status='queued' and n.available_at<=now()
      and exists(select 1 from public.subscriber_notice_configuration where id and enabled)
    order by n.available_at,n.id for update skip locked limit 1
  )
  update public.subscriber_notice_delivery n set status='processing',claimed_at=now()
  from candidate c where n.id=c.id returning n.*;
$$;
revoke all on function public.claim_subscriber_notice() from public,anon,authenticated;
grant execute on function public.claim_subscriber_notice() to service_role;
