// Service-Tracker – Service Worker
importScripts('version.js'); // sets self.APP_VERSION – single source of truth
const CACHE = 'service-tracker-' + self.APP_VERSION;

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['./', './index.html', './style.css', './app.js', './version.js', './manifest.json']
        .map(u => new Request(u, { cache: 'reload' })))
    )
  );
  // Kein auto-skipWaiting – Nutzer tippt Update-Toast → SKIP_WAITING
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

// ─── PERIODIC BACKGROUND SYNC ─────────────────────────────────────────────────
// Wird von Chrome auf Android ausgelöst, wenn die App im Hintergrund ist.
// Voraussetzung: periodicSync.register() im Client + Notification-Berechtigung.
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-update') e.waitUntil(checkForUpdates());
});

// Online-Trigger: Sofortiger Update-Check, sobald wieder Internet da ist
self.addEventListener('sync', e => {
  if (e.tag === 'check-online') e.waitUntil(checkForUpdates());
});

async function checkForUpdates() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clients.some(c => c.visibilityState === 'visible')) return; // App sichtbar → dort erscheint der Update-Hinweis
  try {
    // Versionsdatei vom Server holen (ungecacht)
    const res = await fetch('./version.js?nocache=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    const m = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (!m) return;
    const serverVersion = m[1];
    if (serverVersion !== self.APP_VERSION) {
      await self.registration.showNotification('Service-Tracker – Update verfügbar', {
        body: 'Version ' + serverVersion + ' ist verfügbar. Tippe zum Aktualisieren.',
        tag: 'app-update',
        renotify: false,
        data: { url: './?action=update', version: serverVersion },
        actions: [
          { action: 'update', title: 'Jetzt aktualisieren' },
          { action: 'dismiss', title: 'Später' }
        ]
      });
    }
  } catch (e) {
    // TypeError = normaler Fetch-Fehler (offline) – kein Log-Rauschen.
    if (!(e instanceof TypeError)) console.warn('SW update check failed:', e);
  }
}

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  if (e.action === 'dismiss') return;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const match = clients.find(c => c.url.startsWith(self.registration.scope));
      if (match) return match.navigate(new URL(url, self.registration.scope).href).catch(() => null).then(c => (c || match).focus());
      return self.clients.openWindow(url);
    })
  );
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-only: Live-APIs (VIN-Dekodierung)
  if (url.hostname.includes('vpic.nhtsa.dot.gov')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first: App-Shell + CDN (Fonts, Icons)
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
        : Response.error());
    })
  );
});
