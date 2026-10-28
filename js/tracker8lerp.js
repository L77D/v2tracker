/* =============================================================================
   DETAR — Tracker „8lerp" (Build 105, 2026-10-13): die Nulllinie 8roh plus
   genau zwei Dinge, sonst nichts. Auswahl per ?tracker=8lerp (js/trackerWahl.js).

   Michael 2026-10-13: „die Summe der Filter in alt und neu macht die UX
   ruckelig; 8roh ist in manchen Fällen gut, aber ein paar Grundlagen fehlen."
   Deshalb kein Modus (Ruhe/Bewegt), keine Dead-Zone, kein Median, keine
   Ausreißer-Regel, kein Snap, keine Extrapolation, kein Gyro-Delta, keine
   Haltezeit — nur:
   1. LERP/SLERP im Render-Takt auf die letzte Messung (das übliche Rezept für
      8th-Wall-Bildziele): framerate-unabhängig exponentiell, a = 1 − exp(−dt/τ)
      mit τ = STAB.lerpPosMs / lerpRotMs. Glättet die Treppe der 20–30-Hz-
      Messungen; Nachlauf bei gleichmäßiger Bewegung ≈ τ. τ = 0 → 1:1.
   2. SCHWERKRAFT-SCHIEDSRICHTER auf jeder Messung (js/poseArbiter.js) gegen
      den Pose-Flip. Referenz „oben": Gyro-Lage, wo sie ohne Abfrage vorliegt
      (Android), sonst Bildschirm-oben (Q_SCREEN_UP, seit Build 113 — vorher
      ohne Gyro passiv; die iOS-Bewegungsabfrage ist weg).

   Bei Verlust sofort unsichtbar (SceneFade blendet in CHOREO.lostFadeMs aus);
   beim Wiederfinden gleitet die Pose von der letzten Stelle her (kein Snap).
   Die erste Messung überhaupt setzt den Zustand direkt — es gibt nichts, von
   dem aus zu gleiten wäre.

   Eine nicht-endliche Messung wird gezählt und NICHT zum Ziel: anders als 8roh
   hat diese Variante Zustand, ein Lerp auf NaN bliebe für immer NaN. Das ist
   nicht der NaN-Schutz als Baustein (der wäre ein zusätzlicher Filter), nur die
   Bedingung, dass der Zustand überlebt.

   Zurückgestellt (Michael 2026-10-13, „für später merken"): kurze Haltezeit bei
   Verlust, Snap beim Wiederfinden, NaN-Schutz, Gyro-Brücke/-Kompensation.
   Erwartbar am Gerät: der Inhalt hinkt einer Handy-Drehung um ≈ τ hinterher
   (rein kamera-relative Glättung) — schwimmt er, ist die Gyro-Kompensation
   der nächste Kandidat.

   Schalter: 1 enabled (aus = Messung 1:1) und 10 gravityArbiter wirken; 2–9
   ohne Wirkung. Vertrag wie alle Varianten: constructor(target, gyro) +
   measure(matrix), onFound/onLost/reacquire/tick/snapshot. Kein DOM, in Node
   testbar (tests/tracker.test.mjs).
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { STAB } from "./config.js";
import { finiteVec, finiteQuat } from "./util.js";
import { arbitrateUpright, Q_SCREEN_UP } from "./poseArbiter.js";

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _w = new THREE.Vector3();

/* Anteil, um den ein Frame der Länge dtMs auf das Ziel zugeht (τ in ms). */
function anteil(dtMs, tauMs) {
  return tauMs > 0 ? 1 - Math.exp(-dtMs / tauMs) : 1;
}

export class Tracker8lerp {
  constructor(target, gyro = null) {
    this.target = target;
    this.gyro = gyro; // nur getOrientation() für den Schiedsrichter
    this.target.matrixAutoUpdate = false;
    this.target.visible = false;
    this.tracking = false;
    this.hasPose = false;
    this.pos = new THREE.Vector3(); // Zustand, Szeneneinheiten (kamera-relativ)
    this.quat = new THREE.Quaternion();
    this.goalPos = new THREE.Vector3(); // letzte Messung (nach dem Schiedsrichter)
    this.goalQuat = new THREE.Quaternion();
    this.scale = 1;
    this.lastTickMs = 0;
    this.newMeasFrame = false;
    this.measCount = 0;
    this.hzWindowT = 0;
    this.visionHz = null;
    this.flipCount = 0;
    this.diag = { newMeas: false, rawPos: new THREE.Vector3(), rawQuat: new THREE.Quaternion(), nanCount: 0 };
    this.arb = { flipped: false, zRaw: 0, zChosen: 0, tiltDeg: 0, active: false, quelle: "—" }; // quelle: gyro | bildschirm (?stats)
    this.snap = {};
  }

  onFound() { this.tracking = true; this.target.visible = true; }
  onLost() { this.tracking = false; this.target.visible = false; } // sofort weg, keine Haltezeit
  reacquire() { /* nichts aufzusetzen */ }

  /** Neue Messung → Schiedsrichter → Ziel. Scale = Kartenbreite (Szeneneinheiten). */
  measure(matrix) {
    matrix.decompose(_p, _q, _s);
    this.measCount++;
    this.newMeasFrame = true;
    if (!finiteVec(_p) || !finiteQuat(_q) || !finiteVec(_s) || _s.x < 1e-8) { this.diag.nanCount++; return; }
    this.arbitrate(_p, _q);
    this.diag.rawPos.copy(_p).divideScalar(_s.x); // Kartenbreiten, wie bei den anderen Varianten (?stats)
    this.diag.rawQuat.copy(_q);
    this.goalPos.copy(_p);
    this.goalQuat.copy(_q);
    this.scale = _s.x;
    if (!this.hasPose) { this.pos.copy(_p); this.quat.copy(_q); this.hasPose = true; }
  }

  /* Schwerkraft-Schiedsrichter (poseArbiter.js): nur auf echten Messungen.
     Referenz „oben" = Gyro-Lage, wenn frisch da, sonst Bildschirm-oben (Build 113). */
  arbitrate(p, q) {
    if (!STAB.gravityArbiter) { this.arb.active = false; this.arb.flipped = false; this.arb.quelle = "—"; return; }
    const qGyro = this.gyro?.getOrientation() ?? null;
    this.arb.active = true;
    this.arb.quelle = qGyro ? "gyro" : "bildschirm";
    const was = this.arb.flipped;
    arbitrateUpright(p, q, qGyro ?? Q_SCREEN_UP, STAB.arbiterMargin, this.arb);
    if (this.arb.flipped !== was) this.flipCount++;
  }

  tick() {
    const now = performance.now();
    this.diag.newMeas = this.newMeasFrame;
    this.newMeasFrame = false;
    if (now - this.hzWindowT > 1000) { this.visionHz = this.measCount; this.measCount = 0; this.hzWindowT = now; }
    const dtMs = this.lastTickMs ? Math.min(100, Math.max(0, now - this.lastTickMs)) : 0; // Uhr-Sprung (Tab im Hintergrund) kappen
    this.lastTickMs = now;
    if (!this.hasPose) return;
    if (STAB.enabled) {
      this.pos.lerp(this.goalPos, anteil(dtMs, STAB.lerpPosMs));
      this.quat.slerp(this.goalQuat, anteil(dtMs, STAB.lerpRotMs));
    } else { // Schalter 1: Messung 1:1
      this.pos.copy(this.goalPos);
      this.quat.copy(this.goalQuat);
    }
    this.target.matrix.compose(this.pos, this.quat, _w.setScalar(this.scale));
    this.target.matrixWorldNeedsUpdate = true;
  }

  snapshot() {
    const s = this.snap, d = this.diag;
    s.tracking = this.tracking;
    s.visible = this.target.visible;
    s.moving = false;
    s.moveCause = "—";
    s.visionHz = this.visionHz;
    s.newMeas = d.newMeas;
    s.rawPos = d.rawPos;
    s.rawQuat = d.rawQuat;
    s.rawSkewDeg = this.hasPose ? (this.quat.angleTo(this.goalQuat) * 180) / Math.PI : 0;
    s.rawOffset = this.hasPose ? this.pos.distanceTo(this.goalPos) / (this.scale || 1) : 0;
    s.relocCount = 0;
    s.snapCount = 0;
    s.relockCount = 0;
    s.flipCount = this.flipCount;
    s.nanCount = d.nanCount;
    s.modeSwitches = 0;
    s.gyroApplied = 0;
    s.arb = this.arb;
    return s;
  }
}
