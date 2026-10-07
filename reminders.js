// Service-Tracker – Erinnerungen an fällige Wartungen
//
// Eine Wartung zählt als erinnerungswürdig, wenn sie „Bald fällig“ oder „Überfällig/Dringend“ ist (gleiche Schwellen
// wie auf dem Dashboard) – für alle Fahrzeuge. Drei Wege, alles lokal auf diesem Gerät, ohne Server:
//  1. Beim Öffnen/Zurückkehren: Systembenachrichtigung (max. 1× pro Tag bzw. bei neu fälligen Wartungen).
//  2. App-Symbol-Zähler (Badge), wo der Browser das unterstützt.
//  3. Im Hintergrund (Chrome/Android, installierte App): Der Service Worker prüft anhand einer Momentaufnahme
//     im Cache die datumsbasierten Fälligkeiten. Kilometerbasierte Fälligkeiten ändern sich nur durch neue Eingaben.
(function () {
  'use strict';

  const KEY = 'cst_reminders';        // pro Gerät: { on, day, sig }
  const SNAP_CACHE = 'cst-reminders';
  const SNAP_URL = './reminders-snapshot.json';

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const canNotify = () => 'Notification' in window && Notification.permission === 'granted';

  // Alle erinnerungswürdigen Wartungen aller Fahrzeuge (rechnet je Fahrzeug mit dem globalen `state`)
  function collect() {
    const items = [];
    const keep = state;
    try {
      for (const rec of store.vehicles) {
        if (!rec.settings.onboardingDone) continue;
        state = rec;
        for (const svc of trackedServices()) {
          const status = getServiceStatus(svc);
          if (status !== 'warn' && status !== 'alert') continue;
          let from = '';
          if (svc.dueDate) { // ab wann die Wartung „Bald fällig“ ist (Schwelle wie getServiceStatus)
            const d = parseDate(svc.dueDate);
            d.setDate(d.getDate() - Math.round(Math.max(30, svc.interval.months * 30 * 0.15)));
            from = toIso(d);
          }
          items.push({
            key: rec.id + '|' + svc.category,
            vehicle: vehicleTitle(rec.vehicle) || 'Fahrzeug',
            category: svc.category,
            overdue: isOverdue(svc),
            text: dueText(svc),
            due: svc.dueDate || '',
            from,
          });
        }
      }
    } finally { state = keep; }
    return items;
  }

  // Zukünftig fällig werdende Datumsfristen für den Service Worker
  function futureItems() {
    const out = [];
    const keep = state;
    try {
      for (const rec of store.vehicles) {
        if (!rec.settings.onboardingDone) continue;
        state = rec;
        for (const svc of trackedServices()) {
          if (!svc.last || !svc.dueDate) continue;
          const d = parseDate(svc.dueDate);
          d.setDate(d.getDate() - Math.round(Math.max(30, svc.interval.months * 30 * 0.15)));
          out.push({ key: rec.id + '|' + svc.category, vehicle: vehicleTitle(rec.vehicle) || 'Fahrzeug', category: svc.category, from: toIso(d), due: svc.dueDate });
        }
      }
    } finally { state = keep; }
    return out;
  }

  async function writeSnapshot(on) {
    if (!('caches' in window)) return;
    try {
      const c = await caches.open(SNAP_CACHE);
      if (!on) { await c.delete(SNAP_URL); return; }
      let notified = {};
      try { const old = await c.match(SNAP_URL); if (old) notified = (await old.json()).notified || {}; } catch (e) {}
      await c.put(SNAP_URL, new Response(JSON.stringify({ items: futureItems(), notified, at: todayIso() }), { headers: { 'Content-Type': 'application/json' } }));
    } catch (e) { console.warn('Erinnerungs-Snapshot:', e); }
  }

  function message(items) {
    const lines = items.slice(0, 5).map(i => (i.overdue ? '⚠️ ' : '') + i.category + ' – ' + i.vehicle + (i.overdue ? ' (überfällig)' : ''));
    if (items.length > 5) lines.push('… und ' + (items.length - 5) + ' weitere');
    return { title: items.length === 1 ? 'Wartung fällig' : items.length + ' Wartungen fällig', body: lines.join('\n') };
  }

  let timer = null;
  async function check() {
    if (!store) return;
    const s = load();
    const items = collect();
    try {
      if (navigator.setAppBadge) { if (s.on && items.length) navigator.setAppBadge(items.length); else navigator.clearAppBadge(); }
    } catch (e) {}
    renderCard(items);
    if (!s.on) return;
    writeSnapshot(true);
    if (!items.length || !canNotify()) return;
    const sig = items.map(i => i.key + ':' + (i.overdue ? 'o' : 'w')).sort().join(',');
    const today = todayIso();
    if (s.day === today && s.sig === sig) return; // heute schon gemeldet
    s.day = today; s.sig = sig; save(s);
    const m = message(items);
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(m.title, { body: m.body, tag: 'service-due', renotify: true, data: { url: './' } });
    } catch (e) { console.warn('Benachrichtigung:', e); }
  }

  function scheduleCheck() {
    clearTimeout(timer);
    timer = setTimeout(check, 1500);
  }

  async function registerBackground() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.periodicSync) {
        const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (st.state === 'granted') await reg.periodicSync.register('service-due', { minInterval: 12 * 60 * 60 * 1000 });
      }
    } catch (e) { /* nicht unterstützt – dann nur beim Öffnen */ }
  }

  async function setOn(on) {
    const s = load();
    if (on) {
      if (!('Notification' in window)) { showToast('Benachrichtigungen werden hier nicht unterstützt – du siehst fällige Wartungen weiter im Dashboard', 'warn'); }
      else {
        let perm = Notification.permission;
        if (perm === 'default') perm = await Notification.requestPermission();
        if (perm !== 'granted') showToast('Benachrichtigungen sind blockiert – in den Browser-Einstellungen erlauben. Der Zähler am App-Symbol funktioniert trotzdem.', 'warn');
      }
      s.on = true; s.day = ''; s.sig = '';
      save(s);
      await registerBackground();
      showToast('Erinnerungen aktiviert', 'ok');
    } else {
      s.on = false; save(s);
      try { navigator.clearAppBadge?.(); } catch (e) {}
      writeSnapshot(false);
      showToast('Erinnerungen ausgeschaltet', 'ok');
    }
    check();
  }

  function renderCard(items) {
    const box = document.getElementById('remindStatus');
    const cb = document.getElementById('remindOn');
    if (!box || !cb) return;
    const s = load();
    cb.checked = !!s.on;
    if (!s.on) { box.textContent = ''; return; }
    const blocked = 'Notification' in window && Notification.permission === 'denied';
    box.innerHTML = '';
    const head = document.createElement('div');
    head.textContent = items.length ? 'Aktuell fällig: ' + items.map(i => i.category + (items.some(o => o !== i && o.category === i.category) ? ' (' + i.vehicle + ')' : '')).join(', ') : 'Aktuell ist nichts fällig.';
    box.appendChild(head);
    if (blocked) { const w = document.createElement('div'); w.textContent = 'Benachrichtigungen sind im Browser blockiert.'; box.appendChild(w); }
  }

  window.setReminders = setOn;
  window.checkReminders = scheduleCheck;
  window.renderReminderCard = () => renderCard(store ? collect() : []);
  window.initReminders = function () {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleCheck(); });
    if (load().on) registerBackground();
    scheduleCheck();
  };
})();
