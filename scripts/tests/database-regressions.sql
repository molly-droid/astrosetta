insert into auth.users(id, email) values
 ('00000000-0000-4000-8000-000000000001', 'one@example.invalid'),
 ('00000000-0000-4000-8000-000000000002', 'two@example.invalid'),
 ('00000000-0000-4000-8000-000000000003', 'admin@example.invalid');
update public.users set role = 'admin' where id = '00000000-0000-4000-8000-000000000003';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
update public.users set display_name = 'Allowed profile edit', founding_tier_preference = 'interpret'
 where id = auth.uid();
select public.test_assert((select display_name = 'Allowed profile edit' from public.users where id = auth.uid()), 'profile edit allowed');
do $$
declare assignment text;
begin
  foreach assignment in array array[
    'role = ''admin''', 'subscription_tier = ''calendar''', 'subscription_expires = ''2099-01-01''',
    'subscription_source = ''apple''', 'stripe_customer_id = ''cus_other''',
    'stripe_subscription_id = ''sub_other''', 'iap_transaction_id = ''other''',
    'is_founding_member = false', 'email = ''other@example.invalid''',
    'subscription_admin_override = true'
  ] loop
    begin
      execute 'update public.users set ' || assignment || ' where id = auth.uid()';
      raise exception 'Sensitive field update was allowed: %', assignment;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    insert into public.llm_usage_log(user_id,date_key,call_count,created_by_id)
      values ('00000000-0000-4000-8000-000000000002','2026-10-08',-100,auth.uid());
    raise exception 'Spoofed negative usage was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.increment_llm_usage(auth.uid()::text, '2026-10-08', -1, 'attack');
    raise exception 'Client quota RPC allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.refresh_billing_access('00000000-0000-4000-8000-000000000002');
    raise exception 'Cross-user billing refresh allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Existing admins retain the tier-testing UI, service operations/imports work.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
update public.users set subscription_tier = 'calendar' where id = '00000000-0000-4000-8000-000000000001';
reset role;
set role service_role;
update public.users set subscription_tier = 'interpret', subscription_source = 'stripe', subscription_expires = '2099-01-01'
 where id = '00000000-0000-4000-8000-000000000001';
select public.test_assert((public.increment_llm_usage('00000000-0000-4000-8000-000000000001','2026-10-08',1,'test')->>'allowed')::boolean, 'first usage allowed');
select public.test_assert(not (public.increment_llm_usage('00000000-0000-4000-8000-000000000001','2026-10-08',1,'test')->>'allowed')::boolean, 'second usage denied');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
select public.test_assert((select count(*)=1 from public.llm_usage_log), 'owner usage read preserved');
do $$ begin
  begin
    update public.llm_usage_log set call_count = 0 where created_by_id = auth.uid();
    raise exception 'Usage reset was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.llm_usage_log where created_by_id = auth.uid();
    raise exception 'Usage delete was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.apply_billing_snapshot(auth.uid(), 'stripe', now(), '[]');
    raise exception 'Client billing write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Seeded/imported Stripe access survives the first empty Apple snapshot.
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','revenuecat','2026-10-08T01:00:00Z','[]');
select public.test_assert((select subscription_tier='interpret' and subscription_source='stripe' from public.users where id='00000000-0000-4000-8000-000000000001'), 'legacy Stripe survives RC expiration');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','revenuecat','2026-10-08T02:00:00Z',
 '[{"tier":"calendar","expires_at":"2090-01-01","source":"apple"}]');
select public.test_assert((select subscription_tier='calendar' and subscription_expires='2090-01-01' from public.users where id='00000000-0000-4000-8000-000000000001'), 'Premium wins without inheriting Core longer expiry');
-- Late/duplicate responses cannot replace the newer snapshot.
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','revenuecat','2026-10-08T01:00:00Z','[]');
select public.test_assert((select subscription_tier='calendar' from public.users where id='00000000-0000-4000-8000-000000000001'), 'stale snapshot ignored');
-- Expiring Apple must retain Stripe; expiring Stripe must retain Apple.
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','revenuecat','2026-10-08T03:00:00Z','[]');
select public.test_assert((select subscription_tier='interpret' from public.users where id='00000000-0000-4000-8000-000000000001'), 'Apple expiration preserves Stripe');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','revenuecat','2026-10-08T04:00:00Z',
 '[{"tier":"calendar","expires_at":"2090-01-01","source":"apple"}]');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','stripe','2026-10-08T05:00:00Z','[]');
select public.test_assert((select subscription_tier='calendar' from public.users where id='00000000-0000-4000-8000-000000000001'), 'Stripe deletion preserves Apple');
-- A later read falls back from expired Premium to active Core without waiting
-- for the provider's expiration webhook.
update public.billing_snapshots set entitlements='[{"tier":"calendar","expires_at":"2000-01-01","source":"apple"},{"tier":"interpret","expires_at":"2099-01-01","source":"google"}]'
 where user_id='00000000-0000-4000-8000-000000000001' and provider='revenuecat';
set role authenticated;
select public.refresh_billing_access(auth.uid());
select public.test_assert((select subscription_tier='interpret' and subscription_source='google' from public.users where id=auth.uid()), 'expiry falls back to Core');
reset role;
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000001','revenuecat','2026-10-08T06:00:00Z','[]');
select public.test_assert((select subscription_tier='free' from public.users where id='00000000-0000-4000-8000-000000000001'), 'all expired becomes Free');

-- An account imported after migration, before its first provider sync.
update public.users set subscription_tier='calendar', subscription_source='apple', subscription_expires='2099-01-01'
 where id='00000000-0000-4000-8000-000000000002';
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000002','stripe','2026-10-08T01:00:00Z','[]');
select public.test_assert((select subscription_tier='calendar' from public.users where id='00000000-0000-4000-8000-000000000002'), 'post-migration import preserved');
-- Imported null founding flags are repaired by the trusted refresh, not a
-- browser update. Explicit false flags are never promoted.
update public.users set is_founding_member=null where id='00000000-0000-4000-8000-000000000002';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select public.refresh_billing_access(auth.uid());
select public.test_assert((select is_founding_member from public.users where id=auth.uid()), 'legacy null founding repair');
reset role;
update public.users set is_founding_member=false where id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select public.refresh_billing_access(auth.uid());
select public.test_assert((select not is_founding_member from public.users where id=auth.uid()), 'explicit nonfounding preserved');
-- Admin preview of a paid learner survives both browser and AI refreshes.
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
update public.users set subscription_tier='free', subscription_expires=null
 where id='00000000-0000-4000-8000-000000000002';
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select public.refresh_billing_access(auth.uid());
select public.test_assert((select subscription_tier='free' and subscription_admin_override from public.users where id=auth.uid()), 'learner admin preview survives read');
reset role;
set role service_role;
select public.refresh_billing_access('00000000-0000-4000-8000-000000000002');
select public.test_assert((select subscription_tier='free' from public.users where id='00000000-0000-4000-8000-000000000002'), 'learner admin preview survives AI');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000002','stripe','2026-10-08T00:00:00Z','[]');
select public.test_assert((select subscription_admin_override from public.users where id='00000000-0000-4000-8000-000000000002'), 'stale snapshot does not reset preview');
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000002','stripe','2026-10-08T02:00:00Z','[]');
select public.test_assert((select subscription_tier='calendar' and not subscription_admin_override from public.users where id='00000000-0000-4000-8000-000000000002'), 'new provider sync restores paid access');
reset role;
-- Lower/negative historical counters cannot cancel genuine usage.
insert into public.llm_usage_log(user_id,date_key,call_count,created_by_id) values
 ('00000000-0000-4000-8000-000000000001','duplicates',2,'00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000001','duplicates',2,'00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000001','duplicates',-100,'00000000-0000-4000-8000-000000000001');
select public.test_assert(not (public.increment_llm_usage('00000000-0000-4000-8000-000000000001','duplicates',4)->>'allowed')::boolean, 'duplicate and negative historical rows handled');
select public.test_assert((public.increment_llm_usage('00000000-0000-4000-8000-000000000001','duplicates',-1)->>'allowed')::boolean, 'unlimited admin logging retained');
delete from auth.users where id='00000000-0000-4000-8000-000000000002';
select public.test_assert(not exists(select 1 from public.billing_snapshots where user_id='00000000-0000-4000-8000-000000000002'), 'account deletion cascades billing snapshots');
