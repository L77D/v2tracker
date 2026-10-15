/* PoseStabilizer (js/poseStabilizer.js): Goldstandard-Vergleich gegen den
   Stand vor Refactoring Stufe 3c (Build 87) über das Szenario in
   tests/stabilizerSzenario.mjs — für jede Feature-Schalter-Variante — plus
   Einzelprüfungen der Stufen und der Diagnose-Schnittstelle snapshot().

   Goldstandard neu erzeugen (nur bei GEWOLLTER Verhaltensänderung, mit dem
   Stand vor der Änderung): laufSzenario(PoseStabilizer, konfig, {jederTick})
   je KONFIGS → tests/fixtures/poseStabilizer.golden.json. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { PoseStabilizer } from "../js/poseStabilizer.js";
import { STAB, GYRO } from "../js/config.js";
import { laufSzenario, KONFIGS, STAB_FEST, GYRO_FEST } from "./stabilizerSzenario.mjs";
import { leseJson } from "./karte.mjs";

const golden = leseJson("tests/fixtures/poseStabilizer.golden.json");
const EPS = 1e-9;

test("Goldstandard deckt alle Varianten ab", () => {
  assert.deepEqual(Object.keys(golden.konfigs).sort(), Object.keys(KONFIGS).sort());
});

for (const [name, konfig] of Object.entries(KONFIGS)) {
  test("Szenario „" + name + "“ ist bitidentisch zum Stand vor dem Umbau", () => {
    const soll = golden.konfigs[name];
    const ist = laufSzenario(PoseStabilizer, konfig, { jederTick: name === "standard" ? 1 : 20 });
    assert.deepEqual(ist.zaehler, soll.zaehler, "Zähler");
    assert.equal(ist.ticks.length, soll.ticks.length, "Zahl der Proben");
    for (let k = 0; k < soll.ticks.length; k++) {
      const a = ist.ticks[k], b = soll.ticks[k];
      assert.equal(a[0], b[0]);
      assert.equal(a[1], b[1], "sichtbar bei Tick " + b[0]);
      for (let j = 2; j < b.length; j++) {
        assert.ok(Math.abs(a[j] - b[j]) <= EPS * Math.max(1, Math.abs(b[j])),
          `Tick ${b[0]}, Wert ${j}: ${a[j]} ≠ ${b[j]}`);
      }
    }
  });
}

test("Szenario-Zähler stoßen jede Stufe an (Standard)", () => {
  const z = golden.konfigs.standard.zaehler;
  assert.ok(z.snap >= 2 && z.relock >= 1 && z.reloc === 1 && z.flip >= 2 && z.nan >= 1 && z.gyroApplied > 0 && z.modeSwitches >= 2, JSON.stringify(z));
});

/* ---- Einzelprüfungen mit gefälschter Uhr --------------------------------- */
function aufbau({ gyro = null, stab = {}, gyroCfg = {} } = {}) {
  const alt = { STAB: { ...STAB }, GYRO: { ...GYRO }, now: performance.now };
  Object.assign(STAB, STAB_FEST, stab);
  Object.assign(GYRO, GYRO_FEST, gyroCfg);
  const uhr = { t: 0 };
  performance.now = () => uhr.t;
  const source = new THREE.Group(); source.matrixAutoUpdate = false;
  const target = new THREE.Group();
  const s = new PoseStabilizer(source, target, gyro);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const pose = (x, y, z, scale = 0.059) => { p.set(x, y, z); q.identity(); sc.setScalar(scale); source.matrix.compose(p, q, sc); };
  const schritt = (ms = 1000 / 60) => { uhr.t += ms; s.tick(); };
  const ziel = () => { const o = new THREE.Vector3(); target.matrix.decompose(o, new THREE.Quaternion(), new THREE.Vector3()); return o; };
  const ende = () => { Object.assign(STAB, alt.STAB); Object.assign(GYRO, alt.GYRO); performance.now = alt.now; };
  return { s, source, target, pose, schritt, ziel, ende, uhr };
}
/* Aufsetzen: so viele neue Messungen, bis der Median steht. */
function aufsetzen(t, x = 0, y = 0, z = -0.3) {
  for (let i = 0; i < STAB_FEST.acquireFrames + 1; i++) { t.pose(x + i * 1e-5, y, z); t.schritt(); }
}

test("unsichtbar bis onFound; nach dem Aufsetzen steht die Median-Pose", () => {
  const t = aufbau();
  try {
    t.pose(0, 0, -0.3); t.schritt();
    assert.equal(t.target.visible, false);
    t.s.onFound();
    assert.equal(t.target.visible, true);
    aufsetzen(t);
    const z = t.ziel();
    assert.ok(Math.abs(z.z + 0.3) < 1e-6 && Math.abs(z.x) < 1e-4, JSON.stringify(z));
    assert.equal(t.s.snapshot().tracking, true);
  } finally { t.ende(); }
});

test("NaN-Frame wird verworfen, letzte gute Pose bleibt; ohne Schutz vergiftet er", () => {
  const t = aufbau();
  try {
    t.s.onFound(); aufsetzen(t);
    const vorher = t.ziel();
    t.pose(NaN, 0, -0.3); t.schritt();
    assert.deepEqual(t.ziel(), vorher);
    assert.equal(t.s.snapshot().nanCount, 1);
  } finally { t.ende(); }
  const u = aufbau({ stab: { nanGuard: false } });
  try {
    u.s.onFound(); aufsetzen(u);
    u.pose(NaN, 0, -0.3); u.schritt();
    assert.ok(Number.isNaN(u.ziel().x));
  } finally { u.ende(); }
});

test("Verlust ohne Gyro: Pose hält lostHoldMs, dann ausgeblendet; onFound setzt neu auf", () => {
  const t = aufbau();
  try {
    t.s.onFound(); aufsetzen(t);
    t.s.onLost();
    t.schritt(100);
    assert.equal(t.target.visible, true);
    t.schritt(200); // 300 ms > lostHoldMs 250
    assert.equal(t.target.visible, false);
    t.s.onFound();
    assert.equal(t.target.visible, true);
    assert.equal(t.s.initialised, false); // neu sammeln
  } finally { t.ende(); }
});

test("Gyro-Brücke: bei Verlust dreht die Kamera-Drehung die Pose mit, Figur bleibt sichtbar", () => {
  const delta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.01);
  const ctl = { delta: null };
  const t = aufbau({ gyro: { getDelta: () => ctl.delta, getOrientation: () => null } });
  try {
    t.s.onFound(); aufsetzen(t, 0.05, 0, -0.3);
    const vorher = t.ziel();
    t.s.onLost();
    ctl.delta = delta;
    for (let i = 0; i < 30; i++) t.schritt(); // 0,5 s < bridgeMs
    assert.equal(t.target.visible, true);
    const nachher = t.ziel();
    assert.ok(nachher.distanceTo(vorher) > 1e-3, "Pose wurde mitgedreht");
    assert.equal(t.s.snapshot().gyroApplied, 30);
    for (let i = 0; i < 60; i++) t.schritt(); // über bridgeMs hinaus
    assert.equal(t.target.visible, false);
  } finally { t.ende(); }
});

test("Scale-Lock: einzelner Scale-Ausreißer wird verworfen, anhaltender führt zum Re-Lock", () => {
  const t = aufbau();
  try {
    t.s.onFound(); aufsetzen(t);
    const vorher = t.ziel();
    t.pose(0.01, 0, -0.3, 0.059 * 1.3); t.schritt();
    assert.deepEqual(t.ziel(), vorher);
    for (let i = 0; i < 40; i++) { t.pose(0.01 + i * 1e-5, 0, -0.3, 0.059 * 1.3); t.schritt(); } // > scaleRelockMs
    assert.equal(t.s.snapshot().relockCount, 1);
  } finally { t.ende(); }
});

test("Snap: eine ferne Messung ist ein Ausreißer, zwei in Folge setzen neu auf", () => {
  const t = aufbau();
  try {
    t.s.onFound(); aufsetzen(t);
    t.pose(0.1, 0, -0.3); t.schritt(); // 1,7 Kartenbreiten weit
    assert.equal(t.s.snapshot().snapCount, 0);
    // Der Ausreißer geht nicht in Geschwindigkeit/Messzustand ein, läuft aber
    // durch den One-Euro-Filter bei minCutoff: ~1 % des Sprungs je Frame
    // (Stand Build 87, s. Goldstandard) — kein Snap, kein Sprung.
    const x1 = t.ziel().x;
    assert.ok(x1 > 0 && x1 < 0.005, "nur schwach gezogen: " + x1);
    t.pose(0.1001, 0, -0.3); t.schritt();
    assert.equal(t.s.snapshot().snapCount, 1);
    aufsetzen(t, 0.1);
    assert.ok(Math.abs(t.ziel().x - 0.1) < 1e-3, "nach dem Snap steht die neue Stelle");
  } finally { t.ende(); }
});

test("reacquire: zählt, überspringt die alte Rohpose und setzt per Median neu auf", () => {
  const t = aufbau();
  try {
    t.s.onFound(); aufsetzen(t);
    t.s.reacquire();
    assert.equal(t.s.snapshot().relocCount, 1);
    t.schritt(); // dieselbe Rohpose wie vor dem Tap → zählt nicht
    assert.equal(t.s.acq.samples.length, 0);
    t.pose(0.02, 0, -0.3); t.schritt();
    assert.equal(t.s.acq.samples.length, 1);
  } finally { t.ende(); }
});

test("Stabilizer aus (#1): Rohpose 1:1 durchgereicht", () => {
  const t = aufbau({ stab: { enabled: false } });
  try {
    t.s.onFound();
    t.pose(0.123, 0.4, -0.9); t.schritt();
    assert.deepEqual(t.target.matrix.elements, t.source.matrix.elements);
  } finally { t.ende(); }
});

test("snapshot(): stabiles Objekt mit allen Feldern, die ?stats liest", () => {
  const t = aufbau();
  try {
    const a = t.s.snapshot();
    for (const k of ["tracking", "visible", "moving", "moveCause", "visionHz", "newMeas", "rawPos", "rawQuat",
      "rawSkewDeg", "rawOffset", "relocCount", "snapCount", "relockCount", "flipCount", "nanCount",
      "modeSwitches", "gyroApplied", "arb"]) assert.ok(k in a, k);
    assert.ok(a.rawPos instanceof THREE.Vector3 && a.rawQuat instanceof THREE.Quaternion);
    for (const k of ["active", "flipped", "zRaw", "zChosen", "tiltDeg"]) assert.ok(k in a.arb, "arb." + k);
    assert.equal(t.s.snapshot(), a); // keine Allokation pro Frame
  } finally { t.ende(); }
});
