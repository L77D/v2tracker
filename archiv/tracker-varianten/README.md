# Archiv: Tracker-Varianten alt / neu / 8roh (Stand Build 110, 2026-10-15)

Bis Build 110 lagen vier Tracking-Filter parallel im Live-Code (`js/trackerWahl.js`,
`?tracker=<name>`). Seit Build 110 ist **8lerp** Standard; Michael hat am
2026-10-15 entschieden, die drei anderen aus dem Live-Code zu nehmen und hier
zu archivieren (für die Übergabe an die Produktion wird später separat
aufgeräumt). Die Dateien sind unverändert der Stand von Build 110:

| Datei | Variante | Was es war |
|---|---|---|
| `js/poseStabilizer.js` | `alt` | Zapworks-Port (One-Euro + SLERP + Dead-Zones + Median-Aufsetzen + Gyro-Brücke + Scale-Lock), Standard bis Build 109, Monate Gerätetests, Goldstandard |
| `js/tracker.js` | `neu` | messgetriebener Nachfolger (Build 91), nur Szenario-Tests |
| `js/tracker8roh.js` | `8roh` | Nulllinie (Build 93): jede Messung 1:1, kein Filter |
| `tests/poseStabilizer.test.mjs` + `tests/fixtures/poseStabilizer.golden.json` | alt | Goldstandard-Test (Szenario `tests/stabilizerSzenario.mjs` im Live-Repo) |
| `tests/tracker.test.mjs` | alle | Vergleichsszenario alt/neu/8roh/8lerp mit Kennzahlen + Einzelprüfungen `neu` (die 8lerp-Einzelprüfungen daraus leben weiter in `tests/tracker8lerp.test.mjs`) |
| `tests/tracker8roh.test.mjs` | 8roh | Einzelprüfungen |
| `tracker-vergleich.html` | – | QR-Seite für den Gerätevergleich (vier Varianten mit `?stats`) |

Im Live-Code geblieben: `js/tracker8lerp.js`, `js/trackerWahl.js` (Vertrag +
Bauweg, nur noch ein Eintrag), `js/poseArbiter.js` (Schwerkraft-Schiedsrichter,
den 8lerp nutzt), `tests/stabilizerSzenario.mjs` (Szenario, jetzt Grundlage des
8lerp-Goldstandards). Die Dev-Panel-Schalter 2 (normalize) und 9 (scaleLock)
sowie die STAB-Werte, die nur `alt`/`neu` lasen, sind mit Build 111 aus
`config.js` entfernt (Liste im Commit).

**Reaktivieren:** Datei nach `js/` zurückkopieren, in `TRACKER_VARIANTEN`
(`js/trackerWahl.js`) eintragen, die passenden STAB-Werte in `config.js`
wiederherstellen (Stand Build 110: `git show 9f771c6:js/config.js`), Tests
zurück nach `tests/`. Die Klassen halten den Vertrag aus dem Kopf von
`trackerWahl.js` (`constructor(target, gyro)` + `measure(matrix)` oder
`constructor(source, target, gyro)`, `onFound/onLost/reacquire/tick/snapshot`).
Der Lokal-Prototyp (`tools/build-lokal-prototyp.py`) sammelt nur `js/`,
dieser Ordner wird nicht eingebettet.
