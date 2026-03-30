// Service Worker - Mi Rehabilitación PWA
const CACHE_NAME = 'rehab-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ─── Instalación: cachear assets ─────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// ─── Activación: limpiar cachés antiguas ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: cache-first para assets locales ──────────────────────────────────
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones al mismo origen
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Sin conexión y sin caché: devolver index.html
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ─── Push: recibir notificaciones push del servidor (opcional) ────────────────
self.addEventListener('push', event => {
  let data = { title: '🏥 Mi Rehabilitación', body: '¡Hora de tus ejercicios!' };
  if (event.data) {
    try { data = event.data.json(); } catch { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon:    './icons/icon-192.png',
      badge:   './icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag:     'rehab-reminder',
      renotify: true,
      actions: [
        { action: 'open',   title: 'Abrir app' },
        { action: 'dismiss',title: 'Cerrar' },
      ],
    })
  );
});

// ─── Notificationclick: manejar clic en notificación ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const app = list.find(c => c.url.includes(self.location.origin));
      if (app) return app.focus();
      return clients.openWindow('./');
    })
  );
});

// ─── Mensaje desde el cliente (programar notificaciones locales) ─────────────
const scheduledTimers = new Map();

self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    const { id, delayMs, title, body } = payload;
    if (scheduledTimers.has(id)) clearTimeout(scheduledTimers.get(id));
    const timerId = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        vibrate: [200, 100, 200],
        tag: `rehab-${id}`,
        renotify: true,
      });
      scheduledTimers.delete(id);
    }, delayMs);
    scheduledTimers.set(id, timerId);
  }

  if (type === 'CANCEL_NOTIFICATION') {
    const { id } = payload;
    if (scheduledTimers.has(id)) {
      clearTimeout(scheduledTimers.get(id));
      scheduledTimers.delete(id);
    }
  }
});
