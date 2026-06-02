import { useState, useEffect, useCallback } from 'react'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../supabase'
import { DEFAULT_SCHEDULED_TASKS, DEFAULT_INBOX_TASKS } from '../utils/constants'
import { generateId, formatDateISO } from '../utils/dateUtils'
import { getNextRepeatDate, isRepeatingTask } from '../utils/repeatUtils'

const LOCAL_SCHEDULED_TASKS_KEY = 'planner-scheduled'
const LOCAL_INBOX_TASKS_KEY = 'planner-inbox'
const LOCAL_NOTIFICATION_MOMENTS_KEY = 'planner-task-notification-moments'
const SUPABASE_REQUIRED_MESSAGE = 'Task sync requires Supabase. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the app.'

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
  return tasks.map((task) => ({
    ...task,
    completed: Boolean(task.completed),
    notification_moments: Array.isArray(task.notification_moments)
      ? task.notification_moments
      : saved[task.id],
  }))
}

function normalizeScheduledTask(task) {
  return {
    ...task,
    completed: Boolean(task.completed),
    repeat_frequency: task.repeat_frequency || 'none',
    repeat_interval: Math.max(Number(task.repeat_interval) || 1, 1),
    notification_moments: Array.isArray(task.notification_moments)
      ? task.notification_moments
      : undefined,
  }
}

async function insertScheduledTask(task, userId) {
  const { error } = await supabase
    .from('scheduled_tasks')
    .insert({ ...normalizeScheduledTask(task), user_id: userId })

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
      .filter((task) => task && typeof task.title === 'string' && typeof task.start_time === 'string')
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

  const reportSupabaseError = useCallback((err, fallbackMessage) => {
    const message = err?.message || fallbackMessage
    console.error(message, err)
    setError(message)
  }, [])

  const loadFromSupabase = useCallback(async () => {
    if (!supabase) return
    try {
      await migrateLocalTasksToSupabase(user.id)
      const [{ data: st }, { data: it }] = await Promise.all([
        supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).order('start_time'),
        supabase.from('inbox_tasks').select('*').eq('user_id', user.id).order('created_at'),
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
  }, [user])

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
          { event: '*', schema: 'public', table: 'scheduled_tasks', filter: `user_id=eq.${user.id}` },
          () => loadFromSupabase()
        )
        .subscribe()

      const inbox = supabase
        .channel('inbox-tasks')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'inbox_tasks', filter: `user_id=eq.${user.id}` },
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
  }, [user, canUseSupabase, isDemoUser, loadFromSupabase])

  // ─── Scheduled Task CRUD ───
  const addScheduledTask = useCallback(async (task) => {
    const newTask = normalizeScheduledTask({
      ...task,
      id: generateId(),
    })
    if (canUseSupabase) {
      try {
        await insertScheduledTask(newTask, user.id)
        setScheduledTasks((current) => [...current, newTask])
      } catch (err) {
        reportSupabaseError(err, 'Could not add scheduled task.')
      }
    } else {
      setScheduledTasks((current) => isDemoUser ? [...current, newTask] : current)
    }
  }, [user, canUseSupabase, isDemoUser, reportSupabaseError])

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
        if (nextRepeatTask) await insertScheduledTask(nextRepeatTask, user.id)
        applyLocalUpdate()
      } catch (err) {
        reportSupabaseError(err, 'Could not update scheduled task.')
      }
    } else {
      if (isDemoUser) applyLocalUpdate()
    }
  }, [user, canUseSupabase, isDemoUser, scheduledTasks, reportSupabaseError])

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
        const { error: insertError } = await supabase.from('inbox_tasks').insert({ ...newTask, user_id: user.id })
        if (insertError) throw insertError
        setInboxTasks((current) => [...current, newTask])
      } catch (err) {
        reportSupabaseError(err, 'Could not add inbox task.')
      }
    } else {
      setInboxTasks((current) => isDemoUser ? [...current, newTask] : current)
    }
  }, [user, canUseSupabase, isDemoUser, reportSupabaseError])

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
        await insertScheduledTask(newTask, user.id)
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
  }, [user, canUseSupabase, isDemoUser, reportSupabaseError])

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
  }
}
