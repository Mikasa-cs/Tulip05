do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower('aryan.singhh04@gmail.com')
  limit 1;

  if target_user_id is null then
    raise notice 'Skipping admin bootstrap for aryan.singhh04@gmail.com because auth user does not exist.';
    return;
  end if;

    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
    where id = target_user_id;

  insert into public.profiles (id, email, full_name, role)
  values (target_user_id, 'aryan.singhh04@gmail.com', 'Aryan Singh', 'admin')
  on conflict (id) do update
    set email = excluded.email,
        role = 'admin';

  insert into public.admin_users (user_id, is_active)
  values (target_user_id, true)
  on conflict (user_id) do update
    set is_active = true,
        updated_at = timezone('utc', now());
end;
$$;
