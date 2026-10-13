/* Dialogprüfung ohne Browser (tools/dialogpruefung.mjs), Seiten-Schätzung
   (tools/seitenSchaetzung.js) und Bau des Skills „detar-dialog“ (2026-10-13). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pruefeDialog, lesefassungMarkdown } from "../tools/dialogpruefung.mjs";
import { schaetzeSeiten, ZEICHEN_JE_ZEILE, ZEILEN_JE_SEITE } from "../tools/seitenSchaetzung.js";
import { parseChars, wrapWords, paginateChars, charsToString } from "../js/bubbleText.js";
import { baueSkill, DATEIEN } from "../tools/baue-dialog-skill.mjs";

const vorbild = () => JSON.parse(fs.readFileSync(new URL("../karten/000/dialog.json", import.meta.url), "utf8"));

test("wrapWords/paginateChars: Umbruch an Wortgrenzen, Seiten am Satzende", () => {
  const chars = parseChars("Eins zwei drei. Vier fünf sechs.");
  const breite = (c) => c.length;
  const zeilen = wrapWords(chars, breite, 10).map(charsToString);
  assert.deepEqual(zeilen, ["Eins zwei", "drei. Vier", "fünf", "sechs."]);
  const seiten = paginateChars(chars, (c) => wrapWords(c, breite, 10).length <= 2).map(charsToString);
  assert.deepEqual(seiten, ["Eins zwei drei.", "Vier fünf sechs."]);
  assert.deepEqual(paginateChars([], () => true), []);
});

test("Seiten-Schätzung: kurz = 1 Seite, lang = mehr, Auszeichnung ändert nichts", () => {
  assert.equal(schaetzeSeiten("Genau."), 1);
  assert.equal(schaetzeSeiten(""), 1);
  const satz = "Ich baue Schaltanlagen für Fabriken und prüfe sie.";
  assert.equal(schaetzeSeiten(satz), 1);
  const lang = Array(6).fill(satz).join(" ");
  assert.ok(schaetzeSeiten(lang) >= 3);
  assert.equal(schaetzeSeiten("Bei Strom ist Schludern <marker>keine Option</marker>."), schaetzeSeiten("Bei Strom ist Schludern keine Option."));
  assert.equal(ZEILEN_JE_SEITE, 5);
  assert.ok(ZEICHEN_JE_ZEILE > 20 && ZEICHEN_JE_ZEILE < 30);
});

test("Prüfung: Vorbild mit Firmenname fehlerfrei, Lesefassung vollständig", () => {
  const r = pruefeDialog(vorbild(), { firma: "Siemens" });
  assert.deepEqual(r.fehler, []);
  assert.ok(r.texte.every((t) => Number.isInteger(t.seiten) && t.seiten >= 1));
  const md = lesefassungMarkdown(vorbild(), { firma: "Siemens" });
  for (const teil of ["## Neutrale Fassung", "## Firmenfassung", "## Länge je Text", "### Alltag im Job", "### Wiedereinstieg"]) assert.ok(md.includes(teil), teil);
  assert.ok(!md.split("## Firmenfassung")[0].includes("Siemens"), "neutrale Lesefassung nennt die Firma nicht");
});

test("Prüfung: ohne Firmenname Fehler, --final macht [Annahme] zum Fehler", () => {
  assert.ok(pruefeDialog(vorbild()).fehler.some((f) => f.startsWith("Firmenname fehlt")));
  const fin = pruefeDialog(vorbild(), { firma: "Siemens", final: true });
  assert.ok(fin.fehler.some((f) => f.includes("[Annahme]")));
  assert.ok(!fin.hinweise.some((h) => h.includes("[Annahme]")));
  const ohne = JSON.parse(JSON.stringify(vorbild()).replace(/ \[Annahme\]/g, ""));
  assert.deepEqual(pruefeDialog(ohne, { firma: "Siemens", final: true }).fehler, []);
});

test("Prüfung: ausgeschriebener Firmenname und fremde Felder sind Fehler", () => {
  const d = vorbild();
  d.greeting.text = d.greeting.text.replace("{firma}", "Siemens");
  d._hinweis = "x";
  const r = pruefeDialog(d, { firma: "Siemens" });
  assert.ok(r.fehler.some((f) => f.includes("ausgeschrieben")));
  assert.ok(r.fehler.some((f) => f.includes("„_hinweis“")));
});

test("Prüfung: weitere Namensformen, Datum und Betrag", () => {
  const d = vorbild();
  d.questions.find((q) => q.id === "was").text += " Bei SIEM ist das so.";
  d.questions.find((q) => q.id === "danach").text += " Start ist am 01.09.2027.";
  d.questions.find((q) => q.id === "jetzt_tun").text += " Im ersten Jahr verdienst du 1.122.";
  const r = pruefeDialog(d, { firma: ["Siemens", "SIEM"] });
  assert.ok(r.fehler.some((f) => f.includes("„SIEM“")), "Kurzform");
  assert.ok(r.fehler.some((f) => f.startsWith("Frage danach") && f.includes("Datum")), "Datum");
  assert.ok(r.fehler.some((f) => f.startsWith("Frage jetzt_tun") && f.includes("Geld")), "Betrag");
  assert.deepEqual(pruefeDialog(vorbild(), { firma: ["Siemens", "Siemens AG"] }).fehler, []);
});

test("Lesefassung: nach den Optionen eine Leerzeile", () => {
  const md = lesefassungMarkdown(vorbild(), { firma: "Siemens" });
  assert.ok(!/^- \*\*→ .*\n\*\*/m.test(md), "Rückfrage hängt nicht am letzten Listenpunkt");
});

test("Skill-Bau: alle Dateien da, kopiertes Prüfprogramm läuft", async () => {
  const ziel = fs.mkdtempSync(path.join(os.tmpdir(), "detar-skill-"));
  try {
    const r = await baueSkill(ziel, { zip: false });
    const skill = fs.readFileSync(path.join(r.ordner, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: detar-dialog\ndescription: /);
    assert.ok(!skill.includes("{{STAND}}"));
    assert.match(r.stand, /^\d{2}\.\d{2}\.\d{4}$/);
    for (const [, nach] of DATEIEN) assert.ok(fs.existsSync(path.join(r.ordner, nach)), nach);
    for (const ref of skill.match(/`(references|scripts)\/[^`]+`/g)) assert.ok(fs.existsSync(path.join(r.ordner, ref.slice(1, -1))), ref);
  } finally { fs.rmSync(ziel, { recursive: true, force: true }); }
});
