/* Edition (js/edition.js): Firmenfassung vs. Public-Fassung (?k=<nr>P) —
   branded-Fragen raus, Ids bereinigt, <feld>Public-Texte, {firma}-Ersetzung. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareCard } from "../js/edition.js";
import { prototypKarte } from "./karte.mjs";

const frage = (c, id) => c.questions.find((q) => q.id === id);

test("Firmenfassung: {firma} wird zur Firma, Link-Frage bleibt, Ids unverändert", () => {
  const { karte } = prototypKarte();
  const c = prepareCard(karte);
  assert.equal(c.edition, "firma");
  assert.equal(c.company, "Siemens");
  assert.ok(c.greeting.text.includes("bei Siemens"));
  assert.ok(!c.greeting.text.includes("{firma}"));
  assert.ok(frage(c, "link"));
  assert.deepEqual(frage(c, "bewerbung").unlocks, ["link"]);
  assert.deepEqual(c.initial, karte.initial);
  assert.equal(c.questions.length, karte.questions.length);
});

test("Public: branded raus, Ids bereinigt, Public-Texte, nirgends Firma oder {firma}", () => {
  const { karte } = prototypKarte();
  const c = prepareCard(karte, { publicMode: true });
  assert.equal(c.edition, "public");
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
});

test("Public ohne Public-Fassung: Notnagel companyNeutral, sonst „der Betrieb“", () => {
  const k = { company: "Acme", companyNeutral: "die Firma", questions: [{ id: "q", text: "Bei {firma} ist es gut." }] };
  assert.equal(prepareCard(k, { publicMode: true }).questions[0].text, "Bei die Firma ist es gut.");
  delete k.companyNeutral;
  assert.equal(prepareCard(k, { publicMode: true }).questions[0].text, "Bei der Betrieb ist es gut.");
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
  const p = prepareCard(k, { publicMode: true });
  assert.deepEqual(p.initial, ["a"]);
  assert.deepEqual(p.questions.map((q) => q.id), ["a"]);
  assert.deepEqual(p.questions[0].unlocks, []);
  assert.equal(p.asks[0].prompt, "P neutral");
  assert.equal(p.asks[0].options[0].label, "LP");
  assert.equal(p.asks[0].options[0].reply, "RP");
  assert.deepEqual(p.asks[0].options[0].unlocks, ["a"]);
  assert.equal(p.reentry.rules[0].text, "TP");
  const f = prepareCard(k);
  assert.deepEqual(f.initial, ["a", "b"]);
  assert.equal(f.asks[0].prompt, "P Acme");
  assert.equal(f.asks[0].options[0].label, "L");
  assert.equal(f.asks[0].options[0].reply, "R Acme");
  assert.deepEqual(f.asks[0].options[0].unlocks, ["b", "a"]);
  assert.equal(f.reentry.rules[0].text, "T Acme");
  // Public-Felder bleiben am Objekt (die Prüfseite liest sie), das Original auch
  assert.equal(f.asks[0].promptPublic, "P neutral");
});

test("prepareCard verändert die Eingabe nicht", () => {
  const { karte } = prototypKarte();
  const vorher = JSON.stringify(karte);
  prepareCard(karte, { publicMode: true });
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
  assert.equal(c.edition, "firma");
});
