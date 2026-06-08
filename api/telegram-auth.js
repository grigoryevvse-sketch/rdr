import crypto from 'node:crypto'
import { createAccountLinkToken } from './lib/account-link-token.js'
import { createSupabaseAdmin } from './lib/notification-helpers.js'

const TELEGRAM_AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  return rawBody ? JSON.parse(rawBody) : {}
}

function parseTelegramInitData(initData) {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')

  if (!hash) {
    throw new Error('Telegram auth hash is missing')
  }

  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const userRaw = params.get('user')
  const authDate = Number(params.get('auth_date') || 0) * 1000

  if (!userRaw) {
    throw new Error('Telegram user data is missing')
  }

  if (!authDate || Date.now() - authDate > TELEGRAM_AUTH_MAX_AGE_MS) {
    throw new Error('Telegram auth data is expired')
  }

  return {
    hash,
    dataCheckString,
    user: JSON.parse(userRaw),
  }
}

function verifyTelegramInitData(initData, botToken) {
  const { hash, dataCheckString, user } = parseTelegramInitData(initData)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  const expected = Buffer.from(calculatedHash, 'hex')
  const received = Buffer.from(hash, 'hex')

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new Error('Telegram auth signature is invalid')
  }

  if (!Number.isFinite(Number(user?.id))) {
    throw new Error('Telegram user ID is missing')
  }

  return user
}

function getTelegramEmail(telegramUserId) {
  return `telegram-${telegramUserId}@telegram.reminder.local`
}

function getTelegramDisplayName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || `Telegram ${user.id}`
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    sendJson(response, 500, { error: 'Telegram is not configured' })
    return
  }

  let body

  try {
    body = await readBody(request)
  } catch {
    sendJson(response, 400, { error: 'Invalid JSON body' })
    return
  }

  const initData = String(body?.initData || '')

  if (!initData) {
    sendJson(response, 400, { error: 'Telegram auth data is required' })
    return
  }

  let telegramUser

  try {
    telegramUser = verifyTelegramInitData(initData, botToken)
  } catch (error) {
    sendJson(response, 401, { error: error.message || 'Telegram auth data is invalid' })
    return
  }

  const email = getTelegramEmail(telegramUser.id)
  const userMetadata = {
    provider: 'telegram',
    telegram_id: String(telegramUser.id),
    telegram_username: telegramUser.username || null,
    full_name: getTelegramDisplayName(telegramUser),
    avatar_url: telegramUser.photo_url || null,
  }

  try {
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: userMetadata,
      },
    })

    if (error) {
      throw error
    }

    sendJson(response, 200, {
      email,
      linkToken: createAccountLinkToken({
        primaryUserId: data.user.id,
        telegramUserId: telegramUser.id,
      }),
      tokenHash: data.properties.hashed_token,
      verificationType: data.properties.verification_type,
    })
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Could not create Telegram session' })
  }
}
