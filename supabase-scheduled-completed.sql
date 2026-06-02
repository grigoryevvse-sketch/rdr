alter table public.scheduled_tasks
add column if not exists completed boolean not null default false;

update public.scheduled_tasks
set completed = false
where completed is null;
