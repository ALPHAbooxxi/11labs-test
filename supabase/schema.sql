create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  inbound_phone_number text not null unique,
  greeting text not null,
  address text,
  opening_hours text,
  delivery_enabled boolean not null default true,
  pickup_enabled boolean not null default true,
  minimum_order_amount numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  delivery_area_notes text,
  payment_methods jsonb not null default '["cash"]'::jsonb,
  handoff_phone_number text,
  special_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.restaurants
  add column if not exists delivery_enabled boolean not null default true,
  add column if not exists pickup_enabled boolean not null default true,
  add column if not exists minimum_order_amount numeric(10,2) not null default 0,
  add column if not exists delivery_fee numeric(10,2) not null default 0,
  add column if not exists delivery_area_notes text,
  add column if not exists payment_methods jsonb not null default '["cash"]'::jsonb,
  add column if not exists handoff_phone_number text,
  add column if not exists special_notes text;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null,
  category text not null,
  sizes jsonb,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_timestamp bigint,
  conversation_id text,
  agent_id text,
  call_status text,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  called_number text,
  caller_id text,
  summary text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  conversation_id text,
  customer_name text,
  customer_phone text,
  fulfillment_type text not null,
  delivery_address text,
  notes text,
  status text not null default 'confirmed',
  total_amount numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  source text not null default 'elevenlabs',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  item_size text,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null,
  special_instructions text,
  created_at timestamptz not null default now()
);

create index if not exists restaurants_inbound_phone_number_idx
  on public.restaurants (inbound_phone_number);

create index if not exists menu_items_restaurant_id_idx
  on public.menu_items (restaurant_id);

create index if not exists call_events_restaurant_id_idx
  on public.call_events (restaurant_id);

create index if not exists call_events_conversation_id_idx
  on public.call_events (conversation_id);

create index if not exists orders_restaurant_id_idx
  on public.orders (restaurant_id);

create index if not exists orders_conversation_id_idx
  on public.orders (conversation_id);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
