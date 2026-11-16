/* =====================================================================
   sfx.js: clean UI sounds, all generated in the browser (no audio files)
   ===================================================================== */
(function () {
  "use strict";

  /* ---- settings you can change ---- */
  const VOLUME = 0.55;               // 0 to 1
  const HOVER_SOUNDS = true;         // tiny tick when you hover buttons and cards (mouse only)
  const PAGE_WHOOSH = true;          // whoosh when you change page
  const NAV_SOUNDS = true;           // soft swish when the top bar hides / shows

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  let enabled = true;
  try { enabled = localStorage.getItem("sfx") !== "off"; } catch (e) {}

  let ctx = null, master = null, bus = null, noiseBuf = null;
  const last = {};
  const rate = (k, ms) => { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };

  /* ---------- audio engine ---------- */
  function init() {
    if (ctx) return true;
    try { ctx = new AC(); } catch (e) { return false; }

    master = ctx.createGain();
    master.gain.value = VOLUME;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 1.3);
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const conv = ctx.createConvolver(); conv.buffer = imp;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    bus = ctx.createGain();
    bus.connect(master); bus.connect(wet); wet.connect(conv); conv.connect(master);

    const nl = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() {
    if (!enabled) return;
    if (init() && ctx.state === "suspended") ctx.resume();
  }

  function tone(o) {
    const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.1;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g);
    g.connect(o.dry ? master : bus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(o) {
    const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.3;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || "bandpass"; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f1, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.attack || dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    let end = g;
    if (o.pan != null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(o.pan, t);
      p.pan.linearRampToValueAtTime(o.pan2 != null ? o.pan2 : o.pan, t + dur);
      g.connect(p); end = p;
    }
    end.connect(o.dry ? master : bus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  /* ---------- the sounds ---------- */
  const S = {
    click() {
      tone({ f: 1500, f2: 620, dur: 0.07, gain: 0.14, dry: true });
      noise({ type: "highpass", f1: 5000, dur: 0.03, gain: 0.05, attack: 0.002, q: 0.5, dry: true });
    },
    tick() { tone({ f: 2600, f2: 2200, dur: 0.03, gain: 0.03, dry: true }); },
    pop() { tone({ f: 520, f2: 880, dur: 0.11, gain: 0.14, type: "triangle", lp: 3000 }); },
    play() {
      tone({ f: 440, f2: 1040, dur: 0.16, gain: 0.13, type: "triangle", lp: 3500 });
      noise({ type: "bandpass", f1: 400, f2: 2600, q: 0.9, dur: 0.22, gain: 0.08, attack: 0.07 });
    },
    open() {
      tone({ f: 420, f2: 840, dur: 0.14, gain: 0.12, type: "triangle", lp: 3500 });
      tone({ f: 840, f2: 1260, dur: 0.12, gain: 0.05, delay: 0.04 });
    },
    close() { tone({ f: 760, f2: 380, dur: 0.12, gain: 0.1, type: "triangle", lp: 3000 }); },
    denied() {
      tone({ f: 210, f2: 130, dur: 0.16, gain: 0.13, type: "sawtooth", lp: 650, dry: true });
      tone({ f: 160, f2: 110, dur: 0.12, gain: 0.1, type: "sawtooth", lp: 500, delay: 0.1, dry: true });
    },
    success() {
      tone({ f: 880, dur: 0.22, gain: 0.1 });
      tone({ f: 1318, dur: 0.3, gain: 0.09, delay: 0.075 });
      tone({ f: 1760, dur: 0.38, gain: 0.04, delay: 0.14 });
    },
    whoosh(up) {
      const p = up ? -0.6 : 0.6;
      noise({ type: "bandpass", f1: up ? 250 : 2800, f2: up ? 3600 : 260, q: 0.8, dur: 0.42, gain: 0.2, attack: 0.14, pan: p, pan2: -p });
      noise({ type: "highpass", f1: up ? 2000 : 6000, f2: up ? 9000 : 2500, q: 0.4, dur: 0.36, gain: 0.05, attack: 0.12, pan: p, pan2: -p });
      tone({ f: up ? 90 : 200, f2: up ? 240 : 70, dur: 0.3, gain: 0.06, lp: 500 });
    },
    swish(up) {
      const p = up ? -0.4 : 0.4;
      noise({ type: "bandpass", f1: up ? 500 : 2200, f2: up ? 2600 : 400, q: 1, dur: 0.24, gain: 0.07, attack: 0.08, pan: p, pan2: -p });
    }
  };
  function play(name, a) {
    if (!enabled || !ctx || document.hidden) return;
    if (ctx.state === "suspended") ctx.resume();
    try { S[name](a); } catch (e) {}
  }

  /* ---------- mute button (bottom left) ---------- */
  const css = document.createElement("style");
  css.textContent =
    ".sfx-toggle{position:fixed;left:18px;bottom:18px;z-index:65;width:46px;height:46px;border-radius:50%;border:1px solid var(--line,rgba(120,160,255,.18));background:rgba(10,16,34,.85);color:#fff;cursor:pointer;display:grid;place-items:center;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:background .2s ease,box-shadow .2s ease,opacity .3s ease}" +
    ".sfx-toggle:hover{background:var(--accent2,#2f6bff);box-shadow:0 0 20px var(--glow,rgba(77,141,255,.38))}" +
    ".sfx-toggle.off{opacity:.65}.sfx-toggle svg{width:22px;height:22px}";
  document.head.appendChild(css);

  const ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>';
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "sfx-toggle";
  function paint() {
    btn.innerHTML = enabled ? ON : OFF;
    btn.classList.toggle("off", !enabled);
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.setAttribute("aria-label", enabled ? "Sound effects on" : "Sound effects off");
    btn.title = enabled ? "Sound on (click to mute)" : "Sound off (click to turn on)";
  }
  btn.addEventListener("click", () => {
    enabled = !enabled;
    try { localStorage.setItem("sfx", enabled ? "on" : "off"); } catch (e) {}
    paint();
    if (enabled) { unlock(); play("pop"); }
  });
  paint();
  document.body.appendChild(btn);

  /* ---------- wire it up ---------- */
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, unlock, { capture: true, passive: true }));

  const CLICKABLE = ".q-btn,.chip,.copy,.nav-cta,.nav-links a,.nav-brand,.card,.sn,.back,.go,.resume,.st-buy,.foot-links a,.opt";
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest || t.closest(".sfx-toggle")) return;
    if (t.closest(".st-buy.closed")) return play("denied");
    const fq = t.closest(".fq button");
    if (fq) { const item = fq.parentElement; return setTimeout(() => play(item.classList.contains("open") ? "open" : "close"), 0); }
    if (t.closest(".totop")) return play("whoosh", true);
    const vid = t.closest(".vid");
    if (vid) { if (!vid.dataset.playing) play("play"); return; }
    if (t.closest(".opt")) return play("pop");
    if (t.closest(CLICKABLE)) play("click");
  }, true);

  const HOVER = ".chip,.card,.q-btn,.nav-links a,.nav-cta,.back,.sn,.fq button,.copy,.st-card,.step,.review";
  let lastHover = null;
  document.addEventListener("pointerover", (e) => {
    if (!HOVER_SOUNDS || e.pointerType !== "mouse" || !e.target.closest) return;
    const t = e.target.closest(HOVER);
    if (t !== lastHover) { lastHover = t; if (t && rate("hover", 70)) play("tick"); }
  }, { passive: true });

  if (PAGE_WHOOSH) addEventListener("hashchange", () => { if (rate("route", 250)) play("whoosh", true); });

  const nav = document.querySelector(".nav");
  if (NAV_SOUNDS && nav && "MutationObserver" in window) {
    let hidden = nav.classList.contains("hide");
    new MutationObserver(() => {
      const now = nav.classList.contains("hide");
      if (now !== hidden) { hidden = now; if (rate("nav", 500)) play("swish", !now); }
    }).observe(nav, { attributes: true, attributeFilter: ["class"] });
  }

  if (typeof window.toast === "function") {
    const orig = window.toast;
    window.toast = function () { play("success"); return orig.apply(this, arguments); };
  }
})();
