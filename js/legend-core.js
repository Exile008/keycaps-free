// Environment-independent text outlines and legend booleans. All inputs borrowed.
import { parse } from '../vendor/opentype/opentype.mjs';

export const BUNDLED_FONTS = Object.freeze(Object.fromEntries([
  ['inter-bold', 'Inter Bold'], ['jetbrains-mono-bold', 'JetBrains Mono Bold'],
  ['orbitron-bold', 'Orbitron Bold'], ['bebas-neue', 'Bebas Neue'],
].map(([id, name]) => [id, { url: `./fonts/${id}.ttf`, name }])));

export function loadFont(buffer) {
  const data = ArrayBuffer.isView(buffer)
    ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer;
  return parse(data);
}

function area(poly) {
  return poly.reduce((a, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
}

// Distance to the finite chord, not its infinite line (also handles cusps).
function distance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function flatten(points, tolerance, out, depth = 0) {
  const a = points[0], b = points[points.length - 1];
  if (depth >= 20 || points.slice(1, -1).every(p => distance(p, a, b) <= tolerance)) {
    out.push(b); return;
  }
  let level = points;
  const left = [a], right = [b];
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => midpoint(level[i], p));
    left.push(level[0]); right.unshift(level[level.length - 1]);
  }
  flatten(left, tolerance, out, depth + 1);
  flatten(right, tolerance, out, depth + 1);
}

export function textToContours(font, text, { tolerance = 0.05 } = {}) {
  const warnings = [];
  if ([...text].some(c => !/\s/u.test(c) && font.charToGlyphIndex(c) === 0)) warnings.push('warn.glyphMissing');
  let commands;
  try { commands = font.getPath(text, 0, 0, 100).commands; }
  catch (error) {
    // opentype 2.0 cannot shape Inter's contextual GSUB type 6/format 2.
    // Only that documented library failure falls back to direct cmap glyphs.
    if (!/substitutionType.*not yet supported/.test(error.message)) throw error;
    commands = [];
    let x = 0, previous = null;
    for (const char of text) {
      const glyph = font.charToGlyph(char);
      if (previous) x += font.getKerningValue(previous, glyph) * 100 / font.unitsPerEm;
      commands.push(...glyph.getPath(x, 0, 100, {}, font).commands);
      x += (glyph.advanceWidth || 0) * 100 / font.unitsPerEm;
      previous = glyph;
    }
  }
  const coords = commands.flatMap(c => [c.x, c.y, c.x1, c.y1, c.x2, c.y2].filter(Number.isFinite));
  // Cap flattening error at .02 mm after fitting even very small source glyphs.
  const extent = coords.length ? Math.max(...coords) - Math.min(...coords) : 0;
  const tol = Math.max(1e-6, Math.min(tolerance, extent * 0.02 / 8));
  const polygons = [];
  let poly = [], current = [0, 0];
  const finish = () => {
    if (poly.length > 1 && poly[0][0] === poly.at(-1)[0] && poly[0][1] === poly.at(-1)[1]) poly.pop();
    if (poly.length >= 3 && Math.abs(area(poly)) > 1e-10) polygons.push(poly.map(([x, y]) => [x, -y]));
    poly = [];
  };
  for (const c of commands) {
    const end = [c.x, c.y];
    if (c.type === 'M') { finish(); poly.push(end); }
    else if (c.type === 'L') poly.push(end);
    else if (c.type === 'Q') flatten([current, [c.x1, c.y1], end], tol, poly);
    else if (c.type === 'C') flatten([current, [c.x1, c.y1], [c.x2, c.y2], end], tol, poly);
    else if (c.type === 'Z') { finish(); continue; }
    current = end;
  }
  finish();
  if (!polygons.length) warnings.push('warn.legendEmpty');
  // Polygons remains an Array per SPEC; metadata is non-enumerable for serialization.
  Object.defineProperty(polygons, 'warnings', { value: warnings });
  return polygons;
}

const warningMap = new WeakMap();
export function contoursToCrossSection(wasm, polygons, fillRule = 'NonZero') {
  const usable = polygons.filter(p => p.length >= 3 && Math.abs(area(p)) > 1e-10);
  // The vendored JS binding reads contours[0].length even for an empty set.
  const cs = usable.length ? new wasm.CrossSection(usable, fillRule) : wasm.CrossSection.square([0, 0]);
  warningMap.set(cs, polygons.warnings || []);
  return cs;
}

export function fitLegend(cs, { size = 8, rot = 0, x = 0, y = 0, mirror = false } = {}) {
  const b = cs.bounds();
  const span = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
  if (!(span > 0) || !Number.isFinite(span)) {
    const result = cs.translate([0, 0]);
    warningMap.set(result, warningMap.get(cs) || []);
    return result;
  }
  const centered = cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]);
  const scaled = centered.scale([size / span * (mirror ? -1 : 1), size / span]);
  const rotated = scaled.rotate(rot);
  const result = rotated.translate([x, y]);
  centered.delete(); scaled.delete(); rotated.delete();
  warningMap.set(result, warningMap.get(cs) || []);
  return result;
}

export function applyLegend(wasm, parts, legendCS, p) {
  const warnings = [...(warningMap.get(legendCS) || [])];
  const warn = key => { if (!warnings.includes(key)) warnings.push(key); };
  const finish = (cap, legend) => {
    for (const w of warnings) if (!parts.layout.warnings.includes(w)) parts.layout.warnings.push(w);
    return { cap, legend, warnings };
  };
  if (legendCS.isEmpty()) {
    warn('warn.legendEmpty');
    return finish(parts.capBody, null);
  }
  const b = legendCS.bounds(), top = parts.layout.top;
  if (b.min[0] < -top.w / 2 || b.max[0] > top.w / 2 || b.min[1] < -top.d / 2 || b.max[1] > top.d / 2) warn('warn.legendOverflow');
  const temps = [];
  const keep = m => { temps.push(m); return m; };
  try {
    const prism = keep(keep(keep(legendCS.extrude(40)).translate([0, 0, -20])).transform(parts.layout.frame.mat4));
    const shift = d => keep(parts.outer.translate(parts.layout.frame.normal.map(v => v * d)));
    // With a separate stem part the cap body already excludes the stems and
    // their flare; the legend must not duplicate that volume either.
    const separate = !!(p.stemSeparate && parts.stemPart);
    let cap, legend = null;
    if (p.legendMode === 'raised') {
      const layer = keep(shift(p.legendDepth).subtract(shift(-0.05)));
      legend = keep(prism.intersect(layer));
      if (separate) legend = keep(legend.subtract(parts.stemPart));
      cap = parts.capBody;
    } else {
      const depth = p.legendMode === 'shine' ? p.topThickness + p.dishDepth + 0.5 : p.legendDepth;
      const layer = keep(parts.outer.subtract(shift(-depth)));
      const cut = keep(prism.intersect(layer));
      if (p.legendMode === 'shine') {
        cap = keep((separate ? parts.capBody : parts.shell).subtract(cut));
        if (separate) {
          legend = keep(cut.subtract(parts.stemPart));
        } else {
          legend = parts.stems ? keep(cut.add(parts.stems)) : cut;
          if (parts.flare) legend = keep(legend.add(parts.flare));
        }
      } else {
        cap = keep(parts.capBody.subtract(cut));
        if (p.legendMode !== 'recessed') legend = separate ? keep(cut.subtract(parts.stemPart)) : cut;
      }
    }
    const result = finish(cap, legend);
    temps.splice(0).forEach(m => { if (m !== cap && m !== legend) m.delete(); });
    return result;
  } finally {
    temps.forEach(m => m.delete());
  }
}
