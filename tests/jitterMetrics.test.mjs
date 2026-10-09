/* jitterMetrics (js/jitterMetrics.js): Kennzahlen für ?stats aus einem Fenster
   von Tick-Proben. Kern: die 2. Differenz trennt Rauschen von glatter Bewegung. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, METRIC_COLS } from "../js/jitterMetrics.js";

const MM = 63;
const DT = 20; // ms je Probe
const nahe = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const Q1 = [0, 0, 0, 1];

/* Probe mit neuer Messung; roh = stab, Kopfpunkt fest. */
function probe(i, extra = {}) {
  const p = [0, 0, -3];
  return { t: i * DT, n: true, m: false, sp: p.slice(), sq: Q1.slice(), sx: [100, 100],
    rp: p.slice(), rq: Q1.slice(), rx: [100, 100], ga: 0, ms: 0, gw: null, ...extra };
}
const reihe = (n, f = () => ({})) => Array.from({ length: n }, (_, i) => probe(i, f(i)));

test("zu wenig Daten → null", () => {
  assert.equal(computeMetrics(null, MM), null);
  assert.equal(computeMetrics([], MM), null);
  assert.equal(computeMetrics(reihe(2), MM), null);
  assert.equal(computeMetrics([probe(0), probe(0), probe(0)], MM), null); // Dauer 0
});

test("Takt: Vision-Hz, Render-fps, dt-Perzentile", () => {
  const S = reihe(101);
  const m = computeMetrics(S, MM);
  nahe(m.dauer, 2);
  assert.equal(m.proben, 101);
  assert.equal(m.messungen, 101);
  nahe(m.visionHz, 50.5);
  nahe(m.renderFps, 50);
  assert.equal(m.dtP50, DT);
  assert.equal(m.dtP95, DT);
  const halb = computeMetrics(reihe(101, (i) => ({ n: i % 2 === 0 })), MM);
  assert.equal(halb.messungen, 51);
  assert.equal(halb.dtP50, 2 * DT);
});

test("stillstehende Pose ohne Rauschen: alle Rausch-Kennzahlen 0", () => {
  const m = computeMetrics(reihe(50), MM);
  for (const k of ["hfRohMm", "hfStabMm", "hfRohDeg", "hfStabDeg", "kopfHfRohPx", "kopfHfStabPx",
    "versatzPx", "f2fRohMm", "f2fStabMm", "bewegtPct", "wechsel10s"]) nahe(m[k], 0);
});

test("weißes Rauschen (alternierend ±a) auf roh: 2. Differenz = 4a, stab bleibt 0", () => {
  const a = 0.001;
  const S = reihe(60, (i) => ({ rp: [i % 2 ? a : -a, 0, -3], rx: [100 + (i % 2 ? 1 : -1), 100] }));
  const m = computeMetrics(S, MM);
  nahe(m.hfRohMm, (4 * a / Math.sqrt(6)) * MM);
  nahe(m.hfStabMm, 0);
  nahe(m.f2fRohMm, 2 * a * MM);
  nahe(m.f2fStabMm, 0);
  nahe(m.kopfHfRohPx, 4 / Math.sqrt(6));
  nahe(m.kopfHfStabPx, 0);
  nahe(m.versatzPx, 1); // Kopfpunkt roh ↔ stab 1 px auseinander
});

test("glatte Bewegung: fällt aus der 2. Differenz heraus, bleibt in F2F", () => {
  const v = 0.01; // Kartenbreiten je Probe
  const S = reihe(60, (i) => ({ rp: [v * i, 0, -3], sp: [v * i, 0, -3] }));
  const m = computeMetrics(S, MM);
  nahe(m.hfRohMm, 0);
  nahe(m.hfStabMm, 0);
  nahe(m.f2fRohMm, v * MM);
  nahe(m.f2fStabMm, v * MM);
});

test("Rotationsrauschen (alternierend ±a um Z): 4a/√6 in Grad", () => {
  const a = 0.01;
  const q = (w) => [0, 0, Math.sin(w / 2), Math.cos(w / 2)];
  const S = reihe(60, (i) => ({ rq: q(i % 2 ? a : -a) }));
  const m = computeMetrics(S, MM);
  nahe(m.hfRohDeg, (4 * a / Math.sqrt(6)) * 180 / Math.PI, 1e-9);
  nahe(m.hfStabDeg, 0);
});

test("Lücken ≥ 200 ms gelten als Unterbrechung und fließen nicht ein", () => {
  const a = 0.001;
  const S = reihe(60, (i) => ({ rp: [i % 2 ? a : -a, 0, -3] }));
  for (const s of S) if (s.t >= 30 * DT) s.t += 500; // eine Lücke in der Mitte
  const m = computeMetrics(S, MM);
  assert.equal(m.dtP95, DT);
  nahe(m.hfRohMm, (4 * a / Math.sqrt(6)) * MM); // dieselbe Zahl wie ohne Lücke
});

test("Modus: Bewegt-Anteil und Wechsel je 10 s", () => {
  const S = reihe(101, (i) => ({ m: i < 50, ms: i < 50 ? 0 : 4 }));
  const m = computeMetrics(S, MM);
  nahe(m.bewegtPct, 50);
  nahe(m.wechsel10s, 20); // 4 Wechsel in 2 s
});

test("Lauf ohne Bild: Figurbewegung in Ticks ohne neue Messung", () => {
  // jede zweite Probe ohne Messung, dort wandert der Stab-Kopfpunkt um 1 px
  const S = reihe(101, (i) => ({ n: i % 2 === 0, sx: [100 + (i % 2), 100] }));
  const m = computeMetrics(S, MM);
  nahe(m.laufPxS, 50 / 2); // 50 Ticks ohne Messung × 1 px in 2 s
  assert.equal(computeMetrics(reihe(10), MM).laufPxS, null); // nie ohne Messung
});

test("Gyro: Drehrate aus gw, angewendete Deltas je Sekunde", () => {
  const S = reihe(101, (i) => ({ gw: i * 0.9, ga: i }));
  const m = computeMetrics(S, MM);
  nahe(m.gyroDps, 45);
  nahe(m.gyroDeltasS, 50);
  assert.equal(computeMetrics(reihe(10), MM).gyroDps, null);
});

test("METRIC_COLS nennt nur Kennzahlen, die computeMetrics liefert", () => {
  const m = computeMetrics(reihe(10), MM);
  for (const [key, dez] of METRIC_COLS) {
    assert.ok(key in m, key);
    assert.ok(Number.isInteger(dez) && dez >= 0);
  }
});
