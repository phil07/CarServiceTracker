# Service-Tracker

> Wartungs-, Kosten- und Tankbuch für das eigene Auto – als installierbare Web-App (PWA).

Der Service-Tracker begann als Wartungsbegleiter für einen BMW E39 und funktioniert inzwischen für beliebige Fahrzeuge. Die App läuft komplett im Browser; die Daten bleiben auf dem Gerät, bis du selbst einen Abgleich einrichtest.

## Funktionen

- **Dashboard** mit fälligen Wartungen (OK / Bald fällig / Überfällig) je Fahrzeug
- **Wartungshistorie** mit Kosten, Kilometerstand, Notizen und Fotos
- **Tankbuch** und **Statistik** (Kosten, Verbrauch)
- **Eigene Fristen** (z. B. TÜV, Versicherung) und Fahrzeugnotizen
- **Mehrere Fahrzeuge**, Lackfarbe als Akzentfarbe der Oberfläche (Hell/Dunkel/Automatisch)
- **Erinnerungen** an fällige Wartungen: Benachrichtigung beim Öffnen, Symbol-Zähler, alles lokal ohne Server
- **Digitales Scheckheft**: eine öffentliche Momentaufnahme des Fahrzeugs (ohne Kosten, Notizen und Tankbuch) unter `/s/<id>`, per Link teilbar
- **Sicherung & Abgleich**: Backup als Datei, Sicherheitskopie im Browser und optionaler Abgleich über den eigenen Google Drive
- Funktioniert **offline** (Service Worker); Datenschutzerklärung und Impressum sind enthalten

## Aufbau

| Datei | Zweck |
| --- | --- |
| `index.html`, `app.js`, `style.css` | Oberfläche und Kernlogik |
| `extras.js`, `photos.js`, `reminders.js` | Fristen/Notizen/Sicherheitskopie, Fotos (IndexedDB), Erinnerungen |
| `sync.js` | Abgleich über Google Drive (nur App-Ordner, Scope `drive.appdata`) |
| `book.js`, `scheckheft.*` | Digitales Scheckheft (Veröffentlichen und öffentliche Ansicht) |
| `worker.js`, `wrangler.jsonc` | Cloudflare-Worker: liefert die App aus, API für das Scheckheft und den Google-Login |
| `sw.js`, `version.js`, `manifest.json` | Offline-Cache, Versionsnummer, PWA-Manifest |
| `assets/` | Schriften und QR-Code-Bibliothek |
| `docs/` | Einrichtung (Drive-Abgleich, Scheckheft), Testcheckliste, Design-Entwürfe (`design-previews/`) |

## Lokal ausprobieren

Keine Abhängigkeiten, kein Build-Schritt. Den Ordner über einen lokalen HTTP-Server öffnen, zum Beispiel:

```
python -m http.server 8765
```

und `http://localhost:8765` im Browser aufrufen. `file://` reicht für Service Worker und PWA-Installation nicht. Das digitale Scheckheft und der Google-Login benötigen den Worker (siehe unten).

## Einrichtung und Betrieb

- Deployment: Cloudflare Worker mit statischen Assets (`npx wrangler deploy`), siehe [docs/scheckheft-setup.md](docs/scheckheft-setup.md)
- Google-Drive-Abgleich: [docs/google-drive-sync.md](docs/google-drive-sync.md)
- Tests von Hand: [docs/test-checkliste.md](docs/test-checkliste.md)

## Mitarbeiten

- Direkt auf `main` arbeiten, keine Feature-Branches oder Pull Requests.
- Bei jedem Push, der App-Dateien ändert (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`), `APP_VERSION` in `version.js` um eins erhöhen – daran erkennen installierte Apps den neuen Stand („Update verfügbar“).
- Weitere Regeln stehen in [CLAUDE.md](CLAUDE.md).
