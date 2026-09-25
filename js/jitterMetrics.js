/* =============================================================================
   DETAR — Kennzahlen für ?stats (Handheld-Analyse, 2026-09-25,
   docs/handheld-jitter-analyse.md Abschnitt b). Reine Rechnung auf einem
   Fenster von Tick-Proben, kein DOM, kein three.js — auch in Node prüfbar.

   Trennt Tracking-Rauschen von Handbewegung über die ZWEITE Differenz
   (p[k] − 2·p[k−1] + p[k−2]) / √6: glatte Bewegung fällt fast heraus, weißes
   Rauschen bleibt (für weißes Rauschen σ gilt E[a²] = 6σ²). Roh UND stab
   werden nur zu den Zeitpunkten neuer Vision-Messungen abgetastet — damit
   sind beide vergleichbar (bis Build 61 zählte „Jitter roh" die Nullen der
   Frames ohne neue Messung mit).

   Probe (ein Render-Tick, nur bei sichtbarer, getrackter Figur):
     t   ms · n neue Messung · m BEWEGT-Modus
     sp  Stab-Position [x,y,z] in Kartenbreiten (Kamera-Frame) · sq Stab-Quaternion [x,y,z,w]
     sx  Stab-Messpunkt (Kopfhöhe) in Bildschirm-px [x,y] oder null
     rp/rq/rx  dasselbe für die Rohpose — nur bei n
     ga  Zähler angewendeter Gyro-Deltas · ms Zähler Modus-Wechsel
     gw  aufsummierter Gyro-Drehwinkel (Grad) oder null
   ============================================================================= */

const GAP_MS = 200; // größere Lücke zwischen zwei Proben = Tracking-Unterbrechung

function rotvec(q1, q0) {
  // Drehung von q0 nach q1 im Kamera-Frame (q1 · q0⁻¹) als Achse·Winkel (rad)
  const [ax, ay, az, aw] = q1;
  const bx = -q0[0], by = -q0[1], bz = -q0[2], bw = q0[3];
  let x = aw * bx + ax * bw + ay * bz - az * by;
  let y = aw * by - ax * bz + ay * bw + az * bx;
  let z = aw * bz + ax * by - ay * bx + az * bw;
  let w = aw * bw - ax * bx - ay * by - az * bz;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.sqrt(x * x + y * y + z * z);
  if (s < 1e-12) return [0, 0, 0];
  const ang = 2 * Math.atan2(s, w);
  return [(x / s) * ang, (y / s) * ang, (z / s) * ang];
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const sq = (a) => a.reduce((s, v) => s + v * v, 0);
const d2 = (a, b, c) => a.map((v, i) => v - 2 * b[i] + c[i]);

function pct(arr, p) {
  if (!arr.length) return null;
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
}

/**
 * @param S  Proben (zeitlich sortiert)
 * @param mm physische Kartenbreite in mm
 * @returns Kennzahlen oder null (zu wenig Daten)
 */
export function computeMetrics(S, mm) {
  if (!S || S.length < 3) return null;
  const T = (S[S.length - 1].t - S[0].t) / 1000;
  if (T <= 0) return null;
  const N = S.filter((s) => s.n && s.rp);
  const out = { dauer: T, proben: S.length, messungen: N.length };

  // --- Takt ---
  out.visionHz = N.length / T;
  out.renderFps = (S.length - 1) / T;
  const dts = [];
  for (let k = 1; k < N.length; k++) {
    const dt = N[k].t - N[k - 1].t;
    if (dt < GAP_MS) dts.push(dt);
  }
  out.dtP50 = pct(dts, 0.5);
  out.dtP95 = pct(dts, 0.95);

  // --- Rauschen (2. Differenz, nur neue Messungen) + Frame-zu-Frame ---
  const acc = { hr: 0, hs: 0, rr: 0, rs: 0, pr: 0, ps: 0, n: 0, np: 0 };
  const f2f = { r: 0, s: 0, n: 0 };
  for (let k = 1; k < N.length; k++) {
    const a = N[k], b = N[k - 1];
    if (a.t - b.t >= GAP_MS) continue;
    f2f.r += sq(sub(a.rp, b.rp));
    f2f.s += sq(sub(a.sp, b.sp));
    f2f.n++;
    if (k < 2) continue;
    const c = N[k - 2];
    const dt1 = a.t - b.t, dt0 = b.t - c.t;
    if (dt0 >= GAP_MS || dt1 / dt0 > 2 || dt1 / dt0 < 0.5) continue; // ungleichmäßiger Takt
    acc.hr += sq(d2(a.rp, b.rp, c.rp));
    acc.hs += sq(d2(a.sp, b.sp, c.sp));
    acc.rr += sq(sub(rotvec(a.rq, b.rq), rotvec(b.rq, c.rq)));
    acc.rs += sq(sub(rotvec(a.sq, b.sq), rotvec(b.sq, c.sq)));
    acc.n++;
    if (a.rx && b.rx && c.rx && a.sx && b.sx && c.sx) {
      acc.pr += sq(d2(a.rx, b.rx, c.rx));
      acc.ps += sq(d2(a.sx, b.sx, c.sx));
      acc.np++;
    }
  }
  const hf = (sum, n) => (n ? Math.sqrt(sum / n / 6) : null);
  const DEG = 180 / Math.PI;
  out.hfRohMm = acc.n ? hf(acc.hr, acc.n) * mm : null;
  out.hfStabMm = acc.n ? hf(acc.hs, acc.n) * mm : null;
  out.hfRohDeg = acc.n ? hf(acc.rr, acc.n) * DEG : null;
  out.hfStabDeg = acc.n ? hf(acc.rs, acc.n) * DEG : null;
  out.kopfHfRohPx = hf(acc.pr, acc.np);
  out.kopfHfStabPx = hf(acc.ps, acc.np);
  out.f2fRohMm = f2f.n ? Math.sqrt(f2f.r / f2f.n) * mm : null;
  out.f2fStabMm = f2f.n ? Math.sqrt(f2f.s / f2f.n) * mm : null;

  // --- Versatz Figur ↔ Karte (Kopfpunkt, px) zu den Messzeitpunkten ---
  let vs = 0, vn = 0;
  for (const s of N) if (s.rx && s.sx) { vs += Math.sqrt(sq(sub(s.sx, s.rx))); vn++; }
  out.versatzPx = vn ? vs / vn : null;

  // --- Lauf ohne Bild: Figurbewegung in Ticks OHNE neue Messung (das Kamera-
  //     bild steht, 8th Wall zeigt den ausgewerteten Frame) — Extrapolation
  //     und Gyro-Prediction landen hier ---
  let lauf = 0, laufOk = false;
  for (let k = 1; k < S.length; k++) {
    const a = S[k], b = S[k - 1];
    if (a.n || a.t - b.t >= GAP_MS || !a.sx || !b.sx) continue;
    lauf += Math.sqrt(sq(sub(a.sx, b.sx)));
    laufOk = true;
  }
  out.laufPxS = laufOk ? lauf / T : null;

  // --- Modus ---
  let movT = 0, allT = 0;
  for (let k = 1; k < S.length; k++) {
    const dt = S[k].t - S[k - 1].t;
    if (dt >= GAP_MS) continue;
    allT += dt;
    if (S[k - 1].m) movT += dt;
  }
  out.bewegtPct = allT ? (100 * movT) / allT : null;
  out.wechsel10s = ((S[S.length - 1].ms - S[0].ms) / T) * 10;

  // --- Gyro ---
  const g0 = S.find((s) => s.gw != null), g1 = [...S].reverse().find((s) => s.gw != null);
  out.gyroDps = g0 && g1 && g1 !== g0 ? (g1.gw - g0.gw) / ((g1.t - g0.t) / 1000) : null;
  out.gyroDeltasS = (S[S.length - 1].ga - S[0].ga) / T;
  return out;
}

/* Spalten der Tabellenzeile („Messung 10 s" → Kopieren). Reihenfolge = Kopfzeile. */
export const METRIC_COLS = [
  ["visionHz", 1], ["renderFps", 1], ["dtP95", 0],
  ["hfRohMm", 3], ["hfStabMm", 3], ["hfRohDeg", 3], ["hfStabDeg", 3],
  ["kopfHfRohPx", 2], ["kopfHfStabPx", 2], ["versatzPx", 2], ["laufPxS", 1],
  ["f2fRohMm", 3], ["f2fStabMm", 3], ["bewegtPct", 0], ["wechsel10s", 1],
  ["gyroDps", 2], ["gyroDeltasS", 1],
];
