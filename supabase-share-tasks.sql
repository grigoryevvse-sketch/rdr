-- Add columns for sharing tasks
alter table public.scheduled_tasks
  add column if not exists shared_by_email text,
  add column if not exists shared_by_name text,
  add column if not exists shared_with_users uuid[] not null default array[]::uuid[];

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

-- Update RLS for scheduled_tasks to support shared users
drop policy if exists "Users can read their scheduled tasks" on public.scheduled_tasks;
create policy "Users can read their scheduled tasks"
  on public.scheduled_tasks
  for select
  using (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users));

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

drop policy if exists "Users can insert their scheduled tasks" on public.scheduled_tasks;
create policy "Users can insert their scheduled tasks"
  on public.scheduled_tasks
  for insert
  with check (public.can_access_owner(user_id) or auth.uid() = any(shared_with_users));

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
  v_recipient_chat_id text;
  v_recipient_telegram_enabled boolean;
  v_recipient_language text;
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

  -- Fetch the task to be shared (must be owner or already shared with them)
  select * into v_task
  from public.scheduled_tasks
  where id = p_task_id and (public.can_access_owner(user_id) or v_sender_id = any(shared_with_users));

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

  if v_recipient_id = v_task.user_id or v_recipient_id = any(v_task.shared_with_users) then
    return jsonb_build_object('success', false, 'error', 'Task is already shared with this user');
  end if;

  -- Add recipient to the shared_with_users array.
  -- Only update shared_by_name if the sender is the original owner.
  -- This preserves the original sender's name if a shared task is shared again.
  update public.scheduled_tasks
  set 
    shared_with_users = array(select distinct unnest(array_append(shared_with_users, v_recipient_id))),
    shared_by_email = case when v_task.user_id = v_sender_id then v_sender_email else shared_by_email end,
    shared_by_name = case when v_task.user_id = v_sender_id then v_sender_name else shared_by_name end
  where id = p_task_id;

  -- Get recipient's notification preferences
  select telegram_chat_id, telegram_enabled, language 
  into v_recipient_chat_id, v_recipient_telegram_enabled, v_recipient_language
  from public.notification_settings
  where user_id = v_recipient_id;

  return jsonb_build_object(
    'success', true, 
    'new_task_id', p_task_id, 
    'recipient_email', v_recipient_email,
    'sender_name', v_sender_name,
    'recipient_chat_id', case when v_recipient_telegram_enabled then v_recipient_chat_id else null end,
    'recipient_language', v_recipient_language
  );
end;
$$;
