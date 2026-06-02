export async function sendTelegramReminder(text, chatId) {
  if (!text || !chatId) return false

  try {
    const response = await fetch('/api/telegram-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, chatId }),
    })

    return response.ok
  } catch {
    return false
  }
}
