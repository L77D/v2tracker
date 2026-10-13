#!/bin/bash
# DETAR — baut den Skill „detar-dialog“ per Doppelklick (macOS).
# Ergebnis: dist/detar-dialog.zip (zum Hochladen in Claude) und dist/detar-dialog/.
# Quelle: Regelwerk, Quellenliste, Vorbild und Prüfprogramm aus diesem Repo
# (Details im Kopf von tools/baue-dialog-skill.mjs).
cd "$(dirname "$0")"
node tools/baue-dialog-skill.mjs && open dist
echo ""
read -n 1 -s -r -p "Fertig — Taste drücken zum Schließen."
