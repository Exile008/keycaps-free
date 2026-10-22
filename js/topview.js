// ============================================================================
// topview.js — live 2D SVG diagrams (browser). See docs/SPEC.md §8.
// Geometry is mapped into screen-sized SVGs; labels never scale with millimetres.
// Contract: createTopView(container) → { update(layout, params), dispose() }
// ============================================================================

import { t } from './i18n.js';

function toWorld(frame, local) {
  const R = frame.R;
  const o = frame.origin;
  return [
    R[0][0] * local[0] + R[0][1] * local[1] + R[0][2] * local[2] + o[0],
    R[1][0] * local[0] + R[1][1] * local[1] + R[1][2] * local[2] + o[1],
    R[2][0] * local[0] + R[2][1] * local[1] + R[2][2] * local[2] + o[2],
  ];
}

function fmt(v) {
  return String(Math.round(v * 100) / 100);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function label(x, y, text, anchor = 'middle') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${esc(text)}</text>`;
}

// `geom` = core.keycap (optional): its dishSurfaceZ draws the dish/sculpt line.
export function createTopView(container, geom = {}) {
  const dishSurfaceZ = typeof geom.dishSurfaceZ === 'function' ? geom.dishSurfaceZ : null;
  let state = null;
  let collapsed = false;
  try { collapsed = localStorage.getItem('kcg-diagram-collapsed') === 'true'; } catch (_) { /* ignore */ }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'btn-toggle-topview';
  toggle.className = 'topview-toggle';
  toggle.setAttribute('aria-controls', 'topview-drawings');
  const drawings = document.createElement('div');
  drawings.id = 'topview-drawings';
  drawings.className = 'topview-drawings';
  container.replaceChildren(toggle, drawings);

  function syncToggle() {
    container.classList.toggle('is-collapsed', collapsed);
    drawings.hidden = collapsed;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', t(collapsed ? 'diagram.expand' : 'diagram.collapse'));
    toggle.title = t(collapsed ? 'diagram.expand' : 'diagram.collapse');
    toggle.textContent = t('diagram.title') + (collapsed ? ' ＋' : ' −');
  }

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    syncToggle();
    if (!collapsed) render();
    try { localStorage.setItem('kcg-diagram-collapsed', String(collapsed)); } catch (_) { /* ignore */ }
  });

  function renderTopView(layout, p, width) {
    const b = layout.bottom;
    const top = layout.top;
    // Side annotations get fixed pixel gutters; the drawing uses the rest.
    const scale = (width - 68) / b.w;
    const height = b.d * scale + 48;
    const X = (x) => 34 + (x - b.x0) * scale;
    const Y = (y) => 24 + (b.y1 - y) * scale;
    const svg = [];
    svg.push(`<rect class="diagram-bottom" x="${X(b.x0)}" y="24" width="${b.w * scale}" height="${b.d * scale}" rx="${p.rBottom * scale}"/>`);

    const outline = [];
    const radius = Math.min(p.rTop, top.w / 2, top.d / 2);
    for (const [cx, cy, start] of [
      [top.w / 2 - radius, top.d / 2 - radius, 0],
      [-top.w / 2 + radius, top.d / 2 - radius, Math.PI / 2],
      [-top.w / 2 + radius, -top.d / 2 + radius, Math.PI],
      [top.w / 2 - radius, -top.d / 2 + radius, Math.PI * 1.5],
    ]) {
      for (let i = 0; i <= 8; i++) {
        const a = start + i / 8 * Math.PI / 2;
        const pt = toWorld(layout.frame, [cx + radius * Math.cos(a), cy + radius * Math.sin(a), 0]);
        outline.push(`${X(pt[0])},${Y(pt[1])}`);
      }
    }
    svg.push(`<polygon class="diagram-top" points="${outline.join(' ')}"/>`);

    if (p.stemType === 'choc') {
      // Two Choc prongs per stem position (rotated 90° when stemRotate is set).
      const rot = p.stemRotate === 90;
      const w = (rot ? p.chocProngL : p.chocProngW) * scale;
      const l = (rot ? p.chocProngW : p.chocProngL) * scale;
      for (const [sx, sy] of layout.stems || [[0, 0]]) {
        for (const s of [-1, 1]) {
          const cx = sx + (rot ? 0 : s * p.chocSpacing / 2);
          const cy = sy + (rot ? s * p.chocSpacing / 2 : 0);
          svg.push(`<rect class="diagram-stem" x="${X(cx) - w / 2}" y="${Y(cy) - l / 2}" width="${w}" height="${l}" rx="${0.35 * scale}"/>`);
        }
      }
    } else if (p.stemType !== 'none') {
      for (const [sx, sy] of layout.stems || [[0, 0]]) {
        const x = X(sx), y = Y(sy), k = 1.5 * scale;
        svg.push(`<circle class="diagram-stem" cx="${x}" cy="${y}" r="${p.stemOuterD / 2 * scale}"/>`);
        svg.push(`<path class="diagram-stem" d="M${x - k} ${y}H${x + k}M${x} ${y - k}V${y + k}"/>`);
      }
    }

    const tx0 = top.cx - top.w / 2, tx1 = top.cx + top.w / 2;
    const ty0 = top.cy - top.d / 2, ty1 = top.cy + top.d / 2;
    // Inset chords are measured before tilt, matching the parameter contract.
    svg.push(`<path class="diagram-dimension" d="M${X(b.x0)} ${Y(b.cy)}H${X(tx0)}M${X(tx1)} ${Y(b.cy)}H${X(b.x1)}M${X(b.cx)} ${Y(b.y0)}V${Y(ty0)}M${X(b.cx)} ${Y(ty1)}V${Y(b.y1)}"/>`);
    svg.push(label(width / 2, 10, t('diagram.inset', { side: t('dir.back'), value: fmt(p.insetB) })));
    svg.push(label(width / 2, height - 10, t('diagram.inset', { side: t('dir.front'), value: fmt(p.insetF) })));
    for (const [x, side, value] of [[16, 'dir.left', p.insetL], [width - 16, 'dir.right', p.insetR]]) {
      svg.push(label(x, Y(b.cy) - 7, t(side)));
      svg.push(label(x, Y(b.cy) + 8, fmt(value)));
    }
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t('diagram.top'))}"><title>${esc(t('diagram.insets'))}</title>${svg.join('')}</svg>`;
  }

  function renderSideView(layout, p, width) {
    const b = layout.bottom;
    const top = layout.top;
    const front = toWorld(layout.frame, [0, -top.d / 2, 0]);
    const back = toWorld(layout.frame, [0, top.d / 2, 0]);
    const scale = (width - 16) / b.d;
    const zMax = Math.max(p.height, front[2], back[2]);
    const height = zMax * scale + 58;
    const baseline = height - 24;
    const X = (y) => 8 + (y - b.y0) * scale;
    const Z = (z) => baseline - z * scale;
    const fx = X(front[1]), fy = Z(front[2]);
    const bx = X(back[1]), by = Z(back[2]);
    const svg = [];
    // Outline: back skirt up, top surface (dish / sculpt) back → front, front skirt down.
    // Classic dishes keep the rim silhouette; KLP tops show the centre section,
    // and their thumb/saddle cut also shaves the skirt beyond the top edge.
    const sculpted = !!dishSurfaceZ && String(p.dishType).startsWith('klp');
    const surf = (ly) => (sculpted ? dishSurfaceZ(layout, 0, ly) : 0);
    const { R: Rm, origin: o } = layout.frame;
    const toLocal = (y, z) => {
      const dy = y - o[1], dz = z - o[2], dx = -o[0];
      return [Rm[0][1] * dx + Rm[1][1] * dy + Rm[2][1] * dz, Rm[0][2] * dx + Rm[1][2] * dy + Rm[2][2] * dz];
    };
    // Skirt from the footprint edge up to the rim point (straight or arc),
    // stopped where it meets the top surface. Returns [points, local y of the stop].
    const skirt = (by0, rim, sign) => {
      const out = [[by0, 0]];
      const rounded = p.skirtStyle === 'rounded';
      const zs = rounded ? Math.max(0, Math.min(p.skirtStraight, rim[2] - 0.2)) : 0;
      const dz = rim[2] - zs;
      const R = Math.max(p.skirtRadius, dz + 1e-3);
      if (zs > 0) out.push([by0, zs]);
      for (let k = 1; k <= 24; k++) {
        const tt = k / 24;
        const f = rounded && dz > 1e-6 ? (R - Math.sqrt(R * R - (tt * dz) ** 2)) / (R - Math.sqrt(R * R - dz * dz)) : tt;
        const pt = [by0 + (rim[1] - by0) * f, zs + dz * tt];
        const [ly, lz] = toLocal(pt[0], pt[1]);
        if (lz > surf(ly) + 1e-6) return [out, Math.max(sign * ly, 0) * sign];
        out.push(pt);
      }
      return [out, sign * top.d / 2];
    };
    const [backSkirt, lyBack] = skirt(b.y1, back, 1);
    const [frontSkirt, lyFront] = skirt(b.y0, front, -1);
    const pts = [...backSkirt];
    for (let i = 0; i <= 32; i++) {
      const ly = lyBack + (lyFront - lyBack) * (i / 32);
      const w = toWorld(layout.frame, [0, ly, surf(ly)]);
      pts.push([w[1], w[2]]);
    }
    pts.push(...frontSkirt.reverse());
    svg.push(`<path class="diagram-top" d="M${pts.map(([y, z]) => `${X(y).toFixed(1)} ${Z(z).toFixed(1)}`).join('L')}Z"/>`);
    svg.push(`<path class="diagram-bottom" d="M8 ${baseline}H${width - 8}"/>`);

    const hx = X(0), hy = Z(p.height);
    svg.push(`<path class="diagram-dimension" d="M${hx} ${baseline}V${hy}M${hx - 4} ${baseline}h8M${hx - 4} ${hy}h8"/>`);
    svg.push(label(hx + 6, (baseline + hy) / 2, t('diagram.height', { value: fmt(p.height) }), 'start'));

    // Actual projected pitch angle, with a horizontal reference and a visible arc.
    const angle = Math.atan2(by - fy, bx - fx);
    const radius = Math.min(52, Math.hypot(bx - fx, by - fy) * 0.5);
    const ax = fx + radius * Math.cos(angle), ay = fy + radius * Math.sin(angle);
    svg.push(`<path class="diagram-reference" d="M${fx} ${fy}h${radius + 8}"/>`);
    svg.push(`<path class="diagram-angle" d="M${fx + radius} ${fy}A${radius} ${radius} 0 0 ${angle < 0 ? 0 : 1} ${ax} ${ay}"/>`);
    svg.push(`<circle class="diagram-angle-end" cx="${ax}" cy="${ay}" r="2"/>`);
    svg.push(label(width / 2, 12, t('diagram.tilt', { value: fmt(p.tiltX) })));
    svg.push(label(8, height - 9, t('dir.front'), 'start'));
    svg.push(label(width - 8, height - 9, t('dir.back'), 'end'));
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t('diagram.side'))}">${svg.join('')}</svg>`;
  }

  function render() {
    syncToggle();
    if (collapsed || !state) return;
    const { layout, params } = state;
    if (!layout) { drawings.innerHTML = ''; return; }
    const width = Math.max(180, drawings.clientWidth);
    drawings.innerHTML = `<h3>${esc(t('diagram.top'))}</h3>${renderTopView(layout, params, width)}
      <h3>${esc(t('diagram.side'))}</h3>${renderSideView(layout, params, width)}`;
  }

  function update(layout, params) {
    state = { layout, params };
    render();
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(render) : null;
  if (ro) {
    ro.observe(container);
    ro.observe(drawings);
  }
  window.addEventListener('langchange', render);
  syncToggle();

  function dispose() {
    if (ro) ro.disconnect();
    window.removeEventListener('langchange', render);
    container.replaceChildren();
  }

  return { update, dispose };
}
