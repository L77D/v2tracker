# CLAUDE.md — DETAR WebAR

Stand: 2026-10-28 · Build 113 (Haupt-Repo `L77D/v2tracker`: 8th Wall + Entschlackung + Production-Härtung + Editionen (?k=<nr>P) + Kartendesigns + Schwerkraft-Schiedsrichter gegen den Pose-Flip + Refactoring Stufe 1/2 + Handheld-Messwerkzeug in ?stats + Engine/Karten getrennt: karten/<id>/ per ?k + fester Font-Zeichensatz + Regelwerk/Prüfseite für Kartendialoge, Public-Texte + 35 Testdrucke p01–p35 als Designs mit ?karte=<design> + AR-Szene figureScale 0.5, Handy-Icon doppelt + Doku-Verweise auf den Projektordner + Tests `node --test` für die reinen Module = Refactoring Stufe 3a + main.js zerlegt in arSession/experience/tapInput/figureJump = Stufe 3b + PoseStabilizer in Stufen mit `snapshot()` und Goldstandard-Test = Stufe 3c + Schalter als Booleans, `applyTuning()` übersetzt alte Presets = Stufe 3d + Controller ohne DOM, `syncCssVars` beim Menü = Stufe 3e + Tracker-Varianten parallel im Code: `js/tracker.js` messgetrieben, Auswahl `?tracker=<name>` / `STAB.tracker` über `js/trackerWahl.js`, Nulllinie `8roh` + Karte 000: Standard-Design `p04`, `card` und `tarn` aussortiert, `SCENE.cardAspect` 1,40 + Tracking-Verlust: Szene faded (`js/sceneFade.js`), Suchrahmen + „Halte auf die Karte" nach 1,5 s, Eck-Marker bleiben mit der Figur) + Sprechblase billboardet auch in der Neigung (`CHOREO.bubblePitchMax` 70°) + Tracker-Variante `8lerp` = 8roh + Lerp/Slerp + Schiedsrichter + Tracker-Marke oben rechts bei `?tracker=` + Skill „detar-dialog“: Dialog-Generierung samt Prüfprogramm ohne Browser für eine fremde Claude-Session + Animalese-Stimme raus, Anfangston je Antwort + Antworten stehen doppelt so lange mit Lebendig-Phase (Gewichtsverlagerung seit Build 109 wieder raus) + Lauffeld: ganze Figur bleibt auf der Karte + Standard-Tracker `8lerp` (Build 110) + Refactoring 2026-10-15: Characterization Tests + Browser-Snapshot, Tracker alt/neu/8roh ins Archiv `archiv/tracker-varianten/`, tote Reste raus, STAB auf 8lerp-Werte reduziert (Build 111) + Fehlerjagd 2026-10-28: Wiedereinstieg während des Einklappens, Rückfrage nach Link-Antwort, click-Fallback prüft Weg/Dauer, kein Tap bei verlorener Karte, karten.html-Public-Kachel (Build 112) + Start-Geste: Kamera erst nach beantworteter iOS-Bewegungsabfrage, Technik-Zeile auf „Ohne Kamera geht's nicht“ (Build 113) · Ausgeliefert (`main`): https://l77d.github.io/v2tracker/ · Veraltet/Archiv: `L77D/detar` (Build 33, MindAR, https://l77d.github.io/detar)

## Projekt

Mobile WebAR-Demo (Studio2B / „DEIN ERSTER TAG"): Karte scannen → Comic-Figur
steht auf der Karte und führt einen Dialog nach RPG-NPC-Vorbild (Hub mit
Freischaltungen, Rückfragen der Figur, Sprechblase mit Seiten, Posen,
Gesichtsanimation). Port des Zapworks/Mattercraft-Prototyps auf Open-Source-
Bildtracking (8th-Wall-Engine; das alte Repo `L77D/detar` lief auf MindAR) — kein LLM,
keine API, kein Build-Schritt, statische Site. v1 enthält NUR den Dialog
(Scope 31.08.2026); der Einblick (Portal/Galerie) ist seit der Entschlackung
(Build 49) aus dem Repo entfernt und lebt nur noch in der Historie.

## UI (seit Build 18, 2026-09-03)

Quelle: Figma „DETAR" (Seite UI, Komponenten `support`/`frage`/`Auswahl`,
mock_0–05) + Mockup-PNGs in `Produktion/Quellmaterial/0309/`. Entscheidungen
Michael 2026-09-03: Themen-Namen im Mockup sind Platzhalter (Inhalt bleibt
Elektroniker-Karte) · keine Fußzeile, kein Link-Eintrag, kein DET-Logo/Job-Link
nach dem Splash · „Ich muss weiter" ist eine Kachel im Themenraster (4. Feld)
und in jedem Thema · Sprechblase bleibt 3D über dem Kopf (dreht sich zur
Kamera um die Hochachse und neigt sich seit Build 104 auch zu ihr, Oben =
Kartennormale, höchstens `CHOREO.bubblePitchMax` 70°, Michael 2026-10-13) · Attract nur
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
  (Suche, Karte gefunden, Ruhezustand) und `arSession.js` (`#lostHint`).
- `js/questionMenu.js` — Themen als festes 2×2-Raster; Fragen als Karussell
  mit 2×2 Kacheln je Seite + Seitenpunkte; Kachel = Reiter (THEMA/NEU/LINK/✅)
  über Textkasten 178×73, ±2,34° Tilt. Maße 1:1 aus dem 402-px-Figma-Frame.
- `js/activationFX.js` — vier gelbe Eck-Marker auf den Kartenecken (Canvas-
  Textur aus dem Figma-Pfad), wabern (`ACTFX.bobHeight/bobSec`), ploppen beim
  Tap. Glow + Partikel sind weg. Seit Build 99 (Michael 2026-10-12) bleiben
  sie nach dem Plopp STILL auf den Ecken stehen (Zustand `stay`) — mit der
  Figur, im Ruhezustand, beim Verlust faden sie mit der Szene; `stop()` nur
  noch beim Dev-Replay. Build 101: `renderOrder -1` (vorher 0.5 = zwischen
  Körper 0 und Kopf 1 → Ecke hinter der Figur lag über dem Körper).
- Suchrahmen `#scanFrame` (weiße Ecken) über `body.scanning` — an nach dem
  Start, aus bei der ersten Erkennung; seit Build 99 auch nach
  `CHOREO.trackingLostMs` (1,5 s) Verlust wieder an (s. „Randzustände").
- **Build 27 (Michael 2026-09-07):** `SCENE.figureScale 0.85` skaliert Figur +
  Sprechblase (rig.js) und Hüpf-Icon — Eck-Marker bleiben Kartengeometrie
  (Build 81, Michael 2026-10-09: Szene auf 80 % davon → `figureScale 0.68`;
  Build 82: 0.4; Build 84, Michael 2026-10-09: `figureScale 0.5`; Build 85:
  Hüpf-Icon doppelt so groß, `ACTFX.iconHeight 0.68`; Build 97: FigureRoot-Höhe
  skaliert mit figureScale — vorher schwebte die Figur —, Lauffeld `IDLE`
  = Karte 63 × 88 mm × `roamFraction 1.1`; seit Build 108, Michael
  2026-10-14: die ganze Figur bleibt auf der Karte — `roamHalf()` in
  idleWander.js zieht die Fußhalbbreite (`IDLE.footFraction 0.62` der
  Leinwand × Ruhe-Scale der Figur) vom Kartenrand ab, ≈ 55 % × 68 % der
  Karte; `roamFraction` gibt es nicht mehr) ·
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
per Kartennummer mit angehängtem P, `?k=000P` (auch `p`; Build 75, Michael
2026-10-08 — ersetzt das Flag `?public`, das es nicht mehr gibt). Der
Kartenlader erkennt das P, lädt denselben Ordner und wählt das erste Design mit
`"fassung": "public"` (sonst das erste Design) — die Public-Karte ist ohne Logo
gedruckt und hat ihr eigenes Erkennungsbild. Seriennummern (001.01) sind nur
intern vermerkt und haben keinen Einfluss auf den Code. `js/edition.js →
prepareCard()` liefert main.js eine Kopie der Karte: Fragen mit `branded: true`
entfallen samt Ids in `initial`/`unlocks`; Textfelder mit Public-Fassung
(`<feld>Public`: greeting.textPublic, labelPublic/textPublic, promptPublic,
labelPublic/replyPublic, rules[].textPublic — seit Build 67, Michael
2026-10-08: „ganzer Text doppelt") laufen im Public-Modus in dieser Fassung;
`{firma}` wird durch `card.company` ersetzt (Notnagel im Public-Modus:
`card.companyNeutral`, „der Betrieb"). Regel: in Public nie den Betrieb nennen,
jeder Text mit `{firma}` braucht die Public-Fassung (Regelwerk A9); `company`,
`companyLogo` sind null; `card.edition` = "public". Splash: `body.public`
blendet `#companyKicker` („bei") + `.company-box` aus — dort steht vorerst
NICHTS (Michael 2026-09-09: Public-Splash wird noch gestaltet). `?stats` zeigt
in der Karten-Zeile „PUBLIC"/„Firma". Keine zweite Kartendatei, kein zweites
HTML. Die Fassung steht in `?k` und überlebt damit „Neu laden" und „Link kopieren".

## Engine und Karten (seit Build 63, 2026-10-06)

Ziel: viele Karten, eine Engine. Die **Engine** (`index.html`, `js/`, `css/`,
`assets/` = nur Geteiltes wie UI/Fonts/Logo, `vendor/`) liegt einmal zentral;
jede **Karte** ist ein reiner Daten-Ordner ohne Code. Engine-Update = einmal
hochladen, alle Karten nutzen es.

```
karten/katalog.json            {karten:[{id, name, aktiv}]}
karten/<id>/daten.json         "format": 2 · profession · company · companyLogo · figur · designs · vorschau
karten/<id>/dialog.json        persona · firmenbegriffe · themen · initial · greeting · asks · questions · reentry
karten/<id>/figur/*.webp       Körper je Pose, Kopf, Gesichter
karten/<id>/targets/<d>.json + <d>_luminance.png   (image-target-cli)
karten/<id>/vorschau.jpg       Kartenbild für ?desktop
```

- `js/kartenLader.js → ladeKarte()`: `?k=<id>` (ohne → `{keineKarte}` → main.js zeigt die
  **Auffang-Seite** `#auffangScreen` via `body.keine-karte`, Build 74, Michael
  2026-10-08: ohne ?k startet keine Karte; Ausnahme Lokal-Prototyp = erste
  aktive Karte),
  `?design=<id>` (ohne = erstes Design der Karte), prüft `format`
  (`KARTEN_FORMAT`, ältere Formate dort übersetzen), macht Pfade aus
  daten.json (figur, vorschau, companyLogo, designs[].target) relativ zum
  Kartenordner absolut, ruft `prepareCard()` (Edition). Unbekannte Karte/
  Design/`aktiv: false` → Hinweis in `#errorBox`, Button bleibt aus. Alles per
  `fetch` mit `no-store`. `?karte=` gibt es nicht mehr (Michael 2026-10-06:
  komplett auf `?k=`) — AUSSER für die Testdrucke (Build 80): deren gedruckte
  QR-Codes tragen `?karte=<design>` (z. B. `?karte=p01`); der Lader sucht das
  Design in den aktiven Karten, Fassung = `fassung` des Designs. Feld `qr` des
  Designs = Link wie gedruckt (karten.html zeigt ihn so).
- Pro Sitzung genau EINE Karte und EIN Target. Karten-Ids nie umbenennen oder
  wiederverwenden (stehen in gedruckten QR-Codes).
- **Figur** (`figur` in daten.json): `posen {name: bild}` (`idle` Pflicht) →
  `rig.js` baut je Pose ein Körper-Sprite (`nodes.bodies[name]`), `kopf`,
  `gesicht {neutral, blink, talk}`. Maße/Pivots in `rig.js` = Figuren-Vorlage
  (gleiche Leinwand 1024×1536 für alle Figuren). Posenwahl
  `config.js → poseFor(tag, posen)`: Pose mit genau dem Tag-Namen (auch
  Sonderposen einer Karte) → sonst `POSES[tag]`, falls die Karte den Körper
  hat → sonst idle.
- **Designs** (seit Build 57: mehrere Kartenbilder derselben Karte; Karte 000
  heute `p04` als Standard und die Testdrucke `p01`–`p35`; `card` (Build 95)
  und `tarn` (Build 96) sind aussortiert, Michael 2026-10-12): `designs[{id, name, target, breiteMm, notiz}]` in
  daten.json. `physicalWidthInMeters` = `breiteMm/1000` (Standard 63 mm,
  Druckspezifikation) — NICHT `SCENE.cardWidth` (Szenen-Einheit 0.059).
  `?stats` zeigt „Design: id · targets/<d>.json · mm". Übersicht mit QR-Codes:
  `karten.html` (Karte × Design, QR aus `vendor/qrcode/`). Neues Design + Tracking-
  Vergleich der Designs + lokaler Test: `docs/kartendesigns.md`.
- **Zwei Dateien statt karte.json (Build 72, Michael 2026-10-08):** `daten.json`
  (Kartendaten, trägt `format: 2`) + `dialog.json` (Dialog); der Kartenlader holt
  beide und führt sie zu einem Kartenobjekt zusammen (Rest der Engine
  unverändert). Format 1 (karte.json) wird nicht mehr gelesen — es gab keine
  gedruckten Karten. **Produktionskarten heißen nach ihrer Nummer**
  (`karten/001/`, `?k=001`, kurze URLs); alles bisher Gebaute inkl.
  der Siemens-Elektroniker ist interner Prototyp und heißt Karte `000` (Build 73,
  vorher id `elektroniker-siemens`; Michael 2026-10-08).
- Prototyp `karten/000/` (daten.json + dialog.json) = Inhalt von
  `cards/elektroniker.js` (Build 62) plus `format`, `id`,
  `figur`, `designs`, `vorschau` (alte id `siemens_elektroniker_betriebstechnik`);
  seit Build 67–70 aufs Regelwerk gebracht (Quelle: Siemens-Ausschreibung,
  abgerufen 2026-10-08; Rest `[Annahme]`).
- Fonts (Build 64): fester deutscher Zeichensatz (ASCII, Latin-1, Latin
  Extended-A, Șș Țț, ẞ, Typografie, € ™ −, UI-Pfeile) in
  `tools/font-subset-unicodes.txt` — unabhängig von Karten-Texten; Jersey 10
  29,0 KB, Silkscreen 14,8 KB. Originale aus npm `@expo-google-fonts/*`
  (github.com aus der Cloud gesperrt), Details im Kopf von `tools/build-fonts.sh`.
- Offen (eigener Schritt): Service Worker (fester Cache der Engine, zentrale
  Updates).

## Dialogsystem (seit Build 17, 2026-09-03)

Definition: `Dialogsystem/DETAR_Dialogsystem.md` im Projektordner (Begründungen);
**Regelwerk für neue Karten: `docs/dialog-regelwerk.md`** (Build 67,
2026-10-08, löst `Dialogsystem/DETAR_Dialog_Generierung.md` ab) — festes
Raster (IDs, Themen, Freischaltungen, `initial` wie die Siemens-Karte), drei
Rückfragen, Länge in Seiten (Ziel 1, max 2), `{firma}` max 2× mit
Public-Fassung, `persona` als Feld, kein `quelle`. Build 68 (Michael
2026-10-08): Firmenfassung entsteht zuerst, neutrale Fassung inhaltlich
deckungsgleich ohne Logo/Link/Firmenbezüge; nichts, was sich schnell ändert
(kein Gehalt — Pflichtfrage `geld` ersetzt durch `berufsschule`, seit Build 79 `lernort`); keine
Eigennamen aus dem Betrieb; `firmenbegriffe` (Liste in dialog.json) dürfen nur
in Firmenfassungen stehen; Prüfseite zeigt die Lesefassung beider Fassungen. Build 70: Aussagen ohne Quelle tragen `[Annahme]` im Text (App zeigt die Marke; vor der Freigabe auflösen; zählt nicht zur Länge); Ziel eine Seite, Sinn auf der ersten Seite. Build 71: Schätzfrage mit vier Optionen (drei Schätzungen + „Keine Ahnung", 2×2-Raster). Build 77 (Michael 2026-10-09): Gendern, Schreibweisen und Satzzeichen aus dem Tonality Guide von DEIN ERSTER TAG (Regelwerk A7: neutral zuerst, sonst `*`; `profession` mit `*`, kein (w/m/d); „du" klein; kein „&", keine Abkürzungen; max. 3 Ausrufezeichen je Fassung; Antworten enden nicht mit einer Frage; Satzanfänge abwechseln) — Prüfseite prüft das mit. Build 78 (Michael 2026-10-08, parallel zu Build 77 entstanden): in exportierten JSONs (daten.json, dialog.json, katalog.json) steht nur, was App oder Prüfseite lesen — kein `_hinweis` mehr (Notizen → Prüfbericht im Projektordner, Feldbeschreibung daten.json → Regelwerk „Einbau", seit Build 107 `docs/karte-einbauen.md`); die Prüfseite meldet nicht vorgesehene Felder als Fehler. Build 79 (Michael 2026-10-09): duales Studium — Feld `art` (`ausbildung`/`dual`) in dialog.json, `persona.lehrjahr` → `persona.jahr`, Pflichtfrage `berufsschule` → `lernort` (Berufsschule, Pflegeschule, Hochschule, Akademie), Regelwerk A3a (Schwerpunkt Studium), `profession` bei dual „<Studiengang> – duales Studium". **Build 107 (Michael 2026-10-13): Skill „detar-dialog“** — die Dialog-Seite (Quellen, Generierung, Abnahme beim Betrieb) läuft in einer eigenen Claude-Session außerhalb dieses Repos; zurück kommen `dialog.json` + Faktenblatt. Regelwerk dafür eigenständig gemacht (keine Projektordner-Verweise, Teil B mit Quellenmarken, Prüfbericht in vier Teilen, Persona vorläufig, Abschnitt „Abgabe“; Einbau → `docs/karte-einbauen.md`; Quellenliste `docs/dialog-quellen.md`, vorher `Kunde/DETAR_Erhebung_Inhalte.md` im Projektordner). `tools/dialogpruefung.mjs` = Prüfseiten-Regeln auf der Kommandozeile (`--firma` mehrfach, `--final` macht `[Annahme]` zum Fehler, `--lesefassung` als Markdown); Seiten geschätzt mit `tools/seitenSchaetzung.js` (gleich breite Zeichen, 27 je Zeile, kalibriert an 198 Texten: 187 exakt, Rest eine Seite zu hoch, nie zu niedrig — Michael: Schätzung reicht). Dafür `wrapWords`/`paginateChars` aus `SpeechBubble` nach `bubbleText.js` gezogen (gleicher Algorithmus, App-Verhalten unverändert, an 198 Texten gegen Build 106 verglichen). Prüfregeln neu: Datum und Betrag hinter „verdien…“ = Fehler, Jahreszahl/Monat = Hinweis. Bau: `Dialog-Skill-bauen.command` → `tools/baue-dialog-skill.mjs` → `dist/detar-dialog.zip` (gitignored; Quelle bleibt das Repo, SKILL.md in `tools/dialog-skill/`). Vorbild:
`karten/000/dialog.json`. Prüfseite
`tools/kartenpruefung.html` (+ `kartenpruefung.js`, reine Regeln) misst mit
`SpeechBubble.paginate()` am echten Font — Prüfregeln dort und Regelwerk
synchron halten.

- `karten/000/dialog.json` — Dialog des Prototyps (Siemens-Dialog,
  PENNY-Figur/-Marker als Platzhalter; bis Build 62 `cards/elektroniker.js`). Felder: `art` (ausbildung|dual), `persona{name,jahr,haltung}` und `firmenbegriffe[]` (nur für Regelwerk/Prüfseite, App liest sie nicht), `themen`, `initial`, `greeting{tag,text,textPublic}`,
  `asks[{trigger,prompt,options[{label,sets,unlocks,tag,reply}]}]`,
  `questions[{id,thema,label,text,tag,unlocks,requires,link,url,end}]`,
  `reentry.rules`, je Textfeld optional `<feld>Public`. Text darf `<marker> <gross> <leise> <knall>` tragen
  (`<welle>`/`<zittern>` werden geparst, nicht bewegt — Canvas-Entscheidung; laut Regelwerk erlaubt).
- `js/dialogEngine.js` — Zustand + Regeln (unlocked/asked/fresh/vars/asksDone/
  visits/view), kein DOM, kein 3D.
- `js/cardController.js` — Ablauf: say() paginiert und blättert mit Weiter;
  kein DOM, kein `window` (Stufe 3e, Build 90; Ausnahme `window.open` der
  Link-Frage): Dev-Replay über den Hook `onRescan(done)` aus experience.js
  (Suchrahmen + `CHOREO.replayRescanMs`), Tap-Phasenfragen `acceptsCardTap`/
  `acceptsFigureTap`, `onCardTapped()` → "start"/"reentry"/false; in Node
  testbar (`tests/cardController.test.mjs` mit Attrappen);
  Weiter-Knopf NUR zwischen Seiten, vor einer Rückfrage und vor „Seite öffnen"
  (window.open braucht die Nutzergeste). Ausstieg → Fazit → Abschied →
  `activation.playOut()` (Figur klappt ein) → Phase `resting` → Tap auf die
  Karte → Wiedereinstieg (beiläufige Zeile, Zustand bleibt).
  **Build 108 (Michael 2026-10-14):** jede Antwort beginnt mit einem
  Anfangston (`sound.bubbleOpen()`, zwei steigende Rechteck-Töne, ~85 ms,
  `SOUND.bubble*`, nur Seite 1); das Tippen ist lautlos — Animalese-Stimme
  (`js/voice.js`, `SOUND.speech*`) und Tipp-Ticks (`SOUND.typeTicks`) sind
  raus. Lesezeit verdoppelt (Karte 000 `idleReturnMs` 16000, Fallback 11000);
  `CHOREO.livelyAfterMs` (2 s) nach dem Tippen beginnt die Lebendig-Phase
  (`scheduleLively` → Pose idle + `wander.setLively(true)`: Umschauen nach
  `IDLE.lookChance`, noch ohne Gehen, weil die Blase an der Figur hängt —
  die Gewichtsverlagerung (Kippen + stärkerer Atem) ist seit Build 109,
  Michael 2026-10-15, wieder raus;
  gilt auch, solange ein Weiter wartet); nach der Lesezeit Blase weg und
  freies Idle mit Gehen.
- `js/speechBubble.js` — `paginate()` schneidet am Satzende (Notfall Komma/
  Gedankenstrich, dann Wortgrenze), gemessen am echten Font. Seitenzähler
  „1/3" seit Build 30 aus (`TYPO.pageLabel: false`, Michael 2026-09-07);
  Seiten + Weiter-Kachel bleiben. Kein stilles Kappen mehr.
- `js/bubbleText.js` — Markup-Parser, Satz-/Wortgrenzen.
- `js/questionMenu.js` — Phasen: themen → thema ([←] Kopfzeile mit NEU-Punkt,
  Fragen mit Reitern NEU/LINK/✅) · options · next · idle; Optik siehe „UI".
  Ausstieg als Kachel (`engine.exitQuestion()`). Link-Frage „link" ist seit
  Build 31 eine normale Frage im Thema `wege` (Reiter LINK, „Seite öffnen" →
  neuer Tab), freigeschaltet durch „bewerbung".
- `config.js → POSES`: Emotion-Tag → Körper (idle/affirm/think), bis der Rig
  die elf Posen liefert; die Posenliste der Karte hat Vorrang (s. „Engine und Karten"). `CHOREO`: continueDelayMs, collapseDelayMs,
  collapseSec, livelyAfterMs (Lebendig-Phase nach dem Tippen, Build 108), trackingLostMs (Menü friert nach Verlust ein, Suchrahmen kommt),
  lostFadeMs/foundFadeMs (Szene aus-/einblenden, je 300 ms).
- Randzustände: Kamera abgelehnt → `body.camera-denied` (eigener Bildschirm im
  Splash). **Tracking verloren (Build 99, Michael 2026-10-12):** nach der
  Haltezeit des Trackers (`STAB.lostHoldMs` 250 ms / Gyro-Brücke bis
  `GYRO.bridgeMs` 1,2 s) faded die ganze Szene in `CHOREO.lostFadeMs` aus statt
  hart zu verschwinden; nach `CHOREO.trackingLostMs` (1,5 s) friert das Menü
  ein und Suchrahmen + `#lostHint` („Halte auf die Karte", Icon-Zeile OBEN
  am Bildrand über dem Rahmen, Build 102) kommen zurück, beide mit
  300 ms Fade-in (`body.wieder-suchen`, Build 103; beim Start ohne Fade) — Hook `onSearch` des CardControllers
  (`controller.searching`), gilt ab der Aktivier-Phase; im Ruhezustand trägt
  die Panel-Zeile den Text (ebenfalls erst nach 1,5 s). Beim Fund: Rahmen +
  Hinweis sofort weg, Szene faded in `CHOREO.foundFadeMs` ein.
- Tap-Entprellung in `js/tapInput.js` (pointerup + click-Fallback binnen 120 ms; beide prüfen seit Build 112 `tapMaxPx`/`tapMaxMs`; bei ausgeblendeter Szene — Karte verloren — zählt kein Tap, experience.js) —
  seit dem Dialogsystem wäre Doppel-Auslösung NICHT mehr harmlos.
- Splash: `card.companyLogo` (Pfad) oder Firmenname als Text; `card.jobUrl`
  wird seit Build 18 nicht mehr angezeigt (DET-Label raus).
- Build 16 ist vom ungemergten Branch `tracking-runde5` belegt (nur im alten
  Repo `L77D/detar`), deshalb springt die Zählung von 15 auf 17.

**Tracking-Target:** liegt im Kartenordner `karten/<id>/targets/` (`<design>.json` +
`<design>_luminance.png` aus `@8thwall/image-target-cli`; Standard = erstes
Design in daten.json, weitere per `?design`, s. „Engine und Karten"). Karte 000:
Standard seit Build 95 `p04` (Testdruck 04_2809_1 aus Figma, Export 1488×2078,
Aspekt 1,40 = 63×88 mm). Das frühere `card` (beschnittene Demo-Karte 070926,
1346×2156 px, Aspekt 1,60) ist aussortiert und gelöscht. `SCENE.cardAspect`
steht seit Build 98 auf 88/63 = 1,40 (Eck-Marker, Tap-Fläche, Desktop-Plane;
bis Build 97 1,60 → Marker ~7 % der Kartenbreite zu weit oben/unten). Ein Rest:
`karten/000/vorschau.jpg` (Desktop-Kartenbild) ist noch das alte Druckbild im
alten Format — P04 aus Figma als 1200-px-JPG nachziehen.
Physische Breite fürs Tracking = `breiteMm` des Designs in daten.json (63 mm,
Druckspezifikation 63 × 88 mm); `SCENE.cardWidth 0.059` ist nur noch die
Szenen-Einheit (worldRoot-Skalierung). Die Figur ist relativ zur Kartenbreite
definiert. (MindAR-Target `card.mind`, Compiler-Skript, `targets/old/`: nur
im alten Repo `L77D/detar`.)

**Stack (seit 2026-09-09):** `three@0.160` als schlankes Bundle in
`vendor/three/` (relativer Import `../vendor/three/three.module.js`, KEINE
Importmap mehr) + **Open-Source-8th-Wall-Engine** (MIT) selbst gehostet unter
`vendor/8thwall/` (SIMD) und `vendor/8thwall-nosimd/` (Fallback; `js/arSession.js`
wählt per `WebAssembly.validate`, `?nosimd` erzwingt) — `xr.js` +
`xr-tracking.js`; Bildtracker, KEIN SLAM, kein Binary, kein Niantic-Aufruf,
kein API-Key. Engine wird erst in der Start-Geste geladen; `js/preflight.js`
prüft vorher In-App-Browser/HTTPS/Kamera-API/WASM/WebP und zeigt sonst
`#preflightScreen`. Production-Härtung + Gate-Tabelle:
`docs/8thwall-migration.md` Abschnitt 7. Target: `karten/<id>/targets/<design>.json` + `<design>_luminance.png` aus
`@8thwall/image-target-cli`; weitere Designs daneben, gewählt per `?design`
(s. „Engine und Karten"). Alles dazu: `docs/8thwall-migration.md`.
Das alte Repo `L77D/detar` läuft auf `mind-ar@1.2.5` (Archiv, nicht mehr
anfassen). Vanilla ES-Module, GitHub Pages (liefert NUR `main` aus).

## Repos und Branches (seit 2026-10-12, Michael)

- **Haupt-Repo: `L77D/v2tracker`** (dieses Repo). `main` ist der Stand, den
  GitHub Pages ausliefert → https://l77d.github.io/v2tracker/ (Testlink und
  einziger aktueller Stand). Gearbeitet wird auf eigenen Branches; erst der
  Merge nach `main` bringt eine Änderung auf den Link. **Kein Spiegel-Push
  mehr** — bis 2026-10-12 war dieses Repo nur der Spiegel von
  `L77D/detar` → Branch `v2tracker-prod` (`git push … v2tracker-prod:main`).
- Weitere Branches hier: `daten-dialog` (Stand Build 76, 2026-10-08, nicht in
  `main`), `uebergabe-studio2b` (Engine + Beispielkarte für Studio2B,
  2026-10-09), dazu Arbeits-Branches `claude/*`.
- **Veraltet: `L77D/detar`** (Archiv, nicht mehr pushen). Dessen `main` =
  Build 33 auf MindAR (https://l77d.github.io/detar). Dort liegen auch die
  Historien-Branches `v2tracker-prod` (bis 2026-10-12 der Arbeitsstand, hierher
  gespiegelt), `v2tracker-lean` (Entschlackung, Build 49), `8thwall-image-targets`
  (Build 48), `pruefstand` (Strategie E: `?record`/`?replay`/`?metrics`,
  MindAR-basiert, ungemergt) und `tracking-runde5`.

## Konventionen

- **Versionierung:** `js/version.js` → `BUILD` = freilaufender Zähler,
  **bei JEDEM Push +1** (früher = Commit-Anzahl; seit dem Spiegel-Betrieb
  stimmt das nicht mehr, Build 60 = 50 Commits). `?stats` zeigt den laufenden Build
  und prüft per no-store-Fetch gegen den live-Stand („neu laden!" bei altem
  Cache).
- **Keine tuning.json mehr im Repo** (seit 2026-09-09, Branch v2tracker-lean):
  alle Werte sind Defaults in `js/config.js` (EINE Quelle; reine Daten, seit
  Build 90 ohne DOM — `syncCssVars` liegt in questionMenu.js). Eine tuning.json
  wird nur mit `?dev`/`?tuning` geholt — Tuning-Werkzeug, nie einchecken
  (sonst wieder die Masking-Falle: config-Änderungen wirken nicht, wenn der
  Block in tuning.json steht).
- **Schalter sind Booleans (Build 89, Refactoring Stufe 3d):** `STAB.enabled`,
  `nanGuard`, `gravityArbiter` (bis Build 110 auch `normalize`, `deadZones`,
  `lostHold`, `snap`, `scaleLock`, `extrapolate` — mit dem PoseStabilizer
  archiviert), `GYRO.enabled`, `SOUND.enabled`,
  `CHOREO.requireTap`, `ACTFX.hopper`, `TYPO.pageLabel` sind
  `true`/`false` — bis Build 88 die Strings `"ja"`/`"nein"`, verglichen mit
  `!== "nein"` in sieben Modulen. Jedes Einspielen eines Presets läuft über
  `config.applyTuning()` (tuning.json, Dev-Panel-Presets + localStorage-Stand,
  `window.__TUNING` des Lokal-Prototyps), das `"ja"`/`"nein"` übersetzt — alte
  Presets laden also weiter; andere Strings (`SOUND.speech: "aus"`) bleiben.
  Im Dev-Panel heißen Schalter `bool: true` (Select zeigt ja/nein). Neue
  Schalter: `if (STAB.x)`, nie wieder Strings.
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
  Fonts haben seit Build 64 einen festen deutschen Zeichensatz — neue Karten
  brauchen keinen Font-Neubau; nur wer den Satz erweitert, nutzt
  `tools/build-fonts.sh` (Original-TTFs von Google Fonts). Vollständige Gate-Tabelle:
  `docs/8thwall-migration.md` 7.2.
- **Lokal-Prototyp (Einzeldatei, Doppelklick, kein Server):**
  `python3 tools/build-lokal-prototyp.py <Ziel.html>` packt die App in eine
  HTML-Datei (Module als data:-URLs in der Import-Map, Assets/Fonts/tuning.json
  eingebettet, Desktop-Modus + Dev-Panel erzwungen; three.js aus `vendor/three/`,
  kein CDN). Bei Bedarf neu erzeugen; kein fester Ablageort mehr (alte Stände: `…/Claude/_Archiv/Lokal-Prototyp/`).
  Kartendaten im Projektordner: `Karten/<nr>_<firma>_<beruf>/Export/<nr>/` = `karten/<nr>/` hier
  (Übernahme per `_Karte übernehmen.app`, 2026-10-08).
  Das Skript patcht Quelltextzeilen per `assert` (markiert mit
  „Patch-Anker build-lokal-prototyp.py" in main.js, rig.js, supportUI.js,
  kartenLader.js, desktopMode.js; in config.js ist die tuning.json-Fetch-Zeile
  OHNE Marker-Kommentar der Anker) — Wortlaut dort nicht ändern;
  `tests/vertrag.test.mjs` prüft alle Anker.
  Seit Build 63 bettet es `karten/` ein (Bilder als data:-URIs, JSON als
  `window.__JSON`, ohne `targets/`).
  **Feinschliff (Michael 2026-09-04), seit Build 22 live, seit Build 61 direkt
  in den Basisregeln (kein `body.lokal`, keine Override-Blöcke mehr):**
  Silkscreen −12 % Laufweite · Splash-Raster driftet nach rechts oben ·
  enges Kachelraster (88/102 px Zeilen, `--q-row-themen/-fragen`) · „Halte auf
  die Karte" als Laola-Welle (`wave`-Spans in supportUI) · Karte gefunden: Icon
  springt aus dem Panel (`IconHandy.jumpOut`) und hüpft in 3D auf der
  Kartenmitte mit flachem Pixel-Schatten (`ActivationFX.landIcon/tickHopper`,
  `ACTFX.hopper: true`).
- **Tests (Build 86, Refactoring Stufe 3a):** `node --test 'tests/*.test.mjs'`
  (Node 22, keine Abhängigkeiten, keine package.json — Node erkennt die
  ES-Module am Syntax; das Verzeichnis allein als Argument geht nicht). Geprüft
  werden die DOM-freien Module: dialogEngine, edition, bubbleText, poseArbiter
  (three.js aus `vendor/` läuft in Node), jitterMetrics und die Regeln in
  `tools/kartenpruefung.js` — die Prototyp-Karte 000 muss dort fehlerfrei
  bleiben. Datengrundlage lädt `tests/karte.mjs`. Seit Build 88 ein
  **Goldstandard** für den Tracker: `tests/stabilizerSzenario.mjs` (gefälschte
  Uhr + Gyro, feste Tracking-Werte `STAB_FEST`, 1300 Ticks durch alle Phasen)
  gegen `tests/fixtures/tracker8lerp.golden.json` (Stand Build 110, erzeugt
  2026-10-15; bis Build 110 `poseStabilizer.golden.json`, jetzt im Archiv) je
  Feature-Schalter-Variante, Toleranz 1e-9. Der Goldstandard bricht bei JEDER
  Verhaltensänderung im Filter — gewollt; bei einer gewollten Änderung mit dem
  Stand davor neu erzeugen (`SNAPSHOT_SCHREIBEN=1 node --test
  tests/tracker8lerp.test.mjs`); Tuning in config.js berührt ihn nicht.
  **Characterization Tests (Build 111, Refactoring 2026-10-15):** Snapshot-
  Tests über `tests/snapshot.mjs` (Fixtures `tests/fixtures/*.json`, neu
  schreiben nur bei gewollter Änderung mit `SNAPSHOT_SCHREIBEN=1`) für
  Kartenlader, Sprechblase (Canvas-Attrappe), Menü (Mini-DOM
  `tests/domAttrappe.mjs`), IdleWander, Animationen, Gyro, Tap, Vorabprüfung,
  Sound, Controller-Abläufe und Verträge nach außen (`tests/vertrag.test.mjs`:
  Patch-Anker, DOM-IDs, config-Defaults, Kompatibilitäts-Syntax). Dazu
  `node tools/browser-check.mjs` (headless Chromium: Boot-Zustände je URL,
  Übersichtsseiten, Desktop-Ablauf, Messwerte; `--schreiben` erneuert
  `tests/fixtures/browser.snapshot.json`) und `docs/pruefschritte-manuell.md`
  für alles mit Kamera/Engine/Gyro/Audio.
  Vor jedem Push laufen lassen; wer eine Regel in Regelwerk/Prüfseite
  ändert, zieht den Test nach.
- Kommentare/Commits auf Deutsch, Commit-Trailer `Co-Authored-By: Claude`.
- Änderungen an Tracking-Werten immer mit Datum + Begründung im Kommentar
  (Fix-Log lebt in den Code-Kommentaren; „(MindAR-Stand …)" = Historie aus
  `L77D/detar`, gilt unter 8th Wall nur als Begründung des Aufbaus).
- Gemeinsame Helfer in `js/util.js` (`el`, `rand`, `normalizeAngle`,
  `finiteVec/finiteQuat`, `progress`) — nicht je Modul neu schreiben.
- `.gitignore` hält `tuning.json`, `beats.theatre.json`, den Lokal-Prototyp und
  CLI-Zwischenbilder aus dem Repo.

## Boot und Szene (seit Build 87, Refactoring Stufe 3b)

`main.js` ist nur noch der Boot (URL-Flags, Vorabprüfung, Karte laden, Splash,
Start-Geste mit Sound + Gyro-Permission, Fehlerpfade, Dev-Werkzeuge) und
reicht einen Kontext `ctx` `{card, design, gyro, log, devLog, DebugOverlay,
StatsOverlay, attachDevTools}` an die Module:

- `js/arSession.js` — Engine-Variante (SIMD-Test, `?nosimd`), `preloadEngine()`
  im Boot, `startAR(ctx)` aus der Start-Geste: Lazy-Load mit Timeout, Target-
  Daten, Canvas, Kamera-Pipeline, Pipeline-Modul „detar" (Bildpose → Rohpose
  `anchor.matrix`, PoseStabilizer, ?stats, `#lostHint`, Kamera-Ausfall).
- `js/experience.js` — `buildExperience(szene, ctx)` für AR und Desktop: Rig,
  Behaviors, Sprechblase, Menü, CardController, Tap-Auswertung (`handleTap`:
  Karte → `controller.onCardTapped()` liefert "start"/"reentry"/false, Blase,
  Figur), Render-Loop. `szene.relocalize` = `stab.reacquire` (nur AR).
  Phasenfragen stellt der Controller selbst (`acceptsCardTap`, `acceptsFigureTap`).
- `js/tapInput.js` — Pointer → Tap (Entprellung, Tap ≠ Drag) + Raycaster.
- `js/figureJump.js` — Parabel-Hüpfer der Figur.
- `js/desktopMode.js` importiert `buildExperience` selbst (`startDesktop(ctx)`).
- Patch-Anker von `tools/build-lokal-prototyp.py` in main.js (`DESKTOP_MODE`,
  `DEV_MODE`) und desktopMode.js (`vorschau`) sind unverändert; das Skript
  sammelt `js/` rekursiv, neue Module brauchen dort nichts.

## Tracking-Architektur

**Seit Build 111 läuft an der Stelle „PoseStabilizer.tick()" der Tracker
`8lerp` (s. „Tracker"); die Stufenbeschreibung darunter (NaN-Guard → Scale-Lock →
Median → One-Euro …) ist die des archivierten PoseStabilizers und bleibt als
Herleitung stehen.**

```
8th Wall XrController (xr-tracking.js) → reality.imagefound/imageupdated/imagelost
  └─ anchor.matrix (arSession.js: Kamera⁻¹ × Bildpose, Scale = Kartenbreite; Gruppe
     außerhalb der Szene — Ersatz für MindARs anchor.group)
       └─ PoseStabilizer.tick() (jeden Frame im onUpdate des Pipeline-Moduls)
            └─ poseTarget (Proxy außerhalb der Szene: geglättete Pose + visible = Wunsch des Trackers)
                 └→ stabRoot (KIND DER KAMERA; Pose kopiert, Sichtbarkeit über SceneFade, Build 99)
                      └─ worldRoot (Karten-Frame: rot.x=+90°, scale=1/SCENE.cardWidth)
Rendern: XR8.Threejs.onRender (experience.js → buildExperience({render:false}))
```

(detar/MindAR: `anchor.group.matrix` roh pixel-skaliert, stabRoot auf Szenen-
Ebene, `renderer.setAnimationLoop` — Rest identisch.)

PoseStabilizer (seit Build 88, Stufe 3c: `tick()` ist Dirigent über benannte
Stufen mit expliziter Rohpose `raw`; nach außen liest nur `snapshot()` —
statsOverlay greift auf kein Feld mehr direkt zu): NaN-Guard → **Schwerkraft-Schiedsrichter** (Build 59,
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

## Tracker (seit Build 111 nur `8lerp`, `js/trackerWahl.js`)

Bis Build 110 lagen vier Tracking-Filter parallel im Code (`alt` =
PoseStabilizer, `neu` = tracker.js, `8roh` = Nulllinie, `8lerp`); Michael hat
am 2026-10-15 entschieden: **8lerp bleibt, alt/neu/8roh gehen ins Archiv**
`archiv/tracker-varianten/` (unverändert, mit README zum Reaktivieren; für die
Übergabe an die Produktion wird später separat aufgeräumt). `?tracker=<name>`
in der URL und `STAB.tracker` in config.js wählen weiterhin; ein unbekannter
Name (auch `alt`, `neu`, `8roh`) fällt mit Konsolenwarnung auf `8lerp` zurück,
die Marke oben rechts zeigt dann „alt? → 8lerp". `tracker-vergleich.html`
liegt ebenfalls im Archiv.

**`8lerp`** (`js/tracker8lerp.js`, Build 105, Standard seit Build 110 —
Michael 2026-10-13: „die Summe der Filter in alt/neu macht die UX ruckelig"):
8th-Wall-Messung 1:1 + Lerp/Slerp im Render-Takt auf die letzte Messung
(framerate-unabhängig, a = 1 − exp(−dt/τ), τ = `STAB.lerpPosMs`/`lerpRotMs`
50 ms, Dev-Panel-Regler) + Schwerkraft-Schiedsrichter (`js/poseArbiter.js`)
auf jeder Messung — sonst NICHTS (kein Modus, keine Dead-Zone, kein Median,
keine Ausreißer-Regel, keine Haltezeit, kein Gyro-Delta). Bei Verlust sofort
weg (SceneFade blendet), beim Wiederfinden gleitet sie von der letzten Pose
(kein Snap); nicht-endliche Messung wird nur nicht zum Ziel. Schalter 1 (aus =
1:1) und 10 wirken. **Zurückgestellt (Michael 2026-10-13, „für später
merken"):** kurze Haltezeit bei Verlust, Snap beim Wiederfinden, NaN-Schutz,
Gyro-Brücke/-Kompensation (am Gerät prüfen).

**Vertrag einer Variante** (steht im Kopf von trackerWahl.js): Konstruktor
`(target, gyro)` mit `measure(matrix)` je neuer Messung ODER `(source, target,
gyro)` mit eigenem Lesen in `tick()`; `onFound/onLost/reacquire/tick/snapshot`;
Ausgabe `target.matrix` = Pose × Scale + `target.visible` (target = `poseTarget`
in arSession, seit Build 99 nicht mehr stabRoot selbst — SceneFade blendet
weich). `baueTracker()` wählt den Bauweg, arSession ruft `measure()` nur, wenn
es die Klasse hat (Flag `fresh` bei `imagefound`/`imageupdated`). Neue
Variante: Modul anlegen, in `TRACKER_VARIANTEN` eintragen, Goldstandard über
`tests/stabilizerSzenario.mjs` anlegen (Vorbild `tests/tracker8lerp.test.mjs`).

## Aktuelle Kern-Werte (config.js)

- `CAM`: unter 8th Wall wählt die Engine die Auflösung selbst (Constraint-
  Leiter mit Retry); `maxPixelRatio: 2` gilt weiter (Canvas-Pixelgröße in
  arSession.js). (detar/MindAR: 960×540 per getUserMedia-Wrap, `?res=`.)
- `STAB` (seit Build 111 nur 8lerp): `tracker "8lerp"` · `enabled` ·
  `nanGuard` · `gravityArbiter` · `arbiterMargin 0.15` · `lerpPosMs 50` ·
  `lerpRotMs 50`. Die ~30 PoseStabilizer-Werte (`minCutoff`, `beta`, Dead-
  Zones, Median, Snap, Scale-Lock, Extrapolation …) liegen im Archiv; alte
  Presets mit diesen Schlüsseln laden weiter, die Werte wirken nirgends.
- `CHOREO.tapDebounceMs 120` · `tapMaxPx 6` · `tapMaxMs 400` (Tap-Erkennung,
  tapInput.js) · `idleReturnMs 11000` als Fallback — die Karte (`idleReturnMs` in
  daten.json, heute 16000; beides seit Build 108 verdoppelt) hat Vorrang ·
  `livelyAfterMs 2000`.
- Feature-Toggles im Dev-Panel (`?dev`), seit Build 111 nur 1 Glättung ·
  5 NaN-Schutz · 7 Gyro · 10 Schwerkraft-Schiedsrichter (Pose-Flip); die
  Nummern bleiben wie bis Build 110 (2/3/4/6/8/9 gehörten zum PoseStabilizer).
  `?stats`-Tabellenzeile: Toggle-Kennung vierstellig statt zehnstellig.

## URL-Parameter

`?stats` (seit Build 62 Kennzahlen aus `js/jitterMetrics.js` über 5 s: Takt,
Rauschen roh|stab als 2. Differenz nur auf neuen Messungen, Kopf-Messpunkt in px
mit Versatz + „Lauf ohne Bild", F2F, Modus-Anteil/Wechsel/Auslöser/Drift,
Gyro-Rate; Knöpfe Fall F0–F4 · „Messung 10 s" → Kopieren (Tabellenzeile) /
„Log ↓" (JSON); Anleitung `docs/handheld-jitter-analyse.md` Abschnitt e · Cam+PR, Build-Check,
Engine-Variante, Design, Zeile „Flip": Schiedsrichter-Zustand, Kippwinkel,
n·up roh/gewählt, Flips/Snaps/Re-Lock-Zähler; seit Build 60 handytauglich:
oben links, umbrechend, Knopf „📊" blendet es aus, Zustand in localStorage) · `?k=<id>` (Pflicht — ohne: Auffang-Seite; Karte aus
`karten/katalog.json`) · `?design=<id>` (Kartenbild aus daten.json → designs, Übersicht `karten.html`) · `?dev` (Regler) · `?debug` · `?desktop` · `?timeline` ·
`?nogyro` · `?nosimd` (Nicht-SIMD-Engine erzwingen) · `?tracker=<name>` (Tracker-Variante
`alt`/`neu`/`8roh`/`8lerp`, s. „Tracker-Varianten"; ohne = `STAB.tracker`; `?stats` zeigt die Wahl; seit Build 106 steht der Name zusätzlich klein oben rechts (`#trackerMarke`, main.js → `zeigeTrackerMarke`, auf jedem Bildschirm, unabhängig von `?stats`, mit `?dev` unter dem Dev-Knopf; unbekannter Name → „xyz? → 8lerp"; ohne Flag keine Marke) · `?k=<nr>P` (Public-Edition, steht im
QR-Code der neutralen Karte) ·
`?preflight=inapp|nocam|insecure|nowasm|nowebp` (Hinweis-Screens erzwingen),
`?preflight=aus` · Branch `pruefstand` (nur `L77D/detar`): `?record`, `?replay`, `?metrics`.
(`?res=` gab es nur in `L77D/detar` mit MindAR.)

## Qualitäts-Richtwerte (?stats, Ruhe, 3–5 s Fenster füllen lassen)

**Seit Build 62 gibt es „Jitter roh/stab" nicht mehr.** Die alte Zahl
(Frame-zu-Frame, roh mit Nullen der Frames ohne Messung verdünnt) heißt jetzt
„F2F" und zählt nur neue Messungen; sie enthält Handbewegung. Für Rauschen
gilt „Rauschen roh|stab" (2. Differenz, 3D), für das Sichtbare „Kopf px".
Neue Richtwerte erst nach der Messreihe (`docs/handheld-jitter-analyse.md`);
die Werte unten sind alte F2F-Zahlen und nur noch für Stativ/F0 vergleichbar.

Seit Build 61 sind die mm-Werte ECHTE Millimeter (Kartenbreite des Designs,
63 mm); bis Build 60 rechnete `statsOverlay.js` fest mit einer
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
  Instanz wie `vendor/three/three.module.js`, arSession.js setzt sie). `renderer.setSize` der Engine schreibt Pixelmaße
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
  (arSession.js)
  hat 30 s Timeout; Kamera-Ausfall NACH dem Start zeigt „Kamera unterbrochen"
  in `#lostHint`.
- Kompatibilität: keine `static`-Klassenfelder im Live-Code (ES2022, iOS 14.5
  — das Inline-Gate in index.html prüft nur `?.`/`??` und ließe iOS 13.4–14.4
  ohne Hinweis hängen; Build 61 hat genau das in questionMenu.js behoben).
- **Nur detar/MindAR (Archiv):** mindar-image-three legt IMMER einen CSS3DRenderer-Layer
  an, der Pointer-Events schluckt → `pointerEvents:none`; MindARs elementweiser
  Matrix-Filter erzeugt nicht-starre Matrizen → Grund für den Scale-Lock; MindAR
  schätzt das Kamera-FOV nur (Kipp-Wobble, Strategie A3).
- iOS: Gyro-Permission MUSS in der Start-Geste angefragt werden (vor allen
  awaits); die Kamera startet erst NACH der Antwort (Build 113, main.js — parallel
  endete es auf iPhones ohne gespeicherte Bewegungs-Erlaubnis in „Ohne Kamera
  geht's nicht“, Technik-Zeile `#permDetail` zeigt Fehler + Gerät); Safari cached JS aggressiv → Build-Check in ?stats nutzen. Achtung:
  Safari cached JEDE Datei einzeln (Pages: max-age 600) — `version.js` kann
  frisch sein, während ein anderes Modul noch alt ist (daten.json/dialog.json/katalog.json
  holt der Kartenlader seit Build 63 mit no-store). `?stats` zeigt deshalb seit
  Build 33 auch die geladene Karte (id, Fragenzahl, Link-Frage). Einzelne
  Datei erzwingen: ihre URL direkt in Safari öffnen, dann die App neu laden.

## Referenzen

- `docs/tracking-strategien.md` — Strategien A–E (Rohsignal, Fork,
  WebXR-Fusion, Eck-Anker-Karte, Prüfstand) mit Wissen + Vorgehen je Punkt.
  MindAR-Stand (2026-07): B (MindAR-Fork) und C sind auf diesem Branch
  gegenstandslos, A/D/E gelten sinngemäß weiter.
- Refactoring Stufe 3 (2026-09-15; erledigt 2026-10-09: 3a Tests (Build 86),
  3b main.js zerlegt (Build 87, s. „Boot und Szene"), 3c PoseStabilizer in
  Stufen + `snapshot()` + Goldstandard (Build 88), 3d Schalter als Booleans
  (Build 89), 3e Controller ohne DOM + `syncCssVars` von config.js nach
  questionMenu.js (Build 90). Offen, jeweils Verhaltensänderung mit
  Gerätetest, kein Refactoring): Scale-Lock ausbauen (erst Re-Lock-Zähler am
  Gerät prüfen) · Arbiter: `qEarth` ändert sich 60 Hz ohne Dead-Band → kann
  stale Frames als „neu" melden (Vision-Hz in ?stats prüfen) · `SCENE.cardAspect`
  1,60 → 1,40 (erledigt, Build 98) · Tests (`node --test`) für bubbleText, dialogEngine,
  edition, poseArbiter (erledigt, s. „Konventionen") · `"ja"/"nein"` → Booleans
  (erledigt, Build 89; `applyTuning` übersetzt alte String-Presets).
- Fix-Historie: Code-Kommentare mit Datum (2026-07-08 / -09 / -13 / -14).
