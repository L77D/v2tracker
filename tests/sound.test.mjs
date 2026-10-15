/* SoundDesign (js/sound.js): Tonplan des Anfangstons bubbleOpen() und die
   Ereignis-Zuordnung zu tiks — Characterization Test (Stand Build 110) mit
   gefälschtem AudioContext. tiks liest window.AudioContext beim Import → die
   Attrappe steht VOR dem Import. */
import { test } from "node:test";
import assert from "node:assert/strict";

const log = [];
class Param { constructor(v) { this.value = v; } setValueAtTime(v, t) { log.push(["set", +v.toFixed(4), +t.toFixed(4)]); } linearRampToValueAtTime(v, t) { log.push(["lin", v, +t.toFixed(4)]); } exponentialRampToValueAtTime(v, t) { log.push(["exp", v, +t.toFixed(4)]); } }
class Knoten { constructor(art) { this.art = art; this.gain = new Param(1); this.frequency = new Param(0); this.verbunden = []; } connect(n) { this.verbunden.push(n.art ?? "ziel"); } start(t) { log.push(["start", this.art, this.type, this.frequency.value, +t.toFixed(4)]); } stop(t) { log.push(["stop", this.art, +t.toFixed(4)]); } }
class AudioContextAttrappe {
  constructor() { this.state = "running"; this.currentTime = 1; this.destination = { art: "ziel" }; this.sampleRate = 48000; }
  createGain() { return new Knoten("gain"); }
  createBiquadFilter() { return new Knoten("filter"); }
  createOscillator() { return new Knoten("osc"); }
  createDynamicsCompressor() { const k = new Knoten("comp"); k.threshold = new Param(0); k.knee = new Param(0); k.ratio = new Param(0); k.attack = new Param(0); k.release = new Param(0); return k; }
  createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
  createBufferSource() { return new Knoten("src"); }
  resume() { return Promise.resolve(); }
}
globalThis.window = { AudioContext: AudioContextAttrappe };
const { sound } = await import("../js/sound.js");
const { SOUND } = await import("../js/config.js");

test("vor init(): alle Ereignisse sind stille No-Ops", () => {
  assert.equal(sound.on, false);
  for (const m of ["uiTap", "cardFound", "cardTapped", "popIn", "uiReveal", "questionTap", "figureJump", "bubbleOpen", "applyVolume", "applyTheme"]) sound[m]();
  assert.equal(log.length, 0);
});

test("init(): tiks-Engine mit Theme/Volume, eigener Kontext mit Tiefpass 2800 Hz, Master = volume × bubbleVolume", () => {
  sound.init();
  assert.equal(sound.on, true);
  assert.ok(sound.engine && sound.ctx && sound.master);
  assert.equal(sound.master.gain.value, SOUND.volume * SOUND.bubbleVolume);
  assert.deepEqual(sound.master.verbunden, ["filter"]);
  sound.init(); // idempotent
  assert.equal(sound.on, true);
});

test("bubbleOpen(): zwei Rechteck-Töne 660/990 Hz, 45 ms, 40 ms versetzt (Stand 2026-10-14)", () => {
  log.length = 0;
  sound.bubbleOpen();
  const starts = log.filter((e) => e[0] === "start").map((e) => e.slice(2));
  const stops = log.filter((e) => e[0] === "stop").map((e) => e[2]);
  assert.deepEqual(starts, [["square", 660, 1.005], ["square", 990, 1.045]]);
  assert.deepEqual(stops, [1.06, 1.1]);
  const huellen = log.filter((e) => e[0] !== "start" && e[0] !== "stop");
  assert.deepEqual(huellen, [
    ["set", 0.0001, 1.005], ["lin", 0.5, 1.008], ["exp", 0.0001, 1.05],
    ["set", 0.0001, 1.045], ["lin", 0.5, 1.048], ["exp", 0.0001, 1.09],
  ]);
  // SOUND.enabled = false → stumm
  SOUND.enabled = false; log.length = 0; sound.bubbleOpen(); assert.equal(log.length, 0); SOUND.enabled = true;
});

test("Ereignis-Vokabular → tiks-Methoden", () => {
  const rufe = [];
  const alt = sound.engine;
  sound.engine = new Proxy({}, { get: (_, k) => () => rufe.push(k) });
  try {
    sound.uiTap(); sound.cardFound(); sound.cardTapped(); sound.popIn(); sound.uiReveal(); sound.questionTap(); sound.figureJump();
    sound.applyVolume(); sound.applyTheme();
    assert.deepEqual(rufe, ["click", "notify", "swoosh", "pop", "success", "click", "pop", "setVolume", "setTheme"]);
  } finally { sound.engine = alt; }
});
