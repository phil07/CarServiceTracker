# Service-Tracker

[Deutsch](README.md) · **English**

A maintenance, cost, and fuel log for your own car as an installable web app (PWA). It runs entirely in the browser, works offline, and stores data locally – syncing through your own Google Drive is optional.

Built for a BMW E39, usable for any vehicle.

## Features

- **Dashboard** with due maintenance per vehicle (OK, due soon, overdue)
- **Maintenance history** with costs, mileage, notes, and photos
- **Fuel log** and **statistics** on costs and consumption
- **Custom deadlines** (e.g. inspection, insurance) and vehicle notes
- **Multiple vehicles**; the paint color sets the accent color, theme light, dark, or automatic
- **Reminders** for due maintenance via notification and app badge, all handled locally
- **Digital service book**: a public snapshot of the vehicle (without costs, notes, and fuel log) at `/s/<id>`, shareable by link
- **Backup**: backup file, in-browser safety copy, optional Google Drive sync (app folder only)

## Quick start

No dependencies, no build. Serve the folder with a local HTTP server:

```bash
python -m http.server 8765
```

Then open `http://localhost:8765`. Service workers and PWA installation require HTTP(S). The digital service book and Google sign-in run through the worker (see Deployment).

## Project structure

| File | Purpose |
| --- | --- |
| `index.html`, `app.js`, `style.css` | UI and core logic |
| `extras.js`, `photos.js`, `reminders.js` | Deadlines and notes, photos (IndexedDB), reminders |
| `sync.js` | Google Drive sync (scope `drive.appdata`) |
| `book.js`, `scheckheft.*` | Digital service book: publishing and the public view |
| `worker.js`, `wrangler.jsonc` | Cloudflare Worker: serves the app, API for the service book and Google sign-in |
| `sw.js`, `version.js`, `manifest.json` | Offline cache, version number, PWA manifest |
| `datenschutz.html`, `impressum.html`, `legal.*` | Legal pages |
| `assets/` | Fonts and QR-code library |
| `docs/` | Setup guides (German) |

## Deployment

The app is served as a Cloudflare Worker with static assets:

```bash
npx wrangler deploy
```

Service book setup (KV storage): [docs/scheckheft-setup.md](docs/scheckheft-setup.md)
Google Drive sync (OAuth client): [docs/google-drive-sync.md](docs/google-drive-sync.md)

## Privacy

Vehicle data stays in the browser until you enable Drive sync or the service book yourself. Drive sync uses the hidden app folder in your own account; there is no developer server with access to your data. The service book publishes only what you explicitly share.

## Contributing

- Only the `main` branch exists; commit directly to it, no pull requests.
- On every push that changes app files (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`), increase `APP_VERSION` in `version.js` by one. Installed apps use it to detect the new build.
