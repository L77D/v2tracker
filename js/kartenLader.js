/* =============================================================================
   DETAR — Kartenlader (2026-10-06, Build 63): Engine und Karten sind getrennt.

   Die Engine (js/, css/, assets/, vendor/) liegt einmal zentral; jede Karte ist
   ein reiner Daten-Ordner karten/<id>/ mit daten.json (Beruf, Firma, Logo,
   Figur, Designs, Vorschau) und dialog.json (Dialog), Figurenbildern,
   Kartenbildern fürs Tracking (targets/) und Desktop-Vorschau. Seit Build 72
   (Michael 2026-10-08) zwei Dateien statt einer karte.json; Produktionskarten
   heißen nach ihrer Nummer (karten/001/ → ?k=001, kurze URLs).
   Welche Karte läuft, steht im QR-Code: ?k=<id>. Die Public-Fassung ist die
   Nummer mit angehängtem P (?k=000P, auch klein: ?k=000p) — gleicher Ordner,
   eigenes Erkennungsbild (Design mit "fassung": "public", sonst das erste
   Design). Seit Build 75 (Michael 2026-10-08), ersetzt das Flag ?public.
   Seriennummern spielen im Code keine Rolle. Ohne ?k startet KEINE Karte
   (Michael 2026-10-08, Build 74) — main.js zeigt dann die Auffang-Seite;
   einzige Ausnahme ist der Lokal-Prototyp (Doppelklick, keine URL-Parameter),
   der die erste aktive Karte des Katalogs nimmt (Firmenfassung). das Kartenbild per ?design=<id> (ohne = erstes Design
   der Karte). Pro Sitzung genau eine Karte und ein Target.

   FORMAT: daten.json trägt "format" (Nummer des Aufbaus; 2 = daten.json +
   dialog.json, 1 = alte karte.json bis Build 71, nicht mehr unterstützt — es
   gab keine gedruckten Karten). Die Engine versteht alle Formate bis
   KARTEN_FORMAT; ändert sich der Aufbau, Nummer hochzählen und ältere Formate
   hier übersetzen — gedruckte Karten bleiben so lesbar.

   Pfade in daten.json (figur, vorschau, companyLogo, designs[].target) gelten
   relativ zum Kartenordner und werden hier zu absoluten URLs aufgelöst.
   ============================================================================= */
import { prepareCard } from "./edition.js";

export const KARTEN_DIR = "./karten/";
const KATALOG_URL = KARTEN_DIR + "katalog.json";
// Höchstes Kartenformat, das diese Engine liest (fehlt "format" → 1).
export const KARTEN_FORMAT = 2;
const BREITE_MM_STANDARD = 63; // Druckspezifikation 63 × 88 mm

/* JSON frisch holen (no-store wie bisher bei karten.json/Targets: Safari
   cached jede Datei einzeln, eine alte Karte soll nie an neuer Engine hängen). */
async function holeJson(url) {
  const res = await fetch(url, { cache: "no-store" }); // (Patch-Anker build-lokal-prototyp.py — Wortlaut halten)
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + url);
  return res.json();
}

/* Karte laden und für die Edition vorbereiten. Liefert
   { card, design } oder { error, ids, hinweis?, beruf? } (boot() zeigt dann den Hinweis im
   Splash, Start-Button bleibt aus — wie bisher bei unbekanntem Design) oder
   { keineKarte: true } ohne ?k (Auffang-Seite). */
export async function ladeKarte(params) {
  let katalog;
  try { katalog = await holeJson(KATALOG_URL); }
  catch (e) { return { error: "Kartenkatalog nicht ladbar: " + KATALOG_URL, ids: [] }; }
  const liste = Array.isArray(katalog?.karten) ? katalog.karten : [];
  const ids = liste.filter((k) => k.aktiv !== false).map((k) => k.id);
  const kartenHinweis = " (Parameter ?k, Katalog: " + KATALOG_URL.slice(2) + ")";

  const k = (params.get("k") || "").trim();
  // Public-Fassung: Nummer + P (groß oder klein), z. B. 000P
  const pub = /^\d+[pP]$/.test(k);
  const id = (pub ? k.slice(0, -1) : k) || (window.__LOKAL ? ids[0] : null);
  if (!id) return { keineKarte: true, ids };
  const publicMode = pub;
  const eintrag = liste.find((k) => k.id === id);
  if (!eintrag) return { error: "Unbekannte Karte „" + id + "“", ids, hinweis: kartenHinweis };
  if (eintrag.aktiv === false) return { error: "Karte „" + id + "“ ist nicht mehr verfügbar", ids, hinweis: kartenHinweis };

  const ordner = KARTEN_DIR + id + "/";
  let roh, dialog;
  try { roh = await holeJson(ordner + "daten.json"); }
  catch (e) { return { error: "Kartendaten nicht ladbar: " + ordner + "daten.json", ids: [] }; }
  try { dialog = await holeJson(ordner + "dialog.json"); }
  catch (e) { return { error: "Dialog nicht ladbar: " + ordner + "dialog.json", ids: [] }; }

  const format = roh.format ?? 1;
  if (typeof format !== "number" || format < 2 || format > KARTEN_FORMAT) {
    return { error: "Karte „" + id + "“ hat Format " + format + ", diese Engine liest bis Format " +
      KARTEN_FORMAT + " — Seite neu laden", ids: [] };
  }
  if (!roh.figur?.posen?.idle) return { error: "Karte „" + id + "“ ohne Figur (figur.posen.idle fehlt)", ids: [] };

  // Relative Pfade gegen den Kartenordner auflösen
  const basis = new URL(ordner, location.href);
  const abs = (p) => (typeof p === "string" && p ? new URL(p, basis).href : p);
  const mapAbs = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, abs(v)]));
  const figur = { ...roh.figur, posen: mapAbs(roh.figur.posen), kopf: abs(roh.figur.kopf), gesicht: mapAbs(roh.figur.gesicht) };

  // Design (Kartenbild fürs Tracking) wählen: ?design=<id> (Test) oder das
  // erste Design der Fassung ("fassung": "firma" | "public", fehlt = "firma");
  // hat die Karte kein Public-Design, gilt das erste Design.
  const designs = Array.isArray(roh.designs) ? roh.designs : [];
  const designIds = designs.map((d) => d.id);
  const fassung = publicMode ? "public" : "firma";
  const passend = designs.find((x) => (x.fassung || "firma") === fassung) || designs[0];
  const designId = params.get("design") || passend?.id;
  const d = designs.find((x) => x.id === designId);
  if (!d) {
    return { error: "Unbekanntes Design „" + designId + "“ der Karte „" + id + "“", ids: designIds,
      hinweis: " (Parameter ?design, Liste: " + ordner.slice(2) + "daten.json)", beruf: roh.profession };
  }
  const breite = Number(d.breiteMm);
  const design = {
    id: d.id, name: d.name || d.id, fassung: d.fassung || "firma", target: d.target, targetUrl: abs(d.target),
    breiteMm: Number.isFinite(breite) && breite > 0 ? breite : BREITE_MM_STANDARD, notiz: d.notiz || "",
  };

  // Dialog und Kartendaten zu EINEM Kartenobjekt (wie bisher karte.json) — der Rest der Engine bleibt gleich
  const karte = { ...dialog, ...roh, format, figur, vorschau: abs(roh.vorschau), companyLogo: abs(roh.companyLogo) };
  return { card: prepareCard(karte, { publicMode }), design, publicMode };
}
