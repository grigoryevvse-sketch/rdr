-- Supabase schema for Reminder.
-- Run this once in the Supabase SQL editor before using the app.

create extension if not exists pgcrypto;

create table if not exists public.scheduled_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  start_time text not null,
  duration integer not null default 30 check (duration > 0),
  color text,
  icon text,
  completed boolean not null default false,
  repeat_frequency text not null default 'none'
    check (repeat_frequency in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval integer not null default 1 check (repeat_interval >= 1),
  notification_moments text[] not null default array['start']::text[],
  created_at timestamptz not null default now()
);

alter table public.scheduled_tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists date date,
  add column if not exists start_time text,
  add column if not exists duration integer default 30 check (duration > 0),
  add column if not exists color text,
  add column if not exists icon text,
  add column if not exists completed boolean not null default false,
  add column if not exists repeat_frequency text not null default 'none'
    check (repeat_frequency in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  add column if not exists repeat_interval integer not null default 1 check (repeat_interval >= 1),
  add column if not exists notification_moments text[] not null default array['start']::text[],
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists notes text;

create table if not exists public.inbox_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.inbox_tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists completed boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  browser_enabled boolean not null default false,
  telegram_enabled boolean not null default false,
  telegram_chat_id text,
  default_moments text[] not null default array['start']::text[],
  time_zone text not null default 'UTC',
  language text not null default 'en' check (language in ('en', 'ru')),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings
  add column if not exists browser_enabled boolean not null default false,
  add column if not exists telegram_enabled boolean not null default false,
  add column if not exists telegram_chat_id text,
  add column if not exists default_moments text[] not null default array['start']::text[],
  add column if not exists time_zone text not null default 'UTC',
  add column if not exists language text not null default 'en',
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

create table if not exists public.account_links (
  id uuid primary key default gen_random_uuid(),
  primary_user_id uuid not null references auth.users(id) on delete cascade,
  linked_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  linked_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (linked_user_id, provider)
);

create index if not exists account_links_primary_user_id_idx
  on public.account_links(primary_user_id);

create or replace function public.can_access_owner(owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    auth.uid() = owner_id
    or exists (
      select 1
      from public.account_links
      where account_links.primary_user_id = owner_id
        and account_links.linked_user_id = auth.uid()
    );
$$;

grant execute on function public.can_access_owner(uuid) to authenticated;

alter table public.scheduled_tasks enable row level security;
alter table public.inbox_tasks enable row level security;
alter table public.notification_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.account_links enable row level security;

drop policy if exists "Users can read their account links" on public.account_links;
create policy "Users can read their account links"
  on public.account_links
  for select
  using (auth.uid() = primary_user_id or auth.uid() = linked_user_id);

drop policy if exists "Users can read their scheduled tasks" on public.scheduled_tasks;
create policy "Users can read their scheduled tasks"
  on public.scheduled_tasks
  for select
  using (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users));

drop policy if exists "Users can insert their scheduled tasks" on public.scheduled_tasks;
create policy "Users can insert their scheduled tasks"
  on public.scheduled_tasks
  for insert
  with check (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users));

drop policy if exists "Users can update their scheduled tasks" on public.scheduled_tasks;
create policy "Users can update their scheduled tasks"
  on public.scheduled_tasks
  for update
  using (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users))
  with check (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users));

drop policy if exists "Users can delete their scheduled tasks" on public.scheduled_tasks;
create policy "Users can delete their scheduled tasks"
  on public.scheduled_tasks
  for delete
  using (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users));

drop policy if exists "Users can read their inbox tasks" on public.inbox_tasks;
create policy "Users can read their inbox tasks"
  on public.inbox_tasks
  for select
  using (public.can_access_owner(user_id));

drop policy if exists "Users can insert their inbox tasks" on public.inbox_tasks;
create policy "Users can insert their inbox tasks"
  on public.inbox_tasks
  for insert
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can update their inbox tasks" on public.inbox_tasks;
create policy "Users can update their inbox tasks"
  on public.inbox_tasks
  for update
  using (public.can_access_owner(user_id))
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can delete their inbox tasks" on public.inbox_tasks;
create policy "Users can delete their inbox tasks"
  on public.inbox_tasks
  for delete
  using (public.can_access_owner(user_id));

drop policy if exists "Users can read their notification settings" on public.notification_settings;
create policy "Users can read their notification settings"
  on public.notification_settings
  for select
  using (public.can_access_owner(user_id));

drop policy if exists "Users can insert their notification settings" on public.notification_settings;
create policy "Users can insert their notification settings"
  on public.notification_settings
  for insert
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can update their notification settings" on public.notification_settings;
create policy "Users can update their notification settings"
  on public.notification_settings
  for update
  using (public.can_access_owner(user_id))
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can read their push subscriptions" on public.push_subscriptions;
create policy "Users can read their push subscriptions"
  on public.push_subscriptions
  for select
  using (public.can_access_owner(user_id));

drop policy if exists "Users can insert their push subscriptions" on public.push_subscriptions;
create policy "Users can insert their push subscriptions"
  on public.push_subscriptions
  for insert
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can update their push subscriptions" on public.push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.push_subscriptions
  for update
  using (public.can_access_owner(user_id))
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions
  for delete
  using (public.can_access_owner(user_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scheduled_tasks'
  ) then
    alter publication supabase_realtime add table public.scheduled_tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inbox_tasks'
  ) then
    alter publication supabase_realtime add table public.inbox_tasks;
  end if;
end $$;
