create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  inbound_phone_number text not null unique,
  greeting text not null,
  address text,
  opening_hours text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

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

create index if not exists restaurants_inbound_phone_number_idx
  on public.restaurants (inbound_phone_number);

create index if not exists menu_items_restaurant_id_idx
  on public.menu_items (restaurant_id);

create index if not exists call_events_restaurant_id_idx
  on public.call_events (restaurant_id);

create index if not exists call_events_conversation_id_idx
  on public.call_events (conversation_id);
