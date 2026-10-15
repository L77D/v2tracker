/* =============================================================================
   DETAR — SoundDesign: prozedurale UI-Sounds über tiks (js/vendor/tiks.js,
   vendored — kein CDN, keine Audio-Dateien, reine Web-Audio-Synthese).

   EIN semantisches Vokabular statt roher tiks-Aufrufe: Aufrufer sagen WAS
   passiert (cardFound, popIn, questionTap …), die Zuordnung zu tiks-Sounds
   lebt NUR hier — Klang-Umbau = nur diese Datei anfassen.

   INIT MUSS IN DER USER-GESTE PASSIEREN (START-Button, vor allen awaits):
   tiks legt den AudioContext bei der ersten Geste an — gleiche Regel wie die
   iOS-Gyro-Permission (siehe main.js boot()).

   Alle Methoden sind crash-safe: ohne init() oder mit SOUND.enabled=false
   sind sie stille No-Ops — die App läuft auch komplett ohne Sound.
   ============================================================================= */
import { createTiks } from "./vendor/tiks.js";
import { SOUND } from "./config.js";

class SoundDesign {
  constructor() {
    this.engine = null;
    this.ctx = null;     // eigener AudioContext für den Blasen-Ton (tiks gibt seinen nicht heraus)
    this.master = null;
  }

  /* In der START-Geste rufen. Idempotent. */
  init() {
    if (this.engine) return;
    try {
      this.engine = createTiks({
        theme: SOUND.theme,
        volume: SOUND.volume,
        // Bewusst false: die Demo soll nie "stumm ohne Erklärung" wirken, weil
        // auf einem Test-Gerät "Bewegung reduzieren" aktiv ist. Sounds sind
        // ohnehin additiv (alles hat visuelles Feedback).
        respectReducedMotion: false,
      });
    } catch (e) {
      console.warn("Sound nicht verfügbar:", e);
    }
    // Blasen-Ton: eigener AudioContext — ebenfalls in der Geste entsperren
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      // Tiefpass nimmt dem Rechteck die Schärfe — dezent statt quäkig
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2800;
      this.master.connect(lp);
      lp.connect(this.ctx.destination);
      this.applyVolume();
    } catch (e) {
      console.warn("Blasen-Ton nicht verfügbar:", e);
      this.ctx = null;
    }
  }

  get on() {
    return this.engine !== null && SOUND.enabled;
  }

  /* Geänderte Lautstärke (SOUND.volume) auf die laufende Engine anwenden. */
  applyVolume() {
    this.engine?.setVolume(SOUND.volume);
    if (this.master) this.master.gain.value = SOUND.volume * SOUND.bubbleVolume;
  }

  /* ---- Ereignis-Vokabular ------------------------------------------------- */
  uiTap()       { if (this.on) this.engine.click(); }        // START-Button
  cardFound()   { if (this.on) this.engine.notify(); }       // Karte erkannt → Aktivier-Phase
  cardTapped()  { if (this.on) this.engine.swoosh(); }       // Tap auf die Karte → Burst
  popIn()       { if (this.on) this.engine.pop(); }          // Figur ploppt auf
  uiReveal()    { if (this.on) this.engine.success(); }      // Menü fährt ein (Begrüßung fertig)
  questionTap() { if (this.on) this.engine.click(); }        // Frage-Button
  figureJump()  { if (this.on) this.engine.pop(); }          // Figur-Tap: Hüpfer zur Mitte

  /* Anfangston einer Antwort: wie das „Blip" beim Öffnen einer Textbox in
     alten RPGs — ein kurzes „bi-ip" aus zwei steigenden Rechteck-Tönen
     (Quinte), danach tippt der Text lautlos. Gerufen von
     cardController.say() nur auf Seite 1 einer Antwort. */
  bubbleOpen() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.005;
    const f = SOUND.bubblePitch;
    const tones = [[f, 0], [f * 1.5, SOUND.bubbleGapMs / 1000]];
    const len = SOUND.bubbleToneMs / 1000;
    for (const [freq, delay] of tones) {
      const t = t0 + delay;
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + len + 0.01);
    }
  }
}

export const sound = new SoundDesign();
