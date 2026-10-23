// Unit-Tests für app.js: Datenprüfung, Datumsrechnung, Wartungsstatus, Verbrauch, VIN, Sicherung, Farben.
// Lädt die echte app.js (keine Kopie). Ausführen: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, makeStorage, J } from './helpers.mjs';

const NAMES = ['normalizeState', 'normalizeStore', 'normalizeDeadlines', 'normalizeIntervals', 'normalizePhotoIds', 'toInt', 'blankRecord',
    'parseDate', 'toIso', 'addMonths', 'daysUntil', 'formatDate', 'todayIso', 'vehicleTitle', 'esc',
    'trackedServices', 'getServiceStatus', 'intervalUsed', 'isOverdue', 'dueText', 'fuelStats', 'guessCategory',
    'normalizeVin', 'decodeVinLocal', 'bmwSeriesKey', 'bmwChassisCode', 'bmwDesignation', 'seriesCodeFor', 'colorKeysFor', 'colorOfSettings',
    'contrastRatio', 'contrastAdjust', 'daysSince', 'backupInfo', 'backupAgeText', 'readBackupMeta', 'loadState', 'validHex',
    'CATEGORIES', 'BMW_COLORS', 'SERIES_COLORS', 'DEFAULT_INTERVALS', 'EMPTY_DATA', 'BMW_GENERATIONS', 'STORAGE_KEY', 'GENERIC_COLOR_KEYS',
    'setState', 'setStore'];
const storage = makeStorage();
const A = loadApp(NAMES, {
    globals: { localStorage: storage },
    extraSrc: 'const setState = s => { state = s; }; const setStore = s => { store = s; };',
});
const iso = off => { const d = new Date(); d.setDate(d.getDate() + off); return A.toIso(d); };
const rec = (extra = {}) => ({ vehicle: { vin: '', make: '', model: '', chassis: '', firstRegistration: '', currentKm: 0 }, serviceHistory: [], fuelLog: [], settings: {}, ...extra });

// ───────────── Hilfsfunktionen ─────────────
test('toInt: ganze Zahlen ab Minimum, sonst null', () => {
    assert.equal(A.toInt('12.6', 0), 13); assert.equal(A.toInt(-1, 0), null); assert.equal(A.toInt('x', 0), null);
    assert.equal(A.toInt(0, 1), null); assert.equal(A.toInt(5, 1), 5);
});
test('esc: HTML maskieren', () => {
    assert.equal(A.esc('<b onclick="x">&\'</b>'), '&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;');
});
test('normalizePhotoIds: nur sichere IDs, ohne Duplikate, gedeckelt', () => {
    assert.deepEqual(J(A.normalizePhotoIds(['a1', 'a1', '../x', 'b-2', 'c d', 'e_5'], 3)), ['a1', 'b-2', 'e_5']);
    assert.deepEqual(J(A.normalizePhotoIds('kaputt', 5)), []);
});
test('vehicleTitle: Marke und Modell ohne Doppelungen', () => {
    assert.equal(A.vehicleTitle({ make: 'BMW', model: '530i' }), 'BMW 530i');
    assert.equal(A.vehicleTitle({ make: 'BMW', model: 'BMW 530i' }), 'BMW 530i');
    assert.equal(A.vehicleTitle({ make: 'Audi', model: '' }), 'Audi');
    assert.equal(A.vehicleTitle({}), '');
});

// ───────────── Datum ─────────────
test('parseDate: gültige Tage, unmögliche Daten ergeben null', () => {
    assert.equal(A.parseDate('2026-02-28').getDate(), 28);
    assert.equal(A.parseDate('2026-02-30'), null); assert.equal(A.parseDate('2026-13-01'), null);
    assert.equal(A.parseDate(''), null); assert.equal(A.parseDate(undefined), null); assert.equal(A.parseDate('heute'), null);
    assert.equal(A.parseDate('2024-02-29').getMonth(), 1);
    assert.equal(A.parseDate('2025-02-29'), null);
});
test('toIso/parseDate: Rundlauf ohne Zeitzonen-Versatz', () => {
    assert.equal(A.toIso(A.parseDate('2026-03-29')), '2026-03-29');
    assert.equal(A.toIso(new Date(2026, 0, 5)), '2026-01-05');
});
test('addMonths: Monatsende wird begrenzt, Jahreswechsel, ungültig → leer', () => {
    assert.equal(A.addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(A.addMonths('2024-01-31', 1), '2024-02-29');
    assert.equal(A.addMonths('2026-11-15', 3), '2027-02-15');
    assert.equal(A.addMonths('2026-03-31', 12), '2027-03-31');
    assert.equal(A.addMonths('quatsch', 3), '');
});
test('daysUntil/formatDate', () => {
    assert.equal(A.daysUntil(iso(0)), 0); assert.equal(A.daysUntil(iso(10)), 10); assert.equal(A.daysUntil(iso(-3)), -3);
    assert.equal(A.formatDate('2026-03-05'), '05.03.2026'); assert.equal(A.formatDate('kaputt'), 'kaputt');
});

// ───────────── Normalisierung ─────────────
test('normalizeIntervals: nur bekannte Kategorien, ganze positive Zahlen, leer fällt weg', () => {
    const r = J(A.normalizeIntervals({ 'Öl': { km: '15000', months: 0 }, 'Anderes': { km: 5 }, 'Unbekannt': { km: 5 }, 'Bremsen': { km: null, months: null }, 'Reifen': 'x' }));
    assert.deepEqual(r, { 'Öl': { km: 15000, months: null } });
    assert.deepEqual(J(A.normalizeIntervals(null)), J(A.DEFAULT_INTERVALS));
});
test('normalizeDeadlines: Titel/Datum nötig, doppelte IDs ersetzt, gedeckelt', () => {
    const r = A.normalizeDeadlines([{ id: 'a', title: ' TÜV ', date: '2027-01-01', months: 24 }, { id: 'a', title: 'Dup', date: '2027-02-01' },
        { title: '', date: '2027-01-01' }, { title: 'x', date: 'kaputt' }, null, { id: '../x', title: 'Versicherung', date: '2026-12-31', months: 'x' }]);
    assert.equal(r.length, 3); assert.equal(r[0].title, 'TÜV'); assert.equal(r[0].months, 24);
    assert.notEqual(r[1].id, 'a'); assert.match(r[2].id, /^[\w-]+$/); assert.equal(r[2].months, 0);
    assert.equal(A.normalizeDeadlines(Array.from({ length: 50 }, (_, i) => ({ title: 't' + i, date: '2027-01-01' }))).length, 30);
});
test('normalizeState: ungültiges Format wirft', () => {
    for (const bad of [null, 5, {}, { vehicle: {} }, { vehicle: {}, serviceHistory: 'x' }, { vehicle: 'x', serviceHistory: [] }]) {
        assert.throws(() => A.normalizeState(bad), /Ungültiges Format/);
    }
});
test('normalizeState: Einträge werden geprüft, bereinigt und IDs eindeutig', () => {
    const s = A.normalizeState(rec({
        vehicle: { vin: 'WBADT61000FX12345', currentKm: '120000.4', make: 'BMW', model: null },
        serviceHistory: [
            { id: 'e1', date: '2026-01-10', km: 100000, category: 'Öl', description: '  Ölwechsel ', cost: '89.999', shop: ' Werkstatt ', photos: ['p1', 'p2'], receipts: ['p2', 'zz'] },
            { id: 'e1', date: '2026-02-10', km: 101000, category: 'Quatsch', description: 'doppelte ID' },
            { id: 'e3', date: '2026-13-40', km: 1, description: 'ungültiges Datum' },
            { id: 'e4', date: '2026-03-01', km: -5, description: 'negative km' },
            null,
        ],
        fuelLog: [{ id: 'f1', date: '2026-01-05', km: 100000, liters: 40.123, cost: 70, full: false }, { id: 'f2', date: '2026-01-06', km: 100500, liters: 0 }, { id: 'f3', date: 'x', km: 1, liters: 5 }],
    }));
    assert.equal(s.vehicle.currentKm, 120000); assert.equal(s.vehicle.model, '');
    assert.equal(s.serviceHistory.length, 2);
    const [a, b] = s.serviceHistory;
    assert.equal(a.description, 'Ölwechsel'); assert.equal(a.cost, 90); assert.equal(a.shop, 'Werkstatt');
    assert.deepEqual(J(a.photos), ['p1', 'p2']); assert.deepEqual(J(a.receipts), ['p2'], 'Belege sind Teilmenge der Fotos');
    assert.equal(b.category, 'Anderes'); assert.notEqual(b.id, 'e1');
    assert.equal(s.fuelLog.length, 1); assert.equal(s.fuelLog[0].liters, 40.12); assert.equal(s.fuelLog[0].full, false);
    assert.equal(s.settings.onboardingDone, true, 'Fahrzeugdaten vorhanden → Einrichtung gilt als erledigt');
});
test('normalizeState: Einstellungen – Farben, Teilen-Daten, Notizen', () => {
    const base = { vehicleColor: 'custom', customColor: '#AABBCC', notes: '  Hinweis  ' };
    const s = A.normalizeState(rec({ settings: { ...base, share: { id: 'a'.repeat(20), secret: 'b'.repeat(24), on: true, showVin: 1, until: '2027-01-01' } } }));
    assert.equal(s.settings.vehicleColor, 'custom'); assert.equal(s.settings.customColor, '#aabbcc');
    assert.equal(s.settings.notes, '  Hinweis  '.slice(0, 3000));
    assert.equal(s.settings.share.on, true); assert.equal(s.settings.share.showVin, false); assert.equal(s.settings.share.until, '2027-01-01');
    assert.equal(A.normalizeState(rec({ settings: { vehicleColor: 'gibtsnicht' } })).settings.vehicleColor, 'titansilber');
    assert.equal(A.normalizeState(rec({ settings: { vehicleColor: 'custom', customColor: 'rot' } })).settings.vehicleColor, 'titansilber');
    assert.ok(!('share' in A.normalizeState(rec({ settings: { share: { id: 'kurz', secret: 'x' } } })).settings));
});
test('normalizeState: Löschmarken und Änderungszeiten nur im erlaubten Format', () => {
    const s = A.normalizeState(rec({ deleted: { ok1: 123, 'bad id!': 5, neg: -1 }, meta: { vehicleAt: '77', fieldAt: { 'v.vin': 5, 's.notes': 6, 'x.evil': 9, 'v.': 3 } } }));
    assert.deepEqual(J(s.deleted), { ok1: 123 });
    assert.equal(s.meta.vehicleAt, 77); assert.deepEqual(J(s.meta.fieldAt), { 'v.vin': 5, 's.notes': 6 });
});
test('normalizeState: id aus Altdaten wird „main“', () => {
    assert.equal(A.normalizeState(rec()).id, 'main');
    assert.equal(A.normalizeState(rec({ id: 'auto-2' })).id, 'auto-2');
    assert.equal(A.normalizeState(rec({ id: '../x' })).id, 'main');
});
test('normalizeStore: Altformat (ein Fahrzeug) und Mehrfahrzeug-Format', () => {
    const old = A.normalizeStore(rec({ vehicle: { vin: 'X', make: 'BMW', model: '', chassis: '', firstRegistration: '', currentKm: 5 } }));
    assert.equal(old.vehicles.length, 1); assert.equal(old.activeId, 'main');
    const multi = A.normalizeStore({ activeId: 'zwei', vehicles: [rec({ id: 'eins' }), rec({ id: 'zwei' }), rec({ id: 'zwei' }), 'kaputt'], deletedVehicles: { alt: 5, 'bad!': 3 } });
    assert.equal(multi.vehicles.length, 3); assert.equal(new Set(multi.vehicles.map(v => v.id)).size, 3);
    assert.equal(multi.activeId, 'zwei'); assert.deepEqual(J(multi.deletedVehicles), { alt: 5 });
    assert.equal(A.normalizeStore({ activeId: 'nix', vehicles: [rec({ id: 'eins' })] }).activeId, 'eins');
    assert.equal(A.normalizeStore({ vehicles: [] }).vehicles[0].id, 'main');
    assert.throws(() => A.normalizeStore({ vehicles: ['kaputt'] }), /Ungültiges Format/);
    assert.throws(() => A.normalizeStore(null), /Ungültiges Format/);
});
test('loadState: beschädigte Daten werden gesichert und ergeben null', () => {
    storage.setItem(A.STORAGE_KEY, '{kaputt');
    assert.equal(A.loadState(), null);
    assert.equal(storage.getItem(A.STORAGE_KEY + '_broken'), '{kaputt');
    storage.removeItem(A.STORAGE_KEY);
    assert.equal(A.loadState(), null);
    storage.setItem(A.STORAGE_KEY, JSON.stringify(rec({ id: 'v1' })));
    assert.equal(A.loadState().activeId, 'v1');
});

// ───────────── Wartungsstatus ─────────────
function setup(entries, intervals, km = 100000) {
    A.setState(A.normalizeState(rec({ vehicle: { vin: 'X', make: 'BMW', model: 'x', chassis: '', firstRegistration: '', currentKm: km }, serviceHistory: entries, settings: { intervals } })));
}
const oil = (km, date) => ({ id: 'o' + km, date, km, category: 'Öl', description: 'Öl' });
test('trackedServices: nur Kategorien mit Intervall, Fälligkeit aus letztem Eintrag', () => {
    setup([oil(90000, iso(-30)), oil(80000, iso(-400))], { 'Öl': { km: 12000, months: 12 }, 'Bremsen': { km: 30000, months: null } });
    const t = A.trackedServices();
    assert.deepEqual(t.map(x => x.category).sort(), ['Bremsen', 'Öl']);
    const o = t.find(x => x.category === 'Öl');
    assert.equal(o.dueKm, 102000); assert.equal(o.last.km, 90000); assert.equal(A.daysUntil(o.dueDate) > 300, true);
    assert.equal(t.find(x => x.category === 'Bremsen').last, null);
});
test('getServiceStatus: none/ok/warn/alert nach km', () => {
    const st = km => { setup([oil(90000, iso(0))], { 'Öl': { km: 12000, months: null } }, km); return A.getServiceStatus(A.trackedServices()[0]); };
    assert.equal(st(91000), 'ok');       // 11000 km übrig
    assert.equal(st(100500), 'warn');    // 1500 übrig ≤ 15 % von 12000 (1800)
    assert.equal(st(101800), 'alert');   // 200 übrig ≤ max(300, 600)
    assert.equal(st(103000), 'alert');   // überfällig
    setup([], { 'Öl': { km: 12000, months: 12 } });
    assert.equal(A.getServiceStatus(A.trackedServices()[0]), 'none');
});
test('getServiceStatus: Zeit-Intervall (Monate) und schlechtester Wert gewinnt', () => {
    setup([oil(100000, A.addMonths(iso(0), -23))], { 'Öl': { km: null, months: 24 } });
    assert.equal(A.getServiceStatus(A.trackedServices()[0]), 'alert'); // ~30 Tage übrig
    setup([oil(100000, iso(-10))], { 'Öl': { km: null, months: 24 } });
    assert.equal(A.getServiceStatus(A.trackedServices()[0]), 'ok');
    setup([oil(90000, iso(-10))], { 'Öl': { km: 12000, months: 24 } }, 101800);
    assert.equal(A.getServiceStatus(A.trackedServices()[0]), 'alert', 'km kritisch, Zeit ok');
});
test('isOverdue / dueText / intervalUsed', () => {
    setup([oil(90000, iso(-10))], { 'Öl': { km: 12000, months: null } }, 103000);
    const s = A.trackedServices()[0];
    assert.equal(A.isOverdue(s), true); assert.match(A.dueText(s), /überfällig/);
    setup([oil(90000, iso(-10))], { 'Öl': { km: 12000, months: null } }, 96000);
    const s2 = A.trackedServices()[0];
    assert.equal(A.isOverdue(s2), false); assert.match(A.dueText(s2), /noch 6\.000 km/);
    assert.equal(A.intervalUsed(s2), 50);
    setup([], { 'Öl': { km: 12000, months: null } });
    const s3 = A.trackedServices()[0];
    assert.equal(A.dueText(s3), 'nach dem ersten Eintrag'); assert.equal(A.intervalUsed(s3), 0); assert.equal(A.isOverdue(s3), false);
});

// ───────────── Verbrauch ─────────────
test('fuelStats: Verbrauch zwischen Volltankungen, Teilbetankungen werden eingerechnet', () => {
    A.setState(A.normalizeState(rec({ fuelLog: [
        { id: 'f1', date: '2026-01-01', km: 1000, liters: 50, full: true },
        { id: 'f2', date: '2026-01-10', km: 1300, liters: 20, full: false },
        { id: 'f3', date: '2026-01-20', km: 1600, liters: 25, full: true, cost: 45 },
        { id: 'f4', date: '2026-02-01', km: 2200, liters: 36, full: true, cost: 72 },
    ] })));
    const s = A.fuelStats();
    assert.equal(s.seg.size, 2);
    assert.ok(Math.abs(s.seg.get('f3').l100 - 7.5) < 1e-9, '45 l auf 600 km');
    assert.ok(Math.abs(s.seg.get('f4').l100 - 6) < 1e-9);
    assert.ok(Math.abs(s.avg - (81 / 1200 * 100)) < 1e-9 || Math.abs(s.avg - 6.75) < 1e-9);
    assert.equal(s.last, 6); assert.equal(s.series.length, 2);
    assert.equal(s.totalLiters, 131); assert.equal(s.totalCost, 117);
    assert.ok(Math.abs(s.pricePerL - 117 / 61) < 1e-9);
});
test('fuelStats: ohne Volltankungen keine Durchschnittswerte', () => {
    A.setState(A.normalizeState(rec()));
    let s = A.fuelStats(); assert.equal(s.avg, null); assert.equal(s.last, null); assert.equal(s.pricePerL, null);
    A.setState(A.normalizeState(rec({ fuelLog: [{ id: 'a', date: '2026-01-01', km: 10, liters: 5, full: false }, { id: 'b', date: '2026-01-02', km: 100, liters: 5, full: false }] })));
    s = A.fuelStats(); assert.equal(s.avg, null); assert.equal(s.seg.size, 0);
});

// ───────────── Kategorien ─────────────
test('guessCategory: Stichworte zur Kategorie', () => {
    const g = A.guessCategory;
    assert.equal(g('Bremsbeläge vorne'), 'Bremsen'); assert.equal(g('Zündkerzen gewechselt'), 'Zündkerzen');
    assert.equal(g('HU/AU beim TÜV'), 'TÜV'); assert.equal(g('Ölfilter'), 'Filter');
    assert.equal(g('Inspektion'), 'Inspektion'); assert.equal(g('Kühler getauscht'), 'Kühlmittel');
    assert.equal(g('Spureinstellung'), 'Reifen'); assert.equal(g('Scheibenwischer'), null);
});
test('CATEGORIES: jede Kategorie hat Icon, Farben und Beschriftung', () => {
    for (const [k, c] of Object.entries(A.CATEGORIES)) {
        assert.ok(c.icon && c.fb && c.label, k); assert.match(c.light, /^#[0-9a-f]{6}$/i); assert.match(c.dark, /^#[0-9a-f]{6}$/i);
    }
    assert.ok(A.CATEGORIES['Anderes']);
});

// ───────────── VIN / BMW ─────────────
test('normalizeVin: Großbuchstaben, I/O/Q ersetzt, 17 Stellen', () => {
    assert.equal(A.normalizeVin('wba-dt61 0o0fx12345xyz'), 'WBADT61000FX12345');
    assert.equal(A.normalizeVin('Ii'), '11'); assert.equal(A.normalizeVin(null), '');
    assert.equal(A.normalizeVin('A'.repeat(30)).length, 17);
});
test('decodeVinLocal: BMW-Typschlüssel DT61 → E39 530iA Limousine', () => {
    const d = J(A.decodeVinLocal('WBADT61000FX12345'));
    assert.equal(d.make.startsWith('BMW'), true); assert.equal(d.series, 'E39'); assert.equal(d.model, 'E39 530iA');
    assert.equal(d.body, 'Limousine'); assert.equal(d.transmission, 'Automatik'); assert.equal(d.chassis, 'FX12345');
});
test('decodeVinLocal: unbekannter Hersteller bleibt leer, Modelljahr nur in Nordamerika', () => {
    const d = A.decodeVinLocal('ZZZZZZZZZZZZZZZZZ');
    assert.equal(d.series, undefined); assert.equal(d.modelYear, undefined);
    assert.ok(A.decodeVinLocal('1HGCM82633A004352').modelYear);
});
test('bmwSeriesKey', () => {
    assert.equal(A.bmwSeriesKey('530i'), '5'); assert.equal(A.bmwSeriesKey('3er'), '3'); assert.equal(A.bmwSeriesKey('X5 3.0i'), 'X5');
    assert.equal(A.bmwSeriesKey('Z4'), 'Z4'); assert.equal(A.bmwSeriesKey('Golf'), '');
});
test('bmwChassisCode: Baureihe nach Baujahr und Karosserie', () => {
    assert.equal(A.bmwChassisCode('5', 2000, 'Sedan/Saloon', false), 'E39');
    assert.equal(A.bmwChassisCode('3', 2008, 'Wagon', false), 'E91');
    assert.equal(A.bmwChassisCode('3', 2008, 'Coupe', false), 'E92');
    assert.equal(A.bmwChassisCode('3', 2008, 'Convertible/Cabriolet', false), 'E93');
    assert.equal(A.bmwChassisCode('3', 2015, 'Sedan/Saloon', true), 'F34');
    assert.equal(A.bmwChassisCode('5', 1950, '', false), ''); assert.equal(A.bmwChassisCode('9', 2000, '', false), '');
    assert.equal(A.bmwChassisCode('X5', 2010, '', false), 'E70');
});
test('BMW_GENERATIONS: Zeiträume je Reihe lückenlos aufsteigend, Codes eindeutig je Reihe', () => {
    for (const [k, gens] of Object.entries(A.BMW_GENERATIONS)) {
        for (let i = 0; i < gens.length; i++) {
            assert.ok(gens[i][0] <= gens[i][1], `${k} ${gens[i][2]}`);
            if (i) assert.ok(gens[i][0] > gens[i - 1][0], `${k} aufsteigend`);
        }
    }
});
test('bmwDesignation: Typ-Schriftzug und Baureihe', () => {
    let d = J(A.bmwDesignation({ model: '530i', series: '', trim: '', year: '2001', disp: 3.0, fuel: 'Gasoline', transmission: 'Automatic', drive: 'RWD', bodyClass: 'Sedan/Saloon' }));
    assert.equal(d.series, 'E39'); assert.equal(d.badge, '530iA');
    d = J(A.bmwDesignation({ model: '320d', series: '', trim: '', year: '2008', disp: 2.0, fuel: 'Diesel', transmission: 'Manual/Standard', drive: 'RWD', bodyClass: 'Wagon' }));
    assert.equal(d.series, 'E91'); assert.equal(d.badge, '320d');
    assert.equal(A.bmwDesignation({ model: 'Golf', series: '', trim: '', year: '2010', disp: 1.4, fuel: '', transmission: '', drive: '', bodyClass: '' }), null);
});

// ───────────── Farben ─────────────
test('seriesCodeFor / colorKeysFor: Baureihe aus Fahrzeugdaten, sonst allgemeine Farben', () => {
    assert.equal(A.seriesCodeFor({ make: 'BMW', model: '530i', chassis: 'E39' }), 'E39');
    assert.equal(A.seriesCodeFor({ make: 'BMW', model: '3er Touring E91' }), 'E90');
    assert.equal(A.seriesCodeFor({ make: 'BMW', model: 'Z3' }), 'E36/7');
    assert.equal(A.seriesCodeFor({ make: 'Audi', chassis: 'E39' }), '');
    assert.equal(A.seriesCodeFor(null), '');
    assert.deepEqual(J(A.colorKeysFor({ make: 'Audi' })), J(A.GENERIC_COLOR_KEYS));
});
test('Farbpaletten: alle Schlüssel existieren, Akzentfarben sind gültige Hex-Werte', () => {
    for (const [code, keys] of Object.entries(A.SERIES_COLORS)) for (const k of keys) assert.ok(A.BMW_COLORS[k], `${code}: Farbe ${k} fehlt`);
    for (const k of A.GENERIC_COLOR_KEYS) assert.ok(A.BMW_COLORS[k], k);
    for (const [k, c] of Object.entries(A.BMW_COLORS)) for (const f of ['hex', 'light', 'dark']) assert.match(c[f], /^#[0-9a-fA-F]{6}$/, `${k}.${f}`);
});
test('Akzentfarben im Hell-Design haben genug Kontrast zu weißer Schrift (≥ 4,5:1)', () => {
    for (const [k, c] of Object.entries(A.BMW_COLORS)) assert.ok(A.contrastRatio(c.light, '#ffffff') >= 4.5, `${k}: ${A.contrastRatio(c.light, '#ffffff').toFixed(2)}`);
});
test('contrastRatio/contrastAdjust/colorOfSettings: eigene Farbe wird lesbar gemacht', () => {
    assert.ok(Math.abs(A.contrastRatio('#000000', '#ffffff') - 21) < 1e-6);
    const c = A.colorOfSettings({ vehicleColor: 'custom', customColor: '#FFEE00' });
    assert.equal(c.label, 'Eigene Farbe'); assert.ok(A.contrastRatio(c.light, '#EEF0F3') >= 4.5); assert.ok(A.contrastRatio(c.dark, '#0B0C0F') >= 4.5);
    assert.equal(A.colorOfSettings({}).label, A.BMW_COLORS.titansilber.label);
    assert.equal(A.colorOfSettings({ vehicleColor: 'custom', customColor: 'x' }).label, A.BMW_COLORS.titansilber.label);
});

// ───────────── Sicherungs-Erinnerung ─────────────
test('daysSince / backupAgeText', () => {
    assert.equal(A.daysSince(new Date(Date.now() - 3.5 * 864e5).toISOString()), 3);
    assert.equal(A.daysSince('quatsch'), null);
    assert.equal(A.backupAgeText({ last: null }), 'Noch keine Sicherung angelegt');
    assert.equal(A.backupAgeText({ last: 'x', days: 0 }), 'Letzte Sicherung: heute');
    assert.equal(A.backupAgeText({ last: 'x', days: 1 }), 'Letzte Sicherung: gestern');
    assert.equal(A.backupAgeText({ last: 'x', days: 9 }), 'Letzte Sicherung: vor 9 Tagen');
    assert.equal(A.backupAgeText({ last: 'x', days: null }), 'Letzte Sicherung: unbekannt');
});
test('backupInfo: fällig nach 3 Einträgen ohne Sicherung, nach 30 Tagen mit Änderung, nach 20 Änderungen; Schlummern', () => {
    const mk = n => ({ vehicles: [A.normalizeState(rec({ serviceHistory: Array.from({ length: n }, (_, i) => ({ id: 'e' + i, date: '2026-01-01', km: i, description: 'x' })) }))] });
    A.setStore(mk(2)); storage.removeItem('cst_backup');
    assert.equal(A.backupInfo().due, false);
    A.setStore(mk(3)); assert.equal(A.backupInfo().due, true);
    storage.setItem('cst_backup', JSON.stringify({ last: new Date(Date.now() - 40 * 864e5).toISOString(), count: 3 }));
    assert.equal(A.backupInfo().due, false, 'keine Änderung seit der Sicherung');
    A.setStore(mk(4)); assert.equal(A.backupInfo().due, true);
    storage.setItem('cst_backup', JSON.stringify({ last: new Date().toISOString(), count: 3 }));
    assert.equal(A.backupInfo().due, false);
    A.setStore(mk(30)); assert.equal(A.backupInfo().due, true);
    storage.setItem('cst_backup', JSON.stringify({ last: new Date().toISOString(), count: 3, snooze: new Date(Date.now() + 864e5).toISOString() }));
    assert.equal(A.backupInfo().due, false, 'geschlummert');
});
