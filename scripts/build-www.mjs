// Kopiert nur die Dateien, die die App zur Laufzeit braucht, nach www/.
// Capacitor packt diesen Ordner in die APK.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = [
  'index.html', 'app.js', 'book.js', 'extras.js', 'photos.js', 'release-check.js',
  'reminders.js', 'sync.js', 'version.js', 'style.css', 'manifest.json',
  'legal.js', 'legal.css', 'datenschutz.html', 'impressum.html', 'scheckheft.html',
  'scheckheft.css', 'scheckheft.js',
];
const DIRS = ['assets', 'icons'];

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of FILES) cpSync(f, `www/${f}`);
for (const d of DIRS) cpSync(d, `www/${d}`, { recursive: true });
console.log(`www/ bereit: ${FILES.length} Dateien, ${DIRS.join(', ')}`);
