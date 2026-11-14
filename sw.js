// Network-first service worker: always picks up new deploys, falls back to cache when offline.
const CACHE = "today-v24";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("index.html")))
  );
});

/* ---- background alerts: schedule from the page, fire when the browser wakes us ---- */
const SCH = "today-sched";
async function schGet() { try { const r = await (await caches.open(SCH)).match("s"); return r ? await r.json() : { items: [], shown: [] }; } catch (e) { return { items: [], shown: [] }; } }
async function schPut(d) { try { await (await caches.open(SCH)).put("s", new Response(JSON.stringify(d))); } catch (e) {} }
async function schFire() {
  const d = await schGet(), now = Date.now(); let ch = false;
  for (const it of d.items) { const key = it.at + it.title; if (it.at <= now && now - it.at < 15 * 6e4 && !d.shown.includes(key)) { d.shown.push(key); ch = true; await self.registration.showNotification(it.title, { body: it.body, icon: "icon-192.png", badge: "icon-192.png", tag: "tdy-" + it.at, requireInteraction: true }); } }
  d.shown = d.shown.slice(-100); if (ch) await schPut(d);
}
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "sched") {
    e.waitUntil((async () => { const old = await schGet(); await schPut({ items: e.data.items || [], shown: old.shown }); await schFire();
      for (const it of e.data.items || []) { const w = it.at - Date.now(); if (w > 0 && w < 25000) await new Promise((r) => setTimeout(r, w)).then(schFire); } })());
  }
});
self.addEventListener("periodicsync", (e) => { if (e.tag === "today-check") e.waitUntil(schFire()); });
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => (l[0] ? l[0].focus() : clients.openWindow("./"))));
});
