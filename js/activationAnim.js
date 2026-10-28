/* =============================================================================
   DETAR — ActivationAnim: Pop-In beim ersten Scan (Ease-Out-Back auf die
   ECHTE Start-Scale, optional Spin auf rotation.y). 1:1-Port.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { ACT } from "./config.js";

export class ActivationAnim {
  constructor(nodes) {
    this.P = ACT;
    this.playing = false;
    this.elapsed = 0;
    this.baseRotY = 0;
    this.baseScale = new THREE.Vector3(1, 1, 1);
    this.scaleCaptured = false;
    this.onDone = null;
    this.collapsing = false;
    this.outSec = 0.5;
    this.element = nodes.FigureRoot;
  }
  /* Echte Start-Scale einmal erfassen (vor dem ersten Verstecken) — bis Build
     110 stand der Block dreimal (prime/play/playOut). */
  captureScale() {
    if (this.scaleCaptured) return;
    this.baseScale.copy(this.element.scale);
    this.scaleCaptured = true;
  }
  /* Sofort verstecken (scale 0) + echte Start-Scale erfassen — verhindert,
     dass die Figur vor dem Pop-In kurz in voller Größe aufblitzt. */
  prime() {
    this.captureScale();
    this.element.scale.set(0, 0, 0);
  }
  play(onDone) {
    this.onDone = onDone ?? null;
    this.elapsed = 0;
    this.baseRotY = this.element.rotation.y;
    this.captureScale();
    this.element.scale.set(0, 0, 0);
    // Ein laufendes Einklappen abbrechen (2026-10-28, Build 112): Tap auf
    // „Tipp auf die Karte" während playOut ließ collapsing stehen — tick()
    // klappte weiter ein, meldete „fertig" und die Figur blieb auf Scale 0.
    this.collapsing = false;
    this.playing = true;
  }
  cancel() {
    this.playing = false;
    this.collapsing = false;
    this.onDone = null;
    if (this.scaleCaptured) this.element.scale.copy(this.baseScale);
  }
  /* Dialogsystem (2026-09-03): Figur klappt in die Karte zurück — Umkehrung
     des Pop-Ins (Ease-In auf Scale 0), danach bleibt sie versteckt, bis
     play() sie beim Wiedereinstieg wieder aufploppen lässt. */
  playOut(onDone, durationSec = 0.5) {
    this.onDone = onDone ?? null;
    this.elapsed = 0;
    this.outSec = Math.max(0.05, durationSec);
    this.captureScale();
    this.collapsing = true;
    this.playing = true;
  }
  tick(dt) {
    if (!this.playing) return;
    this.elapsed += dt;
    if (this.collapsing) {
      const t = Math.min(this.elapsed / this.outSec, 1);
      const s = 1 - t * t * t; // ease-in
      this.element.scale.set(this.baseScale.x * s, this.baseScale.y * s, this.baseScale.z * s);
      if (t >= 1) {
        this.playing = false; this.collapsing = false;
        this.element.scale.set(0, 0, 0);
        const cb = this.onDone; this.onDone = null; cb?.();
      }
      return;
    }
    const t = Math.min(this.elapsed / this.P.durationSec, 1);
    const s = this.easeOutBack(t, this.P.overshoot);
    this.element.scale.set(this.baseScale.x * s, this.baseScale.y * s, this.baseScale.z * s);
    const spinTotal = this.P.spins * Math.PI * 2;
    this.element.rotation.y = this.baseRotY + spinTotal * this.easeOut(t);
    if (t >= 1) this.finish();
  }
  finish() {
    this.playing = false;
    this.element.scale.copy(this.baseScale);
    this.element.rotation.y = this.baseRotY;
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }
  easeOutBack(t, overshoot) {
    const c1 = overshoot, c3 = c1 + 1, p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  }
  easeOut(t) { const p = 1 - t; return 1 - p * p * p; }
}
