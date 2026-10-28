/* Animationen ohne DOM: FigureJump, FaceAnimator, ActivationAnim —
   Characterization Tests (Stand Build 110) mit festem Zufall und Attrappen.
   Snapshots: tests/fixtures/animationen.*.json (s. tests/snapshot.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { FigureJump } from "../js/figureJump.js";
import { FaceAnimator } from "../js/faceAnimator.js";
import { ActivationAnim } from "../js/activationAnim.js";
import { pruefeSnapshot, mitZufall } from "./snapshot.mjs";

const DT = 1 / 60;

test("FigureJump: Parabel zur Kartenmitte, Busy/holdFace-Folge, kein Neustart während des Sprungs", () => {
  const FigureRoot = new THREE.Group();
  FigureRoot.position.set(0.02, 0.0312, -0.03);
  const nodes = { FigureRoot, FIGURE_HOME: { pos: new THREE.Vector3(0, 0.0312, 0) } };
  const rufe = [];
  const wander = { setBusy: (v) => rufe.push("busy:" + v), walkTarget: { x: 1 } };
  const face = { holdFace: null, talking: false, blinkActive: false, showFace: (s) => rufe.push("face:" + s) };
  const j = new FigureJump({ nodes, wander, face });
  j.tick(DT); // inaktiv: nichts
  assert.deepEqual(FigureRoot.position.toArray(), [0.02, 0.0312, -0.03]);
  j.start();
  assert.equal(face.holdFace, "talk");
  assert.equal(wander.walkTarget, null);
  j.start(); // läuft schon → ignoriert
  const bahn = [];
  for (let i = 0; i < 30; i++) { j.tick(DT); bahn.push([...FigureRoot.position.toArray(), j.active ? 1 : 0]); }
  pruefeSnapshot("animationen.figureJump", bahn);
  assert.deepEqual(FigureRoot.position.toArray(), [0, 0.0312, 0]);
  assert.equal(face.holdFace, null);
  assert.deepEqual(rufe, ["busy:true", "busy:false", "face:neutral"]);
  // Ende bei Blinzeln: Gesicht blink; beim Sprechen: kein showFace
  face.blinkActive = true; j.start(); for (let i = 0; i < 30; i++) j.tick(DT);
  assert.equal(rufe[rufe.length - 1], "face:blink");
  face.talking = true; rufe.length = 0; j.start(); for (let i = 0; i < 30; i++) j.tick(DT);
  assert.deepEqual(rufe, ["busy:true", "busy:false"]);
});

test("FaceAnimator: Blinzeln + Mund auf/zu über 6 s, holdFace hat Vorrang", () => {
  const nodes = { FaceNeutral: { visible: false }, FaceBlink: { visible: false }, FaceTalk: { visible: false } };
  const gesicht = () => (nodes.FaceTalk.visible ? "T" : nodes.FaceBlink.visible ? "B" : nodes.FaceNeutral.visible ? "N" : "-");
  const folge = mitZufall(7, () => {
    const f = new FaceAnimator(nodes);
    const out = [];
    for (let i = 0; i < 360; i++) {
      if (i === 120) f.setTalking(true);
      if (i === 240) f.setTalking(false);
      if (i === 300) f.holdFace = "talk";
      if (i === 330) f.holdFace = null;
      f.tick(DT);
      out.push(gesicht());
    }
    return out.join("");
  });
  pruefeSnapshot("animationen.faceAnimator", folge);
  assert.ok(folge.includes("B") && folge.includes("T"));
  assert.equal(folge.slice(300, 330), "T".repeat(30));
});

test("ActivationAnim: prime → play (Ease-Out-Back + 2 Spins) → playOut (Ease-In), cancel stellt die Scale zurück", () => {
  const FigureRoot = new THREE.Group();
  FigureRoot.scale.setScalar(0.0638);
  FigureRoot.rotation.y = 0.3;
  const a = new ActivationAnim({ FigureRoot });
  let fertig = 0;
  a.prime();
  assert.deepEqual(FigureRoot.scale.toArray(), [0, 0, 0]);
  a.play(() => fertig++);
  const kurve = [];
  for (let i = 0; i < 100; i++) { a.tick(DT); if (i % 4 === 0) kurve.push([FigureRoot.scale.x, FigureRoot.rotation.y, a.playing ? 1 : 0]); }
  assert.equal(fertig, 1);
  assert.ok(Math.abs(FigureRoot.scale.x - 0.0638) < 1e-12 && Math.abs(FigureRoot.rotation.y - 0.3) < 1e-12);
  a.playOut(() => fertig++, 0.5);
  for (let i = 0; i < 40; i++) { a.tick(DT); if (i % 4 === 0) kurve.push([FigureRoot.scale.x, FigureRoot.rotation.y, a.playing ? 1 : 0]); }
  assert.equal(fertig, 2);
  assert.deepEqual(FigureRoot.scale.toArray(), [0, 0, 0]);
  pruefeSnapshot("animationen.activationAnim", kurve);
  // cancel mitten im Pop-In: Scale zurück, kein Rückruf
  a.play(() => fertig++); a.tick(DT); a.cancel();
  assert.equal(fertig, 2);
  assert.ok(Math.abs(FigureRoot.scale.x - 0.0638) < 1e-12);
  assert.equal(a.playing, false);
  // playOut mit Dauer 0 → Mindestdauer 0,05 s
  a.playOut(null, 0); assert.equal(a.outSec, 0.05);
});

test("ActivationAnim: play() mitten im playOut bricht das Einklappen ab — Figur ploppt wieder auf (Build 112)", () => {
  const FigureRoot = new THREE.Group();
  FigureRoot.scale.setScalar(0.0638);
  const a = new ActivationAnim({ FigureRoot });
  const rufe = [];
  a.playOut(() => rufe.push("playOut"), 0.5);
  for (let i = 0; i < 6; i++) a.tick(DT); // ~100 ms eingeklappt
  a.play(() => rufe.push("play")); // Wiedereinstieg per Tap
  for (let i = 0; i < 120; i++) a.tick(DT);
  assert.deepEqual(rufe, ["play"]);
  assert.ok(Math.abs(FigureRoot.scale.x - 0.0638) < 1e-12, "volle Größe statt Scale 0");
  assert.equal(a.collapsing, false);
});
