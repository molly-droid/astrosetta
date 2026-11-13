-- Keep the completion signal tied to its authenticated owner, independently
-- of the legacy entity table's created_by ownership policy.
create or replace function public.notice_completed_signup()
returns trigger language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
  if new.recommended_start_section is null then return new; end if;
  if auth.uid() is not null and auth.uid()::text<>new.user_id and not public.is_admin() then return new; end if;
  select user_id into uid from public.subscriber_signup_watch where user_id::text=new.user_id;
  if uid is not null then perform public.queue_subscriber_notice(uid,'signup'); end if;
  return new;
end $$;

-- Complimentary access is not an existing paid subscription. Its first real
-- provider purchase should still be announced, even if the tier stays paid.
create or replace function public.notice_first_subscription()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (old.subscription_tier='free' or old.subscription_source is null
      or old.subscription_source not in ('stripe','apple','google') or old.subscription_admin_override)
    and new.subscription_tier in ('interpret','calendar')
    and new.subscription_source in ('stripe','apple','google')
    and not new.subscription_admin_override
    and exists(select 1 from public.billing_snapshots where user_id=new.id) then
    perform public.queue_subscriber_notice(new.id,'subscription');
  end if;
  return new;
end $$;
