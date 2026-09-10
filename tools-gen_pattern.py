"""Generate a vector pattern (contours + yellow blocks + noise) from the hero photo.
Output: pattern.svg (viewBox 1496x820) + seeds.json (dissolve seed points, normalized).
Only numpy + PIL. Marching squares implemented by hand.
"""
import json, math, random, sys
import numpy as np
from PIL import Image, ImageFilter

SRC, OUT_SVG, OUT_JSON = sys.argv[1], sys.argv[2], sys.argv[3]
VW, VH = 1496, 820
W = 748                      # working raster width (scale x2 to viewBox)
GOLD = "#ae9a29"
random.seed(7); np.random.seed(7)

img = Image.open(SRC).convert("RGB")
H = round(W * img.height / img.width)
img = img.resize((W, H), Image.LANCZOS)
S = VW / W  # raster -> viewBox scale

# ---------- fields ----------
lum = np.asarray(img.convert("L").filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32) / 255.0
lum_soft = np.asarray(img.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255.0
lum_mid = np.asarray(img.convert("L").filter(ImageFilter.GaussianBlur(3.5)), dtype=np.float32) / 255.0

hsv = np.asarray(img.filter(ImageFilter.GaussianBlur(1.2)).convert("HSV"), dtype=np.float32)
hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
yellow = ((hue > 30) & (hue < 70) & (sat > 0.42) & (val > 0.30)).astype(np.float32)
yellow = np.asarray(Image.fromarray((yellow * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), dtype=np.float32) / 255

gy, gx = np.gradient(lum)
edge = np.hypot(gx, gy)
edge = edge / (edge.max() + 1e-6)

# ---------- marching squares ----------
def marching_squares(f, level):
    """Return list of polylines (list of (x,y)) for iso-level of scalar field f."""
    b = f >= level
    h, w = f.shape
    # corners: tl, tr, br, bl
    tl, tr = b[:-1, :-1], b[:-1, 1:]
    bl, br = b[1:, :-1], b[1:, 1:]
    idx = tl.astype(np.uint8) * 8 + tr * 4 + br * 2 + bl * 1
    ys, xs = np.nonzero((idx != 0) & (idx != 15))
    segs = []
    def interp(x0, y0, v0, x1, y1, v1):
        t = (level - v0) / (v1 - v0) if v1 != v0 else 0.5
        return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
    for y, x in zip(ys, xs):
        c = idx[y, x]
        v_tl, v_tr, v_br, v_bl = f[y, x], f[y, x + 1], f[y + 1, x + 1], f[y + 1, x]
        top = lambda: interp(x, y, v_tl, x + 1, y, v_tr)
        right = lambda: interp(x + 1, y, v_tr, x + 1, y + 1, v_br)
        bottom = lambda: interp(x, y + 1, v_bl, x + 1, y + 1, v_br)
        left = lambda: interp(x, y, v_tl, x, y + 1, v_bl)
        # segment table (edges between which the contour passes)
        table = {
            1: [(left, bottom)], 2: [(bottom, right)], 3: [(left, right)], 4: [(top, right)],
            5: [(left, top), (bottom, right)], 6: [(top, bottom)], 7: [(left, top)],
            8: [(left, top)], 9: [(top, bottom)], 10: [(left, bottom), (top, right)],
            11: [(top, right)], 12: [(left, right)], 13: [(bottom, right)], 14: [(left, bottom)],
        }
        for a, bfn in table[c]:
            segs.append((a(), bfn()))
    # link segments into polylines
    key = lambda p: (round(p[0] * 4), round(p[1] * 4))
    adj = {}
    for i, (p, q) in enumerate(segs):
        adj.setdefault(key(p), []).append(i)
        adj.setdefault(key(q), []).append(i)
    used = [False] * len(segs)
    lines = []
    for i in range(len(segs)):
        if used[i]:
            continue
        used[i] = True
        p, q = segs[i]
        line = [p, q]
        # extend forward
        for direction in (1, -1):
            end = line[-1] if direction == 1 else line[0]
            while True:
                nxt = None
                for j in adj.get(key(end), []):
                    if not used[j]:
                        nxt = j
                        break
                if nxt is None:
                    break
                used[nxt] = True
                a, bq = segs[nxt]
                other = bq if key(a) == key(end) else a
                if direction == 1:
                    line.append(other)
                else:
                    line.insert(0, other)
                end = other
        lines.append(line)
    return lines

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a
    n = np.linalg.norm(ab)
    P = np.array(pts)
    if n == 0:
        d = np.linalg.norm(P - a, axis=1)
    else:
        d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        return rdp(pts[: i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]

def chaikin(pts, closed=False):
    if len(pts) < 3:
        return pts
    out = []
    n = len(pts)
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p, q = pts[i], pts[(i + 1) % n]
        out.append((0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]))
        out.append((0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]))
    if not closed:
        out = [pts[0]] + out + [pts[-1]]
    return out

def length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

def fmt(v):
    return f"{v:.1f}"

def path_d(pts, closed=False):
    d = "M" + " L".join(f"{fmt(x * S)} {fmt(y * S)}" for x, y in pts)
    return d + (" Z" if closed else "")

# ---------- yellow blocks (fills) + seeds ----------
fills = []
blobs = []
for line in marching_squares(yellow, 0.5):
    closed = math.dist(line[0], line[-1]) < 2
    pts = rdp(line, 1.4)
    if len(pts) < 4:
        continue
    xs, ys = zip(*pts)
    area = abs(sum(xs[i] * ys[(i + 1) % len(pts)] - xs[(i + 1) % len(pts)] * ys[i] for i in range(len(pts)))) / 2
    if area < 30:
        continue
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    blobs.append((area, cx / W, cy / H))
    fills.append((area, path_d(pts, closed=True), cx / W, cy / H))
blobs.sort(reverse=True)
seeds = [(round(float(x), 4), round(float(y), 4)) for _, x, y in blobs[:5]]
if len(seeds) < 5:
    seeds += [(random.random(), random.random()) for _ in range(5 - len(seeds))]

def order(cx, cy):
    # 0..1: distance to nearest seed (in aspect-corrected space), normalized
    d = min(math.hypot((cx - sx) * (VW / VH), cy - sy) for sx, sy in seeds)
    return min(1.0, d / 1.1)

# ---------- contours ----------
contours = []
levels = [float(v) for v in np.percentile(lum_soft, np.linspace(8, 92, 12))]
for li, lv in enumerate(levels):
    field = lum_mid if li % 3 == 1 else lum_soft
    for line in marching_squares(field, lv):
        if length(line) < 70:
            continue
        pts = chaikin(rdp(line, 0.9))
        xs, ys = zip(*pts)
        cx, cy = sum(xs) / len(xs) / W, sum(ys) / len(ys) / H
        L = length(pts) * S
        contours.append((path_d(pts), order(cx, cy), L, li))

# thin out very short ones, cap count
contours.sort(key=lambda c: -c[2])
contours = contours[:420]

# ---------- noise (small squares), weighted by edge strength ----------
prob = 0.10 + 1.6 * edge
prob = prob / prob.sum()
flat = np.random.choice(prob.size, size=2600, replace=False, p=prob.ravel())
ny, nx = np.divmod(flat, W)
groups = [[] for _ in range(12)]
for x, y in zip(nx, ny):
    jx, jy = x + random.random(), y + random.random()
    s = random.choice([1.2, 1.6, 2.0, 2.6, 3.4]) if random.random() < 0.85 else random.choice([4.5, 6.0])
    g = min(11, int(order(jx / W, jy / H) * 12 * (0.7 + 0.6 * random.random())))
    groups[g].append(f"M{fmt(jx * S)} {fmt(jy * S)}h{fmt(s)}v{fmt(s)}h-{fmt(s)}z")

# ---------- write SVG ----------
out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMid slice" class="pattern">']
out.append(f'<rect width="{VW}" height="{VH}" fill="#121212"/>')
out.append('<g class="pattern__noise" fill="#ae9a29">')
for gi, g in enumerate(groups):
    out.append(f'<path data-o="{gi / 11:.3f}" d="{"".join(g)}"/>')
out.append('</g>')
out.append('<g class="pattern__fills" fill="#ae9a29">')
for area, d, cx, cy in fills:
    out.append(f'<path data-o="{order(cx, cy):.3f}" d="{d}"/>')
out.append('</g>')
out.append('<g class="pattern__lines" fill="none" stroke="#ae9a29" stroke-linecap="round" stroke-linejoin="round">')
for d, o, L, li in contours:
    sw = 1.5 if li % 3 == 1 else 1.0
    out.append(f'<path pathLength="1" data-o="{o:.3f}" stroke-width="{sw}" d="{d}"/>')
out.append('</g></svg>')
svg = "\n".join(out)
open(OUT_SVG, "w").write(svg)
json.dump({"seeds": seeds}, open(OUT_JSON, "w"))
print(f"contours={len(contours)} fills={len(fills)} noise={sum(len(g) for g in groups)} seeds={seeds} bytes={len(svg)}")
