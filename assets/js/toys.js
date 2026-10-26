/* Only Wonder: two small toys that are the brand.
   1) "Pick any number": the real Collatz path of any whole number (BigInt), bouncing down to 1.
   2) "Everyone who walks through your life": tap to let someone into your orbit. */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const instant = reduce || /[?&]reveal=/.test(location.search); // screenshot mode draws final frames
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rr = (a, b) => a + (b - a) * Math.random();

  function sprite(rgb) {
    const S = 64, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d"), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.12, `rgba(${rgb},1)`);
    gr.addColorStop(0.26, `rgba(${rgb},0.4)`);
    gr.addColorStop(0.55, `rgba(${rgb},0.08)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return c;
  }
  function fit(canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w: r.width, h: r.height, dpr };
  }
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const sup = (n) => String(n).split("").map((d) => SUP[d]).join("");
  const fmt = (n) => {
    const s = n.toString();
    if (s.length <= 18) return BigInt(s).toLocaleString("en-US");
    return `${s[0]}.${s.slice(1, 3)} × 10${sup(s.length - 1)}`;
  };

  // =====================================================================
  // 1) COLLATZ
  // =====================================================================
  (() => {
    const form = document.getElementById("collatz-form");
    const input = document.getElementById("collatz-input");
    const canvas = document.getElementById("collatz-canvas");
    const out = document.getElementById("collatz-result");
    const share = document.getElementById("collatz-share");
    if (!form || !canvas) return;
    const ctx = canvas.getContext("2d");
    const ICE = [169, 212, 255], GOLD = [255, 211, 138];
    const sprIce = sprite(ICE.join(",")), sprGold = sprite(GOLD.join(","));
    const CAP_STEPS = 100000, CAP_DIGITS = 300;
    let run = null, raf = 0, ranOnce = false;

    const log10 = (n) => { const s = n.toString(); return s.length < 16 ? Math.log10(Number(s)) : Math.log10(Number(s.slice(0, 16))) + s.length - 16; };

    function parse(raw) {
      const s = String(raw).trim().replace(/[\s,_.']/g, "");
      if (!s) return { err: "Type a whole number first. Try 27." };
      if (!/^\d+$/.test(s)) return { err: "Only whole numbers work here, like 27 or 1000." };
      const t = s.replace(/^0+/, "");
      if (!t) return { err: "Zero just stays zero. Try 1 or more." };
      if (t.length > CAP_DIGITS) return { err: `That's huge! Try something up to ${CAP_DIGITS} digits.` };
      return { n: BigInt(t), s: t };
    }

    function compute(n0) {
      let n = n0, steps = 0, peak = n0, peakI = 0;
      const logs = [log10(n0)];
      while (n !== 1n && steps < CAP_STEPS) {
        n = n & 1n ? 3n * n + 1n : n >> 1n;
        steps++;
        logs.push(log10(n));
        if (n > peak) { peak = n; peakI = steps; }
      }
      return { n0, logs, steps, peak, peakI, done: n === 1n };
    }

    function describe(r, s) {
      const start = s.length > 18 ? `Your ${s.length}-digit number` : `<strong>${fmt(r.n0)}</strong>`;
      if (r.steps === 0) return `<strong>1</strong> is already home. Every path ends in the same tiny loop: 1 → 4 → 2 → 1.`;
      if (!r.done) return `${start} was still going after ${CAP_STEPS.toLocaleString("en-US")} steps, so we stopped. Nobody has ever found a number that never reaches 1.`;
      const peak = r.peakI === 0 ? "It never climbs above where it started." : `Highest point: <strong>${fmt(r.peak)}</strong> at step ${r.peakI.toLocaleString("en-US")}.`;
      return `${start} falls to 1 in <strong>${r.steps.toLocaleString("en-US")}</strong> steps. ${peak}`;
    }

    function start(raw, fromUser) {
      const p = parse(raw);
      if (p.err) { out.innerHTML = p.err; return; }
      input.value = p.s.length <= 18 ? BigInt(p.s).toLocaleString("en-US") : p.s;
      const r = compute(p.n);
      run = { ...r, s: p.s, t0: performance.now(), dur: instant ? 0 : clamp(r.steps * 26, 1300, 6500), landed: null };
      out.innerHTML = "Falling…";
      canvas.setAttribute("aria-label", `Graph of the path of ${p.s.length > 18 ? "a " + p.s.length + "-digit number" : p.s} down to 1, ${r.steps} steps.`);
      run.text = describe(r, p.s);
      if (fromUser) {
        try { history.replaceState(null, "", "#n=" + p.s); } catch (e) { /* file:// */ }
        share.hidden = false; share.textContent = "Copy a link to this number";
      }
      ranOnce = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    }

    function draw(now) {
      const { w, h, dpr } = fit(canvas);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!run) return;
      const maxLog = Math.max(...sampleMax(run.logs));
      const yMax = Math.max(1, Math.ceil(maxLog + 0.05));
      ctx.font = `400 ${w < 520 ? 11 : 12}px Jost, system-ui, sans-serif`;
      const widest = ctx.measureText(yMax <= 6 ? Math.pow(10, yMax).toLocaleString("en-US") : "10" + sup(yMax)).width;
      const L = Math.ceil(widest) + (w < 520 ? 14 : 22), R = w < 520 ? 16 : 26, T = 34, B = 26;
      const pw = w - L - R, ph = h - T - B;
      const X = (i) => L + (run.steps ? (i / run.steps) * pw : pw / 2);
      const Y = (lg) => T + (1 - lg / yMax) * ph;

      // grid: powers of ten
      const every = Math.max(1, Math.ceil(yMax / 6));
      ctx.font = `400 ${w < 520 ? 11 : 12}px Jost, system-ui, sans-serif`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let k = 0; k <= yMax; k += every) {
        const y = Y(k);
        ctx.strokeStyle = "rgba(169,212,255,0.09)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
        ctx.fillStyle = "rgba(197,202,224,0.6)";
        ctx.fillText(k <= 6 ? Math.pow(10, k).toLocaleString("en-US") : "10" + sup(k), L - 10, y);
      }

      const u = run.dur ? clamp((now - run.t0) / run.dur, 0, 1) : 1;
      const prog = 1 - Math.pow(1 - u, 1.6);
      const head = prog * run.steps;
      if (u >= 1 && !run.landed) { run.landed = now; out.innerHTML = run.text; }
      const warm = run.landed ? clamp((now - run.landed) / 900, 0, 1) : 0;
      const col = ICE.map((c, i) => Math.round(lerp(c, GOLD[i], warm))).join(",");

      // path (polyline for short runs, per-pixel min/max columns for very long ones)
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      const hi = Math.floor(head);
      if (run.steps <= pw * 1.5) {
        for (let i = 0; i <= hi; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), Y(run.logs[i]));
        if (hi < run.steps) ctx.lineTo(X(head), Y(lerp(run.logs[hi], run.logs[hi + 1], head - hi)));
      } else {
        const cols = Math.ceil(pw);
        const per = run.steps / cols;
        for (let c = 0; c <= cols; c++) {
          const i0 = Math.floor(c * per), i1 = Math.min(hi, Math.floor((c + 1) * per));
          if (i0 > hi) break;
          let mn = Infinity, mx = -Infinity;
          for (let i = i0; i <= i1; i++) { const v = run.logs[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
          const x = L + c;
          if (c === 0) ctx.moveTo(x, Y(mx)); else ctx.lineTo(x, Y(mx));
          ctx.lineTo(x, Y(mn));
        }
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(${col},0.16)`; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 1.7; ctx.stroke();

      // start label
      ctx.fillStyle = "rgba(243,240,232,0.85)"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.font = `500 ${w < 520 ? 12 : 13}px Jost, system-ui, sans-serif`;
      const startLabel = run.s.length > 18 ? `${run.s.length}-digit start` : fmt(run.n0);
      ctx.shadowColor = "rgba(5,8,23,0.95)"; ctx.shadowBlur = 6;
      ctx.fillText(startLabel, Math.min(X(0) + 4, w - R - ctx.measureText(startLabel).width), Math.max(14, Y(run.logs[0]) - 16));
      ctx.shadowBlur = 0;

      // peak flag
      if (run.peakI > 0 && head >= run.peakI && X(run.peakI) - X(0) > 150) {
        const px = X(run.peakI), py = Y(run.logs[run.peakI]);
        const label = "peak " + fmt(run.peak);
        ctx.font = `400 ${w < 520 ? 11 : 12}px Jost, system-ui, sans-serif`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(255,220,160,0.9)"; ctx.textAlign = "left";
        ctx.fillText(label, clamp(px - tw / 2, L, w - R - tw), Math.max(12, py - 10));
        ctx.drawImage(sprGold, px - 10, py - 10, 20, 20);
      }

      // the falling ball
      const hy = hi < run.steps ? lerp(run.logs[hi], run.logs[hi + 1], head - hi) : run.logs[run.steps];
      const bx = X(head), by = Y(hy);
      const bs = 34;
      ctx.drawImage(warm > 0.5 ? sprGold : sprIce, bx - bs / 2, by - bs / 2, bs, bs);

      // landing bloom on 1
      if (run.landed) {
        const k = clamp((now - run.landed) / 1400, 0, 1);
        const r = 10 + k * 70;
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.drawImage(sprGold, bx - r, by - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = "source-over";
      if (run.landed || u >= 1) {
        ctx.fillStyle = "rgba(255,220,160,0.95)"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
        ctx.font = `500 13px Jost, system-ui, sans-serif`;
        ctx.fillText("1", bx - 10, by - 6);
      }
      if (!run.landed || now - run.landed < 1500) raf = requestAnimationFrame(draw);
    }
    // max of the logs without spreading a 100k array into Math.max
    function sampleMax(arr) { let m = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]; return [m]; }

    form.addEventListener("submit", (e) => { e.preventDefault(); start(input.value, true); });
    form.querySelectorAll(".chips button").forEach((b) => b.addEventListener("click", () => {
      let n = b.dataset.n;
      if (n === "random") { n = String(1 + Math.floor(Math.random() * 9)); while (n.length < 40) n += Math.floor(Math.random() * 10); }
      start(n, true);
    }));
    share.addEventListener("click", async () => {
      const url = location.href.split("#")[0].split("?")[0] + "#n=" + (run ? run.s : "27");
      try { await navigator.clipboard.writeText(url); share.textContent = "Link copied"; }
      catch (e) { window.prompt("Copy this link:", url); }
    });
    window.addEventListener("resize", () => { if (run) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });

    // a shared link (#n=...) opens straight onto the toy
    const m = location.hash.match(/^#n=(\d{1,300})$/);
    if (m) {
      input.value = m[1];
      const go = () => { const el = document.getElementById("play"); el.scrollIntoView({ behavior: "auto", block: "start" }); start(m[1], false); share.hidden = false; };
      if (document.readyState === "complete") setTimeout(go, 50); else window.addEventListener("load", () => setTimeout(go, 50));
    }
    // first time it comes into view, drop 27 so it's never empty
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && !ranOnce) { start("27", false); io.disconnect(); } }, { threshold: 0.35 });
      io.observe(canvas);
    } else start("27", false);
  })();

  // =====================================================================
  // 2) LIFE DOTS
  // =====================================================================
  (() => {
    const canvas = document.getElementById("orbit-canvas");
    const stats = document.getElementById("orbit-stats");
    const addBtn = document.getElementById("orbit-add");
    const whisper = document.getElementById("orbit-whisper");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const PAL = ["255,211,138", "255,182,210", "169,212,255", "191,240,198", "205,185,255", "255,176,138"];
    const SPR = PAL.map(sprite), YOU = sprite("255,242,214");
    let people = [], visible = false, raf = 0, last = 0, lastTouch = -10, clock = 0, nextAuto = 1.2, size = { w: 400, h: 400 };
    let counts = "";

    function spawn(px, py) {
      const { w } = size, c = w / 2, maxR = w * 0.46;
      let d, ang;
      if (px == null) { ang = rr(0, Math.PI * 2); d = maxR + 30; }
      else { ang = Math.atan2(py - c, px - c); d = Math.hypot(px - c, py - c); }
      const tr = clamp(d, w * 0.13, w * 0.34) * rr(0.92, 1.04);
      people.push({ ang, r: Math.max(d, 8), tr, w: 0.55 * Math.pow((w * 0.2) / tr, 1.5) * (reduce ? 0.35 : 1), c: Math.floor(rr(0, PAL.length)),
        a: 0, s: rr(4.6, 6.4), st: "arrive", age: 0, life: rr(4.5, 10), ph: rr(0, 6.28) });
      if (people.length > 46) { const i = people.findIndex((p) => p.st === "star"); if (i >= 0) people.splice(i, 1); }
      wake();
    }

    function update(dt) {
      const { w } = size, maxR = w * 0.46;
      if (!reduce && visible && clock - lastTouch > 3.5 && clock > nextAuto) {
        const inOrbit = people.filter((p) => p.st === "arrive" || p.st === "orbit").length;
        if (inOrbit < 7) spawn(null, null);
        nextAuto = clock + rr(1.4, 2.6);
      }
      for (const p of people) {
        p.age += dt;
        p.ang += p.w * dt;
        if (p.st === "arrive") {
          p.r += (p.tr - p.r) * (1 - Math.exp(-dt * 2.4));
          p.a = Math.min(1, p.a + dt * 1.5);
          if (Math.abs(p.r - p.tr) < 1.5) p.st = "orbit";
        } else if (p.st === "orbit") {
          if (p.age > p.life) {
            if (Math.random() < 0.4) p.st = "stay";
            else { p.st = "drift"; p.out = maxR * rr(0.9, 1.0); }
          }
        } else if (p.st === "drift") {
          p.r += (p.out - p.r) * dt * 0.45;
          p.w *= 1 - dt * 0.55;
          p.a = Math.max(0.32, p.a - dt * 0.18);
          if (Math.abs(p.out - p.r) < 2 && Math.abs(p.w) < 0.02) { p.st = "star"; p.w = 0; }
        }
      }
      const stayed = people.filter((p) => p.st === "stay").length;
      const passed = people.filter((p) => p.st === "drift" || p.st === "star").length;
      const orbit = people.filter((p) => p.st !== "drift" && p.st !== "star").length;
      const txt = `In orbit: ${orbit} · Stayed: ${stayed} · Passed through: ${passed}`;
      if (txt !== counts) { counts = txt; stats.textContent = txt; }
      if (stayed && passed) whisper.classList.add("on");
    }

    function draw() {
      const { w, h, dpr } = fit(canvas);
      size = { w, h };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const c = w / 2;
      ctx.globalCompositeOperation = "lighter";
      for (const p of people) {
        if (p.st !== "stay") continue;
        ctx.strokeStyle = `rgba(${PAL[p.c]},0.07)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(c, c, p.r, 0, Math.PI * 2); ctx.stroke();
        const x = c + Math.cos(p.ang) * p.r, y = c + Math.sin(p.ang) * p.r;
        const g = ctx.createLinearGradient(c, c, x, y);
        g.addColorStop(0, "rgba(255,230,190,0.28)"); g.addColorStop(1, `rgba(${PAL[p.c]},0.05)`);
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(x, y); ctx.stroke();
      }
      for (const p of people) {
        const x = c + Math.cos(p.ang) * p.r, y = c + Math.sin(p.ang) * p.r;
        const breathe = 1 + 0.1 * Math.sin(clock * 3 + p.ph);
        const glow = p.st === "stay" ? 1.35 : p.st === "star" ? 0.7 : 1;
        const s = p.s * 6 * breathe * glow;
        ctx.globalAlpha = p.a * (p.st === "star" ? 0.6 + 0.3 * Math.sin(clock * 1.7 + p.ph) : 1);
        ctx.drawImage(SPR[p.c], x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      const ys = (11 + Math.sin(clock * 2) * 0.9) * 6;
      ctx.drawImage(YOU, c - ys / 2, c - ys / 2, ys, ys);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(197,202,224,0.75)"; ctx.font = "400 12px Jost, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("you", c, c + 16);
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; clock += dt;
      update(dt); draw();
      raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    }
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      lastTouch = clock;
      spawn(e.clientX - r.left, e.clientY - r.top);
    });
    addBtn.addEventListener("click", () => { lastTouch = clock; spawn(null, null); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && visible) wake(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) wake(); }, { threshold: 0.05 }).observe(canvas);
    } else { visible = true; wake(); }
    // three people are already here when you arrive
    const r0 = canvas.getBoundingClientRect();
    size = { w: r0.width || 400, h: r0.height || 400 };
    for (let i = 0; i < 3; i++) {
      spawn(null, null);
      const p = people[people.length - 1];
      p.r = p.tr = size.w * rr(0.16, 0.3); p.a = 1; p.st = "orbit"; p.life = rr(3, 7) + i * 2;
      p.w = 0.55 * Math.pow((size.w * 0.2) / p.tr, 1.5) * (reduce ? 0.35 : 1);
    }
    draw();
  })();
})();
