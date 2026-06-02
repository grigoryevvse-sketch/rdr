-- Supabase schema for Antigravity Planner.
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
  add column if not exists created_at timestamptz not null default now();

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

alter table public.scheduled_tasks enable row level security;
alter table public.inbox_tasks enable row level security;

drop policy if exists "Users can read their scheduled tasks" on public.scheduled_tasks;
create policy "Users can read their scheduled tasks"
  on public.scheduled_tasks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their scheduled tasks" on public.scheduled_tasks;
create policy "Users can insert their scheduled tasks"
  on public.scheduled_tasks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their scheduled tasks" on public.scheduled_tasks;
create policy "Users can update their scheduled tasks"
  on public.scheduled_tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their scheduled tasks" on public.scheduled_tasks;
create policy "Users can delete their scheduled tasks"
  on public.scheduled_tasks
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their inbox tasks" on public.inbox_tasks;
create policy "Users can read their inbox tasks"
  on public.inbox_tasks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their inbox tasks" on public.inbox_tasks;
create policy "Users can insert their inbox tasks"
  on public.inbox_tasks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their inbox tasks" on public.inbox_tasks;
create policy "Users can update their inbox tasks"
  on public.inbox_tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their inbox tasks" on public.inbox_tasks;
create policy "Users can delete their inbox tasks"
  on public.inbox_tasks
  for delete
  using (auth.uid() = user_id);

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
