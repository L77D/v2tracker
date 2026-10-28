/* =============================================================================
   DETAR — GyroFusion: liest die Geräte-Rotation (deviceorientation, ~60 Hz)
   und liefert die absolute Lage der Kamera (getOrientation) für den
   Schwerkraft-Schiedsrichter (js/poseArbiter.js) und ?stats.

   Bis Build 110 lieferte sie zusätzlich Rotations-DELTAS als Prediction und
   Verlust-Brücke für den PoseStabilizer (getDelta, Akkumulations-Dead-Band
   2026-07-14) — mit dem Stabilizer archiviert (archiv/tracker-varianten/),
   seit Build 113 auch hier raus.

   KEINE ABFRAGE MEHR (2026-10-28, Build 113, Michael): bis Build 112 rief
   enable() auf iOS DeviceOrientationEvent.requestPermission() — eine zweite
   Systemabfrage beim Start, die mit der Kamera-Abfrage kollidierte („Ohne
   Kamera geht's nicht" trotz Erlauben). Jetzt wird nur noch der Listener
   gesetzt: Android liefert Events frei, iOS ohne Erlaubnis gar keine →
   getOrientation() bleibt null und der Schiedsrichter nimmt Bildschirm-oben
   als Referenz (Q_SCREEN_UP). Nur zum Messen am iPhone (?gyrofrage) fragt
   enable({ fragen: true }) wie früher.

   Frames: W3C-Gerätekoordinaten (X rechts, Y Bildschirm-oben, Z aus dem
   Display) entsprechen im Portrait exakt dem three.js-Kamera-Frame der
   Rückkamera (X rechts, Y hoch, Blick entlang −Z); die Screen-Orientation-
   Drehung um Z wird herausgerechnet.

   Fail-safe: keine Events / stale Daten → getOrientation() liefert null.
   Kill-Switch: ?nogyro (GYRO.enabled).
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";

const DEG = Math.PI / 180;
const _qNew = new THREE.Quaternion();
const _qScreen = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);

/* deviceorientation (alpha,beta,gamma; intrinsisch Z-X'-Y'') → Quaternion */
function quatFromEuler(alpha, beta, gamma, out) {
  const _x = beta * DEG, _y = gamma * DEG, _z = alpha * DEG;
  const cX = Math.cos(_x / 2), cY = Math.cos(_y / 2), cZ = Math.cos(_z / 2);
  const sX = Math.sin(_x / 2), sY = Math.sin(_y / 2), sZ = Math.sin(_z / 2);
  out.set(
    sX * cY * cZ - cX * sY * sZ,
    cX * sY * cZ + sX * cY * sZ,
    cX * cY * sZ + sX * sY * cZ,
    cX * cY * cZ - sX * sY * sZ
  );
  return out;
}

export class GyroFusion {
  constructor() {
    this.active = false;        // Events kommen an
    this.enabled = false;       // enable() gelaufen + erlaubt
    this.qCur = new THREE.Quaternion();   // Kamera-Orientierung (Welt)
    this.lastEventMs = 0;
    this._onEvent = (e) => this.handle(e);
  }

  /* Listener setzen. fragen: true = iOS-Permission anfragen (nur ?gyrofrage;
     MUSS dann aus der User-Geste heraus laufen). Standard: keine Abfrage. */
  async enable({ fragen = false } = {}) {
    try {
      if (fragen && typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== "granted") return false;
      }
      window.addEventListener("deviceorientation", this._onEvent, true);
      this.enabled = true;
      return true;
    } catch (e) {
      return false; // kein Gyro / verweigert → App läuft ohne
    }
  }

  handle(e) {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    quatFromEuler(e.alpha, e.beta, e.gamma, _qNew);
    // Screen-Orientation rausdrehen (Landscape etc.): Rotation um Geräte-Z
    const ang = (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
    if (ang !== 0) {
      _qScreen.setFromAxisAngle(_zAxis, -ang * DEG);
      _qNew.multiply(_qScreen);
    }
    this.qCur.copy(_qNew);
    this.lastEventMs = performance.now();
    this.active = true;
  }

  /* Absolute Orientierung Screen-/Kamera-Frame → Erdframe (Z = oben), oder null
     ohne frisches Signal. Für den Schwerkraft-Schiedsrichter (poseArbiter.js,
     2026-09-15): dort zählt nur der z-Anteil transformierter Vektoren, also
     beta/gamma — der iOS-Alpha-Offset (alpha relativ zur Startlage) ist egal. */
  getOrientation() {
    if (!this.enabled || !this.active) return null;
    if (performance.now() - this.lastEventMs > 250) return null;
    return this.qCur;
  }
}
