-- Catalog is currently served from frontend JSON, so product rows may not exist in DB yet.
-- Keep cart/wishlist persistence working by removing hard FK dependency on public.products.

alter table if exists public.cart_items
  drop constraint if exists cart_items_product_id_fkey;

alter table if exists public.wishlist_items
  drop constraint if exists wishlist_items_product_id_fkey;
