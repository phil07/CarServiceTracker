# Git Workflow

- **Work directly on `main`.** Do not create feature branches or pull requests; commit and push straight to `main`.

# Release Versioning

- **MUST bump `version.js` (`APP_VERSION`, e.g. `v2` → `v3`) by one on every push that changes app files** (`index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`). The service worker cache name derives from it, and the bump is what makes installed apps detect the new build and show the "Update verfügbar" toast.

# Design

- Visual style follows the Japan2026 PWA ("Bezel" layer: Plus Jakarta Sans, floating island header, full-screen menu, double-bezel cards, pill CTAs, light/dark/auto theme). The accent color comes from the selected vehicle paint color (`BMW_COLORS` in `app.js` → `--car-light` / `--car-dark`).
