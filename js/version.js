/* =============================================================================
   DETAR — Build-Marker. BEI JEDEM PUSH +1 (freilaufender Zähler; bis Build 60
   war die Konvention „= Commit-Anzahl", das stimmt seit dem Spiegel-Repo nicht
   mehr — Build 60 = 50 Commits).

   ?stats zeigt die Nummer an UND holt diese Datei zusätzlich frisch vom Server
   (cache: no-store) — steht dort eine höhere Nummer, läuft am Gerät ein alter
   Cache → „neu laden". Damit ist am Handy ablesbar, ob der Stand aktuell ist.
   ============================================================================= */
export const BUILD = 61;
export const BUILD_DATE = "2026-09-15";
