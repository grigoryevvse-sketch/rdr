# React + Vite

Deployment trigger: Vercel PR refresh.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Supabase setup

Task data is stored in Supabase for signed-in users. Browser task storage is only read once to migrate older local tasks after the user signs in.

1. Create or open your Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.
4. Restart the dev server and sign in with Google.

After a successful migration, the app removes the old browser task keys. Demo mode is temporary and does not persist tasks.

## Telegram Mini App sign-in

When the app is opened inside Telegram, it signs in with Telegram WebApp `initData` instead of sending Google OAuth through Telegram's built-in browser.

1. Add your bot token to the deployment environment as `TELEGRAM_BOT_TOKEN`.
2. Add `SUPABASE_SERVICE_ROLE_KEY` so `/api/telegram-auth` can create a one-time Supabase login token.
3. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured for the browser client.
4. Enable manual identity linking in Supabase Auth settings so Telegram users can connect Google from Settings.

Google sign-in still works normally when the app is opened in Safari, Chrome, or a desktop browser.

Telegram users can connect Google from Settings. The app opens a normal browser, signs into the same Supabase user with a one-time token, then links the Google identity so both sign-in methods share the same Reminder tasks.

## Always-on notifications

Telegram and browser push reminders are sent by the server, so they can still arrive after the app tab is closed.

1. Run `supabase-server-notifications.sql` in the Supabase SQL editor if your project already had the base schema.
2. Add these environment variables in your deployment:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`, for example `mailto:you@example.com`
   - `CRON_SECRET`, optional for protecting manual cron calls
3. Add `VITE_VAPID_PUBLIC_KEY` with the same value as `VAPID_PUBLIC_KEY`.
4. Redeploy the app.
5. In cron-job.org, create a monitor that calls `https://YOUR_DOMAIN/api/notification-cron` every 1-5 minutes with the `GET` method. If you set `CRON_SECRET` in Vercel, call `https://YOUR_DOMAIN/api/notification-cron?secret=YOUR_CRON_SECRET` instead.
6. A successful cron run returns JSON like `{ "ok": true, "checked": 1, "delivered": 1, "skipped": 0, "failed": 0 }`.

You can generate VAPID keys with any standard Web Push key generator, then paste the public key into both `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY`.
