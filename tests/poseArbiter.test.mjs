/* PoseArbiter (js/poseArbiter.js): Schwerkraft-Schiedsrichter gegen den
   Pose-Flip. Die ebene Pose-Schätzung hat zwei Lösungen; gewählt wird die,
   deren Kartennormale im Erdframe nach oben zeigt.

   Szene: Karte liegt flach auf dem Tisch (Normale = Erd-Z), das Handy ist um
   `kippDeg` aus der Senkrechten gekippt und schaut auf die Kartenmitte. Die
   Kamera schaut in three.js entlang -Z, Y ist oben auf dem Bildschirm. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { arbitrateUpright } from "../js/poseArbiter.js";

const DEG = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const MARGIN = 0.15; // STAB.arbiterMargin
const nahe = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

function szene(kippDeg, pos = new THREE.Vector3(0, 0, -5)) {
  // Kamera aufrecht: Xc = Xe, Yc = Ze (hoch), Blick -Zc = +Ye → Drehung um X um +90°
  const aufrecht = new THREE.Quaternion().setFromAxisAngle(X, 90 * DEG);
  // Blick senkt sich um (90° − kipp): kipp 0 = senkrecht von oben, kipp 90 = waagerecht
  const kipp = new THREE.Quaternion().setFromAxisAngle(X, -(90 - kippDeg) * DEG);
  const qEarth = aufrecht.multiply(kipp);       // Kamera-Frame → Erdframe
  const qTrue = qEarth.clone().invert();        // Karten-Frame (= Erdframe) im Kamera-Frame
  return { pos, qTrue, qEarth };
}
/* Spiegel-Kandidatin unabhängig vom Arbiter gebaut: die Normale n wird an der
   Sichtlinie u gespiegelt (n' = 2(n·u)u − n), die kürzeste Drehung n → n'
   kommt aus setFromUnitVectors. */
function spiegel(pos, q) {
  const n = Z.clone().applyQuaternion(q);
  const u = pos.clone().negate().normalize();
  const nAlt = u.clone().multiplyScalar(2 * n.dot(u)).sub(n);
  return new THREE.Quaternion().setFromUnitVectors(n, nAlt).multiply(q);
}
const erdZ = (q, qEarth) => Z.clone().applyQuaternion(q).applyQuaternion(qEarth).z;

test("Szene ist konsistent: wahre Pose hat Normale nach oben, Blick senkt sich", () => {
  const { pos, qTrue, qEarth } = szene(45);
  nahe(erdZ(qTrue, qEarth), 1);
  const blick = new THREE.Vector3(0, 0, -1).applyQuaternion(qEarth);
  assert.ok(blick.z < 0 && blick.y > 0);
  nahe(Z.clone().applyQuaternion(qTrue).angleTo(pos.clone().negate()), 45 * DEG);
});

test("wahre Pose bei 45°: kein Wechsel, Rotation unverändert", () => {
  const { pos, qTrue, qEarth } = szene(45);
  const q = qTrue.clone();
  const out = arbitrateUpright(pos, q, qEarth, MARGIN, {});
  assert.equal(out.flipped, false);
  nahe(out.zRaw, 1);
  nahe(out.zChosen, 1);
  nahe(out.tiltDeg, 45);
  nahe(q.angleTo(qTrue), 0);
});

test("gespiegelte Pose bei 45°: Wechsel zurück zur wahren Pose", () => {
  const { pos, qTrue, qEarth } = szene(45);
  const q = spiegel(pos, qTrue);
  nahe(erdZ(q, qEarth), 0); // Normale liegt um 2θ = 90° gekippt: zeigt waagerecht
  const out = arbitrateUpright(pos, q, qEarth, MARGIN, {});
  assert.equal(out.flipped, true);
  nahe(out.zRaw, 0);
  nahe(out.zChosen, 1);
  nahe(out.tiltDeg, 45);
  nahe(q.angleTo(qTrue), 0);
});

test("Involution: Spiegel der Spiegel-Kandidatin ist die Rohpose", () => {
  const { pos, qTrue } = szene(30);
  nahe(spiegel(pos, spiegel(pos, qTrue)).angleTo(qTrue), 0);
});

test("Hysterese: nahe der Frontalsicht gewinnt die Spiegel-Kandidatin nicht", () => {
  const { pos, qTrue, qEarth } = szene(10);
  const q = spiegel(pos, qTrue);
  nahe(erdZ(q, qEarth), Math.cos(20 * DEG)); // Unterschied zur wahren Pose < margin
  const out = arbitrateUpright(pos, q.clone(), qEarth, MARGIN, {});
  assert.equal(out.flipped, false);
  nahe(out.zChosen, Math.cos(20 * DEG));
  const scharf = arbitrateUpright(pos, q.clone(), qEarth, 0.01, {});
  assert.equal(scharf.flipped, true);
  nahe(scharf.zChosen, 1);
});

test("unter 3° Kipp passiert nichts, auch ohne Hysterese", () => {
  const { pos, qTrue, qEarth } = szene(1);
  const q = spiegel(pos, qTrue);
  const out = arbitrateUpright(pos, q, qEarth, 0, {});
  assert.equal(out.flipped, false);
  nahe(out.tiltDeg, 1, 1e-6);
});

test("Position null: kein Wechsel, Diagnose trotzdem befüllt", () => {
  const { qTrue, qEarth } = szene(45);
  const out = arbitrateUpright(new THREE.Vector3(), qTrue.clone(), qEarth, MARGIN, {});
  assert.equal(out.flipped, false);
  nahe(out.zRaw, 1);
  assert.equal(out.tiltDeg, 0);
});

test("allgemeine Lage: Karte seitlich im Bild und um die eigene Achse gedreht", () => {
  const pos = new THREE.Vector3(1.2, -0.7, -4);
  const { qEarth } = szene(40);
  const qTrue = szene(40).qTrue.multiply(new THREE.Quaternion().setFromAxisAngle(Z, 30 * DEG)); // Karte gedreht, Normale gleich
  nahe(erdZ(qTrue, qEarth), 1);
  const q = spiegel(pos, qTrue);
  const out = arbitrateUpright(pos, q, qEarth, MARGIN, {});
  assert.equal(out.flipped, true);
  nahe(out.zChosen, 1);
  nahe(q.angleTo(qTrue), 0);
  // und die wahre Pose bleibt stehen
  const q2 = qTrue.clone();
  assert.equal(arbitrateUpright(pos, q2, qEarth, MARGIN, {}).flipped, false);
  nahe(q2.angleTo(qTrue), 0);
});
