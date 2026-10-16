-- Founding rate forfeiture (Molly, 2026-10-16).
--
-- Policy: "If founding members cancel and later subscribe, they would lose
-- founding rates." Membership in the cohort is permanent — `is_founding_member`
-- keeps driving the Founding Patron badge — but the DISCOUNT is conditional on
-- staying subscribed.
--
-- `project_billing_access` is the one place a user's tier can fall to free, so
-- it is the only correct place to stamp the forfeiture: it already holds the
-- users row locked and already knows both the old and the new tier. Stamping
-- in a webhook handler instead would miss expiry-by-time-passing, which is
-- exactly how most lapses happen.
alter table public.users add column founding_rate_forfeited_at timestamptz;

comment on column public.users.founding_rate_forfeited_at is
  'Set when a paid subscription lapsed to free. Non-null means standard pricing on resubscribe, even though is_founding_member stays true.';

-- Server-managed, like every other billing authority field: a browser must not
-- be able to clear its own forfeiture and buy back in at the founding price.
create or replace function public.protect_user_authority()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Admin tier previews survive ordinary reads, until the next provider sync.
  -- Definer billing functions run as postgres, not as an admin browser.
  if current_user = 'authenticated' and public.is_admin()
     and row(new.subscription_tier, new.subscription_expires)
       is distinct from row(old.subscription_tier, old.subscription_expires) then
    new.subscription_admin_override := true;
  end if;
  if current_user in ('postgres', 'supabase_admin', 'service_role') or public.is_admin() then
    return new;
  end if;
  if row(new.id, new.email, new.role, new.subscription_tier,
         new.subscription_expires, new.subscription_source, new.stripe_customer_id,
         new.stripe_subscription_id, new.iap_transaction_id, new.is_founding_member,
         new.subscription_admin_override, new.founding_rate_forfeited_at)
     is distinct from
     row(old.id, old.email, old.role, old.subscription_tier,
         old.subscription_expires, old.subscription_source, old.stripe_customer_id,
         old.stripe_subscription_id, old.iap_transaction_id, old.is_founding_member,
         old.subscription_admin_override, old.founding_rate_forfeited_at) then
    raise exception 'Account authority fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Recompute from all unexpired grants, choosing tier first, THEN expiry.
-- A longer Core subscription must never extend the Premium tier.
--
-- Unchanged from 20261008000002 except for the forfeiture stamp below.
create or replace function public.project_billing_access(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare winner record; previous record;
begin
  if not exists (select 1 from public.billing_snapshots where user_id = p_user_id) then
    return; -- unmanaged/admin preview/import with no billing provider
  end if;
  select subscription_tier, subscription_expires, is_founding_member,
         founding_rate_forfeited_at
    into previous from public.users where id = p_user_id;
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

  -- A founding member who held a paid tier and now holds none has lapsed.
  -- Stamped once and never cleared, so a later resubscribe prices as standard.
  --
  -- The expiry check is deliberate. A provider can deliver an empty
  -- entitlement array as a tombstone, and forfeiture is irreversible, so we
  -- refuse to burn someone's rate on a webhook glitch: the paid window must
  -- demonstrably have ended. A cancellation reports an expires_at in the past
  -- by the time it matters, so real lapses still stamp.
  if winner.tier is null
     and previous.subscription_tier in ('interpret', 'calendar')
     and previous.subscription_expires is not null
     and previous.subscription_expires <= now()
     and previous.is_founding_member is true
     and previous.founding_rate_forfeited_at is null then
    update public.users set founding_rate_forfeited_at = now() where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.project_billing_access(uuid) from public, anon, authenticated;
