/* =============================================================================
   DETAR — Variante der Karte: S (Schule), B (Business) oder P (Public).

   Ein Kartencode (zweistellig, alphanumerisch, groß) und drei Varianten im
   Link — DETAR.IO/A1/S, /A1/B, /A1/P, ohne Angabe S. In der App: ?k=A1&v=S
   (der Server leitet die Pfad-Form um, s. README). Alias: ?k=00P = v=P
   (js/kartenLader.js).

     B  Business: Firmenkarte — Logo/Firmenname im Splash, Link-Frage im Dialog
     S  Schule:   Firmenkarte — Logo/Firmenname, aber OHNE Link-Frage
     P  Public:   neutral — ohne Firmenblock, ohne Link, Public-Texte

   prepareCard() liefert eine KOPIE der Karte für die gewählte Variante:
   • Fragen mit `link: true` (die Link-Frage) gibt es nur in B; Fragen
     mit `branded: true` entfallen in P — jeweils samt ihrer Ids in `initial`
     und in allen `unlocks`, damit kein NEU-Punkt auf einer Frage hängt, die
     es nicht gibt.
   • Public-Texte: Jedes Textfeld darf eine zweite, neutrale Fassung tragen —
     Feldname + `Public`:
       greeting.textPublic · questions[].labelPublic / textPublic ·
       asks[].promptPublic · asks[].options[].labelPublic / replyPublic ·
       reentry.rules[].textPublic
     In P gilt die Public-Fassung, sonst das Original. Pflicht ist sie für
     jeden Text, der `{firma}` enthält — in P wird der Betrieb nie genannt.
   • `{firma}` wird in S und B durch `card.company` ersetzt. Steht es in P
     trotzdem noch in einem Text (Public-Fassung vergessen), greift als
     Notnagel `card.companyNeutral` („der Betrieb").
   • P: `company`, `companyLogo` sind null. `edition` = Variante ("S"/"B"/"P").
   Splash-Block „bei + Logo/Firma" blendet main.js über body.public aus.
   ============================================================================= */

export const VARIANTEN = ["S", "B", "P"];
export const VARIANTE_STANDARD = "S";

/* Variante aus einem rohen Wert (Query, groß/klein, Leerraum): unbekannt → Standard. */
export function normVariante(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return VARIANTEN.includes(s) ? s : VARIANTE_STANDARD;
}

export function prepareCard(card, { variante = VARIANTE_STANDARD, publicMode = false } = {}) {
  const v = publicMode ? "P" : normVariante(variante); // publicMode: Alias ?k=00P
  const pub = v === "P";
  const firma = pub ? (card.companyNeutral ?? "der Betrieb") : (card.company ?? "");
  const sub = (s) => (typeof s === "string" ? s.replace(/\{firma\}/g, firma) : s);
  // Textfeld `key` von `obj` in der passenden Fassung, {firma} ersetzt
  const pick = (obj, key) => sub(pub && obj[key + "Public"] != null ? obj[key + "Public"] : obj[key]);

  // Fragen filtern; Ids der entfernten Fragen überall streichen
  const dropped = new Set();
  const kept = (card.questions ?? []).filter((q) => {
    if ((pub && q.branded) || (v !== "B" && q.link)) { dropped.add(q.id); return false; }
    return true;
  });
  const clean = (ids) => ids?.filter((id) => !dropped.has(id));
  const questions = kept.map((q) => ({ ...q, label: pick(q, "label"), text: pick(q, "text"),
    unlocks: clean(q.unlocks) }));

  const asks = (card.asks ?? []).map((a) => ({ ...a, prompt: pick(a, "prompt"),
    options: (a.options ?? []).map((o) => ({ ...o, label: pick(o, "label"), reply: pick(o, "reply"), unlocks: clean(o.unlocks) })) }));

  return {
    ...card,
    edition: v,
    company: pub ? null : card.company,
    companyLogo: pub ? null : card.companyLogo,
    initial: clean(card.initial),
    greeting: card.greeting ? { ...card.greeting, text: pick(card.greeting, "text") } : card.greeting,
    asks,
    questions,
    reentry: card.reentry ? { ...card.reentry, rules: (card.reentry.rules ?? []).map((r) => ({ ...r, text: pick(r, "text") })) } : card.reentry,
  };
}
