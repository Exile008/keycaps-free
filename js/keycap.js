// Parametric keycap geometry — pure module (no DOM). See docs/SPEC.md §5.
//
// Coordinate system: origin = switch centre on the bottom plane.
//   +X = right, +Y = back, +Z = up.

import { normalizeParams, DEFAULT_PARAMS } from './params.js';

export const QUALITY = {
  preview: { cornerSeg: 6, circleSeg: 48, dishSeg: 128 },
  export: { cornerSeg: 12, circleSeg: 96, dishSeg: 360 },
};

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// small math helpers
// ---------------------------------------------------------------------------

function mul3(A, B) {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return C;
}

function applyR(R, v) {
  return [
    R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
    R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
    R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
  ];
}

function mat4Of(R, o) {
  return [
    R[0][0], R[1][0], R[2][0], 0,
    R[0][1], R[1][1], R[2][1], 0,
    R[0][2], R[1][2], R[2][2], 0,
    o[0], o[1], o[2], 1,
  ];
}

// R = Rx(tiltX) · Ry(-tiltY), applied as world = R·local.
export function makeRotation(tiltX, tiltY) {
  const a = tiltX * DEG;
  const b = -tiltY * DEG;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const Rx = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]];
  const Ry = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]];
  return mul3(Rx, Ry);
}

function frameFromTop(tx0, tx1, ty0, ty1, height, tiltX, tiltY) {
  const cx = (tx0 + tx1) / 2;
  const cy = (ty0 + ty1) / 2;
  const R = makeRotation(tiltX, tiltY);
  const origin = [cx, cy, height];
  const normal = applyR(R, [0, 0, 1]);
  return { origin, R, normal, mat4: mat4Of(R, origin) };
}

// ---------------------------------------------------------------------------
// §5.1 layout
// ---------------------------------------------------------------------------

export function computeLayout(input) {
  const { params: p, warnings } = normalizeParams(input);
  const W = p.unitW * p.pitch - p.gap;
  const D = p.unitD * p.pitch - p.gap;

  const x0 = -W / 2 - p.extL;
  const x1 = W / 2 + p.extR;
  const y0 = -D / 2 - p.extF;
  const y1 = D / 2 + p.extB;

  const tx0 = x0 + p.insetL;
  const tx1 = x1 - p.insetR;
  const ty0 = y0 + p.insetF;
  const ty1 = y1 - p.insetB;

  const tw = tx1 - tx0;
  const td = ty1 - ty0;
  const tcx = (tx0 + tx1) / 2;
  const tcy = (ty0 + ty1) / 2;

  const frame = frameFromTop(tx0, tx1, ty0, ty1, p.height, p.tiltX, p.tiltY);

  const rBot = Math.max(0, Math.min(p.rBottom, Math.min(x1 - x0, y1 - y0) / 2));
  const rTop = Math.max(0, Math.min(p.rTop, Math.min(tw, td) / 2));

  let r = 0;
  let depth = p.dishDepth;
  if (p.dishType === 'cylindrical') {
    r = (tw * tw + 4 * depth * depth) / (8 * depth || 1);
  } else if (p.dishType === 'spherical') {
    const c = Math.hypot(tw, td);
    r = (c * c + 4 * depth * depth) / (8 * depth || 1);
  }
  if (p.dishType === 'flat' || depth < 0.05) depth = 0;

  return {
    params: p,
    bottom: { x0, x1, y0, y1, w: x1 - x0, d: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 },
    top: { w: tw, d: td, cx: tcx, cy: tcy },
    frame,
    stems: stemPositions(p.unitW, p.unitD, p.stabilizers),
    dish: { type: p.dishType, r, depth },
    r: { rBottom: rBot, rTop },
    warnings,
  };
}

export function toWorld(layout, local) {
  return applyR(layout.frame.R, local).map((v, i) => v + layout.frame.origin[i]);
}

export function dishSurfaceZ(layout, x, y) {
  const d = layout.dish;
  if (d.type === 'flat' || d.depth < 0.05 || d.r <= 0) return 0;
  if (d.type === 'cylindrical') {
    const inside = d.r * d.r - x * x;
    if (inside <= 0) return 0;
    return (d.r - d.depth) - Math.sqrt(inside);
  }
  if (d.type === 'spherical') {
    const inside = d.r * d.r - x * x - y * y;
    if (inside <= 0) return 0;
    return (d.r - d.depth) - Math.sqrt(inside);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// §5.4 stem helper
// ---------------------------------------------------------------------------

function stabOffset(L) {
  if (L >= 2 && L < 3) return 11.938;
  if (L >= 3 && L < 6) return 19.05;
  const table = [[6, 47.625], [6.25, 50.0], [6.5, 52.385], [7, 57.15]];
  for (const [s, o] of table) if (L <= s + 1e-9) return o;
  return table[table.length - 1][1];
}

export function stemPositions(unitW, unitD, stabilizers) {
  const stems = [[0, 0]];
  if (stabilizers !== 'auto') return stems;
  const alongX = unitW >= unitD;
  const L = alongX ? unitW : unitD;
  if (L < 2) return stems;
  const off = stabOffset(L);
  if (alongX) stems.push([-off, 0], [off, 0]);
  else stems.push([0, -off], [0, off]);
  return stems;
}

// ---------------------------------------------------------------------------
// geometry building blocks
// ---------------------------------------------------------------------------

function roundedRect(x0, x1, y0, y1, r, seg) {
  const w = x1 - x0;
  const h = y1 - y0;
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const pts = [];
  const rad = (x1 - x0) / 2;
  void rad;
  const corners = [
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, Math.PI / 2],
    [x0 + r, y0 + r, Math.PI],
    [x1 - r, y0 + r, (3 * Math.PI) / 2],
  ];
  const n = Math.max(1, seg | 0);
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

function buildDish(wasm, p, q, tw, td) {
  const { Manifold } = wasm;
  const d = p.dishDepth;
  if (p.dishType === 'cylindrical') {
    const c = tw;
    const r = (c * c + 4 * d * d) / (8 * d || 1);
    return Manifold.cylinder(td + 40, r, r, q.dishSeg, true)
      .rotate([90, 0, 0])
      .translate([0, 0, r - d]);
  }
  if (p.dishType === 'spherical') {
    const c = Math.hypot(tw, td);
    const r = (c * c + 4 * d * d) / (8 * d || 1);
    return Manifold.sphere(r, q.dishSeg).translate([0, 0, r - d]);
  }
  return null;
}

// Generic hull body (used for outer and inner).
function buildHullBody(wasm, p, q, spec) {
  const { Manifold } = wasm;
  const { x0, x1, y0, y1, insetL, insetR, insetF, insetB, rBottom, rTop, height, frame, bottomDouble } = spec;
  const bottom = roundedRect(x0, x1, y0, y1, rBottom, q.cornerSeg);

  const tx0 = x0 + insetL, tx1 = x1 - insetR;
  const ty0 = y0 + insetF, ty1 = y1 - insetB;
  const tw = tx1 - tx0, td = ty1 - ty0;
  const localTop = roundedRect(-tw / 2, tw / 2, -td / 2, td / 2, rTop, q.cornerSeg);

  const pts = [];
  for (const [x, y] of bottom) pts.push([x, y, 0]);
  if (bottomDouble) for (const [x, y] of bottom) pts.push([x, y, -1]);
  for (const [x, y] of localTop) {
    const w = applyR(frame.R, [x, y, 0]);
    pts.push([w[0] + frame.origin[0], w[1] + frame.origin[1], w[2] + frame.origin[2]]);
  }

  let body = Manifold.hull(pts);
  void height;

  if (p.dishType !== 'flat' && p.dishDepth >= 0.05) {
    const dish = buildDish(wasm, p, q, tw, td);
    if (dish) {
      const place = dish.transform(frame.mat4);
      dish.delete();
      const cut = body.subtract(place);
      place.delete();
      body.delete();
      body = cut;
    }
  }
  return body;
}

function buildOuter(wasm, p, q, layout) {
  const b = layout.bottom;
  return buildHullBody(wasm, p, q, {
    x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1,
    insetL: p.insetL, insetR: p.insetR, insetF: p.insetF, insetB: p.insetB,
    rBottom: layout.r.rBottom, rTop: layout.r.rTop,
    height: p.height, frame: layout.frame, bottomDouble: false,
  });
}

function buildInner(wasm, p, q, layout) {
  const b = layout.bottom;
  const x0 = b.x0 + p.wall, x1 = b.x1 - p.wall;
  const y0 = b.y0 + p.wall, y1 = b.y1 - p.wall;
  const h = p.height - p.topThickness;
  const tx0 = x0 + p.insetL, tx1 = x1 - p.insetR;
  const ty0 = y0 + p.insetF, ty1 = y1 - p.insetB;
  const frame = frameFromTop(tx0, tx1, ty0, ty1, h, p.tiltX, p.tiltY);
  return buildHullBody(wasm, p, q, {
    x0, x1, y0, y1,
    insetL: p.insetL, insetR: p.insetR, insetF: p.insetF, insetB: p.insetB,
    rBottom: Math.max(0.1, layout.r.rBottom - p.wall / 2),
    rTop: Math.max(0.3, layout.r.rTop - p.wall / 2),
    height: h, frame, bottomDouble: true,
  });
}

// Inner top surface description, used by the stem fillet and ribs. Mirrors
// buildInner's inner hull (same insets, tilt, dish) without rebuilding it.
function innerTopGeometry(p, layout) {
  const b = layout.bottom;
  const x0 = b.x0 + p.wall, x1 = b.x1 - p.wall;
  const y0 = b.y0 + p.wall, y1 = b.y1 - p.wall;
  const h = p.height - p.topThickness;
  const tx0 = x0 + p.insetL, tx1 = x1 - p.insetR;
  const ty0 = y0 + p.insetF, ty1 = y1 - p.insetB;
  const frame = frameFromTop(tx0, tx1, ty0, ty1, h, p.tiltX, p.tiltY);
  const tw = tx1 - tx0, td = ty1 - ty0;
  let r = 0;
  let depth = p.dishDepth;
  if (p.dishType === 'cylindrical') {
    r = (tw * tw + 4 * depth * depth) / (8 * depth || 1);
  } else if (p.dishType === 'spherical') {
    const c = Math.hypot(tw, td);
    r = (c * c + 4 * depth * depth) / (8 * depth || 1);
  }
  if (p.dishType === 'flat' || depth < 0.05) depth = 0;
  return { frame, tw, td, dish: { type: p.dishType, r, depth } };
}

// World Z of the (tilted, dished) inner top surface above world (x, y).
function innerTopZAt(g, x, y) {
  const { origin, R } = g.frame;
  const dz = R[2][2];
  if (Math.abs(dz) < 1e-6) return origin[2];
  const planeZ = origin[2] - (R[0][2] * (x - origin[0]) + R[1][2] * (y - origin[1])) / dz;
  const lx = R[0][0] * (x - origin[0]) + R[1][0] * (y - origin[1]) + R[2][0] * (planeZ - origin[2]);
  const ly = R[0][1] * (x - origin[0]) + R[1][1] * (y - origin[1]) + R[2][1] * (planeZ - origin[2]);
  const d = g.dish;
  let lz = 0;
  if (d.depth >= 0.05 && d.r > 0) {
    if (d.type === 'cylindrical') {
      const inside = d.r * d.r - lx * lx;
      if (inside > 0) lz = (d.r - d.depth) - Math.sqrt(inside);
    } else if (d.type === 'spherical') {
      const inside = d.r * d.r - lx * lx - ly * ly;
      if (inside > 0) lz = (d.r - d.depth) - Math.sqrt(inside);
    }
  }
  return planeZ + lz * dz;
}

// Z span of the inner top surface (tilt + dish), used to bound rib slabs.
function innerTopZRange(g) {
  const { origin, R } = g.frame;
  const hw = g.tw / 2, hd = g.td / 2;
  let min = Infinity, max = -Infinity;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const z = origin[2] + R[0][2] * sx * hw + R[1][2] * sy * hd;
      min = Math.min(min, z);
      max = Math.max(max, z);
    }
  }
  if (g.dish.depth > 0) min = Math.min(min, origin[2] - g.dish.depth * R[2][2]);
  return { min, max };
}

// Cylinders (full solids) and their cross-hole cutters. The cylinders are
// intersected with the outer body so their tops follow the dish/tilt; the
// cross-hole cut is applied separately so it can also clear flares and ribs.
function buildStems(wasm, p, q, layout, outer) {
  const { Manifold } = wasm;
  if (p.stemType === 'none') return { stems: null, stemSolid: null, crossCut: null };
  const tol = p.stemTolerance;
  const depth = p.stemCrossDepth + 1;
  const zc = p.stemZ - 1 + depth / 2;
  const cylParts = [];
  const cutParts = [];
  for (const [sx, sy] of layout.stems) {
    const segLen = p.height + 5 - p.stemZ;
    cylParts.push(Manifold.cylinder(segLen, p.stemOuterD / 2, p.stemOuterD / 2, q.circleSeg, true)
      .translate([sx, sy, p.stemZ + segLen / 2]));
    cutParts.push(Manifold.cube([p.stemCrossLen, p.stemCrossV + tol, depth], true)
      .translate([sx, sy, zc]));
    cutParts.push(Manifold.cube([p.stemCrossH + tol, p.stemCrossLen, depth], true)
      .translate([sx, sy, zc]));
  }
  let cylAll = cylParts.length === 1 ? cylParts[0] : Manifold.union(cylParts);
  if (cylParts.length > 1) for (const s of cylParts) s.delete();
  const stemSolid = cylAll.intersect(outer);
  cylAll.delete();
  let crossCut = cutParts.length === 1 ? cutParts[0] : Manifold.union(cutParts);
  if (cutParts.length > 1) for (const s of cutParts) s.delete();
  const stems = stemSolid.subtract(crossCut);
  return { stems, stemSolid, crossCut };
}

// Concave fillet flare around each stem, revolved from a quarter-circle
// profile (r0 at junction-f, r0+f at the junction), then clipped to the inner
// cavity so it merges into the tilted/dished inner top without poking through.
function buildFlares(wasm, p, q, layout, inner, crossCut) {
  const { Manifold, CrossSection } = wasm;
  const f = p.stemFillet;
  if (p.stemType === 'none' || !(f > 1e-4)) return null;
  const g = innerTopGeometry(p, layout);
  const r0 = p.stemOuterD / 2;
  const filletSeg = Math.max(3, Math.round(q.cornerSeg * 1.5));
  const topZ = p.height + 5;
  const parts = [];
  for (const [sx, sy] of layout.stems) {
    const zj = innerTopZAt(g, sx, sy);
    const fe = Math.min(f, zj - p.stemZ);
    if (!(fe > 1e-3) || !(topZ > zj)) continue;
    const z0 = zj - fe;
    const r1 = r0 + f;
    const pts = [[0, z0], [r0, z0]];
    // Quarter circle centred at (r1, z0): tangent to the stem wall at z0 and
    // tangent to the top surface at zj. Vertical radius fe is clamped to the
    // available space above the stem bottom.
    for (let i = 1; i <= filletSeg; i++) {
      const a = (i / filletSeg) * (Math.PI / 2);
      pts.push([r1 - f * Math.cos(a), z0 + fe * Math.sin(a)]);
    }
    pts.push([r1, topZ], [0, topZ]);
    const cs = new CrossSection([pts], 'NonZero');
    const rev = cs.revolve(q.circleSeg);
    cs.delete();
    parts.push(rev.translate([sx, sy, 0]));
    rev.delete();
  }
  if (!parts.length) return null;
  let all = parts.length === 1 ? parts[0] : Manifold.union(parts);
  if (parts.length > 1) for (const s of parts) s.delete();
  // Clip to the inner cavity plus a 0.05 mm upward overlap so the subsequent
  // union with the shell is volumetric (topThickness >= 0.8 leaves ample
  // margin, so this can never reach the outer surface).
  const clipVolume = inner.translate([0, 0, 0.05]);
  const clipped = all.intersect(clipVolume);
  clipVolume.delete();
  all.delete();
  if (!crossCut) return clipped;
  const result = clipped.subtract(crossCut);
  clipped.delete();
  return result;
}

// Ribs: a plus-shaped slab corridor intersected with the inner cavity and
// limited to the layer within ribHeight of the (tilted/dished) inner top.
// Trimming against the full stem cylinders keeps the cross holes clear.
function buildRibs(wasm, p, q, layout, inner, stemSolid) {
  if (p.stemRibs !== 'cross' || p.stemType === 'none' || !stemSolid) return null;
  const { Manifold } = wasm;
  const g = innerTopGeometry(p, layout);
  const range = innerTopZRange(g);
  const h = p.ribHeight;
  const main = layout.stems[0] || [0, 0];
  const zLow = Math.max(p.stemZ, range.min - h - 0.25);
  const zHigh = range.max + 0.25;
  if (!(zHigh > zLow + 0.05)) return null;
  const b = layout.bottom;
  const spanX = (b.x1 - b.x0) + 10;
  const spanY = (b.y1 - b.y0) + 10;
  const zc = (zLow + zHigh) / 2, zh = zHigh - zLow;
  const slabX = Manifold.cube([spanX, p.ribThickness, zh], true).translate([main[0], main[1], zc]);
  const slabY = Manifold.cube([p.ribThickness, spanY, zh], true).translate([main[0], main[1], zc]);
  const slabs = Manifold.union(slabX, slabY);
  slabX.delete();
  slabY.delete();
  // 0.05 mm upward overlap makes the union with the shell volumetric; the
  // lower cut is shifted with it so the rib still hangs exactly ribHeight.
  const clipVolume = inner.translate([0, 0, 0.05]);
  const corridor = slabs.intersect(clipVolume);
  clipVolume.delete();
  slabs.delete();
  const shifted = inner.translate([0, 0, 0.05 - h]);
  const layer = corridor.subtract(shifted);
  corridor.delete();
  shifted.delete();
  let rib = layer;
  {
    const trim = rib.subtract(stemSolid);
    rib.delete();
    rib = trim;
  }
  // Ribs are intentionally identical in joined and separate modes. In separate
  // mode `cap = joinedCap - stemPart` removes any rib portion that would
  // overlap the stem part, which keeps the volume identity exact.
  return rib;
}

function buildHomingBump(wasm, p, q, layout) {
  const { Manifold } = wasm;
  const td = layout.top.d;
  const lx = 0;
  const ly = -td / 2 + 3;
  const r = 0.5;
  const len = 5 - 2 * r;
  const sz = dishSurfaceZ(layout, lx, ly) - 0.15 + r;
  const cyl = Manifold.cylinder(len, r, r, q.circleSeg, true).rotate([0, 90, 0]);
  const s1 = Manifold.sphere(r, q.circleSeg).translate([len / 2, 0, 0]);
  const s2 = Manifold.sphere(r, q.circleSeg).translate([-len / 2, 0, 0]);
  const mid = cyl.add(s1).add(s2);
  cyl.delete();
  s1.delete();
  s2.delete();
  const bump = mid.translate([lx, ly, sz]).transform(layout.frame.mat4);
  mid.delete();
  return bump;
}

// ---------------------------------------------------------------------------
// §5.5 assembly
// ---------------------------------------------------------------------------

export function buildKeycap(wasm, input, opts = {}) {
  const quality = opts.quality === 'export' ? QUALITY.export : QUALITY.preview;
  const layout = computeLayout(input);
  const p = layout.params;
  const q = { ...quality, ...(opts.seg || {}) };

  const outer = buildOuter(wasm, p, q, layout);
  const inner = buildInner(wasm, p, q, layout);
  const shell = outer.subtract(inner);

  const stemParts = buildStems(wasm, p, q, layout, outer);
  const stems = stemParts.stems;
  const flare = buildFlares(wasm, p, q, layout, inner, stemParts.crossCut);
  const ribs = buildRibs(wasm, p, q, layout, inner, stemParts.stemSolid);

  // Joined body: the cap when the stem is not separate. Built identically in
  // both modes so the separate cap is an exact complement of the stem part.
  let joinedCap = shell.asOriginal();
  for (const extra of [stems, flare, ribs]) {
    if (!extra) continue;
    const next = joinedCap.add(extra);
    joinedCap.delete();
    joinedCap = next;
  }
  if (p.homingBump) {
    const bump = buildHomingBump(wasm, p, q, layout);
    const next = joinedCap.add(bump);
    bump.delete();
    joinedCap.delete();
    joinedCap = next;
  }
  // A cross hole deeper than the inner top would otherwise be blocked by the
  // shell plate. Cut it through the final cap as well (a no-op when the cross
  // stays inside the stem).
  if (stems && stemParts.crossCut) {
    const next = joinedCap.subtract(stemParts.crossCut);
    joinedCap.delete();
    joinedCap = next;
  }

  // The separate stem is clipped at the inner ceiling: it never enters the
  // shell/top plate, so the finished top face stays entirely cap-coloured and
  // unbroken. The cap keeps the former stem plug as part of its top plate.
  const separate = !!(p.stemSeparate && stems);
  let stemPart = null;
  let capBody = joinedCap;
  if (separate) {
    const stemUnion = flare ? stems.add(flare) : stems.asOriginal();
    stemPart = stemUnion.intersect(inner);
    stemUnion.delete();
    // Exact set complement: volume(cap) + volume(stemPart) = joined exactly.
    // (The boolean can leave zero-volume sliver shells; they are harmless and
    // must not be "repaired" here, as decompose/re-union perturbs the mesh.)
    capBody = joinedCap.subtract(stemPart);
    joinedCap.delete();
  }

  return {
    outer, inner, shell, stems,
    stemSolid: stemParts.stemSolid, crossCut: stemParts.crossCut,
    flare, ribs, stemPart, capBody, layout, quality: q,
  };
}

// ---------------------------------------------------------------------------
// §5.6 full model (legend delegated to legend-core.js / T2)
// ---------------------------------------------------------------------------

export async function buildModel(wasm, input, legendCS, opts = {}) {
  const now = (globalThis.performance && globalThis.performance.now)
    ? () => globalThis.performance.now()
    : () => Date.now();
  const t0 = now();

  const parts = buildKeycap(wasm, input, opts);
  const warnings = parts.layout.warnings.slice();
  let cap = parts.capBody;
  let legend = null;
  const stem = parts.stemPart || null;

  if (legendCS) {
    try {
      const mod = await import('./legend-core.js');
      const res = mod.applyLegend(wasm, parts, legendCS, parts.layout.params);
      if (res && res.cap) {
        if (cap && cap !== res.cap) {
          cap.delete();
          if (parts.capBody === cap) parts.capBody = null;
        }
        cap = res.cap;
        legend = res.legend || null;
      }
    } catch (e) {
      warnings.push('warn.legendUnavailable');
    }
  }

  // Release every intermediate that is not part of the returned model.
  const kept = new Set([cap, legend, stem]);
  for (const key of ['outer', 'inner', 'shell', 'stems', 'stemSolid', 'crossCut', 'flare', 'ribs', 'capBody']) {
    const m = parts[key];
    if (m && !kept.has(m)) {
      try { m.delete(); } catch (_) { /* already freed by a caller */ }
    }
  }

  const ms = now() - t0;
  const tris = (cap ? cap.numTri() : 0) + (legend ? legend.numTri() : 0) + (stem ? stem.numTri() : 0);
  return { cap, legend, stem, layout: parts.layout, warnings, stats: { ms, tris } };
}

export { DEFAULT_PARAMS };
