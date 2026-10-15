/* SpeechBubble (js/speechBubble.js): paginate() aller Kartentexte mit einer
   Schriftmaß-Attrappe (Zeichen × 0,5 × Schriftgröße; <gross> über den
   Font-String), Typewriter-Verlauf, Billboard — Characterization Test
   (Stand Build 110). Die echte Messung am Font bleibt tools/kartenpruefung.html.
   Snapshot: tests/fixtures/speechBubble.snapshot.json */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { installiereDom } from "./domAttrappe.mjs";
import { prototypKarte } from "./karte.mjs";
import { pruefeSnapshot } from "./snapshot.mjs";
import { schaetzeSeiten } from "../tools/seitenSchaetzung.js";

installiereDom();
const zeichnungen = [];
class Ctx {
  constructor() { this.font = ""; this.globalAlpha = 1; }
  measureText(t) { const px = Number((/(\d+)px/.exec(this.font) || [0, 52])[1]); return { width: t.length * px * 0.3755 }; } // ≈ 27 Zeichen je Zeile bei 52 px (wie tools/seitenSchaetzung.js)
  clearRect() { zeichnungen.push("clear"); } fillRect(x, y, w, h) { zeichnungen.push("rect"); }
  strokeText(t) { zeichnungen.push("S:" + t); } fillText(t) { zeichnungen.push("F:" + t); }
  save() {} restore() {} translate() {} scale() {}
}
document.createElement = (tag) => (tag === "canvas" ? { width: 0, height: 0, getContext: () => new Ctx() } : { tag });
const { SpeechBubble } = await import("../js/speechBubble.js");
const { prepareCard } = await import("../js/edition.js");
const { TYPO } = await import("../js/config.js");

function aufbau() {
  const worldRoot = new THREE.Group();
  const FigureRoot = new THREE.Group(); worldRoot.add(FigureRoot);
  const BubbleRoot = new THREE.Group(); BubbleRoot.position.set(0, 0.647, 0.01); FigureRoot.add(BubbleRoot);
  const cam = new THREE.Vector3(0.1, 0.3, 0.4);
  const frame = { worldRoot, getCamLocal: (out) => out.copy(cam), toLocal: (v) => worldRoot.worldToLocal(v) };
  const b = new SpeechBubble({ BubbleRoot }, frame);
  return { b, cam, FigureRoot, BubbleRoot };
}
function texte(karte) {
  const t = [["greeting", karte.greeting.text]];
  for (const q of karte.questions) t.push(["frage " + q.id, q.text]);
  for (const a of karte.asks) { t.push(["ask " + a.id, a.prompt]); a.options.forEach((o, i) => t.push(["ask " + a.id + " option " + i, o.reply])); }
  (karte.reentry?.rules ?? []).forEach((r, i) => t.push(["reentry " + i, r.text]));
  return t;
}

test("Canvas-Maße und Plane aus TYPO", () => {
  const { b } = aufbau();
  assert.equal(b.canvas.width, 600); assert.equal(b.canvas.height, 371);
  assert.equal(b.maxLineWidth(), 528);
  assert.equal(b.plane.renderOrder, 20);
  assert.ok(Math.abs(b.plane.position.y - (0.742 / 2 + TYPO.offsetY)) < 1e-9);
  assert.equal(b.element.visible, false);
});

test("paginate: Seiten aller Texte der Karte 000 (Firma + Public) gegen den Snapshot", () => {
  const { b } = aufbau();
  const out = {};
  for (const modus of ["firma", "public"]) {
    const karte = prepareCard(prototypKarte().karte, { variante: modus === "public" ? "P" : "B" });
    out[modus] = Object.fromEntries(texte(karte).map(([k, t]) => [k, b.paginate(t)]));
    // Vergleich mit der Schätzung (tools/seitenSchaetzung.js): nur Diagnose, kein Vertrag
    out[modus + "Schaetzung"] = Object.fromEntries(texte(karte).map(([k, t]) => [k, schaetzeSeiten(t)]));
  }
  out.sonderfaelle = { leer: b.paginate(""), nullwert: b.paginate(null), einWort: b.paginate("Hallo"), lang: b.paginate("Wort ".repeat(120).trim()), markup: b.paginate("<marker>Wichtig</marker> und <gross>groß</gross>, <leise>leise</leise> <knall>Peng</knall>!") };
  pruefeSnapshot("speechBubble.snapshot", out);
});

test("Typewriter: 28 ms je Zeichen, Neuzeichnen je Schritt, skip() beendet, hide()", () => {
  const { b } = aufbau();
  const uhr = { t: 1000 }; const alt = performance.now; performance.now = () => uhr.t;
  try {
    let fertig = 0;
    zeichnungen.length = 0;
    b.setText("Hallo <knall>Welt</knall>, das ist ein Test.", () => fertig++, "1/2");
    assert.equal(b.element.visible, true); assert.equal(b.typing, true); assert.ok(b.totalChars > 20);
    assert.equal(zeichnungen.filter((z) => z === "clear").length, 1);
    const verlauf = [];
    for (let i = 0; i < 80; i++) { uhr.t += 1000 / 60; b.tickTypewriter(); verlauf.push(b.revealedChars); }
    assert.equal(fertig, 1);
    assert.equal(b.typing, false);
    pruefeSnapshot("speechBubble.typewriter", { verlauf, zeichnungen: zeichnungen.slice(0, 40) });
    assert.equal(b.skip(), false);
    b.setText("Noch ein Text", () => fertig++);
    uhr.t += 50; b.tickTypewriter();
    assert.equal(b.skip(), true); assert.equal(fertig, 2); assert.equal(b.revealedChars, b.totalChars);
    b.hide(); assert.equal(b.element.visible, false);
    b.setText("", () => fertig++); assert.equal(fertig, 3); assert.equal(b.element.visible, false);
    TYPO.msPerChar = 0; b.setText("x", () => fertig++); b.tickTypewriter(); assert.equal(fertig, 4); TYPO.msPerChar = 28;
  } finally { performance.now = alt; }
});

test("Billboard: Yaw + Neigung zur Kamera, geglättet (billboardLerp), Rotation der Figur rausgerechnet", () => {
  const { b, cam, FigureRoot } = aufbau();
  const out = [];
  FigureRoot.rotation.set(0.1, 0.4, 0.05);
  for (let i = 0; i < 12; i++) {
    if (i === 6) cam.set(-0.3, 0.1, 0.2);
    b.tick(1 / 60);
    out.push([b.bubbleYaw, b.bubblePitch, ...b.element.quaternion.toArray()]);
  }
  pruefeSnapshot("speechBubble.billboard", out);
  assert.equal(b.bubbleYawInit, true);
});
