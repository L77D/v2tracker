#!/usr/bin/env node
/* =============================================================================
   DETAR — baut den Skill „detar-dialog“ für die Dialog-Generierung in einer
   fremden Claude-Session (2026-10-13). Doppelklick: Dialog-Skill-bauen.command.

   Quelle bleibt das Repo — der Skill ist nur eine Zusammenstellung:
     tools/dialog-skill/SKILL.md      → SKILL.md ({{STAND}} wird ersetzt)
     docs/dialog-regelwerk.md         → references/dialog-regelwerk.md
     docs/dialog-quellen.md           → references/dialog-quellen.md
     karten/000/dialog.json           → references/vorbild-dialog.json
     tools/dialogpruefung.mjs,
     tools/kartenpruefung.js,
     tools/seitenSchaetzung.js        → scripts/tools/
     js/edition.js, js/bubbleText.js  → scripts/js/
   (scripts/ spiegelt tools/ und js/, damit die relativen Importe unverändert
   laufen.) Danach prüft der Bau das Vorbild mit dem kopierten Prüfprogramm und
   packt dist/detar-dialog.zip (Ordner mit SKILL.md an der Wurzel — so nimmt
   claude.ai Skills an).

   Aufruf: node tools/baue-dialog-skill.mjs [Zielordner]   (Standard: dist/)
   ============================================================================= */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "detar-dialog";

export const DATEIEN = [
  ["docs/dialog-regelwerk.md", "references/dialog-regelwerk.md"],
  ["docs/dialog-quellen.md", "references/dialog-quellen.md"],
  ["karten/000/dialog.json", "references/vorbild-dialog.json"],
  ["tools/dialogpruefung.mjs", "scripts/tools/dialogpruefung.mjs"],
  ["tools/kartenpruefung.js", "scripts/tools/kartenpruefung.js"],
  ["tools/seitenSchaetzung.js", "scripts/tools/seitenSchaetzung.js"],
  ["js/edition.js", "scripts/js/edition.js"],
  ["js/bubbleText.js", "scripts/js/bubbleText.js"],
];

export async function baueSkill(ziel = path.join(REPO, "dist"), { zip = true } = {}) {
  const ordner = path.join(ziel, NAME);
  fs.rmSync(ordner, { recursive: true, force: true });
  fs.mkdirSync(ordner, { recursive: true });

  const { BUILD } = await import(path.join(REPO, "js/version.js"));
  const regelwerk = fs.readFileSync(path.join(REPO, "docs/dialog-regelwerk.md"), "utf8");
  const stand = (regelwerk.match(/^Stand (\d{2}\.\d{2}\.\d{4})/m) ?? [])[1] ?? "?";
  const skill = fs.readFileSync(path.join(REPO, "tools/dialog-skill/SKILL.md"), "utf8")
    .replace("{{STAND}}", "Stand: Regelwerk vom " + stand + " · zusammengestellt aus DETAR-Build " + BUILD + ".");
  fs.writeFileSync(path.join(ordner, "SKILL.md"), skill);

  for (const [von, nach] of DATEIEN) {
    const z = path.join(ordner, nach);
    fs.mkdirSync(path.dirname(z), { recursive: true });
    fs.copyFileSync(path.join(REPO, von), z);
  }

  // Selbsttest: Das Vorbild muss mit dem kopierten Prüfprogramm fehlerfrei sein.
  const { pruefeDialog } = await import(path.join(ordner, "scripts/tools/dialogpruefung.mjs"));
  const vorbild = JSON.parse(fs.readFileSync(path.join(ordner, "references/vorbild-dialog.json"), "utf8"));
  const r = pruefeDialog(vorbild, { firma: "Beispielfirma" });
  if (r.fehler.length) throw new Error("Vorbild hat Fehler im Prüfprogramm:\n- " + r.fehler.join("\n- "));

  let zipDatei = null;
  if (zip) {
    zipDatei = path.join(ziel, NAME + ".zip");
    fs.rmSync(zipDatei, { force: true });
    try { execFileSync("zip", ["-qr", NAME + ".zip", NAME, "-x", "*.DS_Store"], { cwd: ziel }); }
    catch { execFileSync("ditto", ["-c", "-k", "--keepParent", NAME, NAME + ".zip"], { cwd: ziel }); }
  }
  return { ordner, zip: zipDatei, stand, build: BUILD };
}

const direkt = process.argv[1] && import.meta.url === new URL("file://" + path.resolve(process.argv[1])).href;
if (direkt) {
  baueSkill(process.argv[2] ? path.resolve(process.argv[2]) : undefined)
    .then((r) => console.log("Skill gebaut (Regelwerk " + r.stand + ", Build " + r.build + "):\n  " + r.ordner + (r.zip ? "\n  " + r.zip : "")))
    .catch((e) => { console.error("Bau fehlgeschlagen: " + e.message); process.exitCode = 1; });
}
