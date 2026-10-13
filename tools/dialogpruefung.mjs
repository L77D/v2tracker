#!/usr/bin/env node
/* =============================================================================
   DETAR — Dialogprüfung ohne Browser (2026-10-13).

   Dieselben Prüfregeln wie die Prüfseite (tools/kartenpruefung.js, Regelwerk
   Teil C1), aber auf der Kommandozeile — damit die Claude-Session, die den
   Dialog erzeugt, ihn selbst prüfen und korrigieren kann. Die Seitenzahl wird
   geschätzt (tools/seitenSchaetzung.js); genau misst nur die Prüfseite.

   Aufruf:
     node dialogpruefung.mjs <dialog.json> --firma "<Firmenname>" [--final] [--lesefassung <datei.md>]

     --firma        Firmenname, wie ihn {firma} einsetzt (Pflicht) — damit wird
                    geprüft, dass er nirgends ausgeschrieben steht. Darf mehrfach
                    stehen: weitere Formen (Kurzform, Konzernname) werden
                    genauso geprüft, eingesetzt wird die erste.
     --final        Abgabe nach der Abnahme beim Kunden: jede [Annahme] ist ein
                    Fehler (Regelwerk C3).
     --lesefassung  schreibt die Lesefassung beider Fassungen und die Länge je
                    Text als Markdown in diese Datei.

   Ausgabe: Fehler (müssen weg) und Hinweise (ansehen). Exit-Code 1 bei Fehlern.
   Auch als Modul nutzbar: pruefeDialog(dialog, optionen), lesefassungMarkdown().
   ============================================================================= */
import { pruefeKarte, lesefassung, MAX_SEITEN, ANNAHME } from "./kartenpruefung.js";
import { schaetzeSeiten } from "./seitenSchaetzung.js";

export function pruefeDialog(dialog, { firma = "", final = false } = {}) {
  const namen = (Array.isArray(firma) ? firma : [firma]).map((n) => String(n ?? "").trim()).filter(Boolean);
  firma = namen[0] ?? "";
  const r = pruefeKarte(dialog, { seiten: schaetzeSeiten, firma });
  const fehler = [...r.fehler];
  let hinweise = [...r.hinweise];
  // weitere Formen des Namens: ausgeschrieben oder in der neutralen Fassung = Fehler
  for (const n of namen.slice(1)) {
    for (const f of pruefeKarte(dialog, { firma: n }).fehler) {
      if (f.includes("„" + n + "“") && !fehler.includes(f)) fehler.push(f);
    }
  }
  if (!firma) {
    fehler.unshift("Firmenname fehlt — mit --firma \"<Name>\" angeben.");
    hinweise = hinweise.filter((h) => !h.startsWith("Kein Firmenname bekannt"));
  }
  if (final) {
    const annahme = hinweise.filter((h) => h.includes(ANNAHME));
    hinweise = hinweise.filter((h) => !h.includes(ANNAHME));
    for (const h of annahme) fehler.push("Abgabe: " + h.replace("vor der Freigabe bestätigen oder ersetzen", "nach der Abnahme darf keine [Annahme] mehr stehen"));
  }
  return { fehler, hinweise, texte: r.texte };
}

const ohneTags = (t) => String(t ?? "").replace(/<[^>]*>/g, "");
function leseMarkdown(dialog, publicMode, firma) {
  const bl = lesefassung(dialog, { publicMode, firma });
  return bl.map((b, i) => {
    if (b.art === "thema") return "\n### " + b.titel + "\n";
    const notiz = b.notiz ? " _(" + b.notiz + ")_" : "";
    if (b.art === "frage") return "**▸ " + b.titel + "**" + notiz + "  \n" + ohneTags(b.text) + "\n";
    if (b.art === "option") return "- **→ " + b.titel + ":** " + ohneTags(b.text) + (bl[i + 1]?.art === "option" ? "" : "\n");
    return "**" + b.titel + ":** " + ohneTags(b.text) + notiz + "\n";
  }).join("\n");
}

export function lesefassungMarkdown(dialog, { firma = "", ergebnis = null } = {}) {
  if (Array.isArray(firma)) firma = firma[0] ?? "";
  const r = ergebnis ?? pruefeDialog(dialog, { firma });
  const zeilen = r.texte.map((t) => "| " + t.fassung + " | " + t.ort + " | " + t.zeichen + " | " + (t.seiten ?? "?") + (t.seiten > 1 ? " ⚠" : "") + " |");
  return [
    "# Lesefassung",
    "",
    "## Neutrale Fassung (so sieht eine Schule die Karte)",
    "",
    "Vor der Abnahme einmal ganz lesen: Verrät irgendetwas den Betrieb? Verweist etwas auf eine Seite, die es hier nicht gibt?",
    "",
    leseMarkdown(dialog, true, firma),
    "",
    "## Firmenfassung",
    "",
    leseMarkdown(dialog, false, firma),
    "",
    "## Länge je Text",
    "",
    "Seiten in der Sprechblase, **geschätzt** (Ziel 1, höchstens " + MAX_SEITEN + "; [Annahme] zählt nicht mit).",
    "",
    "| Fassung | Stelle | Zeichen | Seiten |",
    "|---|---|---:|---:|",
    ...zeilen,
    "",
  ].join("\n");
}

/* --- Kommandozeile ------------------------------------------------------- */
async function main(argv) {
  const fs = await import("node:fs");
  const args = { datei: null, firma: [], final: false, lese: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--firma") args.firma.push(argv[++i] ?? "");
    else if (a === "--final") args.final = true;
    else if (a === "--lesefassung") args.lese = argv[++i] ?? null;
    else if (!args.datei) args.datei = a;
  }
  if (!args.datei) {
    console.log("Aufruf: node dialogpruefung.mjs <dialog.json> --firma \"<Firmenname>\" [--final] [--lesefassung <datei.md>]");
    return 2;
  }
  let dialog;
  try { dialog = JSON.parse(fs.readFileSync(args.datei, "utf8")); }
  catch (e) { console.log("Datei nicht lesbar oder kein gültiges JSON: " + e.message); return 1; }
  let r;
  try { r = pruefeDialog(dialog, { firma: args.firma, final: args.final }); }
  catch (e) { console.log("Prüfung abgebrochen: " + e.message); return 1; }
  const zwei = r.texte.filter((t) => t.seiten === 2);
  const lang = r.texte.filter((t) => t.seiten > MAX_SEITEN);
  const out = [];
  out.push("DETAR-Dialogprüfung · " + args.datei + " · Firma: " + (args.firma.filter(Boolean).join(" / ") || "—") + (args.final ? " · Abgabe (--final)" : ""));
  out.push(r.fehler.length ? r.fehler.length + " Fehler · " + r.hinweise.length + " Hinweise" : "Keine Fehler · " + r.hinweise.length + " Hinweise");
  out.push("", "FEHLER (müssen weg)");
  out.push(...(r.fehler.length ? r.fehler.map((f) => "  - " + f) : ["  keine"]));
  out.push("", "HINWEISE (ansehen, beheben oder im Prüfbericht begründen)");
  out.push(...(r.hinweise.length ? r.hinweise.map((h) => "  - " + h) : ["  keine"]));
  out.push("", "LÄNGE (geschätzt; Ziel 1 Seite, höchstens " + MAX_SEITEN + ")");
  if (!zwei.length && !lang.length) out.push("  Alle Texte passen auf eine Seite.");
  for (const t of lang) out.push("  - " + t.seiten + " Seiten: " + t.fassung + " · " + t.ort);
  for (const t of zwei) out.push("  - 2 Seiten: " + t.fassung + " · " + t.ort);
  if (args.lese) {
    fs.writeFileSync(args.lese, lesefassungMarkdown(dialog, { firma: args.firma, ergebnis: r }));
    out.push("", "Lesefassung geschrieben: " + args.lese);
  }
  console.log(out.join("\n"));
  return r.fehler.length ? 1 : 0;
}

const direkt = typeof process !== "undefined" && process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href;
if (direkt) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
