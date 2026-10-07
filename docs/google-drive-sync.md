# Google-Drive-Synchronisierung einrichten

Die App kann ihre Daten über den **eigenen Google Drive** jedes Nutzers abgleichen.
Es gibt keinen Server des Entwicklers: Die Daten liegen im versteckten App-Ordner
(`appDataFolder`) im Drive des jeweiligen Nutzers. Die App sieht nur ihre eigenen Dateien:
`service-tracker-sync.json` (Daten) und `photo-<id>.jpg` (je Foto, auf ca. 1400 px verkleinert). Dafür wird nur der Scope `drive.appdata` angefragt.

Solange keine Client-ID eingetragen ist, bleibt die Funktion unsichtbar und die App
arbeitet rein lokal.

## Einmalige Einrichtung (ca. 15 Minuten, kostenlos)

1. **Google Cloud Console** öffnen (console.cloud.google.com) und ein neues Projekt anlegen,
   z. B. „Service-Tracker“.
2. **APIs & Dienste → Bibliothek →** „Google Drive API“ suchen und **aktivieren**.
3. **APIs & Dienste → OAuth-Zustimmungsbildschirm** (bzw. „Google Auth Platform“):
   - Nutzertyp **Extern**.
   - App-Name, Support-E-Mail und Kontakt-E-Mail eintragen.
   - Link zur **Datenschutzerklärung** und zur App-Startseite eintragen.
   - **Scopes:** nur `…/auth/drive.appdata` hinzufügen (wird als nicht-sensibel eingestuft).
   - Zunächst bleibt die App im Status **„Wird getestet“**. Dann dürfen sich nur eingetragene
     **Testnutzer** (max. 100) anmelden. Für beliebige Nutzer auf **„In Produktion“**
     veröffentlichen. Bei ausschließlich nicht-sensiblen Scopes ist dafür in der Regel keine
     Google-Prüfung nötig. Die aktuellen Regeln stehen in der Google-Dokumentation.
4. **Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID:**
   - Anwendungstyp **Webanwendung**.
   - **Autorisierte JavaScript-Quellen:** die Adresse, unter der die App läuft
     (für diese App: `https://carservicetracker.iphilipp07-869.workers.dev`, nur Ursprung, ohne Pfad und ohne Schrägstrich am Ende).
     Für Tests zusätzlich `http://localhost:8765`.
   - Weiterleitungs-URIs sind nicht nötig.
5. Die erzeugte **Client-ID** (endet auf `.apps.googleusercontent.com`) kopieren und in
   `sync.js` bei `GOOGLE_CLIENT_ID` eintragen. Die Client-ID ist öffentlich, kein Geheimnis.
   Ein Client-Secret wird **nicht** benötigt und darf nicht in die App.
6. **Dauerhafte Anmeldung (Worker-Secrets)**, damit der Abgleich ohne erneutes Bestätigen im
   Hintergrund läuft. In der Google Cloud Console unter Clients beim Web-Client ein **Client-Secret**
   erzeugen und beide Werte als Secrets am Worker hinterlegen (nicht ins Repo):
   - `npx wrangler secret put GOOGLE_CLIENT_SECRET`
   - `npx wrangler secret put GAUTH_KEY` – eine zufällige Zeichenkette (mind. 32 Zeichen),
     z. B. aus `openssl rand -base64 48`. Damit wird das Refresh-Token im Cookie verschlüsselt.
     Wird der Schlüssel geändert, müssen sich alle Nutzer einmal neu verbinden.

   Ohne diese Secrets funktioniert die Synchronisierung weiter, aber nur mit 1-Stunden-Token (siehe Grenzen).
7. Neue Version ausliefern (`version.js` erhöhen). Unter „Fahrzeug & Design“ erscheint der
   Abschnitt **Synchronisierung**.

## Hinweis zur Adresse `workers.dev`

Die App läuft unter `*.workers.dev` (Cloudflare). Diese Domain steht auf der Public-Suffix-Liste.
Für den Testbetrieb (Status „Wird getestet“, eingetragene Testnutzer) ist das unkritisch.
Beim Veröffentlichen („In Produktion“) kann Google verlangen, dass die Domain des Zustimmungsbildschirms
dir gehört und verifiziert ist. Bei `workers.dev` ist das nicht möglich. Dann braucht die App eine
eigene Domain (in Cloudflare als „Custom Domain“ an den Worker hängbar); die Client-ID muss danach um
den neuen Ursprung ergänzt werden.

## Wie es funktioniert

- Jedes Gerät behält eine vollständige lokale Kopie und funktioniert offline.
- Beim Abgleich wird die Datei aus Drive geladen, mit dem lokalen Stand **zusammengeführt**
  (pro Eintrag gewinnt die neuere Änderung, Löschungen werden über Löschmarken übernommen)
  und zurückgeschrieben. Es wird nichts blind überschrieben.
- Abgleich nach Änderungen (nach wenigen Sekunden), beim Öffnen der App und beim Zurückkehren
  in die App.
- Beim ersten Verbinden mit **unterschiedlichen Fahrzeugen** (VIN) auf Gerät und Drive fragt
  die App nach, statt Daten zu vermischen.
- Auf einem neuen Gerät: Startbildschirm → „Aus Google Drive laden“.

## Fotos

- Jedes Foto liegt als eigene Datei im App-Ordner. Neue Fotos werden beim Abgleich hochgeladen,
  fehlende auf einem anderen Gerät heruntergeladen.
- Entfernte Fotos werden in der Cloud frühestens nach einer Stunde gelöscht (Schutz vor Rennen
  zwischen zwei Geräten).
- Das Aufräumen und „Daten in Google Drive löschen“ entfernen auch die Fotodateien.

## Grenzen

- Dauerhafter Abgleich im Hintergrund: Der Worker (`/api/gauth/`) tauscht beim Verbinden den Code gegen ein
  Refresh-Token und legt es AES-GCM-verschlüsselt als httpOnly-Cookie (`cst_grt`) im Browser ab. Danach holt die App
  still neue Zugriffstokens; der Worker speichert nichts. Google gibt das Refresh-Token nur bei der ersten
  Zustimmung heraus – wer der App schon vorher (1-Stunden-Variante) zugestimmt hat, entfernt den Zugriff einmal unter
  myaccount.google.com → Sicherheit → Drittanbieter-Apps und verbindet neu.
- Ohne Worker-Secrets gilt das Zugriffstoken nur **1 Stunde**. Danach zeigt die App einen Hinweis
  „Mit Google Drive abgleichen“; ein Tipp genügt.
- Gleichzeitiges Bearbeiten auf zwei Geräten ist möglich. Bei demselben Eintrag gilt die
  spätere Änderung. Das geht nach Uhrzeit der Geräte, die Uhren sollten also stimmen.
- Die Anmeldung in einer auf den Homescreen installierten Web-App kann auf dem iPhone
  eingeschränkt sein (Popup-Verhalten von iOS). Der Datei-Export bleibt als Alternative.

## Datenschutz (Stichpunkte für die Datenschutzerklärung)

- Daten liegen im Google-Drive-Konto des Nutzers; der Betreiber der App erhält sie nicht.
- Beim Verbinden wird `accounts.google.com/gsi/client` geladen und Google verarbeitet die
  Anmeldung (Google als eigener Verantwortlicher bzw. nach dessen Bedingungen).
- Trennen und Löschen: „Trennen“ beendet die Synchronisierung, „Daten in Google Drive löschen“
  entfernt die Datei.
- Die VIN-Abfrage beim Einrichten geht an die US-Behörde NHTSA (`vpic.nhtsa.dot.gov`).
