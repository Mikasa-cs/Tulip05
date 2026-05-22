do $$
begin
  create type public.chat_message_type as enum ('text', 'product_share', 'review');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (room_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_type public.chat_message_type not null default 'text',
  content text not null default '',
  message_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  review_text text not null default '' check (char_length(review_text) <= 1200),
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, user_id)
);

create index if not exists chat_rooms_slug_idx
  on public.chat_rooms (slug);

create index if not exists chat_room_members_user_room_idx
  on public.chat_room_members (user_id, room_id);

create index if not exists chat_messages_room_time_idx
  on public.chat_messages (room_id, created_at asc);

create index if not exists chat_messages_user_time_idx
  on public.chat_messages (user_id, created_at desc);

create index if not exists product_reviews_product_updated_idx
  on public.product_reviews (product_id, updated_at desc);

create index if not exists product_reviews_user_updated_idx
  on public.product_reviews (user_id, updated_at desc);

drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at
before update on public.chat_rooms
for each row execute function public.set_updated_at();

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
before update on public.product_reviews
for each row execute function public.set_updated_at();

create or replace function public.join_community_chat()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  community_room_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.chat_rooms (slug, name, description, created_by)
  values (
    'community',
    'Tulip Community',
    'Share products, ask style choices, and post reviews.',
    current_user_id
  )
  on conflict (slug) do update
    set name = excluded.name,
        description = excluded.description
  returning id into community_room_id;

  insert into public.chat_room_members (room_id, user_id)
  values (community_room_id, current_user_id)
  on conflict (room_id, user_id) do nothing;

  return community_room_id;
end;
$$;

grant execute on function public.join_community_chat() to authenticated;

grant select on table public.chat_rooms to anon, authenticated;
grant select, insert, delete on table public.chat_room_members to authenticated;
grant select, insert, delete on table public.chat_messages to authenticated;
grant select on table public.product_reviews to anon, authenticated;
grant insert, update, delete on table public.product_reviews to authenticated;

alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.product_reviews enable row level security;

drop policy if exists chat_rooms_public_read on public.chat_rooms;
create policy chat_rooms_public_read
on public.chat_rooms
for select
using (true);

drop policy if exists chat_rooms_admin_insert on public.chat_rooms;
create policy chat_rooms_admin_insert
on public.chat_rooms
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists chat_rooms_admin_update on public.chat_rooms;
create policy chat_rooms_admin_update
on public.chat_rooms
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists chat_rooms_admin_delete on public.chat_rooms;
create policy chat_rooms_admin_delete
on public.chat_rooms
for delete
using (public.is_admin(auth.uid()));

drop policy if exists chat_room_members_select_own_or_admin on public.chat_room_members;
create policy chat_room_members_select_own_or_admin
on public.chat_room_members
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists chat_room_members_insert_own_or_admin on public.chat_room_members;
create policy chat_room_members_insert_own_or_admin
on public.chat_room_members
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists chat_room_members_delete_own_or_admin on public.chat_room_members;
create policy chat_room_members_delete_own_or_admin
on public.chat_room_members
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists chat_messages_select_room_members_or_admin on public.chat_messages;
create policy chat_messages_select_room_members_or_admin
on public.chat_messages
for select
using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.chat_room_members crm
    where crm.room_id = chat_messages.room_id
      and crm.user_id = auth.uid()
  )
);

drop policy if exists chat_messages_insert_room_members_or_admin on public.chat_messages;
create policy chat_messages_insert_room_members_or_admin
on public.chat_messages
for insert
with check (
  (auth.uid() = user_id or public.is_admin(auth.uid()))
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1
      from public.chat_room_members crm
      where crm.room_id = chat_messages.room_id
        and crm.user_id = auth.uid()
    )
  )
);

drop policy if exists chat_messages_delete_own_or_admin on public.chat_messages;
create policy chat_messages_delete_own_or_admin
on public.chat_messages
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists product_reviews_public_read on public.product_reviews;
create policy product_reviews_public_read
on public.product_reviews
for select
using (true);

drop policy if exists product_reviews_insert_own_or_admin on public.product_reviews;
create policy product_reviews_insert_own_or_admin
on public.product_reviews
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists product_reviews_update_own_or_admin on public.product_reviews;
create policy product_reviews_update_own_or_admin
on public.product_reviews
for update
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
)
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists product_reviews_delete_own_or_admin on public.product_reviews;
create policy product_reviews_delete_own_or_admin
on public.product_reviews
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end
$$;