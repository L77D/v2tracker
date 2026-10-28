/* GyroFusion (js/gyroFusion.js): Euler → Quaternion, 250-ms-Frische, Screen-
   Orientation, enable() ohne/mit Bewegungsabfrage — Characterization Test
   (Stand Build 110; getDelta seit Build 113 raus) mit Attrappen für
   screen/window und gefälschter Uhr. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeSnapshot } from "./snapshot.mjs";

globalThis.screen = { orientation: { angle: 0 } };
globalThis.window = { addEventListener() {} };
const { GyroFusion } = await import("../js/gyroFusion.js");

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

test("Lage: stale nach 250 ms ohne Event, null ohne enable", () => {
  const { g, uhr, ende } = aufbau();
  try {
    g.handle({ alpha: 20.3, beta: 0, gamma: 0 });
    assert.ok(g.getOrientation());
    uhr.t += 251;
    assert.equal(g.getOrientation(), null);
    g.handle({ alpha: 20.3, beta: 0, gamma: 0 });
    assert.ok(g.getOrientation());
    g.enabled = false;
    assert.equal(g.getOrientation(), null);
  } finally { ende(); }
});

test("enable(): ohne `fragen` keine requestPermission (Build 113), mit `fragen` wie früher; Ablehnung → enabled false", async () => {
  const aufrufe = { permission: 0, listener: 0 };
  globalThis.DeviceOrientationEvent = function () {};
  DeviceOrientationEvent.requestPermission = async () => { aufrufe.permission++; return aufrufe.permission === 1 ? "granted" : "denied"; };
  const altAdd = window.addEventListener;
  window.addEventListener = (typ) => { if (typ === "deviceorientation") aufrufe.listener++; };
  try {
    const g = new GyroFusion();
    assert.equal(await g.enable(), true);
    assert.deepEqual(aufrufe, { permission: 0, listener: 1 }, "Standard: Listener ohne Abfrage");
    assert.equal(g.enabled, true);
    const g2 = new GyroFusion();
    assert.equal(await g2.enable({ fragen: true }), true);
    assert.deepEqual(aufrufe, { permission: 1, listener: 2 });
    const g3 = new GyroFusion();
    assert.equal(await g3.enable({ fragen: true }), false, "abgelehnt");
    assert.equal(g3.enabled, false);
    assert.deepEqual(aufrufe, { permission: 2, listener: 2 });
  } finally { window.addEventListener = altAdd; delete globalThis.DeviceOrientationEvent; }
});
