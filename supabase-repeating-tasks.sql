-- Add repeating-task settings to scheduled tasks.
-- Run this in the Supabase SQL editor if your app uses Supabase storage.

alter table public.scheduled_tasks
add column if not exists repeat_frequency text default 'none'
  check (repeat_frequency in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
add column if not exists repeat_interval integer default 1
  check (repeat_interval >= 1);

