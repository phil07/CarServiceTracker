// Gemeinsame Hilfen: lädt die echten Browser-Skripte (app.js, sync.js …) in eine vm mit minimaler
// Fake-Umgebung (window, document, localStorage) – ohne Kopie des Codes.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
export const J = x => JSON.parse(JSON.stringify(x)); // Objekte aus der vm haben andere Prototypen

export function makeStorage(initial = {}) {
    const m = new Map(Object.entries(initial));
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); },
        get _map() { return m; },
    };
}

const noop = () => {};
function fakeEl() {
    return new Proxy(function () {}, {
        get: (t, k) => {
            if (k === Symbol.toPrimitive) return () => '';
            if (k === 'style' || k === 'dataset' || k === 'classList') return new Proxy({}, { get: () => noop, set: () => true });
            if (k === 'children' || k === 'childNodes') return [];
            if (k === 'querySelectorAll') return () => [];
            if (k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
            return fakeEl();
        },
        set: () => true,
        apply: () => fakeEl(),
    });
}

// Führt Quelltext aus; `globals` werden vorab gesetzt, `exposeCode` läuft im selben Skript am Ende.
export function run(code, globals = {}) {
    const storage = globals.localStorage || makeStorage();
    const win = { crypto: globalThis.crypto, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }) };
    const doc = {
        readyState: 'loading', addEventListener: noop, removeEventListener: noop, getElementById: () => null,
        querySelector: () => null, querySelectorAll: () => [], createElement: () => fakeEl(),
        body: fakeEl(), head: fakeEl(), documentElement: fakeEl(),
    };
    const ctx = vm.createContext({
        window: win, document: doc, localStorage: storage, console, crypto: globalThis.crypto, self: win,
        setTimeout: noop, clearTimeout: noop, setInterval: noop, requestAnimationFrame: noop,
        navigator: { language: 'de-DE', onLine: true }, location: { hash: '', href: 'http://localhost/', search: '', pathname: '/' },
        history: { replaceState: noop }, addEventListener: noop, matchMedia: win.matchMedia, fetch: () => Promise.reject(new Error('offline')),
        btoa, atob, TextEncoder, TextDecoder, URLSearchParams, URL, Intl, Math, Date, JSON, Set, Map, Number, String, Array, Object, RegExp,
        encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isFinite, isNaN,
        ...globals,
    });
    win.window = win; win.localStorage = storage;
    vm.runInContext(code, ctx);
    return ctx;
}

// Lädt app.js komplett und gibt die genannten Namen zurück (const/let/function des Skripts).
export function loadApp(names, { extraSrc = '', globals = {}, before = '' } = {}) {
    const code = `var __out; ${before}\n${read('app.js')}\n${extraSrc}\n;__out = { ${names.join(', ')} };`;
    const ctx = run(code, globals);
    return Object.assign(ctx.__out, { _ctx: ctx });
}
