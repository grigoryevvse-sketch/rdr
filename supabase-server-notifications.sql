-- Server-side notifications for Antigravity Planner.
-- Run this in the Supabase SQL editor after the base schema.

create extension if not exists pgcrypto;

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  browser_enabled boolean not null default false,
  telegram_enabled boolean not null default false,
  telegram_chat_id text,
  default_moments text[] not null default array['start']::text[],
  time_zone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

alter table public.notification_settings
  add column if not exists browser_enabled boolean not null default false,
  add column if not exists telegram_enabled boolean not null default false,
  add column if not exists telegram_chat_id text,
  add column if not exists default_moments text[] not null default array['start']::text[],
  add column if not exists time_zone text not null default 'UTC',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists endpoint text,
  add column if not exists subscription jsonb,
  add column if not exists enabled boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions(endpoint);

create table if not exists public.notification_deliveries (
  notification_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  moment_id text not null,
  trigger_at timestamptz not null,
  delivered_at timestamptz not null default now(),
  error text
);

alter table public.notification_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users can read their notification settings" on public.notification_settings;
create policy "Users can read their notification settings"
  on public.notification_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their notification settings" on public.notification_settings;
create policy "Users can insert their notification settings"
  on public.notification_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their notification settings" on public.notification_settings;
create policy "Users can update their notification settings"
  on public.notification_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their push subscriptions" on public.push_subscriptions;
create policy "Users can read their push subscriptions"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their push subscriptions" on public.push_subscriptions;
create policy "Users can insert their push subscriptions"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their push subscriptions" on public.push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.push_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);
