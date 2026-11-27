// Service worker: only for the admins' notifications on the Mac (Web Push from the Edge Function admin-push).
// No caching: the website works exactly as without it.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "SCP", body: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "SCP", {
    body: d.body || "", tag: d.tag, icon: "/assets/apple-touch-icon-s.png", badge: "/assets/apple-touch-icon-s.png", data: { url: d.url || "/admin/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/admin/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.location.origin));
    return open ? open.navigate(url).then((c) => (c || open).focus()) : self.clients.openWindow(url);
  }));
});
