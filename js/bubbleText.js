/* =============================================================================
   DETAR — BubbleText: Auszeichnung im Sprechtext und Satzgrenzen.
   Reine Textfunktionen, kein Canvas — die Messung (Zeilenzahl, Breite) macht
   die SpeechBubble selbst, weil nur sie den echten Font kennt.

   Auszeichnung im Text wie HTML:  "Das finde ich <welle>toll</welle>."
   FX ist ein GESCHLOSSENES Vokabular (wie die Emotion-Tags): unbekannte Tags
   bleiben als Text stehen, damit ein Tippfehler in der Kartendatei sichtbar
   wird statt still zu verschwinden.
   Ein Text wird in Zeichen zerlegt: { ch, fx } — fx = Name des Effekts oder
   null. Damit rechnen Umbruch, Seitenumbruch und Typewriter auf derselben
   Liste, und die Auszeichnung verändert die Seitenzahl nicht.
   ============================================================================= */
export const FX = ["welle", "zittern", "knall", "marker", "gross", "leise"];
const FX_RE = new RegExp("<(" + FX.join("|") + ")>([\\s\\S]*?)<\\/\\1>", "g");

/* Markup → [{ ch, fx }]. Zeilenumbrüche werden zu Leerzeichen; Whitespace
   wird auf einzelne Leerzeichen eingedampft, damit der Umbruch nur an
   Wortgrenzen arbeiten muss. */
export function parseChars(txt) {
  const out = [];
  const push = (s, fx) => {
    for (const ch of s.replace(/\s+/g, " ")) out.push({ ch, fx });
  };
  const text = String(txt ?? "");
  let last = 0, m;
  FX_RE.lastIndex = 0;
  while ((m = FX_RE.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index), null);
    push(m[2], m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) push(text.slice(last), null);
  // Rand-Leerzeichen weg
  while (out.length && out[0].ch === " ") out.shift();
  while (out.length && out[out.length - 1].ch === " ") out.pop();
  return out;
}

/* [{ ch, fx }] → Markup (Seiten werden als Markup weitergereicht). */
export function serialize(chars) {
  let s = "", open = null;
  for (const c of chars) {
    if (c.fx !== open) {
      if (open) s += `</${open}>`;
      if (c.fx) s += `<${c.fx}>`;
      open = c.fx;
    }
    s += c.ch;
  }
  if (open) s += `</${open}>`;
  return s;
}

export const charsToString = (chars) => chars.map((c) => c.ch).join("");

/* Wörter (mit Leerzeichen als eigene Einträge dazwischen). */
export function splitWords(chars) {
  const words = [];
  let cur = [];
  for (const c of chars) {
    if (c.ch === " ") { if (cur.length) words.push(cur); cur = []; }
    else cur.push(c);
  }
  if (cur.length) words.push(cur);
  return words;
}

/* Satzgrenzen: nach . ! ? … + Leerzeichen. Kurze Fragmente (Abkürzungen wie
   „z. B.") und kleingeschriebene Anschlüsse werden wieder angehängt, damit
   daraus keine eigene Seite wird. */
export function splitSentences(chars) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c.ch === " " && cur.length && /[.!?…]/.test(cur[cur.length - 1].ch)) {
      parts.push(cur); cur = [];
      continue;
    }
    cur.push(c);
  }
  if (cur.length) parts.push(cur);
  const out = [];
  parts.forEach((p) => {
    const first = p[0]?.ch ?? "";
    if (out.length && (p.length < 4 || /^[a-zäöüß]/.test(first))) {
      out[out.length - 1] = out[out.length - 1].concat([{ ch: " ", fx: null }], p);
    } else out.push(p);
  });
  return out;
}

/* Teilstücke an Komma, Semikolon, Doppelpunkt, Gedankenstrich (Notfall bei
   Sätzen, die allein nicht auf eine Seite passen). */
export function splitClauses(chars) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c.ch === " " && cur.length && /[,;:—–]/.test(cur[cur.length - 1].ch)) {
      parts.push(cur); cur = [];
      continue;
    }
    cur.push(c);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

export const joinWithSpace = (a, b) => (a.length ? a.concat([{ ch: " ", fx: null }], b) : b.slice());

/* Umbruch an Wortgrenzen, ohne Kappung. measure(chars) liefert die Breite —
   in der App am echten Font (SpeechBubble). Ein Wort, das allein zu breit
   ist, bleibt eine eigene Zeile. */
export function wrapWords(chars, measure, maxW) {
  const lines = [];
  let current = [];
  for (const word of splitWords(chars)) {
    const candidate = current.length ? joinWithSpace(current, word) : word;
    if (current.length === 0 || measure(candidate) <= maxW) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current.length) lines.push(current);
  return lines.length ? lines : [[]];
}

/* Seiten: Grenze am Satzende; ein Satz, der allein nicht passt, wird an
   Komma/Gedankenstrich geteilt, zuletzt an der Wortgrenze. fits(chars) sagt,
   ob ein Stück auf eine Seite passt. Liefert Zeichenlisten je Seite (leer,
   wenn der Text leer ist). Kern von SpeechBubble.paginate(). */
export function paginateChars(all, fits) {
  const pages = [];
  let cur = [];
  const splitOversized = (sentence) => {
    const flushWords = (chunk) => {
      let line = [];
      for (const w of splitWords(chunk)) {
        const t = line.length ? joinWithSpace(line, w) : w;
        if (fits(t)) line = t;
        else { if (line.length) pages.push(line); line = w; }
      }
      if (line.length) pages.push(line);
    };
    let acc = [];
    for (const p of splitClauses(sentence)) {
      const t = acc.length ? joinWithSpace(acc, p) : p;
      if (fits(t)) acc = t;
      else {
        if (acc.length) { pages.push(acc); acc = []; }
        if (fits(p)) acc = p; else flushWords(p);
      }
    }
    if (acc.length) pages.push(acc);
  };
  for (const sentence of splitSentences(all)) {
    const t = cur.length ? joinWithSpace(cur, sentence) : sentence;
    if (fits(t)) { cur = t; continue; }
    if (cur.length) { pages.push(cur); cur = []; }
    if (fits(sentence)) cur = sentence;
    else splitOversized(sentence);
  }
  if (cur.length) pages.push(cur);
  return pages;
}
