// Sucht beim Start (höchstens einmal am Tag) und auf „Prüfen“ nach einer neueren GitHub-Release mit APK.
// Native App: APK wird im Hintergrund geladen; installiert wird nach Tippen auf „Installieren“,
// Android bestätigt die Installation immer selbst. Im Browser gibt es nur den Download-Link.
(function () {
  const REPO = 'phil07/CarServiceTracker';
  const CHECK_KEY = 'st_release_checked';
  const DISMISS_KEY = 'st_release_dismissed';
  const READY_KEY = 'st_release_ready';
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = name => window.Capacitor.Plugins[name];

  // 'v58' → 58; unbekannte Formate ergeben 0 und lösen keinen Hinweis aus.
  function versionNumber(v) {
    const m = String(v || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function readStore(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeStore(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  function toast(msg, variant) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'sys-toast sys-toast--' + (variant === 'ok' ? 'ok' : 'err');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Neueste Release mit APK oder { newer: false }.
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
      return { newer: true, tag, apkUrl: apk && apk.browser_download_url, apkName: apk && apk.name };
    } finally {
      clearTimeout(timer);
    }
  }

  // Native: APK in den Cache laden. Liefert den lokalen Pfad.
  async function downloadApk(r) {
    const res = await plugin('ApkUpdate').download({ url: r.apkUrl, name: r.apkName });
    writeStore(READY_KEY, JSON.stringify({ tag: r.tag, path: res.path }));
    return res.path;
  }

  function readyUpdate() {
    try { return JSON.parse(readStore(READY_KEY) || 'null'); } catch (e) { return null; }
  }

  function installReady(ready) {
    const apk = plugin('ApkUpdate');
    apk.canInstall().then(async ({ allowed }) => {
      if (!allowed) {
        toast('Erlaube die Installation für diese App und tippe danach erneut', 'err');
        await apk.openInstallSettings();
        return;
      }
      await apk.install({ path: ready.path });
    }).catch(() => toast('Installation nicht möglich', 'err'));
  }

  function showBanner(tag, action) {
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

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.style.cssText = 'padding:8px 14px;border:0;border-radius:999px;background:var(--accent,#B45309);color:#fff;font:600 14px inherit;cursor:pointer;';
    btn.addEventListener('click', action.run);

    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Hinweis schließen');
    close.textContent = '✕';
    close.style.cssText = 'border:0;background:none;color:inherit;font-size:16px;padding:4px 6px;cursor:pointer;';
    close.addEventListener('click', () => {
      writeStore(DISMISS_KEY, tag);
      bar.remove();
    });

    bar.append(text, btn, close);
    document.body.appendChild(bar);
  }

  // Zeigt den passenden Hinweis für eine neuere Version.
  async function offerRelease(r, manual) {
    if (!isNative()) {
      showBanner(r.tag, { label: 'APK laden', run: () => window.open(r.apkUrl, '_blank', 'noopener') });
      return;
    }
    const ready = readyUpdate();
    if (ready && ready.tag === r.tag) {
      showBanner(r.tag, { label: 'Installieren', run: () => installReady(ready) });
      return;
    }
    if (manual) toast('Lade Version ' + r.tag + ' …', 'ok');
    try {
      const path = await downloadApk(r);
      showBanner(r.tag, { label: 'Installieren', run: () => installReady({ tag: r.tag, path }) });
    } catch (e) {
      if (manual) toast('Download fehlgeschlagen', 'err');
    }
  }

  // Beim Start: höchstens einmal am Tag.
  async function checkForRelease() {
    if (!navigator.onLine) return;
    const last = parseInt(readStore(CHECK_KEY) || '0', 10);
    if (Date.now() - last < ONE_DAY) return;
    writeStore(CHECK_KEY, String(Date.now()));
    try {
      const r = await fetchNewerRelease(self.APP_VERSION);
      if (!r.newer || !r.apkUrl) return;
      if (readStore(DISMISS_KEY) === r.tag) return;
      await offerRelease(r, false);
    } catch (e) { /* kein Netz: still ignorieren */ }
  }

  // Auf „Prüfen“ (native App): zeigt immer ein Ergebnis.
  async function checkReleaseNow() {
    try {
      const r = await fetchNewerRelease(self.APP_VERSION);
      if (!r.newer) return toast('Du bist bereits auf der aktuellsten Version (' + self.APP_VERSION + ')', 'ok');
      if (!r.apkUrl) return toast('Version ' + r.tag + ' ist da, aber noch ohne APK', 'err');
      writeStore(DISMISS_KEY, '');
      await offerRelease(r, true);
    } catch (e) {
      toast('Update-Prüfung fehlgeschlagen', 'err');
    }
  }

  window.initReleaseCheck = checkForRelease;
  window.checkReleaseNow = checkReleaseNow;
})();
