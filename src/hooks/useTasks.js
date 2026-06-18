import { useState, useEffect, useCallback } from 'react'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../supabase'
import { DEFAULT_SCHEDULED_TASKS, DEFAULT_INBOX_TASKS, TASK_COLORS, TASK_ICONS } from '../utils/constants'
import { generateId, formatDateISO } from '../utils/dateUtils'
import { getNextRepeatDate, isRepeatingTask } from '../utils/repeatUtils'

const LOCAL_SCHEDULED_TASKS_KEY = 'planner-scheduled'
const LOCAL_INBOX_TASKS_KEY = 'planner-inbox'
const LOCAL_NOTIFICATION_MOMENTS_KEY = 'planner-task-notification-moments'
const SUPABASE_REQUIRED_MESSAGE = 'Task sync requires Supabase. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function normalizeDate(value) {
  return isValidDateString(value) ? value : formatDateISO(new Date())
}

function normalizeTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : '09:00'
}

function normalizeDuration(value) {
  const duration = Number(value)
  if (!Number.isFinite(duration)) return 30
  return Math.min(Math.max(Math.round(duration), 1), 24 * 60)
}

function normalizeColor(value) {
  return typeof value === 'string' && value.trim() ? value : TASK_COLORS[0]
}

function normalizeIcon(value) {
  return typeof value === 'string' && value.trim() ? value : TASK_ICONS[0]
}

function readLocalNotificationMoments() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_NOTIFICATION_MOMENTS_KEY))
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}

function readLocalArray(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function mergeLocalNotificationMoments(tasks) {
  const saved = readLocalNotificationMoments()
  return tasks.map((task) => normalizeScheduledTask({
    ...task,
    notification_moments: Array.isArray(task?.notification_moments)
      ? task.notification_moments
      : saved[task?.id],
  }))
}

function normalizeScheduledTask(task) {
  const safeTask = task && typeof task === 'object' ? task : {}
  return {
    ...safeTask,
    id: typeof safeTask.id === 'string' && safeTask.id ? safeTask.id : generateId(),
    title: typeof safeTask.title === 'string' && safeTask.title.trim()
      ? safeTask.title.trim()
      : 'Untitled task',
    date: normalizeDate(safeTask.date),
    start_time: normalizeTime(safeTask.start_time),
    duration: normalizeDuration(safeTask.duration),
    color: normalizeColor(safeTask.color),
    icon: normalizeIcon(safeTask.icon),
    completed: Boolean(safeTask.completed),
    repeat_frequency: safeTask.repeat_frequency || 'none',
    repeat_interval: Math.max(Number(safeTask.repeat_interval) || 1, 1),
    notification_moments: Array.isArray(safeTask.notification_moments)
      ? safeTask.notification_moments
      : undefined,
    shared_by_email: safeTask.shared_by_email || undefined,
    shared_by_name: safeTask.shared_by_name || undefined,
    user_id: safeTask.user_id || undefined,
    shared_with_users: Array.isArray(safeTask.shared_with_users) ? safeTask.shared_with_users : [],
    notes: typeof safeTask.notes === 'string' ? safeTask.notes : undefined,
  }
}

async function insertScheduledTask(task, userId) {
  const taskToInsert = normalizeScheduledTask(task)
  if (!taskToInsert.user_id) taskToInsert.user_id = userId
  
  const { error } = await supabase
    .from('scheduled_tasks')
    .insert(taskToInsert)

  if (error) throw error
  return true
}

function buildNextRepeatTask(task) {
  const nextDate = getNextRepeatDate(task)
  if (!nextDate) return null

  return {
    ...task,
    id: generateId(),
    date: nextDate,
    completed: false,
  }
}

function readLocalTasksForMigration() {
  const localNotificationMoments = readLocalNotificationMoments()
  const scheduled = readLocalArray(LOCAL_SCHEDULED_TASKS_KEY)
  const inbox = readLocalArray(LOCAL_INBOX_TASKS_KEY)

  return {
    scheduled: scheduled
      .filter((task) => task && typeof task.title === 'string')
      .map((task) => normalizeScheduledTask({
        ...task,
        id: generateId(),
        notification_moments: Array.isArray(task.notification_moments)
          ? task.notification_moments
          : localNotificationMoments[task.id],
      })),
    inbox: inbox
      .filter((task) => task && typeof task.title === 'string')
      .map((task) => ({
        ...task,
        id: generateId(),
        completed: Boolean(task.completed),
      })),
  }
}

async function migrateLocalTasksToSupabase(userId) {
  const migrationKey = `planner-supabase-migrated-${userId}`
  if (localStorage.getItem(migrationKey) === 'true') return

  const { scheduled, inbox } = readLocalTasksForMigration()
  if (!scheduled.length && !inbox.length) {
    localStorage.setItem(migrationKey, 'true')
    return
  }

  const [scheduledResult, inboxResult] = await Promise.all([
    scheduled.length
      ? supabase.from('scheduled_tasks').insert(scheduled.map((task) => ({ ...task, user_id: userId })))
      : Promise.resolve({ error: null }),
    inbox.length
      ? supabase.from('inbox_tasks').insert(inbox.map((task) => ({ ...task, user_id: userId })))
      : Promise.resolve({ error: null }),
  ])

  if (scheduledResult.error || inboxResult.error) {
    throw scheduledResult.error || inboxResult.error
  }

  localStorage.setItem(migrationKey, 'true')
  localStorage.removeItem(LOCAL_SCHEDULED_TASKS_KEY)
  localStorage.removeItem(LOCAL_INBOX_TASKS_KEY)
  localStorage.removeItem(LOCAL_NOTIFICATION_MOMENTS_KEY)
}

function getDemoScheduledTasks() {
  const todayStr = formatDateISO(new Date())
  return DEFAULT_SCHEDULED_TASKS.map((task) => ({
    ...normalizeScheduledTask(task),
    date: todayStr,
  }))
}

/**
 * Hook for real-time Supabase task CRUD operations.
 * Uses Supabase for signed-in users. Demo mode is in-memory only.
 *
 * Returns: {
 *   scheduledTasks, inboxTasks, loading, error,
 *   addScheduledTask, updateScheduledTask, deleteScheduledTask,
 *   addInboxTask, toggleInboxTask, deleteInboxTask, scheduleInboxTask,
 * }
 */
export function useTasks(user) {
  const [scheduledTasks, setScheduledTasks] = useState([])
  const [inboxTasks, setInboxTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(supabaseConfigError)
  const isDemoUser = user?.id === 'demo'
  const canUseSupabase = Boolean(isSupabaseConfigured && user && !isDemoUser && supabase)
  const ownerId = user?.task_owner_id || user?.id

  const reportSupabaseError = useCallback((err, fallbackMessage) => {
    const message = err?.message || fallbackMessage
    console.error(message, err)
    setError(message)
  }, [])

  const loadFromSupabase = useCallback(async () => {
    if (!supabase || !ownerId) return
    const userId = user?.id
    try {
      await migrateLocalTasksToSupabase(ownerId)
      // Build the filter: own tasks OR shared with ownerId OR shared with userId (for linked accounts)
      let orFilter = `user_id.eq.${ownerId},shared_with_users.cs.{${ownerId}}`
      if (userId && userId !== ownerId) {
        orFilter += `,shared_with_users.cs.{${userId}}`
      }
      const [{ data: st }, { data: it }] = await Promise.all([
        supabase.from('scheduled_tasks').select('*').or(orFilter).order('start_time'),
        supabase.from('inbox_tasks').select('*').eq('user_id', ownerId).order('created_at'),
      ])
      setScheduledTasks(mergeLocalNotificationMoments(st || []))
      setInboxTasks(it || [])
      setError('')
    } catch (err) {
      console.error('Supabase load error:', err)
      setError(err?.message || 'Could not load tasks from Supabase.')
    } finally {
      setLoading(false)
    }
  }, [ownerId, user?.id])

  // ─── Load tasks ───
  useEffect(() => {
    let cancelled = false
    const applyState = (update) => {
      queueMicrotask(() => {
        if (!cancelled) update()
      })
    }

    if (canUseSupabase) {
      applyState(() => setLoading(true))
      queueMicrotask(() => {
        if (!cancelled) loadFromSupabase()
      })
      // Set up real-time subscription
      const scheduled = supabase
        .channel('scheduled-tasks')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'scheduled_tasks' },
          () => loadFromSupabase()
        )
        .subscribe()

      const inbox = supabase
        .channel('inbox-tasks')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'inbox_tasks', filter: `user_id=eq.${ownerId}` },
          () => loadFromSupabase()
        )
        .subscribe()

      return () => {
        cancelled = true
        supabase.removeChannel(scheduled)
        supabase.removeChannel(inbox)
      }
    }

    if (isDemoUser) {
      applyState(() => {
        setScheduledTasks(getDemoScheduledTasks())
        setInboxTasks(DEFAULT_INBOX_TASKS.map((task) => ({ ...task })))
        setError('')
        setLoading(false)
      })
      return
    }

    applyState(() => {
      setScheduledTasks([])
      setInboxTasks([])
      setError(supabaseConfigError || SUPABASE_REQUIRED_MESSAGE)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [ownerId, canUseSupabase, isDemoUser, loadFromSupabase])

  // ─── Scheduled Task CRUD ───
  const addScheduledTask = useCallback(async (task) => {
    const newTask = normalizeScheduledTask({
      ...task,
      id: generateId(),
      user_id: task.user_id || ownerId,
    })
    if (canUseSupabase) {
      try {
        await insertScheduledTask(newTask, ownerId)
        setScheduledTasks((current) => [...current, newTask])
      } catch (err) {
        reportSupabaseError(err, 'Could not add scheduled task.')
      }
    } else {
      setScheduledTasks((current) => isDemoUser ? [...current, newTask] : current)
    }
  }, [ownerId, canUseSupabase, isDemoUser, reportSupabaseError])

  const updateScheduledTask = useCallback(async (id, updates) => {
    const existingTask = scheduledTasks.find((task) => task.id === id)
    const shouldCreateNextRepeat = (
      existingTask &&
      isRepeatingTask(existingTask) &&
      updates.completed === true &&
      !existingTask.completed
    )
    const nextRepeatTask = shouldCreateNextRepeat ? buildNextRepeatTask(existingTask) : null

    const applyLocalUpdate = () => {
      setScheduledTasks((current) => {
        const updated = current.map((task) => (
          task.id === id ? { ...task, ...updates } : task
        ))
        return nextRepeatTask ? [...updated, nextRepeatTask] : updated
      })
    }

    if (canUseSupabase) {
      try {
        const { error: updateError } = await supabase.from('scheduled_tasks').update(updates).eq('id', id)
        if (updateError) throw updateError
        if (nextRepeatTask) await insertScheduledTask(nextRepeatTask, ownerId)
        applyLocalUpdate()
      } catch (err) {
        reportSupabaseError(err, 'Could not update scheduled task.')
      }
    } else {
      if (isDemoUser) applyLocalUpdate()
    }
  }, [ownerId, canUseSupabase, isDemoUser, scheduledTasks, reportSupabaseError])

  const deleteScheduledTask = useCallback(async (id) => {
    if (canUseSupabase) {
      try {
        const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', id)
        if (deleteError) throw deleteError
        setScheduledTasks((current) => current.filter((task) => task.id !== id))
      } catch (err) {
        reportSupabaseError(err, 'Could not delete scheduled task.')
      }
    } else {
      setScheduledTasks((current) => isDemoUser ? current.filter((task) => task.id !== id) : current)
    }
  }, [canUseSupabase, isDemoUser, reportSupabaseError])

  // ─── Inbox Task CRUD ───
  const addInboxTask = useCallback(async (title) => {
    const newTask = { id: generateId(), title, completed: false }
    if (canUseSupabase) {
      try {
        const { error: insertError } = await supabase.from('inbox_tasks').insert({ ...newTask, user_id: ownerId })
        if (insertError) throw insertError
        setInboxTasks((current) => [...current, newTask])
      } catch (err) {
        reportSupabaseError(err, 'Could not add inbox task.')
      }
    } else {
      setInboxTasks((current) => isDemoUser ? [...current, newTask] : current)
    }
  }, [ownerId, canUseSupabase, isDemoUser, reportSupabaseError])

  const toggleInboxTask = useCallback(async (id) => {
    const task = inboxTasks.find(t => t.id === id)
    if (!task) return
    if (canUseSupabase) {
      try {
        const { error: updateError } = await supabase.from('inbox_tasks').update({ completed: !task.completed }).eq('id', id)
        if (updateError) throw updateError
        setInboxTasks((current) => current.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
      } catch (err) {
        reportSupabaseError(err, 'Could not update inbox task.')
      }
    } else {
      setInboxTasks((current) => isDemoUser ? current.map(t => t.id === id ? { ...t, completed: !t.completed } : t) : current)
    }
  }, [canUseSupabase, isDemoUser, inboxTasks, reportSupabaseError])

  const deleteInboxTask = useCallback(async (id) => {
    if (canUseSupabase) {
      try {
        const { error: deleteError } = await supabase.from('inbox_tasks').delete().eq('id', id)
        if (deleteError) throw deleteError
        setInboxTasks((current) => current.filter((task) => task.id !== id))
      } catch (err) {
        reportSupabaseError(err, 'Could not delete inbox task.')
      }
    } else {
      setInboxTasks((current) => isDemoUser ? current.filter((task) => task.id !== id) : current)
    }
  }, [canUseSupabase, isDemoUser, reportSupabaseError])

  const scheduleInboxTask = useCallback(async (inboxTaskId, task) => {
    const newTask = normalizeScheduledTask({
      ...task,
      id: generateId(),
    })
    if (canUseSupabase) {
      try {
        await insertScheduledTask(newTask, ownerId)
        const { error: deleteError } = await supabase.from('inbox_tasks').delete().eq('id', inboxTaskId)
        if (deleteError) throw deleteError
        setScheduledTasks((current) => [...current, newTask])
        setInboxTasks((current) => current.filter((inboxTask) => inboxTask.id !== inboxTaskId))
      } catch (err) {
        reportSupabaseError(err, 'Could not schedule inbox task.')
      }
    } else {
      if (isDemoUser) {
        setScheduledTasks((current) => [...current, newTask])
        setInboxTasks((current) => current.filter((inboxTask) => inboxTask.id !== inboxTaskId))
      }
    }
  }, [ownerId, canUseSupabase, isDemoUser, reportSupabaseError])

  const shareScheduledTask = useCallback(async (taskId, recipientIdentifier) => {
    if (!canUseSupabase) {
      throw new Error('Supabase sync is not ready.')
    }
    const { data, error: rpcError } = await supabase.rpc('share_task_to_user', {
      p_task_id: taskId,
      p_recipient_identifier: recipientIdentifier,
    })
    if (rpcError) throw rpcError
    if (data && !data.success) {
      throw new Error(data.error || 'Failed to share task')
    }
    return data
  }, [canUseSupabase])

  return {
    scheduledTasks,
    inboxTasks,
    loading,
    error,
    addScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    addInboxTask,
    toggleInboxTask,
    deleteInboxTask,
    scheduleInboxTask,
    shareScheduledTask,
  }
}
