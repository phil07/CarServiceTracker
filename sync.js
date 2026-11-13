// Service-Tracker – Synchronisierung über Google Drive (Konto des Nutzers)
//
// Die Daten landen im versteckten App-Ordner („appDataFolder“) des eigenen Google Drive.
// Es gibt keinen Server des Entwicklers; die App sieht nur ihre eigene Datei (Scope drive.appdata).
// Für den dauerhaften Abgleich im Hintergrund holt der Worker (/api/gauth/, siehe worker.js) neue Zugriffstokens;
// das Refresh-Token liegt nur verschlüsselt als httpOnly-Cookie im Browser des Nutzers.
// Das Google-Anmeldeskript wird erst beim Verbinden geladen, nicht beim normalen Start.
//
// Einrichtung: siehe docs/google-drive-sync.md – hier nur die OAuth-Client-ID eintragen.
const GOOGLE_CLIENT_ID = '456570124356-ksovdvup3n1o9hhq6hnm3tfms1r1a0hs.apps.googleusercontent.com';

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

  // ─── dauerhafte Anmeldung über den Worker (/api/gauth/) ──────────────────────
  // Das Refresh-Token liegt verschlüsselt als httpOnly-Cookie im Browser; der Worker holt damit still
  // neue Zugriffstokens. Ist der Worker nicht eingerichtet, gilt wie bisher ein 1-Stunden-Token.
  const AUTH_API = (self.API_BASE || '') + '/api/gauth/';
  let serverAuth = null; // null = unbekannt, false = Worker nicht eingerichtet
  let refreshing = null;
  const authPost = (action, body) => fetch(AUTH_API + action, {
    method: 'POST', credentials: 'same-origin',
    headers: Object.assign({ 'X-CST': '1' }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });

  function refreshToken() {
    if (serverAuth === false || !navigator.onLine || isNativeApp()) return Promise.resolve(null);
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const r = await authPost('refresh');
          if (r.status === 503 || r.status === 404 || r.status === 405) { serverAuth = false; return null; }
          serverAuth = true;
          if (!r.ok) return null;
          const j = await r.json();
          if (!j.access_token) return null;
          setToken(j.access_token, j.expires_in);
          return j.access_token;
        } catch (e) { return null; }
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  async function ensureToken() { return getToken() || await refreshToken(); }

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

  // Native App (Capacitor): Anmeldung über das Google-Plugin, das Zugriffstoken gilt 1 Stunde.
  const isNativeApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  async function requestTokenNative() {
    const G = window.Capacitor.Plugins.GoogleAuth;
    await G.initialize({ clientId: GOOGLE_CLIENT_ID, scopes: [SCOPE], grantOfflineAccess: false });
    const user = await G.signIn();
    const token = user && user.authentication && user.authentication.accessToken;
    if (!token) throw new Error('Anmeldung bei Google fehlgeschlagen');
    setMeta({ persistent: false });
    setToken(token, 3600);
    return token;
  }

  async function requestToken() {
    if (isNativeApp()) return requestTokenNative();
    await loadGis();
    if (serverAuth === false) return requestTokenImplicit();
    const res = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        ux_mode: 'popup',
        callback: r => (r && r.code ? resolve(r) : reject(new Error((r && r.error) || 'Anmeldung fehlgeschlagen'))),
        error_callback: e => reject(Object.assign(new Error('Anmeldung abgebrochen'), { code: e && e.type })),
      });
      client.requestCode();
    });
    const r = await authPost('exchange', { code: res.code });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error || 'Anmeldung fehlgeschlagen');
    serverAuth = true;
    setMeta({ persistent: !!j.persistent });
    setToken(j.access_token, j.expires_in);
    return j.access_token;
  }

  // Fallback ohne Worker: Token-Flow, Zugriff gilt 1 Stunde
  async function requestTokenImplicit() {
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
    const token = await ensureToken();
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
    return normalizeStore(JSON.parse(await r.text()));
  }

  // Uhr dieses Geräts gegenüber dem Server: Änderungszeiten sollen auf allen Geräten vergleichbar sein, auch bei falsch gehender Uhr
  const syncClock = () => Date.now() + (Number(getMeta().clockOffset) || 0);
  function noteServerTime(iso) {
    const t = Date.parse(iso);
    if (!isFinite(t)) return;
    const off = t - Date.now();
    setMeta({ clockOffset: Math.abs(off) < 2000 ? 0 : off }); // unter 2 s Abweichung: Geräteuhr verwenden
  }

  // Version der Datei auf dem Server (ändert sich mit jedem Schreiben) + Serverzeit
  async function fileVersion(id) {
    const r = await drive(API + '/' + id + '?fields=version,modifiedTime');
    const j = await r.json();
    return j;
  }

  async function uploadRemote(id, payload) {
    const body = JSON.stringify(payload);
    if (id) {
      const r = await drive(UPLOAD + '/' + id + '?uploadType=media&fields=id,modifiedTime', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      try { noteServerTime((await r.json()).modifiedTime); } catch (e) {}
      return id;
    }
    const boundary = 'cst' + Date.now().toString(36);
    const multipart = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
      + JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
      + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + boundary + '--';
    const r = await drive(UPLOAD + '?uploadType=multipart&fields=id,modifiedTime', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart,
    });
    const j = await r.json();
    noteServerTime(j.modifiedTime);
    return j.id;
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
  function mergeRecords(local, remote) {
    const deleted = Object.assign({}, remote.deleted);
    Object.keys(local.deleted || {}).forEach(id => { deleted[id] = Math.max(deleted[id] || 0, local.deleted[id]); });
    const alive = e => !(deleted[e.id] && deleted[e.id] >= ts(e));
    const lm = local.meta || {}, rm = remote.meta || {};
    const emptyVehicle = v => !(v.vin || v.make || v.model || v.chassis);
    const pick = (la, ra, lEmpty, rEmpty) => la !== ra ? (la > ra ? 'l' : 'r') : lEmpty !== rEmpty ? (lEmpty ? 'r' : 'l') : 'l';
    const v = pick(lm.vehicleAt || 0, rm.vehicleAt || 0, emptyVehicle(local.vehicle), emptyVehicle(remote.vehicle));
    const s = pick(lm.settingsAt || 0, rm.settingsAt || 0, !local.settings.onboardingDone, !remote.settings.onboardingDone);
    // Fahrzeugdaten und Einstellungen feldweise: je Feld gewinnt die neuere Änderung (ältere Stände ohne Feldzeiten: Zeit des Gesamtobjekts)
    const lf = lm.fieldAt || {}, rf = rm.fieldAt || {};
    const mergeFields = (prefix, lo, ro, whole, lWhole, rWhole) => {
      const out = {};
      new Set([...Object.keys(lo), ...Object.keys(ro)]).forEach(k => {
        // Hat eine Seite Feldzeiten (neuer Stand), heißt „ohne Zeit“ = seit dem Abgleich unverändert (0); ältere Stände nutzen die Zeit des Gesamtobjekts
        const lt = lf[prefix + k] || (Object.keys(lf).length ? 0 : lWhole), rt = rf[prefix + k] || (Object.keys(rf).length ? 0 : rWhole);
        let takeLocal = lt !== rt ? lt > rt : whole === 'l';
        if (lt === rt && (k in lo) !== (k in ro)) takeLocal = k in lo; // gleichauf: das vorhandene Feld behalten
        const src = takeLocal ? lo : ro;
        if (k in src) out[k] = src[k]; // fehlt das Feld auf der gewinnenden Seite, wurde es dort entfernt
      });
      return out;
    };
    const vehicle  = mergeFields('v.', local.vehicle,  remote.vehicle,  v, lm.vehicleAt  || 0, rm.vehicleAt  || 0);
    const settings = mergeFields('s.', local.settings, remote.settings, s, lm.settingsAt || 0, rm.settingsAt || 0);
    const fieldAt = Object.assign({}, rf);
    Object.keys(lf).forEach(k => { fieldAt[k] = Math.max(fieldAt[k] || 0, lf[k]); });
    return normalizeState({
      id: local.id,
      vehicle,
      settings,
      serviceHistory: mergeList(local.serviceHistory, remote.serviceHistory).filter(alive),
      fuelLog:        mergeList(local.fuelLog, remote.fuelLog).filter(alive),
      deleted,
      meta: { vehicleAt: Math.max(lm.vehicleAt || 0, rm.vehicleAt || 0), settingsAt: Math.max(lm.settingsAt || 0, rm.settingsAt || 0), fieldAt },
    });
  }

  // Fahrzeug-Datensatz zuletzt geändert (für Löschmarken-Vergleich)
  const recStamp = r => Math.max((r.meta && r.meta.vehicleAt) || 0, (r.meta && r.meta.settingsAt) || 0,
    ...r.serviceHistory.map(ts), ...r.fuelLog.map(ts));
  const isBlank = r => !r.settings.onboardingDone && !r.serviceHistory.length && !r.fuelLog.length;

  // Fahrzeuge gleicher id werden zusammengeführt; Fahrzeuge nur auf einer Seite bleiben erhalten.
  // linked=false (erste Verbindung): gleiche id, aber verschiedene VIN → zwei getrennte Fahrzeuge.
  function mergeStates(local, remote, linked) {
    const deletedVehicles = Object.assign({}, remote.deletedVehicles);
    Object.keys(local.deletedVehicles || {}).forEach(id => { deletedVehicles[id] = Math.max(deletedVehicles[id] || 0, local.deletedVehicles[id]); });
    const map = new Map();
    remote.vehicles.forEach(r => map.set(r.id, r));
    local.vehicles.forEach(l => {
      const r = map.get(l.id);
      if (!r) map.set(l.id, l);
      else if (!linked && l.vehicle.vin && r.vehicle.vin && l.vehicle.vin !== r.vehicle.vin) {
        const copy = Object.assign({}, l, { id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) });
        map.set(copy.id, copy);
      } else map.set(l.id, mergeRecords(l, r));
    });
    let vehicles = [...map.values()].filter(r => !(deletedVehicles[r.id] && deletedVehicles[r.id] >= recStamp(r)));
    if (vehicles.length > 1) vehicles = vehicles.filter(r => !isBlank(r));
    return normalizeStore({ activeId: local.activeId, vehicles, deletedVehicles });
  }

  // kanonische Form (sortiert) zum Vergleichen und Hochladen; die Fahrzeugauswahl bleibt lokal
  function payloadOf(st) {
    const byId = (a, b) => String(a.id).localeCompare(String(b.id));
    return {
      vehicles: st.vehicles.map(s => ({
        id: s.id, vehicle: s.vehicle, settings: s.settings,
        serviceHistory: s.serviceHistory.slice().sort(byId), fuelLog: s.fuelLog.slice().sort(byId),
        deleted: s.deleted || {}, meta: s.meta || {},
      })).sort(byId),
      deletedVehicles: st.deletedVehicles || {},
    };
  }
  const same = (a, b) => canon(payloadOf(a)) === canon(payloadOf(b));

  // Fremde Daten übernehmen, ohne sie als eigene Änderung zu stempeln
  function adoptState(next) {
    const cur = state && state.id;
    store = next;
    if (addingVehicle) { // mitten im Hinzufügen: nur den Speicher aktualisieren, die Eingabe nicht stören
      store.activeId = next.vehicles.some(r => r.id === store.activeId) ? store.activeId : next.vehicles[0].id;
      buildSnap(); persistRaw(); renderVehicleSwitch();
      return;
    }
    store.activeId = next.vehicles.some(r => r.id === cur) ? cur : next.activeId;
    state = activeRecord();
    buildSnap();
    persistRaw();
    applyTheme(state.settings.vehicleColor);
    renderHeader();
    renderVehicleSwitch();
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
    // Hat ein anderes Gerät zwischen Herunterladen und Hochladen geschrieben, wird neu zusammengeführt (höchstens 3 Versuche),
    // damit dessen neuere Daten nicht überschrieben werden.
    for (let attempt = 0; attempt < 3; attempt++) {
      let remote = null, version = null;
      if (id) {
        try {
          const vInfo = await fileVersion(id);
          version = vInfo.version;
          remote = await downloadRemote(id);
        } catch (e) {
          if (e.status !== 404) throw e;
          id = await findFileId();
          version = null;
          remote = id ? await downloadRemote(id) : null;
        }
      }

      let merged = store;
      if (remote) merged = mergeStates(store, remote, !!getMeta().linked);

      alive();
      if (!same(merged, store)) adoptState(merged);
      if (remote && same(merged, remote)) break; // Server ist schon aktuell
      if (id && version != null) { // zwischenzeitlich verändert? dann neu zusammenführen statt überschreiben
        let now = null;
        try { now = (await fileVersion(id)).version; } catch (e) {}
        if (now !== null && now !== version && attempt < 2) continue;
      }
      id = await uploadRemote(id, payloadOf(merged));
      break;
    }
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
      if (!(await ensureToken())) {
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
    authPost('logout').catch(() => {});
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
      if (!(await ensureToken())) await requestToken();
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
    syncNow();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !syncEnabled()) return;
      const last = Date.parse(getMeta().lastSync || 0) || 0;
      if (Date.now() - last > 15000) syncNow();
    });
    window.addEventListener('focus', () => {
      const last = Date.parse(getMeta().lastSync || 0) || 0;
      if (syncEnabled() && Date.now() - last > 15000) syncNow();
    });
    // Solange die App offen ist, regelmäßig nachsehen, ob ein anderes Gerät neuere Daten hochgeladen hat
    setInterval(() => {
      if (document.visibilityState !== 'visible' || !syncEnabled()) return;
      if (document.querySelector('dialog[open]')) return; // nicht mitten in der Eingabe umschalten
      syncNow();
    }, 90000);
    window.addEventListener('online', () => syncNow());
  }

  Object.assign(window, { syncClock, initSync, scheduleSync, syncNow, syncEnabled, connectDrive, disconnectDrive, deleteDriveData, renderSyncUi,
    syncNowInteractive: () => syncNow({ interactive: true }) });
})();
