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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
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
