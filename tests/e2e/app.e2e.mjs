// Browser-Tests (Playwright + Chromium) gegen die echte App. Ausführen: npm run test:e2e
// Voraussetzung: `npm install` (playwright-core) und ein Chromium (CHROME_PATH, PLAYWRIGHT_BROWSERS_PATH oder /opt/pw-browsers).
// Netzwerk wird gesperrt, die App läuft über einen lokalen Static-Server; ohne Browser werden die Tests übersprungen.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const PUBLIC = /^\/(index\.html|scheckheft\.html|impressum\.html|datenschutz\.html|[\w.-]+\.(js|css|json|svg|png)|assets\/.*)$/;

function findChrome() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean)) {
        if (!fs.existsSync(base)) continue;
        for (const d of fs.readdirSync(base).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
            for (const sub of ['chrome-linux64', 'chrome-linux']) {
                const p = path.join(base, d, sub, 'chrome');
                if (fs.existsSync(p)) return p;
            }
        }
    }
    return null;
}
let chromium = null;
try { ({ chromium } = await import('playwright-core')); } catch (e) { /* nicht installiert */ }
const chrome = findChrome();
const SKIP = !chromium || !chrome ? 'playwright-core oder Chromium fehlt' : false;

let server, base, browser;
const iso = off => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const STORE = () => ({
    activeId: 'main', deletedVehicles: {},
    vehicles: [{
        id: 'main', deleted: {}, meta: {},
        vehicle: { vin: 'WBADT61000FX12345', make: 'BMW', model: 'E39 530iA', chassis: 'FX12345', firstRegistration: '2001-05', currentKm: 150000 },
        serviceHistory: [
            { id: 'e1', date: iso(-60), km: 148000, category: 'Öl', description: 'Ölwechsel 5W-30', cost: 89.9, shop: 'Werkstatt Müller' },
            { id: 'e2', date: iso(-300), km: 140000, category: 'Bremsen', description: 'Bremsbeläge vorne' },
        ],
        fuelLog: [
            { id: 'f1', date: iso(-40), km: 148500, liters: 50, full: true, cost: 85 },
            { id: 'f2', date: iso(-10), km: 149500, liters: 70, full: true, cost: 119 },
        ],
        settings: { vehicleColor: 'titansilber', onboardingDone: true, deadlines: [], vehiclePhotos: [],
            intervals: { 'Öl': { km: 12000, months: 12 }, 'Bremsflüssigkeit': { km: null, months: 24 } } },
    }],
});

before(async () => {
    if (SKIP) return;
    server = http.createServer((req, res) => {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (p === '/') p = '/index.html';
        const f = path.join(ROOT, p);
        if (!PUBLIC.test(p) || !f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nicht gefunden'); }
        res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
        fs.createReadStream(f).pipe(res);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); await new Promise(r => server?.close(r)); });

let ctx, page, errors;
async function open(store = STORE(), { dark = false } = {}) {
    ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 390, height: 844 }, locale: 'de-DE', colorScheme: dark ? 'dark' : 'light' });
    page = await ctx.newPage();
    errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    if (store) await page.addInitScript(s => {
        if (localStorage.getItem('__seeded')) return;
        localStorage.setItem('__seeded', '1');
        localStorage.setItem('bmw_e39_data', s);
    }, JSON.stringify(store));
    await page.goto(base + 'index.html');
    await page.waitForFunction(() => typeof switchTab === 'function' && document.getElementById('appVersion'));
}
afterEach(async () => { await ctx?.close(); ctx = null; });
const t = (name, fn) => test(name, { skip: SKIP }, fn);
const nav = async id => { await page.click('#menuBtn'); await page.click(`#nav-${id}`); await page.waitForFunction(v => document.getElementById('view-' + v)?.classList.contains('active'), id); };
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('bmw_e39_data')));

t('Erster Start ohne Daten: Einrichtung nach VIN statt Fehler', async () => {
    await open(null);
    await page.waitForSelector('#view-onboarding.active, #view-onboarding:not([hidden])');
    assert.ok(await page.locator('#onboardingVin').isVisible());
    assert.deepEqual(errors, []);
});

t('Dashboard: Kilometerstand, Fahrzeug und anstehende Wartungen', async () => {
    await open();
    assert.match(await page.locator('#dashboardKm').innerText(), /150\.000/);
    const txt = await page.locator('#view-dashboard').innerText();
    assert.match(txt, /Öl/); assert.match(await page.locator('#upcomingGrid').innerText(), /noch [\d.]+ km|nach dem ersten Eintrag/);
    assert.match(await page.locator('#appVersion').innerText(), /v\d+/);
    assert.deepEqual(errors, []);
});

t('Menü: alle Bereiche lassen sich öffnen, genau eine Ansicht ist aktiv', async () => {
    await open();
    for (const id of ['history', 'fuel', 'stats', 'settings', 'dashboard']) {
        await nav(id);
        assert.equal(await page.locator('.view.active').count(), 1, id);
    }
    assert.deepEqual(errors, []);
});

t('Historie: Einträge in Reihenfolge, Suche und Kategorie-Filter', async () => {
    await open();
    await nav('history');
    const rows = await page.locator('#historyList .list-row').allInnerTexts();
    assert.equal(rows.length, 2); assert.match(rows[0], /Öl/); assert.match(rows[1], /Bremsen/);
    await page.fill('#historySearch', 'bremsbeläge');
    await page.waitForFunction(() => document.querySelectorAll('#historyList .list-row').length === 1);
    assert.match(await page.locator('#historyList').innerText(), /Bremsbeläge/);
    await page.fill('#historySearch', 'gibtesnicht');
    await page.waitForFunction(() => document.querySelector('#historyList .empty-state'));
    await page.fill('#historySearch', '');
    await page.click('#categoryFilterChips .chip[data-cat="Öl"]');
    await page.waitForFunction(() => document.querySelectorAll('#historyList .list-row').length === 1);
});

t('Eintrag hinzufügen: Formular speichert, Kilometerstand steigt, Daten bleiben nach Neuladen', async () => {
    await open();
    await page.evaluate(() => openAddEntry());
    await page.selectOption('#form-category', 'Zündkerzen');
    await page.fill('#form-date', iso(-1));
    await page.fill('#form-km', '151000');
    await page.fill('#form-cost', '64,50'.replace(',', '.'));
    await page.fill('#form-description', 'Zündkerzen neu');
    await page.evaluate(() => document.getElementById('addEntryForm').requestSubmit());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bmw_e39_data')).vehicles[0].serviceHistory.length === 3);
    const s = (await stored()).vehicles[0];
    assert.equal(s.vehicle.currentKm, 151000);
    const added = s.serviceHistory.find(e => e.description === 'Zündkerzen neu');
    assert.equal(added.cost, 64.5); assert.equal(added.category, 'Zündkerzen');
    await page.reload();
    await page.waitForFunction(() => typeof switchTab === 'function');
    await nav('history');
    assert.match(await page.locator('#historyList').innerText(), /Zündkerzen neu/);
});

t('Eintrag hinzufügen: ohne Beschreibung wird nichts gespeichert', async () => {
    await open();
    await page.evaluate(() => openAddEntry());
    await page.fill('#form-date', iso(0));
    await page.fill('#form-km', '150500');
    await page.evaluate(() => document.getElementById('addEntryForm').requestSubmit());
    await page.waitForTimeout(300);
    assert.equal((await stored()).vehicles[0].serviceHistory.length, 2);
});

t('Eintrag ansehen und löschen (mit Bestätigung)', async () => {
    await open();
    await nav('history');
    await page.click('#historyList .list-row >> nth=1');
    await page.waitForFunction(() => document.getElementById('modal-entry-detail')?.open);
    assert.match(await page.locator('#modal-entry-detail').innerText(), /Bremsbeläge vorne/);
    await page.click('#detailDeleteBtn');
    await page.click('#detailDeleteBtn'); // zweiter Klick bestätigt
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bmw_e39_data')).vehicles[0].serviceHistory.length === 1);
    const s = (await stored()).vehicles[0];
    assert.ok(s.deleted.e2, 'Löschmarke für die Synchronisierung');
});

t('Tankbuch: Verbrauch aus Volltankungen, neuer Tankstopp', async () => {
    await open();
    await nav('fuel');
    const sum = await page.locator('#fuelSummary').innerText();
    assert.match(sum, /7,0/, sum); // 70 l auf 1000 km
    await page.evaluate(() => openFuelDialog());
    await page.fill('#fuel-date', iso(0));
    await page.fill('#fuel-km', '150400');
    await page.fill('#fuel-liters', '45');
    await page.fill('#fuel-cost', '76.5');
    await page.evaluate(() => document.getElementById('fuelForm').requestSubmit());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bmw_e39_data')).vehicles[0].fuelLog.length === 3);
    assert.equal((await stored()).vehicles[0].vehicle.currentKm, 150400);
    assert.match(await page.locator('#fuelList').innerText(), /45/);
});

t('Tankbuch: ungültige Liter werden abgelehnt', async () => {
    await open();
    await page.evaluate(() => openFuelDialog());
    await page.fill('#fuel-date', iso(0)); await page.fill('#fuel-km', '150100'); await page.fill('#fuel-liters', '999');
    await page.evaluate(() => document.getElementById('fuelForm').requestSubmit());
    await page.waitForTimeout(300);
    assert.equal((await stored()).vehicles[0].fuelLog.length, 2);
});

t('Statistik: Seite rendert ohne Fehler und zeigt Kosten', async () => {
    await open();
    await nav('stats');
    assert.match(await page.locator('#statsPage').innerText(), /89|€/);
    assert.deepEqual(errors, []);
});

t('Backup: Export als JSON-Datei, Import stellt Daten wieder her', async () => {
    await open();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportData())]);
    const file = path.join(os.tmpdir(), 'cst-' + Date.now() + '.json');
    await dl.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.vehicles[0].serviceHistory.length, 2); assert.ok(/\.json$/.test(dl.suggestedFilename()));
    // Daten verändern, dann Backup einspielen
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bmw_e39_data')); s.vehicles[0].serviceHistory = []; localStorage.setItem('bmw_e39_data', JSON.stringify(s)); });
    await page.reload(); await page.waitForFunction(() => typeof switchTab === 'function');
    await page.setInputFiles('#importFile', file);
    await page.waitForSelector('#confirmOk', { state: 'visible' });
    await page.click('#confirmOk');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bmw_e39_data')).vehicles[0].serviceHistory.length === 2);
    fs.unlinkSync(file);
});

t('Backup: kaputte Datei wird abgelehnt, Daten bleiben', async () => {
    await open();
    const file = path.join(os.tmpdir(), 'cst-kaputt-' + Date.now() + '.json');
    fs.writeFileSync(file, '{"kaputt": true');
    await page.setInputFiles('#importFile', file);
    await page.waitForFunction(() => /fehlgeschlagen/i.test(document.getElementById('toast')?.textContent || ''));
    assert.equal((await stored()).vehicles[0].serviceHistory.length, 2);
    fs.unlinkSync(file);
});

t('Design: Dunkelmodus per Systemeinstellung, Umschalten per Einstellung', async () => {
    await open(STORE(), { dark: true });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.notEqual(bg, 'rgb(255, 255, 255)');
    await page.evaluate(() => setTheme('light'));
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
});

t('Einstellungen: Intervalle sind sichtbar und Farbwahl ändert die Akzentfarbe', async () => {
    await open();
    await nav('settings');
    assert.match(await page.locator('#intervalEditor').innerText(), /Öl/);
    await page.evaluate(() => applyTheme('titansilber'));
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--car-fill'));
    await page.evaluate(() => applyTheme('calypsorot'));
    const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--car-fill'));
    assert.notEqual(before.trim(), after.trim());
});

t('Rechtliche Seiten und Scheckheft-Seite laden ohne Fehler', async () => {
    await open();
    for (const p of ['impressum.html', 'datenschutz.html', 'scheckheft.html']) {
        const r = await page.goto(base + p);
        assert.equal(r.status(), 200, p);
    }
    assert.deepEqual(errors, []);
});

t('Manifest, Service Worker und Version sind erreichbar', async () => {
    await open();
    const m = await (await page.request.get(base + 'manifest.json')).json();
    assert.ok(m.name && m.start_url && m.icons?.length);
    const sw = await page.request.get(base + 'sw.js');
    assert.equal(sw.status(), 200);
    assert.match(await page.evaluate(() => self.APP_VERSION), /^v\d+$/);
});
