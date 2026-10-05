// Service Tracker – app.js
'use strict';

// ─── Fahrzeugfarben / Akzent-Palette ─────────────────────────────────────────
// hex   = Lackfarbe (Swatch)
// light = Akzent im hellen Design (weiße Schrift darauf, ≥ 4.5:1)
// dark  = Akzent im dunklen Design (dunkle Schrift darauf)
const BMW_COLORS = {
  // Silber / Grau
  alpinweiss:   { label: 'Alpinweiß',    hex: '#e8e8e6', light: '#475569', dark: '#E2E8F0' },
  arktissilber: { label: 'Arktissilber', hex: '#a9adb3', light: '#4A6A8A', dark: '#A9C4DE' },
  hellsilber:   { label: 'Hellsilber',   hex: '#b8bec7', light: '#52637A', dark: '#BCCADB' },
  kashmirsilber:{ label: 'Kashmirsilber',hex: '#b1b4ae', light: '#5B6572', dark: '#C3CAD3' },
  titansilber:  { label: 'Titansilber',  hex: '#8a8f98', light: '#3F5A78', dark: '#8FB0D3' },
  sterlinggrau: { label: 'Sterlinggrau', hex: '#7b7f86', light: '#475569', dark: '#AEBBCB' },
  stahlgrau:    { label: 'Stahlgrau',    hex: '#656a72', light: '#3B4A5C', dark: '#A3B1C2' },
  fjordgrau:    { label: 'Fjordgrau',    hex: '#5b6672', light: '#36556E', dark: '#8FB4CF' },
  // Schwarz
  schwarz:      { label: 'Schwarz',      hex: '#1c1c1f', light: '#27272A', dark: '#E4E4E7' },
  diamantschwarz:{label: 'Diamantschwarz',hex:'#1b1d22', light: '#1F2937', dark: '#E5E7EB' },
  cosmosschwarz:{ label: 'Cosmosschwarz',hex: '#101216', light: '#18181B', dark: '#E4E4E7' },
  carbonschwarz:{ label: 'Carbonschwarz',hex: '#202328', light: '#27272A', dark: '#E4E4E7' },
  // Blau
  orientblau:   { label: 'Orientblau',   hex: '#1e3a8a', light: '#1D4ED8', dark: '#60A5FA' },
  imperialblau: { label: 'Imperialblau', hex: '#1e2f6b', light: '#3730A3', dark: '#A5B4FC' },
  topasblau:    { label: 'Topasblau',    hex: '#3a6ea5', light: '#1D4ED8', dark: '#7DB4F0' },
  montrealblau: { label: 'Montrealblau', hex: '#2c4a78', light: '#1E40AF', dark: '#93C5FD' },
  biarritzblau: { label: 'Biarritzblau', hex: '#6f93b8', light: '#0369A1', dark: '#7DD3FC' },
  avusblau:     { label: 'Avusblau',     hex: '#1f4fa8', light: '#1D4ED8', dark: '#60A5FA' },
  // Rot
  calypsorot:   { label: 'Calypsorot',   hex: '#8b1a1a', light: '#C81E1E', dark: '#F87171' },
  sienarot:     { label: 'Sienarot',     hex: '#6e1f22', light: '#B91C1C', dark: '#FCA5A5' },
  // Grün
  bostongruen:  { label: 'Bostongrün',   hex: '#14532d', light: '#15803D', dark: '#4ADE80' },
  oxfordgruen:  { label: 'Oxfordgrün',   hex: '#1f3f2e', light: '#166534', dark: '#6EE7A0' },
  // Gelb / Beige
  dakargelb:    { label: 'Dakargelb',    hex: '#d9a521', light: '#A16207', dark: '#FACC15' },
  mojavesand:   { label: 'Mojavesand',   hex: '#a8875c', light: '#92400E', dark: '#E3A869' },
};

// ─── Kategorien ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  'Öl':               { icon: 'ph-drop',           fb: '🛢️', light: '#B45309', dark: '#FBBF24', label: 'Öl' },
  'Bremsflüssigkeit': { icon: 'ph-disc',           fb: '💧', light: '#0369A1', dark: '#38BDF8', label: 'Bremsflüssigkeit' },
  'Kühlmittel':       { icon: 'ph-thermometer',    fb: '🌡️', light: '#0E7490', dark: '#22D3EE', label: 'Kühlmittel' },
  'Zündkerzen':       { icon: 'ph-lightning',      fb: '⚡', light: '#A16207', dark: '#FACC15', label: 'Zündkerzen' },
  'Inspektion':       { icon: 'ph-clipboard-text', fb: '📋', light: '#4338CA', dark: '#A5B4FC', label: 'Inspektion' },
  'Filter':           { icon: 'ph-funnel',         fb: '🌀', light: '#15803D', dark: '#4ADE80', label: 'Filter' },
  'Bremsen':          { icon: 'ph-stop-circle',    fb: '🛑', light: '#B91C1C', dark: '#F87171', label: 'Bremsen' },
  'Getriebe':         { icon: 'ph-gear',           fb: '⚙️', light: '#6D28D9', dark: '#C4B5FD', label: 'Getriebe / Differential' },
  'Reifen':           { icon: 'ph-tire',           fb: '🛞', light: '#334155', dark: '#CBD5E1', label: 'Reifen / Räder' },
  'TÜV':              { icon: 'ph-seal-check',     fb: '✅', light: '#047857', dark: '#34D399', label: 'TÜV (HU/AU)' },
  'Anderes':          { icon: 'ph-wrench',         fb: '🔧', light: '#52525B', dark: '#A1A1AA', label: 'Anderes (Sonstiges)' },
};

// Wartungsintervalle (vom Nutzer einstellbar): km und/oder Monate; leer = nicht verfolgt
const DEFAULT_INTERVALS = {
  'Öl':               { km: 12000, months: 12 },
  'Bremsflüssigkeit': { km: null,  months: 24 },
  'Kühlmittel':       { km: null,  months: 48 },
  'Zündkerzen':       { km: 60000, months: null },
};

// ─── Leere Startdaten ─────────────────────────────────────────────────────────
const EMPTY_DATA = {
  vehicle: {
    vin: '',
    make: '',
    model: '',
    chassis: '',
    firstRegistration: '',
    currentKm: 0,
  },
  serviceHistory: [],
  fuelLog: [],
  settings: { vehicleColor: 'titansilber', onboardingDone: false, intervals: DEFAULT_INTERVALS },
};

// ─── State ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'bmw_e39_data'; // Schlüssel bleibt, damit bestehende Daten erhalten bleiben
const THEME_KEY   = 'cst_theme';
let state = null;
let activeTab = 'dashboard';
let historyFilterCat = 'Alle';
let historySearchVal  = '';
let toastTimer = null;

// ─── Persistenz ───────────────────────────────────────────────────────────────
function uid() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toInt(x, min) {
  const n = Math.round(Number(x));
  return isFinite(n) && n >= min ? n : null;
}

function normalizeIntervals(raw) {
  const src = raw && typeof raw === 'object' ? raw : DEFAULT_INTERVALS;
  const out = {};
  Object.keys(CATEGORIES).forEach(cat => {
    if (cat === 'Anderes') return;
    const iv = src[cat];
    if (!iv || typeof iv !== 'object') return;
    const km = toInt(iv.km, 1), months = toInt(iv.months, 1);
    if (km || months) out[cat] = { km, months };
  });
  return out;
}

// Prüft und bereinigt Daten (Import, localStorage). Wirft bei unbrauchbarem Format.
function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || !raw.vehicle || typeof raw.vehicle !== 'object' || !Array.isArray(raw.serviceHistory)) {
    throw new Error('Ungültiges Format');
  }
  const vehicle = Object.assign({}, EMPTY_DATA.vehicle, raw.vehicle);
  Object.keys(vehicle).forEach(k => {
    if (k !== 'currentKm') vehicle[k] = vehicle[k] == null ? '' : String(vehicle[k]);
  });
  vehicle.currentKm = toInt(vehicle.currentKm, 0) || 0;

  const seen = new Set();
  const serviceHistory = [];
  raw.serviceHistory.forEach(e => {
    if (!e || typeof e !== 'object') return;
    const date = String(e.date || '');
    const km = toInt(e.km, 0);
    if (!parseDate(date) || km === null) return;
    let id = String(e.id || '');
    if (!/^[\w-]+$/.test(id) || seen.has(id)) id = uid();
    seen.add(id);
    const entry = {
      id, date, km,
      category: CATEGORIES[e.category] ? e.category : 'Anderes',
      description: String(e.description == null ? '' : e.description).trim(),
    };
    const cost = Number(e.cost);
    if (e.cost !== '' && e.cost != null && isFinite(cost) && cost >= 0) entry.cost = Math.round(cost * 100) / 100;
    if (e.shop) entry.shop = String(e.shop).trim();
    if (e.note) entry.note = String(e.note).trim();
    const ua = toInt(e.updatedAt, 1); if (ua) entry.updatedAt = ua;
    serviceHistory.push(entry);
  });

  const fuelLog = [];
  (Array.isArray(raw.fuelLog) ? raw.fuelLog : []).forEach(f => {
    if (!f || typeof f !== 'object') return;
    const km = toInt(f.km, 0), liters = Number(f.liters);
    if (!parseDate(String(f.date || '')) || km === null || !isFinite(liters) || liters <= 0) return;
    let id = String(f.id || '');
    if (!/^[\w-]+$/.test(id) || seen.has(id)) id = uid();
    seen.add(id);
    const entry = { id, date: String(f.date), km, liters: Math.round(liters * 100) / 100, full: f.full !== false };
    const cost = Number(f.cost);
    if (f.cost !== '' && f.cost != null && isFinite(cost) && cost >= 0) entry.cost = Math.round(cost * 100) / 100;
    const ua = toInt(f.updatedAt, 1); if (ua) entry.updatedAt = ua;
    fuelLog.push(entry);
  });

  // Änderungsverfolgung für die Synchronisierung: Löschmarken + Zeitstempel für Fahrzeug/Einstellungen
  const deleted = {};
  if (raw.deleted && typeof raw.deleted === 'object') {
    Object.keys(raw.deleted).forEach(id => { const t = toInt(raw.deleted[id], 1); if (t && /^[\w-]+$/.test(id)) deleted[id] = t; });
  }
  const rm = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  const meta = {};
  if (toInt(rm.vehicleAt, 1))  meta.vehicleAt  = toInt(rm.vehicleAt, 1);
  if (toInt(rm.settingsAt, 1)) meta.settingsAt = toInt(rm.settingsAt, 1);

  const st = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const hasVehicle = !!(vehicle.vin || vehicle.make || vehicle.model || vehicle.chassis);
  return {
    vehicle,
    serviceHistory,
    fuelLog,
    deleted,
    meta,
    settings: {
      vehicleColor: BMW_COLORS[st.vehicleColor] ? st.vehicleColor : 'titansilber',
      onboardingDone: st.onboardingDone === true || hasVehicle,
      intervals: normalizeIntervals(st.intervals),
    },
  };
}

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { console.warn('loadState:', e); }
  if (!raw) return null;
  try { return normalizeState(JSON.parse(raw)); }
  catch (e) {
    console.warn('loadState: beschädigte Daten, Sicherung unter ' + STORAGE_KEY + '_broken', e);
    try { localStorage.setItem(STORAGE_KEY + '_broken', raw); } catch (e2) {}
    return null;
  }
}

// ─── Änderungsverfolgung (Grundlage der Drive-Synchronisierung) ───────────────
// saveState() ist der einzige Speicherpunkt: Er vergleicht mit dem letzten bekannten Stand,
// stempelt geänderte Einträge (updatedAt) und merkt gelöschte als Löschmarke (deleted[id]).
let snap = null;
const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((r, key) => (r[key] = v[key], r), {}) : v);
const sigEntry = e => { const { updatedAt, ...rest } = e; return canon(rest); };

function buildSnap() {
  snap = { entries: new Map(), vehicle: canon(state.vehicle), settings: canon(state.settings) };
  state.serviceHistory.concat(state.fuelLog).forEach(e => snap.entries.set(e.id, sigEntry(e)));
}

function stampChanges() {
  if (!snap) buildSnap();
  const now = Date.now();
  state.deleted = state.deleted || {};
  state.meta = state.meta || {};
  const seen = new Set();
  state.serviceHistory.concat(state.fuelLog).forEach(e => {
    seen.add(e.id);
    const sig = sigEntry(e);
    if (snap.entries.get(e.id) !== sig) { e.updatedAt = now; snap.entries.set(e.id, sig); delete state.deleted[e.id]; }
  });
  [...snap.entries.keys()].forEach(id => {
    if (!seen.has(id)) { snap.entries.delete(id); state.deleted[id] = now; }
  });
  const v = canon(state.vehicle);
  if (v !== snap.vehicle) { snap.vehicle = v; state.meta.vehicleAt = now; }
  const st = canon(state.settings);
  if (st !== snap.settings) { snap.settings = st; state.meta.settingsAt = now; }
  const cutoff = now - 180 * 86400000; // Löschmarken nach ~6 Monaten verwerfen
  Object.keys(state.deleted).forEach(id => { if (state.deleted[id] < cutoff) delete state.deleted[id]; });
}

// Schreibt den Stand ohne Änderungsverfolgung (z.B. nach dem Übernehmen von Sync-Daten)
function persistRaw() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (e) { console.warn('saveState:', e); showToast('Speichern fehlgeschlagen (Speicher voll?)', 'err'); return false; }
}

function saveState() {
  stampChanges();
  if (persistRaw()) window.scheduleSync?.();
}

// ─── Theme (Hell / Dunkel / System) ───────────────────────────────────────────
const darkMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
let themePref = 'auto';

function applyThemeMode(pref) {
  themePref = pref === 'light' || pref === 'dark' ? pref : 'auto';
  const t = themePref === 'auto' ? (darkMQ?.matches ? 'dark' : 'light') : themePref;
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.theme-btn').forEach(b => {
    const on = b.dataset.theme === themePref;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  updateMetaThemeColor();
}

function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  applyThemeMode(t);
}
darkMQ?.addEventListener?.('change', () => { if (themePref === 'auto') applyThemeMode('auto'); });

// Farb-Hilfen (WCAG-Kontrast)
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rgbToHex(c) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function relLum(h) {
  const [r, g, b] = hexToRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrastRatio(a, b) { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
// mischt die Farbe Schritt für Schritt zu Schwarz (dir -1) oder Weiß (dir 1), bis sie als Text auf bg lesbar ist
function contrastAdjust(hex, bg, dir) {
  const target = dir < 0 ? [0, 0, 0] : [255, 255, 255], base = hexToRgb(hex);
  for (let t = 0; t <= 1.001; t += .05) {
    const h = rgbToHex(base.map((v, i) => v + (target[i] - v) * t));
    if (contrastRatio(h, bg) >= 4.5) return h;
  }
  return rgbToHex(target);
}

// Fahrzeugfarbe → Akzentfarbe der App
function applyTheme(colorKey) {
  const c = BMW_COLORS[colorKey] || BMW_COLORS.titansilber;
  const r = document.documentElement.style;
  // Lackfarbe exakt als Akzent (Flächen); Text-/Kontrastfarben werden daraus abgeleitet
  const bgL = '#EEF0F3', bgD = '#0B0C0F';
  const textL = contrastAdjust(c.hex, bgL, -1), textD = contrastAdjust(c.hex, bgD, 1);
  r.setProperty('--car-fill', c.hex);
  r.setProperty('--car-on', contrastRatio(c.hex, '#FFFFFF') >= contrastRatio(c.hex, '#111318') ? '#FFFFFF' : '#111318');
  r.setProperty('--car-text-l', textL);
  r.setProperty('--car-text-d', textD);
  r.setProperty('--car-edge-l', contrastRatio(c.hex, bgL) < 2.5 ? textL : 'transparent');
  r.setProperty('--car-edge-d', contrastRatio(c.hex, bgD) < 2.5 ? textD : 'transparent');
  document.documentElement.setAttribute('data-vehicle-color', colorKey);
  applyDesign();
}

// Wagenfarbe im Design: alle Bausteine immer aktiv (Klassen d-… steuern das CSS)
const DESIGN_CLASSES = ['tint', 'hero', 'bars', 'chart', 'head'];
function applyDesign() {
  DESIGN_CLASSES.forEach(k => document.documentElement.classList.add('d-' + k));
  updateMetaThemeColor();
}

function updateMetaThemeColor() {
  const meta = document.getElementById('metaThemeColor');
  if (!meta) return;
  meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#EEF0F3';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.className = 'show' + (type ? ' ' + type : '');
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ─── Menü (Vollbild) ──────────────────────────────────────────────────────────
function toggleMenu(open) {
  const app = document.getElementById('app');
  setMenuOpen(typeof open === 'boolean' ? open : !app.classList.contains('menu-open'));
}

function setMenuOpen(open) {
  const app = document.getElementById('app');
  const drawer = document.getElementById('drawer');
  const btn = document.getElementById('menuBtn');
  const wasOpen = app.classList.contains('menu-open');
  app.classList.toggle('menu-open', open);
  drawer.inert = !open;
  if (open) { drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); }
  else { drawer.removeAttribute('role'); drawer.removeAttribute('aria-modal'); }
  btn?.setAttribute('aria-expanded', open);
  btn?.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  if (open && !wasOpen) (drawer.querySelector('.menu-item.active') || drawer.querySelector('.menu-item'))?.focus({ preventScroll: true });
  else if (!open && wasOpen && drawer.contains(document.activeElement)) btn?.focus({ preventScroll: true });
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (document.getElementById('app').classList.contains('menu-open')) { e.preventDefault(); setMenuOpen(false); }
});

// ─── Tab Navigation ───────────────────────────────────────────────────────────
const TAB_TITLES = {
  'dashboard': 'Dashboard',
  'history':   'Service-Historie',
  'fuel':      'Tankprotokoll',
  'stats':     'Statistik',
  'settings':  'Fahrzeug & Design',
};

function switchTab(tab) {
  activeTab = tab;
  setMenuOpen(false);
  document.getElementById('menuBtn').hidden = false;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + tab);
  if (view) view.classList.add('active');

  const btn = document.getElementById('nav-' + tab);
  if (btn) btn.classList.add('active');

  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = TAB_TITLES[tab] || '';

  if (tab === 'dashboard') { renderDashboard(); renderBackupHint(); }
  if (tab === 'history')   renderHistory();
  if (tab === 'settings')  renderSettings();
  if (tab === 'fuel')      renderFuel();
  if (tab === 'stats')     renderStatsPage();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const byRecent = (a, b) => b.date.localeCompare(a.date) || b.km - a.km || String(b.id).localeCompare(String(a.id));

// Verfolgte Wartungen: Kategorien mit Intervall; Fälligkeit = letzter Eintrag + Intervall
function trackedServices() {
  const ivs = state.settings.intervals || {};
  return Object.keys(CATEGORIES).filter(cat => ivs[cat] && (ivs[cat].km || ivs[cat].months)).map(cat => {
    const interval = ivs[cat];
    const last = lastEntryForCat(cat);
    const svc = { category: cat, interval, last, dueKm: null, dueDate: '' };
    if (last) {
      if (interval.km)     svc.dueKm = last.km + interval.km;
      if (interval.months) svc.dueDate = addMonths(last.date, interval.months);
    }
    return svc;
  });
}

// 'none' (noch kein Eintrag) | 'ok' | 'warn' | 'alert'; Schwellen relativ zum Intervall
function getServiceStatus(svc) {
  if (!svc.last) return 'none';
  let worst = 0;
  if (svc.dueKm != null) {
    const diff = svc.dueKm - state.vehicle.currentKm;
    const iv = svc.interval.km;
    if (diff <= Math.max(300, iv * 0.05))       worst = 2;
    else if (diff <= Math.max(1000, iv * 0.15)) worst = Math.max(worst, 1);
  }
  if (svc.dueDate) {
    const days = daysUntil(svc.dueDate);
    const ivDays = svc.interval.months * 30;
    if (days <= Math.max(14, ivDays * 0.05))      worst = 2;
    else if (days <= Math.max(30, ivDays * 0.15)) worst = Math.max(worst, 1);
  }
  return ['ok', 'warn', 'alert'][worst];
}

// Anteil des Intervalls, der seit dem letzten Eintrag verbraucht ist (0–100)
function intervalUsed(svc) {
  if (!svc.last) return 0;
  let used = 0;
  if (svc.interval.km) used = Math.max(used, (state.vehicle.currentKm - svc.last.km) / svc.interval.km);
  if (svc.interval.months) used = Math.max(used, -daysUntil(svc.last.date) / (svc.interval.months * 30.44));
  return Math.round(Math.min(1, Math.max(0, used)) * 100);
}

function isOverdue(svc) {
  if (!svc.last) return false;
  return (svc.dueKm != null && svc.dueKm - state.vehicle.currentKm <= 0) ||
         (!!svc.dueDate && daysUntil(svc.dueDate) < 0);
}

function dueText(svc) {
  if (!svc.last) return 'nach dem ersten Eintrag';
  const parts = [];
  if (svc.dueDate) parts.push(formatDate(svc.dueDate));
  if (svc.dueKm != null) {
    parts.push(svc.dueKm.toLocaleString('de-DE') + ' km');
    const diff = svc.dueKm - state.vehicle.currentKm;
    if (diff > 0) parts.push('(noch ' + diff.toLocaleString('de-DE') + ' km)');
  }
  if (isOverdue(svc)) parts.push('(überfällig!)');
  return parts.join(' · ') || '–';
}

function lastEntryForCat(cat) {
  return [...state.serviceHistory].filter(e => e.category === cat).sort(byRecent)[0] || null;
}

function catIcon(cat) {
  const c = CATEGORIES[cat] || CATEGORIES['Anderes'];
  return `<span class="cat-badge" style="--cat-l:${c.light};--cat-d:${c.dark}"><i class="ph-light ${c.icon}" data-fb="${c.fb}" aria-hidden="true"></i></span>`;
}

// Balkendiagramm der letzten Verbräuche (Dashboard) mit Wertbeschriftung, Datum und Durchschnittslinie
function fuelChart(points, avg, max = 8) {
  const pts = points.slice(-max);
  const vals = pts.map(p => p.v), hi = Math.max(...vals, avg), lo = Math.min(...vals, avg) * .85;
  const pct = v => Math.round(12 + 78 * (v - lo) / (hi - lo || 1));
  const mon = d => d.slice(5, 7) + '/' + d.slice(2, 4);
  return `<span class="fc" aria-hidden="true">
    <span class="fc-plot">
      <span class="fc-avg" style="bottom:${pct(avg)}%"><em>Ø ${fmtNum(avg)}</em></span>
      ${pts.map((p, i) => `<span class="fc-col${i === pts.length - 1 ? ' last' : ''}"><b style="bottom:calc(${pct(p.v)}% + 3px)">${fmtNum(p.v)}</b><i style="height:${pct(p.v)}%"></i></span>`).join('')}
    </span>
    <span class="fc-dates">${pts.map(p => `<u>${mon(p.date)}</u>`).join('')}</span>
  </span>`;
}

function renderDashboard() {
  const v = state.vehicle;

  const eyebrow = document.getElementById('dashboardEyebrow');
  if (eyebrow) eyebrow.textContent = [v.modelYear ? 'Modelljahr ' + v.modelYear : '', v.body].filter(Boolean).join(' · ');
  const headline = document.getElementById('dashboardHeadline');
  if (headline) headline.textContent = vehicleTitle(v) || 'Mein Fahrzeug';

  const kmEl = document.getElementById('dashboardKm');
  if (kmEl) kmEl.textContent = v.currentKm.toLocaleString('de-DE');

  const chassisEl = document.getElementById('heroChassisInfo');
  if (chassisEl) {
    const parts = [];
    if (v.vin)                 parts.push('VIN ' + v.vin);
    else if (v.chassis)        parts.push('Chassis ' + v.chassis);
    if (v.firstRegistration)   parts.push('EZ ' + formatDate(v.firstRegistration));
    chassisEl.textContent = parts.join(' · ');
  }

  const fuelCard = document.getElementById('fuelCard');
  if (fuelCard) {
    const fs = fuelStats();
    fuelCard.hidden = !state.fuelLog.length;
    if (state.fuelLog.length) {
      const sub = fs.avg == null ? 'Noch zu wenig Daten – ab dem 2. vollen Tankstopp'
        : [fs.last != null ? 'Zuletzt ' + fmtNum(fs.last) + ' l/100 km' : '', fs.pricePerL != null ? 'Ø ' + fmtNum(fs.pricePerL, 2) + ' €/l' : ''].filter(Boolean).join(' · ');
      fuelCard.innerHTML = `<span class="fuel-card-top"><span class="cat-badge" style="--cat-l:#0E7490;--cat-d:#22D3EE"><i class="ph-light ph-gas-pump" data-fb="⛽" aria-hidden="true"></i></span>
        <span class="fuel-card-main"><span class="fuel-card-num">${fs.avg != null ? fmtNum(fs.avg) : '–'}<small>Ø l/100 km</small></span><br><span class="fuel-card-sub">${esc(sub)}</span></span></span>${fs.points.length > 1 ? fuelChart(fs.points, fs.avg) : ''}`;
    }
  }

  const grid = document.getElementById('upcomingGrid');
  if (grid) {
    const tracked = trackedServices();
    const title = document.getElementById('upcomingTitle');
    if (title) title.hidden = !tracked.length;
    grid.classList.toggle('is-empty', !tracked.length);
    grid.innerHTML = tracked.length ? tracked.map(svc => {
      const status = getServiceStatus(svc);
      const statusLabel = { none: 'Offen', ok: 'OK', warn: 'Bald fällig', alert: isOverdue(svc) ? 'Überfällig' : 'Dringend' }[status];
      return `
        <div class="card stat-card status-${status}">
          <div class="stat-top">
            <span class="stat-ico">${catIcon(svc.category)}</span>
            <span class="status-badge badge-${status}">${statusLabel}</span>
          </div>
          <div class="stat-body">
            <div class="stat-num">${esc(svc.category).replace('flüssigkeit', '&shy;flüssigkeit')}</div>
            <div class="stat-lbl">Fällig: ${esc(dueText(svc))}</div>
            <div class="stat-lbl">${lastText(svc.category)}</div>
            ${svc.last ? `<div class="meter" role="img" aria-label="${intervalUsed(svc)} % des Intervalls verbraucht"><i style="width:${intervalUsed(svc)}%"></i></div>` : ''}
          </div>
        </div>`;
    }).join('') : `
        <button type="button" class="empty-state empty-state--action" onclick="switchTab('settings')">
          <i class="ph-light ph-timer" data-fb="⏱️" aria-hidden="true"></i>
          <p>Noch keine Wartungsintervalle festgelegt.<br><strong>Intervalle einstellen</strong></p>
        </button>`;
  }

  // Letzter Eintrag insgesamt (kompakt, öffnet die Historie)
  const lastEl = document.getElementById('lastEntry');
  if (lastEl) {
    const last = [...state.serviceHistory].sort(byRecent)[0];
    lastEl.innerHTML = last ? `
        <button type="button" class="list-row" onclick="switchTab('history')">
          <div class="list-icon">${catIcon(last.category)}</div>
          <div class="list-body">
            <div class="list-title">${esc(last.category)}</div>
            <div class="list-sub">${esc(last.description)}</div>
          </div>
          <div class="list-meta">
            <div>${formatDate(last.date)}</div>
            <div>${last.km.toLocaleString('de-DE')} km</div>
          </div>
        </button>` : `
        <div class="list-row">
          <div class="list-icon"><i class="ph-light ph-clock-counter-clockwise" data-fb="🕘" aria-hidden="true"></i></div>
          <div class="list-body">
            <div class="list-title">Noch keine Einträge</div>
            <div class="list-sub">Mit + den ersten Service eintragen</div>
          </div>
        </div>`;
  }
}

function lastText(cat) {
  const last = lastEntryForCat(cat);
  return last ? 'Zuletzt: ' + formatDate(last.date) + ' · ' + last.km.toLocaleString('de-DE') + ' km' : 'Noch kein Eintrag';
}

// KM-Stand bearbeiten
function openKmEdit() {
  const input = document.getElementById('edit-km-val');
  if (input) input.value = state.vehicle.currentKm;
  document.getElementById('modal-km-edit').showModal();
}

async function saveKmEdit() {
  const val = parseInt(document.getElementById('edit-km-val').value, 10);
  if (isNaN(val) || val < 0) { showToast('Ungültiger KM-Stand', 'err'); return; }
  const maxEntry = state.serviceHistory.reduce((m, e) => Math.max(m, e.km), 0);
  let warn = '';
  if (val < maxEntry) warn = `Der Stand liegt unter dem höchsten Eintrag in der Historie (${maxEntry.toLocaleString('de-DE')} km).`;
  else if (state.vehicle.currentKm && val > state.vehicle.currentKm + KM_JUMP) warn = `Der Stand liegt ${(val - state.vehicle.currentKm).toLocaleString('de-DE')} km über dem bisherigen.`;
  if (warn && !(await confirmDialog({ title: 'Stimmt das?', text: warn, ok: 'Trotzdem übernehmen' }))) return;
  state.vehicle.currentKm = val;
  saveState();
  document.getElementById('modal-km-edit').close();
  showToast('KM-Stand aktualisiert', 'ok');
  renderHeader();
  renderDashboard();
}

// ─── History ──────────────────────────────────────────────────────────────────
function renderHistory() {
  const chipBar = document.getElementById('categoryFilterChips');
  if (chipBar) {
    const cats = ['Alle', ...Object.keys(CATEGORIES)];
    chipBar.innerHTML = cats.map(c => `
      <button type="button" class="chip${historyFilterCat === c ? ' active' : ''}"
              data-cat="${esc(c)}">${esc(c)}</button>`
    ).join('');
  }

  let items = [...state.serviceHistory].sort(byRecent);
  if (historyFilterCat !== 'Alle') items = items.filter(e => e.category === historyFilterCat);
  if (historySearchVal.trim()) {
    const q = historySearchVal.toLowerCase();
    items = items.filter(e =>
      [e.category, e.description, e.shop || '', formatDate(e.date), String(e.km), e.km.toLocaleString('de-DE')]
        .join(' ').toLowerCase().includes(q)
    );
  }

  const listEl = document.getElementById('historyList');
  if (!listEl) return;

  if (!items.length) {
    listEl.classList.add('is-empty');
    const none = !state.serviceHistory.length;
    listEl.innerHTML = `<div class="empty-state"><i class="ph-light ${none ? 'ph-clock-counter-clockwise' : 'ph-magnifying-glass'}" data-fb="${none ? '🕘' : '🔍'}"></i><p>${none ? 'Noch keine Einträge – tippe auf +' : 'Keine Einträge gefunden'}</p></div>`;
    return;
  }
  listEl.classList.remove('is-empty');

  listEl.innerHTML = items.map(e => `
      <button type="button" class="list-row" data-id="${esc(e.id)}">
        <div class="list-icon">${catIcon(e.category)}</div>
        <div class="list-body">
          <div class="list-title">${esc(e.category)}</div>
          <div class="list-sub">${esc(e.description)}</div>
        </div>
        <div class="list-meta">
          <div>${formatDate(e.date)}</div>
          <div>${e.km.toLocaleString('de-DE')} km</div>
        </div>
      </button>`
  ).join('');
}

// Event-Delegation statt inline-onclick (keine Werte in JS-Strings)
function bindHistoryEvents() {
  document.getElementById('historyList').addEventListener('click', ev => {
    const row = ev.target.closest('[data-id]');
    if (row) openHistoryDetail(row.dataset.id);
  });
  document.getElementById('categoryFilterChips').addEventListener('click', ev => {
    const chip = ev.target.closest('[data-cat]');
    if (chip) setHistoryCat(chip.dataset.cat);
  });
}

function setHistoryCat(cat) {
  historyFilterCat = cat;
  renderHistory();
}

function filterHistory() {
  historySearchVal = document.getElementById('historySearch').value;
  renderHistory();
}

let detailId = null;
let editingId = null;

function openHistoryDetail(id) {
  const e = state.serviceHistory.find(x => x.id === id);
  if (!e) return;
  detailId = id;
  document.getElementById('detailIcon').innerHTML = catIcon(e.category);
  document.getElementById('detailCat').textContent = e.category;
  document.getElementById('detailDesc').textContent = e.description;
  document.getElementById('detailMeta').innerHTML =
    `<span class="meta-chip">${formatDate(e.date)}</span><span class="meta-chip">${e.km.toLocaleString('de-DE')} km</span>` +
    (e.cost != null ? `<span class="meta-chip">${fmtEur(e.cost)}</span>` : '') +
    (e.shop ? `<span class="meta-chip"><span>${esc(e.shop)}</span></span>` : '');
  resetDeleteConfirm();
  document.getElementById('modal-entry-detail').showModal();
}

function closeEntryDetail() {
  document.getElementById('modal-entry-detail').close();
}

function resetDeleteConfirm() {
  const btn = document.getElementById('detailDeleteBtn');
  btn.classList.remove('confirm');
  btn.textContent = 'Löschen';
}

// Zweistufig: erster Tipp fragt nach, zweiter löscht.
function deleteEntryFromDetail() {
  const btn = document.getElementById('detailDeleteBtn');
  if (!btn.classList.contains('confirm')) {
    btn.classList.add('confirm');
    btn.textContent = 'Wirklich löschen?';
    return;
  }
  state.serviceHistory = state.serviceHistory.filter(x => x.id !== detailId);
  saveState();
  closeEntryDetail();
  showToast('Eintrag gelöscht', 'warn');
  switchTab(activeTab);
}

function editEntryFromDetail() {
  const e = state.serviceHistory.find(x => x.id === detailId);
  if (!e) return;
  closeEntryDetail();
  openAddEntry(e);
}

// ─── Eintrag anlegen / bearbeiten (Popup) ─────────────────────────────────────
function openAddEntry(entry) {
  setMenuOpen(false);
  const edit = entry && entry.id ? entry : null;
  editingId = edit ? edit.id : null;
  document.getElementById('addEntryForm').reset();
  document.getElementById('addEntryTitle').textContent = edit ? 'Eintrag bearbeiten' : 'Neuer Service';
  document.getElementById('form-category').value    = edit ? edit.category : 'Öl';
  document.getElementById('form-date').max          = todayIso();
  document.getElementById('form-date').value        = edit ? edit.date : todayIso();
  document.getElementById('form-km').value          = edit ? edit.km : (state.vehicle.currentKm || '');
  document.getElementById('form-description').value = edit ? edit.description : '';
  document.getElementById('form-cost').value        = edit && edit.cost != null ? edit.cost : '';
  document.getElementById('form-shop').value        = edit ? (edit.shop || '') : '';
  document.getElementById('modal-add-entry').showModal();
}

function closeAddEntry() {
  document.getElementById('modal-add-entry').close();
}

// Hinweistext, wenn ein Kilometerstand auffällig ist (sonst '')
const KM_JUMP = 25000;
function kmWarning(km, date, ignoreId) {
  const cur = state.vehicle.currentKm;
  if (cur && km > cur + KM_JUMP) {
    return `Der Kilometerstand liegt ${(km - cur).toLocaleString('de-DE')} km über dem aktuellen Stand (${cur.toLocaleString('de-DE')} km).`;
  }
  const clash = state.serviceHistory.find(e => e.id !== ignoreId &&
    ((e.date < date && e.km > km) || (e.date > date && e.km < km)));
  if (clash) {
    return `Passt nicht zur Historie: Am ${formatDate(clash.date)} stand der Kilometerzähler bei ${clash.km.toLocaleString('de-DE')} km.`;
  }
  return '';
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const category    = document.getElementById('form-category').value;
  const date        = document.getElementById('form-date').value;
  const km          = parseInt(document.getElementById('form-km').value, 10);
  const description = document.getElementById('form-description').value.trim();
  const costRaw     = document.getElementById('form-cost').value;
  const cost        = costRaw === '' ? null : Math.round(parseFloat(costRaw) * 100) / 100;
  const shop        = document.getElementById('form-shop').value.trim();

  if (!date)               { showToast('Datum fehlt', 'err'); return; }
  if (cost !== null && (isNaN(cost) || cost < 0)) { showToast('Ungültiger Betrag', 'err'); return; }
  if (isNaN(km) || km < 0) { showToast('Ungültiger KM-Stand', 'err'); return; }
  if (!description)        { showToast('Beschreibung fehlt', 'err'); return; }

  const warn = kmWarning(km, date, editingId);
  if (warn && !(await confirmDialog({ title: 'Stimmt das?', text: warn, ok: 'Trotzdem speichern' }))) return;

  const existing = editingId && state.serviceHistory.find(x => x.id === editingId);
  const fields = { date, km, category, description };
  if (cost !== null) fields.cost = cost;
  if (shop) fields.shop = shop;
  if (existing) {
    delete existing.cost; delete existing.shop;
    Object.assign(existing, fields);
  } else state.serviceHistory.push(Object.assign({ id: uid() }, fields));
  if (km > state.vehicle.currentKm) state.vehicle.currentKm = km;
  saveState();
  closeAddEntry();
  showToast(existing ? 'Änderungen gespeichert ✓' : 'Eintrag gespeichert ✓', 'ok');
  editingId = null;
  renderHeader();
  switchTab(activeTab === 'history' ? 'history' : 'dashboard');
}

// ─── Tankprotokoll ────────────────────────────────────────────────────────────
const fmtNum = (n, d = 1) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// Verbrauch nach der Voll-zu-Voll-Methode: Liter seit der letzten vollen Betankung (ohne diese)
// geteilt durch die gefahrenen Kilometer. Teilbetankungen werden aufsummiert.
function fuelStats() {
  const log = [...state.fuelLog].sort((a, b) => a.km - b.km || a.date.localeCompare(b.date));
  const seg = new Map();
  let anchor = null, liters = 0;
  log.forEach(e => {
    if (anchor) {
      liters += e.liters;
      if (e.full) {
        const km = e.km - anchor.km;
        if (km > 0) seg.set(e.id, { km, liters, l100: liters / km * 100 });
        anchor = e; liters = 0;
      }
    } else if (e.full) { anchor = e; liters = 0; }
  });
  const segs = [...seg.values()];
  const sumKm = segs.reduce((t, x) => t + x.km, 0);
  const sumL = segs.reduce((t, x) => t + x.liters, 0);
  const priced = state.fuelLog.filter(e => e.cost != null);
  const pl = priced.reduce((t, e) => t + e.liters, 0);
  return {
    seg,
    avg: sumKm ? sumL / sumKm * 100 : null,
    last: log.filter(e => seg.has(e.id)).map(e => seg.get(e.id).l100).pop() ?? null,
    series: log.filter(e => seg.has(e.id)).map(e => seg.get(e.id).l100),
    points: log.filter(e => seg.has(e.id)).map(e => ({ date: e.date, v: seg.get(e.id).l100 })),
    totalLiters: state.fuelLog.reduce((t, e) => t + e.liters, 0),
    totalCost: priced.reduce((t, e) => t + e.cost, 0),
    pricePerL: pl ? priced.reduce((t, e) => t + e.cost, 0) / pl : null,
  };
}

function renderFuel() {
  const st = fuelStats();
  const sum = document.getElementById('fuelSummary');
  const stat = (lbl, val) => `<div class="fuel-stat"><span>${lbl}</span><strong>${val}</strong></div>`;
  const bars = st.series.slice(-14);
  const max = Math.max(...bars, 1), min = Math.min(...bars);
  sum.innerHTML = `
    <div class="fuel-hero">
      <div class="hero-eyebrow">Ø Verbrauch</div>
      <div class="hero-num-row"><span class="hero-num">${st.avg != null ? fmtNum(st.avg) : '–'}</span><span class="hero-unit">l/100 km</span></div>
    </div>
    ${bars.length > 1 ? `<div class="fuel-bars" role="img" aria-label="Verbrauch der letzten Tankstopps">${bars.map(v =>
      `<span style="height:${Math.round(25 + 75 * (v - min * .9) / (max - min * .9 || 1))}%" title="${fmtNum(v)} l/100 km"></span>`).join('')}</div>` : ''}
    <div class="fuel-stats">
      ${stat('Letzter', st.last != null ? fmtNum(st.last) + ' l/100 km' : '–')}
      ${stat('Ø Preis', st.pricePerL != null ? fmtNum(st.pricePerL, 3) + ' €/l' : '–')}
      ${stat('Getankt', fmtNum(st.totalLiters, 0) + ' l')}
      ${stat('Kosten', st.totalCost ? fmtEur(st.totalCost) : '–')}
    </div>
    ${state.fuelLog.length && st.avg == null ? '<p class="fuel-note">Der Verbrauch wird ab dem zweiten vollen Tankstopp berechnet.</p>' : ''}`;

  const list = document.getElementById('fuelList');
  const items = [...state.fuelLog].sort((a, b) => b.km - a.km || b.date.localeCompare(a.date));
  if (!items.length) {
    list.classList.add('is-empty');
    list.innerHTML = '<div class="empty-state"><i class="ph-light ph-gas-pump" data-fb="⛽"></i><p>Noch keine Tankstopps – tippe auf +<br>und tanke beim nächsten Mal voll.</p></div>';
    return;
  }
  list.classList.remove('is-empty');
  list.innerHTML = items.map(e => {
    const s = st.seg.get(e.id);
    return `
      <button type="button" class="list-row" data-id="${esc(e.id)}">
        <div class="list-icon"><span class="cat-badge" style="--cat-l:#C2410C;--cat-d:#FB923C"><i class="ph-light ph-gas-pump" data-fb="⛽" aria-hidden="true"></i></span></div>
        <div class="list-body">
          <div class="list-title">${fmtNum(e.liters, 2)} l${e.full ? '' : ' <small class="muted-tag">teilgetankt</small>'}</div>
          <div class="list-sub">${formatDate(e.date)} · ${e.km.toLocaleString('de-DE')} km</div>
        </div>
        <div class="list-meta">
          <div>${s ? fmtNum(s.l100) + ' l/100' : '–'}</div>
          <div>${e.cost != null ? fmtEur(e.cost) : ''}</div>
        </div>
      </button>`;
  }).join('');
}

let editingFuelId = null;

function openFuelDialog(entry) {
  setMenuOpen(false);
  const edit = entry && entry.id ? entry : null;
  editingFuelId = edit ? edit.id : null;
  document.getElementById('fuelForm').reset();
  document.getElementById('fuelDialogTitle').textContent = edit ? 'Tankstopp bearbeiten' : 'Tankstopp';
  document.getElementById('fuel-date').max   = todayIso();
  document.getElementById('fuel-date').value = edit ? edit.date : todayIso();
  document.getElementById('fuel-km').value   = edit ? edit.km : (state.vehicle.currentKm || '');
  document.getElementById('fuel-liters').value = edit ? edit.liters : '';
  document.getElementById('fuel-cost').value   = edit && edit.cost != null ? edit.cost : '';
  document.getElementById('fuel-full').checked = edit ? edit.full : true;
  document.getElementById('fuelDeleteBtn').hidden = !edit;
  document.getElementById('modal-fuel').showModal();
}

async function handleFuelSubmit(event) {
  event.preventDefault();
  const date = document.getElementById('fuel-date').value;
  const km = parseInt(document.getElementById('fuel-km').value, 10);
  const liters = Math.round(parseFloat(document.getElementById('fuel-liters').value) * 100) / 100;
  const costRaw = document.getElementById('fuel-cost').value;
  const cost = costRaw === '' ? null : Math.round(parseFloat(costRaw) * 100) / 100;
  const full = document.getElementById('fuel-full').checked;
  if (!date) { showToast('Datum fehlt', 'err'); return; }
  if (isNaN(km) || km < 0) { showToast('Ungültiger KM-Stand', 'err'); return; }
  if (isNaN(liters) || liters <= 0 || liters > 300) { showToast('Ungültige Literzahl', 'err'); return; }
  if (cost !== null && (isNaN(cost) || cost < 0)) { showToast('Ungültiger Betrag', 'err'); return; }

  const cur = state.vehicle.currentKm;
  if (cur && km > cur + KM_JUMP) {
    const ok = await confirmDialog({ title: 'Stimmt das?', text: `Der Kilometerstand liegt ${(km - cur).toLocaleString('de-DE')} km über dem aktuellen Stand (${cur.toLocaleString('de-DE')} km).`, ok: 'Trotzdem speichern' });
    if (!ok) return;
  }
  const fields = { date, km, liters, full };
  if (cost !== null) fields.cost = cost;
  const existing = editingFuelId && state.fuelLog.find(x => x.id === editingFuelId);
  if (existing) { delete existing.cost; Object.assign(existing, fields); }
  else state.fuelLog.push(Object.assign({ id: uid() }, fields));
  if (km > state.vehicle.currentKm) state.vehicle.currentKm = km;
  saveState();
  document.getElementById('modal-fuel').close();
  showToast(existing ? 'Änderungen gespeichert ✓' : 'Tankstopp gespeichert ✓', 'ok');
  editingFuelId = null;
  renderHeader();
  renderFuel();
}

async function deleteFuel() {
  const ok = await confirmDialog({ title: 'Tankstopp löschen?', text: 'Der Eintrag wird entfernt und der Verbrauch neu berechnet.', ok: 'Löschen', danger: true });
  if (!ok) return;
  state.fuelLog = state.fuelLog.filter(x => x.id !== editingFuelId);
  saveState();
  document.getElementById('modal-fuel').close();
  showToast('Tankstopp gelöscht', 'warn');
  editingFuelId = null;
  renderFuel();
}

function bindFuelEvents() {
  document.getElementById('fuelList').addEventListener('click', ev => {
    const row = ev.target.closest('[data-id]');
    const e = row && state.fuelLog.find(x => x.id === row.dataset.id);
    if (e) openFuelDialog(e);
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  renderVehicleInfo('settingsVehicleInfo', state.vehicle);
  renderStats();
  renderIntervalEditor();
  buildColorGrid('settingsColorGrid', state.settings.vehicleColor, (key) => {
    state.settings.vehicleColor = key;
    saveState();
    applyTheme(key);
    renderSettings();
    showToast('Farbe geändert: ' + BMW_COLORS[key].label, 'ok');
  });
}

const fmtEur = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

function renderStats() {
  const el = document.getElementById('statsCard');
  if (!el) return;
  const h = state.serviceHistory;
  const withCost = h.filter(e => e.cost != null);
  const total = withCost.reduce((t, e) => t + e.cost, 0);
  const rows = [['Einträge', String(h.length)]];
  if (withCost.length) {
    const year = String(new Date().getFullYear());
    const thisYear = withCost.filter(e => e.date.startsWith(year)).reduce((t, e) => t + e.cost, 0);
    rows.push(['Gesamtkosten', fmtEur(total) + ' (' + withCost.length + (withCost.length === 1 ? ' Eintrag' : ' Einträge') + ')']);
    rows.push(['Kosten ' + year, fmtEur(thisYear)]);
  } else {
    rows.push(['Kosten', 'noch keine erfasst']);
  }
  el.innerHTML = rows.map(([k, v]) => `<div class="info-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
}

// ─── Statistik ────────────────────────────────────────────────────────────────
function hbars(rows, unit) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return rows.map(r => `
    <div class="hb">
      <div class="hb-head"><span class="hb-label">${r.icon || ''}${esc(r.label)}</span><strong>${esc(r.text)}</strong></div>
      <div class="hb-track"><i style="width:${Math.max(2, Math.round(r.value / max * 100))}%${r.color ? ';background:' + r.color : ''}"></i></div>
      ${r.sub ? `<div class="hb-sub">${esc(r.sub)}</div>` : ''}
    </div>`).join('');
}

function renderStatsPage() {
  const el = document.getElementById('statsPage');
  if (!el) return;
  const svc = state.serviceHistory, fuel = state.fuelLog;
  if (!svc.length && !fuel.length) {
    el.innerHTML = `<div class="empty-state"><i class="ph-light ph-chart-bar" data-fb="📊" aria-hidden="true"></i><p>Noch keine Daten für eine Statistik.<br>Trage Services oder Tankstopps ein.</p></div>`;
    return;
  }
  const yearNow = String(new Date().getFullYear());
  const svcCost = svc.reduce((t, e) => t + (e.cost || 0), 0);
  const fuelCost = fuel.reduce((t, e) => t + (e.cost || 0), 0);
  const total = svcCost + fuelCost;
  const kms = [...svc, ...fuel].map(e => e.km).concat(state.vehicle.currentKm || []).filter(k => k > 0);
  const driven = kms.length ? Math.max(...kms) - Math.min(...kms) : 0;
  const thisYear = [...svc, ...fuel].filter(e => e.date.startsWith(yearNow)).reduce((t, e) => t + (e.cost || 0), 0);
  const tile = (lbl, val, sub) => `<div class="card stat-tile"><span>${lbl}</span><strong>${val}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;

  // Kosten pro Jahr (Service + Tanken gestapelt)
  const years = {};
  svc.forEach(e => { if (e.cost) (years[e.date.slice(0, 4)] ||= { s: 0, f: 0 }).s += e.cost; });
  fuel.forEach(e => { if (e.cost) (years[e.date.slice(0, 4)] ||= { s: 0, f: 0 }).f += e.cost; });
  const yKeys = Object.keys(years).sort();
  const yMax = Math.max(...yKeys.map(y => years[y].s + years[y].f), 1);
  const yearHtml = yKeys.length ? `
    <div class="card stat-block">
      ${yKeys.map(y => { const v = years[y], t = v.s + v.f; return `
        <div class="hb"><div class="hb-head"><span class="hb-label">${y}</span><strong>${fmtEur(t)}</strong></div>
        <div class="hb-track stack" style="width:${Math.max(4, Math.round(t / yMax * 100))}%"><i class="s" style="flex:${v.s}"></i><i class="f" style="flex:${v.f}"></i></div></div>`; }).join('')}
      <div class="hb-legend"><span><i class="s"></i>Service ${fmtEur(svcCost)}</span><span><i class="f"></i>Tanken ${fmtEur(fuelCost)}</span></div>
    </div>` : `<p class="settings-hint">Noch keine Kosten erfasst.</p>`;

  // Service nach Kategorie
  const cats = {};
  svc.forEach(e => { const c = (cats[e.category] ||= { n: 0, cost: 0 }); c.n++; c.cost += e.cost || 0; });
  const catRows = Object.entries(cats).sort((x, y) => y[1].cost - x[1].cost || y[1].n - x[1].n).map(([k, c]) => ({
    icon: catIcon(k), label: (CATEGORIES[k] || CATEGORIES.Anderes).label, value: c.cost || c.n * 0.0001 + 0.0001,
    text: c.cost ? fmtEur(c.cost) : '–', sub: c.n + (c.n === 1 ? ' Eintrag' : ' Einträge'),
    color: 'var(--cat-bar-' + (CATEGORIES[k] ? Object.keys(CATEGORIES).indexOf(k) : 0) + ')',
  }));

  // Kilometer pro Jahr (letzter bekannter Stand je Jahresende)
  const pts = [...svc, ...fuel].map(e => ({ y: e.date.slice(0, 4), km: e.km }));
  if (state.vehicle.currentKm > 0) pts.push({ y: yearNow, km: state.vehicle.currentKm });
  const maxKmByYear = {};
  pts.forEach(p => { maxKmByYear[p.y] = Math.max(maxKmByYear[p.y] || 0, p.km); });
  const kmYears = Object.keys(maxKmByYear).sort();
  const kmRows = [];
  kmYears.forEach((y, i) => {
    const prev = i ? maxKmByYear[kmYears[i - 1]] : Math.min(...pts.filter(p => p.y === y).map(p => p.km));
    const d = maxKmByYear[y] - prev;
    if (d > 0) kmRows.push({ label: y, value: d, text: d.toLocaleString('de-DE') + ' km' });
  });

  // Verbrauch
  const fs = fuelStats();
  const fuelBlock = fs.points.length ? `
    <div class="card stat-block">
      ${fuelChart(fs.points, fs.avg, 14)}
    </div>
    <div class="card info-card">
      ${[['Ø Verbrauch', fmtNum(fs.avg) + ' l/100 km'],
         ['Bester Wert', fmtNum(Math.min(...fs.series)) + ' l/100 km'],
         ['Höchster Wert', fmtNum(Math.max(...fs.series)) + ' l/100 km'],
         ['Getankt gesamt', fmtNum(fs.totalLiters, 0) + ' l'],
         fs.pricePerL != null ? ['Ø Preis', fmtNum(fs.pricePerL, 2) + ' €/l'] : null,
         fuelCost && driven ? ['Spritkosten', fmtNum(fuelCost / driven * 100, 2) + ' € / 100 km'] : null,
      ].filter(Boolean).map(([k, v]) => `<div class="info-row"><span>${k}</span><strong>${esc(v)}</strong></div>`).join('')}
    </div>` : `<p class="settings-hint">Ein Verbrauch wird ab dem zweiten vollen Tankstopp berechnet.</p>`;

  el.innerHTML = `
    <div class="stat-tiles">
      ${tile('Kosten gesamt', total ? fmtEur(total) : '–', total ? 'Service + Tanken' : 'noch keine erfasst')}
      ${tile('Dieses Jahr', thisYear ? fmtEur(thisYear) : '–', yearNow)}
      ${tile('Gefahren', driven ? driven.toLocaleString('de-DE') + ' km' : '–', 'seit dem ersten Eintrag')}
      ${tile('Kosten / 100 km', total && driven ? fmtEur(total / driven * 100) : '–', 'Service + Tanken')}
    </div>
    <h3 class="section-title">Kosten pro Jahr</h3>
    ${yearHtml}
    ${catRows.length ? `<h3 class="section-title">Service nach Kategorie</h3><div class="card stat-block">${hbars(catRows)}</div>` : ''}
    ${kmRows.length ? `<h3 class="section-title">Kilometer pro Jahr</h3><div class="card stat-block">${hbars(kmRows)}</div><p class="settings-hint">Aus dem jeweils höchsten bekannten Kilometerstand je Jahr, daher ungefähr.</p>` : ''}
    <h3 class="section-title">Verbrauch</h3>
    ${fuelBlock}`;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function historyFileTag() {
  return (vehicleTitle(state.vehicle) || 'fahrzeug').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
}

// CSV für Excel (Semikolon, UTF-8-BOM, Zahlen im deutschen Format)
function exportCsv() {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Datum', 'Kilometer', 'Kategorie', 'Beschreibung', 'Kosten (EUR)', 'Werkstatt']];
  [...state.serviceHistory].sort(byRecent).forEach(e => rows.push([
    formatDate(e.date), e.km, e.category, e.description, e.cost != null ? String(e.cost).replace('.', ',') : '', e.shop || '',
  ]));
  download('service-tracker-' + historyFileTag() + '-' + todayIso() + '.csv',
    '\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  showToast('CSV exportiert', 'ok');
}

function exportFuelCsv() {
  if (!state.fuelLog.length) { showToast('Noch keine Tankstopps vorhanden', 'warn'); return; }
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const num = (v, d) => v == null ? '' : v.toFixed(d).replace('.', ',');
  const { seg } = fuelStats();
  const rows = [['Datum', 'Kilometer', 'Liter', 'Kosten (EUR)', 'Preis (EUR/l)', 'Vollgetankt', 'Verbrauch (l/100 km)']];
  [...state.fuelLog].sort((a, b) => b.km - a.km || b.date.localeCompare(a.date)).forEach(e => rows.push([
    formatDate(e.date), e.km, num(e.liters, 2), num(e.cost, 2),
    e.cost != null && e.liters ? num(e.cost / e.liters, 3) : '',
    e.full ? 'ja' : 'nein', seg.has(e.id) ? num(seg.get(e.id).l100, 1) : '',
  ]));
  download('tankprotokoll-' + historyFileTag() + '-' + todayIso() + '.csv',
    '\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  showToast('Tank-CSV exportiert', 'ok');
}

// Druckansicht (Scheckheft) – über „Als PDF speichern“ im Druckdialog
function printHistory() {
  const v = state.vehicle;
  const sorted = [...state.serviceHistory].sort(byRecent);
  const total = sorted.reduce((t, e) => t + (e.cost || 0), 0);
  document.getElementById('printArea').innerHTML = `
    <h1>${esc(vehicleTitle(v) || 'Service-Historie')}</h1>
    <p>${esc([v.vin ? 'VIN ' + v.vin : v.chassis ? 'Chassis ' + v.chassis : '', v.firstRegistration ? 'EZ ' + formatDate(v.firstRegistration) : '', v.currentKm.toLocaleString('de-DE') + ' km', 'Stand ' + formatDate(todayIso())].filter(Boolean).join(' · '))}</p>
    <table>
      <thead><tr><th>Datum</th><th>km</th><th>Kategorie</th><th>Arbeiten</th><th>Werkstatt</th><th>Kosten</th></tr></thead>
      <tbody>${sorted.map(e => `<tr><td>${formatDate(e.date)}</td><td>${e.km.toLocaleString('de-DE')}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td>${esc(e.shop || '')}</td><td>${e.cost != null ? fmtEur(e.cost) : ''}</td></tr>`).join('')}</tbody>
    </table>
    ${total ? `<p><strong>Gesamtkosten: ${fmtEur(total)}</strong></p>` : ''}`;
  window.print();
}

// Stichwort-Zuordnung für Einträge in „Anderes“ (Reihenfolge = Vorrang bei mehreren Treffern)
const CATEGORY_KEYWORDS = [
  ['Inspektion',       /inspektion|ölservice/i],
  ['Zündkerzen',       /zündkerz/i],
  ['Bremsflüssigkeit', /bremsflüssigkeit/i],
  ['Bremsen',          /bremsen|bremsbel|bremsscheib|bremssattel|ankerblech/i],
  ['Getriebe',         /getriebe|differential|wandler|hardyscheibe|mittellager|antriebswelle|gleichlaufgelenk|servo/i],
  ['Reifen',           /reifen|rondell|felge|spureinstellung|achsteile/i],
  ['TÜV',              /tüv|\bhu\b|\bau\b|hauptuntersuchung/i],
  ['Kühlmittel',       /kühlmittel|kühler|thermostat/i],
  ['Filter',           /filter/i],
];

function guessCategory(text) {
  const hit = CATEGORY_KEYWORDS.find(([, re]) => re.test(text));
  return hit ? hit[0] : null;
}

async function autoCategorize() {
  const todo = state.serviceHistory.filter(e => e.category === 'Anderes')
    .map(e => ({ e, cat: guessCategory(e.description) })).filter(x => x.cat);
  if (!todo.length) { showToast('Keine passenden Einträge in „Anderes“ gefunden', 'warn'); return; }
  const counts = {};
  todo.forEach(x => { counts[x.cat] = (counts[x.cat] || 0) + 1; });
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ');
  const ok = await confirmDialog({
    title: `${todo.length} Einträge zuordnen?`,
    text: `Anhand von Stichwörtern in der Beschreibung werden Einträge aus „Anderes“ verschoben: ${summary}. Bei mehreren Stichwörtern entscheidet die wichtigste Kategorie. Einzelne Einträge kannst du danach jederzeit ändern.`,
    ok: 'Zuordnen',
  });
  if (!ok) return;
  todo.forEach(x => { x.e.category = x.cat; });
  saveState();
  showToast(todo.length + ' Einträge zugeordnet ✓', 'ok');
  renderSettings();
}

// Intervall-Editor: eine Zeile je Kategorie (km und Monate), Änderungen werden sofort gespeichert
function renderIntervalEditor() {
  const el = document.getElementById('intervalEditor');
  if (!el) return;
  const ivs = state.settings.intervals || {};
  el.innerHTML = Object.keys(CATEGORIES).filter(c => c !== 'Anderes').map(cat => {
    const iv = ivs[cat] || {};
    return `
      <div class="interval-row" data-cat="${esc(cat)}">
        <div class="interval-name">${catIcon(cat)}<span>${esc(CATEGORIES[cat].label)}</span></div>
        <label class="interval-field"><input type="number" inputmode="numeric" min="1" step="1" data-field="km" value="${iv.km || ''}" placeholder="–" aria-label="${esc(cat)}: Intervall in Kilometern"><span>km</span></label>
        <label class="interval-field"><input type="number" inputmode="numeric" min="1" step="1" data-field="months" value="${iv.months || ''}" placeholder="–" aria-label="${esc(cat)}: Intervall in Monaten"><span>Mon.</span></label>
      </div>`;
  }).join('');
}

function bindIntervalEditor() {
  document.getElementById('intervalEditor').addEventListener('change', ev => {
    const input = ev.target.closest('input[data-field]');
    const row = ev.target.closest('[data-cat]');
    if (!input || !row) return;
    const cat = row.dataset.cat;
    const iv = Object.assign({ km: null, months: null }, state.settings.intervals[cat]);
    iv[input.dataset.field] = toInt(input.value, 1);
    if (iv.km || iv.months) state.settings.intervals[cat] = iv;
    else delete state.settings.intervals[cat];
    input.value = iv[input.dataset.field] || '';
    saveState();
    showToast('Intervall gespeichert', 'ok');
  });
}

function buildColorGrid(containerId, selectedKey, onSelect) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = Object.entries(BMW_COLORS).map(([key, c]) => `
    <button type="button" class="color-swatch-btn${selectedKey === key ? ' active' : ''}"
            title="${c.label}"
            aria-label="${c.label}${selectedKey === key ? ' (aktiv)' : ''}"
            aria-pressed="${selectedKey === key}"
            data-color="${key}">
      <span class="swatch-dot" style="--swatch-color:${c.hex};"></span>
      <span class="swatch-label">${c.label}</span>
    </button>`
  ).join('');
  grid.onclick = (e) => {
    const btn = e.target.closest('[data-color]');
    if (btn) onSelect(btn.dataset.color);
  };
}

// Stammdaten als Info-Zeilen (Fahrzeug-Ansicht + Onboarding)
function renderVehicleInfo(containerId, v) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const rows = [
    ['Modell',         vehicleTitle(v)],
    ['Hersteller',     v.make],
    ['Baureihe',       v.series],
    ['Modelljahr',     v.modelYear],
    ['Karosserie',     v.body],
    ['Motor',          v.engine],
    ['Kraftstoff',     v.fuel],
    ['Getriebe',       v.transmission],
    ['Antrieb',        v.drive],
    ['Werk',           v.plant],
    ['VIN',            v.vin],
    ['Fahrgestellnr.', v.chassis],
    ['Erstzulassung',  v.firstRegistration ? formatDate(v.firstRegistration) : ''],
  ].filter(([, val]) => val);
  el.innerHTML = rows.length
    ? rows.map(([k, val]) => `<div class="info-row"><span>${esc(k)}</span><strong>${esc(val)}</strong></div>`).join('')
    : `<div class="info-row"><span>Keine Fahrzeugdaten hinterlegt</span></div>`;
}

// Kompakte Darstellung der ausgelesenen Daten (Onboarding)
function renderVehicleChips(containerId, v) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const chips = [
    ['ph-calendar-blank', '📅', v.modelYear],
    ['ph-car-profile', '🚘', v.body],
    ['ph-engine', '⚙️', v.engine],
    ['ph-gas-pump', '⛽', v.fuel],
    ['ph-gear-six', '🕹️', v.transmission],
  ].filter(c => c[2]);
  el.innerHTML = chips.map(([icon, fb, val]) =>
    `<span class="meta-chip"><i class="ph-light ${icon}" data-fb="${fb}" aria-hidden="true"></i><span>${esc(val)}</span></span>`).join('');
}

// ─── Export / Import ──────────────────────────────────────────────────────────
// Sicherungs-Metadaten (bewusst nicht Teil der exportierten Daten)
const BACKUP_KEY = 'cst_backup';
const BACKUP_MAX_DAYS = 30;     // Erinnerung nach X Tagen (sobald es Änderungen gibt)
const BACKUP_MAX_CHANGES = 20;  // … oder nach X neuen Einträgen
const BACKUP_SNOOZE_DAYS = 7;

function entryCount() { return state.serviceHistory.length + state.fuelLog.length; }

function readBackupMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
    return m && typeof m === 'object' ? m : {};
  } catch (e) { return {}; }
}
function writeBackupMeta(patch) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(Object.assign(readBackupMeta(), patch))); } catch (e) {}
}
function markBackupDone() {
  writeBackupMeta({ last: new Date().toISOString(), count: entryCount(), snooze: null });
  renderBackupStatus();
  renderBackupHint();
}

function daysSince(iso) {
  const t = Date.parse(iso);
  return isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
}

// Zustand der Sicherung: { days, changes, due }
function backupInfo() {
  const m = readBackupMeta();
  const total = entryCount();
  const days = m.last ? daysSince(m.last) : null;
  const changes = m.last ? Math.max(0, total - (m.count || 0)) : total;
  let due = false;
  if (!m.last) due = total >= 3;
  else due = (days !== null && days >= BACKUP_MAX_DAYS && changes >= 1) || changes >= BACKUP_MAX_CHANGES;
  const snoozed = m.snooze && Date.parse(m.snooze) > Date.now();
  return { last: m.last || null, days, changes, due: due && !snoozed };
}

function backupAgeText(info) {
  if (!info.last) return 'Noch keine Sicherung angelegt';
  if (info.days === null) return 'Letzte Sicherung: unbekannt';
  if (info.days <= 0) return 'Letzte Sicherung: heute';
  if (info.days === 1) return 'Letzte Sicherung: gestern';
  return 'Letzte Sicherung: vor ' + info.days + ' Tagen';
}

function renderBackupStatus() {
  const el = document.getElementById('backupStatus');
  if (!el) return;
  const info = backupInfo();
  const extra = info.last && info.changes ? ' · ' + info.changes + ' neue Einträge seitdem' : '';
  el.textContent = backupAgeText(info) + extra;
  el.classList.toggle('is-due', info.due);
}

function renderBackupHint() {
  const el = document.getElementById('backupHint');
  if (!el) return;
  const info = backupInfo();
  el.hidden = !info.due;
  if (!info.due) return;
  document.getElementById('backupHintText').textContent = info.last
    ? backupAgeText(info) + (info.changes ? ' – seitdem ' + info.changes + ' neue Einträge.' : '.')
    : 'Deine Daten liegen nur auf diesem Gerät. Sichere sie einmal in iCloud, Google Drive oder Dateien.';
}

function snoozeBackupHint() {
  writeBackupMeta({ snooze: new Date(Date.now() + BACKUP_SNOOZE_DAYS * 86400000).toISOString() });
  renderBackupHint();
  renderBackupStatus();
}

// Dauerhaften Speicher anfordern: schützt vor automatischem Aufräumen durch den Browser
async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { return null; }
}

async function renderStorageStatus() {
  const el = document.getElementById('storageStatus');
  if (!el) return;
  let persisted = null;
  try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) {}
  el.textContent = persisted === true ? 'Speicher: dauerhaft geschützt'
    : persisted === false ? 'Speicher: Browser darf ihn bei Platzmangel leeren – bitte regelmäßig sichern'
    : 'Speicher: Status nicht verfügbar';
}

function backupFileName() {
  const tag = (vehicleTitle(state.vehicle) || 'fahrzeug').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return 'service-tracker-' + tag + '-' + todayIso() + '.json';
}

function downloadBackup(file) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Backup: bevorzugt über das Teilen-Menü des Geräts (iCloud Drive, Google Drive, Dateien, Mail …),
// sonst als normaler Download.
async function exportData() {
  const file = new File([JSON.stringify(state, null, 2)], backupFileName(), { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Service-Tracker Backup' });
      markBackupDone();
      showToast('Backup weitergegeben – speichere es in Dateien oder Drive', 'ok');
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // Teilen-Menü abgebrochen: nichts gesichert
    console.warn('share:', e); // anderer Fehler → Download als Rückfall
  }
  downloadBackup(file);
  markBackupDone();
  showToast('Backup heruntergeladen', 'ok');
}

function importData(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const next = normalizeState(JSON.parse(ev.target.result));
      const ok = await confirmDialog({
        title: 'Backup einspielen?',
        text: `${next.serviceHistory.length} Einträge werden geladen. Die aktuellen Daten (${state.serviceHistory.length} Einträge) werden dabei ersetzt.`,
        ok: 'Einspielen', danger: true,
      });
      if (!ok) return;
      const previous = state;
      state = next;
      try {
        applyTheme(state.settings.vehicleColor);
        renderHeader();
        switchTab('dashboard');
      } catch (err) { state = previous; throw err; }
      saveState();
      markBackupDone(); // die eingespielte Datei entspricht dem aktuellen Stand
      showToast('Import erfolgreich', 'ok');
    } catch (e) {
      showToast('Import fehlgeschlagen: ' + e.message, 'err');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

async function resetDataPrompt() {
  const ok = await confirmDialog({
    title: 'Alles zurücksetzen?',
    text: 'Alle Einträge und Einstellungen werden gelöscht. Das kann nicht rückgängig gemacht werden – lege vorher ein Backup an.'
      + (window.syncEnabled?.() ? ' Die Synchronisierung ist aktiv: Das Löschen wird auch in Google Drive und auf deinen anderen Geräten übernommen.' : ''),
    ok: 'Zurücksetzen', danger: true,
  });
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = JSON.parse(JSON.stringify(EMPTY_DATA));
  saveState();
  applyTheme(state.settings.vehicleColor);
  renderHeader();
  showToast('Daten zurückgesetzt', 'warn');
  showOnboarding();
}

// Eigener Bestätigungsdialog (statt window.confirm) – liefert ein Promise<boolean>
function confirmDialog({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise(resolve => {
    const d = document.getElementById('modal-confirm');
    const okBtn = document.getElementById('confirmOk');
    let result = false;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    okBtn.textContent = ok;
    okBtn.classList.toggle('is-danger', danger);
    document.getElementById('confirmCancel').textContent = cancel;
    okBtn.onclick = () => { result = true; d.close(); };
    document.getElementById('confirmCancel').onclick = () => d.close();
    d.onclose = () => resolve(result);
    d.showModal();
  });
}

// ─── VIN-Dekodierung ──────────────────────────────────────────────────────────
// Online: NHTSA vPIC (kostenlos, ohne Schlüssel, CORS-fähig).
// Offline-Fallback: Hersteller (WMI), Region, Seriennummer lokal aus der VIN.
// Hinweis: Lackfarbe und Erstzulassung sind NICHT in der VIN kodiert.
const VIN_API = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
const VIN_RE  = /^[A-HJ-NPR-Z0-9]{17}$/;

const WMI_MAKES = {
  WBA: 'BMW', WBS: 'BMW M', WBY: 'BMW i', WBX: 'BMW', '4US': 'BMW', '5UX': 'BMW', '5UM': 'BMW M', '5YM': 'BMW M',
  WMW: 'MINI', WME: 'smart',
  WDB: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDD: 'Mercedes-Benz', WDF: 'Mercedes-Benz', W1K: 'Mercedes-Benz', W1N: 'Mercedes-Benz', W1V: 'Mercedes-Benz',
  WAU: 'Audi', WUA: 'Audi', TRU: 'Audi', WA1: 'Audi',
  WVW: 'Volkswagen', WVG: 'Volkswagen', WV1: 'Volkswagen Nutzfahrzeuge', WV2: 'Volkswagen Nutzfahrzeuge', '3VW': 'Volkswagen',
  WP0: 'Porsche', WP1: 'Porsche',
  W0L: 'Opel', W0V: 'Opel', WF0: 'Ford', WFO: 'Ford',
  VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroën', VR3: 'Peugeot', VR7: 'Citroën', VSS: 'SEAT', VSK: 'Nissan',
  ZFA: 'Fiat', ZAR: 'Alfa Romeo', ZFF: 'Ferrari', ZHW: 'Lamborghini', ZAM: 'Maserati',
  TMB: 'Škoda', TMA: 'Hyundai', U5Y: 'Kia',
  YV1: 'Volvo', YV4: 'Volvo', YS3: 'Saab',
  SAJ: 'Jaguar', SAL: 'Land Rover', SCC: 'Lotus', SCF: 'Aston Martin', SCB: 'Bentley', SCA: 'Rolls-Royce',
  '5YJ': 'Tesla', '7SA': 'Tesla', LRW: 'Tesla', XP7: 'Tesla',
};
const WMI2_MAKES = {
  JT: 'Toyota', JN: 'Nissan', JH: 'Honda', JM: 'Mazda', JS: 'Suzuki', JF: 'Subaru', JA: 'Mitsubishi',
  KN: 'Kia', KM: 'Hyundai', '1G': 'General Motors', '1F': 'Ford', '1C': 'Chrysler', '2T': 'Toyota',
};
const VIN_REGIONS = [
  [/^[A-H]/, 'Afrika'], [/^[J]/, 'Japan'], [/^K[L-R]/, 'Südkorea'], [/^L/, 'China'], [/^M[A-E]/, 'Indien'],
  [/^S[A-M]/, 'Großbritannien'], [/^T[A-H]/, 'Schweiz'], [/^T[J-P]/, 'Tschechien'], [/^TR/, 'Ungarn'],
  [/^V[A-E]/, 'Österreich'], [/^V[F-R]/, 'Frankreich'], [/^V[S-W]/, 'Spanien'], [/^W/, 'Deutschland'],
  [/^X[S-W0-9]/, 'Russland'], [/^Y[A-E]/, 'Belgien'], [/^Y[F-K]/, 'Finnland'], [/^Y[S-W]/, 'Schweden'],
  [/^Z/, 'Italien'], [/^[1457]/, 'USA'], [/^2/, 'Kanada'], [/^3/, 'Mexiko'], [/^9[A-E]/, 'Brasilien'],
];
const MODEL_YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

function normalizeVin(v) {
  // I/O/Q kommen in VINs nicht vor – häufige Tippfehler direkt korrigieren
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    .replace(/[IOQ]/g, c => (c === 'I' ? '1' : '0')).slice(0, 17);
}

// BMW-Typschlüssel (VIN-Stellen 4–7) → Baureihe, Schriftzug (inkl. „A“ = Automatik), Karosserie.
// Europäische BMW-VINs kennt die NHTSA-Datenbank meist nicht – diese Tabelle füllt die Lücke.
// Nur gesicherte Einträge aufnehmen (Quelle: BMW-Teilekatalog / bimmerarchiv.de).
const BMW_TYPE_CODES = {
  DT61: { series: 'E39', badge: '530iA', body: 'Limousine' },
  DL91: { series: 'E39', badge: '525d',  body: 'Limousine' },
  DD11: { series: 'E39', badge: '520i',  body: 'Limousine' },
};

function decodeVinLocal(vin) {
  const out = { vin };
  out.make = WMI_MAKES[vin.slice(0, 3)] || WMI2_MAKES[vin.slice(0, 2)] || '';
  const region = VIN_REGIONS.find(([re]) => re.test(vin.slice(0, 2)));
  if (region) out.plant = region[1];
  // BMW/MINI: „kurze“ Fahrgestellnummer = letzte 7 Stellen
  if (/^(BMW|MINI)/.test(out.make)) out.chassis = vin.slice(-7);
  const tc = /^BMW/.test(out.make) && BMW_TYPE_CODES[vin.slice(3, 7)];
  if (tc) {
    out.series = tc.series;
    out.model = [tc.series, tc.badge].filter(Boolean).join(' ');
    if (tc.body) out.body = tc.body;
    if (/A$/.test(tc.badge)) out.transmission = 'Automatik';
  }
  // Modelljahr (Stelle 10) ist nur in Nordamerika verbindlich – offline nur dort verwenden
  if (/^[1-5]/.test(vin)) {
    const idx = MODEL_YEAR_CODES.indexOf(vin[9]);
    if (idx >= 0) {
      const maxYear = new Date().getFullYear() + 1;
      let year = 1980 + idx;
      while (year + 30 <= maxYear) year += 30;
      out.modelYear = String(year);
    }
  }
  return out;
}

const VPIC_EMPTY = /^(|0|Not Applicable|null)$/i;
const BODY_DE = {
  'Sedan/Saloon': 'Limousine', 'Wagon': 'Kombi', 'Convertible/Cabriolet': 'Cabrio', 'Coupe': 'Coupé',
  'Hatchback/Liftback/Notchback': 'Schrägheck', 'Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)': 'SUV',
  'Crossover Utility Vehicle (CUV)': 'Crossover', 'Minivan': 'Van', 'Van': 'Transporter', 'Pickup': 'Pick-up', 'Roadster': 'Roadster',
};
const FUEL_DE = { 'Gasoline': 'Benzin', 'Diesel': 'Diesel', 'Electric': 'Elektro', 'Flexible Fuel Vehicle (FFV)': 'Flex-Fuel', 'Compressed Natural Gas (CNG)': 'Erdgas (CNG)', 'Liquefied Petroleum Gas (propane or LPG)': 'Autogas (LPG)' };
const COUNTRY_DE = { 'GERMANY': 'Deutschland', 'AUSTRIA': 'Österreich', 'UNITED STATES (USA)': 'USA', 'FRANCE': 'Frankreich', 'ITALY': 'Italien', 'SPAIN': 'Spanien', 'UNITED KINGDOM (UK)': 'Großbritannien', 'CZECH REPUBLIC': 'Tschechien', 'HUNGARY': 'Ungarn', 'SWEDEN': 'Schweden', 'BELGIUM': 'Belgien', 'NETHERLANDS': 'Niederlande', 'SOUTH AFRICA': 'Südafrika', 'MEXICO': 'Mexiko', 'CHINA': 'China', 'JAPAN': 'Japan', 'SOUTH KOREA': 'Südkorea', 'SLOVAKIA': 'Slowakei', 'POLAND': 'Polen', 'PORTUGAL': 'Portugal', 'FINLAND': 'Finnland', 'BRAZIL': 'Brasilien', 'CANADA': 'Kanada', 'INDIA': 'Indien' };
const TRANS_DE = { 'Automatic': 'Automatik', 'Manual/Standard': 'Schaltgetriebe', 'Continuously Variable Transmission (CVT)': 'CVT', 'Dual-Clutch Transmission (DCT)': 'Doppelkupplung', 'Automated Manual Transmission (AMT)': 'Automatisiert' };

// ─── BMW: Baureihe (E39 …) + Typ-Schriftzug (530i, 520d …) + „A“ für Automatik ──
// Baureihen nach Modelljahr (Grenzen ≈ Modellwechsel). Karosserie-Varianten
// mit eigenem Code (Touring, Coupé, Cabrio, GT) über tour/coupe/cabrio/gt.
const BMW_GENERATIONS = {
  '1': [[2004, 2011, 'E87', { coupe: 'E82', cabrio: 'E88' }], [2012, 2019, 'F20'], [2020, 9999, 'F40']],
  '2': [[2014, 2021, 'F22', { cabrio: 'F23', van: 'F45' }], [2022, 9999, 'G42', { van: 'U06' }]],
  '3': [[1976, 1983, 'E21'], [1984, 1991, 'E30'], [1992, 1998, 'E36'], [1999, 2005, 'E46'],
        [2006, 2012, 'E90', { tour: 'E91', coupe: 'E92', cabrio: 'E93' }], [2013, 2019, 'F30', { tour: 'F31', gt: 'F34' }],
        [2020, 9999, 'G20', { tour: 'G21' }]],
  '4': [[2014, 2020, 'F32', { cabrio: 'F33', gt: 'F36' }], [2021, 9999, 'G22', { cabrio: 'G23', gt: 'G26' }]],
  '5': [[1973, 1981, 'E12'], [1982, 1988, 'E28'], [1989, 1996, 'E34'], [1997, 2003, 'E39'],
        [2004, 2010, 'E60', { tour: 'E61' }], [2011, 2016, 'F10', { tour: 'F11', gt: 'F07' }],
        [2017, 2023, 'G30', { tour: 'G31' }], [2024, 9999, 'G60', { tour: 'G61' }]],
  '6': [[1977, 1989, 'E24'], [2004, 2010, 'E63', { cabrio: 'E64' }], [2011, 2018, 'F12', { cabrio: 'F13', gt: 'F06' }], [2018, 9999, 'G32']],
  '7': [[1978, 1986, 'E23'], [1987, 1994, 'E32'], [1995, 2001, 'E38'], [2002, 2008, 'E65'], [2009, 2015, 'F01'], [2016, 2022, 'G11'], [2023, 9999, 'G70']],
  '8': [[1990, 1999, 'E31'], [2019, 9999, 'G15', { cabrio: 'G14', gt: 'G16' }]],
  'X1': [[2009, 2015, 'E84'], [2016, 2022, 'F48'], [2023, 9999, 'U11']],
  'X3': [[2004, 2010, 'E83'], [2011, 2017, 'F25'], [2018, 2024, 'G01'], [2025, 9999, 'G45']],
  'X4': [[2015, 2018, 'F26'], [2019, 9999, 'G02']],
  'X5': [[2000, 2006, 'E53'], [2007, 2013, 'E70'], [2014, 2018, 'F15'], [2019, 9999, 'G05']],
  'X6': [[2008, 2014, 'E71'], [2015, 2019, 'F16'], [2020, 9999, 'G06']],
  'Z3': [[1996, 2002, 'E36/7']],
  'Z4': [[2003, 2008, 'E85'], [2009, 2016, 'E89'], [2019, 9999, 'G29']],
};
// Hubraum (l, eine Nachkommastelle) → Ziffern im Schriftzug, wo sie vom Hubraum abweichen
const BMW_BADGE_DISP = { '2.2': '20', '2.9': '30', '4.4': '40', '4.8': '50', '1.6': '16', '1.9': '18', '1.8': '18' };

function bmwSeriesKey(model) {
  const m = String(model).match(/\b([1-8])[-\s]?(?:er|series|serie)\b/i) || String(model).match(/^([1-8])\d{2}/);
  if (m) return m[1];
  const x = String(model).match(/\b([XZ]\d)\b/i);
  return x ? x[1].toUpperCase() : '';
}

function bmwChassisCode(seriesKey, year, bodyClass, isGt) {
  const gens = BMW_GENERATIONS[seriesKey];
  if (!gens || !year) return '';
  const gen = gens.find(([from, to]) => year >= from && year <= to);
  if (!gen) return '';
  const v = gen[3] || {};
  if (isGt && v.gt) return v.gt;
  if (/Wagon/i.test(bodyClass) && v.tour) return v.tour;
  if (/Convertible|Cabrio|Roadster/i.test(bodyClass) && v.cabrio) return v.cabrio;
  if (/Coupe/i.test(bodyClass) && v.coupe) return v.coupe;
  if (/Minivan|MPV/i.test(bodyClass) && v.van) return v.van;
  return gen[2];
}

// Liefert z.B. { series: 'E39', badge: '530iA' } – oder null, wenn nicht ermittelbar
function bmwDesignation({ model, series, trim, year, disp, fuel, transmission, drive, bodyClass }) {
  const raw = [series, trim, model].find(t => /\b(\d{3}|[XZ]\d\s?\d{2}|M\d{3})(x?[ide]|e|Li|Ci|i|d)\b/i.test(t || '')) || '';
  const mModel = String(model).match(/^M([1-8])\b/i);           // M3, M5 …
  const seriesKey = mModel ? mModel[1] : (bmwSeriesKey(model) || bmwSeriesKey(raw));
  const chassis = bmwChassisCode(seriesKey, parseInt(year, 10), bodyClass, /\bGT\b|Gran Turismo/i.test(model + ' ' + series + ' ' + trim));

  // Typ-Schriftzug: bevorzugt aus den API-Feldern (530i, 520d, 330xi …)
  let badge = '';
  const xz = /^[XZ]\d$/.test(seriesKey);
  if (mModel) badge = 'M' + mModel[1];
  // X/Z: Modellname + Motorisierung, z.B. „X5 3.0i“ bzw. „X3 xDrive20d“
  else if (xz) badge = [seriesKey, [series, trim].find(t => /\d\.\d[id]|[sx]Drive\d{2}[ide]/i.test(t || '')) || ''].filter(Boolean).join(' ');
  const m = badge ? null : raw.match(/\b(M?\d{3})(x?)([a-z]{1,2})\b/i);
  if (m) {
    badge = m[1] + m[2].toLowerCase() + m[3].replace(/^L(i)$/i, 'Li').replace(/^C(i)$/i, 'Ci');
    if (!/^(Li|Ci)$/.test(badge.slice(-2))) badge = badge.toLowerCase().replace(/^m/, 'M');
  } else if (!badge && /^[1-8]$/.test(seriesKey) && disp > 0 && parseInt(year, 10) < 2011) {
    // Ältere Modelle: Schriftzug folgt (fast immer) dem Hubraum
    const l = disp.toFixed(1);
    const digits = BMW_BADGE_DISP[l] || String(Math.round(disp * 10)).padStart(2, '0');
    const awd = /AWD|4WD|All/i.test(drive);
    badge = seriesKey + digits + (awd ? 'x' : '') + (/Diesel/i.test(fuel) ? 'd' : 'i');
  }
  // „A“ für Automatik (nur am klassischen Schriftzug, nicht bei M-Modellen)
  if (badge && /^\d{3}/.test(badge) && /Automatic/i.test(transmission) && !/A$/.test(badge)) badge += 'A';
  if (badge && /^\d{3}/.test(badge) && /xDrive/i.test(raw)) badge += ' xDrive';

  if (!chassis && !badge) return null;
  return { series: chassis, badge };
}

function prettyMake(s) {
  return s.length <= 4 ? s : s.toLowerCase().replace(/(^|[\s-])\S/g, m => m.toUpperCase());
}

function mapVpic(r) {
  const g = k => (r[k] == null || VPIC_EMPTY.test(String(r[k]).trim())) ? '' : String(r[k]).trim();
  const out = {};
  if (g('Make')) out.make = prettyMake(g('Make'));
  const model = g('Model'), detail = g('Series') || g('Trim');
  out.model = [model, detail && !model.toLowerCase().includes(detail.toLowerCase()) ? detail : ''].filter(Boolean).join(' ');
  if (g('ModelYear')) out.modelYear = g('ModelYear');
  // BMW: „E39 530iA“ statt „5-Series 530i“
  if (/^BMW/i.test(g('Make'))) {
    const d = bmwDesignation({
      model, series: g('Series'), trim: g('Trim'), year: g('ModelYear'), disp: parseFloat(g('DisplacementL')),
      fuel: g('FuelTypePrimary'), transmission: g('TransmissionStyle'), drive: g('DriveType'), bodyClass: g('BodyClass'),
    });
    if (d) {
      out.series = d.series;
      out.model = [d.series, d.badge].filter(Boolean).join(' ') || out.model;
    }
  }
  if (g('BodyClass')) out.body = BODY_DE[g('BodyClass')] || g('BodyClass');
  const disp = parseFloat(g('DisplacementL'));
  const hp = parseFloat(g('EngineHP')), kw = parseFloat(g('EngineKW'));
  const ps = !isNaN(kw) ? Math.round(kw * 1.35962) : (!isNaN(hp) ? Math.round(hp * 1.01387) : NaN);
  out.engine = [
    g('EngineModel'),
    !isNaN(disp) && disp > 0 ? disp.toFixed(1).replace('.', ',') + ' l' : '',
    g('EngineCylinders') ? g('EngineCylinders') + ' Zyl.' : '',
    !isNaN(ps) && ps > 0 ? ps + ' PS' : '',
  ].filter(Boolean).join(' · ');
  if (g('FuelTypePrimary')) out.fuel = FUEL_DE[g('FuelTypePrimary')] || g('FuelTypePrimary');
  if (g('TransmissionStyle')) out.transmission = TRANS_DE[g('TransmissionStyle')] || g('TransmissionStyle');
  const drive = g('DriveType');
  if (drive) out.drive = /AWD|4WD|4x4|All/i.test(drive) ? 'Allrad' : /RWD|Rear/i.test(drive) ? 'Heckantrieb' : /FWD|Front/i.test(drive) ? 'Frontantrieb' : drive;
  const plant = [g('PlantCity') && prettyMake(g('PlantCity')), g('PlantCountry') && (COUNTRY_DE[g('PlantCountry').toUpperCase()] || prettyMake(g('PlantCountry')))].filter(Boolean).join(', ');
  if (plant) out.plant = plant;
  Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
  return out;
}

async function decodeVin(vin) {
  const local = decodeVinLocal(vin);
  if (!navigator.onLine) return { vehicle: local, source: 'offline' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(VIN_API + encodeURIComponent(vin) + '?format=json', { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const online = mapVpic((json.Results && json.Results[0]) || {});
    if (!online.make && !online.model) return { vehicle: local, source: local.model ? 'local' : 'unknown' };
    // Typschlüssel-Tabelle ist bei BMW genauer als die (US-)Datenbank
    const merged = Object.assign({}, local, online);
    if (local.model) ['model', 'series', 'body', 'transmission'].forEach(k => { if (local[k]) merged[k] = local[k]; });
    return { vehicle: merged, source: merged.model ? 'online' : 'nomodel' };
  } catch (e) {
    console.warn('VIN-Abfrage fehlgeschlagen:', e);
    return { vehicle: local, source: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Onboarding (1. VIN → 2. Daten prüfen + Farbe) ───────────────────────────
let pendingOnboardingColor = 'titansilber';
let pendingVehicle = null;

function onVinInput(input) {
  input.value = normalizeVin(input.value);
  const hint = document.getElementById('onboardingVinHint');
  hint.classList.remove('is-error');
  hint.textContent = input.value.length
    ? input.value.length + ' / 17 Zeichen'
    : 'Steht im Fahrzeugschein (Feld E) und unten an der Windschutzscheibe.';
}

function showOnboarding() {
  setMenuOpen(false);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-onboarding').classList.add('active');
  document.getElementById('menuBtn').hidden = !state.settings.onboardingDone;
  document.getElementById('pageTitle').textContent = state.settings.onboardingDone ? 'Fahrzeug ändern' : 'Willkommen';
  document.querySelectorAll('#view-onboarding [data-cancel]').forEach(b => { b.hidden = !state.settings.onboardingDone; });
  document.getElementById('onboardingFinishBtn').textContent = state.settings.onboardingDone ? 'Speichern' : 'Loslegen';

  pendingOnboardingColor = state.settings.vehicleColor || 'titansilber';
  const vinInput = document.getElementById('onboardingVin');
  vinInput.value = state.vehicle.vin || '';
  onVinInput(vinInput);
  showOnboardingStep('vin');
}

function showOnboardingStep(step) {
  document.getElementById('onboardingStepVin').hidden = step !== 'vin';
  document.getElementById('onboardingStepDetails').hidden = step !== 'details';
  const scroller = document.querySelector('#view-onboarding .scroll-content');
  if (scroller) scroller.scrollTop = 0;
  if (step === 'vin') document.getElementById('onboardingVin').focus({ preventScroll: true });
}

async function submitOnboardingVin(event) {
  event.preventDefault();
  const input = document.getElementById('onboardingVin');
  const hint  = document.getElementById('onboardingVinHint');
  const vin   = normalizeVin(input.value);
  input.value = vin;
  if (!VIN_RE.test(vin)) {
    hint.textContent = 'Eine VIN hat genau 17 Zeichen (aktuell ' + vin.length + ').';
    hint.classList.add('is-error');
    input.focus();
    return;
  }
  const btn = document.getElementById('onboardingVinBtn');
  btn.disabled = true;
  btn.textContent = 'Wird abgerufen…';
  try {
    const { vehicle, source } = await decodeVin(vin);
    showOnboardingDetails(vehicle, source);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fahrzeugdaten abrufen';
  }
}

function skipOnboardingVin() {
  showOnboardingDetails({ vin: '' }, 'manual');
}

function showOnboardingDetails(decoded, source) {
  const cur = state.vehicle;
  const sameVin = decoded.vin && decoded.vin === cur.vin;
  pendingVehicle = decoded;

  const notes = {
    online:  'Per VIN ermittelt – bitte prüfen und ergänzen.',
    local:   'Über den Typschlüssel der VIN erkannt – bitte prüfen und ergänzen.',
    nomodel: 'Hersteller erkannt, das Modell ließ sich aus der VIN aber nicht ermitteln. Bitte Modellbezeichnung ergänzen (z.B. E39 530iA).',
    unknown: 'Zu dieser VIN wurden online keine Modelldaten gefunden – Hersteller und Herkunft stammen direkt aus der VIN. Bitte Modell ergänzen.',
    offline: 'Die Online-Abfrage war nicht möglich (offline?). Hersteller und Herkunft stammen direkt aus der VIN – du kannst die VIN später unter „Fahrzeug & Design“ erneut abrufen.',
    manual:  'Trage die Daten deines Fahrzeugs ein.',
  };
  document.getElementById('onboardingDecodeNote').textContent = notes[source] || '';
  document.getElementById('onboardingVehicleTitle').textContent = decoded.model ? vehicleTitle(decoded) : 'Dein Fahrzeug';
  const infoCard = document.getElementById('onboardingVehicleInfo');
  infoCard.hidden = source === "manual";
  renderVehicleChips('onboardingVehicleInfo', decoded);

  // Vorbelegen: dekodierte Werte, sonst vorhandene (bei gleicher VIN / ohne VIN)
  const keep = sameVin || !decoded.vin;
  // Nur den Hersteller (z.B. „BMW“) nicht als Modellbezeichnung vorbelegen
  // Bei gleicher VIN hat ein bereits (manuell) gepflegtes Modell Vorrang
  document.getElementById('onboardingModel').value    =
    (sameVin && cur.model) ? vehicleTitle(cur) :
    decoded.model ? vehicleTitle(decoded) : (keep && cur.model ? vehicleTitle(cur) : '');
  document.getElementById('onboardingFirstReg').value = cur.firstRegistration || '';
  document.getElementById('onboardingKm').value       = cur.currentKm || '';

  buildOnboardingColorGrid();
  showOnboardingStep('details');
}

function buildOnboardingColorGrid() {
  buildColorGrid('onboardingColorGrid', pendingOnboardingColor, (key) => {
    pendingOnboardingColor = key;
    applyTheme(key);
    buildOnboardingColorGrid();
  });
}

function finishOnboarding(event) {
  if (event) event.preventDefault();
  const decoded = pendingVehicle || {};
  const km = parseInt(document.getElementById('onboardingKm').value, 10);
  const modelInput = document.getElementById('onboardingModel').value.trim();

  // Gleiche VIN (oder ohne VIN): bisherige Felder behalten, nur nicht-leere Werte überschreiben.
  // Neue VIN: alte dekodierte Felder verwerfen; KM, EZ und Historie bleiben erhalten.
  const sameVin = !decoded.vin || decoded.vin === state.vehicle.vin;
  const vehicle = sameVin
    ? Object.assign({}, state.vehicle)
    : { currentKm: state.vehicle.currentKm || 0, firstRegistration: state.vehicle.firstRegistration || '' };
  Object.keys(decoded).forEach(k => { if (decoded[k] !== '' && decoded[k] != null) vehicle[k] = decoded[k]; });
  if (!decoded.vin) vehicle.vin = '';

  // Modellbezeichnung aus dem Feld übernehmen (Hersteller bleibt erhalten, nicht doppelt)
  if (modelInput) {
    const make = vehicle.make || '';
    vehicle.model = make && modelInput.toLowerCase().startsWith(make.toLowerCase() + ' ')
      ? modelInput.slice(make.length + 1).trim() : modelInput;
  }
  vehicle.firstRegistration = document.getElementById('onboardingFirstReg').value || '';
  if (!isNaN(km) && km >= 0) vehicle.currentKm = km;

  const wasDone = state.settings.onboardingDone;
  state.vehicle = vehicle;
  state.settings.vehicleColor = pendingOnboardingColor;
  state.settings.onboardingDone = true;
  saveState();
  applyTheme(pendingOnboardingColor);
  renderHeader();
  pendingVehicle = null;
  if (wasDone) showToast('Fahrzeugdaten gespeichert', 'ok');
  switchTab(wasDone ? 'settings' : 'dashboard');
}

function cancelOnboarding() {
  pendingVehicle = null;
  applyTheme(state.settings.vehicleColor);
  switchTab('settings');
}

function editVehicleData() {
  showOnboarding();
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function todayIso() {
  return toIso(new Date());
}

// Datumsfunktionen rechnen mit lokalen Kalendertagen (kein UTC-Versatz)
function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

function toIso(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function addMonths(iso, n) {
  const d = parseDate(iso);
  if (!d) return '';
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toIso(d);
}

function daysUntil(iso) {
  return Math.round((parseDate(iso) - parseDate(todayIso())) / 86400000);
}

function formatDate(iso) {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : iso;
}

function vehicleTitle(v) {
  const model = (v.model || '').trim();
  const make  = (v.make  || '').trim();
  if (!model) return make;
  if (!make || model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return make + ' ' + model;
}

function renderHeader() {
  const title = vehicleTitle(state.vehicle);
  document.title = title ? title + ' – Service-Tracker' : 'Service-Tracker';
  const d = document.getElementById('drawerVehicle');
  if (d) d.textContent = title || 'Service-Tracker';
  const sub = document.getElementById('drawerVehicleSub');
  if (sub) sub.textContent = [state.vehicle.vin, state.vehicle.currentKm ? state.vehicle.currentKm.toLocaleString('de-DE') + ' km' : ''].filter(Boolean).join(' · ');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCategoryOptions() {
  document.getElementById('form-category').innerHTML = Object.entries(CATEGORIES)
    .map(([k, c]) => `<option value="${esc(k)}">${esc(c.label)}</option>`).join('');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Icon-Schrift fehlt (offline/blockiert) → Emoji-Fallback aktivieren
window.addEventListener('load', () => {
  document.fonts?.load('16px "Phosphor-Light"').then(f => {
    if (!f.length) document.documentElement.classList.add('icons-fb');
  }).catch(() => document.documentElement.classList.add('icons-fb'));
});

function init() {
  const saved = loadState();
  state = saved ? saved : JSON.parse(JSON.stringify(EMPTY_DATA));
  buildSnap();
  if (!saved) saveState();
  buildCategoryOptions();
  bindHistoryEvents();
  bindFuelEvents();
  bindIntervalEditor();

  let themeSaved = 'auto';
  try { themeSaved = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
  applyThemeMode(themeSaved);
  applyTheme(state.settings.vehicleColor);
  renderHeader();

  requestPersistentStorage().then(renderStorageStatus);
  renderBackupStatus();
  renderStorageStatus();

  const verEl = document.getElementById('appVersion');
  if (verEl) verEl.textContent = 'Version ' + (self.APP_VERSION || '–');

  // Offline-Hinweis
  function updateOffline() { document.body.classList.toggle('offline', !navigator.onLine); }
  window.addEventListener('online',  updateOffline);
  window.addEventListener('offline', updateOffline);
  updateOffline();

  window.initSync?.();

  // Erster Start: zuerst VIN abfragen
  if (!state.settings.onboardingDone) {
    showOnboarding();
    return;
  }

  // Manifest-Shortcuts (?view=…) und Benachrichtigungen (?action=update)
  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  switchTab({ history: 'history', fuel: 'fuel', stats: 'stats', settings: 'settings' }[view] || 'dashboard');
  if (view === 'new') openAddEntry();
  if (view === 'tank') { switchTab('fuel'); openFuelDialog(); }
  if (params.get('action') === 'update') setTimeout(() => window.checkForUpdate?.(), 1500);
  if (params.has('view') || params.has('action')) history.replaceState(null, '', location.pathname);
}

document.addEventListener('DOMContentLoaded', init);
