-- Catalog is currently served from frontend JSON, so product rows may not exist in DB yet.
-- Keep order placement working by removing hard FK dependency on public.products.

alter table if exists public.order_items
  drop constraint if exists order_items_product_id_fkey;
