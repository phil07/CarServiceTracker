// BMW E39 530iA Service Tracker – app.js
'use strict';

// ─── Fahrzeugfarben / Theme-Palette ──────────────────────────────────────────
const BMW_COLORS = {
  titansilber:  { label: 'Titansilber',  hex: '#6b7280', accent: '#ff9100',   dim: 'rgba(255,145,0,0.15)',    glow: 'rgba(255,145,0,0.08)' },
  orientblau:   { label: 'Orientblau',   hex: '#1e40af', accent: '#3b82f6',   dim: 'rgba(59,130,246,0.15)',   glow: 'rgba(59,130,246,0.08)' },
  calypsorot:   { label: 'Calypsorot',   hex: '#991b1b', accent: '#ef4444',   dim: 'rgba(239,68,68,0.15)',    glow: 'rgba(239,68,68,0.08)' },
  dakargelb:    { label: 'Dakargelb',    hex: '#92400e', accent: '#fbbf24',   dim: 'rgba(251,191,36,0.15)',   glow: 'rgba(251,191,36,0.08)' },
  bostongruen:  { label: 'Bostongrün',   hex: '#14532d', accent: '#22c55e',   dim: 'rgba(34,197,94,0.15)',    glow: 'rgba(34,197,94,0.08)' },
  imperialblau: { label: 'Imperialblau', hex: '#1e3a8a', accent: '#1d4ed8',   dim: 'rgba(29,78,216,0.15)',    glow: 'rgba(29,78,216,0.08)' },
  schwarz:      { label: 'Schwarz',      hex: '#27272a', accent: '#a1a1aa',   dim: 'rgba(161,161,170,0.15)',  glow: 'rgba(161,161,170,0.08)' },
  alpinweiss:   { label: 'Alpinweiß',    hex: '#94a3b8', accent: '#cbd5e1',   dim: 'rgba(203,213,225,0.12)',  glow: 'rgba(203,213,225,0.06)' },
  hellsilber:   { label: 'Hellsilber',   hex: '#475569', accent: '#94a3b8',   dim: 'rgba(148,163,184,0.15)',  glow: 'rgba(148,163,184,0.08)' },
  mojavesand:   { label: 'Mojavesand',   hex: '#78350f', accent: '#d97706',   dim: 'rgba(217,119,6,0.15)',    glow: 'rgba(217,119,6,0.08)' },
};

// ─── Kategorien ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  'Öl':               { icon: 'ph-drop',         label: 'Öl' },
  'Bremsflüssigkeit': { icon: 'ph-disc',          label: 'Bremsflüssigkeit' },
  'Kühlmittel':       { icon: 'ph-thermometer',   label: 'Kühlmittel' },
  'Zündkerzen':       { icon: 'ph-lightning',     label: 'Zündkerzen' },
  'Anderes':          { icon: 'ph-wrench',         label: 'Anderes' },
};

// ─── Leere Startdaten (App startet ohne Vorausfüllung) ───────────────────────
const EMPTY_DATA = {
  vehicle: {
    model: 'BMW E39 530iA',
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
const STORAGE_KEY = 'bmw_e39_data';
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

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(colorKey) {
  const c = BMW_COLORS[colorKey] || BMW_COLORS.titansilber;
  const r = document.documentElement.style;
  r.setProperty('--accent',      c.accent);
  r.setProperty('--accent-dim',  c.dim);
  r.setProperty('--accent-glow', c.glow);
  const meta = document.getElementById('metaThemeColor');
  if (meta) meta.content = c.accent;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.className = type ? 'visible ' + type : 'visible';
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;

  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + tab);
  if (view) view.classList.add('active');

  const btn = document.getElementById('nav-' + tab);
  if (btn) btn.classList.add('active');

  // Update page title
  const titles = {
    'dashboard': 'Dashboard',
    'history': 'Service-Historie',
    'add-entry': 'Neuer Eintrag',
    'settings': 'Einstellungen',
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[tab] || '';

  // Render
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'history')   renderHistory();
  if (tab === 'add-entry') initAddForm();
  if (tab === 'settings')  renderSettings();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function getServiceStatus(svc) {
  const km = state.vehicle.currentKm;
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
  if (svc.dueDate) {
    const d = new Date(svc.dueDate);
    parts.push(d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
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

function renderDashboard() {
  // KM-Stand
  const kmEl = document.getElementById('dashboardKm');
  if (kmEl) kmEl.textContent = state.vehicle.currentKm.toLocaleString('de-DE');

  // Upcoming services
  const grid = document.getElementById('upcomingGrid');
  if (grid) {
    grid.innerHTML = state.upcomingServices.map(svc => {
      const cat = CATEGORIES[svc.category] || CATEGORIES['Anderes'];
      const status = getServiceStatus(svc);
      const statusLabel = { ok: 'OK', warn: 'Bald fällig', alert: 'Dringend' }[status];
      return `
        <div class="upcoming-card status-${status}">
          <div class="upcoming-card-header">
            <div class="upcoming-icon status-icon-${status}">
              <i class="ph-light ${cat.icon}"></i>
            </div>
            <div class="upcoming-status-badge badge-${status}">${statusLabel}</div>
          </div>
          <div class="upcoming-cat-name">${esc(svc.category)}</div>
          <div class="upcoming-due">${esc(dueText(svc))}</div>
        </div>`;
    }).join('');
  }

  // Last services per category
  const lastList = document.getElementById('lastServicesList');
  if (lastList) {
    lastList.innerHTML = Object.keys(CATEGORIES).map(cat => {
      const last = lastEntryForCat(cat);
      const catDef = CATEGORIES[cat];
      if (!last) return `
        <div class="last-service-row">
          <div class="last-service-icon"><i class="ph-light ${catDef.icon}"></i></div>
          <div class="last-service-info">
            <div class="last-service-name">${esc(cat)}</div>
            <div class="last-service-detail text-dim">Noch kein Eintrag</div>
          </div>
        </div>`;
      return `
        <div class="last-service-row" onclick="switchTab('history')" style="cursor:pointer">
          <div class="last-service-icon"><i class="ph-light ${catDef.icon}"></i></div>
          <div class="last-service-info">
            <div class="last-service-name">${esc(cat)}</div>
            <div class="last-service-detail">${esc(last.description)}</div>
          </div>
          <div class="last-service-meta">
            <div class="last-service-date">${new Date(last.date).toLocaleDateString('de-DE')}</div>
            <div class="last-service-km">${last.km.toLocaleString('de-DE')} km</div>
          </div>
        </div>`;
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
  // Filter chips
  const chipBar = document.getElementById('categoryFilterChips');
  if (chipBar) {
    const cats = ['Alle', ...Object.keys(CATEGORIES)];
    chipBar.innerHTML = cats.map(c => `
      <button class="chip${historyFilterCat === c ? ' active' : ''}"
              onclick="setHistoryCat('${esc(c)}')">${esc(c)}</button>`
    ).join('');
  }

  // Filter + search
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
    listEl.innerHTML = `<div class="empty-state"><i class="ph-light ph-magnifying-glass"></i><p>Keine Einträge gefunden</p></div>`;
    return;
  }

  listEl.innerHTML = items.map(e => {
    const cat = CATEGORIES[e.category] || CATEGORIES['Anderes'];
    return `
      <div class="history-row" data-id="${esc(e.id)}" onclick="openHistoryDetail('${esc(e.id)}')" tabindex="0"
           onkeydown="if(event.key==='Enter')openHistoryDetail('${esc(e.id)}')">
        <div class="history-row-icon"><i class="ph-light ${cat.icon}"></i></div>
        <div class="history-row-body">
          <div class="history-row-title">${esc(e.category)}</div>
          <div class="history-row-desc">${esc(e.description)}</div>
        </div>
        <div class="history-row-meta">
          <div class="history-row-date">${new Date(e.date).toLocaleDateString('de-DE')}</div>
          <div class="history-row-km">${e.km.toLocaleString('de-DE')} km</div>
        </div>
      </div>`;
  }).join('');
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

  // Simple confirm-delete dialog via custom dialog
  const dlg = document.getElementById('modal-km-edit');

  // Reuse the km-edit dialog for details – no, build a proper confirm.
  // ponytail: use window.confirm for delete; no extra dialog needed.
  const deleteIt = window.confirm(
    `${e.category} · ${new Date(e.date).toLocaleDateString('de-DE')} · ${e.km.toLocaleString('de-DE')} km\n\n${e.description}\n\nEintrag löschen?`
  );
  if (deleteIt) {
    state.serviceHistory = state.serviceHistory.filter(x => x.id !== id);
    saveState();
    showToast('Eintrag gelöscht', 'warn');
    renderHistory();
    if (activeTab === 'dashboard') renderDashboard();
  }
}

// ─── Add Entry ────────────────────────────────────────────────────────────────
function initAddForm() {
  const dateInput = document.getElementById('form-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  const kmInput = document.getElementById('form-km');
  if (kmInput && !kmInput.value) {
    kmInput.value = state.vehicle.currentKm;
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  const category    = document.getElementById('form-category').value;
  const date        = document.getElementById('form-date').value;
  const km          = parseInt(document.getElementById('form-km').value, 10);
  const description = document.getElementById('form-description').value.trim();

  if (!date)              { showToast('Datum fehlt', 'err'); return; }
  if (isNaN(km) || km < 0){ showToast('Ungültiger KM-Stand', 'err'); return; }
  if (!description)       { showToast('Beschreibung fehlt', 'err'); return; }

  const entry = { id: 'h' + Date.now(), date, km, category, description };
  state.serviceHistory.push(entry);

  if (km > state.vehicle.currentKm) {
    state.vehicle.currentKm = km;
  }
  saveState();
  showToast('Eintrag gespeichert ✓', 'ok');

  // Reset form
  resetAddForm();
  // Go to history
  switchTab('history');
}

function resetAddForm() {
  document.getElementById('addEntryForm').reset();
  document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('form-km').value = '';
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  buildColorGrid('settingsColorGrid', state.settings.vehicleColor, (key) => {
    state.settings.vehicleColor = key;
    saveState();
    applyTheme(key);
    renderSettings();
    showToast('Farbe geändert: ' + BMW_COLORS[key].label, 'ok');
  });

  const verEl = document.getElementById('appVersion');
  if (verEl) verEl.textContent = self.APP_VERSION || '1';
}

function buildColorGrid(containerId, selectedKey, onSelect) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = Object.entries(BMW_COLORS).map(([key, c]) => `
    <button class="color-swatch-btn${selectedKey === key ? ' active' : ''}"
            style="--swatch-color:${c.hex};"
            title="${c.label}"
            aria-label="${c.label}${selectedKey === key ? ' (aktiv)' : ''}"
            aria-pressed="${selectedKey === key}"
            onclick="(${onSelect.toString()})('${key}')">
      <span class="swatch-dot"></span>
      <span class="swatch-label">${c.label}</span>
    </button>`
  ).join('');
}

// ─── Export / Import ──────────────────────────────────────────────────────────
function exportData() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: 'bmw-e39-service-' + new Date().toISOString().split('T')[0] + '.json',
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export erfolgreich', 'ok');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported.serviceHistory || !imported.vehicle) throw new Error('Ungültiges Format');
      state = imported;
      saveState();
      applyTheme(state.settings?.vehicleColor || 'titansilber');
      showToast('Import erfolgreich', 'ok');
      switchTab('dashboard');
    } catch (e) {
      showToast('Import fehlgeschlagen: ' + e.message, 'err');
    }
  };
  reader.readAsText(file);
  file.value = '';
}

function resetDataPrompt() {
  if (window.confirm('Alle App-Daten zurücksetzen? Dies kann nicht rückgängig gemacht werden.')) {
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(EMPTY_DATA));
    state.settings.onboardingDone = true; // Skip onboarding on reset
    saveState();
    applyTheme(state.settings.vehicleColor);
    showToast('Daten zurückgesetzt', 'warn');
    switchTab('dashboard');
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
let pendingOnboardingColor = 'titansilber';

function showOnboarding() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-onboarding').classList.add('active');
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('pageTitle').textContent = 'Willkommen';

  buildColorGrid('onboardingColorGrid', pendingOnboardingColor, (key) => {
    pendingOnboardingColor = key;
    applyTheme(key);
    buildColorGrid('onboardingColorGrid', key, arguments.callee);
  });
}

function startAppWithColor() {
  state.settings.vehicleColor = pendingOnboardingColor;
  state.settings.onboardingDone = true;
  saveState();
  applyTheme(pendingOnboardingColor);
  document.getElementById('bottomNav').style.display = '';
  switchTab('dashboard');
}

// ─── Helper ───────────────────────────────────────────────────────────────────
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
  if (!saved) saveState();

  applyTheme(state.settings?.vehicleColor || 'titansilber');

  // Offline indicator
  function updateOffline() {
    const bar = document.getElementById('offline-bar');
    if (bar) bar.classList.toggle('visible', !navigator.onLine);
  }
  window.addEventListener('online',  updateOffline);
  window.addEventListener('offline', updateOffline);
  updateOffline();

  // Install banner
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('visible');
  });
  const btnInstall = document.getElementById('btn-install');
  if (btnInstall) btnInstall.addEventListener('click', () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then(() => {
      deferredInstall = null;
      document.getElementById('install-banner').classList.remove('visible');
    });
  });
  const btnDismiss = document.getElementById('btn-dismiss');
  if (btnDismiss) btnDismiss.addEventListener('click', () => {
    document.getElementById('install-banner').classList.remove('visible');
  });

  // First run: show onboarding
  if (!state.settings?.onboardingDone) {
    showOnboarding();
  } else {
    switchTab('dashboard');
  }
}

document.addEventListener('DOMContentLoaded', init);
