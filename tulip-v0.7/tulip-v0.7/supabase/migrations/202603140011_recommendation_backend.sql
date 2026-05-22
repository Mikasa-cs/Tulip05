-- Recommendation backend schema: telemetry + cached recommendation rows

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  event_type text not null check (event_type in ('view_product', 'add_to_cart', 'add_to_wishlist')),
  event_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists recommendation_events_user_time_idx
  on public.recommendation_events (user_id, occurred_at desc)
  where user_id is not null;

create index if not exists recommendation_events_product_time_idx
  on public.recommendation_events (product_id, occurred_at desc);

create index if not exists recommendation_events_type_time_idx
  on public.recommendation_events (event_type, occurred_at desc);

create table if not exists public.user_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recommendation_type text not null check (recommendation_type in ('for_you', 'wishlist_inspired', 'similar_products', 'trending')),
  source_product_id text references public.products(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  score numeric(10,6) not null default 0,
  rank_position integer not null check (rank_position > 0),
  reason text,
  model_version text not null default 'hybrid-v1',
  computed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_recommendations_unique_item_idx
  on public.user_recommendations (user_id, recommendation_type, coalesce(source_product_id, ''), product_id);

create unique index if not exists user_recommendations_unique_rank_idx
  on public.user_recommendations (user_id, recommendation_type, coalesce(source_product_id, ''), rank_position);

create index if not exists user_recommendations_lookup_idx
  on public.user_recommendations (user_id, recommendation_type, rank_position asc);

create index if not exists user_recommendations_source_idx
  on public.user_recommendations (source_product_id, recommendation_type, rank_position asc)
  where source_product_id is not null;

create index if not exists user_recommendations_computed_at_idx
  on public.user_recommendations (computed_at desc);

drop trigger if exists user_recommendations_set_updated_at on public.user_recommendations;
create trigger user_recommendations_set_updated_at
before update on public.user_recommendations
for each row execute function public.set_updated_at();

alter table public.recommendation_events enable row level security;
alter table public.user_recommendations enable row level security;

grant select, insert on table public.recommendation_events to authenticated;
grant select on table public.user_recommendations to authenticated;

drop policy if exists recommendation_events_select_own_or_admin on public.recommendation_events;
create policy recommendation_events_select_own_or_admin
on public.recommendation_events
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists recommendation_events_insert_own_or_admin on public.recommendation_events;
create policy recommendation_events_insert_own_or_admin
on public.recommendation_events
for insert
with check (
  user_id is null
  or auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists recommendation_events_admin_delete on public.recommendation_events;
create policy recommendation_events_admin_delete
on public.recommendation_events
for delete
using (public.is_admin(auth.uid()));

drop policy if exists user_recommendations_select_own_or_admin on public.user_recommendations;
create policy user_recommendations_select_own_or_admin
on public.user_recommendations
for select
using (
  auth.uid() = user_id
  or public.is_admin(auth.uid())
);

drop policy if exists user_recommendations_admin_insert on public.user_recommendations;
create policy user_recommendations_admin_insert
on public.user_recommendations
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists user_recommendations_admin_update on public.user_recommendations;
create policy user_recommendations_admin_update
on public.user_recommendations
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists user_recommendations_admin_delete on public.user_recommendations;
create policy user_recommendations_admin_delete
on public.user_recommendations
for delete
using (public.is_admin(auth.uid()));

create or replace function public.get_user_recommendation_rows(
  p_recommendation_type text,
  p_limit integer default 8,
  p_source_product_id text default null
)
returns table (
  product_id text,
  score numeric,
  rank_position integer,
  reason text,
  model_version text,
  computed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.product_id,
    r.score,
    r.rank_position,
    r.reason,
    r.model_version,
    r.computed_at
  from public.user_recommendations r
  where r.user_id = auth.uid()
    and r.recommendation_type = p_recommendation_type
    and (p_source_product_id is null or r.source_product_id = p_source_product_id)
  order by r.rank_position asc
  limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;

grant execute on function public.get_user_recommendation_rows(text, integer, text) to authenticated;
