// Single source of truth for the app version.
// Bump this ONE value per release – sw.js (cache name) and app.js (menu display)
// both derive from it. Loaded in the window (before app.js) and in the service
// worker (via importScripts).
self.APP_VERSION = 'v57';
// In der nativen App (Capacitor) läuft die Oberfläche lokal; API-Aufrufe gehen an den Worker.
self.API_BASE = (self.Capacitor && self.Capacitor.isNativePlatform && self.Capacitor.isNativePlatform()) ? 'https://carservicetracker.iphilipp07-869.workers.dev' : '';
