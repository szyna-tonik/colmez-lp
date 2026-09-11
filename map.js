/* Colmez map — an imitation of the client's product map (Markets view) in the
   brand palette: grey ground, gold-tinted generator speckle, count bubbles
   (dark gold = weak capture, industrial gold = strong), capture-rate legend —
   no product chrome (no labels, toggles, chat, sidebar).
   Ground = Kuba's block-map contour treatment (colmez-block-map-v11_2.html).

   The whole ride is SCROLL-DRIVEN (reversible): rises into perspective, lifts
   and levels flat, density resolves, bubbles pop, legend last; the final flat
   map spans the page's content width (capped by viewport height — it never
   crops). Driven from main.js via window.colmezMap.set(p).

   Interaction (final state only):
   - hovering a state: the rest dims, bubbles collapse to bare numbers, the
     state lights up through goo holes (the hero-photo dissolve, in 2D) and
     holds until the pointer leaves;
   - hovering a bubble: it grows slightly and its number re-ticks like the
     counters in the waste list. */
(() => {
  const cv = document.getElementById('mapCv');
  if (!cv) return;
  const stage = cv.parentElement;
  const ctx = cv.getContext('2d');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- palette (Figma) ----------
  const C = {
    bg: '#121212',
    top: '#313131', topFlat: '#2c2c2c',
    edge: '#737373', edgeFlat: '#5d5d5d',
    hover: '#454748',
    goldDarker: '#38360d', goldDark: '#605817', gold: '#ae9a29', goldLight: '#dfcf77',
    ink: '#ffffff', grey: '#9a9a9a', grey7: '#737373',
  };
  const SPECK = [
    ['#38360d', 0.9], ['#605817', 0.65], ['#ae9a29', 0.4],
  ];

  const S = { simp: 100, edge: 1.6, tilt: 0.54, rot: 0, persp: 0.08, bow: 0.1 };
  const CAM0 = { tilt: 0.25, rot: -25 };
  // scroll-progress windows (p = 0..1 from main.js)
  const T = {
    form: [0, 0.25], flat: [0.28, 0.60], speck: [0.45, 0.75],
    bub: [0.58, 0.96], leg: [0.92, 1],
  };

  // clusters transcribed from the product screenshot: [lon, lat, label, weak?]
  const BUBBLES = [
    [-122.33, 47.60, '2.5k', 0], [-117.40, 47.66, '204', 0], [-112.03, 46.60, '236', 1],
    [-100.78, 47.50, '93', 1], [-97.10, 48.95, '5', 1], [-95.90, 47.50, '177', 1],
    [-92.10, 46.80, '50', 1], [-93.26, 44.98, '2.8k', 1], [-116.20, 43.60, '176', 1],
    [-121.80, 40.20, '270', 1], [-122.42, 37.77, '29k', 0], [-118.24, 34.05, '54k', 0],
    [-115.14, 36.17, '26', 1], [-112.07, 33.45, '1.5k', 0], [-111.89, 40.76, '746', 0],
    [-107.50, 43.00, '24', 1], [-100.35, 44.40, '43', 1], [-104.99, 39.74, '1.2k', 1],
    [-104.80, 37.30, '152', 1], [-106.65, 35.08, '50', 1], [-101.83, 35.19, '129', 1],
    [-102.08, 31.99, '395', 1], [-98.49, 29.42, '201', 0], [-97.51, 35.47, '1.4k', 0],
    [-96.80, 32.78, '1.4k', 0], [-95.37, 29.76, '3.3k', 0], [-97.90, 26.90, '124', 0],
    [-94.58, 39.10, '1.6k', 0], [-90.20, 38.63, '952', 0], [-87.65, 41.85, '6.4k', 0],
    [-83.05, 42.33, '1.9k', 1], [-79.99, 40.44, '3.1k', 0], [-83.00, 39.96, '3.2k', 0],
    [-74.00, 40.71, '4.6k', 1], [-71.06, 42.36, '16k', 0], [-69.80, 44.50, '54', 1],
    [-78.50, 37.80, '5k', 1], [-86.78, 36.16, '2.8k', 0], [-84.00, 33.20, '3.5k', 0],
    [-81.70, 27.30, '2.5k', 1], [-89.60, 29.60, '3', 1], [-90.18, 32.30, '162', 1],
    [-91.14, 30.45, '1.8k', 0],
  ].map(([lon, lat, label, weak]) => ({
    ll: [lon, lat], label, weak: !!weak,
    v: parseFloat(label) * (label.endsWith('k') ? 1000 : 1),
    hov: 0, tick0: -1e9,
  }));

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (t, w) => clamp01((t - w[0]) / (w[1] - w[0]));
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const keep = (id) => !['02', '15', '72', '78', '60', '66', '69'].includes(String(id).padStart(2, '0'));
  const rnd1 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function hx(h) { h = h.slice(1); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const pc = (v) => v.startsWith('rgb') ? v.match(/\d+/g).map(Number) : hx(v);
  function mixc(a, b, t) { const x = pc(a), y = pc(b); return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')'; }
  const fmt = (v, kStyle) => {
    if (!kStyle) return String(Math.round(v));
    const k = v / 1000;
    return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + 'k';
  };

  // ---------- geometry (Kuba's pipeline: warp -> geoTransform -> Path2D) ----------
  let RAW = null, PRE = null, WEIGHTS = null, TOPO = null, stateF = [], nation = null;
  let W = 0, H = 0, dpr = 1, MW = 0, MH = 0, OX = 0, OY = 0, projCache = null;
  let blocks = [], nationP = null, speckle = [];
  let hitCv = null, hitCtx = null, HITKEYS = [];

  function warp(x, y) {
    const cxm = MW / 2, cym = MH / 2;
    let dx = x - cxm, dy = y - cym;
    if (S.rot) { const a = S.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const nx = dx * c - dy * s, ny = dx * s + dy * c; dx = nx; dy = ny; }
    if (S.bow) dy += S.bow * MH * (Math.pow(dx / cxm, 2) - 0.33);
    const u = dy / MH, k = 1 + S.persp * u;
    return [OX + cxm + dx * k, OY + (cym + dy) * S.tilt];
  }

  function resimplify() {
    if (!PRE || !WEIGHTS || !WEIGHTS.length || S.simp <= 0) { TOPO = RAW; }
    else {
      const i = Math.min(WEIGHTS.length - 1, Math.floor(Math.min(S.simp, 99.5) / 100 * WEIGHTS.length));
      try { TOPO = topojson.simplify(PRE, WEIGHTS[i]); } catch (e) { TOPO = RAW; }
    }
    stateF = topojson.feature(TOPO, TOPO.objects.states).features.filter((f) => keep(f.id));
    nation = topojson.merge(TOPO, TOPO.objects.states.geometries.filter((g) => keep(g.id)));
  }

  // deterministic generator-density speckle around the clusters (pre-warp
  // space so it rides the camera); clipped to the nation on screen
  function genSpeckle(proj) {
    let si = 1;
    const rnd = () => rnd1(si++);
    speckle = [];
    for (const b of BUBBLES) {
      const lv = Math.log10(Math.max(3, b.v));
      const n = Math.round(18 + 50 * lv);
      const sig = MW * (0.012 + 0.008 * lv);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.2832;
        const rr = Math.sqrt(-2 * Math.log(Math.max(1e-6, rnd()))) * sig * 0.55;
        speckle.push({ x: b.px + Math.cos(a) * rr, y: b.py + Math.sin(a) * rr, s: 0.8 + rnd() * 1.7, c: (rnd() * 3) | 0, o: rnd() });
      }
    }
    const bb = d3.geoPath(proj).bounds(nation);
    for (let i = 0; i < 550; i++)
      speckle.push({ x: bb[0][0] + rnd() * (bb[1][0] - bb[0][0]), y: bb[0][1] + rnd() * (bb[1][1] - bb[0][1]), s: 0.7 + rnd() * 1.2, c: (rnd() * 3) | 0, o: rnd() });
  }

  function build() {
    const nW = stage.clientWidth, nH = stage.clientHeight;
    if (!nW || !nH || !TOPO) return false;
    const nd = Math.min(window.devicePixelRatio || 1, 2);
    if (nW !== W || nH !== H || nd !== dpr) {
      W = nW; H = nH; dpr = nd;
      cv.width = W * dpr; cv.height = H * dpr;
      projCache = null;
      hitCv = null;
    }
    if (!projCache) {
      // final flat state: the page's content width, capped by the band height
      // so the nation NEVER crops
      const trial = d3.geoAlbers().fitWidth(1000, nation);
      const tb = d3.geoPath(trial).bounds(nation);
      const mhPerMw = (tb[1][1] - tb[0][1]) / 1000;
      MW = Math.min(W * (1416 / 1496), (H * 0.96) / mhPerMw);
      const mh = MW * mhPerMw;
      projCache = { MW, MH: mh, proj: d3.geoAlbers().fitExtent([[0, 0], [MW, mh]], nation) };
      const proj = projCache.proj;
      for (const b of BUBBLES) { const q = proj(b.ll); b.px = q ? q[0] : 0; b.py = q ? q[1] : 0; }
      BUBBLES.sort((a, b) => a.px - b.px); // resolve in west -> east
      genSpeckle(proj);
    }
    MW = projCache.MW; MH = projCache.MH;
    OX = (W - MW) / 2;
    OY = (H - MH * S.tilt) / 2;

    const tr = d3.geoTransform({ point(x, y) { const p = warp(x, y); this.stream.point(p[0], p[1]); } });
    const path = d3.geoPath({ stream: (s) => projCache.proj.stream(tr.stream(s)) });
    blocks = stateF.map((f) => {
      const d = path(f);
      if (!d) return null;
      const bx = path.bounds(f);
      let c = path.centroid(f);
      if (!isFinite(c[1])) c = [(bx[0][0] + bx[1][0]) / 2, (bx[0][1] + bx[1][1]) / 2];
      return { p: new Path2D(d), fips: String(f.id).padStart(2, '0'), bx, cx: c[0], cy: c[1] };
    }).filter(Boolean);
    const nd2 = path(nation);
    nationP = nd2 ? new Path2D(nd2) : null;

    // hover hit-test canvas (state under the pointer), CSS-pixel resolution
    hitCv = document.createElement('canvas');
    hitCv.width = W; hitCv.height = H;
    hitCtx = hitCv.getContext('2d', { willReadFrequently: true });
    hitCtx.fillStyle = '#000';
    hitCtx.fillRect(0, 0, W, H);
    HITKEYS = blocks.map((b) => b.fips);
    blocks.forEach((b, i) => {
      const v = i + 1;
      hitCtx.fillStyle = 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',0)';
      hitCtx.fill(b.p);
    });
    return true;
  }

  // ---------- hover state (final state only) ----------
  let hovState = null;              // fips under the pointer
  let hovBub = null;                // bubble under the pointer
  const anim = {};                  // fips -> goo progress 0..1
  let dim = 0;                      // rest-of-map dim, follows max(anim)
  let hoverRaf = 0;

  // goo mask: blurred blobs thresholded by contrast — the 2D take on the
  // hero photo dissolve
  const gooA = document.createElement('canvas'), gooB = document.createElement('canvas');

  function drawGoo(block, a) {
    const bw = Math.ceil(block.bx[1][0] - block.bx[0][0]) + 80;
    const bh = Math.ceil(block.bx[1][1] - block.bx[0][1]) + 80;
    if (bw <= 0 || bh <= 0) return null;
    if (gooA.width < bw || gooA.height < bh) { gooA.width = gooB.width = bw; gooA.height = gooB.height = bh; }
    const ox = block.bx[0][0] - 40, oy = block.bx[0][1] - 40;
    const ga = gooA.getContext('2d'), gb = gooB.getContext('2d');
    ga.setTransform(1, 0, 0, 1, 0, 0);
    ga.clearRect(0, 0, gooA.width, gooA.height);
    // seeds inside the state, lumpy metaballs
    const maxR = Math.hypot(bw, bh) * 0.5;
    const seedN = 3;
    ga.fillStyle = '#fff';
    const h = parseInt(block.fips, 10);
    for (let i = 0; i < seedN; i++) {
      const sx = (block.cx - ox) + (rnd1(h * 7 + i) - 0.5) * bw * 0.42;
      const sy = (block.cy - oy) + (rnd1(h * 13 + i) - 0.5) * bh * 0.42;
      const R = a * maxR * (0.75 + 0.35 * rnd1(h * 3 + i));
      for (let j = 0; j < 3; j++) {
        const jx = sx + (rnd1(h + i * 5 + j) - 0.5) * R * 0.5;
        const jy = sy + (rnd1(h + i * 9 + j + 40) - 0.5) * R * 0.5;
        ga.beginPath();
        ga.arc(jx, jy, Math.max(0.01, R * (0.55 + 0.25 * rnd1(h + j))), 0, 6.2832);
        ga.fill();
      }
    }
    const gb2 = gb;
    gb2.setTransform(1, 0, 0, 1, 0, 0);
    gb2.clearRect(0, 0, gooB.width, gooB.height);
    gb2.filter = 'blur(9px) contrast(24)';
    gb2.drawImage(gooA, 0, 0);
    gb2.filter = 'none';
    gb2.globalCompositeOperation = 'source-in';
    gb2.fillStyle = C.hover;
    gb2.fillRect(0, 0, gooB.width, gooB.height);
    gb2.globalCompositeOperation = 'source-over';
    return { ox, oy, w: gooB.width, h: gooB.height };
  }

  // ---------- painting ----------
  let PH = { ground: 0, flat: 0, speck: 0, bub: 0, leg: 0 }; // cached phases

  function paint(now) {
    const s = MW / 1200;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const topC = mixc(C.top, C.topFlat, PH.flat);
    ctx.globalAlpha = PH.ground;
    for (const b of blocks) {
      const a = anim[b.fips] || 0;
      ctx.fillStyle = dim > 0 ? mixc(topC, C.bg, 0.45 * dim * (1 - a)) : topC;
      ctx.fill(b.p);
      // hovered state lights up through goo holes and holds
      if (a > 0.004) {
        if (REDUCED || a > 0.996) { ctx.fillStyle = C.hover; ctx.fill(b.p); }
        else {
          const g = drawGoo(b, easeIO(a));
          if (g) { ctx.save(); ctx.clip(b.p); ctx.drawImage(gooB, 0, 0, g.w, g.h, g.ox, g.oy, g.w, g.h); ctx.restore(); }
        }
      }
    }
    ctx.lineWidth = S.edge;
    ctx.strokeStyle = mixc(C.edge, C.edgeFlat, PH.flat);
    ctx.globalAlpha = PH.ground * lerp(1, 0.45, PH.flat) * (1 - 0.4 * dim);
    for (const b of blocks) ctx.stroke(b.p);
    ctx.globalAlpha = 1;

    if (PH.speck > 0 && nationP) {
      ctx.save();
      ctx.clip(nationP);
      const dimK = 1 - 0.6 * dim;
      for (const d of speckle) {
        const a = seg(PH.speck, [d.o * 0.6, d.o * 0.6 + 0.4]);
        if (a <= 0) continue;
        const sp = SPECK[d.c];
        const p = warp(d.x, d.y);
        ctx.globalAlpha = a * sp[1] * (0.45 + d.o * 0.55) * dimK;
        ctx.fillStyle = sp[0];
        const r = d.s * s;
        ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (PH.bub > 0) {
      const n = BUBBLES.length;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      BUBBLES.forEach((b, i) => {
        const st = (i / (n - 1)) * 0.72;
        const a = easeOut(seg(PH.bub, [st, st + 0.28]));
        if (a <= 0) { b.sx = -1e6; return; }
        const p = warp(b.px, b.py);
        const r0 = (6 + 7.6 * Math.log10(b.v)) * s;
        b.sx = p[0]; b.sy = p[1]; b.sr = r0;
        // a state hover collapses the circles to bare numbers; a bubble hover grows its own
        const r = r0 * a * (1 - dim) * (1 + 0.14 * b.hov);
        if (r > 0.3) {
          ctx.globalAlpha = 0.85 * a;
          ctx.fillStyle = b.weak ? C.goldDark : C.gold;
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, 6.2832);
          ctx.fill();
        }
        const fs = Math.max(8, Math.min(14 * s, r0 * 0.62)) * (1 + 0.10 * b.hov);
        ctx.globalAlpha = a;
        ctx.fillStyle = C.ink;
        ctx.font = '500 ' + fs + 'px "Overused Grotesk", system-ui, sans-serif';
        // a bubble hover re-ticks the count, waste-list style
        const tf = REDUCED ? 1 : easeOut(clamp01((now - b.tick0) / 800));
        ctx.fillText(tf >= 1 ? b.label : fmt(b.v * tf, b.label.endsWith('k')), p[0], p[1] + fs * 0.06);
      });
      ctx.globalAlpha = 1;
    }

    if (PH.leg > 0) {
      const x = Math.max(32, OX), y = H - 40, bw = 148, bh = 5;
      ctx.globalAlpha = PH.leg * (1 - 0.5 * dim);
      ctx.font = '500 9px "Overused Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.grey;
      ctx.fillText('CAPTURE RATE', x, y);
      const g = ctx.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, C.goldDark);
      g.addColorStop(1, C.goldLight);
      ctx.fillStyle = g;
      ctx.fillRect(x, y + 8, bw, bh);
      ctx.fillStyle = C.grey7;
      ctx.fillText('0% · WEAK', x, y + 26);
      ctx.textAlign = 'right';
      ctx.fillText('STRONG · 100%', x + bw, y + 26);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- scroll drive ----------
  let lastP = -1, curP = 0, camKey = '';

  function set(p) {
    curP = p;
    if (!TOPO) return;
    if (REDUCED) p = p > 0.05 ? 1 : 0;
    if (p === lastP) return;
    lastP = p;
    const formE = easeIO(seg(p, T.form));
    const flatE = easeIO(seg(p, T.flat));
    S.tilt = lerp(lerp(CAM0.tilt, 0.54, formE), 1, flatE);
    S.rot = lerp(CAM0.rot, 0, formE);
    S.persp = lerp(0.08, 0, flatE);
    S.bow = lerp(0.1, 0, flatE);
    const ck = S.tilt.toFixed(4) + '|' + S.rot.toFixed(3) + '|' + stage.clientWidth + 'x' + stage.clientHeight;
    if (ck !== camKey) { camKey = ck; if (!build()) return; }
    PH = { ground: seg(p, [0, 0.08]), flat: flatE, speck: seg(p, T.speck), bub: seg(p, T.bub), leg: seg(p, T.leg) };
    paint(performance.now());
  }

  // ---------- hover (final state only) ----------
  function pick(x, y) {
    if (!hitCtx || x < 0 || y < 0 || x >= W || y >= H) return null;
    const d = hitCtx.getImageData(x, y, 1, 1).data;
    const v = d[0] + (d[1] << 8);
    return v > 0 ? HITKEYS[v - 1] : null;
  }

  function hoverTick(now) {
    hoverRaf = 0;
    let busy = false;
    for (const b of blocks) {
      const f = b.fips;
      const tg = f === hovState ? 1 : 0;
      let a = anim[f] || 0;
      if (a === 0 && tg === 0) continue;
      a += (tg - a) * (tg === 1 ? 0.075 : 0.17); // goo grows in readably, lets go quick
      if (tg === 1 && a > 0.996) a = 1;
      if (tg === 0 && a < 0.004) a = 0;
      if (a !== tg) busy = true;
      if (a === 0) delete anim[f]; else anim[f] = a;
    }
    dim = 0;
    for (const f in anim) dim = Math.max(dim, anim[f]);
    for (const b of BUBBLES) {
      const tg = b === hovBub ? 1 : 0;
      if (b.hov !== tg) { b.hov += (tg - b.hov) * 0.2; if (Math.abs(b.hov - tg) < 0.01) b.hov = tg; busy = true; }
      if (now - b.tick0 < 820) busy = true;
    }
    paint(now);
    if (busy) hoverRaf = requestAnimationFrame(hoverTick);
  }
  const wake = () => { if (!hoverRaf) hoverRaf = requestAnimationFrame(hoverTick); };

  cv.addEventListener('pointermove', (e) => {
    if (curP < 0.98 || !hitCtx) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    // bubbles take precedence over the state underneath
    let hb = null;
    for (const b of BUBBLES) {
      if (b.sx === undefined || b.sx < -1e5) continue;
      const dx = x - b.sx, dy = y - b.sy;
      if (dx * dx + dy * dy <= b.sr * b.sr * 1.21) { hb = b; break; }
    }
    if (hb !== hovBub) {
      hovBub = hb;
      if (hb && !REDUCED) hb.tick0 = performance.now(); // re-tick on enter
    }
    const st = hb ? null : pick(Math.round(x), Math.round(y));
    if (st !== hovState) hovState = st;
    wake();
  });
  cv.addEventListener('pointerleave', () => { hovState = null; hovBub = null; wake(); });

  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { projCache = null; W = 0; camKey = ''; lastP = -1; set(curP); }, 150);
  });

  // topology up front; same source Kuba's tool uses (identical simplify weights)
  d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json').then((us) => {
    RAW = us;
    try {
      PRE = topojson.presimplify(us);
      const w = [];
      for (const arc of PRE.arcs) for (const p of arc) { const v = p[2]; if (v != null && isFinite(v)) w.push(v); }
      w.sort((a, b) => a - b);
      WEIGHTS = w;
    } catch (e) { PRE = null; WEIGHTS = null; }
    resimplify();
    const p = curP; lastP = -1; set(p); // apply whatever the scroll already wants
  }).catch(() => {});

  window.colmezMap = { set };
})();
