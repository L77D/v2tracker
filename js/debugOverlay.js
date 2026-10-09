/* =============================================================================
   DETAR — Debug-Overlay (pinke Hilfslinien): Lauffeld-Begrenzung + FACE_CAM-
   Kegel + aktuelle Blickrichtung. Aktivieren per ?debug in der URL.
   Port aus dem Lokal-Prototyp; Kamera-Position kommt aus dem Karten-Frame.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { IDLE } from "./config.js";

const DEBUG_PINK = 0xff2fd6;
const FACECAM_SEGS = 24;
const _dbgV = new THREE.Vector3();

export class DebugOverlay {
  constructor(worldRoot, nodes, frame) {
    this.nodes = nodes;
    this.frame = frame;
    this.group = new THREE.Group();
    this.group.visible = false;
    worldRoot.add(this.group);

    this.roamRectGeo = new THREE.BufferGeometry();
    this.roamRectGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    const roamRect = new THREE.LineLoop(
      this.roamRectGeo,
      new THREE.LineBasicMaterial({ color: DEBUG_PINK, depthTest: false })
    );
    roamRect.renderOrder = 10;
    this.group.add(roamRect);

    this.roamFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: DEBUG_PINK, transparent: true, opacity: 0.18,
        depthTest: false, side: THREE.DoubleSide,
      })
    );
    this.roamFill.rotation.x = -Math.PI / 2;
    this.roamFill.renderOrder = 9;
    this.group.add(this.roamFill);

    this.faceCamGeo = new THREE.BufferGeometry();
    this.faceCamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((FACECAM_SEGS + 4) * 3), 3));
    const faceCamCone = new THREE.Line(
      this.faceCamGeo,
      new THREE.LineBasicMaterial({ color: DEBUG_PINK, depthTest: false })
    );
    faceCamCone.renderOrder = 10;
    this.group.add(faceCamCone);

    this.headingGeo = new THREE.BufferGeometry();
    this.headingGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
    const headingLine = new THREE.Line(
      this.headingGeo,
      new THREE.LineBasicMaterial({ color: 0xff8ae6, depthTest: false })
    );
    headingLine.renderOrder = 10;
    this.group.add(headingLine);
  }
  setVisible(v) { this.group.visible = v; }
  tick() {
    if (!this.group.visible) return;
    const FigureRoot = this.nodes.FigureRoot;
    const halfW = (IDLE.markerWidth * IDLE.roamFraction) / 2;
    const halfH = (IDLE.markerHeight * IDLE.roamFraction) / 2;
    const y = 0.0015;
    const a = this.roamRectGeo.attributes.position.array;
    a.set([-halfW, y, -halfH, halfW, y, -halfH, halfW, y, halfH, -halfW, y, halfH]);
    this.roamRectGeo.attributes.position.needsUpdate = true;
    this.roamFill.scale.set(halfW * 2, halfH * 2, 1);
    this.roamFill.position.y = y;

    const fx = FigureRoot.position.x;
    const fz = FigureRoot.position.z;
    const y2 = 0.002;
    const camL = this.frame.getCamLocal(_dbgV);
    if (!camL) return; // NaN-Schutz
    const camH = Math.atan2(camL.x - fx, camL.z - fz);
    const thr = (IDLE.cameraFacingThreshold * Math.PI) / 180;
    const r = Math.max(halfW, halfH) * 1.8;
    const c = this.faceCamGeo.attributes.position.array;
    let k = 0;
    const put = (px, pz) => { c[k++] = px; c[k++] = y2; c[k++] = pz; };
    put(fx, fz);
    for (let i = 0; i <= FACECAM_SEGS; i++) {
      const ang = camH - thr + (2 * thr * i) / FACECAM_SEGS;
      put(fx + Math.sin(ang) * r, fz + Math.cos(ang) * r);
    }
    put(fx, fz);
    this.faceCamGeo.attributes.position.needsUpdate = true;

    const h = this.headingGeo.attributes.position.array;
    const hy = FigureRoot.rotation.y;
    h.set([fx, y2, fz, fx + Math.sin(hy) * r * 1.15, y2, fz + Math.cos(hy) * r * 1.15]);
    this.headingGeo.attributes.position.needsUpdate = true;
  }
}

/* =============================================================================
   Tracker-Rahmen (?debug, 2026-10-09, Michael: „bricht das Tracking am
   Bildrand ab?"). Die Engine wertet das VOLLE Kamerabild aus (xr.js lädt jedes
   Videobild ungeschnitten in die Rechen-Textur); das Display zeigt davon nur
   den Ausschnitt, der den Canvas füllt (GlTextureRenderer: „cover" → auf
   hohen Handys fehlt links/rechts ein Streifen, oben/unten ist Displayrand =
   Kamerarand). Der Rahmen macht das sichtbar:
   - auf dem Bild: Erkennungsfläche des Targets (3:4-Crop, cyan) + ganze Karte
     (gestrichelt) aus der ROHPOSE — bei Verlust bleibt die letzte Lage rot stehen;
   - Mini-Karte oben rechts: Kamerabild (weißer Rahmen), Display-Ausschnitt
     (grau), Erkennungsfläche (cyan, rot sobald angeschnitten);
   - Zahlen: Anteil der Erkennungsfläche im Kamerabild / im Display, dazu die
     Werte im Moment des letzten Verlusts.
   Nur Darstellung, kein Eingriff ins Tracking. Nur im AR-Modus (nicht ?desktop).
   ============================================================================= */
const TF_INSET_W = 104;     // CSS-px Breite der Mini-Karte
const _tfV = new THREE.Vector3();

export class TrackerFrame {
  /* anchor: Rohpose-Träger (Matrix kamera-relativ, Einheit = Crop-Breite)
     camera: three-Kamera der Engine · targetData: Target-JSON (properties =
     Crop im Originalbild) · getVideo/getCanvas: aktuelle Pixelmaße
     fillViewport: XR8.GlTextureRenderer.fillTextureViewport */
  constructor({ anchor, camera, targetData, getVideo, getCanvas, fillViewport }) {
    this.anchor = anchor;
    this.camera = camera;
    this.getVideo = getVideo;
    this.getCanvas = getCanvas;
    this.fillViewport = fillViewport;
    this.tracked = false;
    this.lastLoss = null;          // { cam, disp } in % beim letzten Verlust
    this.last = null;              // { cam, disp } der letzten Rohpose

    // Ecken in Anchor-Einheiten (Ursprung = Crop-Mitte, x rechts, y hoch,
    // 1 = Crop-Breite = Kartenbreite beim Standard-Crop)
    const p = targetData.properties || {};
    const w = p.width || 3, h = p.height || 4;
    const cu = (p.left || 0) + w / 2, cv = (p.top || 0) + h / 2;
    const loc = (u, v) => [(u - cu) / w, -(v - cv) / w];
    this.cropCorners = [loc(cu - w / 2, cv - h / 2), loc(cu + w / 2, cv - h / 2), loc(cu + w / 2, cv + h / 2), loc(cu - w / 2, cv + h / 2)];
    const ow = p.originalWidth || w, oh = p.originalHeight || h;
    this.cardCorners = p.isRotated ? null : [loc(0, 0), loc(ow, 0), loc(ow, oh), loc(0, oh)];

    this.cv = document.createElement("canvas");
    this.cv.id = "trackerFrame";
    this.cv.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:40;";
    document.body.appendChild(this.cv);
    // Sonde für env(safe-area-inset-top) — Canvas kann env() nicht lesen
    this.safeTop = document.createElement("div");
    this.safeTop.style.cssText = "position:fixed;left:0;width:0;height:0;top:env(safe-area-inset-top, 0px);pointer-events:none;";
    document.body.appendChild(this.safeTop);
    this.ctx = this.cv.getContext("2d");
  }

  onFound() { this.tracked = true; }
  onLost() {
    this.tracked = false;
    if (this.last) this.lastLoss = { cam: this.last.cam, disp: this.last.disp };
  }

  // Ecken → normierte Canvas-Koordinaten (0..1, außerhalb = nicht im Display);
  // null, wenn eine Ecke hinter der Kamera liegt.
  project(corners) {
    const m = this.anchor.matrix, out = [];
    for (const [x, y] of corners) {
      _tfV.set(x, y, 0).applyMatrix4(m);
      if (_tfV.z >= 0) return null;
      _tfV.applyMatrix4(this.camera.projectionMatrix);
      out.push([(_tfV.x + 1) / 2, (1 - _tfV.y) / 2]);
    }
    return out;
  }

  tick() {
    const ctx = this.ctx, cv = this.cv;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * pr) || cv.height !== Math.round(H * pr)) {
      cv.width = Math.round(W * pr); cv.height = Math.round(H * pr);
    }
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const vid = this.getVideo(), can = this.getCanvas();
    if (!vid.videoWidth || !can.width) return;
    // Kamerabild in normierten Canvas-Koordinaten (ragt links/rechts bzw.
    // oben/unten über 0..1 hinaus)
    const vp = this.fillViewport(vid.videoWidth, vid.videoHeight, can.width, can.height);
    const vx = vp.offsetX / can.width, vy = vp.offsetY / can.height;
    const vw = vp.width / can.width, vh = vp.height / can.height;
    const toCam = ([x, y]) => [(x - vx) / vw, (y - vy) / vh];

    // Rohpose nur auswerten, solange getrackt — sonst die letzte Lage zeigen
    if (this.tracked) {
      const crop = this.project(this.cropCorners);
      if (crop) {
        this.last = {
          crop, card: this.cardCorners ? this.project(this.cardCorners) : null,
          cam: Math.round(100 * insideFraction(crop.map(toCam))),
          disp: Math.round(100 * insideFraction(crop)),
        };
      }
    }
    const s = this.last;
    const lostCol = "rgba(255,70,70,0.9)";

    // 1) Auf dem Bild
    if (s) {
      const scr = (q) => q.map(([x, y]) => [x * W, y * H]);
      if (s.card) poly(ctx, scr(s.card), this.tracked ? "rgba(255,255,255,0.8)" : lostCol, 1.5, [6, 5]);
      poly(ctx, scr(s.crop), this.tracked ? (s.cam < 100 ? "#ff4646" : "#33e0ff") : lostCol, 2.5);
    }

    // 2) Mini-Karte: Kamerabild auf TF_INSET_W skaliert
    const sc = TF_INSET_W / (vw * W);
    const iw = TF_INSET_W, ih = vh * H * sc;
    const ix = W - iw - 10, iy = 10 + this.safeTop.getBoundingClientRect().top;
    const toInset = ([x, y]) => { const [cx, cy] = toCam([x, y]); return [ix + cx * iw, iy + cy * ih]; };
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(ix - 4, iy - 4, iw + 8, ih + 64);
    // Display-Ausschnitt
    const d0 = toInset([0, 0]), d1 = toInset([1, 1]);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(d0[0], d0[1], d1[0] - d0[0], d1[1] - d0[1]);
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.strokeRect(d0[0], d0[1], d1[0] - d0[0], d1[1] - d0[1]);
    ctx.setLineDash([]);
    // Kamerabild
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.strokeRect(ix, iy, iw, ih);
    // Karte + Erkennungsfläche (außerhalb der Mini-Karte abgeschnitten)
    if (s) {
      ctx.save();
      ctx.beginPath(); ctx.rect(ix - 4, iy - 4, iw + 8, ih + 8); ctx.clip();
      if (s.card) poly(ctx, s.card.map(toInset), this.tracked ? "rgba(255,255,255,0.7)" : lostCol, 1, [3, 3]);
      poly(ctx, s.crop.map(toInset), this.tracked ? (s.cam < 100 ? "#ff4646" : "#33e0ff") : lostCol, 1.5);
      ctx.restore();
    }
    // Zahlen
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    const ty = iy + ih + 6;
    ctx.fillText(this.tracked ? "ERKANNT" : s ? "VERLOREN" : "SUCHT", ix, ty);
    ctx.fillText("Kamera  " + (s ? s.cam + "%" : "–"), ix, ty + 13);
    ctx.fillText("Display " + (s ? s.disp + "%" : "–"), ix, ty + 26);
    const l = this.lastLoss;
    ctx.fillStyle = "rgba(255,150,150,1)";
    ctx.fillText(l ? `weg: K${l.cam} D${l.disp}` : "weg: –", ix, ty + 39);
  }
}

function poly(ctx, pts, color, width, dash) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Anteil der Vierecksfläche innerhalb von [0,1]² (Sutherland-Hodgman-Clipping)
function insideFraction(pts) {
  const area = (p) => Math.abs(p.reduce((a, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x * y2 - x2 * y; }, 0)) / 2;
  const full = area(pts);
  if (!(full > 0)) return 0;
  let poly = pts;
  const clip = (inside, cut) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    poly = out;
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  clip((p) => p[0] >= 0, (a, b) => lerp(a, b, (0 - a[0]) / (b[0] - a[0])));
  if (poly.length) clip((p) => p[0] <= 1, (a, b) => lerp(a, b, (1 - a[0]) / (b[0] - a[0])));
  if (poly.length) clip((p) => p[1] >= 0, (a, b) => lerp(a, b, (0 - a[1]) / (b[1] - a[1])));
  if (poly.length) clip((p) => p[1] <= 1, (a, b) => lerp(a, b, (1 - a[1]) / (b[1] - a[1])));
  return poly.length < 3 ? 0 : Math.min(1, area(poly) / full);
}
