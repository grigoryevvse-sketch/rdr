import {
  createSupabaseAdmin,
  getMomentBody,
  getMomentDate,
  getMomentTitle,
  getTelegramMomentText,
  isDue,
  notificationKey,
  sendTelegramMessage,
  sendWebPush,
} from './lib/notification-helpers.js'

const DEFAULT_MOMENTS = ['start']
const TASK_LOOKBACK_DAYS = 2
const TASK_LOOKAHEAD_DAYS = 32
const DEFAULT_TIME_ZONE = process.env.DEFAULT_TIME_ZONE || 'Europe/Prague'

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers['x-vercel-cron'] === '1'

  if (isVercelCron) return true
  if (!cronSecret) return true

  const url = new URL(request.url || '/', 'http://localhost')
  const querySecret = url.searchParams.get('secret')

  return request.headers.authorization === `Bearer ${cronSecret}` || querySecret === cronSecret
}

function getSettingsForTask(settingsByUser, task) {
  const userSettings = settingsByUser.get(task.user_id)
  const fallbackTelegramChatId = String(process.env.TELEGRAM_CHAT_ID || '').trim()

  if (userSettings) {
    const shouldUseTelegramFallback = Boolean(fallbackTelegramChatId && !userSettings.telegram_chat_id)

    return {
      ...userSettings,
      telegram_enabled: Boolean(userSettings.telegram_enabled || shouldUseTelegramFallback),
      telegram_chat_id: userSettings.telegram_chat_id || fallbackTelegramChatId || '',
      time_zone: userSettings.time_zone || DEFAULT_TIME_ZONE,
      language: userSettings.language === 'ru' ? 'ru' : 'en',
    }
  }

  return {
    user_id: task.user_id,
    browser_enabled: false,
    telegram_enabled: Boolean(fallbackTelegramChatId),
    telegram_chat_id: fallbackTelegramChatId,
    default_moments: DEFAULT_MOMENTS,
    time_zone: DEFAULT_TIME_ZONE,
    language: 'en',
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { error: 'Unauthorized' })
    return
  }

  let supabase

  try {
    supabase = createSupabaseAdmin()
  } catch (error) {
    sendJson(response, 500, { error: error.message })
    return
  }

  const now = Date.now()
  const maxTaskDate = new Date(now + TASK_LOOKAHEAD_DAYS * 24 * 60 * 60_000).toISOString().slice(0, 10)
  const minTaskDate = new Date(now - TASK_LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString().slice(0, 10)

  const [{ data: tasks, error: tasksError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from('scheduled_tasks')
      .select('id,user_id,title,date,start_time,duration,completed,notification_moments')
      .eq('completed', false)
      .gte('date', minTaskDate)
      .lte('date', maxTaskDate),
    supabase
      .from('notification_settings')
      .select('user_id,browser_enabled,telegram_enabled,telegram_chat_id,default_moments,time_zone,language'),
  ])

  if (tasksError || settingsError) {
    sendJson(response, 500, { error: tasksError?.message || settingsError?.message })
    return
  }

  const settingsByUser = new Map((settings || []).map((row) => [row.user_id, row]))
  let checked = 0
  let delivered = 0
  let skipped = 0
  let failed = 0
  let due = 0

  for (const task of tasks || []) {
    const userSettings = getSettingsForTask(settingsByUser, task)
    if (!userSettings?.browser_enabled && !userSettings?.telegram_enabled) continue

    const moments = Array.isArray(task.notification_moments) && task.notification_moments.length
      ? task.notification_moments
      : userSettings.default_moments || DEFAULT_MOMENTS

    for (const momentId of moments) {
      const triggerAt = getMomentDate(task, momentId, userSettings.time_zone || 'UTC')
      checked += 1

      if (!triggerAt || !isDue(triggerAt, now)) continue
      due += 1

      const key = notificationKey(task, momentId)
      const { error: deliveryError } = await supabase
        .from('notification_deliveries')
        .insert({
          notification_key: key,
          user_id: task.user_id,
          task_id: task.id,
          moment_id: momentId,
          trigger_at: triggerAt.toISOString(),
        })

      if (deliveryError) {
        skipped += 1
        continue
      }

      try {
        const sentCount = await deliverNotification(supabase, userSettings, task, momentId, key)
        if (sentCount < 1) throw new Error('No notification channel is available')
        delivered += 1
      } catch {
        failed += 1
        await supabase
          .from('notification_deliveries')
          .delete()
          .eq('notification_key', key)
      }
    }
  }

  sendJson(response, 200, { ok: true, checked, due, delivered, skipped, failed })
}

async function deliverNotification(supabase, settings, task, momentId, key) {
  const deliveries = []

  if (settings.telegram_enabled && settings.telegram_chat_id) {
    deliveries.push(sendTelegramMessage(getTelegramMomentText(momentId, task, settings.language), settings.telegram_chat_id))
  }

  if (settings.browser_enabled) {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id,subscription')
      .eq('user_id', task.user_id)
      .eq('enabled', true)

    for (const row of subscriptions || []) {
      deliveries.push(
        sendWebPush(row.subscription, {
          title: getMomentTitle(momentId, task, settings.language),
          body: getMomentBody(momentId, settings.language),
          tag: key,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          data: { taskId: task.id, date: task.date },
        }).catch(async (error) => {
          if (/410|404/.test(error.message)) {
            await supabase.from('push_subscriptions').update({ enabled: false }).eq('id', row.id)
          }
          throw error
        })
      )
    }
  }

  if (!deliveries.length) return 0
  const results = await Promise.allSettled(deliveries)
  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(results[0].reason?.message || 'Notification delivery failed')
  }

  return results.filter((result) => result.status === 'fulfilled').length
}
