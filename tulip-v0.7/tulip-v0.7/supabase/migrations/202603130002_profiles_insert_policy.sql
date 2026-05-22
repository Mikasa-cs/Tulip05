grant usage on schema public to anon, authenticated;

grant select on table public.products to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.addresses to authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;
grant select, insert, delete on table public.wishlist_items to authenticated;
grant select, insert, update, delete on table public.orders to authenticated;
grant select, insert, update, delete on table public.order_items to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_insert_own_or_admin on public.profiles;
create policy profiles_insert_own_or_admin
on public.profiles
for insert
with check (
  auth.uid() = id
  or public.is_admin(auth.uid())
);
