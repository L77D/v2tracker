/* =============================================================================
   DETAR — App-Boot: Splash → Start-Geste → AR-Sitzung oder Desktop-Modus.

   Seit Refactoring Stufe 3b (Build 87) ist main.js nur noch der Boot: URL-
   Flags, Vorabprüfung, Karte laden, Splash befüllen, Start-Geste (Sound,
   Gyro-Permission), Fehlerpfade, Dev-Werkzeuge. Die Arbeit liegt in Modulen:
   • js/arSession.js   — 8th-Wall-Engine (SIMD-Wahl, Lazy-Load), Kamera-
                         Pipeline, Bildpose → Rohpose des PoseStabilizers,
                         Karte-verloren-Hinweis (startAR, preloadEngine)
   • js/experience.js  — gemeinsamer Szenen-Aufbau beider Modi: Rig, Behaviors,
                         Sprechblase, Menü, CardController, Tap-Auswertung,
                         Render-Loop (buildExperience)
   • js/tapInput.js    — Pointer → Tap (Entprellung, Tap ≠ Drag) + Strahl
   • js/figureJump.js  — Parabel-Hüpfer der Figur beim Tap
   • js/desktopMode.js — ?desktop: ohne Kamera, Karte als Boden-Plane, Maus-
                         Orbit im Phone-Rahmen (nur per Flag geladen)

   Zwei Modi:
   • Normal (Handy): 8th Wall Image Targets (Open-Source-Engine, selbst gehostet
                     unter vendor/8thwall/), Figur steht auf der echten Karte.
   • ?desktop:       Desktop-Testmodus ohne Kamera (js/desktopMode.js) — Karte
                     als Boden-Plane, Maus-Orbit. Zum Entwickeln/Prüfen.
   • ?debug:         pinke Hilfslinien (Lauffeld + FACE_CAM-Kegel) zuschalten.
   ============================================================================= */
import { ladeKarte } from "./kartenLader.js";
import { GYRO, loadTuning } from "./config.js";
import { syncCssVars } from "./questionMenu.js";
import { GyroFusion } from "./gyroFusion.js";
import { sound } from "./sound.js";
import { preflight, showPreflightScreen } from "./preflight.js";
import { startAR, preloadEngine, ENGINE_VARIANT, XR_ENGINE_URL, TRACKER_NAME } from "./arSession.js";
import { el } from "./util.js";

const params = new URLSearchParams(location.search);
// (tools/build-lokal-prototyp.py patcht die Zeilen DESKTOP_MODE / DEV_MODE — Wortlaut halten)
const DESKTOP_MODE = params.has("desktop");
// Edition: Public-Fassung = Kartennummer mit angehängtem P (?k=000P, Build 75,
// Michael 2026-10-08 — ersetzt das frühere Flag ?public). Ohne Firmenlogo/
// -name im Splash und ohne Link-Frage im Dialog (js/edition.js). Bestimmt der
// Kartenlader (resolved.publicMode); steht in der Query, bleibt also beim
// Neuladen und bei „Link kopieren" erhalten.
let PUBLIC_MODE = false;
// Debug NUR per URL (?debug) — bewusst kein Config-Key dafür (ein Leftover
// aus Tuning-Sessions soll nie live erscheinen; SCENE.debug seit Build 61 weg).
const DEBUG_MODE = params.has("debug");
const DEV_MODE = params.has("dev");           // Tuning-Panel (Regler)
const TIMELINE_MODE = params.has("timeline"); // Theatre.js-Studio (Keyframe-Editor)
// Konsolen-Ausgaben + window.__detar nur in Entwickler-Sessions (2026-09-15;
// vorher landeten Firmenname/Fragenzahl in jeder Nutzer-Konsole).
const DEV_LOG = DEV_MODE || DEBUG_MODE || TIMELINE_MODE || params.has("stats");
const log = (...a) => { if (DEV_LOG) console.log(...a); };

// Kontext für die Module (gefüllt in boot()): Karte (Content) kommt seit
// Build 63 aus karten/<id>/daten.json + dialog.json (js/kartenLader.js,
// ?k=<id>) — vorher statischer Import von cards/elektroniker.js. `design` =
// gewähltes Kartenbild fürs Tracking (?design). `gyro` wird in der START-Geste
// angelegt (iOS-Permission). Dev-Module werden NUR mit ihrem URL-Flag geladen
// (kein Byte davon im Normalfall): ?debug → debugOverlay.js · ?stats →
// statsOverlay.js · ?dev → devPanel.js · ?dev/?timeline → timeline.js
// (Theatre.js) · ?desktop → desktopMode.js (+ phoneFrame.js)
const ctx = {
  card: null, design: null, gyro: null,
  log, devLog: DEV_LOG,
  DebugOverlay: null, StatsOverlay: null,
  attachDevTools,
};
let desktop = null;

/* --------------------------------------------------------------------------
   Splash befüllen + Start-Button freigeben, sobald Tuning + Font geladen sind.
   -------------------------------------------------------------------------- */
async function boot() {
  // Vorabprüfung (2026-09-09): In-App-Browser / kein HTTPS / keine Kamera-API /
  // kein WASM → Hinweis-Bildschirm statt Fehler nach dem Klick; Button bleibt
  // aus. Test: ?preflight=inapp|nocam|insecure|nowasm|nowebp (s. js/preflight.js).
  const blocked = await preflight(params.get("preflight"));
  // Karte laden (?k=<id> gegen karten/katalog.json, Design per ?design=<id>).
  // Unbekannte Karte/Design: Hinweis in der Fehlerzeile des Splash, Button
  // bleibt aus — statt einer leeren Seite nach dem Klick (Target-404).
  const resolved = await ladeKarte(params);
  PUBLIC_MODE = !!resolved.publicMode;
  // Ohne ?k startet keine Karte (Build 74): Auffang-Seite statt Splash —
  // Vorrang vor der Vorabprüfung, denn ohne Karte gibt es nichts zu starten.
  if (resolved.keineKarte) {
    document.body.classList.add("keine-karte");
    console.warn("DETAR: kein ?k — Auffang-Seite. Bekannte Karten:", resolved.ids.join(", "));
    return;
  }
  if (blocked) {
    el("cardName").textContent = resolved.card?.profession ?? resolved.beruf ?? "";
    showPreflightScreen(blocked);
    return;
  }
  if (resolved.error) {
    if (resolved.beruf) el("cardName").textContent = resolved.beruf;
    const box = el("errorBox");
    box.textContent = resolved.error + (resolved.ids.length ? " — bekannt: " + resolved.ids.join(", ") : "") +
      (resolved.hinweis ?? "");
    box.style.display = "block";
    console.warn("DETAR", resolved.error, resolved.ids);
    return;
  }
  const { card, design } = resolved;
  ctx.card = card; ctx.design = design;
  log("DETAR Karte:", card.id, "· Design:", design.id, "·", design.name, "·", design.breiteMm, "mm →", design.targetUrl);
  // Engine-Kern vorladen (Netzwerk, nicht ausgeführt; welche Variante,
  // entscheidet arSession.js am Gerät). Im Desktop-Modus wird die Engine nie gebraucht.
  if (!DESKTOP_MODE) {
    preloadEngine();
    log("DETAR Engine-Variante:", ENGINE_VARIANT, "→", XR_ENGINE_URL, "· Tracker:", TRACKER_NAME);
  }
  // tuning.json nur in Tuning-Sessions holen (?dev oder ?tuning) — im Normalfall
  // gibt es die Datei nicht, alle Werte sind Defaults in config.js (2026-09-09).
  if (DEV_MODE || params.has("tuning")) await loadTuning();
  syncCssVars();

  // Desktop-Modus: eigenes Modul; Rahmen VOR dem Splash aufbauen, damit schon
  // der Startscreen im Phone sitzt
  if (DESKTOP_MODE) {
    desktop = await import("./desktopMode.js");
    await desktop.createPhoneFrame();
  }
  if (DEBUG_MODE) ({ DebugOverlay: ctx.DebugOverlay } = await import("./debugOverlay.js"));
  if (params.has("stats")) ({ StatsOverlay: ctx.StatsOverlay } = await import("./statsOverlay.js"));

  el("cardName").textContent = card.profession;
  // Firmenlogo nur, wenn die Karte eines mitbringt — sonst der Name als Text.
  // Public-Edition: der ganze Block „bei + Logo/Firma" bleibt weg (body.public;
  // der Public-Splash wird noch gestaltet — Michael 2026-09-09).
  const logoImg = el("companyLogo"), companyText = el("companyText");
  if (PUBLIC_MODE) { document.body.classList.add("public"); logoImg.hidden = true; companyText.hidden = true; }
  else if (card.companyLogo) { logoImg.src = card.companyLogo; logoImg.alt = card.company; companyText.hidden = true; }
  else { logoImg.hidden = true; companyText.textContent = card.company ?? ""; }
  log("DETAR Edition:", card.edition, "· Fragen:", card.questions.length);
  // (DET-Logo mit Job-Link nach dem Splash: seit dem UI-Update 2026-09-03 raus)

  // Font muss VOR dem ersten Bubble-measureText geladen sein.
  try {
    await Promise.all([document.fonts.load(`52px "Jersey 10"`), document.fonts.load(`26px "Silkscreen"`)]);
  } catch (e) { /* Fallback mono */ }

  const btn = el("launchButton");
  btn.disabled = false;
  btn.addEventListener("click", async () => {
    btn.disabled = true; // Spinner während Kamera/Tracking hochfahren
    // Sound MUSS in der User-Geste initialisiert werden (AudioContext-Unlock,
    // gleiche Regel wie die Gyro-Permission) — VOR allen awaits.
    sound.init();
    sound.uiTap();
    // Gyro-Permission MUSS direkt in der User-Geste angefragt werden (iOS) —
    // deshalb hier, VOR allen awaits. Fail-safe: ohne Gyro läuft alles normal.
    if (!DESKTOP_MODE && GYRO.enabled && !params.has("nogyro")) {
      ctx.gyro = new GyroFusion();
      ctx.gyro.enable(); // bewusst nicht awaiten (Geste nicht verlieren)
    }
    try {
      if (DESKTOP_MODE) await desktop.startDesktop(ctx);
      else await startAR(ctx);
      document.body.classList.add("launched");
      document.body.classList.add("scanning"); // Suchrahmen (weiße Ecken) bis zur ersten Erkennung
    } catch (err) {
      console.error("DETAR start failed:", err);
      showStartError(err);
      btn.disabled = false;
    }
  });
}

/* Startfehler. Kamera abgelehnt → eigener Bildschirm ohne Kamerabild
   (Dialogsystem 2026-09-03, UI-Inventar Abschnitt 6); alles andere bleibt
   eine Fehlerzeile im Splash. */
function showStartError(err) {
  const isCam = /permission|notallowed|denied/i.test(String(err?.name) + String(err?.message));
  if (isCam) {
    document.body.classList.add("camera-denied");
    const reload = el("permReload");
    if (reload) reload.onclick = () => location.reload();
    return;
  }
  const box = el("errorBox");
  box.textContent = "Start fehlgeschlagen. Bitte Seite neu laden. (" + (err?.message ?? err) + ")";
  box.style.display = "block";
}

/* --------------------------------------------------------------------------
   Dev-Werkzeuge: Theatre.js-Timeline (Beats) + Tuning-Panel — NUR mit ?dev
   bzw. ?timeline. (Bis 2026-09-09 lud jeder Start timeline.js und holte
   beats.theatre.json per fetch, obwohl es die Datei nie gab. Sollen autorisierte
   Beats einmal live laufen, hier wieder einen Player-Pfad ohne Flag öffnen.)
   Aufrufer: arSession.js (onStart) und desktopMode.js, über ctx.attachDevTools.
   -------------------------------------------------------------------------- */
async function attachDevTools(exp) {
  if (!DEV_MODE && !TIMELINE_MODE) return;
  let timeline = null;
  try {
    const { initTimeline } = await import("./timeline.js");
    timeline = await initTimeline({ nodes: exp.nodes, withStudio: TIMELINE_MODE });
  } catch (e) {
    console.warn("Timeline nicht verfügbar:", e);
  }
  if (DEV_MODE) {
    const { DevPanel } = await import("./devPanel.js");
    new DevPanel({ bubble: exp.bubble, nodes: exp.nodes, controller: exp.controller, timeline, fx: exp.fx });
  }
}

// Fehler im Boot (außerhalb des Start-Klicks) sichtbar machen — vorher eine
// stille Unhandled Rejection, Splash mit ausgegrautem Knopf (2026-09-15).
boot().catch((err) => { console.error("DETAR boot failed:", err); showStartError(err); });
