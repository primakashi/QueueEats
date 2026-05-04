-- Allow anonymous (public) reads of the customer-facing menu.
-- Staff stay unrestricted since they're authenticated.

drop policy if exists "menu_items read" on public.menu_items;
create policy "menu_items read" on public.menu_items
  for select
  using (auth.uid() is not null or is_available = true);

drop policy if exists "menu_categories read" on public.menu_categories;
create policy "menu_categories read" on public.menu_categories
  for select
  using (true);
