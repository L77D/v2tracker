/* Variante (js/edition.js): S Schule, B Business, P Public (Build 112) —
   link-Fragen nur in B, branded-Fragen nicht in P, Ids bereinigt,
   <feld>Public-Texte, {firma}-Ersetzung, alter Parameter publicMode. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareCard, normVariante, VARIANTEN, VARIANTE_STANDARD } from "../js/edition.js";
import { prototypKarte } from "./karte.mjs";

const frage = (c, id) => c.questions.find((q) => q.id === id);

test("normVariante: groß, getrimmt, unbekannt → Standard S", () => {
  assert.deepEqual(VARIANTEN, ["S", "B", "P"]);
  assert.equal(VARIANTE_STANDARD, "S");
  for (const [v, soll] of [["S", "S"], ["b", "B"], [" p ", "P"], ["x", "S"], ["", "S"], [null, "S"], [undefined, "S"]]) assert.equal(normVariante(v), soll, String(v));
});

test("B (Business): {firma} wird zur Firma, Link-Frage bleibt, Ids unverändert", () => {
  const { karte } = prototypKarte();
  const c = prepareCard(karte, { variante: "B" });
  assert.equal(c.edition, "B");
  assert.equal(c.company, "Siemens");
  assert.ok(c.greeting.text.includes("bei Siemens"));
  assert.ok(!c.greeting.text.includes("{firma}"));
  assert.ok(frage(c, "link"));
  assert.deepEqual(frage(c, "bewerbung").unlocks, ["link"]);
  assert.deepEqual(c.initial, karte.initial);
  assert.equal(c.questions.length, karte.questions.length);
});

test("S (Schule, Standard): wie B, aber ohne Link-Frage und ohne deren Id", () => {
  const { karte } = prototypKarte();
  const c = prepareCard(karte);
  assert.equal(c.edition, "S");
  assert.equal(c.company, "Siemens");
  assert.equal(c.companyLogo, karte.companyLogo);
  assert.ok(c.greeting.text.includes("bei Siemens"));
  assert.equal(frage(c, "link"), undefined);
  assert.deepEqual(frage(c, "bewerbung").unlocks, []);
  assert.equal(c.questions.length, karte.questions.length - 1);
  assert.equal(frage(c, "bewerbung").text, karte.questions.find((q) => q.id === "bewerbung").text.replace("{firma}", "Siemens"));
  assert.deepEqual(prepareCard(karte, { variante: "s" }).questions.map((q) => q.id), c.questions.map((q) => q.id));
});

test("P (Public): branded und link raus, Ids bereinigt, Public-Texte, nirgends Firma oder {firma}", () => {
  const { karte } = prototypKarte();
  const c = prepareCard(karte, { variante: "P" });
  assert.equal(c.edition, "P");
  assert.equal(c.company, null);
  assert.equal(c.companyLogo, null);
  assert.equal(frage(c, "link"), undefined);
  assert.deepEqual(frage(c, "bewerbung").unlocks, []);
  assert.equal(c.questions.length, karte.questions.length - 1);
  assert.equal(c.greeting.text, karte.greeting.textPublic);
  const bewerbung = karte.questions.find((q) => q.id === "bewerbung");
  assert.equal(frage(c, "bewerbung").text, bewerbung.textPublic);
  const texte = [c.greeting.text,
    ...c.questions.flatMap((q) => [q.label, q.text]),
    ...c.asks.flatMap((a) => [a.prompt, ...a.options.flatMap((o) => [o.label, o.reply])]),
    ...c.reentry.rules.map((r) => r.text)];
  for (const t of texte) assert.ok(!/siemens|\{firma\}/i.test(t ?? ""), t);
  // alte Schreibweise (Build 75–111) liefert dasselbe
  assert.deepEqual(prepareCard(karte, { publicMode: true }), c);
});

test("link ohne branded und branded ohne link: Regeln getrennt", () => {
  const k = { company: "Acme", initial: ["l", "b", "n"],
    questions: [{ id: "l", text: "L", link: true }, { id: "b", text: "B", branded: true }, { id: "n", text: "N", unlocks: ["l", "b"] }] };
  const ids = (v) => prepareCard(k, { variante: v }).questions.map((q) => q.id);
  assert.deepEqual(ids("B"), ["l", "b", "n"]);
  assert.deepEqual(ids("S"), ["b", "n"]);
  assert.deepEqual(ids("P"), ["n"]);
  assert.deepEqual(prepareCard(k, { variante: "S" }).initial, ["b", "n"]);
  assert.deepEqual(frage(prepareCard(k, { variante: "S" }), "n").unlocks, ["b"]);
  assert.deepEqual(frage(prepareCard(k, { variante: "P" }), "n").unlocks, []);
});

test("Public ohne Public-Fassung: Notnagel companyNeutral, sonst „der Betrieb“", () => {
  const k = { company: "Acme", companyNeutral: "die Firma", questions: [{ id: "q", text: "Bei {firma} ist es gut." }] };
  assert.equal(prepareCard(k, { variante: "P" }).questions[0].text, "Bei die Firma ist es gut.");
  delete k.companyNeutral;
  assert.equal(prepareCard(k, { variante: "P" }).questions[0].text, "Bei der Betrieb ist es gut.");
  assert.equal(prepareCard(k).questions[0].text, "Bei Acme ist es gut.");
  assert.equal(prepareCard({ questions: [{ id: "q", text: "{firma} {firma}" }] }).questions[0].text, " ");
});

test("Rückfragen und Wiedereinstieg: Public-Fassung je Feld, unlocks und initial bereinigt", () => {
  const k = {
    company: "Acme", initial: ["a", "b"],
    questions: [{ id: "a", text: "A", unlocks: ["b"] }, { id: "b", text: "B", branded: true }],
    asks: [{ id: "x", prompt: "P {firma}", promptPublic: "P neutral",
      options: [{ label: "L", labelPublic: "LP", reply: "R {firma}", replyPublic: "RP", unlocks: ["b", "a"] }] }],
    reentry: { rules: [{ text: "T {firma}", textPublic: "TP" }] },
  };
  const p = prepareCard(k, { variante: "P" });
  assert.deepEqual(p.initial, ["a"]);
  assert.deepEqual(p.questions.map((q) => q.id), ["a"]);
  assert.deepEqual(p.questions[0].unlocks, []);
  assert.equal(p.asks[0].prompt, "P neutral");
  assert.equal(p.asks[0].options[0].label, "LP");
  assert.equal(p.asks[0].options[0].reply, "RP");
  assert.deepEqual(p.asks[0].options[0].unlocks, ["a"]);
  assert.equal(p.reentry.rules[0].text, "TP");
  for (const v of ["S", "B"]) {
    const f = prepareCard(k, { variante: v });
    assert.deepEqual(f.initial, ["a", "b"]);
    assert.equal(f.asks[0].prompt, "P Acme");
    assert.equal(f.asks[0].options[0].label, "L");
    assert.equal(f.asks[0].options[0].reply, "R Acme");
    assert.deepEqual(f.asks[0].options[0].unlocks, ["b", "a"]);
    assert.equal(f.reentry.rules[0].text, "T Acme");
    // Public-Felder bleiben am Objekt (die Prüfseite liest sie), das Original auch
    assert.equal(f.asks[0].promptPublic, "P neutral");
  }
});

test("prepareCard verändert die Eingabe nicht", () => {
  const { karte } = prototypKarte();
  const vorher = JSON.stringify(karte);
  for (const v of ["S", "B", "P"]) prepareCard(karte, { variante: v });
  prepareCard(karte);
  assert.equal(JSON.stringify(karte), vorher);
});

test("Karte ohne Dialogfelder bricht nicht", () => {
  const c = prepareCard({});
  assert.deepEqual(c.questions, []);
  assert.deepEqual(c.asks, []);
  assert.equal(c.greeting, undefined);
  assert.equal(c.initial, undefined);
  assert.equal(c.reentry, undefined);
  assert.equal(c.edition, "S");
});
