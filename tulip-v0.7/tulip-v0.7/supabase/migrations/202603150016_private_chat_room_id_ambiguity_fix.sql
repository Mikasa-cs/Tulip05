create or replace function public.create_private_chat_with_member(
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_room_id uuid;
  pair_left text;
  pair_right text;
  room_slug text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_member_id is null then
    raise exception 'A member is required';
  end if;

  if current_user_id = p_member_id then
    raise exception 'Cannot create private chat with yourself';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_member_id
  ) then
    raise exception 'Selected member not found';
  end if;

  pair_left := least(current_user_id::text, p_member_id::text);
  pair_right := greatest(current_user_id::text, p_member_id::text);
  room_slug := format('dm:%s:%s', pair_left, pair_right);

  insert into public.chat_rooms (slug, name, description, created_by, is_private)
  values (
    room_slug,
    'Private chat',
    '1:1 private conversation',
    current_user_id,
    true
  )
  on conflict (slug) do update
    set updated_at = timezone('utc', now())
  returning id into v_room_id;

  insert into public.chat_room_members (room_id, user_id)
  values
    (v_room_id, current_user_id),
    (v_room_id, p_member_id)
  on conflict (room_id, user_id) do nothing;

  return v_room_id;
end;
$$;

grant execute on function public.create_private_chat_with_member(uuid) to authenticated;