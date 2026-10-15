/* Tracker 8lerp (js/tracker8lerp.js, Standard seit Build 110): Goldstandard
   über das Szenario tests/stabilizerSzenario.mjs — jede Variante von KONFIGS,
   dazu τ fest auf 50 ms (STAB.lerpPosMs/lerpRotMs), damit späteres Tuning in
   config.js den Stand nicht bricht. Erzeugt am 2026-10-15 mit dem Stand
   Build 110 (vor dem Refactoring). Toleranz 1e-9 relativ.

   Neu erzeugen (nur bei GEWOLLTER Verhaltensänderung, mit dem Stand davor):
     SNAPSHOT_SCHREIBEN=1 node --test tests/tracker8lerp.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Tracker8lerp } from "../js/tracker8lerp.js";
import { laufSzenario, KONFIGS } from "./stabilizerSzenario.mjs";
import { ROOT } from "./karte.mjs";

const DATEI = path.join(ROOT, "tests/fixtures/tracker8lerp.golden.json");
const EPS = 1e-9;
const konfig8lerp = (k) => ({ ...k, STAB: { lerpPosMs: 50, lerpRotMs: 50, ...(k.STAB ?? {}) } });
const VARIANTEN = { ...KONFIGS, ohneLerp: { STAB: { lerpPosMs: 0, lerpRotMs: 0 } } };

if (process.env.SNAPSHOT_SCHREIBEN) {
  const konfigs = {};
  for (const [name, k] of Object.entries(VARIANTEN)) konfigs[name] = laufSzenario(Tracker8lerp, konfig8lerp(k), { jederTick: name === "standard" ? 1 : 20 });
  fs.writeFileSync(DATEI, JSON.stringify({ erzeugt: "2026-10-15, js/tracker8lerp.js Stand Build 110, Szenario tests/stabilizerSzenario.mjs", konfigs }) + "\n");
}
const golden = JSON.parse(fs.readFileSync(DATEI, "utf8"));

test("8lerp-Goldstandard deckt alle Varianten ab", () => {
  assert.deepEqual(Object.keys(golden.konfigs).sort(), Object.keys(VARIANTEN).sort());
});

for (const [name, k] of Object.entries(VARIANTEN)) {
  test("8lerp-Szenario „" + name + "“ ist bitidentisch zu Build 110", () => {
    const soll = golden.konfigs[name];
    const ist = laufSzenario(Tracker8lerp, konfig8lerp(k), { jederTick: name === "standard" ? 1 : 20 });
    assert.deepEqual(ist.zaehler, soll.zaehler, "Zähler");
    assert.equal(ist.ticks.length, soll.ticks.length, "Zahl der Proben");
    for (let i = 0; i < soll.ticks.length; i++) {
      const a = ist.ticks[i], b = soll.ticks[i];
      assert.equal(a[0], b[0]);
      assert.equal(a[1], b[1], "sichtbar bei Tick " + b[0]);
      for (let j = 2; j < b.length; j++) {
        assert.ok(Math.abs(a[j] - b[j]) <= EPS * Math.max(1, Math.abs(b[j])), `Tick ${b[0]}, Wert ${j}: ${a[j]} ≠ ${b[j]}`);
      }
    }
  });
}

test("8lerp-Szenario: Zähler wie erwartet (kein Snap/Re-Lock/Modus, NaN gezählt, Schiedsrichter kippt)", () => {
  const z = golden.konfigs.standard.zaehler;
  assert.equal(z.snap + z.relock + z.reloc + z.modeSwitches + z.gyroApplied, 0, JSON.stringify(z));
  assert.ok(z.nan >= 1 && z.flip >= 1, JSON.stringify(z));
});
