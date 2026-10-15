/* =============================================================================
   DETAR — SceneFade: Szene weich ein-/ausblenden statt hart schalten — bei
   Tracking-Verlust darf das Bild nicht hart abbrechen.

   Der Tracker entscheidet weiter selbst, WANN die Figur weg soll — er
   schreibt in einen Proxy außerhalb der Szene (arSession.js → poseTarget),
   dessen `visible` hier nur noch der Wunsch ist. SceneFade macht daraus eine
   Deckkraft-Rampe (CHOREO.lostFadeMs / foundFadeMs) und schaltet
   `root.visible` erst bei 0 ab.

   Deckkraft: Figur, Blase und Marker haben je eigene Materialien. Pro Frame:
   begin() schreibt die Basis-Deckkraft zurück (Module wie activationFX setzen
   ihre Opacity selbst und sollen ihren eigenen Wert sehen), apply() merkt sich
   nach den Ticks die Basis und multipliziert mit alpha. Nur während alpha < 1
   — im Normalbetrieb kein Traversieren. Bekannter Kompromiss: die Figur sind
   übereinanderliegende Sprites ohne Tiefentest → halbtransparent scheint der
   Körper kurz durch Kopf/Gesicht (300 ms, am Handy kaum zu sehen).
   ============================================================================= */
import { CHOREO } from "./config.js";

/* Reine Rampe: nächstes alpha aus Wunsch und Zeitschritt. */
export function fadeStep(alpha, want, dtMs, inMs, outMs) {
  if (want) return inMs > 0 ? Math.min(1, alpha + dtMs / inMs) : 1;
  return outMs > 0 ? Math.max(0, alpha - dtMs / outMs) : 0;
}

export class SceneFade {
  /* root = sichtbarer Träger (stabRoot), dessen Teilbaum gefaded wird */
  constructor(root) {
    this.root = root;
    this.alpha = 0;
    this.lastMs = 0;
    this.touched = []; // Materialien mit gemerkter Basis-Deckkraft
    root.visible = false;
  }

  /* Frame-Anfang: Basis-Deckkraft zurück, damit die Ticks ihre Werte sehen. */
  begin() {
    for (const m of this.touched) m.opacity = m.userData.fadeBase;
  }

  /* Wunsch des Trackers → alpha; root.visible = alpha > 0. */
  update(want, now = performance.now()) {
    const dtMs = this.lastMs ? Math.min(100, now - this.lastMs) : 0; // Uhr-Sprung (Tab im Hintergrund) kappen
    this.lastMs = now;
    this.alpha = fadeStep(this.alpha, want, dtMs, CHOREO.foundFadeMs, CHOREO.lostFadeMs);
    this.root.visible = this.alpha > 0;
    return this.alpha;
  }

  /* Nach den Ticks: Deckkraft × alpha (nur während der Rampe). */
  apply() {
    if (this.alpha >= 1 || this.alpha <= 0) { this.release(); return; }
    this.touched.length = 0;
    this.root.traverse((o) => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (!mats) return;
      for (const m of mats) {
        m.userData.fadeBase = m.opacity; // (alle sichtbaren DETAR-Materialien sind transparent)
        m.opacity = m.userData.fadeBase * this.alpha;
        this.touched.push(m);
      }
    });
  }

  /* Rampe vorbei: begin() hat die Basis zu Frame-Beginn schon zurückgeschrieben,
     danach haben die Ticks ggf. eigene Werte gesetzt — die bleiben stehen. */
  release() {
    for (const m of this.touched) delete m.userData.fadeBase;
    this.touched.length = 0;
  }
}
