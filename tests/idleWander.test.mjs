/* IdleWander (js/idleWander.js): Lauffeld roamHalf, Zustandsfolge und Bewegung
   über 40 s mit festem Zufall — Characterization Test (Stand Build 110).
   Invariante: die Füße bleiben im Lauffeld. Snapshot: tests/fixtures/idleWander.snapshot.json */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { IdleWander, roamHalf } from "../js/idleWander.js";
import { IDLE } from "../js/config.js";
import { pruefeSnapshot, mitZufall } from "./snapshot.mjs";

function aufbau() {
  const worldRoot = new THREE.Group();
  const FigureRoot = new THREE.Group(); FigureRoot.scale.setScalar(0.12759215518606418 * 0.5); FigureRoot.position.y = 0.0312; worldRoot.add(FigureRoot);
  const BodyPivot = new THREE.Group(); BodyPivot.position.y = -0.4897775782082088; FigureRoot.add(BodyPivot);
  const HeadPivot = new THREE.Group(); HeadPivot.position.set(0, 0.6251773316593252, 0.01); BodyPivot.add(HeadPivot);
  const HeadNod = new THREE.Group(); HeadNod.position.y = 0.25; HeadPivot.add(HeadNod);
  const nodes = { FigureRoot, BodyPivot, HeadPivot, HeadNod, FIGURE_HOME: { scale: FigureRoot.scale.clone() } };
  const cam = new THREE.Vector3(0.03, 0.25, 0.35);
  const frame = { worldRoot, getCamLocal: (out) => out.copy(cam), toLocal: (v) => worldRoot.worldToLocal(v) };
  return { nodes, frame, cam };
}

test("roamHalf: Fußhalbbreite vom Kartenrand abgezogen (figureScale 0.5)", () => {
  const { nodes } = aufbau();
  const r = roamHalf(nodes);
  assert.ok(Math.abs(r.halfW - 0.016315477297440033) < 1e-15 && Math.abs(r.halfH - 0.028015477297440035) < 1e-15, JSON.stringify(r));
  assert.deepEqual(roamHalf({ FigureRoot: { scale: { x: 10 } } }), { halfW: 0, halfH: 0 });
  assert.ok(Math.abs(roamHalf({ FigureRoot: { scale: { x: 0.0638 } } }).halfW - r.halfW) < 1e-6, "ohne FIGURE_HOME: FigureRoot.scale");
});

test("Verlauf über 40 s: frei → busy → attending → lively → frei (Snapshot), Füße im Lauffeld", () => {
  const { nodes, frame, cam } = aufbau();
  const { halfW, halfH } = roamHalf(nodes);
  const zustaende = new Set();
  const verlauf = mitZufall(11, () => {
    const w = new IdleWander(nodes, frame);
    const out = [];
    for (let i = 0; i < 2400; i++) {
      if (i === 1200) w.setBusy(true);
      if (i === 1300) { w.setBusy(false); w.setAttending(true); }
      if (i === 1500) w.setLively(true);
      if (i === 1800) cam.set(-0.2, 0.2, 0.25);
      if (i === 2000) w.setLively(false);
      if (i === 2100) w.setAttending(false);
      w.tick(1 / 60);
      zustaende.add(w.state);
      const p = nodes.FigureRoot.position;
      assert.ok(Math.abs(p.x) <= halfW + 1e-12 && Math.abs(p.z) <= halfH + 1e-12, "Tick " + i + ": " + p.x + "/" + p.z);
      if (i % 12 === 0) out.push([i, w.state, p.x, p.z, nodes.FigureRoot.rotation.y, nodes.FigureRoot.rotation.z, nodes.HeadPivot.rotation.y, nodes.HeadNod.rotation.x, nodes.BodyPivot.scale.x, nodes.BodyPivot.scale.y]);
    }
    return out;
  });
  pruefeSnapshot("idleWander.snapshot", verlauf);
  assert.ok(["bop", "walk", "look_around", "face_cam"].every((s) => zustaende.has(s)), [...zustaende].join(","));
});

test("dt-Schutz, reset(), NaN-Kamera hält den Zustand", () => {
  const { nodes, frame } = aufbau();
  const w = mitZufall(5, () => new IdleWander(nodes, frame));
  w.tick(0); w.tick(5); // → 0,016
  assert.ok(Math.abs(w.clock - 0.032) < 1e-12);
  frame.getCamLocal = () => null;
  w.tick(1 / 60); assert.equal(w.state, "bop");
  nodes.FigureRoot.rotation.y = 0.7;
  w.reset();
  assert.equal(nodes.FigureRoot.rotation.y, 0); assert.equal(w.state, "bop"); assert.equal(w.clock, 0);
  assert.deepEqual(nodes.BodyPivot.scale.toArray(), [1, 1, 1]);
  assert.equal(IDLE.footFraction, 0.62);
});
