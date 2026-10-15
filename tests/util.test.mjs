/* js/util.js — Grenzfälle der kleinen Helfer (Stand Build 110). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAngle, finiteVec, finiteQuat, progress, rand } from "../js/util.js";

test("normalizeAngle faltet auf [−π, π] (beide Ränder bleiben stehen)", () => {
  assert.equal(normalizeAngle(0), 0);
  assert.equal(normalizeAngle(Math.PI), Math.PI);
  assert.equal(normalizeAngle(-Math.PI), -Math.PI);
  assert.ok(Math.abs(normalizeAngle(3 * Math.PI) - Math.PI) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(-3 * Math.PI) + Math.PI) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(2 * Math.PI + 0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(-2 * Math.PI - 0.5) + 0.5) < 1e-12);
});
test("progress: Mindestdauer 50 ms, gekappt bei 1", () => {
  assert.equal(progress(0.025, 0), 0.5);
  assert.equal(progress(1, 0), 1);
  assert.equal(progress(0.2, 0.4), 0.5);
  assert.equal(progress(-0.1, 0.4), -0.25);
});
test("finiteVec / finiteQuat", () => {
  assert.equal(finiteVec({ x: 0, y: 1, z: -2 }), true);
  assert.equal(finiteVec({ x: NaN, y: 1, z: 2 }), false);
  assert.equal(finiteVec({ x: 0, y: Infinity, z: 2 }), false);
  assert.equal(finiteQuat({ x: 0, y: 0, z: 0, w: 1 }), true);
  assert.equal(finiteQuat({ x: 0, y: 0, z: 0, w: -Infinity }), false);
});
test("rand liegt in [a, b)", () => {
  const alt = Math.random;
  try {
    Math.random = () => 0; assert.equal(rand(2, 5), 2);
    Math.random = () => 0.999; assert.ok(rand(2, 5) < 5);
  } finally { Math.random = alt; }
});
