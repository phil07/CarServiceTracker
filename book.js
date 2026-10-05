// Service-Tracker – Digitales Scheckheft
//
// Veröffentlicht eine Momentaufnahme des gewählten Fahrzeugs (Wartungen, Fahrzeugdaten, Fotos – ohne Kosten,
// Notizen und Tankbuch) über den Worker dieser App (/api/book/…). Die Adresse /s/<id> ist für jeden mit dem
// Link abrufbar (auch Fremde, ohne Anmeldung) und zeigt immer den zuletzt veröffentlichten Stand.
// Der geheime Schlüssel bleibt in den Fahrzeug-Einstellungen (Backup/Drive-Sync) und berechtigt zum Ändern.
(function () {
  'use strict';

  const STATE_KEY = 'cst_book'; // { [id]: { hash, up: [Foto-ids auf dem Server], at } }
  const API = '/api/book/';
  const MAX_VEHICLE_PHOTOS = 12;
  const MAX_PHOTO_BYTES = 1536 * 1024;

  const read = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || {}; } catch (e) { return {}; } };
  const bookState = id => Object.assign({ hash: '', up: [], at: 0 }, read()[id]);
  const saveBookState = (id, st) => { try { const all = read(); all[id] = st; localStorage.setItem(STATE_KEY, JSON.stringify(all)); } catch (e) {} };
  const dropBookState = id => { try { const all = read(); delete all[id]; localStorage.setItem(STATE_KEY, JSON.stringify(all)); } catch (e) {} };

  const rand = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); };
  const urlOf = id => location.origin + '/s/' + id;
  const sharing = rec => rec.settings.share && rec.settings.share.on ? rec.settings.share : null;

  let status = {}; // id → '' | 'busy' | 'error:<Text>'

  // ─── Momentaufnahme ─────────────────────────────────────────────────────────
  function snapshotOf(rec, up) {
    const sh = rec.settings.share;
    const v = rec.vehicle;
    const ok = id => up.has(id);
    const col = BMW_COLORS[rec.settings.vehicleColor] || {};
    const entries = rec.serviceHistory.map(e => {
      const o = { date: e.date, km: e.km, category: e.category, categoryLabel: (CATEGORIES[e.category] || {}).label || e.category, description: e.description };
      if (e.shop) o.shop = e.shop;
      const ph = (e.photos || []).filter(ok); if (ph.length) o.photos = ph;
      return o;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
    return {
      v: 1,
      accent: { light: col.light, dark: col.dark },
      vehicle: {
        title: vehicleTitle(v), chassis: v.chassis || '', firstRegistration: v.firstRegistration || '', currentKm: v.currentKm || 0,
        vin: sh && sh.showVin ? v.vin || '' : '',
      },
      vehiclePhotos: (rec.settings.vehiclePhotos || []).slice(0, MAX_VEHICLE_PHOTOS).filter(ok),
      entries,
    };
  }

  function wantedPhotoIds(rec) {
    const ids = (rec.settings.vehiclePhotos || []).slice(0, MAX_VEHICLE_PHOTOS).slice();
    rec.serviceHistory.forEach(e => (e.photos || []).forEach(id => ids.push(id)));
    return [...new Set(ids)];
  }

  // ─── Server ─────────────────────────────────────────────────────────────────
  async function call(path, method, secret, body, type) {
    const r = await fetch(API + path, {
      method, body, cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + secret }, type ? { 'Content-Type': type } : {}),
    });
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).error || ''; } catch (e) {}
      const err = new Error(r.status === 404 && !msg ? 'Server für das Scheckheft ist nicht eingerichtet' : msg || 'Fehler ' + r.status);
      err.status = r.status;
      throw err;
    }
    return r;
  }

  let running = false, again = false, timer = null;

  async function publishRecord(rec, force) {
    const sh = sharing(rec);
    if (!sh) return;
    const st = bookState(sh.id);
    const want = wantedPhotoIds(rec);
    const up = new Set(st.up);
    for (const pid of want) {
      if (up.has(pid)) continue;
      const blob = await photoGet(pid);
      if (!blob || blob.size > MAX_PHOTO_BYTES) continue;
      await call(sh.id + '/photo/' + pid, 'PUT', sh.secret, blob, 'image/jpeg');
      up.add(pid);
    }
    const stale = [...up].some(pid => !want.includes(pid));
    [...up].forEach(pid => { if (!want.includes(pid)) up.delete(pid); });
    const snap = snapshotOf(rec, up);
    const hash = canon(snap);
    if (!force && !stale && hash === st.hash) return;
    snap.updated = Date.now();
    await call(sh.id + (stale ? '?prune=1' : ''), 'PUT', sh.secret, JSON.stringify(snap), 'application/json');
    saveBookState(sh.id, { hash, up: [...up], at: snap.updated });
  }

  async function publishAll(force) {
    if (running) { again = true; return; }
    running = true;
    try {
      for (const rec of store.vehicles) {
        const sh = sharing(rec);
        if (!sh) continue;
        status[sh.id] = 'busy'; renderBookCard();
        try { await publishRecord(rec, force); status[sh.id] = ''; }
        catch (e) { status[sh.id] = 'error:' + (e.message || 'Fehler'); }
      }
    } finally {
      running = false;
      renderBookCard();
      if (again) { again = false; scheduleBookPublish(500); }
    }
  }

  function scheduleBookPublish(delay) {
    if (!store.vehicles.some(sharing)) return;
    clearTimeout(timer);
    timer = setTimeout(() => publishAll(false), delay == null ? 6000 : delay);
  }

  // ─── Aktionen ───────────────────────────────────────────────────────────────
  async function enableBook() {
    const ok = await confirmDialog({
      title: 'Scheckheft veröffentlichen?',
      text: 'Jeder, der den QR-Code oder Link kennt – auch Fremde – kann die Wartungshistorie dieses Fahrzeugs samt Fotos der Wartungen und Fahrzeugfotos sehen. Kosten, Notizen und das Tankbuch bleiben privat, die FIN ist standardmäßig verborgen. Die Daten liegen auf dem Server dieser App (Cloudflare). Du kannst die Veröffentlichung jederzeit beenden.',
      ok: 'Veröffentlichen',
    });
    if (!ok) return;
    const share = state.settings.share || {};
    state.settings.share = { id: share.id || rand(24), secret: share.secret || rand(40), on: true, showVin: !!share.showVin };
    saveState();
    const id = state.settings.share.id;
    status[id] = 'busy'; renderBookCard();
    try {
      await publishRecord(state, true);
      status[id] = '';
      renderBookCard();
      openBookDialog();
    } catch (e) {
      state.settings.share.on = false;
      saveState();
      status[id] = '';
      renderBookCard();
      showToast('Veröffentlichen fehlgeschlagen: ' + (e.message || 'Fehler'), 'err');
    }
  }

  async function disableBook() {
    const sh = state.settings.share;
    if (!sh) return;
    const ok = await confirmDialog({
      title: 'Veröffentlichung beenden?',
      text: 'Das Scheckheft wird vom Server gelöscht. Der bisherige QR-Code und Link funktionieren dann nicht mehr; bereits gedruckte Codes sind unbrauchbar. Deine Daten in der App bleiben unverändert.',
      ok: 'Beenden', danger: true,
    });
    if (!ok) return;
    try {
      await call(sh.id, 'DELETE', sh.secret);
    } catch (e) {
      if (e.status !== 404) { showToast('Löschen fehlgeschlagen: ' + (e.message || 'Fehler'), 'err'); return; }
    }
    dropBookState(sh.id);
    delete status[sh.id];
    delete state.settings.share;
    saveState();
    document.getElementById('modal-book')?.close();
    renderBookCard();
    showToast('Scheckheft nicht mehr veröffentlicht', 'ok');
  }

  function setBookVin(on) {
    if (!state.settings.share) return;
    state.settings.share.showVin = !!on;
    saveState();
    scheduleBookPublish(300);
  }

  function publishBookNow() { publishAll(true); }

  // ─── QR-Code ────────────────────────────────────────────────────────────────
  function loadQr() {
    return new Promise((resolve, reject) => {
      if (window.qrcode) return resolve();
      const s = document.createElement('script');
      s.src = 'assets/qrcode.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('QR-Code-Bibliothek nicht geladen (offline?)'));
      document.head.appendChild(s);
    });
  }

  function qrModules(text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    return { n, dark: (r, c) => q.isDark(r, c) };
  }

  function qrSvg(text) {
    const { n, dark } = qrModules(text);
    const quiet = 4;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    const size = n + quiet * 2;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR-Code zum Scheckheft" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  function qrPngBlob(text) {
    const { n, dark } = qrModules(text);
    const quiet = 4, scale = Math.max(4, Math.floor(1024 / (n + quiet * 2)));
    const size = (n + quiet * 2) * scale;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }

  async function openBookDialog() {
    const sh = sharing(state);
    if (!sh) return;
    const url = urlOf(sh.id);
    const dlg = document.getElementById('modal-book');
    document.getElementById('bookDialogTitle').textContent = vehicleTitle(state.vehicle) || 'Digitales Scheckheft';
    document.getElementById('bookUrl').textContent = url;
    const box = document.getElementById('bookQr');
    box.innerHTML = '';
    try { await loadQr(); box.innerHTML = qrSvg(url); }
    catch (e) { box.textContent = e.message; }
    if (!dlg.open) dlg.showModal();
  }

  async function shareBookLink() {
    const sh = sharing(state); if (!sh) return;
    const url = urlOf(sh.id);
    try {
      if (navigator.share) { await navigator.share({ title: 'Digitales Scheckheft', url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); showToast('Link kopiert', 'ok'); }
    catch (e) { showToast('Kopieren nicht möglich – Link markieren und kopieren', 'warn'); }
  }

  async function saveBookQr() {
    const sh = sharing(state); if (!sh) return;
    try {
      await loadQr();
      const blob = await qrPngBlob(urlOf(sh.id));
      const name = 'scheckheft-qr-' + (vehicleTitle(state.vehicle) || 'fahrzeug').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Scheckheft QR-Code' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      downloadBackup(file);
    } catch (e) { showToast('QR-Code konnte nicht gespeichert werden', 'err'); }
  }

  // ─── Oberfläche ─────────────────────────────────────────────────────────────
  function renderBookCard() {
    const off = document.getElementById('bookOff');
    if (!off) return;
    const sh = sharing(state);
    off.hidden = !!sh;
    document.getElementById('bookOn').hidden = !sh;
    if (!sh) return;
    const st = bookState(sh.id), s = status[sh.id] || '';
    const el = document.getElementById('bookStatusText');
    el.textContent = s === 'busy' ? 'Wird veröffentlicht …'
      : s.startsWith('error:') ? 'Fehler: ' + s.slice(6) + ' – wird beim nächsten Speichern erneut versucht'
      : 'Veröffentlicht' + (st.at ? ' · Stand ' + new Date(st.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '');
    el.classList.toggle('is-due', s.startsWith('error:'));
    document.getElementById('bookShowVin').checked = !!sh.showVin;
  }

  function initBook() {
    renderBookCard();
    window.addEventListener('online', () => scheduleBookPublish(500));
    if (store.vehicles.some(sharing)) scheduleBookPublish(2500);
  }

  Object.assign(window, { initBook, scheduleBookPublish, renderBookCard, enableBook, disableBook, setBookVin, publishBookNow, openBookDialog, shareBookLink, saveBookQr });
})();
