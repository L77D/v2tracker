/* =============================================================================
   DETAR — kleine gemeinsame Helfer (2026-09-15, Refactoring). Live-Code:
   nur Syntax bis `?.`/`??` (Grenze iOS 13.4 / Chrome 80, s. CLAUDE.md).
   ============================================================================= */

/* document.getElementById, kurz. */
export const el = (id) => document.getElementById(id);

/* Gleichverteilte Zufallszahl in [a, b). */
export const rand = (a, b) => a + Math.random() * (b - a);

/* Winkel auf (−π, π] falten. */
export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/* Endlichkeits-Prüfung für Vector3 / Quaternion (NaN-Schutz im Tracking). */
export function finiteVec(v) { return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z); }
export function finiteQuat(q) { return Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z) && Number.isFinite(q.w); }

/* Normierter Fortschritt 0…1 einer Animation mit Mindestdauer 50 ms
   (schützt vor Division durch 0 bei Dauer 0 aus dem Dev-Panel). */
export function progress(t, sec) { return Math.min(1, t / Math.max(0.05, sec)); }
