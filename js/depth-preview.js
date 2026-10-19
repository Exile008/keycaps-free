// ============================================================================
// depth-preview.js — live 2D cross-section of the keycap top plate through the
// legend centre (browser). See docs/SPEC.md §6/§8.
//
// The section is taken in the top-face local frame, along local X at
// y = legendY, because that is the direction in which the cylindrical dish
// curves and the direction of the legend's width.  Geometry is schematic:
// horizontal and vertical scales differ so sub-millimetre depths stay legible.
//
// Contract: createDepthPreview(container) → { update(params, layout, legendInfo), dispose() }
//   legendInfo = { hasLegend:boolean, width:mm (fitted bbox along X), depth:mm }
// ============================================================================

import { t } from './i18n.js';

const SVG_H = 144;       // CSS pixels; the diagram is 1 SVG unit = 1 CSS px
const DRAW_TOP = 14;
const DRAW_BOTTOM = 100;
const SUMMARY_1 = 114;
const SUMMARY_2 = 127;
const WARNING_Y = 140;

let sequence = 0;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmt(v) {
  return (Math.round(v * 100) / 100).toFixed(2);
}

// Local Z of the inner top surface.  The inner hull uses the same dish depth
// but its own (smaller) top rectangle, so recompute the sagitta radius.
function innerDishZ(p, tw, td, x, y) {
  const d = p.dishDepth;
  if (p.dishType === 'flat' || !(d >= 0.05)) return 0;
  if (p.dishType === 'cylindrical') {
    const r = (tw * tw + 4 * d * d) / (8 * d);
    const inside = r * r - x * x;
    return inside > 0 ? (r - d) - Math.sqrt(inside) : 0;
  }
  const c = Math.hypot(tw, td);
  const r = (c * c + 4 * d * d) / (8 * d);
  const inside = r * r - x * x - y * y;
  return inside > 0 ? (r - d) - Math.sqrt(inside) : 0;
}

// Half-width of a rounded rectangle at local y (a section along X).
function faceHalfX(y, tw, td, r) {
  const halfW = tw / 2;
  const halfD = td / 2;
  r = Math.max(0, Math.min(r, halfW, halfD));
  const ay = Math.min(Math.abs(y), halfD);
  if (ay <= halfD - r) return halfW;
  const dy = ay - (halfD - r);
  if (dy >= r) return Math.max(0, halfW - r);
  return Math.max(0, halfW - r + Math.sqrt(Math.max(0, r * r - dy * dy)));
}

function sample(fn, a, b, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const x = a + (b - a) * (i / n);
    out.push([x, fn(x)]);
  }
  return out;
}

function polyline(pts, X, Y) {
  return pts.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(2)} ${Y(z).toFixed(2)}`).join('');
}

// `geom` comes from main.js (core.keycap) so this module does not statically
// import keycap.js. main.js loads core modules tolerantly; a static import
// here would break the whole app when keycap.js is missing.
export function createDepthPreview(container, geom = {}) {
  const computeLayout = typeof geom.computeLayout === 'function' ? geom.computeLayout : null;
  const dishSurfaceZ = typeof geom.dishSurfaceZ === 'function' ? geom.dishSurfaceZ : null;
  const root = document.createElement('div');
  root.className = 'depth-preview';
  container.replaceChildren(root);

  const id = `depth-preview-${++sequence}`;
  let last = null;

  function render() {
    if (!last) return;
    const { params, layout: supplied, legend } = last;
    const info = legend || { hasLegend: false };

    let layout = supplied;
    if ((!layout || !layout.top || !layout.frame) && computeLayout) {
      try { layout = computeLayout(params); } catch (_) { layout = null; }
    }
    if (!layout || !layout.top) { root.innerHTML = ''; return; }

    const p = layout.params || params || {};
    const W = Math.max(180, Math.round(root.clientWidth - 8) || 270);
    const mode = p.legendMode || 'inlay';
    const hasLegend = !!info.hasLegend;
    const top = layout.top;
    const tw = Math.max(0.1, top.w);
    const td = Math.max(0.1, top.d);
    const wall = Math.max(0, p.wall || 0);
    const twi = Math.max(0.1, tw - 2 * wall);
    const tdi = Math.max(0.1, td - 2 * wall);
    const ri = Math.max(0.3, (layout.r && layout.r.rTop != null ? layout.r.rTop : p.rTop) - wall / 2);
    const rTop = layout.r && layout.r.rTop != null ? layout.r.rTop : p.rTop;

    // The section is taken through the legend centre, clamped to the face.
    const yc = clamp(Number(p.legendY) || 0, -td / 2 + 1e-4, td / 2 - 1e-4);
    const halfO = faceHalfX(yc, tw, td, rTop);
    const halfI = Math.max(0.001, faceHalfX(yc, twi, tdi, ri));

    const surface = (x) => (dishSurfaceZ ? dishSurfaceZ(layout, x, yc) : 0);
    const innerSurface = (x) => innerDishZ(p, twi, tdi, x, yc) - p.topThickness;

    // Cut depth produced by applyLegend: shine ignores legendDepth and cuts
    // through topThickness + dish + 0.5 mm.
    const through = mode === 'shine';
    const depth = through
      ? Math.max(0, p.topThickness) + Math.max(0, p.dishDepth) + 0.5
      : Math.max(0, p.legendDepth);
    const depthLabelKey = through ? 'depth.throughLabel' : 'depth.depthLabel';

    // Vertical extent: include the raised band above the surface, the inner
    // surface, and the bottom of the legend cut (which may pass the inner top).
    let zMin = innerSurface(0);
    for (const [x, z] of sample(innerSurface, -halfI, halfI, 24)) zMin = Math.min(zMin, z);
    const bandX0 = hasLegend
      ? clamp((Number(p.legendX) || 0) - (Number(info.width) || 0) / 2, -halfO, halfO) : 0;
    const bandX1 = hasLegend
      ? clamp((Number(p.legendX) || 0) + (Number(info.width) || 0) / 2, -halfO, halfO) : 0;
    const hasBand = hasLegend && bandX1 - bandX0 > 0.01;
    if (hasBand) {
      for (const [x, z] of sample(surface, bandX0, bandX1, 20)) {
        zMin = Math.min(zMin, mode === 'raised' ? z : z - depth);
      }
    }
    zMin -= 0.28; // a little air under the section
    const zMax = hasBand && mode === 'raised' ? depth : 0;

    const span = Math.max(0.2, zMax - zMin);
    const sz = Math.min((DRAW_BOTTOM - DRAW_TOP) / span, 50);
    const offset = Math.max(0, (DRAW_BOTTOM - DRAW_TOP) - span * sz) / 2;
    const y0 = DRAW_TOP + offset + zMax * sz;
    const Y = (z) => y0 - z * sz;
    const sx = (W - 20) / tw;
    const X = (x) => 10 + (x + tw / 2) * sx;
    const bx0 = X(bandX0), bx1 = X(bandX1);

    const yBottom = Y(zMin);
    const left = X(-halfO), right = X(halfO);
    const innerLeft = X(-halfI), innerRight = X(halfI);

    // ------------------------------------------------------------------ fills
    const outerPts = sample(surface, -halfO, halfO, 56);
    const innerPts = sample(innerSurface, -halfI, halfI, 44);
    const materialPath = `${polyline(outerPts, X, Y)}L${right.toFixed(2)} ${yBottom.toFixed(2)}`
      + `L${left.toFixed(2)} ${yBottom.toFixed(2)}Z`;
    const cavityPath = `${polyline(innerPts, X, Y)}L${innerRight.toFixed(2)} ${yBottom.toFixed(2)}`
      + `L${innerLeft.toFixed(2)} ${yBottom.toFixed(2)}Z`;

    const capColor = /^#[0-9a-f]{3,8}$/i.test(String(p.capColor || '')) ? p.capColor : '#1c1c1e';
    const legendColor = /^#[0-9a-f]{3,8}$/i.test(String(p.legendColor || '')) ? p.legendColor : '#f2f2f2';

    const svg = [];
    svg.push(`<defs><pattern id="${id}-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
      + '<rect width="5" height="5" class="depth-cavity-fill"/>'
      + '<line x1="0" y1="0" x2="0" y2="5" class="depth-hatch-line"/></pattern></defs>');
    svg.push(`<path class="depth-material" fill="${esc(capColor)}" d="${materialPath}"/>`);
    svg.push(`<path class="depth-cavity" fill="url(#${id}-hatch)" d="${cavityPath}"/>`);
    svg.push(`<path class="depth-cut" d="M${left.toFixed(2)} ${yBottom.toFixed(2)}H${right.toFixed(2)}"/>`);

    // ------------------------------------------------------------- surface lines
    svg.push(`<path class="depth-surface" d="${polyline(outerPts, X, Y)}"/>`);
    svg.push(`<path class="depth-inner" d="${polyline(innerPts, X, Y)}"/>`);
    svg.push(`<path class="depth-edge" d="M${left.toFixed(2)} ${Y(surface(-halfO)).toFixed(2)}V${yBottom.toFixed(2)}`
      + `M${right.toFixed(2)} ${Y(surface(halfO)).toFixed(2)}V${yBottom.toFixed(2)}"/>`);

    // ------------------------------------------------------------- legend band
    if (hasBand) {
      const surfacePts = sample(surface, bandX0, bandX1, 24);
      const topPts = mode === 'raised' ? surfacePts.map(([x, z]) => [x, z + depth]) : surfacePts;
      const bottomPts = mode === 'raised' ? surfacePts : surfacePts.map(([x, z]) => [x, z - depth]);
      const bandClass = mode === 'recessed' ? 'depth-groove' : 'depth-band';
      // Top curve left→right, down the right edge, bottom curve right→left.
      const rev = bottomPts.slice().reverse();
      let bandPath = polyline(topPts, X, Y);
      bandPath += `L${X(rev[0][0]).toFixed(2)} ${Y(rev[0][1]).toFixed(2)}`;
      for (let i = 1; i < rev.length; i++) {
        bandPath += `L${X(rev[i][0]).toFixed(2)} ${Y(rev[i][1]).toFixed(2)}`;
      }
      bandPath += 'Z';
      if (mode === 'recessed') {
        svg.push(`<path class="${bandClass}" fill="url(#${id}-hatch)" d="${bandPath}"/>`);
      } else {
        svg.push(`<path class="${bandClass}" fill="${esc(legendColor)}" d="${bandPath}"/>`);
      }
    }

    // ------------------------------------------------------------------- arrows
    if (hasLegend && hasBand) {
      // Depth arrow just outside the band.
      let xd = bx1 + 7;
      if (xd > W - 16) xd = bx1 - 7;
      if (xd < 16) xd = (bx1 + bx0) / 2;
      const xdm = clamp((xd - 10) / sx - tw / 2, -halfO, halfO);
      const zs = surface(xdm);
      const z1 = mode === 'raised' ? zs + depth : zs;
      const z2 = mode === 'raised' ? zs : zs - depth;
      svg.push(dimLine(xd, Y(z1), Y(z2), 'is-depth'));
    }
    if (hasBand) {
      // Remaining material below the legend band (omitted when it is gone).
      const xr = X(clamp(Number(p.legendX) || 0, -halfO + 0.05, halfO - 0.05));
      const zTop = mode === 'raised' ? surface((xr - 10) / sx - tw / 2)
        : surface((xr - 10) / sx - tw / 2) - depth;
      const zLow = innerSurface((xr - 10) / sx - tw / 2);
      if (zTop - zLow > 0.08) {
        svg.push(dimLine(xr, Y(zTop), Y(zLow), 'is-remaining'));
      }
    }
    // Top thickness arrow, inside the cavity near its left edge.
    {
      const xt = X(halfI > 0.2 ? -halfI + Math.min(0.55, halfI * 0.4) : 0);
      const xm = (xt - 10) / sx - tw / 2;
      svg.push(dimLine(xt, Y(surface(xm)), Y(innerSurface(xm)), 'is-top'));
    }

    // ------------------------------------------------------------------- labels
    if (!hasLegend) {
      svg.push(`<text class="depth-none" x="${(W / 2).toFixed(2)}" y="10" text-anchor="middle">${esc(t('depth.noLegend'))}</text>`);
    }

    const depthValue = through ? depth : (Number(p.legendDepth) || 0);
    if (hasLegend) {
      svg.push(summary(8, 'start', SUMMARY_1, t(depthLabelKey), depthValue));
      svg.push(summary(W - 8, 'end', SUMMARY_1, t('depth.topLabel'), p.topThickness));
    } else {
      svg.push(summary(8, 'start', SUMMARY_1, t('depth.topLabel'), p.topThickness));
    }

    let remaining = null;
    if (hasLegend) {
      if (mode === 'inlay' || mode === 'recessed') remaining = p.topThickness - p.legendDepth;
      else if (mode === 'raised') remaining = p.topThickness;
      else if (mode === 'shine') remaining = 0;
    }
    if (remaining != null) {
      svg.push(summary(8, 'start', SUMMARY_2, t('depth.remainingLabel'), remaining));
    }

    let warning = null;
    if (hasLegend && (mode === 'inlay' || mode === 'recessed')) {
      if (Number(p.legendDepth) >= Number(p.topThickness)) warning = t('depth.warnThrough');
      else if (remaining < 0.4) warning = t('depth.warnThin', { value: fmt(Math.max(0, remaining)) });
    }
    if (warning) {
      svg.push(`<text class="depth-warning" x="8" y="${WARNING_Y}">${esc(warning)}</text>`);
    } else if (hasLegend && mode === 'shine' && p.stemType !== 'none') {
      const note = p.stemSeparate ? 'depth.stemSeparateNote' : 'depth.stemsNote';
      svg.push(`<text class="depth-note" x="8" y="${WARNING_Y}">${esc(t(note))}</text>`);
    }

    root.classList.toggle('is-warn', !!warning);
    const aria = t('depth.aria', { mode: t('mode.' + mode) });
    root.setAttribute('aria-label', aria);
    root.innerHTML = `<svg viewBox="0 0 ${W} ${SVG_H}" role="img" aria-label="${esc(aria)}"`
      + ` xmlns="http://www.w3.org/2000/svg"><title>${esc(t('depth.title'))} · ${esc(t('mode.' + mode))}</title>`
      + svg.join('') + '</svg>';
  }

  function dimLine(x, y1, y2, cls) {
    if (!(Math.abs(y2 - y1) > 1)) return '';
    return `<path class="depth-dim ${cls}" d="M${x.toFixed(2)} ${y1.toFixed(2)}V${y2.toFixed(2)}`
      + `M${(x - 3).toFixed(2)} ${y1.toFixed(2)}h6M${(x - 3).toFixed(2)} ${y2.toFixed(2)}h6"/>`;
  }

  function summary(x, anchor, y, label, value) {
    return `<text class="depth-summary" x="${x}" y="${y}" text-anchor="${anchor}">`
      + `<tspan class="depth-summary-label">${esc(label)}</tspan> `
      + `<tspan class="depth-summary-value">${esc(fmt(Number(value) || 0))} mm</tspan></text>`;
  }

  function update(params, layout, legendInfo) {
    last = { params, layout, legend: legendInfo };
    render();
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(render) : null;
  if (ro) ro.observe(container);
  window.addEventListener('langchange', render);

  function dispose() {
    if (ro) ro.disconnect();
    window.removeEventListener('langchange', render);
    container.replaceChildren();
    last = null;
  }

  return { update, dispose };
}
