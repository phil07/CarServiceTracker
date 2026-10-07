// Service-Tracker – Cloudflare Worker
// 1. liefert die statische App aus (Binding ASSETS)
// 2. Digitales Scheckheft: öffentlich lesbare Momentaufnahme je Fahrzeug (Binding BOOKS, Workers KV)
//
// Schreiben darf nur, wer den geheimen Schlüssel des Scheckhefts kennt (liegt nur in der App des Besitzers;
// hier wird nur der SHA-256-Hash gespeichert). Lesen kann jeder, der die (nicht erratbare) Adresse kennt.

const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const PID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BOOK = 1024 * 1024;       // 1 MB je Scheckheft-Daten
const MAX_PHOTO = 1536 * 1024;      // 1,5 MB je Foto
const MAX_PHOTOS = 80;              // Fotos je Scheckheft

const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), {
  status,
  headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }, extra),
});

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function secretOf(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(req.headers.get('authorization') || '');
  return m ? m[1] : null;
}

// Prüft den Schlüssel; legt das Scheckheft beim ersten Schreiben an (create=true)
async function authorize(req, env, id, create) {
  const secret = secretOf(req);
  if (!secret) return { err: json({ error: 'Schlüssel fehlt' }, 401) };
  const hash = await sha256(secret);
  const rec = await env.BOOKS.get('b:' + id, 'json');
  if (rec) return rec.hash === hash ? { rec, hash } : { err: json({ error: 'Schlüssel falsch' }, 403) };
  return create ? { rec: null, hash } : { err: json({ error: 'Nicht gefunden' }, 404) };
}

function cleanSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries) || !raw.vehicle || typeof raw.vehicle !== 'object') return null;
  return raw;
}

async function api(req, env, url) {
  const parts = url.pathname.split('/').filter(Boolean); // api, book, :id, [photo, :pid]
  const id = parts[2];
  if (!ID_RE.test(id || '')) return json({ error: 'Ungültige Adresse' }, 400);
  const sub = parts[3];

  // ─── öffentlich lesen ──────────────────────────────────────────────────────
  if (req.method === 'GET' && !sub) {
    const rec = await env.BOOKS.get('b:' + id, 'json');
    if (!rec || !rec.data) return json({ error: 'Nicht gefunden' }, 404);
    return json(rec.data);
  }
  if (req.method === 'GET' && sub === 'photo' && PID_RE.test(parts[4] || '')) {
    const buf = await env.BOOKS.get('p:' + id + ':' + parts[4], 'arrayBuffer');
    if (!buf) return new Response('Nicht gefunden', { status: 404 });
    return new Response(buf, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-robots-tag': 'noindex' } });
  }

  // ─── schreiben (mit Schlüssel) ─────────────────────────────────────────────
  if (req.method === 'PUT' && !sub) {
    const a = await authorize(req, env, id, true);
    if (a.err) return a.err;
    const text = await req.text();
    if (text.length > MAX_BOOK) return json({ error: 'Zu groß' }, 413);
    let data; try { data = cleanSnapshot(JSON.parse(text)); } catch (e) { data = null; }
    if (!data) return json({ error: 'Ungültige Daten' }, 400);
    await env.BOOKS.put('b:' + id, JSON.stringify({ hash: a.hash, data }));
    if (url.searchParams.get('prune') === '1') { // nicht mehr verwendete Fotos entfernen
      const keep = new Set();
      const add = pid => { if (typeof pid === 'string' && PID_RE.test(pid)) keep.add(pid); };
      (data.vehiclePhotos || []).forEach(add);
      data.entries.forEach(e => (e.photos || []).forEach(add));
      const list = await env.BOOKS.list({ prefix: 'p:' + id + ':' });
      await Promise.all(list.keys.filter(k => !keep.has(k.name.slice(('p:' + id + ':').length))).map(k => env.BOOKS.delete(k.name)));
    }
    return json({ ok: true });
  }
  if (req.method === 'PUT' && sub === 'photo' && PID_RE.test(parts[4] || '')) {
    const a = await authorize(req, env, id, true); // Fotos kommen vor den Daten: Schlüssel hier schon hinterlegen
    if (a.err) return a.err;
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_PHOTO) return json({ error: 'Foto zu groß' }, 413);
    const b = new Uint8Array(buf);
    if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return json({ error: 'Nur JPEG' }, 415);
    const prefix = 'p:' + id + ':';
    const key = prefix + parts[4];
    if (!(await env.BOOKS.get(key, 'arrayBuffer'))) {
      const list = await env.BOOKS.list({ prefix });
      if (list.keys.length >= MAX_PHOTOS) return json({ error: 'Zu viele Fotos' }, 413);
    }
    if (!a.rec) await env.BOOKS.put('b:' + id, JSON.stringify({ hash: a.hash, data: null }));
    await env.BOOKS.put(key, buf);
    return json({ ok: true });
  }
  if (req.method === 'DELETE' && !sub) {
    const a = await authorize(req, env, id, false);
    if (a.err) return a.err;
    let cursor;
    do {
      const list = await env.BOOKS.list({ prefix: 'p:' + id + ':', cursor });
      await Promise.all(list.keys.map(k => env.BOOKS.delete(k.name)));
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
    await env.BOOKS.delete('b:' + id);
    return json({ ok: true });
  }
  return json({ error: 'Nicht erlaubt' }, 405);
}

async function asset(env, origin, path) {
  let r = await env.ASSETS.fetch(new Request(origin + path));
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) r = await env.ASSETS.fetch(new Request(new URL(r.headers.get('location'), origin)));
  return r;
}

// ─── Google-Anmeldung für die Drive-Synchronisierung ──────────────────────────
// Der Worker tauscht nur den Anmeldecode bzw. das Refresh-Token bei Google gegen ein kurzlebiges
// Zugriffstoken. Das Refresh-Token liegt AES-GCM-verschlüsselt als httpOnly-Cookie im Browser des
// Nutzers; der Worker speichert nichts und sieht keine Drive-Inhalte.
// Secrets (wrangler secret put …): GOOGLE_CLIENT_SECRET, GAUTH_KEY (zufällige Zeichenkette, mind. 32 Zeichen)
const GOOGLE_CLIENT_ID = '456570124356-ksovdvup3n1o9hhq6hnm3tfms1r1a0hs.apps.googleusercontent.com';
const GAUTH_COOKIE = 'cst_grt';
const GAUTH_MAX_AGE = 400 * 86400; // Browser-Höchstwert

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function gauthKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.GAUTH_KEY));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await gauthKey(env), new TextEncoder().encode(text));
  return b64u(iv) + '.' + b64u(ct);
}

async function unseal(env, s) {
  try {
    const [iv, ct] = s.split('.');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await gauthKey(env), unb64u(ct));
    return new TextDecoder().decode(pt);
  } catch (e) { return null; }
}

function readCookie(req, name) {
  const c = (req.headers.get('cookie') || '').split(/;\s*/).find(p => p.startsWith(name + '='));
  return c ? c.slice(name.length + 1) : null;
}

const gauthCookie = (value, maxAge) => GAUTH_COOKIE + '=' + value + '; Path=/api/gauth/; Max-Age=' + maxAge + '; HttpOnly; Secure; SameSite=Strict';

async function googleToken(env, params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.assign({ client_id: GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET }, params)),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

async function gauth(req, env, url) {
  if (req.method !== 'POST') return json({ error: 'Methode nicht erlaubt' }, 405);
  const origin = req.headers.get('origin');
  if (req.headers.get('x-cst') !== '1' || (origin && origin !== url.origin)) return json({ error: 'Nicht erlaubt' }, 403);
  if (!env.GOOGLE_CLIENT_SECRET || !env.GAUTH_KEY) return json({ error: 'Server nicht eingerichtet' }, 503);
  const action = url.pathname.slice('/api/gauth/'.length);

  // Anmeldecode (Popup) gegen Zugriffs- und Refresh-Token tauschen
  if (action === 'exchange') {
    let code; try { code = (await req.json()).code; } catch (e) {}
    if (typeof code !== 'string' || !code || code.length > 2048) return json({ error: 'Ungültiger Code' }, 400);
    const t = await googleToken(env, { code, grant_type: 'authorization_code', redirect_uri: 'postmessage' });
    if (!t.ok || !t.data.access_token) return json({ error: 'Anmeldung bei Google fehlgeschlagen' }, 400);
    const headers = {};
    if (t.data.refresh_token) headers['set-cookie'] = gauthCookie(await seal(env, t.data.refresh_token), GAUTH_MAX_AGE);
    return json({ access_token: t.data.access_token, expires_in: t.data.expires_in, persistent: !!(t.data.refresh_token || readCookie(req, GAUTH_COOKIE)) }, 200, headers);
  }

  // still ein neues Zugriffstoken holen
  if (action === 'refresh') {
    const c = readCookie(req, GAUTH_COOKIE);
    const rt = c && await unseal(env, c);
    if (!rt) return json({ error: 'Keine Anmeldung' }, 401, c ? { 'set-cookie': gauthCookie('', 0) } : {});
    const t = await googleToken(env, { refresh_token: rt, grant_type: 'refresh_token' });
    if (!t.ok || !t.data.access_token) {
      const gone = t.data.error === 'invalid_grant'; // widerrufen oder abgelaufen
      return json({ error: 'Anmeldung abgelaufen' }, gone ? 401 : 502, gone ? { 'set-cookie': gauthCookie('', 0) } : {});
    }
    return json({ access_token: t.data.access_token, expires_in: t.data.expires_in }, 200, { 'set-cookie': gauthCookie(c, GAUTH_MAX_AGE) });
  }

  // Trennen: Zugriff bei Google widerrufen, Cookie löschen
  if (action === 'logout') {
    const c = readCookie(req, GAUTH_COOKIE);
    const rt = c && await unseal(env, c);
    if (rt) {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: rt }),
      }).catch(() => {});
    }
    return json({ ok: true }, 200, { 'set-cookie': gauthCookie('', 0) });
  }
  return json({ error: 'Nicht gefunden' }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/gauth/')) {
      try { return await gauth(req, env, url); }
      catch (e) { return json({ error: 'Serverfehler' }, 500); }
    }
    if (url.pathname.startsWith('/api/book/')) {
      try { return await api(req, env, url); }
      catch (e) { return json({ error: 'Serverfehler' }, 500); }
    }
    // Scheckheft-Seite: /s/<id> → scheckheft.html (Adresse nicht an Dritte weitergeben)
    if (/^\/s\/[A-Za-z0-9_-]{16,64}\/?$/.test(url.pathname) && req.method === 'GET') {
      const r = await asset(env, url.origin, '/scheckheft');
      const h = new Headers(r.headers);
      h.set('referrer-policy', 'no-referrer');
      h.set('x-robots-tag', 'noindex, nofollow');
      h.set('cache-control', 'no-cache');
      return new Response(r.body, { status: r.status, headers: h });
    }
    return env.ASSETS.fetch(req);
  },
};
