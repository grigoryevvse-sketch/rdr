import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import telegramAuthHandler from './api/telegram-auth.js'
import telegramReminderHandler from './api/telegram-reminder.js'

function localApiPlugin() {
  return {
    name: 'local-api',
    configureServer(server) {
      const env = loadEnv('', process.cwd(), '')
      process.env.VITE_SUPABASE_URL ||= env.VITE_SUPABASE_URL
      process.env.SUPABASE_URL ||= env.SUPABASE_URL
      process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY
      process.env.TELEGRAM_BOT_TOKEN ||= env.TELEGRAM_BOT_TOKEN
      process.env.TELEGRAM_CHAT_ID ||= env.TELEGRAM_CHAT_ID

      server.middlewares.use('/api/telegram-auth', (request, response) => {
        telegramAuthHandler(request, response)
      })

      server.middlewares.use('/api/telegram-reminder', (request, response) => {
        telegramReminderHandler(request, response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5180,
    allowedHosts: true,
  },
})
