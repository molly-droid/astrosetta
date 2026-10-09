-- Each billing authority replaces only its own snapshot. Projection is locked
-- per user so concurrent Apple/Stripe updates cannot erase each other.
create table public.billing_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'revenuecat')),
  observed_at timestamptz not null,
  entitlements jsonb not null check (jsonb_typeof(entitlements) = 'array'),
  primary key (user_id, provider)
);
alter table public.billing_snapshots enable row level security;
revoke all on public.billing_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.billing_snapshots to service_role;

-- Must be called with the users row locked. Preserve an imported legacy
-- subscription until ITS provider has been refreshed, including imports made
-- after this migration. Empty snapshots are deliberate tombstones, not missing.
create function public.seed_legacy_billing(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.billing_snapshots(user_id, provider, observed_at, entitlements)
  select id, case when subscription_source = 'stripe' then 'stripe' else 'revenuecat' end,
    '-infinity'::timestamptz,
    jsonb_build_array(jsonb_build_object('tier', subscription_tier,
      'expires_at', subscription_expires, 'source', subscription_source))
  from public.users where id = p_user_id
    and subscription_tier in ('interpret', 'calendar')
    and subscription_source in ('stripe', 'apple', 'google')
  on conflict do nothing;
$$;

-- Recompute from all unexpired grants, choosing tier first, THEN expiry.
-- A longer Core subscription must never extend the Premium tier.
create function public.project_billing_access(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare winner record;
begin
  if not exists (select 1 from public.billing_snapshots where user_id = p_user_id) then
    return; -- unmanaged/admin preview/import with no billing provider
  end if;
  select e->>'tier' as tier, (e->>'expires_at')::timestamptz as expires_at,
         e->>'source' as source into winner
  from public.billing_snapshots s cross join lateral jsonb_array_elements(s.entitlements) e
  where s.user_id = p_user_id
    and (e->>'expires_at' is null or (e->>'expires_at')::timestamptz > now())
  order by case e->>'tier' when 'calendar' then 2 when 'interpret' then 1 else 0 end desc,
           (e->>'expires_at')::timestamptz desc nulls first, s.provider
  limit 1;
  update public.users set subscription_tier = coalesce(winner.tier, 'free'),
    subscription_expires = winner.expires_at, subscription_source = winner.source
  where id = p_user_id and row(subscription_tier, subscription_expires, subscription_source)
    is distinct from row(coalesce(winner.tier, 'free'), winner.expires_at, winner.source);
end;
$$;

create function public.apply_billing_snapshot(
  p_user_id uuid, p_provider text, p_observed_at timestamptz, p_entitlements jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if p_provider is null or p_provider not in ('stripe', 'revenuecat')
     or p_observed_at is null or not isfinite(p_observed_at)
     or p_entitlements is null or jsonb_typeof(p_entitlements) <> 'array' then
    raise exception 'Invalid billing snapshot';
  end if;
  for e in select * from jsonb_array_elements(p_entitlements) loop
    if e->>'tier' is null or e->>'tier' not in ('interpret', 'calendar')
       or e->>'source' is null or e->>'source' not in ('stripe', 'apple', 'google')
       or not (e ? 'expires_at') then
      raise exception 'Invalid entitlement';
    end if;
    if e->>'expires_at' is not null and not isfinite((e->>'expires_at')::timestamptz) then
      raise exception 'Invalid entitlement expiration';
    end if;
  end loop;
  perform 1 from public.users where id = p_user_id for update;
  if not found then raise exception 'Billing user not found'; end if;
  perform public.seed_legacy_billing(p_user_id);
  insert into public.billing_snapshots values (p_user_id, p_provider, p_observed_at, p_entitlements)
  on conflict (user_id, provider) do update
    set observed_at = excluded.observed_at, entitlements = excluded.entitlements
    where billing_snapshots.observed_at < excluded.observed_at;
  if not found then return; end if; -- stale deliveries must not clear previews
  update public.users set subscription_admin_override = false where id = p_user_id;
  perform public.project_billing_access(p_user_id);
end;
$$;

-- Refresh on authenticated profile reads and AI requests so an expired
-- Premium grant falls back to a still-active Core grant even before a webhook.
create function public.refresh_billing_access(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare account record;
begin
  if current_setting('role', true) not in ('service_role', 'none')
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select role, subscription_admin_override into account from public.users where id = p_user_id for update;
  if not found then return; end if;
  -- Preserve the existing legacy founding repair without granting browser writes.
  update public.users set is_founding_member = true
    where id = p_user_id and is_founding_member is null;
  if account.role = 'admin' or account.subscription_admin_override then return; end if;
  perform public.seed_legacy_billing(p_user_id);
  perform public.project_billing_access(p_user_id);
end;
$$;

revoke all on function public.seed_legacy_billing(uuid) from public, anon, authenticated;
revoke all on function public.project_billing_access(uuid) from public, anon, authenticated;
revoke all on function public.apply_billing_snapshot(uuid, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.refresh_billing_access(uuid) from public, anon;
grant execute on function public.apply_billing_snapshot(uuid, text, timestamptz, jsonb) to service_role;
grant execute on function public.refresh_billing_access(uuid) to authenticated, service_role;
