/* =============================================================================
   DETAR — zentrale Konfiguration (alle Dashboards). EINE Quelle: die Werte
   hier sind die Live-Werte. Tracking-Werte tragen ihre Begründung im Kommentar.
   ============================================================================= */

// SpeechBubble → TYPO
export const TYPO = {
  fontFamily: '"Jersey 10", monospace',
  fontWeight: "normal",
  fontSize: 52,
  lineSpacing: 0.8,
  textColor: "#f6f6f6",
  strokeColor: "#000000",
  strokeWidth: 8,
  paddingPx: 28,
  maxLines: 5,
  maxWidth: 1.2,
  unitsPerPx: 0.002,
  offsetX: 0,
  offsetY: -0.17,
  msPerChar: 28,
  // Baseline-Lage im Zeilenraster (Anteil fontSize, alphabetic) + Highlight-
  // Effekte im Sprechtext (Auszeichnung in der Karte: <marker> <gross> <leise>
  // <knall>; welle/zittern werden nicht bewegt).
  baselineRatio: 0.8,
  fxMarkerColor: "#fced62", // <marker>: gelbe Schrift + Unterstrich; auch Seitenzähler
  fxGrossScale: 1.16,       // <gross>: Schriftgröße × Faktor
  fxLeiseAlpha: 0.62,       // <leise>: Deckkraft der Füllung
  fxKnallMs: 260,           // <knall>: Dauer des Aufploppens je Zeichen
  fxKnallScale: 1.7,        // <knall>: Start-Vergrößerung
  pageLabel: false,         // Seitenzähler „1/3" in der Blase (aus; Seiten + Weiter bleiben)
};

// Emotion-Tags der Kartendatei → die drei Standardkörper (idle/affirm/think).
// Bringt eine Karte für einen Tag eine eigene Pose mit, gilt die (poseFor).
export const POSES = {
  neutral: "idle", erklaeren: "idle", halten: "idle", zweihaendig: "idle",
  winken: "affirm", bestaetigen: "affirm", stolz: "affirm", zeigen: "affirm",
  denken: "think", schulterzucken: "think", erschoepft: "think",
};
// `posen` = Posenliste der Karte (daten.json → figur.posen).
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
  // markerWidth/-Height = Kartenformat 63 × 88 mm. Die GANZE Figur bleibt auf
  // der Karte — der Fuß-Mittelpunkt hält eine Fußhalbbreite Abstand zum Rand,
  // in beiden Achsen, weil die Figur sich dreht (IdleWander.roamHalf).
  // footFraction = Fußbreite als Anteil der Figuren-Leinwand, gemessen an
  // karten/00/figur/body_idle.webp (Füße 145–622 von 768 px = 0,62; gleiche
  // Leinwand für alle Figuren). Bei figureScale 0.5 ≈ 55 % × 68 % der Karte.
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
                         // eigenem idleReturnMs (daten.json) hat Vorrang.
  livelyAfterMs: 2000,   // so lange nach dem Tippen bleibt die Figur ruhig, dann
                         // Lebendig-Phase (Pose idle, Umschauen nach IDLE.lookChance,
                         // noch ohne Gehen) bis zur Haltezeit
  greetingPose: "idle",
  billboardLerp: 0.2,
  bubblePitchMax: 70,    // Sprechblase neigt sich zur Kamera, höchstens so viele Grad
                         // (Grenze, weil direkt von oben „oben" entartet). 0 = nur Yaw.
  jumpDurationSec: 0.45, // Figur-Tap: Parabel-Hüpfer zur Kartenmitte
  jumpHeight: 0.04,
  // Tap-Erkennung (js/tapInput.js): Entprellung pointerup + click-Fallback
  // (eine Doppel-Auslösung würde im Dialog doppelt antworten), Tap ≠ Drag
  // über Weg und Dauer.
  tapDebounceMs: 120,
  tapMaxPx: 6,
  tapMaxMs: 400,
  // Dialogablauf
  continueDelayMs: 350,   // automatisches Weiter nach einer Antwort (kein Knopf)
  collapseDelayMs: 900,   // Abschiedszeile steht so lange, bevor die Figur einklappt
  collapseSec: 0.5,       // Dauer des Einklappens (Figur → Karte)
  trackingLostMs: 1500,   // ab dieser Verlustdauer friert das Menü ein und Suchrahmen +
                          // „Halte auf die Karte" kommen zurück
  // Szene ein-/ausblenden: bei Verlust kein harter Schnitt — sobald der Tracker
  // die Karte verliert, faded die ganze Szene (Figur, Blase, Eck-Marker) aus;
  // beim Wiederfinden ein.
  lostFadeMs: 300,
  foundFadeMs: 300,
};

// Szene (Skalierung + Nick-Achse). cardWidth koppelt die Szenen-Einheiten an
// die Anchor-Einheit: eine Anchor-Einheit = eine Kartenbreite (arSession.js
// setzt die Anchor-Scale auf die Kartenbreite), in der Szene ist die Karte
// cardWidth Einheiten breit. worldRoot wird um 1/cardWidth skaliert — damit
// gelten ALLE getunten Werte (Lauffeld, Bubble, Sprünge …) in Szenen-Einheiten.
export const SCENE = {
  cardWidth: 0.059,  // SZENEN-Einheit der Kartenbreite. Die PHYSISCHE Breite fürs
                     // Tracking kommt aus daten.json der Karte (designs[].breiteMm).
  cardAspect: 88 / 63,     // Höhe/Breite der Karte in Anchor-Einheiten → Eck-Marker, Tap-Fläche.
                           // 1,40 = gedruckte Karte 63 × 88 mm (Druckspezifikation).
  figureScale: 0.5,  // Maßstab der AR-Szene: Figur samt Sprechblase (rig.js) und
                     // Hüpf-Icon (activationFX.js); die Eck-Marker bleiben auf den
                     // Kartenecken, die sind Kartengeometrie.
  headNodAxis: 0.25, // Höhe der Kopf-Nick-Achse ÜBER dem HeadPivot (≈ Kopfmitte)
};

// Tracking-Glättung: Tracker 8lerp (js/tracker8lerp.js). Die 8th-Wall-Engine
// hat keinen konfigurierbaren Vorfilter.
export const STAB = {
  // --- Feature-Schalter ------------------------------------------------------
  enabled: true,     // Glättung (false = Messung 1:1, τ ohne Wirkung)
  nanGuard: true,    // kaputte Kamera-Transformationen im Frame überspringen
                     //   (experience.js getCamLocal; false = Figur kann bei einer
                     //   degenerierten Matrix verschwinden!)
  gravityArbiter: true, // Schwerkraft-Schiedsrichter gegen den „Pose-Flip":
                        //   die ebene Pose-Schätzung hat zwei Lösungen; 8th Wall liefert
                        //   manchmal stabil die gespiegelte (Karte um 2θ gekippt, Figur liegt
                        //   flach zum Betrachter, Kopf unten). Aus der Rohpose wird die
                        //   Spiegel-Kandidatin berechnet und die Lage gewählt, deren Normale
                        //   im Erdframe nach oben zeigt (js/poseArbiter.js). Ohne Gyro passiv.
  // SCHWERKRAFT-SCHIEDSRICHTER: Hysterese — die Spiegel-Kandidatin
  // gewinnt erst, wenn ihr z-Anteil (Normale im Erdframe, 1 = senkrecht nach
  // oben) um mehr als arbiterMargin über dem der Rohpose liegt. Nahe der
  // Frontalsicht sind beide Kandidaten gleich → kein Umschalten, kein Flattern.
  arbiterMargin: 0.15,
  // TRACKER „8lerp" (js/tracker8lerp.js): Zeitkonstante
  // des Lerp/Slerp auf die letzte Messung, in ms. Die Engine misst alle 33–50 ms
  // (20–30 Hz) — τ in derselben Größe glättet die Treppe, Nachlauf bei
  // gleichmäßiger Bewegung ≈ τ. 0 = Messung 1:1.
  lerpPosMs: 50,
  lerpRotMs: 50,
};

// Aktivier-Phase (ActivationFX): vier gelbe Eck-Marker auf den Kartenecken,
// wabern leicht auf und ab; beim Tap ploppen sie auf und bleiben dann still
// auf den Ecken stehen (dann kommt die Figur).
export const ACTFX = {
  markerSize: 0.14,    // Kantenlänge der Marker (Anteil Kartenbreite)
  bobHeight: 0.05,     // Hub des Waberns (Anteil Kartenbreite)
  bobSec: 1.6,         // Periode des Waberns (s)
  burstSec: 0.35,      // Dauer des Aufploppens beim Tap bis zur Figur
  color: "#fced62",    // Marker-Füllung
  outline: "#000000",  // Marker-Kontur
  outlineWidth: 4.44,  // Konturstärke in viewBox-Einheiten (32,59 = Marker-Kante)
  // Handy-Icon springt beim Erkennen aus dem Panel und hüpft auf der Kartenmitte.
  hopper: true,
  iconHeight: 0.68,    // Icon-Höhe (Anteil Kartenbreite, × SCENE.figureScale)
  hopHeight: 0.12,     // Sprunghöhe (Anteil Kartenbreite)
  hopSec: 0.32,        // Dauer eines Sprungs
  squashSec: 0.14,     // Stauchen beim Aufkommen
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
  // Anfangston einer Antwort (sound.bubbleOpen): zwei steigende Töne (Quinte)
  // wie das Textbox-„Blip" alter RPGs, nur auf Seite 1.
  bubblePitch: 660,    // erster Ton (Hz), der zweite liegt eine Quinte höher
  bubbleToneMs: 45,    // Länge je Ton (ms)
  bubbleGapMs: 40,     // Abstand der Toneinsätze (ms) — zusammen ~85 ms
  bubbleVolume: 0.4,   // Pegel relativ zum Master (volume × bubbleVolume)
};

// Gyro (js/gyroFusion.js): Handy-Lage für den Schwerkraft-Schiedsrichter
// (STAB.gravityArbiter). Kill-Switch zusätzlich per ?nogyro.
export const GYRO = {
  enabled: true,
  bridgeMs: 1200,        // wie lange ein Aussetzer gyro-geführt überbrückt würde
                         // (der Tracker 8lerp nutzt keine Gyro-Brücke)
  deltaDeadZone: 0.0012, // rad; Akkumulations-Schwelle von GyroFusion.getDelta():
                         // qPrev rückt nur vor, wenn das Delta auch geliefert wird —
                         // langsame Drehungen summieren sich auf und feuern in
                         // ~0.07°-Quanten, Rauschen bleibt draußen
  deltaMax: 0.2,         // rad; größere Deltas = Sensor-Glitch → verwerfen (resync)
};

// Kamera: Die 8th-Wall-Engine wählt die Auflösung selbst (geräteabhängige
// Constraint-Leiter mit Retry).
export const CAM = {
  maxPixelRatio: 2,      // Canvas-Cap: arSession.js setzt die
                         // Canvas-Pixelgröße = CSS-Größe × min(devicePixelRatio, Cap)
                         // — Cap 2 statt 3 auf iPhones gibt der Vision-Schleife GPU-Luft.
};

/* Per-Frame-Lerps (faceCamLerp, billboardLerp) sind
   fps-abhängig — auf 60-fps-Äquivalent normalisieren (identisch bei 60 fps). */
export function frameLerp60(lerpPerFrame, dt) {
  return 1 - Math.pow(1 - lerpPerFrame, dt * 60);
}
