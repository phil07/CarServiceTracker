// Tests für worker.js: Scheckheft-API (Lesen/Schreiben mit Schlüssel, Fotos, Ablauf, Löschen),
// Google-Anmeldung (Schutzprüfungen) und Auslieferung der App. Mit gefälschtem KV-Speicher und Assets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from './helpers.mjs';

function loadWorker() {
    const ctx = vm.createContext({ Response, Request, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto,
        btoa, atob, Math, Date, JSON, Promise, Uint8Array, Set, Map, Number, String, Array, Object, RegExp, console,
        fetch: () => Promise.reject(new Error('kein Netz')) });
    vm.runInContext(read('worker.js').replace('export default', 'var __worker ='), ctx);
    return ctx.__worker;
}
const worker = loadWorker();

function fakeKv() {
    const m = new Map();
    return {
        m,
        async get(k, type) {
            const v = m.get(k)?.value; if (v === undefined) return null;
            return type === 'json' ? JSON.parse(v) : type === 'arrayBuffer' ? v : v;
        },
        async put(k, v, opts) { m.set(k, { value: typeof v === 'string' ? v : v, ttl: opts?.expirationTtl }); },
        async delete(k) { m.delete(k); },
        async list({ prefix = '' } = {}) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
    };
}
const ID = 'A'.repeat(20), SECRET = 'S'.repeat(30);
const env = () => ({ BOOKS: fakeKv(), ASSETS: { fetch: async req => new Response('ASSET ' + new URL(req.url).pathname, { status: 200 }) } });
const call = (e, method, path, { body, secret, headers = {} } = {}) => worker.fetch(new Request('https://x.test' + path, {
    method, body, headers: { ...(secret ? { authorization: 'Bearer ' + secret } : {}), ...headers } }), e);
const snapshot = (extra = {}) => JSON.stringify({ entries: [{ id: 'e1', photos: ['p1'] }], vehicle: { make: 'BMW' }, vehiclePhotos: [], ...extra });
const jpeg = () => new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3]);

test('Auslieferung: normale Pfade gehen an die App-Assets', async () => {
    const r = await call(env(), 'GET', '/index.html');
    assert.equal(r.status, 200); assert.equal(await r.text(), 'ASSET /index.html');
});
test('Scheckheft-Seite /s/<id> liefert scheckheft mit Datenschutz-Headern', async () => {
    const r = await call(env(), 'GET', `/s/${ID}`);
    assert.equal(r.status, 200); assert.equal(await r.text(), 'ASSET /scheckheft');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer'); assert.match(r.headers.get('x-robots-tag'), /noindex/);
    assert.equal((await call(env(), 'GET', '/s/kurz')).status, 200); // kein Scheckheft-Pfad → normale Assets
});
test('Scheckheft: ungültige Adresse → 400', async () => {
    assert.equal((await call(env(), 'GET', '/api/book/zu-kurz')).status, 400);
});
test('Scheckheft: Schreiben braucht Schlüssel, Lesen nicht', async () => {
    const e = env();
    assert.equal((await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot() })).status, 401);
    assert.equal((await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot(), secret: 'zu-kurz' })).status, 401);
    const ok = await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot(), secret: SECRET });
    assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { ok: true });
    const get = await call(e, 'GET', `/api/book/${ID}`);
    assert.equal(get.status, 200); assert.equal((await get.json()).vehicle.make, 'BMW');
    assert.equal(get.headers.get('cache-control'), 'no-store');
    assert.equal((await call(e, 'GET', `/api/book/${'B'.repeat(20)}`)).status, 404);
});
test('Scheckheft: nur der Besitzer des Schlüssels darf überschreiben; Schlüssel wird nur als Hash gespeichert', async () => {
    const e = env();
    await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot(), secret: SECRET });
    assert.equal((await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot(), secret: 'X'.repeat(30) })).status, 403);
    assert.equal((await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot({ vehicle: { make: 'Audi' } }), secret: SECRET })).status, 200);
    assert.equal((await (await call(e, 'GET', `/api/book/${ID}`)).json()).vehicle.make, 'Audi');
    assert.ok(![...e.BOOKS.m.values()].some(v => String(v.value).includes(SECRET)), 'Klartext-Schlüssel gespeichert');
});
test('Scheckheft: ungültige oder zu große Daten werden abgelehnt', async () => {
    const e = env();
    for (const bad of ['{kaputt', '[]', '{"entries":1,"vehicle":{}}', '{"entries":[]}']) {
        assert.equal((await call(e, 'PUT', `/api/book/${ID}`, { body: bad, secret: SECRET })).status, 400, bad);
    }
    assert.equal((await call(e, 'PUT', `/api/book/${ID}`, { body: 'x'.repeat(1024 * 1024 + 1), secret: SECRET })).status, 413);
});
test('Scheckheft: abgelaufener Link → 410, Ablaufdatum bestimmt die Speicherfrist', async () => {
    const e = env();
    await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot({ until: Date.now() - 1000 }), secret: SECRET });
    assert.equal((await call(e, 'GET', `/api/book/${ID}`)).status, 410);
    const e2 = env();
    await call(e2, 'PUT', `/api/book/${ID}`, { body: snapshot({ until: Date.now() + 3 * 86400e3 }), secret: SECRET });
    const ttl = e2.BOOKS.m.get('b:' + ID).ttl;
    assert.ok(ttl > 9 * 86400 && ttl < 11 * 86400, `TTL ${ttl}`);
    const e3 = env();
    await call(e3, 'PUT', `/api/book/${ID}`, { body: snapshot({ until: 'morgen' }), secret: SECRET });
    assert.equal(e3.BOOKS.m.get('b:' + ID).ttl, 365 * 86400, 'ungültiges until wird entfernt');
});
test('Fotos: nur JPEG, Größe und Anzahl begrenzt, öffentlich lesbar', async () => {
    const e = env();
    const put = (pid, data, secret = SECRET) => call(e, 'PUT', `/api/book/${ID}/photo/${pid}`, { body: data, secret });
    assert.equal((await put('p1', jpeg())).status, 200);
    assert.equal((await put('p2', new Uint8Array([1, 2, 3, 4, 5]))).status, 415);
    assert.equal((await put('p3', new Uint8Array(1536 * 1024 + 1).fill(0xFF))).status, 413);
    assert.equal((await put('p4', jpeg(), 'zu-kurz')).status, 401);
    const get = await call(e, 'GET', `/api/book/${ID}/photo/p1`);
    assert.equal(get.status, 404, 'ohne veröffentlichte Daten kein Foto');
    await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot(), secret: SECRET });
    const ok = await call(e, 'GET', `/api/book/${ID}/photo/p1`);
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'image/jpeg');
    for (let i = 0; i < 79; i++) await put('x' + i, jpeg());
    assert.equal((await put('zu-viel', jpeg())).status, 413);
    assert.equal((await put('x0', jpeg())).status, 200, 'vorhandenes Foto ersetzen bleibt erlaubt');
});
test('Speichern mit prune=1 entfernt nicht mehr verwendete Fotos', async () => {
    const e = env();
    await call(e, 'PUT', `/api/book/${ID}/photo/p1`, { body: jpeg(), secret: SECRET });
    await call(e, 'PUT', `/api/book/${ID}/photo/alt`, { body: jpeg(), secret: SECRET });
    await call(e, 'PUT', `/api/book/${ID}?prune=1`, { body: snapshot(), secret: SECRET });
    assert.ok(e.BOOKS.m.has(`p:${ID}:p1`)); assert.ok(!e.BOOKS.m.has(`p:${ID}:alt`));
});
test('Löschen: Schlüssel nötig, entfernt Daten und Fotos', async () => {
    const e = env();
    await call(e, 'PUT', `/api/book/${ID}`, { body: snapshot(), secret: SECRET });
    await call(e, 'PUT', `/api/book/${ID}/photo/p1`, { body: jpeg(), secret: SECRET });
    assert.equal((await call(e, 'DELETE', `/api/book/${ID}`)).status, 401);
    assert.equal((await call(e, 'DELETE', `/api/book/${ID}`, { secret: 'X'.repeat(30) })).status, 403);
    assert.equal((await call(e, 'DELETE', `/api/book/${ID}`, { secret: SECRET })).status, 200);
    assert.equal(e.BOOKS.m.size, 0);
    assert.equal((await call(e, 'DELETE', `/api/book/${ID}`, { secret: SECRET })).status, 404);
});
test('Nicht erlaubte Methoden → 405', async () => {
    assert.equal((await call(env(), 'POST', `/api/book/${ID}`)).status, 405);
});

// ───────────── Google-Anmeldung ─────────────
test('gauth: nur POST, nur mit Header x-cst und gleicher Origin', async () => {
    const e = { ...env(), GOOGLE_CLIENT_SECRET: 's', GAUTH_KEY: 'k'.repeat(40) };
    assert.equal((await call(e, 'GET', '/api/gauth/refresh')).status, 405);
    assert.equal((await call(e, 'POST', '/api/gauth/refresh')).status, 403);
    assert.equal((await call(e, 'POST', '/api/gauth/refresh', { headers: { 'x-cst': '1', origin: 'https://evil.test' } })).status, 403);
});
test('gauth: ohne Server-Geheimnisse 503, ohne Cookie 401, ungültiger Code 400, unbekannte Aktion 404', async () => {
    const h = { 'x-cst': '1' };
    assert.equal((await call(env(), 'POST', '/api/gauth/refresh', { headers: h })).status, 503);
    const e = { ...env(), GOOGLE_CLIENT_SECRET: 's', GAUTH_KEY: 'k'.repeat(40) };
    assert.equal((await call(e, 'POST', '/api/gauth/refresh', { headers: h })).status, 401);
    assert.equal((await call(e, 'POST', '/api/gauth/exchange', { headers: h, body: '{}' })).status, 400);
    assert.equal((await call(e, 'POST', '/api/gauth/exchange', { headers: h, body: JSON.stringify({ code: 'x'.repeat(3000) }) })).status, 400);
    assert.equal((await call(e, 'POST', '/api/gauth/unbekannt', { headers: h })).status, 404);
    const out = await call(e, 'POST', '/api/gauth/logout', { headers: h });
    assert.equal(out.status, 200); assert.match(out.headers.get('set-cookie'), /Max-Age=0/i);
});
test('gauth: manipuliertes Cookie wird verworfen und gelöscht', async () => {
    const e = { ...env(), GOOGLE_CLIENT_SECRET: 's', GAUTH_KEY: 'k'.repeat(40) };
    const r = await call(e, 'POST', '/api/gauth/refresh', { headers: { 'x-cst': '1', cookie: 'cst_grt=ZmFsc2NoZXNDb29raWU' } });
    assert.equal(r.status, 401); assert.match(r.headers.get('set-cookie') || '', /Max-Age=0/i);
});
