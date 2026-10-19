import { SVGLoader } from 'three/addons/SVGLoader.js';

const MODES = new Set(['fill', 'outline', 'cut', 'off']);
const signedArea = points => points.reduce((a, p, i) => {
  const q = points[(i + 1) % points.length];
  return a + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9;
const clampOpacity = value => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n / (String(value).endsWith('%') ? 100 : 1))) : 1;
};
function polygon(points, positive = true) {
  const poly = points.map(p => Array.isArray(p) ? [...p] : [p.x, -p.y]);
  if (poly.length > 1 && samePoint(poly[0], poly.at(-1))) poly.pop();
  const area = signedArea(poly);
  if (poly.length < 3 || Math.abs(area) < 1e-10) return null;
  if ((area > 0) !== positive) poly.reverse();
  return poly;
}
function bounds(points) {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
  }
  return b;
}
const unionBounds = parts => bounds(parts.flatMap(p => [[p.bbox.minX, p.bbox.minY], [p.bbox.maxX, p.bbox.maxY]]));

// SVGLoader r186 inherits opacity as a scalar instead of multiplying ancestor
// opacities, and does not read display/color. Resolve these before loading. The
// XML stays detached: importing an SVG must not execute it or load its resources.
function prepareSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('err.svgNoShapes');
  const properties = ['fill', 'stroke', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'fill-rule', 'color', 'opacity', 'display', 'visibility'];
  const rules = [];
  for (const node of root.querySelectorAll('style')) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(node.textContent);
    for (const rule of sheet.cssRules) {
      if (!rule.selectorText) continue;
      for (const selector of rule.selectorText.split(',')) {
        // SVG icon styles normally use class/id/type selectors; keep their
        // specificity and source order rather than treating classes as inline.
        const ids = (selector.match(/#[\w-]+/g) || []).length;
        const classes = (selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) || []).length;
        const types = (selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?/g, '').match(/[a-zA-Z][\w-]*/g) || []).length;
        rules.push({ selector: selector.trim(), style: rule.style, score: ids * 10000 + classes * 100 + types });
      }
    }
  }
  const styles = new Map();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  function paint(value, color) {
    if (!value || value === 'none' || value.startsWith('url(')) return { color: null, alpha: 0 };
    if (value.toLowerCase() === 'currentcolor') value = color;
    ctx.fillStyle = '#000000'; ctx.fillStyle = value;
    const normalized = ctx.fillStyle;
    if (normalized.startsWith('#')) return { color: normalized.slice(0, 7), alpha: normalized.length === 9 ? parseInt(normalized.slice(7), 16) / 255 : 1 };
    const numbers = normalized.match(/[\d.]+/g)?.map(Number);
    if (!numbers || numbers.length < 3) return { color: '#000000', alpha: 1 };
    return { color: '#' + numbers.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join(''), alpha: numbers[3] ?? 1 };
  }
  function visit(node, parent = {}) {
    const local = {};
    for (const property of properties) {
      let value = node.getAttribute(property), priority = -1;
      for (const rule of rules) {
        let matches = false;
        try { matches = node.matches(rule.selector); } catch { /* Unsupported selector. */ }
        const candidate = rule.style.getPropertyValue(property);
        const score = rule.score + (rule.style.getPropertyPriority(property) ? 1e8 : 0);
        if (matches && candidate && score >= priority) { value = candidate; priority = score; }
      }
      const inline = node.style?.getPropertyValue(property);
      if (inline && (priority < 1e8 || node.style.getPropertyPriority(property))) value = inline;
      if (value !== null && value !== undefined && value !== '') local[property] = value.trim();
    }
    const inherited = (name, fallback) => local[name] && !['inherit', 'unset'].includes(local[name]) ? local[name] : (parent[name] ?? fallback);
    const effective = {};
    for (const [name, fallback] of Object.entries({ fill: '#000000', stroke: 'none', 'fill-opacity': '1', 'stroke-opacity': '1', 'stroke-width': '1', 'fill-rule': 'nonzero', color: '#000000', visibility: 'visible' })) effective[name] = inherited(name, fallback);
    effective.localOpacity = local.opacity === 'inherit' ? (parent.localOpacity ?? 1) : clampOpacity(local.opacity ?? 1);
    effective.opacity = (parent.opacity ?? 1) * effective.localOpacity;
    effective.hidden = parent.hidden || local.display === 'none';
    const fill = paint(effective.fill, effective.color), stroke = paint(effective.stroke, effective.color);
    effective.fillColor = fill.alpha > 0 ? fill.color : null;
    effective.strokeColor = stroke.alpha > 0 ? stroke.color : null;
    effective.fillOpacity = clampOpacity(effective['fill-opacity']) * fill.alpha;
    effective.strokeOpacity = clampOpacity(effective['stroke-opacity']) * stroke.alpha;
    styles.set(node, effective);
    for (const child of node.children) visit(child, effective);
  }
  visit(root);
  // Bake only paint attributes. SVGLoader still owns geometry, units and all
  // transforms (including the world-space stroke width).
  let index = 0;
  const effectiveStyles = new Map();
  for (const [node, style] of styles) {
    const key = String(index++);
    node.setAttribute('data-kcg-style', key); effectiveStyles.set(key, style);
    for (const [name, value] of Object.entries({ fill: style.fillColor || 'none', stroke: style.strokeColor || 'none', 'fill-opacity': style.fillOpacity, 'stroke-opacity': style.strokeOpacity, opacity: style.opacity, 'stroke-width': style['stroke-width'], 'fill-rule': style['fill-rule'], visibility: style.visibility })) {
      node.setAttribute(name, value);
      node.style?.setProperty(name, String(value));
    }
  }
  return { root, effectiveStyles, text: new XMLSerializer().serializeToString(root) };
}

export function defaultModes(parsed) {
  const modes = Object.fromEntries(parsed.parts.map(part => [part.id,
    ['artboard', 'background', 'faint'].includes(part.role) ? 'off' : part.fill ? 'fill' : part.stroke ? 'outline' : 'off']));
  if (!Object.values(modes).some(mode => mode !== 'off')) {
    const largest = parsed.parts.filter(p => p.role !== 'artboard' && (p.fill || p.stroke))
      .sort((a, b) => b.area - a.area || (b.bbox.maxX - b.bbox.minX) * (b.bbox.maxY - b.bbox.minY) - (a.bbox.maxX - a.bbox.minX) * (a.bbox.maxY - a.bbox.minY))[0];
    if (largest) modes[largest.id] = largest.fill ? 'fill' : 'outline';
  }
  return modes;
}

export function defaultSvgOptions(parsed) {
  const widths = parsed.parts.filter(p => p.stroke && p.strokeWidth > 0).map(p => p.strokeWidth).sort((a, b) => a - b);
  const middle = Math.floor(widths.length / 2), b = unionBounds(parsed.parts);
  const outlineWidth = widths.length ? (widths[middle] + widths[Math.floor((widths.length - 1) / 2)]) / 2
    : Math.max(b.maxX - b.minX, b.maxY - b.minY) * .015;
  return { outlineWidth: Number.isFinite(outlineWidth) && outlineWidth > 0 ? outlineWidth : 1.5, invert: false };
}

export function parseSvgParts(svgText) {
  const prepared = prepareSvg(svgText);
  const data = new SVGLoader().parse(prepared.text);
  const parts = [];
  for (const path of data.paths) {
    const { node, style } = path.userData;
    const effective = prepared.effectiveStyles.get(node.getAttribute('data-kcg-style'));
    if (effective.hidden || effective.visibility === 'hidden' || effective.visibility === 'collapse' || effective.opacity === 0) continue;
    const outlinePaths = path.subPaths.map(subpath => {
      const points = subpath.getPoints(12).map(p => [p.x, -p.y]);
      const closed = subpath.autoClose || (points.length > 2 && samePoint(points[0], points.at(-1)));
      if (closed && points.length > 1 && samePoint(points[0], points.at(-1))) points.pop();
      return { points, closed: Boolean(closed) };
    }).filter(p => p.points.length >= 2);
    if (!outlinePaths.length) continue;
    const fillPolys = [];
    for (const shape of path.toShapes()) {
      const points = shape.extractPoints(12), outer = polygon(points.shape);
      if (outer) fillPolys.push(outer);
      for (const hole of points.holes) { const poly = polygon(hole, false); if (poly) fillPolys.push(poly); }
    }
    const fill = effective.fillOpacity > 0 ? effective.fillColor : null;
    const stroke = effective.strokeOpacity > 0 && style.strokeWidth > 0 ? effective.strokeColor : null;
    parts.push({
      id: 'p' + parts.length, index: parts.length, tag: node.localName,
      fill, stroke, strokeWidth: style.strokeWidth, opacity: effective.opacity,
      fillOpacity: effective.fillOpacity, strokeOpacity: effective.strokeOpacity,
      fillPolys: fillPolys.length ? fillPolys : null, fillRule: style.fillRule === 'evenodd' ? 'EvenOdd' : 'NonZero',
      outlinePaths, bbox: bounds(outlinePaths.flatMap(p => p.points)),
      area: Math.max(0, fillPolys.reduce((sum, poly) => sum + signedArea(poly), 0)),
      role: fill ? 'fill' : 'stroke', defaultMode: 'off',
    });
  }
  const rawViewBox = (prepared.root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const b = unionBounds(parts);
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) && rawViewBox[2] > 0 && rawViewBox[3] > 0
    ? { x: rawViewBox[0], y: rawViewBox[1], w: rawViewBox[2], h: rawViewBox[3] }
    : { x: Number.isFinite(b.minX) ? b.minX : 0, y: Number.isFinite(b.maxY) ? -b.maxY : 0,
      w: Math.max(b.maxX - b.minX, 0) || parseFloat(prepared.root.getAttribute('width')) || 1,
      h: Math.max(b.maxY - b.minY, 0) || parseFloat(prepared.root.getAttribute('height')) || 1 };
  for (const part of parts) {
    const box = part.bbox;
    if (['rect', 'path'].includes(part.tag) && (!part.fill || part.fill === '#ffffff') && box.maxX - box.minX >= viewBox.w * .97 && box.maxY - box.minY >= viewBox.h * .97) part.role = 'artboard';
    else if (part.opacity * Math.max(part.fill ? part.fillOpacity : 0, part.stroke ? part.strokeOpacity : 0) < .5) part.role = 'faint';
  }
  for (const part of parts) {
    if (!part.fill || part.role !== 'fill') continue;
    // Ignore exported artboard frames when deciding whether an icon has a
    // background; otherwise their larger bbox can hide the actual background.
    const others = parts.filter(p => p !== part && p.role !== 'artboard' && (p.fill || p.stroke));
    if (!others.length) continue;
    const otherBox = unionBounds(others), box = part.bbox;
    const centresInside = others.filter(p => {
      const x = (p.bbox.minX + p.bbox.maxX) / 2, y = (p.bbox.minY + p.bbox.maxY) / 2;
      return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
    }).length;
    if (box.maxX - box.minX >= (otherBox.maxX - otherBox.minX) * .8 && box.maxY - box.minY >= (otherBox.maxY - otherBox.minY) * .8 && centresInside >= others.length * .5) part.role = 'background';
  }
  const parsed = { viewBox, parts, groups: [], warnings: prepared.root.querySelector('text') ? ['warn.svgTextIgnored'] : [] };
  const modes = defaultModes(parsed), groups = new Map();
  for (const part of parts) {
    part.defaultMode = modes[part.id];
    const key = JSON.stringify([part.fill, part.stroke, part.strokeWidth, part.opacity, part.fillOpacity, part.strokeOpacity, part.fillRule, part.role, part.defaultMode]);
    if (!groups.has(key)) groups.set(key, { key, partIds: [], fill: part.fill, stroke: part.stroke, role: part.role, defaultMode: part.defaultMode });
    groups.get(key).partIds.push(part.id);
  }
  parsed.groups = [...groups.values()];
  return parsed;
}

// Positive-winding capsules form a union, not XOR, at overlapping joints.
function capsules(paths, width) {
  const polygons = [], r = width / 2;
  if (!(r > 0)) return polygons;
  for (const { points, closed } of paths) {
    for (const [x, y] of points) polygons.push(polygon(Array.from({ length: 16 }, (_, i) => [x + r * Math.cos(i * Math.PI / 8), y + r * Math.sin(i * Math.PI / 8)])));
    for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i % points.length];
      const length = Math.hypot(bx - ax, by - ay);
      if (length < 1e-10) continue;
      const dx = -(by - ay) * r / length, dy = (bx - ax) * r / length;
      polygons.push(polygon([[ax + dx, ay + dy], [bx + dx, by + dy], [bx - dx, by - dy], [ax - dx, ay - dy]]));
    }
  }
  return polygons.filter(Boolean);
}
const partWidth = (part, options) => !part.fill && part.stroke ? part.strokeWidth : options.outlineWidth;

export function buildSvgCrossSection(wasm, parsed, modes = {}, opts = {}) {
  const { CrossSection } = wasm, defaults = defaultModes(parsed), options = { ...defaultSvgOptions(parsed), ...opts };
  if (!Number.isFinite(options.outlineWidth) || options.outlineWidth <= 0) options.outlineWidth = defaultSvgOptions(parsed).outlineWidth;
  const temporary = new Set();
  const own = cs => { temporary.add(cs); return cs; };
  const drop = cs => { cs.delete(); temporary.delete(cs); };
  // The vendored binding reads contours[0].length for an empty array.
  const section = (polys = [], rule = 'NonZero') => own(polys.length ? new CrossSection(polys, rule) : CrossSection.square([0, 0]));
  function outline(part) {
    const width = partWidth(part, options);
    let result = section();
    for (const path of part.outlinePaths) {
      let stroke;
      if (path.closed && polygon(path.points)) {
        const base = section([polygon(path.points)]);
        const outer = own(base.offset(width / 2, 'Round', 2, 16));
        const inner = own(base.offset(-width / 2, 'Round', 2, 16));
        stroke = own(outer.subtract(inner));
        drop(base); drop(outer); drop(inner);
      } else stroke = section(capsules([path], width));
      const next = own(result.add(stroke)); drop(result); drop(stroke); result = next;
    }
    return result;
  }
  try {
    let result = section();
    for (const part of parsed.parts) {
      const mode = Object.hasOwn(modes, part.id) && MODES.has(modes[part.id]) ? modes[part.id] : defaults[part.id];
      if (mode === 'off') continue;
      // Fill/Cut use the enclosed geometry even for a stroke-only closed path.
      // Open lines have no enclosed fill; Outline is their printable mode.
      const shape = mode === 'outline'
        ? outline(part) : section(part.fillPolys || [], part.fillRule);
      const next = own(mode === 'cut' ? result.subtract(shape) : result.add(shape));
      drop(result); drop(shape); result = next;
    }
    if (options.invert) {
      const background = parsed.parts.find(p => p.role === 'background' && p.fillPolys?.length);
      const b = unionBounds(parsed.parts);
      const rect = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
      const base = section(background ? background.fillPolys : (parsed.parts.length ? [rect] : []), background?.fillRule || 'NonZero');
      const next = own(base.subtract(result)); drop(base); drop(result); result = next;
    }
    if (result.isEmpty()) throw new Error('err.svgNoShapes');
    temporary.delete(result);
    return result;
  } finally {
    for (const cs of temporary) cs.delete();
  }
}

// Synchronous compatibility API: default modes never contain Cut or Invert.
// Capsules are equivalent to round offset rings after NonZero union by callers.
export function svgToContours(svgText) {
  const parsed = parseSvgParts(svgText), modes = defaultModes(parsed), options = defaultSvgOptions(parsed), polygons = [];
  for (const part of parsed.parts) {
    if (modes[part.id] === 'fill') polygons.push(...(part.fillPolys || []));
    else if (modes[part.id] === 'outline') polygons.push(...capsules(part.outlinePaths, partWidth(part, options)));
  }
  if (!polygons.length) throw new Error('err.svgNoShapes');
  return { polygons, fillRule: 'NonZero' };
}
