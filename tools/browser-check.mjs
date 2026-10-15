#!/usr/bin/env node
/* DETAR — Browser-Snapshot + Messung (Refactoring 2026-10-15, Characterization).
   Startet tools/dev-server.js auf einem freien Port, öffnet die Seiten in
   headless Chromium (Playwright, global installiert oder über NODE_PATH) und
   hält fest, was ein Nutzer sieht: Boot-Zustand je URL-Variante (body-Klassen,
   Kartenname, Fehlerzeile, Start-Knopf, Tracker-Marke, Hinweis-Text, Konsole),
   karten.html / tracker-vergleich.html / tools/kartenpruefung.html, und den
   Desktop-Ablauf (?desktop) bis zur ersten Antwort (Phasen, Menü-Kacheln).
   Dazu Messwerte (nicht Teil des Snapshots): Requests/Bytes vor und nach dem
   Start, Zeit bis zum freien Start-Knopf, JS-Selbstzeit je Datei im Profiler.

   Aufruf:  node tools/browser-check.mjs            → Vergleich mit tests/fixtures/browser.snapshot.json
            node tools/browser-check.mjs --schreiben → Snapshot neu schreiben (nur bei gewollter Änderung)
   Kein Teil von `node --test` (braucht Chromium). Die AR-Sitzung selbst (Kamera,
   8th-Wall-Engine) ist hier nicht prüfbar → docs/pruefschritte-manuell.md. */
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(ROOT, "tests/fixtures/browser.snapshot.json");
const SCHREIBEN = process.argv.includes("--schreiben");
const PORT = 8790 + Math.floor(Math.random() * 100);
const BASE = `http://localhost:${PORT}/`;

function ladePlaywright() {
  for (const p of [process.env.NODE_PATH, (() => { try { return execSync("npm root -g").toString().trim(); } catch { return null; } })()]) {
    if (!p) continue;
    try { return createRequire(p + "/").call(null, "playwright"); } catch { /* nächster */ }
  }
  try { return createRequire(import.meta.url)("playwright"); } catch { throw new Error("playwright nicht gefunden (npm i -g playwright)"); }
}
const { chromium } = ladePlaywright();

const server = spawn(process.execPath, [path.join(ROOT, "tools/dev-server.js"), String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const snapshot = {};
const messung = {};

async function seite(url) {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 });
  const konsole = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") konsole.push(m.type() + ": " + m.text().replace(BASE, "").replace(/HeadlessChrome\/[\d.]+/, "HeadlessChrome").slice(0, 120)); });
  page.on("pageerror", (e) => konsole.push("PAGEERROR: " + e.message));
  await page.goto(BASE + url, { waitUntil: "load" });
  return { page, konsole };
}

try {
  /* ---- Boot-Zustände je URL ---------------------------------------------- */
  const varianten = ["index.html", "index.html?k=000", "index.html?k=000P", "index.html?k=xyz", "index.html?karte=p07", "index.html?k=000&design=nope",
    "index.html?k=000&preflight=inapp", "index.html?k=000&preflight=nowebp", "index.html?k=000&tracker=alt", "index.html?k=000&tracker=foo", "index.html?k=000&tracker=8lerp&dev"];
  snapshot.boot = {};
  for (const u of varianten) {
    const { page, konsole } = await seite(u);
    await page.waitForTimeout(1200);
    snapshot.boot[u] = await page.evaluate(() => ({
      body: document.body.className, cardName: document.getElementById("cardName").textContent,
      companyText: document.getElementById("companyText").textContent, logoHidden: document.getElementById("companyLogo").hidden,
      err: document.getElementById("errorBox").textContent, errSichtbar: document.getElementById("errorBox").style.display,
      startKnopfAus: document.getElementById("launchButton").disabled, marke: document.getElementById("trackerMarke").textContent,
      markeKlassen: document.getElementById("trackerMarke").className, pfTitel: document.getElementById("pfTitle").textContent,
      pfText: document.getElementById("pfText").textContent.slice(0, 60), pfUrl: document.getElementById("pfUrl").value.replace(location.origin, ""),
      preload: [...document.querySelectorAll("link[rel=preload]")].map((l) => l.getAttribute("href")),
    }));
    snapshot.boot[u].konsole = konsole;
    await page.close();
  }

  /* ---- Übersichtsseiten ---------------------------------------------------- */
  for (const u of ["karten.html", "tracker-vergleich.html?k=000"]) {
    const { page, konsole } = await seite(u);
    await page.waitForTimeout(1200);
    snapshot[u] = await page.evaluate(() => ({
      titel: document.title, qr: document.querySelectorAll("canvas").length,
      links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href").replace(location.origin + "/", "./")).filter((h) => h.includes("?")).slice(0, 60),
      text: document.body.innerText.replaceAll(location.origin + "/", "./").replace(/\s+/g, " ").slice(0, 400),
    }));
    snapshot[u].konsole = konsole;
    await page.close();
  }
  {
    const { page, konsole } = await seite("tools/kartenpruefung.html?k=000");
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    snapshot["tools/kartenpruefung.html?k=000"] = { kopf: text.split("\n").slice(0, 8), zeichen: text.length, konsole };
    await page.close();
  }

  /* ---- Desktop-Ablauf + Messung ------------------------------------------- */
  const { page, konsole } = await seite("index.html?k=000&desktop&stats");
  const t0 = Date.now();
  await page.waitForFunction(() => !document.getElementById("launchButton").disabled, null, { timeout: 30000 });
  messung.startKnopfFreiMs = Date.now() - t0 + Math.round(await page.evaluate(() => performance.getEntriesByType("navigation")[0].loadEventEnd));
  const res = async () => page.evaluate(() => { const r = performance.getEntriesByType("resource"); return { requests: r.length, bytes: r.reduce((s, x) => s + x.decodedBodySize, 0), js: r.filter((x) => /\.js$/.test(x.name)).reduce((s, x) => s + x.decodedBodySize, 0) }; });
  messung.boot = await res();
  snapshot.desktop = { geladeneModule: await page.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name.replace(location.origin + "/", "")).filter((n) => n.endsWith(".js")).sort()) };
  await page.click("#launchButton");
  await page.waitForFunction(() => document.body.classList.contains("launched"), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  messung.nachStart = await res();
  const zustand = () => page.evaluate(() => {
    const c = window.__detar.controller;
    const panel = document.querySelector("#question-root .detar-panel");
    return { phase: c.phase, menu: c.menu.phase, body: document.body.className, panel: panel?.className ?? null,
      kacheln: [...document.querySelectorAll("#question-root .detar-tile")].map((b) => b.textContent),
      support: document.querySelector("#question-root .support-lines")?.textContent ?? null,
      blase: c.bubble.element.visible, figur: Object.entries(c.nodes.bodies).filter(([, b]) => b.visible).map(([k]) => k) };
  });
  snapshot.desktop.nachStart = await zustand();
  await page.evaluate(() => window.__detar.controller.onCardTapped());
  await page.waitForTimeout(3500);
  snapshot.desktop.nachTap = await zustand();
  await page.evaluate(() => window.__detar.controller.onTheme("alltag"));
  snapshot.desktop.thema = await zustand();
  await page.evaluate(() => { const c = window.__detar.controller; c.answerQuestion("was"); });
  await page.waitForTimeout(300);
  snapshot.desktop.antwortLaeuft = await zustand();
  await page.evaluate(() => window.__detar.controller.onBubbleTapped());
  await page.waitForTimeout(500);
  snapshot.desktop.antwortFertig = await zustand();
  snapshot.desktop.konsole = konsole;

  // Profiler: JS-Selbstzeit je Datei über 3 s (Blase steht, Menü offen)
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start"); await page.waitForTimeout(3000);
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const je = {}; let total = 0, js = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const f = byId.get(profile.samples[i]).callFrame; const d = profile.timeDeltas[i] || 0; total += d;
    if (/\(idle\)|\(program\)|\(garbage/.test(f.functionName)) continue;
    js += d; const k = f.url ? f.url.replace(BASE, "") : "(nativ)"; je[k] = (je[k] || 0) + d;
  }
  messung.profil3s = { jsMs: Math.round(js / 1000), anteilProzent: +(js / total * 100).toFixed(1), jeDateiMs: Object.fromEntries(Object.entries(je).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, +(v / 1000).toFixed(1)])) };
  await page.close();
} finally {
  await browser.close();
  server.kill();
}

/* ---- Ausgabe --------------------------------------------------------------- */
console.log("Messung:", JSON.stringify(messung, null, 1));
if (SCHREIBEN) {
  fs.writeFileSync(FIXTURE, JSON.stringify(snapshot, null, 1) + "\n");
  console.log("Snapshot geschrieben:", path.relative(ROOT, FIXTURE));
} else {
  const soll = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const diff = [];
  const geh = (a, b, pfad) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) geh(a[k], b[k], pfad + "." + k); }
    else diff.push(pfad + ": " + JSON.stringify(b) + " → " + JSON.stringify(a));
  };
  geh(snapshot, soll, "");
  if (diff.length) { console.error("ABWEICHUNG vom Snapshot (" + diff.length + "):\n" + diff.join("\n")); process.exit(1); }
  console.log("Browser-Snapshot unverändert (" + Object.keys(snapshot.boot).length + " Boot-Varianten, Übersichtsseiten, Desktop-Ablauf).");
}
