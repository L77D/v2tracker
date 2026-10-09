/* Deterministisches Szenario für den PoseStabilizer (Refactoring Stufe 3c):
   gefälschte Uhr (performance.now), gefälschtes Gyro, feste Tracking-Werte
   (STAB_FEST — unabhängig von späterem Tuning in config.js) und eine
   Abfolge, die jede Stufe des Filters anstößt:

     Tick   0– 29  noch nicht getrackt
          30–299  Ruhe mit Rauschen (Aufsetzen per Median, Dead-Zones, One-Euro);
                  ab 200 alle 7 Ticks ein Gyro-Delta (Prediction), Gyro-Lage „aufrecht"
         300–479  gleichmäßige Bewegung (Bewegt-Modus, Extrapolation)
         480–599  wieder Ruhe (Verweilzeit → Ruhe-Modus)
         600      EINE ferne Messung (Ausreißer → verworfen)
         648/651  ZWEI ferne Messungen in Folge an neuer Stelle B (Snap → neu aufsetzen)
         700–759  Verlust MIT Gyro-Deltas (Gyro-Brücke), 760 wiedergefunden
         800–899  Verlust OHNE Gyro (lostHold → ausblenden), 900 wiedergefunden
         950      reacquire() (Tap)
        1000–1059 Scale +20 % (Scale-Lock verwirft → nach scaleRelockMs Re-Lock)
        1101      NaN-Frame (verwerfen)
        1150–1249 gespiegelte Pose auf dem Tisch mit Erd-Lage (Schiedsrichter kippt)
        1250–1299 wahre Pose (Schiedsrichter kippt zurück)

   Vision-Messungen kommen nur jeden 3. Tick (sonst bleibt die Matrix
   bitidentisch = „stale"), Render-Takt 60 Hz. Genutzt vom Goldstandard
   tests/fixtures/poseStabilizer.golden.json (erzeugt mit dem Stand VOR dem
   Umbau, Build 87) und von tests/poseStabilizer.test.mjs. */
import * as THREE from "../vendor/three/three.module.js";
import { STAB, GYRO } from "../js/config.js";

export const TICKS = 1300;
export const DT_MS = 1000 / 60;

// Tracking-Werte, eingefroren am 2026-10-09 (Build 87) — bewusst eine Kopie,
// damit späteres Tuning in config.js den Goldstandard nicht bricht.
export const STAB_FEST = {
  enabled: "ja", normalize: "ja", deadZones: "ja", lostHold: "ja", nanGuard: "ja", snap: "ja",
  scaleLock: "ja", gravityArbiter: "ja",
  minCutoff: 0.1, beta: 10, dCutoff: 1.0, rotMinCutoff: 0.5, rotBeta: 4.0,
  posDeadZone: 0.001, rotDeadZone: 0.0015, lostHoldMs: 250, snapDist: 0.25, snapAngle: 0.5,
  scaleOutlier: 0.1, acquireFrames: 10, acquireMaxMs: 700, scaleRelockMs: 600, arbiterMargin: 0.15,
  extrapolate: "ja", extrapMaxMs: 150, latencyMs: 40, moveDwellMs: 250,
  maxSpeed: 3, maxAngSpeed: 4, extrapMaxDist: 0.08, extrapMaxAngle: 0.25,
  minSpeed: 0.04, minAngSpeed: 0.09, refHz: 60,
};
export const GYRO_FEST = { enabled: "ja", bridgeMs: 1200, deltaDeadZone: 0.0012, deltaMax: 0.2 };

/* Varianten: jeder Feature-Schalter einmal aus. */
export const KONFIGS = {
  standard: {},
  aus: { STAB: { enabled: "nein" } },
  ohneNormierung: { STAB: { normalize: "nein" } },
  ohneDeadZones: { STAB: { deadZones: "nein" } },
  ohneLostHold: { STAB: { lostHold: "nein" } },
  ohneNanGuard: { STAB: { nanGuard: "nein" } },
  ohneSnap: { STAB: { snap: "nein" } },
  ohneScaleLock: { STAB: { scaleLock: "nein" } },
  ohneArbiter: { STAB: { gravityArbiter: "nein" } },
  ohneExtrapolation: { STAB: { extrapolate: "nein" } },
  ohneGyro: { GYRO: { enabled: "nein" } },
};

/* Linearer Kongruenzgenerator — gleiche Zahlen in jedem Lauf. */
export function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const DEG = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

/* Tisch-Szene wie in tests/poseArbiter.test.mjs: Karte flach, Handy 45° aus der Senkrechten. */
function tisch() {
  const aufrecht = new THREE.Quaternion().setFromAxisAngle(X, 90 * DEG);
  const kipp = new THREE.Quaternion().setFromAxisAngle(X, -(90 - 45) * DEG);
  const qEarth = aufrecht.multiply(kipp);
  const qTrue = qEarth.clone().invert();
  const pos = new THREE.Vector3(0, 0, -0.3);
  const n = Z.clone().applyQuaternion(qTrue);
  const u = pos.clone().negate().normalize();
  const nAlt = u.clone().multiplyScalar(2 * n.dot(u)).sub(n);
  const qMirror = new THREE.Quaternion().setFromUnitVectors(n, nAlt).multiply(qTrue);
  return { qEarth, qTrue, qMirror, pos };
}

/**
 * Lässt das Szenario durch eine PoseStabilizer-Klasse laufen.
 * @returns { ticks: [[i, sichtbar, px,py,pz, qx,qy,qz,qw, s] …], zaehler: {…} }
 *   ticks: jeder `jederTick`-te Tick (Goldstandard: standard jeder, Varianten jeder 20.), Werte auf 12 signifikante Stellen
 */
export function laufSzenario(PoseStabilizer, konfig = {}, { jederTick = 1 } = {}) {
  const stabAlt = { ...STAB }, gyroAlt = { ...GYRO }, nowAlt = performance.now;
  Object.assign(STAB, STAB_FEST, konfig.STAB ?? {});
  Object.assign(GYRO, GYRO_FEST, konfig.GYRO ?? {});
  const uhr = { t: 0 };
  performance.now = () => uhr.t;
  try {
    return lauf(PoseStabilizer, jederTick, uhr);
  } finally {
    Object.assign(STAB, stabAlt);
    Object.assign(GYRO, gyroAlt);
    performance.now = nowAlt;
  }
}

function lauf(PoseStabilizer, jederTick, uhr) {
  const rnd = lcg(20261009);
  const gyroCtl = { delta: null, qEarth: null };
  const gyro = { getDelta: () => gyroCtl.delta, getOrientation: () => gyroCtl.qEarth };
  const source = new THREE.Group();
  source.matrixAutoUpdate = false;
  const target = new THREE.Group();
  const stab = new PoseStabilizer(source, target, gyro);

  const SCALE = 0.059;
  const baseP = new THREE.Vector3(0.01, -0.02, -0.30);
  const baseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.1, 0.05));
  const bP = baseP.clone().add(new THREE.Vector3(0.08, 0, 0)); // Stelle B nach dem Snap
  const t45 = tisch();
  const aufrecht = new THREE.Quaternion().setFromAxisAngle(X, 90 * DEG); // Erd-Lage für Phase Ruhe (keine Spiegelung nötig)
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const noiseQ = new THREE.Quaternion();
  const gyroDelta = new THREE.Quaternion();
  const out = { ticks: [], zaehler: null };
  const rp = new THREE.Vector3(), rq = new THREE.Quaternion(), rs = new THREE.Vector3();

  const rausch = (sigma) => (rnd() + rnd() + rnd() - 1.5) * sigma * 2; // grob normalverteilt
  function messung(center, quat, { sigma = 0.0005, rot = 0.3 * DEG, scale = SCALE, nan = false } = {}) {
    p.copy(center).add(new THREE.Vector3(rausch(sigma), rausch(sigma), rausch(sigma)));
    noiseQ.setFromEuler(new THREE.Euler(rausch(rot), rausch(rot), rausch(rot)));
    q.copy(quat).multiply(noiseQ);
    s.setScalar(scale);
    if (nan) p.x = NaN;
    source.matrix.compose(p, q, s);
  }

  for (let i = 0; i < TICKS; i++) {
    uhr.t = i * DT_MS;
    const vision = i % 3 === 0;
    gyroCtl.delta = null;
    gyroCtl.qEarth = null;

    // Ereignisse
    if (i === 30 || i === 760 || i === 900) stab.onFound();
    if (i === 700 || i === 800) stab.onLost();
    if (i === 950) stab.reacquire();

    // Messungen und Gyro je Phase
    if (i >= 30 && i < 300) {
      if (vision) messung(baseP, baseQ);
      if (i >= 200 && i % 7 === 0) gyroCtl.delta = gyroDelta.setFromAxisAngle(X, 0.003);
      if (i >= 200) gyroCtl.qEarth = aufrecht;
    } else if (i >= 300 && i < 480) {
      if (vision) {
        const tt = (i - 300) * DT_MS / 1000;
        const c = baseP.clone().add(new THREE.Vector3(0.05 * tt, 0, 0));
        const rq2 = baseQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, 20 * DEG * tt));
        messung(c, rq2);
      }
    } else if (i >= 480 && i < 600) {
      const c = baseP.clone().add(new THREE.Vector3(0.05 * 3, 0, 0));
      const rq2 = baseQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, 20 * DEG * 3));
      if (vision) messung(c, rq2);
    } else if (i >= 600 && i < 700) {
      const c = baseP.clone().add(new THREE.Vector3(0.15, 0, 0));
      const rq2 = baseQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, 60 * DEG));
      if (i === 600) messung(c.clone().add(new THREE.Vector3(0.1, 0, 0)), rq2); // Ausreißer
      else if (i === 648 || i === 651) messung(bP, baseQ);                  // zwei ferne → Snap
      else if (i > 651 && vision) messung(bP, baseQ);
      else if (vision) messung(c, rq2);
    } else if (i >= 700 && i < 760) {
      gyroCtl.delta = gyroDelta.setFromAxisAngle(Y, 0.002); // Brücke
    } else if (i >= 760 && i < 800) {
      if (vision) messung(bP, baseQ);
    } else if (i >= 800 && i < 900) {
      // Verlust ohne Gyro: Matrix bleibt stehen
    } else if (i >= 900 && i < 1000) {
      if (vision) messung(bP, baseQ);
    } else if (i >= 1000 && i < 1060) {
      if (vision) messung(bP, baseQ, { scale: SCALE * 1.2 });
    } else if (i >= 1060 && i < 1150) {
      if (vision) messung(bP, baseQ, { nan: i === 1101 });
    } else if (i >= 1150 && i < 1250) {
      if (vision) messung(t45.pos, t45.qMirror, { sigma: 0.0002, rot: 0.1 * DEG });
      gyroCtl.qEarth = t45.qEarth;
    } else if (i >= 1250) {
      if (vision) messung(t45.pos, t45.qTrue, { sigma: 0.0002, rot: 0.1 * DEG });
      gyroCtl.qEarth = t45.qEarth;
    }

    stab.tick();

    if (i % jederTick === 0) {
      target.matrix.decompose(rp, rq, rs);
      const f = (v) => +v.toPrecision(12);
      out.ticks.push([i, target.visible ? 1 : 0, f(rp.x), f(rp.y), f(rp.z), f(rq.x), f(rq.y), f(rq.z), f(rq.w), f(rs.x)]);
    }
  }
  const z = stab.snapshot ? stab.snapshot() : stab;
  const zaehler = stab.snapshot
    ? { reloc: z.relocCount, snap: z.snapCount, relock: z.relockCount, flip: z.flipCount, nan: z.nanCount,
        modeSwitches: z.modeSwitches, gyroApplied: z.gyroApplied, tracking: z.tracking, moving: z.moving, arbFlipped: z.arb.flipped }
    : { reloc: stab.relocCount, snap: stab.snapCount, relock: stab.relockCount, flip: stab.flipCount, nan: stab.diag.nanCount,
        modeSwitches: stab.diag.modeSwitches, gyroApplied: stab.diag.gyroApplied, tracking: stab.tracking, moving: stab.moving, arbFlipped: stab.arb.flipped };
  out.zaehler = zaehler;
  return out;
}
