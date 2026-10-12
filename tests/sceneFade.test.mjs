/* SceneFade (js/sceneFade.js, Build 99): Szene weich aus-/einblenden statt
   hart schalten. Rampe, Sichtbarkeit des Trägers und Deckkraft der
   Materialien (Basis bleibt erhalten, Module setzen ihre eigene Opacity). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { CHOREO } from "../js/config.js";
import { fadeStep, SceneFade } from "../js/sceneFade.js";

test("fadeStep: Rampe in beide Richtungen, geklemmt, 0 ms = sofort", () => {
  assert.equal(fadeStep(1, false, 150, 300, 300), 0.5);
  assert.equal(fadeStep(0.5, false, 500, 300, 300), 0);
  assert.equal(fadeStep(0, true, 75, 300, 300), 0.25);
  assert.equal(fadeStep(0.9, true, 100, 300, 300), 1);
  assert.equal(fadeStep(1, false, 16, 300, 0), 0);
  assert.equal(fadeStep(0, true, 16, 0, 300), 1);
});

function szene() {
  const root = new THREE.Group();
  const figur = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 }));
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 }));
  root.add(figur, schatten);
  return { root, figur: figur.material, schatten: schatten.material };
}
/* Ein Frame wie in arSession: begin → update → (Ticks) → apply */
function frame(f, want, now, tick) {
  f.begin();
  f.update(want, now);
  tick?.();
  f.apply();
}
/* ms in 50-ms-Frames (unter der Kappung von 100 ms je Frame) */
function lauf(f, want, uhr, ms) {
  for (let i = 0; i < ms / 50; i++) frame(f, want, (uhr.t += 50));
}

test("SceneFade: Einblenden, Ausblenden über lostFadeMs, Träger erst bei 0 unsichtbar", () => {
  const { root, figur, schatten } = szene();
  const f = new SceneFade(root);
  assert.equal(root.visible, false);
  const uhr = { t: 1000 };
  frame(f, true, uhr.t); // erster Frame: dt 0 → noch alpha 0
  lauf(f, true, uhr, CHOREO.foundFadeMs / 2);
  assert.equal(root.visible, true);
  assert.ok(Math.abs(figur.opacity - 0.5) < 1e-9);
  assert.ok(Math.abs(schatten.opacity - 0.25) < 1e-9, "Basis-Deckkraft bleibt Faktor");
  lauf(f, true, uhr, CHOREO.foundFadeMs);
  assert.equal(f.alpha, 1);
  assert.equal(figur.opacity, 1);
  assert.equal(schatten.opacity, 0.5);
  // Verlust: halb ausgeblendet, Träger noch sichtbar
  lauf(f, false, uhr, CHOREO.lostFadeMs / 2);
  assert.equal(root.visible, true);
  assert.ok(Math.abs(figur.opacity - 0.5) < 1e-9);
  lauf(f, false, uhr, CHOREO.lostFadeMs);
  assert.equal(root.visible, false);
  assert.equal(figur.opacity, 1, "Basis zurück");
  assert.equal(schatten.opacity, 0.5);
});

test("SceneFade: Module, die ihre Opacity selbst setzen, sehen ihren Wert, nicht den gefadeten", () => {
  const { root, figur } = szene();
  const f = new SceneFade(root);
  const uhr = { t: 1000 };
  frame(f, true, uhr.t);
  lauf(f, true, uhr, 1000); // voll da
  lauf(f, false, uhr, CHOREO.lostFadeMs / 2 - 50);
  let gesehen = null;
  frame(f, false, (uhr.t += 50), () => { gesehen = figur.opacity; figur.opacity = 0.8; });
  assert.equal(gesehen, 1);
  assert.ok(Math.abs(figur.opacity - 0.4) < 1e-9);
  frame(f, false, (uhr.t += 10), () => { gesehen = figur.opacity; });
  assert.equal(gesehen, 0.8);
});

test("SceneFade: Uhr-Sprung (Tab im Hintergrund) wird gekappt", () => {
  const { root } = szene();
  const f = new SceneFade(root);
  frame(f, true, 1000);
  frame(f, true, 1000 + 60000);
  assert.ok(f.alpha < 1 && f.alpha > 0);
});
