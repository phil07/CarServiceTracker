// Service-Tracker – Fotos (Fahrzeug + Einträge)
//
// Die Bilder liegen als verkleinerte JPEGs in IndexedDB (localStorage ist dafür zu klein).
// Im Datenstand stehen nur die Foto-IDs: entry.photos = [id, …], settings.vehiclePhotos = [id, …].
// Backup-Dateien enthalten die Bilder (Base64); die Drive-Synchronisierung legt sie einzeln im App-Ordner ab.
(function () {
  'use strict';

  const DB_NAME = 'cst_photos', STORE = 'photos';
  const MAX_SIDE = 1400, QUALITY = 0.8;
  const MAX_ENTRY = 6, MAX_VEHICLE = 12;
  const GC_GRACE_MS = 60000; // frisch gespeicherte Bilder nicht sofort wegräumen

  // ─── IndexedDB ──────────────────────────────────────────────────────────────
  let dbPromise = null;
  function db() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB nicht verfügbar'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const urls = new Map(); // id -> Object-URL
  const photoPut = (id, blob) => tx('readwrite', s => s.put({ id, blob, created: Date.now() }));
  const photoGet = id => tx('readonly', s => s.get(id)).then(r => (r ? r.blob : null)).catch(() => null);
  const photoAll = () => tx('readonly', s => s.getAll()).then(r => r || []).catch(() => []);
  function photoDel(id) {
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    return tx('readwrite', s => s.delete(id)).catch(() => {});
  }
  async function photoUrl(id) {
    if (urls.has(id)) return urls.get(id);
    const blob = await photoGet(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(id, u);
    return u;
  }

  // ─── Bild verkleinern (EXIF-Drehung berücksichtigt) ─────────────────────────
  async function processImage(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      bmp = await new Promise((resolve, reject) => {
        const img = new Image(), u = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('Bild nicht lesbar')); };
        img.src = u;
      });
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); // PNG-Transparenz → weiß
    ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    if (bmp.close) bmp.close();
    return new Promise((resolve, reject) => cv.toBlob(b => (b ? resolve(b) : reject(new Error('Bild konnte nicht umgewandelt werden'))), 'image/jpeg', QUALITY));
  }

  // Dateiauswahl → verkleinerte Blobs [{ id, blob }]
  async function pickToBlobs(input, room) {
    const files = [...(input.files || [])].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    input.value = '';
    if (!files.length) return [];
    const take = files.slice(0, Math.max(0, room));
    if (files.length > take.length) showToast('Limit erreicht – nicht alle Fotos wurden übernommen', 'warn');
    const out = [];
    for (const f of take) {
      try { out.push({ id: uid(), blob: await processImage(f) }); }
      catch (e) { showToast('Foto konnte nicht verarbeitet werden', 'err'); }
    }
    return out;
  }

  // ─── Aufräumen ──────────────────────────────────────────────────────────────
  function referencedIds() {
    const ids = new Set(state.settings.vehiclePhotos || []);
    state.serviceHistory.forEach(e => (e.photos || []).forEach(id => ids.add(id)));
    return ids;
  }
  async function gcPhotos() {
    const keep = referencedIds();
    const all = await photoAll();
    const now = Date.now();
    await Promise.all(all.filter(r => !keep.has(r.id) && now - (r.created || 0) > GC_GRACE_MS).map(r => photoDel(r.id)));
  }
  async function clearPhotos() {
    const all = await photoAll();
    await Promise.all(all.map(r => photoDel(r.id)));
  }

  // ─── Anzeige ────────────────────────────────────────────────────────────────
  // <img data-photo="ID"> mit dem gespeicherten Bild füllen; fehlt es, wird das Element ausgeblendet
  async function hydratePhotos(root) {
    const imgs = (root || document).querySelectorAll('img[data-photo]');
    await Promise.all([...imgs].map(async img => {
      const u = await photoUrl(img.dataset.photo);
      if (u) { img.src = u; img.hidden = false; img.closest('.photo-thumb, .hero-photo')?.classList.remove('is-missing'); }
      else img.closest('.photo-thumb, .hero-photo')?.classList.add('is-missing');
    }));
  }

  // Foto-Streifen mit Vorschaubildern (tippen = vergrößern); extra: HTML für Zusatz-Buttons je Bild
  function thumbsHtml(ids, extra) {
    return ids.map((id, i) => `
      <div class="photo-thumb">
        <button type="button" class="photo-open" data-open="${i}" aria-label="Foto ${i + 1} vergrößern"><img data-photo="${esc(id)}" alt="" loading="lazy" hidden></button>
        ${extra ? extra(id, i) : ''}
      </div>`).join('');
  }

  // ─── Vollbild-Ansicht ───────────────────────────────────────────────────────
  let lb = { ids: [], i: 0, opts: {} };
  async function showLightbox() {
    const dlg = document.getElementById('modal-photo');
    const img = document.getElementById('lightboxImg');
    const url = await photoUrl(lb.ids[lb.i]);
    img.src = url || '';
    img.alt = 'Foto ' + (lb.i + 1) + ' von ' + lb.ids.length;
    document.getElementById('lightboxCount').textContent = (lb.i + 1) + ' / ' + lb.ids.length;
    dlg.classList.toggle('single', lb.ids.length < 2);
    document.getElementById('lightboxDelete').hidden = !lb.opts.onDelete;
    document.getElementById('lightboxCover').hidden = !lb.opts.onCover || lb.i === 0;
  }
  function openLightbox(ids, index, opts) {
    if (!ids.length) return;
    lb = { ids: ids.slice(), i: Math.min(Math.max(0, index || 0), ids.length - 1), opts: opts || {} };
    const dlg = document.getElementById('modal-photo');
    if (!dlg.open) dlg.showModal();
    showLightbox();
  }
  function lightboxStep(d) {
    if (lb.ids.length < 2) return;
    lb.i = (lb.i + d + lb.ids.length) % lb.ids.length;
    showLightbox();
  }
  function closeLightbox() { document.getElementById('modal-photo').close(); }
  async function lightboxDelete() {
    if (!lb.opts.onDelete) return;
    const ok = await confirmDialog({ title: 'Foto löschen?', text: 'Das Foto wird entfernt.', ok: 'Löschen', danger: true });
    if (!ok) return;
    const id = lb.ids[lb.i];
    await lb.opts.onDelete(id);
    lb.ids.splice(lb.i, 1);
    if (!lb.ids.length) return closeLightbox();
    lb.i = Math.min(lb.i, lb.ids.length - 1);
    showLightbox();
  }
  async function lightboxCover() {
    if (!lb.opts.onCover) return;
    const id = lb.ids[lb.i];
    await lb.opts.onCover(id);
    lb.ids.splice(lb.i, 1); lb.ids.unshift(id); lb.i = 0;
    showLightbox();
    showToast('Als Titelbild gesetzt', 'ok');
  }

  // ─── Fotos im Eintrags-Formular ─────────────────────────────────────────────
  // formPhotos: [{ id, blob|null }] – neue Bilder werden erst beim Speichern in IndexedDB geschrieben,
  // bis dahin zeigt ein temporärer Object-URL (urls-Cache) sie an.
  let formPhotos = [];

  function dropPending() {
    formPhotos.forEach(p => { if (p.blob && urls.has(p.id)) { URL.revokeObjectURL(urls.get(p.id)); urls.delete(p.id); } });
  }
  function formPhotosReset(ids) {
    dropPending();
    formPhotos = (ids || []).map(id => ({ id, blob: null }));
    renderFormPhotos();
  }
  function renderFormPhotos() {
    const el = document.getElementById('formPhotos');
    if (!el) return;
    el.innerHTML = thumbsHtml(formPhotos.map(p => p.id), id =>
      `<button type="button" class="photo-remove" data-remove="${esc(id)}" aria-label="Foto entfernen"><i class="ph-light ph-x" data-fb="✕" aria-hidden="true"></i></button>`)
      + (formPhotos.length < MAX_ENTRY
      ? `<button type="button" class="photo-add" data-add aria-label="Foto hinzufügen"><i class="ph-light ph-camera" data-fb="📷" aria-hidden="true"></i><span>Foto</span></button>` : '');
    hydratePhotos(el);
  }
  async function onFormPhotosPicked(input) {
    const got = await pickToBlobs(input, MAX_ENTRY - formPhotos.length);
    got.forEach(g => { urls.set(g.id, URL.createObjectURL(g.blob)); formPhotos.push(g); });
    renderFormPhotos();
  }
  function bindFormPhotos() {
    const el = document.getElementById('formPhotos');
    if (!el) return;
    el.addEventListener('click', ev => {
      if (ev.target.closest('[data-add]')) return document.getElementById('formPhotoInput').click();
      const rm = ev.target.closest('[data-remove]');
      if (rm) {
        const p = formPhotos.find(x => x.id === rm.dataset.remove);
        if (p && p.blob && urls.has(p.id)) { URL.revokeObjectURL(urls.get(p.id)); urls.delete(p.id); }
        formPhotos = formPhotos.filter(x => x !== p);
        renderFormPhotos();
        return;
      }
      const op = ev.target.closest('[data-open]');
      if (op) openLightbox(formPhotos.map(p => p.id), Number(op.dataset.open));
    });
  }
  // Beim Speichern: neue Bilder schreiben, Liste der IDs zurückgeben
  async function formPhotosCommit() {
    for (const p of formPhotos) if (p.blob) { await photoPut(p.id, p.blob); p.blob = null; }
    return formPhotos.map(p => p.id);
  }

  // ─── Fahrzeugfotos (Einstellungen + Dashboard) ──────────────────────────────
  const vehicleIds = () => (state.settings.vehiclePhotos = state.settings.vehiclePhotos || []);

  function renderVehiclePhotos() {
    const el = document.getElementById('vehiclePhotos');
    if (el) {
      const ids = vehicleIds();
      el.innerHTML = thumbsHtml(ids) + (ids.length < MAX_VEHICLE
        ? `<button type="button" class="photo-add" data-add aria-label="Fahrzeugfoto hinzufügen"><i class="ph-light ph-camera" data-fb="📷" aria-hidden="true"></i><span>Foto</span></button>` : '');
      hydratePhotos(el);
    }
  }
  async function onVehiclePhotosPicked(input) {
    const got = await pickToBlobs(input, MAX_VEHICLE - vehicleIds().length);
    if (!got.length) return;
    for (const g of got) { await photoPut(g.id, g.blob); vehicleIds().push(g.id); }
    saveState();
    renderVehiclePhotos();
    renderHeroPhoto();
  }
  function bindVehiclePhotos() {
    const el = document.getElementById('vehiclePhotos');
    if (!el) return;
    el.addEventListener('click', ev => {
      if (ev.target.closest('[data-add]')) return document.getElementById('vehiclePhotoInput').click();
      const op = ev.target.closest('[data-open]');
      if (op) openLightbox(vehicleIds(), Number(op.dataset.open), {
        onDelete: async id => { state.settings.vehiclePhotos = vehicleIds().filter(x => x !== id); saveState(); await photoDel(id); renderVehiclePhotos(); renderHeroPhoto(); },
        onCover: async id => { state.settings.vehiclePhotos = [id].concat(vehicleIds().filter(x => x !== id)); saveState(); renderVehiclePhotos(); renderHeroPhoto(); },
      });
    });
  }
  // Titelbild im Dashboard
  function renderHeroPhoto() {
    const el = document.getElementById('heroPhoto');
    if (!el) return;
    const ids = vehicleIds();
    el.hidden = !ids.length;
    if (!ids.length) { el.innerHTML = ''; return; }
    // Unscharfe Kopie füllt die Fläche, das Foto selbst wird ganz angezeigt (contain) – das Fahrzeug ist nie angeschnitten
    el.innerHTML = `<img class="hero-photo-bg" data-photo="${esc(ids[0])}" alt="" aria-hidden="true" hidden><img class="hero-photo-fg" data-photo="${esc(ids[0])}" alt="Fahrzeugfoto" hidden>` + (ids.length > 1 ? `<span class="hero-photo-count"><i class="ph-light ph-images" data-fb="🖼️" aria-hidden="true"></i> ${ids.length}</span>` : '');
    hydratePhotos(el);
  }
  function openHeroPhoto() { openLightbox(vehicleIds(), 0); }

  // ─── Detailansicht eines Eintrags ───────────────────────────────────────────
  function renderDetailPhotos(entry) {
    const el = document.getElementById('detailPhotos');
    if (!el) return;
    const ids = (entry && entry.photos) || [];
    el.hidden = !ids.length;
    el.innerHTML = thumbsHtml(ids);
    el.onclick = ev => { const op = ev.target.closest('[data-open]'); if (op) openLightbox(ids, Number(op.dataset.open)); };
    hydratePhotos(el);
  }

  // ─── Backup: Bilder als Base64 in die Datei / zurück ────────────────────────
  const blobToDataUrl = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
  async function photosForBackup() {
    const out = {};
    for (const id of referencedIds()) {
      const b = await photoGet(id);
      if (b) out[id] = await blobToDataUrl(b);
    }
    return out;
  }
  async function restorePhotos(map) {
    if (!map || typeof map !== 'object') return;
    for (const id of Object.keys(map)) {
      if (!/^[\w-]+$/.test(id) || typeof map[id] !== 'string' || !map[id].startsWith('data:image/')) continue;
      try { await photoPut(id, await (await fetch(map[id])).blob()); } catch (e) { console.warn('restorePhoto', e); }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindFormPhotos();
    bindVehiclePhotos();
    const dlg = document.getElementById('modal-photo');
    if (dlg) {
      dlg.addEventListener('click', ev => { if (ev.target === dlg) closeLightbox(); });
      let sx = null;
      dlg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
      dlg.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) lightboxStep(dx < 0 ? 1 : -1); });
      dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') lightboxStep(1); if (e.key === 'ArrowLeft') lightboxStep(-1); });
    }
  });

  Object.assign(window, {
    photoPut, photoGet, photoDel, photoUrl, gcPhotos, clearPhotos, hydratePhotos,
    openLightbox, lightboxStep, closeLightbox, lightboxDelete, lightboxCover,
    formPhotosReset, formPhotosCommit, onFormPhotosPicked,
    renderVehiclePhotos, onVehiclePhotosPicked, renderHeroPhoto, openHeroPhoto, renderDetailPhotos,
    photosForBackup, restorePhotos, referencedPhotoIds: referencedIds,
  });
})();
