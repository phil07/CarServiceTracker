# Google-Drive-Synchronisierung einrichten

Die App kann ihre Daten über den **eigenen Google Drive** jedes Nutzers abgleichen.
Es gibt keinen Server des Entwicklers: Die Daten liegen im versteckten App-Ordner
(`appDataFolder`) im Drive des jeweiligen Nutzers. Die App sieht nur ihre eigene Datei
(`service-tracker-sync.json`). Dafür wird nur der Scope `drive.appdata` angefragt.

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
     (z. B. `https://<name>.github.io`, nur Ursprung, ohne Pfad und ohne Schrägstrich am Ende).
     Für Tests zusätzlich `http://localhost:8765`.
   - Weiterleitungs-URIs sind nicht nötig.
5. Die erzeugte **Client-ID** (endet auf `.apps.googleusercontent.com`) kopieren und in
   `sync.js` bei `GOOGLE_CLIENT_ID` eintragen. Die Client-ID ist öffentlich, kein Geheimnis.
   Ein Client-Secret wird **nicht** benötigt und darf nicht in die App.
6. Neue Version ausliefern (`version.js` erhöhen). Unter „Fahrzeug & Design“ erscheint der
   Abschnitt **Synchronisierung**.

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

## Grenzen

- Ohne eigenen Server gibt es keinen dauerhaften Login: Das Zugriffstoken gilt **1 Stunde**.
  Danach zeigt die App einen Hinweis „Mit Google Drive abgleichen“; ein Tipp genügt
  (Google bestätigt meist ohne erneute Eingabe).
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
