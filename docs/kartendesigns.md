# Kartendesigns umschalten (`?karte=<id>`, Build 57, 2026-09-15)

Mehrere Kartendesigns liegen als eigene Targets nebeneinander in
`targets/8thwall/` und werden per URL-Parameter gewählt — kein Branch pro
Design, `main` bleibt unberührt.

- `targets/8thwall/karten.json` — die Liste. Je Eintrag: `id` (steht in der
  URL), `name` (Anzeigename), `target` (Dateibasis: `<target>.json` +
  `<target>_luminance.png`), `breiteMm` (physische Kartenbreite),
  `notiz` (frei).
- `index.html?karte=<id>` lädt das Target des Eintrags. Ohne Parameter gilt
  `card` = der bisherige Stand. Unbekannte id → Hinweis in der Fehlerzeile des
  Splash („Unbekannte Karte … — bekannt: …"), der Start-Button bleibt aus.
- `physicalWidthInMeters` = `breiteMm / 1000` des Eintrags (Standard 63 mm
  laut Druckspezifikation; bis Build 56 kam der Wert aus `SCENE.cardWidth`
  = 59 mm). `SCENE.cardWidth` in `config.js` bleibt die Szenen-Einheit
  (worldRoot-Skalierung, Eck-Marker, Desktop-Plane) und ist davon getrennt.
  `SCENE.cardAspect` gilt weiterhin für alle Designs gemeinsam — solange alle
  im Format 63 × 88 mm bleiben, passt das.
- `?stats` zeigt die Zeile `Design: <id> · <target>.json · <breiteMm> mm`.
- `karten.html` — Übersicht: liest `karten.json`, zeigt je Design Name, Link
  und QR-Code auf `?karte=<id>` (Häkchen für `stats`, `public`, `nosimd`).
  Die Links zeigen auf den Host, von dem die Seite geladen wurde — am
  Pages-Spiegel wie am Tunnel. QR-Erzeugung: `vendor/qrcode/qrcode.js`
  (qrcode-generator 2.0.4, MIT), kein CDN.
- `?karte` überlebt „Neu laden" und „Link kopieren" (beides behält die Query)
  und lässt sich mit allen anderen Flags kombinieren (`?karte=x&public&stats`).

## Neues Design hinzufügen

1. **Kartenbild exportieren** — die ganze Karte ohne Beschnittrand, hochkant,
   mindestens ~1300 px breit (das bisherige Target ist 1346 × 2156). PNG oder
   JPG. Layout-Regeln fürs Tracking: `Tracking-Pruefstand/` im Projektordner.
2. **Target erzeugen** (Node ≥ 18; die CLI ist interaktiv, Pipe-Variante
   unten). Name = die Dateibasis, die in `karten.json` unter `target` steht —
   kurz, keine Leerzeichen, z. B. `v3-blau`:

   ```bash
   printf '%s\n' "/pfad/zur/karte_v3.png" "" "" "targets/8thwall" "v3-blau" \
     | OVERWRITE_FILES=true npx @8thwall/image-target-cli@latest
   ```

   (Prompts: Bildpfad · Typ leer = `flat` · Default-Crop leer = Ja · Ordner ·
   Name. Details: `docs/8thwall-migration.md`, Abschnitt 1.)
3. **Zwei Dateien behalten:** `targets/8thwall/v3-blau.json` und
   `v3-blau_luminance.png` (Pflicht); `_thumbnail.png` darf bleiben,
   `_cropped.png` und `_original.png` löschen (nicht einchecken).
4. **Zeile in `karten.json`:**

   ```json
   { "id": "v3-blau", "name": "V3 blau", "target": "v3-blau", "breiteMm": 63, "notiz": "Export 2026-09-20, Figma Seite X" }
   ```

   `id` und `target` dürfen gleich sein; `id` ist das, was im QR-Code steht.
5. Committen und den Spiegel nachziehen — `karten.html` zeigt den neuen
   Eintrag mit QR-Code sofort.

Ein Design **wechseln** heißt also nie, `card.json` zu überschreiben: neue
Dateibasis, neue Zeile. Erst wenn ein Design das Standarddesign werden soll,
wird in `karten.json` der Eintrag `card` darauf umgestellt (oder die Dateien
umbenannt).

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

Am Rechner ohne Kamera: `http://localhost:8743/?desktop&dev&karte=<id>`
(Desktop-Modus nutzt das Target nicht, prüft aber die Auflösung der id und
den Splash-Hinweis). Mit Webcam: `http://localhost:8743/?stats&karte=<id>`.
