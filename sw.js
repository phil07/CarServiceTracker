// BMW E39 Service Tracker – Service Worker
importScripts('version.js'); // sets self.APP_VERSION

const CACHE = 'bmw-e39-' + self.APP_VERSION;

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['./', './index.html', './style.css', './app.js', './version.js', './manifest.json'])
        .catch(err => console.warn('SW precache failed (install continues):', err))
    )
  );
  // Kein auto-skipWaiting – Nutzer tippt Update-Toast
});

// ─── MESSAGE ──────────────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first: externe Ressourcen (Fonts, Icons CDN)
  const isExternal = url.hostname !== self.location.hostname &&
                     url.hostname !== 'localhost';
  if (isExternal) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || Response.error()))
    );
    return;
  }

  // Cache-first: App-Shell
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => e.request.mode === 'navigate'
        ? caches.match('./index.html').then(r => r || Response.error())
        : Response.error()
      );
    })
  );
});
