/* CardController (js/cardController.js): Phasen waiting → attract → intro →
   live → resting → live, Rückgabewerte von onCardTapped(), Tap-Phasenfragen,
   Dev-Replay über den Hook onRescan (Stufe 3e: kein DOM im Controller).
   Rig, Blase, Menü, Animationen sind Attrappen, die ihre Aufrufe protokollieren
   und Rückrufe sofort ausführen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CardController } from "../js/cardController.js";
import { CHOREO } from "../js/config.js";
import { prototypKarte } from "./karte.mjs";

function attrappen() {
  const calls = [];
  const rec = (name, ret) => (...a) => { calls.push(name); return ret; };
  const nodes = {
    FigureRoot: { position: { copy() {}, set() {} }, scale: { copy() {} } },
    FIGURE_HOME: { pos: {}, scale: {} },
    bodies: { idle: { visible: true }, affirm: { visible: false }, think: { visible: false } },
  };
  const bubble = {
    hide: rec("bubble.hide"), skip: rec("bubble.skip"),
    paginate: (t) => [t],
    setText: (text, onDone, label) => { calls.push("bubble.setText"); bubble.text = text; bubble.onDone = onDone; bubble.label = label; },
  };
  const face = { setTalking: rec("face.setTalking") };
  const wander = {
    reset: rec("wander.reset"), setBusy: rec("wander.setBusy"), setAttending: rec("wander.setAttending"),
    setLively: (v) => { calls.push("wander.setLively(" + v + ")"); wander.lively = v; },
  };
  const activation = {
    cancel: rec("activation.cancel"), prime: rec("activation.prime"),
    play: (cb) => { calls.push("activation.play"); cb(); },
    playOut: (cb) => { calls.push("activation.playOut"); cb(); },
  };
  const menu = {
    phase: "onboarding",
    reset: rec("menu.reset"), showAttract: rec("menu.showAttract"), hideOnboarding: rec("menu.hideOnboarding"),
    clear: rec("menu.clear"), revealUI: rec("menu.revealUI"), showHub: rec("menu.showHub"), showNext: rec("menu.showNext"),
    showOptions: rec("menu.showOptions"), clearSelection: rec("menu.clearSelection"), setFrozen: rec("menu.setFrozen"),
    showIdle: (lost) => { calls.push("menu.showIdle"); menu.phase = lost ? "idle-lost" : "idle"; },
    showThema: rec("menu.showThema"), showThemen: rec("menu.showThemen"),
    jumpIconOut: (cb) => { calls.push("menu.jumpIconOut"); cb(); },
  };
  const fx = { stop: rec("fx.stop"), play: rec("fx.play"), landIcon: rec("fx.landIcon"), burst: (cb) => { calls.push("fx.burst"); cb(); } };
  return { calls, nodes, bubble, face, wander, activation, menu, fx };
}
function controller(extra = {}) {
  const a = attrappen();
  const c = new CardController({ card: prototypKarte().karte, ...a, ...extra });
  return { c, ...a };
}

test("Karte gesehen: Aktivier-Phase mit Markern, Hinweis und Hüpf-Icon — nur einmal", () => {
  const { c, calls } = controller();
  assert.equal(c.phase, "waiting");
  assert.equal(c.greeted, false);
  c.onCardSeen();
  assert.equal(c.phase, "attract");
  assert.equal(c.greeted, true);
  assert.ok(c.acceptsCardTap && !c.acceptsFigureTap);
  for (const k of ["activation.prime", "fx.play", "menu.showAttract", "menu.jumpIconOut", "fx.landIcon"]) assert.ok(calls.includes(k), k);
  const n = calls.length;
  c.onCardSeen(); // zweites Mal: nichts
  assert.equal(calls.length, n);
  c.clearTimers();
});

test("Karten-Tap: „start“ aus attract, dann live mit Begrüßung; sonst false", () => {
  const { c, calls, bubble } = controller();
  assert.equal(c.onCardTapped(), false); // waiting
  c.onCardSeen();
  assert.equal(c.onCardTapped(), "start");
  assert.equal(c.phase, "live"); // burst + activation.play rufen sofort zurück
  assert.ok(calls.includes("fx.burst") && calls.includes("activation.play"));
  assert.equal(bubble.text, c.data.greeting.text);
  assert.ok(c.acceptsFigureTap && !c.acceptsCardTap);
  assert.equal(c.onCardTapped(), false); // live: Karten-Tap zählt nicht
  bubble.onDone(); // Begrüßung fertig getippt → Menü fährt ein
  assert.ok(calls.includes("menu.revealUI"));
  assert.ok(c.timers.idle, "Lesezeit läuft");
  c.clearTimers();
});

test("Blasen-Tap: überspringt beim Tippen, löst Weiter aus, sonst nichts", () => {
  const { c, calls, bubble } = controller();
  c.onCardSeen(); c.onCardTapped();
  assert.equal(c.speaking, true);
  assert.equal(c.onBubbleTapped(), true);
  assert.ok(calls.includes("bubble.skip"));
  bubble.onDone();
  assert.equal(c.onBubbleTapped(), false); // nichts wartet
  c.waitContinue(() => calls.push("weiter"), "Weiter");
  assert.equal(c.onBubbleTapped(), true);
  assert.ok(calls.includes("weiter"));
  c.clearTimers();
});

test("Lebendig-Phase: livelyAfterMs nach dem Tippen Pose idle + lebendig, nächste Antwort beendet sie", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { c, bubble, nodes, wander } = controller();
  c.onCardSeen(); c.onCardTapped(); bubble.onDone(); // Begrüßung → Hub
  const q = c.data.questions.find((x) => !x.end && !x.link);
  c.answerQuestion(q);
  c.setPose("affirm"); // Antwort-Pose, unabhängig vom Tag der Frage
  bubble.onDone();
  t.mock.timers.tick(CHOREO.livelyAfterMs - 1);
  assert.notEqual(wander.lively, true, "vorher ruhig");
  t.mock.timers.tick(1);
  assert.equal(wander.lively, true);
  assert.equal(nodes.bodies.idle.visible, true, "Pose zurück auf idle");
  c.answerQuestion(c.data.questions.find((x) => x !== q && !x.end && !x.link));
  assert.equal(wander.lively, false, "neue Antwort beendet die Lebendig-Phase");
  c.clearTimers();
});

test("Ausstieg: collapse → resting; Karten-Tap → „reentry“ → live, Besuch zählt", () => {
  const { c, bubble } = controller();
  c.onCardSeen(); c.onCardTapped(); bubble.onDone();
  c.collapse();
  assert.equal(c.phase, "resting");
  assert.ok(c.acceptsCardTap);
  assert.equal(c.lostHintWanted, false);
  assert.equal(c.onCardTapped(), "reentry");
  assert.equal(c.phase, "live");
  assert.equal(c.engine.visits, 2);
  assert.equal(bubble.text, c.data.reentry.rules[2].text); // Standard-Regel beim 2. Besuch
  c.clearTimers();
});

test("Tracking verloren/gefunden: nach trackingLostMs Menü eingefroren + Suchrahmen, Fund gibt sofort frei", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const search = [];
  const { c, calls, menu } = controller({ onSearch: (on) => search.push(on) });
  c.onTrackingLost(); // waiting: nichts
  assert.equal(c.timers.lost, undefined);
  // Aktivier-Phase: Suchrahmen kommt ebenfalls zurück (seit Build 99)
  c.onCardSeen();
  c.onTrackingLost();
  t.mock.timers.tick(CHOREO.trackingLostMs);
  assert.deepEqual(search, [true]);
  c.onTrackingFound();
  assert.deepEqual(search, [true, false]);
  c.onCardTapped();
  assert.equal(c.lostHintWanted, true);
  c.onTrackingLost();
  assert.ok(c.timers.lost);
  t.mock.timers.tick(CHOREO.trackingLostMs - 1);
  assert.equal(c.searching, false, "vor Ablauf kein Suchrahmen");
  c.onTrackingFound(); // kurzer Aussetzer: kein Suchrahmen, kein Einfrieren-Rest
  assert.equal(c.timers.lost, null);
  assert.deepEqual(search, [true, false]);
  c.onTrackingLost();
  t.mock.timers.tick(CHOREO.trackingLostMs);
  assert.equal(c.searching, true);
  assert.ok(calls.includes("menu.setFrozen"));
  c.onTrackingFound();
  assert.equal(c.searching, false);
  assert.deepEqual(search, [true, false, true, false]);
  // Ruhezustand: Panel-Zeile wechselt erst nach Ablauf
  c.collapse();
  c.onTrackingLost();
  assert.equal(menu.phase, "idle");
  t.mock.timers.tick(CHOREO.trackingLostMs);
  assert.equal(menu.phase, "idle-lost");
  c.onTrackingFound();
  assert.equal(menu.phase, "idle");
  // Ausstieg, während die Karte weg ist: Panel sofort auf „Halte auf die Karte"
  c.phase = "live";
  c.onTrackingLost();
  t.mock.timers.tick(CHOREO.trackingLostMs);
  c.collapse();
  assert.equal(menu.phase, "idle-lost");
  // Replay räumt den Suchrahmen-Zustand ab
  c.replay();
  assert.equal(c.searching, false);
  c.clearTimers();
});

test("Replay: Hook onRescan bekommt done(), Controller fasst kein DOM an", () => {
  let done = null;
  const { c, calls } = controller({ onRescan: (d) => { calls.push("onRescan"); done = d; } });
  c.onCardSeen(); c.onCardTapped();
  c.replay();
  assert.equal(c.phase, "waiting");
  assert.ok(calls.includes("onRescan") && calls.includes("menu.reset") && calls.includes("wander.reset"));
  assert.equal(c.engine.asked.size, 0);
  done();
  assert.equal(c.phase, "attract");
  c.clearTimers();
  // ohne Hook: der „Scan" folgt sofort
  const o = controller();
  o.c.replay();
  assert.equal(o.c.phase, "attract");
  o.c.clearTimers();
});

test("Controller-Quelltext nutzt weder document noch window", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../js/cardController.js", import.meta.url), "utf8");
  assert.ok(!/\bdocument\./.test(src));
  assert.ok(!/\bwindow\.(?!open\b)/.test(src)); // window.open für die Link-Frage ist die eine Browser-Aktion
});
