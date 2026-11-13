-- An explicit migration cohort, not the general founding-member flag.
-- Rows are seeded separately from the verified private 48-account import map.
create table public.beta_trial_members (
  user_id uuid primary key references public.users(id) on delete cascade,
  trial_ends_at timestamptz not null default '2027-01-01 00:00:00 America/Chicago',
  redeemed_at timestamptz,
  stripe_subscription_id text unique,
  check ((redeemed_at is null) = (stripe_subscription_id is null))
);
alter table public.beta_trial_members enable row level security;
revoke all on public.beta_trial_members from public, anon, authenticated;
grant select on public.beta_trial_members to authenticated;
grant select, insert, update, delete on public.beta_trial_members to service_role;
create policy beta_trial_member_read on public.beta_trial_members for select to authenticated using (user_id = auth.uid());

-- Exactly one completed subscription consumes the offer. Other simultaneous
-- checkouts are cancelled by the webhook before any paid period can begin.
create function public.redeem_beta_trial(p_user_id uuid, p_subscription_id text)
returns text language plpgsql security definer set search_path=public as $$
declare winner text;
begin
  if p_subscription_id is null or p_subscription_id not like 'sub_%' then raise exception 'Invalid subscription'; end if;
  select stripe_subscription_id into winner from public.beta_trial_members where user_id=p_user_id for update;
  if not found then raise exception 'Not a beta trial member'; end if;
  if winner is null then
    update public.beta_trial_members set stripe_subscription_id=p_subscription_id,redeemed_at=now() where user_id=p_user_id;
    return p_subscription_id;
  end if;
  return winner;
end $$;
revoke all on function public.redeem_beta_trial(uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_beta_trial(uuid,text) to service_role;

-- A trial is access, but ending an unpaid trial is not a lapsed paid plan.
alter table public.users add column subscription_is_trial boolean not null default false;
create function public.protect_trial_authority() returns trigger language plpgsql set search_path=public as $$
begin
  if new.subscription_is_trial is distinct from old.subscription_is_trial
     and current_user not in ('postgres','supabase_admin','service_role') and not public.is_admin() then
    raise exception 'Trial status is server-managed' using errcode='42501';
  end if;
  return new;
end $$;
create trigger users_trial_authority before update on public.users for each row execute function public.protect_trial_authority();

create or replace function public.project_billing_access(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare winner record; previous record;
begin
  if not exists(select 1 from public.billing_snapshots where user_id=p_user_id) then return; end if;
  select subscription_tier,subscription_expires,is_founding_member,founding_rate_forfeited_at,subscription_is_trial
    into previous from public.users where id=p_user_id;
  select e->>'tier' tier,(e->>'expires_at')::timestamptz expires_at,e->>'source' source,
         coalesce((e->>'is_trial')::boolean,false) is_trial into winner
  from public.billing_snapshots s cross join lateral jsonb_array_elements(s.entitlements) e
  where s.user_id=p_user_id and (e->>'expires_at' is null or (e->>'expires_at')::timestamptz>now())
  order by case e->>'tier' when 'calendar' then 2 when 'interpret' then 1 else 0 end desc,
    (e->>'expires_at')::timestamptz desc nulls first,s.provider limit 1;
  update public.users set subscription_tier=coalesce(winner.tier,'free'),subscription_expires=winner.expires_at,
    subscription_source=winner.source,subscription_is_trial=coalesce(winner.is_trial,false)
  where id=p_user_id and row(subscription_tier,subscription_expires,subscription_source,subscription_is_trial)
    is distinct from row(coalesce(winner.tier,'free'),winner.expires_at,winner.source,coalesce(winner.is_trial,false));
  if winner.tier is null and previous.subscription_tier in ('interpret','calendar')
    and not previous.subscription_is_trial
    and previous.subscription_expires is not null and previous.subscription_expires<=now()
    and previous.is_founding_member is true and previous.founding_rate_forfeited_at is null then
    update public.users set founding_rate_forfeited_at=now() where id=p_user_id;
  end if;
end $$;
revoke all on function public.project_billing_access(uuid) from public,anon,authenticated;
