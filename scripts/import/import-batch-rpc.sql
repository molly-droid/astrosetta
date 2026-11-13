-- Temporary operational RPC. Remove with DROP FUNCTION after validation.
-- Batches are atomic, reject stale plans, and retain original source timestamps.
create or replace function public.apply_base44_import_batch(
  p_table text, p_rows jsonb, p_expected jsonb
) returns integer language plpgsql security definer set search_path=public as $$
declare r jsonb; existing timestamptz; cols text; assignments text; n integer:=0;
begin
  if p_table <> all(array[
    'users','account_deletion_request','calendar_synthesis','chart','daily_quiz',
    'error_log','event_order','feature_highlight','feedback','founding_patron',
    'glossary_item','incentive_sku','interpretation','llm_usage_log','learning_module',
    'placement','planet_correction','planner_journal_entry','popup_event','roadmap_item',
    'saved_chart','streak_bonus_content','synthesis_rating','user_interpretation_rating',
    'user_module_progress','user_placement_progress','user_progress','waitlist_email','xp_event'
  ]) then raise exception 'Unsupported import table'; end if;
  if exists(select 1 from pg_trigger where tgrelid='public.chart'::regclass
    and tgname='chart_welcome_email' and tgenabled<>'D') then
    raise exception 'Welcome email must be held before importing';
  end if;
  if exists(select 1 from cron.job where jobname like '%email%' and active) then
    raise exception 'Email schedules must be held before importing';
  end if;
  execute format('lock table public.%I in exclusive mode',p_table);
  execute format('alter table public.%I disable trigger %I',p_table,p_table||'_updated_date');
  for r in select value from jsonb_array_elements(p_rows) loop
    if not(p_expected ? (r->>'id')) then raise exception 'Missing expected revision'; end if;
    existing:=null;
    execute format('select updated_date from public.%I where id=$1::uuid',p_table)
      into existing using r->>'id';
    if existing is distinct from (p_expected->>(r->>'id'))::timestamptz then
      raise exception 'Target changed since reconciliation, regenerate plan';
    end if;
    select string_agg(format('%I',key),',' order by key),
      string_agg(format('%I=excluded.%I',key,key),',' order by key) filter(where key<>'id')
      into cols,assignments from jsonb_object_keys(r) as key;
    execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) on conflict(id) do update set %3$s',p_table,cols,assignments) using r;
    n:=n+1;
  end loop;
  execute format('alter table public.%I enable trigger %I',p_table,p_table||'_updated_date');
  return n;
end;
$$;
revoke all on function public.apply_base44_import_batch(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_base44_import_batch(text,jsonb,jsonb) to service_role;
