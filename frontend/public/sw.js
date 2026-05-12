self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Pulse";
  const iconUrl = new URL("favicon.svg", self.registration.scope).toString();
  const options = {
    body: payload.body || payload.message || "",
    data: payload,
    icon: iconUrl,
    badge: iconUrl,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.registration.scope));
});
