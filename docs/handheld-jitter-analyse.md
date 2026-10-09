# Handheld-Jitter: Analyse (Phase 1)

Stand 2026-09-25 · Code-Stand Build 61 (Spiegel `L77D/v2tracker`, = `v2tracker-prod`) ·
nur Analyse, kein Produktivcode geändert.

Fall: Karte liegt auf dem Tisch, Handy in der Hand. Befund am Gerät: Figur zittert
sichtbar, Bewertung 5–6/10, `?stats` „Jitter stab" teils 2–3 mm.

## 0. Vorab: zwei Korrekturen am Ausgangsbild

- **Die 2–3 mm stammen aus Build 58 und sind um den Faktor 2,38 zu groß.**
  Bis Build 60 rechnete `?stats` fest mit einer 150-mm-Karte; seit Build 61 mit
  `breiteMm` aus `karten.json` (63 mm) — `js/statsOverlay.js:18-21`, `:56-58`.
  Umgerechnet: 2–3 mm alt ≈ **0,84–1,26 mm echt**. Das Problem bleibt (Ziel laut
  CLAUDE.md: < 0,13 mm in der Hand), ist aber kleiner als gedacht.
- **Die selbst gehostete Engine enthält kein SLAM.** Details unter Punkt 2.

## a) Prüfung der Punkte 1–4 am Code

### Punkt 1 — Normalfall fällt aus der Ruhe-Glättung: **bestätigt, mit Ergänzungen**

- Bewegt-Erkennung über Drift im 250-ms-Fenster: `js/poseStabilizer.js:456-471`
  (Snapshots alle 250 ms, `:460`; EMA-Faktor 0,25 auf die Drift, `:469-470`).
- Schwellen: `minSpeed 0.04` Kartenbreiten/s (`js/config.js:219`) = **2,5 mm/s**
  bei 63-mm-Karte; `minAngSpeed 0.09` rad/s ≈ 5,2 °/s (`js/config.js:226`).
  Entscheidung: `js/poseStabilizer.js:488-499`; zurück in Ruhe erst nach
  `moveDwellMs 250` ohne Überschreiten (`js/config.js:212`).
- Zum Vergleich: Die Drift wird im **Kamera-Frame** gemessen. Liegt die Karte
  25 cm vor der Kamera, reichen ≈ 0,6 °/s ungedeckte Handydrehung für 2,5 mm/s.
  Deckt der Gyro die Drehung ab, bleibt immer noch die Handverschiebung
  (1:1 in mm) — beides übersteigt beim freien Halten leicht die Schwelle.
- Folgen im Bewegt-Modus, jeweils belegt:
  - Totzone Position aus: `js/poseStabilizer.js:316-321` (`!moving`).
  - Totzone Rotation aus: `js/poseStabilizer.js:328` (`|| moving`).
  - One-Euro öffnet: `beta`-Term nur bei `open` = `moving`,
    `js/poseStabilizer.js:313`, `:550`. Cutoff = 0,1 Hz + 10 · |dxHat|.
  - Extrapolation läuft: `js/poseStabilizer.js:501-517`, inklusive
    `latencyMs 40` Vorhersage (`:502`).
- **Korrektur/Präzisierung:** „Der geglättete Wert nähert sich dem Rohwert"
  stimmt nur für den Filter. Die Extrapolation kann `stab` sogar **unruhiger als
  roh** machen: Die Vorhersage nutzt eine Geschwindigkeit aus zwei Messungen
  (50/50-Lerp, `:432`) und schiebt sie bis zu 150 + 40 ms nach vorn (`:502`).
  Rauschen in der Geschwindigkeit wird damit direkt zu Positionsrauschen.
- **Ergänzung Rotation:** Die Rotations-Glättung hat gar kein Gate. Ihr Cutoff
  wächst immer mit `angVel` (`js/poseStabilizer.js:329`), auch in Ruhe.
- **Kommentar widerspricht Code:** `js/poseStabilizer.js:477-480` beschreibt
  Ausschalten „unter der HALBEN Schwelle". Der Code (`:490-499`) kennt keine
  halbe Schwelle, nur die Verweilzeit.

### Punkt 2 — Stabilizer kennt nur die Kamera-relative Pose: **bestätigt; SLAM-Aussage falsch**

- Eingang ist die Kamera-relative Pose: `js/arSession.js` (`updateAnchor` =
  Kamera⁻¹ × Bildpose), Stabilizer liest sie `js/poseStabilizer.js:196`.
  Hand- und Kartenbewegung sind darin nicht trennbar.
- Gyro liefert nur Drehung: `js/gyroFusion.js:63` (nur `deviceorientation`),
  `:98-113` (Rotations-Delta); angewendet als reine Drehung in
  `js/poseStabilizer.js:524-541`. Keine Verschiebung.
- `disableWorldTracking: true`: `js/arSession.js` (`startAR`).
- **Korrektur: Die Open-Source-Engine in `vendor/8thwall/` hat kein World-
  Tracking, das man einschalten könnte.**
  - `docs/8thwall-migration.md:10-14`: „Die Open-Source-Engine enthält gar kein
    SLAM"; SLAM steckt nur im geschlossenen `@8thwall/engine-binary`
    (`xr-slam.js`, eigene Lizenz).
  - Gegenprobe im eingebetteten WASM von `vendor/8thwall/xr-tracking.js`
    (Strings): vorhanden sind `pose-robust-pnp`, `pose-image-homography`,
    `track-local`, `track-global`, `PoseEstimationTranslationStability`
    (Ceres). Keine Treffer für `slam`, `keyframe`, `mapPoint`, `WorldTracking`.
  - Ohne `disableWorldTracking` verlangt die Engine ein Mobilgerät
    (Fehlertext „Reality with camera on non-mobile devices requires
    disableWorldTracking" in `xr-tracking.js`). Was sie dann auf dem Handy
    liefert (vermutlich nur Geräte-Drehung), ist nicht belegt → Spike nötig.
- **Präzisierung „genau diese fehlt":** Im Kamera-Frame dominiert meist die
  Drehung (1° bei 25 cm ≈ 4,4 mm Kartenversatz), die Verschiebung ist kleiner.
  Die Drehung deckt der Gyro ab — aber zeitlich versetzt (siehe Punkt 4,
  Befund B2). Beim Drehen aus dem Handgelenk entsteht zusätzlich echte
  Kameraverschiebung (Hebel ≈ 10–15 cm → ≈ 2 mm pro Grad), die kein Sensor im
  aktuellen Aufbau liefert.

### Punkt 3 — Messung trennt nicht: **bestätigt, plus zwei Messfehler**

- Frame-zu-Frame-RMS der Position, im Kamera-Raum, in Kartenbreiten × mm:
  `js/statsOverlay.js:22-37` (Ring), `:118-129` (Befüllung).
  Echte Handbewegung zählt voll mit.
- **Messfehler 1 — roh und stab sind nicht vergleichbar.** Der Ring wird jeden
  Render-Frame befüllt (`:118-125`). Roh ändert sich nur bei neuer Messung
  (≈ 30 Hz), dazwischen stehen Nullen. Stab ändert sich jeden Frame. „roh" ist
  dadurch systematisch verdünnt, das Verhältnis roh/stab verzerrt.
- **Messfehler 2 — Rotation fehlt.** Gemessen wird nur die Position des
  Karten-Ursprungs. Drehrauschen wirkt am Kopf der Figur (Hebel = Figurhöhe)
  und ist oft das Sichtbare.
- Fenster: `N = 90` Render-Frames (`:16`) ≈ 1,5 s bei 60 fps. CLAUDE.md empfiehlt
  „3–5 s füllen lassen" — das Fenster ist kürzer.
- Der Richtwert „< 0,3 mm" steht noch im Kopfkommentar (`:6`); in CLAUDE.md ist
  er seit Build 61 auf < 0,13 mm umgerechnet. Beide Werte taugen im Handheld-
  Fall nicht als Ziel, solange Handbewegung mitgemessen wird.
- Die 0,16 mm aus dem alten Prüfstand: synthetisch, MindAR — nicht als Beleg
  verwenden (übernommen aus dem Auftrag).

### Punkt 4 — Stabilizer unverändert von MindAR übernommen: **bestätigt, teils schon markiert**

MindAR-Begründungen, die im Code stehen:

- Extrapolation mit „MindAR misst nur mit ~15–30 Hz":
  `js/poseStabilizer.js:294-300`; `latencyMs 40` als „Alter der Vision-
  Messung" geschätzt: `js/config.js:210-211`.
- beta-Gate mit „15–30-Hz-Treppensignal": `js/poseStabilizer.js:305-312`.
- Gyro-Kopfkommentar „MindARs visuelle Pose": `js/gyroFusion.js:5-6`.
- Stale-Kommentar „MindAR hat nicht neu gemessen": `js/poseStabilizer.js:401`.
- Einheiten-Kommentar „15-cm-Karte": `js/config.js:137` (bei 63 mm ist
  `posDeadZone 0.001` = 0,063 mm, nicht 0,15 mm).
- Scale-Lock ist bereits als wirkungslos unter 8th Wall markiert:
  `js/config.js:149-154`, `js/poseStabilizer.js:225-228`.
- Offener Punkt „Stabilizer-A/B am Gerät": `docs/8thwall-migration.md:270-271`.

Zwei Befunde, die über den Auftrag hinausgehen (aus dem Engine-Code gelesen,
am Gerät zu bestätigen):

- **B1 — Kamerabild und Pose sind unter 8th Wall synchron.** Das Threejs-Modul
  zeichnet `realityTexture` (das Bild, das der Tracker ausgewertet hat), nicht
  das Live-Video (`vendor/8thwall/xr.js`, Stelle
  `g.realityTexture||g.cameraFeedTexture`). `imageupdated` kommt aus demselben
  Ergebnis. Unter MindAR lief das Video live und die Pose hinterher — dafür
  waren `latencyMs` und Extrapolation gebaut. Unter 8th Wall schiebt die
  Extrapolation die Figur **vor** das angezeigte Bild; zwischen zwei Messungen
  läuft die Figur, während das Bild steht.
- **B2 — Gyro-Prediction läuft dem Bild voraus.** Das Gyro-Delta wird zur
  Renderzeit sofort angewendet (`js/poseStabilizer.js:193`), das Bild zeigt
  aber den ausgewerteten, älteren Frame. Beim Drehen in der Hand eilt die
  Figur dem Kartenbild voraus, die nächste Messung zieht sie zurück. Derselbe
  Versatz landet in der Bewegungs-Schätzung (gedrehte `measPos` vs.
  ungedrehte, ältere Rohpose, `:421-437`) und kann den Bewegt-Modus füttern.
- Nebenbefund: Die Engine hat eine eigene zeitliche Stabilisierung der
  Translation (`PoseEstimationTranslationStability`). Unser Filter sitzt
  womöglich auf einem schon geglätteten Signal (doppelte Latenz).

## b) Messplan: Handbewegung und Tracking-Rauschen trennen

### Fälle (je 3 × 10 s, gleiches Licht, gleiche Karte, Abstand ≈ 25 cm, Neigung ≈ 45°)

- **F0 Stativ:** Handy fest aufgelegt (Bücherstapel), Karte liegt. Rauschboden.
- **F1 Abgestützt:** Ellbogen/Handkante auf dem Tisch, Karte liegt.
- **F2 Freihändig:** Handy frei in der Hand, Karte liegt (Demo-Normalfall).
- **F3 Schwenk:** frei, langsam um die Karte schwenken (Nachlauf-Prüfung).
- **F4 Verdecken:** Karte 1,5 s abdecken (Lost-Hold, Snap, Brücke).

Pro Fall als Paar roh/stab erfassen, plus Modus-Werte. F0 liefert, was reines
Tracking-Rauschen ist; F1/F2 minus F0 ist der Handanteil.

### Kennzahlen

- **R-HF roh / R-HF stab — Rauschen ohne Handbewegung:** RMS der zweiten
  Differenz (p[k] − 2·p[k−1] + p[k−2]) / √6. Glatte Handbewegung fällt dabei
  fast heraus, weißes Rauschen bleibt. Roh **nur auf neuen Messungen**, stab
  auf denselben Zeitpunkten abgetastet — damit sind beide vergleichbar.
- **Rotation:** dieselbe Kennzahl in Grad und umgerechnet in mm auf Kopfhöhe
  der Figur.
- **Figur-auf-Karte (px):** Projektion eines Punkts auf Kopfhöhe mit Stab- und
  mit Rohpose auf den Bildschirm, Abstand in Pixeln. Aufgeteilt in
  **HF-Anteil** (Zittern) und **Mittelwert** (Nachlauf/Vorlauf, „Schwimmen").
  Das ist, was man sieht: Das Bild ist synchron zur Rohpose (B1).
- **Modus:** Anteil BEWEGT in %, Umschaltungen pro 10 s, Auslöser
  (Position oder Winkel), aktuelle `driftSpeed`/`driftAngSpeed` als Vielfaches
  der Schwelle.
- **Gyro:** Drehrate |ω| in °/s (aus `qCur`), angewendete Deltas pro s.
- **Takt:** Vision-Hz, Kamera-fps, Messabstand p50/p95. Nebenbei prüfen: Ist
  Vision-Hz ≈ Kamera-fps? Wenn Vision-Hz ≈ Render-fps, ist die Stale-Erkennung
  kaputt (Kamera-Matrix ändert sich pro Frame).
- **Zähler:** Snaps, Re-Locks, verworfene NaN-Frames, Flips.

### Nötige Anzeigen in `?stats`

- Zeile **R-HF** roh | stab in mm (Position) und ° (Rotation), nur neue Messungen.
- Zeile **Figur/Karte** HF in px | Mittel in px.
- Zeile **Modus** `BEWEGT 63 % · 14 Wechsel/10 s · Auslöser Pos · Drift 1,8× / 0,4×`.
- Zeile **Gyro** `|ω| 3,2 °/s · Deltas 41/s` neben dem bestehenden Status.
- Zeile **Takt** `Vision 30 Hz · Kamera 30 fps · Δt p95 45 ms`.
- Zeile **Zähler** um `NaN verworfen` ergänzen.
- Fenster auf 5 s (in Sekunden statt Frames).
- Bestehende Zeilen „Jitter roh/stab" beheben: roh nur neue Messungen.
- Knopf **„Messung 10 s"**: friert die Kennzahlen des Fensters ein, kopiert eine
  Tabellenzeile (Fall, Build, Toggles, alle Werte) in die Zwischenablage.
  Optional: Rohdaten-Log (t, Rohpose, Stabpose, Gyro, Modus) als JSON — Basis
  für Replay (Option E-light unten).

Aufwand: ≈ 1 Tag (Anzeigen + Knopf), + ½–1 Tag (JSON-Log).

## c) A/B-Plan für die Stabilizer-Bausteine

### Regeln

- Pro Test **eine** Änderung, alles andere auf dem jeweils gültigen Stand.
- Fälle F1 und F2 (F4 nur bei Snap/Lost-Hold), je 3 × 10 s.
- Reihenfolge **A-B-B-A**, damit Wärme, Ermüdung, Licht sich ausmitteln.
- Vorher **A/A-Test** (zweimal dieselbe Einstellung): ergibt die Streuung. Ein
  Unterschied kleiner als diese Streuung zählt nicht.
- Nach jeder Entscheidung wird der Gewinner die neue Basis.
- Toggle live umschalten, dann 2 s warten (Filterzustand) oder neu aufsetzen
  (Tap auf die Karte).

### „Bringt etwas" heißt

- Hauptwert **Figur/Karte HF (px)** in F2 sinkt um mehr als die A/A-Streuung
  (Richtwert ≥ 20 %).
- **Und** Figur/Karte Mittel (Schwimmen) in F3 steigt nicht über die Streuung.
- **Und** keine neuen Snaps/Pops in F4.
- Subjektive Note (0–10) wird mitgeschrieben, entscheidet aber nicht allein.
- Ein Baustein, der nichts bringt und nichts schadet, ist Kandidat zum Ausbau.

### Reihenfolge

1. **Referenz:** alles an vs. `enabled` aus (Toggle 1, roh 1:1). Klärt, ob der
   Stabilizer in F2 überhaupt hilft.
2. **extrapolate** (Toggle 8) aus — Hypothese B1.
3. **GYRO** (Toggle 7) aus — Hypothese B2. Achtung: Toggle 7 schaltet auch die
   Verlust-Brücke ab (`js/poseStabilizer.js:164`), den Schiedsrichter nicht
   (`:210` prüft nur Toggle 10). F4 getrennt bewerten.
4. **deadZones** (Toggle 3) aus.
5. **Bewegt-Schwellen:** `minSpeed`, `minAngSpeed` × 2 und × 4 (je einzeln).
   Parameter, kein Toggle — über den Regler im Dev-Panel.
6. **minCutoff / rotMinCutoff / beta:** je einzeln, nach Faustregel config.js.
7. **snap** (Toggle 6): nur F4, Zähler Snaps + sichtbare Pops.
8. **lostHold** (Toggle 4): nur F4.

Nicht per A/B auf Jitter testen, sondern über Zähler prüfen:

- **normalize** (2): Einheiten-Konvention. Aus = alle Schwellen bedeuten Meter
  statt Kartenbreiten, der Test misst dann falsch eingestellte Schwellen.
- **nanGuard** (5): Schutz. Zähler „NaN verworfen" über alle Sitzungen; 0 heißt
  nicht „unnötig", nur „nicht aufgetreten".
- **scaleLock** (9): Zähler Re-Lock über alle Sitzungen. Bleibt er 0, ist die
  Stufe laut Code strukturell tot (`js/config.js:152-154`).
- **gravityArbiter** (10): nicht zur Disposition; in F2 nur prüfen, dass
  `Flips` nicht hochzählt.

## d) Optionen gegen Punkt 2 und Strategien A–E unter 8th Wall

Aufwände als Arbeitszeit inklusive Gerätetest, ohne Wertung, ohne Rangfolge.

### Welt-/Kamerabewegung

- **W1 — `disableWorldTracking: false` mit der Open-Source-Engine**
  - Handheld-Jitter: unklar; SLAM ist nicht enthalten (Punkt 2). Vermutlich nur
    Geräte-Drehung, also nichts über den Gyro hinaus.
  - Aufwand: 2–4 h Spike (was liefert `reality` dann?).
  - iOS/Android: Engine verlangt Mobilgerät; Desktop-Schnelltest fällt weg.
  - Voraussetzung: Bewegungssensor-Rechte durch die Engine; Kamera-Matrix
    ändert sich pro Frame → Stale-Erkennung und Stabilizer-Eingang anpassen.
- **W2 — Geschlossenes `@8thwall/engine-binary` (SLAM, `xr-slam.js`)**
  - Handheld-Jitter: trennt Hand- und Kartenbewegung (Rotation **und**
    Translation). Karte liegt → im Weltframe ruhig, stark filterbar.
  - Aufwand: Lizenz/Bedingungen klären 1–2 h; Spike 1–2 Tage; Umbau Stabilizer
    auf Welt-Frame 3–5 Tage.
  - iOS/Android: beide (historisch 8th-Wall-SLAM im Browser auf beiden).
  - Voraussetzung: bricht die Regel „kein Binary"; höhere CPU-Last, Wärme,
    Akku; Motion-Permission (iOS separat); größerer Download; Datenschutz-
    Prüfung der Binary (Netzaufrufe).
- **W3 — Erdfest filtern mit vorhandenem Gyro (nur Rotation)**
  - Handheld-Jitter: Kartenrotation im Erdframe ist bei liegender Karte
    konstant → dort hart glätten; Bewegt-Erkennung im Erdframe ignoriert
    Handydrehung. Verschiebung bleibt ungelöst.
  - Aufwand: 1–2 Tage.
  - iOS/Android: beide (Gyro-Permission wie heute).
  - Voraussetzung: keine; ohne Gyro-Freigabe fällt es auf heute zurück.
- **W4 — Translation aus `devicemotion` (Beschleunigung, doppelt integriert)**
  - Handheld-Jitter: nur kurzfristig (≈ 100 ms) brauchbar, Drift sonst.
  - Aufwand: 2–3 Tage.
  - iOS/Android: beide; iOS braucht `DeviceMotionEvent.requestPermission`.
  - Voraussetzung: zusätzliche Permission in der Start-Geste.
- **W5 — Gyro zeitlich an den Kameraframe koppeln** (behebt B2)
  - Handheld-Jitter: Gyro-Delta nur ab dem Zeitpunkt des angezeigten Frames
    anwenden → kein Vorlauf, kein Zurückziehen.
  - Aufwand: 1–2 Tage (Ring-Puffer Orientierung × Zeitstempel,
    `frameStartResult.videoTime/frameTime` im eigenen Pipeline-Modul).
  - iOS/Android: beide.
  - Voraussetzung: Zeitbasis von `deviceorientation.timeStamp` und Kameraframe
    passt zusammen (prüfen).

### Strategien aus `docs/tracking-strategien.md`

- **A1 Fokus/Belichtung sperren**
  - Handheld-Jitter: indirekt; weniger Unschärfe durch Autofokus-Pumpen bei
    Abstandsänderung → weniger Roh-Rauschen.
  - Aufwand: 3–5 h (Track über `onCameraStatusChange` Status `hasStream`,
    `applyConstraints`).
  - iOS/Android: Android (Chrome, Feature-Detect); iOS Safari bietet
    `focusMode` nach aktuellem Kenntnisstand nicht → No-op.
  - Voraussetzung: Zugriff auf den MediaStream der Engine (8th Wall öffnet die
    Kamera selbst).
- **A2 Echte Frame-Zeitstempel**
  - Handheld-Jitter: saubere Geschwindigkeit, messbare Latenz; Basis für W5.
  - Aufwand: ½–1 Tag. Unter 8th Wall einfacher als unter MindAR: Zeitstempel
    kommen im Pipeline-Modul mit (`frameStartResult`).
  - iOS/Android: beide.
  - Voraussetzung: keine.
- **A3 Brennweite/Intrinsics**
  - Handheld-Jitter: Bias beim Kippen („Atmen"), kein Rauschen.
  - Aufwand: 1–2 h Prüfen (Intrinsics loggen, gegen Gerät vergleichen);
    Korrektur ohne Engine-API: Engine-Eingriff, mehrere Tage.
  - iOS/Android: beide.
  - Voraussetzung: Unklar, ob die Open-Source-Engine eine Geräte-Datenbank für
    Intrinsics enthält.
- **B1–B4 MindAR-Fork** — hinfällig (kein MindAR). Unter 8th Wall entspricht
  dem ein **Engine-Eingriff (B′)** in die offene Engine: Tracker-Parameter
  (`PosePnP.*ConfidenceThreshold`, eigene Translation-Stabilisierung),
  Zeitstempel pro Pose, Sub-Pixel prüfen.
  - Handheld-Jitter: senkt Roh-Rauschen; trennt keine Handbewegung.
  - Aufwand: Quelltext lesen 1–2 Tage; je Änderung Bazel-Build ≈ 23 min + ≈ 5 min
    zweite Variante; insgesamt Tage bis Wochen.
  - iOS/Android: beide.
  - Voraussetzung: Monorepo-Build-Umgebung (`vendor/8thwall/README.md`), beide
    Varianten SIMD/nicht-SIMD bauen.
- **C1 WebXR-Kamerapose (Android)**
  - Handheld-Jitter: wie W2, aber nur Android.
  - Aufwand: 1–2 Wochen (8th-Wall-Bildtracking mit WebXR-Kamerabild füttern).
  - iOS/Android: nur Android (Chrome, ARCore).
  - Voraussetzung: WebXR `camera-access`, zweiter Laufzeitpfad.
- **C2 WASM-SLAM (AlvaAR)**
  - Handheld-Jitter: Kamera-Odometrie inkl. Translation, driftend.
  - Aufwand: Spike 1–2 Wochen.
  - iOS/Android: beide.
  - Voraussetzung: Kamerapixel aus der Pipeline — genau diese Module
    (`CameraPixelArray`) sind im Zuschnitt entfernt (`vendor/8thwall/README.md`);
    hohe CPU-Last, zweite CV-Pipeline.
- **D Karte als Tracking-Instrument**
  - Handheld-Jitter: senkt Roh-Rauschen; trennt keine Handbewegung.
  - Aufwand: Design-Variante für 8th Wall (Muster wie „tarn", Build 58) 1–2 Tage
    inkl. Druck; eigener Eck-Anker-Tracker 1–2 Wochen.
  - iOS/Android: beide.
  - Voraussetzung: Eck-Anker brauchen einen eigenen Detektor mit Pixelzugriff
    (wie C2).
- **E Replay-Prüfstand**
  - Handheld-Jitter: keine direkte Wirkung; macht A/B reproduzierbar.
  - **E-light (Pose-Replay):** Rohposen + Gyro + Zeitstempel am Gerät loggen,
    Stabilizer offline in Node mit denselben Daten laufen lassen. Aufwand 1–2
    Tage. Gilt für Filter-A/B — anders als TrackingScore/Tracking-Prüfstand,
    die den Rohwert des Designs messen.
  - **E-voll (Video-Replay):** Video in die Engine speisen (`getUserMedia`
    ersetzen). Aufwand 3–5 Tage.
  - iOS/Android: Aufnahme auf beiden; `?record` braucht HTTPS.
  - Voraussetzung: Branch `pruefstand` ist MindAR-basiert und ungemergt.

## e) Phase 2, Schritt 1: Messwerkzeug (Build 62, 2026-09-25)

Umgesetzt ist das Werkzeug aus Abschnitt b. Das Filterverhalten ist
**unverändert**: Der Stabilizer bekommt nur Diagnose-Zähler (seit Build 88 über `stab.snapshot()` gelesen).

### Was neu ist

- `js/jitterMetrics.js` — Kennzahlen, reine Rechnung (auch in Node prüfbar).
- `js/statsOverlay.js` — neue Zeilen, 5-s-Fenster, Mess-Knöpfe oben im Panel.
- `js/poseStabilizer.js` — `diag`: neue Messung ja/nein + Rohmessung,
  Modus-Wechsel, Auslöser, NaN-Verwürfe, angewendete Gyro-Deltas.
- `js/arSession.js` — reicht die Kamera an `?stats` durch (Projektion in px).

### Anzeige lesen

- **Takt:** Vision-Hz ≈ Kamera-fps (meist 30) ist gesund. Vision-Hz ≈
  Render-fps (60) → Stale-Erkennung defekt, bitte melden.
- **Rauschen roh|stab (mm · °):** 2. Differenz, 3D, nur neue Messungen.
  Handbewegung fällt weitgehend heraus (Prüfung: 12 mm Handbewegung bei 0,7 Hz
  hebt F2F um den Faktor 9, diese Zahl nur um ≈ 25 %).
- **Kopf px roh|stab:** dasselbe für einen festen Punkt 1,5 Kartenbreiten über
  der Kartenmitte (≈ Kopfhöhe), in Bildschirm-px. **Hauptwert für das
  Sichtbare** (stab).
- **Versatz:** mittlerer Abstand Figur-Kopf ↔ Rohpose-Kopf in px. Hoch bei
  Bewegung = Nachlauf/Schwimmen.
- **Lauf o. Bild:** Figurbewegung in px/s in Ticks ohne neue Messung. Das
  Kamerabild steht dann (B1); alles hier ist Extrapolation oder
  Gyro-Prediction.
- **F2F:** alte Zahl, enthält Handbewegung.
- **Modus:** Anteil BEWEGT, Wechsel pro 10 s, Auslöser (Pos/Winkel/beide),
  Drift ÷ Schwelle (Position/Winkel; > 1× = BEWEGT).
- **Gyro-Rate:** Drehrate des Handys (misst auch bei Toggle 7 aus), angewendete
  Deltas pro s.

### Messung durchführen

1. Handy mit `?k=000&stats&dev` öffnen (Testlink), Karte suchen, Figur antippen.
2. Fall-Knopf auf F0 … F4 stellen (siehe Abschnitt b).
3. „Messung 10 s" tippen, Haltung 10 s halten. Der Knopf zählt herunter.
4. Gelbe Zeile = Kurzfazit. „Kopieren" legt Kopf- + Wertezeile
   (Tab-getrennt, Dezimalkomma) in die Zwischenablage → in eine Tabelle
   einfügen. „Log ↓" speichert alle Tick-Proben als JSON (für ein späteres
   Offline-Replay, Option E-light).
5. Pro Einstellung 3 Messungen, Reihenfolge A-B-B-A (Abschnitt c).

Spalte `toggles` = Toggles 1–10 als Ziffern (1 = an), so bleibt jede Zeile
eindeutig einer Einstellung zugeordnet. `verlorenMs` > 0 = Karte war während
der Messung verloren → Messung wiederholen.

### Nächster Schritt

Messreihe nach Abschnitt c, zuerst A/A (zweimal alles an, F1 und F2), dann
Referenz Toggle 1. Die A/B-Tests der Schritte 1–8 brauchen keine neuen
Schalter; alle Stellschrauben stehen schon im Dev-Panel. Neue Filter-
Änderungen (z. B. W3, W5) kommen erst nach den Zahlen, jede mit eigenem
Dev-Panel-Schalter.

## Offene Punkte vor Phase 2

- Konvention `version.js`: geklärt (Michael 2026-09-25) — freilaufender
  Zähler, +1 pro Push.
- Dieses Dokument wurde ohne Build-Erhöhung gepusht (kein Code geändert).
- B1/B2 sind aus dem Engine-Code gelesen, nicht am Gerät gemessen.
