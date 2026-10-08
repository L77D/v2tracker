/* =============================================================================
   DETAR — Kartenprüfung: die maschinellen Punkte der Prüfliste aus
   docs/dialog-regelwerk.md (Teil C1). Läuft in tools/kartenpruefung.html.

   pruefeKarte(karte, { seiten }) → { fehler: [...], hinweise: [...], texte: [...] }
     karte   ganze Karte (daten.json + dialog.json zusammengeführt) ODER nur dialog.json (themen, initial,
             persona, greeting, asks, questions, reentry) — so, wie Claude ihn
             nach dem Regelwerk ausgibt. `company` darf fehlen; dann wird der
             Firmenname aus `optionen.firma` genommen (Eingabefeld der Seite).
     seiten  Funktion text → Seitenzahl in der Sprechblase. Die Seite übergibt
             SpeechBubble.paginate() der App — gemessen am echten Font.

   Kein DOM, kein 3D — reine Prüfregeln. Die festen Werte (Themen, Pflicht-
   fragen, Freischaltungen, Startfragen) sind die der Siemens-Karte
   (karten/elektroniker-siemens/dialog.json), entschieden 2026-10-08.
   ============================================================================= */
import { prepareCard } from "../js/edition.js";

export const THEMEN = [
  { id: "alltag", label: "Alltag im Job" },
  { id: "beruf", label: "Was der Beruf bringt" },
  { id: "wege", label: "Wie man reinkommt" },
];

// Pflichtfragen: Thema und Mindest-Freischaltungen (feste Topologie)
export const PFLICHT = {
  was:           { thema: "alltag", unlocks: ["tag_ablauf", "purpose"] },
  tag_ablauf:    { thema: "alltag", unlocks: ["anstrengend", "berufsschule"] },
  anstrengend:   { thema: "alltag", unlocks: ["danach"] },
  purpose:       { thema: "beruf",  unlocks: ["anstrengend"] },
  koennen:       { thema: "beruf",  unlocks: ["berufsschule", "bewerbung"] },
  berufsschule:  { thema: "beruf",  unlocks: ["danach"] },
  danach:        { thema: "beruf",  unlocks: ["bewerbung", "praktikum_wie"] },
  jetzt_tun:     { thema: "wege",   unlocks: ["praktikum_wie"] },
  bewerbung:     { thema: "wege",   unlocks: ["link"] },
  praktikum_wie: { thema: "wege",   unlocks: ["praktikum_was"] },
  praktikum_was: { thema: "wege",   unlocks: [] },
  link:          { thema: "wege",   unlocks: [] },
  ende:          { thema: null,     unlocks: [] },
};
export const INITIAL = ["was", "koennen", "jetzt_tun", "ende"];
export const TAGS = ["neutral", "winken", "erklaeren", "denken", "bestaetigen", "halten",
  "schulterzucken", "stolz", "erschoepft", "zeigen", "zweihaendig"];
export const FX = ["welle", "zittern", "knall", "marker", "gross", "leise"];
export const MAX_SEITEN = 2;
export const MAX_ZUSATZ = 2;
export const MIN_JE_THEMA = 3;
export const MAX_FIRMA = 2;
const UNBEKANNT = "unbekannt";
// Markierung für Aussagen ohne Quelle (Regelwerk A1) — zählt nicht zur Länge
export const ANNAHME = "[Annahme]";
const ANNAHME_RE = /\s*\[Annahme\]/g;
export const ohneAnnahme = (t) => String(t ?? "").replace(ANNAHME_RE, "");
// Verweise auf Firmenbestandteile, die es in der neutralen Fassung nicht gibt
const SEITE_FEHLER = /ausbildungsseite|webseite|website|homepage|internetseite/i;
const SEITE_HINWEIS = /\bseite\b|\blink\b/i;
// Angaben, die sich schnell ändern (Regelwerk A10) — Fehler bzw. Hinweis
const WANDEL_FEHLER = /€|\beuro\b|gehalt|vergütung|\blohn\b/i;
const WANDEL_HINWEIS = /verdien|urlaub|übernomm|übernahme|prämie|zuschuss|frist|bewerbungsschluss/i;

/* Alle Textstellen der Karte mit Ort, Feldname und Objekt. */
function textstellen(k) {
  const out = [];
  const add = (ort, obj, feld) => { if (obj && obj[feld] != null) out.push({ ort, obj, feld }); };
  if (k.greeting) add("Begrüßung", k.greeting, "text");
  for (const q of k.questions ?? []) {
    const n = out.length;
    add("Frage " + q.id + " · Beschriftung", q, "label");
    add("Frage " + q.id, q, "text");
    if (q.branded) for (let i = n; i < out.length; i++) out[i].nurFirma = true; // gibt es nur in der Firmenfassung
  }
  for (const a of k.asks ?? []) {
    add("Rückfrage " + a.id, a, "prompt");
    (a.options ?? []).forEach((o, i) => {
      add("Rückfrage " + a.id + " · Option " + (i + 1) + " · Beschriftung", o, "label");
      add("Rückfrage " + a.id + " · Option " + (i + 1), o, "reply");
    });
  }
  (k.reentry?.rules ?? []).forEach((r, i) => add("Wiedereinstieg " + (i + 1), r, "text"));
  return out;
}

/* Markup prüfen: nur Vokabular, jedes Tag geschlossen, nicht verschachtelt. */
function pruefeMarkup(text) {
  const probleme = [];
  const re = /<(\/?)([^<>\s\/]*)>/g;
  let offen = null, m;
  while ((m = re.exec(text))) {
    const [, zu, name] = m;
    if (!FX.includes(name)) { probleme.push("unbekannte Auszeichnung <" + zu + name + ">"); continue; }
    if (!zu) { if (offen) probleme.push("<" + name + "> steht in <" + offen + ">"); offen = name; }
    else if (offen !== name) probleme.push("</" + name + "> ohne passendes <" + name + ">");
    else offen = null;
  }
  if (offen) probleme.push("<" + offen + "> wird nicht geschlossen");
  return probleme;
}

export function pruefeKarte(karte, { seiten = null, firma = "" } = {}) {
  const fehler = [], hinweise = [];
  const F = (t) => fehler.push(t), H = (t) => hinweise.push(t);
  const k = karte ?? {};
  const fragen = Array.isArray(k.questions) ? k.questions : [];
  const asks = Array.isArray(k.asks) ? k.asks : [];
  const byId = new Map();

  /* --- Pflichtfelder --------------------------------------------------- */
  for (const feld of ["themen", "initial", "persona", "firmenbegriffe", "greeting", "asks", "questions", "reentry"]) {
    if (k[feld] == null) F("Feld „" + feld + "“ fehlt.");
  }
  if (k.firmenbegriffe != null && !Array.isArray(k.firmenbegriffe)) F("firmenbegriffe muss eine Liste sein (darf leer sein).");
  const p = k.persona;
  if (p && (!p.name || !p.lehrjahr || !p.haltung)) F("persona braucht name, lehrjahr und haltung.");

  /* --- Themen und IDs -------------------------------------------------- */
  const themenOk = Array.isArray(k.themen) && k.themen.length === THEMEN.length &&
    THEMEN.every((t, i) => k.themen[i]?.id === t.id && k.themen[i]?.label === t.label);
  if (!themenOk) F("themen müssen genau sein: " + THEMEN.map((t) => t.id + " „" + t.label + "“").join(", ") + ".");

  for (const q of fragen) {
    if (!q.id) { F("Eine Frage hat keine id."); continue; }
    if (byId.has(q.id)) F("id „" + q.id + "“ kommt doppelt vor.");
    byId.set(q.id, q);
  }
  for (const id of Object.keys(PFLICHT)) if (!byId.has(id)) F("Pflichtfrage „" + id + "“ fehlt.");

  /* --- Steuernde Rückfrage und Zweige ----------------------------------- */
  const steuernde = asks.filter((a) => (a.options ?? []).some((o) => o.sets));
  const zweige = new Set();
  let variable = null;
  if (steuernde.length > 1) F("Höchstens eine Rückfrage darf eine Variable setzen (gefunden: " + steuernde.map((a) => a.id).join(", ") + ").");
  if (steuernde.length >= 1) {
    const s = steuernde[0];
    if (s.trigger?.afterAnswers !== 1) F("Die steuernde Rückfrage „" + s.id + "“ braucht trigger { afterAnswers: 1 }.");
    const namen = new Set();
    for (const o of s.options ?? []) Object.keys(o.sets ?? {}).forEach((n) => namen.add(n));
    if (namen.size !== 1) F("Die steuernde Rückfrage muss genau eine Variable setzen (gefunden: " + [...namen].join(", ") + ").");
    variable = [...namen][0] ?? null;
    const opts = s.options ?? [];
    if (opts.length !== 3) F("Die steuernde Rückfrage braucht drei Optionen (zwei Pole + „Weiß ich noch nicht“).");
    if (opts.some((o) => !o.sets || !(variable in o.sets))) F("Jede Option der steuernden Rückfrage muss „" + variable + "“ setzen.");
    const weissNicht = opts.filter((o) => o.sets?.[variable] === UNBEKANNT);
    if (weissNicht.length !== 1) F("Genau eine Option muss „" + variable + ": " + UNBEKANNT + "“ setzen.");
    else if ((weissNicht[0].unlocks ?? []).length) F("Die Option „" + UNBEKANNT + "“ darf nichts freischalten.");
    for (const o of opts.filter((o) => o.sets && o.sets[variable] !== UNBEKANNT)) {
      const u = o.unlocks ?? [];
      if (u.length !== 1) { F("Pol „" + o.sets[variable] + "“ muss genau eine Frage freischalten."); continue; }
      zweige.add(u[0]);
      const z = byId.get(u[0]);
      if (!z) continue;
      if (PFLICHT[u[0]]) F("Zweigfrage „" + u[0] + "“ darf keine Pflichtfrage sein.");
      const req = z.requires?.[variable];
      if (!Array.isArray(req) || !req.includes(o.sets[variable])) {
        F("Zweigfrage „" + u[0] + "“ braucht requires { " + variable + ": [\"" + o.sets[variable] + "\"] }.");
      }
    }
  }
  for (const q of fragen) {
    if (!q.requires) continue;
    const keys = Object.keys(q.requires);
    if (!variable) F("Frage „" + q.id + "“ trägt requires, aber die Karte hat keine steuernde Rückfrage.");
    else if (keys.some((n) => n !== variable)) F("Frage „" + q.id + "“: requires darf nur „" + variable + "“ abfragen.");
    if (!zweige.has(q.id)) F("Frage „" + q.id + "“ trägt requires, wird aber von keinem Pol freigeschaltet.");
  }
  if (!variable) H("Die Karte hat keine steuernde Rückfrage — zulässig, wenn der Beruf keine Achse trägt.");

  /* --- Zusatzfragen ---------------------------------------------------- */
  const zusatz = fragen.filter((q) => q.id && !PFLICHT[q.id] && !zweige.has(q.id));
  if (zusatz.length > MAX_ZUSATZ) F("Höchstens " + MAX_ZUSATZ + " Zusatzfragen (gefunden: " + zusatz.map((q) => q.id).join(", ") + ").");
  const zusatzIds = new Set(zusatz.map((q) => q.id));

  /* --- Thema, Topologie, Sonderfragen ----------------------------------- */
  const themaIds = THEMEN.map((t) => t.id);
  for (const q of fragen) {
    const soll = PFLICHT[q.id];
    if (q.end) { if (q.thema) F("„" + q.id + "“ (Ausstieg) darf kein thema haben."); }
    else if (!themaIds.includes(q.thema)) F("Frage „" + q.id + "“ braucht ein thema aus " + themaIds.join(" / ") + ".");
    if (soll && soll.thema && q.thema !== soll.thema) F("Frage „" + q.id + "“ gehört ins Thema „" + soll.thema + "“.");
    for (const id of q.unlocks ?? []) if (!byId.has(id)) F("Frage „" + q.id + "“ schaltet unbekannte id „" + id + "“ frei.");
    if (soll) {
      const ist = new Set(q.unlocks ?? []);
      const fehlt = soll.unlocks.filter((id) => !ist.has(id));
      if (fehlt.length) F("Frage „" + q.id + "“ muss " + fehlt.join(", ") + " freischalten.");
      const extra = [...ist].filter((id) => !soll.unlocks.includes(id) && !zusatzIds.has(id));
      if (extra.length) F("Frage „" + q.id + "“ schaltet " + extra.join(", ") + " frei — über das Raster hinaus nur Zusatzfragen.");
    }
    if (!q.end && !q.label) F("Frage „" + q.id + "“ hat keine Beschriftung (label).");
    if (!q.text) F("Frage „" + q.id + "“ hat keinen Text.");
    if ("quelle" in q) H("Frage „" + q.id + "“ trägt „quelle“ — das Feld wird nicht mehr geführt.");
  }
  const link = byId.get("link");
  if (link && !(link.link === true && link.branded === true && /^https?:\/\//.test(link.url ?? ""))) {
    F("„link“ braucht link: true, branded: true und eine url (https://…).");
  }
  const ende = byId.get("ende");
  if (ende && ende.end !== true) F("„ende“ braucht end: true.");
  if (fragen.some((q) => q.link && q.id !== "link")) F("Nur die Frage „link“ darf link: true tragen.");

  const init = Array.isArray(k.initial) ? k.initial : [];
  if (init.length !== INITIAL.length || INITIAL.some((id) => !init.includes(id))) {
    F("initial muss genau " + INITIAL.join(", ") + " sein.");
  }

  /* --- Rückfragen ------------------------------------------------------- */
  const quiz = asks.filter((a) => a.trigger?.afterAnswers === 3);
  const fazit = asks.filter((a) => a.trigger?.onExit === true);
  for (const a of asks) {
    const t = a.trigger ?? {};
    const ok = t.afterAnswers === 1 || t.afterAnswers === 3 || t.onExit === true;
    if (!ok) F("Rückfrage „" + a.id + "“ hat einen unbekannten trigger.");
    if (!a.prompt) F("Rückfrage „" + a.id + "“ hat keinen prompt.");
    for (const o of a.options ?? []) {
      if (!o.label || !o.reply) F("Rückfrage „" + a.id + "“: jede Option braucht label und reply.");
      for (const id of o.unlocks ?? []) if (!byId.has(id)) F("Rückfrage „" + a.id + "“ schaltet unbekannte id „" + id + "“ frei.");
    }
  }
  if (quiz.length === 0) H("Keine Schätzfrage — nur in Ausnahmefällen zulässig; Begründung gehört in den Prüfbericht.");
  if (quiz.length > 1) F("Höchstens eine Schätzfrage (afterAnswers: 3).");
  for (const a of quiz) {
    if ((a.options ?? []).length !== 4) F("Die Schätzfrage „" + a.id + "“ braucht vier Optionen: drei Schätzungen und „Keine Ahnung“.");
    if ((a.options ?? []).filter((o) => /^keine ahnung$/i.test(String(o.label ?? "").trim())).length !== 1) F("Die Schätzfrage „" + a.id + "“ braucht genau eine Option „Keine Ahnung“.");
    if ((a.options ?? []).some((o) => o.sets || (o.unlocks ?? []).length)) F("Die Schätzfrage setzt nichts und schaltet nichts frei.");
  }
  if (fazit.length !== 1) F("Genau eine Abschiedsfrage (onExit) ist Pflicht.");
  for (const a of fazit) {
    if ((a.options ?? []).length !== 3) F("Die Abschiedsfrage braucht drei Optionen.");
    if (!(a.options ?? []).some((o) => (o.unlocks ?? []).includes("praktikum_wie"))) F("Eine Option der Abschiedsfrage muss „praktikum_wie“ freischalten.");
    if ((a.options ?? []).some((o) => o.sets)) F("Die Abschiedsfrage setzt keine Variable.");
  }

  /* --- Wiedereinstieg --------------------------------------------------- */
  const rules = k.reentry?.rules ?? [];
  if (!rules.length) F("reentry.rules ist leer.");
  else {
    const last = rules[rules.length - 1];
    if (last.ifVisit || last.ifVar || last.ifAsked || last.ifNotAsked) F("Die letzte Wiedereinstiegs-Regel muss ohne Bedingung sein (Standard).");
    if (rules.length < 3) H("Wiedereinstieg: " + rules.length + " Varianten — Richtwert 3.");
  }

  /* --- Erreichbarkeit --------------------------------------------------- */
  const erreicht = new Set(init);
  let neu = true;
  while (neu) {
    neu = false;
    const add = (id) => { if (!erreicht.has(id)) { erreicht.add(id); neu = true; } };
    for (const q of fragen) if (erreicht.has(q.id)) (q.unlocks ?? []).forEach(add);
    for (const a of asks) for (const o of a.options ?? []) (o.unlocks ?? []).forEach(add);
  }
  for (const q of fragen) if (!erreicht.has(q.id)) F("Frage „" + q.id + "“ wird nie freigeschaltet.");

  /* --- Tags und Auszeichnung --------------------------------------------- */
  const tagOrte = [];
  if (k.greeting) tagOrte.push(["Begrüßung", k.greeting.tag]);
  fragen.forEach((q) => tagOrte.push(["Frage " + q.id, q.tag]));
  asks.forEach((a) => { tagOrte.push(["Rückfrage " + a.id, a.tag]); (a.options ?? []).forEach((o, i) => tagOrte.push(["Rückfrage " + a.id + " · Option " + (i + 1), o.tag])); });
  rules.forEach((r, i) => tagOrte.push(["Wiedereinstieg " + (i + 1), r.tag]));
  for (const [ort, tag] of tagOrte) if (!TAGS.includes(tag)) F(ort + ": tag „" + (tag ?? "—") + "“ ist nicht im Vokabular.");

  const stellen = textstellen(k);
  for (const s of stellen) {
    for (const feld of [s.feld, s.feld + "Public"]) {
      const t = s.obj[feld];
      if (typeof t !== "string") continue;
      for (const pr of pruefeMarkup(t)) F(s.ort + (feld.endsWith("Public") ? " (Public)" : "") + ": " + pr + ".");
    }
  }

  /* --- Firmenname, Firmenbegriffe, Verweise, schnell veraltende Angaben ---
     Gemeinsame Texte (ohne Public-Fassung) und Public-Fassungen erscheinen in
     der neutralen Fassung — dort darf nichts den Betrieb kenntlich machen. */
  const name = (k.company ?? firma ?? "").trim();
  const begriffe = [name, ...(Array.isArray(k.firmenbegriffe) ? k.firmenbegriffe : [])]
    .map((b) => String(b ?? "").trim()).filter((b) => b.length > 1);
  const findeBegriff = (t) => begriffe.find((b) => t.toLowerCase().includes(b.toLowerCase()));
  let firmaZahl = 0;
  for (const s of stellen) {
    const orig = String(s.obj[s.feld] ?? "");
    const pub = s.obj[s.feld + "Public"];
    const n = (orig.match(/\{firma\}/g) ?? []).length;
    firmaZahl += n;
    if (name && orig.toLowerCase().includes(name.toLowerCase())) F(s.ort + ": Firmenname „" + name + "“ ausgeschrieben — stattdessen {firma} schreiben.");
    for (const t of [orig, pub]) {
      if (typeof t !== "string") continue;
      if (WANDEL_FEHLER.test(t)) F(s.ort + ": nennt Geld oder Gehalt — Angaben, die sich schnell ändern, gehören nicht in die Karte.");
      else if (WANDEL_HINWEIS.test(t)) H(s.ort + ": prüfen, ob hier etwas steht, das sich schnell ändert (Urlaub, Übernahme, Leistungen, Fristen).");
    }
    if (s.nurFirma) continue; // Link-Frage: gibt es nur in der Firmenfassung
    if (n && pub == null) F(s.ort + ": enthält {firma}, aber keine neutrale Fassung (" + s.feld + "Public).");
    const neutral = pub != null ? String(pub) : orig; // was die neutrale Fassung zeigt
    const wo = s.ort + (pub != null ? " (neutrale Fassung)" : " (gilt für beide Fassungen)");
    if (/\{firma\}/.test(neutral)) F(wo + ": darf {firma} nicht enthalten.");
    const b = findeBegriff(neutral);
    if (b) F(wo + ": „" + b + "“ ist ein Firmenbegriff — neutral formulieren oder eine neutrale Fassung (" + s.feld + "Public) ergänzen.");
    if (SEITE_FEHLER.test(neutral)) F(wo + ": verweist auf eine Seite des Betriebs — die neutrale Fassung hat keine.");
    else if (SEITE_HINWEIS.test(neutral)) H(wo + ": „Seite“/„Link“ — prüfen, ob das auf die Ausbildungsseite verweist.");
    if (pub != null && !n && !findeBegriff(orig) && !SEITE_FEHLER.test(orig) && !SEITE_HINWEIS.test(orig)) {
      H(s.ort + ": hat eine neutrale Fassung, obwohl die Firmenfassung keinen Firmenbezug erkennen lässt.");
    }
  }
  if (firmaZahl > MAX_FIRMA) F("{firma} steht " + firmaZahl + "-mal in der Firmenfassung — höchstens " + MAX_FIRMA + ".");
  if (!name) H("Kein Firmenname bekannt — die Prüfung auf den ausgeschriebenen Firmennamen entfällt.");

  /* --- Belegung je Thema und Länge, je Fassung --------------------------- */
  const texte = [];
  for (const publicMode of [false, true]) {
    let fassung;
    try { fassung = prepareCard({ ...k, company: name || k.company }, { publicMode }); }
    catch (e) { F("Karte lässt sich nicht für die " + (publicMode ? "Public" : "Firmen") + "-Fassung aufbereiten: " + e.message); continue; }
    const label = publicMode ? "Public" : "Firma";
    for (const t of THEMEN) {
      const n = fassung.questions.filter((q) => q.thema === t.id && !q.requires).length;
      if (n < MIN_JE_THEMA) F("Thema „" + t.label + "“ hat in der " + label + "-Fassung nur " + n + " Fragen (mind. " + MIN_JE_THEMA + ", Zweigfragen zählen nicht).");
    }
    for (const s of textstellen(fassung)) {
      if (s.feld === "label") continue; // Beschriftungen stehen in Kacheln, nicht in der Blase
      const text = String(s.obj[s.feld] ?? "");
      const ohne = ohneAnnahme(text);
      const zeichen = ohne.replace(/<[^>]*>/g, "").length;
      const n = seiten ? seiten(ohne) : null;
      texte.push({ fassung: label, ort: s.ort, zeichen, seiten: n, text });
      if (n != null && n > MAX_SEITEN) F(label + " · " + s.ort + ": " + n + " Seiten (höchstens " + MAX_SEITEN + ").");
    }
  }
  const zwei = texte.filter((t) => t.fassung === "Firma" && t.seiten === 2).length;
  if (zwei) H(zwei + (zwei === 1 ? " Text braucht" : " Texte brauchen") + " 2 Seiten (Ziel ist 1; der Sinn muss auf der ersten Seite klar sein).");

  /* --- Annahmen: Aussagen ohne Quelle, vor der Freigabe auflösen ---------- */
  const annahmen = [];
  for (const s of stellen) {
    for (const feld of [s.feld, s.feld + "Public"]) {
      const t = s.obj[feld];
      const m = typeof t === "string" ? t.match(ANNAHME_RE) : null;
      if (m) annahmen.push(s.ort + (feld.endsWith("Public") ? " (neutral)" : "") + (m.length > 1 ? " ×" + m.length : ""));
    }
  }
  if (annahmen.length) H(annahmen.length + (annahmen.length === 1 ? " Text" : " Texte") + " mit [Annahme] — vor der Freigabe bestätigen oder ersetzen: " + annahmen.join(" · ") + ".");

  return { fehler, hinweise, texte };
}

/* Lesefassung: der komplette Dialog einer Fassung am Stück, in der Reihenfolge,
   in der ihn ein Schüler höchstens sehen kann (Begrüßung, Themen mit Fragen,
   Rückfragen, Ausstieg, Wiedereinstieg). Liefert [{art, titel, text, notiz}]. */
export function lesefassung(karte, { publicMode = false, firma = "" } = {}) {
  const k = prepareCard({ ...karte, company: karte.company || firma || karte.company }, { publicMode });
  const out = [];
  if (k.greeting) out.push({ art: "figur", titel: "Begrüßung", text: k.greeting.text });
  const zweig = (q) => q.requires ? "nur nach Antwort „" + Object.values(q.requires).flat().join(", ") + "“" : "";
  for (const t of k.themen ?? []) {
    out.push({ art: "thema", titel: t.label });
    for (const q of (k.questions ?? []).filter((q) => q.thema === t.id)) {
      out.push({ art: "frage", titel: q.label, text: q.text, notiz: [zweig(q), q.link ? "öffnet die Seite" : ""].filter(Boolean).join(" · ") });
    }
  }
  out.push({ art: "thema", titel: "Rückfragen der Figur" });
  for (const a of k.asks ?? []) {
    const wann = a.trigger?.onExit ? "beim Ausstieg" : "nach der " + a.trigger?.afterAnswers + ". Antwort";
    out.push({ art: "figur", titel: wann, text: a.prompt });
    for (const o of a.options ?? []) out.push({ art: "option", titel: o.label, text: o.reply });
  }
  const ende = (k.questions ?? []).find((q) => q.end);
  if (ende) { out.push({ art: "thema", titel: "Ausstieg" }); out.push({ art: "frage", titel: ende.label, text: ende.text }); }
  out.push({ art: "thema", titel: "Wiedereinstieg" });
  for (const r of k.reentry?.rules ?? []) out.push({ art: "figur", titel: r.ifVisit ? "ab dem " + r.ifVisit + ". Besuch" : "Standard", text: r.text });
  return out;
}
