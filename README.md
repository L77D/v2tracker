# DETAR — WebAR Trading Card (eigenständige App, ohne Zapworks)

Mobile WebAR-Demo: Karte scannen, Comic-Figur steht auf der Karte und führt
einen Dialog nach RPG-NPC-Vorbild (Fragen nach Themen, Freischaltungen,
Rückfragen der Figur) mit Sprechblase, Posen und Gesichtsanimation. Kompletter Port
des Zapworks/Mattercraft-Prototyps auf **Open-Source-Tracking** — keine
Lizenzkosten, kein Build-Schritt, eine einzige statische Website.

**Tracking (Branch `v2tracker-prod`, 2026-09-09):** 8th Wall Image
Targets aus der **Open-Source-8th-Wall-Engine** (MIT), selbst gehostet unter
`vendor/8thwall/` (WASM-SIMD) und `vendor/8thwall-nosimd/` (Fallback für
ältere Browser, automatisch gewählt) — nur Bildtracking, kein SLAM, kein
Niantic-Server, kein API-Key. Die Engine startet erst nach „Scan starten";
vorher prüft `js/preflight.js` In-App-Browser, HTTPS, Kamera-API, WASM und
WebP und zeigt sonst „Bitte im Browser öffnen" mit „Link kopieren". Umstieg,
Target-Erzeugung, Event-Zuordnung und die Production-Härtung mit Gate-Tabelle
(Mindestversionen: **iOS 14 / Chrome 80**): `docs/8thwall-migration.md`.
(`main` läuft noch auf MindAR.) Testlink des Branches:
https://l77d.github.io/v2tracker/ (Spiegel-Repo `L77D/v2tracker`, Pages von
dessen `main`).

**Zwei Editionen pro Karte:** Firmenversion (Standard) mit Logo/Firmenname im
Splash und Link zur Ausbildungsseite im Dialog, und die neutrale Public-
Version über das URL-Flag **`?public`** (im QR-Code der Public-Karte): kein
Firmenblock im Splash, Fragen mit `branded: true` entfallen, `{firma}` in
Texten wird neutral („der Betrieb"). Eine Kartendatei für beides
(`js/edition.js`).

**Engine und Karten getrennt (Build 63, 2026-10-06):** Die Engine
(`index.html`, `js/`, `css/`, `assets/`, `vendor/`) liegt einmal zentral; jede
Karte ist ein reiner Daten-Ordner `karten/<id>/` ohne Code — Dialog
(`karte.json`), Figurenbilder, Kartenbilder fürs Tracking, Desktop-Vorschau.
Welche Karte läuft, steht im QR-Code: **`?k=<id>`** (ohne Parameter die
Standard-Karte aus `karten/katalog.json`). Ein Engine-Update gilt sofort für
alle Karten; eine neue Karte fasst die Engine nicht an.

**Kein LLM, keine externe API, kein CDN im Live-Code** (einzige Ausnahme: das
Theatre.js-Studio unter dem Dev-Flag `?timeline` lädt sein Bundle von jsDelivr)
— alle Inhalte sind autorisiert und
liegen als Daten im Repo (`karten/<id>/karte.json`). Laufzeit-Abhängigkeiten liegen komplett im Repo:
three.js 0.160 als schlankes Bundle (`vendor/three/`, tree-shaken auf die
genutzten Klassen) + die zugeschnittene 8th-Wall-Engine (`vendor/8thwall/`).
Nach dem Klick geht kein Byte an Dritte. Schlank seit Branch `v2tracker-lean`
(2026-09-09): keine tuning.json (Werte sind Defaults in `js/config.js`),
Dev-Module nur per URL-Flag, Desktop-Modus als eigenes Modul, Einblick/Portal
und MindAR-Targets entfernt.

UI (Build 18, 2026-09-03) nach Figma „DETAR": Blau/Gelb/Schwarz, Pixel-Halo-
Kästen, Handy-Icon, Eck-Marker. Fonts: Jersey 10 + Silkscreen, beide SIL Open
Font License (`assets/fonts/`, Lizenztexte daneben; auf einen festen deutschen
Zeichensatz gekürzt — ASCII, Latin-1, Latin Extended-A, ẞ, Typografie —
`tools/build-fonts.sh`). Figur als WebP mit Alpha im Kartenordner
(`karten/<id>/figur/`, 768×1152).

---

## Veröffentlichen (GitHub Pages)

1. Auf github.com ein neues Repository anlegen (z. B. `detar-webar`, Public).
2. Diesen kompletten Ordner hochladen (Drag & Drop auf „uploading an existing
   file" funktioniert, oder GitHub Desktop).
3. Im Repo: **Settings → Pages → Source: „Deploy from a branch" → Branch:
   `main` / `/ (root)` → Save.**
4. Nach ~1 Minute läuft die App unter
   `https://<dein-name>.github.io/detar-webar/` — diese URL als QR-Code auf
   die Karte drucken.

Kamera-Zugriff braucht HTTPS — GitHub Pages liefert das automatisch.

## Lokal testen

Direktes Öffnen der Datei per Doppelklick funktioniert NICHT (ES-Module
brauchen einen Server). Im Ordner starten:

```
node tools/dev-server.js           # Port 8743, richtige MIME-Typen (.wasm/.webp), Cache aus
```

dann `http://localhost:8743/index.html?desktop&dev` öffnen (macOS: Doppelklick
auf `Start-Dev-Server.command`). Ein `python3 -m http.server` geht zur Not
auch, liefert `.wasm` aber ohne MIME-Typ.

* **`?desktop`** — Desktop-Testmodus ohne Kamera: Karte als Boden-Plane,
  Maus = Orbit/Zoom (wie der Lokal-Tuning-Prototyp). Zum Prüfen von
  Choreographie/Verhalten am Rechner: `http://localhost:8743/?desktop`
* **`?debug`** — pinke Hilfslinien (Lauffeld + FACE_CAM-Kegel), kombinierbar:
  `?desktop&debug`
* **`?dev`** — Tuning-Panel (alle Regler live, localStorage-persistent,
  Presets, tuning.json-Export, Replay, Tracking-Feature-Toggles 1–10). Bewusst
  OHNE Theatre — bleibt auch am Handy übersichtlich.
* **`?timeline`** — Theatre.js-Studio (visueller Keyframe-Editor, lädt das
  Bundle vom CDN). Für Animations-Arbeit am Rechner: `?desktop&dev&timeline`.
* **`?stats`** — Live-Diagnose am Handy: Tracking-/Gyro-Status, Jitter in mm,
  Gyro-Toggle, Build-Check, Engine-Variante. **`?nogyro`** — Gyro-Fusion
  komplett aus. **`?nosimd`** — Nicht-SIMD-Engine erzwingen.
  **`?preflight=inapp|nocam|insecure|nowasm|nowebp`** — Hinweis-Bildschirme
  der Vorabprüfung ansehen (nur Test). **`?public`** — Public-Edition (kein
  Test-Flag, steht im QR-Code der neutralen Karte). **`?k=<id>`** — Karte
  aus `karten/katalog.json` (ohne Parameter: Standard-Karte).
  **`?design=<id>`** — Kartenbild (Design) der Karte aus `karte.json → designs`
  (ohne Parameter: das erste, heute `card`; Test-Design `tarn`). Übersicht mit
  QR-Codes zum Umschalten am Handy: `karten.html`. (`?karte=` gibt es seit
  Build 63 nicht mehr.)

Flags sind frei kombinierbar (z. B. `?dev&stats` am Handy fürs Tracking-Tuning).

## Animationen / Timeline (Theatre.js)

Autorisierte Animations-Beats werden visuell gekeyframed statt programmiert:

1. `?desktop&dev&timeline` öffnen → Theatre-Studio erscheint (Outline links,
   Timeline unten). Objekt „Beats / Figur" animiert den `BeatRoot`-Wrapper
   (posX/Y/Z, rotY/Z, scale) — die reaktiven Behaviors (IdleWander, FACE_CAM)
   laufen unabhängig weiter und addieren sich dazu.
2. Keyframes setzen, scrubben, Kurven im Studio editieren;
   „▶ Timeline" im Dev-Panel spielt die Sequenz ab.
3. Dev-Panel → „Timeline exportieren" → die Datei als **`beats.theatre.json`**
   ins Repo-Root legen (steht in `.gitignore`).
4. Einen Live-Player-Pfad gibt es derzeit NICHT: ohne `?timeline` wird
   `timeline.js` weder geladen noch die JSON geholt (`main.js →
   attachDevTools`). Sollen autorisierte Beats live laufen, dort einen
   Player-Pfad ohne Flag öffnen.

Reaktives Verhalten (Watscheln, Kamera-Blick, Billboard) bleibt bewusst Code —
das lässt sich nicht keyframen, weil es auf die Kamera reagiert.

Am Handy testen ohne Deploy: Rechner und Handy im selben WLAN, dann
`http://<rechner-ip>:8743` — Achtung, Kamera geht nur über HTTPS; für echte
AR-Tests am Handy die GitHub-Pages-URL nehmen (push = live).

## Getunte Werte

Alle Dashboards (TYPO / FACE / IDLE / ACT / CHOREO / SCENE / STAB …) liegen als
Live-Werte in `js/config.js` — EINE Quelle. Für Tuning-Sessions: Dev-Panel
(`?dev`) → „tuning.json exportieren", die Datei ins Repo-Root legen und mit
`?dev` oder `?tuning` laden (nur dann wird sie geholt). Ergebnis danach in
`config.js` übernehmen, Datei nicht einchecken.

## Neue Karte / neuer Beruf

Eine Karte = ein Ordner, die Engine bleibt unangetastet:

```
karten/<id>/
  karte.json        Dialog + Figur + Designs ("format": 1)
  figur/            body_idle.webp (Pflicht) + weitere Posen, head.webp, face_*.webp
  targets/          <design>.json + <design>_luminance.png (image-target-cli)
  vorschau.jpg      Kartenbild für ?desktop (optional)
  logo.webp         Firmenlogo (optional)
```

1. Ordner `karten/elektroniker-siemens/` kopieren, neue `<id>` vergeben (kurz,
   Kleinbuchstaben, Bindestriche — steht im QR-Code und wird nie wieder
   geändert oder wiederverwendet).
2. `karte.json` anpassen: Texte/Fragen/Rückfragen/Link (Datenmodell und Regeln:
   `Dialogsystem/DETAR_Dialogsystem.md` im Projektordner; Emotion-Tags aus dem
   geschlossenen Vokabular, Highlight-Tags `<marker> <gross> <leise> <knall>`).
   Firmenbezug nur über `company`, `companyLogo`, `companyNeutral`, `{firma}`
   in Texten und `branded: true` an Fragen, die es nur in der Firmenversion
   gibt — dann funktioniert `?public` ohne zweite Datei. Pfade in `karte.json`
   gelten relativ zum Kartenordner.
3. Figur in `figur/` austauschen: aus den 1024×1536-PNGs des Nano-Banana-
   Workflows (gleiche Slicing-Positionen = Figuren-Vorlage) WebP mit Alpha in
   768×1152 erzeugen (exakt 2:3 — Pivots in `rig.js` sind relativ; Qualität 85,
   Lanczos auf premultipliziertem Alpha, s. Commit „Figur-PNGs → WebP").
   **Posen:** `figur.posen` listet `{name: bild}`. Die Standardposen heißen
   `idle`/`affirm`/`think`; Emotion-Tags werden über `POSES` in
   `js/config.js` darauf abgebildet. Eine **Sonderpose** nur dieser Karte:
   Bild ablegen, in `figur.posen` unter einem eigenen Namen eintragen und den
   Namen als `tag` an der Dialogzeile verwenden. Unbekannte Namen → `idle`.
4. Kartenbild als 8th-Wall-Target erzeugen (s. u.), Dateien nach `targets/`,
   Eintrag in `designs` (`id`, `name`, `target`, `breiteMm`, `notiz`).
5. Karte in `karten/katalog.json` eintragen (`id`, `name`, `aktiv: true`).
   QR-Code: `…/?k=<id>` (Public-Edition: `…/?k=<id>&public`).
6. Zeichen außerhalb des festen Schriftsatzes fallen auf die Systemschrift
   zurück — Prüfbefehl im Kopf von `tools/build-fonts.sh`.

Eine Karte zurückziehen: im Katalog `aktiv: false` (Link zeigt dann einen
Hinweis statt einer Fehlerseite).

## Tracking-Target (8th Wall) neu erzeugen

Ein Design = ein Kartenbild einer Karte. Weitere Designs derselben Karte (z. B.
das Test-Design `tarn`) liegen daneben in `karten/<id>/targets/` und stehen in
`designs` der `karte.json`; Aufruf per `?design=<id>`. (`docs/kartendesigns.md`
beschreibt noch den Stand vor Build 63 mit `targets/8thwall/` und `?karte`.)

Das Standard-Target `card` der Elektroniker-Karte ist aus dem beschnittenen
Kartenbild erzeugt (`Assets/September/demo_skat_070926_mind_cropped.png`,
1346×2156; Druckdatei `demo_skat_070926.jpg`). Bei neuem Karten-Layout:

1. `npx @8thwall/image-target-cli@latest` — Bildpfad, Typ `flat`, Default-Crop,
   Name = Design-id (Details und Pipe-Variante: `docs/8thwall-migration.md`,
   Abschnitt 1)
2. `<name>.json` und `<name>_luminance.png` nach `karten/<id>/targets/` legen
   und einchecken (Thumbnail, `_cropped`/`_original` braucht die App nicht)
3. Physische Breite = `breiteMm` des Designs in `karte.json` (Standard 63 mm;
   `SCENE.cardAspect` in `js/config.js` ist nur die Szenen-Geometrie der
   Eck-Marker; bei anderem Kartenformat mit anpassen)

Der Crop ist immer 3:4 (zentriert, volle Kartenbreite). Gute Targets: viel
Kontrast, viele unregelmäßige Details, matt gedruckt — dieselben Regeln wie
beim Zapworks-Training.

## Tracking-Glättung

Die Haupt-Glättung ist unser **PoseStabilizer** (`js/poseStabilizer.js`,
`STAB` in `js/config.js`): erst `minCutoff` senken, bis das Ruhe-Zittern weg
ist, dann `beta` erhöhen, bis schnelle Bewegungen ohne Nachziehen folgen —
eine Schraube pro Test, Zahlen in `?stats`. `lostHoldMs`/`GYRO.bridgeMs`
halten die Pose bei kurzem Tracking-Verlust. (`filterMinCF`/`filterBeta`/
`missTolerance`/`warmupTolerance` waren MindAR-intern und sind ohne Wirkung.)

## Struktur

```
index.html            Splash (DU SCANNST … START) + AR-Container + Overlays
css/app.css           Tokens, Splash, Support-Zeilen, Suchrahmen, Karte-verloren-Hinweis, Hinweis-Screens
css/question-menu.css Bottom-UI (Themen, Fragen-Karussell, Optionen, Weiter)
js/main.js            Boot, Engine-Variante (SIMD/nicht-SIMD), 8th-Wall-Setup (Pipeline-Modul), Figur-Tap, Loop
js/kartenLader.js     Karte laden (?k, ?design): Katalog, karte.json, Format-Prüfung, Pfade
js/preflight.js       Vorabprüfung im Splash (In-App-Browser, HTTPS, Kamera-API, WASM, WebP)
js/edition.js         Edition Firma/Public (?public): Karte filtern, {firma} ersetzen
js/version.js         Build-Nummer (?stats vergleicht mit dem Live-Stand)
js/util.js            gemeinsame Helfer (el, rand, normalizeAngle, finiteVec, progress)
js/config.js          ALLE Tuning-Dashboards + tuning.json-Merge
js/poseStabilizer.js  Tracking-Glättung (Median-Aufsetzen, One-Euro, SLERP, Dead-Zone, Lost-Hold)
js/poseArbiter.js     Schwerkraft-Schiedsrichter gegen den Pose-Flip (Toggle 10)
js/gyroFusion.js      Gyro-Deltas als Prediction + Verlust-Brücke
js/rig.js             Figuren-Hierarchie (Transforms aus Scene.zcomp), Körper je Pose der Karte
js/cardController.js  Choreographie + Dialogablauf: Scan → Pop-In → Begrüßung →
                      Hub (Themen → Fragen) → Antwort/Seiten → Rückfragen →
                      Ausstieg → Ruhezustand → Wiedereinstieg
js/dialogEngine.js    Gesprächszustand: Freischaltungen, Variable, Rückfragen
js/bubbleText.js      Markup-Parser (Highlight-Tags), Satz-/Wortgrenzen
js/idleWander.js      Watscheln, Bop, FACE_CAM, attending-Modus
js/speechBubble.js    Canvas-Typewriter-Bubble mit Seiten, Billboard
js/faceAnimator.js    Blinzeln + Mund-Sync
js/activationAnim.js  Pop-In beim ersten Scan, Einklappen beim Ausstieg (Figur-Scale)
js/activationFX.js    Eck-Marker auf der Karte + hüpfendes Handy-Icon (Aktivier-Phase)
js/questionMenu.js    Support-Zeilen + Dialog-Menü: Themenkacheln, Fragen mit Reitern,
                      Antwortoptionen, Weiter (DOM, Karussell)
js/supportUI.js       Handy-Icon (PNG-Frames) + Balken-Zeilen
js/sound.js, voice.js UI-Sounds (vendor/tiks.js, Web Audio) + Animalese-Stimme für den Typewriter
js/debugOverlay.js    pinke Hilfslinien (?debug)
js/statsOverlay.js    ?stats: Jitter in mm, Vision-Hz, Flip-Zeile, Build-Check
js/devPanel.js        ?dev: Regler für alle Dashboards, Toggles 1–10, Presets, Replay
js/timeline.js        ?timeline: Theatre.js-Studio (CDN)
js/desktopMode.js     ?desktop: Karte als Boden-Plane, Maus-Orbit (nur per Flag geladen)
js/phoneFrame.js      Smartphone-Rahmen für den Desktop-Modus
karten/katalog.json   Liste aller Karten + Standard-Karte (?k)
karten/<id>/          eine Karte: karte.json (Dialog, Figur, Designs), figur/, targets/, vorschau.jpg
assets/               nur Geteiltes: UI-Grafiken, Logos, Fonts (Subset)
karten.html           Übersicht Karte × Design mit QR-Codes (Umschalten am Handy)
vendor/qrcode/        qrcode-generator (MIT) für karten.html
vendor/8thwall/       Open-Source-8th-Wall-Engine, zugeschnitten (xr.js + xr-tracking.js, MIT, WASM-SIMD)
vendor/8thwall-nosimd/ dieselbe Engine ohne WASM-SIMD (Fallback, main.js wählt automatisch)
tools/build-fonts.sh  Font-Subset (pyftsubset, fester deutscher Zeichensatz) aus den Original-TTFs
tools/dev-server.js   lokaler Dev-Server (Port 8743, MIME-Typen, no-store)
tools/build-lokal-prototyp.py  Einzeldatei-Prototyp (patcht markierte Quelltextzeilen)
vendor/three/         three.js 0.160, tree-shaken (tools/build-three.sh)
docs/8thwall-migration.md  Umstieg MindAR → 8th Wall: Target-Erzeugung, Änderungen, Events
docs/kartendesigns.md      Kartendesigns (Stand vor Build 63, ?karte): lokaler Test mit cloudflared
```

## Technik-Notizen (für spätere Änderungen wichtig)

* **Koordinaten:** Zapworks lief im Anchor-Origin-Modus (Karte = Ursprung,
  Kamera bewegt sich), der PoseStabilizer arbeitet invertiert (Kamera =
  Ursprung, Anchor bewegt sich). 8th Wall liefert die Bildpose im Szenen-Frame;
  `main.js` rechnet sie in Kamera⁻¹ × Bild um, `stabRoot` hängt unter der
  Kamera. Figur + Bubble hängen unter `worldRoot` (Karten-Frame, Y =
  hoch von der Karte); alle „Wo ist die Kamera?"-Rechnungen laufen über
  `frame.getCamLocal()`. Die Behavior-Logik selbst ist 1:1 der Stand des
  Lokal-Prototyps (2026-07-06) inkl. umgebautem Walk, attending-Modus,
  Figur-Tap-Sprung, unten verankerter Bubble und HeadNod-Nick-Achse.
* **Skalierung:** Die Anchor-Scale ist die Kartenbreite (8th Wall:
  `scale × scaledWidth`, der 3:4-Crop behält die volle Breite) → eine Anchor-
  Einheit = eine Kartenbreite wie bei MindAR; `worldRoot` wird um
  `1/SCENE.cardWidth` skaliert, damit alle Prototyp-Werte (Lauffeld,
  Sprunghöhe, Bubble-Maße) unverändert gelten.
* **Painter's Algorithm:** depthTest AUS auf allen flachen Layern, feste
  renderOrder (Body 0, Head 1, Face 2, Bubble 3) — nie ändern, sonst
  verschwindet der Kopf hinter dem Body (siehe CLAUDE.md-Gotchas).
* **three.js ist gepinnt** (0.160.0, Bundle in `vendor/three/`) — nicht blind
  hochziehen; `XR8.Threejs` braucht das globale THREE ≥ r125 und dieselbe
  Instanz wie unsere Module (`window.THREE = THREE` in main.js). Neue
  `THREE.*`-Klasse im Code → `tools/three-slim-entry.js` + `tools/build-three.sh`.
* **Kompatibilität:** keine Importmap, keine JS-Syntax jenseits `?.`/`??` im
  Live-Code, Bilder als WebP, neues CSS mit Fallback — Gate-Tabelle und
  Begründung in `docs/8thwall-migration.md` Abschnitt 7.

© Studio2B — Demo. Logos: DEIN ERSTER TAG / PENNY (mit Erlaubnis).
