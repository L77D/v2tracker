/* =============================================================================
   DETAR — zentrale Konfiguration (alle Dashboards). EINE Quelle: die Werte
   hier sind die Live-Werte. Ein aus dem Dev-Panel exportiertes Preset kann
   als tuning.json ins Repo-Root gelegt werden und überschreibt sie beim Laden
   (loadTuning, nur mit ?dev/?tuning) — für Tuning-Sessions, NIE einchecken
   (.gitignore): sonst wirken Änderungen hier nicht mehr, solange der Block
   in tuning.json steht („Masking-Falle", s. CLAUDE.md).

   Fix-Log-Konvention: Tracking-Werte tragen Datum + Begründung im Kommentar
   (CLAUDE.md „Konventionen"); Einträge „(MindAR-Stand …)" beschreiben den
   Tracker von Branch main und gelten unter 8th Wall nur noch als Historie.
   ============================================================================= */

// SpeechBubble → TYPO
export const TYPO = {
  fontFamily: '"Jersey 10", monospace',
  fontWeight: "normal",
  fontSize: 52,
  lineSpacing: 0.8,
  textColor: "#f6f6f6", // UI-Update 2026-09-03 (Figma)
  strokeColor: "#000000",
  strokeWidth: 8,
  paddingPx: 28,
  maxLines: 5,
  maxWidth: 1.2,
  unitsPerPx: 0.002,
  offsetX: 0,
  offsetY: -0.17,
  msPerChar: 28,
  // Dialogsystem (2026-09-03): Baseline-Lage im Zeilenraster (Anteil fontSize,
  // alphabetic) + Highlight-Effekte im Sprechtext (Auszeichnung in der Karte:
  // <marker> <gross> <leise> <knall>; welle/zittern werden nicht bewegt).
  baselineRatio: 0.8,
  fxMarkerColor: "#fced62", // <marker>: gelbe Schrift + Unterstrich; auch Seitenzähler (Figma-Gelb)
  fxGrossScale: 1.16,       // <gross>: Schriftgröße × Faktor
  fxLeiseAlpha: 0.62,       // <leise>: Deckkraft der Füllung
  fxKnallMs: 260,           // <knall>: Dauer des Aufploppens je Zeichen
  fxKnallScale: 1.7,        // <knall>: Start-Vergrößerung
  pageLabel: false,         // Seitenzähler „1/3" in der Blase (Michael 2026-09-07: aus; Seiten + Weiter bleiben)
};

// Emotion-Tags der Kartendatei → heute vorhandene Körper (idle/affirm/think).
// Zwischenlösung (03.09.2026), bis der Rig die elf Posen liefert — dann
// entfällt die Tabelle, der Tag wird direkt zum Posennamen.
export const POSES = {
  neutral: "idle", erklaeren: "idle", halten: "idle", zweihaendig: "idle",
  winken: "affirm", bestaetigen: "affirm", stolz: "affirm", zeigen: "affirm",
  denken: "think", schulterzucken: "think", erschoepft: "think",
};
// Seit Build 63: `posen` = Posenliste der Karte (daten.json → figur.posen).
// Hat die Karte eine Pose mit genau diesem Namen (auch eine Sonderpose), gilt
// sie; sonst die Zuordnung oben, falls die Karte diesen Körper hat; sonst idle.
export const poseFor = (tag, posen = {}) =>
  (tag in posen ? tag : (POSES[tag] in posen ? POSES[tag] : "idle"));

// FaceAnimator → FACE
export const FACE = {
  blinkIntervalMin: 2.0,
  blinkIntervalMax: 5.0,
  blinkDuration: 0.12,
  talkFrameMs: 150,
};

// IdleWander → IDLE
export const IDLE = {
  // Lauffeld (Füße der Figur, Karten-Frame, Einheit SCENE.cardWidth = 0.059):
  // markerWidth/-Height = Kartenformat 63 × 88 mm. 2026-10-14 (Michael, Build
  // 108): die GANZE Figur bleibt auf der Karte — der Fuß-Mittelpunkt hält
  // eine Fußhalbbreite Abstand zum Rand, in beiden Achsen, weil die Figur
  // sich dreht (IdleWander.roamHalf). footFraction = Fußbreite als Anteil der
  // Figuren-Leinwand, gemessen an karten/000/figur/body_idle.webp (Füße 145–622
  // von 768 px = 0,62; gleiche Leinwand für alle Figuren). Bei figureScale 0.5
  // ≈ 55 % × 68 % der Karte. Vorher roamFraction 1.1 = Fuß-Mittelpunkt bis
  // 110 % der Karte (Build 97; davor 122 % × 121 %).
  markerWidth: 0.059, markerHeight: 0.0824, footFraction: 0.62,
  bopAmplitude: 0.015, bopFrequency: 0.5,
  walkSpeed: 0.04, walkFrequency: 2.2, walkRollMax: 0.18, stepSquash: 0.05,
  headLookMax: 0.5, headPitchMax: 0.35,
  bopHoldMin: 1.5, bopHoldMax: 3.5, actionMin: 1.2, actionMax: 2.4,
  cameraFacingThreshold: 45, faceCamLerp: 0.12,
  lookChance: 0.6, walkChance: 0.4,
};

// ActivationAnim → ACT
export const ACT = {
  durationSec: 1.55,
  spins: 2,
  overshoot: 1.75,
};

// CardController / CSS
export const CHOREO = {
  requireTap: true,      // true = Aktivier-Phase (Karte leuchtet, Tap startet
                         // die Figur) · false = Figur kommt direkt beim Scan
  uiRevealMs: 1000,      // reine CSS-Einfahr-DAUER (--q-reveal-time), keine Wartezeit
  revealOffset: 60,      // CSS --q-reveal-offset (px)
  idleReturnMs: 11000,   // Haltezeit NACH dem Typewriter — Fallback; eine Karte mit
                         // eigenem idleReturnMs (daten.json) hat Vorrang (seit Build 61,
                         // vorher stand config in der ??-Kette zuerst und gewann immer).
                         // 2026-10-14 (Michael, Build 108): verdoppelt (vorher 5500),
                         // Karte 000 16000 statt 8000 — Antworten stehen länger.
  livelyAfterMs: 2000,   // so lange nach dem Tippen bleibt die Figur ruhig, dann
                         // Lebendig-Phase (Pose idle, Umschauen nach IDLE.lookChance,
                         // noch ohne Gehen) bis zur Haltezeit (2026-10-14, Michael;
                         // Gewichtsverlagerung 2026-10-15 wieder raus, Build 109)
  greetingPose: "idle",
  billboardLerp: 0.2,
  bubblePitchMax: 70,    // Sprechblase neigt sich zur Kamera, höchstens so viele Grad
                         // (2026-10-13, Build 104, Michael: Blase soll billboarden;
                         // Grenze, weil direkt von oben „oben" entartet). 0 = nur Yaw
                         // wie bis Build 103.
  jumpDurationSec: 0.45, // Figur-Tap: Parabel-Hüpfer zur Kartenmitte
  jumpHeight: 0.04,
  // Tap-Erkennung (js/tapInput.js, bis Build 86 main.js; bis Build 60 Literale): Entprellung pointerup +
  // click-Fallback (Doppel-Auslösung wäre seit dem Dialogsystem nicht mehr
  // harmlos), Tap ≠ Drag über Weg und Dauer.
  tapDebounceMs: 120,
  tapMaxPx: 6,
  tapMaxMs: 400,
  replayRescanMs: 600,   // Dev-Replay: Suchrahmen so lange an, dann „Scan"
  // Dialogsystem (2026-09-03)
  continueDelayMs: 350,   // automatisches Weiter nach einer Antwort (kein Knopf)
  collapseDelayMs: 900,   // Abschiedszeile steht so lange, bevor die Figur einklappt
  collapseSec: 0.5,       // Dauer des Einklappens (Figur → Karte)
  trackingLostMs: 1500,   // ab dieser Verlustdauer friert das Menü ein; seit Build 99 kommen dann
                          // auch Suchrahmen + „Halte auf die Karte" zurück (Michael 2026-10-12)
  // Szene ein-/ausblenden (Build 99, Michael 2026-10-12): bei Verlust kein harter
  // Schnitt mehr — nach der Haltezeit des Trackers (lostHoldMs / Gyro-Brücke)
  // faded die ganze Szene (Figur, Blase, Eck-Marker) aus; beim Wiederfinden ein.
  lostFadeMs: 300,
  foundFadeMs: 300,
};

// Szene (Skalierung + Nick-Achse). cardWidth koppelt die Prototyp-Einheiten an
// die Anchor-Einheit: eine Anchor-Einheit = eine Kartenbreite (arSession.js setzt die
// Anchor-Scale auf die Kartenbreite; MindAR normierte genauso), im Prototyp war
// die Karte cardWidth Einheiten breit. worldRoot wird um 1/cardWidth skaliert —
// damit gelten ALLE getunten Werte (Lauffeld, Bubble, Sprünge …) unverändert.
export const SCENE = {
  cardWidth: 0.059,  // SZENEN-Einheit der Kartenbreite (Karte 59 × 91 mm hochkant, Michael
                     // 2026-09-07; vorher 0.17 → 0.095). Die PHYSISCHE Breite fürs Tracking
                     // kommt seit Build 57 aus daten.json der Karte (designs[].breiteMm).
  cardAspect: 88 / 63,     // Höhe/Breite der Karte in Anchor-Einheiten → Eck-Marker, Tap-Fläche,
                           // Desktop-Plane. 2026-10-12 (Michael, Build 98): 1,40 = gedruckte
                           // Karte 63×88 mm (Druckspezifikation, P04). Bis Build 97 stand hier
                           // 2156/1346 = 1,60 aus der beschnittenen Demo-Karte 070926 (MindAR-
                           // Target, 2026-09-07), die seit Build 95 aussortiert ist — die Marker
                           // saßen damit ~7 % der Kartenbreite zu weit oben und unten.
  figureScale: 0.5,  // 2026-10-09 (Michael): gesamte AR-Szene auf 0.5 (Build 84; vorher
                     // Build 82: 0.4, Build 81: 0.68 = 80 % von 0.85; 2026-09-07: ~85 %) — Figur samt
                     // Sprechblase (rig.js) und Hüpf-Icon (activationFX.js); die
                     // Eck-Marker bleiben auf den Kartenecken, die sind Kartengeometrie.
  headNodAxis: 0.25, // Höhe der Kopf-Nick-Achse ÜBER dem HeadPivot (≈ Kopfmitte)
  bgColor: "#9a9a9a", // nur Desktop-Testmodus (Debug-Overlays: NUR per ?debug, kein Key hier)
};

// Tracking-Glättung (Build 111, 2026-10-15): nur noch der Tracker 8lerp
// (js/tracker8lerp.js) — bis Build 110 lagen hier ~30 weitere Werte des
// PoseStabilizers (One-Euro, Dead-Zones, Median-Aufsetzen, Snap, Scale-Lock,
// Extrapolation …); die Varianten alt/neu/8roh liegen samt ihren Werten in
// archiv/tracker-varianten/ (Stand Build 110: `git show 9f771c6:js/config.js`).
// Alte tuning.json/Presets mit diesen Schlüsseln laden weiter (applyTuning
// hängt unbekannte Schlüssel an, sie wirken nur nirgends).
// Toggle-Nummern = Reihenfolge im Dev-Panel (js/devPanel.js, Block
// „Tracking-Features"), seit Build 111 nur noch 1 · 5 · 7 (GYRO.enabled) · 10;
// ?stats nennt sie in der Flip-Zeile. (Die 8th-Wall-Engine hat keinen
// konfigurierbaren Vorfilter.)
export const STAB = {
  // Tracker-Variante (js/trackerWahl.js): seit Build 111 nur "8lerp"; ?tracker=
  // in der URL hat Vorrang, ein unbekannter Name (auch alt/neu/8roh) fällt mit
  // Warnung auf "8lerp" zurück. 2026-10-15 (Michael, nach dem Handytest):
  // Standard "alt" → "8lerp" (Build 110), Archivierung der anderen (Build 111).
  tracker: "8lerp",
  // --- Feature-Schalter (Dev-Panel „Tracking-Features an/aus") ---------------
  enabled: true,     // 1 Glättung (false = Messung 1:1, τ ohne Wirkung)
  nanGuard: true,    // 5 kaputte Kamera-Transformationen im Frame überspringen
                     //   (experience.js getCamLocal; false = alter Verschwinde-Bug möglich!)
  gravityArbiter: true, // 10 Schwerkraft-Schiedsrichter gegen den „Pose-Flip" (2026-09-15):
                        //   die ebene Pose-Schätzung hat zwei Lösungen; 8th Wall liefert
                        //   manchmal stabil die gespiegelte (Karte um 2θ gekippt, Figur liegt
                        //   flach zum Betrachter, Kopf unten). Aus der Rohpose wird die
                        //   Spiegel-Kandidatin berechnet und die Lage gewählt, deren Normale
                        //   im Erdframe nach oben zeigt (js/poseArbiter.js). Ohne Gyro passiv.
  // 7 = GYRO.enabled (unten)
  // SCHWERKRAFT-SCHIEDSRICHTER (2026-09-15): Hysterese — die Spiegel-Kandidatin
  // gewinnt erst, wenn ihr z-Anteil (Normale im Erdframe, 1 = senkrecht nach
  // oben) um mehr als arbiterMargin über dem der Rohpose liegt. Nahe der
  // Frontalsicht sind beide Kandidaten gleich → kein Umschalten, kein Flattern.
  arbiterMargin: 0.15,
  // TRACKER „8lerp" (Build 105, 2026-10-13, js/tracker8lerp.js): Zeitkonstante
  // des Lerp/Slerp auf die letzte Messung, in ms. Die Engine misst alle 33–50 ms
  // (20–30 Hz) — τ in derselben Größe glättet die Treppe, Nachlauf bei
  // gleichmäßiger Bewegung ≈ τ. 0 = Messung 1:1.
  lerpPosMs: 50,
  lerpRotMs: 50,
};

// Aktivier-Phase (ActivationFX, UI-Update 2026-09-03): vier gelbe Eck-Marker
// auf den Kartenecken, wabern leicht auf und ab; beim Tap ploppen sie auf und
// faden (dann kommt die Figur). Glow + Partikel der Vorversion sind entfernt.
export const ACTFX = {
  markerSize: 0.14,    // Kantenlänge der Marker (Anteil Kartenbreite; Figma: 32 px bei ~230 px Karte)
  bobHeight: 0.05,     // Hub des Waberns (Anteil Kartenbreite)
  bobSec: 1.6,         // Periode des Waberns (s)
  burstSec: 0.35,      // Dauer des Aufploppens beim Tap bis zur Figur
  color: "#fced62",    // Marker-Füllung (Figma-Gelb)
  outline: "#000000",  // Marker-Kontur
  outlineWidth: 4.44,  // Konturstärke in viewBox-Einheiten (32,59 = Marker-Kante)
  // Handy-Icon springt beim Erkennen aus dem Panel und hüpft auf der Karten-
  // mitte (2026-09-04, seit Build 22 auch live — vorher nur Lokal-Prototyp).
  hopper: true,
  iconHeight: 0.68,    // Icon-Höhe (Anteil Kartenbreite, × SCENE.figureScale); 2026-10-09 (Michael,
                       // Build 85): doppelt so groß, vorher 0.34
  hopHeight: 0.12,     // Sprunghöhe (Anteil Kartenbreite)
  hopSec: 0.32,        // Dauer eines Sprungs
  squashSec: 0.14,     // Stauchen beim Aufkommen (bis Build 60 Literal)
  hopPauseSec: 0.9,    // Pause zwischen den Sprüngen
  dropHeight: 0.6,     // Landeanflug: Starthöhe (Anteil Kartenbreite)
  dropSec: 0.4,        // Dauer des Landeanflugs
  shadowW: 1.0,        // Schatten-Rechteck: Breite (Anteil Icon-Breite), 50 % Deckkraft, direkt unter dem Icon
  shadowD: 0.35,       // Schatten-Rechteck: Tiefe (Anteil Icon-Breite)
};

// Sound-Design (js/sound.js → tiks, js/vendor/tiks.js): prozedurale UI-Sounds,
// reine Web-Audio-Synthese — keine Audio-Dateien, kein Netzwerk. Das Theme
// färbt ALLE Sounds gemeinsam ("arcade" = 8-bit/Chiptune, passt zum Pixel-Look).
export const SOUND = {
  enabled: true,
  theme: "arcade",   // "soft" | "crisp" | "arcade" | "glass"
  volume: 0.3,       // 0–1 (tiks-Default 0.3 — dezent), Master für UI + Blasen-Ton
  // Anfangston einer Antwort (sound.bubbleOpen, 2026-10-14, Michael): zwei
  // steigende Töne (Quinte) wie das Textbox-„Blip" alter RPGs, nur auf Seite 1.
  // Ersetzt die Animalese-Stimme (speech/speech*) und die Tipp-Ticks.
  bubblePitch: 660,    // erster Ton (Hz), der zweite liegt eine Quinte höher
  bubbleToneMs: 45,    // Länge je Ton (ms)
  bubbleGapMs: 40,     // Abstand der Toneinsätze (ms) — zusammen ~85 ms
  bubbleVolume: 0.4,   // Pegel relativ zum Master (volume × bubbleVolume)
};

// Gyro-Fusion: Handy-Gyroskop stützt die visuelle Pose (Prediction) und
// überbrückt kurze Tracking-Aussetzer. Kill-Switch zusätzlich per ?nogyro.
export const GYRO = {
  enabled: true,
  bridgeMs: 1200,        // wie lange ein Aussetzer gyro-geführt überbrückt wird
  deltaDeadZone: 0.0012, // rad; AKKUMULATIONS-Schwelle (2026-07-14, Finding 4):
                         // qPrev rückt in GyroFusion nur vor, wenn das Delta auch
                         // ANGEWENDET wird — langsame Drehungen summieren sich auf
                         // und feuern in ~0.07°-Quanten, statt Frame für Frame
                         // verworfen zu werden (vorher trug die Prediction bei
                         // Schwenks < ~4°/s NICHTS bei). Rauschen bleibt draußen.
  deltaMax: 0.2,         // rad; größere Deltas = Sensor-Glitch → verwerfen (resync)
};

// Kamera: Die 8th-Wall-Engine wählt die Auflösung selbst (geräteabhängige
// Constraint-Leiter mit Retry); gelieferte Auflösung in ?stats ablesen.
export const CAM = {
  maxPixelRatio: 2,      // Canvas-Cap (Finding 2, 2026-07-14): arSession.js setzt die
                         // Canvas-Pixelgröße = CSS-Größe × min(devicePixelRatio, Cap)
                         // — Cap 2 statt 3 auf iPhones gibt der Vision-Schleife GPU-Luft.
};

export const ALL = { TYPO, FACE, IDLE, ACT, CHOREO, SCENE, STAB, GYRO, ACTFX, CAM, SOUND };

/* Schalter sind seit Build 89 (Refactoring Stufe 3d) Booleans — bis Build 88
   waren es die Strings "ja"/"nein" (Vergleiche `!== "nein"` in sieben
   Modulen). Alte Presets tragen die Strings noch: tuning.json, Dev-Panel-
   Presets und der Regler-Stand in localStorage, der eingebettete Block des
   Lokal-Prototyps (window.__TUNING). Deshalb läuft JEDES Einspielen eines
   Presets über applyTuning(), das "ja"/"nein" in true/false übersetzt; andere
   Strings (SOUND.theme "arcade", Farben, Posen) bleiben unberührt. */
export function uebersetzeSchalter(block) {
  const out = {};
  for (const [k, v] of Object.entries(block)) out[k] = v === "ja" ? true : v === "nein" ? false : v;
  return out;
}
export function applyTuning(s) {
  if (!s || typeof s !== "object") return false;
  for (const [name, obj] of Object.entries(ALL)) {
    if (s[name] && typeof s[name] === "object") Object.assign(obj, uebersetzeSchalter(s[name]));
  }
  return true;
}

/* Optional: tuning.json (Preset-Export aus dem Dev-Panel) im Repo-Root
   überschreibt die Defaults. Seit 2026-09-09 liegt KEINE tuning.json mehr im
   Repo — alle getunten Werte sind Defaults hier; die Datei bleibt ein Werkzeug
   für Tuning-Sessions (Dev-Panel → Export, Datei daneben legen, testen). */
export async function loadTuning() {
  try {
    const res = await fetch("./tuning.json", { cache: "no-store" });
    if (!res.ok) return false;
    return applyTuning(await res.json());
  } catch (e) {
    return false; // Datei fehlt oder ungültig → Defaults
  }
}

/* Per-Frame-Lerps aus dem Mattercraft-Code (faceCamLerp, billboardLerp) sind
   fps-abhängig — auf 60-fps-Äquivalent normalisieren (identisch bei 60 fps). */
export function frameLerp60(lerpPerFrame, dt) {
  return 1 - Math.pow(1 - lerpPerFrame, dt * 60);
}
