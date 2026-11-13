-- Cadence comes from the same winning provider entitlement as access.
alter table public.users add column subscription_billing_period text
  check (subscription_billing_period in ('monthly','yearly'));

create function public.protect_billing_period() returns trigger language plpgsql set search_path=public as $$
begin
  if new.subscription_billing_period is distinct from old.subscription_billing_period
     and current_user not in ('postgres','supabase_admin','service_role') and not public.is_admin() then
    raise exception 'Billing period is server-managed' using errcode='42501';
  end if;
  return new;
end $$;
create trigger users_billing_period_authority before update on public.users for each row execute function public.protect_billing_period();

create or replace function public.project_billing_access(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare winner record; previous record;
begin
  if not exists(select 1 from public.billing_snapshots where user_id=p_user_id) then return; end if;
  select subscription_tier,subscription_expires,is_founding_member,founding_rate_forfeited_at,subscription_is_trial
    into previous from public.users where id=p_user_id;
  select e->>'tier' tier,(e->>'expires_at')::timestamptz expires_at,e->>'source' source,
         coalesce((e->>'is_trial')::boolean,false) is_trial,
         case when e->>'billing_period' in ('monthly','yearly') then e->>'billing_period' end billing_period into winner
  from public.billing_snapshots s cross join lateral jsonb_array_elements(s.entitlements) e
  where s.user_id=p_user_id and (e->>'expires_at' is null or (e->>'expires_at')::timestamptz>now())
  order by case e->>'tier' when 'calendar' then 2 when 'interpret' then 1 else 0 end desc,
    (e->>'expires_at')::timestamptz desc nulls first,s.provider limit 1;
  update public.users set subscription_tier=coalesce(winner.tier,'free'),subscription_expires=winner.expires_at,
    subscription_source=winner.source,subscription_is_trial=coalesce(winner.is_trial,false),
    subscription_billing_period=winner.billing_period
  where id=p_user_id and row(subscription_tier,subscription_expires,subscription_source,subscription_is_trial,subscription_billing_period)
    is distinct from row(coalesce(winner.tier,'free'),winner.expires_at,winner.source,coalesce(winner.is_trial,false),winner.billing_period);
  if winner.tier is null and previous.subscription_tier in ('interpret','calendar')
    and not previous.subscription_is_trial
    and previous.subscription_expires is not null and previous.subscription_expires<=now()
    and previous.is_founding_member is true and previous.founding_rate_forfeited_at is null then
    update public.users set founding_rate_forfeited_at=now() where id=p_user_id;
  end if;
end $$;
revoke all on function public.project_billing_access(uuid) from public,anon,authenticated;
