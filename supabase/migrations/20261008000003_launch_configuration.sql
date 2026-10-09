-- Null end date preserves beta. Set an explicit cutoff only when approved.
create table public.launch_configuration (
  id boolean primary key default true check (id),
  founding_ends_at timestamptz
);
insert into public.launch_configuration(id, founding_ends_at) values (true, null);
alter table public.launch_configuration enable row level security;
revoke all on public.launch_configuration from public, anon, authenticated;
grant select, update on public.launch_configuration to service_role;

create function public.founding_eligible(p_created_at timestamptz)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select founding_ends_at is null or p_created_at <= founding_ends_at
    from public.launch_configuration where id), false);
$$;
revoke all on function public.founding_eligible(timestamptz) from public, anon, authenticated;
grant execute on function public.founding_eligible(timestamptz) to service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.users(id,email,full_name,is_founding_member)
  values(new.id,new.email,
    coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),
    public.founding_eligible(now()))
  on conflict(id) do nothing;
  return new;
end;
$$;

-- Do not change existing cohorts. Repair only null imported values using their
-- original signup date, not the date of their next login.
create or replace function public.refresh_billing_access(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare account record;
begin
  if current_setting('role', true) not in ('service_role', 'none')
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select role, subscription_admin_override into account from public.users where id=p_user_id for update;
  if not found then return; end if;
  update public.users set is_founding_member=public.founding_eligible(created_date)
    where id=p_user_id and is_founding_member is null;
  if account.role='admin' or account.subscription_admin_override then return; end if;
  perform public.seed_legacy_billing(p_user_id);
  perform public.project_billing_access(p_user_id);
end;
$$;
