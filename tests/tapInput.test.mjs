/* TapInput (js/tapInput.js): Entprellung, Tap ≠ Drag, click-Fallback, NDC-
   Strahl — Characterization Test (Stand Build 110). Seit Build 112 prüft auch
   der native click-Fallback tapMaxPx/tapMaxMs (bis Build 111 nur die
   Entprellung — ein click nach einem Drag löste einen Tap aus). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { TapInput } from "../js/tapInput.js";
import { CHOREO } from "../js/config.js";
import { pruefeSnapshot } from "./snapshot.mjs";

function aufbau() {
  const handler = {};
  const el = { addEventListener: (t, fn) => { handler[t] = fn; }, getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 800 }) };
  const camera = new THREE.PerspectiveCamera(60, 0.5, 0.01, 100);
  camera.updateMatrixWorld();
  const taps = [];
  const uhr = { t: 1000 };
  const alt = performance.now;
  performance.now = () => uhr.t;
  const ti = new TapInput(el, camera, (ray) => taps.push([...ray.ray.origin.toArray(), ...ray.ray.direction.toArray()]));
  return { h: handler, taps, uhr, ti, ende: () => { performance.now = alt; } };
}

test("Listener: pointerdown, pointerup, click", () => {
  const t = aufbau();
  try { assert.deepEqual(Object.keys(t.h).sort(), ["click", "pointerdown", "pointerup"]); } finally { t.ende(); }
});

test("pointerdown/up ohne Weg = 1 Tap; click binnen 120 ms wird entprellt, danach zählt er", () => {
  const t = aufbau();
  try {
    t.h.pointerdown({ clientX: 210, clientY: 420 });
    t.uhr.t += 100;
    t.h.pointerup({ clientX: 210, clientY: 420 });
    assert.equal(t.taps.length, 1);
    t.uhr.t += CHOREO.tapDebounceMs - 1; t.h.click({ clientX: 210, clientY: 420 });
    assert.equal(t.taps.length, 1, "click binnen Entprellzeit fällt weg");
    t.uhr.t += 2; t.h.click({ clientX: 210, clientY: 420 });
    assert.equal(t.taps.length, 2, "click nach der Entprellzeit zählt");
  } finally { t.ende(); }
});

test("Drag (Weg > tapMaxPx) und langes Halten (> tapMaxMs) lösen über pointerup keinen Tap aus", () => {
  const t = aufbau();
  try {
    t.h.pointerdown({ clientX: 100, clientY: 100 });
    t.h.pointerup({ clientX: 100 + CHOREO.tapMaxPx + 1, clientY: 100 });
    assert.equal(t.taps.length, 0);
    t.h.pointerdown({ clientX: 100, clientY: 100 });
    t.h.pointerup({ clientX: 100 + CHOREO.tapMaxPx, clientY: 100 });
    assert.equal(t.taps.length, 1, "genau tapMaxPx ist noch ein Tap");
    t.uhr.t += 1000;
    t.h.pointerdown({ clientX: 100, clientY: 100 });
    t.uhr.t += CHOREO.tapMaxMs + 1;
    t.h.pointerup({ clientX: 100, clientY: 100 });
    assert.equal(t.taps.length, 1, "zu lang gehalten");
  } finally { t.ende(); }
});

test("click-Fallback prüft Weg und Dauer wie pointerup (Build 112); nach pointercancel zählt ein kurzer click", () => {
  const t = aufbau();
  try {
    t.h.pointerdown({ clientX: 100, clientY: 100 });
    t.h.pointerup({ clientX: 300, clientY: 300 }); // Drag → kein Tap
    t.h.click({ clientX: 300, clientY: 300 });      // … auch nicht über click
    assert.equal(t.taps.length, 0, "click nach Drag");
    t.uhr.t += 1000;
    t.h.pointerdown({ clientX: 100, clientY: 100 });
    t.uhr.t += CHOREO.tapMaxMs + 1;
    t.h.click({ clientX: 100, clientY: 100 });
    assert.equal(t.taps.length, 0, "click nach langem Halten");
    t.uhr.t += 1000;
    t.h.pointerdown({ clientX: 100, clientY: 100 }); // iOS: pointercancel, kein pointerup
    t.uhr.t += 80;
    t.h.click({ clientX: 102, clientY: 101 });
    assert.equal(t.taps.length, 1, "kurzer click ohne pointerup");
  } finally { t.ende(); }
});

test("Strahl aus NDC (Canvas-Rechteck mit Versatz 10/20, 400×800)", () => {
  const t = aufbau();
  try {
    for (const [x, y] of [[10, 20], [210, 420], [410, 820], [10, 820]]) { t.uhr.t += 500; t.ti.tap(x, y); }
    pruefeSnapshot("tapInput.strahlen", t.taps);
    assert.ok(Math.abs(t.taps[1][3]) < 1e-9 && Math.abs(t.taps[1][4]) < 1e-9 && t.taps[1][5] < 0, "Mitte → geradeaus −Z");
  } finally { t.ende(); }
});
