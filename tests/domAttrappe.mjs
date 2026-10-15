/* Testhelfer: Mini-DOM für Module, die Elemente bauen (questionMenu, supportUI,
   speechBubble-Canvas). Nur, was die Module wirklich benutzen; Serialisierung
   für Snapshots. Kein Layout, kein Rendering. */
export class Element {
  constructor(tag) {
    this.tag = tag; this.className = ""; this.children = []; this.parent = null;
    this.attrs = {}; this.styleProps = {}; this._text = ""; this.html = null;
    this.listeners = {}; this.onclick = null; this.scrollLeft = 0; this.hidden = false;
    const self = this;
    this.style = { setProperty: (k, v) => { self.styleProps[k] = String(v); }, set pointerEvents(v) { self.styleProps.pointerEvents = v; }, set cursor(v) { self.styleProps.cursor = v; }, set visibility(v) { self.styleProps.visibility = v; } };
    this.classList = {
      add: (...cs) => { for (const c of cs) if (!self.hat(c)) self.className = (self.className + " " + c).trim(); },
      remove: (c) => { self.className = self.klassen().filter((x) => x !== c).join(" "); },
      toggle: (c, on) => { const soll = on === undefined ? !self.hat(c) : !!on; if (soll) self.classList.add(c); else self.classList.remove(c); return soll; },
      contains: (c) => self.hat(c),
    };
  }
  klassen() { return this.className.split(/\s+/).filter(Boolean); }
  hat(c) { return this.klassen().includes(c); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); }
  removeEventListener() {}
  set textContent(v) { this._text = String(v); this.children = []; this.html = null; }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text; }
  set innerHTML(v) { this.children = []; this._text = ""; this.html = v === "" ? null : String(v); }
  get innerHTML() { return this.html ?? ""; }
  get firstElementChild() { return this.children[0] ?? null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 200 }; }
  passt(sel) {
    const [tag, ...cls] = sel.split(".");
    return (!tag || tag === this.tag) && cls.every((c) => this.hat(c));
  }
  alle() { return this.children.flatMap((c) => [c, ...c.alle()]); }
  querySelector(sel) { return this.alle().find((e) => e.passt(sel)) ?? null; }
  querySelectorAll(sel) { return this.alle().filter((e) => e.passt(sel)); }
}
/* Serialisierung für Snapshots: Tag, Klassen, Text, Attribute, Style, Kinder. */
export function serialisiere(e) {
  const o = { t: e.tag };
  if (e.className) o.c = e.klassen().join(" ");
  if (!e.children.length && e._text) o.x = e._text;
  if (e.html) o.h = e.html;
  if (Object.keys(e.attrs).length) o.a = e.attrs;
  if (Object.keys(e.styleProps).length) o.s = e.styleProps;
  if (e.onclick) o.klick = true;
  if (Object.keys(e.listeners).length) o.hoert = Object.keys(e.listeners);
  if (e.children.length) o.k = e.children.map(serialisiere);
  return o;
}
/* Globale Attrappen anlegen (document, Image, requestAnimationFrame). */
export function installiereDom() {
  const root = new Element("html");
  root.style = { setProperty: (k, v) => { root.styleProps[k] = String(v); } };
  globalThis.document = {
    documentElement: root,
    body: new Element("body"),
    createElement: (tag) => new Element(tag),
    createElementNS: (ns, tag) => new Element(tag),
  };
  globalThis.Image = class { constructor() { this.src = ""; } };
  globalThis.requestAnimationFrame = (fn) => { fn(0); return 1; };
  return root;
}
