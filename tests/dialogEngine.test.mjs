/* DialogEngine (js/dialogEngine.js): Zustand des Gesprächs — Freischaltungen,
   NEU-Marken, Rückfragen, Zweige über die steuernde Variable, Wiedereinstieg.
   Datengrundlage: die Prototyp-Karte karten/000/ (Siemens-Dialog). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DialogEngine } from "../js/dialogEngine.js";
import { prototypKarte } from "./karte.mjs";

const karte = () => prototypKarte().karte;
const ids = (qs) => qs.map((q) => q.id);
const thema = (e, id) => e.themes().find((t) => t.id === id);

test("Start: nur initial freigeschaltet, je Thema eine offene Frage, Ausstieg da", () => {
  const e = new DialogEngine(karte());
  assert.deepEqual([...e.unlocked], ["was", "koennen", "jetzt_tun", "ende"]);
  assert.deepEqual(e.themes().map((t) => [t.id, t.open, t.fresh, t.done]),
    [["alltag", 1, false, false], ["beruf", 1, false, false], ["wege", 1, false, false]]);
  assert.equal(e.exitQuestion().id, "ende");
  assert.deepEqual(e.view, { mode: "themen", thema: null });
  assert.equal(e.visits, 1);
});

test("markAsked schaltet frei und markiert NEU; zweites Mal schaltet nichts", () => {
  const e = new DialogEngine(karte());
  const was = e.questionById("was");
  assert.equal(e.markAsked(was), false);
  assert.ok(e.asked.has("was"));
  assert.deepEqual([...e.fresh], ["tag_ablauf", "purpose"]);
  assert.equal(thema(e, "alltag").open, 1);   // tag_ablauf
  assert.equal(thema(e, "alltag").fresh, true);
  assert.equal(thema(e, "beruf").open, 2);    // koennen + purpose
  assert.equal(e.freshElsewhere("alltag"), true);  // purpose liegt in beruf
  assert.equal(e.freshElsewhere("wege"), true);
  // Die Frage selbst verliert ihre NEU-Marke, sobald sie gestellt ist
  e.unlock(["was"]);
  assert.equal(e.fresh.has("was"), false);
  // Zweites Stellen: liefert true und schaltet nichts erneut frei
  e.fresh.clear();
  assert.equal(e.markAsked(was), true);
  assert.equal(e.fresh.size, 0);
});

test("unlock fügt nur hinzu und markiert nur wirklich Neues", () => {
  const e = new DialogEngine(karte());
  e.unlock(["koennen", "danach"]); // koennen ist schon initial
  assert.deepEqual([...e.fresh], ["danach"]);
  e.unlock(undefined);
  assert.equal(e.unlocked.size, 5);
});

test("Reihenfolge im Thema: Zweigfrage zuerst, Dateireihenfolge, gestellte ans Ende", () => {
  const e = new DialogEngine(karte());
  e.markAsked(e.questionById("was")); // → tag_ablauf frei
  e.applyOption({ sets: { neigung: "menschen" }, unlocks: ["reden"] });
  assert.deepEqual(ids(e.sortedQuestionsOf("alltag")), ["reden", "tag_ablauf", "was"]);
  assert.deepEqual(ids(e.openOf("alltag")), ["tag_ablauf", "reden"]);
});

test("requires: Zweigfrage erscheint nur bei passender Variable", () => {
  const e = new DialogEngine(karte());
  e.unlock(["reden", "technik"]);
  assert.deepEqual(ids(e.questionsOf("alltag")), ["was"]); // Variable fehlt
  e.applyOption({ sets: { neigung: "maschinen" } });
  assert.deepEqual(ids(e.questionsOf("alltag")), ["was", "technik"]);
  assert.equal(e.meetsRequirement(e.questionById("reden")), false);
  assert.equal(e.meetsRequirement(e.questionById("technik")), true);
  assert.equal(e.meetsRequirement(e.questionById("was")), true);
});

test("Rückfragen: nach der 1. und 3. Antwort, beim Ausstieg, jede nur einmal", () => {
  const e = new DialogEngine(karte());
  assert.equal(e.askAfterAnswers(), null);
  e.markAsked(e.questionById("was"));
  const erste = e.askAfterAnswers();
  assert.equal(erste.id, "neigung");
  e.beginAsk(erste);
  assert.equal(e.askAfterAnswers(), null); // schon dran gewesen
  e.markAsked(e.questionById("koennen"));
  assert.equal(e.askAfterAnswers(), null); // nach der 2. Antwort nichts
  e.markAsked(e.questionById("jetzt_tun"));
  assert.equal(e.askAfterAnswers().id, "quiz");
  assert.equal(e.askOnExit().id, "fazit");
  e.beginAsk(e.askOnExit());
  assert.equal(e.askOnExit(), null);
});

test("applyOption setzt die Variable und schaltet frei", () => {
  const e = new DialogEngine(karte());
  const neigung = e.card.asks.find((a) => a.id === "neigung");
  e.applyOption(neigung.options[0]); // Eher mit Menschen
  assert.deepEqual(e.vars, { neigung: "menschen" });
  assert.ok(e.unlocked.has("reden") && e.fresh.has("reden"));
  e.applyOption(neigung.options[2]); // Weiß ich noch nicht: setzt, schaltet nichts
  assert.equal(e.vars.neigung, "unbekannt");
  assert.equal(e.unlocked.has("technik"), false);
  e.applyOption({});
  assert.equal(e.unlocked.size, 5);
});

test("settleView: im Thema bleiben, bis dort nichts Offenes mehr steht", () => {
  const e = new DialogEngine(karte());
  e.enterThema("wege");
  assert.deepEqual(e.view, { mode: "thema", thema: "wege" });
  e.settleView();
  assert.equal(e.view.mode, "thema"); // jetzt_tun offen
  e.markAsked(e.questionById("jetzt_tun")); // → praktikum_wie frei
  e.settleView();
  assert.equal(e.view.mode, "thema");
  e.markAsked(e.questionById("praktikum_wie")); // → praktikum_was frei
  e.markAsked(e.questionById("praktikum_was"));
  e.settleView();
  assert.deepEqual(e.view, { mode: "themen", thema: null });
  assert.equal(thema(e, "wege").done, true);
  e.enterThema("alltag");
  e.leaveThema();
  assert.equal(e.view.mode, "themen");
});

test("Wiedereinstieg: Besuche zählen, Ausstieg wieder möglich, Regel nach Besuch", () => {
  const k = karte();
  const e = new DialogEngine(k);
  const regeln = k.reentry.rules; // [ifVisit 4, ifVisit 3, Standard]
  e.markAsked(e.questionById("ende"));
  assert.ok(e.asked.has("ende"));
  const r = e.reenter();
  assert.equal(e.visits, 2);
  assert.equal(e.asked.has("ende"), false);
  assert.equal(r.text, regeln[2].text);
  assert.equal(e.reenter().text, regeln[1].text); // 3. Besuch
  assert.equal(e.reenter().text, regeln[0].text); // 4. Besuch
  assert.equal(e.reenter().text, regeln[0].text); // 5. Besuch: erste passende Regel
});

test("Wiedereinstieg: ifVar, ifAsked, ifNotAsked — erste passende Regel gewinnt", () => {
  const k = {
    initial: ["a", "b"],
    questions: [{ id: "a" }, { id: "b" }, { id: "ende", end: true }],
    reentry: { rules: [
      { ifVar: { neigung: ["menschen"] }, text: "var" },
      { ifAsked: ["a"], ifNotAsked: ["b"], text: "asked" },
      { text: "standard" },
    ] },
  };
  const e = new DialogEngine(k);
  assert.equal(e.reenter().text, "standard");
  e.markAsked({ id: "a" });
  assert.equal(e.reenter().text, "asked");
  e.markAsked({ id: "b" });
  assert.equal(e.reenter().text, "standard");
  e.vars.neigung = "menschen";
  assert.equal(e.reenter().text, "var");
  assert.equal(new DialogEngine({ questions: [] }).reenter(), null);
});

test("reset stellt den Startzustand her", () => {
  const e = new DialogEngine(karte());
  e.markAsked(e.questionById("was"));
  e.applyOption({ sets: { neigung: "menschen" }, unlocks: ["reden"] });
  e.beginAsk({ id: "neigung" });
  e.enterThema("alltag");
  e.reenter();
  e.reset();
  assert.deepEqual([...e.unlocked], ["was", "koennen", "jetzt_tun", "ende"]);
  assert.equal(e.asked.size, 0);
  assert.equal(e.fresh.size, 0);
  assert.deepEqual(e.vars, {});
  assert.equal(e.asksDone.size, 0);
  assert.equal(e.visits, 1);
  assert.equal(e.view.mode, "themen");
});

test("Karte ohne Themen, Rückfragen oder initial bricht nicht", () => {
  const e = new DialogEngine({ questions: [] });
  assert.deepEqual(e.themes(), []);
  assert.equal(e.askAfterAnswers(), null);
  assert.equal(e.exitQuestion(), null);
  assert.equal(e.questionById("x"), null);
});
