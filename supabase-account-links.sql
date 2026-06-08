-- Account linking for Telegram <-> Google sync.
-- Run this once in Supabase SQL editor for existing projects.

create extension if not exists pgcrypto;

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
  using (public.can_access_owner(user_id));

drop policy if exists "Users can insert their scheduled tasks" on public.scheduled_tasks;
create policy "Users can insert their scheduled tasks"
  on public.scheduled_tasks
  for insert
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can update their scheduled tasks" on public.scheduled_tasks;
create policy "Users can update their scheduled tasks"
  on public.scheduled_tasks
  for update
  using (public.can_access_owner(user_id))
  with check (public.can_access_owner(user_id));

drop policy if exists "Users can delete their scheduled tasks" on public.scheduled_tasks;
create policy "Users can delete their scheduled tasks"
  on public.scheduled_tasks
  for delete
  using (public.can_access_owner(user_id));

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
