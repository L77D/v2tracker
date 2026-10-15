/* QuestionMenu (js/questionMenu.js): DOM-Baum je Phase, Reiter NEU/LINK/✅,
   Seitenpunkte, Tilt, Hooks, Einfrieren, syncCssVars — Characterization Test
   (Stand Build 110) mit dem Mini-DOM aus tests/domAttrappe.mjs.
   Snapshot: tests/fixtures/questionMenu.snapshot.json */
import { test } from "node:test";
import assert from "node:assert/strict";
import { installiereDom, serialisiere, Element } from "./domAttrappe.mjs";
import { prototypKarte } from "./karte.mjs";
import { pruefeSnapshot, mitZufall } from "./snapshot.mjs";

const html = installiereDom();
const { QuestionMenu, syncCssVars } = await import("../js/questionMenu.js");
const { DialogEngine } = await import("../js/dialogEngine.js");
const { CHOREO } = await import("../js/config.js");

function aufbau() {
  const rufe = [];
  const hooks = {
    onQuestion: (q) => rufe.push("frage:" + q.id), onTheme: (id) => rufe.push("thema:" + id), onBack: () => rufe.push("zurueck"),
    onOption: (o) => rufe.push("option:" + o.label), onNext: () => rufe.push("weiter"), onReentry: () => rufe.push("wiedereinstieg"),
  };
  const root = new Element("div");
  const engine = new DialogEngine(prototypKarte().karte);
  const menu = mitZufall(3, () => new QuestionMenu(root, engine, hooks)); // IconHandy würfelt Blinzel-Abstände
  return { root, engine, menu, rufe, baum: () => serialisiere(root) };
}
const klick = (el) => el.onclick?.({});
// IconHandy hält endlose setTimeout-Ketten → am Testende abbauen, sonst endet der Prozess nie
const aufraeumen = (menu) => menu.resetRoot();

test("syncCssVars schreibt CHOREO in CSS-Variablen", () => {
  syncCssVars();
  assert.deepEqual(html.styleProps, { "--q-reveal-time": CHOREO.uiRevealMs / 1000 + "s", "--q-reveal-offset": CHOREO.revealOffset + "px" });
});

test("Phasen-Bäume gegen den Snapshot von Build 110", () => {
  const { root, engine, menu, rufe, baum } = aufbau();
  const schnappschuss = {};
  schnappschuss.onboarding = baum();
  assert.equal(menu.phase, "onboarding");
  menu.showAttract(); schnappschuss.attract = baum(); assert.equal(menu.phase, "attract");
  menu.hideOnboarding(); schnappschuss.leer = baum(); assert.equal(menu.phase, "speaking");
  menu.revealUI(); schnappschuss.themenReveal = baum(); assert.equal(menu.phase, "themen");
  menu.revealUI(); menu.showAttract(); menu.hideOnboarding(); // nach dem Reveal wirkungslos
  assert.equal(menu.phase, "themen");
  // Thema „alltag" mit erster Frage, NEU in anderem Thema, ✅ auf einer Frage
  engine.markAsked(engine.questionById("was")); // schaltet frei → NEU-Marken
  engine.enterThema("alltag");
  menu.showThema("alltag"); schnappschuss.themaAlltag = baum(); assert.equal(menu.phase, "thema");
  engine.unlock(["bewerbung", "link"]);
  menu.showThema("wege"); schnappschuss.themaWegeMitLink = baum();
  menu.showThemen(); schnappschuss.themenMitNeu = baum();
  menu.showOptions(engine.card.asks[0].options); schnappschuss.options = baum(); assert.equal(menu.phase, "options");
  menu.showNext("Seite öffnen"); schnappschuss.next = baum(); assert.equal(menu.phase, "next");
  menu.showNext(); schnappschuss.nextWeiter = baum();
  menu.showIdle(false); schnappschuss.idle = baum(); assert.equal(menu.phase, "idle");
  menu.showIdle(true); schnappschuss.idleLost = baum(); assert.equal(menu.phase, "idle-lost");
  menu.setFrozen(true); schnappschuss.idleLostFrozen = baum();
  menu.showThemen(); schnappschuss.themenFrozen = baum();
  menu.setFrozen(false); schnappschuss.themenAufgetaut = baum();
  menu.reset(); schnappschuss.reset = baum(); assert.equal(menu.phase, "onboarding"); assert.equal(menu.revealed, false);
  pruefeSnapshot("questionMenu.snapshot", schnappschuss);
  assert.deepEqual(rufe, []);
  assert.equal(root.children.length, 1);
  aufraeumen(menu);
});

test("Hooks: Kacheln, Zurück, Weiter, Optionen, Wiedereinstieg; eingefroren feuert nichts; selected-Markierung", () => {
  const { root, engine, menu, rufe } = aufbau();
  menu.revealUI();
  const kacheln = root.querySelectorAll("button.detar-tile");
  assert.equal(kacheln.length, 4); // drei Themen + „Ich muss weiter"
  klick(kacheln[0]); klick(kacheln[3]);
  assert.deepEqual(rufe, ["thema:alltag", "frage:ende"]);
  assert.ok(kacheln[3].hat("selected") && !kacheln[0].hat("selected"));
  menu.clearSelection(); assert.ok(!kacheln[3].hat("selected"));
  engine.enterThema("alltag"); menu.showThema("alltag");
  klick(root.querySelector("button.detar-back")); assert.equal(rufe.at(-1), "zurueck");
  klick(root.querySelector("button.detar-tile")); assert.equal(rufe.at(-1), "frage:was");
  menu.showOptions(engine.card.asks[0].options);
  klick(root.querySelectorAll("button.detar-tile")[1]); assert.equal(rufe.at(-1), "option:" + engine.card.asks[0].options[1].label);
  menu.showNext(); klick(root.querySelector("button.detar-tile")); assert.equal(rufe.at(-1), "weiter");
  assert.ok(!root.querySelector("button.detar-tile").hat("selected"), "Weiter-Kachel ohne selected");
  menu.showIdle(false); klick(root.querySelector("div.support")); assert.equal(rufe.at(-1), "wiedereinstieg");
  menu.showIdle(true); assert.equal(root.querySelector("div.support").onclick, null);
  const n = rufe.length;
  menu.setFrozen(true);
  menu.showThemen(); klick(root.querySelector("button.detar-tile"));
  engine.enterThema("alltag"); menu.showThema("alltag"); klick(root.querySelector("button.detar-back")); klick(root.querySelector("button.detar-tile"));
  menu.showNext(); klick(root.querySelector("button.detar-tile"));
  menu.showIdle(false); klick(root.querySelector("div.support"));
  assert.equal(rufe.length, n, "eingefroren: kein Hook");
  assert.ok(root.querySelector("div.detar-panel").hat("detar-panel--frozen"));
  aufraeumen(menu);
});

test("Karussell: Seitenpunkte folgen scrollLeft (Seitenbreite + 4 px)", () => {
  const { root, engine, menu } = aufbau();
  for (const q of engine.card.questions) engine.unlocked.add(q.id);
  engine.enterThema("wege"); menu.showThema("wege"); // 5 Fragen → 2 Seiten
  const punkte = root.querySelectorAll("span.detar-dot");
  const seiten = root.querySelectorAll("div.detar-page");
  assert.ok(punkte.length === seiten.length && seiten.length >= 2, punkte.length + "/" + seiten.length);
  const wrap = root.querySelector("div.detar-pages");
  wrap.scrollLeft = 304; wrap.listeners.scroll[0]();
  assert.deepEqual(punkte.map((d) => d.hat("active")), punkte.map((_, i) => i === 1));
  wrap.scrollLeft = 100; wrap.listeners.scroll[0]();
  assert.deepEqual(punkte.map((d) => d.hat("active")), punkte.map((_, i) => i === 0));
  aufraeumen(menu);
});

test("jumpIconOut: ohne Icon sofort zurück; mit Icon erst nach animationend (oder destroy)", () => {
  const { root, menu } = aufbau();
  let n = 0;
  menu.jumpIconOut(() => n++);
  assert.equal(n, 0);
  const icon = root.querySelector("div.support-icon");
  assert.ok(icon.hat("support-icon--jump"));
  icon.listeners.animationend[0]();
  assert.equal(n, 1);
  assert.equal(icon.styleProps.visibility, "hidden");
  menu.showAttract(); menu.jumpIconOut(() => n++); menu.clear(); // destroy feuert aus
  assert.equal(n, 2);
  aufraeumen(menu);
});
