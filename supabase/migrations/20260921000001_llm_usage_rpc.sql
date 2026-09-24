-- increment_llm_usage — daily LLM quota bookkeeping for the llm-task Edge
-- Function. One llm_usage_log row per user per UTC day (Base44's LLMUsageLog
-- shape: user_id + date_key + call_count), incremented atomically on each
-- allowed call.
--
-- Returns {"allowed": bool, "total": int}. When the day's total has reached
-- p_limit the call is refused and nothing is written. p_limit < 0 means
-- unlimited (admins).
--
-- No unique index exists on (user_id, date_key) — imported Base44 data may
-- hold duplicates — so the total is SUM(call_count) across matching rows and
-- a concurrent first-call race can create two rows; both count toward the sum.
create or replace function public.increment_llm_usage(
  p_user_id text,
  p_date_key text,
  p_limit integer,
  p_description text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_updated integer;
begin
  select coalesce(sum(call_count), 0) into v_total
  from public.llm_usage_log
  where user_id = p_user_id and date_key = p_date_key;

  if p_limit >= 0 and v_total >= p_limit then
    return jsonb_build_object('allowed', false, 'total', v_total);
  end if;

  update public.llm_usage_log
  set call_count = coalesce(call_count, 0) + 1,
      updated_date = now()
  where id = (
    select id from public.llm_usage_log
    where user_id = p_user_id and date_key = p_date_key
    limit 1
  );
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- Stamp created_by_id explicitly: the RPC runs under the service role, so
    -- the column's auth.uid() default would be NULL and the row invisible to
    -- the user's own RLS-scoped reads (Base44 parity: users read own usage).
    insert into public.llm_usage_log (user_id, date_key, call_count, description, created_by_id)
    values (p_user_id, p_date_key, 1, p_description, p_user_id::uuid);
  end if;

  return jsonb_build_object('allowed', true, 'total', v_total + 1);
end;
$$;

-- Service-role only (called by the llm-task Edge Function).
revoke execute on function public.increment_llm_usage(text, text, integer, text) from public, anon, authenticated;
