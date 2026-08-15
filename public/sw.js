// Fuhrpark-Manager Service Worker.
//
// Bewusst zurückhaltend: Seiten und API-Antworten enthalten personenbezogene
// Fuhrparkdaten und werden deshalb NIE zwischengespeichert. Gecacht werden
// ausschließlich versionierte statische Dateien sowie eine Offline-Seite,
// damit die App im Standalone-Modus ohne Netz nicht leer bleibt.

const CACHE = "fuhrpark-static-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// --- Push-Benachrichtigungen ------------------------------------------------

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Fuhrpark-Manager", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Fuhrpark-Manager", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Gleicher Tag = neue Meldung ersetzt die alte, statt sie zu stapeln.
      tag: payload.tag || "fuhrpark",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Bereits offenes Fenster wiederverwenden statt ein zweites zu öffnen.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe: immer aus dem Netz, offline die Hinweisseite zeigen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())),
    );
    return;
  }

  // Versionierte Build-Assets und Icons dürfen aus dem Cache kommen.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname) ||
    url.pathname.endsWith(".png");

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
