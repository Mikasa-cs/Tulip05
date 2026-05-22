drop policy if exists chat_rooms_read_visible on public.chat_rooms;
create policy chat_rooms_read_visible
on public.chat_rooms
for select
using (
  not is_private
  or public.is_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.chat_room_members crm
    where crm.room_id = chat_rooms.id
      and crm.user_id = auth.uid()
  )
);

drop policy if exists chat_room_members_select_own_or_admin on public.chat_room_members;
create policy chat_room_members_select_own_or_admin
on public.chat_room_members
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.chat_room_members me
    where me.room_id = chat_room_members.room_id
      and me.user_id = auth.uid()
  )
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