/*
 * Daily reminder (ADR-018): loaded into the service worker (vite.config.ts → workbox.importScripts),
 * so it works while the app is closed. Shows the notification, sets the number on the app icon,
 * and opens the app when the notification is tapped.
 */

self.addEventListener('push', (event) => {
  let message = { title: 'Leitner', body: 'Your words are waiting.', badge: 0 };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Not JSON: keep the default text.
  }
  const badge = 'setAppBadge' in navigator
    ? message.badge > 0
      ? navigator.setAppBadge(message.badge)
      : navigator.clearAppBadge()
    : Promise.resolve();
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(message.title, {
        body: message.body,
        icon: 'icons/icon-192.png',
        tag: 'daily-reminder', // a new reminder replaces yesterday's
      }),
      badge.catch(() => {}),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => 'focus' in client);
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
