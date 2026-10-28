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
   das frühere Delta-Dead-Band sind irrelevant. Hysterese über
   STAB.arbiterMargin: nahe der Frontalsicht sind beide Kandidaten praktisch
   gleich, dort wird nicht umgeschaltet (kein Flattern, kein sichtbarer Sprung).

   REFERENZ „OBEN" (2026-10-28, Build 113 — Michael: „gibt es eine Taktik ohne
   Gyro?"): Der Vergleich braucht nur ein Quaternion, das den Kamera-Frame in
   einen Frame mit +Z = oben dreht. Zwei Quellen:
   • Gyro-Lage (GyroFusion.getOrientation(), Erd-oben) — wo sie ohne Abfrage da
     ist (Android). Grenze: Karten, die von UNTEN betrachtet werden.
   • Q_SCREEN_UP = Bildschirm-oben (Kamera-+Y): die Spiegel-Lösung ist die
     Normale an der Sichtlinie gespiegelt — bei Karte auf dem Tisch oder in der
     Hand, Handy von oben/schräg darauf, zeigt die WAHRE Normale im Kamera-Frame
     nach Bildschirm-oben (n.y > 0), die Spiegel-Lösung nach unten (n.y < 0;
     genau das Fehlerbild „Kopf unter den Füßen"). Nachgerechnet mit der Szene
     aus tests/poseArbiter.test.mjs, Kipp 15°–75°, auch seitlich versetzt:
     Spiegel wird exakt zurückgedreht, wahre Pose bleibt. Grenze: eine
     SENKRECHTE Karte (Wand), von OBEN betrachtet, hat n.y < 0 und würde gekippt
     — für die 63×88-mm-Karte in Hand/Tisch irrelevant. Keine Permission nötig,
     deshalb seit Build 113 die Grundlage auf allen Geräten (keine iOS-
     Bewegungsabfrage mehr); die Gyro-Lage gewinnt, wo sie frei vorliegt.
   Reine Mathematik, kein Zustand, kein DOM.
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

/* Bildschirm-oben als Referenz: Rx(+90°) bildet Kamera-+Y auf +Z ab (z' = y),
   damit in arbitrateUpright der z-Anteil = Anteil nach Bildschirm-oben ist. */
export const Q_SCREEN_UP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

/**
 * Wählt zwischen der Rohpose und ihrer Spiegel-Kandidatin die Lage, deren
 * Kartennormale im „Oben"-Frame stärker nach oben zeigt.
 * @param pos    Kartenposition im Kamera-Frame (nur die Richtung zählt)
 * @param quat   Kartenrotation im Kamera-Frame — wird bei Wechsel ÜBERSCHRIEBEN
 * @param qUp    Kamera-Frame → Frame mit +Z = oben: Gyro-Lage
 *               (GyroFusion.getOrientation(), Erd-oben) oder Q_SCREEN_UP (Bildschirm-oben)
 * @param margin Hysterese: Differenz der z-Anteile, ab der die Spiegel-Kandidatin gewinnt
 * @param out    { flipped, zRaw, zChosen, tiltDeg } — wird befüllt und zurückgegeben
 */
export function arbitrateUpright(pos, quat, qUp, margin, out) {
  out.flipped = false;
  _n.set(0, 0, 1).applyQuaternion(quat);          // Kartennormale (Kamera-Frame)
  _u.copy(pos).negate();                           // Karte → Kamera
  const len = _u.length();
  out.zRaw = _tmp.copy(_n).applyQuaternion(qUp).z;
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
  const zAlt = _tmp.copy(_nAlt).applyQuaternion(qUp).z;
  if (zAlt - out.zRaw > margin) {
    quat.copy(_qAlt);
    out.flipped = true;
    out.zChosen = zAlt;
  }
  return out;
}
