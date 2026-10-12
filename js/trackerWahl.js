/* =============================================================================
   DETAR — Tracker-Varianten (Build 92, 2026-10-12): mehrere Tracking-Filter
   liegen parallel im Code, EINE läuft je Sitzung. Auswahl: ?tracker=<name>,
   sonst der Standard STAB.tracker (config.js). Diese Codebasis ist intern —
   am Ende fällt eine Entscheidung, die Verlierer fliegen samt Tests raus, und
   die Engine wird bereinigt ausgeliefert.

   VERTRAG einer Variante (alles, was arSession.js, ?stats und die Tests nutzen):
     constructor(target, gyro)            messgetrieben: bekommt jede neue Messung
                                          über measure(matrix)  — ODER —
     constructor(source, target, gyro)    liest source.matrix selbst in tick()
     onFound() · onLost() · reacquire() · tick() · snapshot()
     Ausgabe: target.matrix (stabRoot) = Pose × Scale, Scale = Kartenbreite
   snapshot() liefert die Felder, die statsOverlay.js liest (s. poseStabilizer.js).
   Das Szenario tests/stabilizerSzenario.mjs und der Vergleich in
   tests/tracker.test.mjs laufen mit jeder Klasse, die den Vertrag hält.

   Neue Variante: Modul anlegen, hier eintragen, in tests/tracker.test.mjs in
   die Vergleichsliste aufnehmen. Alle Varianten werden statisch geladen (je
   ~15 KB) — ab der dritten lieber per import() erst in startAR.
   ============================================================================= */
import { STAB } from "./config.js";
import { PoseStabilizer } from "./poseStabilizer.js";
import { Tracker } from "./tracker.js";
import { Tracker8roh } from "./tracker8roh.js";

export const TRACKER_VARIANTEN = {
  alt: { Klasse: PoseStabilizer, beschreibung: "PoseStabilizer (Zapworks-Port, liest anchor.matrix je Frame)" },
  neu: { Klasse: Tracker, beschreibung: "tracker.js (messgetrieben, 2026-10-09)" },
  "8roh": { Klasse: Tracker8roh, beschreibung: "8th Wall roh: jede Messung 1:1, kein Filter, kein Gyro, bei Verlust sofort weg (Nulllinie)" },
};
export const TRACKER_STANDARD = "alt";

/* Name aus der URL (?tracker=) oder config (STAB.tracker) → Eintrag.
   Unbekannt → Standard mit Warnung (die Sitzung läuft trotzdem). */
export function waehleTracker(params, cfg = STAB) {
  const gewuenscht = (params?.get?.("tracker") || cfg.tracker || TRACKER_STANDARD).trim();
  const name = gewuenscht in TRACKER_VARIANTEN ? gewuenscht : TRACKER_STANDARD;
  const warnung = name === gewuenscht ? null
    : "Unbekannter Tracker „" + gewuenscht + "“ — bekannt: " + Object.keys(TRACKER_VARIANTEN).join(", ") + "; nehme „" + name + "“";
  return { name, Klasse: TRACKER_VARIANTEN[name].Klasse, beschreibung: TRACKER_VARIANTEN[name].beschreibung, warnung };
}

/* Instanz nach dem Vertrag bauen: messgetriebene Klassen (measure) bekommen
   (target, gyro), lesende Klassen (source, target, gyro). */
export function baueTracker(Klasse, source, target, gyro) {
  return Klasse.prototype.measure ? new Klasse(target, gyro) : new Klasse(source, target, gyro);
}
