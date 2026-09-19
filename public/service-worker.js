/* Service worker for push notifications */
self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? String(event.data) : 'New notification' };
  }

  const title = data.title || 'New message';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    data: data,
    badge: data.badge || '/favicon.png',
    tag: data.tag || data.type || 'metoyou-notification',
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.requireInteraction),
    actions: Array.isArray(data.actions) ? data.actions : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var notificationData = event.notification.data || {};
  var actionTarget = notificationData.actionUrls && notificationData.actionUrls[event.action];
  var targetUrl = actionTarget || notificationData.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && client.url !== targetUrl) return client.navigate(targetUrl).then(function () { return client.focus(); });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
