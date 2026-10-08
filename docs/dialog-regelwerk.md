# DETAR — Regelwerk zur Dialog-Generierung

Stand 08.10.2026 (Build 71). Löst `Dialogsystem/DETAR_Dialog_Generierung.md`
im Projektordner ab (Stand 03.09.2026). Dieses Dokument ist die
Arbeitsanweisung, mit der Claude den Dialog **einer** Karte erzeugt. Es ist als
**Kontrakt** geschrieben: Jede Regel ist prüfbar.

Produktionsweg: **Erhebung → Faktenblatt (+ Gesprächsabschrift) → Claude generiert den
Dialogteil → Prüfseite → menschliche Korrektur → Freigabe durch den Betrieb →
Einbau in `karten/<id>/karte.json`.** Es gibt keine schreibenden Autoren; der
Mensch korrigiert, entscheidet und gibt frei.

**Zwei Fassungen, ein Auftrag.** Karten werden von Betrieben in Auftrag
gegeben; deshalb entsteht zuerst die **Firmenfassung**. Aus ihr wird die
**neutrale Fassung** für öffentliche Einrichtungen abgeleitet (`?public` im
QR-Code) — ohne Logo, ohne Link, ohne Firmenbezüge. Beide haben zuerst einen
neutralen Bildungsauftrag: Sie vermitteln **inhaltlich deckungsgleich den
Beruf**. Die Firmenfassung darf zusätzlich den Betrieb und allgemeine
Firmenzusammenhänge nennen (A9), nie aber Angaben, die sich schnell ändern
(A10).

Begleitend:

- **Vorbild:** `karten/elektroniker-siemens/karte.json` — eine vollständige
  Karte im Zielzustand. Bei Widerspruch zwischen Regelwerk und Vorbild gewinnt
  das Regelwerk; dann wird das Vorbild angepasst.
- **Prüfseite:** `tools/kartenpruefung.html` — prüft alle Punkte aus C1
  automatisch und misst die Seiten wie die App (Aufruf in Teil C).
- **Begründungen:** `Dialogsystem/DETAR_Dialogsystem.md` und
  `DETAR_Dialogsystem_Konzept.md` im Projektordner (warum Hub statt Baum,
  warum eine Variable, Haltung der Rückfragen).

---

# Teil A — Generierungs-Spezifikation

## A1. Auftrag und Eingaben

Erzeuge den **Dialogteil** einer Karte als JSON nach dem Ausgabekontrakt (A11):
`persona`, `firmenbegriffe`, `themen`, `initial`, `greeting`, `asks`,
`questions`, `reentry`. Erst die Firmenfassung schreiben, dann jeden Text
prüfen, ob er eine neutrale Fassung braucht (A9).
Kopfdaten (`id`, `profession`, `company`, `companyLogo`), Figur und
Kartenbilder gehören **nicht** dazu — sie kommen aus der Produktion.

Eingaben sind **ausschließlich**: dieses Dokument, das ausgefüllte Faktenblatt
(Teil B) und, falls vorhanden, die Abschrift des Azubi-Interviews.

**Nichts erfinden, Annahmen kennzeichnen.** Jede prüfbare Aussage — Zahl,
Dauer, Größe, Uhrzeit, Ort, Tätigkeit, Ablauf — stammt aus Faktenblatt oder
Gesprächsabschrift. Wo das Material fehlt und Claude eine Aussage trotzdem als
Platzhalter setzt, steht direkt dahinter **`[Annahme]`**, vor dem
Satzzeichen: `Einmal die Woche Berufsschule [Annahme]: …`

- `[Annahme]` bleibt im Text, bis die Aussage bestätigt (Marke löschen) oder
  ersetzt ist. Die App zeigt die Marke an — gewollt, solange die Karte ein
  Entwurf ist. Vor der Freigabe beim Betrieb steht keine Marke mehr im Dialog.
- Nicht markiert werden Meinungen und Ratschläge der Figur („Ein Praktikum
  sagt mehr als jede Broschüre") und die erfundene Persona.
- Die Prüfseite listet alle Marken auf und zählt sie bei der Länge nicht mit.
- Jede Lücke steht zusätzlich im **Prüfbericht** nach dem JSON (siehe
  Aufrufmuster).

## A2. Persona

Vor dem Dialog wird die Figur festgelegt und als Feld `persona` ausgegeben:

```json
"persona": { "name": "Jonas", "lehrjahr": 2, "haltung": "ruhig und direkt, erzählt aus der Werkstatt …" }
```

- **name:** Vorname, frei erfunden, unauffällig, nicht der Name einer realen
  Person aus Faktenblatt oder Interview.
- **lehrjahr:** 2 oder 3.
- **haltung:** ein Satz Sprechhaltung, aus dem Interview abgeleitet.

Die App liest `persona` nicht. Das Feld hält beim Gegenlesen und beim
Neu-Generieren fest, nach wem die Karte klingen soll. Sichtbar wird der Name
nur, wenn die Figur ihn sagt — in der Begrüßung stellt sie sich vor. Die
Haltung färbt den Ton, hebelt aber keine Regel aus A7 aus.

## A3. Themen und Pflichtfragen

Die drei Themen sind auf **allen Karten gleich** (Wortlaut eingeschlossen):

```json
"themen": [
  { "id": "alltag", "label": "Alltag im Job" },
  { "id": "beruf",  "label": "Was der Beruf bringt" },
  { "id": "wege",   "label": "Wie man reinkommt" }
]
```

Jede Karte enthält **genau diese** Pflichtfragen mit diesen IDs und Themen.
Die Beschriftung (`label`, Text auf der Kachel) wird an den Beruf angepasst;
Rolle, ID und Thema nicht.

| ID | Thema | Rolle |
|---|---|---|
| `was` | alltag | Was der Beruf konkret ist — mit einem Bild, das ein Laie versteht |
| `tag_ablauf` | alltag | Ein Arbeitstag von morgens bis Feierabend |
| `anstrengend` | alltag | Was hart, unbequem oder langweilig ist |
| `purpose` | beruf | Wem die Arbeit nützt, was ohne sie passieren würde |
| `koennen` | beruf | Voraussetzungen: Abschluss, Fächer, Eigenschaften |
| `berufsschule` | beruf | Was man in der Berufsschule lernt und wie oft man dort ist |
| `danach` | beruf | Dauer der Ausbildung, wie es danach weitergeht |
| `jetzt_tun` | wege | Was man jetzt schon tun kann |
| `bewerbung` | wege | Wie man sich bewirbt — ohne Termine; Firmenfassung verweist auf die Seite, neutrale Fassung erklärt allgemein |
| `praktikum_wie` | wege | Wie man an ein Praktikum kommt |
| `praktikum_was` | wege | Was ein Praktikum zeigt |
| `link` | wege | Öffnet die Ausbildungsseite (Firmenfassung) |
| `ende` | — | Ausstieg („Ich muss weiter"), steht als Kachel im Themenraster |

Sonderfragen:

- **`link`** trägt `"link": true`, `"branded": true` und `"url"` (aus dem
  Faktenblatt). Beschriftung frei, kurz genug für die Kachel (Vorbild: „Zeig
  mir die Seite"). Der Text kündigt an, dass sich die Seite öffnet. In der
  Public-Fassung entfällt die Frage automatisch.
- **`ende`** trägt `"end": true` und **kein** `thema`. Beschriftung frei.

**Zusatzfragen:** höchstens **zwei**, Thema frei, nur wenn Faktenblatt oder
Interview Material liefern, das in keine Pflichtfrage passt. Sie werden durch
eine Pflichtfrage freigeschaltet (deren `unlocks` wird ergänzt), stehen nie in
`initial` und haben sprechende IDs.

**Belegung:** Jedes Thema hat **mindestens drei Fragen** — in der Firmen- und
in der Public-Fassung. Zweigfragen (A5) zählen nicht mit, weil sie nicht jeder
Nutzer sieht.

## A4. Startfragen und Freischaltungen

```json
"initial": ["was", "koennen", "jetzt_tun", "ende"]
```

Je Thema eine Startfrage, damit keine Themenkarte leer wirkt; dazu der
Ausstieg. Die Freischaltungen sind fest:

```
was           → tag_ablauf, purpose
tag_ablauf    → anstrengend, berufsschule
anstrengend   → danach
purpose       → anstrengend
koennen       → berufsschule, bewerbung
berufsschule  → danach
danach        → bewerbung, praktikum_wie
jetzt_tun     → praktikum_wie
bewerbung     → link
praktikum_wie → praktikum_was
```

Dazu kommen die Freischaltungen aus den Rückfragen (A5): je Pol eine
Zweigfrage, die Ja-Antwort der Abschiedsfrage → `praktikum_wie`.
Freischaltungen fügen nur hinzu, sie nehmen nie etwas weg.

## A5. Die drei Rückfragen

Die Figur fragt dreimal zurück. Jede Option braucht eine Reaktion (`reply`).
Keine Antwort ist falsch; eine Option, die nichts preisgibt („Weiß ich noch
nicht", „Keine Ahnung"), ist immer dabei und hat keinen Nachteil. Die
steuernde Rückfrage und die Abschiedsfrage haben **drei** Optionen, die
Schätzfrage **vier** (drei Schätzungen und „Keine Ahnung"; das Menü zeigt vier
Kacheln auf einer Seite).

### 1. Steuernde Rückfrage — `trigger: { "afterAnswers": 1 }`

Die Achse gehört zur Karte und wird aus dem Beruf abgeleitet, nicht aus einer
Liste gewählt. Auf dem Vorbild: „Sag mal — arbeitest du lieber mit Menschen
oder lieber mit Maschinen?"

- Sie teilt den Arbeitstag in **zwei Anteile** und fragt nach der Vorliebe des
  Nutzers, nicht nach seinem Wissen.
- **Beide Pole müssen im Beruf in vergleichbarer Größe vorkommen.** Probe:
  beide Reaktionen und beide Zweigfragen probeweise schreiben — bleibt eine
  dünn, trägt die Achse nicht.
- **Anteil statt Gegenstand.** Brauchbare Achsen: allein/im Team,
  planbar/jeden Tag anders, mit den Händen/im Kopf, drinnen/draußen,
  Menschen/Maschinen.
- Gefunden wird die Achse im Interview: dort, wo zwei Leute im selben Beruf
  verschieden antworten, was sie daran mögen.
- **Trägt der Beruf keine Achse, entfällt die Rückfrage** samt Zweigfragen.

Aufbau — genau **eine** Variable, drei Optionen:

- Pol A setzt `"<variable>": "<pol a>"` und schaltet **genau eine** Zweigfrage
  frei; Pol B ebenso mit seiner Zweigfrage.
- „Weiß ich noch nicht" setzt `"<variable>": "unbekannt"` und schaltet
  **nichts** frei. Der Wert `unbekannt` ist reserviert.
- Variablenname und Pol-Werte sind **sprechend** (`neigung: menschen /
  maschinen`), nicht `a` / `b`.
- **Zweigfragen** haben sprechende IDs (Vorbild: `reden`, `technik`), ein
  Thema nach Inhalt und tragen `"requires": { "<variable>": ["<pol>"] }`.
  Sie behandeln genau den Anteil, den ihr Pol benennt.

Reaktionen **beschreiben, statt zu beurteilen**: die Antwort aufnehmen, den
Anteil im Berufsalltag konkret schildern, aufhören. Kein Urteil über die
Person — weder „dann ist das nur halb deins" noch „dann bist du hier
goldrichtig". Keine Wertung durch die Hintertür („nur", „immerhin",
„leider"). Jede Reaktion enthält eine konkrete Angabe.

### 2. Schätzfrage — `trigger: { "afterAnswers": 3 }`

Die Schätzfrage ist **didaktisch wichtig** und gehört auf jede Karte. Sie
braucht eine richtige Antwort aus Faktenblatt oder Interview und **vier
Optionen: drei Schätzungen und „Keine Ahnung"** (Wortlaut fest, immer an
letzter Stelle). Erlaubte Arten der drei Schätzungen:

| Art | Beispiel | Optionen |
|---|---|---|
| **Zahl schätzen** | „Wie viele Kabel stecken in so einem Kasten?" — nur Zahlen, die lange gelten, nie Geld | deutlich zu niedrig · richtig · deutlich zu hoch |
| **Was gehört dazu?** | „Was davon mache ich NICHT?" | drei Tätigkeiten, eine gehört nicht zum Beruf |
| **Wo landet es?** | „Wohin geht das, was ich baue?" | drei Orte oder Abnehmer, einer stimmt |
| **Womit arbeite ich?** | „Was habe ich am häufigsten in der Hand?" | drei Gegenstände, einer stimmt |

- **Jede Reaktion nennt die richtige Antwort**, auch die auf „Keine Ahnung".
  Eine falsche Schätzung wird korrigiert, nicht kommentiert — kein „da hast du
  dich vertan".
- Die Schätzfrage setzt keine Variable und schaltet nichts frei.
- **Trägt keine der vier Arten, wird eine neue Art gesucht**, die demselben
  Muster folgt (eine richtige Antwort, zwei plausible falsche, Auflösung in
  jeder Reaktion). Die Schätzfrage entfällt nur in **Ausnahmefällen**; die
  Begründung steht dann im Prüfbericht.

### 3. Abschiedsfrage — `trigger: { "onExit": true }`

Läuft beim Ausstieg vor der Verabschiedung und ersetzt die Schlusszeile.

- **Sinn ist fest:** Könnte sich der Nutzer den Beruf vorstellen? Wortlaut
  frei, passend zur Figur (Vorbild: „Bevor du gehst — könntest du dir sowas
  vorstellen?").
- **Drei Optionen:** Ja · Nein · Weiß nicht — sinngemäß, Wortlaut frei.
- Die **Ja-Option schaltet `praktikum_wie` frei**, damit der Strang beim
  nächsten Antippen der Karte wartet.
- Hier urteilt der Schüler über sich selbst. Die Figur nimmt alle drei
  Antworten **gleichwertig** an und schiebt nichts nach; ein Nein ist ein
  Ergebnis, kein Verlust.

## A6. Begrüßung und Wiedereinstieg

- **Begrüßung** (`greeting`): Die Figur stellt sich mit Namen und Beruf vor
  und lädt zum Fragen ein. Eine Seite.
- **Wiedereinstieg** (`reentry.rules`): drei Varianten nach erneutem Tippen
  auf die Karte. Beiläufig — kein zweites Hallo, keine Erinnerung an Link,
  Bewerbung oder offene Fragen. Erste passende Regel gewinnt; die **letzte
  Regel hat keine Bedingung** (Standard). Vorbild: `ifVisit: 4`, `ifVisit: 3`,
  Standard.

## A7. Sprache und Länge

### Länge: gemessen in Seiten

Die Sprechblase fasst fünf Zeilen; längerer Text wird in **Seiten** geteilt,
der Nutzer blättert mit Weiter. Gezählt wird in Seiten, nicht in Zeichen —
die Prüfseite misst genau wie die App.

- **Ziel: eine Seite. Höchstens zwei.** Der Sinn muss auf der ersten Seite
  klar sein; zwei Seiten sind die Ausnahme, aber kein Fehler. Drei Seiten
  sind ein Fehler. Gekürzt wird, wo inhaltlich nichts verloren geht.
- Eine Seite fasst etwa **90–110 Zeichen**. Die App teilt am **Satzende**:
  Ein Satz, der nicht mehr auf die laufende Seite passt, beginnt eine neue.
  Ein einzelner Satz über ~100 Zeichen wird mitten im Satz geteilt.
- Daraus folgt: **kurze Sätze**, jeder unter ~90 Zeichen, höchstens drei
  Sätze pro Antwort. Ein sehr kurzer erster Satz („Genau.") steht allein auf
  einer Seite, wenn der nächste nicht mehr dazupasst.
- Gilt für alle Texte in der Sprechblase: Begrüßung, Antworten, Rückfragen,
  Reaktionen, Wiedereinstieg — in beiden Fassungen.

### Allgemein verständliche Sprache

Jedes Wort muss eine Achtklässlerin ohne Vorwissen verstehen.

- **Keine Eigennamen aus dem Betrieb:** keine Produktnamen,
  Typenbezeichnungen, Programm- oder Abteilungsnamen und keine Abkürzungen
  („SIVACON", „SPE", „E-Werkstatt 2"). Stattdessen beschreiben, was es ist:
  „Schaltanlage" statt „SIVACON-Anlage", „unsere Ausbildungswerkstatt" statt
  „SPE".
- **Fachbegriffe** nur nach den Sprachregeln unten: höchstens einer pro
  Antwort, im selben Satz erklärt.
- **Firmenzusammenhänge** nennt die Firmenfassung in Alltagssprache: den Ort
  („in Erlangen"), die Branche, wofür das Produkt gebraucht wird („Anlagen für
  Krankenhäuser"). Wie der Betrieb seine Dinge intern nennt, gehört nicht
  dazu.
- **Betriebseigenes als eigene Erfahrung:** Was nur in diesem Betrieb gilt
  (Arbeitsbeginn, Voraussetzungen, was gebaut wird), sagt die Figur als ihre
  Erfahrung („Ich hatte Mittlere Reife, das reicht bei uns"), nicht als Regel
  des Berufs — sonst liest es sich in der neutralen Fassung falsch.

**Probe:** Könnte die Schülerin den Satz einem Freund nacherzählen, ohne ein
Wort nachzuschlagen?

### Sprachregeln

Die Figur ist Azubi und erzählt aus ihrem Tag — sie erklärt nicht das
Berufsbild.

- **Ich-Perspektive im Präsens.** „Ich mache", nicht „Man macht".
- **Kein Fachwort ohne Bild.** Höchstens **ein** Fachbegriff pro Antwort, und
  nur mit Erklärung im selben Satz: „Bei uns heißen sie Schaltanlagen."
- **Kontext vor Detail.** Erst wofür, dann was.
- **Eine konkrete Angabe pro Antwort:** Zahl, Gegenstand, Uhrzeit, Ort oder
  Beispiel. Antworten ohne konkrete Angabe werden neu geschrieben.
- **Keine HR-Sprache, keine angebiederte Jugendsprache.** Weder „vielfältige
  Herausforderungen" noch „krass". Die Figur ist zwei, drei Jahre älter als
  die Zielgruppe und redet normal.
- **Auch die harte Seite** gehört in dieselbe Sprache wie die schöne.

**Ersetzungsmuster** (pro Branche erweitern)

| statt | schreibe |
|---|---|
| ablängen | auf Länge schneiden |
| anschlagen | an beiden Enden festschrauben |
| Betriebsmittel | Geräte, Maschinen |
| Inbetriebnahme | zum ersten Mal einschalten |
| kommissionieren | Waren für einen Auftrag zusammensuchen |
| Schutzmaßnahme | damit niemandem was passiert |
| dokumentieren | aufschreiben, was gemacht wurde |

**Beispielpaare**

- ✗ „Ich übernehme die Inbetriebnahme von Schaltanlagen unter Beachtung der
  Schutzmaßnahmen."
  ✓ „Wenn der Kasten fertig ist, schalte ich ihn zum ersten Mal ein. Vorher
  prüfe ich dreimal, dass nichts unter Strom steht."
- ✗ „Der Beruf bietet vielfältige Herausforderungen und Entwicklungschancen."
  ✓ „Kein Kasten ist wie der davor. Nach zwei Jahren baue ich Teile allein,
  die ich am Anfang nur halten durfte."
- ✗ „Dann bist du hier goldrichtig."
  ✓ „Kenn ich. Der Tag geht fast komplett für den Kasten drauf."

## A8. Auszeichnung im Text

Texte dürfen Hervorhebungen aus einem geschlossenen Vokabular tragen,
geschrieben wie HTML: `Bei Strom ist Schludern <marker>keine Option</marker>.`

| Tag | Wirkung |
|---|---|
| `marker` | gelbe Schrift mit Unterstrich |
| `gross` | größere Schrift (Zahlen) |
| `leise` | blasser, wie beiläufig gesagt |
| `knall` | ploppt beim Erscheinen auf |
| `welle` | erlaubt; wird erst sichtbar, sobald der Renderer Bewegung kann |
| `zittern` | erlaubt; wird erst sichtbar, sobald der Renderer Bewegung kann |

- Höchstens **eine** Hervorhebung pro Antwort (Ausnahme: zwei Zahlen mit
  `gross` in derselben Antwort).
- Jedes Tag wird geschlossen; Tags werden nicht verschachtelt.

## A9. Firmenfassung und neutrale Fassung

Beide Fassungen stehen in **einer** Datei. Die meisten Texte gelten für beide.
Nur wo die Firmenfassung den Betrieb kenntlich macht, steht die neutrale
Fassung als **ganzer zweiter Text** daneben.

**Was die Firmenfassung zusätzlich hat:**

- den Firmennamen — nur über den Platzhalter **`{firma}`**, nie
  ausgeschrieben, **höchstens zweimal** pro Karte (Vorbild: Begrüßung und
  Bewerbung);
- allgemeine Firmenzusammenhänge in Alltagssprache (Ort, Branche, wofür das
  Produkt gebraucht wird, A7);
- die Link-Frage (`branded: true`) und Verweise auf die Ausbildungsseite.

**Was die neutrale Fassung hat:** nichts davon. Kein Logo, kein Link, kein
Firmenname, kein Firmenbegriff, kein Verweis auf eine Seite des Betriebs. Sie
vermittelt den Beruf mit denselben Inhalten.

**Wann ein Text eine neutrale Fassung braucht** — wenn er

- `{firma}` enthält,
- einen Begriff aus `firmenbegriffe` enthält, oder
- auf die Ausbildungsseite, „die Seite" oder den Link verweist.

Dann trägt er ein zweites Feld `<feld>Public` ohne diesen Bezug, mit
demselben Inhalt:

| Ort | Feld | neutrale Fassung |
|---|---|---|
| Begrüßung | `greeting.text` | `greeting.textPublic` |
| Frage | `label`, `text` | `labelPublic`, `textPublic` |
| Rückfrage | `prompt` | `promptPublic` |
| Option | `label`, `reply` | `labelPublic`, `replyPublic` |
| Wiedereinstieg | `text` | `textPublic` |

Beispiel: `"text": "Online, über die Ausbildungsseite von {firma}. …"` ·
`"textPublic": "Du bewirbst dich direkt bei den Betrieben, meistens online. …"`
— die neutrale Fassung erklärt allgemein, wie es läuft, ohne auf eine Seite
zu verweisen.

**Alle anderen Texte** bekommen kein Public-Feld; sie dürfen dann auch nichts
enthalten, was den Betrieb kenntlich macht. Die Link-Frage braucht keine
neutrale Fassung — sie entfällt in `?public` ganz.

**`firmenbegriffe`** ist die Liste der Wörter, die nur die Firmenfassung
nennen darf: Standort, eigene Bezeichnungen (z. B. „Ausbildungswerkstatt
Erlangen"). Der Firmenname zählt automatisch dazu. Die Liste kommt aus dem
Faktenblatt; Claude ergänzt jeden Firmenbegriff, den es selbst verwendet. Die
Liste darf leer sein. Produkt- und Programmnamen stehen nicht darin — die
kommen nach A7 gar nicht vor.

## A10. Verbote (hart)

1. **Nichts, was sich schnell ändert:** keine Vergütung oder Gehälter, keine
   Urlaubstage, Zusatzleistungen, Übernahmequoten, Termine, Fristen,
   Jahrgänge oder Veranstaltungen. Ziel der Karte ist Berufsorientierung. Wo
   Veränderliches gefragt ist, verweist die **Firmenfassung** auf die
   Ausbildungsseite („steht auf der Ausbildungsseite"); die neutrale Fassung
   erklärt allgemein, ohne Verweis.
2. **Keine Werbung.** Keine Aufforderung zur Bewerbung, kein Anpreisen des
   Betriebs, keine Superlative. Die Figur informiert über den Beruf.
3. **Keine erfundenen Fakten** (A1).
4. **Keine realen Personen**, auch nicht die Ansprechpartner aus der
   Ausschreibung.
5. **Keine Speicherung, kein Merken, keine Zählung** im Dialog („Soll ich dir
   das merken?").
6. **Keine Frage ohne unbedenkliche Antwort.** „Weiß ich noch nicht" ist immer
   dabei und hat nie einen Nachteil.
7. **Keine personenbezogene Abfrage** — kein Alter, keine Klassenstufe, kein
   Name, keine Schule.
8. **Kein ausgeschriebener Firmenname** — nur `{firma}` (A9).
9. **Keine Eigennamen aus dem Betrieb** — keine Produkt-, Programm- oder
   Abteilungsnamen, keine Abkürzungen (A7).

## A11. Ausgabekontrakt

Ausgabe ist ein JSON-Objekt mit genau diesen Feldern, danach der Prüfbericht
(siehe Aufrufmuster). Kein Fließtext vor dem JSON.

```jsonc
{
  "persona": { "name": "…", "lehrjahr": 2, "haltung": "…" },
  "firmenbegriffe": ["…"],
  "themen": [ /* fest, siehe A3 */ ],
  "initial": ["was", "koennen", "jetzt_tun", "ende"],

  "greeting": { "tag": "winken", "text": "… bei {firma} …", "textPublic": "… hier …" },

  "asks": [
    { "id": "neigung", "trigger": { "afterAnswers": 1 }, "tag": "denken",
      "prompt": "…",
      "options": [
        { "label": "…", "sets": { "neigung": "menschen" }, "unlocks": ["reden"], "tag": "…", "reply": "…" },
        { "label": "…", "sets": { "neigung": "maschinen" }, "unlocks": ["technik"], "tag": "…", "reply": "…" },
        { "label": "Weiß ich noch nicht", "sets": { "neigung": "unbekannt" }, "tag": "…", "reply": "…" }
      ] },
    { "id": "quiz", "trigger": { "afterAnswers": 3 }, "tag": "denken", "prompt": "…", "options": [ /* 3 Schätzungen + „Keine Ahnung" */ ] },
    { "id": "fazit", "trigger": { "onExit": true }, "tag": "denken", "prompt": "…",
      "options": [ { "label": "…", "unlocks": ["praktikum_wie"], "tag": "…", "reply": "…" }, /* 2 weitere */ ] }
  ],

  "reentry": { "rules": [
    { "ifVisit": 4, "tag": "…", "text": "…" },
    { "ifVisit": 3, "tag": "…", "text": "…" },
    { "tag": "…", "text": "…" }
  ] },

  "questions": [
    { "id": "was", "thema": "alltag", "label": "…", "tag": "erklaeren", "text": "…",
      "unlocks": ["tag_ablauf", "purpose"] },
    { "id": "reden", "thema": "alltag", "label": "…", "tag": "erklaeren",
      "requires": { "neigung": ["menschen"] }, "text": "…" },
    { "id": "link", "thema": "wege", "label": "…", "tag": "zeigen",
      "link": true, "branded": true, "url": "https://…", "text": "…" },
    { "id": "ende", "label": "…", "tag": "winken", "end": true, "text": "…" }
  ]
}
```

Feldregeln:

- `tag` stammt aus dem geschlossenen Vokabular — identisch mit den Namen der
  Posenbibliothek: `neutral` · `winken` · `erklaeren` · `denken` ·
  `bestaetigen` · `halten` · `schulterzucken` · `stolz` · `erschoepft` ·
  `zeigen` · `zweihaendig`. Pflicht bei Begrüßung, jeder Frage, jeder
  Rückfrage, jeder Option und jeder Wiedereinstiegs-Regel.
- `unlocks` und `requires` zeigen nur auf existierende IDs.
- **Kein Feld `quelle`** und keine weiteren Felder außer den hier genannten.

---

# Teil B — Faktenblatt (Eingabe)

Wird aus den Inhalten der Erhebung gefüllt (Liste:
`Kunde/DETAR_Erhebung_Inhalte.md` im Projektordner; **wie** die Inhalte
eingeholt werden, wird mit Studio2B abgestimmt) oder aus einer öffentlichen
Ausschreibung übernommen. **Ohne dieses Blatt wird nicht generiert.**

```
BERUF
  Offizielle Bezeichnung:
  Betrieb (Name, wird nur als {firma} verwendet) und Standort (Ort reicht):
  Dauer der Ausbildung:

FIRMENBEGRIFFE (nur Firmenfassung)
  Standort, eigene Bezeichnungen, die die Figur nennen darf
  (z. B. „Ausbildungswerkstatt Erlangen") — keine Produkt- oder Programmnamen

TÄTIGKEITEN (in Alltagssprache, 3–5 Stichpunkte)
  – was wird konkret gemacht
  – womit (Werkzeuge, Geräte, Materialien)
  – wo (Halle, Baustelle, Büro, draußen)

EIN ARBEITSTAG
  Beginn, grober Ablauf, Feierabend

BERUFSSCHULE
  Wie oft (Tage pro Woche oder Block), was dort gelernt wird

VORAUSSETZUNGEN
  Schulabschluss:
  wichtige Fächer:
  Eigenschaften, die wirklich zählen:

ZAHLEN (mindestens zwei, werden wörtlich genannt — nur solche, die lange gelten)
  z. B. Stückzahlen, Größen, Entfernungen, Gewichte, Temperaturen
  NICHT: Vergütung, Urlaubstage, Zusatzleistungen, Übernahmequoten

MATERIAL FÜR DIE SCHÄTZFRAGE (mindestens eins)
  – eine Zahl, die Leute beeindruckt (Stück, Meter, Kilo, Grad …)
  – eine Tätigkeit, die man dem Beruf fälschlich zuschreibt
  – wohin das Ergebnis der Arbeit geht (Orte, Abnehmer)
  – der Gegenstand, den man am häufigsten in der Hand hat

ACHSE (aus dem Interview)
  Wo antworten zwei Leute im Beruf verschieden, was sie mögen?
  Beide Anteile mit je einem konkreten Beispiel — oder „keine Achse".

PURPOSE
  Wer profitiert von der Arbeit? Was passiert, wenn sie nicht gemacht wird?

HARTE SEITE (Pflichtfeld)
  Was ist anstrengend, langweilig oder unbequem?

DANACH
  Abschluss, typische nächste Schritte im Beruf (Weiterbildung, Einsatzbereiche)

PRAKTIKUM
  Möglich ab welcher Klasse (falls bekannt), an wen man sich wendet (Funktion)

LINK
  URL der Ausbildungs- oder Berufsseite

NICHT ANFRAGEN
  Vergütung, Leistungen, Übernahme, Bewerbungsfristen, Starttermine,
  Kontaktpersonen, Kampagnen, Produktnamen — diese Angaben gehören nicht in
  den Dialog und veralten.
```

---

# Teil C — Prüfliste

Läuft zweimal: einmal von Claude direkt nach der Generierung (als Prüfbericht),
einmal von der Person, die korrigiert.

## C1. Maschinell — Prüfseite

**Aufruf ohne Terminal:**

- Am Rechner: `Start-Dev-Server.command` doppelklicken, dann
  `http://localhost:8743/tools/kartenpruefung.html` öffnen.
- Oder auf dem Testlink: `https://l77d.github.io/v2tracker/tools/kartenpruefung.html`
  (sobald dieser Stand auf `main` liegt).

Die Seite prüft eine Karte aus dem Repo (Auswahl oben, `?k=<id>`) oder einen
eingefügten Dialogteil (Ausgabe von Claude, Firmenname daneben eintragen). Sie
meldet **Fehler** (müssen weg) und **Hinweise** (ansehen), zeigt die
**Lesefassung** beider Fassungen (der komplette Dialog am Stück) und für jeden
Text die Seitenzahl in beiden Fassungen.

Geprüft wird:

- [ ] Pflichtfelder `persona` (name, lehrjahr, haltung), `themen`, `initial`,
      `greeting`, `asks`, `questions`, `reentry`.
- [ ] Themen exakt wie A3; alle Pflichtfragen da, im richtigen Thema.
- [ ] `initial` exakt wie A4; Freischaltungen der Pflichtfragen wie A4,
      darüber hinaus nur zu Zusatzfragen; höchstens zwei Zusatzfragen.
- [ ] Keine unbekannte ID in `unlocks`; jede Frage ist erreichbar.
- [ ] `link` mit `link`, `branded`, `url`; `ende` mit `end`, ohne Thema.
- [ ] Steuernde Rückfrage (falls vorhanden): `afterAnswers: 1`, eine Variable,
      drei Optionen, genau einmal `unbekannt` ohne Freischaltung, je Pol genau
      eine Zweigfrage mit passendem `requires`.
- [ ] Schätzfrage: `afterAnswers: 3`, vier Optionen (genau eine „Keine
      Ahnung"), setzt und schaltet nichts
      (fehlt sie → Hinweis, Begründung nötig).
- [ ] Abschiedsfrage: `onExit`, drei Optionen, eine schaltet `praktikum_wie`
      frei.
- [ ] Wiedereinstieg: letzte Regel ohne Bedingung (weniger als drei → Hinweis).
- [ ] Jeder `tag` aus dem Vokabular; Auszeichnung nur aus A8, geschlossen,
      nicht verschachtelt.
- [ ] `firmenbegriffe` vorhanden (Liste, darf leer sein).
- [ ] `{firma}` höchstens zweimal; jeder Text mit `{firma}` hat eine neutrale
      Fassung; der Firmenname steht nirgends ausgeschrieben.
- [ ] Was die neutrale Fassung zeigt (gemeinsame Texte und `…Public`), enthält
      kein `{firma}`, keinen Firmenbegriff und keinen Verweis auf eine Seite
      des Betriebs („Seite"/„Link" → Hinweis).
- [ ] Kein Geld, kein Gehalt (Fehler); Urlaub, Übernahme, Leistungen, Fristen
      → Hinweis zum Nachlesen.
- [ ] Mindestens drei Fragen je Thema, in beiden Fassungen (ohne Zweige).
- [ ] Kein Text länger als zwei Seiten, in beiden Fassungen (zwei Seiten →
      Hinweis, Ziel ist eine; `[Annahme]` zählt nicht mit).
- [ ] Alle `[Annahme]`-Marken werden als Hinweis aufgelistet.

## C2. Inhaltlich — liest ein Mensch

**Pflicht vor der Freigabe:** die **Lesefassung neutral** auf der Prüfseite
einmal ganz lesen — so sieht die Schule die Karte. Verrät irgendetwas den
Betrieb? Verweist etwas auf eine Seite, die es dort nicht gibt?

- [ ] Kommt ein Datum, eine Frist oder ein Jahrgang vor?
- [ ] Steht irgendwo ein Urteil darüber, ob der Beruf zum Nutzer passt?
- [ ] Kommen beide Pole der Achse im Beruf in vergleichbarer Größe vor, oder
      klingt eine Reaktion wie eine Rechtfertigung?
- [ ] Nennt jede Reaktion der Schätzfrage die richtige Antwort — ohne
      Kommentar zur falschen Schätzung?
- [ ] Nimmt die Abschiedsfrage alle drei Antworten gleichwertig an?
- [ ] Gibt es einen Satz, den ein Achtklässler nicht einem Freund nacherzählen
      könnte? Ein Fachwort ohne Erklärung im selben Satz?
- [ ] Hat jede Antwort eine konkrete Angabe?
- [ ] Ist die harte Seite ehrlich benannt oder weichgezeichnet?
- [ ] Klingt eine Zeile nach Werbung, Broschüre oder Personalabteilung?
- [ ] Ich-Form und Präsens durchgehend? Klingt alles nach **einer** Person
      (`persona.haltung`)?
- [ ] Liest sich die neutrale Fassung natürlich, ohne Lücke, wo der Betrieb
      stand — und sagt sie inhaltlich dasselbe wie die Firmenfassung?
- [ ] Steht Betriebseigenes als eigene Erfahrung der Figur da, nicht als Regel
      des Berufs?
- [ ] Gibt es ein Wort aus dem Betrieb, das eine Schülerin nicht kennt
      (Produkt-, Programmname, Abkürzung)?
- [ ] Ist jede prüfbare Aussage durch Faktenblatt oder Interview gedeckt?

## C3. Freigabe beim Betrieb

Vorher: keine `[Annahme]` mehr im Dialog — jede ist bestätigt oder ersetzt.

Zweispaltig vorlegen:

- **Fachaussage** — der Betrieb prüft, ob es stimmt.
- **Formulierung** — bleibt bei uns. Korrekturwünsche an der Sprache werden als
  Fachhinweis aufgenommen und von uns umgesetzt, nicht wörtlich übernommen.

Ohne diese Trennung stehen nach der zweiten Runde wieder „Betriebsmittel" und
„Schutzmaßnahmen" im Dialog.

---

# Einbau

1. Ordner `karten/<id>/` anlegen (Vorlage: `karten/elektroniker-siemens/`),
   Kopfdaten in `karte.json` setzen: `format`, `id`, `profession`, `company`,
   `companyLogo`, `companyNeutral`, `idleReturnMs`, `figur`, `designs`,
   `vorschau`.
2. Den geprüften Dialogteil einsetzen (ersetzt `persona`, `firmenbegriffe`,
   `themen`, `initial`, `greeting`, `asks`, `questions`, `reentry`).
3. Karte in `karten/katalog.json` eintragen. Kartenbilder fürs Tracking:
   `docs/kartendesigns.md`.
4. Prüfseite mit `?k=<id>` laufen lassen — keine Fehler.
5. Am Handy durchspielen, Firmenfassung und `?public`.

---

# Aufrufmuster

> Du erzeugst einen DETAR-Kartendialog. Halte dich ausschließlich an das
> Regelwerk `docs/dialog-regelwerk.md`, an das folgende Faktenblatt und an die
> Interview-Abschrift. Vorbild ist `karten/elektroniker-siemens/karte.json`.
> Erfinde keine Fakten; wo du ohne Quelle einen Platzhalter setzt, markiere
> ihn mit [Annahme] (A1). Schreib zuerst die Firmenfassung und ergänze dann je
> Text die neutrale Fassung, wo A9 sie verlangt. Gib zuerst nur das JSON des Dialogteils aus
> (Ausgabekontrakt A11). Danach folgt ein **Prüfbericht** mit drei Teilen:
> (1) jede Angabe, die gefehlt hat, und wie du damit umgegangen bist;
> (2) die gewählte Achse und die Art der Schätzfrage mit kurzer Begründung —
> bzw. die Begründung, warum eine davon entfällt; (3) jeder Punkt aus C1 und
> C2, den du nicht erfüllen konntest.
>
> [Faktenblatt hier einfügen]
>
> [Interview-Abschrift hier einfügen]
