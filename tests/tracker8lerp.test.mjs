/* Tracker 8lerp (js/tracker8lerp.js, Standard seit Build 110): Goldstandard
   über das Szenario tests/stabilizerSzenario.mjs — jede Variante von KONFIGS,
   dazu τ fest auf 50 ms (STAB.lerpPosMs/lerpRotMs), damit späteres Tuning in
   config.js den Stand nicht bricht. Erzeugt am 2026-10-15 mit dem Stand
   Build 110 (vor dem Refactoring); neu erzeugt 2026-10-28 (Build 113): der
   Schiedsrichter nimmt ohne Gyro-Lage Bildschirm-oben als Referenz — die
   synthetische Pose des Szenarios (baseQ, Normale leicht nach Bildschirm-unten)
   wird in allen Phasen ohne qEarth gespiegelt, deshalb änderten sich alle
   Varianten außer `ohneArbiter`. Toleranz 1e-9 relativ.

   Neu erzeugen (nur bei GEWOLLTER Verhaltensänderung, mit dem Stand davor):
     SNAPSHOT_SCHREIBEN=1 node --test tests/tracker8lerp.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Tracker8lerp } from "../js/tracker8lerp.js";
import * as THREE from "../vendor/three/three.module.js";
import { STAB } from "../js/config.js";
import { laufSzenario, KONFIGS, STAB_FEST, DT_MS } from "./stabilizerSzenario.mjs";
import { ROOT } from "./karte.mjs";

const DATEI = path.join(ROOT, "tests/fixtures/tracker8lerp.golden.json");
const EPS = 1e-9;
const konfig8lerp = (k) => ({ ...k, STAB: { lerpPosMs: 50, lerpRotMs: 50, ...(k.STAB ?? {}) } });
const VARIANTEN = { ...KONFIGS, ohneLerp: { STAB: { lerpPosMs: 0, lerpRotMs: 0 } } };

if (process.env.SNAPSHOT_SCHREIBEN) {
  const konfigs = {};
  for (const [name, k] of Object.entries(VARIANTEN)) konfigs[name] = laufSzenario(Tracker8lerp, konfig8lerp(k), { jederTick: name === "standard" ? 1 : 20 });
  fs.writeFileSync(DATEI, JSON.stringify({ erzeugt: "2026-10-28, js/tracker8lerp.js Stand Build 113 (Schiedsrichter mit Bildschirm-Oben-Prior, wo keine Gyro-Lage; vorher 2026-10-15 Build 110), Szenario tests/stabilizerSzenario.mjs", konfigs }) + "\n");
}
const golden = JSON.parse(fs.readFileSync(DATEI, "utf8"));

test("8lerp-Goldstandard deckt alle Varianten ab", () => {
  assert.deepEqual(Object.keys(golden.konfigs).sort(), Object.keys(VARIANTEN).sort());
});

for (const [name, k] of Object.entries(VARIANTEN)) {
  test("8lerp-Szenario „" + name + "“ ist bitidentisch zum Goldstandard", () => {
    const soll = golden.konfigs[name];
    const ist = laufSzenario(Tracker8lerp, konfig8lerp(k), { jederTick: name === "standard" ? 1 : 20 });
    assert.deepEqual(ist.zaehler, soll.zaehler, "Zähler");
    assert.equal(ist.ticks.length, soll.ticks.length, "Zahl der Proben");
    for (let i = 0; i < soll.ticks.length; i++) {
      const a = ist.ticks[i], b = soll.ticks[i];
      assert.equal(a[0], b[0]);
      assert.equal(a[1], b[1], "sichtbar bei Tick " + b[0]);
      for (let j = 2; j < b.length; j++) {
        assert.ok(Math.abs(a[j] - b[j]) <= EPS * Math.max(1, Math.abs(b[j])), `Tick ${b[0]}, Wert ${j}: ${a[j]} ≠ ${b[j]}`);
      }
    }
  });
}

test("8lerp-Szenario: Zähler wie erwartet (kein Snap/Re-Lock/Modus, NaN gezählt, Schiedsrichter kippt)", () => {
  const z = golden.konfigs.standard.zaehler;
  assert.equal(z.snap + z.relock + z.reloc + z.modeSwitches + z.gyroApplied, 0, JSON.stringify(z));
  assert.ok(z.nan >= 1 && z.flip >= 1, JSON.stringify(z));
});

/* ---- Szenario-Varianten + Einzelprüfungen (bis Build 110 in tests/tracker.test.mjs) --- */
test("Szenario-Varianten laufen auch durch 8lerp ohne Fehler", () => {
  for (const konfig of [{}, { STAB: { enabled: false } }, { STAB: { gravityArbiter: false } }, { STAB: { lerpPosMs: 0, lerpRotMs: 0 } }]) {
    const r = laufSzenario(Tracker8lerp, konfig, { jederTick: 20 });
    for (const row of r.ticks) for (let j = 2; j < row.length; j++) assert.ok(Number.isFinite(row[j]), JSON.stringify(konfig));
  }
});

/* ---- Einzelprüfungen 8lerp ----------------------------------------------- */
function aufbau8lerp({ gyro = null, stab = {} } = {}) {
  const alt = { STAB: { ...STAB }, now: performance.now };
  Object.assign(STAB, STAB_FEST, { lerpPosMs: 50, lerpRotMs: 50 }, stab);
  const uhr = { t: 1000 };
  performance.now = () => uhr.t;
  const target = new THREE.Group();
  const tr = new Tracker8lerp(target, gyro);
  const m = new THREE.Matrix4();
  const mess = (pos, quat = new THREE.Quaternion(), scale = 0.059) => { m.compose(pos, quat, new THREE.Vector3(scale, scale, scale)); tr.measure(m); };
  const frame = (ms = DT_MS) => { uhr.t += ms; tr.tick(); };
  const pose = () => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); target.matrix.decompose(p, q, s); return { p, q, s }; };
  const ende = () => { Object.assign(STAB, alt.STAB); performance.now = alt.now; };
  return { tr, target, mess, frame, pose, ende };
}

test("8lerp: unsichtbar bis onFound, erste Messung sitzt exakt, bei Verlust sofort weg", () => {
  const t = aufbau8lerp();
  try {
    t.frame(); assert.equal(t.target.visible, false);
    t.tr.onFound(); t.mess(new THREE.Vector3(0.01, 0.02, -0.3)); t.frame();
    assert.equal(t.target.visible, true);
    assert.ok(t.pose().p.distanceTo(new THREE.Vector3(0.01, 0.02, -0.3)) < 1e-9);
    assert.ok(Math.abs(t.pose().s.x - 0.059) < 1e-9);
    t.tr.onLost(); assert.equal(t.target.visible, false);
  } finally { t.ende(); }
});

test("8lerp: gleitet framerate-unabhängig auf die letzte Messung (a = 1 − exp(−dt/τ))", () => {
  const ziel = new THREE.Vector3(0.01, 0, -0.3);
  const lauf = (dt, n) => {
    const t = aufbau8lerp();
    try {
      t.tr.onFound(); t.mess(new THREE.Vector3(0, 0, -0.3)); t.frame();
      t.mess(ziel, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2));
      for (let i = 0; i < n; i++) t.frame(dt);
      return t.pose();
    } finally { t.ende(); }
  };
  const a = lauf(DT_MS, 3), b = lauf(DT_MS * 3, 1); // 50 ms in 3 Frames = 50 ms in einem
  assert.ok(Math.abs(a.p.x - b.p.x) < 1e-9, a.p.x + " vs " + b.p.x);
  assert.ok(Math.abs(a.p.x - 0.01 * (1 - Math.exp(-1))) < 1e-6, "nach τ: 63 %: " + a.p.x);
  const c = lauf(DT_MS, 30); // 500 ms = 10 τ
  assert.ok(c.p.distanceTo(ziel) < 1e-6 && c.q.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2)) < 1e-4);
});

test("8lerp: τ = 0 und Schalter 1 aus = Messung 1:1", () => {
  for (const stab of [{ lerpPosMs: 0, lerpRotMs: 0 }, { enabled: false }]) {
    const t = aufbau8lerp({ stab });
    try {
      t.tr.onFound(); t.mess(new THREE.Vector3(0, 0, -0.3)); t.frame();
      t.mess(new THREE.Vector3(0.02, 0, -0.3)); t.frame();
      assert.ok(Math.abs(t.pose().p.x - 0.02) < 1e-9, JSON.stringify(stab));
    } finally { t.ende(); }
  }
});

test("8lerp: nicht-endliche Messung wird gezählt und vergiftet den Zustand nicht", () => {
  const t = aufbau8lerp();
  try {
    t.tr.onFound(); t.mess(new THREE.Vector3(0.01, 0, -0.3)); t.frame();
    t.mess(new THREE.Vector3(NaN, 0, -0.3)); t.frame(); t.frame();
    assert.equal(t.tr.snapshot().nanCount, 1);
    const p = t.pose().p;
    assert.ok(Number.isFinite(p.x) && Math.abs(p.x - 0.01) < 1e-9);
  } finally { t.ende(); }
});

test("8lerp: Schiedsrichter kippt die Spiegel-Lösung zurück, nur mit Gyro-Lage und Schalter 10", () => {
  // Kamera = Erdframe (Lage = Identität, z oben), Karte schräg unter der Kamera
  // (Sichtlinie 45°). Wahre Karte liegt flach: Normale (0,0,1). Die Engine liefert
  // die Spiegel-Lösung: Normale an der Sichtlinie gespiegelt = (0,1,0).
  const pos = new THREE.Vector3(0, -0.2, -0.2);
  const qSpiegel = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
  const normale = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const lage = new THREE.Quaternion();
  for (const [gyro, stab, erwartetZ, flips] of [
    [{ getOrientation: () => lage }, {}, 1, 1],
    [{ getOrientation: () => lage }, { gravityArbiter: false }, 0, 0],
    [{ getOrientation: () => null }, {}, 0, 0],
  ]) {
    const t = aufbau8lerp({ gyro, stab });
    try {
      t.tr.onFound(); t.mess(pos, qSpiegel); t.frame();
      assert.ok(Math.abs(normale(t.pose().q).z - erwartetZ) < 1e-6, "z " + normale(t.pose().q).z + " " + JSON.stringify(stab));
      const s = t.tr.snapshot();
      assert.equal(s.flipCount, flips);
      assert.equal(s.arb.flipped, flips === 1);
    } finally { t.ende(); }
  }
});

test("8lerp: snapshot hat alle Felder von ?stats; Quelltext ohne DOM und verbotene Syntax", async () => {
  const t = aufbau8lerp();
  try {
    const s = t.tr.snapshot();
    for (const k of ["tracking", "visible", "moving", "moveCause", "visionHz", "newMeas", "rawPos", "rawQuat", "rawSkewDeg", "rawOffset",
      "relocCount", "snapCount", "relockCount", "flipCount", "nanCount", "modeSwitches", "gyroApplied", "arb"]) assert.ok(k in s, k);
  } finally { t.ende(); }
  const src = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../js/tracker8lerp.js", import.meta.url), "utf8"));
  assert.ok(!/\bdocument\.|\bwindow\./.test(src));
  assert.ok(!/^\s+static |\?\?=|\.at\(/m.test(src));
});

