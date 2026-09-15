#!/bin/bash
# DETAR — Dev-Server per Doppelklick (macOS; `open` gibt es nur dort).
# Startet tools/dev-server.js (Port 8743, richtige MIME-Typen für .wasm/.webp,
# Cache aus) und öffnet den Browser im Desktop-Dev-Modus. Bis Build 60 lief hier
# `python3 -m http.server 8080` — der liefert .wasm ohne MIME-Typ, die Engine
# lädt dann anders als auf GitHub Pages. Beenden: Fenster schließen oder Ctrl+C.
cd "$(dirname "$0")"
echo "Modi:  ?desktop&dev  = Editor am Rechner   |   ?desktop&debug = Hilfslinien"
echo "Beenden: Ctrl+C oder Fenster schließen."
( sleep 1; open "http://localhost:8743/index.html?desktop&dev" ) &
node tools/dev-server.js 8743
