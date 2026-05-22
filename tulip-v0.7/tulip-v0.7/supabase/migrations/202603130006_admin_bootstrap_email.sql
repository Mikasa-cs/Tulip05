create table if not exists public.admin_bootstrap_emails (
  email text primary key,
  created_at timestamptz not null default timezone('utc', now())
);

grant select on table public.admin_bootstrap_emails to authenticated;

insert into public.admin_bootstrap_emails (email)
values ('aryan.singhh04@gmail.com')
on conflict (email) do nothing;

create or replace function public.apply_admin_bootstrap_for_email(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_users (user_id, is_active)
  select p.id, true
  from public.profiles p
  where lower(p.email) = lower(target_email)
  on conflict (user_id) do update
    set is_active = true,
        updated_at = timezone('utc', now());

  update public.profiles
  set role = 'admin'
  where lower(email) = lower(target_email);
end;
$$;

create or replace function public.bootstrap_admin_from_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.admin_bootstrap_emails abe
    where lower(abe.email) = lower(new.email)
  ) then
    perform public.apply_admin_bootstrap_for_email(new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_bootstrap_admin_trigger on public.profiles;
create trigger profiles_bootstrap_admin_trigger
after insert on public.profiles
for each row execute function public.bootstrap_admin_from_profile_insert();

select public.apply_admin_bootstrap_for_email('aryan.singhh04@gmail.com');
