/* Tracker „8roh" (js/tracker8roh.js): Nulllinie — Messung 1:1, sofort weg bei Verlust, nichts sonst. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { Tracker8roh } from "../js/tracker8roh.js";
import { laufSzenario } from "./stabilizerSzenario.mjs";

test("Messung 1:1, sichtbar nur zwischen onFound und onLost, reacquire ohne Wirkung", () => {
  const target = new THREE.Group();
  const t = new Tracker8roh(target, null);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(0.1, -0.2, -0.3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4), new THREE.Vector3(0.059, 0.059, 0.059));
  assert.equal(target.visible, false);
  t.onFound();
  assert.equal(target.visible, true);
  t.measure(m); t.tick();
  assert.deepEqual(target.matrix.elements, m.elements);
  assert.equal(t.snapshot().newMeas, true);
  t.tick();
  assert.equal(t.snapshot().newMeas, false);
  const vorher = target.matrix.elements.slice();
  t.reacquire(); t.tick();
  assert.deepEqual(target.matrix.elements, vorher);
  t.onLost();
  assert.equal(target.visible, false); // sofort, keine Haltezeit
  // rawPos in Kartenbreiten (für ?stats), Zähler alle null
  const s = t.snapshot();
  assert.ok(Math.abs(s.rawPos.x - 0.1 / 0.059) < 1e-12);
  assert.equal(s.snapCount + s.relockCount + s.relocCount + s.flipCount + s.gyroApplied + s.modeSwitches, 0);
  assert.equal(s.moving, false);
  for (const k of ["tracking", "visible", "moveCause", "visionHz", "rawQuat", "rawSkewDeg", "rawOffset", "nanCount", "arb"]) assert.ok(k in s, k);
});

test("NaN-Messung wird gezählt, nicht verworfen (kein Filter)", () => {
  const target = new THREE.Group();
  const t = new Tracker8roh(target);
  t.onFound();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(NaN, 0, -0.3), new THREE.Quaternion(), new THREE.Vector3(0.059, 0.059, 0.059));
  t.measure(m);
  assert.equal(t.snapshot().nanCount, 1);
  assert.ok(Number.isNaN(target.matrix.elements[12]));
});

test("läuft durch das Goldstandard-Szenario ohne Ausnahme", () => {
  const r = laufSzenario(Tracker8roh, {}, { jederTick: 10 });
  assert.equal(r.ticks.length, 130);
  assert.equal(r.zaehler.snap, 0);
  assert.equal(r.zaehler.nan, 1);
});
