import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import telegramReminderHandler from './api/telegram-reminder.js'

function telegramReminderApiPlugin() {
  return {
    name: 'telegram-reminder-api',
    configureServer(server) {
      const env = loadEnv('', process.cwd(), '')
      process.env.TELEGRAM_BOT_TOKEN ||= env.TELEGRAM_BOT_TOKEN
      process.env.TELEGRAM_CHAT_ID ||= env.TELEGRAM_CHAT_ID

      server.middlewares.use('/api/telegram-reminder', (request, response) => {
        telegramReminderHandler(request, response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), telegramReminderApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5180,
    allowedHosts: true,
  },
})
