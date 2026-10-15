/* =============================================================================
   DETAR — Tracker-Wahl (Build 92, 2026-10-12): mehrere Tracking-Filter lagen
   bis Build 110 parallel im Code (alt = PoseStabilizer, neu = tracker.js,
   8roh = Nulllinie, 8lerp). Seit Build 111 (Michael 2026-10-15) ist nur noch
   8lerp im Live-Code; die anderen liegen in archiv/tracker-varianten/ (README
   dort). Auswahl weiterhin: ?tracker=<name> in der URL, sonst der Standard
   STAB.tracker (config.js) — ein unbekannter Name (auch „alt", „neu", „8roh")
   fällt mit Warnung auf den Standard zurück, die Marke zeigt „alt? → 8lerp".

   VERTRAG einer Variante (alles, was arSession.js, ?stats und die Tests nutzen):
     constructor(target, gyro)            messgetrieben: bekommt jede neue Messung
                                          über measure(matrix)  — ODER —
     constructor(source, target, gyro)    liest source.matrix selbst in tick()
     onFound() · onLost() · reacquire() · tick() · snapshot()
     Ausgabe: target.matrix = Pose × Scale, Scale = Kartenbreite; target.visible =
     Sichtbarkeits-Wunsch (target = poseTarget in arSession.js, seit Build 99 ein
     Proxy — stabRoot blendet SceneFade weich nach)
   snapshot() liefert die Felder, die statsOverlay.js liest (s. tracker8lerp.js).
   Das Szenario tests/stabilizerSzenario.mjs läuft mit jeder Klasse, die den
   Vertrag hält (Goldstandard: tests/tracker8lerp.test.mjs).

   Neue Variante: Modul anlegen, hier eintragen, Szenario-Test dazu.
   ============================================================================= */
import { STAB } from "./config.js";
import { Tracker8lerp } from "./tracker8lerp.js";

export const TRACKER_VARIANTEN = {
  "8lerp": { Klasse: Tracker8lerp, beschreibung: "8th Wall roh + Lerp/Slerp auf die letzte Messung (τ lerpPosMs/lerpRotMs) + Schwerkraft-Schiedsrichter, sonst nichts" },
};
// Rückfall ohne config und bei unbekanntem Namen — gleich STAB.tracker
// (2026-10-15, Michael: Standard 8lerp statt alt).
export const TRACKER_STANDARD = "8lerp";

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
