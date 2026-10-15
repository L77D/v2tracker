# DETAR — WebAR-Karte (Engine + Beispielkarte)

Stand: 15.10.2026 · Übergabe an Studio2B GmbH zur Prüfung der CMS-Einbindung.

Man scannt eine gedruckte Karte mit dem Handy. Auf der Karte erscheint eine
Comic-Figur, mit der man ein Gespräch über einen Ausbildungsberuf führt:
Fragen nach Themen, freischaltbare Fragen, Rückfragen der Figur, Sprechblase,
Posen und Gesichtsanimation.

Die App ist eine **statische Website**. Es gibt keinen Build-Schritt, keinen
Server-Code, keine Datenbank, kein LLM und keine externe API. Alle
Laufzeit-Abhängigkeiten liegen im Repo.

**Rechte:** Die Rechte am eigenen Code liegen bei Michael Pogorzhelskiy. Die
Nutzung durch Studio2B wird gesondert vereinbart. Fremdkomponenten stehen unter
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

Unser Vorschlag für die Arbeitsteilung: Das CMS legt nur Kartenordner ab und
pflegt den Katalog. Die Engine bleibt unverändert.

Dieses Repo enthält genau eine Beispielkarte: `karten/00/`. Ihr Inhalt ist ein
Beispiel (Elektroniker\*in für Betriebstechnik bei „Musterbetrieb“). Die
Struktur ist vollständig wie bei einer Produktionskarte; wo Material fehlt,
stehen Platzhalter: das Logo ist ein neutraler Platzhalter, und beide
Kartendesigns nutzen dasselbe Kartenbild (bei einer Produktionskarte: eines mit
Logo, eines ohne). Aussagen ohne belegte Quelle tragen im Text die Marke
`[Annahme]`; die Figur spricht sie sichtbar mit. Das ist im Beispiel so
gewollt: Die Marke zeigt, welche Aussagen vor der Freigabe einer Karte noch zu
bestätigen sind.

## 2. Was ein Kartenordner enthält

```
karten/<code>/
  daten.json          Kartendaten (Beruf, Firma, Figur, Kartenbilder)
  dialog.json         Gespräch der Figur
  figur/*.webp        Figur in Einzelteilen (Körper je Pose, Kopf, Gesichter)
  targets/firma.json, targets/firma_luminance.png     Erkennungsdaten der Firmenkarte (S, B)
  targets/public.json, targets/public_luminance.png   Erkennungsdaten der Public-Karte (P)
  logo.webp           Firmenlogo (optional)
```

Vorgesehen ist, dass alle Dateien eines Kartenordners fertig geliefert werden
und das CMS sie nur ablegt, ohne sie zu verändern.

Die Erkennungsdaten (`targets/*.json` und das Luminanz-Bild daneben) kommen so
aus dem Werkzeug, das sie aus dem Kartenbild erzeugt. Die JSON nennt unter
`resources` weitere Dateien (Original, Zuschnitt, Vorschaubild); die liegen
nicht bei und werden nicht gebraucht. Die App liest nur die Erkennungsdaten
und sucht das Luminanz-Bild neben der JSON.

Alle Pfade in `daten.json` gelten **relativ zum Kartenordner**.

### karten/katalog.json

```json
{ "karten": [ { "id": "00", "name": "…", "aktiv": true } ] }
```

- `id` = Kartencode = Ordnername = Wert im Link (`?k=00`). Nur Großbuchstaben
  und Ziffern, z. B. `A1`. Ein Code wird nie umbenannt und nie neu vergeben,
  weil er im gedruckten QR-Code steht.
- `aktiv: false` zieht eine Karte zurück. Der Link zeigt dann einen Hinweis statt
  einer Fehlerseite.

### daten.json

| Feld | Pflicht | Inhalt |
|---|---|---|
| `format` | ja | Aufbau-Version, heute `2` |
| `id` | ja | Kartencode, wie im Katalog |
| `profession` | ja | Berufsbezeichnung, z. B. „Elektroniker\*in für Betriebstechnik“. Die Schriften enthalten einen festen Zeichensatz (Deutsch und westeuropäische Sonderzeichen); andere Zeichen fallen auf die Systemschrift zurück |
| `company` | ja | Firmenname (ersetzt `{firma}` in den Dialogtexten der Firmenfassung) |
| `companyLogo` | nein | Pfad zum Logo (jedes Bildformat, das der Browser anzeigt; der Kasten ist dunkelgrau, helle Logos sind besser lesbar); `null` = Firmenname als Text im Startbildschirm |
| `companyNeutral` | ja | Ersatzwort für die Public-Fassung, z. B. „der Betrieb“ |
| `idleReturnMs` | nein | Lesezeit nach einer Antwort in ms, danach verschwindet die Sprechblase; ohne Angabe 11000 |
| `figur.posen` | ja | `{ "idle": "figur/body_idle.webp", … }` — `idle` ist Pflicht, weitere Posen frei benennbar |
| `figur.kopf` | ja | Kopf-Bild |
| `figur.gesicht` | ja | `{ "neutral", "blink", "talk" }` |
| `designs[]` | ja | Kartenbilder fürs Tracking: `id`, `name`, `target` (Pfad zur `.json`), `breiteMm` (Kartenbreite, Standard 63), `notiz`, optional `fassung` (`"firma"` oder `"public"`) |

Ohne `?design` nimmt die App das erste Design der passenden Fassung: Varianten
S und B nutzen `"firma"`, Variante P nutzt `"public"`. Fehlt `fassung`, gilt
ein Design als `"firma"`. Hat eine Karte kein Public-Design, nimmt P das erste
Design.

### dialog.json

Zur Orientierung die Hauptfelder:
`art`, `persona`, `firmenbegriffe`, `themen`, `initial`, `greeting`, `asks`
(Rückfragen der Figur), `questions` (Fragen mit Freischaltungen und optionalem
Link) und `reentry` (Wiedereinstieg). Textfelder können eine Public-Fassung
tragen (`textPublic`, `labelPublic` …), die nur in Variante P gilt. Fragen mit
`link: true` gibt es nur in Variante B, Fragen mit `branded: true` nicht in P.

Wie ein Dialog aufgebaut, geschrieben und geprüft wird (Freischaltungen,
Rückfragen, Textlängen, Public-Fassungen), kann bei Bedarf als eigenes
Dokument nachgeliefert werden. Für die Einbindung ins CMS ist das nicht nötig:
`dialog.json` wird fertig geliefert und nur abgelegt.

## 3. Links und Varianten

Jede Karte gibt es in drei Varianten. Der Link trägt den Kartencode und den
Varianten-Buchstaben:

| Variante | Link | Startbildschirm | Link-Frage im Dialog | Texte |
|---|---|---|---|---|
| **S** Schulprogramm | `/?k=A1&v=S` oder `/?k=A1` | Logo oder Firmenname | nein | Firmenfassung |
| **B** Auslieferung an Kunden | `/?k=A1&v=B` | Logo oder Firmenname | ja | Firmenfassung |
| **P** Public-Produkt | `/?k=A1&v=P` | ohne Firmenblock | nein | Public-Fassung, eigenes Kartendesign mit `"fassung": "public"` |

Weitere Regeln:

| Link | Wirkung |
|---|---|
| `/?k=A1` ohne `v` oder mit unbekanntem `v` | Variante S |
| `/?k=a1&v=b` | Code und Variante werden groß gelesen |
| `/?k=A1&v=B&design=<id>` | ein bestimmtes Kartendesign der Karte, z. B. `design=public` (nur zum Testen) |
| `/?k=00P` (auch `p`) | Alias für `v=P`, nur hinter einem Zahlencode |
| `/` ohne `?k` | Auffang-Seite „Scanne deine Karte“ — es startet keine Karte |

Beispiel: `/?k=00&v=B` startet die Beispielkarte als Kundenkarte.

**Pfad-Form `DETAR.IO/A1/S`.** Die App liest nur die Query-Form. Die gedruckte
Pfad-Form leitet der Webserver mit einer Regel um; das ist die einzige
Stelle, die beim Hosting dazukommt. Die Beispiele sind Vorlagen und nicht auf
einem Server getestet; sie erlauben zwei- und dreistellige Codes, damit auch
die Beispielkarte `00` passt:

```
# Nginx
location ~ ^/([A-Z0-9]{2,3})(?:/([SBP]))?/?$ { return 302 /?k=$1&v=$2; }

# Apache (.htaccess, mod_rewrite)
RewriteEngine On
RewriteRule ^([A-Z0-9]{2,3})(?:/([SBP]))?/?$ /?k=$1&v=$2 [R=302,L]
```

Ohne Varianten-Segment landet `/A1` so bei `/?k=A1&v=`, und die App nimmt S.
Liegt die App in einem Unterordner, gehört dieser vor das `/?k=`. Ein Hosting
ohne Umleitungsregeln (z. B. GitHub Pages) kann stattdessen je Link einen
Ordner mit einer Weiterleitung ablegen. Für die Beispielkarte liegen diese
Ordner bei: `00/`, `00/S/`, `00/B/`, `00/P/` (je eine `index.html`, die auf
`?k=00&v=…` weiterleitet). Damit funktionieren `/00`, `/00/S`, `/00/B` und
`/00/P` auch ohne Server-Regel, sofern der Server für einen Ordner die
`index.html` ausliefert (bei GitHub Pages und üblichen Webservern der Fall).
Mit Server-Regel sind die Ordner überflüssig.

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
- **Caching:** Die JSON-Dateien einer Karte (Katalog, `daten.json`,
  `dialog.json`, Target-JSON) holt die App immer frisch (`no-store`). Alle
  anderen Dateien, auch das Luminanz-Bild und die Bilder der Karte, laufen über
  den normalen Browser-Cache; Safari speichert dabei jede Datei einzeln. Nach
  einem Engine-Update sollten die Engine-Dateien deshalb kurze Cache-Zeiten
  haben oder versioniert ausgeliefert werden.
- **Unterstützte Browser:** ausgelegt für iOS ab 14 und Chrome ab 80, geprüft
  auf aktuellen Geräten. Bei älteren Browsern, In-App-Browsern (z. B. Instagram)
  oder ohne Kamerazugriff zeigt die App selbst einen Hinweis.
- **Nicht in einen Rahmen einbetten:** Die App nicht in einen iframe einer
  anderen Domain einbetten; dort bleibt die Kamera gesperrt, sofern der Rahmen
  nicht ausdrücklich `allow="camera"` setzt.

## 5. Fremdkomponenten

| Komponente | Aufgabe | Lizenz | Ort |
|---|---|---|---|
| 8th Wall Engine (Niantic Spatial) | Tracker | MIT | `vendor/8thwall*/LICENSE` |
| three.js 0.160 | 3D-Library | MIT | `vendor/three/LICENSE` |
| tiks 0.3.0 | Sound-Library | MIT | `js/vendor/LICENSE-tiks.txt` |
| Jersey 10 | Font | SIL Open Font License 1.1 | `assets/fonts/OFL-Jersey10.txt` |
| Silkscreen | Font | SIL Open Font License 1.1 | `assets/fonts/OFL-Silkscreen.txt` |

Die 8th-Wall-Engine ist ein eigener Build der offenen Quellen
(github.com/8thwall/8thwall, Quellstand vom 05.09.2026), ohne die hier
ungenutzten Teile (Gesichtserkennung, Framework-Adapter, Aufnahme). Beide
Varianten (`vendor/8thwall/` mit WASM-SIMD, `vendor/8thwall-nosimd/` ohne)
stammen aus demselben Quellstand; die App wählt am Gerät automatisch. three.js
ist auf die genutzten Klassen gekürzt, die Fonts sind auf einen festen
Zeichensatz gekürzt. Die Engine arbeitet vollständig im Browser. Sie ruft
keinen Niantic-Server auf und braucht keinen API-Schlüssel.
