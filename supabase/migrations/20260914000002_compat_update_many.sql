-- compat_update_many — server-side helper for Base44's updateMany semantics,
-- used by the Edge Function compat layer (base44Compat.ts) for the one
-- pattern PostgREST cannot express: an atomic guarded increment
-- (IncentiveSKU stock decrement: query {stock_remaining: {$gt: 0}},
-- update {$inc: {stock_remaining: -1}}).
--
-- p_query: {"col": value} equality matches, or {"col": {"$gt": value}}.
-- p_set:   {"col": value} plain assignments.
-- p_inc:   {"col": delta} atomic col = col + delta.
-- Returns the number of rows updated.
--
-- Service-role only: not callable by anon/authenticated.

create or replace function public.compat_update_many(
  p_table text,
  p_query jsonb,
  p_set jsonb default '{}'::jsonb,
  p_inc jsonb default '{}'::jsonb
) returns integer
language plpgsql
as $$
declare
  set_parts text[] := '{}';
  where_parts text[] := '{}';
  k text;
  v jsonb;
  n integer;
begin
  if p_table !~ '^[a-z_][a-z0-9_]*$' then
    raise exception 'invalid table name %', p_table;
  end if;

  for k, v in select * from jsonb_each(coalesce(p_set, '{}'::jsonb)) loop
    set_parts := set_parts || format('%I = %L', k, v #>> '{}');
  end loop;
  for k, v in select * from jsonb_each(coalesce(p_inc, '{}'::jsonb)) loop
    set_parts := set_parts || format('%I = %I + %s', k, k, (v #>> '{}')::numeric);
  end loop;
  if array_length(set_parts, 1) is null then
    raise exception 'nothing to update';
  end if;

  for k, v in select * from jsonb_each(coalesce(p_query, '{}'::jsonb)) loop
    if jsonb_typeof(v) = 'object' and v ? '$gt' then
      where_parts := where_parts || format('%I > %s', k, (v ->> '$gt')::numeric);
    elsif jsonb_typeof(v) = 'null' then
      where_parts := where_parts || format('%I is null', k);
    else
      where_parts := where_parts || format('%I = %L', k, v #>> '{}');
    end if;
  end loop;

  execute format(
    'update public.%I set %s %s',
    p_table,
    array_to_string(set_parts, ', '),
    case when array_length(where_parts, 1) is null then ''
         else 'where ' || array_to_string(where_parts, ' and ') end
  );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.compat_update_many(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
