/* =============================================================================
   DETAR — Seiten-Schätzung für die Dialogprüfung ohne Browser.

   Die App teilt Texte am echten Font in Seiten (SpeechBubble.paginate(), fünf
   Zeilen je Seite). Ohne Browser gibt es den Font nicht — hier zählt jedes
   Zeichen gleich breit (<gross> etwas breiter), sonst läuft derselbe
   Algorithmus (bubbleText.js → wrapWords, paginateChars): Umbruch an
   Wortgrenzen, Seitengrenze am Satzende.

   Entschieden 2026-10-13 (Michael): Schätzung reicht. Kalibriert am selben Tag
   gegen die echte Messung (198 Texte der Karten 000 und 001 und Kombinationen
   daraus, 1–4 Seiten): mit 27 Zeichen je Zeile stimmen 187 von 198 Seitenzahlen,
   die übrigen 11 schätzt sie um eine Seite zu hoch, nie zu niedrig — im
   Zweifel wird also eher gekürzt. Ab 28 Zeichen schätzt sie 7 Texte zu
   niedrig. Genau misst weiterhin tools/kartenpruefung.html.
   ============================================================================= */
import { parseChars, wrapWords, paginateChars } from "../js/bubbleText.js";

export const ZEICHEN_JE_ZEILE = 27;
export const ZEILEN_JE_SEITE = 5; // = TYPO.maxLines
const GROSS = 1.16;               // = TYPO.fxGrossScale

export function schaetzeSeiten(markup, { zeichenJeZeile = ZEICHEN_JE_ZEILE, zeilen = ZEILEN_JE_SEITE } = {}) {
  const all = parseChars(markup);
  if (all.length === 0) return 1;
  const breite = (chars) => chars.reduce((s, c) => s + (c.fx === "gross" ? GROSS : 1), 0);
  const passt = (chars) => wrapWords(chars, breite, zeichenJeZeile).length <= zeilen;
  return Math.max(1, paginateChars(all, passt).length);
}
