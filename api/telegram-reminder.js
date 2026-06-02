const TELEGRAM_API_BASE = 'https://api.telegram.org'

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

  const text = String(body?.text || '').trim()
  const chatId = String(body?.chatId || process.env.TELEGRAM_CHAT_ID || '').trim()

  if (!text) {
    sendJson(response, 400, { error: 'Message text is required' })
    return
  }

  if (!/^-?\d+$/.test(chatId)) {
    sendJson(response, 400, { error: 'Telegram chat ID is required' })
    return
  }

  try {
    const telegramResponse = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    })

    const result = await telegramResponse.json().catch(() => null)

    if (!telegramResponse.ok) {
      sendJson(response, telegramResponse.status, {
        error: result?.description || 'Telegram request failed',
      })
      return
    }

    sendJson(response, 200, { ok: true })
  } catch {
    sendJson(response, 502, { error: 'Telegram request failed' })
  }
}
