/* =============================================================================
   DETAR — AR-Sitzung: 8th-Wall-Engine laden, Kamera-Pipeline aufsetzen, die
   Bildpose in die kamera-relative Rohpose des PoseStabilizers übersetzen und
   die Szene (js/experience.js) daran hängen. Bis Build 86 Teil von main.js
   (startAR, detarPipelineModule, loadEngine, loadTargetData, Engine-Variante),
   seit Refactoring Stufe 3b eigenes Modul; main.js ruft nur noch
   preloadEngine() im Boot und startAR() aus der Start-Geste.

   TRACKING (seit 2026-09-09, Branch 8thwall-image-targets): Die Kamera und die
   Bilderkennung liefert die Open-Source-8th-Wall-Engine (MIT, ohne SLAM). Sie
   läuft in einer eigenen Kamera-Pipeline (XR8.run) — KEIN SLAM/World-Tracking
   (disableWorldTracking: true), kein Niantic-Cloud-Aufruf, kein API-Key. Die
   Engine wird ERST in der Start-Geste geladen (Splash → „Scan starten"), vorher
   läuft weder Skript noch Kamera. Die Bildpose kommt als Event
   (reality.imagefound / imageupdated / imagelost) in Szenen-Koordinaten und wird
   hier in die KAMERA-relative Rohpose umgerechnet, die der PoseStabilizer seit
   dem MindAR-Stand erwartet — Glättung, Gyro-Fusion, Median-Aufsetzen, ?stats
   und die gesamte Choreographie bleiben unverändert.

   SKALIERUNG: Die Anchor-Scale wird auf die KARTENBREITE in Szeneneinheiten
   gesetzt (8th Wall: scale × scaledWidth; der 3:4-Crop des Targets behält die
   volle Kartenbreite, s. docs/8thwall-migration.md). Damit ist eine Anchor-
   Einheit = eine Kartenbreite — genau wie bei MindAR — und worldRoot.scale =
   1/cardWidth lässt alle getunten Werte (Lauffeld, Bubble, Sprünge …) gelten.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { SCENE, CAM } from "./config.js";
import { PoseStabilizer } from "./poseStabilizer.js";
import { buildExperience } from "./experience.js";
import { buildSupport } from "./supportUI.js";
import { el } from "./util.js";

// 8th-Wall-Engine, selbst gehostet (Open-Source-Build, MIT — s. vendor/8thwall/
// README.md). xr.js lädt daneben den Chunk „slam", der in der Open-Source-Engine
// xr-tracking.js ist: der reine Bildtracker, KEIN SLAM-Binary.
//
// ZWEI VARIANTEN (Production-Härtung 2026-09-09): vendor/8thwall/ ist mit
// WASM-SIMD gebaut (wasmreleasesimd; braucht iOS 16.4 / Chrome 91 — ältere
// Browser lehnen das Modul beim Instanziieren ab, die Engine stirbt nach dem
// Klick), vendor/8thwall-nosimd/ ohne SIMD (wasmrelease; läuft ab iOS 11 /
// Chrome 57, nur langsamer). Der Test unten ist byte-identisch mit der Engine-
// eigenen Prüfung (wasm-feature-detect: v128-Konstante + i8x16.add). Der Chunk
// xr-tracking.js wird von xr.js relativ zu seinem EIGENEN Pfad geladen — die
// Variante des Kerns zieht also automatisch den passenden Tracker nach.
// ?nosimd erzwingt die Nicht-SIMD-Variante (Test); ?stats zeigt die Wahl.
function hasWasmSimd() {
  try {
    return typeof WebAssembly === "object" && WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]));
  } catch (e) { return false; }
}
const NOSIMD = new URLSearchParams(location.search).has("nosimd");
const ENGINE_SIMD = !NOSIMD && hasWasmSimd();
export const ENGINE_VARIANT = ENGINE_SIMD ? "SIMD" : (NOSIMD ? "nicht-SIMD (?nosimd)" : "nicht-SIMD (Fallback)");
export const XR_ENGINE_URL = ENGINE_SIMD ? "./vendor/8thwall/xr.js" : "./vendor/8thwall-nosimd/xr.js";

/* Engine-Kern VORLADEN (Netzwerk, nicht ausgeführt) — per JS statt als <link>
   in index.html, weil die Variante (SIMD / nicht-SIMD) vom Gerät abhängt; so
   lädt jedes Gerät nur die eine xr.js, die es auch nutzt. Der Tracker-Chunk
   kommt weiterhin erst nach dem Klick. */
export function preloadEngine() {
  const pre = document.createElement("link");
  pre.rel = "preload"; pre.as = "script"; pre.href = XR_ENGINE_URL;
  document.head.appendChild(pre);
}

/* --------------------------------------------------------------------------
   8th-Wall-Engine LAZY laden — erst aus der Start-Geste heraus. Vor dem Klick
   auf „Scan starten" läuft kein Engine-Skript und keine Kamera. xr.js zieht
   über data-preload-chunks="slam" den Tracking-Chunk nach (Open-Source-Engine:
   xr-tracking.js = Bildtracker ohne SLAM) und feuert danach `xrloaded`.
   -------------------------------------------------------------------------- */
const ENGINE_LOAD_TIMEOUT_MS = 30000; // großzügig für langsame Netze (xr-tracking.js ≈ 3,8 MB)
function loadEngine() {
  if (window.XR8) return Promise.resolve(window.XR8);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = XR_ENGINE_URL;
    s.async = true;
    s.setAttribute("data-preload-chunks", "slam");
    // Timeout (2026-09-15): lädt xr.js, feuert aber nie `xrloaded` (z. B. WASM-
    // Instanziierung schlägt fehl), hing das Promise vorher für immer — Button
    // blieb ausgegraut, kein Fehlertext.
    const onLoaded = () => { clearTimeout(timer); resolve(window.XR8); };
    const fail = (msg) => { window.removeEventListener("xrloaded", onLoaded); reject(new Error(msg)); };
    const timer = setTimeout(() => fail("8th-Wall-Engine antwortet nicht (Timeout " + ENGINE_LOAD_TIMEOUT_MS / 1000 + " s): " + XR_ENGINE_URL),
      ENGINE_LOAD_TIMEOUT_MS);
    s.onerror = () => { clearTimeout(timer); fail("8th-Wall-Engine nicht ladbar: " + XR_ENGINE_URL +
      " (Build nach vendor/8thwall/ legen, s. vendor/8thwall/README.md)"); };
    window.addEventListener("xrloaded", onLoaded, { once: true });
    document.head.appendChild(s);
  });
}

/* Target-Daten (JSON aus image-target-cli) laden. Das Luminanz-Bild wird
   NEBEN der JSON gesucht (resources.luminanceImage) — so kann ein frisch
   generierter CLI-Ordner 1:1 nach karten/<id>/targets/ kopiert werden, ohne den
   von der CLI fest eingetragenen Pfad „image-targets/…" anzupassen. */
async function loadTargetData(card, design) {
  const targetUrl = design.targetUrl;
  const res = await fetch(targetUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Target-Datei fehlt: " + targetUrl + " (Design „" + design.id + "“ der Karte „" + card.id + "“)");
  const data = await res.json();
  const base = new URL(targetUrl, location.href);
  const lum = data.resources?.luminanceImage;
  data.imagePath = new URL(lum || data.imagePath, base).href;
  // Karte liegt in der Hand → beweglich (kein „static target"). Physische
  // Breite = Kartenbreite des Designs in daten.json (breiteMm, Standard
  // 63 mm laut Druckspezifikation; bis Build 56 SCENE.cardWidth = 59 mm):
  // damit ist detail.scale metrisch; die Figur hängt davon nicht ab
  // (Anchor-Einheit = Kartenbreite, s. Kopfkommentar).
  data.moveable = true;
  data.physicalWidthInMeters = design.breiteMm / 1000;
  return data;
}

/* --------------------------------------------------------------------------
   AR-Modus (8th Wall Image Targets). Tracking-Glättung: eigener PoseStabilizer
   (One-Euro + SLERP + Dead-Zone + Lost-Hold + Median-Aufsetzen) zwischen
   Rohpose und Figur — die Figur hängt unter stabRoot (Kind der KAMERA, weil
   der Stabilizer kamera-relativ arbeitet); `anchor` ist eine Gruppe außerhalb
   der Szene, deren Matrix pro Frame aus der 8th-Wall-Bildpose gebaut wird
   (Kamera⁻¹ × Bild, Scale = Kartenbreite). Der Stabilizer kopiert die Pose
   geglättet nach stabRoot und steuert auch die Sichtbarkeit. NaN-Schutz und
   Behavior-Pause bei Verlust bleiben wie gehabt.

   Aufgelöst wird das Promise, sobald die Kamera läuft und die Szene steht
   (onStart); verworfen bei Kamera-Fehler (onCameraStatusChange „failed" →
   NotAllowedError für den Kamera-abgelehnt-Bildschirm) oder Engine-Ausnahme.

   @param ctx { card, design, gyro, log, devLog, DebugOverlay, StatsOverlay, attachDevTools }
     gyro           GyroFusion aus der Start-Geste (iOS-Permission) oder null
     log            Konsole nur in Entwickler-Sessions
     StatsOverlay   Klasse (nur mit ?stats geladen) oder null
     attachDevTools (exp) → Dev-Panel/Timeline nachladen (main.js, nur ?dev/?timeline)
   -------------------------------------------------------------------------- */
export async function startAR(ctx) {
  const container = el("ar-container");
  const [XR8, targetData] = await Promise.all([loadEngine(), loadTargetData(ctx.card, ctx.design)]);

  // XR8.Threejs verlangt das globale THREE (>= r125) — dieselbe Instanz wie
  // unsere Module (vendor/three/three.module.js, relativer Import), sonst
  // passen Klassen nicht zusammen.
  window.THREE = THREE;

  // Canvas für Kamerabild + Szene. Die Engine liest canvas.width/height jeden
  // Frame und passt Renderer/Projektion an (onCanvasSizeChange) — Größe setzen
  // wir selbst: CSS-Größe × PixelRatio, gecappt (CAM.maxPixelRatio, Finding 2:
  // Cap 2 statt 3 auf iPhones gibt der Vision-Schleife GPU-Luft).
  const canvas = document.createElement("canvas");
  canvas.id = "xr-canvas";
  container.appendChild(canvas);
  const sizeCanvas = () => {
    const pr = Math.min(window.devicePixelRatio || 1, CAM.maxPixelRatio);
    canvas.width = Math.max(1, Math.round(container.clientWidth * pr));
    canvas.height = Math.max(1, Math.round(container.clientHeight * pr));
  };
  sizeCanvas();
  window.addEventListener("resize", () => requestAnimationFrame(sizeCanvas));
  window.addEventListener("orientationchange", () => setTimeout(sizeCanvas, 300));

  // NUR Bildtracking: disableWorldTracking MUSS vor pipelineModule() und run()
  // stehen. Ohne World-Tracking fragt die Engine weder Bewegungssensoren an
  // noch lädt sie je einen SLAM-Chunk; unsere GyroFusion bleibt davon getrennt.
  XR8.XrController.configure({
    disableWorldTracking: true,
    imageTargetData: [targetData],
  });

  return new Promise((resolve, reject) => {
    XR8.addCameraPipelineModules([
      XR8.XrController.pipelineModule(),      // „reality": Bildtracker, feuert reality.image*-Events
      XR8.GlTextureRenderer.pipelineModule(), // Kamerabild auf den Canvas (vor der Szene)
      XR8.Threejs.pipelineModule(),           // three.js-Szene/-Kamera/-Renderer auf demselben Canvas
      detarPipelineModule(XR8, ctx, { resolve, reject }),
    ]);
    XR8.run({
      canvas,
      cameraConfig: { direction: XR8.XrConfig.camera().BACK },
      // ANY statt MOBILE: ohne World-Tracking läuft Bildtracking auch am
      // Rechner mit Webcam (Schnelltest) — die Engine lässt das nur so zu.
      allowedDevices: XR8.XrConfig.device().ANY,
    });
  });
}

/* Unser Kamera-Pipeline-Modul: baut in onStart die Szene auf (nach dem
   Threejs-Modul, damit XR8.Threejs.xrScene() steht), tickt in onUpdate und
   übersetzt die Bild-Events in die bisherigen Hooks (Stabilizer, Controller,
   Suchrahmen, Karte-verloren-Hinweis). Ereignis-Zuordnung zu MindAR:
     anchor.onTargetFound → reality.imagefound
     (Pose-Update)        → reality.imageupdated  (nur wenn sich die Pose ändert;
                                                    sonst „stale" wie bei MindAR)
     anchor.onTargetLost  → reality.imagelost
     (Target geladen)     → reality.imagescanning */
function detarPipelineModule(XR8, ctx, { resolve, reject }) {
  const { card, design, gyro, log, StatsOverlay } = ctx;
  let exp = null, stab = null, stats = null, cam = null;
  let anchor = null, stabRoot = null;
  let latest = null;                                  // letzte Bildpose (detail) — null = nicht getrackt
  const video = { videoWidth: 0, videoHeight: 0 };    // für ?stats (Kamera-Auflösung)
  const _img = new THREE.Matrix4(), _camInv = new THREE.Matrix4();
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

  // Karte verloren: Support-Zeile mit Icon mittig im Bild (mock 05), das Menü
  // bleibt stehen und friert nach CHOREO.trackingLostMs ein.
  const hint = el("lostHint");
  const lost = buildSupport("gefunden", [{ text: "Halte auf die Karte" }]);
  lost.icon.stop();
  hint.appendChild(lost);

  /* Bildpose (Szenen-Frame; Bild = XY-Ebene, +Z zur Kamera, Höhe des 3:4-Crops
     = 1 × scale) → kamera-relative Rohpose mit Scale = KARTENBREITE. Der Crop
     behält die volle Kartenbreite, also Kartenbreite = scale × scaledWidth.
     Wird jeden Frame gerechnet (Kamera-Matrix des aktuellen Frames, vom
     Threejs-Modul gesetzt); ohne neue Messung bleibt die Matrix bitidentisch →
     der Stabilizer sieht den Frame korrekt als „stale". */
  function updateAnchor(camera) {
    const d = latest;
    if (!d) return;
    const aspect = d.scaledWidth ?? (d.properties ? d.properties.width / d.properties.height : 1);
    const cardWidth = (d.scale || 1) * aspect;
    _p.set(d.position.x, d.position.y, d.position.z);
    _q.set(d.rotation.x, d.rotation.y, d.rotation.z, d.rotation.w);
    _s.setScalar(cardWidth);
    _img.compose(_p, _q, _s);
    camera.updateMatrixWorld(true);
    _camInv.copy(camera.matrixWorld).invert();
    anchor.matrix.multiplyMatrices(_camInv, _img);
  }

  function onFound(detail) {
    latest = detail;
    document.body.classList.remove("scanning");
    if (hint.classList.contains("show")) { hint.classList.remove("show"); lost.icon.stop(); }
    updateAnchor(cam); // Pose steht, BEVOR der Stabilizer aufsetzt
    stab.onFound();
    const { controller } = exp;
    controller.onCardSeen(); // greeted-Flag: Choreographie nur beim ersten Mal
    controller.onTrackingFound(); // Menü wieder freigeben
  }

  function onLost() {
    latest = null;
    stab.onLost();
    const { controller } = exp;
    if (controller.greeted) {
      if (controller.lostHintWanted) { hint.classList.add("show"); lost.icon.setMode("suchen"); }
      controller.onTrackingLost(); // nach CHOREO.trackingLostMs friert das Menü ein; im Ruhezustand wechselt die Panel-Zeile
    }
  }

  let settled = false;
  // Vor onStart: Promise verwerfen (Splash zeigt den Fehler). Nach onStart
  // (2026-09-15): Kamera-Ausfall in der Session (Anruf, Tab-Wechsel, Hitze) —
  // vorher stumm; jetzt Support-Zeile mittig „Kamera unterbrochen".
  const fail = (err) => {
    if (!settled) { settled = true; reject(err); return; }
    console.error("DETAR Kamera/Engine nach dem Start:", err);
    hint.innerHTML = "";
    hint.appendChild(buildSupport("suchen", [{ text: "Kamera unterbrochen", kind: "gelb" }, { text: "→ Seite neu laden", einzug: true }]));
    hint.classList.add("show");
  };

  return {
    name: "detar",

    onCameraStatusChange: ({ status, reason }) => {
      if (status !== "failed") return;
      // DENY_CAMERA → NotAllowedError, damit showStartError (main.js) den eigenen
      // Kamera-abgelehnt-Bildschirm zeigt (Regex permission|notallowed|denied).
      const err = new Error("Kamera nicht verfügbar (" + (reason ?? "UNSPECIFIED") + ")");
      err.name = reason === "DENY_CAMERA" ? "NotAllowedError" : "CameraError";
      fail(err);
    },

    onException: (err) => {
      console.error("XR8:", err);
      fail(err instanceof Error ? err : new Error(String(err)));
    },

    onStart: ({ videoWidth, videoHeight }) => {
      video.videoWidth = videoWidth; video.videoHeight = videoHeight;
      const { scene, camera, renderer } = XR8.Threejs.xrScene();
      cam = camera;

      // Rohpose-Träger (Ersatz für MindARs anchor.group): NICHT in der Szene,
      // matrixAutoUpdate aus — nur die Matrix zählt (der Stabilizer liest sie).
      anchor = new THREE.Group();
      anchor.matrixAutoUpdate = false;

      // Geglätteter Träger als KIND DER KAMERA (kamera-relative Pose)
      stabRoot = new THREE.Group();
      camera.add(stabRoot);
      stab = new PoseStabilizer(anchor, stabRoot, gyro);

      // Karten-Frame unter dem stabRoot: X = rechts, Y = hoch von der Karte,
      // Z = zur Karten-Unterkante. (+90° X: Anchor-Z "aus dem Bild" wird zu Y.)
      const worldRoot = new THREE.Group();
      worldRoot.rotation.x = Math.PI / 2;
      worldRoot.scale.setScalar(1 / SCENE.cardWidth);
      stabRoot.add(worldRoot);

      // ?stats — Live-Diagnose am Gerät (Tracking/Gyro/Jitter in Zahlen)
      stats = StatsOverlay
        ? new StatsOverlay(anchor, stabRoot, stab, gyro, { getVideo: () => video, renderer, camera, card, engine: ENGINE_VARIANT, design })
        : null;

      exp = buildExperience({
        renderer, scene, camera, worldRoot,
        /* Behavior-Ticks nur, solange die Figur sichtbar ist — verhindert, dass
           Lost-Frames (NaN-Quelle) in die Zustands-Lerps einsickern. */
        isRunning: () => stabRoot.visible,
        preTick: () => { updateAnchor(camera); stab.tick(); stats?.tick(); },
        render: false, // rendert XR8.Threejs in onRender
        relocalize: () => stab.reacquire(), // Neu-Aufsetzen per Median auf Figur-/Karten-Tap
      }, ctx);
      log(`DETAR Kamera: ${videoWidth}×${videoHeight}, Canvas ${renderer.domElement.width}×${renderer.domElement.height}`);
      // Erst auflösen (Splash weg, body.scanning an), DANN die Dev-Werkzeuge
      // nachladen — der Tracker läuft ab hier schon; würde ein Fund vor dem
      // Auflösen kommen, setzte boot() den Suchrahmen danach wieder an.
      if (!settled) { settled = true; resolve(); }
      ctx.attachDevTools(exp).catch((e) => console.warn("Dev-Werkzeuge nicht geladen:", e));
    },

    onUpdate: () => { exp?.loop(); },

    listeners: [
      { event: "reality.imagescanning", process: () => log("DETAR Target geladen, suche Karte …") },
      { event: "reality.imagefound",   process: ({ detail }) => { if (exp) onFound(detail); } },
      { event: "reality.imageupdated", process: ({ detail }) => { latest = detail; } },
      { event: "reality.imagelost",    process: () => { if (exp) onLost(); } },
    ],
  };
}
