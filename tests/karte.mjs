/* Testhelfer: die Prototyp-Karte karten/000/ so laden, wie der Kartenlader sie
   zusammenführt (dialog.json + daten.json → ein Kartenobjekt), ohne Pfade
   aufzulösen — die Tests brauchen nur die Dialogdaten. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function leseJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/* Frische Kopie je Aufruf — Tests dürfen die Karte verändern. */
export function prototypKarte() {
  const dialog = leseJson("karten/000/dialog.json");
  const daten = leseJson("karten/000/daten.json");
  return { dialog, daten, karte: { ...dialog, ...daten } };
}
