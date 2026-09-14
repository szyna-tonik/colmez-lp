/* Colmez map — an imitation of the client's product map (Markets view):
   brand-grey ground, gold-tinted generator speckle, count bubbles + legend in
   the PRODUCT's own colours (red #c64237 = weak capture, gold #dfa32f =
   strong) — no product chrome (no labels, toggles, chat, sidebar).
   Ground = Kuba's block-map contour treatment (colmez-block-map-v11_2.html).

   The whole ride is SCROLL-DRIVEN (reversible): rises into perspective, lifts
   and levels flat, density resolves, bubbles pop, legend last; the final flat
   map spans the page's content width (capped by viewport height — it never
   crops). Driven from main.js via window.colmezMap.set(p).

   Interaction (once the map is mostly resolved, p >= HOV_P):
   - hovering a state: the rest dims, off-state bubbles shrink 20% and grey
     out (they never vanish), and — exactly like the hero logo hover — ONE
     melting blob follows the cursor inside the state, revealing the logo's
     dense pattern, clipped by the state contour; the name rides the cursor
     in a crisis-style chip; the state's own bubbles stay at full colour;
   - hovering a bubble (also while a state is lit): it grows slightly.
   Bubbles + legend keep the CLIENT'S product colours (red = weak capture,
   gold = strong) — that part is their product, not our palette. */
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
    // the client's product colours (bubbles + capture-rate legend)
    red: '#c64237', prodGold: '#dfa32f',
    ink: '#ffffff', grey: '#9a9a9a', grey7: '#737373',
  };
  const SPECK = [
    ['#38360d', 0.9], ['#605817', 0.65], ['#ae9a29', 0.4],
  ];

  const S = { simp: 100, edge: 1.6, tilt: 0.54, rot: 0, persp: 0.08, bow: 0.1, zoom: 1 };
  const CAM0 = { tilt: 0.25, rot: -25, zoom: 0.72 };
  // scroll-progress windows (p = 0..1 from main.js)
  const T = {
    // the flat window starts LATE (user rev 2): the map holds its perspective
    // pose — speckle and bubbles already resolving on it — until it nearly
    // fills the viewport, and only then lifts and levels
    form: [0, 0.22], flat: [0.66, 0.90], speck: [0.5, 0.78],
    bub: [0.56, 0.94], leg: [0.92, 1], frame: [0.02, 0.34],
  };
  const HOV_P = 0.8; // hover arms once the map is levelling out

  const NAMES = {
    '01': 'Alabama', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
    '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
    '12': 'Florida', '13': 'Georgia', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
    '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
    '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
    '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
    '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
    '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
    '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
    '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
    '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
    '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
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
    hov: 0,
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

  // ---------- geometry (Kuba's pipeline: warp -> geoTransform -> Path2D) ----------
  let RAW = null, PRE = null, WEIGHTS = null, TOPO = null, stateF = [], nation = null;
  let W = 0, H = 0, dpr = 1, MW = 0, MH = 0, OX = 0, OY = 0, projCache = null;
  let blocks = [], nationP = null, speckle = [];
  // identity-transform context for exact point-in-polygon picking
  const pickCtx = document.createElement('canvas').getContext('2d');

  // screen = canvas centre + centred offsets scaled by tilt and zoom (the map
  // grows to full content width as the ride flattens)
  function warp(x, y) {
    const cxm = MW / 2, cym = MH / 2;
    let dx = x - cxm, dy = y - cym;
    if (S.rot) { const a = S.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const nx = dx * c - dy * s, ny = dx * s + dy * c; dx = nx; dy = ny; }
    if (S.bow) dy += S.bow * MH * (Math.pow(dx / cxm, 2) - 0.33);
    const u = dy / MH, k = 1 + S.persp * u;
    return [W / 2 + dx * k * S.zoom, H / 2 + dy * S.tilt * S.zoom];
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
    }
    if (!projCache) {
      // final flat state: as big as the band allows — side edges pushed out
      // to nearly touch the vertical frame lines (user rev)
      const trial = d3.geoAlbers().fitWidth(1000, nation);
      const tb = d3.geoPath(trial).bounds(nation);
      const mhPerMw = (tb[1][1] - tb[0][1]) / 1000;
      const innerW = W * (1416 / 1496);
      // 24px breathing room above and below — the map must never touch the
      // horizontal frame lines (client rev; OY centres it, so 24 each side)
      MW = Math.min(innerW * 0.995, (H - 48) / mhPerMw);
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

    // which state each bubble sits on (its bubbles stay lit on a state hover);
    // coastal metros (SF, Seattle, New Orleans…) can land just outside the
    // brutally simplified polygon — probe rings around the point, then fall
    // back to the nearest centroid, so EVERY bubble gets a state
    const inBlock = (x, y) => {
      for (const bl of blocks) {
        if (x < bl.bx[0][0] || x > bl.bx[1][0] || y < bl.bx[0][1] || y > bl.bx[1][1]) continue;
        if (pickCtx.isPointInPath(bl.p, x, y)) return bl.fips;
      }
      return null;
    };
    for (const b of BUBBLES) {
      const q = warp(b.px, b.py);
      b.fips = inBlock(q[0], q[1]);
      for (const rr of [6, 14, 26, 42]) {
        if (b.fips) break;
        for (let k = 0; k < 8 && !b.fips; k++) {
          const a = (k / 8) * 6.2832;
          b.fips = inBlock(q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr);
        }
      }
      if (!b.fips) {
        let bd = Infinity;
        for (const bl of blocks) {
          const dx = q[0] - bl.cx, dy = q[1] - bl.cy, d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; b.fips = bl.fips; }
        }
      }
    }
    return true;
  }

  // ---------- hover state (final state only) ----------
  let hovState = null;              // fips under the pointer
  let hovBub = null;                // bubble under the pointer
  const anim = {};                  // fips -> goo progress 0..1
  let dim = 0;                      // rest-of-map dim, follows max(anim)
  let hoverRaf = 0;
  let mx = -1, my = -1;             // pointer, CSS px (for the state-name label)

  // goo mask: blurred blobs thresholded by contrast — the 2D take on the
  // hero photo dissolve
  const gooA = document.createElement('canvas'), gooB = document.createElement('canvas');

  // the blob reveals EXACTLY what the hero logo hover shows. The logo shader
  // cover-fits pattern.svg to the BIG logo's box (1416x191, aspect ~7.4 vs
  // the texture's 1.82) — the cover crop + the 2.6x zoom land on the central
  // 575x78 sliver of the pattern, ENLARGED ~2.46x (1416/575): thick, tightly
  // packed strokes, fills included, brightness 1.35. We rasterise that same
  // sliver at that same scale into a mirror-tiled 2x2 canvas (seamless
  // repeat) used as a translating CanvasPattern.
  const patImg = new Image();
  patImg.onload = () => { patFill = null; if (lastP >= 0) { lastP = -1; set(curP); } };
  // lineImg = the same pattern with the big solid pattern__fills areas turned
  // off — at map scale a fill landing on a state flooded it in flat gold
  // (client: lines everywhere, never gold fields); the fine noise dust stays
  const lineImg = new Image();
  lineImg.onload = () => { if (lastP >= 0) { lastP = -1; set(curP); } };
  fetch('assets/img/pattern.svg').then((r) => r.text()).then((txt) => {
    const src = txt.replace('<svg ', '<svg width="1496" height="820" ');
    patImg.src = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    const lsrc = src.replace('<g class="pattern__fills" fill="#ae9a29">',
                             '<g class="pattern__fills" fill="none">')
      // doubled stroke weight: sampled zoomed OUT (uZoom < 1) the hero
      // strokes thin to hairlines — this keeps the logo hover's line weight
      .replace(/stroke-width="1\.0"/g, 'stroke-width="2.0"')
      .replace(/stroke-width="1\.5"/g, 'stroke-width="3.0"');
    lineImg.src = URL.createObjectURL(new Blob([lsrc], { type: 'image/svg+xml' }));
  }).catch(() => { patImg.src = 'assets/img/pattern.svg'; lineImg.src = 'assets/img/pattern.svg'; });
  let patFill = null, patFillW = 0;
  let patDX = 0, patDY = 0; // current drift, updated in paint()
  function patternFill() {
    if (!patImg.complete || !W) return null;
    if (!patFill || patFillW !== W) {
      const sc = (W / 1496) * 2.46;         // the logo hover's effective scale (1416 / 575)
      const sw = 1496 / 2.6, sh = 820 * (1.82 / 7.41) / 2.6; // the 575x78 sliver the shader samples
      const sx = (1496 - sw) / 2, sy = (820 - sh) / 2;
      const tw = Math.max(1, Math.round(sw * sc)), th = Math.max(1, Math.round(sh * sc));
      const tile = document.createElement('canvas');
      tile.width = tw * 2; tile.height = th * 2;
      const g = tile.getContext('2d');
      g.fillStyle = '#121212';
      g.fillRect(0, 0, tw * 2, th * 2);
      try {
        g.filter = 'brightness(1.35)'; // the logo shader's col * 1.35
        for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          g.setTransform(fx, 0, 0, fy, fx === 1 ? 0 : tw * 2, fy === 1 ? 0 : th * 2);
          g.drawImage(patImg, sx, sy, sw, sh, 0, 0, tw, th);
        }
        g.filter = 'none';
      } catch (e) { return null; }
      g.setTransform(1, 0, 0, 1, 0, 0);
      patFill = ctx.createPattern(tile, 'repeat');
      patFillW = W;
    }
    return patFill;
  }

  // ONE melting blob follows the eased cursor inside the hovered state —
  // the hero logo hover interaction, run through THE SAME SHADER (FRAG_LOGO
  // with the glyph mask dropped — the state contour clips in 2D instead).
  // The dense "marble" of the logo hover comes from the shader's melt-smear
  // warping the texture UVs, which no 2D approximation reproduces — so the
  // blob renders on its own small WebGL canvas and is composited in.
  let bxE = 0, byE = 0; // eased blob centre (k = 0.10/frame, like the logo)

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

  // FRAG_LOGO from main.js, VERBATIM (only the glyph mask is dropped — the
  // state contour clips in 2D instead). The whole MAP canvas plays the part
  // of the logo box: cover-fit + the 2.6x zoom run over it, so one
  // continuous logo-style pattern underlies the entire map and a hovered
  // state simply reveals its piece of it.
  const FRAG_BLOB = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uRes;
    uniform float uTexAspect;
    uniform float uP;
    uniform float uTime;
    uniform vec2 uSeed;
    uniform float uRad;
    uniform float uZoom;
    ${GLSL_NOISE}
    void main(){
      float sa = uRes.x / uRes.y;
      vec2 uv = vUv;
      if (sa > uTexAspect) uv.y = (uv.y - 0.5) * (uTexAspect / sa) + 0.5;
      else                 uv.x = (uv.x - 0.5) * (sa / uTexAspect) + 0.5;

      vec2 q = vec2(vUv.x * sa, vUv.y);
      float n1 = fbm3(q * 2.6 + 3.1);
      float n2 = snoise(q * 5.5 + vec2(7.3, 1.9)) * 0.5;

      float r = max(uP * uRad, 1e-4);
      float e = distance(q, uSeed) / r + n1 * 0.32 + n2 * 0.10;
      float vis = 1.0 - smoothstep(0.86, 1.10, e);
      if (vis <= 0.0) { gl_FragColor = vec4(0.0); return; }
      float melt = (1.0 - smoothstep(0.55, 1.45, e)) * smoothstep(0.0, 0.08, uP);

      uv = 0.5 + (uv - 0.5) / uZoom;

      vec2 w = uv + vec2(
        snoise(q * 1.6 + vec2(uTime * 0.05, -uTime * 0.04)),
        snoise(q * 1.6 + vec2(-uTime * 0.045, uTime * 0.05) + 4.7)
      ) * 0.004;

      float drip = melt * (0.12 + 0.30 * (0.5 + 0.5 * n2)) * (0.35 + 0.65 * uP);
      w.y -= drip * (0.6 + 0.4 * snoise(q * 9.0) * 0.6) * 0.4;
      w.x += melt * 0.05 * snoise(q * 6.0 + 11.0) * 0.6;
      w = 1.0 - abs(fract(w * 0.5) * 2.0 - 1.0); // mirror-tile: uZoom < 1 samples past the texture edge
      vec3 col = texture2D(uTex, w).rgb * 1.35;

      col *= 1.0 - 0.35 * melt;

      gl_FragColor = vec4(col * vis, vis);
    }`;

  let bglCv = null, bgl = null, bglU = null, bglTexReady = false, bglSide = 0;
  function initBlobGL(side) {
    if (bgl === false) return null;
    if (!bglCv) {
      bglCv = document.createElement('canvas');
      bgl = bglCv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!bgl) { bgl = false; return null; }
      const sh = (t, s) => { const x = bgl.createShader(t); bgl.shaderSource(x, s); bgl.compileShader(x); return x; };
      const VERT = 'attribute vec2 aP; varying vec2 vUv; void main(){ vUv = vec2(aP.x*0.5+0.5, 0.5-aP.y*0.5); gl_Position = vec4(aP,0.,1.); }';
      const prog = bgl.createProgram();
      bgl.attachShader(prog, sh(bgl.VERTEX_SHADER, VERT));
      bgl.attachShader(prog, sh(bgl.FRAGMENT_SHADER, FRAG_BLOB));
      bgl.linkProgram(prog);
      if (!bgl.getProgramParameter(prog, bgl.LINK_STATUS)) { bgl = false; return null; }
      bgl.useProgram(prog);
      const buf = bgl.createBuffer();
      bgl.bindBuffer(bgl.ARRAY_BUFFER, buf);
      bgl.bufferData(bgl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), bgl.STATIC_DRAW);
      const loc = bgl.getAttribLocation(prog, 'aP');
      bgl.enableVertexAttribArray(loc);
      bgl.vertexAttribPointer(loc, 2, bgl.FLOAT, false, 0, 0);
      bglU = {};
      for (const n of ['uTex', 'uRes', 'uTexAspect', 'uP', 'uTime', 'uSeed', 'uRad', 'uZoom'])
        bglU[n] = bgl.getUniformLocation(prog, n);
      const tex = bgl.createTexture();
      bgl.bindTexture(bgl.TEXTURE_2D, tex);
      bgl.texParameteri(bgl.TEXTURE_2D, bgl.TEXTURE_WRAP_S, bgl.CLAMP_TO_EDGE);
      bgl.texParameteri(bgl.TEXTURE_2D, bgl.TEXTURE_WRAP_T, bgl.CLAMP_TO_EDGE);
      bgl.texParameteri(bgl.TEXTURE_2D, bgl.TEXTURE_MIN_FILTER, bgl.LINEAR);
      bgl.texParameteri(bgl.TEXTURE_2D, bgl.TEXTURE_MAG_FILTER, bgl.LINEAR);
      bgl.uniform1i(bglU.uTex, 0);
    }
    if (!bglTexReady) {
      if (!lineImg.complete || !lineImg.naturalWidth) return null;
      // the logo texture raster: pattern.svg at 2244x1230 (makeLogoTexture),
      // lines-only variant
      const tc = document.createElement('canvas');
      tc.width = 2244; tc.height = 1230;
      const g = tc.getContext('2d');
      g.fillStyle = '#121212';
      g.fillRect(0, 0, 2244, 1230);
      try { g.drawImage(lineImg, 0, 0, 2244, 1230); } catch (e) { return null; }
      bgl.texImage2D(bgl.TEXTURE_2D, 0, bgl.RGB, bgl.RGB, bgl.UNSIGNED_BYTE, tc);
      bglTexReady = true;
    }
    if (bglSide !== side) {
      const w = Math.max(1, Math.round(W)), h = Math.max(1, Math.round(H));
      bglCv.width = w; bglCv.height = h;
      bgl.viewport(0, 0, w, h);
      bglSide = side;
    }
    return bgl;
  }

  // the whole map canvas rendered through the logo hover shader — one
  // continuous pattern layer; the hole chases the eased cursor exactly like
  // on the logo, but its radius is sized per state so a fully lit state is
  // covered EDGE TO EDGE (a fixed 0.52 left the far side of big states black,
  // so the highlight read as a blob instead of a filled state)
  function drawBlobGL(block, a, now) {
    const gl2 = initBlobGL(Math.round(W) * 65536 + Math.round(H));
    if (!gl2) return null;
    const sa = W / H;
    gl2.uniform2f(bglU.uRes, W, H);
    gl2.uniform1f(bglU.uTexAspect, 1496 / 820);
    gl2.uniform1f(bglU.uP, a);
    gl2.uniform1f(bglU.uTime, REDUCED ? 7.3 : now / 1000);
    gl2.uniform2f(bglU.uSeed, (bxE / W) * sa, byE / H);
    gl2.uniform1f(bglU.uRad, blobRadius(block, sa));
    gl2.uniform1f(bglU.uZoom, PAT_ZOOM);
    gl2.clearColor(0, 0, 0, 0);
    gl2.clear(gl2.COLOR_BUFFER_BIT);
    gl2.drawArrays(gl2.TRIANGLES, 0, 6);
    return true;
  }

  // q-space radius that reaches every corner of the block's bbox from the
  // eased cursor; COVER absorbs the noise (n1*0.32 + n2*0.10) that pushes the
  // dissolve edge inwards, so the polygon fills right up to its border
  const BLOB_COVER = 1.5;
  // 2.6 (the logo's own zoom) was far too coarse spread over the whole map —
  // a hovered state showed two or three giant contour rings; 1.0 shows the
  // full pattern across the band, matching the logo hover's line density
  // (client rev: as dense as the logo). Mirror-tiled in the shader, so 0.7
  // packs ~1.4x the full pattern across the band; the doubled raster stroke
  // width keeps the lines at logo weight at this scale.
  let PAT_ZOOM = 0.7;
  function blobRadius(block, sa) {
    const qx = (x) => (x / W) * sa, qy = (y) => y / H;
    const sx = qx(bxE), sy = qy(byE);
    let m = 0;
    for (const cx of [block.bx[0][0], block.bx[1][0]])
      for (const cy of [block.bx[0][1], block.bx[1][1]]) {
        const dx = qx(cx) - sx, dy = qy(cy) - sy;
        const d = Math.hypot(dx, dy);
        if (d > m) m = d;
      }
    return Math.max(m * BLOB_COVER, 0.08);
  }

  function drawBlob(block, a, now) {
    const Rmax = H * 0.26;
    const R = a * Rmax;
    if (R < 1) return null;
    const pad = Math.ceil(Rmax * 1.6 + 40);
    const w = pad * 2, h2 = pad * 2;
    if (gooA.width < w || gooA.height < h2) { gooA.width = gooB.width = w; gooA.height = gooB.height = h2; }
    const ox = bxE - pad, oy = byE - pad;
    const ga = gooA.getContext('2d'), gb = gooB.getContext('2d');
    ga.setTransform(1, 0, 0, 1, 0, 0);
    ga.clearRect(0, 0, gooA.width, gooA.height);
    ga.fillStyle = '#fff';
    const hs = parseInt(block.fips, 10);
    const t = now * 0.001;
    for (let i = 0; i < 7; i++) {
      const wob = 1 + 0.10 * Math.sin(t * (0.8 + 0.5 * rnd1(hs + i * 3)) + i * 2.1);
      const ang = rnd1(hs * 5 + i) * 6.2832 + t * 0.12 * (i % 2 ? 1 : -1);
      const off = i === 0 ? 0 : R * 0.48 * (0.35 + 0.65 * rnd1(hs + i * 7));
      const cx2 = pad + Math.cos(ang) * off;
      const cy2 = pad + Math.sin(ang) * off * 0.9 + (i % 3 === 2 ? R * 0.14 : 0); // melt bias down
      const rr = R * (i === 0 ? 0.70 : 0.26 + 0.30 * rnd1(hs * 11 + i)) * wob;
      ga.beginPath();
      ga.arc(cx2, cy2, Math.max(0.01, rr), 0, 6.2832);
      ga.fill();
    }
    gb.setTransform(1, 0, 0, 1, 0, 0);
    gb.clearRect(0, 0, gooB.width, gooB.height);
    gb.filter = 'blur(9px) contrast(24)';
    gb.drawImage(gooA, 0, 0);
    gb.filter = 'none';
    gb.globalCompositeOperation = 'source-in';
    const pat = patternFill();
    if (pat) {
      // pattern coords stay global (drift − blob-canvas offset) so it floats
      pat.setTransform(new DOMMatrix().translate(patDX - ox, patDY - oy));
      gb.fillStyle = pat;
      gb.fillRect(0, 0, gooB.width, gooB.height);
    } else { gb.fillStyle = C.hover; gb.fillRect(0, 0, gooB.width, gooB.height); }
    gb.globalCompositeOperation = 'source-over';
    return { ox, oy, w: gooB.width, h: gooB.height };
  }

  // ---------- painting ----------
  let PH = { ground: 0, flat: 0, speck: 0, bub: 0, leg: 0, frame: 0 }; // cached phases

  function paint(now) {
    // the pattern floats slowly, like a dense substance
    if (!REDUCED) {
      const t = now * 0.001;
      patDX = 14 * Math.sin(t * 0.21) + 7 * Math.sin(t * 0.083 + 2.1);
      patDY = 12 * Math.cos(t * 0.17) + 6 * Math.sin(t * 0.101 + 1.3);
    }
    const s = MW / 1200;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Figma frame: two 1px horizontals across the FULL page width at the
    // band's top/bottom edges, two verticals at the 40u content margins
    // between them — horizontals draw L->R, verticals follow T->B
    if (PH.frame > 0) {
      const mg = W * (40 / 1496);
      const hT = easeIO(seg(PH.frame, [0, 0.7]));
      const vT = easeIO(seg(PH.frame, [0.25, 1]));
      ctx.strokeStyle = '#313131';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0.5); ctx.lineTo(W * hT, 0.5);
      ctx.moveTo(0, H - 0.5); ctx.lineTo(W * hT, H - 0.5);
      if (vT > 0) {
        ctx.moveTo(mg + 0.5, 0.5); ctx.lineTo(mg + 0.5, H * vT);
        ctx.moveTo(W - mg - 0.5, 0.5); ctx.lineTo(W - mg - 0.5, H * vT);
      }
      ctx.stroke();
    }

    const topC = mixc(C.top, C.topFlat, PH.flat);
    ctx.globalAlpha = PH.ground;
    for (const b of blocks) {
      const a = anim[b.fips] || 0;
      ctx.fillStyle = dim > 0 ? mixc(topC, C.bg, 0.45 * dim * (1 - a)) : topC;
      ctx.fill(b.p);
      // the hovered state reveals its piece of the map-wide pattern layer
      // (the eased anim[fips] IS the logo's exponential lhp — no extra easing)
      if (a > 0.004) {
        if (drawBlobGL(b, a, now)) { ctx.save(); ctx.clip(b.p); ctx.drawImage(bglCv, 0, 0, W, H); ctx.restore(); }
        else {
          const g2 = drawBlob(b, easeIO(a), now); // 2D fallback (no WebGL)
          if (g2) { ctx.save(); ctx.clip(b.p); ctx.drawImage(gooB, 0, 0, g2.w, g2.h, g2.ox, g2.oy, g2.w, g2.h); ctx.restore(); }
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
        // a state hover keeps its own bubbles at full colour; the rest shrink
        // 20% and grey out (never vanish) so the focus lands on the lit state
        const aSt = anim[b.fips] || 0;
        const bd = dim * (1 - aSt);
        const r = r0 * a * (1 - 0.2 * bd) * (1 + 0.14 * b.hov);
        const base = b.weak ? C.red : C.prodGold;
        if (r > 0.3) {
          // bubbles on the hovered state go fully opaque
          ctx.globalAlpha = (0.85 + 0.15 * aSt * dim) * a * (1 - 0.3 * bd);
          ctx.fillStyle = bd > 0.01 ? mixc(base, '#4a4a4a', 0.7 * bd) : base;
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, 6.2832);
          ctx.fill();
        }
        const fs = Math.max(8, Math.min(14 * s, r0 * 0.62)) * (1 + 0.10 * b.hov);
        ctx.globalAlpha = a * (1 - 0.25 * bd);
        // white on the product gold is ~1.9:1 — unreadable once the hovered
        // state's pattern runs underneath; gold discs take the page black,
        // the red (weak) discs keep white. Dimmed discs go dark, so the ink
        // flips light as they grey out.
        const ink0 = b.weak ? C.ink : '#121212';
        ctx.fillStyle = bd > 0.01 ? mixc(ink0, b.weak ? '#8a8a8a' : '#9a9a9a', bd) : ink0;
        ctx.font = '600 ' + fs + 'px "Overused Grotesk", system-ui, sans-serif';
        ctx.fillText(b.label, p[0], p[1] + fs * 0.06);
      });
      ctx.globalAlpha = 1;
    }

    if (PH.leg > 0) {
      // raised + 10% larger (user rev)
      const x = Math.max(32, OX), y = H - 72, bw = 163, bh = 6;
      ctx.globalAlpha = PH.leg * (1 - 0.5 * dim);
      ctx.font = '500 10px "Overused Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.grey;
      ctx.fillText('CAPTURE RATE', x, y);
      const g = ctx.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, C.red);
      g.addColorStop(1, C.prodGold);
      ctx.fillStyle = g;
      ctx.fillRect(x, y + 9, bw, bh);
      ctx.fillStyle = C.grey7;
      ctx.fillText('0% · WEAK', x, y + 29);
      ctx.textAlign = 'right';
      ctx.fillText('STRONG · 100%', x + bw, y + 29);
      ctx.globalAlpha = 1;
    }

    // hovered state's name rides the cursor — same style as the crisis
    // number chips: a small grey-800 plate, label bottom-left
    if (dim > 0.02 && mx >= 0) {
      let best = null, ba = 0;
      for (const b of blocks) { const a2 = anim[b.fips] || 0; if (a2 > ba) { ba = a2; best = b; } }
      if (best && NAMES[best.fips]) {
        ctx.font = '600 12px "Overused Grotesk", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const label = NAMES[best.fips].toUpperCase();
        const tw = ctx.measureText(label).width;
        const ch = 28, cw = tw + 12;
        const cx2 = Math.min(mx + 16, W - cw - 8), cy2 = Math.max(8, my - 16 - ch);
        ctx.globalAlpha = ba;
        ctx.fillStyle = '#313131';
        ctx.fillRect(cx2, cy2, cw, ch);
        ctx.fillStyle = C.ink;
        ctx.fillText(label, cx2 + 5, cy2 + ch - 6);
        ctx.globalAlpha = 1;
      }
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
    if (p < HOV_P && (hovState || hovBub)) { hovState = null; hovBub = null; wake(); }
    const formE = easeIO(seg(p, T.form));
    const flatE = easeIO(seg(p, T.flat));
    S.tilt = lerp(lerp(CAM0.tilt, 0.54, formE), 1, flatE);
    S.rot = lerp(CAM0.rot, 0, formE);
    S.persp = lerp(0.08, 0, flatE);
    S.bow = lerp(0.1, 0, flatE);
    S.zoom = lerp(CAM0.zoom, 1, flatE); // the map grows to fill the band as it levels
    const ck = S.tilt.toFixed(4) + '|' + S.rot.toFixed(3) + '|' + S.zoom.toFixed(4) + '|' + stage.clientWidth + 'x' + stage.clientHeight;
    if (ck !== camKey) { camKey = ck; if (!build()) return; }
    PH = { ground: seg(p, [0, 0.08]), flat: flatE, speck: seg(p, T.speck), bub: seg(p, T.bub), leg: seg(p, T.leg), frame: seg(p, T.frame) };
    paint(performance.now());
  }

  // ---------- hover (final state only) ----------
  // exact point-in-polygon pick — the old hit-canvas approach antialiased the
  // shared borders, so a pointer on a state line blended into a random
  // neighbour's index and the highlight jumped
  function pick(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    for (const b of blocks) {
      if (x < b.bx[0][0] || x > b.bx[1][0] || y < b.bx[0][1] || y > b.bx[1][1]) continue;
      if (pickCtx.isPointInPath(b.p, x, y)) return b.fips;
    }
    // exactly on a shared border the point can land in no polygon — stay on
    // the current state instead of flickering off (it must still be adjacent)
    if (hovState) {
      const cur = blocks.find((b) => b.fips === hovState);
      if (cur)
        for (const o of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]])
          if (pickCtx.isPointInPath(cur.p, x + o[0], y + o[1])) return hovState;
    }
    return null;
  }

  function hoverTick(now) {
    hoverRaf = 0;
    let busy = false;
    for (const b of blocks) {
      const f = b.fips;
      const tg = f === hovState ? 1 : 0;
      let a = anim[f] || 0;
      if (a === 0 && tg === 0) continue;
      a += (tg - a) * (tg === 1 ? 0.062 : 0.038); // the logo hover's own easing
      if (REDUCED) a = tg;
      if (tg === 1 && a > 0.996) a = 1;
      if (tg === 0 && a < 0.004) a = 0;
      if (a !== tg) busy = true;
      if (a === 0) delete anim[f]; else anim[f] = a;
    }
    // the blob centre chases the cursor like the logo hover's hole
    if (mx >= 0) {
      bxE += (mx - bxE) * (REDUCED ? 1 : 0.10);
      byE += (my - byE) * (REDUCED ? 1 : 0.10);
    }
    // the global dim eases on its own — tying it to max(anim) made the whole
    // map (and every bubble) dip and pop when crossing between two states
    const dt = hovState ? 1 : 0;
    if (dim !== dt) {
      dim += (dt - dim) * (dt === 1 ? 0.1 : 0.17);
      if (Math.abs(dim - dt) < 0.004) dim = dt; else busy = true;
    }
    for (const b of BUBBLES) {
      const tg = b === hovBub ? 1 : 0;
      if (b.hov !== tg) { b.hov += (tg - b.hov) * 0.2; if (Math.abs(b.hov - tg) < 0.01) b.hov = tg; busy = true; }
    }
    if (!REDUCED && dim > 0.004) busy = true; // keep the pattern drifting while a state is lit
    paint(now);
    if (busy) hoverRaf = requestAnimationFrame(hoverTick);
  }
  const wake = () => { if (!hoverRaf) hoverRaf = requestAnimationFrame(hoverTick); };

  cv.addEventListener('pointermove', (e) => {
    if (curP < HOV_P || !blocks.length) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    mx = x; my = y;
    // a bubble hover adds on top of the state hover (grow), it does not
    // release the lit state underneath
    let hb = null;
    for (const b of BUBBLES) {
      if (b.sx === undefined || b.sx < -1e5) continue;
      const dx = x - b.sx, dy = y - b.sy;
      if (dx * dx + dy * dy <= b.sr * b.sr * 1.21) { hb = b; break; }
    }
    if (hb !== hovBub) hovBub = hb;
    const st = pick(Math.round(x), Math.round(y));
    if (st && !hovState && dim < 0.01) { bxE = x; byE = y; } // fresh hover: blob starts at the cursor
    if (st !== hovState) hovState = st;
    wake();
  });
  cv.addEventListener('pointerleave', () => { hovState = null; hovBub = null; mx = -1; my = -1; wake(); });

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

  window.colmezMap = { set, zoom: (z) => { PAT_ZOOM = z; } };
})();
