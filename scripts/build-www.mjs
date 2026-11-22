// Baut www/ für die APK aus genau den Dateien, die auch die PWA ausliefert.
// Die Liste wird aus den HTML-Seiten gelesen, damit neue Dateien automatisch in der APK landen.
import { cpSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const PAGES = ['index.html', 'datenschutz.html', 'impressum.html', 'scheckheft.html'];
const EXTRA = ['manifest.json', 'version.js'];
const DIRS = ['assets', 'icons'];

const files = new Set([...PAGES, ...EXTRA]);
for (const page of PAGES) {
  const html = readFileSync(page, 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#?]+)/g)) {
    if (/^(https?:|data:|mailto:|tel:|\/\/)/.test(ref)) continue;
    const path = ref.replace(/^\.?\//, '');
    if (DIRS.some(d => path.startsWith(d + '/'))) continue;
    if (existsSync(path)) files.add(path);
  }
}

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of files) {
  mkdirSync(`www/${dirname(f)}`, { recursive: true });
  cpSync(f, `www/${f}`);
}
for (const d of DIRS) cpSync(d, `www/${d}`, { recursive: true });
console.log(`www/ bereit: ${files.size} Dateien (${[...files].sort().join(', ')}) + ${DIRS.join(', ')}`);
