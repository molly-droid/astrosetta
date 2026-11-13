insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000010','beta-trial@example.invalid'),('00000000-0000-4000-8000-000000000011','new-not-beta@example.invalid');
insert into public.beta_trial_members(user_id) values('00000000-0000-4000-8000-000000000010');
update public.users set is_founding_member=true,subscription_admin_override=false where id='00000000-0000-4000-8000-000000000010';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000010';
select public.test_assert((select count(*)=1 from public.beta_trial_members),'member sees their own offer');
do $$ begin
  begin
    update public.beta_trial_members set redeemed_at=null;
    raise exception 'Client changed trial membership';
  exception when insufficient_privilege then null; end;
  begin
    update public.users set subscription_is_trial=true where id=auth.uid();
    raise exception 'Client changed trial authority';
  exception when insufficient_privilege then null; end;
  begin
    perform public.redeem_beta_trial(auth.uid(),'sub_forged');
    raise exception 'Client redeemed trial';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
select public.test_assert((select count(*)=0 from public.beta_trial_members),'nonmember cannot read other cohort members');
reset role;
select public.test_assert(public.redeem_beta_trial('00000000-0000-4000-8000-000000000010','sub_first')='sub_first','first checkout claims offer');
select public.test_assert(public.redeem_beta_trial('00000000-0000-4000-8000-000000000010','sub_duplicate')='sub_first','second checkout cannot replace winner');
-- An unpaid trial is genuine access but cannot burn founding-rate eligibility.
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000010','stripe',now(),
 '[{"tier":"calendar","expires_at":"2099-01-01","source":"stripe","is_trial":true}]');
select public.test_assert((select subscription_tier='calendar' and subscription_is_trial from public.users where id='00000000-0000-4000-8000-000000000010'),'trial grants Premium through normal billing projection');
-- Simulate time passing beyond trial expiry, then a read refresh with no webhook.
update public.billing_snapshots set entitlements='[{"tier":"calendar","expires_at":"2000-01-01","source":"stripe","is_trial":true}]' where user_id='00000000-0000-4000-8000-000000000010';
update public.users set subscription_expires='2000-01-01' where id='00000000-0000-4000-8000-000000000010';
select public.refresh_billing_access('00000000-0000-4000-8000-000000000010');
select public.test_assert((select subscription_tier='free' and not subscription_is_trial and founding_rate_forfeited_at is null from public.users where id='00000000-0000-4000-8000-000000000010'),'unpaid trial expiry returns Free and preserves founding price');
-- Conversion to a paid subscription clears the trial marker and normal lapse policy applies.
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000010','stripe',now()+interval '1 second',
 '[{"tier":"calendar","expires_at":"2099-01-01","source":"stripe"}]');
select public.test_assert((select not subscription_is_trial from public.users where id='00000000-0000-4000-8000-000000000010'),'paid conversion clears trial marker');
update public.users set subscription_expires='2000-01-01' where id='00000000-0000-4000-8000-000000000010';
select public.apply_billing_snapshot('00000000-0000-4000-8000-000000000010','stripe',now()+interval '2 seconds','[]');
select public.test_assert((select founding_rate_forfeited_at is not null from public.users where id='00000000-0000-4000-8000-000000000010'),'paid lapse still forfeits founding rate');
delete from auth.users where id in('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011');
select public.test_assert(not exists(select 1 from public.beta_trial_members where user_id='00000000-0000-4000-8000-000000000010'),'deletion removes trial cohort record');
