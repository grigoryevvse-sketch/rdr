-- Add columns for sharing tasks
alter table public.scheduled_tasks
  add column if not exists shared_by_email text,
  add column if not exists shared_by_name text;

-- Add username column to notification_settings
alter table public.notification_settings
  add column if not exists username text;

-- Add unique constraint on username
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_settings_username_key'
  ) then
    alter table public.notification_settings add constraint notification_settings_username_key unique (username);
  end if;
end $$;

-- Create share_task_to_user function
create or replace function public.share_task_to_user(
  p_task_id text,
  p_recipient_identifier text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sender_id uuid;
  v_sender_email text;
  v_sender_name text;
  v_recipient_id uuid;
  v_recipient_email text;
  v_task record;
  v_new_task_id text;
begin
  -- Get the current authenticated user (sender)
  v_sender_id := auth.uid();
  if v_sender_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- Get sender's details
  select 
    coalesce(email, raw_user_meta_data->>'email', 'Unknown'),
    coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'telegram_username', 'User')
  into v_sender_email, v_sender_name
  from auth.users
  where id = v_sender_id;

  -- Fetch the task to be shared
  select * into v_task
  from public.scheduled_tasks
  where id = p_task_id and (user_id = v_sender_id or public.can_access_owner(user_id));

  if not found then
    return jsonb_build_object('success', false, 'error', 'Task not found or you do not have permission to share it');
  end if;

  -- Find the recipient user
  -- 1. Try by custom username in notification_settings
  declare
    v_clean_username text := ltrim(p_recipient_identifier, '@');
  begin
    select user_id into v_recipient_id
    from public.notification_settings
    where lower(username) = lower(v_clean_username)
    limit 1;
    
    if v_recipient_id is not null then
      select email into v_recipient_email
      from auth.users
      where id = v_recipient_id;
    end if;
  end;

  -- 2. Try by email in auth.users
  if v_recipient_id is null then
    if position('@' in p_recipient_identifier) > 0 and position('.' in p_recipient_identifier) > 0 then
      select id, email into v_recipient_id, v_recipient_email
      from auth.users
      where lower(email) = lower(p_recipient_identifier)
         or lower(raw_user_meta_data->>'email') = lower(p_recipient_identifier)
      limit 1;
    end if;
  end if;

  -- 3. Try by Telegram username (removing @ if present)
  if v_recipient_id is null then
    declare
      v_username text := ltrim(p_recipient_identifier, '@');
    begin
      select id, email into v_recipient_id, v_recipient_email
      from auth.users
      where lower(raw_user_meta_data->>'telegram_username') = lower(v_username)
      limit 1;
    end;
  end if;

  -- 4. Final fallback check of email & username
  if v_recipient_id is null then
    select id, email into v_recipient_id, v_recipient_email
    from auth.users
    where lower(email) = lower(p_recipient_identifier)
       or lower(raw_user_meta_data->>'telegram_username') = lower(p_recipient_identifier)
    limit 1;
  end if;

  if v_recipient_id is null then
    return jsonb_build_object('success', false, 'error', 'Recipient user not found');
  end if;

  if v_recipient_id = v_sender_id then
    return jsonb_build_object('success', false, 'error', 'You cannot share a task with yourself');
  end if;

  -- Generate a random text ID for the new task
  v_new_task_id := encode(gen_random_bytes(16), 'hex');

  -- Insert copied task for recipient
  insert into public.scheduled_tasks (
    id,
    user_id,
    title,
    date,
    start_time,
    duration,
    color,
    icon,
    completed,
    repeat_frequency,
    repeat_interval,
    notification_moments,
    shared_by_email,
    shared_by_name
  ) values (
    v_new_task_id,
    v_recipient_id,
    v_task.title,
    v_task.date,
    v_task.start_time,
    v_task.duration,
    v_task.color,
    v_task.icon,
    false, -- reset completed status
    v_task.repeat_frequency,
    v_task.repeat_interval,
    v_task.notification_moments,
    v_sender_email,
    v_sender_name
  );

  return jsonb_build_object('success', true, 'new_task_id', v_new_task_id, 'recipient_email', v_recipient_email);
end;
$$;
