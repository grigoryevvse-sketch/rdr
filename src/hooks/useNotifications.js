import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_NOTIFICATION_MOMENTS } from '../utils/constants'
import { formatMinutesBefore, isCustomNotificationMoment } from '../utils/notificationUtils'
import { sendTelegramReminder } from '../utils/telegramUtils'

const MAX_TIMEOUT_MS = 2_147_483_647
const DUE_CHECK_INTERVAL_MS = 15_000
const MISSED_NOTIFICATION_GRACE_MS = 5 * 60_000
const START_SOUND_FREQUENCIES = [880, 1174.66, 1567.98]

function getPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function taskDateTime(task) {
  if (!task?.date || !task?.start_time) return null
  const date = new Date(`${task.date}T${task.start_time}:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getMomentDate(task, momentId) {
  const start = taskDateTime(task)
  if (!start) return null

  if (isCustomNotificationMoment(momentId)) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return new Date(start.getTime() - minutes * 60_000)
  }
  if (momentId === 'before10') return new Date(start.getTime() - 10 * 60_000)
  if (momentId === 'before60') return new Date(start.getTime() - 60 * 60_000)
  if (momentId === 'finish') return new Date(start.getTime() + (Number(task.duration) || 0) * 60_000)
  return start
}

function getMomentTitle(momentId, task) {
  if (isCustomNotificationMoment(momentId)) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return `${task.title} starts in ${formatMinutesBefore(minutes).replace(' before', '')}`
  }
  if (momentId === 'before10') return `${task.title} starts in 10 minutes`
  if (momentId === 'before60') return `${task.title} starts in 1 hour`
  if (momentId === 'finish') return `${task.title} is finished`
  return `${task.title} is starting`
}

function getMomentBody(momentId) {
  if (momentId === 'finish') return 'Your planned time for this task has ended.'
  if (momentId === 'start') return 'Time to begin this task.'
  return 'Upcoming task reminder.'
}

function formatTelegramLeadTime(minutes) {
  const value = Number(minutes) || 0

  if (value < 60) return `${value} ${value === 1 ? 'minute' : 'minutes'}`
  if (value % 60 === 0) {
    const hours = value / 60
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }

  const hours = Math.floor(value / 60)
  const rest = value % 60
  return `${hours} hr ${rest} min`
}

function getTelegramMomentText(momentId, task) {
  if (isCustomNotificationMoment(momentId)) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return `${task.title} starts in ${formatTelegramLeadTime(minutes)}`
  }
  if (momentId === 'before10') return `${task.title} starts in 10 minutes`
  if (momentId === 'before60') return `${task.title} starts in 1 hour`
  if (momentId === 'finish') return `${task.title} is finished`
  return `${task.title} starts now`
}

export function useNotificationScheduler(tasks, settings) {
  const timeoutIdsRef = useRef([])
  const intervalIdRef = useRef(null)
  const audioContextRef = useRef(null)
  const firedRef = useRef(new Set())
  const [permission, setPermission] = useState(getPermission)
  const supported = permission !== 'unsupported'

  const getAudioContext = useCallback(() => {
    if (!('AudioContext' in window) && !('webkitAudioContext' in window)) return null

    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContextCtor()
    }

    return audioContextRef.current
  }, [])

  const unlockSound = useCallback(() => {
    const audioContext = getAudioContext()
    if (audioContext?.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
  }, [getAudioContext])

  const playStartSound = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {})
      return
    }

    const now = audioContext.currentTime
    const masterGain = audioContext.createGain()
    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95)
    masterGain.connect(audioContext.destination)

    START_SOUND_FREQUENCIES.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const noteGain = audioContext.createGain()
      const startAt = now + index * 0.16
      const endAt = startAt + 0.32

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, startAt)
      noteGain.gain.setValueAtTime(0.0001, startAt)
      noteGain.gain.exponentialRampToValueAtTime(1, startAt + 0.03)
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt)

      oscillator.connect(noteGain)
      noteGain.connect(masterGain)
      oscillator.start(startAt)
      oscillator.stop(endAt + 0.02)
    })
  }, [getAudioContext])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/notification-sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, unlockSound, { passive: true }))

    return () => {
      events.forEach((event) => window.removeEventListener(event, unlockSound))
    }
  }, [unlockSound])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return 'unsupported'
    }

    unlockSound()
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [unlockSound])

  const showNotification = useCallback(async (title, options) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null)
      if (registration?.showNotification) {
        await registration.showNotification(title, options)
        return
      }
    }

    new Notification(title, options)
  }, [])

  useEffect(() => {
    timeoutIdsRef.current.forEach(clearTimeout)
    timeoutIdsRef.current = []
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }

    const telegramChatId = String(settings?.telegramChatId || '').trim()
    const telegramEnabled = Boolean(settings?.telegramEnabled && telegramChatId)
    const browserEnabled = settings?.enabled && permission === 'granted'

    if (!browserEnabled && !telegramEnabled) return

    const scheduledNotifications = []
    const queueNotification = (task, momentId, key) => {
      if (momentId === 'start') playStartSound()

      if (browserEnabled) {
        showNotification(getMomentTitle(momentId, task), {
          body: getMomentBody(momentId),
          tag: key,
          renotify: true,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          data: { taskId: task.id, date: task.date },
        })
      }

      if (telegramEnabled) {
        sendTelegramReminder(getTelegramMomentText(momentId, task), telegramChatId).catch(() => {})
      }
    }
    const fireIfDue = (notification, now = Date.now()) => {
      const delay = notification.triggerAt.getTime() - now
      const isDue = delay <= 0 && delay >= -MISSED_NOTIFICATION_GRACE_MS

      if (!isDue || firedRef.current.has(notification.key)) return

      firedRef.current.add(notification.key)
      queueNotification(notification.task, notification.momentId, notification.key)
    }

    tasks.forEach((task) => {
      if (task.completed) return

      const moments = Array.isArray(task.notification_moments)
        ? task.notification_moments
        : settings.defaultMoments || DEFAULT_NOTIFICATION_MOMENTS

      moments.forEach((momentId) => {
        const triggerAt = getMomentDate(task, momentId)
        if (!triggerAt) return

        const key = `${task.id}:${task.date}:${task.start_time}:${task.duration}:${momentId}`
        const notification = { task, momentId, triggerAt, key }
        const delay = triggerAt.getTime() - Date.now()
        scheduledNotifications.push(notification)

        if (delay > 0 && delay <= MAX_TIMEOUT_MS) {
          const timeoutId = window.setTimeout(() => {
            fireIfDue(notification)
          }, delay)

          timeoutIdsRef.current.push(timeoutId)
        } else {
          fireIfDue(notification)
        }
      })
    })

    intervalIdRef.current = window.setInterval(() => {
      const now = Date.now()
      scheduledNotifications.forEach((notification) => fireIfDue(notification, now))
    }, DUE_CHECK_INTERVAL_MS)

    return () => {
      timeoutIdsRef.current.forEach(clearTimeout)
      timeoutIdsRef.current = []
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [tasks, settings, permission, showNotification, playStartSound])

  return {
    permission,
    supported,
    requestPermission,
  }
}
