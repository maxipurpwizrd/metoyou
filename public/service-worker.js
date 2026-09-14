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
    icon: data.icon || '/logo192.png',
    data: data,
    badge: data.badge || '/favicon.ico',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';
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
