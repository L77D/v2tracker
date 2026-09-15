# CLAUDE.md — DETAR WebAR

Stand: 2026-09-15 · Build 61 (Branch `v2tracker-prod`: 8th Wall + Entschlackung + Production-Härtung + Editionen ?public + Kartendesigns ?karte + Schwerkraft-Schiedsrichter gegen den Pose-Flip + Refactoring Stufe 1/2) · Testlink: https://l77d.github.io/v2tracker/ · Live (main, Build 33, MindAR): https://l77d.github.io/detar

## Projekt

Mobile WebAR-Demo (Studio2B / „DEIN ERSTER TAG"): Karte scannen → Comic-Figur
steht auf der Karte und führt einen Dialog nach RPG-NPC-Vorbild (Hub mit
Freischaltungen, Rückfragen der Figur, Sprechblase mit Seiten, Posen,
Gesichtsanimation). Port des Zapworks/Mattercraft-Prototyps auf Open-Source-
Bildtracking (dieser Branch: 8th-Wall-Engine; `main`: MindAR) — kein LLM,
keine API, kein Build-Schritt, statische Site. v1 enthält NUR den Dialog
(Scope 31.08.2026); der Einblick (Portal/Galerie) ist seit der Entschlackung
(Build 49) aus dem Repo entfernt und lebt nur noch in der Historie.

## UI (seit Build 18, 2026-09-03)

Quelle: Figma „DETAR" (Seite UI, Komponenten `support`/`frage`/`Auswahl`,
mock_0–05) + Mockup-PNGs in `Produktion/Quellmaterial/0309/`. Entscheidungen
Michael 2026-09-03: Themen-Namen im Mockup sind Platzhalter (Inhalt bleibt
Elektroniker-Karte) · keine Fußzeile, kein Link-Eintrag, kein DET-Logo/Job-Link
nach dem Splash · „Ich muss weiter" ist eine Kachel im Themenraster (4. Feld)
und in jedem Thema · Sprechblase bleibt 3D über dem Kopf · Attract nur
Eck-Marker · Karte verloren = Menü eingefroren, nicht bedienbar.

- **Tokens** in `css/app.css` (`--d-*`): Blau `#3aa1cd`, Reiter-Blau `#0b95d0`,
  Gelb `#fced62`, Schwarz `#171717`, NEU `#71ff51/#1d3917`, LINK
  `#23b6f5/#0e1b3d`, ausgewählt `#193d18/#58ff71`, gefragt `#3d3d3d/#b5b5b5`.
- **Fonts:** Jersey 10 (Hauptschrift) + **Silkscreen** (OFL,
  `assets/fonts/`) für Support-Zeilen — Ersatz für FS Pixel Sans aus dem
  Mockup (kommerziell). Silkscreen läuft ~1,6× breiter, Größen daher auf die
  Mockup-Kastenbreiten zurückgerechnet (22 px Hinweise, 20 px Kopfzeile).
- **Pixel-Halo** (Textkasten mit ausgefransten Kanten): SVG-Filter
  `feMorphology dilate` je Farbe/Radius, Definitionen in `index.html`,
  Zuordnung `.px-*` in `app.css`. Sprechblase (Canvas) macht dasselbe über
  Kontur mit `lineJoin miter` + `lineCap square`.
- `js/supportUI.js` — Handy-Icon (6 PNG-Frames, `assets/ui/icon-handy/`)
  + Balken; Zustände suchen/gefunden/ruhe. Genutzt von `questionMenu.js`
  (Suche, Karte gefunden, Ruhezustand) und `main.js` (`#lostHint`).
- `js/questionMenu.js` — Themen als festes 2×2-Raster; Fragen als Karussell
  mit 2×2 Kacheln je Seite + Seitenpunkte; Kachel = Reiter (THEMA/NEU/LINK/✅)
  über Textkasten 178×73, ±2,34° Tilt. Maße 1:1 aus dem 402-px-Figma-Frame.
- `js/activationFX.js` — vier gelbe Eck-Marker auf den Kartenecken (Canvas-
  Textur aus dem Figma-Pfad), wabern (`ACTFX.bobHeight/bobSec`), ploppen beim
  Tap. Glow + Partikel sind weg.
- Suchrahmen `#scanFrame` (weiße Ecken) über `body.scanning` — an nach dem
  Start, aus bei der ersten Erkennung.
- **Build 27 (Michael 2026-09-07):** `SCENE.figureScale 0.85` skaliert Figur +
  Sprechblase (rig.js) und Hüpf-Icon — Eck-Marker bleiben Kartengeometrie ·
  Panel-Raster in Titelzeilen-Blau, beginnt 20 % unter der Panel-Oberkante
  (Splash-Raster bleibt gelb) · Icon ohne Schlagschatten · „Ich muss weiter"
  nur im Hauptmenü · Ruhezustand + Karte verloren: Panel-Zeile wechselt auf
  „Halte auf die Karte" (`menu.showIdle(true)`, Phase `idle-lost`), der
  mittige `#lostHint` erscheint nur außerhalb des Ruhezustands
  (`controller.lostHintWanted`).
- **Ohne Entwurf, abgeleitet** (Michael liefert später Mockups nach):
  Antwortoptionen, Weiter-Kachel, Ruhezustand, Kamera-abgelehnt, Firmenname-
  Text-Fallback im Splash, Seitenzähler, NEU-Punkt am Zurückpfeil.

## Editionen (seit Build 56, 2026-09-09)

Eine Karte, zwei Fassungen: **Firma** (Standard: Logo/Firmenname im Splash,
Link-Frage „Zeig mir die Seite" im Thema „Wie man reinkommt") und **Public**
per URL-Flag `?public` (QR-Code der neutralen Karte). `js/edition.js →
prepareCard()` liefert main.js eine Kopie der Karte: Fragen mit `branded: true`
entfallen samt Ids in `initial`/`unlocks`; `{firma}` in Texten wird durch
`card.company` bzw. `card.companyNeutral` („der Betrieb") ersetzt; `company`,
`companyLogo`, `jobUrl` sind null; `card.edition` = "public". Splash: `body.public`
blendet `#companyKicker` („bei") + `.company-box` aus — dort steht vorerst
NICHTS (Michael 2026-09-09: Public-Splash wird noch gestaltet). `?stats` zeigt
in der Karten-Zeile „PUBLIC"/„Firma". Keine zweite Kartendatei, kein zweites
HTML. Der Parameter überlebt „Neu laden" und „Link kopieren" (preflight.js
arbeitet am rohen Query-String, damit `?public` nicht zu `public=` wird).

## Kartendesigns (seit Build 57, 2026-09-15)

Mehrere Designs als eigene Targets in `targets/8thwall/`, Liste
`targets/8thwall/karten.json` (`id`, `name`, `target` = Dateibasis,
`breiteMm`, `notiz`). `?karte=<id>` wählt das Design, ohne Parameter gilt
`card` (bisheriger Stand). Unbekannte id → Hinweis in `#errorBox`, Button
bleibt aus. `physicalWidthInMeters` = `breiteMm/1000` des Eintrags (Standard
63 mm, Druckspezifikation) — NICHT mehr `SCENE.cardWidth` (bleibt Szenen-
Einheit 0.059). `?stats` zeigt „Design: id · target.json · mm". Übersicht mit
QR-Codes: `karten.html` (QR aus `vendor/qrcode/`, MIT, kein CDN). Neues
Design + lokaler Test mit cloudflared: `docs/kartendesigns.md`.

## Dialogsystem (seit Build 17, 2026-09-03)

Definition: `Dialogsystem/DETAR_Dialogsystem.md` im Projektordner; Prototyp
`detar_dialog_v2.html` (Themenebene) ist die Referenz, die App portiert ihn 1:1.

- `cards/elektroniker.js` — Kartendatei (Siemens-Dialog, PENNY-Figur/-Marker
  als Platzhalter). Felder: `themen`, `initial`, `greeting{tag,text}`,
  `asks[{trigger,prompt,options[{label,sets,unlocks,tag,reply}]}]`,
  `questions[{id,thema,label,text,tag,unlocks,requires,link,url,end}]`,
  `reentry.rules`. Text darf `<marker> <gross> <leise> <knall>` tragen
  (`<welle>`/`<zittern>` werden geparst, nicht bewegt — Canvas-Entscheidung).
- `js/dialogEngine.js` — Zustand + Regeln (unlocked/asked/fresh/vars/asksDone/
  visits/view), kein DOM, kein 3D.
- `js/cardController.js` — Ablauf: say() paginiert und blättert mit Weiter;
  Weiter-Knopf NUR zwischen Seiten, vor einer Rückfrage und vor „Seite öffnen"
  (window.open braucht die Nutzergeste). Ausstieg → Fazit → Abschied →
  `activation.playOut()` (Figur klappt ein) → Phase `resting` → Tap auf die
  Karte → Wiedereinstieg (beiläufige Zeile, Zustand bleibt).
- `js/speechBubble.js` — `paginate()` schneidet am Satzende (Notfall Komma/
  Gedankenstrich, dann Wortgrenze), gemessen am echten Font. Seitenzähler
  „1/3" seit Build 30 aus (`TYPO.pageLabel: "nein"`, Michael 2026-09-07);
  Seiten + Weiter-Kachel bleiben. Kein stilles Kappen mehr.
- `js/bubbleText.js` — Markup-Parser, Satz-/Wortgrenzen.
- `js/questionMenu.js` — Phasen: themen → thema ([←] Kopfzeile mit NEU-Punkt,
  Fragen mit Reitern NEU/LINK/✅) · options · next · idle; Optik siehe „UI".
  Ausstieg als Kachel (`engine.exitQuestion()`). Link-Frage „link" ist seit
  Build 31 eine normale Frage im Thema `wege` (Reiter LINK, „Seite öffnen" →
  neuer Tab), freigeschaltet durch „bewerbung"; `permaQuestions()` bleibt
  ungenutzt.
- `config.js → POSES`: Emotion-Tag → Körper (idle/affirm/think), bis der Rig
  die elf Posen liefert. `CHOREO`: continueDelayMs, collapseDelayMs,
  collapseSec, trackingLostMs (Menü friert nach Verlust ein).
- Randzustände: Kamera abgelehnt → `body.camera-denied` (eigener Bildschirm im
  Splash); Tracking verloren → `menu.setFrozen()` + `#lostHint` (Icon-Zeile
  mittig, Menü bleibt ungedimmt stehen).
- Tap-Entprellung in main.js (pointerup + click-Fallback binnen 120 ms) —
  seit dem Dialogsystem wäre Doppel-Auslösung NICHT mehr harmlos.
- Splash: `card.companyLogo` (Pfad) oder Firmenname als Text; `card.jobUrl`
  wird seit Build 18 nicht mehr angezeigt (DET-Label raus).
- Build 16 ist vom ungemergten Branch `tracking-runde5` belegt (nur in
  `main`), deshalb springt main von 15 auf 17.

**Tracking-Target:** liegt in `targets/8thwall/` (`card.json` +
`card_luminance.png` aus `@8thwall/image-target-cli`, weitere Designs per
`?karte`, s. „Kartendesigns"). Vorlage der Standard-Karte: beschnittene
Demo-Karte 070926 (`Assets/September/demo_skat_070926_mind_cropped.png`,
1346×2156 px, Aspekt 1,60 → `SCENE.cardAspect`, Szenen-Geometrie der Eck-
Marker/Tap-Fläche). Desktop-Kartenbild: `assets/card/detar_demokarte_070926.jpg`
(1200 px, aus der Druckdatei `Assets/September/demo_skat_070926.jpg`).
Physische Breite fürs Tracking = `breiteMm` aus `karten.json` (63 mm,
Druckspezifikation 63 × 88 mm); `SCENE.cardWidth 0.059` ist nur noch die
Szenen-Einheit (worldRoot-Skalierung). Die Figur ist relativ zur Kartenbreite
definiert. (MindAR-Target `card.mind`, Compiler-Skript, `targets/old/`: nur
in `main`.)

**Stack (seit 2026-09-09):** `three@0.160` als schlankes Bundle in
`vendor/three/` (relativer Import `../vendor/three/three.module.js`, KEINE
Importmap mehr) + **Open-Source-8th-Wall-Engine** (MIT) selbst gehostet unter
`vendor/8thwall/` (SIMD) und `vendor/8thwall-nosimd/` (Fallback; `main.js`
wählt per `WebAssembly.validate`, `?nosimd` erzwingt) — `xr.js` +
`xr-tracking.js`; Bildtracker, KEIN SLAM, kein Binary, kein Niantic-Aufruf,
kein API-Key. Engine wird erst in der Start-Geste geladen; `js/preflight.js`
prüft vorher In-App-Browser/HTTPS/Kamera-API/WASM/WebP und zeigt sonst
`#preflightScreen`. Production-Härtung + Gate-Tabelle:
`docs/8thwall-migration.md` Abschnitt 7. Target: `targets/8thwall/card.json` + `card_luminance.png` aus
`@8thwall/image-target-cli`; weitere Designs daneben, gewählt per `?karte`
(`karten.json`, `docs/kartendesigns.md`). Alles dazu: `docs/8thwall-migration.md`.
`main` läuft weiter auf `mind-ar@1.2.5` (dort: mind-ar ist gegen three 0.160
gebaut, nicht bumpen). Vanilla ES-Module, GitHub Pages (served NUR `main`).

## Branches

- `main` — live (Pages deployt automatisch)
- `v2tracker-prod` — auf `v2tracker-lean` aufgesetzt: Production-Härtung
  (2026-09-09, Build 50–55: Importmap raus, Vorabprüfung, Nicht-SIMD-Engine,
  WebP, Font-Subsetting). **Das ist der Stand für den Merge.**
  **Testdeployment:** Spiegel-Repo `L77D/v2tracker` (Branch → dessen `main`)
  → https://l77d.github.io/v2tracker/ — nach jedem Push nachziehen:
  `git push https://github.com/L77D/v2tracker.git v2tracker-prod:main`.
- `v2tracker-lean` — Entschlackung (Build 49; Michael am Handy: Tracker
  „deutlich besser als MindAR"). Referenz.
- `8thwall-image-targets` — Tracking auf 8th Wall Image Targets, Stand vor der
  Entschlackung (Build 48). Bleibt als Referenz.
- `pruefstand` — Strategie E: `?record` / `?replay` / `?metrics`
  (Session-Aufnahme am Gerät, Replay + Vergleichszahlen am Desktop).
  Noch nicht gemerged; `?record` braucht HTTPS = erst nach Merge am Handy nutzbar.

## Konventionen

- **Versionierung:** `js/version.js` → `BUILD` = freilaufender Zähler,
  **bei JEDEM Push +1** (früher = Commit-Anzahl; seit dem Spiegel-Repo stimmt
  das nicht mehr, Build 60 = 50 Commits). `?stats` zeigt den laufenden Build
  und prüft per no-store-Fetch gegen den live-Stand („neu laden!" bei altem
  Cache).
- **Keine tuning.json mehr im Repo** (seit 2026-09-09, Branch v2tracker-lean):
  alle Werte sind Defaults in `js/config.js` (EINE Quelle). Eine tuning.json
  wird nur mit `?dev`/`?tuning` geholt — Tuning-Werkzeug, nie einchecken
  (sonst wieder die Masking-Falle: config-Änderungen wirken nicht, wenn der
  Block in tuning.json steht).
- **Schlank-Regeln (v2tracker-lean):** Dev-Module (`debugOverlay`, `statsOverlay`,
  `devPanel`, `timeline`, `desktopMode`+`phoneFrame`) NUR per URL-Flag laden;
  keine CDN-Requests (three.js aus `vendor/three/`, neue THREE.*-Klasse →
  `tools/three-slim-entry.js` + `tools/build-three.sh`); Engine-Kern ohne
  Framework-Adapter (`vendor/8thwall/BUILD-INFO.txt`); keine toten Assets
  (Einblick/Portal, MindAR-Targets, Lokal-Vendor sind raus).
- **Kompatibilitäts-Regeln (v2tracker-prod, 2026-09-09):** KEINE Importmap
  (Import-Maps = iOS 16.4) — Vendor-Module relativ importieren. Im Live-Code
  keine Syntax jenseits `?.`/`??` (Grenze iOS 13.4 / Chrome 80; `??=`, `#priv`,
  `.at()` o. ä. nur in Dev-Modulen). Bilder als WebP mit Alpha (Grenze iOS 14).
  Neues CSS mit Fallback (`inset` → top/right/bottom/left). Engine-Update
  immer BEIDE Varianten bauen (`wasmreleasesimd` → `vendor/8thwall/`,
  `wasmrelease` → `vendor/8thwall-nosimd/`, s. `vendor/8thwall/README.md`).
  Neue Zeichen in Karten-Texten → `tools/build-fonts.sh` (Font-Subset,
  Original-TTFs von Google Fonts). Vollständige Gate-Tabelle:
  `docs/8thwall-migration.md` 7.2.
- **Lokal-Prototyp (Einzeldatei, Doppelklick, kein Server):**
  `python3 tools/build-lokal-prototyp.py <Ziel.html>` packt die App in eine
  HTML-Datei (Module als data:-URLs in der Import-Map, Assets/Fonts/tuning.json
  eingebettet, Desktop-Modus + Dev-Panel erzwungen; three.js aus `vendor/three/`,
  kein CDN). Nach jedem Build neu erzeugen; Ablage `…/Claude/Lokal-Prototyp/`.
  Das Skript patcht fünf Quelltextzeilen per `assert` (markiert mit
  „Patch-Anker build-lokal-prototyp.py" in main.js, config.js, rig.js,
  supportUI.js) — Wortlaut dort nicht ändern.
  **Feinschliff (Michael 2026-09-04), seit Build 22 live, seit Build 61 direkt
  in den Basisregeln (kein `body.lokal`, keine Override-Blöcke mehr):**
  Silkscreen −12 % Laufweite · Splash-Raster driftet nach rechts oben ·
  enges Kachelraster (88/102 px Zeilen, `--q-row-themen/-fragen`) · „Halte auf
  die Karte" als Laola-Welle (`wave`-Spans in supportUI) · Karte gefunden: Icon
  springt aus dem Panel (`IconHandy.jumpOut`) und hüpft in 3D auf der
  Kartenmitte mit flachem Pixel-Schatten (`ActivationFX.landIcon/tickHopper`,
  `ACTFX.hopper="ja"`).
- Kommentare/Commits auf Deutsch, Commit-Trailer `Co-Authored-By: Claude`.
- Änderungen an Tracking-Werten immer mit Datum + Begründung im Kommentar
  (Fix-Log lebt in den Code-Kommentaren; „(MindAR-Stand …)" = Historie aus
  `main`, gilt unter 8th Wall nur als Begründung des Aufbaus).
- Gemeinsame Helfer in `js/util.js` (`el`, `rand`, `normalizeAngle`,
  `finiteVec/finiteQuat`, `progress`) — nicht je Modul neu schreiben.
- `.gitignore` hält `tuning.json`, `beats.theatre.json`, den Lokal-Prototyp und
  CLI-Zwischenbilder aus dem Repo.

## Tracking-Architektur

```
8th Wall XrController (xr-tracking.js) → reality.imagefound/imageupdated/imagelost
  └─ anchor.matrix (main.js: Kamera⁻¹ × Bildpose, Scale = Kartenbreite; Gruppe
     außerhalb der Szene — Ersatz für MindARs anchor.group)
       └─ PoseStabilizer.tick() (jeden Frame im onUpdate des Pipeline-Moduls)
            └─ stabRoot (geglättet, KIND DER KAMERA; trägt Figur)
                 └─ worldRoot (Karten-Frame: rot.x=+90°, scale=1/SCENE.cardWidth)
Rendern: XR8.Threejs.onRender (buildExperience({render:false}))
```

(main/MindAR: `anchor.group.matrix` roh pixel-skaliert, stabRoot auf Szenen-
Ebene, `renderer.setAnimationLoop` — Rest identisch.)

PoseStabilizer: NaN-Guard → **Schwerkraft-Schiedsrichter** (Build 59,
`js/poseArbiter.js`, Toggle 10: aus der Rohpose die Spiegel-Kandidatin der
ebenen Pose berechnen und die Lage wählen, deren Kartennormale im Erdframe
nach oben zeigt — nur beta/gamma nötig, ohne Gyro passiv; Hysterese
`STAB.arbiterMargin`) → Einheiten-Normierung auf Kartenbreiten →
**Scale-Lock** (Scale strukturell konstant; >10 % Abweichung = Fehl-Homographie
→ Frame verwerfen; hält die Abweichung `scaleRelockMs` am Stück an → **Re-Lock**
= komplett neu aufsetzen) → **Aufsetzen per Median** (Build 28: die ersten
`acquireFrames` Messungen bzw. `acquireMaxMs` → Median je Achse, Medoid-
Rotation, Median-Scale; solange läuft der laufende Median sichtbar mit — gilt
für den ersten Scan, Re-Found und Snap) → **Neu-Aufsetzen auf Tap** (Build 29:
Figur-Tap und Karten-Tap in „Karte gefunden" rufen `stab.reacquire()` → Median
über die nächsten Messungen, während der Nutzer stillhält; die anstehende
Rohpose von vor dem Tap zählt nicht (`skipCurrent`). `?stats` zeigt „Roh↔Stab"
in Grad/‰-Kartenbreiten + Zahl der Re-Erkennungen — Roh≈Stab und trotzdem
schief = Drift im Tracker, Roh≠Stab = wir halten alt. (Unter MindAR erzwang
main.js zusätzlich Detect+Match des Trackers; 8th Wall erkennt kontinuierlich.) → Bewegungs-Schätzung (250-ms-Drift-Fenster, tremor-fest) →
Far-Debounce (2 ferne Messungen → Snap) → Extrapolation (nur BEWEGT) →
**One-Euro Position mit beta-GATE** (beta nur im BEWEGT-Modus; die Frame-
Ableitung ist in Ruhe nie ~0 → ohne Gate stand der Filter permanent offen) →
adaptives Rotations-SLERP → Dead-Zones (nur Ruhe). GyroFusion liefert
Kamera-Dreh-Deltas (Akkumulations-Dead-Band: qPrev rückt nur bei angewendetem
Delta vor) als Prediction + Verlust-Brücke.

## Aktuelle Kern-Werte (config.js)

- `CAM`: unter 8th Wall wählt die Engine die Auflösung selbst (Constraint-
  Leiter mit Retry); `maxPixelRatio: 2` gilt weiter (Canvas-Pixelgröße in
  main.js). (main/MindAR: 960×540 per getUserMedia-Wrap, `?res=`.)
- `STAB`: `minCutoff 0.1` · `beta 10` (gated) · `rotMinCutoff 0.5` ·
  `rotBeta 4` · `minSpeed 0.04` · `minAngSpeed 0.09` · `scaleOutlier 0.1`
  (Scale-Lock löst unter 8th Wall strukturell nie aus, s. Gotchas).
  Die MindAR-Keys `filterMinCF/filterBeta/missTolerance/warmupTolerance`
  gibt es hier nicht mehr.
- `CHOREO.tapDebounceMs 120` · `tapMaxPx 6` · `tapMaxMs 400` (Tap-Erkennung,
  main.js) · `idleReturnMs 5500` als Fallback — die Karte (`idleReturnMs` in
  `cards/*.js`, heute 8000) hat Vorrang.
- Feature-Toggles 1–10 im Dev-Panel (`?dev`), Nr. 9 = Scale-Lock, Nr. 10 =
  Schwerkraft-Schiedsrichter (Pose-Flip).

## URL-Parameter

`?stats` (Jitter roh/stab, Vision-Hz, BEWEGT/ruhig, Cam+PR, Build-Check,
Engine-Variante, Design, Zeile „Flip": Schiedsrichter-Zustand, Kippwinkel,
n·up roh/gewählt, Flips/Snaps/Re-Lock-Zähler; seit Build 60 handytauglich:
oben links, umbrechend, Knopf „📊" blendet es aus, Zustand in localStorage) · `?karte=<id>` (Kartendesign aus
`targets/8thwall/karten.json`, Übersicht `karten.html`) · `?dev` (Regler) · `?debug` · `?desktop` · `?timeline` ·
`?nogyro` · `?nosimd` (Nicht-SIMD-Engine erzwingen) · `?public` (Public-Edition,
kein Test-Flag — steht im QR-Code der neutralen Karte) ·
`?preflight=inapp|nocam|insecure|nowasm|nowebp` (Hinweis-Screens erzwingen),
`?preflight=aus` · Branch pruefstand: `?record`, `?replay`, `?metrics`.
(`?res=` gibt es nur in `main`/MindAR.)

## Qualitäts-Richtwerte (?stats, Ruhe, 3–5 s Fenster füllen lassen)

Seit Build 61 sind die mm-Werte ECHTE Millimeter (Kartenbreite aus
`karten.json`, 63 mm); bis Build 60 rechnete `statsOverlay.js` fest mit einer
150-mm-Karte — alte Protokolle durch 2,38 teilen, um sie zu vergleichen.

- Jitter **stab**: aufgelegt ≈ 0–0,04 mm (Dead-Zone friert ein) · in der Hand
  < 0,13 mm (Kalibrierziel; Bestwert 0,07 mm — alt: < 0,3 / 0,16).
- Jitter **roh**: aufgelegt 0,13–0,4 mm gesund; > 0,8–1,3 mm = Problem
  stromaufwärts (Marker/Licht/FOV), nicht mit Filtern kaschieren (alt:
  0,3–1 / > 2–3). Marker-A/B immer über **roh** vergleichen. stab sollte
  ~5–10× unter roh liegen.
- Beim Stillhalten muss `ruhig` stehen, sonst misst man Bewegung.

## Gotchas

- Production-Härtung: Der Claude-Browser-Pane meldet im verdeckten Zustand
  Viewport 0×0 und pausiert rAF (Intro-Choreo hängt bei `phase: intro`) —
  kein CSS-Fehler; `?desktop&dev` per JS-Klick + `controller.onCardTapped()`
  treiben. Port 8743 kann von einem alten Dev-Server belegt sein → anderen
  Port nehmen, nicht killen. Im Handy-Preset des Panes liefert die Engine
  `UNSPECIFIED` statt `DENY_CAMERA` (dann kein `body.camera-denied`) — Desktop-
  Preset nehmen. `?preflight=…` überspringt boot() komplett (kein Dev-Panel).
- 8th Wall: `disableWorldTracking: true` MUSS vor `XrController.pipelineModule()`
  und `XR8.run()` stehen. `XR8.Threejs` verlangt `window.THREE` (dieselbe
  Instanz wie `vendor/three/three.module.js`, main.js setzt sie). `renderer.setSize` der Engine schreibt Pixelmaße
  als Inline-CSS → `#xr-canvas` hat `width/height: 100% !important`.
- 8th Wall: `reality.imageupdated` feuert nur bei geänderter Pose → der
  Stabilizer sieht unveränderte Frames als „stale" (wie MindAR). `detail.scale`
  gilt pro Track als konstant (Scale-Lock-Annahme, am Gerät prüfen).
- 8th-Wall-Target ist immer ein 3:4-Crop (zentriert, volle Kartenbreite);
  eigener Crop muss die Kartenbreite behalten (Skalierung!).
- **Pose-Flip (2026-09-15):** Die ebene Pose-Schätzung hat zwei Lösungen; die
  Engine liefert manchmal STABIL die gespiegelte (Karte um 2θ um ihre Querachse
  gekippt, θ = Handy-Neigung → bei 45° liegt die Figur flach zum Betrachter,
  Kopf unten, Blasentext auf dem Kopf). Der Stabilizer folgt der Quelle und
  kann das weder erzeugen noch halten (zwei ferne Messungen → Neuaufsetzen);
  Scale-Lock ist unter 8th Wall wirkungslos (`scale` = konfigurierte Größe,
  konstant). Abhilfe: Schiedsrichter (Toggle 10); Diagnose in `?stats` Zeile
  „Flip" (`n·up roh` negativ/klein bei Karte auf dem Tisch = Engine liefert
  die Spiegel-Lösung). Herleitung + Handy-Test: `docs/8thwall-migration.md` 9.
- Boot-Fehlerpfade (Build 61): `boot()` und `attachDevTools()` haben `.catch`
  (vorher stille Unhandled Rejection = Splash mit totem Knopf); `loadEngine()`
  hat 30 s Timeout; Kamera-Ausfall NACH dem Start zeigt „Kamera unterbrochen"
  in `#lostHint`.
- Kompatibilität: keine `static`-Klassenfelder im Live-Code (ES2022, iOS 14.5
  — das Inline-Gate in index.html prüft nur `?.`/`??` und ließe iOS 13.4–14.4
  ohne Hinweis hängen; Build 61 hat genau das in questionMenu.js behoben).
- **Nur main/MindAR:** mindar-image-three legt IMMER einen CSS3DRenderer-Layer
  an, der Pointer-Events schluckt → `pointerEvents:none`; MindARs elementweiser
  Matrix-Filter erzeugt nicht-starre Matrizen → Grund für den Scale-Lock; MindAR
  schätzt das Kamera-FOV nur (Kipp-Wobble, Strategie A3).
- iOS: Gyro-Permission MUSS in der Start-Geste angefragt werden (vor allen
  awaits); Safari cached JS aggressiv → Build-Check in ?stats nutzen. Achtung:
  Safari cached JEDE Datei einzeln (Pages: max-age 600) — `version.js` kann
  frisch sein, während `cards/*.js` noch alt ist. `?stats` zeigt deshalb seit
  Build 33 auch die geladene Karte (id, Fragenzahl, Link-Frage). Einzelne
  Datei erzwingen: ihre URL direkt in Safari öffnen, dann die App neu laden.

## Referenzen

- `docs/tracking-strategien.md` — Strategien A–E (Rohsignal, Fork,
  WebXR-Fusion, Eck-Anker-Karte, Prüfstand) mit Wissen + Vorgehen je Punkt.
  MindAR-Stand (2026-07): B (MindAR-Fork) und C sind auf diesem Branch
  gegenstandslos, A/D/E gelten sinngemäß weiter.
- Refactoring Stufe 3 (offen, 2026-09-15): main.js in Module zerlegen (Tap-
  Eingabe, Figur-Hüpfer, Pipeline-Modul) · `poseStabilizer.tick()` in Stufen
  mit expliziten Parametern · Scale-Lock ausbauen (erst Re-Lock-Zähler am
  Gerät prüfen) · Arbiter: `qEarth` ändert sich 60 Hz ohne Dead-Band → kann
  stale Frames als „neu" melden (Vision-Hz in ?stats prüfen) · `SCENE.cardAspect`
  1,60 → 1,40 (63×88 mm) · Tests (`node --test`) für bubbleText, dialogEngine,
  edition, poseArbiter · `"ja"/"nein"` → Booleans (bricht alte Presets).
- Fix-Historie: Code-Kommentare mit Datum (2026-07-08 / -09 / -13 / -14).
