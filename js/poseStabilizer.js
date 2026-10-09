/* =============================================================================
   DETAR — PoseStabilizer: entzittert die Marker-Pose, BEVOR die Figur sie
   erbt. Port des in Zapworks verifizierten Stabilizers (Stand 2026-07-02).

   Eingang (seit 8th Wall, 2026-09-09): `source.matrix` ist die KAMERA-RELATIVE
   Karten-Pose (arSession.js → updateAnchor: Kamera⁻¹ × Bildpose, Scale = Karten-
   breite in Szenen-Einheiten). Unter MindAR (Branch main) war das direkt
   anchor.group.matrix — Kamera-Origin-Modus, Anchor-Scale in Target-Pixeln.

   Architektur: die Figur hängt NICHT am rohen Anchor, sondern unter `stabRoot`
   = KIND DER KAMERA (kamera-relative Pose; unter MindAR lag stabRoot auf
   Szenen-Ebene). Pro Frame: source.matrix lesen → One-Euro (Position) + SLERP
   (Rotation), framerate-korrekt, Dead-Zone (Snap-to-still), Lost-Hold →
   in stabRoot.matrix schreiben. Sichtbarkeit steuert der Stabilizer selbst.
   Stufen-Nummern (#1–#10) = Toggles im Dev-Panel (js/devPanel.js).

   AUFBAU (Refactoring Stufe 3c, Build 88): tick() ist nur noch der Dirigent
   und ruft die Stufen in fester Reihenfolge — jede Stufe bekommt die Rohpose
   `raw` {p, q, s} explizit und sagt, ob der Frame weiterläuft:
     holdWhileLost → passThrough(#1) → applyCameraDelta(Gyro) → readRaw(#5)
     → arbitrate(#10) → lockScale(#9) → normalize(#2) → acquire/initialise
     → updateMotionEstimate → applyExtrapolation(#8) → filterPosition(#3)
     → filterRotation → write
   Die Scratch-Vektoren (_pos/_quat/_scale) wandern nur noch als `raw`
   durch die Stufen; write() hat seinen eigenen. Nach außen gibt es genau
   eine Lesestelle: snapshot() für ?stats (statsOverlay.js) — alle anderen
   Felder sind intern. Verhalten gegenüber Build 87 bitidentisch, gesichert
   durch tests/fixtures/poseStabilizer.golden.json.

   NaN-SCHUTZ (Fix 2026-07-08): In den Frames um Tracking-Verlust kann der
   Tracker degenerierte Matrizen liefern. Ein einziges NaN vergiftet über lerp/atan2
   dauerhaft alle Folgewerte — Symptom: Kopf/Bubble/Figur verschwinden bis
   zum Neuladen. Deshalb wird JEDE gelesene Pose auf Endlichkeit geprüft und
   ein kaputter Frame komplett verworfen.
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { STAB, GYRO } from "./config.js";
import { arbitrateUpright } from "./poseArbiter.js";
import { finiteVec, finiteQuat } from "./util.js";

// Rohpose des aktuellen Frames — EIN Satz Scratch-Vektoren, der als `raw`
// explizit durch die Stufen gereicht wird (keine Allokation pro Frame).
const _raw = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
const _wp = new THREE.Vector3();     // write(): Position in Anchor-Einheiten
const _dqInv = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _predQ = new THREE.Quaternion();

export class PoseStabilizer {
  /**
   * @param source Rohpose-Träger (arSession.js schreibt pro Frame source.matrix)
   * @param target stabRoot (Kind der Kamera, trägt die Figur)
   * @param gyro   optionale GyroFusion (Prediction + Lost-Brücke)
   */
  constructor(source, target, gyro = null) {
    this.source = source;
    this.target = target;
    this.gyro = gyro;
    this.target.matrixAutoUpdate = false;
    this.target.visible = false;

    // One-Euro-Zustand
    this.xPrev = new THREE.Vector3();
    this.dxPrev = new THREE.Vector3();
    this.initialised = false;
    this.smoothPos = new THREE.Vector3();
    this.smoothQuat = new THREE.Quaternion();
    this.lastScale = new THREE.Vector3(1, 1, 1);
    this.scaleLock = 1;        // eingefrorene Anchor-Scale (#9) — beim Aufsetzen gesetzt
    this.hasScaleLock = false;
    // Aufsetzen per Median (2026-09-07): Sammelpuffer der ersten Messungen
    this.acq = null;           // { samples: [{p,q,s}], startMs, lastRaw, skipCurrent }
    this.outlierSinceMs = 0;   // seit wann die Scale am Stück außerhalb des Locks liegt
    // Diagnose (?stats): Abstand Rohpose ↔ geglätteter Zustand + Zahl der Neu-Erkennungen
    this.rawSkewDeg = 0;
    this.rawOffset = 0;
    this.relocCount = 0;   // Neu-Aufsetzen auf Tap (reacquire)
    this.snapCount = 0;    // automatische Snaps (zwei ferne Messungen in Folge) — bis Build 58 unsichtbar
    this.relockCount = 0;  // Scale-Re-Locks — dito
    // Schwerkraft-Schiedsrichter (poseArbiter.js, 2026-09-15): Ergebnis des
    // letzten Frames + Zahl der Zustandswechsel (roh ↔ gespiegelt)
    this.arb = { flipped: false, zRaw: 0, zChosen: 0, tiltDeg: 0, active: false };
    this.flipCount = 0;
    // Messwerkzeug ?stats (2026-09-25, Handheld-Analyse): reine Diagnose, ändert
    // kein Verhalten. newMeas = in diesem Tick kam eine neue Vision-Messung an
    // (rawPos/rawQuat = diese Messung nach Schiedsrichter, in Kartenbreiten);
    // Zähler für Modus-Wechsel, NaN-Verwürfe und angewendete Gyro-Deltas.
    this.diag = {
      newMeas: false, rawPos: new THREE.Vector3(), rawQuat: new THREE.Quaternion(),
      modeSwitches: 0, moveCause: "—", nanCount: 0, gyroApplied: 0,
    };
    // snapshot(): ein wiederverwendetes Objekt für ?stats (keine Allokation pro Frame)
    this.snap = {};

    // Tracking-Status (Lost-Hold)
    this.tracking = false;
    this.everVisible = false;
    this.lastSeenMs = 0;
    this.lastClockMs = 0;

    // Bewegungs-Extrapolation: letzte ECHTE Messung + geschätzte Geschwindigkeit
    this.measPos = new THREE.Vector3();     // letzte neue Messung (Kartenbreiten,
                                            // wird von der Gyro-Prediction MITGEDREHT)
    this.measQuat = new THREE.Quaternion();
    this.measT = 0;                         // Zeitpunkt der Messung
    this.vel = new THREE.Vector3();         // Kartenbreiten/s (geglättet)
    this.angVel = new THREE.Vector3();      // Achse*rad/s (geglättet)
    this.hasMeas = false;
    this.farCount = 0;                      // ferne Messungen in Folge (Ausreißer-Debounce #6)

    // FIX 2026-07-13: Stale-Erkennung braucht die UNGEDREHTE Rohpose. measPos
    // wird vom Gyro mitrotiert — der Vergleich damit meldete bei Handy-Drehung
    // jeden stale Frame als „neue Messung" (Mini-dt, Rückwärts-Geschwindigkeit)
    // und vergiftete die Bewegungsschätzung.
    this.rawPrev = new THREE.Vector3();
    this.rawPrevQ = new THREE.Quaternion();
    this.hasRaw = false;

    // Bewegt-Zustand mit Hysterese + Verweilzeit (statt binärem Flackern)
    this.moving = false;
    this.lastAboveMs = 0;

    // DRIFT-Detektor (Fix 2026-07-13): „bewegt sich" wird an der Verschiebung
    // über ein ~250-ms-Fenster gemessen, nicht an der Momentan-Geschwindigkeit.
    // Hand-Tremor pendelt um einen Punkt (Drift ≈ 0), echte Bewegung
    // akkumuliert Strecke — Momentan-Geschwindigkeit kann beides nicht
    // unterscheiden (Tremor erreicht kurzzeitig hohe Werte).
    this.snapOld = { p: new THREE.Vector3(), q: new THREE.Quaternion(), t: 0, ok: false };
    this.snapNew = { p: new THREE.Vector3(), q: new THREE.Quaternion(), t: 0, ok: false };
    this.driftSpeed = 0;
    this.driftAngSpeed = 0;

    // Vision-Messrate (für ?stats)
    this.measCount = 0;
    this.hzWindowT = 0;
    this.visionHz = null;
  }

  /* ---- Ereignisse von außen ---------------------------------------------- */
  onFound() {
    const now = performance.now();
    // Nur wenn die Figur schon AUSGEBLENDET war, auf die neue Pose snappen —
    // war sie noch sichtbar (Lost-Hold/Gyro-Brücke), weich weiterkorrigieren.
    if (this.everVisible && !this.target.visible) {
      this.initialised = false;
      this.acq = null; // frisch sammeln (Median), nicht alte Samples weiterverwenden
    }
    this.tracking = true;
    this.everVisible = true;
    this.lastSeenMs = now;
    this.target.visible = true;
  }

  onLost() {
    this.tracking = false;
  }

  /* NEU AUFSETZEN auf Nutzer-Tap (2026-09-07): Median über die nächsten
     Messungen, während der Nutzer stillhält. Die im Moment anstehende Rohpose
     stammt noch von VOR dem Tap — sie zählt nicht als Messung (skipCurrent);
     bis die erste frische Messung da ist, steht die alte Pose. (Unter MindAR
     stieß main.js hier zusätzlich die Neu-Erkennung des Trackers an; 8th Wall
     erkennt kontinuierlich neu.) */
  reacquire() {
    this.initialised = false;
    this.hasScaleLock = false;
    this.outlierSinceMs = 0;
    this.acq = { samples: [], startMs: performance.now(), lastRaw: null, skipCurrent: true };
    this.relocCount++;
  }

  /* Diagnose für ?stats (statsOverlay.js) — die EINZIGE Lesestelle von außen;
     alles andere am Stabilizer ist intern (Stufe 3c). Liefert immer dasselbe
     Objekt; rawPos/rawQuat/arb zeigen auf interne Objekte (nur lesen). */
  snapshot() {
    const s = this.snap, d = this.diag;
    s.tracking = this.tracking;
    s.visible = this.target.visible;
    s.moving = this.moving;
    s.moveCause = d.moveCause;
    s.visionHz = this.visionHz;
    s.newMeas = d.newMeas;
    s.rawPos = d.rawPos;
    s.rawQuat = d.rawQuat;
    s.rawSkewDeg = this.rawSkewDeg;
    s.rawOffset = this.rawOffset;
    s.relocCount = this.relocCount;
    s.snapCount = this.snapCount;
    s.relockCount = this.relockCount;
    s.flipCount = this.flipCount;
    s.nanCount = d.nanCount;
    s.modeSwitches = d.modeSwitches;
    s.gyroApplied = d.gyroApplied;
    s.arb = this.arb;
    return s;
  }

  /* ---- Dirigent: ein Frame ------------------------------------------------ */
  tick() {
    const now = performance.now();
    const dt = this.clockDt(now);
    this.diag.newMeas = false;

    // Gyro-Delta JEDEN Frame abholen (hält den internen Zustand frisch).
    // null = KEIN frisches Signal (keine Permission / kein Sensor / stale).
    const dq = this.gyro?.getDelta() ?? null;
    const gyroOn = GYRO.enabled;

    if (this.tracking) this.lastSeenMs = now;
    else { this.holdWhileLost(now, dq, gyroOn); return; } // Pose eingefroren — nie aus einem Lost-Frame lesen (NaN-Quelle)

    if (!STAB.enabled) { this.passThrough(); return; }

    // Gyro-PREDICTION: echte Kamera-Drehung sofort übernehmen. Das Sehen muss
    // dann nur noch Drift/Translation korrigieren → der Filter darf hart
    // glätten, ohne dass die Figur bei Bewegung nachzieht.
    if (dq && gyroOn) this.applyCameraDelta(dq);

    const raw = _raw;
    if (!this.readRaw(raw)) return;          // kaputter Frame → komplett verwerfen, letzte gute Pose steht
    this.arbitrate(raw);
    if (!this.lockScale(raw, now)) return;   // Fehl-Messung (schräg/riesig) → komplett verwerfen
    this.normalize(raw);

    if (!this.initialised) {
      // AUFSETZEN PER MEDIAN (2026-09-07): erst Messungen sammeln; solange wird
      // der laufende Median angezeigt. Liefert false, sobald der Median steht —
      // dann liegen Median-Pose und -Scale in raw.
      if (this.acquire(raw.p, raw.q, raw.s, now)) return;
      this.initialise(raw, now);
      return;
    }
    this.lastScale.copy(raw.s);
    // Diagnose: wie weit liegt die Rohpose vom geglätteten Zustand (Kartenbreiten / Grad)?
    this.rawSkewDeg = (raw.q.angleTo(this.smoothQuat) * 180) / Math.PI;
    this.rawOffset = raw.p.distanceTo(this.smoothPos);

    this.updateMotionEstimate(raw, now);
    const moving = this.applyExtrapolation(raw, now);
    this.filterPosition(raw.p, dt, moving);
    this.filterRotation(raw.q, dt, moving);
    this.write();
  }

  /* Frame-Zeit in Sekunden; erster Frame und Uhr-Sprünge → Referenztakt. */
  clockDt(now) {
    let dtMs = this.lastClockMs ? now - this.lastClockMs : 1000 / STAB.refHz;
    this.lastClockMs = now;
    if (dtMs <= 0) dtMs = 1000 / STAB.refHz;
    return dtMs / 1000;
  }

  /* ---- Lost-Hold / Gyro-Brücke (#4) ---------------------------------------- */
  holdWhileLost(now, dq, gyroOn) {
    const since = now - this.lastSeenMs;
    if (dq && gyroOn && this.everVisible && this.target.visible && since < GYRO.bridgeMs) {
      // Gyro-Brücke: Kamera-Drehung wird kompensiert — die Figur bleibt
      // (ungefähr) auf der KARTE, nicht am Bildschirm.
      this.applyCameraDelta(dq);
      this.write();
      return;
    }
    // FIX 2026-07-08 (Handy-Test): OHNE lebendes Gyro-Signal gibt es KEINE
    // lange Brücke — die eingefrorene Pose ist kamera-relativ und klebt am
    // BILDSCHIRM, sobald sich das Handy bewegt („Figur hängt im Bild").
    // Dann nur kurzer Flacker-Schutz (lostHoldMs), danach ausblenden.
    const holdMs = !STAB.lostHold ? 0 : (dq ? GYRO.bridgeMs : STAB.lostHoldMs);
    if (this.everVisible && since > holdMs) {
      this.target.visible = false;
    }
  }

  /* ---- FEATURE-SCHALTER #1: Stabilizer komplett aus → rohe Anchor-Pose 1:1 -- */
  passThrough() {
    this.target.matrix.copy(this.source.matrix);
    this.target.matrixWorldNeedsUpdate = true;
    this.initialised = false; // beim Wieder-Einschalten sauber neu aufsetzen
  }

  /* ---- Rohe kamera-relative Pose lesen + NaN-Schutz (#5) -------------------- */
  readRaw(raw) {
    this.source.matrix.decompose(raw.p, raw.q, raw.s);
    if (STAB.nanGuard &&
        (!finiteVec(raw.p) || !finiteQuat(raw.q) || !finiteVec(raw.s) || raw.s.x < 1e-8)) {
      this.diag.nanCount++;
      return false;
    }
    return true;
  }

  /* ---- SCHWERKRAFT-SCHIEDSRICHTER (#10, 2026-09-15, „Pose-Flip") -------------
     Die ebene Pose-Schätzung hat zwei Lösungen; die Engine liefert manchmal
     stabil die gespiegelte (Karte um 2θ gekippt → Figur liegt flach zum
     Betrachter). Aus der Rohpose wird die Spiegel-Kandidatin berechnet und die
     Lage gewählt, deren Kartennormale im Erdframe nach oben zeigt (nur
     beta/gamma nötig). VOR Scale-Lock/Normierung/Stale-Erkennung: das Ergebnis
     hängt nur von der Rohpose ab, bitidentische Rohposen bleiben bitidentisch
     → stale Frames werden weiter erkannt. Ohne frisches Gyro-Signal passiv. */
  arbitrate(raw) {
    const qEarth = STAB.gravityArbiter ? (this.gyro?.getOrientation() ?? null) : null;
    this.arb.active = !!qEarth;
    if (qEarth) {
      const was = this.arb.flipped;
      arbitrateUpright(raw.p, raw.q, qEarth, STAB.arbiterMargin, this.arb);
      if (this.arb.flipped !== was) this.flipCount++;
    } else {
      this.arb.flipped = false;
    }
  }

  /* ---- SCALE-LOCK (#9, MindAR-Stand 2026-07-14) -----------------------------
     Die Anchor-Scale ist strukturell KONSTANT (Entfernung steckt in der
     Translation, nie in der Scale). Jede Abweichung war unter MindAR ein
     ARTEFAKT (elementweiser Matrix-Filter → nicht-starre Zwischenmatrizen;
     Fehl-Homographien → „Figur schräg/zu groß"): kleine Abweichung →
     eingefrorene Scale, große → Frame verwerfen.
     UNTER 8TH WALL (2026-09-15): arSession.js setzt die Scale aus detail.scale ×
     scaledWidth, und detail.scale ist pro Track konstant — die Stufe löst
     strukturell nie aus (Re-Lock-Zähler in ?stats bleibt 0). Bleibt als
     Sicherung; Ausbau ist ein Stufe-3-Punkt nach Prüfung am Gerät.
     Liefert false, wenn der Frame zu verwerfen ist. */
  lockScale(raw, now) {
    if (!STAB.scaleLock || !this.hasScaleLock) return true;
    if (Math.abs(raw.s.x - this.scaleLock) / this.scaleLock > STAB.scaleOutlier) {
      // RE-LOCK (2026-09-07): hält die Abweichung scaleRelockMs am Stück an, war
      // der Lock selbst falsch (schlechter Aufsetz-Frame) → neu aufsetzen, mit
      // Median über die nächsten Messungen. Einzelne Ausreißer weiter verwerfen.
      if (!this.outlierSinceMs) this.outlierSinceMs = now;
      else if (now - this.outlierSinceMs > STAB.scaleRelockMs) {
        this.outlierSinceMs = 0;
        this.initialised = false;
        this.hasScaleLock = false;
        this.acq = null;
        this.relockCount++;
      }
      return false;
    }
    this.outlierSinceMs = 0;
    raw.s.setScalar(this.scaleLock);
    return true;
  }

  /* ---- EINHEITEN-NORMIERUNG (#2, Prüfstand-Befund 2026-07-08) ---------------
     Gefiltert wird in KARTENBREITEN (pos / scale) — damit sind posDeadZone/beta
     einheitenfest, egal in welcher Einheit der Tracker liefert (8th Wall:
     Anchor-Scale = Kartenbreite in Szenen-Einheiten ≈ 0,06; MindAR: Target-
     Pixelbreite, Position z. B. z ≈ −4500). */
  normalize(raw) {
    if (STAB.normalize) raw.p.divideScalar(raw.s.x);
  }

  /* ---- Aufsetzen: Filterzustand aus der Median-Pose ------------------------- */
  initialise(raw, now) {
    this.xPrev.copy(raw.p);
    this.dxPrev.set(0, 0, 0);
    this.smoothPos.copy(raw.p);
    this.smoothQuat.copy(raw.q);
    this.lastScale.copy(raw.s);
    this.scaleLock = raw.s.x; // Scale einfrieren (#9) — aus dem Median der Aufsetz-Messungen
    this.hasScaleLock = true;
    this.outlierSinceMs = 0;
    this.measPos.copy(raw.p);
    this.measQuat.copy(raw.q);
    this.measT = now;
    this.hasMeas = true;
    this.rawPrev.copy(raw.p);
    this.rawPrevQ.copy(raw.q);
    this.hasRaw = true;
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.moving = false;
    this.snapOld.ok = false;
    this.snapNew.ok = false;
    this.driftSpeed = 0;
    this.driftAngSpeed = 0;
    this.farCount = 0;
    this.initialised = true;
    this.write();
  }

  /* Aufsetz-Sammler (2026-09-07): NEUE Messungen (Rohpose ändert sich) in den
     Puffer, bis acquireFrames erreicht sind oder acquireMaxMs vergangen (min.
     3 Messungen). Schreibt den laufenden Median in p/q/s. true = noch sammeln. */
  acquire(p, q, s, now) {
    if (!this.acq) this.acq = { samples: [], startMs: now, lastRaw: null, skipCurrent: false };
    const a = this.acq;
    const isNew = !a.lastRaw || p.distanceTo(a.lastRaw.p) > 1e-6 || a.lastRaw.q.angleTo(q) > 1e-6;
    if (isNew) {
      if (a.skipCurrent) a.skipCurrent = false; // alte Rohpose beim Re-Tap überspringen
      else a.samples.push({ p: p.clone(), q: q.clone(), s: s.x });
      a.lastRaw = { p: p.clone(), q: q.clone() };
    }
    const n = a.samples.length;
    if (n === 0) { this.write(); return true; } // noch keine frische Messung → alte Pose halten
    const frames = Math.max(1, STAB.acquireFrames | 0);
    const done = n >= frames || (n >= 3 && now - a.startMs > STAB.acquireMaxMs);
    this.medianOf(a.samples, p, q, s);
    if (done) { this.acq = null; return false; }
    // Zwischenstand: laufender Median steht sichtbar auf der Karte
    this.smoothPos.copy(p);
    this.smoothQuat.copy(q);
    this.lastScale.copy(s);
    this.write();
    return true;
  }
  /* Median je Positionsachse + Median-Scale; Rotation als MEDOID (die Messung
     mit der kleinsten Winkelsumme zu allen anderen — kein Mitteln von
     Quaternionen nötig, ein Ausreißer gewinnt nie). */
  medianOf(samples, p, q, s) {
    const med = (arr) => {
      const a = arr.slice().sort((x, y) => x - y);
      const m = a.length >> 1;
      return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
    };
    p.set(med(samples.map((x) => x.p.x)), med(samples.map((x) => x.p.y)), med(samples.map((x) => x.p.z)));
    s.setScalar(med(samples.map((x) => x.s)));
    let best = 0, bestSum = Infinity;
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      for (let j = 0; j < samples.length; j++) if (i !== j) sum += samples[i].q.angleTo(samples[j].q);
      if (sum < bestSum) { bestSum = sum; best = i; }
    }
    q.copy(samples[best].q);
  }

  /* ---- Bewegungs-Schätzung (2026-07-09) ---------------------------------------
     Die Bilderkennung misst nur mit ~15–30 Hz; dazwischen wiederholt der Anchor
     die alte Pose → Treppensignal beim Karte-Bewegen. Hier: neue Vision-Messung
     erkennen (ROHPOSE unterscheidet sich von der letzten — ungedreht, damit die
     Gyro-Prediction keine Fehl-Messungen erzeugt) und lineare + Winkel-
     Geschwindigkeit schätzen (geglättet, 50/50-Lerp). Die Geschwindigkeit selbst
     wird gegen die GYRO-KOMPENSIERTE measPos gerechnet — Kamera-Drehung ist
     damit herausgerechnet, übrig bleibt die echte Karten-Bewegung. */
  updateMotionEstimate(raw, now) {
    // Vision-Hz-Fenster (für ?stats)
    if (now - this.hzWindowT > 1000) {
      this.visionHz = this.measCount;
      this.measCount = 0;
      this.hzWindowT = now;
    }

    const isNew = !this.hasRaw ||
      raw.p.distanceTo(this.rawPrev) > 1e-6 || this.rawPrevQ.angleTo(raw.q) > 1e-6;
    this.rawPrev.copy(raw.p);
    this.rawPrevQ.copy(raw.q);
    this.hasRaw = true;
    if (!isNew) return; // stale Frame — die Engine hat nicht neu gemessen
    this.measCount++;
    this.diag.newMeas = true;
    this.diag.rawPos.copy(raw.p);
    this.diag.rawQuat.copy(raw.q);

    // AUSREISSER-DEBOUNCE + Snap (#6, 2026-07-13): Messung weit weg vom
    // Glättungszustand? EINE solche Messung ist meist ein Fehlgriff unter
    // Bewegungsunschärfe → verwerfen (weder Geschwindigkeit noch Snap daraus).
    // Erst die ZWEITE ferne Messung in Folge gilt als echt (Re-Found nach
    // Drift) → Filter snappt neu auf.
    const far = this.smoothPos.distanceTo(raw.p) > STAB.snapDist ||
                this.smoothQuat.angleTo(raw.q) > STAB.snapAngle;
    if (far) {
      this.farCount++;
      if (this.farCount >= 2 && STAB.snap) {
        this.initialised = false; // nächster Tick setzt hart neu auf
        this.snapCount++;
      }
      return; // Ausreißer (oder Snap folgt) — Messung nicht in vel/meas übernehmen
    }
    this.farCount = 0;

    const dtMeas = Math.min(0.5, Math.max(0.02, (now - this.measT) / 1000));

    // RAUSCH-SCHWELLE (Fix 2026-07-13): Verschiebungen unterhalb der Dead-Zone
    // sind Mess-Rauschen — daraus KEINE Geschwindigkeit schätzen, sondern die
    // Schätzung abklingen lassen. Sonst hält Ruhe-Rauschen den Bewegt-Modus
    // fälschlich am Leben und die Latenz-Kompensation VERSTÄRKT das Rauschen.
    const dPosMeas = raw.p.distanceTo(this.measPos);
    if (dPosMeas > STAB.posDeadZone) {
      const vx = (raw.p.x - this.measPos.x) / dtMeas;
      const vy = (raw.p.y - this.measPos.y) / dtMeas;
      const vz = (raw.p.z - this.measPos.z) / dtMeas;
      if (Number.isFinite(vx)) this.vel.lerp({ x: vx, y: vy, z: vz }, 0.5);
      // Spike-Kappe: mehr als maxSpeed ist keine Hand mehr, sondern Messfehler
      if (this.vel.length() > STAB.maxSpeed) this.vel.setLength(STAB.maxSpeed);
    } else {
      this.vel.multiplyScalar(0.5);
    }

    // Winkel: dq = meas⁻¹ ⊗ neu → Achse*Winkel/Zeit (im Mess-lokalen Frame)
    _dq.copy(this.measQuat).invert().multiply(raw.q);
    if (_dq.w < 0) { _dq.x *= -1; _dq.y *= -1; _dq.z *= -1; _dq.w *= -1; } // kürzester Weg
    const s = Math.sqrt(Math.max(0, 1 - _dq.w * _dq.w));
    const angMeas = 2 * Math.acos(Math.min(1, _dq.w));
    if (s > 1e-6 && angMeas > STAB.rotDeadZone) {
      _axis.set(_dq.x / s, _dq.y / s, _dq.z / s).multiplyScalar(angMeas / dtMeas);
      this.angVel.lerp(_axis, 0.5);
      if (this.angVel.length() > STAB.maxAngSpeed) this.angVel.setLength(STAB.maxAngSpeed);
    } else {
      this.angVel.multiplyScalar(0.5);
    }

    this.measPos.copy(raw.p);
    this.measQuat.copy(raw.q);
    this.measT = now;

    // Drift-Fenster fortschreiben (Snapshots alle ~250 ms)
    if (!this.snapNew.ok) {
      this.snapNew.p.copy(raw.p); this.snapNew.q.copy(raw.q);
      this.snapNew.t = now; this.snapNew.ok = true;
    } else if (now - this.snapNew.t > 250) {
      this.snapOld.p.copy(this.snapNew.p); this.snapOld.q.copy(this.snapNew.q);
      this.snapOld.t = this.snapNew.t; this.snapOld.ok = true;
      this.snapNew.p.copy(raw.p); this.snapNew.q.copy(raw.q); this.snapNew.t = now;
    }
    if (this.snapOld.ok) {
      const dtW = Math.max(0.1, (now - this.snapOld.t) / 1000);
      // Geglättet (EMA): einzelne Tremor-Spitzen am Fensterrand dürfen den
      // Bewegt-Modus nicht zünden; echte Bewegung hebt das Signal in ~200 ms.
      this.driftSpeed += (raw.p.distanceTo(this.snapOld.p) / dtW - this.driftSpeed) * 0.25;
      this.driftAngSpeed += (this.snapOld.q.angleTo(raw.q) / dtW - this.driftAngSpeed) * 0.25;
    }
  }

  /* ---- Extrapolation (#8): Ziel-Pose zwischen den Messungen vorhersagen ------
     Überschreibt raw.p/raw.q mit der Prediction. Liefert true, wenn die Karte
     gerade als „in Bewegung" gilt — das schaltet die Dead-Zones ab und öffnet
     den beta-Term des One-Euro-Filters.

     HYSTERESE + VERWEILZEIT (2026-07-13): Einschalten ab minSpeed, Ausschalten
     erst unter der HALBEN Schwelle UND nachdem moveDwellMs lang keine
     Bewegung mehr über der Einschalt-Schwelle war — kein Regime-Flackern an
     der Grenze mehr (das war das „produziert zu schnell wieder Zittern").

     LATENZ-KOMPENSATION (2026-07-13): Jede Vision-Messung ist bei Ankunft
     schon ~latencyMs alt (Verarbeitungszeit) — die Prediction rechnet dieses
     Alter mit ein, sonst läuft die Figur der Karte konstant hinterher. */
  applyExtrapolation(raw, now) {
    // Bewegt-Entscheidung über die FENSTER-DRIFT (tremor-fest), nicht über
    // die Momentan-Geschwindigkeit (die dient nur der Vorhersage selbst).
    const speed = this.driftSpeed;
    const angSpeed = this.driftAngSpeed;
    const above = speed > STAB.minSpeed || angSpeed > STAB.minAngSpeed;
    const wasMoving = this.moving;
    if (above) {
      this.moving = true;
      this.lastAboveMs = now;
    } else if (this.moving && now - this.lastAboveMs > STAB.moveDwellMs) {
      // Rückfall: dwellMs lang KEIN Überschreiten mehr → zurück in Ruhe.
      // (Kein „Band-Halten" mehr — das hielt den Bewegt-Modus bei Tremor
      // dauerhaft fest, Diagnose 2026-07-13: 100 % Bewegt-Quote in Ruhe.)
      this.moving = false;
    }
    const moving = this.moving;
    if (moving !== wasMoving) this.diag.modeSwitches++;
    if (above) {
      const p = speed > STAB.minSpeed, a = angSpeed > STAB.minAngSpeed;
      this.diag.moveCause = p && a ? "beide" : p ? "Pos" : "Winkel";
    }
    if (!STAB.extrapolate || !moving) return moving;
    const tp = (Math.min(now - this.measT, STAB.extrapMaxMs) + STAB.latencyMs) / 1000;
    if (tp <= 0) return moving;
    // VORHERSAGE-KAPPEN (2026-07-13): Strecke und Winkel der Prediction hart
    // begrenzen — ein Überschwinger Richtung Kamera wirkt sonst wie eine
    // Größen-Explosion der Figur, ein Winkel-Überschwinger wie Schrägstand.
    const dist = Math.min(this.vel.length() * tp, STAB.extrapMaxDist);
    if (dist > 1e-7 && this.vel.lengthSq() > 0) {
      _axis.copy(this.vel).normalize();
      raw.p.copy(this.measPos).addScaledVector(_axis, dist);
    }
    const ang = Math.min(this.angVel.length() * tp, STAB.extrapMaxAngle);
    if (ang > 1e-5) {
      _axis.copy(this.angVel).normalize();
      _predQ.setFromAxisAngle(_axis, ang);
      raw.q.copy(this.measQuat).multiply(_predQ);
    }
    return moving;
  }

  /* ---- One-Euro auf die Position (pro Achse) + Dead-Zone (#3) ----------------
     beta-GATE (2026-07-14): Die Frame-Ableitung dxHat wird in Ruhe NIE ~0 —
     das 15–30-Hz-Treppensignal springt bei jeder neuen Messung über ein
     16-ms-Render-dt (dxRaw-Spikes von 0.3+ KB/s), dCutoff hält dxHat auf
     Rausch-Niveau → beta·dxHat öffnete den Filter in Ruhe DAUERHAFT auf
     1–2 Hz („wirkt, als gäbe es keinen Filter", egal wie klein minCutoff).
     Fix: Der beta-Term greift nur im BEWEGT-Modus — die Entscheidung trifft
     der tremor-feste 250-ms-Drift-Detektor, nicht die verrauschte Ableitung.
     Ruhe = purer minCutoff (hartes Glätten), Bewegung = adaptiv wie gehabt.
     Dead-Zone: winzige Restbewegung verwerfen (nur im RUHE-Zustand). */
  filterPosition(p, dt, moving) {
    this.oneEuro(p, this.smoothPos, dt, moving);
    const dzOn = STAB.deadZones;
    if (dzOn && !moving && this.smoothPos.distanceTo(this.xPrev) < STAB.posDeadZone) {
      this.smoothPos.copy(this.xPrev);
    } else {
      this.xPrev.copy(this.smoothPos);
    }
  }

  /* ---- ADAPTIVE Rotations-Glättung (One-Euro-Prinzip, 2026-07-13) ------------
     Vorher fixer SLERP-Faktor: ließ in Ruhe 35 % des Rotations-Rauschens
     durch und hing bei schnellen Drehungen nach. Jetzt: Cutoff wächst mit
     der gemessenen Winkelgeschwindigkeit — Ruhe = dicht, Drehung = wach.
     Dead-Zone (#3) auch hier nur in Ruhe. */
  filterRotation(q, dt, moving) {
    const dzOn = STAB.deadZones;
    const angle = this.smoothQuat.angleTo(q);
    if (angle > STAB.rotDeadZone || moving || !dzOn) {
      const rotCutoff = STAB.rotMinCutoff + STAB.rotBeta * this.angVel.length();
      const t = Math.min(1, this.alpha(dt, rotCutoff));
      this.smoothQuat.slerp(q, t);
    }
  }

  /* Kamera hat sich um dq gedreht (Kamera-Frame) → Karten-Pose im Kamera-
     Frame entsprechend gegenrotieren: R' = dq⁻¹⊗R, p' = dq⁻¹·p. Wirkt auf
     den GEGLÄTTETEN Zustand + Filter-Historie (xPrev/dxPrev mitdrehen). */
  applyCameraDelta(dq) {
    // Dead-Band + Glitch-Filter leben seit 2026-07-14 in GyroFusion.getDelta()
    // (Akkumulations-Schwelle statt pro-Frame-Verwerfen, Finding 4) — hier
    // kommt nur noch Anwendbares an.
    this.diag.gyroApplied++;
    _dqInv.copy(dq).invert();
    this.smoothQuat.premultiply(_dqInv);
    this.smoothPos.applyQuaternion(_dqInv);
    this.xPrev.applyQuaternion(_dqInv);
    this.dxPrev.applyQuaternion(_dqInv);
    // Bewegungs-Schätzung + Drift-Snapshots mitdrehen (Kamera-Frame gedreht)
    this.measPos.applyQuaternion(_dqInv);
    this.measQuat.premultiply(_dqInv);
    this.vel.applyQuaternion(_dqInv);
    if (this.snapOld.ok) { this.snapOld.p.applyQuaternion(_dqInv); this.snapOld.q.premultiply(_dqInv); }
    if (this.snapNew.ok) { this.snapNew.p.applyQuaternion(_dqInv); this.snapNew.q.premultiply(_dqInv); }
    // Aufsetz-Puffer mitdrehen, damit der Median bei Kameradrehung konsistent bleibt
    if (this.acq) for (const x of this.acq.samples) { x.p.applyQuaternion(_dqInv); x.q.premultiply(_dqInv); }
  }

  oneEuro(targetV, out, dt, open) {
    for (const a of ["x", "y", "z"]) {
      const dxRaw = (targetV[a] - this.xPrev[a]) / Math.max(dt, 1e-4);
      const aD = this.alpha(dt, STAB.dCutoff);
      const dxHat = this.dxPrev[a] + aD * (dxRaw - this.dxPrev[a]);
      this.dxPrev[a] = dxHat;
      // beta nur bei Bewegung (Drift-Detektor) — s. Kommentar an filterPosition
      const cutoff = open ? STAB.minCutoff + STAB.beta * Math.abs(dxHat) : STAB.minCutoff;
      const aPos = this.alpha(dt, cutoff);
      out[a] = this.xPrev[a] + aPos * (targetV[a] - this.xPrev[a]);
    }
  }

  alpha(dt, cutoff) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /* Geglätteten Zustand nach stabRoot schreiben. smoothPos ist in Kartenbreiten
     normiert → zurück in Anchor-Einheiten. */
  write() {
    _wp.copy(this.smoothPos);
    if (STAB.normalize) _wp.multiplyScalar(this.lastScale.x);
    this.target.matrix.compose(_wp, this.smoothQuat, this.lastScale);
    this.target.matrixWorldNeedsUpdate = true;
  }
}
