/* BubbleText (js/bubbleText.js): Markup-Parser, Serialisierung, Wort-, Satz-
   und Teilsatzgrenzen — die Grundlage der Seitenaufteilung in der Sprechblase. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FX, parseChars, serialize, charsToString, splitWords, splitSentences, splitClauses, joinWithSpace,
} from "../js/bubbleText.js";

const saetze = (t) => splitSentences(parseChars(t)).map(charsToString);

test("parseChars: Auszeichnung je Zeichen, unbekannte Tags bleiben sichtbarer Text", () => {
  const c = parseChars("Ab <welle>cd</welle> e");
  assert.equal(charsToString(c), "Ab cd e");
  assert.deepEqual(c.map((x) => x.fx), [null, null, null, "welle", "welle", null, null]);
  const u = parseChars("<foo>x</foo>");
  assert.equal(charsToString(u), "<foo>x</foo>");
  assert.ok(u.every((x) => x.fx === null));
  // nicht geschlossen = kein Markup
  assert.equal(charsToString(parseChars("<welle>offen")), "<welle>offen");
});

test("parseChars: Whitespace eingedampft, Ränder getrimmt, leer und null", () => {
  assert.equal(charsToString(parseChars("  Hallo\n\n  Welt \t ")), "Hallo Welt");
  assert.deepEqual(parseChars(null), []);
  assert.deepEqual(parseChars(undefined), []);
  assert.deepEqual(parseChars(""), []);
  assert.deepEqual(parseChars("   "), []);
});

test("alle FX-Namen werden erkannt", () => {
  for (const fx of FX) assert.deepEqual(parseChars(`<${fx}>a</${fx}>`), [{ ch: "a", fx }]);
});

test("serialize ist die Umkehr von parseChars", () => {
  for (const s of ["Hallo Welt", "A <marker>b c</marker> d", "<gross>x</gross><leise>y</leise>",
    "<knall>a</knall> b <knall>c</knall>", "Frag mich <welle>was</welle>."]) {
    assert.equal(serialize(parseChars(s)), s);
  }
  assert.equal(serialize([]), "");
});

test("splitWords trennt an Leerzeichen", () => {
  assert.deepEqual(splitWords(parseChars("ab cd e")).map(charsToString), ["ab", "cd", "e"]);
  assert.deepEqual(splitWords([]), []);
});

test("splitSentences: Satzende nach . ! ? …", () => {
  assert.deepEqual(saetze("Erster Satz. Zweiter Satz! Dritter? Vierter…"), ["Erster Satz.", "Zweiter Satz!", "Dritter?", "Vierter…"]);
  assert.deepEqual(saetze("Ohne Satzende"), ["Ohne Satzende"]);
  assert.deepEqual(splitSentences([]), []);
});

test("splitSentences: Abkürzungen und kleingeschriebene Anschlüsse hängen am Satz", () => {
  assert.deepEqual(saetze("Das ist z. B. so. Und weiter."), ["Das ist z. B. so.", "Und weiter."]);
  assert.deepEqual(saetze("Ja. und dann weiter. Ende."), ["Ja. und dann weiter.", "Ende."]);
});

test("splitSentences behält die Auszeichnung", () => {
  const teile = splitSentences(parseChars("<marker>Hallo.</marker> Du bist dran."));
  assert.deepEqual(teile.map(serialize), ["<marker>Hallo.</marker>", "Du bist dran."]);
  // kurzes Fragment („Du.“ unter 4 Zeichen) hängt am Satz davor
  assert.deepEqual(splitSentences(parseChars("<marker>Hi.</marker> Du.")).map(serialize), ["<marker>Hi.</marker> Du."]);
});

test("splitClauses: Komma, Semikolon, Doppelpunkt, Gedankenstrich", () => {
  assert.deepEqual(splitClauses(parseChars("Eins, zwei; drei: vier — fünf")).map(charsToString),
    ["Eins,", "zwei;", "drei:", "vier —", "fünf"]);
  assert.deepEqual(splitClauses(parseChars("Nichts zu trennen")).map(charsToString), ["Nichts zu trennen"]);
});

test("joinWithSpace fügt mit Leerzeichen zusammen und kopiert bei leerem Anfang", () => {
  const a = parseChars("a"), b = parseChars("b");
  assert.equal(charsToString(joinWithSpace(a, b)), "a b");
  const j = joinWithSpace([], b);
  assert.equal(charsToString(j), "b");
  assert.notEqual(j, b);
  assert.equal(a.length, 1); // Eingabe unverändert
});
