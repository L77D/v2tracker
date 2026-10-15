/* Verträge nach außen, die beim Refactoring nicht brechen dürfen (Stand Build 110):
   Patch-Anker des Lokal-Prototyps, version.js-Format für ?stats, DOM-IDs aus
   index.html, die der Code anspricht, Default-Werte in config.js (Snapshot),
   Kompatibilitäts-Syntax im Live-Code. Reine Textprüfungen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./karte.mjs";
import { pruefeSnapshot } from "./snapshot.mjs";
import { ALL, poseFor, frameLerp60 } from "../js/config.js";

const lies = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("Patch-Anker von tools/build-lokal-prototyp.py stehen wörtlich im Quelltext", () => {
  const anker = [
    ["js/main.js", 'const DESKTOP_MODE = params.has("desktop");'],
    ["js/main.js", 'const DEV_MODE = params.has("dev");'],
    ["js/config.js", '    const res = await fetch("./tuning.json", { cache: "no-store" });'],
    ["js/rig.js", "const t = texLoader.load(url);"],
    ["js/kartenLader.js", '  const res = await fetch(url, { cache: "no-store" });'],
    ["js/desktopMode.js", "new THREE.TextureLoader().load(vorschau)"],
    ["js/supportUI.js", 'im.src = ICON_DIR + f + ".png";'],
    ["js/supportUI.js", 'this.img.src = ICON_DIR + name + ".png";'],
    ["index.html", '<link rel="stylesheet" href="./css/app.css" />'],
    ["index.html", '  <link rel="stylesheet" href="./css/question-menu.css" />'],
    ["index.html", '<script type="module" src="./js/main.js"></script>'],
    ["index.html", "<title>DEIN ERSTER TAG — AR</title>"],
  ];
  for (const [datei, text] of anker) assert.ok(lies(datei).includes(text), datei + ": " + text);
  // Das Skript selbst nennt dieselben Anker
  const py = lies("tools/build-lokal-prototyp.py");
  for (const [, text] of anker.slice(0, 8)) assert.ok(py.includes(text.trim()), "py: " + text);
});

test("version.js passt zum Regex des Build-Checks in statsOverlay.js", () => {
  const m = lies("js/version.js").match(/BUILD\s*=\s*(\d+)/);
  assert.ok(m && Number(m[1]) >= 110, String(m));
  assert.ok(lies("js/statsOverlay.js").includes("/BUILD\\s*=\\s*(\\d+)/"));
});

test("jede im Code angesprochene DOM-ID steht in index.html", () => {
  const html = lies("index.html");
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const dynamisch = new Set(["xr-canvas"]); // legt arSession.js selbst an
  for (const f of fs.readdirSync(path.join(ROOT, "js")).filter((x) => x.endsWith(".js"))) {
    const src = lies("js/" + f);
    for (const m of src.matchAll(/(?:\bel|getElementById)\("([^"]+)"\)/g)) {
      assert.ok(ids.has(m[1]) || dynamisch.has(m[1]), f + " spricht #" + m[1] + " an");
    }
  }
  for (const id of ["ar-container", "scanFrame", "lostHint", "trackerMarke", "question-root", "splash", "cardName", "companyKicker", "companyLogo", "companyText", "errorBox", "launchButton", "permScreen", "permReload", "auffangScreen", "preflightScreen", "pfTitle", "pfText", "pfUrl", "pfCopy"]) assert.ok(ids.has(id), id);
});

test("Default-Werte in config.js (Snapshot) und kleine Helfer", () => {
  pruefeSnapshot("config.defaults", ALL);
  assert.equal(poseFor("winken", { idle: 1, affirm: 1 }), "affirm");
  assert.equal(poseFor("winken", { idle: 1 }), "idle");
  assert.equal(poseFor("winken", { idle: 1, winken: 1, affirm: 1 }), "winken");
  assert.equal(poseFor("unbekannt", { idle: 1 }), "idle");
  assert.equal(poseFor("neutral"), "idle");
  assert.ok(Math.abs(frameLerp60(0.2, 1 / 60) - 0.2) < 1e-12);
  assert.ok(Math.abs(frameLerp60(0.2, 2 / 60) - (1 - 0.8 * 0.8)) < 1e-12);
});

test("Live-Code ohne Syntax jenseits ?. / ?? und ohne static-Klassenfelder (Grenze iOS 13.4 / Chrome 80)", () => {
  const dev = new Set(["debugOverlay.js", "statsOverlay.js", "devPanel.js", "timeline.js", "desktopMode.js", "phoneFrame.js"]);
  for (const f of fs.readdirSync(path.join(ROOT, "js")).filter((x) => x.endsWith(".js") && !dev.has(x))) {
    const src = lies("js/" + f);
    assert.ok(!/^\s+static |\?\?=|\|\|=|&&=|\.at\(|#[a-z]\w*\s*[=;(]/m.test(src), f);
  }
  assert.ok(!lies("index.html").includes("importmap"));
});
