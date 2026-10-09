-- Profile preferences remain owner-editable. Identity, billing and founding
-- state may only be changed by trusted server operations or an existing admin.
alter table public.users add column subscription_admin_override boolean not null default false;

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
         new.subscription_admin_override)
     is distinct from
     row(old.id, old.email, old.role, old.subscription_tier,
         old.subscription_expires, old.subscription_source, old.stripe_customer_id,
         old.stripe_subscription_id, old.iap_transaction_id, old.is_founding_member,
         old.subscription_admin_override) then
    raise exception 'Account authority fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger users_protect_authority before update on public.users
  for each row execute function public.protect_user_authority();

-- Usage is server-owned. Restrict both policies and privileges so the public
-- CRUD shim cannot reset counts, spoof another user_id, or insert negatives.
drop policy if exists llm_usage_log_insert on public.llm_usage_log;
drop policy if exists llm_usage_log_update on public.llm_usage_log;
drop policy if exists llm_usage_log_delete on public.llm_usage_log;
revoke insert, update, delete, truncate on public.llm_usage_log from public, anon, authenticated;
grant select, insert, update, delete on public.llm_usage_log to service_role;

create or replace function public.increment_llm_usage(
  p_user_id text, p_date_key text, p_limit integer, p_description text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total bigint;
  v_updated integer;
begin
  if p_user_id is null or p_date_key is null or p_limit is null or p_limit < -1 then
    raise exception 'Invalid quota reservation';
  end if;
  -- Lock the user/day even when no row exists yet. The check and increment
  -- must serialize across llm-task AND navigator-chat, including first calls.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_date_key, 0));
  select coalesce(sum(greatest(coalesce(call_count, 0), 0)), 0) into v_total
    from public.llm_usage_log where user_id = p_user_id and date_key = p_date_key;
  if p_limit >= 0 and v_total >= p_limit then
    return jsonb_build_object('allowed', false, 'total', v_total);
  end if;
  update public.llm_usage_log
    set call_count = greatest(coalesce(call_count, 0), 0) + 1, updated_date = now()
    where id = (select id from public.llm_usage_log
                where user_id = p_user_id and date_key = p_date_key limit 1);
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    insert into public.llm_usage_log (user_id, date_key, call_count, description, created_by_id)
      values (p_user_id, p_date_key, 1, p_description, p_user_id::uuid);
  end if;
  return jsonb_build_object('allowed', true, 'total', v_total + 1);
end;
$$;
revoke all on function public.increment_llm_usage(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.increment_llm_usage(text, text, integer, text) to service_role;
