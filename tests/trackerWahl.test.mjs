/* trackerWahl (js/trackerWahl.js): Auswahl der Tracker-Variante per URL oder
   config, Rückfall auf den Standard, Bauweg nach dem Vertrag. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { TRACKER_VARIANTEN, TRACKER_STANDARD, waehleTracker, baueTracker } from "../js/trackerWahl.js";
import { PoseStabilizer } from "../js/poseStabilizer.js";
import { Tracker } from "../js/tracker.js";
import { STAB } from "../js/config.js";

const params = (q) => new URLSearchParams(q);

test("Standard ist der alte Filter; config und URL wählen, URL hat Vorrang", () => {
  assert.equal(TRACKER_STANDARD, "alt");
  assert.equal(STAB.tracker, "alt");
  assert.equal(waehleTracker(params("")).Klasse, PoseStabilizer);
  assert.equal(waehleTracker(params("?tracker=neu")).Klasse, Tracker);
  assert.equal(waehleTracker(params(""), { tracker: "neu" }).Klasse, Tracker);
  assert.equal(waehleTracker(params("?tracker=alt"), { tracker: "neu" }).Klasse, PoseStabilizer);
  assert.equal(waehleTracker(null).name, "alt");
  for (const w of [waehleTracker(params("")), waehleTracker(params("?tracker=neu"))]) assert.equal(w.warnung, null);
});

test("unbekannter Name: Standard mit Warnung, Sitzung läuft", () => {
  const w = waehleTracker(params("?tracker=gibtsnicht"));
  assert.equal(w.name, "alt");
  assert.equal(w.Klasse, PoseStabilizer);
  assert.match(w.warnung, /gibtsnicht/);
  assert.match(w.warnung, /alt, neu/);
});

test("jede Variante erfüllt den Vertrag und wird passend gebaut", () => {
  const source = new THREE.Group(), target = new THREE.Group();
  for (const [name, { Klasse, beschreibung }] of Object.entries(TRACKER_VARIANTEN)) {
    assert.ok(beschreibung.length > 0, name);
    const t = baueTracker(Klasse, source, target, null);
    for (const m of ["onFound", "onLost", "reacquire", "tick", "snapshot"]) assert.equal(typeof t[m], "function", name + "." + m);
    assert.equal(t.target, target, name + ": target");
    if (Klasse.prototype.measure) assert.equal(t.gyro, null); else assert.equal(t.source, source);
    const s = t.snapshot();
    for (const k of ["tracking", "visible", "moving", "newMeas", "rawPos", "rawQuat", "snapCount", "flipCount", "nanCount", "arb"]) assert.ok(k in s, name + ": snapshot." + k);
  }
});
