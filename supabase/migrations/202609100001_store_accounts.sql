-- Run once after 202609090001_public_menu.sql. Adds merchant accounts:
-- store_staff membership, a security-definer create_store() function, and
-- owner-scoped write policies for stores, categories, menu_items and tables.
begin;

create table public.store_staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

alter table public.store_staff enable row level security;

revoke all on public.store_staff from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.store_staff to authenticated;
grant all on public.store_staff to service_role;

create policy "Owners can read their own membership" on public.store_staff
  for select to authenticated using (user_id = auth.uid());

-- Runs with the privileges of the function owner (the migration role, which
-- owns public.stores/public.store_staff), so it bypasses RLS entirely for its
-- own two inserts. No INSERT grant is given to authenticated on either table —
-- this function is the only way a normal user can create a store or become
-- its owner, closing the privilege-escalation hole a client-side insert would
-- otherwise open.
create or replace function public.create_store(store_name text, store_slug text)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store public.stores;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to create a store';
  end if;

  if length(trim(store_name)) = 0 then
    raise exception 'Store name is required';
  end if;

  if store_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Store link must be lowercase letters, numbers, and hyphens';
  end if;

  insert into public.stores (name, slug)
  values (trim(store_name), store_slug)
  returning * into new_store;

  insert into public.store_staff (store_id, user_id, role)
  values (new_store.id, auth.uid(), 'owner');

  return new_store;
end;
$$;

revoke all on function public.create_store(text, text) from public;
grant execute on function public.create_store(text, text) to anon, authenticated;

grant insert, update, delete on public.categories, public.menu_items, public.tables to authenticated;
grant update on public.stores to authenticated;

create policy "Owners manage their store" on public.stores
  for update to authenticated
  using (id in (select store_id from public.store_staff where user_id = auth.uid()));

create policy "Owners manage their categories" on public.categories
  for all to authenticated
  using (store_id in (select store_id from public.store_staff where user_id = auth.uid()))
  with check (store_id in (select store_id from public.store_staff where user_id = auth.uid()));

create policy "Owners manage their menu items" on public.menu_items
  for all to authenticated
  using (store_id in (select store_id from public.store_staff where user_id = auth.uid()))
  with check (store_id in (select store_id from public.store_staff where user_id = auth.uid()));

create policy "Owners manage their tables" on public.tables
  for all to authenticated
  using (store_id in (select store_id from public.store_staff where user_id = auth.uid()))
  with check (store_id in (select store_id from public.store_staff where user_id = auth.uid()));

notify pgrst, 'reload schema';
commit;
