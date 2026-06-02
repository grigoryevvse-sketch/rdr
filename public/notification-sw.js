/* global clients */

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
