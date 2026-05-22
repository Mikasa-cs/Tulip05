create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('customer', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.order_status as enum ('processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  gender text,
  avatar_url text,
  role public.app_role not null default 'customer',
  joined_at timestamptz not null default timezone('utc', now()),
  address text,
  city text,
  pincode text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  address text not null,
  city text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists addresses_single_default_per_user_idx
  on public.addresses (user_id)
  where is_default;

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  image_url text not null,
  hover_image_url text,
  gender text not null,
  master_category text not null,
  sub_category text not null,
  article_type text not null,
  base_colour text,
  season text,
  year integer,
  usage text,
  category text not null,
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  reviews integer not null default 0 check (reviews >= 0),
  is_new boolean not null default false,
  is_trending boolean not null default false,
  is_ai_pick boolean not null default false,
  colors text[] not null default '{}',
  sizes text[] not null default '{}',
  material text,
  fit text,
  skin_type text,
  notable_effects text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_gender_idx on public.products (gender);
create index if not exists products_master_category_idx on public.products (master_category);
create index if not exists products_price_idx on public.products (price);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  selected_size text not null default '',
  selected_color text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id, selected_size, selected_color)
);

create index if not exists cart_items_user_id_idx on public.cart_items (user_id);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);

create index if not exists wishlist_items_user_id_idx on public.wishlist_items (user_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'processing',
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  currency text not null default 'INR',
  shipping_name text not null,
  shipping_email text not null,
  shipping_phone text,
  shipping_address text not null,
  shipping_city text not null,
  shipping_pincode text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  selected_size text not null default '',
  selected_color text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

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
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_name text;
  derived_gender text;
begin
  derived_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  derived_gender := nullif(trim(new.raw_user_meta_data ->> 'gender'), '');

  insert into public.profiles (id, email, full_name, gender)
  values (new.id, new.email, derived_name, derived_gender)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        gender = coalesce(excluded.gender, public.profiles.gender);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_order_from_cart(
  p_shipping_name text,
  p_shipping_email text,
  p_shipping_phone text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_pincode text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_order_id uuid;
  cart_total numeric(12,2);
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(sum(p.price * c.quantity), 0)
  into cart_total
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = current_user_id;

  if cart_total <= 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.orders (
    user_id,
    total_amount,
    shipping_name,
    shipping_email,
    shipping_phone,
    shipping_address,
    shipping_city,
    shipping_pincode,
    notes
  )
  values (
    current_user_id,
    cart_total,
    p_shipping_name,
    p_shipping_email,
    p_shipping_phone,
    p_shipping_address,
    p_shipping_city,
    p_shipping_pincode,
    p_notes
  )
  returning id into created_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    selected_size,
    selected_color
  )
  select
    created_order_id,
    p.id,
    p.name,
    p.price,
    c.quantity,
    c.selected_size,
    c.selected_color
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = current_user_id;

  delete from public.cart_items where user_id = current_user_id;

  return created_order_id;
end;
$$;

grant execute on function public.create_order_from_cart(text, text, text, text, text, text, text) to authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles
for update
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
)
with check (
  auth.uid() = id
  or public.is_admin(auth.uid())
);

drop policy if exists addresses_select_own_or_admin on public.addresses;
create policy addresses_select_own_or_admin
on public.addresses
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists addresses_insert_own_or_admin on public.addresses;
create policy addresses_insert_own_or_admin
on public.addresses
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists addresses_update_own_or_admin on public.addresses;
create policy addresses_update_own_or_admin
on public.addresses
for update
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
)
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists addresses_delete_own_or_admin on public.addresses;
create policy addresses_delete_own_or_admin
on public.addresses
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products
for select
using (true);

drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert
on public.products
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists products_admin_update on public.products;
create policy products_admin_update
on public.products
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete
on public.products
for delete
using (public.is_admin(auth.uid()));

drop policy if exists cart_select_own_or_admin on public.cart_items;
create policy cart_select_own_or_admin
on public.cart_items
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists cart_insert_own_or_admin on public.cart_items;
create policy cart_insert_own_or_admin
on public.cart_items
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists cart_update_own_or_admin on public.cart_items;
create policy cart_update_own_or_admin
on public.cart_items
for update
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
)
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists cart_delete_own_or_admin on public.cart_items;
create policy cart_delete_own_or_admin
on public.cart_items
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists wishlist_select_own_or_admin on public.wishlist_items;
create policy wishlist_select_own_or_admin
on public.wishlist_items
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists wishlist_insert_own_or_admin on public.wishlist_items;
create policy wishlist_insert_own_or_admin
on public.wishlist_items
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists wishlist_delete_own_or_admin on public.wishlist_items;
create policy wishlist_delete_own_or_admin
on public.wishlist_items
for delete
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin
on public.orders
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists orders_insert_own_or_admin on public.orders;
create policy orders_insert_own_or_admin
on public.orders
for insert
with check (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update
on public.orders
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete
on public.orders
for delete
using (public.is_admin(auth.uid()));

drop policy if exists order_items_select_own_or_admin on public.order_items;
create policy order_items_select_own_or_admin
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists order_items_insert_own_or_admin on public.order_items;
create policy order_items_insert_own_or_admin
on public.order_items
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.user_id = auth.uid()
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists order_items_admin_update on public.order_items;
create policy order_items_admin_update
on public.order_items
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists order_items_admin_delete on public.order_items;
create policy order_items_admin_delete
on public.order_items
for delete
using (public.is_admin(auth.uid()));
