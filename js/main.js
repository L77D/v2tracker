/* =============================================================================
   DETAR — App-Boot: Splash → Start-Geste → AR-Sitzung.

   main.js ist nur der Boot: URL-Parameter, Vorabprüfung, Karte laden, Splash
   befüllen, Start-Geste (Sound, Gyro-Permission), Fehlerpfade. Die Arbeit
   liegt in Modulen:
   • js/arSession.js   — 8th-Wall-Engine (SIMD-Wahl, Lazy-Load), Kamera-
                         Pipeline, Bildpose → Rohpose des Trackers,
                         Karte-verloren-Hinweis (startAR, preloadEngine)
   • js/experience.js  — Szenen-Aufbau: Rig, Behaviors, Sprechblase, Menü,
                         CardController, Tap-Auswertung, Render-Loop
                         (buildExperience)
   • js/tapInput.js    — Pointer → Tap (Entprellung, Tap ≠ Drag) + Strahl
   • js/figureJump.js  — Parabel-Hüpfer der Figur beim Tap

   8th Wall Image Targets (Open-Source-Engine, selbst gehostet unter
   vendor/8thwall/), Figur steht auf der echten Karte.
   ============================================================================= */
import { ladeKarte } from "./kartenLader.js";
import { GYRO } from "./config.js";
import { syncCssVars } from "./questionMenu.js";
import { GyroFusion } from "./gyroFusion.js";
import { sound } from "./sound.js";
import { preflight, showPreflightScreen } from "./preflight.js";
import { startAR, preloadEngine } from "./arSession.js";
import { el } from "./util.js";

const params = new URLSearchParams(location.search);
// Variante der Karte: ?k=<code>&v=S|B|P, ohne v = S (Schule); P = Public ohne
// Firmenlogo/-name im Splash und ohne Link-Frage (js/edition.js, Alias
// ?k=00P). Bestimmt der Kartenlader (resolved.variante); steht in der Query,
// bleibt also beim Neuladen und bei „Link kopieren" erhalten.
let PUBLIC_MODE = false;

// Kontext für die Module (gefüllt in boot()): Karte (Content) aus
// karten/<id>/daten.json + dialog.json (js/kartenLader.js, ?k=<id>). `design` =
// Kartenbild fürs Tracking. `gyro` wird in der START-Geste angelegt
// (iOS-Permission).
const ctx = { card: null, design: null, gyro: null };

/* --------------------------------------------------------------------------
   Splash befüllen + Start-Button freigeben, sobald der Font geladen ist.
   -------------------------------------------------------------------------- */
async function boot() {
  // Vorabprüfung: In-App-Browser / kein HTTPS / keine Kamera-API / kein WASM →
  // Hinweis-Bildschirm statt Fehler nach dem Klick; Button bleibt aus.
  // Test: ?preflight=inapp|nocam|insecure|nowasm|nowebp (s. js/preflight.js).
  const blocked = await preflight(params.get("preflight"));
  // Karte laden (?k=<id> gegen karten/katalog.json, Design per ?design=<id>).
  // Unbekannte Karte/Design: Hinweis in der Fehlerzeile des Splash, Button
  // bleibt aus — statt einer leeren Seite nach dem Klick (Target-404).
  const resolved = await ladeKarte(params);
  PUBLIC_MODE = resolved.variante === "P";
  // Ohne ?k startet keine Karte: Auffang-Seite statt Splash — Vorrang vor der
  // Vorabprüfung, denn ohne Karte gibt es nichts zu starten.
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
  // Engine-Kern vorladen (Netzwerk, nicht ausgeführt; welche Variante,
  // entscheidet arSession.js am Gerät).
  preloadEngine();
  syncCssVars();

  el("cardName").textContent = card.profession;
  // Firmenlogo nur, wenn die Karte eines mitbringt — sonst der Name als Text.
  // Public-Edition: der ganze Block „bei + Logo/Firma" bleibt weg (body.public).
  const logoImg = el("companyLogo"), companyText = el("companyText");
  if (PUBLIC_MODE) { document.body.classList.add("public"); logoImg.hidden = true; companyText.hidden = true; }
  else if (card.companyLogo) { logoImg.src = card.companyLogo; logoImg.alt = card.company; companyText.hidden = true; }
  else { logoImg.hidden = true; companyText.textContent = card.company ?? ""; }

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
    if (GYRO.enabled && !params.has("nogyro")) {
      ctx.gyro = new GyroFusion();
      ctx.gyro.enable(); // bewusst nicht awaiten (Geste nicht verlieren)
    }
    try {
      await startAR(ctx);
      document.body.classList.add("launched");
      document.body.classList.add("scanning"); // Suchrahmen (weiße Ecken) bis zur ersten Erkennung
    } catch (err) {
      console.error("DETAR start failed:", err);
      showStartError(err);
      btn.disabled = false;
    }
  });
}

/* Startfehler. Kamera abgelehnt → eigener Bildschirm ohne Kamerabild; alles
   andere bleibt eine Fehlerzeile im Splash. */
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

// Fehler im Boot (außerhalb des Start-Klicks) sichtbar machen — sonst eine
// stille Unhandled Rejection, Splash mit ausgegrautem Knopf.
boot().catch((err) => { console.error("DETAR boot failed:", err); showStartError(err); });
