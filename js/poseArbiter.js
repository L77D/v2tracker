/* =============================================================================
   DETAR — PoseArbiter: Schwerkraft-Schiedsrichter gegen den „Pose-Flip"
   (2026-09-15, Michael: Figur liegt flach in der Tischebene zum Betrachter,
   Kopf unten, Blasentext auf dem Kopf; stabil, bei zwei Kartenmotiven).

   URSACHE (Analyse 2026-09-15): Die ebene Pose-Schätzung hat zwei Lösungen,
   die fast identisch ins Bild projizieren. Die zweite ist die Karte um ihre
   Querachse um 2θ gekippt (θ = Neigung des Handys gegen die Senkrechte): bei
   45° liegt die Figur exakt flach zum Betrachter. Die Engine (8th Wall,
   xr-tracking.js) liefert diese Lösung manchmal stabil; der PoseStabilizer
   folgt der Quelle und kann sie weder erzeugen noch halten (zwei ferne
   Messungen → Neuaufsetzen, s. poseStabilizer.js). Belege + Rechnung:
   docs/8thwall-migration.md Abschnitt 9.

   PRINZIP: Beide Lösungen sind eine Involution — aus der Rohpose T lässt sich
   die Spiegel-Kandidatin T' exakt berechnen (Normale n an der Sichtlinie u
   gespiegelt = Drehung um n×u um 2θ, Position bleibt) und aus T' wieder T.
   Gewählt wird die Kandidatin, deren Kartennormale im ERDFRAME stärker nach
   oben zeigt. Dafür zählt nur der z-Anteil der Normale — der hängt allein an
   beta/gamma (Neigung), nicht an alpha (Kompass): der iOS-Alpha-Offset und
   das Dead-Band von GyroFusion.getDelta() sind irrelevant. Hysterese über
   STAB.arbiterMargin: nahe der Frontalsicht sind beide Kandidaten praktisch
   gleich, dort wird nicht umgeschaltet (kein Flattern, kein sichtbarer Sprung).

   Reine Mathematik, kein Zustand, kein DOM. Ohne frisches Gyro-Signal (keine
   Permission, Desktop, ?nogyro) ruft der Stabilizer den Arbiter nicht auf.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";

const _n = new THREE.Vector3();
const _u = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _nAlt = new THREE.Vector3();
const _qFlip = new THREE.Quaternion();
const _qAlt = new THREE.Quaternion();
const _tmp = new THREE.Vector3();
const MIN_TILT = 0.05; // rad (~3°): darunter sind beide Kandidaten identisch

/**
 * Wählt zwischen der Rohpose und ihrer Spiegel-Kandidatin die Lage, deren
 * Kartennormale im Erdframe stärker nach oben zeigt.
 * @param pos    Kartenposition im Kamera-Frame (nur die Richtung zählt)
 * @param quat   Kartenrotation im Kamera-Frame — wird bei Wechsel ÜBERSCHRIEBEN
 * @param qEarth Screen-/Kamera-Frame → Erdframe (GyroFusion.getOrientation())
 * @param margin Hysterese: Differenz der z-Anteile, ab der die Spiegel-Kandidatin gewinnt
 * @param out    { flipped, zRaw, zChosen, tiltDeg } — wird befüllt und zurückgegeben
 */
export function arbitrateUpright(pos, quat, qEarth, margin, out) {
  out.flipped = false;
  _n.set(0, 0, 1).applyQuaternion(quat);          // Kartennormale (Kamera-Frame)
  _u.copy(pos).negate();                           // Karte → Kamera
  const len = _u.length();
  out.zRaw = _tmp.copy(_n).applyQuaternion(qEarth).z;
  out.zChosen = out.zRaw;
  out.tiltDeg = 0;
  if (len < 1e-9) return out;
  _u.divideScalar(len);
  const cosT = Math.max(-1, Math.min(1, _n.dot(_u)));
  const theta = Math.acos(cosT);
  out.tiltDeg = (theta * 180) / Math.PI;
  if (theta < MIN_TILT || theta > Math.PI - MIN_TILT) return out;
  // Spiegel-Kandidatin: n an u gespiegelt = Drehung um (n×u) um 2θ
  // (Rechte-Hand-Regel: x um z um +90° → y; um 2θ liegt n jenseits von u).
  _axis.crossVectors(_n, _u);
  if (_axis.lengthSq() < 1e-12) return out;
  _axis.normalize();
  _qFlip.setFromAxisAngle(_axis, 2 * theta);
  _qAlt.copy(_qFlip).multiply(quat);              // R' = Rot(axis, 2θ) · R
  _nAlt.set(0, 0, 1).applyQuaternion(_qAlt);
  const zAlt = _tmp.copy(_nAlt).applyQuaternion(qEarth).z;
  if (zAlt - out.zRaw > margin) {
    quat.copy(_qAlt);
    out.flipped = true;
    out.zChosen = zAlt;
  }
  return out;
}
