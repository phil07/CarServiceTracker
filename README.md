# Service-Tracker

Wartungs-, Kosten- und Tankbuch für das eigene Auto als installierbare Web-App (PWA). Läuft vollständig im Browser, funktioniert offline und speichert die Daten lokal – ein Abgleich über den eigenen Google Drive ist optional.

Entstanden für einen BMW E39, nutzbar für beliebige Fahrzeuge.

## Funktionen

- **Dashboard** mit fälligen Wartungen je Fahrzeug (OK, bald fällig, überfällig)
- **Wartungshistorie** mit Kosten, Kilometerstand, Notizen und Fotos
- **Tankbuch** und **Statistik** zu Kosten und Verbrauch
- **Eigene Fristen** (z. B. TÜV, Versicherung) und Fahrzeugnotizen
- **Mehrere Fahrzeuge**; Lackfarbe bestimmt die Akzentfarbe, Design hell, dunkel oder automatisch
- **Erinnerungen** an fällige Wartungen per Benachrichtigung und Symbol-Zähler, alles lokal
- **Digitales Scheckheft**: öffentliche Momentaufnahme des Fahrzeugs (ohne Kosten, Notizen und Tankbuch) unter `/s/<id>`, per Link teilbar
- **Sicherung**: Backup-Datei, Sicherheitskopie im Browser, optionaler Abgleich über Google Drive (nur App-Ordner)

## Schnellstart

Keine Abhängigkeiten, kein Build. Ordner über einen lokalen HTTP-Server ausliefern:

```bash
python -m http.server 8765
```

Anschließend `http://localhost:8765` öffnen. Service Worker und PWA-Installation benötigen HTTP(S). Das digitale Scheckheft und der Google-Login laufen über den Worker (siehe Deployment).

## Projektstruktur

| Datei | Zweck |
| --- | --- |
| `index.html`, `app.js`, `style.css` | Oberfläche und Kernlogik |
| `extras.js`, `photos.js`, `reminders.js` | Fristen und Notizen, Fotos (IndexedDB), Erinnerungen |
| `sync.js` | Abgleich über Google Drive (Scope `drive.appdata`) |
| `book.js`, `scheckheft.*` | Digitales Scheckheft: Veröffentlichen und öffentliche Ansicht |
| `worker.js`, `wrangler.jsonc` | Cloudflare-Worker: liefert die App aus, API für Scheckheft und Google-Login |
| `sw.js`, `version.js`, `manifest.json` | Offline-Cache, Versionsnummer, PWA-Manifest |
| `datenschutz.html`, `impressum.html`, `legal.*` | Rechtliche Seiten |
| `assets/` | Schriften und QR-Code-Bibliothek |
| `docs/` | Einrichtungsanleitungen |

## Deployment

Die App wird als Cloudflare Worker mit statischen Assets ausgeliefert:

```bash
npx wrangler deploy
```

Einrichtung des Scheckhefts (KV-Speicher): [docs/scheckheft-setup.md](docs/scheckheft-setup.md)
Google-Drive-Abgleich (OAuth-Client): [docs/google-drive-sync.md](docs/google-drive-sync.md)

## Datenschutz

Fahrzeugdaten bleiben im Browser, bis du den Drive-Abgleich oder das Scheckheft selbst aktivierst. Der Drive-Abgleich nutzt den versteckten App-Ordner im eigenen Konto; es gibt keinen Server des Entwicklers mit Zugriff auf die Daten. Das Scheckheft veröffentlicht nur, was du ausdrücklich teilst.

## Mitarbeiten

- Nur der Branch `main` existiert; direkt dorthin committen, keine Pull Requests.
- Bei jedem Push, der App-Dateien ändert (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`), `APP_VERSION` in `version.js` um eins erhöhen. Daran erkennen installierte Apps den neuen Stand.
