/* Only Wonder: the sky.
   One continuous 3D space of glowing dots. Every section of the page is a place in it,
   and scrolling moves a camera from place to place:
   hero cloud -> road of seeds (Lessons) -> lattice of numbers (Science) -> pulses (News)
   -> constellation (About) -> pull all the way back to see the road you travelled. */
(() => {
  "use strict";
  const canvas = document.getElementById("sky");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = mqReduce.matches;

  const ROAD = 4200;               // length of the Lessons road in world units
  const SCI_X = ROAD + 300;        // x of the science / news / about column

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let seed = 20261026;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // ---------- palette + glow sprites ----------
  const COLORS = ["#dfe6ff", "#ffd38a", "#ffb08a", "#a9d4ff", "#bff0c6", "#cdb9ff", "#ffb6d2", "#fff2d6"];
  const SPR = 64;
  const sprites = COLORS.map((c) => {
    const s = document.createElement("canvas");
    s.width = s.height = SPR;
    const g = s.getContext("2d");
    const [r, gg, b] = hex(c);
    const grad = g.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.1, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.22, `rgba(${r},${gg},${b},0.42)`);
    grad.addColorStop(0.5, `rgba(${r},${gg},${b},0.09)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPR, SPR);
    return s;
  });

  // ---------- size / quality ----------
  let W = 0, H = 0, DPR = 1, F = 600, density = 1;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(w - W) < 1 && Math.abs(h - H) < 1) return;
    W = w; H = h;
    DPR = Math.min(window.devicePixelRatio || 1, W < 760 ? 1.5 : 1.75);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    F = Math.sqrt(W * H) * 0.78;
  }
  resize();
  density = clamp((window.innerWidth * window.innerHeight) / (1440 * 900), 0.5, 1);

  // ---------- particles (struct of arrays) ----------
  const MAX = 4200;
  const PX = new Float32Array(MAX), PY = new Float32Array(MAX), PZ = new Float32Array(MAX);
  const PR = new Float32Array(MAX), PA = new Float32Array(MAX), PH = new Float32Array(MAX), AMP = new Float32Array(MAX);
  const PC = new Uint8Array(MAX);
  const SX = new Float32Array(MAX), SY = new Float32Array(MAX), OX = new Float32Array(MAX), OY = new Float32Array(MAX);
  const VALID = new Uint8Array(MAX);
  let N = 0;
  function add(x, y, z, r, a, c, amp = 0) {
    if (N >= MAX) return;
    PX[N] = x; PY[N] = y; PZ[N] = z; PR[N] = r; PA[N] = a; PC[N] = c; PH[N] = rnd() * Math.PI * 2; AMP[N] = amp;
    N++;
  }

  // background stars through the whole space
  for (let i = 0; i < 560 * density; i++) {
    add(rr(-5000, ROAD + 5500), rr(-6500, 3800), rr(-3000, 24000), rr(1.6, 3.4), rr(0.22, 0.62), rnd() < 0.75 ? 0 : (rnd() < 0.5 ? 3 : 7), rr(4, 18));
  }
  // hero cloud
  for (let i = 0; i < 430 * density; i++) {
    const z = 300 + Math.pow(rnd(), 1.25) * 4300;
    const c = rnd() < 0.07 ? 1 : rnd() < 0.05 ? 6 : rnd() < 0.3 ? 3 : 0;
    add(gauss() * 2600, gauss() * 1600, z, rr(2.2, 5.2), rr(0.35, 0.95), c, rr(20, 70));
  }
  // the road of seeds
  const roadY = (x) => 620 + 120 * Math.sin(x / 700);
  const roadZ = (x) => 6800 + 200 * Math.sin(x / 1100 + 1);
  for (let x = -1200; x <= ROAD + 1300; x += 52) {
    add(x, roadY(x), roadZ(x), 3.2, 0.75, 1, 3);
    if (rnd() < 0.6) add(x + rr(-30, 30), roadY(x) + rr(10, 120), roadZ(x) + rr(-200, 200), rr(1.4, 2.6), rr(0.2, 0.5), rnd() < 0.5 ? 2 : 7, 10);
  }
  // science lattice: planes of faint dots, like graph paper floating in space
  const latStep = density < 0.7 ? 420 : 320;
  for (const z of [12600, 13900, 15200, 16500]) {
    for (let x = -1900; x <= 1900; x += latStep) {
      for (let y = -1300; y <= 1300; y += latStep) {
        add(SCI_X + x, y + 150, z, 2.1, 0.32, 3, 2);
      }
    }
  }
  // news + about neighbourhood dust
  for (let i = 0; i < 160 * density; i++) add(SCI_X + gauss() * 2600, -2700 + gauss() * 1700, rr(16500, 21500), rr(1.8, 3.6), rr(0.25, 0.7), rnd() < 0.5 ? 5 : 0, rr(10, 40));

  // ---------- trees of light along the road ----------
  const trees = [];
  function makeTree(tx) {
    const by = roadY(tx), bz = roadZ(tx) + rr(-40, 40);
    const segs = [], tips = [];
    const L0 = rr(72, 100);
    (function grow(x, y, ang, len, d) {
      const x1 = x + Math.sin(ang) * len, y1 = y - Math.cos(ang) * len;
      segs.push([x, y, x1, y1, d]);
      if (d >= 4) { tips.push([x1, y1]); return; }
      const n = d === 0 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const spread = n === 3 ? (k - 1) * 0.55 : (k ? 0.42 : -0.42);
        grow(x1, y1, ang + spread + rr(-0.12, 0.12), len * rr(0.62, 0.76), d + 1);
      }
    })(tx, by, rr(-0.06, 0.06), L0, 0);
    const leaves = [];
    for (const [x, y] of tips) {
      const n = density < 0.7 ? 3 : 5;
      for (let k = 0; k < n; k++) leaves.push([x + rr(-22, 22), y + rr(-17, 12), rr(1.8, 3.4), [1, 2, 4, 7, 6][Math.floor(rnd() * 5)], rnd() * 6.28]);
    }
    trees.push({ x: tx, z: bz, segs, leaves, g: 0 });
  }
  for (let x = 250; x <= ROAD + 900; x += rr(520, 760)) makeTree(x);

  // ---------- hailstone paths in the science world ----------
  function hail(n) { const out = [n]; while (n !== 1 && out.length < 400) { n = n % 2 ? 3 * n + 1 : n / 2; out.push(n); } return out; }
  const paths = [
    { seq: hail(27), z: 13200, y0: 820, w: 3600 },
    { seq: hail(97), z: 14500, y0: 760, w: 3300 },
    { seq: hail(871), z: 15800, y0: 900, w: 3900 },
  ].map((p) => {
    const n = p.seq.length - 1;
    p.pts = p.seq.map((v, i) => [SCI_X - p.w / 2 + (i / n) * p.w, p.y0 - Math.log10(v) * 340]);
    p.speed = n / 9; // steps per second for the travelling ball
    return p;
  });

  // ---------- camera keys (rebuilt from the page layout) ----------
  const BG = {
    hero: ["#050817", "#0b1233"],
    lessons: ["#0a0913", "#1c1426"],
    science: ["#030a19", "#08203d"],
    news: ["#07071a", "#16123a"],
    about: ["#05060f", "#0d1028"],
    end: ["#020309", "#0a0c1e"],
  };
  for (const k in BG) BG[k] = BG[k].map(hex);
  let keys = [{ s: 0, x: 0, y: 0, z: 0, f: 1, far: 6500, trail: 0, cy: 0.5, pitch: 0, bg: BG.hero, lin: false }];

  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function buildKeys() {
    const $ = (s) => document.querySelector(s);
    const vh = window.innerHeight;
    const flies = document.querySelectorAll("[data-fly]");
    const hs = $("[data-hscroll]"), orbit = $("#orbit"), play = $("#play"), news = $("#news"), about = $("#about"), end = $("#end");
    if (!flies[1] || !hs || !orbit || !play || !news || !about || !end) return;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const mid = (el) => docTop(el) + el.offsetHeight / 2 - vh / 2;
    const K = (s, x, y, z, bg, o = {}) => ({ s, x, y, z, bg: BG[bg], f: o.f || 1, far: o.far || 6500, trail: o.trail || 0, cy: o.cy || 0.5, pitch: o.pitch || 0, lin: !!o.lin });
    const list = [
      K(0, 0, 0, 0, "hero"),
      K(docTop(flies[0]) + flies[0].offsetHeight - vh, 0, -40, 4300, "hero"),
      K(docTop(hs), -350, 0, 5250, "lessons"),
      K(docTop(hs) + hs.offsetHeight - vh, ROAD + 100, 0, 5250, "lessons", { lin: true }),
      K(mid(orbit), SCI_X, -120, 5650, "lessons"),
      K(docTop(flies[1]) + flies[1].offsetHeight - vh, SCI_X, 0, 11400, "science"),
      K(docTop(play), SCI_X, 150, 12500, "science"),
      K(docTop(play) + play.offsetHeight - vh, SCI_X, 200, 14600, "science"),
      K(mid(news), SCI_X, -2700, 16300, "news"),
      K(mid(about), SCI_X, -2700, 18900, "about"),
      K(docTop(end), SCI_X, -2700, 19300, "about"),
      K(max, 2300, -16000, -14000, "end", { f: W < 720 ? 0.92 : 0.85, far: 60000, trail: 1, cy: W < 720 ? 0.21 : 0.3, pitch: 0.62 }),
    ];
    for (let i = 1; i < list.length; i++) if (list[i].s <= list[i - 1].s) list[i].s = list[i - 1].s + 1;
    keys = list;
    buildTrail();
  }

  function sampleKeys(s) {
    // the page can change height after the keys were built: the last key always sits at the real bottom
    const last = keys[keys.length - 1], maxS = document.documentElement.scrollHeight - window.innerHeight;
    if (keys.length > 1) last.s = Math.max(keys[keys.length - 2].s + 1, maxS);
    if (s <= keys[0].s) return { ...keys[0], t: 0 };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (s <= b.s) {
        let t = (s - a.s) / (b.s - a.s);
        t = b.lin ? (typeof window.__owRoad === "number" ? window.__owRoad : t) : ease(t);
        return {
          x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
          f: lerp(a.f, b.f, t), far: lerp(a.far, b.far, t), trail: lerp(a.trail, b.trail, t), cy: lerp(a.cy, b.cy, t), pitch: lerp(a.pitch, b.pitch, t),
          bg: [0, 1].map((j) => [0, 1, 2].map((c) => lerp(a.bg[j][c], b.bg[j][c], t))),
        };
      }
    }
    return { ...keys[keys.length - 1] };
  }

  // the road you travelled, drawn only when you look back (catmull-rom through the camera keys)
  let trail = [];
  function buildTrail() {
    const pts = keys.slice(0, -1).map((k) => [k.x, k.y * 0.18 + 420, k.z + 700]);
    pts.unshift([0, 420, -600]);
    for (let i = pts.length - 1; i > 0; i--) if (Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]) < 300) pts.splice(i, 1);
    trail = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const steps = 40;
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const q = [0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3));
        q[0] += 420 * Math.sin(q[2] / 2300) * smooth(-600, 2000, q[2]); // let the road wander a little
        trail.push(q);
      }
    }
  }

  // ---------- input ----------
  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0, last: -10 };
  let clock = 0;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = (e.clientX / W) * 2 - 1; mouse.ny = (e.clientY / H) * 2 - 1;
    mouse.last = clock;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

  // ---------- render ----------
  const cam = { x: 0, y: 0, z: 0, f: 1, far: 6500, trail: 0, cy: 0.5, pitch: 0, bg: BG.hero };
  let prev = { x: 0, y: 0, z: 0 };
  let first = true;

  function drawBg(bg) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const c = (a) => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
    g.addColorStop(0, c(bg[0]));
    g.addColorStop(1, c(bg[1]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function render(dt) {
    const target = sampleKeys(window.scrollY);
    const snapped = first || reduce;
    const k = snapped ? 1 : 1 - Math.exp(-dt * 5.5);
    first = false;
    cam.x = lerp(cam.x, target.x, k); cam.y = lerp(cam.y, target.y, k); cam.z = lerp(cam.z, target.z, k);
    cam.f = lerp(cam.f, target.f, k); cam.far = lerp(cam.far, target.far, k); cam.trail = lerp(cam.trail, target.trail, k); cam.cy = lerp(cam.cy, target.cy, k); cam.pitch = lerp(cam.pitch, target.pitch, k);
    cam.bg = target.bg;
    // gentle look-around with the mouse
    const mk = reduce ? 0 : 1 - Math.exp(-dt * 2.5);
    mouse.sx = lerp(mouse.sx, mouse.nx, mk); mouse.sy = lerp(mouse.sy, mouse.ny, mk);
    const cx = cam.x + mouse.sx * 90 * (1 - cam.trail), cy = cam.y + mouse.sy * 55 * (1 - cam.trail), cz = cam.z;
    const speed = Math.abs(cam.z - prev.z) / Math.max(dt, 0.008); // streak only when flying forward or back
    prev = { x: cam.x, y: cam.y, z: cam.z };
    const streak = !reduce && speed > 900;
    const fl = F * cam.f, far = cam.far, near = 40, hw = W / 2, hh = H * cam.cy;
    const roadDim = W < 720 ? 0.5 : 1;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBg(cam.bg);
    ctx.globalCompositeOperation = "lighter";

    const mouseOn = !reduce && clock - mouse.last < 2.5 && mouse.x > -999;
    const t = clock;
    // --- particles ---
    for (let i = 0; i < N; i++) {
      const amp = AMP[i], ph = PH[i];
      const wy = PY[i] + (amp ? Math.cos(t * 0.17 + ph * 1.3) * amp * 0.7 : 0);
      const ry = wy - cy, rz = PZ[i] - cz;
      const dz = ry * sp + rz * cp;
      if (dz < near || dz > far) { VALID[i] = 0; continue; }
      const wx = PX[i] + (amp ? Math.sin(t * 0.21 + ph) * amp : 0);
      const sc = fl / dz;
      let sx = hw + (wx - cx) * sc, sy = hh + (ry * cp - rz * sp) * sc;
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) { VALID[i] = 0; continue; }
      // cursor: dots lean away from the pointer, then spring back
      if (mouseOn) {
        const ddx = sx - mouse.x, ddy = sy - mouse.y, d2 = ddx * ddx + ddy * ddy;
        if (d2 < 30000) {
          const d = Math.sqrt(d2) + 0.01, push = (1 - d / 173) * (1 - d / 173) * 38;
          OX[i] += ((ddx / d) * push - OX[i]) * 0.14; OY[i] += ((ddy / d) * push - OY[i]) * 0.14;
        } else { OX[i] *= 0.93; OY[i] *= 0.93; }
      } else { OX[i] *= 0.93; OY[i] *= 0.93; }
      sx += OX[i]; sy += OY[i];
      let s = PR[i] * sc;
      let a = PA[i] * (0.78 + 0.22 * Math.sin(t * 1.3 + ph * 3));
      a *= smooth(far, far * 0.55, dz) * smooth(near, near + 520, dz);
      if (s < 0.8) { a *= s / 0.8; s = 0.8; }
      if (s > 22) s = 22;
      if (a < 0.01) { VALID[i] = 0; continue; }
      if (streak && VALID[i] && s > 1) {
        const lx = SX[i], ly = SY[i];
        const len = Math.abs(sx - lx) + Math.abs(sy - ly);
        if (len > 4 && len < 400) {
          ctx.globalAlpha = Math.min(0.55, a * 0.6);
          ctx.strokeStyle = COLORS[PC[i]];
          ctx.lineWidth = Math.min(3, s * 0.7);
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(sx, sy); ctx.stroke();
        }
      }
      SX[i] = sx; SY[i] = sy; VALID[i] = 1;
      ctx.globalAlpha = a > 1 ? 1 : a;
      const d = s * 5;
      ctx.drawImage(sprites[PC[i]], sx - d / 2, sy - d / 2, d, d);
    }

    const proj = (x, y, z) => {
      const ry = y - cy, rz = z - cz, dz = ry * sp + rz * cp;
      if (dz < near || dz > far) return null;
      const sc = fl / dz;
      return [hw + (x - cx) * sc, hh + (ry * cp - rz * sp) * sc, sc, dz];
    };
    const fog = (dz) => smooth(far, far * 0.55, dz) * smooth(near, near + 520, dz);

    // --- the road line ---
    ctx.lineCap = "round";
    ctx.beginPath();
    let started = false, roadA = 0;
    for (let x = -1200; x <= ROAD + 1300; x += 60) {
      const p = proj(x, roadY(x), roadZ(x));
      if (!p) { started = false; continue; }
      roadA = Math.max(roadA, fog(p[3]));
      if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
    }
    if (roadA > 0.01) {
      ctx.globalAlpha = 0.22 * roadA * roadDim; ctx.strokeStyle = "#ffd38a"; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // --- trees: they grow as the camera reaches them, and stay grown ---
    for (const tr of trees) {
      const want = Math.max(smooth(tr.x - 1500, tr.x - 250, cam.x) * smooth(4000, 5000, cam.z), cam.z > 7000 || cam.trail > 0.05 ? 1 : 0);
      if (want > tr.g) tr.g = snapped ? want : Math.min(want, tr.g + dt * 0.55);
      if (tr.g <= 0.001) continue;
      const base = proj(tr.x, roadY(tr.x), tr.z);
      if (!base) continue;
      const a = fog(base[3]) * roadDim;
      if (a < 0.01) continue;
      const g = tr.g * 5.2;
      ctx.strokeStyle = "#ffd9a0";
      for (const [x0, y0, x1, y1, d] of tr.segs) {
        const vf = clamp(g - d, 0, 1);
        if (vf <= 0) continue;
        const sc = base[2];
        const A = proj(x0, y0, tr.z), B = proj(x0 + (x1 - x0) * vf, y0 + (y1 - y0) * vf, tr.z);
        if (!A || !B) continue;
        const ax = A[0], ay = A[1], bx = B[0], by = B[1];
        ctx.globalAlpha = 0.5 * a;
        ctx.lineWidth = Math.max(0.6, (5 - d) * 0.85 * sc);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      const la = clamp((tr.g - 0.72) / 0.28, 0, 1) * a;
      if (la > 0.01) {
        for (const [x, y, r, c, ph] of tr.leaves) {
          const sc = base[2];
          const L = proj(x + Math.sin(t * 0.6 + ph) * 3, y, tr.z);
          if (!L) continue;
          const sx = L[0], sy = L[1];
          let s = r * sc; if (s < 0.8) s = 0.8;
          ctx.globalAlpha = la * (0.65 + 0.35 * Math.sin(t * 1.1 + ph));
          const d = s * 5;
          ctx.drawImage(sprites[c], sx - d / 2, sy - d / 2, d, d);
        }
      }
    }

    // --- hailstone paths, each with a ball bouncing down to 1 ---
    for (const p of paths) {
      const b = proj(SCI_X, 0, p.z);
      if (!b) continue;
      const a = fog(b[3]) * smooth(near, 1700, b[3]);
      if (a < 0.01) continue;
      const sc = b[2];
      ctx.beginPath();
      p.pts.forEach(([x, y], i) => { const q = proj(x, y, p.z); if (q) (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); });
      ctx.globalAlpha = 0.13 * a; ctx.strokeStyle = "#a9d4ff"; ctx.lineWidth = Math.max(0.7, 2.2 * sc); ctx.stroke();
      const n = p.pts.length - 1;
      const cyc = (t * p.speed) % (n + 30);
      const head = Math.min(n, cyc);
      const hi = Math.floor(head), fr = head - hi;
      // bright tail
      ctx.beginPath();
      for (let j = Math.max(0, hi - 14); j <= hi; j++) {
        const [x, y] = p.pts[j]; const q = proj(x, y, p.z); if (!q) continue;
        j === Math.max(0, hi - 14) ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]);
      }
      const q0 = p.pts[hi], q1 = p.pts[Math.min(n, hi + 1)];
      const hq = proj(lerp(q0[0], q1[0], fr), lerp(q0[1], q1[1], fr), p.z) || [0, 0];
      const hx = hq[0], hy = hq[1];
      ctx.lineTo(hx, hy);
      ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = cyc >= n ? "#ffd38a" : "#d8ecff"; ctx.lineWidth = Math.max(1, 4 * sc); ctx.stroke();
      const s = Math.max(1.2, 9 * sc) * 5;
      ctx.globalAlpha = a;
      ctx.drawImage(sprites[cyc >= n ? 1 : 3], hx - s / 2, hy - s / 2, s, s);
    }

    // --- news: pulses of discovery travelling outward ---
    {
      const c = proj(SCI_X, -3120, 17700);
      if (c) {
        const a = fog(c[3]);
        if (a > 0.01) {
          const sc = c[2];
          for (let r = 0; r < 5; r++) {
            const fr = (t * 0.07 + r / 5) % 1;
            const rad = 120 + fr * 1900;
            const ra = Math.pow(1 - fr, 1.6) * a * 0.85;
            const dots = 44;
            for (let j = 0; j < dots; j++) {
              const ang = (j / dots) * Math.PI * 2 + r;
              const q = proj(SCI_X + Math.cos(ang) * rad, -3120 + Math.sin(ang) * rad, 17700);
              if (!q) continue;
              const sx = q[0], sy = q[1];
              const s = Math.max(1, 5 * sc) * 5;
              ctx.globalAlpha = ra;
              ctx.drawImage(sprites[j % 3 ? 5 : 0], sx - s / 2, sy - s / 2, s, s);
            }
          }
          const s = Math.max(2, 16 * sc) * 5 * (1 + 0.12 * Math.sin(t * 2));
          ctx.globalAlpha = a;
          ctx.drawImage(sprites[7], c[0] - s / 2, c[1] - s / 2, s, s);
        }
      }
    }

    // --- about: a small constellation of four promises ---
    {
      const stars = [[-900, -450], [-250, 260], [420, -220], [980, 380]];
      const pts = stars.map(([x, y]) => proj(SCI_X + x, -2700 + y, 20300));
      if (pts.every(Boolean)) {
        const a = fog(pts[0][3]);
        if (a > 0.01) {
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          ctx.globalAlpha = 0.13 * a; ctx.strokeStyle = "#ffd38a"; ctx.lineWidth = 1; ctx.stroke();
          pts.forEach((p, i) => {
            const s = Math.max(2, 13 * p[2]) * 5 * (1 + 0.1 * Math.sin(t * 1.4 + i));
            ctx.globalAlpha = a; ctx.drawImage(sprites[1], p[0] - s / 2, p[1] - s / 2, s, s);
          });
        }
      }
    }

    // --- the view back: the whole journey as one line of light ---
    if (cam.trail > 0.02 && trail.length) {
      ctx.beginPath();
      let on = false;
      for (const [x, y, z] of trail) {
        const p = proj(x, y, z);
        if (!p) { on = false; continue; }
        on ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        on = true;
      }
      ctx.strokeStyle = "#ffd38a";
      ctx.globalAlpha = 0.18 * cam.trail; ctx.lineWidth = 7; ctx.stroke();
      ctx.globalAlpha = 0.75 * cam.trail; ctx.lineWidth = 1.6; ctx.stroke();
      // a traveller dot walking the line, so the loop starts again
      const idx = Math.floor((t * 22) % trail.length);
      const p = proj(...trail[idx]);
      if (p) { const s = 26; ctx.globalAlpha = cam.trail; ctx.drawImage(sprites[7], p[0] - s / 2, p[1] - s / 2, s, s); }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- loop ----------
  let last = performance.now(), raf = 0, running = false;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    render(dt);
    raf = running ? requestAnimationFrame(loop) : 0;
  }
  function start() {
    if (running || reduce) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  // reduced motion: a still sky that only changes when you scroll
  let pending = false;
  function still() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(0); }); }

  window.addEventListener("scroll", () => { if (reduce) still(); }, { passive: true });
  window.addEventListener("resize", () => { resize(); if (reduce) still(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  mqReduce.addEventListener && mqReduce.addEventListener("change", (e) => { reduce = e.matches; if (reduce) { stop(); still(); } else start(); });
  document.addEventListener("ow:layout", () => { buildKeys(); if (reduce) still(); });
  window.OWSky = { snap() { first = true; if (reduce) still(); }, state: () => ({ cam, keys: keys.map((k) => [k.s | 0, k.z | 0]), trail: trail.length, W, H, scrollY: window.scrollY }) };

  buildKeys();
  if (reduce) still(); else start();
})();
