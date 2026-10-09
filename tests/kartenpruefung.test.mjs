/* Kartenprüfung (tools/kartenpruefung.js): die maschinellen Regeln aus
   docs/dialog-regelwerk.md. Die Prototyp-Karte muss fehlerfrei durchlaufen;
   jede Verletzung wird an einer gezielt verdorbenen Kopie geprüft. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeKarte, lesefassung, ohneAnnahme, PFLICHT, INITIAL, THEMEN } from "../tools/kartenpruefung.js";
import { prototypKarte } from "./karte.mjs";

/* Prüfung mit einer veränderten Kopie der Prototyp-Karte; `aendern` bekommt
   { dialog, daten } und darf beides umbauen. */
function pruefe(aendern = () => {}, optionen = {}) {
  const { dialog, daten } = prototypKarte();
  aendern({ dialog, daten });
  return pruefeKarte({ ...dialog, ...daten }, { dateien: { dialog, daten }, ...optionen });
}
const frage = (d, id) => d.questions.find((q) => q.id === id);
function fehlerMit(r, text) {
  assert.ok(r.fehler.some((f) => f.includes(text)), "erwarteter Fehler „" + text + "“ fehlt in:\n" + r.fehler.join("\n"));
}
function keinFehlerMit(r, text) {
  assert.ok(!r.fehler.some((f) => f.includes(text)), "unerwarteter Fehler „" + text + "“");
}

test("Prototyp-Karte 000 ist fehlerfrei; Hinweise nur zu [Annahme]", () => {
  const r = pruefe();
  assert.deepEqual(r.fehler, []);
  assert.equal(r.hinweise.length, 1);
  assert.match(r.hinweise[0], /\[Annahme\]/);
  assert.ok(r.texte.length > 0);
  assert.ok(r.texte.every((t) => t.seiten === null)); // ohne seiten-Funktion keine Seitenzahl
  // Fassungen: jeder Text taucht für Firma und Public auf, Public ohne Link-Frage
  const firma = r.texte.filter((t) => t.fassung === "Firma").length;
  const pub = r.texte.filter((t) => t.fassung === "Public").length;
  assert.equal(firma, pub + 1);
});

test("Regelwerk-Konstanten passen zur Prototyp-Karte", () => {
  const { dialog } = prototypKarte();
  assert.deepEqual(dialog.initial, INITIAL);
  assert.deepEqual(dialog.themen, THEMEN);
  for (const id of Object.keys(PFLICHT)) assert.ok(frage(dialog, id), id);
});

test("Pflichtfelder und Pflichtfragen", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog.questions = dialog.questions.filter((q) => q.id !== "lernort"); }), "Pflichtfrage „lernort“ fehlt");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "lernort").id = "berufsschule"; }), "heißt seit Build 79 „lernort“");
  fehlerMit(pruefe(({ dialog }) => { delete dialog.persona; }), "Feld „persona“ fehlt");
  fehlerMit(pruefe(({ dialog }) => { dialog.persona.lehrjahr = dialog.persona.jahr; }), "persona.lehrjahr heißt");
  fehlerMit(pruefe(({ dialog }) => { dialog.art = "praktikum"; }), "art muss");
});

test("Nur vorgesehene Felder (A11), je Datei", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog._hinweis = "Notiz"; }), "dialog.json: Feld „_hinweis“ ist nicht vorgesehen");
  fehlerMit(pruefe(({ daten }) => { daten.quelle = "x"; }), "daten.json: Feld „quelle“");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").notiz = "x"; }), "Frage was: Feld „notiz“");
  // Ohne `dateien`: nur Dialogteil → Kartenfelder gelten als fremd
  const { dialog } = prototypKarte();
  assert.deepEqual(pruefeKarte(dialog, { firma: "Siemens" }).fehler, []);
  const ganz = pruefeKarte({ ...dialog, profession: "x" });
  assert.ok(ganz.fehler.some((f) => f.includes("Feld „profession“")));
});

test("Themen, initial, Topologie", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog.themen.reverse(); }), "themen müssen genau sein");
  fehlerMit(pruefe(({ dialog }) => { dialog.initial = ["was", "koennen", "jetzt_tun"]; }), "initial muss genau");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").unlocks = ["tag_ablauf"]; }), "Frage „was“ muss purpose freischalten");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").unlocks.push("danach"); }), "über das Raster hinaus");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").unlocks.push("gibtsnicht"); }), "unbekannte id „gibtsnicht“");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").thema = "beruf"; }), "gehört ins Thema „alltag“");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "ende").thema = "wege"; }), "(Ausstieg) darf kein thema");
  fehlerMit(pruefe(({ dialog }) => { delete frage(dialog, "link").branded; }), "„link“ braucht link: true, branded: true");
  fehlerMit(pruefe(({ dialog }) => { dialog.questions.push({ ...frage(dialog, "was"), id: "was" }); }), "kommt doppelt vor");
});

test("Zusatzfragen: höchstens zwei, jede erreichbar", () => {
  const zusatz = (id) => ({ id, thema: "alltag", label: "L", tag: "neutral", text: "Text." });
  fehlerMit(pruefe(({ dialog }) => { dialog.questions.push(zusatz("extra")); }), "Frage „extra“ wird nie freigeschaltet");
  const ok = pruefe(({ dialog }) => { dialog.questions.push(zusatz("extra")); frage(dialog, "was").unlocks.push("extra"); });
  keinFehlerMit(ok, "extra");
  fehlerMit(pruefe(({ dialog }) => {
    for (const id of ["e1", "e2", "e3"]) { dialog.questions.push(zusatz(id)); frage(dialog, "was").unlocks.push(id); }
  }), "Höchstens 2 Zusatzfragen");
});

test("Steuernde Rückfrage und Zweige", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[1].options[0].sets = { neigung: "x" }; }), "Höchstens eine Rückfrage darf eine Variable setzen");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[0].trigger = { afterAnswers: 3 }; }), "braucht trigger { afterAnswers: 1 }");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[0].options[2].unlocks = ["reden"]; }), "darf nichts freischalten");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "reden").requires = { neigung: ["maschinen"] }; }), "Zweigfrage „reden“ braucht requires");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").requires = { neigung: ["menschen"] }; }), "wird aber von keinem Pol freigeschaltet");
  const ohne = pruefe(({ dialog }) => {
    dialog.asks = dialog.asks.filter((a) => a.id !== "neigung");
    dialog.questions = dialog.questions.filter((q) => !q.requires);
  });
  assert.ok(ohne.hinweise.some((h) => h.includes("keine steuernde Rückfrage")));
  assert.deepEqual(ohne.fehler, []);
});

test("Schätzfrage und Abschiedsfrage", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[1].options.pop(); }), "braucht vier Optionen");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[1].options[3].label = "Egal"; }), "genau eine Option „Keine Ahnung“");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[2].options.pop(); }), "Abschiedsfrage braucht drei Optionen");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[2].options[0].unlocks = []; }), "muss „praktikum_wie“ freischalten");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks.push({ ...dialog.asks[2], id: "fazit2" }); }), "Genau eine Abschiedsfrage");
  fehlerMit(pruefe(({ dialog }) => { dialog.asks[0].trigger = { afterAnswers: 2 }; }), "unbekannten trigger");
  const ohneQuiz = pruefe(({ dialog }) => { dialog.asks = dialog.asks.filter((a) => a.id !== "quiz"); });
  assert.ok(ohneQuiz.hinweise.some((h) => h.includes("Keine Schätzfrage")));
});

test("Wiedereinstieg", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog.reentry.rules = []; }), "reentry.rules ist leer");
  fehlerMit(pruefe(({ dialog }) => { dialog.reentry.rules.at(-1).ifVisit = 2; }), "letzte Wiedereinstiegs-Regel muss ohne Bedingung");
  const wenig = pruefe(({ dialog }) => { dialog.reentry.rules = dialog.reentry.rules.slice(-1); });
  assert.ok(wenig.hinweise.some((h) => h.includes("Richtwert 3")));
});

test("Tags und Auszeichnung", () => {
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").tag = "tanzen"; }), "tag „tanzen“ ist nicht im Vokabular");
  fehlerMit(pruefe(({ dialog }) => { dialog.greeting.tag = undefined; }), "Begrüßung: tag „—“");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").text = "<welle>offen"; }), "<welle> wird nicht geschlossen");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").text = "<blink>x</blink>"; }), "unbekannte Auszeichnung <blink>");
  fehlerMit(pruefe(({ dialog }) => { frage(dialog, "was").text = "<gross><welle>x</welle></gross>"; }), "<welle> steht in <gross>");
  fehlerMit(pruefe(({ dialog }) => { dialog.greeting.textPublic = "x</marker>"; }), "Begrüßung (Public): </marker> ohne passendes");
});

test("Schreibweisen nach dem Tonality Guide (A7)", () => {
  const setze = (text) => pruefe(({ dialog }) => { frage(dialog, "was").text = text; });
  fehlerMit(setze("Die Kolleg/innen helfen."), "gegendert wird mit *");
  fehlerMit(setze("Die KollegInnen helfen."), "gegendert wird mit *");
  keinFehlerMit(setze("Die Kolleg*innen helfen."), "gegendert");
  fehlerMit(setze("Das weißt Du schon, Du bist dran."), "„du“ wird im Satz kleingeschrieben");
  keinFehlerMit(setze("Du bist dran. Du weißt das."), "kleingeschrieben");
  fehlerMit(setze("Strom & Spannung."), "„&“ → „und“");
  fehlerMit(setze("Das ist z. B. so."), "Abkürzung „z. B.“");
  fehlerMit(setze("Das geht´s."), "Apostroph");
  fehlerMit(setze("Und was machst du dann?"), "endet mit einer Frage");
  keinFehlerMit(pruefe(({ dialog }) => { dialog.greeting.text = "Was willst du wissen?"; dialog.greeting.textPublic = "Was willst du wissen?"; }), "endet mit einer Frage");
  const hinweis = setze("Die Kollegen sind ein tolles Team.");
  assert.ok(hinweis.hinweise.some((h) => h.includes("„Kollegen“")));
  assert.ok(hinweis.hinweise.some((h) => h.includes("Broschüre")));
  fehlerMit(pruefe(({ dialog }) => { for (const q of dialog.questions) if (q.text) q.text += "!!"; }), "Ausrufezeichen — höchstens 3");
});

test("Firma: ausgeschrieben, {firma} ohne neutrale Fassung, zu oft, Firmenbegriffe, Seite", () => {
  // Die Karte nutzt {firma} schon zweimal (Begrüßung, bewerbung) = Höchstzahl;
  // {firma}-Fälle laufen deshalb über die Frage bewerbung, die es schon trägt.
  const setze = (id, text, publicText) => pruefe(({ dialog }) => {
    frage(dialog, id).text = text;
    if (publicText === null) delete frage(dialog, id).textPublic;
    else if (publicText !== undefined) frage(dialog, id).textPublic = publicText;
  });
  fehlerMit(setze("was", "Bei Siemens ist es gut."), "Firmenname „Siemens“ ausgeschrieben");
  fehlerMit(setze("bewerbung", "Bei {firma} ist es gut.", null), "enthält {firma}, aber keine neutrale Fassung");
  keinFehlerMit(setze("bewerbung", "Bei {firma} ist es gut.", "Hier ist es gut."), "{firma}");
  fehlerMit(setze("bewerbung", "Bei {firma} ist es gut.", "Bei {firma} auch."), "darf {firma} nicht enthalten");
  fehlerMit(setze("was", "Bei {firma}.", "Hier."), "{firma} steht 3-mal");
  fehlerMit(pruefe(({ dialog }) => { dialog.firmenbegriffe = ["Werk Erlangen"]; frage(dialog, "was").text = "Im Werk Erlangen."; }), "„Werk Erlangen“ ist ein Firmenbegriff");
  fehlerMit(setze("was", "Schau auf die Ausbildungsseite."), "verweist auf eine Seite des Betriebs");
  fehlerMit(setze("was", "Das Gehalt ist gut."), "nennt Geld oder Gehalt");
  const h = setze("was", "Hier ist es gut.", "Hier ist es gut.");
  assert.ok(h.hinweise.some((x) => x.includes("obwohl die Firmenfassung keinen Firmenbezug")));
});

test("Länge über die seiten-Funktion, Belegung je Thema", () => {
  const lang = pruefe(() => {}, { seiten: (t) => (t.startsWith("Hey!") ? 3 : 1) });
  fehlerMit(lang, "Begrüßung: 3 Seiten (höchstens 2)");
  assert.ok(lang.texte.every((t) => t.seiten >= 1));
  const zwei = pruefe(() => {}, { seiten: () => 2 });
  assert.deepEqual(zwei.fehler, []);
  assert.ok(zwei.hinweise.some((x) => x.includes("2 Seiten")));
  // wege hat 5 Fragen, Public ohne link 4: zwei weg → Firma 3 (reicht), Public 2 (zu wenig)
  fehlerMit(pruefe(({ dialog }) => {
    const weg = ["praktikum_was", "praktikum_wie"];
    dialog.questions = dialog.questions.filter((q) => !weg.includes(q.id));
    for (const q of dialog.questions) q.unlocks = (q.unlocks ?? []).filter((id) => !weg.includes(id));
  }), "Thema „Wie man reinkommt“ hat in der Public-Fassung nur 2 Fragen");
});

test("Duales Studium (A3a, A7)", () => {
  fehlerMit(pruefe(({ dialog }) => { dialog.art = "dual"; }), "profession: bei einem dualen Studium");
  const ok = pruefe(({ dialog, daten }) => { dialog.art = "dual"; daten.profession = "Elektrotechnik – duales Studium"; });
  keinFehlerMit(ok, "profession");
  assert.ok(ok.hinweise.some((h) => h.includes("weder Hochschule noch Studium")));
  fehlerMit(pruefe(({ daten }) => { daten.profession = "Elektroniker (w/m/d)"; }), "„(w/m/d)“ weglassen");
});

test("[Annahme] zählt nicht zur Länge", () => {
  assert.equal(ohneAnnahme("Das ist so. [Annahme] Und weiter [Annahme]"), "Das ist so. Und weiter");
  assert.equal(ohneAnnahme(null), "");
  const r = pruefe(() => {}, { seiten: (t) => (t.includes("[Annahme]") ? 9 : 1) });
  assert.deepEqual(r.fehler, []);
});

test("lesefassung: Firma mit Firma und Link, Public ohne beides", () => {
  const { karte } = prototypKarte();
  const firma = lesefassung(karte);
  const pub = lesefassung(karte, { publicMode: true });
  assert.equal(firma[0].titel, "Begrüßung");
  assert.ok(firma[0].text.includes("Siemens"));
  assert.ok(firma.some((e) => e.notiz === "öffnet die Seite"));
  assert.ok(!pub.some((e) => (e.notiz ?? "").includes("öffnet die Seite")));
  assert.ok(pub.every((e) => !/siemens|\{firma\}/i.test(e.text ?? "")));
  assert.equal(firma.length, pub.length + 1);
  assert.ok(firma.some((e) => e.art === "option"));
  assert.equal(firma.at(-1).titel, "Standard");
});
