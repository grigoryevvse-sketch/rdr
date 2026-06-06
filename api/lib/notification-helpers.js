import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { format, subMonths } from 'date-fns'

export const DUE_WINDOW_MS = 15 * 60_000

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin is not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function isCustomNotificationMoment(momentId) {
  return typeof momentId === 'string' && momentId.startsWith('custom:')
}

export function taskDateTimeUtc(task, timeZone = 'UTC') {
  if (!task?.date || !task?.start_time) return null

  const [year, month, day] = String(task.date).split('-').map(Number)
  const [hour, minute] = String(task.start_time).split(':').map(Number)

  if (![year, month, day, hour, minute].every(Number.isFinite)) return null

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offset = getTimeZoneOffset(utcGuess, timeZone)
  const date = new Date(utcGuess - offset)

  return Number.isNaN(date.getTime()) ? null : date
}

export function getMomentDate(task, momentId, timeZone) {
  const start = taskDateTimeUtc(task, timeZone)
  if (!start) return null

  if (isCustomNotificationMoment(momentId)) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return new Date(start.getTime() - minutes * 60_000)
  }

  if (momentId === 'before10') return new Date(start.getTime() - 10 * 60_000)
  if (momentId === 'before60') return new Date(start.getTime() - 60 * 60_000)
  if (momentId === 'before1day') return new Date(start.getTime() - 24 * 60 * 60_000)
  if (momentId === 'before2days') return new Date(start.getTime() - 2 * 24 * 60 * 60_000)
  if (momentId === 'before1week') return new Date(start.getTime() - 7 * 24 * 60 * 60_000)
  if (momentId === 'before1month') {
    const reminderDate = format(subMonths(parseTaskLocalDate(task), 1), 'yyyy-MM-dd')
    return taskDateTimeUtc({ ...task, date: reminderDate }, timeZone)
  }
  if (momentId === 'finish') return new Date(start.getTime() + (Number(task.duration) || 0) * 60_000)
  return start
}

export function notificationKey(task, momentId) {
  return `${task.id}:${task.date}:${task.start_time}:${task.duration}:${momentId}`
}

export function isDue(triggerAt, now = Date.now()) {
  const delta = triggerAt.getTime() - now
  return delta <= 0 && delta > -DUE_WINDOW_MS
}

export function getMomentTitle(momentId, task) {
  if (isCustomNotificationMoment(momentId)) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return `${task.title} starts in ${formatTelegramLeadTime(minutes)}`
  }
  if (momentId === 'before10') return `${task.title} starts in 10 minutes`
  if (momentId === 'before60') return `${task.title} starts in 1 hour`
  if (momentId === 'before1day') return `${task.title} starts in 1 day`
  if (momentId === 'before2days') return `${task.title} starts in 2 days`
  if (momentId === 'before1week') return `${task.title} starts in 1 week`
  if (momentId === 'before1month') return `${task.title} starts in 1 month`
  if (momentId === 'finish') return `${task.title} is finished`
  return `${task.title} is starting`
}

export function getMomentBody(momentId) {
  if (momentId === 'finish') return 'Your planned time for this task has ended.'
  if (momentId === 'start') return 'Time to begin this task.'
  return 'Upcoming task reminder.'
}

export function getTelegramMomentText(momentId, task) {
  if (isCustomNotificationMoment(momentId)) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return `${task.title} starts in ${formatTelegramLeadTime(minutes)}`
  }
  if (momentId === 'before10') return `${task.title} starts in 10 minutes`
  if (momentId === 'before60') return `${task.title} starts in 1 hour`
  if (momentId === 'before1day') return `${task.title} starts in 1 day`
  if (momentId === 'before2days') return `${task.title} starts in 2 days`
  if (momentId === 'before1week') return `${task.title} starts in 1 week`
  if (momentId === 'before1month') return `${task.title} starts in 1 month`
  if (momentId === 'finish') return `${task.title} is finished`
  return `${task.title} starts now`
}

export async function sendTelegramMessage(text, chatId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('Telegram is not configured')

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.description || 'Telegram request failed')
  }
}

export async function sendWebPush(subscription, payload) {
  const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com'
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured')
  }

  const endpoint = subscription?.endpoint
  const receiverPublicKey = base64UrlToBuffer(subscription?.keys?.p256dh)
  const authSecret = base64UrlToBuffer(subscription?.keys?.auth)

  if (!endpoint || !receiverPublicKey.length || !authSecret.length) {
    throw new Error('Invalid push subscription')
  }

  const audience = new URL(endpoint).origin
  const jwt = createVapidJwt({ audience, subject, publicKey, privateKey })
  const encrypted = encryptPushPayload(JSON.stringify(payload), receiverPublicKey, authSecret)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '2419200',
    },
    body: encrypted,
  })

  if (!response.ok) {
    throw new Error(`Push request failed with ${response.status}`)
  }
}

function getTimeZoneOffset(timestamp, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value])
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )

  return asUtc - timestamp
}

function parseTaskLocalDate(task) {
  const [year, month, day] = String(task.date).split('-').map(Number)
  return new Date(year, month - 1, day)
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

function createVapidJwt({ audience, subject, publicKey, privateKey }) {
  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const body = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }))
  const signingInput = `${header}.${body}`
  const keyObject = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateKey,
      x: publicKeyToJwkPoint(publicKey).x,
      y: publicKeyToJwkPoint(publicKey).y,
    },
    format: 'jwk',
  })
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: keyObject,
    dsaEncoding: 'ieee-p1363',
  })

  return `${signingInput}.${base64UrlEncode(signature)}`
}

function encryptPushPayload(message, receiverPublicKey, authSecret) {
  const salt = crypto.randomBytes(16)
  const ecdh = crypto.createECDH('prime256v1')
  const serverPublicKey = ecdh.generateKeys()
  const sharedSecret = ecdh.computeSecret(receiverPublicKey)
  const prk = hkdfExtract(authSecret, sharedSecret)
  const context = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    receiverPublicKey,
    serverPublicKey,
  ])
  const ikm = hkdfExpand(prk, context, 32)
  const cek = hkdfExpand(hkdfExtract(salt, ikm), Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdfExpand(hkdfExtract(salt, ikm), Buffer.from('Content-Encoding: nonce\0'), 12)
  const plaintext = Buffer.concat([Buffer.from(message), Buffer.from([0x02])])
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
  const recordSize = Buffer.alloc(4)
  recordSize.writeUInt32BE(4096, 0)

  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    encrypted,
  ])
}

function hkdfExtract(salt, ikm) {
  return crypto.createHmac('sha256', salt).update(ikm).digest()
}

function hkdfExpand(prk, info, length) {
  const blocks = []
  let previous = Buffer.alloc(0)
  let counter = 1

  while (Buffer.concat(blocks).length < length) {
    previous = crypto
      .createHmac('sha256', prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest()
    blocks.push(previous)
    counter += 1
  }

  return Buffer.concat(blocks).subarray(0, length)
}

function publicKeyToJwkPoint(publicKey) {
  const bytes = base64UrlToBuffer(publicKey)
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Invalid VAPID public key')

  return {
    x: base64UrlEncode(bytes.subarray(1, 33)),
    y: base64UrlEncode(bytes.subarray(33, 65)),
  }
}

function base64UrlToBuffer(value = '') {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  return Buffer.from(padded, 'base64')
}

function base64UrlEncode(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value)
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
