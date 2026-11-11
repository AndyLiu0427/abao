// Service worker: makes the app installable and delivers system notifications. No offline cache (the agent needs the network).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}
  const title = data.title || "阿寶";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "abao",
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 150, 300],
        data: { url: data.url || "/" },
      }),
      self.navigator.setAppBadge ? self.navigator.setAppBadge(1).catch(() => {}) : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
