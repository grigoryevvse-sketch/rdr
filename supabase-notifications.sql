alter table public.scheduled_tasks
add column if not exists notification_moments text[] default array['start']::text[];

update public.scheduled_tasks
set notification_moments = array['start']::text[]
where notification_moments is null;
