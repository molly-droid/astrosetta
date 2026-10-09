-- These assertions run only in the disposable test database.
select public.test_assert(public.founding_eligible(now()), 'beta signup remains founding');
update public.launch_configuration set founding_ends_at='2026-01-01';
select public.test_assert(public.founding_eligible('2025-12-31'), 'pre-cutoff cohort preserved');
select public.test_assert(not public.founding_eligible('2026-01-02'), 'post-cutoff cohort excluded');
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000004','postlaunch@example.invalid');
select public.test_assert((select not is_founding_member from public.users where id='00000000-0000-4000-8000-000000000004'), 'signup trigger uses configured cutoff');
update public.users set is_founding_member=null,created_date='2025-12-31' where id='00000000-0000-4000-8000-000000000004';
select public.refresh_billing_access('00000000-0000-4000-8000-000000000004');
select public.test_assert((select is_founding_member from public.users where id='00000000-0000-4000-8000-000000000004'), 'import repair uses original signup date');

set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
do $$ declare name text; begin
  foreach name in array array['launch_configuration','calendar_feed_keys','google_calendar_connections','google_calendar_states','ai_request_metrics'] loop
    begin
      execute format('select * from public.%I',name);
      raise exception 'Private table readable: %',name;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    update public.launch_configuration set founding_ends_at=null;
    raise exception 'Client may extend founding eligibility';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
insert into public.calendar_feed_keys(user_id) values('00000000-0000-4000-8000-000000000004');
select public.test_assert((select token ~ '^[a-f0-9]{64}$' from public.calendar_feed_keys where user_id='00000000-0000-4000-8000-000000000004'), 'private feed token generated');
insert into public.google_calendar_connections values('00000000-0000-4000-8000-000000000004','access-test','refresh-test',now()+interval '1 hour',now());
insert into public.ai_request_metrics(user_id,task,provider,outcome,latency_ms) values('00000000-0000-4000-8000-000000000004','test','test','success',1);
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000004';
select public.test_assert(not exists(select 1 from public.calendar_feed_keys where user_id='00000000-0000-4000-8000-000000000004'), 'deletion revokes feed');
select public.test_assert(not exists(select 1 from public.google_calendar_connections where user_id='00000000-0000-4000-8000-000000000004'), 'deletion removes OAuth tokens');
select public.test_assert(not exists(select 1 from public.ai_request_metrics where user_id='00000000-0000-4000-8000-000000000004'), 'deletion removes per-user metrics');
