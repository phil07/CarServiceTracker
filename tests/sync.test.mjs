// Tests für das Zusammenführen bei der Drive-Synchronisierung (sync.js): pro Eintrag gewinnt der neuere Stand,
// Löschmarken schlagen ältere Einträge, Fahrzeuge werden zusammengeführt. Lädt app.js + sync.js zusammen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, read, J } from './helpers.mjs';

let sync = read('sync.js');
const end = sync.lastIndexOf('})');
sync = sync.slice(0, end) + '\n;window.__s = { mergeList, mergeRecords, mergeStates, payloadOf, same, recStamp, isBlank };\n' + sync.slice(end);
const ctx = run(`${read('app.js')}\n${sync}\n;var __n = { normalizeState, normalizeStore, blankRecord };`);
const S = ctx.window.__s, N = ctx.__n;

const veh = (o = {}) => ({ vin: '', make: '', model: '', chassis: '', firstRegistration: '', currentKm: 0, ...o });
const entry = (id, updatedAt, extra = {}) => ({ id, date: '2026-01-01', km: 1, category: 'Öl', description: id, updatedAt, ...extra });
const rec = (o = {}) => N.normalizeState({ id: 'main', vehicle: veh({ vin: 'WBADT61000FX12345', make: 'BMW' }), serviceHistory: [], fuelLog: [], settings: { onboardingDone: true }, ...o });

test('mergeList: je Eintrag gewinnt der neuere Stand, beide Seiten bleiben erhalten', () => {
    const r = S.mergeList([{ id: 'a', updatedAt: 5, v: 'lokal' }, { id: 'b', updatedAt: 1 }], [{ id: 'a', updatedAt: 9, v: 'remote' }, { id: 'c', updatedAt: 2 }]);
    const m = Object.fromEntries(J(r).map(e => [e.id, e]));
    assert.equal(m.a.v, 'remote'); assert.ok(m.b && m.c); assert.equal(r.length, 3);
    assert.equal(S.mergeList([{ id: 'a', updatedAt: 9, v: 'lokal' }], [{ id: 'a', updatedAt: 5, v: 'remote' }])[0].v, 'lokal');
});
test('mergeRecords: neue Einträge beider Seiten werden vereint', () => {
    const l = rec({ serviceHistory: [entry('l1', 10)] }), r = rec({ serviceHistory: [entry('r1', 20)] });
    assert.deepEqual(J(S.mergeRecords(l, r).serviceHistory.map(e => e.id).sort()), ['l1', 'r1']);
});
test('mergeRecords: neuere Löschmarke entfernt den Eintrag, ein später geänderter Eintrag überlebt', () => {
    const l = rec({ serviceHistory: [entry('x', 10), entry('y', 50)] });
    const r = rec({ serviceHistory: [], deleted: { x: 20, y: 30 } });
    const m = S.mergeRecords(l, r);
    assert.deepEqual(J(m.serviceHistory.map(e => e.id)), ['y']);
    assert.equal(m.deleted.x, 20);
});
test('mergeRecords: Löschmarken beider Seiten werden vereint (größte Zeit)', () => {
    const m = S.mergeRecords(rec({ deleted: { a: 5, b: 9 } }), rec({ deleted: { a: 7 } }));
    assert.deepEqual(J(m.deleted), { a: 7, b: 9 });
});
test('mergeRecords: Fahrzeugfelder je Feld nach Änderungszeit', () => {
    const l = rec({ vehicle: veh({ vin: 'WBADT61000FX12345', make: 'BMW', model: 'lokal', currentKm: 100 }), meta: { vehicleAt: 50, fieldAt: { 'v.model': 50, 'v.currentKm': 10 } } });
    const r = rec({ vehicle: veh({ vin: 'WBADT61000FX12345', make: 'BMW', model: 'remote', currentKm: 200 }), meta: { vehicleAt: 40, fieldAt: { 'v.model': 20, 'v.currentKm': 40 } } });
    const m = S.mergeRecords(l, r);
    assert.equal(m.vehicle.model, 'lokal'); assert.equal(m.vehicle.currentKm, 200);
    assert.equal(m.meta.vehicleAt, 50); assert.equal(m.meta.fieldAt['v.currentKm'], 40);
});
test('mergeRecords: leeres Fahrzeug überschreibt kein befülltes bei Gleichstand', () => {
    const filled = rec({ vehicle: veh({ vin: 'WBADT61000FX12345', make: 'BMW' }) });
    const empty = N.normalizeState({ id: 'main', vehicle: veh(), serviceHistory: [], settings: {} });
    assert.equal(S.mergeRecords(empty, filled).vehicle.vin, 'WBADT61000FX12345');
    assert.equal(S.mergeRecords(filled, empty).vehicle.vin, 'WBADT61000FX12345');
});
test('mergeRecords: Ergebnis ist normalisiert (ungültige Einträge fallen weg)', () => {
    const l = rec(), r = rec();
    r.serviceHistory = [{ id: 'bad', date: 'kaputt', km: 1, category: 'Öl', description: '' }];
    assert.equal(S.mergeRecords(l, r).serviceHistory.length, 0);
});
test('mergeStates: Fahrzeuge nur auf einer Seite bleiben erhalten', () => {
    const l = N.normalizeStore({ activeId: 'a', vehicles: [rec({ id: 'a' })] }), r = N.normalizeStore({ vehicles: [rec({ id: 'b', vehicle: veh({ vin: 'WBAXX', make: 'BMW' }) })] });
    const m = S.mergeStates(l, r, true);
    assert.deepEqual(J(m.vehicles.map(v => v.id).sort()), ['a', 'b']); assert.equal(m.activeId, 'a');
});
test('mergeStates: gleiche id, verschiedene VIN bei erster Verbindung → zwei getrennte Fahrzeuge', () => {
    const l = N.normalizeStore({ vehicles: [rec({ id: 'main', vehicle: veh({ vin: 'WBAAAAAAAAAAAAAAA', make: 'BMW' }) })] });
    const r = N.normalizeStore({ vehicles: [rec({ id: 'main', vehicle: veh({ vin: 'WBABBBBBBBBBBBBBB', make: 'BMW' }) })] });
    assert.equal(S.mergeStates(l, r, false).vehicles.length, 2);
    assert.equal(S.mergeStates(l, r, true).vehicles.length, 1, 'bereits verbunden → zusammenführen');
});
test('mergeStates: gelöschtes Fahrzeug bleibt gelöscht, außer es wurde danach geändert; leere Fahrzeuge entfallen', () => {
    const veh1 = rec({ id: 'v1', serviceHistory: [entry('e', 10)] });
    const l = N.normalizeStore({ vehicles: [veh1, rec({ id: 'v2', serviceHistory: [entry('n', 100)] })] });
    const r = N.normalizeStore({ vehicles: [], deletedVehicles: { v1: 50, v2: 50 } });
    const m = S.mergeStates(l, r, true);
    assert.deepEqual(J(m.vehicles.map(v => v.id)), ['v2'], 'v1 gelöscht, v2 später geändert');
    const blank = N.normalizeState({ id: 'leer', vehicle: veh(), serviceHistory: [], settings: {} });
    const m2 = S.mergeStates(N.normalizeStore({ vehicles: [rec({ id: 'voll' }), blank] }), N.normalizeStore({ vehicles: [] }), true);
    assert.deepEqual(J(m2.vehicles.map(v => v.id)), ['voll']);
});
test('payloadOf/same: Reihenfolge der Einträge ist egal, Auswahl des Fahrzeugs zählt nicht', () => {
    const a = N.normalizeStore({ activeId: 'a', vehicles: [rec({ id: 'a', serviceHistory: [entry('1', 1), entry('2', 2)] }), rec({ id: 'b' })] });
    const b = N.normalizeStore({ activeId: 'b', vehicles: [rec({ id: 'b' }), rec({ id: 'a', serviceHistory: [entry('2', 2), entry('1', 1)] })] });
    assert.equal(S.same(a, b), true);
    const c = N.normalizeStore({ activeId: 'a', vehicles: [rec({ id: 'a', serviceHistory: [entry('1', 1), entry('2', 3)] }), rec({ id: 'b' })] });
    assert.equal(S.same(a, c), false);
});
