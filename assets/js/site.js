/* Only Wonder: page choreography (horizontal road, fly-through words, reveals, videos, rail). */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const params = new URLSearchParams(location.search);
  if (params.has("reveal")) document.documentElement.classList.add("shot");

  // ---------- horizontal road (Lessons) ----------
  const hs = document.querySelector("[data-hscroll]");
  const track = hs && hs.querySelector(".hscroll__track");
  let hdist = 0, stops = [0, 0];
  function layoutRoad() {
    if (!hs) return;
    if (reduce) { hs.classList.remove("is-pinned"); hs.style.height = ""; track.style.transform = ""; return; }
    hs.classList.add("is-pinned");
    hdist = Math.max(0, track.scrollWidth - window.innerWidth);
    hs.style.height = Math.round(hdist * 1.15) + window.innerHeight + "px";
    // each video is a stop on the road: the track eases between stops and rests on each one
    const vw = window.innerWidth;
    stops = [...track.children].map((st) => clamp(st.offsetLeft + st.offsetWidth / 2 - vw / 2, 0, hdist));
    stops[0] = 0; stops[stops.length - 1] = hdist;
  }
  function updateRoad() {
    if (!hs || reduce) return;
    const span = hs.offsetHeight - window.innerHeight;
    const top = hs.getBoundingClientRect().top;
    const p = span > 0 ? clamp(-top / span, 0, 1) : 0;
    document.body.classList.toggle("on-road", top < window.innerHeight * 0.3 && top > -span - window.innerHeight * 0.3);
    const n = stops.length - 1, u = p * n, i = Math.min(n - 1, Math.floor(u));
    const x = stops[i] + (stops[i + 1] - stops[i]) * smooth(0.14, 0.86, u - i);
    window.__owRoad = hdist ? x / hdist : 0;
    track.style.transform = `translate3d(${Math.round(-x)}px,0,0)`;   // whole pixels keep text crisp
  }

  // ---------- fly-through words ----------
  const flies = [...document.querySelectorAll("[data-fly]")].map((el) => ({
    el,
    lines: [...el.querySelectorAll(".fly__line")].map((l) => ({ l, r: l.dataset.range.split(",").map(Number) })),
  }));
  function updateFlies() {
    if (reduce) return;
    const vh = window.innerHeight;
    for (const f of flies) {
      const rect = f.el.getBoundingClientRect();
      if (rect.bottom < -50 || rect.top > vh + 50) { f.lines.forEach(({ l }) => (l.style.opacity = 0)); continue; }
      const p = clamp(-rect.top / (rect.height - vh), 0, 1);
      for (const { l, r } of f.lines) {
        const q = clamp((p - r[0]) / (r[1] - r[0]), 0, 1);
        const op = smooth(0, 0.22, q) * (1 - smooth(0.6, 0.94, q));
        // grow from small to full size (never above ~1.4x), so the browser can keep the text sharp
        const sc = 0.22 * Math.pow(6.5, q);
        l.style.opacity = op.toFixed(3);
        l.style.transform = `translate(0,${Math.round((0.5 - q) * 30)}px) scale(${sc.toFixed(3)})`;
      }
    }
  }

  // ---------- reveals ----------
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !params.has("reveal")) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach((el) => (el.closest(".hero") ? requestAnimationFrame(() => el.classList.add("in")) : io.observe(el)));
  } else reveals.forEach((el) => el.classList.add("in"));

  // ---------- videos: lazy, autoplay muted in view, pause off-screen, tap for sound ----------
  const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  const frames = [...document.querySelectorAll(".frame")].map((fr) => ({
    fr, v: fr.querySelector("video"), snd: fr.querySelector(".frame__sound"), play: fr.querySelector(".frame__play"), loaded: false, visible: false, userPaused: false,
  }));
  function setSound(f, on) {
    f.v.muted = !on;
    f.snd.setAttribute("aria-pressed", on ? "true" : "false");
    f.snd.setAttribute("aria-label", on ? "Mute this video" : "Unmute this video");
    f.snd.innerHTML = (on ? ICON_ON : ICON_OFF) + '<span class="sr">' + (on ? "Mute" : "Unmute") + "</span>";
  }
  function load(f) {
    if (f.loaded) return;
    f.loaded = true;
    f.v.src = f.v.dataset.src;
    f.v.load();
  }
  function tryPlay(f) {
    load(f);
    const p = f.v.play();
    if (p && p.catch) p.then(() => (f.play.hidden = true)).catch(() => (f.play.hidden = false));
  }
  frames.forEach((f) => {
    setSound(f, false);
    f.play.innerHTML = ICON_PLAY + '<span class="sr">Play video</span>';
    if (reduce) f.play.hidden = false;
    f.play.addEventListener("click", () => { f.userPaused = false; tryPlay(f); });
    const toggleSound = () => {
      const on = f.v.muted;
      if (on) frames.forEach((o) => o !== f && !o.v.muted && setSound(o, false));
      setSound(f, on);
      if (on && f.v.paused) { f.userPaused = false; tryPlay(f); }
    };
    f.snd.addEventListener("click", toggleSound);
    f.v.addEventListener("click", toggleSound);
  });
  if ("IntersectionObserver" in window) {
    const near = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { const f = frames.find((x) => x.v === e.target); load(f); near.unobserve(e.target); }
    }), { rootMargin: "500px 700px 500px 700px" });
    const seen = new IntersectionObserver((es) => es.forEach((e) => {
      const f = frames.find((x) => x.v === e.target);
      f.visible = e.intersectionRatio >= 0.4;
      if (f.visible) { if (!reduce && !f.userPaused) tryPlay(f); }
      else if (!f.v.paused) f.v.pause();
    }), { threshold: [0, 0.4, 0.7] });
    frames.forEach((f) => { near.observe(f.v); seen.observe(f.v); });
  } else frames.forEach((f) => { load(f); if (!reduce) tryPlay(f); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) frames.forEach((f) => f.v.pause());
    else if (!reduce) frames.forEach((f) => f.visible && tryPlay(f));
  });

  // ---------- rail + nav state ----------
  const railIds = ["hero", "lessons", "science", "news", "about", "end"];
  const railLinks = railIds.map((id) => document.querySelector(`.rail a[data-rail="${id}"]`));
  const railDot = document.querySelector(".rail__dot");
  const secs = railIds.map((id) => document.getElementById(id));
  const navLinks = [...document.querySelectorAll(".top__nav a")];
  let secTops = [];
  function measure() { secTops = secs.map((s) => (s ? docTop(s) : 0)); }
  function updateRail() {
    const y = window.scrollY + window.innerHeight * 0.45;
    let i = 0;
    for (let k = 0; k < secTops.length; k++) if (y >= secTops[k]) i = k;
    const next = secTops[i + 1] || document.documentElement.scrollHeight;
    const frac = clamp((y - secTops[i]) / Math.max(1, next - secTops[i]), 0, 1);
    railLinks.forEach((a, k) => a && a.setAttribute("aria-current", k === i ? "true" : "false"));
    if (railDot && railLinks[i]) {
      const a = railLinks[i].offsetTop, b = railLinks[i + 1] ? railLinks[i + 1].offsetTop : a;
      railDot.style.transform = `translateY(${(a + (b - a) * frac).toFixed(1)}px)`;
    }
    const cur = secs[i] && secs[i].id;
    const play = document.getElementById("play");
    const inPlay = play && y >= docTop(play) && y < docTop(play) + play.offsetHeight;
    navLinks.forEach((a) => {
      const id = a.getAttribute("href").slice(1);
      a.setAttribute("aria-current", (inPlay ? id === "play" : id === cur) ? "true" : "false");
    });
  }

  // ---------- in-page links: glide (the sky flies you there) ----------
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    let top = id === "hero" ? 0 : docTop(el);
    if (id === "lessons") top = docTop(el) + window.innerHeight * 0.05;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    if (id !== "hero") history.replaceState(null, "", "#" + id);
    else history.replaceState(null, "", location.pathname + location.search);
  });

  // ---------- frame scheduling ----------
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; updateRoad(); updateFlies(); updateRail(); });
  }
  let lastW = 0;
  function layout(force) {
    const w = window.innerWidth;
    if (!force && w === lastW) { updateRoad(); return; } // ignore mobile URL-bar height changes
    lastW = w;
    layoutRoad();
    measure();
    document.dispatchEvent(new Event("ow:layout"));
    updateRoad(); updateFlies(); updateRail();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  // anything that changes the page height (fonts, lazy media) re-measures the journey
  if ("ResizeObserver" in window) {
    let lastH = 0, timer = 0;
    new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      clearTimeout(timer);
      timer = setTimeout(() => { measure(); document.dispatchEvent(new Event("ow:layout")); onScroll(); }, 120);
    }).observe(document.querySelector("main"));
  }
  window.addEventListener("resize", () => layout(false));
  layout(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layout(true));
  window.addEventListener("load", () => {
    layout(true);
    // debug / screenshot helpers: ?y=1200  or  ?at=lessons&p=0.5 (p = progress through that element)
    let target = null;
    if (params.has("y")) target = parseFloat(params.get("y"));
    if (params.has("at")) {
      const el = document.getElementById(params.get("at")) || document.querySelector(params.get("at"));
      if (el) target = docTop(el) + (parseFloat(params.get("p")) || 0) * Math.max(0, el.offsetHeight - window.innerHeight);
    }
    if (target !== null) {
      window.scrollTo(0, target);
      if (window.OWSky) window.OWSky.snap();
      onScroll();
    }
    if (params.has("probe")) {
      setTimeout(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")].filter((el) => {
          if (el.closest(".hscroll__track") || el.closest("svg")) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        }).slice(0, 12).map((el) => `${el.tagName}.${el.className}`);
        const pre = document.createElement("pre");
        pre.id = "probe";
        pre.style.cssText = "position:fixed;left:0;top:60px;z-index:99;background:#000;color:#0f0;font:11px monospace;white-space:pre-wrap;max-width:100vw;padding:6px";
        pre.textContent = JSON.stringify({ innerWidth: window.innerWidth, clientWidth: vw, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, overflowing: wide, sky: window.OWSky && window.OWSky.state() });
        document.body.appendChild(pre);
        if (window.parent !== window) window.parent.postMessage(pre.textContent, "*");
      }, 600);
    }
  });
})();
