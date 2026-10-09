/* =============================================================================
   DETAR — Experience: gemeinsamer Szenen-Aufbau für beide Modi — Rig +
   Behaviors + Sprechblase + Menü + CardController + Tap-Auswertung +
   Render-Loop. AR (js/arSession.js) und Desktop (js/desktopMode.js)
   importieren buildExperience() direkt; bis Build 86 lag die Funktion in
   main.js und wurde dem Desktop-Modus als Parameter durchgereicht
   (Refactoring Stufe 3b).

   KOORDINATEN-KERN: Zapworks lief im Anchor-Origin-Modus (Karte = Welt-
   Ursprung, Kamera bewegt sich). Der Stabilizer arbeitet invertiert (Kamera =
   Ursprung, der Karten-Anchor bewegt sich im Kamera-Raum) — deshalb hängt
   stabRoot unter der Kamera. Figur + Bubble leben unter einem `worldRoot`
   (Karten-Frame: X = Karte rechts, Y = hoch von der Karte weg, Z = zur Karten-
   Unterkante), und alle "Wo ist die Kamera?"-Rechnungen transformieren die
   Kamera-Weltposition in diesen Frame (frame.getCamLocal) — die komplette
   Behavior-Logik aus dem Prototyp bleibt dadurch 1:1 gültig.

   `render: false` → der Loop rendert NICHT selbst (AR: das übernimmt der
   Threejs-Pipeline-Modul-Hook onRender der 8th-Wall-Engine, sonst doppelt).
   ============================================================================= */
import { STAB, CHOREO } from "./config.js";
import { buildRig } from "./rig.js";
import { FaceAnimator } from "./faceAnimator.js";
import { SpeechBubble } from "./speechBubble.js";
import { IdleWander } from "./idleWander.js";
import { ActivationAnim } from "./activationAnim.js";
import { QuestionMenu } from "./questionMenu.js";
import { CardController } from "./cardController.js";
import { ActivationFX } from "./activationFX.js";
import { FigureJump } from "./figureJump.js";
import { TapInput } from "./tapInput.js";
import { sound } from "./sound.js";
import { el, finiteVec } from "./util.js";

/**
 * @param szene { renderer, scene, camera, worldRoot, isRunning?, preTick?, render?, relocalize? }
 *   isRunning   () → Behavior-Ticks nur, solange true (AR: Figur sichtbar)
 *   preTick     () → vor den Ticks (AR: Anchor + PoseStabilizer + ?stats)
 *   relocalize  AR: () → stab.reacquire(), NEU-AUFSETZEN auf Tap (2026-09-07):
 *               Figur-Tap (Hüpfer kaschiert den Sprung) und Karten-Tap in der
 *               „Karte gefunden"-Phase setzen den PoseStabilizer per Median neu
 *               auf. Desktop: fehlt. (Unter MindAR wurde hier zusätzlich die
 *               Neu-Erkennung des Trackers erzwungen; 8th Wall erkennt
 *               kontinuierlich, ein Eingriff ist weder nötig noch möglich.)
 * @param ctx   { card, DebugOverlay?, devLog } — Karte (Dialog + Figur), Klasse
 *              des Debug-Overlays (nur mit ?debug geladen), devLog = window.__detar
 *              anlegen (nur ?dev/?debug/?stats)
 */
export function buildExperience({ renderer, scene, camera, worldRoot, isRunning, preTick, render = true, relocalize = null }, ctx) {
  const { card, DebugOverlay = null, devLog = false } = ctx;
  const frame = {
    worldRoot,
    camera,
    /* Kamera-Weltposition in den Karten-Frame transformieren. WICHTIG:
       updateWorldMatrix VOR dem Lesen — matrixWorld ist im Animation-Loop
       sonst einen Frame alt (Zapworks-Gotcha, gilt in three.js generell).
       NaN-SCHUTZ: liefert null, wenn die Transformation nicht endlich ist
       (degenerierte Matrix um Tracking-Verlust) — Aufrufer überspringen den
       Frame dann, statt NaN in ihre Lerps einsickern zu lassen. */
    getCamLocal(out) {
      camera.getWorldPosition(out);
      worldRoot.updateWorldMatrix(true, false);
      worldRoot.worldToLocal(out);
      if (STAB.nanGuard && !finiteVec(out)) return null;
      return out;
    },
    /* Welt → Karten-Frame (matrixWorld muss aktuell sein — getCamLocal wird
       in allen Verwendungen zuerst gerufen und aktualisiert sie). */
    toLocal(v) {
      return worldRoot.worldToLocal(v);
    },
  };

  const nodes = buildRig(worldRoot, card.figur);

  const faceAnim = new FaceAnimator(nodes);
  const bubble = new SpeechBubble(nodes, frame);
  const wander = new IdleWander(nodes, frame);
  const activation = new ActivationAnim(nodes);
  const fx = new ActivationFX(worldRoot);
  let controller = null;
  const menu = new QuestionMenu(el("question-root"), null, {
    onQuestion: (q) => controller.answerQuestion(q),
    onTheme: (id) => controller.onTheme(id),
    onBack: () => controller.onBack(),
    onOption: (o) => controller.onOption(o),
    onNext: () => controller.onNext(),
    onReentry: () => controller.onCardTapped(),
  });
  controller = new CardController({
    card, nodes, bubble, face: faceAnim, wander, activation, menu, fx,
    // Dev-Replay (Dev-Panel): Suchrahmen wieder an wie nach dem Start, nach
    // CHOREO.replayRescanMs „Scan" — DOM und Verzögerung liegen hier, nicht im Controller
    onRescan: (done) => {
      document.body.classList.add("scanning");
      setTimeout(() => { document.body.classList.remove("scanning"); done(); }, CHOREO.replayRescanMs);
    },
  });
  menu.engine = controller.engine;
  if (devLog) window.__detar = { controller, engine: controller.engine, fx, nodes, camera, renderer, sound }; // Debug-Zugriff (Konsole, nur ?dev/?debug/?stats)
  const debug = DebugOverlay ? new DebugOverlay(worldRoot, nodes, frame) : null;
  if (debug) debug.setVisible(true);

  /* ---- Tap-Auswertung (Strahl aus js/tapInput.js) ------------------------ */
  const jump = new FigureJump({ nodes, wander, face: faceAnim });
  const figureMeshes = [
    ...Object.values(nodes.bodies),
    nodes.Head, nodes.FaceNeutral, nodes.FaceBlink, nodes.FaceTalk,
  ];
  function handleTap(ray) {
    // Aktivier-Phase + Ruhezustand: Tap auf die KARTE (unsichtbare Tap-Plane)
    // startet die Figur bzw. holt sie zurück (Wiedereinstieg).
    if (controller.acceptsCardTap) {
      if (ray.intersectObject(fx.tapPlane, false).length > 0) {
        // Start aus „Karte gefunden": Nutzer hält still → beste Gelegenheit für eine saubere Pose
        if (controller.onCardTapped() === "start") relocalize?.();
      }
      return;
    }
    // Sprechblase: Schreibvorgang überspringen bzw. Weiter-Schritt auslösen
    if (bubble.element.visible && ray.intersectObject(bubble.plane, false).length > 0) {
      if (controller.onBubbleTapped()) return;
    }
    if (!controller.acceptsFigureTap) return;
    const hits = ray.intersectObjects(figureMeshes.filter((m) => m.visible), false);
    if (hits.length > 0) { jump.start(); relocalize?.(); } // Hüpfer + „Geraderücken"
  }
  new TapInput(renderer.domElement, camera, handleTap);

  /* ---- Render-Loop -------------------------------------------------------- */
  let lastT = performance.now();
  function loop() {
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    lastT = now;
    preTick?.(); // AR: PoseStabilizer (glättet Anchor-Pose → stabRoot)
    if (!isRunning || isRunning()) {
      wander.tick(dt);
      jump.tick(dt); // nach wander: überschreibt die Position während des Sprungs
      activation.tick(dt);
      fx.tick(dt);
      faceAnim.tick(dt);
      bubble.tick(dt);
      debug?.tick();
    }
    if (render) renderer.render(scene, camera);
  }

  return { controller, bubble, loop, nodes, fx, camera };
}
