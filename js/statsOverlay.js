/* =============================================================================
   DETAR — StatsOverlay (?stats): Live-Diagnose am Gerät.
   Zeigt Tracking-/Gyro-Status und — seit Build 62 (Handheld-Analyse,
   docs/handheld-jitter-analyse.md) — Kennzahlen, die Tracking-Rauschen von
   Handbewegung trennen (js/jitterMetrics.js), über ein 5-s-Fenster:
     Takt      Vision-Hz, Render-fps, Messabstand p50/p95
     Rauschen  2. Differenz roh|stab in mm und Grad, nur neue Messungen
     Kopf      Messpunkt 1,5 Kartenbreiten über der Kartenmitte in Bildschirm-px:
               Rauschen roh|stab, Versatz Figur↔Karte, Lauf ohne Bild (px/s)
     F2F       alte Frame-zu-Frame-Zahl (bis Build 61 „Jitter"), jetzt nur auf
               neuen Messungen — enthält Handbewegung, taugt nur für F0/Stativ
     Modus     Anteil BEWEGT, Wechsel/10 s, Auslöser, Drift ÷ Schwelle
     Gyro      Drehrate des Handys, angewendete Deltas/s
   Knopf „Messung 10 s": friert die Kennzahlen über 10 s ein → „Kopieren"
   (Tabellenzeile mit Kopf, Tab-getrennt) und „Log ↓" (alle Tick-Proben als
   JSON). Fall-Knopf F0–F4 = Messfälle aus dem Analyse-Dokument.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { GYRO, STAB } from "./config.js";
import { BUILD } from "./version.js";
import { computeMetrics, METRIC_COLS } from "./jitterMetrics.js";

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _gq = new THREE.Quaternion();
const WIN_MS = 5000;      // Anzeige-Fenster (CLAUDE.md: 3–5 s füllen lassen)
const CAPTURE_MS = 10000; // „Messung 10 s"
const HEAD_KB = 1.5;      // fester Messpunkt über der Kartenmitte (≈ Kopfhöhe), Kartenbreiten
const FAELLE = ["F0 Stativ", "F1 abgestützt", "F2 freihändig", "F3 Schwenk", "F4 verdecken"];

// Toggle-Reihenfolge 1–10 wie im Dev-Panel → Kennung „1111111111" in der Tabellenzeile
const toggleCode = () => [
  STAB.enabled, STAB.normalize, STAB.deadZones, STAB.lostHold, STAB.nanGuard,
  STAB.snap, GYRO.enabled, STAB.extrapolate, STAB.scaleLock, STAB.gravityArbiter,
].map((v) => (v === "nein" ? "0" : "1")).join("");

const fx = (v, d) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));

export class StatsOverlay {
  constructor(anchorGroup, stabRoot, stab, gyro, env = null) {
    this.anchor = anchorGroup;
    this.stabRoot = stabRoot;
    this.stab = stab;
    this.gyro = gyro;
    this.env = env; // { getVideo, renderer } — Kamera-Auflösung + PixelRatio (Finding 1/2)
    // Versions-Check: version.js frisch vom Server holen (am Cache vorbei) und
    // mit dem LAUFENDEN Build vergleichen → „hab ich den neuesten Stand?"
    this.liveBuild = null;
    fetch("./js/version.js", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => {
        const m = t && t.match(/BUILD\s*=\s*(\d+)/);
        if (m) this.liveBuild = +m[1];
      })
      .catch(() => {}); // offline/Fehler → nur die eigene Nummer anzeigen
    this.mm = Number(env?.design?.breiteMm) || 63;
    this.win = [];          // Tick-Proben der letzten WIN_MS (jitterMetrics.js)
    this.cap = null;        // laufende „Messung 10 s": { t0, samples, snaps0, nan0, lostMs, lastT }
    this.result = null;     // letzte fertige Messung: { metrics, meta, samples }
    this.fall = 2;          // Index in FAELLE (Standard F2 = Demo-Normalfall)
    this.gyroAng = 0;       // aufsummierter Gyro-Drehwinkel (Grad)
    this.gyroPrev = null;
    this.lastDom = 0;
    // LAYOUT (2026-09-15, Michael: iPhone 12 mini, Panel nahm das ganze Bild ein):
    // oben links unter der Safe-Area, links/rechts 8 px Rand, rechts Platz für den
    // ⚙-Dev-Knopf (top-right, ~70 px); Zeilen umbrechen (pre-wrap) statt über den
    // Rand zu laufen; 10-px-Monospace; Höhe auf 45 % des Bildschirms gedeckelt,
    // damit Karte, Figur und Menü sichtbar bleiben.
    this.box = document.createElement("div");
    this.box.id = "statsBox";
    this.box.style.cssText =
      "position:fixed;top:calc(40px + env(safe-area-inset-top, 0px));left:8px;z-index:50;" +
      "max-width:calc(100vw - 96px);max-height:45vh;overflow:hidden;box-sizing:border-box;" +
      "background:rgba(0,0,0,0.72);border-radius:8px;padding:6px 8px;" +
      "font:10px/1.35 monospace;pointer-events:none";
    this.el = document.createElement("div");
    this.el.style.cssText = "color:#0f0;white-space:pre-wrap;word-break:break-word";
    this.box.appendChild(this.el);
    // EIN/AUS-Knopf (2026-09-15): „📊" oben links, Gegenstück zum ⚙-Dev-Knopf
    // oben rechts. Zustand überlebt Neuladen (localStorage, fail-safe: ohne
    // Speicher bleibt das Panel sichtbar). Versteckt = kein DOM-Update im tick().
    this.toggle = document.createElement("button");
    this.toggle.id = "statsToggle";
    this.toggle.style.cssText =
      "position:fixed;top:calc(8px + env(safe-area-inset-top, 0px));left:8px;z-index:120;" +
      "background:rgba(0,0,0,0.72);color:#0f0;border:1px solid #0f0;border-radius:8px;" +
      "font:bold 12px monospace;padding:5px 8px;cursor:pointer;pointer-events:auto";
    let hidden = false;
    try { hidden = localStorage.getItem("detar.statsHidden") === "1"; } catch (e) { /* kein Speicher */ }
    this.setHidden(hidden);
    this.toggle.onclick = () => {
      const h = !this.box.hidden;
      this.setHidden(h);
      try { localStorage.setItem("detar.statsHidden", h ? "1" : "0"); } catch (e) { /* egal */ }
    };
    document.body.appendChild(this.toggle);
    // Gyro-Toggle: GYRO.enabled wird pro Frame geprüft → wirkt sofort.
    // Kill-Switch-Vergleich am Gerät ohne Neuladen (Jitter mit/ohne Gyro).
    this.btn = document.createElement("button");
    this.btn.style.cssText =
      "margin-top:6px;width:100%;pointer-events:auto;cursor:pointer;" +
      "font:bold 10px monospace;border:none;border-radius:6px;padding:4px 8px";
    this.btn.onclick = () => {
      GYRO.enabled = GYRO.enabled === "nein" ? "ja" : "nein";
      this.paintBtn();
    };
    this.paintBtn();
    this.box.appendChild(this.btn);
    // Messung (2026-09-25): Fall wählen · 10 s aufnehmen · Ergebnis kopieren / Log laden
    const mk = (label, on) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = this.btn.style.cssText + ";background:#0a3;color:#fff;margin:0 4px 4px 0;width:auto";
      b.onclick = on;
      return b;
    };
    const row = document.createElement("div");
    this.fallBtn = mk("", () => { this.fall = (this.fall + 1) % FAELLE.length; this.paintFall(); });
    this.capBtn = mk("Messung 10 s", () => this.startCapture());
    this.copyBtn = mk("Kopieren", () => this.copyResult());
    this.logBtn = mk("Log ↓", () => this.downloadLog());
    this.copyBtn.hidden = this.logBtn.hidden = true;
    row.append(this.fallBtn, this.capBtn, this.copyBtn, this.logBtn);
    this.resEl = document.createElement("div");
    this.resEl.style.cssText = "color:#ff0;white-space:pre-wrap;margin-bottom:4px";
    // OBEN im Panel: das Panel ist auf 45 vh gedeckelt, unten würde abgeschnitten
    this.box.insertBefore(this.resEl, this.el);
    this.box.insertBefore(row, this.resEl);
    this.btn.style.margin = "0 0 4px 0";
    this.box.insertBefore(this.btn, row); // Gyro-Knopf ebenfalls nach oben
    this.paintFall();
    document.body.appendChild(this.box);
  }
  paintFall() { this.fallBtn.textContent = FAELLE[this.fall]; }

  startCapture() {
    const st = this.stab.snapshot();
    this.cap = { t0: performance.now(), samples: [], snaps0: st.snapCount,
      nan0: st.nanCount, lostMs: 0, lastT: performance.now() };
    this.result = null;
    this.copyBtn.hidden = this.logBtn.hidden = true;
    this.resEl.textContent = "";
  }
  finishCapture(now) {
    const c = this.cap;
    this.cap = null;
    const metrics = computeMetrics(c.samples, this.mm);
    const meta = {
      build: BUILD, datum: new Date().toISOString(), fall: FAELLE[this.fall].split(" ")[0],
      toggles: toggleCode(),
      minSpeed: STAB.minSpeed, minAngSpeed: STAB.minAngSpeed, minCutoff: STAB.minCutoff,
      beta: STAB.beta, rotMinCutoff: STAB.rotMinCutoff, rotBeta: STAB.rotBeta,
      latencyMs: STAB.latencyMs, breiteMm: this.mm, design: this.env?.design?.id ?? null,
      snaps: this.stab.snapshot().snapCount - c.snaps0,
      nan: this.stab.snapshot().nanCount - c.nan0,
      verlorenMs: Math.round(c.lostMs),
      dauerMs: Math.round(now - c.t0),
    };
    this.result = { metrics, meta, samples: c.samples };
    this.copyBtn.hidden = this.logBtn.hidden = false;
    this.resEl.textContent = metrics
      ? `Messung ${meta.fall} fertig: Kopf stab ${fx(metrics.kopfHfStabPx, 2)} px · Versatz ${fx(metrics.versatzPx, 1)} px · ` +
        `BEWEGT ${fx(metrics.bewegtPct, 0)} % · Snaps ${meta.snaps} · verloren ${meta.verlorenMs} ms`
      : `Messung ${meta.fall}: zu wenig Daten (Karte im Bild?)`;
  }
  tableText() {
    const { metrics, meta } = this.result;
    const metaCols = ["build", "datum", "fall", "toggles", "minSpeed", "minAngSpeed", "minCutoff",
      "beta", "rotMinCutoff", "rotBeta", "latencyMs", "design", "snaps", "nan", "verlorenMs"];
    const head = [...metaCols, ...METRIC_COLS.map(([k]) => k)].join("\t");
    const vals = [...metaCols.map((k) => meta[k] ?? ""),
      ...METRIC_COLS.map(([k, d]) => (metrics && Number.isFinite(metrics[k]) ? metrics[k].toFixed(d).replace(".", ",") : ""))].join("\t");
    return head + "\n" + vals;
  }
  copyResult() {
    if (!this.result) return;
    const text = this.tableText();
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* dann bleibt nur der Log */ }
      ta.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(fallback);
    else fallback();
    this.copyBtn.textContent = "Kopiert ✓";
    setTimeout(() => { this.copyBtn.textContent = "Kopieren"; }, 1500);
  }
  downloadLog() {
    if (!this.result) return;
    const { meta } = this.result;
    const blob = new Blob([JSON.stringify(this.result)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `detar-messung-${meta.fall}-b${meta.build}-${meta.datum.replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* Kopf-Messpunkt einer kamera-relativen Pose (Position in Szenen-Einheiten,
     Scale = Kartenbreite) → Bildschirm-px relativ zur Bildmitte, oder null. */
  headPx(pos, quat, scale) {
    const cam = this.env?.camera, canvas = this.env?.renderer?.domElement;
    if (!cam || !canvas || !canvas.clientWidth) return null;
    _v.set(0, 0, HEAD_KB * scale).applyQuaternion(quat).add(pos).applyMatrix4(cam.projectionMatrix);
    if (!Number.isFinite(_v.x) || !Number.isFinite(_v.y)) return null;
    return [_v.x * 0.5 * canvas.clientWidth, _v.y * 0.5 * canvas.clientHeight];
  }
  setHidden(h) {
    this.box.hidden = h;
    this.toggle.textContent = h ? "📊 Stats" : "📊 aus";
    this.toggle.title = h ? "Stats einblenden" : "Stats ausblenden";
  }
  paintBtn() {
    const on = GYRO.enabled !== "nein";
    this.btn.textContent = on ? "Gyro AN — tippen: aus" : "Gyro AUS — tippen: an";
    this.btn.style.background = on ? "#ffdd00" : "#555";
    this.btn.style.color = on ? "#111" : "#eee";
  }
  tick() {
    const now = performance.now();
    // Stabilizer-Zustand nur über snapshot() lesen (Stufe 3c): ein Objekt, pro Frame aktualisiert
    const st = this.stab.snapshot();
    // Gyro-Drehrate: Winkel zwischen aufeinanderfolgenden Orientierungen
    // aufsummieren (misst die Handdrehung auch bei Toggle 7 aus)
    if (this.gyro?.active) {
      if (this.gyroPrev) this.gyroAng += (this.gyroPrev.angleTo(this.gyro.qCur) * 180) / Math.PI;
      (this.gyroPrev ??= new THREE.Quaternion()).copy(this.gyro.qCur);
    }
    let sample = null;
    if (st.tracking && this.stabRoot.visible) {
      this.stabRoot.matrix.decompose(_p, _q, _s);
      const sc = _s.x;
      if (sc > 1e-8 && Number.isFinite(_p.x)) {
        sample = {
          t: now, n: st.newMeas, m: st.moving,
          sp: [_p.x / sc, _p.y / sc, _p.z / sc], sq: [_q.x, _q.y, _q.z, _q.w],
          sx: this.headPx(_p, _q, sc),
          ga: st.gyroApplied, ms: st.modeSwitches, gw: this.gyro?.active ? this.gyroAng : null,
        };
        if (st.newMeas) {
          // Rohmessung nach Schiedsrichter; in Kartenbreiten, wenn normiert wird
          const norm = STAB.normalize !== "nein";
          const r = st.rawPos;
          sample.rp = norm ? [r.x, r.y, r.z] : [r.x / sc, r.y / sc, r.z / sc];
          sample.rq = [st.rawQuat.x, st.rawQuat.y, st.rawQuat.z, st.rawQuat.w];
          _gq.copy(st.rawQuat);
          sample.rx = this.headPx(_v.copy(r).multiplyScalar(norm ? sc : 1).clone(), _gq, sc);
        }
      }
    }
    if (sample) this.win.push(sample);
    while (this.win.length && now - this.win[0].t > WIN_MS) this.win.shift();
    if (this.cap) {
      if (sample) this.cap.samples.push(sample);
      else this.cap.lostMs += now - this.cap.lastT;
      this.cap.lastT = now;
      if (now - this.cap.t0 >= CAPTURE_MS) this.finishCapture(now);
    }
    if (this.box.hidden) return; // versteckt → kein DOM-Update (Fenster + Messung laufen weiter)
    if (now - this.lastDom < 500) return;
    this.lastDom = now;
    this.capBtn.textContent = this.cap ? `läuft … ${Math.ceil((CAPTURE_MS - (now - this.cap.t0)) / 1000)} s` : "Messung 10 s";
    const gy = GYRO.enabled === "nein" ? "DEAKTIVIERT (Toggle)"
      : !this.gyro ? "aus (?nogyro/Desktop)"
      : !this.gyro.enabled ? "keine Permission"
      : this.gyro.active ? "AKTIV" : "enabled, keine Events";
    const v = this.env?.getVideo?.();
    const cam = v && v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : "—";
    const pr = this.env?.renderer ? this.env.renderer.getPixelRatio().toFixed(1) : "—";
    const arb = st.arb;
    const arbState = STAB.gravityArbiter === "nein" ? "AUS (Toggle)" : !arb.active ? "kein Gyro" : arb.flipped ? "GESPIEGELT→korrigiert" : "roh ok";
    // Engine-Variante (2026-09-09): SIMD oder Nicht-SIMD-Fallback (arSession.js
    // wählt per WebAssembly.validate; Konsole: „8th Wall XR Version: …s"
    // = SIMD, ohne s = nicht-SIMD)
    const build = this.liveBuild == null ? `v${BUILD}`
      : this.liveBuild === BUILD ? `v${BUILD} (aktuell)`
      : `v${BUILD} — v${this.liveBuild} LIVE → neu laden!`;
    this.el.textContent =
      // Kompakt seit Build 62 (mehr Kennzahl-Zeilen, Panel ist auf 45 vh gedeckelt)
      `Track: ${st.tracking ? "FOUND" : "LOST"} · sichtbar: ${this.stabRoot.visible ? "ja" : "nein"} · Gyro: ${gy}\n` +
      `Cam: ${cam} PR: ${pr} · Build: ${build} · Engine: ${this.env?.engine ?? "—"}\n` +
      this.metricLines() +
      `Roh↔Stab: ${st.rawSkewDeg.toFixed(1)}°  ${(st.rawOffset * 1000).toFixed(1)}‰KB  Re-Erk.: ${st.relocCount}\n` +
      // Pose-Flip-Diagnose (2026-09-15): Schiedsrichter-Zustand, Kippwinkel der
      // Kartennormale gegen die Sichtlinie, z-Anteil der Normale im Erdframe
      // (1 = senkrecht nach oben; negativ/klein bei Karte auf dem Tisch = die
      // Engine liefert die gespiegelte Lösung), Zahl der Wechsel; dazu die bis
      // Build 58 unsichtbaren automatischen Snaps und Scale-Re-Locks.
      `Flip: ${arbState}  Kipp ${(arb.tiltDeg ?? 0).toFixed(0)}°  n·up roh ${(arb.zRaw ?? 0).toFixed(2)} → gew. ${(arb.zChosen ?? 0).toFixed(2)}` +
      `  Flips ${st.flipCount}  Snaps ${st.snapCount}  Re-Lock ${st.relockCount}  NaN ${st.nanCount}\n` +
      // Karten-Kennung (2026-09-07): zeigt, welche Kartendatei der Browser
      // tatsächlich geladen hat — Safari cached jede Datei einzeln (Pages:
      // max-age 600), ein frischer Build kann eine alte Karte mitschleppen.
      `Karte: ${this.env?.card?.id ?? "—"} · ${this.env?.card?.edition === "public" ? "PUBLIC" : "Firma"} · ${this.env?.card?.questions?.length ?? "?"} Fragen` +
      `${this.env?.card?.questions?.some((q) => q.link) ? " · Link-Frage" : ""}\n` +
      // Kartendesign (2026-09-15; seit Build 72 aus daten.json → designs,
      // gewählt per ?design): id, Target-Datei im Kartenordner und die
      // physische Breite, die als physicalWidthInMeters an die Engine ging.
      `Design: ${this.env?.design?.id ?? "—"} · ${this.env?.design?.target ?? "—"} · ${this.env?.design?.breiteMm ?? "—"} mm`;
  }

  /* Kennzahlen-Zeilen über das 5-s-Fenster (Abschnitt b der Analyse). */
  metricLines() {
    const M = computeMetrics(this.win, this.mm);
    const st = this.stab;
    const drift = `${fx(st.driftSpeed / STAB.minSpeed, 1)}×/${fx(st.driftAngSpeed / STAB.minAngSpeed, 1)}×`;
    const modus = `Modus: ${st.moving ? "BEWEGT" : "ruhig"} · ${fx(M?.bewegtPct, 0)} % bewegt · ` +
      `${fx(M?.wechsel10s, 1)} Wechsel/10 s · ${st.diag?.moveCause ?? "—"} · Drift ${drift}\n`;
    if (!M) return `Takt/Rauschen: — (Karte im Bild halten, ${WIN_MS / 1000} s)\n` + modus;
    return (
      `Takt: Vision ${fx(M.visionHz, 0)} Hz · Render ${fx(M.renderFps, 0)} fps · Δt p50 ${fx(M.dtP50, 0)} / p95 ${fx(M.dtP95, 0)} ms\n` +
      `Rauschen roh|stab: ${fx(M.hfRohMm, 3)}|${fx(M.hfStabMm, 3)} mm · ${fx(M.hfRohDeg, 3)}|${fx(M.hfStabDeg, 3)}°\n` +
      `Kopf px roh|stab: ${fx(M.kopfHfRohPx, 2)}|${fx(M.kopfHfStabPx, 2)} · Versatz ${fx(M.versatzPx, 1)} · Lauf o. Bild ${fx(M.laufPxS, 0)} px/s\n` +
      `F2F roh|stab: ${fx(M.f2fRohMm, 2)}|${fx(M.f2fStabMm, 2)} mm (mit Handbewegung)\n` +
      modus +
      `Gyro-Rate: ${fx(M.gyroDps, 1)} °/s · Deltas ${fx(M.gyroDeltasS, 0)}/s\n`
    );
  }
}
