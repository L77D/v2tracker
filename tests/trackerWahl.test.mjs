/* trackerWahl (js/trackerWahl.js): Auswahl der Tracker-Variante per URL oder
   config, Rückfall auf den Standard, Bauweg nach dem Vertrag. Seit Build 111
   gibt es nur noch 8lerp; alt/neu/8roh (archiv/tracker-varianten/) fallen wie
   jeder unbekannte Name mit Warnung auf den Standard zurück. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { TRACKER_VARIANTEN, TRACKER_STANDARD, waehleTracker, baueTracker } from "../js/trackerWahl.js";
import { Tracker8lerp } from "../js/tracker8lerp.js";
import { STAB } from "../js/config.js";

const params = (q) => new URLSearchParams(q);

test("Standard ist 8lerp (seit 2026-10-15); config und URL wählen, URL hat Vorrang", () => {
  assert.equal(TRACKER_STANDARD, "8lerp");
  assert.equal(STAB.tracker, "8lerp");
  assert.deepEqual(Object.keys(TRACKER_VARIANTEN), ["8lerp"]);
  assert.equal(waehleTracker(params("")).Klasse, Tracker8lerp);
  assert.equal(waehleTracker(params("?tracker=8lerp")).Klasse, Tracker8lerp);
  assert.equal(waehleTracker(params(""), { tracker: "8lerp" }).name, "8lerp");
  assert.equal(waehleTracker(null).name, "8lerp");
  for (const w of [waehleTracker(params("")), waehleTracker(params("?tracker=8lerp"))]) assert.equal(w.warnung, null);
});

test("unbekannter Name (auch die archivierten alt/neu/8roh): Standard mit Warnung, Sitzung läuft", () => {
  for (const n of ["gibtsnicht", "alt", "neu", "8roh"]) {
    const w = waehleTracker(params("?tracker=" + n));
    assert.equal(w.name, "8lerp");
    assert.equal(w.Klasse, Tracker8lerp);
    assert.match(w.warnung, new RegExp(n));
    assert.match(w.warnung, /bekannt: 8lerp/);
  }
  assert.equal(waehleTracker(params(""), { tracker: "alt" }).name, "8lerp");
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
  // Bauweg für lesende Klassen (Vertrag bleibt, auch ohne Variante im Code)
  class Lesend { constructor(s, t, g) { this.source = s; this.target = t; this.gyro = g; } }
  const l = baueTracker(Lesend, source, target, "g");
  assert.equal(l.source, source); assert.equal(l.gyro, "g");
});
