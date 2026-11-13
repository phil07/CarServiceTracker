// Digitales Scheckheft – öffentliche Ansicht (lädt die Momentaufnahme von /api/book/<id>)
(function () {
  'use strict';
  const app = document.getElementById('app');
  const m = /^\/s\/([\w-]+)\/?$/.exec(location.pathname);
  const id = m && m[1];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const photoUrl = pid => '/api/book/' + encodeURIComponent(id) + '/photo/' + encodeURIComponent(pid);
  const fmtDate = iso => { const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return d ? d[3] + '.' + d[2] + '.' + d[1] : esc(iso); };
  const fmtKm = n => (Number(n) || 0).toLocaleString('de-DE') + ' km';
  let data = null, filter = 'Alle';

  function setAccent(a) {
    if (!a) return;
    const ok = c => /^#[0-9a-f]{6}$/i.test(c || '');
    const st = document.createElement('style');
    st.textContent = (ok(a.light) ? ':root{--accent:' + a.light + ';--accent-soft:' + a.light + '1f}' : '')
      + (ok(a.dark) ? '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--accent:' + a.dark + ';--accent-soft:' + a.dark + '2b}}' : '');
    document.head.appendChild(st);
  }

  function render() {
    const v = data.vehicle || {};
    const entries = (data.entries || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.km || 0) - (a.km || 0));
    const cats = ['Alle'].concat([...new Set(entries.map(e => e.categoryLabel || e.category || 'Anderes'))]);
    if (!cats.includes(filter)) filter = 'Alle';
    const shown = entries.filter(e => filter === 'Alle' || (e.categoryLabel || e.category || 'Anderes') === filter);
    const cover = (data.vehiclePhotos || [])[0];
    const chips = [
      v.firstRegistration ? ['Erstzulassung', fmtDate(v.firstRegistration)] : null,
      v.currentKm ? ['Kilometerstand', fmtKm(v.currentKm)] : null,
      v.chassis ? ['Baureihe', v.chassis] : null,
      v.vin ? ['FIN', v.vin] : null,
    ].filter(Boolean);
    const last = entries[0];
    app.innerHTML =
      (cover ? `<button type="button" class="hero" data-photo="${esc(cover)}" aria-label="Foto vergrößern"><img class="bg" src="${photoUrl(cover)}" alt=""><img class="fg" src="${photoUrl(cover)}" alt="Fahrzeugfoto"></button>` : '')
      + '<div><p class="kicker">Digitales Scheckheft</p><h1>' + esc(v.title || 'Fahrzeug') + '</h1></div>'
      + (chips.length ? '<ul class="chips">' + chips.map(c => `<li><span>${esc(c[0])}</span> ${esc(c[1])}</li>`).join('') + '</ul>' : '')
      + `<p class="summary">${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}${last ? ' · zuletzt ' + fmtDate(last.date) + ' bei ' + fmtKm(last.km) : ''}</p>`
      + (cats.length > 2 ? '<div class="filter" role="group" aria-label="Nach Kategorie filtern">' + cats.map(c => `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === filter}">${esc(c)}</button>`).join('') + '</div>' : '')
      + '<ul class="entries">' + (shown.length ? shown.map(e => `<li class="entry">
          <div class="entry-head"><strong>${fmtDate(e.date)}</strong><span>${fmtKm(e.km)}</span></div>
          <span class="cat">${esc(e.categoryLabel || e.category || 'Anderes')}</span>
          ${e.description ? '<p>' + esc(e.description) + '</p>' : ''}
          ${e.shop ? '<p class="shop">' + esc(e.shop) + '</p>' : ''}
          ${(e.photos || []).length ? '<div class="thumbs">' + e.photos.map(p => `<button type="button" data-photo="${esc(p)}" aria-label="Foto vergrößern"><img loading="lazy" src="${photoUrl(p)}" alt=""></button>`).join('') + '</div>' : ''}
        </li>`).join('') : '<li class="state">Keine Einträge.</li>') + '</ul>'
      + `<p class="foot">Vom Fahrzeughalter geführt, Angaben nicht amtlich geprüft. Stand: ${data.updated ? new Date(data.updated).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–'}. Ohne Kosten und persönliche Notizen.</p>`;
    document.title = (v.title ? v.title + ' – ' : '') + 'Digitales Scheckheft';
  }

  async function load() {
    if (!id) { app.innerHTML = '<p class="state">Ungültiger Link.</p>'; return; }
    try {
      const r = await fetch((self.API_BASE || '') + '/api/book/' + encodeURIComponent(id), { cache: 'no-store' });
      if (r.status === 404) { app.innerHTML = '<p class="state">Dieses Scheckheft existiert nicht (mehr) oder wurde nicht veröffentlicht.</p>'; return; }
      if (r.status === 410) { app.innerHTML = '<p class="state">Dieser Link ist abgelaufen. Bitte beim Fahrzeughalter einen neuen anfragen.</p>'; return; }
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
      setAccent(data.accent);
      render();
    } catch (e) {
      if (!data) app.innerHTML = '<p class="state">Das Scheckheft konnte nicht geladen werden. Bitte Verbindung prüfen und neu laden.</p>';
    }
  }

  app.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]');
    if (c) { filter = c.dataset.cat; render(); return; }
    const p = e.target.closest('[data-photo]');
    if (p) { document.getElementById('viewerImg').src = photoUrl(p.dataset.photo); document.getElementById('viewer').showModal(); }
  });
  const dlg = document.getElementById('viewer');
  document.getElementById('viewerClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && data) load(); });
  load();
})();
