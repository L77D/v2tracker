/* =============================================================================
   DETAR — Tracker (neu, Build 91, 2026-10-09): messgetriebener Nachfolger des
   PoseStabilizers für die 8th-Wall-Engine. Umschaltbar per ?tracker=neu
   (js/arSession.js); Standard bleibt bis zum Gerätevergleich der alte
   js/poseStabilizer.js. Beide bedienen dieselbe Schnittstelle nach außen
   (onFound, onLost, reacquire, tick, snapshot) — dieser hier zusätzlich
   measure(), das arSession bei JEDER neuen Messung ruft (reality.imagefound /
   reality.imageupdated).

   ZWEI TAKTE, GETRENNT:
   • measure(matrix)  — eine neue Vision-Messung (20–30 Hz): NaN-Schutz,
     Schwerkraft-Schiedsrichter, Ausreißer-Regel (s. u.), One-Euro für Position und
     Rotation MIT DEM MESSTAKT als dt (die Ableitung ist damit eine echte
     Geschwindigkeit), Dead-Zones in Ruhe, Bewegt-Modus aus dem tremor-festen
     250-ms-Drift-Fenster. Der beta-Term des One-Euro wirkt NUR im Bewegt-
     Modus: beta 10 ist als Öffnung bei Bewegung kalibriert; in Ruhe würde
     schon das Messrauschen (≈0,1 Kartenbreiten/s bei 0,2 mm) den Filter auf
     ~0,6 Hz öffnen (Befund Szenario 2026-10-09). Ruhe = reiner minCutoff.
   • tick()           — jeder Render-Frame (60 Hz): Gyro-Delta auf den Zustand,
     Verlust-Haltung (Brücke, solange das Gyro LEBT, sonst kurz), gedeckelte
     Extrapolation nur im Bewegt-Modus, schreiben nach stabRoot.

   WAS GEGENÜBER DEM ALTEN FILTER WEGFÄLLT (und warum):
   • Stale-Erkennung (rawPrev/hasRaw): das Ereignis sagt, wann eine Messung neu
     ist — die Engine feuert imageupdated nur bei geänderter Pose.
   • Scale-Lock + Re-Lock: die Anchor-Scale ist unter 8th Wall per Konstruktion
     konstant (arSession: detail.scale × scaledWidth).
   • Normierungsstufe: die Position wird beim Messen einmal in Kartenbreiten
     umgerechnet und beim Schreiben zurück.
   • Haltezeit bei Verlust hängt nicht mehr am einzelnen Gyro-Delta (das fehlt
     bei ganz ruhiger Hand wegen des Dead-Bands), sondern an „Gyro lebt"
     (getOrientation() liefert) UND Schalter 7.
   • Der Schiedsrichter entscheidet nur auf echten Messungen — kein Kippen
     zwischen zwei identischen Rohposen.
   • Eine einzelne ferne Messung wird GEHALTEN statt gefiltert (vorher zog
     sie die Rotation mit ~5 %/Frame über drei Frames nach — im Vergleichs-
     szenario 2,5 mm und 7°).
   • AUSREISSER-REGEL neu definiert (2026-10-09): ein Ausreißer ist ein SPRUNG
     GEGENÜBER DER LETZTEN MESSUNG (snapDist/snapAngle), nicht „fern vom
     geglätteten Zustand". Fern vom Zustand, aber zusammenhängend mit der
     letzten Messung heißt: der Filter hinkt (Anfahrt aus der Ruhe, Re-Found
     nach der Gyro-Brücke) → Bewegt-Modus erzwingen, Filter öffnet und holt
     auf. Der alte Filter snappt in diesem Fall (Goldstandard-Szenario: neun
     Snaps bei 5 cm/s Anfahrt, Figur springt statt zu folgen). Ein Sprung,
     dem eine zusammenhängende Messung folgt, ist echt → Snap + Median.

   SCHALTER (config.js STAB/GYRO, Dev-Panel 1–10): 1 enabled (nein = Rohpose
   1:1), 3 deadZones, 4 lostHold, 6 snap, 7 GYRO.enabled, 8 extrapolate,
   10 gravityArbiter. OHNE WIRKUNG hier: 2 normalize (immer Kartenbreiten),
   5 nanGuard (immer an), 9 scaleLock (entfällt). Die Zahlenwerte (minCutoff,
   beta, rotMinCutoff, rotBeta, Dead-Zones, Snap-Schwellen, Drift-Schwellen,
   Extrapolations-Kappen, acquireFrames/MaxMs, latencyMs) sind dieselben wie
   beim alten Filter; One-Euro-Cutoffs sind in Hz und damit taktunabhängig —
   Feinabstimmung am Gerät bleibt offen (CLAUDE.md „Tracker neu").

   Einheiten: intern Kartenbreiten; `scale` = Anchor-Scale der letzten Messung
   (Kartenbreite in Szeneneinheiten), beim Schreiben wieder angewendet.
   Kein DOM, in Node testbar (tests/tracker.test.mjs, Szenario gemeinsam mit
   dem alten Filter: tests/stabilizerSzenario.mjs).
   ============================================================================= */
import * as THREE from "../vendor/three/three.module.js";
import { STAB, GYRO } from "./config.js";
import { arbitrateUpright } from "./poseArbiter.js";
import { finiteVec, finiteQuat } from "./util.js";

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _wp = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3();
const _dqInv = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const _axis = new THREE.Vector3(), _predQ = new THREE.Quaternion();

export class Tracker {
  /**
   * @param target stabRoot (Kind der Kamera, trägt die Figur)
   * @param gyro   optionale GyroFusion (getDelta → Kompensation, getOrientation → Schiedsrichter + „lebt")
   */
  constructor(target, gyro = null) {
    this.target = target;
    this.gyro = gyro;
    this.target.matrixAutoUpdate = false;
    this.target.visible = false;
    this.scale = 1;              // Anchor-Scale (Kartenbreite in Szeneneinheiten) der letzten Messung

    // Geglätteter Zustand (Kartenbreiten, Kamera-Frame)
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.hasPose = false;        // etwas zum Zeigen (laufender Median oder Filterzustand)
    this.initialised = false;    // Filter aufgesetzt (Median steht)
    this.acq = null;             // Aufsetz-Puffer { samples: [{p,q}], startMs }
    // One-Euro Position: vorherige Ausgabe + geglättete Ableitung
    this.xPrev = new THREE.Vector3();
    this.dxPrev = new THREE.Vector3();
    // Letzte echte Messung + Geschwindigkeiten (für Drift, Extrapolation, Rotations-Cutoff)
    this.measPos = new THREE.Vector3();
    this.measQuat = new THREE.Quaternion();
    this.measT = 0;
    this.vel = new THREE.Vector3();      // Kartenbreiten/s
    this.angVel = new THREE.Vector3();   // Achse·rad/s im Mess-lokalen Frame
    this.farCount = 0;
    this.rawLast = { p: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false }; // letzte Messung (auch gehaltene)
    this.held = { p: new THREE.Vector3(), q: new THREE.Quaternion() };               // gehaltener Ausreißer-Kandidat
    // Bewegt-Modus (Drift-Fenster ~250 ms, Hysterese über Verweilzeit)
    this.snapOld = { p: new THREE.Vector3(), q: new THREE.Quaternion(), t: 0, ok: false };
    this.snapNew = { p: new THREE.Vector3(), q: new THREE.Quaternion(), t: 0, ok: false };
    this.driftSpeed = 0;
    this.driftAngSpeed = 0;
    this.moving = false;
    this.lastAboveMs = 0;
    // Tracking-Status
    this.tracking = false;
    this.everVisible = false;
    this.lastSeenMs = 0;
    // Diagnose (?stats) — Felder wie beim PoseStabilizer, gelesen über snapshot()
    this.arb = { flipped: false, zRaw: 0, zChosen: 0, tiltDeg: 0, active: false };
    this.flipCount = 0;
    this.relocCount = 0;
    this.snapCount = 0;
    this.rawSkewDeg = 0;
    this.rawOffset = 0;
    this.diag = { newMeas: false, rawPos: new THREE.Vector3(), rawQuat: new THREE.Quaternion(),
      modeSwitches: 0, moveCause: "—", nanCount: 0, gyroApplied: 0 };
    this.newMeasFrame = false;
    this.measCount = 0;
    this.hzWindowT = 0;
    this.visionHz = null;
    this.snap = {};
  }

  /* ---- Ereignisse von außen ---------------------------------------------- */
  onFound() {
    // War die Figur schon ausgeblendet, neu aufsetzen (Median über die nächsten
    // Messungen); war sie noch sichtbar (Brücke), weich weiterkorrigieren.
    if (this.everVisible && !this.target.visible) { this.initialised = false; this.acq = null; }
    this.tracking = true;
    this.everVisible = true;
    this.lastSeenMs = performance.now();
    this.target.visible = true;
  }

  onLost() {
    this.tracking = false;
  }

  /* Neu aufsetzen auf Nutzer-Tap: Median über die nächsten Messungen. Die
     alte Pose steht, bis der erste Median da ist. (Anders als beim alten
     Filter zählt jede Messung — es gibt keine anstehende Rohpose von vor dem Tap.) */
  reacquire() {
    this.initialised = false;
    this.acq = null;
    this.relocCount++;
  }

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
    s.relockCount = 0; // gibt es hier nicht
    s.flipCount = this.flipCount;
    s.nanCount = d.nanCount;
    s.modeSwitches = d.modeSwitches;
    s.gyroApplied = d.gyroApplied;
    s.arb = this.arb;
    return s;
  }

  /* ---- Eine neue Vision-Messung ------------------------------------------- */
  /** @param matrix kamera-relative Karten-Pose (arSession: anchor.matrix), Scale = Kartenbreite */
  measure(matrix, now = performance.now()) {
    matrix.decompose(_p, _q, _s);
    if (!finiteVec(_p) || !finiteQuat(_q) || !finiteVec(_s) || _s.x < 1e-8) { this.diag.nanCount++; return; }
    this.scale = _s.x;
    _p.divideScalar(_s.x); // → Kartenbreiten
    this.measCount++;
    this.newMeasFrame = true;

    this.arbitrate(_p, _q);
    this.diag.rawPos.copy(_p);
    this.diag.rawQuat.copy(_q);
    // Sprung gegenüber der letzten Messung (auch während Aufsetzen/Durchreichen
    // mitführen, damit die Ausreißer-Regel direkt nach dem Median greift)
    const sprung = this.rawLast.ok && (this.rawLast.p.distanceTo(_p) > STAB.snapDist || this.rawLast.q.angleTo(_q) > STAB.snapAngle);
    this.rawLast.p.copy(_p); this.rawLast.q.copy(_q); this.rawLast.ok = true;

    if (!STAB.enabled) { // Schalter 1: Rohpose 1:1
      this.pos.copy(_p); this.quat.copy(_q);
      this.hasPose = true; this.initialised = true; this.moving = false;
      return;
    }
    if (!this.initialised) { this.acquire(_p, _q, now); return; }

    this.rawSkewDeg = (_q.angleTo(this.quat) * 180) / Math.PI;
    this.rawOffset = _p.distanceTo(this.pos);

    // AUSREISSER-REGEL (s. Kopf): Sprung gegenüber der LETZTEN Messung → halten.
    // Folgt darauf eine zusammenhängende Messung, die ebenfalls fern vom Zustand
    // liegt, war der Sprung echt → Snap (neu aufsetzen, beide als erste Proben).
    // Fern vom Zustand ohne Sprung → der Filter hinkt → Bewegt-Modus erzwingen.
    const fernVomZustand = this.pos.distanceTo(_p) > STAB.snapDist || this.quat.angleTo(_q) > STAB.snapAngle;
    const gehalten = this.farCount > 0;
    if (fernVomZustand) {
      if (sprung) { this.held.p.copy(_p); this.held.q.copy(_q); this.farCount = 1; return; } // Kandidat: halten
      if (gehalten && STAB.snap) {                            // zweite zusammenhängende Messung: echt
        this.snapCount++;
        this.farCount = 0;
        this.initialised = false; this.acq = null;
        this.acquire(this.held.p, this.held.q, now);
        this.acquire(_p, _q, now);
        return;
      }
      this.erzwingeBewegt(now);                               // Filter hinkt → öffnen und aufholen
    }
    this.farCount = 0;

    const dtMeas = Math.min(0.5, Math.max(0.02, (now - this.measT) / 1000));
    this.estimateMotion(_p, _q, dtMeas, now);
    const moving = this.updateMode(now);

    // One-Euro Position (dt = Messabstand; beta nur im Bewegt-Modus, s. Kopf)
    // + Dead-Zone in Ruhe
    this.oneEuro(_p, dtMeas, moving);
    if (STAB.deadZones && !moving && this.pos.distanceTo(this.xPrev) < STAB.posDeadZone) this.pos.copy(this.xPrev);
    else this.xPrev.copy(this.pos);

    // Adaptive Rotation: Cutoff wächst mit der Winkelgeschwindigkeit; Dead-Zone in Ruhe
    const angle = this.quat.angleTo(_q);
    if (angle > STAB.rotDeadZone || moving || !STAB.deadZones) {
      const cutoff = STAB.rotMinCutoff + STAB.rotBeta * this.angVel.length();
      this.quat.slerp(_q, Math.min(1, this.alpha(dtMeas, cutoff)));
    }

    this.measPos.copy(_p);
    this.measQuat.copy(_q);
    this.measT = now;
  }

  /* Schwerkraft-Schiedsrichter (poseArbiter.js): nur auf echten Messungen. */
  arbitrate(p, q) {
    const qEarth = STAB.gravityArbiter ? (this.gyro?.getOrientation() ?? null) : null;
    this.arb.active = !!qEarth;
    if (!qEarth) { this.arb.flipped = false; return; }
    const was = this.arb.flipped;
    arbitrateUpright(p, q, qEarth, STAB.arbiterMargin, this.arb);
    if (this.arb.flipped !== was) this.flipCount++;
  }

  /* Aufsetzen per Median: Messungen sammeln bis acquireFrames bzw. acquireMaxMs
     (mind. 3); solange steht der laufende Median sichtbar auf der Karte. */
  acquire(p, q, now) {
    if (!this.acq) this.acq = { samples: [], startMs: now };
    const a = this.acq;
    a.samples.push({ p: p.clone(), q: q.clone() });
    const n = a.samples.length;
    const frames = Math.max(1, STAB.acquireFrames | 0);
    const done = n >= frames || (n >= 3 && now - a.startMs > STAB.acquireMaxMs);
    this.medianOf(a.samples, this.pos, this.quat);
    this.hasPose = true;
    if (!done) return;
    this.acq = null;
    this.xPrev.copy(this.pos);
    this.dxPrev.set(0, 0, 0);
    this.measPos.copy(this.pos);
    this.measQuat.copy(this.quat);
    this.measT = now;
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.farCount = 0;
    this.snapOld.ok = false; this.snapNew.ok = false;
    this.driftSpeed = 0; this.driftAngSpeed = 0;
    if (this.moving) this.diag.modeSwitches++;
    this.moving = false;
    this.initialised = true;
  }
  /* Median je Achse, Rotation als Medoid (kleinste Winkelsumme — ein Ausreißer gewinnt nie). */
  medianOf(samples, p, q) {
    const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    p.set(med(samples.map((x) => x.p.x)), med(samples.map((x) => x.p.y)), med(samples.map((x) => x.p.z)));
    let best = 0, bestSum = Infinity;
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      for (let j = 0; j < samples.length; j++) if (i !== j) sum += samples[i].q.angleTo(samples[j].q);
      if (sum < bestSum) { bestSum = sum; best = i; }
    }
    q.copy(samples[best].q);
  }

  /* Geschwindigkeiten aus zwei Messungen (50/50-Lerp, Spike-Kappen) + Drift-Fenster. */
  estimateMotion(p, q, dtMeas, now) {
    if (p.distanceTo(this.measPos) > STAB.posDeadZone) {
      const vx = (p.x - this.measPos.x) / dtMeas, vy = (p.y - this.measPos.y) / dtMeas, vz = (p.z - this.measPos.z) / dtMeas;
      if (Number.isFinite(vx)) this.vel.lerp({ x: vx, y: vy, z: vz }, 0.5);
      if (this.vel.length() > STAB.maxSpeed) this.vel.setLength(STAB.maxSpeed);
    } else {
      this.vel.multiplyScalar(0.5);
    }
    _dq.copy(this.measQuat).invert().multiply(q);
    if (_dq.w < 0) { _dq.x *= -1; _dq.y *= -1; _dq.z *= -1; _dq.w *= -1; }
    const s = Math.sqrt(Math.max(0, 1 - _dq.w * _dq.w));
    const ang = 2 * Math.acos(Math.min(1, _dq.w));
    if (s > 1e-6 && ang > STAB.rotDeadZone) {
      _axis.set(_dq.x / s, _dq.y / s, _dq.z / s).multiplyScalar(ang / dtMeas);
      this.angVel.lerp(_axis, 0.5);
      if (this.angVel.length() > STAB.maxAngSpeed) this.angVel.setLength(STAB.maxAngSpeed);
    } else {
      this.angVel.multiplyScalar(0.5);
    }
    // Drift-Fenster (Snapshots alle ~250 ms), geglättet — Tremor pendelt, Bewegung akkumuliert
    if (!this.snapNew.ok) {
      this.snapNew.p.copy(p); this.snapNew.q.copy(q); this.snapNew.t = now; this.snapNew.ok = true;
    } else if (now - this.snapNew.t > 250) {
      this.snapOld.p.copy(this.snapNew.p); this.snapOld.q.copy(this.snapNew.q); this.snapOld.t = this.snapNew.t; this.snapOld.ok = true;
      this.snapNew.p.copy(p); this.snapNew.q.copy(q); this.snapNew.t = now;
    }
    if (this.snapOld.ok) {
      const dtW = Math.max(0.1, (now - this.snapOld.t) / 1000);
      this.driftSpeed += (p.distanceTo(this.snapOld.p) / dtW - this.driftSpeed) * 0.25;
      this.driftAngSpeed += (this.snapOld.q.angleTo(q) / dtW - this.driftAngSpeed) * 0.25;
    }
  }

  /* Der Filter hinkt hinter einer zusammenhängenden Messreihe her: wie Bewegung behandeln. */
  erzwingeBewegt(now) {
    if (!this.moving) this.diag.modeSwitches++;
    this.moving = true;
    this.lastAboveMs = now;
    this.diag.moveCause = "Nachlauf";
  }

  /* Bewegt-Modus: ein ab minSpeed/minAngSpeed, aus erst nach moveDwellMs ohne Überschreitung. */
  updateMode(now) {
    const speed = this.driftSpeed, angSpeed = this.driftAngSpeed;
    const above = speed > STAB.minSpeed || angSpeed > STAB.minAngSpeed;
    const was = this.moving;
    if (above) {
      this.moving = true; this.lastAboveMs = now;
      const p = speed > STAB.minSpeed, a = angSpeed > STAB.minAngSpeed;
      this.diag.moveCause = p && a ? "beide" : p ? "Pos" : "Winkel";
    } else if (this.moving && now - this.lastAboveMs > STAB.moveDwellMs) {
      this.moving = false;
    }
    if (this.moving !== was) this.diag.modeSwitches++;
    return this.moving;
  }

  oneEuro(target, dt, open) {
    for (const a of ["x", "y", "z"]) {
      const dxRaw = (target[a] - this.xPrev[a]) / Math.max(dt, 1e-4);
      const aD = this.alpha(dt, STAB.dCutoff);
      const dxHat = this.dxPrev[a] + aD * (dxRaw - this.dxPrev[a]);
      this.dxPrev[a] = dxHat;
      const aPos = this.alpha(dt, open ? STAB.minCutoff + STAB.beta * Math.abs(dxHat) : STAB.minCutoff);
      this.pos[a] = this.xPrev[a] + aPos * (target[a] - this.xPrev[a]);
    }
  }
  alpha(dt, cutoff) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /* ---- Jeder Render-Frame ------------------------------------------------- */
  tick() {
    const now = performance.now();
    this.diag.newMeas = this.newMeasFrame; // gilt für diesen Frame (?stats liest nach tick)
    this.newMeasFrame = false;
    if (now - this.hzWindowT > 1000) { this.visionHz = this.measCount; this.measCount = 0; this.hzWindowT = now; }

    const gyroOn = GYRO.enabled;
    const dq = this.gyro?.getDelta() ?? null; // jeden Frame abholen (hält GyroFusion frisch)
    if (dq && gyroOn && this.hasPose) this.applyCameraDelta(dq);

    if (!this.tracking) {
      // Haltezeit: Gyro LEBT (Lage kommt) → Brücke, die Figur bleibt gyro-geführt
      // auf der Karte; sonst nur kurzer Flacker-Schutz — eine eingefrorene
      // kamera-relative Pose klebt am Bildschirm (Fix 2026-07-08).
      const alive = gyroOn && !!(this.gyro?.getOrientation());
      const holdMs = !STAB.lostHold ? 0 : (alive ? GYRO.bridgeMs : STAB.lostHoldMs);
      if (this.everVisible && now - this.lastSeenMs > holdMs) this.target.visible = false;
      if (this.target.visible && this.hasPose) this.write(now);
      return;
    }
    this.lastSeenMs = now;
    if (this.moving && now - this.lastAboveMs > STAB.moveDwellMs) { this.moving = false; this.diag.modeSwitches++; }
    if (this.hasPose) this.write(now);
  }

  /* Kamera hat sich um dq gedreht → Zustand im Kamera-Frame gegenrotieren. */
  applyCameraDelta(dq) {
    this.diag.gyroApplied++;
    _dqInv.copy(dq).invert();
    this.quat.premultiply(_dqInv);
    this.pos.applyQuaternion(_dqInv);
    this.xPrev.applyQuaternion(_dqInv);
    this.dxPrev.applyQuaternion(_dqInv);
    this.measPos.applyQuaternion(_dqInv);
    this.measQuat.premultiply(_dqInv);
    this.vel.applyQuaternion(_dqInv);
    if (this.snapOld.ok) { this.snapOld.p.applyQuaternion(_dqInv); this.snapOld.q.premultiply(_dqInv); }
    if (this.snapNew.ok) { this.snapNew.p.applyQuaternion(_dqInv); this.snapNew.q.premultiply(_dqInv); }
    if (this.acq) for (const x of this.acq.samples) { x.p.applyQuaternion(_dqInv); x.q.premultiply(_dqInv); }
  }

  /* Zustand (+ Vorhersage im Bewegt-Modus) nach stabRoot schreiben. */
  write(now) {
    _wp.copy(this.pos);
    _wq.copy(this.quat);
    if (STAB.extrapolate && this.moving && this.initialised && this.tracking) {
      // Dead Reckoning bis zur nächsten Messung, inkl. Alter der letzten
      // Messung (latencyMs); Strecke und Winkel hart gedeckelt.
      const tp = (Math.min(now - this.measT, STAB.extrapMaxMs) + STAB.latencyMs) / 1000;
      if (tp > 0) {
        const dist = Math.min(this.vel.length() * tp, STAB.extrapMaxDist);
        if (dist > 1e-7 && this.vel.lengthSq() > 0) _wp.addScaledVector(_axis.copy(this.vel).normalize(), dist);
        const ang = Math.min(this.angVel.length() * tp, STAB.extrapMaxAngle);
        if (ang > 1e-5) { _predQ.setFromAxisAngle(_axis.copy(this.angVel).normalize(), ang); _wq.multiply(_predQ); }
      }
    }
    _wp.multiplyScalar(this.scale);
    _ws.setScalar(this.scale);
    this.target.matrix.compose(_wp, _wq, _ws);
    this.target.matrixWorldNeedsUpdate = true;
  }
}
