# Manuelle Prüfschritte (Stand Build 110, 2026-10-15)

Was `node --test 'tests/*.test.mjs'` und `node tools/browser-check.mjs` nicht
abdecken: Kamera, 8th-Wall-Engine, Gyro, Audio, CSS-Animationen und die echte
Font-Messung. Nach jedem Umbau am Handy durchgehen (iPhone Safari und Android
Chrome, gedruckte Karte P04). Erwartung = Verhalten von Build 110.

## 1. Normaler Ablauf (`?k=000`)
1. Splash: „Du scannst · Elektroniker*in für Betriebstechnik · bei · Siemens“ als Text (kein Logo). Knopf „Scan starten“ wird erst aktiv, wenn der Font geladen ist. Mit `?tracker=…` steht die Marke oben rechts.
2. „Scan starten“: Klick-Ton. NUR die Kamera-Abfrage — keine Frage nach „Bewegung und Ausrichtung“ mehr (seit Build 113; Test mit einem Gerät ohne gespeicherte Erlaubnis, z. B. Safari-Website-Daten für l77d.github.io löschen). Splash weg, Kamerabild, weiße Rahmen-Ecken, Panel unten „Halte auf die Karte“ als Laola-Welle, Handy-Icon mit offenem Mund schaut links/rechts. Bei „Ohne Kamera geht's nicht“ steht unten klein die Technik-Zeile (Fehler, iOS, Browser, Gyro) — Screenshot davon.
3. Karte ins Bild: Rahmen sofort weg, Ping, vier gelbe Eck-Marker wabern auf den Kartenecken, Panel „Karte gefunden / → Tipp sie an!“, Icon springt links aus dem Panel und hüpft in 3D auf der Kartenmitte mit flachem Schatten.
4. Tap auf die Karte: Swoosh, Marker ploppen und bleiben still auf den Ecken, Pop-Ton, Figur dreht sich zweimal und ploppt mit Überschwinger auf.
5. Begrüßung: Anfangston „bi-ip“, Text tippt lautlos (28 ms/Zeichen), `<welle>`-Wort steht still. Blase billboardet zur Kamera (Drehung und Neigung bis 70°).
6. Chime, Menü fährt in 1 s ein: „Was interessiert dich?“, drei Themenkacheln (Reiter THEMA, NEU wo etwas wartet, ±2,34° Tilt) + „Ich muss weiter“.
7. Thema öffnen: Kopfzeile mit Zurück-Pfeil (NEU-Punkt, wenn woanders etwas Neues liegt), Karussell 2×2, Seitenpunkte folgen dem Wischen.
8. Erste Antwort: Figur dreht sich zur Kamera, Kopf folgt der Kamera, Pose nach Tag. Nach 2 s Umschauen am Platz (kein Gehen). Weiter-Kachel, dann Rückfrage „neigung“ mit drei Optionen; danach Zweigfrage (reden/technik) mit NEU.
9. Nach der dritten Antwort: Schätzfrage mit vier Optionen (2×2).
10. Lange Antwort: Seiten mit Weiter-Kachel, kein Zähler „1/2“. Tap auf die Blase während des Tippens zeigt den Rest sofort; Tap danach = Weiter.
11. 16 s ohne Eingabe: Blase weg, Figur geht frei umher, bleibt mit den Füßen ganz auf der Karte.
12. Tap auf die Figur: Hüpfer zur Kartenmitte, Pose kurz „talk“-Gesicht.
13. „Ich muss weiter“: Fazit-Rückfrage → Abschiedszeile → nach 0,9 s klappt die Figur ein, Marker bleiben, Panel „Tipp auf die Karte“ pulsiert.
14. Tap auf die Karte: Wiedereinstieg mit beiläufiger Zeile (ab dem 3./4. Besuch andere Zeilen), Hub im alten Zustand, „Ich muss weiter“ wieder ohne Haken.
15. Noch einmal „Ich muss weiter“ und SOFORT beim Einklappen auf „Tipp auf die Karte“ tippen: Figur ploppt wieder auf (bis Build 111 blieb sie unsichtbar).

## 2. Link-Frage
Antwort „bewerbung“ schaltet „Zeig mir die Seite“ (Reiter LINK) frei. Antwort → Kachel „Seite öffnen“ → neuer Tab (kein Popup-Blocker), zurück im Hub. Ist der Link die 1. oder 3. Antwort, stellt die Figur danach ihre Rückfrage (seit Build 112).

## 3. Tracking-Verlust
- Karte verdecken: Szene blendet in 300 ms aus (8lerp sofort). Unter 1,5 s zurück: kein Rahmen, Szene blendet ein und gleitet (kein Sprung).
- Ab 1,5 s: Menü eingefroren (Taps ohne Wirkung, nicht gedimmt), Suchrahmen + „Halte auf die Karte“ oben mit 300-ms-Einblendung. Im Ruhezustand steht der Text stattdessen in der Panel-Zeile.
- Karte weg (Ruhezustand oder „Karte gefunden“): Tap auf die Stelle, wo die Karte war, tut nichts — kein Pop-Ton (seit Build 112).
- Wiederfinden: Rahmen und Hinweis sofort weg, Menü bedienbar.

## 4. Editionen und Testdrucke
- `?k=000P`: Splash ohne „bei“ und Firma; Begrüßung ohne „Siemens“; keine Link-Frage; `?stats` zeigt „PUBLIC“.
- `?karte=p07`: lädt Karte 000 mit Design p07 (Firma).

## 5. Fehlerpfade
- Ohne `?k`: Auffang-Seite „Scanne deine Karte“. `?k=999`, `?design=nope`, `?karte=xyz`: Fehlerzeile im Splash, Knopf aus.
- `?preflight=inapp|nocam|insecure|nowasm|nowebp`: Hinweis-Bildschirm, Link-Feld ohne `preflight`, „Link kopieren“ → „Kopiert!“ (1,8 s). `?preflight=aus` überspringt.
- Kamera abgelehnt: Bildschirm „Ohne Kamera geht's nicht“ mit „Neu laden“. Kamera-Ausfall nach dem Start: Zeile „Kamera unterbrochen / → Seite neu laden“.
- Alter Browser ohne `?.`: Inline-Hinweis (nur auf echtem Altgerät prüfbar).

## 6. Werkzeuge
- `?stats`: Panel oben links (Build-Prüfung „aktuell“/„neu laden!“, Engine-Variante, Design, Karte, Tracker, Flip-Zeile), 📊 blendet aus (bleibt nach Neuladen), „Messung 10 s“ → Kopieren/Log.
- `?dev`: Zahnrad, Regler wirken sofort (Schrift → Blase neu, Einfahrzeit → CSS), Presets/Export, Replay (Rahmen 600 ms, dann Aktivierung neu). Mit `?tracker=` sitzt die Marke unter dem Dev-Knopf.
- `?desktop`: Handy-Rahmen mit Format-Wahl, nach 1,2 s simulierter Scan, Karte als Bodenfläche, Maus-Orbit.
- `?nosimd` → ?stats „nicht-SIMD (?nosimd)“; `?nogyro` → Flip-Zeile „(Bildschirm)“; `?gyrofrage` → iOS fragt „Bewegung und Ausrichtung“, danach erst die Kamera, Flip-Zeile „(Gyro)“; `?tracker=xyz` → Marke „xyz? → 8lerp“.

## 7. Pose-Flip ohne Gyro (Build 113)
- `?k=000&stats`: Flip-Zeile zeigt „roh ok (Bildschirm)“ (iPhone) bzw. „(Gyro)“ (Android ohne Abfrage).
- Karte auf dem Tisch, Handy schräg 30–60° von oben, auch fern/flach (Fehlerbild aus `docs/8thwall-migration.md` 9 herbeiführen): Figur steht aufrecht, Blasentext lesbar; bei gespiegelter Engine-Pose „GESPIEGELT→korrigiert“. `?dev` Toggle 10 aus → Figur kippt in die Tischebene (Signatur 2θ) = Prior war aktiv.
- Karte in der Hand, frontal bis schräg (Oberkante weiter weg als Unterkante): aufrecht.
- Bekannte Grenze, kein Fehler: Karte senkrecht an die Wand halten und von OBEN filmen (Oberkante näher als Unterkante) → Figur kippt; das täte der Gyro-Schiedsrichter genauso.
- `karten.html`: Kachel je Karte × Fassung × Design mit QR; Häkchen stats/nosimd ändern Links. `tools/kartenpruefung.html`: Karte 000 „keine Fehler · 2 Hinweise“, Seiten am echten Font.
