do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from public.profiles
  where lower(email) = lower('aryan.singhh04@gmail.com')
  limit 1;

  if target_user_id is null then
    raise notice 'No profile found for aryan.singhh04@gmail.com. Sign up first, then run this migration SQL manually.';
    return;
  end if;

  insert into public.admin_users (user_id, is_active)
  values (target_user_id, true)
  on conflict (user_id)
  do update set
    is_active = true,
    updated_at = timezone('utc', now());

  update public.profiles
  set role = 'admin'
  where id = target_user_id;
end;
$$;
