---
name: detar-dialog
description: Erzeugt den Dialog der Figur auf einer DETAR-Karte (dialog.json) aus Quellen zu einem Ausbildungsberuf oder dualen Studium — Faktenblatt, Dialog nach Regelwerk, Selbstprüfung mit Prüfprogramm, Prüfbericht, Lesefassung und Abgabe nach der Abnahme beim Betrieb. Verwenden, sobald ein DETAR-Kartendialog erstellt, überarbeitet oder abgegeben werden soll.
---

# DETAR-Kartendialog

{{STAND}}

Dieser Skill erzeugt den Dialog, den die Figur auf einer DETAR-Karte führt.
Verbindlich ist das Regelwerk: **Lies `references/dialog-regelwerk.md` vollständig,
bevor du anfängst.** Bei Widerspruch zwischen dieser Anleitung, dem Vorbild und
dem Regelwerk gilt das Regelwerk.

## Dateien im Skill

| Datei | Wofür |
|---|---|
| `references/dialog-regelwerk.md` | Regeln für Faktenblatt (Teil B), Dialog (Teil A), Prüfung (Teil C) und Abgabe |
| `references/dialog-quellen.md` | welche Inhalte eine Karte braucht und woher sie kommen |
| `references/vorbild-dialog.json` | ein vollständiger Dialog als Muster für Aufbau und Ton |
| `scripts/tools/dialogpruefung.mjs` | Prüfprogramm (Regelwerk C1); braucht Node 18 oder neuer |

Prüfe zu Beginn mit `node --version`, ob Node läuft. Ohne Node kannst du nicht
selbst prüfen — sag das der Person sofort und nenne als Ausweg die Prüfseite
der App (Regelwerk C1).

## Ablauf

### 1. Quellen sichten

- Lies alle bereitgestellten Quellen: Ausschreibung, Briefing,
  Gesprächsabschrift, Fotos. `references/dialog-quellen.md` sagt, was gebraucht wird.
- Kläre den **Firmennamen**: die Form für `{firma}` und alle weiteren Formen
  (Kurzform, Konzernname, mit Rechtsform) für die Prüfung (Regelwerk A9). Und
  ob es um eine Ausbildung oder ein duales Studium geht.
- Fehlt Wesentliches — vor allem eine Gesprächsabschrift, die harte Seite oder
  Material für die Schätzfrage —, sag es der Person, bevor du schreibst. Sie
  entscheidet, ob nachgeliefert oder mit `[Annahme]` weitergearbeitet wird.
  Kommt keine Antwort, arbeite mit `[Annahme]` weiter und vermerke das im
  Prüfbericht.

### 2. Faktenblatt

Erstelle `faktenblatt.md` nach Regelwerk Teil B: Quellen nummerieren, jede
Angabe mit Quellenmarke, Lücken als „fehlt“, nichts erfinden, nichts
Veränderliches übernehmen.

### 3. Dialog

Schreibe `dialog.json` nach Regelwerk Teil A, mit dem Vorbild als Muster.

- Erst die Firmenfassung, dann für jeden Text mit Firmenbezug die neutrale
  Fassung (`…Public`, A9).
- Raster, IDs, Themen, `initial` und Freischaltungen genau wie in A3 und A4.
- Die Persona ist vorläufig (A2).
- Die Datei enthält nur die Felder aus A11 — keine Kommentare, keine
  Notizfelder.

### 4. Prüfen und korrigieren

```
node <skill>/scripts/tools/dialogpruefung.mjs dialog.json --firma "<Form für {firma}>" --firma "<weitere Form>" … --lesefassung lesefassung.md
```

- Korrigiere und prüfe erneut, bis **keine Fehler** mehr gemeldet werden.
- Hinweise: beheben oder im Prüfbericht begründen. Texte mit zwei Seiten
  möglichst kürzen (Ziel eine Seite).
- Geh danach die inhaltlichen Punkte aus C2 selbst durch — anhand der
  Lesefassung, dort steht der Firmenname eingesetzt — und überarbeite, was
  nicht besteht.

### 5. Prüfbericht und Übergabe zum Lesen

- Schreibe `pruefbericht.md` nach Regelwerk Teil C (vier Teile).
- Gib der Person vier Dateien: `dialog.json` (Entwurf), `faktenblatt.md`,
  `pruefbericht.md`, `lesefassung.md`. Sag in zwei, drei Sätzen, wie viele
  `[Annahme]` offen sind und welche Fragen an den Betrieb gehen.
- Ein Mensch liest die neutrale Lesefassung ganz (C2), danach geht der Dialog
  zur Abnahme an den Betrieb (C3).

### 6. Korrekturen und Abnahme

- Korrekturen des Betriebs: Fachaussagen sinngemäß übernehmen, Formulierung
  nach dem Regelwerk (C3) — nicht wörtlich.
- Neue Angaben ins Faktenblatt mit eigener Quellenmarke
  (`[Q5] Abnahme durch den Betrieb am …`).
- Jede `[Annahme]` ist bestätigt (Marke löschen) oder ersetzt.
- Prüfen mit `--final`, bis keine Fehler mehr gemeldet werden.

### 7. Abgabe

Abgegeben werden `dialog.json`, `faktenblatt.md` und, falls mitgeliefert, das
Logo des Betriebs (Regelwerk „Abgabe“). Prüfbericht und Lesefassung bleiben bei
der Redaktion.
