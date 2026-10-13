# DETAR — Karte einbauen

Stand 13.10.2026. Wie eine Karte aus `dialog.json` und Faktenblatt in die App
kommt. Bis 13.10.2026 Abschnitt „Einbau“ in `docs/dialog-regelwerk.md`; das
Regelwerk endet seitdem mit der Abgabe von `dialog.json` und Faktenblatt.

## Ablauf

Eine Karte besteht aus zwei Dateien (seit Build 72, 2026-10-08): `daten.json`
(Kartendaten) und `dialog.json` (Dialog). Produktionskarten heißen nach ihrer
Nummer: `karten/001/`, Aufruf `?k=001`.

1. Ordner `karten/<nr>/` anlegen (Vorlage: `Vorlagen/_Karte/Export/NNN/` im
   Projektordner) und `daten.json` setzen — nur diese Felder:

   | Feld | Inhalt |
   |---|---|
   | `format` | 2 |
   | `id` | Kartennummer, dreistellig (`"001"`) |
   | `profession` | Beruf oder Studiengang, Schreibweise Regelwerk A7, z. B. „Elektroniker*in für Betriebstechnik" oder „Elektro- und Informationstechnik – duales Studium" |
   | `company` | Firmenname (für `{firma}` und den Splash) |
   | `companyLogo` | `logo.webp` (fehlt in der Public-Fassung automatisch) |
   | `companyNeutral` | „der Betrieb" (Notnagel, falls `{firma}` in der Public-Fassung steht) |
   | `idleReturnMs` | Haltezeit nach einem Text, Standard 8000 |
   | `vorschau` | `vorschau.jpg` (Kartenbild für `?desktop`) |
   | `figur` | `posen` (Pose → Bild, `idle` Pflicht), `kopf`, `gesicht` (`neutral`, `blink`, `talk`) |
   | `designs` | je Fassung ein Erkennungsbild: `id`, `fassung` (`firma`/`public`), `name`, `target`, `breiteMm` (63), `qr` (nur Testdrucke: Link wie im gedruckten QR-Code), `notiz` |

   - Pfade gelten relativ zum Kartenordner `karten/<nr>/`.
   - `?k=<nr>` nimmt das erste Design mit `"fassung": "firma"`, `?k=<nr>P` das
     erste mit `"fassung": "public"` (Karte ohne Logo). Seriennummern gehören
     nicht hierher — sie sind nur intern vermerkt (Projektordner).
   - Figur: Die Ebenen kommen direkt aus dem Grafikprogramm in `figur/` — WebP
     mit Transparenz, alle Ebenen auf derselben Fläche 768 × 1152 px
     (Halsgelenk ~36 % von oben, Fußpunkt ~98 %). Exportnamen: `body_idle`
     (Pflicht), `body_<tag>` je weitere Pose (Tag-Namen aus A11), `head`,
     `face_neutral`, `face_blink`, `face_talk`. Ungenutzte Posen aus `posen`
     streichen.
2. Den geprüften Dialogteil als `dialog.json` daneben legen (`art`, `persona`,
   `firmenbegriffe`, `themen`, `initial`, `greeting`, `asks`, `questions`,
   `reentry`).
3. Karte in `karten/katalog.json` eintragen. Kartenbilder fürs Tracking:
   `docs/kartendesigns.md`.
4. Prüfseite mit `?k=<id>` laufen lassen — keine Fehler.
5. Am Handy durchspielen, Firmenfassung (`?k=<nr>`) und Public-Fassung (`?k=<nr>P`).
