# vendor/qrcode — QR-Code-Erzeugung für karten.html

`qrcode.js` = `qrcode-generator` 2.0.4 (Kazuhiko Arase, MIT), unverändert aus
dem npm-Paket (`dist/qrcode.js`, klassisches Skript, globale Funktion `qrcode`).
Läuft ohne Build-Schritt und ohne CDN in jedem Browser ab ES5.

Genutzt nur von `karten.html` (Übersicht der Kartendesigns mit QR-Codes zum
Umschalten am Handy, 2026-09-15). Die App selbst lädt die Datei nie.

Aktualisieren: `npm pack qrcode-generator@<version>` → `package/dist/qrcode.js`
hierher kopieren, LICENSE aus dem Repo github.com/kazuhikoarase/qrcode-generator.
