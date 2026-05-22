create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_users_user_id_idx on public.admin_users (user_id);

grant select, insert, update, delete on table public.admin_users to authenticated;

create or replace function public.sync_profile_role_from_admin_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  should_be_admin boolean;
begin
  target_user_id := coalesce(new.user_id, old.user_id);

  should_be_admin := exists (
    select 1
    from public.admin_users au
    where au.user_id = target_user_id
      and au.is_active = true
  );

  update public.profiles
  set role = case
    when should_be_admin then 'admin'::public.app_role
    else 'customer'::public.app_role
  end
  where id = target_user_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists admin_users_sync_profile_role on public.admin_users;
create trigger admin_users_sync_profile_role
after insert or update or delete on public.admin_users
for each row execute function public.sync_profile_role_from_admin_users();

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  )
  or exists (
    select 1
    from public.admin_users au
    where au.user_id = p_user_id
      and au.is_active = true
  );
$$;

alter table public.admin_users enable row level security;

drop policy if exists admin_users_select_self_or_admin on public.admin_users;
create policy admin_users_select_self_or_admin
on public.admin_users
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists admin_users_admin_insert on public.admin_users;
create policy admin_users_admin_insert
on public.admin_users
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists admin_users_admin_update on public.admin_users;
create policy admin_users_admin_update
on public.admin_users
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists admin_users_admin_delete on public.admin_users;
create policy admin_users_admin_delete
on public.admin_users
for delete
using (public.is_admin(auth.uid()));

create or replace function public.bootstrap_first_admin(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  active_admin_count integer;
begin
  select count(*) into active_admin_count
  from public.profiles
  where role = 'admin';

  if active_admin_count > 0 then
    raise exception 'Admin already exists. Use promote_admin_by_email as an admin.';
  end if;

  select id into target_user_id
  from public.profiles
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No profile found for email %', target_email;
  end if;

  insert into public.admin_users (user_id, is_active)
  values (target_user_id, true)
  on conflict (user_id) do update
    set is_active = true,
        updated_at = timezone('utc', now());

  update public.profiles
  set role = 'admin'
  where id = target_user_id;

  return target_user_id;
end;
$$;

create or replace function public.promote_admin_by_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  target_user_id uuid;
begin
  if requester_id is null or not public.is_admin(requester_id) then
    raise exception 'Only admins can promote users';
  end if;

  select id into target_user_id
  from public.profiles
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No profile found for email %', target_email;
  end if;

  insert into public.admin_users (user_id, is_active)
  values (target_user_id, true)
  on conflict (user_id) do update
    set is_active = true,
        updated_at = timezone('utc', now());

  update public.profiles
  set role = 'admin'
  where id = target_user_id;

  return target_user_id;
end;
$$;

grant execute on function public.promote_admin_by_email(text) to authenticated;

revoke all on function public.bootstrap_first_admin(text) from public;
revoke all on function public.bootstrap_first_admin(text) from anon;
revoke all on function public.bootstrap_first_admin(text) from authenticated;
