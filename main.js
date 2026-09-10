/* Colmez LP — scroll choreography
   One pinned stage. Smoothed progress P (0..1) over the stage's track drives:
     A  0.00–0.22  photo rises from y=460u to y=0, covering the hero copy
     A' 0.02–0.24  logo + CTA morph into the nav; hero words dissolve L→R 0.01–0.16
     B  0.12–0.55  photo dissolves (WebGL goo) — starts while the photo is still rising
     B' 0.14–0.62  vector pattern fades in, line after line
     C  0.30–0.56  waste list words rise one by one; per-word shimmer fill mid-rise
     D  0.53–0.70  lead words follow the same way
   The A–D map lives in Pw (the original 420vh feel inside a shorter 330vh
   track — the dead tail is gone). The exit happens DURING the crisis
   ride-in, driven by its entry progress E: waste words dissolve out
   hero-style from "Solvents" (E 0.02–0.44) together with the pattern
   running its own draw-in backwards (E 0.04–0.48) — both gone by the time
   the crisis edge reaches mid-viewport, where its entry cascade starts:
   section headline, then per box heading → photo shimmer → subhead.
   Accordion choreography (E entry / C pinned) sits further down. The nav is
   position:fixed, so the compact logo+CTA ride the whole page. Wheel
   scrolling is smoothed page-wide (same k as the progress smoothing;
   other inputs stay native).
   The pattern is VECTOR: a 2D canvas restrokes it every frame. Lines morph
   slowly (noise field); the pointer stirs it: a continuous swirl on an eased
   follower plus a trail of slowly-decaying swirls — a long dense-liquid wake.
   Bubbles ride the same field.
   Logo hover: WebGL goo-shader hole around the cursor, glyph-masked in-shader.
   Smooth scroll: native scroll stays, P is exponentially smoothed — no lib. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const pin = stage.querySelector('.stage__pin');
  const photoLayer = $('photoLayer');
  const canvas = $('photoCanvas');
  const patCanvas = $('patternCanvas');
  const list = $('wasteList');
  const lead = $('wasteLead');
  const hint = $('scrollHint');
  const logo = $('navLogo');
  const cta = $('navCta');

  const GOLD = [0xae / 255, 0x9a / 255, 0x29 / 255];
  const GOLD_CSS = '#ae9a29';
  const BG_CSS = '#121212';
  const TEX_ASPECT = 1496 / 820;
  const DESIGN_W = 1496, DESIGN_H = 820;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- helpers ----------
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (p, a, b) => clamp01((p - a) / (b - a));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const u = () => pin.clientWidth / 1496;

  // ---------- nav morph ----------
  const LOGO_REST = { x: 40, y: 40, w: 1416, h: 191 };
  const CTA_REST = { x: 1117, y: 271, w: 339, h: 129, fs: 16, pb: 8 };
  const NAV = { top: 20, logoH: 24, ctaW: 172, ctaH: 32, ctaFs: 12, pad: 12 };
  let lastNavT = -1;

  function layoutNav(t) {
    if (t === lastNavT) return;
    lastNavT = t;
    const k = u();
    const vw = pin.clientWidth;
    const gutter = 40 * k;
    const e = easeInOut(t);

    const lh1 = NAV.logoH, lw1 = lh1 * (LOGO_REST.w / LOGO_REST.h);
    logo.style.left = lerp(LOGO_REST.x * k, gutter, e) + 'px';
    logo.style.top = lerp(LOGO_REST.y * k, NAV.top, e) + 'px';
    logo.style.width = lerp(LOGO_REST.w * k, lw1, e) + 'px';
    logo.style.height = lerp(LOGO_REST.h * k, lh1, e) + 'px';

    const fs = lerp(CTA_REST.fs * k, NAV.ctaFs, e);
    const pb = lerp(CTA_REST.pb * k, (NAV.ctaH - fs * 1.2) / 2, e);
    cta.style.left = lerp(CTA_REST.x * k, vw - gutter - NAV.ctaW, e) + 'px';
    cta.style.top = lerp(CTA_REST.y * k, NAV.top + (NAV.logoH - NAV.ctaH) / 2, e) + 'px';
    cta.style.width = lerp(CTA_REST.w * k, NAV.ctaW, e) + 'px';
    cta.style.height = lerp(CTA_REST.h * k, NAV.ctaH, e) + 'px';
    cta.style.fontSize = fs + 'px';
    cta.style.padding = `0 ${lerp(12 * k, NAV.pad, e)}px ${pb}px`;
  }

  // ---------- pattern data (parsed once from pattern.svg) ----------
  let patLines = [], patFills = [], patDots = [];
  let patReady = false;
  let patSvgText = null;

  function parsePath(d) {
    const nums = d.match(/-?[\d.]+/g);
    const pts = new Float32Array(nums.length);
    for (let i = 0; i < nums.length; i++) pts[i] = +nums[i];
    return pts;
  }

  async function loadPattern() {
    const res = await fetch('assets/img/pattern.svg');
    const text = await res.text();
    patSvgText = text;
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');

    patLines = [...doc.querySelectorAll('.pattern__lines path')].map((el) => {
      let pts = parsePath(el.getAttribute('d'));
      if (pts.length > 320) { // downsample very dense polylines
        const keep = new Float32Array(2 * (Math.ceil(pts.length / 4) + 1));
        let j = 0;
        for (let i = 0; i < pts.length - 1; i += 4) { keep[j++] = pts[i]; keep[j++] = pts[i + 1]; }
        keep[j++] = pts[pts.length - 2]; keep[j++] = pts[pts.length - 1];
        pts = keep.subarray(0, j);
      }
      let len = 0;
      for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      return { o: +el.dataset.o, sw: +el.getAttribute('stroke-width'), pts, work: new Float32Array(pts.length), len };
    });

    patFills = [...doc.querySelectorAll('.pattern__fills path')].map((el) => {
      const pts = parsePath(el.getAttribute('d'));
      let cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
      cx /= pts.length / 2; cy /= pts.length / 2;
      return { o: +el.dataset.o, pts, work: new Float32Array(pts.length), cx, cy };
    });

    patDots = [];
    for (const el of doc.querySelectorAll('.pattern__noise path')) {
      const o = +el.dataset.o;
      const re = /M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)/g;
      let m;
      while ((m = re.exec(el.getAttribute('d')))) patDots.push({ o, x: +m[1], y: +m[2], s: +m[3] });
    }

    patReady = true;
    makeLogoTexture();
    dirty = true;
  }

  // ---------- noise ----------
  const PERM = new Uint8Array(512);
  {
    let sd = 7;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 256; i++) PERM[i] = PERM[i + 256] = (rnd() * 256) | 0;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf);
    const xa = xi & 255, ya = yi & 255;
    const a = PERM[(PERM[xa] + ya) & 255], b = PERM[(PERM[(xa + 1) & 255] + ya) & 255];
    const c = PERM[(PERM[xa] + ya + 1) & 255], d = PERM[(PERM[(xa + 1) & 255] + ya + 1) & 255];
    return ((a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv) / 255) * 2 - 1;
  }

  const MORPH_AMP = 10;        // design px — slow, viscous shape change
  const MORPH_FREQ = 1 / 190;  // wavelength ~190 design px
  const STIR_R2 = 85 * 85;     // stir influence radius²
  const STIR_K = 0.26;         // stir gain
  const STIR_CAP = 45;         // max stir displacement, design px
  const STIR_DECAY = 0.20;     // very slow release — the wake lingers like dense liquid
  const STIR_LIFE = 16;        // seconds a swirl stays alive
  const STIR_ATTACK = 0.35;    // seconds a swirl takes to reach full strength

  // pointer stir trail: slowly-decaying swirls (a stick in a bucket of paint).
  // 28 slots so a long, slowly-fading wake never gets snapped away mid-life.
  const NSTIR = 28;
  const stir = []; // {x, y, dx, dy, t0}
  for (let i = 0; i < NSTIR; i++) stir.push({ x: 0, y: 0, dx: 0, dy: 0, t0: -1e9 });
  let stirHead = 0, stirActive = false;
  // continuous primary swirl riding the eased follower — strength follows
  // pointer speed with a slow envelope, so slow moves stay perfectly smooth
  let mStr = 0, mDirX = 0, mDirY = 0;

  // continuous looped "self-stirring": three swirls slowly wandering the
  // pattern on closed orbits — same character as the pointer stir, subtler
  const AUTO_R2 = 170 * 170;
  const AUTO = [
    { cx: 420, cy: 260, rx: 260, ry: 160, w1: 0.10, w2: 0.081, ph: 0.0, dir: 1 },
    { cx: 930, cy: 520, rx: 320, ry: 180, w1: 0.077, w2: 0.093, ph: 2.1, dir: -1 },
    { cx: 1230, cy: 250, rx: 210, ry: 170, w1: 0.088, w2: 0.069, ph: 4.2, dir: 1 },
  ];

  // swirl-only part of the field (pointer stir + auto orbits) — also pushes bubbles
  const S = new Float32Array(2);
  function swirlAt(x, y, t, now) {
    let sx = 0, sy = 0;
    for (let i = 0; i < 3; i++) {
      const a = AUTO[i];
      const ax = a.cx + a.rx * Math.sin(t * a.w1 + a.ph);
      const ay = a.cy + a.ry * Math.cos(t * a.w2 + a.ph);
      const dx = x - ax, dy = y - ay;
      const w = Math.exp(-(dx * dx + dy * dy) / AUTO_R2) * 0.32 * a.dir;
      sx += -dy * w;
      sy += dx * w;
    }
    if (stirActive || mStr > 0.01) {
      let px = 0, py = 0;
      if (mStr > 0.01) {
        const dx = x - fwX, dy = y - fwY;
        const w = Math.exp(-(dx * dx + dy * dy) / STIR_R2) * mStr;
        px += (-dy * 1.2 + mDirX * 40) * w;
        py += (dx * 1.2 + mDirY * 40) * w;
      }
      for (let i = 0; i < NSTIR; i++) {
        const b = stir[i];
        const age = (now - b.t0) / 1000;
        if (age > STIR_LIFE) continue;
        const dx = x - b.x, dy = y - b.y;
        const env = Math.min(1, age / STIR_ATTACK); // ease in — no snapping
        const w = Math.exp(-(dx * dx + dy * dy) / STIR_R2) * Math.exp(-age * STIR_DECAY) * env * env * (3 - 2 * env);
        px += (-dy * 1.2 + b.dx * 40) * w;
        py += (dx * 1.2 + b.dy * 40) * w;
      }
      px *= STIR_K; py *= STIR_K;
      const m = Math.hypot(px, py);
      if (m > STIR_CAP) { px *= STIR_CAP / m; py *= STIR_CAP / m; }
      sx += px; sy += py;
    }
    S[0] = sx; S[1] = sy;
  }

  // combined displacement field (morph + swirls) -> F
  const F = new Float32Array(2);
  function field(x, y, t, now) {
    swirlAt(x, y, t, now);
    F[0] = S[0] + vnoise(x * MORPH_FREQ + t * 0.050, y * MORPH_FREQ) * MORPH_AMP;
    F[1] = S[1] + vnoise(x * MORPH_FREQ - 13.7, y * MORPH_FREQ + t * 0.045) * MORPH_AMP;
  }

  // deform pts -> work: sample the field every STEP-th point, lerp between
  const STEP = 3;
  function deform(pts, work, t, now, amp) {
    const n = pts.length;
    if (amp <= 0) { work.set(pts); return; }
    field(pts[0], pts[1], t, now);
    let px = F[0] * amp, py = F[1] * amp, i0 = 0;
    work[0] = pts[0] + px; work[1] = pts[1] + py;
    for (let i = 2; i < n; i += STEP * 2) {
      const j = Math.min(i + STEP * 2 - 2, n - 2);
      field(pts[j], pts[j + 1], t, now);
      const ndx = F[0] * amp, ndy = F[1] * amp;
      const span = (j - i0) / 2 || 1;
      for (let k = i; k <= j; k += 2) {
        const f = ((k - i0) / 2) / span;
        work[k] = pts[k] + px + (ndx - px) * f;
        work[k + 1] = pts[k + 1] + py + (ndy - py) * f;
      }
      px = ndx; py = ndy; i0 = j;
    }
  }

  // gold dimmed towards the page black — colour change, not opacity
  const GOLD_RGB = [174, 154, 41], BG_RGB = [18, 18, 18];
  function goldAt(dim) {
    const r = Math.round(BG_RGB[0] + (GOLD_RGB[0] - BG_RGB[0]) * dim);
    const g = Math.round(BG_RGB[1] + (GOLD_RGB[1] - BG_RGB[1]) * dim);
    const b = Math.round(BG_RGB[2] + (GOLD_RGB[2] - BG_RGB[2]) * dim);
    return `rgb(${r},${g},${b})`;
  }

  // ---------- pattern rendering (canvas 2D, vector every frame) ----------
  const pctx = patCanvas.getContext('2d', { alpha: false });
  let patScale = 1, patOx = 0, patOy = 0, patDpr = 1;

  function resizePattern() {
    patDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(patCanvas.clientWidth * patDpr), h = Math.round(patCanvas.clientHeight * patDpr);
    if (patCanvas.width !== w || patCanvas.height !== h) { patCanvas.width = w; patCanvas.height = h; }
    patScale = Math.max(w / DESIGN_W, h / DESIGN_H);
    patOx = (w - DESIGN_W * patScale) / 2;
    patOy = (h - DESIGN_H * patScale) / 2;
  }

  let lastPatKey = '';
  function renderPattern(pd, now, dim) {
    if (!patReady) return;
    const t = now / 1000;
    const live = !REDUCED && pd > 0;
    const key = live ? '' : `${pd.toFixed(4)}|${dim.toFixed(3)}`;
    if (key && key === lastPatKey) return;
    lastPatKey = key;

    const ctx = pctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG_CSS;
    ctx.fillRect(0, 0, patCanvas.width, patCanvas.height);
    if (pd <= 0) return;

    ctx.setTransform(patScale, 0, 0, patScale, patOx, patOy);
    const gold = goldAt(dim); // dim = darker gold, not opacity
    ctx.fillStyle = gold;
    ctx.strokeStyle = gold;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const amp = live ? 1 : 0;

    // noise dots — tiny bubbles: slow pulse, rare pops, riding the stir field
    let di = 0;
    for (const d of patDots) {
      di++;
      const a = easeOut(seg(pd, d.o * 0.7, d.o * 0.7 + 0.25));
      if (a <= 0) continue;
      let sc = 1, al = a, ox = 0, oy = 0;
      if (live) {
        const h = ((di * 2654435761) >>> 8 & 1023) / 1023;
        const cyc = (t * 0.016 + h) % 1;
        if (cyc > 0.97) {           // rare, gentle pop
          const pp = (cyc - 0.97) / 0.03;
          sc = 1 + pp * 0.35;
          al = a * (1 - pp * pp);
        } else {
          sc = 1 + 0.04 * Math.sin(t * 0.35 + h * 6.283);
        }
        swirlAt(d.x, d.y, t, now);
        ox = S[0]; oy = S[1];
        sc += Math.min(0.5, Math.hypot(ox, oy) / STIR_CAP * 0.45);
      }
      ctx.globalAlpha = al;
      const g = d.s * (sc - 1) / 2;
      ctx.fillRect(d.x + ox - g, d.y + oy - g, d.s * sc, d.s * sc);
    }

    // yellow blocks (morph along with the lines)
    for (const f of patFills) {
      const tf = easeOut(seg(pd, 0.08 + f.o * 0.6, 0.08 + f.o * 0.6 + 0.22));
      if (tf <= 0) continue;
      deform(f.pts, f.work, t, now, amp * tf);
      const sc = 0.86 + 0.14 * tf;
      ctx.globalAlpha = tf;
      ctx.beginPath();
      const q = f.work;
      ctx.moveTo(f.cx + (q[0] - f.cx) * sc, f.cy + (q[1] - f.cy) * sc);
      for (let i = 2; i < q.length; i += 2) ctx.lineTo(f.cx + (q[i] - f.cx) * sc, f.cy + (q[i + 1] - f.cy) * sc);
      ctx.closePath();
      ctx.fill();
    }

    // contour lines — smooth staggered fade-in
    for (const l of patLines) {
      const tl = easeInOut(seg(pd, l.o * 0.58, l.o * 0.58 + 0.42));
      if (tl <= 0) continue;
      deform(l.pts, l.work, t, now, amp);
      ctx.globalAlpha = tl;
      ctx.lineWidth = l.sw;
      ctx.beginPath();
      const q = l.work;
      ctx.moveTo(q[0], q[1]);
      for (let i = 2; i < q.length; i += 2) ctx.lineTo(q[i], q[i + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- pointer -> eased follower -> continuous flow injection ----------
  let ptX = -1e6, ptY = -1e6;      // raw pointer, design space
  let fwX = -1e6, fwY = -1e6;      // eased follower

  function onPointerMove(e) {
    if (REDUCED) return;
    const r = patCanvas.getBoundingClientRect();
    if (r.height === 0) return;
    const cx = (e.clientX - r.left) * patDpr, cy = (e.clientY - r.top) * patDpr;
    ptX = (cx - patOx) / patScale;
    ptY = (cy - patOy) / patScale;
    if (fwX < -1e5) { fwX = ptX; fwY = ptY; }
  }

  let lastSlotX = -1e6, lastSlotY = -1e6;

  function updateStir(now, dt) {
    if (ptX > -1e5) {
      const k = 1 - Math.exp(-dt * 4.5);
      const pvx = fwX, pvy = fwY;
      fwX += (ptX - fwX) * k;
      fwY += (ptY - fwY) * k;
      const mvx = fwX - pvx, mvy = fwY - pvy;
      const vel = Math.hypot(mvx, mvy) / dt; // eased-follower speed, design px/s

      // continuous swirl strength: quick to grab, very slow to let go
      const target = Math.min(1, vel / 420);
      const rate = target > mStr ? 7 : 0.55;
      mStr += (target - mStr) * (1 - Math.exp(-dt * rate));
      if (vel > 1) {
        const m = Math.hypot(mvx, mvy) || 1;
        const dk = 1 - Math.exp(-dt * 6);
        mDirX += (mvx / m - mDirX) * dk;
        mDirY += (mvy / m - mDirY) * dk;
      }

      // trail slots keep the wake behind the follower
      const sdx = fwX - lastSlotX, sdy = fwY - lastSlotY;
      if (sdx * sdx + sdy * sdy > 784) {
        const m = Math.hypot(mvx, mvy) || 1;
        const b = stir[stirHead]; stirHead = (stirHead + 1) % NSTIR;
        b.x = fwX; b.y = fwY;
        b.dx = (mvx / m) * Math.min(1, vel / 900);
        b.dy = (mvy / m) * Math.min(1, vel / 900);
        b.t0 = now;
        lastSlotX = fwX; lastSlotY = fwY;
      }
    }
    stirActive = mStr > 0.01;
    if (!stirActive) for (let i = 0; i < NSTIR; i++) if ((now - stir[i].t0) / 1000 < STIR_LIFE) { stirActive = true; break; }
  }

  // ---------- WebGL goo dissolve (photo) ----------
  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main(){ vUv = vec2(aPos.x, 1.0 - aPos.y); gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

  const GLSL_NOISE = `
    vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    float fbm3(vec2 p){
      float v = 0.5 * snoise(p);
      v += 0.25 * snoise(p * 2.02 + vec2(1.7, 9.2));
      v += 0.125 * snoise(p * 4.08 + vec2(8.3, 2.8));
      return v;
    }`;

  const FRAG_GOO = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uRes;
    uniform float uTexAspect;
    uniform float uP;
    uniform vec2 uSeeds[5];
    uniform vec3 uGold;
    ${GLSL_NOISE}
    void main(){
      float sa = uRes.x / uRes.y;
      vec2 uv = vUv;
      if (sa > uTexAspect) uv.y = (uv.y - 0.5) * (uTexAspect / sa) + 0.5;
      else                 uv.x = (uv.x - 0.5) * (sa / uTexAspect) + 0.5;

      if (uP <= 0.0) { gl_FragColor = vec4(texture2D(uTex, uv).rgb, 1.0); return; }

      vec2 q = vec2(vUv.x * sa, vUv.y);
      float n1 = fbm3(q * 2.6 + 3.1);
      float n2 = snoise(q * 5.5 + vec2(7.3, 1.9)) * 0.5;

      float field = 10.0;
      for (int i = 0; i < 5; i++) {
        vec2 s = vec2(uSeeds[i].x * sa, uSeeds[i].y);
        float grow = 0.72 + 0.28 * fract(float(i) * 0.618);
        float r = max(uP * 2.3 * grow, 1e-4);
        field = min(field, distance(q, s) / r);
      }
      float e = field + n1 * 0.42 + n2 * 0.12;
      float alpha = smoothstep(0.80, 1.18, e);
      float melt = (1.0 - smoothstep(0.55, 1.75, e)) * smoothstep(0.0, 0.08, uP);

      if (melt < 0.004) { gl_FragColor = vec4(texture2D(uTex, uv).rgb * alpha, alpha); return; }

      float drip = melt * (0.12 + 0.30 * (0.5 + 0.5 * n2)) * (0.35 + 0.65 * uP);
      vec2 w = uv;
      w.y -= drip * (0.6 + 0.4 * snoise(q * 9.0) * 0.6);
      w.x += melt * 0.09 * snoise(q * 6.0 + 11.0) * 0.6;
      w = clamp(w, 0.001, 0.999);
      vec3 col = texture2D(uTex, w).rgb;

      col *= 1.0 - 0.45 * melt;
      float rim = smoothstep(0.74, 1.0, e) * (1.0 - smoothstep(1.0, 1.2, e));
      col = mix(col, uGold, rim * 0.6);

      gl_FragColor = vec4(col * alpha, alpha);
    }`;

  let gl = null, glReady = false, pGoo = null;
  let seedsTex = [[0.5128, 0.7627], [0.1636, 0.59], [0.9079, 0.6166], [0.5235, 0.3725], [0.9105, 0.1369]];

  function initGL() {
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    const sh = (type, src) => {
      const x = gl.createShader(type);
      gl.shaderSource(x, src); gl.compileShader(x);
      if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(x)); return null; }
      return x;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG_GOO);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return false; }
    const uni = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      uni[info.name.replace('[0]', '')] = gl.getUniformLocation(prog, info.name);
    }
    pGoo = { prog, uni };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      glReady = true;
      photoLayer.classList.add('has-gl');
      resizeGL();
      dirty = true;
    };
    img.src = 'assets/img/hero-bg.jpg';
    return true;
  }

  function seedsToScreen() {
    const sa = canvas.clientWidth / canvas.clientHeight;
    const out = new Float32Array(10);
    seedsTex.forEach(([x, y], i) => {
      let sx = x, sy = y;
      if (sa > TEX_ASPECT) sy = (y - 0.5) * (sa / TEX_ASPECT) + 0.5;
      else sx = (x - 0.5) * (TEX_ASPECT / sa) + 0.5;
      out[i * 2] = sx; out[i * 2 + 1] = sy;
    });
    return out;
  }

  function resizeGL() {
    if (!gl || !pGoo) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(pGoo.prog);
    gl.uniform2f(pGoo.uni.uRes, w, h);
    gl.uniform1f(pGoo.uni.uTexAspect, TEX_ASPECT);
    gl.uniform3fv(pGoo.uni.uGold, GOLD);
    gl.uniform2fv(pGoo.uni.uSeeds, seedsToScreen());
    lastGooP = -1;
  }

  let lastGooP = -1, gooBlank = false;
  function renderGoo(d) {
    if (!glReady) return;
    if (d >= 1) {
      if (!gooBlank) { gooBlank = true; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      return;
    }
    gooBlank = false;
    if (d === lastGooP) return;
    lastGooP = d;
    gl.useProgram(pGoo.prog);
    gl.uniform1f(pGoo.uni.uP, d);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ---------- text ----------
  const T_WORDS = 0.30;   // list enters while the photo is still dissolving
  const T_SPREAD = 0.17;
  const T_LEAD = T_WORDS + T_SPREAD + 0.06;
  const LEAD_SPREAD = 0.08;
  const RISE_D = 0.055, FILL_D = 0.075;
  const hash01 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const listWords = [...list.querySelectorAll('.w')];
  const leadWords = [...lead.querySelectorAll('.w')];
  const wordMeta = [
    ...listWords.map((el, i) => {
      const rs = T_WORDS + (i / listWords.length) * T_SPREAD;
      return { el, sup: el.querySelector('sup'), rs, fs: rs + 0.018 + hash01(i) * 0.035 };
    }),
    ...leadWords.map((el, i) => {
      const rs = T_LEAD + (i / leadWords.length) * LEAD_SPREAD;
      return { el, sup: null, rs, fs: rs + 0.018 + hash01(i + 100) * 0.03 };
    }),
  ];
  let lastTextP = -1;

  // stage exit — driven by the crisis entry progress E (not P), so the waste
  // words dissolve out hero-style, in reading order from "Solvents", WHILE
  // the crisis section rides up over the still-live pattern
  const XT_START = 0.02, XT_SPREAD = 0.26, XT_DUR = 0.13;
  wordMeta.forEach((m, i) => {
    m.xs = XT_START + (i / wordMeta.length) * XT_SPREAD + hash01(i + 500) * 0.03;
    m.out = false;
  });

  function layoutWords() {
    for (const { el, sup } of wordMeta) {
      if (!sup) continue;
      sup.style.backgroundSize = `${el.clientWidth}px 100%`;
      sup.style.backgroundPosition = `${-(sup.offsetLeft - el.offsetLeft)}px 0`;
    }
  }

  const pad3 = (n) => String(n).padStart(3, '0');

  function updateText(Pw, X) {
    const key = Pw * 8 + X;
    if (key === lastTextP) return;
    lastTextP = key;
    const travel = 38 * u();
    for (const m of wordMeta) {
      const st = m.el.style;

      // exit: hero-style sweep leaving transparency (gradient swapped via .wout)
      const xf = seg(X, m.xs, m.xs + XT_DUR);
      if (xf > 0) {
        if (!m.out) {
          m.out = true;
          m.el.classList.add('wout');
          if (m.sup) m.sup.classList.add('wout');
          st.opacity = '1';
          st.transform = '';
        }
        st.setProperty('--fill', lerp(-40, 124, xf).toFixed(1) + '%');
        continue;
      }
      if (m.out) {
        m.out = false;
        m.el.classList.remove('wout');
        if (m.sup) m.sup.classList.remove('wout');
      }

      const tr = easeOut(seg(Pw, m.rs, m.rs + RISE_D));
      st.opacity = tr.toFixed(3);
      st.transform = tr >= 1 ? '' : `translate3d(0, ${((1 - tr) * travel).toFixed(1)}px, 0)`;
      const tf = seg(Pw, m.fs, m.fs + FILL_D);
      st.setProperty('--fill', lerp(-24, 124, tf).toFixed(1) + '%');
      if (m.sup) {
        const v = pad3(Math.round(+m.sup.dataset.n * easeOut(tf)));
        if (m.sup.textContent !== v) m.sup.textContent = v;
      }
    }
  }

  // hero words dissolve left→right (shimmer sweep to transparency) as the photo rises
  const heroWords = [...document.querySelectorAll('#heroCopy .hw')];
  const heroMeta = heroWords.map((el, i) => {
    const st = 0.012 + (i / heroWords.length) * 0.105 + hash01(i + 200) * 0.012;
    return { el, st };
  });
  let lastHeroP = -1;

  function updateHero(P) {
    if (P === lastHeroP) return;
    lastHeroP = P;
    for (const m of heroMeta) {
      const t = seg(P, m.st, m.st + 0.045);
      m.el.style.setProperty('--fill', lerp(-40, 124, t).toFixed(1) + '%');
    }
  }

  // ---------- logo hover fx (big-logo state only) ----------
  // the goo dissolve shader, inverted: a melting hole follows the cursor inside
  // the glyphs (glyph mask sampled in-shader) and reveals the drifting pattern
  const logoFx = $('logoFx');
  let logoHover = false, lhp = 0, logoFxClear = true;
  let lmxRaw = -1e6, lmyRaw = -1e6, lmx = -1e6, lmy = -1e6;

  logo.addEventListener('mouseenter', () => { logoHover = true; });
  logo.addEventListener('mouseleave', () => { logoHover = false; });
  logo.addEventListener('mousemove', (e) => {
    const r = logoFx.getBoundingClientRect();
    if (r.width === 0) return;
    lmxRaw = (e.clientX - r.left) / r.width * logoFx.width;
    lmyRaw = (e.clientY - r.top) / r.height * logoFx.height;
    if (lmx < -1e5) { lmx = lmxRaw; lmy = lmyRaw; }
  });

  const FRAG_LOGO = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform sampler2D uMask;
    uniform vec2 uRes;
    uniform float uTexAspect;
    uniform float uP;
    uniform float uTime;
    uniform vec2 uSeed;
    uniform vec3 uGold;
    ${GLSL_NOISE}
    void main(){
      float glyph = texture2D(uMask, vUv).a;
      if (glyph <= 0.003) { gl_FragColor = vec4(0.0); return; }
      float sa = uRes.x / uRes.y;
      vec2 uv = vUv;
      if (sa > uTexAspect) uv.y = (uv.y - 0.5) * (uTexAspect / sa) + 0.5;
      else                 uv.x = (uv.x - 0.5) * (sa / uTexAspect) + 0.5;

      vec2 q = vec2(vUv.x * sa, vUv.y);
      float n1 = fbm3(q * 2.6 + 3.1);
      float n2 = snoise(q * 5.5 + vec2(7.3, 1.9)) * 0.5;

      float r = max(uP * 0.52, 1e-4);
      float e = distance(q, uSeed) / r + n1 * 0.32 + n2 * 0.10;
      float vis = (1.0 - smoothstep(0.86, 1.10, e)) * glyph;
      if (vis <= 0.0) { gl_FragColor = vec4(0.0); return; }
      float melt = (1.0 - smoothstep(0.55, 1.45, e)) * smoothstep(0.0, 0.08, uP);

      // zoom into the pattern so its lines read at logo scale
      uv = 0.5 + (uv - 0.5) / 2.6;

      // gentle drift so the pattern lives like the big one below
      vec2 w = uv + vec2(
        snoise(q * 1.6 + vec2(uTime * 0.05, -uTime * 0.04)),
        snoise(q * 1.6 + vec2(-uTime * 0.045, uTime * 0.05) + 4.7)
      ) * 0.004;

      // goo smear near the melting rim — same recipe as the photo dissolve
      float drip = melt * (0.12 + 0.30 * (0.5 + 0.5 * n2)) * (0.35 + 0.65 * uP);
      w.y -= drip * (0.6 + 0.4 * snoise(q * 9.0) * 0.6) * 0.4;
      w.x += melt * 0.05 * snoise(q * 6.0 + 11.0) * 0.6;
      w = clamp(w, 0.001, 0.999);
      vec3 col = texture2D(uTex, w).rgb * 1.35;

      col *= 1.0 - 0.35 * melt;

      gl_FragColor = vec4(col * vis, vis);
    }`;

  // preloader: the logo forms out of 3 growing goo holes (white glyphs +
  // gold rim at the melt edge), clipped by the same glyph mask
  const FRAG_LOGO_IN = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uMask;
    uniform vec2 uRes;
    uniform float uP;
    uniform vec3 uGold;
    ${GLSL_NOISE}
    void main(){
      float glyph = texture2D(uMask, vUv).a;
      if (glyph <= 0.003) { gl_FragColor = vec4(0.0); return; }
      float sa = uRes.x / uRes.y;
      vec2 q = vec2(vUv.x * sa, vUv.y);
      float n1 = fbm3(q * 2.2 + 5.7);
      float n2 = snoise(q * 5.0 + vec2(2.3, 8.1)) * 0.5;
      float field = 10.0;
      for (int i = 0; i < 3; i++) {
        vec2 s = vec2(sa * (0.18 + 0.32 * float(i)), 0.5);
        float grow = 0.8 + 0.2 * fract(float(i) * 0.618);
        float r = max(uP * 4.5 * grow, 1e-4);
        field = min(field, distance(q, s) / r);
      }
      float e = field + n1 * 0.38 + n2 * 0.12;
      float vis = (1.0 - smoothstep(0.86, 1.12, e)) * glyph;
      if (vis <= 0.0) { gl_FragColor = vec4(0.0); return; }
      float rim = smoothstep(0.74, 1.0, e) * (1.0 - smoothstep(1.0, 1.2, e));
      vec3 col = mix(vec3(1.0), uGold, rim * 0.7);
      gl_FragColor = vec4(col * vis, vis);
    }`;

  let lgl = null, pLogo = null, pLogoIn = null, logoTexReady = false, logoTex = null, logoMaskTex = null, logoMaskInTex = null, logoMaskReady = false;

  function initLogoGL() {
    lgl = logoFx.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!lgl) return false;
    const sh = (type, src) => {
      const x = lgl.createShader(type);
      lgl.shaderSource(x, src); lgl.compileShader(x);
      if (!lgl.getShaderParameter(x, lgl.COMPILE_STATUS)) { console.error(lgl.getShaderInfoLog(x)); return null; }
      return x;
    };
    const vs = sh(lgl.VERTEX_SHADER, VERT), fs = sh(lgl.FRAGMENT_SHADER, FRAG_LOGO);
    if (!vs || !fs) return false;
    const prog = lgl.createProgram();
    lgl.attachShader(prog, vs); lgl.attachShader(prog, fs);
    lgl.bindAttribLocation(prog, 0, 'aPos');
    lgl.linkProgram(prog);
    if (!lgl.getProgramParameter(prog, lgl.LINK_STATUS)) { console.error(lgl.getProgramInfoLog(prog)); return false; }
    const uni = {};
    const n = lgl.getProgramParameter(prog, lgl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = lgl.getActiveUniform(prog, i);
      uni[info.name.replace('[0]', '')] = lgl.getUniformLocation(prog, info.name);
    }
    pLogo = { prog, uni };

    // second program on the same context: preloader logo reveal
    const fsIn = sh(lgl.FRAGMENT_SHADER, FRAG_LOGO_IN);
    if (fsIn) {
      const progIn = lgl.createProgram();
      lgl.attachShader(progIn, vs); lgl.attachShader(progIn, fsIn);
      lgl.bindAttribLocation(progIn, 0, 'aPos');
      lgl.linkProgram(progIn);
      if (lgl.getProgramParameter(progIn, lgl.LINK_STATUS)) {
        const uniIn = {};
        const nIn = lgl.getProgramParameter(progIn, lgl.ACTIVE_UNIFORMS);
        for (let i = 0; i < nIn; i++) {
          const info = lgl.getActiveUniform(progIn, i);
          uniIn[info.name.replace('[0]', '')] = lgl.getUniformLocation(progIn, info.name);
        }
        pLogoIn = { prog: progIn, uni: uniIn };
        lgl.useProgram(progIn);
        lgl.uniform1i(uniIn.uMask, 1);
        lgl.uniform3fv(uniIn.uGold, GOLD);
      }
    }

    const buf = lgl.createBuffer();
    lgl.bindBuffer(lgl.ARRAY_BUFFER, buf);
    lgl.bufferData(lgl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), lgl.STATIC_DRAW);
    lgl.enableVertexAttribArray(0);
    lgl.vertexAttribPointer(0, 2, lgl.FLOAT, false, 0, 0);
    lgl.useProgram(prog);
    lgl.uniform1f(uni.uTexAspect, TEX_ASPECT);
    lgl.uniform3fv(uni.uGold, GOLD);
    const mkTex = () => {
      const t = lgl.createTexture();
      lgl.bindTexture(lgl.TEXTURE_2D, t);
      lgl.texParameteri(lgl.TEXTURE_2D, lgl.TEXTURE_WRAP_S, lgl.CLAMP_TO_EDGE);
      lgl.texParameteri(lgl.TEXTURE_2D, lgl.TEXTURE_WRAP_T, lgl.CLAMP_TO_EDGE);
      lgl.texParameteri(lgl.TEXTURE_2D, lgl.TEXTURE_MIN_FILTER, lgl.LINEAR);
      lgl.texParameteri(lgl.TEXTURE_2D, lgl.TEXTURE_MAG_FILTER, lgl.LINEAR);
      return t;
    };
    logoTex = mkTex();
    logoMaskTex = mkTex();
    logoMaskInTex = mkTex();
    lgl.uniform1i(uni.uTex, 0);
    lgl.uniform1i(uni.uMask, 1);
    makeLogoMaskTexture();
    return true;
  }

  // glyph alpha mask: logo.svg rasterized once, dilated ~1.5 design px so the
  // pattern tucks under the white logo's antialiased edge (no thin outline)
  function makeLogoMaskTexture() {
    const img = new Image();
    img.onload = () => {
      const W = 2832, H = 382;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const cc = c.getContext('2d');
      const d = 3;
      for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]])
        cc.drawImage(img, ox, oy, W, H);
      lgl.activeTexture(lgl.TEXTURE1);
      lgl.bindTexture(lgl.TEXTURE_2D, logoMaskTex);
      lgl.texImage2D(lgl.TEXTURE_2D, 0, lgl.RGBA, lgl.RGBA, lgl.UNSIGNED_BYTE, c);
      // undilated copy for the preloader reveal — the dilated one renders the
      // glyphs ~1.5px fatter, which popped visibly at the swap to the <img>
      const c2 = document.createElement('canvas');
      c2.width = W; c2.height = H;
      c2.getContext('2d').drawImage(img, 0, 0, W, H);
      lgl.bindTexture(lgl.TEXTURE_2D, logoMaskInTex);
      lgl.texImage2D(lgl.TEXTURE_2D, 0, lgl.RGBA, lgl.RGBA, lgl.UNSIGNED_BYTE, c2);
      lgl.activeTexture(lgl.TEXTURE0);
      logoMaskReady = true;
    };
    img.src = 'assets/img/logo.svg';
  }

  function makeLogoTexture() {
    if (!lgl || !patSvgText) return;
    const W = 2244, H = 1230;
    const withSize = patSvgText.replace('<svg ', `<svg width="${W}" height="${H}" `);
    const url = URL.createObjectURL(new Blob([withSize], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, 0, 0, W, H);
      lgl.activeTexture(lgl.TEXTURE0);
      lgl.bindTexture(lgl.TEXTURE_2D, logoTex);
      lgl.texImage2D(lgl.TEXTURE_2D, 0, lgl.RGB, lgl.RGB, lgl.UNSIGNED_BYTE, c);
      URL.revokeObjectURL(url);
      logoTexReady = true;
    };
    img.src = url;
  }

  function resizeLogoFx() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(LOGO_REST.w * u() * dpr), h = Math.round(LOGO_REST.h * u() * dpr);
    if (logoFx.width !== w || logoFx.height !== h) { logoFx.width = w; logoFx.height = h; }
    if (lgl && pLogo) { lgl.viewport(0, 0, w, h); lgl.useProgram(pLogo.prog); lgl.uniform2f(pLogo.uni.uRes, w, h); }
    if (lgl && pLogoIn) { lgl.useProgram(pLogoIn.prog); lgl.uniform2f(pLogoIn.uni.uRes, w, h); }
  }

  function renderLogoFx(now) {
    if (!lgl || !logoTexReady || !logoMaskReady) return;
    const target = logoHover && lastNavT < 0.05 && !REDUCED && lmxRaw > -1e5 ? 1 : 0;
    lhp += (target - lhp) * (1 - Math.exp(-0.016 * (target > lhp ? 4 : 2.4)));
    if (lhp < 0.004) {
      lhp = 0;
      if (!logoFxClear) { lgl.clearColor(0, 0, 0, 0); lgl.clear(lgl.COLOR_BUFFER_BIT); logoFxClear = true; }
      return;
    }
    logoFxClear = false;
    lmx += (lmxRaw - lmx) * 0.10;
    lmy += (lmyRaw - lmy) * 0.10;
    const sa = logoFx.width / logoFx.height;
    lgl.useProgram(pLogo.prog);
    lgl.activeTexture(lgl.TEXTURE1);
    lgl.bindTexture(lgl.TEXTURE_2D, logoMaskTex);
    lgl.activeTexture(lgl.TEXTURE0);
    lgl.bindTexture(lgl.TEXTURE_2D, logoTex);
    lgl.uniform1f(pLogo.uni.uP, lhp);
    lgl.uniform1f(pLogo.uni.uTime, now / 1000);
    lgl.uniform2f(pLogo.uni.uSeed, (lmx / logoFx.width) * sa, lmy / logoFx.height);
    lgl.clearColor(0, 0, 0, 0);
    lgl.clear(lgl.COLOR_BUFFER_BIT);
    lgl.drawArrays(lgl.TRIANGLES, 0, 6);
  }

  // ---------- crisis section (pinned accordion) ----------
  // E: entry — section top rides viewport-bottom → pin engage; every word
  //    except subheads 002/003 sweeps in waste-style.
  // C: pinned — phase A hands the active state 001→002 (media 340↔140,
  //    subhead swap), phase B hands it 002→003. Media heights move in sync
  //    so the list height stays constant (no reflow jumps).
  const crisis = $('crisis');
  const crisisPin = crisis.querySelector('.crisis__pin');
  const cItems = [...crisis.querySelectorAll('.crisis-item')];
  const cDescs = cItems.map((it) => it.querySelector('.crisis-item__desc'));
  const cMedias = cItems.map((it) => it.querySelector('.crisis-item__media'));

  const CE_RISE = 0.08, CE_LAG = 0.02, CE_FILL = 0.10; // entry windows, in E
  const CA_RISE = 0.05, CA_LAG = 0.02, CA_FILL = 0.07; // activation windows, in C

  // entry cascade (in E): the section headline first, around mid-viewport;
  // then each box in order — box heading (number + title), photo, subhead
  const BOX_S = [0.58, 0.68, 0.78];
  const IM_W = BOX_S.map((s) => [s + 0.02, s + 0.22]); // photo shimmer windows (slow reveal)
  const cEntry = [];
  const addWords = (els, start, spread, seed) => els.forEach((el, i) =>
    cEntry.push({ el, rs: start + (i / els.length) * spread + hash01(i + seed) * 0.012 }));
  addWords([...crisis.querySelectorAll('.crisis__head .cw')], 0.44, 0.10, 300);
  cItems.forEach((it, bi) => {
    addWords([...it.querySelectorAll('.crisis-item__num .cw, .crisis-item__title .cw')], BOX_S[bi], 0.03, 320 + bi * 40);
  });
  addWords([...cDescs[0].querySelectorAll('.cw')], BOX_S[0] + 0.10, 0.10, 360);

  const actWords = (desc, start, h0) => [...desc.querySelectorAll('.cw')]
    .map((el, i, a) => ({ el, rs: start + (i / a.length) * 0.13 + hash01(i + h0) * 0.015 }));
  const cAct1 = actWords(cDescs[1], 0.18, 400);
  const cAct2 = actWords(cDescs[2], 0.68, 450);

  function sweepWord(m, p, rise, lag, fill, travel) {
    const tr = easeOut(seg(p, m.rs, m.rs + rise));
    const st = m.el.style;
    st.opacity = tr.toFixed(3);
    st.transform = tr >= 1 ? '' : `translate3d(0, ${((1 - tr) * travel).toFixed(1)}px, 0)`;
    st.setProperty('--fill', lerp(-24, 124, seg(p, m.rs + lag, m.rs + lag + fill)).toFixed(1) + '%');
  }

  let lastCrisisKey = '';
  function updateCrisis(E, C) {
    const key = E.toFixed(4) + '|' + C.toFixed(4);
    if (key === lastCrisisKey) return;
    lastCrisisKey = key;
    const travel = 38 * u();

    for (const m of cEntry) sweepWord(m, E, CE_RISE, CE_LAG, CE_FILL, travel);
    for (const m of cAct1) sweepWord(m, C, CA_RISE, CA_LAG, CA_FILL, travel);
    for (const m of cAct2) sweepWord(m, C, CA_RISE, CA_LAG, CA_FILL, travel);

    // photos shimmer in L→R (gold edge over page-black), like the words.
    // Rest = -34% keeps every gradient stop <= 0, so no gold sliver leaks
    // on the covered photo's left edge (tail is 26% wide).
    for (let i = 0; i < 3; i++)
      cMedias[i].style.setProperty('--ifill',
        lerp(-34, 124, seg(E, IM_W[i][0], IM_W[i][1])).toFixed(1) + '%');

    const a = easeInOut(seg(C, 0.06, 0.44)); // 001 → 002
    const b = easeInOut(seg(C, 0.56, 0.94)); // 002 → 003
    cItems[0].style.setProperty('--mh', lerp(340, 140, a).toFixed(1));
    cItems[1].style.setProperty('--mh', lerp(lerp(140, 340, a), 140, b).toFixed(1));
    cItems[2].style.setProperty('--mh', lerp(140, 340, b).toFixed(1));
    cDescs[0].style.opacity = (1 - seg(C, 0.06, 0.22)).toFixed(3);
    cDescs[1].style.opacity = (1 - seg(C, 0.56, 0.72)).toFixed(3);
  }

  const CR = { E: 0, C: 0 };
  function crisisProgress() {
    const vh = window.innerHeight;
    const top = crisis.getBoundingClientRect().top;
    // rect.top at pin engage — mirrors the sticky top min() in styles.css
    const k = u();
    const Ts = Math.min(-237 * k, vh - 1035 * k);
    CR.E = clamp01((vh - top) / Math.max(1, vh - Ts));
    CR.C = clamp01((Ts - top) / Math.max(1, crisis.offsetHeight - crisisPin.offsetHeight));
  }

  // ---------- preloader ----------
  // Time-driven intro (skipped under reduced motion):
  //   0.0–1.4  logo forms centre-screen out of 3 goo holes (FRAG_LOGO_IN,
  //            UNdilated mask — the dilated hover mask popped at the swap)
  //   PRE_GO   logo flies up (0.75s, cubic-bezier(.61,0,.2,1)); the photo
  //            goo-reveal starts with it (1.9s, uP 1→0)
  //   PRE_EL   (+0.35s, once the logo cleared their zone) headline + meta
  //            words sweep in; CTA draws its 2px line (0.6s) then grows up
  //            (0.7s), content fades in last
  // Scroll is held at 0 until the end; then everything hands off to the
  // scroll choreography (layoutNav / updateHero / renderGoo resume).
  const PRE = { active: !REDUCED, goo: 0, t0: 0, boot: 0, gooLogo: false };
  const PRE_GO = 1.70;           // the fly-up moment
  const PRE_EL = PRE_GO + 0.35;  // texts + CTA start once the logo has cleared their zone
  const PRE_END = 3.8;

  // cubic-bezier evaluator (same semantics as the CSS function)
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (u) => {
      if (u <= 0) return 0;
      if (u >= 1) return 1;
      let t = u;
      for (let i = 0; i < 5; i++) { const d = dx(t); if (d < 1e-6) break; t -= (sx(t) - u) / d; }
      if (!(t >= 0 && t <= 1) || Math.abs(sx(t) - u) > 1e-3) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (sx(t) < u) lo = t; else hi = t; }
      }
      return sy(t);
    };
  };
  const flyEase = bezier(0.61, 0, 0.2, 1);
  const logoImgEl = logo.querySelector('img');
  const photoImg = $('photoImg');
  const ctaSpans = [...cta.querySelectorAll('span')];
  const preHl = [], preMeta = [];
  let logoInDone = false;

  function initPreloader() {
    if (!PRE.active) return;
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    PRE.goo = 1;
    const mk = (list, arr, start, spread, seed) => list.forEach((el, i) => {
      el.classList.add('win');
      el.style.opacity = '0';
      arr.push({ el, rs: start + (i / list.length) * spread + hash01(i + seed) * 0.06 });
    });
    mk([...document.querySelectorAll('.hero-copy__headline .hw')], preHl, PRE_EL, 0.45, 600);
    mk([...document.querySelectorAll('.hero-copy__meta .hw')], preMeta, PRE_EL, 0.50, 650);
    logoImgEl.style.opacity = '0';
    cta.style.opacity = '0';
    for (const s of ctaSpans) s.style.opacity = '0';
    hint.style.opacity = '0';
    hint.style.pointerEvents = 'none';
    photoImg.style.opacity = '0';
  }

  function renderLogoIn(rev) {
    if (logoInDone) return;
    if (rev >= 1) {
      logoImgEl.style.opacity = '1';
      if (PRE.gooLogo) { lgl.clearColor(0, 0, 0, 0); lgl.clear(lgl.COLOR_BUFFER_BIT); logoFxClear = true; }
      logoInDone = true;
      return;
    }
    if (!PRE.gooLogo) { // no WebGL / mask missing: plain fade
      logoImgEl.style.opacity = easeInOut(rev).toFixed(3);
      return;
    }
    lgl.useProgram(pLogoIn.prog);
    lgl.activeTexture(lgl.TEXTURE1);
    lgl.bindTexture(lgl.TEXTURE_2D, logoMaskInTex);
    lgl.uniform1f(pLogoIn.uni.uP, easeInOut(rev));
    lgl.clearColor(0, 0, 0, 0);
    lgl.clear(lgl.COLOR_BUFFER_BIT);
    lgl.drawArrays(lgl.TRIANGLES, 0, 6);
    logoFxClear = false;
  }

  function finishPreloader() {
    PRE.active = false;
    PRE.goo = 0;
    // hand the hero words back to the scroll dissolve gradient
    for (const m of [...preHl, ...preMeta]) {
      m.el.classList.remove('win');
      m.el.style.opacity = '';
      m.el.style.transform = '';
      m.el.style.setProperty('--fill', '-40%');
    }
    for (const s of ctaSpans) s.style.opacity = '';
    cta.style.opacity = '';
    hint.style.opacity = '';
    hint.style.pointerEvents = '';
    photoImg.style.opacity = '';
    lastNavT = -1; lastHeroP = -1; // force layoutNav/updateHero to rewrite rest state
    dirty = true;
  }

  function updatePreloader(now) {
    if (!PRE.active) return;
    if (!PRE.boot) PRE.boot = now;
    if (!PRE.t0) { // hold black until the glyph mask is in (capped wait)
      if (lgl && pLogoIn && logoMaskReady) { PRE.gooLogo = true; PRE.t0 = now; }
      else if (!lgl || !pLogoIn || now - PRE.boot > 2500) PRE.t0 = now;
      else return;
    }
    if (window.scrollY) window.scrollTo(0, 0); // scroll held during the intro
    const t = (now - PRE.t0) / 1000;
    const k = u(), vh = window.innerHeight;

    // logo: goo reveal centre-screen, then fly up to the hero position
    const fly = flyEase(seg(t, PRE_GO, PRE_GO + 0.75));
    logo.style.left = LOGO_REST.x * k + 'px';
    logo.style.top = lerp((vh - LOGO_REST.h * k) / 2, LOGO_REST.y * k, fly) + 'px';
    logo.style.width = LOGO_REST.w * k + 'px';
    logo.style.height = LOGO_REST.h * k + 'px';
    renderLogoIn(seg(t, 0, 1.40));

    // hero words (subheading + podpis), same sweep grammar as everywhere
    const travel = 38 * u();
    for (const m of preHl) sweepWord(m, t, 0.35, 0.12, 0.45, travel);
    for (const m of preMeta) sweepWord(m, t, 0.35, 0.12, 0.45, travel);

    // CTA: 2px line draws across, then the block grows up from the line
    // (padding scales with the growth — border-box padding would otherwise
    // thicken the 2px line and widen the zero-width start)
    const lw = easeOut(seg(t, PRE_EL, PRE_EL + 0.60));
    const lh = easeOut(seg(t, PRE_EL + 0.60, PRE_EL + 1.30));
    const h = Math.max(2, CTA_REST.h * k * lh);
    cta.style.left = CTA_REST.x * k + 'px';
    cta.style.width = (CTA_REST.w * k * lw) + 'px';
    cta.style.height = h + 'px';
    cta.style.top = ((CTA_REST.y + CTA_REST.h) * k - h) + 'px';
    cta.style.padding = `0 ${12 * k * lh}px ${CTA_REST.pb * k * lh}px`;
    cta.style.opacity = lw > 0 ? '1' : '0';
    const ct = seg(t, PRE_EL + 1.20, PRE_EL + 1.50);
    for (const s of ctaSpans) s.style.opacity = ct.toFixed(3);

    // photo: the goo dissolve run backwards, alongside everything else
    PRE.goo = 1 - easeInOut(seg(t, PRE_GO, PRE_GO + 1.90));
    if (!glReady) photoImg.style.opacity = (1 - PRE.goo).toFixed(3);

    hint.style.opacity = seg(t, PRE_END - 0.40, PRE_END).toFixed(3);

    dirty = true;
    if (t >= PRE_END) finishPreloader();
  }

  // ---------- main update ----------
  let dirty = true, lastP = -1, lastEsSeen = -1;

  function progress() {
    const track = stage.offsetHeight - window.innerHeight;
    return clamp01(-stage.getBoundingClientRect().top / track);
  }

  function update(P, now, dt) {
    updateStir(now, dt);
    // original choreography keeps its 420vh scroll feel regardless of track length
    const track = stage.offsetHeight - window.innerHeight;
    const Pw = Math.min(1, P * track / (4.2 * window.innerHeight));
    // pattern: draws in over Pw, then runs the same animation backwards over
    // the stage's tail — fully gone at P 0.985, BEFORE the crisis edge enters
    // the viewport, so its hard bottom edge never meets the pattern. The waste
    // words then dissolve during the ride (E-driven, in updateText).
    const pd = seg(Pw, 0.14, 0.62) * (1 - seg(P, 0.86, 0.985));
    const live = !REDUCED && patReady && pd > 0;
    if (P === lastP && Es === lastEsSeen && !dirty && !live && !stirActive && lhp === 0 && !logoHover) return;
    const pChanged = P !== lastP || Es !== lastEsSeen || dirty;
    lastP = P; lastEsSeen = Es; dirty = false;

    const dim = 1 - 0.6 * easeOut(seg(Pw, 0.28, 0.42));

    if (pChanged) {
      const st = pin.style;
      st.setProperty('--rise', easeInOut(seg(Pw, 0.0, 0.22)).toFixed(4));
      st.setProperty('--hint', (1 - seg(Pw, 0.0, 0.08)).toFixed(3));
      st.setProperty('--dissolve', seg(Pw, 0.12, 0.55).toFixed(4));

      if (!PRE.active) { // the preloader owns the nav and hero words until it hands off
        layoutNav(seg(Pw, 0.02, 0.24));
        updateHero(Pw);
      }
      updateText(Pw, Es);
    }

    renderPattern(pd, now, dim);
    renderGoo(Math.max(seg(Pw, 0.12, 0.55), PRE.goo)); // preloader reveals the photo (goo run backwards)
    if (!PRE.active) renderLogoFx(now);
  }

  // ---------- page-wide smooth scroll (wheel only; other inputs stay native) ----------
  // The wheel drives a target; the loop eases the real scroll position towards
  // it with the same k the progress smoothing uses — so the stage choreography
  // feels exactly as before, and native movement (crisis ride-in, accordion)
  // inherits the same smoothness.
  let sTarget = 0, sCur = 0, sInit = false;

  window.addEventListener('wheel', (e) => {
    if (REDUCED || e.ctrlKey) return; // pinch-zoom stays native
    e.preventDefault();
    if (PRE.active) return; // scroll held during the preloader
    if (!sInit) { sTarget = sCur = window.scrollY; sInit = true; }
    const d = e.deltaMode === 1 ? e.deltaY * 33
            : e.deltaMode === 2 ? e.deltaY * window.innerHeight
            : e.deltaY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    sTarget = Math.max(0, Math.min(max, sTarget + d));
  }, { passive: false });

  function smoothScroll(dt) { // returns true while it is driving the scroll
    if (!sInit) return false;
    const y = window.scrollY;
    if (Math.abs(y - sCur) > 1.5) { sCur = sTarget = y; return false; } // external scroll took over
    if (Math.abs(sTarget - sCur) < 0.4) { sCur = sTarget; return false; }
    sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 6.5));
    window.scrollTo(0, sCur);
    return true;
  }

  // ---------- loop with smoothed progress ----------
  let Ps = null, Es = null, Cs = null, lastTs = 0;

  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    updatePreloader(ts);
    const wheelDriving = smoothScroll(dt);
    const P = progress();
    crisisProgress();
    if (Ps === null || REDUCED) { Ps = P; Es = CR.E; Cs = CR.C; }
    else if (wheelDriving) { Ps = P; Es = CR.E; Cs = CR.C; } // scroll itself is smoothed — no double lag
    else {
      const k = 1 - Math.exp(-dt * 6.5);
      Ps += (P - Ps) * k;
      Es += (CR.E - Es) * k;
      Cs += (CR.C - Cs) * k;
      if (Math.abs(P - Ps) < 0.0004) Ps = P;
      if (Math.abs(CR.E - Es) < 0.0004) Es = CR.E;
      if (Math.abs(CR.C - Cs) < 0.0004) Cs = CR.C;
    }
    update(Ps, ts, dt);
    updateCrisis(Es, Cs);
    requestAnimationFrame(loop);
  }

  // ---------- boot ----------
  hint.addEventListener('click', (e) => {
    e.preventDefault();
    // jump to the stage end: list and lead fully filled, crisis at the doorstep
    window.scrollTo({ top: stage.offsetTop + (stage.offsetHeight - window.innerHeight), behavior: 'smooth' });
  });
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  let resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeGL();
      resizePattern();
      resizeLogoFx();
      layoutWords();
      lastTextP = -1; lastHeroP = -1; lastNavT = -1; lastPatKey = ''; lastCrisisKey = '';
      dirty = true;
    });
  }

  if (!initGL()) photoLayer.classList.remove('has-gl');
  initLogoGL();
  initPreloader();
  loadPattern();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutWords(); dirty = true; });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
  onResize();
  requestAnimationFrame(loop);
})();
