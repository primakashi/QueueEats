-- Queue management schema

do $$ begin
  create type queue_entry_status as enum ('waiting', 'called', 'seated', 'no_show', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type queue_notification_state as enum ('none', 'joined', 'almost', 'called', 'no_show');
exception when duplicate_object then null; end $$;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  party_size int not null check (party_size between 1 and 20),
  phone text,
  token text not null unique,
  status queue_entry_status not null default 'waiting',
  notification_state queue_notification_state not null default 'none',
  assigned_table text,
  pending_wa_url text,
  created_at timestamptz not null default now(),
  called_at timestamptz,
  seated_at timestamptz
);

create index if not exists queue_entries_restaurant_status_idx
  on public.queue_entries(restaurant_id, status);
create index if not exists queue_entries_token_idx
  on public.queue_entries(token);

insert into public.restaurants (name)
select coalesce(nullif(current_setting('app.restaurant_name', true), ''), 'QueueEats')
where not exists (select 1 from public.restaurants);
