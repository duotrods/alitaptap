-- Run after the migration. Safe to rerun: existing records are not overwritten.
begin;

insert into public.stores (slug, name, description)
values ('kape-ni-juan', 'Kape ni Juan', 'Local coffee, familiar comfort.')
on conflict (slug) do nothing;

insert into public.tables (store_id, code, label)
select stores.id, sample.code, sample.label
from public.stores
cross join (values ('T01', 'Table 01'), ('T02', 'Table 02'), ('T03', 'Table 03'))
  as sample(code, label)
where stores.slug = 'kape-ni-juan'
on conflict (store_id, code) do nothing;

insert into public.categories (store_id, name, sort_order)
select stores.id, sample.name, sample.sort_order
from public.stores
cross join (values ('Coffee', 1), ('Refreshers', 2), ('Bakes', 3))
  as sample(name, sort_order)
where stores.slug = 'kape-ni-juan'
on conflict (store_id, name) do nothing;

insert into public.menu_items
  (id, store_id, category_id, name, description, price, color, emoji, popular, sort_order)
select sample.id::uuid, stores.id, categories.id, sample.name, sample.description,
  sample.price, sample.color, sample.emoji, sample.popular, sample.sort_order
from (values
  ('10000000-0000-4000-8000-000000000001', 'Coffee', 'Spanish Latte',
    'Espresso, silky milk, and a touch of condensed milk.', 145, '#c98755', '☕', true, 1),
  ('10000000-0000-4000-8000-000000000002', 'Coffee', 'Sea Salt Latte',
    'Creamy espresso finished with a cloud of sea salt foam.', 155, '#9c765a', '🥛', false, 2),
  ('10000000-0000-4000-8000-000000000003', 'Coffee', 'Tablea Mocha',
    'Local cacao, double espresso, and steamed fresh milk.', 165, '#765447', '🍫', true, 3),
  ('10000000-0000-4000-8000-000000000004', 'Refreshers', 'Calamansi Fizz',
    'Fresh calamansi, soda, and wildflower honey.', 115, '#a9b95f', '🍋', false, 4),
  ('10000000-0000-4000-8000-000000000005', 'Refreshers', 'Mango Iced Tea',
    'House-brewed black tea with ripe Philippine mango.', 125, '#e1a943', '🥭', false, 5),
  ('10000000-0000-4000-8000-000000000006', 'Bakes', 'Ube Ensaymada',
    'Soft brioche, ube halaya, butter, and aged cheese.', 95, '#9d7ab2', '🧁', true, 6),
  ('10000000-0000-4000-8000-000000000007', 'Bakes', 'Tuna Pandesal',
    'Warm pandesal with tuna, herbs, and melted cheese.', 110, '#d59d66', '🥪', false, 7),
  ('10000000-0000-4000-8000-000000000008', 'Bakes', 'Banana Loaf',
    'Moist banana bread with muscovado and walnuts.', 85, '#ad895d', '🍌', false, 8)
) as sample(id, category, name, description, price, color, emoji, popular, sort_order)
join public.stores on stores.slug = 'kape-ni-juan'
join public.categories on categories.store_id = stores.id and categories.name = sample.category
on conflict (id) do nothing;

commit;
