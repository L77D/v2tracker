/* Tracker (js/tracker.js, ?tracker=neu): messgetriebener Nachfolger des
   PoseStabilizers. Teil 1: dasselbe Szenario wie der Goldstandard durch BEIDE
   Tracker — Kennzahlen nebeneinander (Diagnose) und die Eigenschaften, die der
   neue per Konstruktion haben muss. Teil 2: Einzelprüfungen mit gefälschter Uhr. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { Tracker } from "../js/tracker.js";
import { Tracker8roh } from "../js/tracker8roh.js";
import { Tracker8lerp } from "../js/tracker8lerp.js";
import { PoseStabilizer } from "../js/poseStabilizer.js";
import { STAB, GYRO } from "../js/config.js";
import { laufSzenario, STAB_FEST, GYRO_FEST, DT_MS } from "./stabilizerSzenario.mjs";
import { baueTracker } from "../js/trackerWahl.js";

/* ---- Vergleichsszenario alt vs. neu mit bekannter Wahrheit ----------------
   Realistisches Rauschen (0,2 mm, 0,1°; CLAUDE.md: roh in der Hand 0,13–0,4 mm),
   Messung jeden 3. Tick bei 60 Hz, Scale 0.059 m je Kartenbreite:
     30–209   Ruhe an A           210–389  Bewegung 0,03 m/s + 10°/s
     390–569  Ruhe an B           570      EINE ferne Messung (+8 cm, +40°)
     573–659  Ruhe an B           660–719  Verlust, Gyro lebt (Lage ja, Delta nein)
     720–779  Ruhe an B           780–839  Verlust, Gyro tot
     840–899  Ruhe an B (neu aufsetzen) */
const DEG = Math.PI / 180;
const SCALE = 0.059;
function vergleich(Klasse) {
  const alt = { STAB: { ...STAB }, GYRO: { ...GYRO }, now: performance.now };
  Object.assign(STAB, STAB_FEST); Object.assign(GYRO, GYRO_FEST);
  const uhr = { t: 0 }; performance.now = () => uhr.t;
  try {
    let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rausch = (sig) => (rnd() + rnd() + rnd() - 1.5) * sig * 2;
    const gy = { lage: null };
    const gyro = { getDelta: () => null, getOrientation: () => gy.lage };
    const source = new THREE.Group(); source.matrixAutoUpdate = false;
    const target = new THREE.Group();
    const tr = baueTracker(Klasse, source, target, gyro);
    const A = new THREE.Vector3(0.01, -0.02, -0.30), qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.1, 0.05));
    const Y = new THREE.Vector3(0, 1, 0);
    const wahr = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(SCALE, SCALE, SCALE), nq = new THREE.Quaternion();
    const out = []; // je Tick: { sichtbar, p, q, wahrP, wahrQ, moving }
    const op = new THREE.Vector3(), oq = new THREE.Quaternion(), os = new THREE.Vector3();
    for (let i = 0; i < 900; i++) {
      uhr.t = i * DT_MS;
      if (i === 30 || i === 720 || i === 840) tr.onFound();
      if (i === 660 || i === 780) tr.onLost();
      gy.lage = (i >= 660 && i < 720) ? new THREE.Quaternion() : null;
      // Wahrheit
      if (i < 210) { wahr.p.copy(A); wahr.q.copy(qA); }
      else if (i < 390) { const tt = (i - 210) * DT_MS / 1000; wahr.p.copy(A).add(new THREE.Vector3(0.03 * tt, 0, 0)); wahr.q.copy(qA).multiply(new THREE.Quaternion().setFromAxisAngle(Y, 10 * DEG * tt)); }
      else { wahr.p.copy(A).add(new THREE.Vector3(0.09, 0, 0)); wahr.q.copy(qA).multiply(new THREE.Quaternion().setFromAxisAngle(Y, 30 * DEG)); }
      // Messung
      const getrackt = (i >= 30 && i < 660) || (i >= 720 && i < 780) || i >= 840;
      let neu = false;
      if (getrackt && i % 3 === 0) {
        p.copy(wahr.p).add(new THREE.Vector3(rausch(0.0002), rausch(0.0002), rausch(0.0002)));
        nq.setFromEuler(new THREE.Euler(rausch(0.1 * DEG), rausch(0.1 * DEG), rausch(0.1 * DEG)));
        q.copy(wahr.q).multiply(nq);
        if (i === 570) { p.x += 0.08; q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, 40 * DEG)); }
        source.matrix.compose(p, q, s); neu = true;
      }
      if (neu && tr.measure) tr.measure(source.matrix);
      tr.tick();
      target.matrix.decompose(op, oq, os);
      out.push({ sichtbar: target.visible, p: op.clone(), q: oq.clone(), wahrP: wahr.p.clone(), wahrQ: wahr.q.clone(), moving: tr.snapshot().moving });
    }
    const z = tr.snapshot();
    return { out, zaehler: { snap: z.snapCount, relock: z.relockCount, nan: z.nanCount, reloc: z.relocCount, modeSwitches: z.modeSwitches } };
  } finally { Object.assign(STAB, alt.STAB); Object.assign(GYRO, alt.GYRO); performance.now = alt.now; }
}
function kennzahlen(r) {
  const O = r.out;
  const fehler = (a, b) => { let s = 0, n = 0; for (let i = a; i < b; i++) { s += O[i].p.distanceTo(O[i].wahrP) ** 2; n++; } return Math.sqrt(s / n) * 1000; };
  const fehlerDeg = (a, b) => { let s = 0, n = 0; for (let i = a; i < b; i++) { s += O[i].q.angleTo(O[i].wahrQ) ** 2; n++; } return Math.sqrt(s / n) / DEG; };
  const zitter = (a, b) => { let s = 0, n = 0; for (let i = a + 2; i < b; i++) { const d = O[i].p.clone().sub(O[i - 1].p.clone().multiplyScalar(2)).add(O[i - 2].p); s += d.lengthSq(); n++; } return Math.sqrt(s / n / 6) * 1000; };
  const bewegt = (a, b) => { let n = 0; for (let i = a; i < b; i++) n += O[i].moving ? 1 : 0; return n; };
  const sichtbar = (a, b) => { let n = 0; for (let i = a; i < b; i++) n += O[i].sichtbar ? 1 : 0; return n; };
  const abw = (a, b, ref) => { let m = 0, d = 0; for (let i = a; i <= b; i++) { m = Math.max(m, O[i].p.distanceTo(O[ref].p) * 1000); d = Math.max(d, O[i].q.angleTo(O[ref].q) / DEG); } return { mm: +m.toFixed(3), deg: +d.toFixed(3) }; };
  const f = (v) => +v.toFixed(3);
  return {
    ruhe1FehlerMm: f(fehler(90, 210)), ruhe1ZitterMm: f(zitter(90, 210)), ruhe1BewegtTicks: bewegt(90, 210),
    bewegungFehlerMm: f(fehler(240, 390)), bewegungFehlerDeg: f(fehlerDeg(240, 390)), bewegungBewegtTicks: bewegt(240, 390),
    ruhe2FehlerMm: f(fehler(450, 570)), ruhe2ZitterMm: f(zitter(450, 570)), ruhe2BewegtTicks: bewegt(450, 570),
    ausreisser570_572: abw(570, 572, 569), ausreisser573_630: abw(573, 630, 569),
    sichtbarGyroLebt: sichtbar(660, 720), sichtbarGyroTot: sichtbar(780, 840),
    ...r.zaehler,
  };
}

test("Vergleichsszenario: alt gegen neu, Eigenschaften des neuen Trackers", (t) => {
  const alt = kennzahlen(vergleich(PoseStabilizer));
  const neu = kennzahlen(vergleich(Tracker));
  const roh = kennzahlen(vergleich(Tracker8roh)); // Nulllinie: die Engine selbst
  const lerp = kennzahlen(vergleich(Tracker8lerp)); // Nulllinie + Lerp/Slerp + Schiedsrichter
  for (const k of Object.keys(neu)) t.diagnostic(`${k}: 8roh ${JSON.stringify(roh[k])} · alt ${JSON.stringify(alt[k])} · neu ${JSON.stringify(neu[k])} · 8lerp ${JSON.stringify(lerp[k])}`);
  // Nulllinie: Rohrauschen und Ausreißer voll sichtbar, bei Verlust sofort weg — jeder Filter muss das schlagen
  assert.ok(roh.ruhe1ZitterMm > 0.05 && roh.ruhe1ZitterMm > neu.ruhe1ZitterMm * 5, "8roh zittert: " + roh.ruhe1ZitterMm);
  assert.ok(roh.ausreisser570_572.mm > 50 && roh.ausreisser570_572.deg > 30, JSON.stringify(roh.ausreisser570_572));
  assert.equal(roh.sichtbarGyroLebt, 0);
  assert.equal(roh.sichtbarGyroTot, 0);
  assert.equal(roh.snap + roh.relock + roh.reloc, 0);
  // In Ruhe wird die Karte als ruhig erkannt (Drift-Detektor) und die Figur steht
  assert.equal(neu.ruhe1BewegtTicks, 0, "Ruhe 1 bewegt");
  assert.ok(neu.ruhe2BewegtTicks <= 3, "Ruhe 2 bewegt: " + neu.ruhe2BewegtTicks); // Rest der Verweilzeit nach der Bewegung
  assert.ok(neu.ruhe1ZitterMm < 0.02 && neu.ruhe2ZitterMm < 0.02, "Zittern in Ruhe");
  assert.ok(neu.ruhe1FehlerMm < 0.5 && neu.ruhe2FehlerMm < 0.5, "Lagefehler in Ruhe");
  // Bewegung: erkannt, Nachlauf klein
  assert.ok(neu.bewegungBewegtTicks > 120, "Bewegung erkannt");
  assert.ok(neu.bewegungFehlerMm < 5 && neu.bewegungFehlerDeg < 3, "Nachlauf: " + neu.bewegungFehlerMm + " mm, " + neu.bewegungFehlerDeg + "°");
  // Eine einzelne ferne Messung wird exakt gehalten (alt: zieht nach)
  assert.deepEqual(neu.ausreisser570_572, { mm: 0, deg: 0 });
  assert.ok(alt.ausreisser570_572.deg > 0.1, "alt zieht beim Ausreißer nach: " + JSON.stringify(alt.ausreisser570_572));
  assert.ok(neu.ausreisser573_630.mm < 0.3 && neu.ausreisser573_630.deg < 0.3, "kein Nachwirken");
  assert.equal(neu.snap, 0);
  // Verlust: Gyro lebt → ganze Sekunde sichtbar; Gyro tot → nach 250 ms weg (15 Ticks)
  assert.equal(neu.sichtbarGyroLebt, 60);
  assert.ok(neu.sichtbarGyroTot >= 15 && neu.sichtbarGyroTot <= 17, String(neu.sichtbarGyroTot));
  assert.equal(neu.relock, 0);
  assert.equal(neu.nan, 0);
  // 8lerp (Build 105): ruhiger als die Nulllinie, Nachlauf ≈ v·τ, kein Modus,
  // Ausreißer sichtbar, aber gedämpft (keine Ausreißer-Regel, gewollt), bei Verlust sofort weg
  assert.ok(lerp.ruhe1ZitterMm < roh.ruhe1ZitterMm / 3 && lerp.ruhe2ZitterMm < roh.ruhe2ZitterMm / 3, "8lerp Zittern: " + lerp.ruhe1ZitterMm);
  assert.ok(lerp.ruhe1FehlerMm < roh.ruhe1FehlerMm, "8lerp Lagefehler: " + lerp.ruhe1FehlerMm);
  assert.ok(lerp.bewegungFehlerMm < 3 && lerp.bewegungFehlerDeg < 1, "8lerp Nachlauf: " + lerp.bewegungFehlerMm + " mm");
  assert.equal(lerp.bewegungBewegtTicks + lerp.modeSwitches, 0);
  assert.ok(lerp.ausreisser570_572.mm > 10 && lerp.ausreisser570_572.mm < roh.ausreisser570_572.mm, JSON.stringify(lerp.ausreisser570_572));
  assert.equal(lerp.sichtbarGyroLebt, 0);
  assert.equal(lerp.sichtbarGyroTot, 0);
  assert.equal(lerp.snap + lerp.relock + lerp.reloc + lerp.nan, 0);
});

test("Szenario-Varianten laufen auch durch den neuen Tracker ohne Fehler", () => {
  for (const konfig of [{ STAB: { enabled: false } }, { STAB: { extrapolate: false } }, { STAB: { deadZones: false } },
    { STAB: { gravityArbiter: false } }, { STAB: { snap: false } }, { STAB: { lostHold: false } }, { GYRO: { enabled: false } }]) {
    const r = laufSzenario(Tracker, konfig, { jederTick: 20 });
    for (const row of r.ticks) for (let j = 2; j < row.length; j++) assert.ok(Number.isFinite(row[j]), JSON.stringify(konfig));
  }
});

test("Szenario-Varianten laufen auch durch 8lerp ohne Fehler", () => {
  for (const konfig of [{}, { STAB: { enabled: false } }, { STAB: { gravityArbiter: false } }, { STAB: { lerpPosMs: 0, lerpRotMs: 0 } }]) {
    const r = laufSzenario(Tracker8lerp, konfig, { jederTick: 20 });
    for (const row of r.ticks) for (let j = 2; j < row.length; j++) assert.ok(Number.isFinite(row[j]), JSON.stringify(konfig));
  }
});

/* ---- Einzelprüfungen 8lerp ----------------------------------------------- */
function aufbau8lerp({ gyro = null, stab = {} } = {}) {
  const alt = { STAB: { ...STAB }, now: performance.now };
  Object.assign(STAB, STAB_FEST, { lerpPosMs: 50, lerpRotMs: 50 }, stab);
  const uhr = { t: 1000 };
  performance.now = () => uhr.t;
  const target = new THREE.Group();
  const tr = new Tracker8lerp(target, gyro);
  const m = new THREE.Matrix4();
  const mess = (pos, quat = new THREE.Quaternion(), scale = 0.059) => { m.compose(pos, quat, new THREE.Vector3(scale, scale, scale)); tr.measure(m); };
  const frame = (ms = DT_MS) => { uhr.t += ms; tr.tick(); };
  const pose = () => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); target.matrix.decompose(p, q, s); return { p, q, s }; };
  const ende = () => { Object.assign(STAB, alt.STAB); performance.now = alt.now; };
  return { tr, target, mess, frame, pose, ende };
}

test("8lerp: unsichtbar bis onFound, erste Messung sitzt exakt, bei Verlust sofort weg", () => {
  const t = aufbau8lerp();
  try {
    t.frame(); assert.equal(t.target.visible, false);
    t.tr.onFound(); t.mess(new THREE.Vector3(0.01, 0.02, -0.3)); t.frame();
    assert.equal(t.target.visible, true);
    assert.ok(t.pose().p.distanceTo(new THREE.Vector3(0.01, 0.02, -0.3)) < 1e-9);
    assert.ok(Math.abs(t.pose().s.x - 0.059) < 1e-9);
    t.tr.onLost(); assert.equal(t.target.visible, false);
  } finally { t.ende(); }
});

test("8lerp: gleitet framerate-unabhängig auf die letzte Messung (a = 1 − exp(−dt/τ))", () => {
  const ziel = new THREE.Vector3(0.01, 0, -0.3);
  const lauf = (dt, n) => {
    const t = aufbau8lerp();
    try {
      t.tr.onFound(); t.mess(new THREE.Vector3(0, 0, -0.3)); t.frame();
      t.mess(ziel, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2));
      for (let i = 0; i < n; i++) t.frame(dt);
      return t.pose();
    } finally { t.ende(); }
  };
  const a = lauf(DT_MS, 3), b = lauf(DT_MS * 3, 1); // 50 ms in 3 Frames = 50 ms in einem
  assert.ok(Math.abs(a.p.x - b.p.x) < 1e-9, a.p.x + " vs " + b.p.x);
  assert.ok(Math.abs(a.p.x - 0.01 * (1 - Math.exp(-1))) < 1e-6, "nach τ: 63 %: " + a.p.x);
  const c = lauf(DT_MS, 30); // 500 ms = 10 τ
  assert.ok(c.p.distanceTo(ziel) < 1e-6 && c.q.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2)) < 1e-4);
});

test("8lerp: τ = 0 und Schalter 1 aus = Messung 1:1", () => {
  for (const stab of [{ lerpPosMs: 0, lerpRotMs: 0 }, { enabled: false }]) {
    const t = aufbau8lerp({ stab });
    try {
      t.tr.onFound(); t.mess(new THREE.Vector3(0, 0, -0.3)); t.frame();
      t.mess(new THREE.Vector3(0.02, 0, -0.3)); t.frame();
      assert.ok(Math.abs(t.pose().p.x - 0.02) < 1e-9, JSON.stringify(stab));
    } finally { t.ende(); }
  }
});

test("8lerp: nicht-endliche Messung wird gezählt und vergiftet den Zustand nicht", () => {
  const t = aufbau8lerp();
  try {
    t.tr.onFound(); t.mess(new THREE.Vector3(0.01, 0, -0.3)); t.frame();
    t.mess(new THREE.Vector3(NaN, 0, -0.3)); t.frame(); t.frame();
    assert.equal(t.tr.snapshot().nanCount, 1);
    const p = t.pose().p;
    assert.ok(Number.isFinite(p.x) && Math.abs(p.x - 0.01) < 1e-9);
  } finally { t.ende(); }
});

test("8lerp: Schiedsrichter kippt die Spiegel-Lösung zurück, nur mit Gyro-Lage und Schalter 10", () => {
  // Kamera = Erdframe (Lage = Identität, z oben), Karte schräg unter der Kamera
  // (Sichtlinie 45°). Wahre Karte liegt flach: Normale (0,0,1). Die Engine liefert
  // die Spiegel-Lösung: Normale an der Sichtlinie gespiegelt = (0,1,0).
  const pos = new THREE.Vector3(0, -0.2, -0.2);
  const qSpiegel = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
  const normale = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const lage = new THREE.Quaternion();
  for (const [gyro, stab, erwartetZ, flips] of [
    [{ getOrientation: () => lage }, {}, 1, 1],
    [{ getOrientation: () => lage }, { gravityArbiter: false }, 0, 0],
    [{ getOrientation: () => null }, {}, 0, 0],
  ]) {
    const t = aufbau8lerp({ gyro, stab });
    try {
      t.tr.onFound(); t.mess(pos, qSpiegel); t.frame();
      assert.ok(Math.abs(normale(t.pose().q).z - erwartetZ) < 1e-6, "z " + normale(t.pose().q).z + " " + JSON.stringify(stab));
      const s = t.tr.snapshot();
      assert.equal(s.flipCount, flips);
      assert.equal(s.arb.flipped, flips === 1);
    } finally { t.ende(); }
  }
});

test("8lerp: snapshot hat alle Felder von ?stats; Quelltext ohne DOM und verbotene Syntax", async () => {
  const t = aufbau8lerp();
  try {
    const s = t.tr.snapshot();
    for (const k of ["tracking", "visible", "moving", "moveCause", "visionHz", "newMeas", "rawPos", "rawQuat", "rawSkewDeg", "rawOffset",
      "relocCount", "snapCount", "relockCount", "flipCount", "nanCount", "modeSwitches", "gyroApplied", "arb"]) assert.ok(k in s, k);
  } finally { t.ende(); }
  const src = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../js/tracker8lerp.js", import.meta.url), "utf8"));
  assert.ok(!/\bdocument\.|\bwindow\./.test(src));
  assert.ok(!/^\s+static |\?\?=|\.at\(/m.test(src));
});

/* ---- Einzelprüfungen ----------------------------------------------------- */
function aufbau({ gyro = null, stab = {}, gyroCfg = {} } = {}) {
  const alt = { STAB: { ...STAB }, GYRO: { ...GYRO }, now: performance.now };
  Object.assign(STAB, STAB_FEST, stab);
  Object.assign(GYRO, GYRO_FEST, gyroCfg);
  const uhr = { t: 0 };
  performance.now = () => uhr.t;
  const target = new THREE.Group();
  const tr = new Tracker(target, gyro);
  const m = new THREE.Matrix4();
  const mess = (x, y, z, { dreh = 0, scale = 0.059 } = {}) => {
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dreh), new THREE.Vector3(scale, scale, scale));
    tr.measure(m);
  };
  const frame = (ms = DT_MS) => { uhr.t += ms; tr.tick(); };
  const ziel = () => { const o = new THREE.Vector3(); target.matrix.decompose(o, new THREE.Quaternion(), new THREE.Vector3()); return o; };
  const zielQ = () => { const q = new THREE.Quaternion(); target.matrix.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
  const ende = () => { Object.assign(STAB, alt.STAB); Object.assign(GYRO, alt.GYRO); performance.now = alt.now; };
  return { tr, target, mess, frame, ziel, zielQ, ende, uhr };
}
function aufsetzen(t, x = 0, y = 0, z = -0.3) {
  for (let i = 0; i < STAB_FEST.acquireFrames; i++) { t.mess(x + i * 1e-5, y, z); t.frame(50); }
}

test("unsichtbar bis onFound, Median steht nach acquireFrames Messungen", () => {
  const t = aufbau();
  try {
    t.mess(0, 0, -0.3); t.frame();
    assert.equal(t.target.visible, false);
    t.tr.onFound();
    assert.equal(t.target.visible, true);
    assert.equal(t.tr.initialised, false);
    aufsetzen(t);
    assert.equal(t.tr.initialised, true);
    const z = t.ziel();
    assert.ok(Math.abs(z.z + 0.3) < 1e-9 && Math.abs(z.x) < 1e-4);
    assert.equal(t.tr.snapshot().visionHz === null || t.tr.snapshot().visionHz >= 0, true);
  } finally { t.ende(); }
});

test("NaN-Messung wird verworfen, Pose bleibt", () => {
  const t = aufbau();
  try {
    t.tr.onFound(); aufsetzen(t);
    const vorher = t.ziel();
    t.mess(NaN, 0, -0.3); t.frame();
    assert.deepEqual(t.ziel(), vorher);
    assert.equal(t.tr.snapshot().nanCount, 1);
  } finally { t.ende(); }
});

test("Ausreißer, dann normal: verworfen, Pose unverändert, kein Snap", () => {
  const t = aufbau();
  try {
    t.tr.onFound(); aufsetzen(t);
    const vorher = t.ziel();
    t.mess(0.1, 0, -0.3, { dreh: 0.6 }); t.frame(); t.frame(); t.frame();
    assert.deepEqual(t.ziel(), vorher);
    t.mess(0.00001, 0, -0.3); t.frame();            // zurück bei der alten Stelle
    assert.equal(t.tr.snapshot().snapCount, 0);
    assert.ok(t.ziel().distanceTo(vorher) < 1e-5);
    assert.equal(t.tr.snapshot().moving, false);
  } finally { t.ende(); }
});

test("eine ferne Messung: halten; zwei in Folge: Snap und neu aufsetzen an der neuen Stelle", () => {
  const t = aufbau();
  try {
    t.tr.onFound(); aufsetzen(t);
    const vorher = t.ziel(), qVorher = t.zielQ();
    t.mess(0.1, 0, -0.3, { dreh: 0.6 }); t.frame(); t.frame(); t.frame();
    assert.deepEqual(t.ziel(), vorher);       // exakt gehalten, auch über stale Frames
    assert.equal(t.zielQ().angleTo(qVorher), 0);
    assert.equal(t.tr.snapshot().snapCount, 0);
    t.mess(0.1001, 0, -0.3, { dreh: 0.6 }); t.frame();
    assert.equal(t.tr.snapshot().snapCount, 1);
    assert.equal(t.tr.initialised, false);    // Median läuft, die ferne Messung ist die erste Probe
    for (let i = 0; i < STAB_FEST.acquireFrames; i++) { t.mess(0.1 + i * 1e-5, 0, -0.3, { dreh: 0.6 }); t.frame(50); }
    assert.ok(Math.abs(t.ziel().x - 0.1) < 1e-3);
    assert.ok(Math.abs(t.zielQ().angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6))) < 1e-3);
  } finally { t.ende(); }
});

test("Verlust: ohne Gyro nach lostHoldMs weg; mit lebendem Gyro (auch ohne Delta) bis bridgeMs sichtbar", () => {
  const t = aufbau();
  try {
    t.tr.onFound(); aufsetzen(t);
    t.tr.onLost();
    t.frame(200); assert.equal(t.target.visible, true);
    t.frame(100); assert.equal(t.target.visible, false);
  } finally { t.ende(); }
  const ctl = { delta: null, lage: new THREE.Quaternion() };
  const u = aufbau({ gyro: { getDelta: () => ctl.delta, getOrientation: () => ctl.lage } });
  try {
    u.tr.onFound(); aufsetzen(u);
    u.tr.onLost();
    u.frame(1000); assert.equal(u.target.visible, true);   // Gyro lebt, Hand ganz ruhig (kein Delta)
    u.frame(300); assert.equal(u.target.visible, false);   // > bridgeMs 1200
  } finally { u.ende(); }
  // Schalter 7 aus: trotz lebendem Gyro nur die kurze Haltezeit
  const v = aufbau({ gyro: { getDelta: () => null, getOrientation: () => ctl.lage }, gyroCfg: { enabled: false } });
  try {
    v.tr.onFound(); aufsetzen(v); v.tr.onLost();
    v.frame(300); assert.equal(v.target.visible, false);
  } finally { v.ende(); }
  // Schalter 4 aus: sofort weg, auch mit Gyro
  const w = aufbau({ gyro: { getDelta: () => null, getOrientation: () => ctl.lage }, stab: { lostHold: false } });
  try {
    w.tr.onFound(); aufsetzen(w); w.tr.onLost();
    w.frame(); assert.equal(w.target.visible, false);
  } finally { w.ende(); }
});

test("Gyro-Brücke dreht die Pose mit der Kamera mit", () => {
  const ctl = { delta: null, lage: new THREE.Quaternion() };
  const t = aufbau({ gyro: { getDelta: () => ctl.delta, getOrientation: () => ctl.lage } });
  try {
    t.tr.onFound(); aufsetzen(t, 0.05, 0, -0.3);
    t.frame();
    const vorher = t.ziel();
    t.tr.onLost();
    ctl.delta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.01);
    for (let i = 0; i < 30; i++) t.frame();
    assert.equal(t.target.visible, true);
    assert.ok(t.ziel().distanceTo(vorher) > 1e-3);
    assert.equal(t.tr.snapshot().gyroApplied, 30);
  } finally { t.ende(); }
});

test("Bewegung: Bewegt-Modus schaltet ein, Extrapolation läuft zwischen den Messungen, Ruhe kehrt zurück", () => {
  const t = aufbau();
  try {
    t.tr.onFound(); aufsetzen(t);
    // 0,05 m/s in x, Messungen alle 50 ms
    for (let i = 1; i <= 20; i++) { t.mess(0.05 * i * 0.05, 0, -0.3); t.frame(50); }
    assert.equal(t.tr.snapshot().moving, true);
    assert.equal(t.tr.snapshot().snapCount, 0, "Anfahrt aus der Ruhe ohne Snap");
    const a = t.ziel().x; t.frame(); t.frame(); const b = t.ziel().x; // zwei Render-Frames ohne Messung
    assert.ok(b > a, "Extrapolation bewegt die Ausgabe weiter");
    // Nachlauf klein: Ausgabe nahe der wahren Position
    assert.ok(Math.abs(t.ziel().x - 0.05) < 0.006, String(t.ziel().x));
    for (let i = 0; i < 20; i++) { t.mess(0.05 + (i % 2) * 1e-5, 0, -0.3); t.frame(50); }
    assert.equal(t.tr.snapshot().moving, false);
  } finally { t.ende(); }
});

test("Schalter 1 aus: Rohpose 1:1, auch ohne Aufsetzen", () => {
  const t = aufbau({ stab: { enabled: false } });
  try {
    t.tr.onFound();
    t.mess(0.123, 0.4, -0.9, { dreh: 0.3 }); t.frame();
    const z = t.ziel();
    assert.ok(Math.abs(z.x - 0.123) < 1e-12 && Math.abs(z.y - 0.4) < 1e-12 && Math.abs(z.z + 0.9) < 1e-12);
  } finally { t.ende(); }
});

test("reacquire zählt und setzt per Median neu auf; snapshot hat alle Felder von ?stats", () => {
  const t = aufbau();
  try {
    t.tr.onFound(); aufsetzen(t);
    t.tr.reacquire();
    assert.equal(t.tr.snapshot().relocCount, 1);
    assert.equal(t.tr.initialised, false);
    aufsetzen(t, 0.02);
    assert.ok(Math.abs(t.ziel().x - 0.02) < 1e-3);
    const s = t.tr.snapshot();
    for (const k of ["tracking", "visible", "moving", "moveCause", "visionHz", "newMeas", "rawPos", "rawQuat",
      "rawSkewDeg", "rawOffset", "relocCount", "snapCount", "relockCount", "flipCount", "nanCount",
      "modeSwitches", "gyroApplied", "arb"]) assert.ok(k in s, k);
    assert.equal(s.relockCount, 0);
    assert.equal(t.tr.snapshot(), s);
    // newMeas gilt genau für den Frame nach der Messung
    t.mess(0.02, 0, -0.3); t.frame();
    assert.equal(t.tr.snapshot().newMeas, true);
    t.frame();
    assert.equal(t.tr.snapshot().newMeas, false);
  } finally { t.ende(); }
});

test("Tracker-Quelltext: kein DOM, kein window, keine verbotene Syntax", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../js/tracker.js", import.meta.url), "utf8");
  assert.ok(!/\bdocument\.|\bwindow\./.test(src));
  assert.ok(!/^\s+static |\?\?=|\.at\(/m.test(src));
});
