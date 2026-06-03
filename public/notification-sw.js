/* global clients */

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Antigravity Planner',
    body: 'You have a scheduled reminder.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
  }
  let payload

  try {
    payload = event.data?.json?.() || fallback
  } catch {
    payload = fallback
  }
  const title = payload.title || fallback.title
  const options = {
    body: payload.body || fallback.body,
    tag: payload.tag,
    renotify: Boolean(payload.tag),
    icon: payload.icon || fallback.icon,
    badge: payload.badge || fallback.badge,
    data: payload.data || {},
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const appClient = clientList.find((client) => 'focus' in client)

    if (appClient) {
      await appClient.focus()
      return
    }

    if (clients.openWindow) {
      await clients.openWindow('/')
    }
  })())
})
