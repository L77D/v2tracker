/* config.js: Schalter sind Booleans (seit Build 89); alte Presets mit
   "ja"/"nein" werden beim Einspielen übersetzt (applyTuning / uebersetzeSchalter). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL, STAB, GYRO, SOUND, TYPO, CHOREO, ACTFX, applyTuning, uebersetzeSchalter } from "../js/config.js";

test("kein Schalter in config.js ist noch ein String „ja“/„nein“", () => {
  for (const [name, obj] of Object.entries(ALL)) {
    for (const [k, v] of Object.entries(obj)) assert.ok(v !== "ja" && v !== "nein", name + "." + k);
  }
  for (const k of ["enabled", "normalize", "deadZones", "lostHold", "nanGuard", "snap", "scaleLock", "gravityArbiter", "extrapolate"]) {
    assert.equal(typeof STAB[k], "boolean", "STAB." + k);
  }
  assert.equal(typeof GYRO.enabled, "boolean");
  assert.equal(typeof SOUND.enabled, "boolean");
  assert.equal(typeof SOUND.typeTicks, "boolean");
  assert.equal(typeof TYPO.pageLabel, "boolean");
  assert.equal(typeof CHOREO.requireTap, "boolean");
  assert.equal(typeof ACTFX.hopper, "boolean");
});

test("uebersetzeSchalter: nur „ja“/„nein“ werden übersetzt, alles andere bleibt", () => {
  assert.deepEqual(uebersetzeSchalter({ a: "ja", b: "nein", c: "aus", d: 3, e: "#fff", f: true, g: null }),
    { a: true, b: false, c: "aus", d: 3, e: "#fff", f: true, g: null });
});

test("applyTuning: altes Preset (Strings) und neues Preset (Booleans) laden gleich", () => {
  const alt = { STAB: { ...STAB }, GYRO: { ...GYRO }, SOUND: { ...SOUND } };
  try {
    assert.equal(applyTuning({ STAB: { enabled: "nein", snap: "nein", minCutoff: 0.2 }, GYRO: { enabled: "nein" }, SOUND: { speech: "aus" } }), true);
    assert.equal(STAB.enabled, false);
    assert.equal(STAB.snap, false);
    assert.equal(STAB.minCutoff, 0.2);
    assert.equal(STAB.normalize, true); // unberührt
    assert.equal(GYRO.enabled, false);
    assert.equal(SOUND.speech, "aus");
    applyTuning({ STAB: { enabled: true, snap: true }, GYRO: { enabled: true } });
    assert.equal(STAB.enabled, true);
    assert.equal(GYRO.enabled, true);
    // Unbekannte Blöcke und Unsinn: kein Fehler, nichts verändert
    assert.equal(applyTuning({ GIBTSNICHT: { x: 1 }, STAB: "kaputt" }), true);
    assert.equal(applyTuning(null), false);
    assert.equal(applyTuning("x"), false);
    assert.equal(STAB.enabled, true);
  } finally {
    Object.assign(STAB, alt.STAB); Object.assign(GYRO, alt.GYRO); Object.assign(SOUND, alt.SOUND);
  }
});
