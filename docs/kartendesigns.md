# Kartendesigns (`?design=<id>`, seit Build 57; neue Struktur seit Build 63)

Ein **Design** ist ein Kartenbild derselben Karte: Dialog und Figur bleiben
gleich, nur das Bild, das die Kamera erkennt, wechselt. So lassen sich
mehrere gedruckte Varianten nebeneinander testen — kein Branch pro Design,
`main` bleibt unberührt. (Bis Build 62: `targets/8thwall/karten.json` und
`?karte=<id>`; beides gibt es nicht mehr.)

**Testdrucke (Build 80):** Die 35 Motive mit QR-Code aus Figma DETAR, Seite
PRINT, Section „Druck MeinSpiel 63x88" (Knoten 646:364) sind die Designs
`p01`–`p35` der Karte 000 (alle Firmenfassung: FIRMA-Platzhalter auf jedem
Motiv). Ihre gedruckten QR-Codes nutzen eine eigene Link-Grammatik,
`l77d.github.io/v2tracker/?karte=p01` — sie steht unverändert im Feld `qr`
des Designs, `karten.html` zeigt sie so, und der Kartenlader löst
`?karte=<design>` auf (Karte = die aktive Karte mit diesem Design, Fassung =
`fassung` des Designs). Export: Rahmen 815 × 1110 px (69 × 94 mm) ohne die
3 mm Beschnitt (35,5 px je Seite) in 2× → 1488 × 2078 px.

- **Liste:** `daten.json → designs` im Kartenordner, z. B.
  `karten/000/daten.json`. Je Eintrag: `id` (steht in der
  URL), `name` (Anzeigename), `target` (Pfad relativ zum Kartenordner, z. B.
  `targets/tarn.json`), `breiteMm` (physische Kartenbreite), `notiz` (frei).
- **Dateien:** `karten/<karte>/targets/<id>.json` + `<id>_luminance.png`. Das
  Luminanzbild wird neben der JSON gesucht (`resources.luminanceImage`).
- **Aufruf:** `index.html?k=<karte>&design=<id>`. Ohne `&design` gilt das
  **erste** Design der Liste (heute `card`) — gedruckte QR-Codes brauchen den
  Parameter also nicht. Unbekannte id → Hinweis in der Fehlerzeile des Splash
  („Unbekanntes Design … — bekannt: …"), der Start-Button bleibt aus.
- **Breite:** `physicalWidthInMeters` = `breiteMm / 1000` (Standard 63 mm
  laut Druckspezifikation). `SCENE.cardWidth` in `config.js` bleibt die
  Szenen-Einheit (worldRoot-Skalierung) und ist davon getrennt.
  `SCENE.cardAspect` gilt für alle Designs gemeinsam — betrifft nur Eck-Marker,
  Tap-Fläche und Desktop-Plane, nicht das Tracking.
- **`?stats`** zeigt die Zeile `Design: <id> · targets/<id>.json · <breiteMm> mm`;
  die Kopierzeile von „Messung 10 s" hat eine Spalte `design`.
- **`karten.html`** — Übersicht: liest `karten/katalog.json` und je Karte die
  `daten.json`, zeigt je Karte × Fassung × Design Name, Link und QR-Code (Häkchen für
  `stats`, `nosimd`). Beim Standard-Design der Fassung steht nur `?k=<karte>`
  bzw. `?k=<karte>P` im Link, sonst zusätzlich `&design=<id>`. Fassung eines
  Designs: Feld `"fassung": "firma" | "public"` (fehlt = firma); die
  Public-Fassung nimmt ohne eigenes Design das erste Design. Die Links zeigen auf den Host, von dem
  die Seite geladen wurde — am Pages-Spiegel wie am Tunnel. QR-Erzeugung:
  `vendor/qrcode/qrcode.js` (qrcode-generator 2.0.4, MIT), kein CDN.
- `?design` überlebt „Neu laden" und „Link kopieren" (beides behält die Query)
  und lässt sich mit allen anderen Flags kombinieren
  (`?k=000P&design=x&stats`).

## Neues Design hinzufügen

1. **Kartenbild exportieren** — die ganze Karte ohne Beschnittrand, hochkant,
   mindestens ~1300 px breit (das Standard-Target ist 1346 × 2156). PNG oder
   JPG. Layout-Regeln fürs Tracking: `Produktion/Kartenlayout/DETAR_Kartenlayout_Eckpfeiler_Tracking.md`
   im Projektordner; Bewertung mit TrackingScore (`Tracking-Pruefstand/TrackingScore/`).
2. **Target erzeugen** (Node ≥ 18; die CLI ist interaktiv, Pipe-Variante
   unten). Name = Design-id — kurz, Kleinbuchstaben, keine Leerzeichen,
   z. B. `v3-blau`:

   ```bash
   printf '%s\n' "/pfad/zur/karte_v3.png" "" "" "karten/000/targets" "v3-blau" \
     | OVERWRITE_FILES=true npx @8thwall/image-target-cli@latest
   ```

   (Prompts: Bildpfad · Typ leer = `flat` · Default-Crop leer = Ja · Ordner ·
   Name. Details: `docs/8thwall-migration.md`, Abschnitt 1.)
3. **Zwei Dateien behalten:** `v3-blau.json` und `v3-blau_luminance.png`.
   `_thumbnail.png`, `_cropped.png` und `_original.png` löschen — die App
   braucht sie nicht (nicht einchecken).
4. **Eintrag in `designs`** der `daten.json`, hinten anhängen:

   ```json
   { "id": "v3-blau", "name": "V3 blau", "target": "targets/v3-blau.json", "breiteMm": 63, "notiz": "Export 2026-10-06, Figma Seite X" }
   ```

   Das erste Design der Liste ist der Standard — neue Designs nicht davor
   einsortieren, solange sie nur getestet werden. Gedruckte Testkarte mit
   eigener QR-Grammatik: zusätzlich `"qr": "<Link wie gedruckt>"`.
5. Committen und pushen (Testseite erst nach Merge in `main`, sonst Tunnel,
   s. u.) — `karten.html` zeigt das neue Design mit QR-Code sofort.

Ein Design **wechseln** heißt also nie, `card.json` zu überschreiben: neue
Dateien, neuer Eintrag. Soll ein Design Standard werden, wird sein Eintrag
an die erste Stelle von `designs` verschoben.

## Designs auf Tracking vergleichen

Ziel: herausfinden, welches gedruckte Design die Engine am ruhigsten und
zuverlässigsten erkennt. Gemessen wird mit dem Werkzeug in `?stats`
(Anleitung und Kennzahlen: `docs/handheld-jitter-analyse.md`, Abschnitt e).

1. **QR-Codes holen:** `karten.html` öffnen, Häkchen `stats` setzen (für das
   Dev-Panel `&dev` von Hand anhängen). Je Design eine Kachel.
2. **Gleiche Bedingungen für alle Designs:** gleiches Licht, gleiches Handy,
   Abstand ≈ 25 cm, Neigung ≈ 45°, Karte matt und flach. Alle Filter-Toggles
   gleich lassen (Spalte `toggles` in der Kopierzeile prüfen).
3. **Je Design messen:** QR scannen, Karte suchen, Figur antippen
   (Neu-Aufsetzen), Fall **F0** (Stativ: Handy fest aufgelegt, Karte liegt —
   reines Tracking-Rauschen, wichtigster Fall für den Design-Vergleich) und
   **F2** (freihändig, Demo-Normalfall) wählen; F4 (Karte 1,5 s abdecken)
   zeigt, wie schnell ein Design wiedergefunden wird. „Messung 10 s", danach „Kopieren" → Tabellenzeile.
   3 Messungen je Design und Fall, Reihenfolge A-B-B-A (Ermüdung und
   Lichtwechsel mitteln sich heraus). Fälle: `docs/handheld-jitter-analyse.md` b.
4. **Vergleichen über das Rohsignal:**
   - **Rauschen roh** (mm · °) — der Hauptwert. Kleiner = Design trackt
     ruhiger. NICHT über „stab" vergleichen: der Filter glättet die
     Unterschiede weg (Regel aus CLAUDE.md, „Marker-A/B immer über roh").
   - **`verlorenMs`** > 0 = Karte war während der Messung verloren → Messung
     wiederholen; häufige Verluste bei einem Design sind selbst ein Ergebnis.
   - **Takt** (Vision-Hz): sollte bei allen Designs gleich sein; weicht er ab,
     liegt es am Gerät, nicht am Design.
   - Ergänzend von Hand notieren: wie schnell die Karte erkannt wird und ob
     sie bei flacher Neigung oder Teilverdeckung (Daumen) hält.
5. Richtwerte für F0 (alte F2F-Zahlen, nur grob vergleichbar): roh
   0,13–0,4 mm gesund, > 0,8 mm = Problem im Bild (Kontrast, Glanz, zu wenig
   Details).

## Lokal testen (Handy braucht HTTPS)

Die Kamera gibt es nur über HTTPS, `localhost` im WLAN reicht am Handy nicht.
Deshalb: lokaler Server + Tunnel.

```bash
# 1. Server im Repo-Ordner (kein Cache, MIME für .wasm/.webp)
node tools/dev-server.js 8743

# 2. Tunnel (einmalig: brew install cloudflared) — druckt eine
#    https://<zufall>.trycloudflare.com-Adresse, ohne Konto, ohne Login
cloudflared tunnel --url http://localhost:8743
```

Dann am Rechner `https://<zufall>.trycloudflare.com/karten.html` öffnen: die
QR-Codes zeigen auf die Tunnel-Adresse, am Handy scannen, fertig. Nach jeder
Änderung reicht Neu laden am Handy (der Dev-Server sendet `no-store`); die
Tunnel-Adresse wechselt bei jedem Neustart von `cloudflared`.

Am Rechner ohne Kamera: `http://localhost:8743/?k=000&desktop&dev&design=<id>`
(Desktop-Modus nutzt das Target nicht, prüft aber die Auflösung der id und
den Splash-Hinweis; `000` durch die eigene Kartennummer ersetzen — ohne `?k`
kommt seit Build 74 nur die Auffang-Seite). Mit Webcam: `http://localhost:8743/?k=000&stats&design=<id>`.
