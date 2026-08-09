// ── Cache names ──────────────────────────────────────────────────────────────
const STATIC_CACHE = "scp-static-v3";
const DYNAMIC_CACHE = "scp-dynamic-v3";
const ALL_CACHES = [STATIC_CACHE, DYNAMIC_CACHE];

// Pages and assets to pre-cache on install
const PRECACHE = [
  "/",
  "/feed",
  "/dashboard",
  "/profiles",
  "/news",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate — clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes — network-only (never cache)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // Next.js static assets — network-first in dev (no content hashes), cache-first in prod
  if (url.pathname.startsWith("/_next/static/")) {
    const isDev = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
    if (isDev) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            return response;
          })
          .catch(() => caches.match(request).then((cached) => cached || new Response(null, { status: 503 })))
      );
    } else {
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
              return response;
            })
        )
      );
    }
    return;
  }

  // Static files (icons, images, fonts) — cache-first
  if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // HTML pages — network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "SCP Nova", body: event.data.text() };
  }

  const title = data.title || "Sports Content Playbook";
  const options = {
    body: data.body || data.message || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: [{ action: "open", title: "Veure" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
