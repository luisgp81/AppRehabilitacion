'use strict';
// Service worker: el juego funciona sin conexión una vez instalado.
// Lo básico (código, protagonistas, iconos) se guarda al instalar; enemigos y fondos, la primera vez que se usan.
// Cada visita sirve lo guardado y lo actualiza por detrás, así una versión nueva llega en la siguiente apertura.
const CACHE = 'seleccion-arcade-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest',
  'js/audio.js', 'js/input.js', 'js/characters.js', 'js/fighter.js', 'js/render.js', 'js/sprite-data.js', 'js/sprites.js',
  'js/frame-index.js', 'js/frames.js', 'js/ai.js', 'js/stage-index.js', 'js/calle-roster.js', 'js/calle-stage.js', 'js/calle.js', 'js/game.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // fuentes de Google y demás: red normal
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
