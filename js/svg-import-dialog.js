// SVG import is transactional: only the plain modes/options returned on Use this
// are committed by main.js. Every preview CrossSection is released immediately.
import { t, applyI18n } from './i18n.js';
import { defaultModes, defaultSvgOptions, buildSvgCrossSection } from './svg-legend.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MODES = ['fill', 'outline', 'cut', 'off'];
const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const translated = (tag, cls, key) => {
  const n = node(tag, cls, t(key));
  n.dataset.i18n = key;
  return n;
};
const button = (key, cls = 'btn btn-sm') => {
  const b = translated('button', cls, key);
  b.type = 'button';
  return b;
};
const svgNode = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
  return n;
};
const number = value => String(Number(value.toPrecision(4)));
const pathData = (paths, closed = true) => paths.map(path => path.length
  ? 'M' + path.map(([x, y]) => `${x},${-y}`).join('L') + (closed ? 'Z' : '') : '').join('');

export function openSvgImportDialog({ name, svgText, parsed, modes, options, wasm, legendSize = 8 }) {
  const auto = defaultModes(parsed), defaults = defaultSvgOptions(parsed);
  let draftModes = Object.fromEntries(parsed.parts.map(p => [p.id,
    MODES.includes(modes?.[p.id]) ? modes[p.id] : auto[p.id]]));
  let draftOptions = {
    outlineWidth: Number.isFinite(options?.outlineWidth) && options.outlineWidth > 0 ? options.outlineWidth : defaults.outlineWidth,
    invert: typeof options?.invert === 'boolean' ? options.invert : defaults.invert,
  };
  let grouped = parsed.parts.length > 12;
  let timer = null, closed = false, previewExtent = 0;
  const previousFocus = document.activeElement;
  const vb = parsed.viewBox;
  const viewBox = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  const imageUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  const dialog = node('dialog', 'svg-import-dialog');
  dialog.setAttribute('aria-labelledby', 'svg-import-title');
  dialog.innerHTML = `
    <header class="modal-head svg-import-head">
      <div><h2 id="svg-import-title" data-i18n="svgImport.title"></h2><p class="svg-import-filename"></p></div>
    </header>
    <div class="svg-import-body">
      <section class="svg-import-previews"></section>
      <section class="svg-import-parts">
        <div class="svg-import-parts-head"><h3></h3><label class="svg-import-group"><input type="checkbox"><span data-i18n="svgImport.groupByStyle"></span></label></div>
        <div class="svg-import-rows"></div>
      </section>
      <section class="svg-import-options">
        <div class="svg-import-width"><label for="svg-import-width" data-i18n="svgImport.outlineWidth"></label><output for="svg-import-width"></output><input id="svg-import-width" class="slider" type="range"><p class="hint" data-i18n="svgImport.widthHint"></p></div>
        <label class="svg-import-invert"><input type="checkbox"><span data-i18n="svgImport.invert"></span></label>
        <div class="svg-import-bulk"></div>
      </section>
      <div class="svg-import-warnings" role="status" aria-live="polite"></div>
      <p class="svg-import-error" role="status" aria-live="polite" hidden></p>
    </div>
    <footer class="svg-import-footer"><p class="svg-import-summary" aria-live="polite"></p><div class="svg-import-actions"></div></footer>`;
  const q = selector => dialog.querySelector(selector);
  q('.svg-import-filename').textContent = name;
  q('.svg-import-filename').title = name;
  const closeButton = button('btn.close', 'btn btn-ghost btn-sm');
  q('.svg-import-head').appendChild(closeButton);
  const previews = q('.svg-import-previews');
  const makePreview = key => {
    const figure = node('figure', 'svg-import-preview');
    figure.appendChild(translated('figcaption', '', key));
    const canvas = node('div', 'svg-import-canvas');
    figure.appendChild(canvas); previews.appendChild(figure);
    return canvas;
  };
  const original = makePreview('svgImport.yourFile');
  const img = node('img'); img.alt = name; img.src = imageUrl;
  original.appendChild(img);
  const highlight = svgNode('svg', { viewBox, 'aria-hidden': 'true', class: 'svg-import-highlight' });
  original.appendChild(highlight);
  const print = makePreview('svgImport.willPrint');
  const printSvg = svgNode('svg', { viewBox, role: 'img' });
  const printPath = svgNode('path', { 'fill-rule': 'evenodd', fill: '#17191d' });
  printSvg.appendChild(printPath); print.appendChild(printSvg);
  const groupToggle = q('.svg-import-group input');
  groupToggle.checked = grouped;
  q('.svg-import-group').hidden = parsed.parts.length <= 12;
  const rows = q('.svg-import-rows');
  const width = q('#svg-import-width');
  const span = Math.max(vb.w, vb.h);
  width.min = number(Math.max(span * .0001, .0001));
  width.max = number(Math.max(span * .15, draftOptions.outlineWidth * 2, defaults.outlineWidth * 3));
  width.step = 'any'; width.value = draftOptions.outlineWidth;
  const invert = q('.svg-import-invert input'); invert.checked = draftOptions.invert;
  const cancel = button('svgImport.cancel', 'btn');
  const use = button('svgImport.use', 'btn btn-primary'); use.disabled = true;
  q('.svg-import-actions').append(cancel, use);
  const bulk = q('.svg-import-bulk');
  const reset = button('svgImport.reset');
  const allFill = button('svgImport.allFill');
  const allOff = button('svgImport.allOff');
  bulk.append(reset, allFill, allOff);

  function partLabel(part) {
    return part.role === 'stroke'
      ? t('svgImport.role.stroke', { width: number(part.strokeWidth) })
      : t('svgImport.role.' + part.role);
  }
  function drawParts(target, parts, hover = false) {
    target.replaceChildren();
    for (const part of parts) {
      if (hover) {
        for (const path of part.outlinePaths) target.appendChild(svgNode('path', {
          d: pathData([path.points], path.closed), fill: 'none', stroke: 'var(--accent)',
          'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke',
        }));
      } else {
        if (part.fill && part.fillPolys) target.appendChild(svgNode('path', {
          d: pathData(part.fillPolys), fill: part.fill, 'fill-rule': part.fillRule === 'EvenOdd' ? 'evenodd' : 'nonzero',
        }));
        if (part.stroke) for (const path of part.outlinePaths) target.appendChild(svgNode('path', {
          d: pathData([path.points], path.closed), fill: 'none', stroke: part.stroke, 'stroke-width': part.strokeWidth,
        }));
      }
    }
  }
  function syncRows() {
    for (const row of rows.children) {
      const ids = JSON.parse(row.dataset.partIds);
      const selected = new Set(ids.map(id => draftModes[id]));
      row.classList.toggle('is-off', selected.size === 1 && selected.has('off'));
      row.querySelector('.svg-import-mixed').hidden = selected.size < 2;
      row.querySelectorAll('[data-mode]').forEach(b => {
        const active = selected.size === 1 && selected.has(b.dataset.mode);
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    }
  }
  function renderRows() {
    rows.replaceChildren(); highlight.replaceChildren();
    const entries = grouped ? parsed.groups : parsed.parts.map(p => ({ partIds: [p.id] }));
    for (const entry of entries) {
      const parts = entry.partIds.map(id => parsed.parts.find(p => p.id === id));
      const part = parts[0];
      const row = node('div', 'svg-import-part');
      row.dataset.partIds = JSON.stringify(entry.partIds);
      const minX = Math.min(...parts.map(p => p.bbox.minX)), maxX = Math.max(...parts.map(p => p.bbox.maxX));
      const minY = Math.min(...parts.map(p => p.bbox.minY)), maxY = Math.max(...parts.map(p => p.bbox.maxY));
      const pad = Math.max(maxX - minX, maxY - minY, part.strokeWidth || 1) * .12;
      const thumbBox = `${minX - pad} ${-maxY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
      const thumb = svgNode('svg', { viewBox: thumbBox, 'aria-hidden': 'true', class: 'svg-import-part-thumb' });
      drawParts(thumb, parts); row.appendChild(thumb);
      const label = node('div', 'svg-import-part-label');
      const title = node('span', 'svg-import-part-title', partLabel(part));
      const swatch = node('span', 'svg-import-swatch'); swatch.style.background = part.fill || part.stroke || 'transparent';
      title.prepend(swatch); label.appendChild(title);
      label.appendChild(node('span', 'hint', entry.partIds.length > 1
        ? t('svgImport.groupCount', { count: entry.partIds.length })
        : t('svgImport.partNumber', { number: part.index + 1 })));
      label.appendChild(node('span', 'svg-import-mixed', t('svgImport.mixed')));
      row.appendChild(label);
      const seg = node('div', 'segmented svg-import-segmented');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', partLabel(part) + ' · ' + t('svgImport.partNumber', { number: part.index + 1 }));
      for (const mode of MODES) {
        const b = button('svgImport.mode.' + mode, 'seg'); b.dataset.mode = mode;
        b.addEventListener('click', () => {
          entry.partIds.forEach(id => { draftModes[id] = mode; });
          changed();
        });
        seg.appendChild(b);
      }
      row.appendChild(seg);
      const show = () => drawParts(highlight, parts, true);
      row.addEventListener('mouseenter', show);
      row.addEventListener('mouseleave', () => highlight.replaceChildren());
      row.addEventListener('focusin', show);
      row.addEventListener('focusout', e => { if (!row.contains(e.relatedTarget)) highlight.replaceChildren(); });
      rows.appendChild(row);
    }
    syncRows();
  }
  function updateText() {
    applyI18n(dialog);
    q('.svg-import-parts-head h3').textContent = t('svgImport.parts', { count: parsed.parts.length });
    q('.svg-import-summary').textContent = t('svgImport.summary', {
      count: parsed.parts.length, off: Object.values(draftModes).filter(mode => mode === 'off').length,
    });
    q('.svg-import-width output').textContent = t('svgImport.widthValue', {
      width: number(draftOptions.outlineWidth),
      mm: previewExtent > 0 ? number(draftOptions.outlineWidth * legendSize / previewExtent) : '—',
    });
    printSvg.setAttribute('aria-label', t('svgImport.willPrint'));
    q('.svg-import-warnings').replaceChildren(...[...new Set(parsed.warnings || [])].map(key => node('p', 'hint', t(key))));
  }
  function renderPreview() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (closed) return;
    let cs = null;
    const error = q('.svg-import-error');
    try {
      cs = buildSvgCrossSection(wasm, parsed, draftModes, draftOptions);
      printPath.setAttribute('d', pathData(cs.toPolygons()));
      const b = cs.bounds(); previewExtent = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
      error.hidden = true; error.textContent = ''; use.disabled = false;
    } catch (err) {
      printPath.setAttribute('d', ''); previewExtent = 0; use.disabled = true;
      error.dataset.errorKey = err.message === 'err.svgNoShapes' ? 'svgImport.empty' : 'err.svgParse';
      error.textContent = t(error.dataset.errorKey); error.hidden = false;
    } finally { if (cs) cs.delete(); }
    updateText();
  }
  function changed() {
    syncRows(); updateText();
    use.disabled = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(renderPreview, 60);
  }
  groupToggle.addEventListener('change', () => { grouped = groupToggle.checked; renderRows(); });
  width.addEventListener('input', () => { draftOptions.outlineWidth = Number(width.value); changed(); });
  invert.addEventListener('change', () => { draftOptions.invert = invert.checked; changed(); });
  reset.addEventListener('click', () => {
    draftModes = { ...auto }; draftOptions = { ...defaults };
    width.value = draftOptions.outlineWidth; invert.checked = draftOptions.invert; changed();
  });
  allFill.addEventListener('click', () => { Object.keys(draftModes).forEach(id => { draftModes[id] = 'fill'; }); changed(); });
  allOff.addEventListener('click', () => { Object.keys(draftModes).forEach(id => { draftModes[id] = 'off'; }); changed(); });

  return new Promise(resolve => {
    const finish = result => {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('langchange', relabel);
      dialog.close(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(result);
    };
    const accept = () => {
      if (timer) renderPreview();
      if (!use.disabled) finish({ modes: { ...draftModes }, options: { ...draftOptions } });
    };
    const relabel = () => {
      updateText(); renderRows();
      const error = q('.svg-import-error');
      if (!error.hidden) error.textContent = t(error.dataset.errorKey);
    };
    closeButton.addEventListener('click', () => finish(null));
    cancel.addEventListener('click', () => finish(null));
    use.addEventListener('click', accept);
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); });
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
          .filter(n => n.getClientRects().length);
        const index = focusable.indexOf(document.activeElement);
        if (index < 0 || (e.shiftKey && index === 0) || (!e.shiftKey && index === focusable.length - 1)) {
          e.preventDefault();
          focusable[e.shiftKey ? focusable.length - 1 : 0]?.focus();
        }
      }
      // Buttons retain their native Enter activation (including Cancel / All off).
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); accept(); }
      e.stopPropagation();
    });
    window.addEventListener('langchange', relabel);
    renderRows(); renderPreview();
    document.body.appendChild(dialog);
    dialog.showModal(); use.focus();
  });
}
