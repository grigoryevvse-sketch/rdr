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

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const url = new URL(request.url || '/', 'http://localhost')
  const querySecret = url.searchParams.get('secret')

  return request.headers.authorization === `Bearer ${cronSecret}` || querySecret === cronSecret
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
  const tomorrow = new Date(now + 24 * 60 * 60_000).toISOString().slice(0, 10)
  const yesterday = new Date(now - 24 * 60 * 60_000).toISOString().slice(0, 10)

  const [{ data: tasks, error: tasksError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from('scheduled_tasks')
      .select('id,user_id,title,date,start_time,duration,completed,notification_moments')
      .eq('completed', false)
      .gte('date', yesterday)
      .lte('date', tomorrow),
    supabase
      .from('notification_settings')
      .select('user_id,browser_enabled,telegram_enabled,telegram_chat_id,default_moments,time_zone'),
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

  for (const task of tasks || []) {
    const userSettings = settingsByUser.get(task.user_id)
    if (!userSettings?.browser_enabled && !userSettings?.telegram_enabled) continue

    const moments = Array.isArray(task.notification_moments) && task.notification_moments.length
      ? task.notification_moments
      : userSettings.default_moments || DEFAULT_MOMENTS

    for (const momentId of moments) {
      const triggerAt = getMomentDate(task, momentId, userSettings.time_zone || 'UTC')
      checked += 1

      if (!triggerAt || !isDue(triggerAt, now)) continue

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
        await deliverNotification(supabase, userSettings, task, momentId, key)
        delivered += 1
      } catch (error) {
        failed += 1
        await supabase
          .from('notification_deliveries')
          .update({ error: error.message || 'Notification delivery failed' })
          .eq('notification_key', key)
      }
    }
  }

  sendJson(response, 200, { ok: true, checked, delivered, skipped, failed })
}

async function deliverNotification(supabase, settings, task, momentId, key) {
  const deliveries = []

  if (settings.telegram_enabled && settings.telegram_chat_id) {
    deliveries.push(sendTelegramMessage(getTelegramMomentText(momentId, task), settings.telegram_chat_id))
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
          title: getMomentTitle(momentId, task),
          body: getMomentBody(momentId),
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

  if (!deliveries.length) return
  const results = await Promise.allSettled(deliveries)
  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(results[0].reason?.message || 'Notification delivery failed')
  }
}
