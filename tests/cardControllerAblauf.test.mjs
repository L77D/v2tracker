/* CardController (js/cardController.js): komplette Abläufe als Aufruf-Protokoll
   gegen den Snapshot von Build 110 — mehrseitige Antwort (Weiter, Anfangston nur
   auf Seite 1), Rückfrage nach der ersten Antwort, Link-Frage (window.open in der
   Geste), Ausstieg → Fazit → Abschied → Ruhezustand → Wiedereinstieg, Lebendig-
   Phase und Lesezeit. Attrappen wie in tests/cardController.test.mjs, Timer
   gefälscht. Snapshot: tests/fixtures/cardController.ablauf.json */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CardController } from "../js/cardController.js";
import { CHOREO } from "../js/config.js";
import { sound } from "../js/sound.js";
import { prototypKarte } from "./karte.mjs";
import { pruefeSnapshot } from "./snapshot.mjs";

function attrappen(calls) {
  const rec = (name, ret) => (...a) => { calls.push(name); return ret; };
  const nodes = {
    FigureRoot: { position: { copy() {}, set() {} }, scale: { copy() {} } },
    FIGURE_HOME: { pos: {}, scale: {} },
    bodies: { idle: { visible: true }, affirm: { visible: false }, think: { visible: false } },
  };
  const bubble = {
    hide: rec("bubble.hide"), skip: rec("bubble.skip"),
    paginate: (t) => (t.includes("||") ? t.split("||") : [t]),
    setText: (text, onDone, label) => { calls.push("bubble.setText(" + (label || "-") + "): " + text.slice(0, 40)); bubble.onDone = onDone; },
  };
  const face = { setTalking: (v) => calls.push("face.setTalking(" + v + ")") };
  const wander = { reset: rec("wander.reset"), setBusy: (v) => calls.push("wander.setBusy(" + v + ")"), setAttending: (v) => calls.push("wander.setAttending(" + v + ")"), setLively: (v) => calls.push("wander.setLively(" + v + ")") };
  const activation = { cancel: rec("activation.cancel"), prime: rec("activation.prime"), play: (cb) => { calls.push("activation.play"); cb(); }, playOut: (cb, s) => { calls.push("activation.playOut(" + s + ")"); cb(); } };
  const menu = {
    phase: "onboarding", reset: rec("menu.reset"), showAttract: rec("menu.showAttract"), hideOnboarding: rec("menu.hideOnboarding"),
    clear: rec("menu.clear"), revealUI: rec("menu.revealUI"), showHub: rec("menu.showHub"), showNext: (l) => calls.push("menu.showNext(" + l + ")"),
    showOptions: (o) => calls.push("menu.showOptions(" + o.length + ")"), clearSelection: rec("menu.clearSelection"), setFrozen: (v) => calls.push("menu.setFrozen(" + v + ")"),
    showIdle: (lost) => { calls.push("menu.showIdle(" + lost + ")"); menu.phase = lost ? "idle-lost" : "idle"; },
    showThema: (id) => calls.push("menu.showThema(" + id + ")"), showThemen: rec("menu.showThemen"), jumpIconOut: (cb) => { calls.push("menu.jumpIconOut"); cb(); },
  };
  const fx = { stop: rec("fx.stop"), play: rec("fx.play"), landIcon: rec("fx.landIcon"), burst: (cb) => { calls.push("fx.burst"); cb(); } };
  return { nodes, bubble, face, wander, activation, menu, fx };
}

function aufbau(t, karteAnpassen = (k) => k) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  const a = attrappen(calls);
  const karte = karteAnpassen(prototypKarte().karte);
  const c = new CardController({ card: karte, ...a, onSearch: (on) => calls.push("onSearch(" + on + ")") });
  const altOpen = sound.bubbleOpen;
  sound.bubbleOpen = () => calls.push("sound.bubbleOpen");
  globalThis.window = { open: (u, z, f) => calls.push("window.open(" + u + "," + z + "," + f + ")") };
  const pose = () => Object.entries(a.nodes.bodies).find(([, b]) => b.visible)[0];
  const ende = () => { sound.bubbleOpen = altOpen; c.clearTimers(); };
  const start = () => { c.onCardSeen(); c.onCardTapped(); a.bubble.onDone(); calls.push("-- Menü steht, Phase " + c.phase); };
  return { c, calls, a, pose, ende, start, mark: (s) => calls.push("-- " + s) };
}

test("Ablauf 1: Antwort → Rückfrage → Option → zurück; zweite Antwort; Lebendig-Phase und Lesezeit", (t) => {
  const { c, calls, a, pose, ende, start, mark } = aufbau(t);
  try {
    start();
    assert.ok(c.timers.idle);
    c.onTheme("alltag"); c.onBack(); // live, nicht sprechend → Menü
    c.onTheme("alltag");
    mark("Frage was");
    c.answerQuestion("was");
    c.onTheme("beruf"); c.onBack(); c.answerQuestion("koennen"); // beim Sprechen ignoriert
    assert.equal(pose(), "idle"); // Tag der Frage → Pose
    mark("Blase fertig → Weiter wartet (Rückfrage folgt)");
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.livelyAfterMs); // Lebendig-Phase trotz wartendem Weiter
    assert.equal(c.onBubbleTapped(), true); // Weiter per Blase
    mark("Rückfrage neigung gestellt");
    a.bubble.onDone();
    c.onOption(c.engine.card.asks[0].options[0]);
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.continueDelayMs);
    mark("zurück im Hub, Phase " + c.phase + ", view " + c.engine.view.mode);
    c.answerQuestion("technik"); // durch neigung freigeschaltet
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.continueDelayMs);
    mark("Lesezeit läuft");
    t.mock.timers.tick(CHOREO.livelyAfterMs);
    t.mock.timers.tick(c.data.idleReturnMs - CHOREO.livelyAfterMs);
    mark("Lesezeit vorbei");
    assert.equal(c.data.idleReturnMs, 16000);
    pruefeSnapshot("cardController.ablauf1", calls);
  } finally { ende(); }
});

test("Ablauf 2: mehrseitige Antwort (Weiter zwischen Seiten, Anfangston nur einmal), Link-Frage mit window.open in der Geste", (t) => {
  const { c, calls, a, ende, start, mark } = aufbau(t, (k) => {
    k.questions.find((q) => q.id === "koennen").text = "Seite eins.||Seite zwei.";
    return k;
  });
  try {
    start();
    c.answerQuestion("koennen");
    a.bubble.onDone();
    mark("Seite 1 fertig");
    c.onNext();
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.continueDelayMs);
    assert.equal(calls.filter((x) => x === "sound.bubbleOpen").length, 2, "ein Ton je Antwort, nicht je Seite");
    mark("Link-Frage");
    c.engine.unlock(["bewerbung", "link"]);
    c.answerQuestion("link");
    a.bubble.onDone();
    assert.equal(c.pendingContinue !== null, true);
    c.onNext();
    mark("Phase " + c.phase);
    pruefeSnapshot("cardController.ablauf2", calls);
    assert.ok(calls.some((x) => x.startsWith("window.open(") && x.endsWith(",_blank,noopener)")));
  } finally { ende(); }
});

test("Ablauf 3: Ausstieg → Fazit → Abschied → Ruhezustand → Tap → Wiedereinstieg; Verlust im Ruhezustand", (t) => {
  const { c, calls, a, ende, start, mark } = aufbau(t);
  try {
    start();
    c.answerQuestion("ende");
    a.bubble.onDone(); // Fazit-Prompt fertig → Optionen
    c.onOption(c.engine.card.asks.find((x) => x.id === "fazit").options[1]);
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.continueDelayMs); // → Abschied
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.collapseDelayMs);
    mark("Phase " + c.phase + ", acceptsCardTap " + c.acceptsCardTap + ", lostHintWanted " + c.lostHintWanted);
    assert.equal(c.phase, "resting");
    c.onTrackingLost(); t.mock.timers.tick(CHOREO.trackingLostMs);
    mark("verloren im Ruhezustand, menu.phase " + a.menu.phase);
    c.onTrackingFound();
    mark("Tap im Ruhezustand → " + c.onCardTapped());
    a.bubble.onDone();
    t.mock.timers.tick(CHOREO.continueDelayMs);
    mark("Phase " + c.phase + ", Besuche " + c.engine.visits);
    assert.equal(c.onCardTapped(), false);
    assert.equal(c.engine.asked.has("ende"), false, "Ausstieg wieder möglich");
    pruefeSnapshot("cardController.ablauf3", calls);
  } finally { ende(); }
});
