-- Optional seed: sample categories + menu items. Run AFTER creating auth users.
-- Promote a user to admin manually:
--   update public.profiles set role = 'admin' where id = '<user-uuid>';

insert into public.menu_categories (name, sort_order) values
  ('Mains', 1),
  ('Sides', 2),
  ('Drinks', 3),
  ('Desserts', 4)
on conflict do nothing;

with cats as (
  select id, name from public.menu_categories
)
insert into public.menu_items (category_id, name, description, price, is_available)
select (select id from cats where name = 'Mains'), 'Nasi Goreng Special', 'Fried rice with chicken, egg, and prawn crackers', 35000, true
where not exists (select 1 from public.menu_items where name = 'Nasi Goreng Special')
union all
select (select id from cats where name = 'Mains'), 'Ayam Bakar', 'Grilled chicken with sambal and rice', 45000, true
where not exists (select 1 from public.menu_items where name = 'Ayam Bakar')
union all
select (select id from cats where name = 'Mains'), 'Mie Goreng', 'Stir-fried noodles with vegetables', 32000, true
where not exists (select 1 from public.menu_items where name = 'Mie Goreng')
union all
select (select id from cats where name = 'Sides'), 'Tempe Goreng', 'Crispy fried tempeh', 15000, true
where not exists (select 1 from public.menu_items where name = 'Tempe Goreng')
union all
select (select id from cats where name = 'Sides'), 'Kerupuk', 'Prawn crackers', 8000, true
where not exists (select 1 from public.menu_items where name = 'Kerupuk')
union all
select (select id from cats where name = 'Drinks'), 'Es Teh Manis', 'Sweet iced tea', 10000, true
where not exists (select 1 from public.menu_items where name = 'Es Teh Manis')
union all
select (select id from cats where name = 'Drinks'), 'Jus Alpukat', 'Avocado juice with chocolate', 22000, true
where not exists (select 1 from public.menu_items where name = 'Jus Alpukat')
union all
select (select id from cats where name = 'Desserts'), 'Pisang Goreng', 'Fried banana with palm sugar', 18000, true
where not exists (select 1 from public.menu_items where name = 'Pisang Goreng');
