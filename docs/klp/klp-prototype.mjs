// Claude prototype (2026-10-22): proves the KLP-style geometry with manifold-3d. Reference only — NOT app code.
// Run: node docs/klp/klp-prototype.mjs  (prints status/volume/timing for 6 variants)
import Module from '../../vendor/manifold/manifold.js';
const w = await Module(); w.setup(); const { Manifold, Mesh } = w;
// --- sculpt functions (top-local, z<=0 is below rim plane) ---
const Gx = (x, ax) => { const s = Math.min(1, Math.abs(x) / ax); return Math.pow(Math.max(0, 1 - Math.pow(s, 2.5)), 1.3); };
const Gy = (y, ay) => { const s = Math.min(1, Math.abs(y) / ay); return Math.pow(Math.max(0, 1 - Math.pow(s, 1.7)), 1.2); };
function sculptZ(type, a, b, rim, D, drop, x, y) {
  const ax = a - rim, ay = b - rim;
  const thumbSide = (type === 'thumb' && y < 0) || type === 'saddle';
  if (thumbSide) return -D * Gx(x, ax) - drop * Math.pow(Math.abs(y) / b, 2.77);
  return -D * Gx(x, ax) * Gy(y, ay);
}
// heightfield cutter: solid between z=s(x,y)+lift and z=top, over [-X,X]x[-Y,Y]
function cutter(f, X, Y, n, top = 30, lift = 0.02) {
  const N = n, M = n, v = [], t = [];
  const id = (i, j, k) => k * (N + 1) * (M + 1) + j * (N + 1) + i;
  for (const k of [0, 1]) for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) {
    const x = -X + 2 * X * i / N, y = -Y + 2 * Y * j / M;
    v.push(x, y, k === 0 ? Math.min(f(x, y), 0) + lift : top);
  }
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const a = id(i, j, 0), b = id(i + 1, j, 0), c = id(i + 1, j + 1, 0), d = id(i, j + 1, 0);
    t.push(a, c, b, a, d, c);                     // bottom surface faces down
    const A = id(i, j, 1), B = id(i + 1, j, 1), C = id(i + 1, j + 1, 1), Dd = id(i, j + 1, 1);
    t.push(A, B, C, A, C, Dd);                    // lid faces up
  }
  const side = (p, q) => { const P = id(...p, 0), Q = id(...q, 0), P1 = id(...p, 1), Q1 = id(...q, 1); t.push(P, Q, Q1, P, Q1, P1); };
  for (let i = 0; i < N; i++) { side([i, 0], [i + 1, 0]); side([i + 1, M], [i, M]); }
  for (let j = 0; j < M; j++) { side([N, j], [N, j + 1]); side([0, j + 1], [0, j]); }
  const mesh = new Mesh({ numProp: 3, vertProperties: new Float32Array(v), triVerts: new Uint32Array(t) });
  mesh.merge(); return new Manifold(mesh);
}
// rounded skirt hull: rings bottom(z0)->straight->arc->top
function rr(x0, x1, y0, y1, r, seg) { const pts = [], cs = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= seg; i++) { const a = (a0 + 90 * i / seg) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return pts; }
function body({ W, D, ins, H, tilt, rB, rT, straight, R, seg = 8, rings = 8, zb = 0 }) {
  const bot = rr(-W / 2, W / 2, -D / 2, D / 2, rB, seg), tw = W - 2 * ins, td = D - 2 * ins;
  const top = rr(-tw / 2, tw / 2, -td / 2, td / 2, rT, seg);
  const c = Math.cos(tilt * Math.PI / 180), s = Math.sin(tilt * Math.PI / 180);
  const topW = top.map(([x, y]) => [x, y * c, H + y * s]);
  const pts = []; for (const [x, y] of bot) { pts.push([x, y, zb]); pts.push([x, y, straight]); }
  for (let k = 1; k <= rings; k++) { const t = k / rings;
    for (let i = 0; i < bot.length; i++) { const [bx, by] = bot[i], [tx, ty, tz] = topW[i];
      const z = straight + (tz - straight) * t, dz = (tz - straight); const Rr = Math.max(R, dz + 1e-3);
      const f = (Rr - Math.sqrt(Rr * Rr - (t * dz) ** 2)) / (Rr - Math.sqrt(Rr * Rr - dz * dz));
      pts.push([bx + (tx - bx) * f, by + (ty - by) * f, z]); } }
  return Manifold.hull(pts);
}
const cfg = { W: 17.5, D: 16.5, ins: 1.44, rB: 4.3, rT: 3.2, straight: 1.5, R: 6.7 };
for (const type of ['normal', 'thumb', 'saddle']) for (const tilt of [0, 15]) {
  const t0 = performance.now(); const H = tilt ? 7.4 : 5.65, n = 48;
  const a = (cfg.W - 2 * cfg.ins) / 2, b = (cfg.D - 2 * cfg.ins) / 2;
  const outer0 = body({ ...cfg, H, tilt });
  const cutO = cutter((x, y) => sculptZ(type, a, b, 0.86, 0.85, 0.85, x, y), 15, 15, n).rotate([tilt, 0, 0]).translate([0, 0, H]);
  const outer = outer0.subtract(cutO);
  const wall = 0.9, tt = 1.5;
  const inner0 = body({ ...cfg, W: cfg.W - 2 * wall, D: cfg.D - 2 * wall, H: H - tt, tilt, rB: 3.4, rT: 2.3, zb: -1 });
  const cutI = cutter((x, y) => sculptZ(type, a - wall, b - wall, 0.86, 0.85, 0.85, x, y), 15, 15, n).rotate([tilt, 0, 0]).translate([0, 0, H - tt]);
  const inner = inner0.subtract(cutI);
  let shell = outer.subtract(inner);
  // choc prongs: 1.2 x 3.0 at x=±2.85, from z=-0.5 up into the ceiling, clipped to outer
  const prong = (x) => Manifold.cube([1.2, 3.0, 10], true).translate([x, 0, -0.5 + 5]);
  const prongs = prong(2.85).add(prong(-2.85)).intersect(outer.add(Manifold.cube([20, 20, 0.5], true).translate([0, 0, -0.25])));
  const cap = shell.add(prongs);
  const bb = cap.boundingBox();
  console.log(type.padEnd(6), 'tilt', String(tilt).padStart(2), cap.status(), 'genus', cap.genus(), 'vol', cap.volume().toFixed(0), 'tris', cap.numTri(),
    'z', bb.min[2].toFixed(2), bb.max[2].toFixed(2), (performance.now() - t0).toFixed(0) + 'ms');
}
