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
      // iPhone ignores `tag` replacement, so yesterday's reminders piled up on the lock screen
      // (bug 1, 2026-11-09): close the earlier ones first, so only today's stays.
      self.registration
        .getNotifications()
        .catch(() => [])
        .then((earlier) => {
          for (const old of earlier) old.close();
          return self.registration.showNotification(message.title, {
            body: message.body,
            icon: 'icons/icon-192.png',
            tag: 'daily-reminder', // replaces yesterday's where the browser supports it
          });
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
