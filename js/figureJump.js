/* =============================================================================
   DETAR — FigureJump: Parabel-Hüpfer der Figur zurück zur Kartenmitte beim
   Tap auf die Figur. Bis Build 86 Teil von main.js (buildExperience), seit
   Refactoring Stufe 3b eigenes Modul. Während des Sprungs pausiert das
   Wandern (wander.setBusy) und das Gesicht bleibt auf „talk" gehalten — sonst
   überschreibt der nächste Tick des FaceAnimators den Ausdruck; am Ende steht
   die Figur wieder auf FIGURE_HOME. Dauer/Höhe: CHOREO.jumpDurationSec,
   CHOREO.jumpHeight. Ein laufender Sprung wird nicht neu gestartet (active).
   ============================================================================= */
import { CHOREO } from "./config.js";
import { sound } from "./sound.js";

export class FigureJump {
  constructor({ nodes, wander, face }) {
    this.nodes = nodes;
    this.wander = wander;
    this.face = face;
    this.active = false;
    this.t = 0;
    this.fromX = 0;
    this.fromZ = 0;
  }

  start() {
    if (this.active) return;
    this.active = true;
    sound.figureJump();
    this.t = 0;
    this.fromX = this.nodes.FigureRoot.position.x;
    this.fromZ = this.nodes.FigureRoot.position.z;
    this.wander.setBusy(true);
    this.wander.walkTarget = null;
    this.face.holdFace = "talk"; // gehaltener Ausdruck — sonst überschreibt der nächste Tick
  }

  /* Nach wander.tick() rufen: überschreibt die Position während des Sprungs. */
  tick(dt) {
    if (!this.active) return;
    const { nodes, face, wander } = this;
    this.t += dt;
    const k = Math.min(1, this.t / Math.max(0.05, CHOREO.jumpDurationSec));
    const e = k * k * (3 - 2 * k); // smoothstep horizontal
    nodes.FigureRoot.position.x = this.fromX * (1 - e);
    nodes.FigureRoot.position.z = this.fromZ * (1 - e);
    nodes.FigureRoot.position.y = nodes.FIGURE_HOME.pos.y + Math.sin(Math.PI * k) * CHOREO.jumpHeight;
    if (k >= 1) {
      this.active = false;
      nodes.FigureRoot.position.set(0, nodes.FIGURE_HOME.pos.y, 0);
      wander.setBusy(false);
      face.holdFace = null;
      if (!face.talking) face.showFace(face.blinkActive ? "blink" : "neutral");
    }
  }
}
