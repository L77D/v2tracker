/* =============================================================================
   DETAR — TapInput: macht aus Pointer-Ereignissen auf dem Canvas einen TAP und
   liefert dem Aufrufer den Strahl in die Szene. Bis Build 86 Teil von main.js
   (buildExperience → doTap), seit Refactoring Stufe 3b eigenes Modul.

   Tap ≠ Wackeln/Drag: höchstens CHOREO.tapMaxPx Weg und CHOREO.tapMaxMs Dauer
   zwischen pointerdown und pointerup.
   ENTPRELLEN: pointerup UND der native click-Fallback rufen beide tap() —
   FALLBACK (iOS): bricht der Browser die Pointer-Sequenz mit pointercancel ab,
   kommt nie ein pointerup, der native click feuert trotzdem. Der zweite Aufruf
   binnen CHOREO.tapDebounceMs fällt weg: seit dem Dialogsystem wäre Doppel-
   Auslösung NICHT mehr harmlos (Blase überspringen + Weiter in einem Tap).
   WAS getroffen wurde (Karte, Blase, Figur) und was das in der aktuellen Phase
   bedeutet, entscheidet der Aufrufer (js/experience.js → handleTap).
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { CHOREO } from "./config.js";

export class TapInput {
  /**
   * @param domElement Canvas des Renderers (Pointer-Ereignisse, Pixelmaße)
   * @param camera     Szenenkamera — der Strahl geht vom Tap-Punkt in NDC aus
   * @param onTap      (raycaster) → Aufrufer wertet die Treffer aus
   */
  constructor(domElement, camera, onTap) {
    this.el = domElement;
    this.camera = camera;
    this.onTap = onTap;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.downX = 0; this.downY = 0; this.downT = 0;
    this.lastTapT = 0;
    domElement.addEventListener("pointerdown", (e) => {
      this.downX = e.clientX; this.downY = e.clientY; this.downT = performance.now();
    });
    domElement.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > CHOREO.tapMaxPx) return;
      if (performance.now() - this.downT > CHOREO.tapMaxMs) return;
      this.tap(e.clientX, e.clientY);
    });
    domElement.addEventListener("click", (e) => this.tap(e.clientX, e.clientY));
  }

  tap(clientX, clientY) {
    const nowT = performance.now();
    if (nowT - this.lastTapT < CHOREO.tapDebounceMs) return;
    this.lastTapT = nowT;
    const rect = this.el.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    this.onTap(this.ray);
  }
}
