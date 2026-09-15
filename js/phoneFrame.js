/* =============================================================================
   DETAR — PhoneFrame (nur Desktop-Modus): Smartphone-Rahmen wie im
   Lokal-Prototyp. Rendering + alle App-Overlays (Splash, Bottom-UI, DET-Logo,
   Tracking-Hinweis) leben in einem phone-großen, skalierten Container.

   Trick: der Rahmen hat einen CSS-transform — dadurch verankern sich alle
   `position: fixed`-Overlays der App automatisch AM RAHMEN statt am Viewport
   (ein transformierter Ahne wird zum Containing Block). Die App-CSS bleibt
   unverändert und verhält sich im Rahmen exakt wie am echten Gerät.
   ============================================================================= */

const PRESETS = {
  "iPhone (390×844)": [390, 844],
  "Klein (360×780)": [360, 780],
  "Groß (430×932)": [430, 932],
};
const LS_KEY = "detar-phone-preset";
const MOVE_IDS = ["ar-container", "question-root", "splash"];

export class PhoneFrame {
  /* onResize(w, h) setzt desktopMode.js nach dem Aufbau (Renderer-Größe). */
  constructor() {
    this.onResize = null;
    const style = document.createElement("style");
    style.textContent = `
      body.phone-framed { background: #1c1c1e; }
      #pfStage { position: fixed; inset: 0; display: flex;
        align-items: center; justify-content: center; }
      #pfPhone { position: relative; overflow: hidden; background: #000;
        border-radius: 34px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 10px #0c0c0d; }
      #pfPhone #ar-container { position: absolute; inset: 0; }
      #pfSel { position: fixed; top: 8px; left: 8px; z-index: 130;
        background: #3a3a3e; color: #ddd; border: none; border-radius: 7px;
        font: 12px -apple-system, Arial, sans-serif; padding: 6px 8px; }
    `;
    document.head.appendChild(style);
    document.body.classList.add("phone-framed");

    this.stage = document.createElement("div");
    this.stage.id = "pfStage";
    this.phone = document.createElement("div");
    this.phone.id = "pfPhone";
    this.stage.appendChild(this.phone);
    document.body.appendChild(this.stage);

    // App-Overlays in den Rahmen umziehen (Reihenfolge bleibt erhalten)
    for (const id of MOVE_IDS) {
      const el = document.getElementById(id);
      if (el) this.phone.appendChild(el);
    }

    // Format-Auswahl (persistent)
    this.sel = document.createElement("select");
    this.sel.id = "pfSel";
    for (const name of Object.keys(PRESETS)) this.sel.add(new Option(name, name));
    let saved = null;
    try { saved = localStorage.getItem(LS_KEY); } catch (e) { /* kein Speicher (Private Mode) */ }
    this.sel.value = saved || Object.keys(PRESETS)[0];
    if (!PRESETS[this.sel.value]) this.sel.value = Object.keys(PRESETS)[0];
    this.sel.onchange = () => {
      try { localStorage.setItem(LS_KEY, this.sel.value); } catch (e) { /* egal */ }
      this.fit(true);
    };
    document.body.appendChild(this.sel);

    window.addEventListener("resize", () => this.fit(false));
    this.fit(true);
  }

  get size() { return PRESETS[this.sel.value]; }

  fit(sizeChanged) {
    const [w, h] = this.size;
    this.w = w; this.h = h;
    this.phone.style.width = w + "px";
    this.phone.style.height = h + "px";
    const pad = 40;
    const s = Math.min((window.innerWidth - pad) / w, (window.innerHeight - pad) / h, 1.15);
    this.phone.style.transform = `scale(${s})`;
    if (sizeChanged) this.onResize?.(w, h);
  }
}
