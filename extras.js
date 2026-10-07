// Service-Tracker – Zusatzfunktionen: eigene Fristen, Fahrzeugnotizen, eigene Lackfarbe, Sicherheitskopie
//
// Alles liegt lokal im Datenstand (settings.deadlines, settings.notes, settings.customColor) und wird wie die übrigen
// Einstellungen über Backup und Google-Drive-Abgleich mitgeführt. Die Sicherheitskopie liegt nur in diesem Browser.
(function () {
  'use strict';

  const SOON_DAYS = 21; // „Bald fällig“ ab so vielen Tagen vor dem Termin

  // ─── Eigene Fristen ─────────────────────────────────────────────────────────
  const deadlines = () => state.settings.deadlines || (state.settings.deadlines = []);

  function deadlineStatus(d) {
    const days = daysUntil(d.date);
    if (days < 0) return { key: 'alert', label: 'Überfällig', days };
    if (days <= SOON_DAYS) return { key: 'warn', label: 'Bald fällig', days };
    return { key: 'ok', label: 'OK', days };
  }
  const daysText = days => days < 0 ? 'seit ' + (-days) + (days === -1 ? ' Tag' : ' Tagen')
    : days === 0 ? 'heute' : days === 1 ? 'morgen' : 'in ' + days + ' Tagen';

  // Für reminders.js: Fristen eines Fahrzeugdatensatzes als Erinnerungs-Einträge
  function deadlineItems(rec) {
    return ((rec.settings && rec.settings.deadlines) || []).map(d => {
      const from = parseDate(d.date);
      from.setDate(from.getDate() - SOON_DAYS);
      return { id: d.id, title: d.title, date: d.date, from: toIso(from), months: d.months };
    });
  }

  function deadlineRow(d, withActions) {
    const st = deadlineStatus(d);
    return `<div class="deadline-row${st.key !== 'ok' ? ' is-due' : ''}" data-deadline="${esc(d.id)}">
      <div><strong>${esc(d.title)}</strong>
        <small>${formatDate(d.date)} · ${daysText(st.days)}${d.months ? ' · ' + (d.months === 12 ? 'jährlich' : d.months % 12 ? 'alle ' + d.months + ' Monate' : 'alle ' + d.months / 12 + ' Jahre') : ''}</small></div>
      ${withActions ? `<button type="button" class="link-btn" data-act="done">${d.months ? 'Erledigt' : 'Entfernen'}</button>
      <button type="button" class="link-btn" data-act="edit">Ändern</button>` : `<span class="status-badge badge-${st.key}">${st.label}</span>`}
    </div>`;
  }

  function renderDeadlines() {
    const list = [...deadlines()].sort((a, b) => a.date.localeCompare(b.date));
    const box = document.getElementById('deadlineBox');
    if (box) {
      const due = list.filter(d => deadlineStatus(d).key !== 'ok');
      const shown = (due.length ? due : list).slice(0, 4);
      box.hidden = !shown.length;
      box.innerHTML = shown.length ? `<h3 class="section-title">Fristen</h3><div class="card info-card">${shown.map(d => deadlineRow(d, false)).join('')}</div>` : '';
    }
    const el = document.getElementById('deadlineList');
    if (el) el.innerHTML = list.length ? list.map(d => deadlineRow(d, true)).join('') : '<p class="settings-hint">Noch keine Fristen angelegt.</p>';
  }

  function openDeadline(id) {
    const d = id ? deadlines().find(x => x.id === id) : null;
    const f = document.getElementById('deadlineForm');
    f.reset();
    f.dataset.id = d ? d.id : '';
    document.getElementById('deadlineTitle').textContent = d ? 'Frist ändern' : 'Neue Frist';
    document.getElementById('dl-title').value = d ? d.title : '';
    document.getElementById('dl-date').value = d ? d.date : '';
    document.getElementById('dl-months').value = d ? String(d.months || 0) : '0';
    document.getElementById('dl-delete').hidden = !d;
    document.getElementById('modal-deadline').showModal();
  }

  function saveDeadline(ev) {
    ev.preventDefault();
    const f = ev.target, id = f.dataset.id;
    const title = document.getElementById('dl-title').value.trim().slice(0, 60);
    const date = document.getElementById('dl-date').value;
    const months = parseInt(document.getElementById('dl-months').value, 10) || 0;
    if (!title) return showToast('Bezeichnung fehlt', 'err');
    if (!date) return showToast('Datum fehlt', 'err');
    const list = deadlines();
    if (!id && list.length >= 30) return showToast('Maximal 30 Fristen', 'warn');
    if (id) Object.assign(list.find(x => x.id === id) || {}, { title, date, months });
    else list.push({ id: uid(), title, date, months });
    saveState();
    document.getElementById('modal-deadline').close();
    renderDeadlines();
    window.renderReminderCard?.();
    showToast('Frist gespeichert ✓', 'ok');
  }

  async function deleteDeadlineFromForm() {
    const id = document.getElementById('deadlineForm').dataset.id;
    if (!id) return;
    state.settings.deadlines = deadlines().filter(x => x.id !== id);
    saveState();
    document.getElementById('modal-deadline').close();
    renderDeadlines();
    window.renderReminderCard?.();
    showToast('Frist gelöscht', 'warn');
  }

  // „Erledigt“: wiederkehrende Frist rückt um das Intervall weiter (ab dem alten Termin bzw. heute, falls überfällig), sonst entfernen
  function deadlineDone(id) {
    const d = deadlines().find(x => x.id === id);
    if (!d) return;
    if (d.months) {
      let next = addMonths(d.date, d.months);
      while (daysUntil(next) < 0) next = addMonths(next, d.months);
      d.date = next;
      showToast(d.title + ': nächste Frist ' + formatDate(next), 'ok');
    } else {
      state.settings.deadlines = deadlines().filter(x => x.id !== id);
      showToast('Frist entfernt', 'ok');
    }
    saveState();
    renderDeadlines();
    window.renderReminderCard?.();
  }

  function bindDeadlines() {
    const el = document.getElementById('deadlineList');
    if (el) el.addEventListener('click', ev => {
      const row = ev.target.closest('[data-deadline]'), act = ev.target.closest('[data-act]');
      if (!row || !act) return;
      if (act.dataset.act === 'done') deadlineDone(row.dataset.deadline);
      else openDeadline(row.dataset.deadline);
    });
  }

  // ─── Fahrzeugnotizen ────────────────────────────────────────────────────────
  function renderNotes() {
    const el = document.getElementById('vehicleNotes');
    if (el && document.activeElement !== el) el.value = state.settings.notes || '';
  }
  function saveNotes(el) {
    const v = el.value.trim().slice(0, 3000);
    if (v) state.settings.notes = v; else delete state.settings.notes;
    saveState();
  }

  // ─── Eigene Lackfarbe ───────────────────────────────────────────────────────
  function renderCustomColor() {
    const row = document.getElementById('customColorRow');
    if (!row) return;
    const active = state.settings.vehicleColor === 'custom';
    row.classList.toggle('active', active);
    document.getElementById('customColorInput').value = state.settings.customColor || '#8a8f98';
    document.getElementById('customColorLabel').textContent = active ? 'Eigene Farbe (aktiv)' : 'Eigene Farbe wählen';
  }
  function setCustomColor(hex) {
    state.settings.customColor = hex.toLowerCase();
    state.settings.vehicleColor = 'custom';
    saveState();
    applyTheme('custom');
    renderSettings();
    showToast('Eigene Farbe gesetzt', 'ok');
  }

  // ─── Sicherheitskopie (nur in diesem Browser, ohne Fotos) ───────────────────
  const SAFE_KEYS = { event: 'cst_safety_event', daily: 'cst_safety_daily' };
  const readSafe = k => { try { return JSON.parse(localStorage.getItem(SAFE_KEYS[k])); } catch (e) { return null; } };
  const countOf = s => { try { const r = JSON.parse(s); return (r.vehicles || []).reduce((n, v) => n + (v.serviceHistory || []).length, 0); } catch (e) { return 0; } };

  // slot 'event': vor einer riskanten Aktion (Löschen, Zurücksetzen, Import); 'daily': höchstens einmal pro Tag
  function safetyCopy(slot, reason) {
    try {
      if (!store || !store.vehicles.length) return;
      if (slot === 'daily') { const old = readSafe('daily'); if (old && old.day === todayIso()) return; }
      const data = JSON.stringify(store);
      if (store.vehicles.every(v => !v.settings.onboardingDone && !v.serviceHistory.length)) return; // nichts Sicherungswertes
      localStorage.setItem(SAFE_KEYS[slot], JSON.stringify({ at: Date.now(), day: todayIso(), reason, data }));
    } catch (e) { /* Speicher voll – dann eben keine Kopie */ }
  }

  function renderSafety() {
    const el = document.getElementById('safetyBox');
    if (!el) return;
    const rows = ['event', 'daily'].map(k => ({ k, c: readSafe(k) })).filter(r => r.c && r.c.data);
    el.innerHTML = rows.length ? rows.map(({ k, c }) => `
      <div class="deadline-row"><div><strong>${esc(c.reason)}</strong>
        <small>${new Date(c.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · ${countOf(c.data)} Einträge</small></div>
        <button type="button" class="link-btn" data-restore="${k}">Wiederherstellen</button></div>`).join('')
      : '<p class="settings-hint">Noch keine Sicherheitskopie vorhanden.</p>';
  }

  async function restoreSafety(slot) {
    const c = readSafe(slot);
    if (!c) return;
    const ok = await confirmDialog({
      title: 'Sicherheitskopie wiederherstellen?',
      text: 'Der aktuelle Stand wird durch die Kopie vom ' + new Date(c.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) + ' ersetzt (' + countOf(c.data) + ' Einträge). Davor wird der jetzige Stand selbst als Sicherheitskopie abgelegt. Fotos sind in der Kopie nicht enthalten; bereits gelöschte Fotos kommen nicht zurück.',
      ok: 'Wiederherstellen', danger: true,
    });
    if (!ok) return;
    try {
      const restored = normalizeStore(JSON.parse(c.data));
      safetyCopy('event', 'Vor dem Wiederherstellen');
      store = restored;
      state = store.vehicles.find(v => v.id === store.activeId) || store.vehicles[0];
      store.activeId = state.id;
      buildSnap();
      saveState();
      showToast('Sicherheitskopie wiederhergestellt', 'ok');
      setTimeout(() => location.reload(), 600);
    } catch (e) { showToast('Wiederherstellen fehlgeschlagen', 'err'); }
  }

  function bindSafety() {
    const el = document.getElementById('safetyBox');
    if (el) el.addEventListener('click', ev => { const b = ev.target.closest('[data-restore]'); if (b) restoreSafety(b.dataset.restore); });
  }

  function renderExtras() {
    renderDeadlines(); renderNotes(); renderCustomColor(); renderSafety();
  }

  function initExtras() {
    bindDeadlines(); bindSafety();
    safetyCopy('daily', 'Tägliche Sicherung');
    renderDeadlines();
  }

  Object.assign(window, {
    initExtras, renderExtras, renderDeadlines, openDeadline, saveDeadline, deleteDeadlineFromForm, deadlineItems,
    saveNotes, setCustomColor, safetyCopy,
  });
})();
