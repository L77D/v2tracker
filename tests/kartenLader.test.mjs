/* Kartenlader (js/kartenLader.js): Characterization Test (Stand Build 110).
   fetch-Attrappe liest die Dateien aus dem Repo (oder eine Überschreibung je
   Fall), protokolliert Ziel + Cache-Option; location/window sind Attrappen.
   Snapshot: tests/fixtures/kartenLader.snapshot.json (s. tests/snapshot.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./karte.mjs";
import { pruefeSnapshot } from "./snapshot.mjs";

globalThis.location = { href: "https://x.test/v2tracker/index.html" };
globalThis.window = {};
const { ladeKarte, KARTEN_DIR, KARTEN_FORMAT } = await import("../js/kartenLader.js");

let protokoll = [];
let ueberschreibung = {};
globalThis.fetch = async (url, opts) => {
  protokoll.push(url + " [" + (opts?.cache ?? "-") + "]");
  const rel = url.replace(/^\.\//, "");
  if (rel in ueberschreibung) {
    const v = ueberschreibung[rel];
    if (v === 404) return { ok: false, status: 404 };
    return { ok: true, json: async () => JSON.parse(JSON.stringify(v)) };
  }
  const datei = path.join(ROOT, rel);
  if (!fs.existsSync(datei)) return { ok: false, status: 404 };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(datei, "utf8")) };
};

const lies = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

/* Ergebnis auf das Wesentliche kürzen (die Karte selbst ist groß). */
function kurz(r) {
  if (!r.card) return r;
  const c = r.card;
  return {
    publicMode: r.publicMode, design: r.design,
    card: {
      id: c.id, edition: c.edition, format: c.format, company: c.company, companyLogo: c.companyLogo, companyNeutral: c.companyNeutral,
      profession: c.profession, vorschau: c.vorschau, idleReturnMs: c.idleReturnMs, figur: c.figur,
      fragen: c.questions.map((q) => q.id), initial: c.initial, greeting: c.greeting.text,
    },
  };
}

async function fall(query, { dateien = {}, lokal = false } = {}) {
  protokoll = []; ueberschreibung = dateien;
  globalThis.window = lokal ? { __LOKAL: true } : {};
  const r = await ladeKarte(new URLSearchParams(query));
  return { ergebnis: kurz(r), fetches: protokoll };
}

test("Konstanten", () => {
  assert.equal(KARTEN_DIR, "./karten/");
  assert.equal(KARTEN_FORMAT, 2);
});

test("ladeKarte: alle URL-Fälle gegen den Snapshot von Build 110", async () => {
  const daten = lies("karten/000/daten.json");
  const faelle = {
    ohneK: await fall(""),
    k000: await fall("k=000"),
    k000P: await fall("k=000P"),
    k000p: await fall("k=000p"),
    kMitLeerzeichen: await fall("k=%20000%20"),
    k999: await fall("k=999"),
    design_p05: await fall("k=000&design=p05"),
    design_unbekannt: await fall("k=000&design=nope"),
    karte_p01: await fall("karte=p01"),
    karte_P01: await fall("karte=P01"),
    karte_xyz: await fall("karte=xyz"),
    k_vor_karte: await fall("k=000&karte=p01"),
    katalog404: await fall("k=000", { dateien: { "karten/katalog.json": 404 } }),
    katalogLeer: await fall("k=000", { dateien: { "karten/katalog.json": {} } }),
    inaktiv: await fall("k=000", { dateien: { "karten/katalog.json": { karten: [{ id: "000", name: "x", aktiv: false }] } } }),
    daten404: await fall("k=000", { dateien: { "karten/000/daten.json": 404 } }),
    dialog404: await fall("k=000", { dateien: { "karten/000/dialog.json": 404 } }),
    format1: await fall("k=000", { dateien: { "karten/000/daten.json": { ...daten, format: 1 } } }),
    format3: await fall("k=000", { dateien: { "karten/000/daten.json": { ...daten, format: 3 } } }),
    formatFehlt: await fall("k=000", { dateien: { "karten/000/daten.json": { ...daten, format: undefined } } }),
    ohneIdle: await fall("k=000", { dateien: { "karten/000/daten.json": { ...daten, figur: { ...daten.figur, posen: { think: "figur/body_react_think.webp" } } } } }),
    breiteFehlt: await fall("k=000", { dateien: { "karten/000/daten.json": { ...daten, designs: [{ id: "x", target: "targets/p04.json" }] } } }),
    lokalPrototyp: await fall("", { lokal: true }),
  };
  pruefeSnapshot("kartenLader.snapshot", faelle);
  // Eigenschaften, die der Snapshot nur implizit trägt:
  assert.equal(faelle.ohneK.ergebnis.keineKarte, true);
  assert.equal(faelle.k000P.ergebnis.card.edition, "public");
  assert.equal(faelle.k000P.ergebnis.card.company, null);
  assert.equal(faelle.k000.ergebnis.card.edition, "firma");
  assert.ok(faelle.k000.ergebnis.card.figur.posen.idle.startsWith("https://x.test/v2tracker/karten/000/"));
  assert.ok(faelle.k_vor_karte.fetches.every((f) => f.endsWith("[no-store]")));
});
