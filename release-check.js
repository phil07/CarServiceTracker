// Prüft beim Start (höchstens einmal am Tag), ob es auf GitHub eine neuere Release
// mit APK gibt, und zeigt dann einen Hinweis mit Download-Link.
// Die APK installiert Android nur nach Bestätigung durch den Nutzer.
(function () {
  const REPO = 'phil07/CarServiceTracker';
  const CHECK_KEY = 'st_release_checked';
  const DISMISS_KEY = 'st_release_dismissed';
  const ONE_DAY = 24 * 60 * 60 * 1000;

  // 'v55' → 55; unbekannte Formate ergeben 0 und lösen keinen Hinweis aus.
  function versionNumber(v) {
    const m = String(v || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function showBanner(tag, apkUrl) {
    if (document.getElementById('release-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'release-banner';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9000;' +
      'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;' +
      'background:var(--surface,#fff);color:var(--text,#111);box-shadow:0 8px 28px rgba(0,0,0,.18);' +
      'font:500 14px/1.35 "Plus Jakarta Sans",system-ui,sans-serif;';

    const text = document.createElement('span');
    text.style.flex = '1';
    text.textContent = 'Neue Version ' + tag + ' verfügbar';

    const link = document.createElement('a');
    link.href = apkUrl;
    link.rel = 'noopener';
    link.textContent = 'APK laden';
    // In der nativen App lädt die WebView APKs nicht; der System-Browser übernimmt den Download.
    link.addEventListener('click', e => {
      const browser = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
      if (!browser || !(window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
      e.preventDefault();
      browser.open({ url: apkUrl });
    });
    link.style.cssText = 'padding:8px 14px;border-radius:999px;background:var(--accent,#B45309);color:#fff;text-decoration:none;font-weight:600;';

    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Hinweis schließen');
    close.textContent = '✕';
    close.style.cssText = 'border:0;background:none;color:inherit;font-size:16px;padding:4px 6px;cursor:pointer;';
    close.addEventListener('click', () => {
      writeStore(DISMISS_KEY, tag);
      bar.remove();
    });

    bar.append(text, link, close);
    document.body.appendChild(bar);
  }

  function toast(msg, variant) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'sys-toast sys-toast--' + (variant === 'ok' ? 'ok' : 'err');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Liefert die neueste Release mit APK oder null, wenn es keine neuere gibt.
  async function fetchNewerRelease(current) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('GitHub ' + res.status);
      const release = await res.json();
      const tag = release.tag_name || '';
      if (versionNumber(tag) <= versionNumber(current)) return { newer: false, tag };
      const apk = (release.assets || []).find(a => /\.apk$/i.test(a.name));
      return { newer: true, tag, apkUrl: apk && apk.browser_download_url };
    } finally {
      clearTimeout(timer);
    }
  }

  // Manuell über „Prüfen“ (native App): zeigt immer ein Ergebnis.
  async function checkReleaseNow() {
    try {
      const r = await fetchNewerRelease(self.APP_VERSION);
      if (!r.newer) return toast('Du bist bereits auf der aktuellsten Version (' + self.APP_VERSION + ')', 'ok');
      if (!r.apkUrl) return toast('Version ' + r.tag + ' ist da, aber noch ohne APK', 'err');
      writeStore(DISMISS_KEY, '');
      showBanner(r.tag, r.apkUrl);
    } catch (e) {
      toast('Update-Prüfung fehlgeschlagen', 'err');
    }
  }

  async function checkForRelease() {
    if (!navigator.onLine) return;
    const current = self.APP_VERSION;
    const last = parseInt(readStore(CHECK_KEY) || '0', 10);
    if (Date.now() - last < ONE_DAY) return;
    writeStore(CHECK_KEY, String(Date.now()));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!res.ok) return;
      const release = await res.json();
      const tag = release.tag_name || '';
      if (versionNumber(tag) <= versionNumber(current)) return;
      if (readStore(DISMISS_KEY) === tag) return;

      const apk = (release.assets || []).find(a => /\.apk$/i.test(a.name));
      if (!apk || !apk.browser_download_url) return;
      showBanner(tag, apk.browser_download_url);
    } catch (e) {
      // Kein Netz oder GitHub nicht erreichbar: still ignorieren.
    } finally {
      clearTimeout(timer);
    }
  }

  window.initReleaseCheck = checkForRelease;
  window.checkReleaseNow = checkReleaseNow;
})();
