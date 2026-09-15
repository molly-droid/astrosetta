-- ============================================================================
-- Scheduled jobs + entity automations, replacing base44/workflows/*.jsonc.
--
-- Edge Functions are invoked over HTTP (pg_net) with the service key.
-- Environment-specific values live in Vault; seed once per environment:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'edge_base_url');
--   select vault.create_secret('<service key>', 'edge_service_key');
-- (Local stack: url http://supabase_kong_<project>:8000 — reachable from the
-- db container — and the local service key.)
-- Until both secrets exist, invocations log a warning and do nothing;
-- triggers never fail the user's write.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_edge_function(slug text, body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  svc_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'edge_base_url';
  select decrypted_secret into svc_key from vault.decrypted_secrets where name = 'edge_service_key';
  if base_url is null or svc_key is null then
    raise warning 'invoke_edge_function(%): vault secrets edge_base_url / edge_service_key not seeded — skipping', slug;
    return null;
  end if;
  return net.http_post(
    url := base_url || '/functions/v1/' || slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := body,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke execute on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Entity automations (Base44 automations/workflows on entity events)
-- ----------------------------------------------------------------------------

-- "Welcome email" — Base44 automation on Chart creation (first chart marks
-- onboarding complete). Payload shape the function expects: { data: <row> }.
create or replace function public.trigger_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.invoke_edge_function('send-welcome-email', jsonb_build_object('data', to_jsonb(new)));
  exception when others then
    raise warning 'welcome-email trigger failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger chart_welcome_email
  after insert on public.chart
  for each row execute function public.trigger_welcome_email();

-- "Bug Report Admin Alert" — Base44 workflow on Feedback creation where
-- type = 'bug'. Payload shape the function expects:
-- { event: { entity_id: <feedback id> }, data: <feedback row> }.
create or replace function public.trigger_bug_report_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.invoke_edge_function('notify-admin-bug-report',
      jsonb_build_object(
        'event', jsonb_build_object('entity_id', new.id),
        'data', to_jsonb(new)
      ));
  exception when others then
    raise warning 'bug-report trigger failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger feedback_bug_alert
  after insert on public.feedback
  for each row
  when (new.type = 'bug')
  execute function public.trigger_bug_report_alert();

-- ----------------------------------------------------------------------------
-- Scheduled jobs (schedules copied from base44/workflows — all UTC)
-- ----------------------------------------------------------------------------

select cron.schedule('daily-email-digest', '0 12 * * *',
  $$select public.invoke_edge_function('send-daily-email', '{"scheduled": true, "appUrl": "https://astrosetta.com"}'::jsonb)$$);

select cron.schedule('weekly-email-digest', '0 12 * * 1',
  $$select public.invoke_edge_function('send-weekly-email', '{"scheduled": true, "appUrl": "https://astrosetta.com"}'::jsonb)$$);

select cron.schedule('monthly-email-digest', '0 12 1 * *',
  $$select public.invoke_edge_function('send-monthly-email', '{"scheduled": true, "appUrl": "https://astrosetta.com"}'::jsonb)$$);

select cron.schedule('weekly-feedback-digest', '0 13 * * 1',
  $$select public.invoke_edge_function('send-feedback-digest', '{"scheduled": true}'::jsonb)$$);

select cron.schedule('daily-ephemeris-cross-check', '0 11 * * *',
  $$select public.invoke_edge_function('cross-check-ephemeris', '{}'::jsonb)$$);

-- Interval workflows ran every 10 minutes; each run processes one chart and
-- re-runs are free (see the functions' own comments).
select cron.schedule('calendar-synthesis-generation', '*/10 * * * *',
  $$select public.invoke_edge_function('generate-calendar-synthesis', '{}'::jsonb)$$);

select cron.schedule('pre-generate-daily-synthesis', '*/10 * * * *',
  $$select public.invoke_edge_function('pre-generate-synthesis', '{}'::jsonb)$$);
