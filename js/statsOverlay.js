/* =============================================================================
   DETAR — StatsOverlay (?stats): Live-Diagnose am Gerät.
   Zeigt: Tracking-Status, Gyro-Status, Roh- vs. stabilisierten Jitter (mm,
   RMS der Frame-zu-Frame-Bewegung über die letzten ~90 getrackten Frames,
   normiert auf 150-mm-Karte). Damit lässt sich STAB am Handy mit ZAHLEN
   kalibrieren: erst minCutoff runter, bis „Stab" in Ruhe < ~0,3 mm, dann
   beta hoch, bis Bewegung ohne Nachziehen folgt.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { GYRO, STAB } from "./config.js";
import { BUILD } from "./version.js";

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const N = 90;

/* Jitter-Fenster: RMS der Frame-zu-Frame-Differenz in Kartenbreiten; rms()
   liefert Millimeter über die physische Kartenbreite (karten.json → breiteMm;
   bis Build 60 fest 150 mm → alle mm-Werte ≈ 2,4× zu groß, Richtwerte in
   CLAUDE.md seit Build 61 umgerechnet). */
class Ring {
  constructor(mm) { this.mm = mm; this.buf = []; this.prev = null; }
  push(x, y, z) {
    if (this.prev) {
      const dx = x - this.prev[0], dy = y - this.prev[1], dz = z - this.prev[2];
      this.buf.push(dx * dx + dy * dy + dz * dz);
      if (this.buf.length > N) this.buf.shift();
    }
    this.prev = [x, y, z];
  }
  reset() { this.prev = null; }
  rms() {
    if (!this.buf.length) return null;
    return Math.sqrt(this.buf.reduce((a, v) => a + v, 0) / this.buf.length) * this.mm;
  }
}

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
    const mm = Number(env?.karte?.breiteMm) || 63;
    this.raw = new Ring(mm);
    this.smooth = new Ring(mm);
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
    document.body.appendChild(this.box);
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
    if (this.stab.tracking) {
      this.anchor.matrix.decompose(_p, _q, _s);
      if (_s.x > 1e-8 && Number.isFinite(_p.x)) {
        this.raw.push(_p.x / _s.x, _p.y / _s.x, _p.z / _s.x);
      }
      this.stabRoot.matrix.decompose(_p, _q, _s);
      if (_s.x > 1e-8) this.smooth.push(_p.x / _s.x, _p.y / _s.x, _p.z / _s.x);
    } else {
      this.raw.reset();
      this.smooth.reset();
    }
    if (this.box.hidden) return; // versteckt → kein DOM-Update (Jitter-Ringe laufen weiter)
    const now = performance.now();
    if (now - this.lastDom < 500) return;
    this.lastDom = now;
    const f = (v) => (v == null ? "—" : v.toFixed(2) + " mm");
    const gy = GYRO.enabled === "nein" ? "DEAKTIVIERT (Toggle)"
      : !this.gyro ? "aus (?nogyro/Desktop)"
      : !this.gyro.enabled ? "keine Permission"
      : this.gyro.active ? "AKTIV" : "enabled, keine Events";
    const v = this.env?.getVideo?.();
    const cam = v && v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : "—";
    const pr = this.env?.renderer ? this.env.renderer.getPixelRatio().toFixed(1) : "—";
    const arb = this.stab.arb ?? {};
    const arbState = STAB.gravityArbiter === "nein" ? "AUS (Toggle)" : !arb.active ? "kein Gyro" : arb.flipped ? "GESPIEGELT→korrigiert" : "roh ok";
    const build = this.liveBuild == null ? `v${BUILD}`
      : this.liveBuild === BUILD ? `v${BUILD} (aktuell)`
      : `v${BUILD} — v${this.liveBuild} LIVE → neu laden!`;
    this.el.textContent =
      `Track: ${this.stab.tracking ? "FOUND" : "LOST"}  sichtbar: ${this.stabRoot.visible ? "ja" : "nein"}\n` +
      `Gyro:  ${gy}\n` +
      `Cam:   ${cam}  PR: ${pr}\n` +
      `Jitter roh:  ${f(this.raw.rms())}\n` +
      `Jitter stab: ${f(this.smooth.rms())}\n` +
      `Vision: ${this.stab.visionHz ?? "—"} Hz  ${this.stab.moving ? "BEWEGT" : "ruhig"}\n` +
      `Roh↔Stab: ${(this.stab.rawSkewDeg ?? 0).toFixed(1)}°  ${((this.stab.rawOffset ?? 0) * 1000).toFixed(1)}‰KB  Re-Erk.: ${this.stab.relocCount ?? 0}\n` +
      // Pose-Flip-Diagnose (2026-09-15): Schiedsrichter-Zustand, Kippwinkel der
      // Kartennormale gegen die Sichtlinie, z-Anteil der Normale im Erdframe
      // (1 = senkrecht nach oben; negativ/klein bei Karte auf dem Tisch = die
      // Engine liefert die gespiegelte Lösung), Zahl der Wechsel; dazu die bis
      // Build 58 unsichtbaren automatischen Snaps und Scale-Re-Locks.
      `Flip: ${arbState}  Kipp ${(arb.tiltDeg ?? 0).toFixed(0)}°  n·up roh ${(arb.zRaw ?? 0).toFixed(2)} → gew. ${(arb.zChosen ?? 0).toFixed(2)}` +
      `  Flips ${this.stab.flipCount ?? 0}  Snaps ${this.stab.snapCount ?? 0}  Re-Lock ${this.stab.relockCount ?? 0}\n` +
      `Build: ${build}\n` +
      // Engine-Variante (2026-09-09): SIMD oder Nicht-SIMD-Fallback (main.js
      // wählt per WebAssembly.validate; Konsole: „8th Wall XR Version: …s"
      // = SIMD, ohne s = nicht-SIMD)
      `Engine: ${this.env?.engine ?? "—"}\n` +
      // Karten-Kennung (2026-09-07): zeigt, welche Kartendatei der Browser
      // tatsächlich geladen hat — Safari cached jede Datei einzeln (Pages:
      // max-age 600), ein frischer Build kann eine alte Karte mitschleppen.
      `Karte: ${this.env?.card?.id ?? "—"} · ${this.env?.card?.edition === "public" ? "PUBLIC" : "Firma"} · ${this.env?.card?.questions?.length ?? "?"} Fragen` +
      `${this.env?.card?.questions?.some((q) => q.link) ? " · Link-Frage" : ""}\n` +
      // Kartendesign (2026-09-15): aktive id aus ?karte (targets/8thwall/
      // karten.json), Target-Dateibasis und die physische Breite, die als
      // physicalWidthInMeters an die Engine ging.
      `Design: ${this.env?.karte?.id ?? "—"} · ${this.env?.karte?.target ?? "—"}.json · ${this.env?.karte?.breiteMm ?? "—"} mm`;
  }
}
