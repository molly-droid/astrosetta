set request.jwt.claim.sub='';
select public.test_assert(not exists(select 1 from public.subscriber_notice_delivery), 'installation does not backfill announcements');
update public.subscriber_notice_configuration set enabled=true where id;

-- An existing member completing/editing a legacy progress record is not new.
delete from public.subscriber_signup_watch where user_id='00000000-0000-4000-8000-000000000001';
insert into public.user_progress(user_id,current_tier,recommended_start_section)
values('00000000-0000-4000-8000-000000000001','apprentice','foundations');
select public.test_assert(not exists(select 1 from public.subscriber_notice_delivery), 'legacy progress cannot cause an email swarm');

insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000020','new-subscriber@example.invalid');
insert into public.user_progress(user_id,current_tier) values('00000000-0000-4000-8000-000000000020','apprentice');
select public.test_assert(not exists(select 1 from public.subscriber_notice_delivery), 'unfinished signup is not announced');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$ begin
  begin insert into public.user_progress(user_id,current_tier,recommended_start_section)
    values('00000000-0000-4000-8000-000000000020','apprentice','forged-completion');
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub='';
select public.test_assert(not exists(select 1 from public.subscriber_notice_delivery), 'one browser cannot announce another account');
update public.user_progress set recommended_start_section='foundations' where user_id='00000000-0000-4000-8000-000000000020';
update public.user_progress set recommended_start_section='classical' where user_id='00000000-0000-4000-8000-000000000020';
select public.test_assert((select count(*)=1 from public.subscriber_notice_delivery where kind='signup'), 'completed signup is queued exactly once');

update public.users set subscription_tier='calendar',subscription_source=null,subscription_admin_override=true
where id='00000000-0000-4000-8000-000000000020';
select public.test_assert(not exists(select 1 from public.subscriber_notice_delivery where kind='subscription'), 'complimentary access is not a subscription');

select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000020','stripe',now(),
 '[{"tier":"interpret","expires_at":"2099-01-01","source":"stripe","billing_period":"monthly"}]');
select public.test_assert((select count(*)=1 from public.subscriber_notice_delivery where kind='subscription'), 'first provider purchase after complimentary access is announced');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000020','revenuecat',now(),
 '[{"tier":"calendar","expires_at":"2098-01-01","source":"apple","billing_period":"yearly"}]');
select public.test_assert((select subscription_tier='calendar' and subscription_billing_period='yearly' from public.users where id='00000000-0000-4000-8000-000000000020'), 'cadence belongs to winning Premium grant, not longer Core grant');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000020','revenuecat',now()+interval '1 second',
 '[{"tier":"calendar","expires_at":"2098-02-01","source":"apple","billing_period":"yearly"}]');
select public.test_assert((select count(*)=1 from public.subscriber_notice_delivery where kind='subscription'), 'renewals, duplicate webhooks and paid upgrades do not reannounce subscriber');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000020','revenuecat',now()+interval '2 seconds','[]');
select public.test_assert((select subscription_tier='interpret' and subscription_billing_period='monthly' from public.users where id='00000000-0000-4000-8000-000000000020'), 'fallback picks the Core monthly cadence');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000020','stripe',now()+interval '3 seconds','[]');
select public.test_assert((select subscription_tier='free' and subscription_billing_period is null from public.users where id='00000000-0000-4000-8000-000000000020'), 'Free has no billing cadence');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000020','stripe',now()+interval '4 seconds',
 '[{"tier":"calendar","expires_at":"2099-01-01","source":"stripe","billing_period":"yearly","is_trial":true}]');
select public.test_assert((select count(*)=1 from public.subscriber_notice_delivery where kind='subscription'), 'resubscription and trial do not duplicate first-subscriber notice');

set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000020';
do $$ begin
  begin update public.users set subscription_billing_period='monthly' where id=auth.uid();
    raise exception 'Browser forged billing period'; exception when insufficient_privilege then null; end;
  begin perform public.claim_subscriber_notice();
    raise exception 'Browser claimed an admin email'; exception when insufficient_privilege then null; end;
  begin insert into public.subscriber_notice_delivery(user_id,kind) values(auth.uid(),'signup');
    raise exception 'Browser queued an admin email'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub='';
select public.test_assert(not has_table_privilege('authenticated','public.subscriber_notice_delivery','SELECT'), 'admin notice contents remain private');
delete from auth.users where id='00000000-0000-4000-8000-000000000020';
select public.test_assert(not exists(select 1 from public.subscriber_notice_delivery), 'account deletion removes its pending notices');

-- One due message is left for the concurrent claim test, never an actual send.
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000023','notice-concurrency@example.invalid');
insert into public.user_progress(user_id,current_tier,recommended_start_section)
values('00000000-0000-4000-8000-000000000023','apprentice','foundations');
update public.subscriber_notice_delivery set available_at=now()-interval '1 second';
