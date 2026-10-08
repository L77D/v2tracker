#!/bin/bash
# DETAR — Fonts auf die genutzten Zeichen kürzen (Production-Härtung 2026-09-09).
# Eingabe: die Original-TTFs (Google Fonts, OFL) — NICHT im Repo, Pfad als $1.
# Zeichenmenge (seit Build 63, 2026-10-06): FESTER deutscher Zeichensatz,
# unabhängig von Karten-Texten — eine neue Karte fasst die Engine nicht an:
# ASCII + Latin-1 (ÄÖÜäöüß, « », é …) + Latin Extended-A (Namen: ł ş č ğ …)
# + rumänisch Șș Țț + ẞ + Typografie (‐ – — ‘ ’ ‚ “ ” „ † ‡ • … ‰ ‹ ›) + € ™ −
# + UI-Zeichen (→ ← ↑ ↓ ✓ ✅ ⋮), gespeichert in tools/font-subset-unicodes.txt.
# Was die Originale nicht enthalten (Silkscreen hat kaum Extended-A, beide
# keine Pfeile/Häkchen), fällt im Browser auf die Systemschrift zurück.
# Bis Build 62 wurde die Menge aus cards/*.js + js/*.js gesammelt (Latin-1 +
# Kartenzeichen); der feste Satz ist eine Obermenge davon.
# Hinting wird entfernt (fpgm/prep/cvt): iOS/macOS und Android/Skia werten
# TrueType-Instruktionen nicht aus, Outlines bleiben identisch.
# Originale: Google Fonts (OFL). github.com ist aus der Claude-Cloud gesperrt —
# dieselben Dateien liegen im npm-Paket @expo-google-fonts/jersey-10 bzw.
# @expo-google-fonts/silkscreen (400Regular/*_400Regular.ttf; geprüft
# 2026-10-06: liefern mit der alten Zeichenliste byte-gleich die Build-62-Fonts).
#   pip install fonttools brotli
#   tools/build-fonts.sh /pfad/zu/originalen   # enthält Jersey10-Regular.ttf, Silkscreen-Regular.ttf
# Zeichenliste neu schreiben (nur wenn der feste Satz erweitert werden soll):
#   python3 -c "s=set(range(0x20,0x7F))|set(range(0xA0,0x180))|{0x218,0x219,0x21A,0x21B,0x1E9E}|{ord(c) for c in '‐‑–—‘’‚“”„†‡•…‰‹›€™−→←↑↓✓✅⋮'};open('tools/font-subset-unicodes.txt','w').write(','.join('U+%04X'%c for c in sorted(s)))"
# Karten prüfen (Zeichen außerhalb des Satzes = fallen auf die Systemschrift):
#   python3 -c "import glob;f={int(u[2:],16) for u in open('tools/font-subset-unicodes.txt').read().split(',')};[print(p,''.join(sorted({c for c in open(p,encoding='utf-8').read() if ord(c)>=0x20 and ord(c) not in f}))) for p in glob.glob('karten/*/dialog.json')+glob.glob('karten/*/daten.json')]"
set -e
SRC="${1:?Pfad zu den Original-TTFs}"
cd "$(dirname "$0")/.."
for f in Jersey10-Regular Silkscreen-Regular; do
  pyftsubset "$SRC/$f.ttf" --unicodes-file=tools/font-subset-unicodes.txt --output-file="assets/fonts/$f.ttf" \
    --layout-features='*' --name-IDs='*' --name-legacy --notdef-outline --glyph-names --no-hinting
  ls -la "assets/fonts/$f.ttf"
done
