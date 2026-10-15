/* GyroFusion (js/gyroFusion.js): Euler → Quaternion, Sammel-Schwelle, Glitch-
   Grenze, 250-ms-Frische, Screen-Orientation — Characterization Test (Stand
   Build 110) mit Attrappen für screen/window und gefälschter Uhr. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeSnapshot } from "./snapshot.mjs";

globalThis.screen = { orientation: { angle: 0 } };
globalThis.window = { addEventListener() {} };
const { GyroFusion } = await import("../js/gyroFusion.js");
const { GYRO } = await import("../js/config.js");

function aufbau() {
  const uhr = { t: 1000 };
  const alt = performance.now;
  performance.now = () => uhr.t;
  const g = new GyroFusion();
  g.enabled = true;
  return { g, uhr, ende: () => { performance.now = alt; } };
}
const q4 = (q) => [q.x, q.y, q.z, q.w];

test("ohne enable/Events: null; unvollständige Events werden ignoriert", () => {
  const { g, ende } = aufbau();
  try {
    assert.equal(g.getDelta(), null);
    assert.equal(g.getOrientation(), null);
    g.handle({ alpha: null, beta: 1, gamma: 2 });
    assert.equal(g.active, false);
  } finally { ende(); }
});

test("Orientierung aus alpha/beta/gamma, auch im Querformat (Snapshot)", () => {
  const { g, ende } = aufbau();
  try {
    const out = {};
    for (const [a, b, c] of [[0, 0, 0], [10, 20, 30], [90, 45, -30], [180, 90, 0], [270, -45, 60]]) {
      g.handle({ alpha: a, beta: b, gamma: c });
      out[`${a}_${b}_${c}`] = q4(g.getOrientation());
    }
    screen.orientation.angle = 90;
    g.handle({ alpha: 10, beta: 20, gamma: 30 });
    out.quer90_10_20_30 = q4(g.getOrientation());
    screen.orientation = undefined; window.orientation = -90;
    g.handle({ alpha: 10, beta: 20, gamma: 30 });
    out.windowOrientation_minus90 = q4(g.getOrientation());
    screen.orientation = { angle: 0 }; delete window.orientation;
    pruefeSnapshot("gyroFusion.orientierung", out);
  } finally { ende(); }
});

test("getDelta: erster Aufruf null, kleine Deltas sammeln sich, Glitch > deltaMax verwirft und setzt neu, stale nach 250 ms", () => {
  const { g, uhr, ende } = aufbau();
  try {
    g.handle({ alpha: 0, beta: 0, gamma: 0 });
    assert.equal(g.getDelta(), null, "erster Aufruf setzt nur die Referenz");
    // 0,05° je Schritt < deltaDeadZone (0,0012 rad ≈ 0,069°): sammeln
    g.handle({ alpha: 0.05, beta: 0, gamma: 0 }); assert.equal(g.getDelta(), null);
    g.handle({ alpha: 0.10, beta: 0, gamma: 0 });
    const d = g.getDelta();
    assert.ok(d, "Summe 0,10° > Schwelle → Delta");
    const ang = 2 * Math.acos(Math.min(1, Math.abs(d.w)));
    assert.ok(Math.abs(ang - 0.10 * Math.PI / 180) < 1e-9, String(ang));
    assert.ok(ang >= GYRO.deltaDeadZone);
    // Glitch: 20° auf einmal > deltaMax 0,2 rad → null, Referenz rückt vor
    g.handle({ alpha: 20.1, beta: 0, gamma: 0 }); assert.equal(g.getDelta(), null);
    g.handle({ alpha: 20.3, beta: 0, gamma: 0 }); assert.ok(g.getDelta(), "nach dem Glitch wieder relativ zur neuen Referenz");
    // stale: > 250 ms ohne Event
    uhr.t += 251;
    assert.equal(g.getDelta(), null);
    assert.equal(g.hasPrev, false);
    assert.equal(g.getOrientation(), null);
    g.handle({ alpha: 20.3, beta: 0, gamma: 0 });
    assert.equal(g.getDelta(), null, "nach stale wieder erst die Referenz");
    assert.ok(g.getOrientation());
    g.enabled = false;
    assert.equal(g.getDelta(), null); assert.equal(g.getOrientation(), null);
  } finally { ende(); }
});
