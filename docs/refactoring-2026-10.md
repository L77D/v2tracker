# Refactoring + Performance-Durchgang, 2026-10-15 (Build 110 → 111)

Auftrag (Michael): Aufräumen und nur dort optimieren, wo Messungen einen echten
Engpass zeigen. **Das Verhalten von Build 110 ist die Spezifikation** — nichts,
was Nutzer sehen, auslösen oder als Ergebnis bekommen, hat sich geändert.
Einzige sichtbare Ausnahme, von Michael entschieden: `?tracker=alt|neu|8roh`
fällt jetzt mit Warnung auf `8lerp` zurück (Marke „alt? → 8lerp"), die
Varianten liegen in `archiv/tracker-varianten/`.

## 1. Vorgehen

1. Bestandsaufnahme (Modulgraph, tote/doppelte Stellen, Hotspots, Verträge nach außen).
2. Verhalten abgesichert, BEVOR Code angefasst wurde: 57 neue Tests (133 → 190 vor der
   Archivierung; danach 153, weil die Tests der archivierten Tracker mitgingen), alle
   Fixtures mit dem unveränderten Build-110-Stand erzeugt. Dazu `tools/browser-check.mjs`
   (headless Chromium, Boot-Zustände je URL, Übersichtsseiten, Desktop-Ablauf) und
   `docs/pruefschritte-manuell.md` (Kamera, Engine, Gyro, Audio).
3. Ausgangswerte gemessen (unten).
4. Plan vorgelegt; Freigabe + Entscheidung zu den Tracker-Varianten.
5. Aufräumen in sechs einzeln nachvollziehbaren Commits, nach jedem: `node --test`,
   Browser-Snapshot, Lokal-Prototyp-Bau.
6. Optimieren: nur die Lade-Entschlackung, die sich aus dem Aufräumen ergibt (s. 3).
7. Dieser Bericht.

## 2. Messwerte vorher / nachher

Umgebung: headless Chromium (Playwright) mit Software-GL gegen `tools/dev-server.js`,
Desktop-Modus `?k=000&desktop&stats`. Absolute Frame-Zeiten sind damit NICHT
handy-repräsentativ; Bytes, Requests und JS-Anteile schon.

| Messgröße | Build 110 | Build 111 | Δ |
|---|---|---|---|
| App-JS gesamt in `js/` (roh / gzip) | 325,2 KB / 108,3 KB | 274,4 KB / 92,7 KB | −50,8 KB / −15,6 KB |
| statisch beim Boot geladene Module (ohne three.js) | 32 Dateien, 277,8 KB roh | 29 Dateien, 216,6 KB roh (84,6 KB gz) | −3 Dateien, −61,2 KB |
| Requests / Bytes bis zum freien Start-Knopf | 46 / 890,9 KB | 43 / 829,9 KB | −3 / −61,0 KB |
| Requests / Bytes nach dem Start (Desktop) | 64 / 1 484 KB | 60 / 1 423 KB | −4 / −61 KB |
| `js/config.js` | 384 Zeilen | 302 Zeilen | −82 |
| JS-Selbstzeit je 3 s (Blase steht, Menü offen) | 70–92 ms (2,3–3,0 %) | 73 ms (2,4 %) | gleich (Messrauschen) |
| Heap-Allokation pro Frame (Sampling-Profiler) | 0,1–0,2 KB | unverändert | – |
| `renderCanvas` je Aufruf (Median / p95) | 0,2 / 0,3 ms | unverändert | – |
| `paginate` am echten Font | 0,23 ms je Text | unverändert | – |
| Tracker-Tick in Node (8lerp, Szenario) | 4,0 µs | unverändert | – |
| Tests (`node --test`) | 133 | 153 (+ 20 Snapshot-Fixtures) | |

Unverändert und außerhalb dieses Repos: 8th-Wall-Engine 4,76 MB (SIMD) nach dem
Klick, three.js-Bundle 473 KB / 120 KB gz beim Boot. Ein Befund der ersten Messung
(„~100 KB Allokation pro Frame" über `performance.memory`) war ein Messartefakt — der
Sampling-Heap-Profiler zeigt 0,1–0,2 KB/Frame.

## 3. Was geändert wurde (Commits auf `claude/clever-einstein-673v4u`)

1. **Characterization Tests** — `tests/snapshot.mjs`, `tests/domAttrappe.mjs`, 14 neue
   Testdateien, 20 Fixtures, `tools/browser-check.mjs`, `docs/pruefschritte-manuell.md`.
   Goldstandard für 8lerp (`tests/fixtures/tracker8lerp.golden.json`, Toleranz 1e-9).
2. **Tracker alt/neu/8roh archiviert** — `archiv/tracker-varianten/` (Code, Tests,
   Goldstandard, `tracker-vergleich.html`, README zum Reaktivieren). `trackerWahl.js` kennt
   nur `8lerp`. −55 KB JS beim Boot.
3. **Tote Reste** — `BUILD_DATE`, `idleWander.headBaseRotZ`, `statsOverlay.anchor`
   (+ Signatur), `corner-gelb.svg`, `icon-handy/mouth-shut.png`; `timeline.js` wird nur
   noch mit `?timeline` geladen (bei `?dev` lieferte es sofort `null`).
4. **Veraltete Kommentare/Doku** — Verweise auf `cards/elektroniker.js`, `voice.js`,
   `targets/8thwall/karten.json`, `permaQuestions`, Timeline-Live-Pfad; CLAUDE.md
   (Tracker-Abschnitt, Tests, Patch-Anker), README, Analyse-Dokus mit Archiv-Hinweis.
5. **Doppelter Code** — `figureJump` → `util.progress`, `activationAnim.captureScale()`,
   `arSession` wertet `trackerWahl()` einmal aus.
6. **STAB auf 8lerp reduziert** — `config.js` behält `tracker`, `enabled`, `nanGuard`,
   `gravityArbiter`, `arbiterMargin`, `lerpPosMs`, `lerpRotMs`; Dev-Panel ohne die
   Schalter 2/3/4/6/8/9 und deren Regler; `?stats`-Kennung vierstellig, Messung-Metadaten
   mit lerp/arbiter. Alte Presets mit entfernten Schlüsseln laden weiter (Test).

**Verhaltensgleich, weil:** jeder Commit lief gegen 153 Tests (davon 8lerp-Goldstandard
bitgenau, 20 Snapshot-Fixtures aus Build 110), den Browser-Snapshot (11 URL-Varianten,
Übersichtsseiten, Desktop-Ablauf bis zur Antwort — nur die zwei erwarteten Änderungen in
Schritt 2: Marke bei `?tracker=alt`, `tracker-vergleich.html` weg), den Lokal-Prototyp-Bau
(Patch-Anker) und `tools/dialogpruefung.mjs` (Karte 000 unverändert „keine Fehler · 2 Hinweise").

## 4. Geprüft und bewusst NICHT optimiert

Die Messung zeigt keinen JS-Engpass (2–4 % der Frame-Zeit im App-Code; der Rest ist
three.js-Rendering, WebGL und — am Handy — die WASM-Vision der Engine). Verworfen:
- Szenen-/AR-Module erst in der Start-Geste laden: spart Parse-Zeit vor dem Splash, verschiebt
  sie hinter den Klick, wo ohnehin 4,7 MB Engine warten; Risiko für den Lokal-Prototyp
  (Import-Regex). Ohne Gerätemessung kein Gewinn belegbar.
- `renderCanvas`: `lineRuns` cachen — 0,2 ms je Aufruf, kein Engpass.
- `faceCamera` nur bei sichtbarer Blase rechnen — ändert den Yaw-Lerp beim Einblenden (Verhalten).
- `getCamLocal` pro Frame cachen — Mikrosekunden.
- `preloadEngine()` vor die JSON-Fetches ziehen — würde auf Fehlerseiten 873 KB umsonst laden.
- Allokationen — nichts zu tun (0,2 KB/Frame).

## 5. Offene Punkte und Risiken (aufgelistet, nicht geändert)

- `tapInput.js`: der native click-Fallback löst nach einem Drag trotzdem einen Tap aus
  (`tapMaxPx/tapMaxMs` gelten nur für pointerup). Als Ist-Verhalten im Test festgehalten.
- `kartenLader`: späte Fehler (daten/dialog/format/figur) liefern `ids: []` → Fehlerzeile
  ohne „bekannt:". Im Snapshot festgehalten.
- `arSession.js` (Kamera-Ausfall): `hint.innerHTML = ""` ohne `lost.icon.stop()` — die
  Timer-Kette des Icons läuft am losgelösten Element weiter (kein sichtbarer Effekt).
- `experience.js`: `onRescan`-Timeout nicht verwaltet (mehrfaches Dev-Replay stapelt).
- `timeline.js` lädt Theatre.js vom CDN (einzige Ausnahme der Kein-CDN-Regel, nur `?timeline`).
- `karten/000/vorschau.jpg` ist laut CLAUDE.md noch das alte Druckbild (Inhalt, kein Code).
- Manuelle Prüfung am Handy (docs/pruefschritte-manuell.md) stand in dieser Sitzung nicht
  zur Verfügung — Kamera/Engine/Gyro/Audio sind nur dort prüfbar; die Logik dahinter ist
  durch die Node- und Browser-Tests abgedeckt.
- `GYRO.bridgeMs`/`deltaDeadZone` bleiben in config.js und im Dev-Panel, obwohl 8lerp keine
  Gyro-Brücke/-Deltas nutzt (nur `getOrientation()` für den Schiedsrichter) — bewusst
  gelassen, weil die Brücke als „für später merken" notiert ist.
- Für die Produktionsübergabe (separat, Michael): `archiv/` entfernen oder mitgeben, Dev-Module
  und Werkzeuge entscheiden.
