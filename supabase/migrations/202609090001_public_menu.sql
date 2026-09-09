-- Run once in the Supabase SQL Editor on the new development project.
-- This milestone exposes menu reads only. Checkout and staff writes come later.
begin;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null check (length(trim(code)) > 0),
  label text not null check (length(trim(label)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, code)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, name),
  unique (id, store_id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  price numeric(10,2) not null check (price >= 0 and price < 100000000),
  available boolean not null default true,
  sort_order integer not null default 0,
  color text not null default '#c98755' check (color ~ '^#[0-9a-fA-F]{6}$'),
  emoji text not null default '🍽️',
  popular boolean not null default false,
  created_at timestamptz not null default now(),
  -- A menu item cannot reference a category belonging to another store.
  foreign key (category_id, store_id) references public.categories(id, store_id)
);

create index menu_items_store_sort_idx on public.menu_items (store_id, sort_order, id);
create index menu_items_category_idx on public.menu_items (category_id, store_id);

alter table public.stores enable row level security;
alter table public.tables enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;

-- Remove any default client write privileges before granting public reads.
revoke all on public.stores, public.tables, public.categories, public.menu_items
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.stores, public.tables, public.categories, public.menu_items
  to anon, authenticated;
grant all on public.stores, public.tables, public.categories, public.menu_items
  to service_role;

create policy "Read active stores" on public.stores
  for select to anon, authenticated using (active);

create policy "Read active tables in active stores" on public.tables
  for select to anon, authenticated
  using (active and exists (
    select 1 from public.stores where stores.id = tables.store_id and stores.active
  ));

create policy "Read categories in active stores" on public.categories
  for select to anon, authenticated
  using (exists (
    select 1 from public.stores where stores.id = categories.store_id and stores.active
  ));

create policy "Read available menu items in active stores" on public.menu_items
  for select to anon, authenticated
  using (available and exists (
    select 1 from public.stores where stores.id = menu_items.store_id and stores.active
  ));

notify pgrst, 'reload schema';
commit;
