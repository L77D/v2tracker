/* =============================================================================
   DETAR — Tracker „8roh" (Build 93, 2026-10-12): die Nulllinie. Was die
   8th-Wall-Engine liefert, eins zu eins — kein Filter, kein Median, keine
   Dead-Zone, keine Extrapolation, kein Gyro, kein Schiedsrichter, keine
   Haltezeit. Auswahl per ?tracker=8roh (js/trackerWahl.js).

   Zweck: Jede Filtervariante muss messbar besser sein als das hier. In ?stats
   sind „roh" und „stab" identisch — die Rauschzahl ist exakt die der Engine;
   Pose-Flip, Treppensignal (20–30 Hz) und Flackern beim Verdecken sind
   sichtbar, und zwar absichtlich. Kein Schalter 1–10 wirkt hier.

   Vertrag wie alle Varianten: constructor(target, gyro) + measure(matrix),
   onFound/onLost/reacquire/tick/snapshot. Eine NaN-Messung wird NICHT
   verworfen (das wäre ein Filter), nur gezählt — die Behaviors schützen sich
   selbst (experience.js → getCamLocal, STAB.nanGuard).
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { finiteVec, finiteQuat } from "./util.js";

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class Tracker8roh {
  constructor(target, gyro = null) {
    this.target = target;
    this.gyro = gyro; // unbenutzt — Vertrag
    this.target.matrixAutoUpdate = false;
    this.target.visible = false;
    this.tracking = false;
    this.newMeasFrame = false;
    this.measCount = 0;
    this.hzWindowT = 0;
    this.visionHz = null;
    this.diag = { newMeas: false, rawPos: new THREE.Vector3(), rawQuat: new THREE.Quaternion(), nanCount: 0 };
    this.arb = { flipped: false, zRaw: 0, zChosen: 0, tiltDeg: 0, active: false };
    this.snap = {};
  }

  onFound() { this.tracking = true; this.target.visible = true; }
  onLost() { this.tracking = false; this.target.visible = false; } // sofort weg, keine Haltezeit
  reacquire() { /* nichts aufzusetzen */ }

  /** Messung 1:1 übernehmen. rawPos in Kartenbreiten (wie bei den anderen Varianten, ?stats). */
  measure(matrix) {
    matrix.decompose(_p, _q, _s);
    if (!finiteVec(_p) || !finiteQuat(_q) || !finiteVec(_s)) this.diag.nanCount++;
    this.diag.rawPos.copy(_p).divideScalar(_s.x || 1);
    this.diag.rawQuat.copy(_q);
    this.target.matrix.copy(matrix);
    this.target.matrixWorldNeedsUpdate = true;
    this.measCount++;
    this.newMeasFrame = true;
  }

  tick() {
    const now = performance.now();
    this.diag.newMeas = this.newMeasFrame;
    this.newMeasFrame = false;
    if (now - this.hzWindowT > 1000) { this.visionHz = this.measCount; this.measCount = 0; this.hzWindowT = now; }
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
    s.rawSkewDeg = 0;
    s.rawOffset = 0;
    s.relocCount = 0;
    s.snapCount = 0;
    s.relockCount = 0;
    s.flipCount = 0;
    s.nanCount = d.nanCount;
    s.modeSwitches = 0;
    s.gyroApplied = 0;
    s.arb = this.arb;
    return s;
  }
}
