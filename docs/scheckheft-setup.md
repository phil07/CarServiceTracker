# Digitales Scheckheft – Einrichtung (Cloudflare)

Das Scheckheft braucht einen kleinen Server. Das ist der Worker in `worker.js`
(läuft zusammen mit der App bei Cloudflare, Free-Tier reicht) und ein Speicher (Workers KV).

## Was im Repository liegt
- `worker.js` – liefert die App aus und stellt `/api/book/…` (Schreiben nur mit Schlüssel, Lesen öffentlich) sowie `/s/<id>` bereit.
- `wrangler.jsonc` – Worker-Name `carservicetracker`, Assets aus dem Projektordner, KV-Binding `BOOKS`.
- `.assetsignore` – hält `worker.js`, `docs` usw. aus den öffentlichen Dateien heraus.
- `scheckheft.html/.css/.js` – öffentliche Ansicht.

## Einmalig in Cloudflare
1. Im Cloudflare-Dashboard unter **Workers & Pages → carservicetracker → Settings → Build** prüfen, dass der
   Deploy-Befehl `npx wrangler deploy` lautet. Ein Eintrag wie `npx wrangler deploy --assets=.`
   würde die `wrangler.jsonc` überschreiben; dann auf `npx wrangler deploy` ändern.
2. Beim nächsten Deploy legt Wrangler den KV-Namespace `BOOKS` automatisch an. Falls das nicht klappt:
   **Storage & Databases → KV → Create** (Name z. B. `service-tracker-books`), danach in `wrangler.jsonc` bei
   `kv_namespaces` die `"id": "<Namespace-ID>"` ergänzen.
3. Deploy abwarten. Schlägt der Build fehl, bleibt die alte Version online.

## Grenzen (Free-Tier)
- Workers KV: 1.000 Schreibvorgänge/Tag, 100.000 Lesevorgänge/Tag, 1 GB Speicher.
  Jede Veröffentlichung = 1 Schreibvorgang für die Daten + je 1 für jedes neue Foto.
- Wer die App kennt, kann Scheckhefte anlegen (Größenlimits: 1 MB Daten, 1,5 MB je Foto, 80 Fotos je Scheckheft).
  Bei Missbrauch in Cloudflare eine Rate-Limiting-Regel für `/api/book/*` anlegen.

## Datenschutz
Das Scheckheft ist öffentlich für alle mit dem Link. Der Datenschutz-Text (Abschnitt 8) beschreibt das;
bitte im Rahmen der Rechtsprüfung der Entwürfe mit prüfen.
