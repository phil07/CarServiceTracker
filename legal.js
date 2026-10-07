// Angaben des Betreibers für Impressum und Datenschutzerklärung.
// Hier einmal ausfüllen – beide Seiten übernehmen die Werte automatisch.
// Leere Felder erscheinen auf den Seiten rot markiert als „bitte ergänzen“.
const LEGAL = {
  name:   'Philipp Fischer',   // z. B. 'Vorname Nachname'
  street: 'Hugo-Sellheim-Straße 7',   // z. B. 'Musterstraße 1'
  city:   '68647 Biblis',   // z. B. '12345 Musterstadt'
  email:  'iphilipp07@gmail.com',   // Kontakt-E-Mail (öffentlich sichtbar)
  stand:  '7. Oktober 2026', // Datum der letzten inhaltlichen Änderung
};

(function () {
  try { const t = localStorage.getItem('cst_theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-legal]').forEach(el => {
      const key = el.dataset.legal, v = (LEGAL[key] || '').trim();
      if (v) {
        if (key === 'email') { const a = document.createElement('a'); a.href = 'mailto:' + v; a.textContent = v; el.replaceChildren(a); }
        else el.textContent = v;
      } else { el.textContent = '[bitte ergänzen: ' + ({ name: 'Name', street: 'Straße', city: 'PLZ Ort', email: 'E-Mail' }[key] || key) + ']'; el.classList.add('missing'); }
    });
  });
})();
