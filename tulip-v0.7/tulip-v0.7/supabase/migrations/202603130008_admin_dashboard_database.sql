create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_user_id);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

grant select, insert on table public.admin_audit_logs to authenticated;

alter table public.admin_audit_logs enable row level security;

drop policy if exists admin_audit_logs_admin_select on public.admin_audit_logs;
create policy admin_audit_logs_admin_select
on public.admin_audit_logs
for select
using (public.is_admin(auth.uid()));

drop policy if exists admin_audit_logs_admin_insert on public.admin_audit_logs;
create policy admin_audit_logs_admin_insert
on public.admin_audit_logs
for insert
with check (public.is_admin(auth.uid()));

create or replace function public.admin_dashboard_metrics()
returns table (
  total_users bigint,
  total_products bigint,
  total_orders bigint,
  total_revenue numeric,
  processing_orders bigint,
  shipped_orders bigint,
  out_for_delivery_orders bigint,
  delivered_orders bigint,
  cancelled_orders bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.products),
    (select count(*) from public.orders),
    (select coalesce(sum(total_amount), 0) from public.orders),
    (select count(*) from public.orders where status = 'processing'),
    (select count(*) from public.orders where status = 'shipped'),
    (select count(*) from public.orders where status = 'out_for_delivery'),
    (select count(*) from public.orders where status = 'delivered'),
    (select count(*) from public.orders where status = 'cancelled');
end;
$$;

create or replace function public.admin_recent_orders(limit_count integer default 20)
returns table (
  id uuid,
  customer text,
  email text,
  amount numeric,
  status public.order_status,
  created_at timestamptz,
  items integer,
  address text,
  city text,
  pincode text,
  product text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    o.id,
    coalesce(p.full_name, split_part(p.email, '@', 1)) as customer,
    p.email,
    o.total_amount as amount,
    o.status,
    o.created_at,
    coalesce((select sum(oi.quantity)::integer from public.order_items oi where oi.order_id = o.id), 0) as items,
    o.shipping_address as address,
    o.shipping_city as city,
    o.shipping_pincode as pincode,
    coalesce((
      select oi.product_name
      from public.order_items oi
      where oi.order_id = o.id
      order by oi.created_at asc
      limit 1
    ), '—') as product
  from public.orders o
  join public.profiles p on p.id = o.user_id
  order by o.created_at desc
  limit greatest(limit_count, 1);
end;
$$;

create or replace function public.admin_top_products(limit_count integer default 10)
returns table (
  product_id text,
  name text,
  brand text,
  image_url text,
  rating numeric,
  quantity_sold bigint,
  revenue numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    p.id as product_id,
    p.name,
    p.brand,
    p.image_url,
    p.rating,
    coalesce(sum(oi.quantity), 0) as quantity_sold,
    coalesce(sum(oi.quantity * oi.unit_price), 0) as revenue
  from public.products p
  left join public.order_items oi on oi.product_id = p.id
  group by p.id, p.name, p.brand, p.image_url, p.rating
  order by quantity_sold desc, revenue desc
  limit greatest(limit_count, 1);
end;
$$;

create or replace function public.admin_update_order_status(
  target_order_id uuid,
  next_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  updated_order public.orders;
begin
  if actor_id is null or not public.is_admin(actor_id) then
    raise exception 'Admin access required';
  end if;

  update public.orders
  set status = next_status,
      updated_at = timezone('utc', now())
  where id = target_order_id
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'Order not found';
  end if;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    actor_id,
    'order_status_updated',
    'order',
    updated_order.id::text,
    jsonb_build_object('status', updated_order.status)
  );

  return updated_order;
end;
$$;

grant execute on function public.admin_dashboard_metrics() to authenticated;
grant execute on function public.admin_recent_orders(integer) to authenticated;
grant execute on function public.admin_top_products(integer) to authenticated;
grant execute on function public.admin_update_order_status(uuid, public.order_status) to authenticated;
