/* PoseArbiter (js/poseArbiter.js): Schwerkraft-Schiedsrichter gegen den
   Pose-Flip. Die ebene Pose-Schätzung hat zwei Lösungen; gewählt wird die,
   deren Kartennormale im Erdframe nach oben zeigt.

   Szene: Karte liegt flach auf dem Tisch (Normale = Erd-Z), das Handy ist um
   `kippDeg` aus der Senkrechten gekippt und schaut auf die Kartenmitte. Die
   Kamera schaut in three.js entlang -Z, Y ist oben auf dem Bildschirm. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { arbitrateUpright, Q_SCREEN_UP } from "../js/poseArbiter.js";

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

/* ---- Bildschirm-Oben-Prior (Build 113, ohne Gyro) ---------------------------
   Referenz = Kamera-+Y statt Erd-Z. In der Tisch-Szene oben zeigt die wahre
   Normale nach Bildschirm-oben (n.y = sin kipp > 0), die Spiegel-Lösung nach
   unten — der Prior entscheidet identisch zum Gyro-Schiedsrichter. */
const Y = new THREE.Vector3(0, 1, 0);
const nY = (q) => Z.clone().applyQuaternion(q).y;

test("Q_SCREEN_UP: z-Anteil im Oben-Frame = y-Anteil im Kamera-Frame", () => {
  const v = new THREE.Vector3(0.2, 0.7, -0.3);
  nahe(v.clone().applyQuaternion(Q_SCREEN_UP).z, v.y);
  nahe(Y.clone().applyQuaternion(Q_SCREEN_UP).z, 1);
});

test("Prior, Tisch 15°–75°: Spiegel wird exakt zurückgedreht, wahre Pose bleibt", () => {
  for (const kipp of [15, 30, 45, 60, 75]) {
    const { pos, qTrue } = szene(kipp);
    assert.ok(nY(qTrue) > 0 && nY(spiegel(pos, qTrue)) < 0, `Kipp ${kipp}: wahre Normale nach Bildschirm-oben, Spiegel nach unten`);
    const q = spiegel(pos, qTrue);
    const out = arbitrateUpright(pos, q, Q_SCREEN_UP, MARGIN, {});
    assert.equal(out.flipped, true, `Kipp ${kipp}: Spiegel korrigiert`);
    nahe(q.angleTo(qTrue), 0);
    nahe(out.zChosen, Math.sin(kipp * DEG));
    const q2 = qTrue.clone();
    assert.equal(arbitrateUpright(pos, q2, Q_SCREEN_UP, MARGIN, {}).flipped, false, `Kipp ${kipp}: wahre Pose bleibt`);
    nahe(q2.angleTo(qTrue), 0);
  }
});

test("Prior, Karte seitlich im Bild und gedreht: wie mit Gyro", () => {
  const pos = new THREE.Vector3(1.2, -0.7, -4);
  const qTrue = szene(40).qTrue.multiply(new THREE.Quaternion().setFromAxisAngle(Z, 30 * DEG));
  const q = spiegel(pos, qTrue);
  assert.equal(arbitrateUpright(pos, q, Q_SCREEN_UP, MARGIN, {}).flipped, true);
  nahe(q.angleTo(qTrue), 0);
  const q2 = qTrue.clone();
  assert.equal(arbitrateUpright(pos, q2, Q_SCREEN_UP, MARGIN, {}).flipped, false);
});

test("Prior, Frontalsicht: unter 3° keine Entscheidung; Hysterese greift bis ~4,3° (2·sin θ < margin), bei 10° wird entschieden", () => {
  // Der Oben-Anteil ist hier sin θ statt cos 2θ — der Unterschied der Kandidaten
  // (2·sin θ) wächst schneller als mit der Gyro-Lage (1 − cos 2θ); der Prior
  // entscheidet also früher. Beide Kandidaten liegen bei 10° nur 20° auseinander.
  const nah = szene(1);
  assert.equal(arbitrateUpright(nah.pos, spiegel(nah.pos, nah.qTrue), Q_SCREEN_UP, 0, {}).flipped, false);
  const s4 = szene(4);
  assert.equal(arbitrateUpright(s4.pos, spiegel(s4.pos, s4.qTrue), Q_SCREEN_UP, MARGIN, {}).flipped, false, "2·sin 4° = 0,14 < 0,15");
  const { pos, qTrue } = szene(10);
  const q = spiegel(pos, qTrue);
  assert.equal(arbitrateUpright(pos, q, Q_SCREEN_UP, MARGIN, {}).flipped, true, "2·sin 10° = 0,35 > 0,15");
  nahe(q.angleTo(qTrue), 0);
});

test("Prior, bekannte Grenze: senkrechte Karte von OBEN betrachtet wird gekippt (Characterization)", () => {
  // Wand: Kartennormale waagerecht zur Kamera; Kamera nickt 30° nach unten → n.y < 0
  const kamera = new THREE.Quaternion().setFromAxisAngle(X, -30 * DEG);
  const qTrue = kamera.clone().invert();
  const pos = new THREE.Vector3(0, 0, -5);
  assert.ok(nY(qTrue) < 0);
  const q = qTrue.clone();
  assert.equal(arbitrateUpright(pos, q, Q_SCREEN_UP, MARGIN, {}).flipped, true, "Prior hält die wahre Pose für die Spiegel-Lösung");
  nahe(q.angleTo(qTrue), 60 * DEG); // um 2θ gekippt
  // Dieselbe Grenze hat der Gyro-Schiedsrichter: die Spiegel-Kandidatin der
  // Wandkarte liegt wie ein Tisch (Normale im Erdframe nach oben, z = sin 60°)
  // und gewinnt gegen die waagerechte wahre Normale (z = 0).
  const qEarthWand = new THREE.Quaternion().setFromAxisAngle(X, 90 * DEG).multiply(kamera); // Kamera → Erdframe (Z oben)
  const qg = qTrue.clone();
  const out = arbitrateUpright(pos, qg, qEarthWand, MARGIN, {});
  assert.equal(out.flipped, true);
  nahe(out.zRaw, 0); nahe(out.zChosen, Math.sin(60 * DEG));
  nahe(qg.angleTo(q), 0, 1e-6); // beide Referenzen wählen dieselbe (falsche) Lage
});
