# Arbeitsregeln

- **Nur der Branch `main` existiert.** Keine Feature-Branches, keine Pull Requests – direkt auf `main` committen und pushen.
- **`version.js` (`APP_VERSION`, z. B. `v52` → `v53`) bei jedem Push, der App-Dateien ändert (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`), um eins erhöhen.** Der Service-Worker-Cache leitet sich davon ab; daran erkennen installierte Apps den neuen Stand („Update verfügbar“).
- Design: Stil wie die Trip-Planer-PWA (Plus Jakarta Sans, schwebender Header, Vollbild-Menü, Doppel-Bezel-Karten, Pill-Buttons, hell/dunkel/auto). Die Akzentfarbe kommt aus der Lackfarbe des gewählten Fahrzeugs (`BMW_COLORS` in `app.js` → `--car-light` / `--car-dark`).
