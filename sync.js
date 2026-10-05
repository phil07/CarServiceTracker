// Service-Tracker – Synchronisierung über Google Drive (Konto des Nutzers)
//
// Die Daten landen im versteckten App-Ordner („appDataFolder“) des eigenen Google Drive.
// Es gibt keinen Server des Entwicklers; die App sieht nur ihre eigene Datei (Scope drive.appdata).
// Das Google-Anmeldeskript wird erst beim Verbinden geladen, nicht beim normalen Start.
//
// Einrichtung: siehe docs/google-drive-sync.md – hier nur die OAuth-Client-ID eintragen.
const GOOGLE_CLIENT_ID = '';

(function () {
  'use strict';

  const SCOPE      = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE_NAME  = 'service-tracker-sync.json';
  const META_KEY   = 'cst_sync';      // { enabled, linked, fileId, lastSync }
  const TOKEN_KEY  = 'cst_sync_token'; // { token, exp } – 1 Stunde gültig
  const API        = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD     = 'https://www.googleapis.com/upload/drive/v3/files';

  const configured = () => !!GOOGLE_CLIENT_ID;

  // ─── lokaler Zustand ────────────────────────────────────────────────────────
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null') || {}; } catch (e) { return {}; } };
  const write = (key, obj) => { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {} };
  const getMeta = () => read(META_KEY);
  const setMeta = patch => write(META_KEY, Object.assign(getMeta(), patch));

  const syncEnabled = () => configured() && !!getMeta().enabled;

  function getToken() {
    const t = read(TOKEN_KEY);
    return t.token && t.exp > Date.now() ? t.token : null;
  }
  const setToken = (token, expiresIn) => write(TOKEN_KEY, { token, exp: Date.now() + (Number(expiresIn) || 3600) * 1000 - 60000 });
  const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} };

  // idle | syncing | ok | needs-auth | error
  let status = 'idle';
  let errorText = '';
  function setStatus(s, text) { status = s; errorText = text || ''; renderSyncUi(); }

  const authError = () => Object.assign(new Error('Anmeldung bei Google nötig'), { code: 'AUTH' });

  // ─── Google-Anmeldung (Token-Flow, ohne Server) ─────────────────────────────
  function loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Google-Anmeldung nicht erreichbar (offline?)'));
      document.head.appendChild(s);
    });
  }

  async function requestToken() {
    await loadGis();
    const res = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: r => (r && r.access_token ? resolve(r) : reject(new Error((r && r.error) || 'Anmeldung fehlgeschlagen'))),
        error_callback: e => reject(Object.assign(new Error('Anmeldung abgebrochen'), { code: e && e.type })),
      });
      client.requestAccessToken({ prompt: '' });
    });
    setToken(res.access_token, res.expires_in);
    return res.access_token;
  }

  // ─── Drive-Zugriff ──────────────────────────────────────────────────────────
  async function drive(url, opts = {}) {
    const token = getToken();
    if (!token) throw authError();
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.headers) }));
    if (r.status === 401) { clearToken(); throw authError(); }
    if (!r.ok) throw Object.assign(new Error('Google Drive: Fehler ' + r.status), { status: r.status });
    return r;
  }

  async function findFileId() {
    const q = encodeURIComponent("name='" + FILE_NAME + "'");
    const r = await drive(API + '?spaces=appDataFolder&q=' + q + '&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id)');
    const j = await r.json();
    return j.files && j.files[0] ? j.files[0].id : null;
  }

  async function downloadRemote(id) {
    const r = await drive(API + '/' + id + '?alt=media');
    return normalizeState(JSON.parse(await r.text()));
  }

  async function uploadRemote(id, payload) {
    const body = JSON.stringify(payload);
    if (id) {
      await drive(UPLOAD + '/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      return id;
    }
    const boundary = 'cst' + Date.now().toString(36);
    const multipart = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
      + JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
      + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + boundary + '--';
    const r = await drive(UPLOAD + '?uploadType=multipart&fields=id', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart,
    });
    return (await r.json()).id;
  }

  // ─── Fotos (je Bild eine Datei „photo-<id>.jpg“ im App-Ordner) ─────────────
  const PHOTO_PREFIX = 'photo-';
  const ORPHAN_MIN_AGE_MS = 3600000; // verwaiste Cloud-Fotos erst nach 1 Stunde löschen (Gerät könnte den Eintrag noch nicht hochgeladen haben)

  async function listPhotoFiles() {
    const out = new Map();
    let page = '';
    do {
      const q = encodeURIComponent("name contains '" + PHOTO_PREFIX + "'");
      const r = await drive(API + '?spaces=appDataFolder&q=' + q + '&pageSize=1000&fields=nextPageToken,files(id,name,createdTime)' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
      const j = await r.json();
      (j.files || []).forEach(f => {
        const m = /^photo-([\w-]+)\.jpg$/.exec(f.name || '');
        if (m) out.set(m[1], { fileId: f.id, created: Date.parse(f.createdTime) || 0 });
      });
      page = j.nextPageToken || '';
    } while (page);
    return out;
  }

  async function uploadPhoto(id, blob) {
    const boundary = 'cstp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
      + JSON.stringify({ name: PHOTO_PREFIX + id + '.jpg', parents: ['appDataFolder'], mimeType: 'image/jpeg' })
      + '\r\n--' + boundary + '\r\nContent-Type: image/jpeg\r\n\r\n';
    const body = new Blob([head, blob, '\r\n--' + boundary + '--']);
    await drive(UPLOAD + '?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
  }

  // Bilder abgleichen: fehlende hochladen, fehlende laden, verwaiste in der Cloud aufräumen
  async function syncPhotos(alive) {
    const want = referencedPhotoIds();
    const remote = await listPhotoFiles();
    let pulled = 0;
    for (const id of want) {
      alive();
      if (remote.has(id)) {
        if (!(await photoGet(id))) {
          const r = await drive(API + '/' + remote.get(id).fileId + '?alt=media');
          const b = await r.blob();
          if (b.size) { await photoPut(id, new Blob([b], { type: 'image/jpeg' })); pulled++; }
        }
      } else {
        const blob = await photoGet(id);
        if (blob) await uploadPhoto(id, blob);
      }
    }
    const now = Date.now();
    for (const [id, f] of remote) {
      alive();
      if (!want.has(id) && now - f.created > ORPHAN_MIN_AGE_MS) await drive(API + '/' + f.fileId, { method: 'DELETE' }).catch(() => {});
    }
    if (pulled) { hydratePhotos(document); renderHeroPhoto(); renderVehiclePhotos(); }
  }

  async function deleteAllCloudPhotos() {
    const remote = await listPhotoFiles();
    for (const f of remote.values()) await drive(API + '/' + f.fileId, { method: 'DELETE' }).catch(() => {});
  }

  // ─── Zusammenführen ─────────────────────────────────────────────────────────
  const ts = e => (e && e.updatedAt) || 0;

  function mergeList(a, b) {
    const m = new Map();
    a.forEach(e => m.set(e.id, e));
    b.forEach(e => { const cur = m.get(e.id); if (!cur || ts(e) > ts(cur)) m.set(e.id, e); });
    return [...m.values()];
  }

  // pro Eintrag gewinnt der neuere Stand; eine Löschmarke schlägt einen älteren Eintrag
  function mergeStates(local, remote) {
    const deleted = Object.assign({}, remote.deleted);
    Object.keys(local.deleted || {}).forEach(id => { deleted[id] = Math.max(deleted[id] || 0, local.deleted[id]); });
    const alive = e => !(deleted[e.id] && deleted[e.id] >= ts(e));
    const lm = local.meta || {}, rm = remote.meta || {};
    const emptyVehicle = v => !(v.vin || v.make || v.model || v.chassis);
    const pick = (la, ra, lEmpty, rEmpty) => la !== ra ? (la > ra ? 'l' : 'r') : lEmpty !== rEmpty ? (lEmpty ? 'r' : 'l') : 'l';
    const v = pick(lm.vehicleAt || 0, rm.vehicleAt || 0, emptyVehicle(local.vehicle), emptyVehicle(remote.vehicle));
    const s = pick(lm.settingsAt || 0, rm.settingsAt || 0, !local.settings.onboardingDone, !remote.settings.onboardingDone);
    return normalizeState({
      vehicle:        v === 'l' ? local.vehicle : remote.vehicle,
      settings:       s === 'l' ? local.settings : remote.settings,
      serviceHistory: mergeList(local.serviceHistory, remote.serviceHistory).filter(alive),
      fuelLog:        mergeList(local.fuelLog, remote.fuelLog).filter(alive),
      deleted,
      meta: { vehicleAt: Math.max(lm.vehicleAt || 0, rm.vehicleAt || 0), settingsAt: Math.max(lm.settingsAt || 0, rm.settingsAt || 0) },
    });
  }

  // kanonische Form (sortiert) zum Vergleichen und Hochladen
  function payloadOf(s) {
    const byId = (a, b) => String(a.id).localeCompare(String(b.id));
    return {
      vehicle: s.vehicle, settings: s.settings,
      serviceHistory: s.serviceHistory.slice().sort(byId), fuelLog: s.fuelLog.slice().sort(byId),
      deleted: s.deleted || {}, meta: s.meta || {},
    };
  }
  const same = (a, b) => canon(payloadOf(a)) === canon(payloadOf(b));

  // Fremde Daten übernehmen, ohne sie als eigene Änderung zu stempeln
  function adoptState(next) {
    state = next;
    buildSnap();
    persistRaw();
    applyTheme(state.settings.vehicleColor);
    renderHeader();
    if (document.querySelector('dialog[open]')) return; // nicht mitten in der Eingabe umschalten
    if (!state.settings.onboardingDone) return;
    const onb = document.getElementById('view-onboarding');
    switchTab(onb && onb.classList.contains('active') ? 'dashboard' : activeTab);
  }

  // ─── Ablauf ─────────────────────────────────────────────────────────────────
  let syncing = false, queued = false, timer = null, paused = false;
  let epoch = 0; // wird bei Trennen/Löschen erhöht: laufende Abgleiche brechen dann ab

  async function runSync(alive) {
    const meta = getMeta();
    let id = meta.fileId || await findFileId();
    let remote = null;
    if (id) {
      try { remote = await downloadRemote(id); }
      catch (e) {
        if (e.status !== 404) throw e;
        id = await findFileId();
        remote = id ? await downloadRemote(id) : null;
      }
    }

    let merged = state;
    if (remote) {
      // Erste Verbindung dieses Geräts: nie stillschweigend zwei verschiedene Fahrzeuge vermischen
      const localEmpty = !state.settings.onboardingDone && !entryCount();
      const lv = state.vehicle.vin, rv = remote.vehicle.vin;
      if (!meta.linked && !localEmpty && lv && rv && lv !== rv) {
        const ok = await confirmDialog({
          title: 'Anderes Fahrzeug in Google Drive',
          text: 'In Drive liegen Daten für „' + (vehicleTitle(remote.vehicle) || rv) + '“ (' + (remote.serviceHistory.length + remote.fuelLog.length)
            + ' Einträge). Auf diesem Gerät: „' + (vehicleTitle(state.vehicle) || lv) + '“. Drive-Daten übernehmen? Die lokalen Daten werden dabei ersetzt – sichere sie vorher per Backup.',
          ok: 'Drive übernehmen', danger: true,
        });
        if (!ok) throw Object.assign(new Error('Abgebrochen'), { code: 'CANCEL' });
        merged = remote;
      } else {
        merged = mergeStates(state, remote);
      }
    }

    alive();
    if (!same(merged, state)) adoptState(merged);
    if (!remote || !same(merged, remote)) id = await uploadRemote(id, payloadOf(merged));
    alive();
    setMeta({ fileId: id, linked: true, lastSync: new Date().toISOString() });
    await syncPhotos(alive);
  }

  async function syncNow(opts = {}) {
    if (!syncEnabled() || paused) return;
    if (syncing) { queued = true; return; }
    syncing = true;
    const myEpoch = epoch;
    const alive = () => { if (myEpoch !== epoch) throw Object.assign(new Error('Beendet'), { code: 'STOPPED' }); };
    setStatus('syncing');
    try {
      if (!getToken()) {
        if (!opts.interactive) { setStatus('needs-auth'); return; }
        await requestToken();
      }
      await runSync(alive);
      alive();
      setStatus('ok');
    } catch (e) {
      if (e.code === 'STOPPED') { /* getrennt/gelöscht – nichts mehr anzeigen */ }
      else if (e.code === 'CANCEL') { disableSync(); }
      else if (e.code === 'AUTH' || e.code === 'popup_failed_to_open' || e.code === 'popup_closed') setStatus('needs-auth');
      else setStatus('error', e.message || 'Unbekannter Fehler');
      if (opts.interactive && e.code !== 'CANCEL') showToast('Synchronisierung: ' + (e.message || 'Fehler'), 'err');
    } finally {
      syncing = false;
      if (queued) { queued = false; scheduleSync(500); }
    }
  }

  // nach Änderungen: kurz warten, dann abgleichen (nur wenn aktiv)
  function scheduleSync(delay) {
    if (!syncEnabled()) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(), delay == null ? 4000 : delay);
    if (!getToken()) setStatus('needs-auth');
  }

  // ─── Verbinden / Trennen ────────────────────────────────────────────────────
  async function connectDrive() {
    if (!configured()) return;
    setMeta({ enabled: true });
    await syncNow({ interactive: true });
    if (status === 'ok') showToast('Mit Google Drive verbunden', 'ok');
    else if (status !== 'error' && !syncEnabled()) renderSyncUi();
  }

  function disableSync() {
    epoch++;
    setMeta({ enabled: false, linked: false, fileId: null });
    clearTimeout(timer);
    setStatus('idle');
  }

  async function disconnectDrive() {
    const token = getToken();
    disableSync();
    try { if (token && window.google && google.accounts) google.accounts.oauth2.revoke(token, () => {}); } catch (e) {}
    clearToken();
    renderSyncUi();
    showToast('Getrennt – die Datei in Google Drive bleibt bestehen', 'ok');
  }

  async function deleteDriveData() {
    const ok = await confirmDialog({
      title: 'Cloud-Daten löschen?',
      text: 'Die Sicherungsdatei wird aus deinem Google Drive gelöscht und die Synchronisierung beendet. Die Daten auf diesem Gerät bleiben erhalten.',
      ok: 'Löschen', danger: true,
    });
    if (!ok) return;
    paused = true; epoch++; clearTimeout(timer); queued = false;
    try {
      for (let i = 0; syncing && i < 100; i++) await new Promise(r => setTimeout(r, 100)); // laufenden Abgleich auslaufen lassen
      if (!getToken()) await requestToken();
      const id = getMeta().fileId || await findFileId();
      if (id) await drive(API + '/' + id, { method: 'DELETE' });
      await deleteAllCloudPhotos();
      await disconnectDrive();
      showToast('Cloud-Daten gelöscht', 'ok');
    } catch (e) {
      showToast('Löschen fehlgeschlagen: ' + (e.message || 'Fehler'), 'err');
    } finally { paused = false; }
  }

  // ─── Oberfläche ─────────────────────────────────────────────────────────────
  function lastSyncText() {
    const m = getMeta();
    if (!m.lastSync) return '';
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(m.lastSync)) / 60000));
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return 'vor ' + mins + ' Min.';
    const h = Math.round(mins / 60);
    return h < 24 ? 'vor ' + h + ' Std.' : 'vor ' + Math.round(h / 24) + ' Tagen';
  }

  function renderSyncUi() {
    const card = document.getElementById('syncCard');
    const on = syncEnabled();
    if (card) card.hidden = !configured();
    const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
    set('syncConnect',    el => { el.hidden = on; });
    set('syncActions',    el => { el.hidden = !on; });
    set('onbDriveBtn',    el => { el.hidden = !configured() || on; });

    let text = 'Nicht verbunden';
    if (on) {
      text = status === 'syncing' ? 'Synchronisiere …'
        : status === 'needs-auth' ? 'Verbunden – zum Abgleichen kurz bei Google bestätigen'
        : status === 'error' ? 'Fehler: ' + errorText
        : 'Verbunden' + (lastSyncText() ? ' · zuletzt ' + lastSyncText() : '');
    }
    set('syncStatusText', el => { el.textContent = text; el.classList.toggle('is-due', on && (status === 'needs-auth' || status === 'error')); });

    const hint = document.getElementById('syncHint');
    if (hint) hint.hidden = !(on && status === 'needs-auth');
    const busy = status === 'syncing';
    document.querySelectorAll('[data-sync-btn]').forEach(b => { b.disabled = busy; });
  }

  // ─── Start ──────────────────────────────────────────────────────────────────
  function initSync() {
    renderSyncUi();
    if (!syncEnabled()) return;
    if (getToken()) syncNow(); else setStatus('needs-auth');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !syncEnabled() || !getToken()) return;
      const last = Date.parse(getMeta().lastSync || 0) || 0;
      if (Date.now() - last > 60000) syncNow();
    });
    window.addEventListener('online', () => { if (getToken()) syncNow(); });
  }

  Object.assign(window, { initSync, scheduleSync, syncNow, syncEnabled, connectDrive, disconnectDrive, deleteDriveData, renderSyncUi,
    syncNowInteractive: () => syncNow({ interactive: true }) });
})();
