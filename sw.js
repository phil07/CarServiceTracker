// Service-Tracker – Service Worker
importScripts('version.js'); // sets self.APP_VERSION – single source of truth
const CACHE = 'service-tracker-' + self.APP_VERSION;

const PRECACHE = ['./', './index.html', './style.css', './app.js', './sync.js', './book.js', './reminders.js', './extras.js', './assets/qrcode.js', './photos.js', './datenschutz.html', './impressum.html', './legal.js', './legal.css', './version.js', './manifest.json',
  './assets/fonts/fonts.css', './assets/fonts/phosphor.css', './assets/fonts/Phosphor-Light.woff2',
  './assets/fonts/plus-jakarta-sans-latin-400-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-500-normal.woff2',
  './assets/fonts/plus-jakarta-sans-latin-600-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-700-normal.woff2',
  './assets/fonts/plus-jakarta-sans-latin-800-normal.woff2'];

// Eine Antwort, die über eine Weiterleitung kam (z. B. /impressum.html → /impressum bei Cloudflare),
// darf für Seitenaufrufe nicht aus dem Cache geliefert werden (Browser: ERR_FAILED). Daher ohne „redirected“-Flag neu verpacken.
async function clean(resp) {
  if (!resp || !resp.redirected) return resp;
  return new Response(await resp.clone().blob(), { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(PRECACHE.map(async u => {
      const r = await fetch(new Request(u, { cache: 'reload' }));
      if (!r.ok) throw new Error('Precache fehlgeschlagen: ' + u);
      await c.put(u, await clean(r));
    })))
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
      Promise.all(keys.filter(k => k !== CACHE && k !== 'cst-reminders').map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── PERIODIC BACKGROUND SYNC ─────────────────────────────────────────────────
// Wird von Chrome auf Android ausgelöst, wenn die App im Hintergrund ist.
// Voraussetzung: periodicSync.register() im Client + Notification-Berechtigung.
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-update') e.waitUntil(checkForUpdates());
  if (e.tag === 'service-due') e.waitUntil(checkServiceDue());
});

// Erinnerungen an fällige Wartungen: Momentaufnahme der datumsbasierten Fristen aus dem Cache (schreibt reminders.js)
async function checkServiceDue() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clients.some(c => c.visibilityState === 'visible')) return; // App sichtbar → dort läuft die Prüfung
  try {
    const cache = await caches.open('cst-reminders');
    const res = await cache.match('./reminders-snapshot.json');
    if (!res) return;
    const snap = await res.json();
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    snap.notified = snap.notified || {};
    const due = (snap.items || []).filter(i => i.from <= today && snap.notified[i.key] !== today);
    if (!due.length) return;
    due.forEach(i => { snap.notified[i.key] = today; });
    const lines = due.slice(0, 5).map(i => i.category + ' – ' + i.vehicle + (i.due < today ? ' (überfällig)' : ''));
    if (due.length > 5) lines.push('… und ' + (due.length - 5) + ' weitere');
    await cache.put('./reminders-snapshot.json', new Response(JSON.stringify(snap), { headers: { 'Content-Type': 'application/json' } }));
    await self.registration.showNotification(due.length === 1 ? 'Wartung fällig' : due.length + ' Wartungen fällig', {
      body: lines.join('\n'), tag: 'service-due', renotify: true, data: { url: './' }
    });
  } catch (e) { console.warn('SW Erinnerungen:', e); }
}

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

  // Fremde Hosts (VIN-Dekodierung, Google Anmeldung/Drive) nie cachen – direkt ans Netz
  if (url.origin !== self.location.origin) return;

  // Scheckheft-Server und öffentliche Scheckheft-Seiten nie aus dem Cache bedienen (müssen aktuell sein)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/')) return;

  // Cache-first: App-Shell inkl. lokaler Schrift/Icons
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return clean(cached);
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          clean(resp.clone()).then(copy => caches.open(CACHE).then(c => c.put(e.request, copy)));
        }
        return resp;
      }).catch(() => e.request.mode === 'navigate'
        ? caches.match('./index.html').then(r => r || Response.error())
        : Response.error());
    })
  );
});
