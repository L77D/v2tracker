/* =============================================================================
   DETAR — Edition der Karte: Firmenversion (Standard) oder Public (?public).

   Michael 2026-09-09: Es gibt zwei Versionen einer Karte — für Firmenkunden
   (Logo/Firmenname im Splash, Link zur Ausbildungsseite im Dialog) und eine
   neutrale Public-Version ohne Firmenbezug. Der Unterschied steckt im
   QR-Code: derselbe Link mit `?public` liefert die neutrale Fassung. Eine
   Kartendatei.

   prepareCard() liefert eine KOPIE der Karte für die gewählte Edition:
   • Fragen mit `branded: true` (heute: die Link-Frage) fliegen im Public-
     Modus raus — samt ihrer Ids in `initial` und in allen `unlocks`, damit
     kein NEU-Punkt auf einer Frage hängt, die es nicht gibt.
   • Public-Texte (2026-10-08, Michael: „ganzer Text doppelt"): Jedes Textfeld
     darf eine zweite, neutrale Fassung tragen — Feldname + `Public`:
       greeting.textPublic · questions[].labelPublic / textPublic ·
       asks[].promptPublic · asks[].options[].labelPublic / replyPublic ·
       reentry.rules[].textPublic
     Im Public-Modus gilt die Public-Fassung, sonst das Original. Pflicht ist
     sie für jeden Text, der `{firma}` enthält — in der Public-Fassung wird der
     Betrieb nie genannt (Regelwerk docs/dialog-regelwerk.md, geprüft von
     tools/kartenpruefung.html).
   • `{firma}` wird in der Firmenfassung durch `card.company` ersetzt. Steht es
     im Public-Modus trotzdem noch in einem Text (Public-Fassung vergessen),
     greift als Notnagel `card.companyNeutral` („der Betrieb").
   • Public: `company`, `companyLogo` sind null; `edition` = "public".
   Splash-Block „bei + Logo/Firma" blendet main.js über body.public aus (der
   Public-Splash wird noch gestaltet, bis dahin steht dort nichts).
   ============================================================================= */

export function prepareCard(card, { publicMode = false } = {}) {
  const firma = publicMode ? (card.companyNeutral ?? "der Betrieb") : (card.company ?? "");
  const sub = (s) => (typeof s === "string" ? s.replace(/\{firma\}/g, firma) : s);
  // Textfeld `key` von `obj` in der passenden Fassung, {firma} ersetzt
  const pick = (obj, key) => sub(publicMode && obj[key + "Public"] != null ? obj[key + "Public"] : obj[key]);

  // Fragen filtern; Ids der entfernten Fragen überall streichen
  const dropped = new Set();
  const kept = (card.questions ?? []).filter((q) => {
    if (publicMode && q.branded) { dropped.add(q.id); return false; }
    return true;
  });
  const clean = (ids) => ids?.filter((id) => !dropped.has(id));
  const questions = kept.map((q) => ({ ...q, label: pick(q, "label"), text: pick(q, "text"),
    unlocks: clean(q.unlocks) }));

  const asks = (card.asks ?? []).map((a) => ({ ...a, prompt: pick(a, "prompt"),
    options: (a.options ?? []).map((o) => ({ ...o, label: pick(o, "label"), reply: pick(o, "reply"), unlocks: clean(o.unlocks) })) }));

  return {
    ...card,
    edition: publicMode ? "public" : "firma",
    company: publicMode ? null : card.company,
    companyLogo: publicMode ? null : card.companyLogo,
    initial: clean(card.initial),
    greeting: card.greeting ? { ...card.greeting, text: pick(card.greeting, "text") } : card.greeting,
    asks,
    questions,
    reentry: card.reentry ? { ...card.reentry, rules: (card.reentry.rules ?? []).map((r) => ({ ...r, text: pick(r, "text") })) } : card.reentry,
  };
}
