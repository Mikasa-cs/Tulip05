alter table public.chat_rooms
  add column if not exists is_private boolean not null default false;

create index if not exists chat_rooms_private_created_idx
  on public.chat_rooms (is_private, created_at desc);

drop policy if exists chat_rooms_public_read on public.chat_rooms;
drop policy if exists chat_rooms_read_visible on public.chat_rooms;
create policy chat_rooms_read_visible
on public.chat_rooms
for select
using (
  not is_private
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.chat_room_members crm
    where crm.room_id = chat_rooms.id
      and crm.user_id = auth.uid()
  )
);

create or replace function public.search_chat_members(
  p_query text default '',
  p_limit integer default 8
)
returns table (
  user_id uuid,
  display_name text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_query text := lower(trim(coalesce(p_query, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 8), 30));
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    p.id as user_id,
    coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)) as display_name,
    p.email
  from public.profiles p
  where p.id <> current_user_id
    and (
      normalized_query = ''
      or lower(coalesce(p.full_name, '')) like '%' || normalized_query || '%'
      or lower(p.email) like '%' || normalized_query || '%'
    )
  order by
    case
      when normalized_query <> '' and lower(p.email) like normalized_query || '%' then 0
      when normalized_query <> '' and lower(coalesce(p.full_name, '')) like normalized_query || '%' then 1
      else 2
    end,
    p.joined_at desc
  limit safe_limit;
end;
$$;

grant execute on function public.search_chat_members(text, integer) to authenticated;

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
  room_id uuid;
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
  returning id into room_id;

  insert into public.chat_room_members (room_id, user_id)
  values
    (room_id, current_user_id),
    (room_id, p_member_id)
  on conflict (room_id, user_id) do nothing;

  return room_id;
end;
$$;

grant execute on function public.create_private_chat_with_member(uuid) to authenticated;

create or replace function public.list_my_chat_rooms()
returns table (
  room_id uuid,
  slug text,
  room_name text,
  description text,
  is_private boolean,
  display_name text,
  peer_user_id uuid,
  peer_name text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with my_rooms as (
    select
      r.id,
      r.slug,
      r.name,
      r.description,
      r.is_private,
      r.created_at,
      r.updated_at
    from public.chat_rooms r
    join public.chat_room_members crm
      on crm.room_id = r.id
    where crm.user_id = auth.uid()
  ),
  last_messages as (
    select
      cm.room_id,
      max(cm.created_at) as last_message_at
    from public.chat_messages cm
    join my_rooms mr on mr.id = cm.room_id
    group by cm.room_id
  )
  select
    mr.id as room_id,
    mr.slug,
    mr.name as room_name,
    mr.description,
    mr.is_private,
    case
      when mr.is_private then coalesce(peer.display_name, 'Private chat')
      else mr.name
    end as display_name,
    peer.user_id as peer_user_id,
    peer.display_name as peer_name,
    lm.last_message_at
  from my_rooms mr
  left join last_messages lm
    on lm.room_id = mr.id
  left join lateral (
    select
      p.id as user_id,
      coalesce(nullif(trim(p.full_name), ''), split_part(p.email, '@', 1)) as display_name
    from public.chat_room_members crm2
    join public.profiles p
      on p.id = crm2.user_id
    where crm2.room_id = mr.id
      and crm2.user_id <> auth.uid()
    order by crm2.joined_at asc
    limit 1
  ) peer on true
  order by coalesce(lm.last_message_at, mr.updated_at, mr.created_at) desc;
$$;

grant execute on function public.list_my_chat_rooms() to authenticated;