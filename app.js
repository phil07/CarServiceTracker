// Service Tracker – app.js
'use strict';

// ─── Fahrzeugfarben / Akzent-Palette ─────────────────────────────────────────
// hex   = Lackfarbe (Swatch)
// light = Akzent im hellen Design (weiße Schrift darauf, ≥ 4.5:1)
// dark  = Akzent im dunklen Design (dunkle Schrift darauf)
const BMW_COLORS = {
  titansilber:  { label: 'Titansilber',  hex: '#8a8f98', light: '#B45309', dark: '#FF9F43' },
  orientblau:   { label: 'Orientblau',   hex: '#1e3a8a', light: '#1D4ED8', dark: '#60A5FA' },
  calypsorot:   { label: 'Calypsorot',   hex: '#8b1a1a', light: '#C81E1E', dark: '#F87171' },
  dakargelb:    { label: 'Dakargelb',    hex: '#d9a521', light: '#A16207', dark: '#FACC15' },
  bostongruen:  { label: 'Bostongrün',   hex: '#14532d', light: '#15803D', dark: '#4ADE80' },
  imperialblau: { label: 'Imperialblau', hex: '#1e2f6b', light: '#3730A3', dark: '#A5B4FC' },
  schwarz:      { label: 'Schwarz',      hex: '#1c1c1f', light: '#27272A', dark: '#E4E4E7' },
  alpinweiss:   { label: 'Alpinweiß',    hex: '#e5e7eb', light: '#475569', dark: '#E2E8F0' },
  hellsilber:   { label: 'Hellsilber',   hex: '#b8bec7', light: '#52525B', dark: '#CBD5E1' },
  mojavesand:   { label: 'Mojavesand',   hex: '#a8875c', light: '#92400E', dark: '#E3A869' },
};

// ─── Kategorien ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  'Öl':               { icon: 'ph-drop',        fb: '🛢️', label: 'Öl' },
  'Bremsflüssigkeit': { icon: 'ph-disc',        fb: '🛑', label: 'Bremsflüssigkeit' },
  'Kühlmittel':       { icon: 'ph-thermometer', fb: '🌡️', label: 'Kühlmittel' },
  'Zündkerzen':       { icon: 'ph-lightning',   fb: '⚡', label: 'Zündkerzen' },
  'Anderes':          { icon: 'ph-wrench',      fb: '🔧', label: 'Anderes' },
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
  upcomingServices: [
    { category: 'Öl',               dueDate: '', dueKm: null },
    { category: 'Bremsflüssigkeit', dueDate: '', dueKm: null },
    { category: 'Kühlmittel',       dueDate: '', dueKm: null },
    { category: 'Zündkerzen',       dueDate: '', dueKm: null },
  ],
  serviceHistory: [],
  settings: { vehicleColor: 'titansilber', onboardingDone: false },
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
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('loadState:', e); }
  return null;
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('saveState:', e); }
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

// Fahrzeugfarbe → Akzentfarbe der App
function applyTheme(colorKey) {
  const c = BMW_COLORS[colorKey] || BMW_COLORS.titansilber;
  const r = document.documentElement.style;
  r.setProperty('--car-light', c.light);
  r.setProperty('--car-dark',  c.dark);
  document.documentElement.setAttribute('data-vehicle-color', colorKey);
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
  'add-entry': 'Neuer Eintrag',
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

  if (tab === 'dashboard') renderDashboard();
  if (tab === 'history')   renderHistory();
  if (tab === 'add-entry') initAddForm();
  if (tab === 'settings')  renderSettings();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function getServiceStatus(svc) {
  const km = state.vehicle.currentKm;
  if (svc.dueKm == null && !svc.dueDate) return 'none';
  let worst = 'ok';

  if (svc.dueKm != null) {
    const diff = svc.dueKm - km;
    if (diff <= 500)       worst = 'alert';
    else if (diff <= 2000) worst = worst === 'ok' ? 'warn' : worst;
  }

  if (svc.dueDate) {
    const days = Math.round((new Date(svc.dueDate) - new Date()) / 86400000);
    if (days <= 30)       worst = 'alert';
    else if (days <= 90)  worst = worst === 'ok' ? 'warn' : worst;
  }

  return worst;
}

function dueText(svc) {
  const parts = [];
  if (svc.dueDate) parts.push(formatDate(svc.dueDate));
  if (svc.dueKm != null) {
    parts.push(svc.dueKm.toLocaleString('de-DE') + ' km');
    const diff = svc.dueKm - state.vehicle.currentKm;
    if (diff > 0) parts.push('(noch ' + diff.toLocaleString('de-DE') + ' km)');
    else parts.push('(überfällig!)');
  }
  return parts.join(' · ') || '–';
}

function lastEntryForCat(cat) {
  return [...state.serviceHistory]
    .filter(e => e.category === cat)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function catIcon(cat) {
  const c = CATEGORIES[cat] || CATEGORIES['Anderes'];
  return `<i class="ph-light ${c.icon}" data-fb="${c.fb}" aria-hidden="true"></i>`;
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

  const grid = document.getElementById('upcomingGrid');
  if (grid) {
    grid.innerHTML = state.upcomingServices.map(svc => {
      const status = getServiceStatus(svc);
      const statusLabel = { none: 'Kein Termin', ok: 'OK', warn: 'Bald fällig', alert: 'Dringend' }[status];
      return `
        <div class="card stat-card status-${status}">
          <div class="stat-top">
            <span class="stat-ico">${catIcon(svc.category)}</span>
            <span class="status-badge badge-${status}">${statusLabel}</span>
          </div>
          <div>
            <div class="stat-num">${esc(svc.category).replace('flüssigkeit', '&shy;flüssigkeit')}</div>
            <div class="stat-lbl">${esc(dueText(svc))}</div>
          </div>
        </div>`;
    }).join('');
  }

  const lastList = document.getElementById('lastServicesList');
  if (lastList) {
    lastList.innerHTML = Object.keys(CATEGORIES).map(cat => {
      const last = lastEntryForCat(cat);
      if (!last) return `
        <div class="list-row">
          <div class="list-icon">${catIcon(cat)}</div>
          <div class="list-body">
            <div class="list-title">${esc(cat)}</div>
            <div class="list-sub">Noch kein Eintrag</div>
          </div>
        </div>`;
      return `
        <button type="button" class="list-row" onclick="switchTab('history')">
          <div class="list-icon">${catIcon(cat)}</div>
          <div class="list-body">
            <div class="list-title">${esc(cat)}</div>
            <div class="list-sub">${esc(last.description)}</div>
          </div>
          <div class="list-meta">
            <div>${formatDate(last.date)}</div>
            <div>${last.km.toLocaleString('de-DE')} km</div>
          </div>
        </button>`;
    }).join('');
  }
}

// KM-Stand bearbeiten
function openKmEdit() {
  const input = document.getElementById('edit-km-val');
  if (input) input.value = state.vehicle.currentKm;
  document.getElementById('modal-km-edit').showModal();
}

function saveKmEdit() {
  const val = parseInt(document.getElementById('edit-km-val').value, 10);
  if (isNaN(val) || val < 0) { showToast('Ungültiger KM-Stand', 'err'); return; }
  state.vehicle.currentKm = val;
  saveState();
  document.getElementById('modal-km-edit').close();
  showToast('KM-Stand aktualisiert', 'ok');
  renderDashboard();
}

// ─── History ──────────────────────────────────────────────────────────────────
function renderHistory() {
  const chipBar = document.getElementById('categoryFilterChips');
  if (chipBar) {
    const cats = ['Alle', ...Object.keys(CATEGORIES)];
    chipBar.innerHTML = cats.map(c => `
      <button type="button" class="chip${historyFilterCat === c ? ' active' : ''}"
              onclick="setHistoryCat('${esc(c)}')">${esc(c)}</button>`
    ).join('');
  }

  let items = [...state.serviceHistory].sort((a, b) => b.date.localeCompare(a.date));
  if (historyFilterCat !== 'Alle') items = items.filter(e => e.category === historyFilterCat);
  if (historySearchVal.trim()) {
    const q = historySearchVal.toLowerCase();
    items = items.filter(e =>
      e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    );
  }

  const listEl = document.getElementById('historyList');
  if (!listEl) return;

  if (!items.length) {
    listEl.classList.add('is-empty');
    listEl.innerHTML = `<div class="empty-state"><i class="ph-light ph-magnifying-glass" data-fb="🔍"></i><p>Keine Einträge gefunden</p></div>`;
    return;
  }
  listEl.classList.remove('is-empty');

  listEl.innerHTML = items.map(e => `
      <button type="button" class="list-row" onclick="openHistoryDetail('${esc(e.id)}')">
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

function setHistoryCat(cat) {
  historyFilterCat = cat;
  renderHistory();
}

function filterHistory() {
  historySearchVal = document.getElementById('historySearch').value;
  renderHistory();
}

function openHistoryDetail(id) {
  const e = state.serviceHistory.find(x => x.id === id);
  if (!e) return;
  const deleteIt = window.confirm(
    `${e.category} · ${formatDate(e.date)} · ${e.km.toLocaleString('de-DE')} km\n\n${e.description}\n\nEintrag löschen?`
  );
  if (deleteIt) {
    state.serviceHistory = state.serviceHistory.filter(x => x.id !== id);
    saveState();
    showToast('Eintrag gelöscht', 'warn');
    renderHistory();
  }
}

// ─── Add Entry ────────────────────────────────────────────────────────────────
function initAddForm() {
  const dateInput = document.getElementById('form-date');
  if (dateInput && !dateInput.value) dateInput.value = todayIso();
  const kmInput = document.getElementById('form-km');
  if (kmInput && !kmInput.value) kmInput.value = state.vehicle.currentKm || '';
}

function handleFormSubmit(event) {
  event.preventDefault();
  const category    = document.getElementById('form-category').value;
  const date        = document.getElementById('form-date').value;
  const km          = parseInt(document.getElementById('form-km').value, 10);
  const description = document.getElementById('form-description').value.trim();

  if (!date)               { showToast('Datum fehlt', 'err'); return; }
  if (isNaN(km) || km < 0) { showToast('Ungültiger KM-Stand', 'err'); return; }
  if (!description)        { showToast('Beschreibung fehlt', 'err'); return; }

  state.serviceHistory.push({ id: 'h' + Date.now(), date, km, category, description });
  if (km > state.vehicle.currentKm) state.vehicle.currentKm = km;
  saveState();
  showToast('Eintrag gespeichert ✓', 'ok');

  resetAddForm();
  switchTab('history');
}

function resetAddForm() {
  document.getElementById('addEntryForm').reset();
  document.getElementById('form-date').value = todayIso();
  document.getElementById('form-km').value = '';
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  renderVehicleInfo('settingsVehicleInfo', state.vehicle);

  buildColorGrid('settingsColorGrid', state.settings.vehicleColor, (key) => {
    state.settings.vehicleColor = key;
    saveState();
    applyTheme(key);
    renderSettings();
    showToast('Farbe geändert: ' + BMW_COLORS[key].label, 'ok');
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

// ─── Export / Import ──────────────────────────────────────────────────────────
function exportData() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: 'service-tracker-' + todayIso() + '.json',
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export erfolgreich', 'ok');
}

function importData(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported.serviceHistory || !imported.vehicle) throw new Error('Ungültiges Format');
      state = imported;
      state.settings = Object.assign({ vehicleColor: 'titansilber' }, state.settings, { onboardingDone: true });
      saveState();
      applyTheme(state.settings.vehicleColor);
      renderHeader();
      showToast('Import erfolgreich', 'ok');
      switchTab('dashboard');
    } catch (e) {
      showToast('Import fehlgeschlagen: ' + e.message, 'err');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function resetDataPrompt() {
  if (window.confirm('Alle App-Daten zurücksetzen? Dies kann nicht rückgängig gemacht werden.')) {
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(EMPTY_DATA));
    saveState();
    applyTheme(state.settings.vehicleColor);
    renderHeader();
    showToast('Daten zurückgesetzt', 'warn');
    showOnboarding();
  }
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

function decodeVinLocal(vin) {
  const out = { vin };
  out.make = WMI_MAKES[vin.slice(0, 3)] || WMI2_MAKES[vin.slice(0, 2)] || '';
  const region = VIN_REGIONS.find(([re]) => re.test(vin.slice(0, 2)));
  if (region) out.plant = region[1];
  // BMW/MINI: „kurze“ Fahrgestellnummer = letzte 7 Stellen
  if (/^(BMW|MINI)/.test(out.make)) out.chassis = vin.slice(-7);
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
    if (!online.make && !online.model) return { vehicle: local, source: 'unknown' };
    return { vehicle: Object.assign({}, local, online), source: 'online' };
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
    online:  'Diese Daten wurden über die VIN ermittelt. Ergänze, was fehlt.',
    unknown: 'Zu dieser VIN wurden online keine Modelldaten gefunden – Hersteller und Herkunft stammen direkt aus der VIN. Bitte Modell ergänzen.',
    offline: 'Die Online-Abfrage war nicht möglich (offline?). Hersteller und Herkunft stammen direkt aus der VIN – du kannst die VIN später unter „Fahrzeug & Design“ erneut abrufen.',
    manual:  'Trage die Daten deines Fahrzeugs ein.',
  };
  document.getElementById('onboardingDecodeNote').textContent = notes[source] || '';
  document.getElementById('onboardingVehicleTitle').textContent = vehicleTitle(decoded) || 'Dein Fahrzeug';
  const infoCard = document.getElementById('onboardingVehicleInfo');
  infoCard.hidden = source === 'manual';
  renderVehicleInfo('onboardingVehicleInfo', decoded);

  // Vorbelegen: dekodierte Werte, sonst vorhandene (bei gleicher VIN / ohne VIN)
  const keep = sameVin || !decoded.vin;
  document.getElementById('onboardingModel').value    = vehicleTitle(decoded) || (keep ? vehicleTitle(cur) : '');
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

  // Neue VIN → alte dekodierte Felder verwerfen; KM, EZ und Historie bleiben erhalten
  const base = {
    currentKm: state.vehicle.currentKm || 0,
    firstRegistration: state.vehicle.firstRegistration || '',
  };
  if (!decoded.vin) Object.assign(base, state.vehicle, { vin: '' });
  const vehicle = Object.assign(base, decoded);

  // Manuell geänderte Modellbezeichnung übernehmen
  if (modelInput && modelInput !== vehicleTitle(decoded)) {
    vehicle.model = modelInput;
    if (vehicle.make && !modelInput.toLowerCase().startsWith(vehicle.make.toLowerCase())) vehicle.make = '';
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
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  const saved = loadState();
  state = saved ? saved : JSON.parse(JSON.stringify(EMPTY_DATA));
  state.settings = Object.assign({ vehicleColor: 'titansilber', onboardingDone: false }, state.settings);
  if (!saved) saveState();

  let themeSaved = 'auto';
  try { themeSaved = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
  applyThemeMode(themeSaved);
  applyTheme(state.settings.vehicleColor);
  renderHeader();

  const verEl = document.getElementById('appVersion');
  if (verEl) verEl.textContent = 'Version ' + (self.APP_VERSION || '–');

  // Offline-Hinweis
  function updateOffline() { document.body.classList.toggle('offline', !navigator.onLine); }
  window.addEventListener('online',  updateOffline);
  window.addEventListener('offline', updateOffline);
  updateOffline();

  // Erster Start: zuerst VIN abfragen
  if (!state.settings.onboardingDone) {
    showOnboarding();
    return;
  }

  // Manifest-Shortcuts (?view=…) und Benachrichtigungen (?action=update)
  const params = new URLSearchParams(location.search);
  const view = params.get('view');
  switchTab(view === 'new' ? 'add-entry' : ({ history: 'history', settings: 'settings' }[view] || 'dashboard'));
  if (params.get('action') === 'update') setTimeout(() => window.checkForUpdate?.(), 1500);
  if (params.has('view') || params.has('action')) history.replaceState(null, '', location.pathname);
}

document.addEventListener('DOMContentLoaded', init);
