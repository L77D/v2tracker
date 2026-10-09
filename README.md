# DETAR — WebAR-Karte (Engine + Beispielkarte)

Stand: 09.10.2026 · Übergabe an Studio2B GmbH zur Prüfung der CMS-Einbindung.

Man scannt eine gedruckte Karte mit dem Handy. Auf der Karte erscheint eine
Comic-Figur, mit der man ein Gespräch über einen Ausbildungsberuf führt:
Fragen nach Themen, freischaltbare Fragen, Rückfragen der Figur, Sprechblase,
Posen und Gesichtsanimation.

Die App ist eine **statische Website**. Es gibt keinen Build-Schritt, keinen
Server-Code, keine Datenbank, kein LLM und keine externe API. Alle
Laufzeit-Abhängigkeiten liegen im Repo.

**Rechte:** Die Rechte am eigenen Code liegen bei L77 (Michael Pogorzhelskiy). Die Nutzung durch
Studio2B GmbH regelt eine schriftliche Absprache. Fremdkomponenten stehen unter
ihren eigenen Lizenzen (siehe „Fremdkomponenten“).

---

## 1. Aufbau: Engine und Karten

```
index.html, js/, css/, assets/, vendor/   Engine — liegt einmal zentral, für alle Karten
karten/katalog.json                       Liste aller Karten
karten/<nr>/                              eine Karte — reiner Datenordner, kein Code
```

Die **Engine** wird einmal ausgeliefert. Ein Engine-Update gilt sofort für alle
Karten. Eine **Karte** ist nur ein Ordner mit Daten und Bildern. Eine neue Karte
fasst die Engine nicht an.

Für ein CMS heißt das: Es muss nur Kartenordner ablegen und den Katalog pflegen.
Die Engine bleibt unverändert.

Dieses Repo enthält genau eine Beispielkarte: `karten/000/`. Ihr Inhalt ist ein
Beispiel (Elektroniker\*in für Betriebstechnik bei „Musterbetrieb“). Aussagen
ohne belegte Quelle tragen im Text die Marke `[Annahme]`, die die App sichtbar
anzeigt. Das ist im Beispiel so gewollt.

## 2. Was ein Kartenordner enthält

```
karten/<nr>/
  daten.json          Kartendaten (Beruf, Firma, Figur, Kartenbilder)
  dialog.json         Gespräch der Figur
  figur/*.webp        Figur in Einzelteilen (Körper je Pose, Kopf, Gesichter)
  targets/<d>.json, targets/<d>_luminance.png   Erkennungsbild je Kartendesign
  logo.webp           Firmenlogo (optional)
```

Alle Dateien eines Kartenordners werden fertig geliefert. Das CMS legt sie nur
ab und verändert sie nicht.

Alle Pfade in `daten.json` gelten **relativ zum Kartenordner**.

### karten/katalog.json

```json
{ "karten": [ { "id": "000", "name": "…", "aktiv": true } ] }
```

- `id` = Kartennummer = Ordnername = Wert im Link (`?k=000`). Eine Nummer wird
  nie umbenannt und nie neu vergeben, weil sie im gedruckten QR-Code steht.
- `aktiv: false` zieht eine Karte zurück. Der Link zeigt dann einen Hinweis statt
  einer Fehlerseite.

### daten.json

| Feld | Pflicht | Inhalt |
|---|---|---|
| `format` | ja | Aufbau-Version, heute `2` |
| `id` | ja | Kartennummer, wie im Katalog |
| `profession` | ja | Berufsbezeichnung, z. B. „Elektroniker\*in für Betriebstechnik“ |
| `company` | ja | Firmenname (ersetzt `{firma}` in den Dialogtexten der Firmenfassung) |
| `companyLogo` | nein | Pfad zum Logo; `null` = Firmenname als Text im Startbildschirm |
| `companyNeutral` | ja | Ersatzwort für die Public-Fassung, z. B. „der Betrieb“ |
| `idleReturnMs` | nein | Wartezeit bis zum Ruhezustand in ms |
| `figur.posen` | ja | `{ "idle": "figur/body_idle.webp", … }` — `idle` ist Pflicht, weitere Posen frei benennbar |
| `figur.kopf` | ja | Kopf-Bild |
| `figur.gesicht` | ja | `{ "neutral", "blink", "talk" }` |
| `designs[]` | ja | Kartenbilder fürs Tracking: `id`, `name`, `target` (Pfad zur `.json`), `breiteMm` (Kartenbreite, Standard 63), `notiz`, optional `fassung` (`"firma"` oder `"public"`) |

### dialog.json

Zur Orientierung die Hauptfelder:
`art`, `persona`, `firmenbegriffe`, `themen`, `initial`, `greeting`, `asks`
(Rückfragen der Figur), `questions` (Fragen mit Freischaltungen und optionalem
Link) und `reentry` (Wiedereinstieg). Textfelder können eine Public-Fassung
tragen (`textPublic`, `labelPublic` …).

## 3. Links

| Link | Wirkung |
|---|---|
| `/?k=<nr>` | Firmenfassung der Karte |
| `/?k=<nr>P` (auch `p`) | Public-Fassung: ohne Firmenname, Logo und Firmenlink; eigenes Kartendesign mit `"fassung": "public"` |
| `/?design=<id>` | ein bestimmtes Kartendesign der Karte (nur zum Testen) |
| `/` ohne `?k` | Auffang-Seite „Scanne deine Karte“ — es startet keine Karte |

Beispiel: `/?k=000` startet die Beispielkarte.

Zum Testen sind in der Engine noch eingebaut: `?nosimd` (Engine-Variante ohne
SIMD erzwingen), `?nogyro` (Gyro-Unterstützung aus) und
`?preflight=inapp|nocam|insecure|nowasm|nowebp` (Hinweis-Bildschirme ansehen).

## 4. Hosting

- **Statisch:** Jeder Webserver oder jedes CDN, das Dateien ausliefert, reicht.
- **HTTPS ist Pflicht**, sonst gibt der Browser die Kamera nicht frei.
- **Alles von einer Domain:** Engine und `karten/` liegen unter derselben
  Adresse. Alle Pfade sind relativ, die App läuft auch in einem
  Unterordner.
- **Kein Bundler, kein Umbau:** Die Dateien werden so ausgeliefert, wie sie im
  Repo liegen.
- **MIME-Typen:** `.webp` als `image/webp`, `.js` als JavaScript-Modul.
- **Caching:** Die Karten-JSONs holt die App immer frisch (`no-store`). Safari
  speichert jede Engine-Datei einzeln zwischen. Nach einem Engine-Update sollten
  die Engine-Dateien deshalb kurze Cache-Zeiten haben oder versioniert
  ausgeliefert werden.
- **Unterstützte Browser:** ab iOS 14 und Chrome 80. Bei älteren Browsern, In-App-Browsern
  (z. B. Instagram) oder ohne Kamerazugriff zeigt die App selbst einen Hinweis.
- **Nicht in einen Rahmen einbetten:** Die App darf nicht über eine „getarnte“
  Weiterleitung in einem iframe laufen, weil die Kamera dann gesperrt ist.

## 5. Fremdkomponenten

| Komponente | Aufgabe | Lizenz | Ort |
|---|---|---|---|
| 8th Wall Engine (Niantic Spatial) | Tracker | MIT | `vendor/8thwall*/LICENSE` |
| three.js 0.160 | 3D-Library | MIT | `vendor/three/LICENSE` |
| tiks 0.3.0 | Sound-Library | MIT | Kopf von `js/vendor/tiks.js` |
| Jersey 10 | Font | SIL Open Font License 1.1 | `assets/fonts/OFL-Jersey10.txt` |
| Silkscreen | Font | SIL Open Font License 1.1 | `assets/fonts/OFL-Silkscreen.txt` |

Die Engine arbeitet vollständig im Browser. Sie ruft keinen Niantic-Server auf
und braucht keinen API-Schlüssel.
