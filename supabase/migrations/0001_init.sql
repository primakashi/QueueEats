-- QueueEats initial schema
-- Creates enums, tables, helper functions, RLS policies, realtime publication.

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "pgcrypto";

-- =====================================================================
-- Enums
-- =====================================================================
do $$ begin
  create type user_role as enum ('waiter', 'kitchen', 'cashier', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'preparing', 'ready', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status_enum as enum ('unpaid', 'pending', 'paid', 'failed', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method_enum as enum ('qris', 'cash');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Tables
-- =====================================================================

-- One row per authenticated staff user (mirrors auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'waiter',
  created_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price int not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Daily sequence for human-readable order numbers: ORD-YYYYMMDD-NNNN
create table if not exists public.order_counters (
  day date primary key,
  last_value int not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  table_number text,
  customer_name text,
  status order_status not null default 'pending',
  payment_status payment_status_enum not null default 'unpaid',
  payment_method payment_method_enum,
  subtotal int not null default 0,
  total int not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name_snapshot text not null,
  price_snapshot int not null check (price_snapshot >= 0),
  quantity int not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'xendit',
  xendit_qr_id text unique,
  qr_string text,
  amount int not null check (amount >= 0),
  status payment_status_enum not null default 'pending',
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_id_idx on public.payments(order_id);

-- =====================================================================
-- Helper: current user's role
-- =====================================================================
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

-- =====================================================================
-- Order number generator + create_order RPC
-- =====================================================================
create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Jakarta')::date;
  next_val int;
begin
  insert into public.order_counters(day, last_value)
  values (today, 1)
  on conflict (day) do update
    set last_value = public.order_counters.last_value + 1
  returning last_value into next_val;

  return 'ORD-' || to_char(today, 'YYYYMMDD') || '-' || lpad(next_val::text, 4, '0');
end;
$$;

-- Accepts { table_number, customer_name, notes, items: [{ menu_item_id, quantity, notes }] }
-- Inserts order + order_items atomically, computes totals from current menu prices.
create or replace function public.create_order(payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_order_number text;
  v_subtotal int := 0;
  item jsonb;
  v_menu_item public.menu_items;
  v_qty int;
  v_role user_role;
begin
  v_role := public.current_role();
  if v_role is null then
    raise exception 'not authenticated';
  end if;
  if v_role not in ('waiter', 'admin') then
    raise exception 'only waiter or admin can create orders';
  end if;

  if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'items must be a non-empty array';
  end if;

  v_order_number := public.next_order_number();

  insert into public.orders (order_number, table_number, customer_name, notes, created_by, subtotal, total)
  values (
    v_order_number,
    nullif(payload->>'table_number', ''),
    nullif(payload->>'customer_name', ''),
    nullif(payload->>'notes', ''),
    auth.uid(),
    0,
    0
  )
  returning * into v_order;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    select * into v_menu_item from public.menu_items where id = (item->>'menu_item_id')::uuid;
    if v_menu_item.id is null then
      raise exception 'menu item % not found', item->>'menu_item_id';
    end if;
    if not v_menu_item.is_available then
      raise exception 'menu item % is not available', v_menu_item.name;
    end if;
    v_qty := coalesce((item->>'quantity')::int, 1);
    if v_qty <= 0 then
      raise exception 'quantity must be positive';
    end if;

    insert into public.order_items (order_id, menu_item_id, name_snapshot, price_snapshot, quantity, notes)
    values (
      v_order.id,
      v_menu_item.id,
      v_menu_item.name,
      v_menu_item.price,
      v_qty,
      nullif(item->>'notes', '')
    );

    v_subtotal := v_subtotal + (v_menu_item.price * v_qty);
  end loop;

  update public.orders
    set subtotal = v_subtotal, total = v_subtotal, updated_at = now()
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$$;

-- =====================================================================
-- updated_at triggers
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists menu_items_touch on public.menu_items;
create trigger menu_items_touch before update on public.menu_items
for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
for each row execute function public.touch_updated_at();

-- Auto-create profile on signup (default role = waiter; admin must promote)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'waiter')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_counters enable row level security;

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- menu_categories: any signed-in user reads, admin writes
drop policy if exists "menu_categories read" on public.menu_categories;
create policy "menu_categories read" on public.menu_categories
  for select using (auth.uid() is not null);

drop policy if exists "menu_categories admin write" on public.menu_categories;
create policy "menu_categories admin write" on public.menu_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- menu_items: any signed-in user reads, admin writes
drop policy if exists "menu_items read" on public.menu_items;
create policy "menu_items read" on public.menu_items
  for select using (auth.uid() is not null);

drop policy if exists "menu_items admin write" on public.menu_items;
create policy "menu_items admin write" on public.menu_items
  for all using (public.is_admin()) with check (public.is_admin());

-- orders
drop policy if exists "orders staff read" on public.orders;
create policy "orders staff read" on public.orders
  for select using (auth.uid() is not null);

-- Inserts happen via create_order RPC (security definer), but allow waiters/admins to insert directly if needed
drop policy if exists "orders waiter insert" on public.orders;
create policy "orders waiter insert" on public.orders
  for insert with check (public.current_role() in ('waiter', 'admin'));

drop policy if exists "orders kitchen update status" on public.orders;
create policy "orders kitchen update status" on public.orders
  for update using (public.current_role() in ('kitchen', 'cashier', 'admin'))
  with check (public.current_role() in ('kitchen', 'cashier', 'admin'));

drop policy if exists "orders admin delete" on public.orders;
create policy "orders admin delete" on public.orders
  for delete using (public.is_admin());

-- order_items: read by any staff; write via RPC (security definer). Admin can edit.
drop policy if exists "order_items staff read" on public.order_items;
create policy "order_items staff read" on public.order_items
  for select using (auth.uid() is not null);

drop policy if exists "order_items admin write" on public.order_items;
create policy "order_items admin write" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- payments: read by any staff, written by cashier/admin via server actions (service role bypasses RLS)
drop policy if exists "payments staff read" on public.payments;
create policy "payments staff read" on public.payments
  for select using (auth.uid() is not null);

drop policy if exists "payments cashier write" on public.payments;
create policy "payments cashier write" on public.payments
  for all using (public.current_role() in ('cashier', 'admin'))
  with check (public.current_role() in ('cashier', 'admin'));

-- order_counters: no direct access; only the SECURITY DEFINER function touches it
-- (RLS enabled without policies = deny all to non-service-role)

-- =====================================================================
-- Realtime
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['orders','order_items','payments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- Storage bucket for menu images
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "menu-images public read" on storage.objects;
create policy "menu-images public read" on storage.objects
  for select using (bucket_id = 'menu-images');

drop policy if exists "menu-images admin write" on storage.objects;
create policy "menu-images admin write" on storage.objects
  for all using (bucket_id = 'menu-images' and public.is_admin())
  with check (bucket_id = 'menu-images' and public.is_admin());
