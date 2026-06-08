import crypto from 'node:crypto'

const TOKEN_TTL_MS = 10 * 60 * 1000

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function getSecret() {
  const secret = process.env.ACCOUNT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TELEGRAM_BOT_TOKEN
  if (!secret) throw new Error('Account linking is not configured')
  return secret
}

function sign(payload) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url')
}

export function createAccountLinkToken({ primaryUserId, telegramUserId }) {
  const payload = base64UrlEncode(JSON.stringify({
    primaryUserId,
    telegramUserId: String(telegramUserId),
    exp: Date.now() + TOKEN_TTL_MS,
  }))

  return `${payload}.${sign(payload)}`
}

export function verifyAccountLinkToken(token) {
  const [payload, signature] = String(token || '').split('.')

  if (!payload || !signature) {
    throw new Error('Account link token is invalid')
  }

  const expected = sign(payload)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error('Account link token signature is invalid')
  }

  const data = JSON.parse(base64UrlDecode(payload))

  if (!data?.primaryUserId || !data?.exp || Date.now() > Number(data.exp)) {
    throw new Error('Account link token is expired')
  }

  return data
}
