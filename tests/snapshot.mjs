/* Testhelfer: Snapshot-Vergleich gegen tests/fixtures/<name>.json
   (Characterization Tests, Refactoring 2026-10-15). Der Snapshot ist das
   festgehaltene Verhalten von Build 110 — weicht ein Lauf ab, hat sich
   Verhalten geändert. Neu schreiben NUR bei gewollter Änderung:
     SNAPSHOT_SCHREIBEN=1 node --test 'tests/*.test.mjs'
   Zahlen werden vor dem Vergleich auf 10 signifikante Stellen gerundet. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ROOT } from "./karte.mjs";

const DIR = path.join(ROOT, "tests", "fixtures");

export function runde(v) {
  if (typeof v === "number") return Number.isFinite(v) ? +v.toPrecision(10) : String(v);
  if (Array.isArray(v)) return v.map(runde);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, runde(x)]));
  return v;
}

export function pruefeSnapshot(name, wert) {
  const datei = path.join(DIR, name + ".json");
  const ist = runde(wert);
  if (process.env.SNAPSHOT_SCHREIBEN) {
    fs.writeFileSync(datei, JSON.stringify(ist, null, 1) + "\n");
    return;
  }
  assert.ok(fs.existsSync(datei), "Snapshot fehlt: " + datei + " (SNAPSHOT_SCHREIBEN=1 erzeugt ihn)");
  const soll = JSON.parse(fs.readFileSync(datei, "utf8"));
  assert.deepEqual(ist, soll, "Snapshot „" + name + "“ weicht ab");
}

/* Linearer Kongruenzgenerator als Ersatz für Math.random (gleiche Zahlen je Lauf). */
export function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function mitZufall(seed, fn) {
  const alt = Math.random;
  Math.random = lcg(seed);
  try { return fn(); } finally { Math.random = alt; }
}
