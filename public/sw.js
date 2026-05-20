self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = getPushPayload(event);
  const title = payload.title || "Depclean";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-icon-192.png",
    badge: payload.badge || "/pwa-maskable-192.png",
    tag: payload.tag || "depclean-notification",
    data: {
      url: payload.url || "/notificacoes",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationId = event.notification.data?.notificationId;
  const target = new URL(event.notification.data?.url || "/notificacoes", self.location.origin);
  if (notificationId) {
    target.searchParams.set("readNotification", notificationId);
  }
  const targetUrl = target.href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;

      client.postMessage({
        type: "DEPCLEAN_PUSH_NOTIFICATION_CLICKED",
        notificationId,
      });
      await client.navigate(targetUrl);
      return client.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(fetch(event.request));
});

function getPushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch {
    return {
      body: event.data.text(),
    };
  }
}
