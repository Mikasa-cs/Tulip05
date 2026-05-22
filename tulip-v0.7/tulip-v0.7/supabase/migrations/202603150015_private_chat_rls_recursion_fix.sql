create or replace function public.is_chat_room_member(
  p_room_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_room_members crm
    where crm.room_id = p_room_id
      and crm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

grant execute on function public.is_chat_room_member(uuid, uuid) to authenticated;

drop policy if exists chat_rooms_read_visible on public.chat_rooms;
create policy chat_rooms_read_visible
on public.chat_rooms
for select
using (
  not is_private
  or public.is_admin(auth.uid())
  or created_by = auth.uid()
  or public.is_chat_room_member(id, auth.uid())
);

drop policy if exists chat_room_members_select_own_or_admin on public.chat_room_members;
create policy chat_room_members_select_own_or_admin
on public.chat_room_members
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or public.is_chat_room_member(room_id, auth.uid())
);

drop policy if exists chat_room_members_insert_own_or_admin on public.chat_room_members;
create policy chat_room_members_insert_own_or_admin
on public.chat_room_members
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.chat_rooms r
    where r.id = chat_room_members.room_id
      and r.created_by = auth.uid()
  )
);

drop policy if exists chat_room_members_delete_own_or_admin on public.chat_room_members;
create policy chat_room_members_delete_own_or_admin
on public.chat_room_members
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.chat_rooms r
    where r.id = chat_room_members.room_id
      and r.created_by = auth.uid()
  )
);

drop policy if exists chat_messages_select_room_members_or_admin on public.chat_messages;
create policy chat_messages_select_room_members_or_admin
on public.chat_messages
for select
using (
  public.is_admin(auth.uid())
  or public.is_chat_room_member(room_id, auth.uid())
);

drop policy if exists chat_messages_insert_room_members_or_admin on public.chat_messages;
create policy chat_messages_insert_room_members_or_admin
on public.chat_messages
for insert
with check (
  (auth.uid() = user_id or public.is_admin(auth.uid()))
  and (
    public.is_admin(auth.uid())
    or public.is_chat_room_member(room_id, auth.uid())
  )
);