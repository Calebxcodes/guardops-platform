/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & typeof globalThis

// Take control immediately on install/activate
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Inject precache manifest (replaced by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST)

// Runtime: API requests — network first, 8s timeout
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 8 })
)

// ── Push notification handler ─────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  let data: {
    title?: string
    body?: string
    url?: string
    tag?: string
    requireInteraction?: boolean
    urgency?: string
  } = {}

  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'Strondis Guard', body: event.data?.text() ?? '' }
  }

  const title = data.title || 'Strondis Guard'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: data.tag || 'strondis-guard',
    requireInteraction: data.requireInteraction ?? (data.urgency === 'critical' || data.urgency === 'high'),
    silent: false,
    data: { url: data.url || '/' },
    // vibration pattern: buzz-pause-buzz for high urgency
    vibrate: data.urgency === 'critical' ? [200, 100, 200, 100, 200] : [100, 50, 100],
  } as NotificationOptions

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click handler ────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const targetUrl = (event.notification.data?.url as string) || '/'
  const origin = self.location.origin

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.startsWith(origin) && 'focus' in client) {
            client.focus()
            // Tell the app to navigate to the notification's target URL
            client.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl })
            return
          }
        }
        // Open a new window if the app isn't open
        if (self.clients.openWindow) {
          return self.clients.openWindow(origin + targetUrl)
        }
      })
  )
})

// ── Notification close handler (analytics / cleanup) ─────────────────────

self.addEventListener('notificationclose', (_event: NotificationEvent) => {
  // No-op — can be used for analytics later
})
