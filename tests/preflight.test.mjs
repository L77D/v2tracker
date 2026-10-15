/* Vorabprüfung (js/preflight.js): Prüfreihenfolge, erzwungene Fälle, Kopier-Link
   ohne ?preflight — Characterization Test (Stand Build 110) mit Attrappen für
   navigator/window/Image/document. */
import { test } from "node:test";
import assert from "node:assert/strict";

let webpOk = true;
class ImageAttrappe {
  constructor() { this.width = 1; this.height = 1; }
  set src(v) { this._src = v; queueMicrotask(() => (webpOk ? this.onload?.() : this.onerror?.())); }
}
globalThis.Image = ImageAttrappe;
const nav = { userAgent: "Mozilla/5.0 (iPhone) Safari", mediaDevices: { getUserMedia() {} }, clipboard: null };
Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
globalThis.window = { isSecureContext: true, WebAssembly: {} };
const { preflight, showPreflightScreen } = await import("../js/preflight.js");

test("preflight: Reihenfolge inapp → insecure → nocam → nowasm → nowebp; ok = null", async () => {
  assert.equal(await preflight(undefined), null);
  nav.userAgent = "Mozilla/5.0 Instagram 300.0"; assert.equal(await preflight(undefined), "inapp");
  for (const ua of ["FBAN/FBIOS", "FBAV/1", "FB_IAB/", "Snapchat", "TikTok", "musical_ly", "Line/12", "MicroMessenger", "LinkedInApp", "Twitter", "Pinterest"]) {
    nav.userAgent = "x " + ua; assert.equal(await preflight(undefined), "inapp", ua);
  }
  nav.userAgent = "Outline Online"; assert.equal(await preflight(undefined), null);
  window.isSecureContext = false; assert.equal(await preflight(undefined), "insecure");
  window.isSecureContext = true; nav.mediaDevices = {}; assert.equal(await preflight(undefined), "nocam");
  nav.mediaDevices = { getUserMedia() {} }; window.WebAssembly = undefined; assert.equal(await preflight(undefined), "nowasm");
  window.WebAssembly = {}; webpOk = false; assert.equal(await preflight(undefined), "nowebp");
  webpOk = true;
  // Reihenfolge: inapp schlägt insecure
  nav.userAgent = "Instagram"; window.isSecureContext = false; assert.equal(await preflight(undefined), "inapp");
  nav.userAgent = "Safari"; window.isSecureContext = true;
});

test("preflight: ?preflight=aus überspringt, bekannter Schlüssel erzwingt, unbekannter prüft echt", async () => {
  nav.userAgent = "Instagram";
  assert.equal(await preflight("aus"), null);
  assert.equal(await preflight("nowebp"), "nowebp");
  assert.equal(await preflight("unsinn"), "inapp");
  nav.userAgent = "Safari";
});

test("showPreflightScreen: Texte, Link ohne preflight-Parameter, body-Klasse", () => {
  const els = {
    pfTitle: { textContent: "" }, pfText: { textContent: "" }, pfUrl: { value: "" },
    pfCopy: { onclick: null, querySelector: () => ({ textContent: "" }) },
  };
  globalThis.document = { getElementById: (id) => els[id], body: { classList: { add(c) { this.added = c; }, added: null } } };
  globalThis.location = { href: "https://x.test/v2tracker/index.html?k=000&stats&preflight=inapp&tracker=8lerp#x" };
  const warn = console.warn; console.warn = () => {};
  try {
    showPreflightScreen("inapp");
    assert.equal(els.pfTitle.textContent, "Bitte im Browser öffnen");
    assert.ok(els.pfText.textContent.startsWith("Diese App braucht die Kamera."));
    assert.equal(els.pfUrl.value, "https://x.test/v2tracker/index.html?k=000&stats&tracker=8lerp#x");
    assert.equal(typeof els.pfCopy.onclick, "function");
    assert.equal(document.body.classList.added, "preflight-blocked");
    globalThis.location = { href: "https://x.test/v2tracker/index.html?preflight=nocam" };
    showPreflightScreen("unbekannt"); // → Text nocam
    assert.ok(els.pfText.textContent.startsWith("Dein Browser stellt keine Kamera-Schnittstelle"));
    assert.equal(els.pfUrl.value, "https://x.test/v2tracker/index.html");
    for (const [k, t] of [["insecure", "Die Seite ist nicht über eine sichere Verbindung"], ["nowasm", "Dein Browser ist zu alt für die Bilderkennung"], ["nowebp", "Dein Browser ist zu alt, um die Figur anzuzeigen"]]) {
      showPreflightScreen(k); assert.ok(els.pfText.textContent.startsWith(t), k);
    }
  } finally { console.warn = warn; }
});
