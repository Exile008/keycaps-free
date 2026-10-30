// ============================================================================
// main.js — app state, UI binding and the regeneration loop.  Built for T3.
// See docs/SPEC.md §8.  Core modules (params / keycap / legend / export /
// manifold-loader) are imported dynamically so a missing one degrades to a
// translated "core module missing" status instead of crashing.
// ============================================================================

import {
  t, getLang, setLang, toggleLang, applyI18n, assertDictionaryParity,
} from './i18n.js';
import { createViewer } from './viewer.js';
import { createTopView } from './topview.js';
import { createDepthPreview } from './depth-preview.js';

// ---------------------------------------------------------------------------
// fallbacks (used only if js/params.js is not available yet)
// ---------------------------------------------------------------------------
const FALLBACK_DEFAULT_PARAMS = {
  unitW: 1, unitD: 1, pitch: 19.05, gap: 1.05,
  extL: 0, extR: 0, extF: 0, extB: 0,
  insetL: 2.6, insetR: 2.6, insetF: 3.4, insetB: 1.2,
  height: 8.0, tiltX: 5, tiltY: 0,
  rBottom: 0.6, rTop: 2.0,
  dishType: 'cylindrical', dishDepth: 0.8,
  wall: 1.5, topThickness: 1.5,
  stemType: 'mx', stemOuterD: 6.05, stemCrossLen: 4.4, stemCrossH: 1.375,
  stemCrossV: 1.21, stemCrossDepth: 4.0, stemTolerance: 0, stemZ: 0.0,
  stemFillet: 1.0, stemRibs: 'none', ribThickness: 1.0, ribHeight: 2.0,
  stemSeparate: false, stemColor: '#f2f2f2',
  stabilizers: 'auto', homingBump: false,
  legendMode: 'inlay', legendSize: 8, legendDepth: 0.6,
  legendRot: 0, legendX: 0, legendY: 0, legendMirror: false,
  capColor: '#1c1c1e', legendColor: '#f2f2f2',
};
const FALLBACK_RANGES = {
  unitW: { min: 1, max: 7, step: 0.25 }, unitD: { min: 1, max: 3, step: 0.25 },
  gap: { min: 0, max: 3, step: 0.05 },
  extL: { min: -3, max: 6, step: 0.1 }, extR: { min: -3, max: 6, step: 0.1 },
  extF: { min: -3, max: 6, step: 0.1 }, extB: { min: -3, max: 6, step: 0.1 },
  insetL: { min: 0.3, max: 8, step: 0.1 }, insetR: { min: 0.3, max: 8, step: 0.1 },
  insetF: { min: 0.3, max: 8, step: 0.1 }, insetB: { min: 0.3, max: 8, step: 0.1 },
  height: { min: 3, max: 18, step: 0.1 }, tiltX: { min: -20, max: 20, step: 0.5 },
  tiltY: { min: -20, max: 20, step: 0.5 },
  rBottom: { min: 0.1, max: 4, step: 0.1 }, rTop: { min: 0.1, max: 6, step: 0.1 },
  dishDepth: { min: 0, max: 2.5, step: 0.05 }, wall: { min: 0.8, max: 3, step: 0.05 },
  topThickness: { min: 0.8, max: 4, step: 0.05 },
  stemOuterD: { min: 4.5, max: 6.5, step: 0.1 }, stemCrossDepth: { min: 3.6, max: 6, step: 0.1 },
  stemTolerance: { min: -0.2, max: 0.3, step: 0.05 }, stemZ: { min: 0, max: 3, step: 0.1 },
  stemFillet: { min: 0, max: 3, step: 0.1 },
  ribThickness: { min: 0.6, max: 2.0, step: 0.05 }, ribHeight: { min: 0.5, max: 6, step: 0.1 },
  legendSize: { min: 2, max: 16, step: 0.5 }, legendDepth: { min: 0.2, max: 1.5, step: 0.05 },
  legendRot: { min: -180, max: 180, step: 1 },
  legendX: { min: -8, max: 8, step: 0.1 }, legendY: { min: -8, max: 8, step: 0.1 },
};
const FALLBACK_SIZE_LIST = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 3, 6, 6.25, 7];
const BUNDLED_FALLBACK = {
  'inter-bold': { url: './fonts/inter-bold.ttf' },
  'jetbrains-mono-bold': { url: './fonts/jetbrains-mono-bold.ttf' },
  'orbitron-bold': { url: './fonts/orbitron-bold.ttf' },
  'bebas-neue': { url: './fonts/bebas-neue.ttf' },
};

// ---------------------------------------------------------------------------
// core module registry
// ---------------------------------------------------------------------------
const core = {
  params: null, keycap: null, legend: null, exporter: null, svg: null, loader: null,
  wasm: null, svgDialog: null,
};

async function loadCore() {
  const tryImport = async (p) => { try { return await import(p); } catch (_) { return null; } };
  core.params = await tryImport('./params.js');
  core.keycap = await tryImport('./keycap.js');
  core.loader = await tryImport('./manifold-loader.js');
  core.legend = await tryImport('./legend-core.js');
  core.exporter = await tryImport('./export.js');
  core.svg = await tryImport('./svg-legend.js');
  core.svgDialog = await tryImport('./svg-import-dialog.js');
}

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const state = {
  params: { ...FALLBACK_DEFAULT_PARAMS },
  legendSource: { kind: 'text', text: 'A', fontId: 'inter-bold' },
  activePreset: null,
  customFonts: [],   // { id, name, buffer:ArrayBuffer, font }
  uploadedSvgs: [],  // { name, svgText, partModes, svgOptions }
  lang: getLang(),
  theme: 'dark',
};
let linkLR = false;

const ui = { rows: {}, extraRows: {}, fonts: [], currentStatus: null, warnings: [] };

// convenience accessors that prefer the core modules when present
const RANGES = () => (core.params && core.params.PARAM_RANGES) || FALLBACK_RANGES;
const DEFAULTS = () => (core.params && core.params.DEFAULT_PARAMS) || FALLBACK_DEFAULT_PARAMS;
const SIZE_LIST = () => (core.params && core.params.SIZE_LIST) || FALLBACK_SIZE_LIST;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function i18nEl(tag, cls, key) {
  const n = el(tag, cls, t(key));
  n.setAttribute('data-i18n', key);
  return n;
}

// ---------------------------------------------------------------------------
// viewer / topview
// ---------------------------------------------------------------------------
let viewer = null;
let topview = null;
let depthPreview = null;
let editingSlider = false;
let refitRequested = false;

function setupViewer() {
  const vp = $('#viewport');
  if (vp) viewer = createViewer(vp);
  const tv = $('#topview');
  if (tv) topview = createTopView(tv, core.keycap || {});

  $$('.view-buttons .btn-seg').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.view-buttons .btn-seg').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      if (viewer) viewer.setView(b.dataset.view);
    });
  });
  const iso = $('.view-buttons .btn-seg[data-view="iso"]');
  if (iso) iso.classList.add('is-active');
  const reframe = $('#btn-reframe');
  if (reframe && viewer) reframe.addEventListener('click', () => viewer.frame());
}

// ---------------------------------------------------------------------------
// status + warnings
// ---------------------------------------------------------------------------
function setStatus(key, cls = 'ok', vars) {
  ui.currentStatus = { key, cls, vars };
  const text = $('#status-text');
  const line = $('#status-line');
  if (text) {
    text.removeAttribute('data-i18n');
    text.textContent = t(key, vars);
  }
  if (line) {
    line.classList.remove('is-busy', 'is-warn', 'is-error');
    if (cls === 'busy') line.classList.add('is-busy');
    else if (cls === 'warn') line.classList.add('is-warn');
    else if (cls === 'error') line.classList.add('is-error');
  }
}

function renderWarnings(keys) {
  ui.warnings = Array.from(new Set(keys || []));
  const box = $('#warning-chips');
  if (!box) return;
  box.innerHTML = '';
  for (const k of ui.warnings) {
    const isErr = k.startsWith('err.');
    const chip = el('span', 'chip' + (isErr ? ' err' : ''), t(k));
    chip.dataset.warnKey = k;
    box.appendChild(chip);
  }
}

function setStats(result, parts) {
  const box = $('#stats');
  if (!box) return;
  if (!result) { box.textContent = t('stats.empty'); return; }
  let tris = result.stats && result.stats.tris;
  if (tris == null) tris = (parts || []).reduce((a, p) => a + (p.indices.length / 3), 0);
  const ms = result.stats && result.stats.ms;
  box.textContent = `${Math.round(tris).toLocaleString()} ${t('stats.tris')} · ${Math.round(ms || 0)} ${t('stats.ms')}`;
}

// ---------------------------------------------------------------------------
// generic control rows
// ---------------------------------------------------------------------------
function labelFor(key, customLabelKey, tipKey, noTip) {
  const wrap = el('span', 'prow-label');
  const lab = i18nEl('label', '', customLabelKey || ('label.' + key));
  lab.htmlFor = `control-${key}-0`;
  wrap.appendChild(lab);
  if (!noTip && (tipKey || (!key.startsWith('__')))) {
    const k = tipKey || ('tip.' + key);
    const tip = el('button', 'tip', '?');
    tip.type = 'button';
    tip.setAttribute('data-i18n-title', k);
    tip.setAttribute('title', t(k));
    tip.setAttribute('data-i18n-aria', k);
    tip.setAttribute('aria-label', t(k));
    wrap.appendChild(tip);
  }
  return wrap;
}

function rangeRow(key, opts = {}) {
  const r = RANGES()[key] || { min: 0, max: 1, step: 0.1 };
  const unit = opts.unit != null ? opts.unit : 'mm';
  const row = el('div', 'prow');
  row.dataset.key = key;

  const head = el('div', 'prow-head');
  head.appendChild(labelFor(key, opts.labelKey, opts.tipKey));
  const val = el('div', 'prow-value');
  const num = el('input', 'num');
  num.type = 'number';
  num.min = r.min; num.max = r.max; num.step = r.step;
  num.setAttribute('aria-label', t(opts.labelKey || ('label.' + key)));
  val.appendChild(num);
  if (unit) val.appendChild(el('span', 'unit', unit));
  head.appendChild(val);

  const slider = el('input', 'slider');
  slider.type = 'range';
  slider.min = r.min; slider.max = r.max; slider.step = r.step;
  slider.setAttribute('aria-label', t(opts.labelKey || ('label.' + key)));

  row.appendChild(head);
  row.appendChild(slider);

  const apply = (v) => {
    let x = Number(v);
    if (!Number.isFinite(x)) x = state.params[key];
    x = Math.min(r.max, Math.max(r.min, x));
    state.params[key] = x;
    num.value = fmtNum(x);
    slider.value = x;
    onParamChanged(key, x);
  };
  slider.addEventListener('input', () => {
    editingSlider = true;
    apply(slider.value);
  });
  slider.addEventListener('change', () => {
    editingSlider = false;
    if (viewer) viewer.frameIfNeeded();
  });
  num.addEventListener('change', () => apply(num.value));

  ui.rows[key] = { kind: 'range', num, slider, range: r };
  return row;
}

function fmtNum(v) {
  const s = String(Math.round(v * 1000) / 1000);
  return s;
}

function toggleRow(key, labelKey, tipKey, values) {
  const row = el('div', 'prow prow-toggle');
  row.dataset.key = key;
  row.appendChild(labelFor(key, labelKey, tipKey));
  const sw = el('label', 'switch');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.setAttribute('aria-label', t(labelKey || ('label.' + key)));
  const track = el('span', 'track');
  track.appendChild(el('span', 'knob'));
  sw.appendChild(cb); sw.appendChild(track);
  row.appendChild(sw);
  // `values` = { on, off } stores non-boolean values (e.g. stemRotate 90 / 0).
  cb.addEventListener('change', () => {
    const v = values ? (cb.checked ? values.on : values.off) : cb.checked;
    state.params[key] = v;
    onParamChanged(key, v);
  });
  ui.rows[key] = { kind: 'toggle', input: cb, values };
  return row;
}

// Collapsible "Advanced" sub-section holding extra rows.
function advancedBox(rows) {
  const box = el('details', 'adv');
  box.appendChild(i18nEl('summary', '', 'label.advanced'));
  for (const r of rows) box.appendChild(r);
  return box;
}

function selectRow(key, options, opts = {}) {
  const row = el('div', 'prow');
  row.dataset.key = key;
  const head = el('div', 'prow-head');
  head.appendChild(labelFor(key, opts.labelKey, opts.tipKey, opts.noTip));
  row.appendChild(head);
  const sel = el('select');
  sel.setAttribute('aria-label', t(opts.labelKey || ('label.' + key)));
  for (const o of options) {
    const opt = el('option', '', t(o.key));
    opt.value = o.value;
    opt.setAttribute('data-i18n', o.key);
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    if (opts.onChange) { opts.onChange(sel.value); return; }
    state.params[key] = sel.value;
    onParamChanged(key, sel.value);
  });
  row.appendChild(sel);
  if (opts.register !== false) ui.rows[key] = { kind: 'select', select: sel };
  return row;
}

function segmentedRow(key, options, opts = {}) {
  const row = el('div', 'prow');
  row.dataset.key = key;
  if (opts.withLabel) {
    const head = el('div', 'prow-head');
    head.appendChild(labelFor(key, opts.labelKey, opts.tipKey));
    row.appendChild(head);
  }
  const seg = el('div', 'segmented');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', t(opts.labelKey || ('label.' + key)));
  for (const o of options) {
    const b = el('button', 'seg', t(o.key));
    b.type = 'button';
    b.dataset.value = o.value;
    b.setAttribute('data-i18n', o.key);
    b.addEventListener('click', () => {
      state.params[key] = o.value;
      syncRow(key);
      onParamChanged(key, o.value);
    });
    seg.appendChild(b);
  }
  row.appendChild(seg);
  ui.rows[key] = { kind: 'segmented', seg };
  return row;
}

function stepperRow(key, step, opts = {}) {
  const r = RANGES()[key] || { min: -1, max: 1, step };
  const row = el('div', 'prow');
  row.dataset.key = key;
  const head = el('div', 'prow-head');
  head.appendChild(labelFor(key, opts.labelKey, opts.tipKey));
  const st = el('div', 'stepper');
  const minus = el('button', '', '\u2212'); minus.type = 'button';
  const num = el('input', 'num'); num.type = 'number';
  num.min = r.min; num.max = r.max; num.step = step;
  num.setAttribute('aria-label', t(opts.labelKey || ('label.' + key)));
  const plus = el('button', '', '+'); plus.type = 'button';
  st.appendChild(minus); st.appendChild(num); st.appendChild(plus);
  head.appendChild(st);
  row.appendChild(head);

  const set = (v) => {
    let x = Number(v);
    if (!Number.isFinite(x)) x = state.params[key];
    x = Math.round(x / step) * step;
    x = Math.min(r.max, Math.max(r.min, x));
    x = Math.round(x * 1000) / 1000;
    state.params[key] = x;
    num.value = fmtNum(x);
    onParamChanged(key, x);
  };
  minus.addEventListener('click', () => set(state.params[key] - step));
  plus.addEventListener('click', () => set(state.params[key] + step));
  num.addEventListener('change', () => set(num.value));

  ui.rows[key] = { kind: 'stepper', num, step, range: r };
  return row;
}

function colorRow(key, opts = {}) {
  const r = el('div', 'prow prow-toggle');
  r.dataset.key = key;
  r.appendChild(labelFor(key, opts.labelKey, opts.tipKey));
  const inp = el('input');
  inp.type = 'color';
  inp.setAttribute('aria-label', t(opts.labelKey || ('label.' + key)));
  inp.style.cssText = 'width:40px;height:26px;padding:1px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2);cursor:pointer';
  inp.addEventListener('input', () => {
    state.params[key] = inp.value;
    onParamChanged(key, inp.value);
  });
  r.appendChild(inp);
  ui.rows[key] = { kind: 'color', input: inp };
  return r;
}

function syncRow(key) {
  const row = ui.rows[key];
  if (!row) return;
  const v = state.params[key];
  if (row.kind === 'unitW') {
    row.num.value = fmtNum(v);
    row.select.value = SIZE_LIST().includes(v) ? String(v) : '__custom';
  } else if (row.kind === 'range' || row.kind === 'stepper') {
    if (row.num) row.num.value = fmtNum(v);
    if (row.slider) row.slider.value = v;
  } else if (row.kind === 'toggle') {
    row.input.checked = row.values ? v === row.values.on : !!v;
  } else if (row.kind === 'switchSize') {
    row.select.value = switchSizeValue();
  } else if (row.kind === 'segmented') {
    $$('.seg', row.seg).forEach((b) => b.classList.toggle('is-active', b.dataset.value === v));
  } else if (row.kind === 'select') {
    row.select.value = v;
  } else if (row.kind === 'color') {
    row.input.value = v;
  }
}

function syncAllRows() {
  Object.keys(ui.rows).forEach(syncRow);
  updateStemVisibility();
  updatePresetBadge();
}

// Rib sliders only apply to the cross pattern; the stem colour is only used
// when the stem is exported as its own part.
function updateStemVisibility() {
  const cross = state.params.stemRibs === 'cross';
  const separate = !!state.params.stemSeparate;
  for (const key of ['ribThickness', 'ribHeight']) {
    const row = ui.extraRows[key];
    if (row) row.style.display = cross ? '' : 'none';
  }
  const color = ui.extraRows.stemColor;
  if (color) color.style.display = separate ? '' : 'none';
  const p = state.params;
  const show = (key, on) => { const r = ui.extraRows[key]; if (r) r.style.display = on ? '' : 'none'; };
  show('chocAdv', p.stemType === 'choc');
  show('stemZ', p.stemType !== 'choc');
  show('stemRotate', p.stemType !== 'none');
  show('homingType', !!p.homingBump);
  show('skirtAdv', p.skirtStyle === 'rounded');
  show('sculptAdv', isSculptedDish(p.dishType));
  const credit = $('#klp-credit');
  if (credit) credit.hidden = !isSculptedDish(p.dishType);
}

function isSculptedDish(type) {
  return typeof type === 'string' && type.startsWith('klp');
}

// Switch / size quick selector: "<stemType>-<sizeStandard>".
const SWITCH_SIZES = ['choc-choc', 'choc-mx', 'mx-mx', 'mx-choc'];
const FALLBACK_SIZE_STANDARDS = {
  mx: { pitch: 19.05, pitchY: 19.05, gap: 1.05 },
  choc: { pitch: 18, pitchY: 17, gap: 0.5 },
};
function switchSizeValue() {
  const p = state.params;
  const v = `${p.stemType}-${p.sizeStandard}`;
  return SWITCH_SIZES.includes(v) ? v : '__custom';
}
function applySwitchSize(value) {
  const [stem, size] = value.split('-');
  const std = ((core.params && core.params.SIZE_STANDARD_VALUES) || FALLBACK_SIZE_STANDARDS)[size];
  if (!std) return;
  Object.assign(state.params, std, { stemType: stem, sizeStandard: size });
  refitRequested = true;
  onParamChanged('sizeStandard', size);
}

// called by every control when its value changes
function onParamChanged(key, value) {
  if (key === 'insetL' && linkLR) { state.params.insetR = value; syncRow('insetR'); }
  if (key === 'insetR' && linkLR) { state.params.insetL = value; syncRow('insetL'); }
  if (core.params) {
    const normalized = core.params.normalizeParams(state.params);
    state.params = normalized.params;
    ui.inputWarnings = normalized.warnings;
  }
  syncAllRows();
  updateDerived();
  if (key === 'capColor' && viewer) viewer.setColor('Keycap', value);
  if (key === 'legendColor' && viewer) viewer.setColor('Legend', value);
  if (key === 'stemColor' && viewer) viewer.setColor('Stem', value);
  scheduleBuild();
}

// ---------------------------------------------------------------------------
// static UI construction
// ---------------------------------------------------------------------------
function buildStaticUI() {
  // ---- profile ----
  const profileBody = $('#profile-body');
  if (profileBody) {
    const famOpts = (core.params && core.params.PRESET_FAMILIES)
      ? core.params.PRESET_FAMILIES.map((f) => ({ value: f, key: 'preset.' + f }))
      : ['cherry', 'oem', 'sa', 'dsa', 'xda', 'flat'].map((f) => ({ value: f, key: 'preset.' + f }));
    const onFamily = () => {
      rebuildRowOptions(ui.family.value);
      ui.rowSel.value = defaultRowFor(ui.family.value);
      applySelectedPreset();
    };
    const famRow = selectRow('__family', famOpts, { labelKey: 'label.family', register: false, onChange: onFamily, noTip: true });
    famRow.dataset.key = '__family';
    profileBody.appendChild(famRow);

    const rowOpts = ['R1', 'R2', 'R3', 'R4'].map((r) => ({ value: r, key: r }));
    const rowRow = selectRow('__row', rowOpts, { labelKey: 'label.row', register: false, onChange: applySelectedPreset, noTip: true });
    rowRow.dataset.key = '__row';
    profileBody.appendChild(rowRow);
    ui.family = famRow.querySelector('select');
    ui.rowSel = rowRow.querySelector('select');
    ui.rowRow = rowRow;

    const hint = i18nEl('p', 'hint-sm', 'preset.uniform');
    hint.id = 'preset-uniform-hint';
    hint.style.display = 'none';
    profileBody.appendChild(hint);

    // Attribution required by the KLP Lamé author; a plain link, no fetch.
    const credit = el('p', 'hint-sm klp-credit');
    credit.id = 'klp-credit';
    credit.hidden = true;
    credit.appendChild(i18nEl('span', '', 'credit.klp'));
    credit.appendChild(document.createTextNode(' '));
    const link = i18nEl('a', '', 'credit.link');
    link.href = 'https://github.com/braindefender/KLP-Lame-Keycaps';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    credit.appendChild(link);
    profileBody.appendChild(credit);

    const custom = i18nEl('option', '', 'label.custom');
    custom.value = '__custom';
    custom.disabled = true;
    ui.family.prepend(custom);
    ui.family.value = '__custom';
    ui.rowSel.value = 'R3';

    const apply = el('button', 'reset');
    apply.type = 'button';
    apply.id = 'btn-apply-preset';
    apply.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.4h-4.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
    apply.setAttribute('data-i18n-title', 'preset.reapply');
    apply.setAttribute('data-i18n-aria', 'preset.reapply');
    apply.addEventListener('click', applySelectedPreset);
    const head = $('[data-section="profile"] .card-head');
    if (head) head.insertBefore(apply, $('.reset', head));
    updatePresetRowVisibility();
  }

  // ---- size ----
  const sizeBody = $('#size-body');
  if (sizeBody) {
    const wRow = el('div', 'prow');
    wRow.dataset.key = 'unitW';
    const wHead = el('div', 'prow-head');
    wHead.appendChild(labelFor('unitW'));
    wRow.appendChild(wHead);
    const wSel = el('select');
    wSel.setAttribute('aria-label', t('label.unitW'));
    for (const s of SIZE_LIST()) {
      const opt = el('option', '', s + 'u');
      opt.value = String(s);
      wSel.appendChild(opt);
    }
    const customOpt = el('option', '', t('opt.custom'));
    customOpt.value = '__custom';
    customOpt.setAttribute('data-i18n', 'opt.custom');
    wSel.appendChild(customOpt);
    wRow.appendChild(wSel);
    const wNumWrap = el('div', 'prow-value');
    wNumWrap.style.marginTop = '4px';
    const wNum = el('input', 'num');
    wNum.type = 'number'; wNum.min = 1; wNum.max = 7; wNum.step = 0.25;
    wNum.setAttribute('aria-label', t('label.custom'));
    wNumWrap.appendChild(wNum);
    wNumWrap.appendChild(el('span', 'unit', t('unit.u')));
    wRow.appendChild(wNumWrap);
    sizeBody.appendChild(wRow);
    ui.rows.unitW = { kind: 'unitW', select: wSel, num: wNum };

    wSel.addEventListener('change', () => {
      if (wSel.value === '__custom') return;
      state.params.unitW = Number(wSel.value);
      syncRow('unitW');
      updateDerived(); scheduleBuild();
    });
    wNum.addEventListener('change', () => {
      let x = Number(wNum.value);
      if (!Number.isFinite(x)) x = state.params.unitW;
      x = Math.min(7, Math.max(1, Math.round(x * 4) / 4));
      state.params.unitW = x;
      syncRow('unitW');
      updateDerived(); scheduleBuild();
    });

    sizeBody.appendChild(rangeRow('unitD', { unit: 'u' }));

    const ssOpts = SWITCH_SIZES.map((v) => ({ value: v, key: 'switchSize.' + v }));
    const ssRow = selectRow('__switchSize', ssOpts, {
      labelKey: 'label.switchSize', tipKey: 'tip.switchSize', register: false, onChange: applySwitchSize,
    });
    const ssSel = ssRow.querySelector('select');
    const ssCustom = i18nEl('option', '', 'opt.custom');
    ssCustom.value = '__custom';
    ssCustom.disabled = true;
    ssSel.appendChild(ssCustom);
    ui.rows.__switchSize = { kind: 'switchSize', select: ssSel };
    sizeBody.appendChild(ssRow);
  }

  // ---- top face ----
  const tf = $('#topface-body');
  if (tf) {
    tf.appendChild(rangeRow('insetL'));
    tf.appendChild(rangeRow('insetR'));

    const linkRow = el('div', 'prow prow-toggle');
    linkRow.appendChild(labelFor('linkLR', 'label.linkLR', 'tip.linkLR'));
    const sw = el('label', 'switch');
    const cb = el('input'); cb.type = 'checkbox';
    cb.setAttribute('aria-label', t('label.linkLR'));
    const track = el('span', 'track'); track.appendChild(el('span', 'knob'));
    sw.appendChild(cb); sw.appendChild(track);
    linkRow.appendChild(sw);
    cb.addEventListener('change', () => {
      linkLR = cb.checked;
      if (linkLR) {
        state.params.insetR = state.params.insetL;
        onParamChanged('insetR', state.params.insetR);
      }
    });
    tf.appendChild(linkRow);

    tf.appendChild(rangeRow('insetF'));
    tf.appendChild(rangeRow('insetB'));

    const derived = el('div', 'derived');
    derived.appendChild(i18nEl('span', 'k', 'label.topSize'));
    const v = el('span', 'v', '—'); v.id = 'derived-top';
    derived.appendChild(v);
    tf.appendChild(derived);
  }

  // ---- extension ----
  const ext = $('#ext-body');
  if (ext) ['extL', 'extR', 'extF', 'extB'].forEach((k) => ext.appendChild(rangeRow(k)));

  // ---- height & tilt ----
  const ht = $('#height-body');
  if (ht) {
    ht.appendChild(rangeRow('height'));
    ht.appendChild(rangeRow('tiltX', { unit: '°' }));
    ht.appendChild(rangeRow('tiltY', { unit: '°' }));
  }

  // ---- corners ----
  const cor = $('#corners-body');
  if (cor) {
    cor.appendChild(rangeRow('rBottom'));
    cor.appendChild(rangeRow('rTop'));
    cor.appendChild(segmentedRow('skirtStyle', [
      { value: 'straight', key: 'skirt.straight' }, { value: 'rounded', key: 'skirt.rounded' },
    ], { labelKey: 'label.skirtStyle', tipKey: 'tip.skirtStyle', withLabel: true }));
    ui.extraRows.skirtAdv = advancedBox([rangeRow('skirtStraight'), rangeRow('skirtRadius')]);
    cor.appendChild(ui.extraRows.skirtAdv);
  }

  // ---- dish ----
  const dish = $('#dish-body');
  if (dish) {
    dish.appendChild(segmentedRow('dishType', [
      { value: 'cylindrical', key: 'dish.cylindrical' },
      { value: 'spherical', key: 'dish.spherical' },
      { value: 'flat', key: 'dish.flat' },
      { value: 'klp', key: 'dish.klp' },
      { value: 'klp-thumb', key: 'dish.klpThumb' },
      { value: 'klp-saddle', key: 'dish.klpSaddle' },
    ], { labelKey: 'label.dishType', tipKey: 'tip.dishType', withLabel: true }));
    dish.appendChild(rangeRow('dishDepth'));
    ui.extraRows.sculptAdv = advancedBox([rangeRow('sculptRim'), rangeRow('sculptDrop')]);
    dish.appendChild(ui.extraRows.sculptAdv);
  }

  // ---- shell ----
  const shell = $('#shell-body');
  if (shell) { shell.appendChild(rangeRow('wall')); shell.appendChild(rangeRow('topThickness')); }

  // ---- stem ----
  const stem = $('#stem-body');
  if (stem) {
    stem.appendChild(segmentedRow('stemType', [
      { value: 'mx', key: 'stem.mx' }, { value: 'choc', key: 'stem.choc' }, { value: 'none', key: 'stem.none' },
    ], { labelKey: 'label.stemType', tipKey: 'tip.stemType', withLabel: true }));
    ui.extraRows.stemRotate = toggleRow('stemRotate', null, null, { on: 90, off: 0 });
    stem.appendChild(ui.extraRows.stemRotate);
    stem.appendChild(stepperRow('stemTolerance', 0.05));
    ui.extraRows.stemZ = rangeRow('stemZ');
    stem.appendChild(ui.extraRows.stemZ);
    ui.extraRows.chocAdv = advancedBox(['chocProngW', 'chocProngL', 'chocSpacing', 'chocProngZ'].map((k) => rangeRow(k)));
    stem.appendChild(ui.extraRows.chocAdv);
    stem.appendChild(rangeRow('stemFillet'));
    stem.appendChild(segmentedRow('stemRibs', [
      { value: 'none', key: 'stemRibs.none' }, { value: 'cross', key: 'stemRibs.cross' },
    ], { labelKey: 'label.stemRibs', tipKey: 'tip.stemRibs', withLabel: true }));
    const ribThickness = rangeRow('ribThickness');
    const ribHeight = rangeRow('ribHeight');
    ui.extraRows.ribThickness = ribThickness;
    ui.extraRows.ribHeight = ribHeight;
    stem.appendChild(ribThickness);
    stem.appendChild(ribHeight);
    stem.appendChild(toggleRow('stemSeparate'));
    stem.appendChild(segmentedRow('stabilizers', [
      { value: 'auto', key: 'stab.auto' }, { value: 'none', key: 'stab.none' },
    ], { labelKey: 'label.stabilizers', tipKey: 'tip.stabilizers', withLabel: true }));
    stem.appendChild(toggleRow('homingBump'));
    ui.extraRows.homingType = segmentedRow('homingType', [
      { value: 'bar', key: 'homing.bar' }, { value: 'dots3', key: 'homing.dots3' },
    ], { labelKey: 'label.homingType', tipKey: 'tip.homingType', withLabel: true });
    stem.appendChild(ui.extraRows.homingType);
  }

  // ---- right sidebar: placement / mode / colours ----
  const place = $('#placement-body');
  if (place) {
    place.appendChild(rangeRow('legendSize'));
    place.appendChild(rangeRow('legendDepth'));
    // Cross-section preview sits directly under the Depth control.
    const depthHost = el('div', 'depth-preview-host');
    depthHost.id = 'depth-preview';
    place.appendChild(depthHost);
    // Pass the core geometry helpers in instead of importing keycap.js here:
    // main.js loads core modules tolerantly, so a missing keycap.js must not
    // break the depth preview's module graph.
    depthPreview = createDepthPreview(depthHost, core.keycap || {});
    place.appendChild(rangeRow('legendRot', { unit: '°' }));
    place.appendChild(rangeRow('legendX'));
    place.appendChild(rangeRow('legendY'));
    place.appendChild(toggleRow('legendMirror'));
  }
  const mode = $('#mode-body');
  if (mode) {
    mode.appendChild(segmentedRow('legendMode', [
      { value: 'inlay', key: 'mode.inlay' },
      { value: 'recessed', key: 'mode.recessed' },
      { value: 'raised', key: 'mode.raised' },
      { value: 'shine', key: 'mode.shine' },
    ], { labelKey: 'sec.mode', tipKey: 'tip.legendMode', withLabel: true }));
  }
  const colors = $('#colors-body');
  if (colors) {
    colors.appendChild(colorRow('capColor'));
    colors.appendChild(colorRow('legendColor'));
    const stemColor = colorRow('stemColor');
    ui.extraRows.stemColor = stemColor;
    colors.appendChild(stemColor);
  }

  syncAllRows();
}

const PRESET_KEYS_FALLBACK = ['dishType', 'dishDepth', 'insetL', 'insetR', 'insetF', 'insetB', 'rTop'];
const presetKeys = () => [
  ...((core.params && core.params.PRESET_PARAM_KEYS) || PRESET_KEYS_FALLBACK),
  'height', 'tiltX', 'homingBump', 'homingType',
];

// Row list per family (R1–R4 for classic families, flat/tilted/homing for KLP).
function rowsFor(family) {
  const rows = core.params && core.params.presetRows ? core.params.presetRows(family) : [];
  return rows.length ? rows : ['R1', 'R2', 'R3', 'R4'];
}
function defaultRowFor(family) {
  const d = core.params && core.params.presetDefaultRow ? core.params.presetDefaultRow(family) : null;
  return d || 'R3';
}
function rowKey(row) {
  return /^R\d$/.test(row) ? row : 'row.' + row;
}
function rebuildRowOptions(family) {
  if (!ui.rowSel) return;
  const rows = rowsFor(family);
  const current = rows.join();
  if (ui.rowSel.dataset.rows === current) return;
  ui.rowSel.dataset.rows = current;
  ui.rowSel.replaceChildren(...rows.map((r) => {
    const opt = i18nEl('option', '', rowKey(r));
    opt.value = r;
    return opt;
  }));
}

function validPreset(value) {
  const presets = core.params && core.params.PRESETS;
  if (!value || !presets || !Object.hasOwn(presets, value.family)) return null;
  const preset = presets[value.family];
  if (preset.rows && !Object.hasOwn(preset.rows, value.row)) return null;
  return { family: value.family, row: preset.rows ? value.row : null };
}

function syncPresetControls() {
  if (!ui.family || !ui.rowSel) return;
  ui.family.value = state.activePreset ? state.activePreset.family : '__custom';
  rebuildRowOptions(ui.family.value);
  ui.rowSel.value = state.activePreset && state.activePreset.row || defaultRowFor(ui.family.value);
  updatePresetRowVisibility();
  updatePresetBadge();
}

function updatePresetBadge() {
  const badge = $('#preset-badge');
  const apply = $('#btn-apply-preset');
  if (apply) apply.disabled = !state.activePreset;
  if (!badge) return;
  const active = state.activePreset;
  badge.hidden = !active;
  if (!active) { badge.textContent = ''; return; }
  const expected = core.params.applyPreset(state.params, active.family, active.row);
  const custom = presetKeys().some((key) => expected[key] !== state.params[key]);
  const name = t('preset.' + active.family) + (active.row ? ' ' + t(rowKey(active.row)) : '');
  badge.textContent = t(custom ? 'preset.customFrom' : 'preset.active', { name });
  badge.classList.toggle('is-custom', custom);
}

function applySelectedPreset() {
  const active = validPreset({ family: ui.family.value, row: ui.rowSel.value });
  if (!active || !core.params.applyPreset) return;
  state.activePreset = active;
  state.params = core.params.applyPreset(state.params, active.family, active.row);
  syncAllRows();
  updatePresetRowVisibility();
  updateDerived();
  refitRequested = true;
  scheduleBuild(0);
  persistSession();
}

function updatePresetRowVisibility() {
  const fam = ui.family ? ui.family.value : null;
  const preset = core.params && core.params.PRESETS ? core.params.PRESETS[fam] : null;
  const uniform = preset ? !preset.rows : ['dsa', 'xda', 'flat'].includes(fam);
  if (ui.rowRow) ui.rowRow.style.display = uniform || fam === '__custom' ? 'none' : '';
  const hint = $('#preset-uniform-hint');
  if (hint) hint.style.display = uniform ? '' : 'none';
}

// ---------------------------------------------------------------------------
// derived read-outs
// ---------------------------------------------------------------------------
let lastLayout = null;
function computeLayoutSafe() {
  if (core.keycap && core.keycap.computeLayout) {
    try { return core.keycap.computeLayout(state.params); } catch (_) { return null; }
  }
  return null;
}

// Approximate fitted legend bbox for the depth preview.  The long edge is
// legendSize; the short edge keeps the source aspect ratio.  Rotation is
// applied to the bbox.  Falls back to a square before contours are loaded.
function legendInfoForPreview() {
  const src = state.legendSource;
  if (!src || src.kind === 'none') return { hasLegend: false };
  if (src.kind === 'text' && !String(src.text || '').trim()) return { hasLegend: false };
  if (src.kind === 'svg' && !src.svgText) return { hasLegend: false };
  const p = state.params;
  const size = Number(p.legendSize) || 8;
  const b = legendContourCache.key === legendCacheKey(src) ? legendContourCache.bounds : null;
  const bw = b && b.w > 0 ? b.w : 1;
  const bh = b && b.h > 0 ? b.h : 1;
  const span = Math.max(bw, bh);
  const fw = (bw / span) * size;
  const fh = (bh / span) * size;
  const a = ((Number(p.legendRot) || 0) * Math.PI) / 180;
  const ca = Math.abs(Math.cos(a));
  const sa = Math.abs(Math.sin(a));
  return { hasLegend: true, width: fw * ca + fh * sa, depth: fw * sa + fh * ca };
}

function updateDepthPreview(layout = lastLayout) {
  if (!depthPreview) return;
  depthPreview.update(state.params, layout || computeLayoutSafe(), legendInfoForPreview());
}

function updateDerived() {
  const layout = computeLayoutSafe();
  lastLayout = layout;
  const v = $('#derived-top');
  if (v) {
    if (layout && layout.top) v.textContent = `${layout.top.w.toFixed(1)} × ${layout.top.d.toFixed(1)} mm`;
    else v.textContent = '—';
  }
  if (topview) topview.update(layout, layout ? (layout.params || state.params) : state.params);
  updateDepthPreview(layout);
}

// ---------------------------------------------------------------------------
// legend source / fonts
// ---------------------------------------------------------------------------
function bundledFonts() {
  const bf = core.legend && core.legend.BUNDLED_FONTS;
  const ids = bf && typeof bf === 'object' ? Object.keys(bf) : Object.keys(BUNDLED_FALLBACK);
  return ids.map((id) => {
    let url, name;
    if (bf && typeof bf === 'object' && bf[id]) {
      if (typeof bf[id] === 'string') url = bf[id];
      else url = bf[id].url || bf[id].path || bf[id].file;
      name = bf[id].name;
    }
    if (!url) url = (BUNDLED_FALLBACK[id] && BUNDLED_FALLBACK[id].url) || `./fonts/${id}.ttf`;
    return { id, url, name: name || t('font.' + id) };
  });
}

function rebuildFontSelect() {
  const sel = $('#legend-font');
  if (!sel) return;
  sel.innerHTML = '';
  for (const f of bundledFonts()) {
    const o = el('option', '', f.name || f.id);
    o.value = f.id;
    sel.appendChild(o);
  }
  for (const f of state.customFonts) {
    const o = el('option', '', f.name);
    o.value = f.id;
    sel.appendChild(o);
  }
  if (state.legendSource.kind === 'text') {
    sel.value = state.legendSource.fontId;
    if (!sel.value && sel.options.length) {
      state.legendSource.fontId = sel.options[0].value;
      sel.value = state.legendSource.fontId;
    }
  }
}

const fontCache = new Map();
async function getFont(id) {
  if (fontCache.has(id)) return fontCache.get(id);
  let entry = null;
  const custom = state.customFonts.find((f) => f.id === id);
  if (custom) {
    if (custom.font) entry = { font: custom.font };
    else if (core.legend && core.legend.loadFont) {
      try { custom.font = await core.legend.loadFont(custom.buffer); entry = { font: custom.font }; }
      catch (_) { entry = null; }
    }
  } else {
    const info = bundledFonts().find((f) => f.id === id);
    if (info && core.legend && core.legend.loadFont) {
      try {
        const res = await fetch(info.url);
        const buf = await res.arrayBuffer();
        entry = { font: await core.legend.loadFont(buf) };
      } catch (_) { entry = null; }
    }
  }
  fontCache.set(id, entry);
  return entry;
}

// cache of legend *contours* (plain polygons) keyed by source content
let legendContourCache = {
  key: null, polygons: null, fillRule: 'NonZero', warnings: [], bounds: null,
};

function legendCacheKey(src) {
  return src.kind === 'text' ? `t|${src.fontId}|${src.text}`
    : src.kind === 'svg' ? JSON.stringify(['svg', src.name, src.svgText, src.partModes, src.svgOptions]) : 'none';
}

async function getLegendContours() {
  const src = state.legendSource;
  const key = legendCacheKey(src);
  if (legendContourCache.key === key) return legendContourCache;

  const warnings = [];
  let polygons = null;
  let fillRule = 'NonZero';

  try {
    if (src.kind === 'text') {
      if (!src.text || !src.text.trim()) {
        warnings.push('warn.legendEmpty');
      } else if (!core.legend || !core.legend.textToContours) {
        warnings.push('warn.legendUnavailable');
      } else {
        const f = await getFont(src.fontId);
        if (!f) { warnings.push('err.fontLoad'); }
        else {
          const res = core.legend.textToContours(f.font, src.text);
          if (typeof f.font.charToGlyphIndex === 'function' && Array.from(src.text).some(c => !/\s/.test(c) && !f.font.charToGlyphIndex(c))) warnings.push('warn.glyphMissing');
          if (Array.isArray(res)) polygons = res;
          else if (res && res.polygons) {
            polygons = res.polygons;
            if (res.glyphMissing || res.missing || (res.missingGlyphs && res.missingGlyphs.length)) {
              warnings.push('warn.glyphMissing');
            }
            if (Array.isArray(res.warnings)) warnings.push(...res.warnings);
          }
        }
      }
    } else if (src.kind === 'svg') {
      if (!core.svg || !core.svg.buildSvgCrossSection) {
        warnings.push('warn.legendUnavailable');
      } else if (src.svgText) {
        const parsed = core.svg.parseSvgParts(src.svgText);
        warnings.push(...(parsed.warnings || []));
        let cs = null;
        try {
          cs = core.svg.buildSvgCrossSection(await ensureWasm(), parsed,
            src.partModes || core.svg.defaultModes(parsed),
            src.svgOptions || core.svg.defaultSvgOptions(parsed));
          polygons = cs.toPolygons();
        } finally { if (cs) cs.delete(); }
      }
    }
  } catch (err) {
    warnings.push(err.message === 'err.svgNoShapes' ? 'err.svgNoShapes' : src.kind === 'svg' ? 'err.svgParse' : 'warn.legendUnavailable');
    polygons = null;
  }

  if (polygons && polygons.length === 0) { polygons = null; warnings.push('warn.legendEmpty'); }

  // Contour bbox, used only to approximate the legend band width in the
  // depth cross-section.  One pass per source change, no geometry work.
  let bounds = null;
  if (polygons) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polygons) {
      if (!Array.isArray(poly)) continue;
      for (const pt of poly) {
        if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(minY)) {
      bounds = { w: Math.max(1e-9, maxX - minX), h: Math.max(1e-9, maxY - minY) };
    }
  }

  legendContourCache = { key, polygons, fillRule, warnings, bounds };
  return legendContourCache;
}

// ---------------------------------------------------------------------------
// build loop
// ---------------------------------------------------------------------------
let buildTimer = null;
let buildToken = 0;
let lastResult = null;

function scheduleBuild(delay = 120) {
  if (buildTimer) clearTimeout(buildTimer);
  buildTimer = setTimeout(() => { buildTimer = null; build('preview'); }, Math.max(0, delay));
  // The section is cheap to redraw and gives immediate feedback while the
  // geometry build is still debounced.
  updateDepthPreview();
  persistSession();
}

async function ensureWasm() {
  if (core.wasm) return core.wasm;
  if (!core.loader || !core.loader.getManifold) throw new Error('err.coreMissing');
  setStatus('status.wasmLoading', 'busy');
  core.wasm = await core.loader.getManifold();
  return core.wasm;
}

function freeResult(res) {
  if (!res) return;
  for (const k of ['cap', 'legend', 'stem']) {
    const m = res[k];
    if (m && typeof m.delete === 'function') { try { m.delete(); } catch (_) { /* ignore */ } }
  }
}

function meshFromManifold(m) {
  const mesh = m.getMesh();
  const np = mesh.numProp || 3;
  const vp = mesh.vertProperties;
  const nv = mesh.numVert;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    positions[3 * i] = vp[i * np];
    positions[3 * i + 1] = vp[i * np + 1];
    positions[3 * i + 2] = vp[i * np + 2];
  }
  const indices = mesh.triVerts instanceof Uint32Array
    ? mesh.triVerts : new Uint32Array(mesh.triVerts);
  return { positions, indices };
}

function meshFor(m) {
  if (core.exporter && core.exporter.meshData) {
    try { return core.exporter.meshData(m); } catch (_) { /* fall through */ }
  }
  return meshFromManifold(m);
}

async function build(quality = 'preview') {
  const token = ++buildToken;

  // Normalise first — this never throws and gives us layout + warnings.
  let norm;
  if (core.params && core.params.normalizeParams) {
    norm = core.params.normalizeParams(state.params);
    state.params = norm.params;
    syncAllRows();
  } else {
    norm = { params: state.params, warnings: [] };
  }
  const warnings = [...norm.warnings, ...(ui.inputWarnings || [])];
  ui.inputWarnings = [];

  const layout = computeLayoutSafe();
  updateDerived();

  if (!core.keycap || !core.keycap.buildModel || !core.loader) {
    setStatus('status.coreMissing', 'warn');
    renderWarnings(warnings.concat('err.coreMissing'));
    return null;
  }

  let wasm;
  try {
    wasm = await ensureWasm();
  } catch (e) {
    setStatus('err.wasmLoad', 'error');
    renderWarnings(warnings.concat('err.wasmLoad'));
    return null;
  }
  if (token !== buildToken) return null;

  setStatus(quality === 'export' ? 'status.exporting' : 'status.generating', 'busy');

  // Legend contours → CrossSection (only rebuilt when the source changes).
  let legendCS = null;
  if (state.legendSource.kind !== 'none') {
    try {
      const lc = await getLegendContours();
      warnings.push(...lc.warnings);
      if (lc.polygons && core.legend && core.legend.contoursToCrossSection) {
        const baseCS = core.legend.contoursToCrossSection(wasm, lc.polygons, lc.fillRule);
        try {
          legendCS = core.legend.fitLegend
            ? core.legend.fitLegend(baseCS, {
              size: state.params.legendSize,
              rot: state.params.legendRot,
              x: state.params.legendX,
              y: state.params.legendY,
              mirror: state.params.legendMirror,
            })
            : baseCS;
        } finally { if (legendCS !== baseCS) baseCS.delete(); }
      }
    } catch (e) {
      warnings.push('warn.legendUnavailable');
    }
  }
  if (token !== buildToken) { if (legendCS) legendCS.delete(); return null; }

  let result;
  try {
    result = await core.keycap.buildModel(wasm, state.params, legendCS, { quality });
  } catch (e) {
    setStatus('err.buildFailed', 'error');
    renderWarnings(warnings.concat('err.buildFailed'));
    return null;
  } finally {
    if (legendCS) legendCS.delete();
  }
  if (token !== buildToken) { freeResult(result); return null; }

  warnings.push(...(result.warnings || []));

  const finalLayout = result.layout || layout;
  if (finalLayout && topview) topview.update(finalLayout, finalLayout.params || state.params);
  updateDepthPreview(finalLayout);
  const dv = $('#derived-top');
  if (dv && finalLayout && finalLayout.top) {
    dv.textContent = `${finalLayout.top.w.toFixed(1)} × ${finalLayout.top.d.toFixed(1)} mm`;
  }

  // Extract meshes for the viewer.
  const parts = [];
  if (result.cap) {
    const cm = meshFor(result.cap);
    parts.push({ name: 'Keycap', positions: cm.positions, indices: cm.indices, color: state.params.capColor });
  }
  if (result.legend) {
    const lm = meshFor(result.legend);
    parts.push({ name: 'Legend', positions: lm.positions, indices: lm.indices, color: state.params.legendColor });
  }
  if (result.stem) {
    const sm = meshFor(result.stem);
    parts.push({ name: 'Stem', positions: sm.positions, indices: sm.indices, color: state.params.stemColor });
  }

  if (viewer) {
    viewer.setParts(parts, { autoFrame: !editingSlider });
    if (refitRequested && !editingSlider) {
      viewer.frame();
      refitRequested = false;
    }
    viewer.setColor('Keycap', state.params.capColor);
    viewer.setColor('Legend', state.params.legendColor);
    viewer.setColor('Stem', state.params.stemColor);
  }

  // replace the previous result (free its WASM memory)
  if (lastResult && lastResult !== result) freeResult(lastResult);
  lastResult = result;

  $('#btn-export-stl-legend').disabled = !result.legend;
  $('#btn-export-stl-stem').disabled = !result.stem;
  renderWarnings(warnings);
  setStats(result, parts);

  const hasWarn = warnings.length > 0;
  setStatus(result.legend ? (hasWarn ? 'status.done' : 'status.done')
    : (state.legendSource.kind === 'none' ? 'status.ready' : state.params.legendMode === 'recessed' && !warnings.length ? 'status.done' : 'status.capOnly'),
  hasWarn ? 'warn' : 'ok');

  ui.lastParts = parts;
  return { result, parts };
}

// ---------------------------------------------------------------------------
// downloads / exports
// ---------------------------------------------------------------------------
function safeName(s) {
  return String(s || 'keycap').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'keycap';
}
function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime || 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function ensureExportQuality() {
  const out = await build('export');
  return out;
}

// 3MF metadata: credit the KLP Lamé author when a sculpted KLP top is used.
function exportMeta() {
  return isSculptedDish(state.params.dishType)
    ? { description: 'Keycap Generator - KLP Lamé–style shape (braindefender, https://github.com/braindefender/KLP-Lame-Keycaps)' }
    : {};
}

async function export3MF() {
  if (!core.exporter || !core.exporter.to3MF) { setStatus('err.coreMissing', 'warn'); return; }
  const out = await ensureExportQuality();
  if (!out || !out.result) return;
  const parts = [];
  if (out.result.cap) parts.push({ name: 'Keycap', manifold: out.result.cap, color: state.params.capColor });
  if (out.result.legend) parts.push({ name: 'Legend', manifold: out.result.legend, color: state.params.legendColor });
  if (out.result.stem) parts.push({ name: 'Stem', manifold: out.result.stem, color: state.params.stemColor });
  try {
    const bytes = core.exporter.to3MF(parts, exportMeta());
    const legend = state.legendSource.kind === 'text' ? state.legendSource.text : (state.legendSource.name || '');
    downloadBytes(bytes, `keycap_${state.params.unitW}u_${safeName(legend)}.3mf`, 'model/3mf');
  } catch (e) { setStatus('err.exportFailed', 'error'); }
}

async function exportSTL(which) {
  if (!core.exporter || !core.exporter.toSTL) { setStatus('err.coreMissing', 'warn'); return; }
  const out = await ensureExportQuality();
  if (!out || !out.result) return;
  let parts = [];
  if (which === 'cap') parts = [{ name: 'Keycap', manifold: out.result.cap }];
  else if (which === 'legend') {
    if (!out.result.legend) { setStatus('err.noLegendExport', 'warn'); return; }
    parts = [{ name: 'Legend', manifold: out.result.legend }];
  } else if (which === 'stem') {
    if (!out.result.stem) { setStatus('err.noStemExport', 'warn'); return; }
    parts = [{ name: 'Stem', manifold: out.result.stem }];
  } else {
    if (out.result.cap) parts.push({ name: 'Keycap', manifold: out.result.cap });
    if (out.result.legend) parts.push({ name: 'Legend', manifold: out.result.legend });
    if (out.result.stem) parts.push({ name: 'Stem', manifold: out.result.stem });
  }
  try {
    const bytes = core.exporter.toSTL(parts);
    downloadBytes(bytes, `keycap_${state.params.unitW}u_${which}.stl`, 'model/stl');
  } catch (e) { setStatus('err.exportFailed', 'error'); }
}

function uint8ToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function base64ToUint8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function projectSnapshot() {
  return {
    params: state.params,
    activePreset: state.activePreset,
    legendSource: state.legendSource,
    customFonts: state.customFonts.map((f) => ({ id: f.id, name: f.name, data: uint8ToBase64(f.buffer) })),
  };
}

async function saveProject() {
  let text;
  if (core.exporter && core.exporter.projectToJSON) {
    try {
      const project = JSON.parse(core.exporter.projectToJSON(projectSnapshot()));
      // Preset provenance is UI metadata; core serializers only keep model fields.
      project.activePreset = state.activePreset;
      text = JSON.stringify(project, null, 2);
    } catch (_) { text = null; }
  }
  if (!text) {
    text = JSON.stringify({ app: 'keycap-generator', version: 1, ...projectSnapshot() }, null, 2);
  }
  const legend = state.legendSource.kind === 'text' ? state.legendSource.text : (state.legendSource.name || '');
  downloadText(text, `keycap_${state.params.unitW}u_${safeName(legend)}.json`, 'application/json');
  setStatus('status.saved', 'ok');
}

async function loadProjectText(text) {
  setStatus('status.loadingProject', 'busy');
  let obj = null;
  if (core.exporter && core.exporter.projectFromJSON) {
    try { obj = core.exporter.projectFromJSON(text); } catch (_) { setStatus('err.projectLoad', 'error'); return; }
  }
  if (!obj) {
    try { obj = JSON.parse(text); } catch (_) { setStatus('err.projectLoad', 'error'); return; }
  }
  let activePreset = null;
  try { activePreset = JSON.parse(text).activePreset; } catch (_) { /* ignore */ }
  state.activePreset = validPreset(activePreset);
  syncPresetControls();
  if (obj.params) state.params = { ...DEFAULTS(), ...obj.params };
  if (obj.legendSource) state.legendSource = obj.legendSource;
  if (Array.isArray(obj.customFonts)) {
    state.customFonts = [];
    for (const f of obj.customFonts) {
      const buffer = f.data ? base64ToUint8(f.data).buffer : null;
      state.customFonts.push({ id: f.id || ('custom-' + Date.now()), name: f.name || 'font', buffer, font: null });
    }
    fontCache.clear();
  }
  if (obj.uploadedSvgs && Array.isArray(obj.uploadedSvgs)) {
    state.uploadedSvgs = obj.uploadedSvgs;
    renderSvgGallery();
  }
  rebuildFontSelect();
  syncAllRows();
  if (state.legendSource.kind === 'svg') {
    state.legendSource = svgSourceWithDefaults(state.legendSource);
    state.uploadedSvgs = [{ ...state.legendSource }];
    renderSvgGallery();
  }
  setLegendTab(state.legendSource.kind);
  if (state.legendSource.kind === 'text') {
    const ti = $('#legend-text'); if (ti) ti.value = state.legendSource.text || '';
  }
  updateDerived();
  if (buildTimer) { clearTimeout(buildTimer); buildTimer = null; }
  const loaded = await build('preview');
  persistSession();
  if (loaded) setStatus('status.loaded', 'ok');
}

// ---------------------------------------------------------------------------
// legend tabs / inputs
// ---------------------------------------------------------------------------
function setLegendTab(kind) {
  const map = { text: 'text', svg: 'svg', none: 'none' };
  const k = map[kind] || 'text';
  $$('.tab[data-legend-tab]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.legendTab === k);
    b.setAttribute('aria-selected', String(b.dataset.legendTab === k));
  });
  $$('.tabpanel[data-panel]').forEach((p) => p.classList.toggle('is-hidden', p.dataset.panel !== k));
  if (state.legendSource.kind === k) {
    if (k === 'text') {
      $('#legend-text').value = state.legendSource.text || '';
      $('#legend-font').value = state.legendSource.fontId;
    }
    return;
  }
  if (kind === 'none') state.legendSource = { kind: 'none' };
  else if (kind === 'svg') {
    const first = state.uploadedSvgs[0];
    if (first) state.legendSource = { kind: 'svg', ...first };
    else state.legendSource = { kind: 'svg', name: '', svgText: '' };
  } else {
    const ti = $('#legend-text');
    const fi = $('#legend-font');
    state.legendSource = { kind: 'text', text: ti ? ti.value : '', fontId: fi ? fi.value : 'inter-bold' };
  }
}

function svgDataUrl(text) {
  try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text))); }
  catch (_) { return ''; }
}

function svgSourceWithDefaults(source) {
  const parsed = core.svg.parseSvgParts(source.svgText);
  return {
    name: source.name, svgText: source.svgText, kind: 'svg',
    partModes: { ...core.svg.defaultModes(parsed), ...source.partModes },
    svgOptions: { ...core.svg.defaultSvgOptions(parsed), ...source.svgOptions },
  };
}

async function configureSvg(source) {
  if (!core.svg || !core.svgDialog) throw new Error('err.coreMissing');
  const parsed = core.svg.parseSvgParts(source.svgText);
  return core.svgDialog.openSvgImportDialog({
    name: source.name, svgText: source.svgText, parsed,
    modes: source.partModes, options: source.svgOptions,
    wasm: await ensureWasm(), legendSize: state.params.legendSize,
  });
}

function renderSvgGallery() {
  const gal = $('#svg-gallery');
  if (!gal) return;
  gal.innerHTML = '';
  gal.dataset.empty = t('legend.noSvg');
  for (const s of state.uploadedSvgs) {
    const tile = el('div', 'svg-gallery-item');
    const t0 = el('button', 'svg-thumb');
    t0.type = 'button';
    t0.setAttribute('aria-label', s.name);
    t0.title = s.name;
    const img = el('img');
    img.alt = s.name;
    img.src = svgDataUrl(s.svgText);
    t0.appendChild(img);
    t0.appendChild(el('span', 'name', s.name));
    const active = state.legendSource.kind === 'svg' && state.legendSource.name === s.name
      && state.legendSource.svgText === s.svgText && state.legendSource.partModes === s.partModes;
    t0.classList.toggle('is-active', active);
    t0.setAttribute('aria-pressed', String(active));
    t0.addEventListener('click', () => {
      state.legendSource = { kind: 'svg', ...s };
      renderSvgGallery();
      scheduleBuild();
    });
    const edit = el('button', 'btn btn-sm svg-thumb-edit', '✎ ' + t('svgImport.edit'));
    edit.type = 'button';
    edit.setAttribute('aria-label', t('svgImport.editFile', { name: s.name }));
    edit.addEventListener('click', async () => {
      edit.disabled = true;
      try {
        const result = await configureSvg(s);
        if (!result) return;
        s.partModes = result.modes; s.svgOptions = result.options;
        state.legendSource = { kind: 'svg', ...s };
        setLegendTab('svg'); renderSvgGallery(); scheduleBuild();
      } catch (err) { setStatus(err.message === 'err.coreMissing' ? 'err.coreMissing' : 'err.svgParse', 'error'); }
      finally {
        edit.disabled = false;
        const current = $$('.svg-gallery-item', gal)[state.uploadedSvgs.indexOf(s)];
        if (current) $('.svg-thumb-edit', current).focus();
      }
    });
    tile.append(t0, edit); gal.appendChild(tile);
  }
}

// ---------------------------------------------------------------------------
// input wiring (chrome: topbar, tabs, files, export, modal)
// ---------------------------------------------------------------------------
function bindChrome() {
  // language
  const lb = $('#btn-lang');
  if (lb) lb.addEventListener('click', () => {
    const l = toggleLang();
    state.lang = l;
    updateLangButton();
  });
  // theme
  const tb = $('#btn-theme');
  if (tb) tb.addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
  // help
  const hb = $('#btn-help');
  const modal = $('#help-modal');
  if (hb && modal) hb.addEventListener('click', () => {
    modal.classList.remove('is-hidden');
    $('[data-close-modal].btn', modal).focus();
  });
  if (modal) $$('[data-close-modal]', modal).forEach((x) => x.addEventListener('click', () => modal.classList.add('is-hidden')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && modal && !modal.classList.contains('is-hidden')) {
      const nodes = $$('button, input, select, [tabindex="0"]', modal);
      if (nodes.length && (e.shiftKey && document.activeElement === nodes[0] || !e.shiftKey && document.activeElement === nodes[nodes.length - 1])) {
        e.preventDefault();
        nodes[e.shiftKey ? nodes.length - 1 : 0].focus();
      }
    }
    if (e.key === 'Escape' && modal) modal.classList.add('is-hidden');
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveProject(); }
  });

  // legend tabs
  $$('.tab[data-legend-tab]').forEach((b) => b.addEventListener('click', () => {
    setLegendTab(b.dataset.legendTab);
    renderSvgGallery();
    scheduleBuild();
  }));

  // legend text + font
  const ti = $('#legend-text');
  if (ti) ti.addEventListener('input', () => {
    if (state.legendSource.kind !== 'text') setLegendTab('text');
    state.legendSource.text = ti.value;
    scheduleBuild();
  });
  const fs = $('#legend-font');
  if (fs) fs.addEventListener('change', () => {
    if (state.legendSource.kind !== 'text') setLegendTab('text');
    state.legendSource.fontId = fs.value;
    scheduleBuild();
  });

  // import font
  const importBtn = $('#btn-import-font');
  const ff = $('#file-font');
  if (importBtn && ff) importBtn.addEventListener('click', () => ff.click());
  if (ff) ff.addEventListener('change', async () => {
    const file = ff.files && ff.files[0];
    ff.value = '';
    if (!file) return;
    setStatus('status.importingFont', 'busy');
    try {
      const buffer = await file.arrayBuffer();
      const id = 'custom-' + safeName(file.name) + '-' + Date.now();
      let font = null;
      if (core.legend && core.legend.loadFont) {
        try { font = await core.legend.loadFont(buffer); } catch (_) { font = null; }
      }
      if (!font) { setStatus('err.fontLoad', 'error'); return; }
      state.customFonts.push({ id, name: file.name.replace(/\.[^.]+$/, ''), buffer, font });
      fontCache.set(id, font ? { font } : null);
      if (state.legendSource.kind !== 'text') setLegendTab('text');
      state.legendSource.fontId = id;
      rebuildFontSelect();
      if (fs) fs.value = id;
      setStatus('status.ready', 'ok');
      scheduleBuild();
    } catch (e) { setStatus('err.fontLoad', 'error'); }
  });

  // upload svg
  const upBtn = $('#btn-upload-svg');
  const sf = $('#file-svg');
  if (upBtn && sf) upBtn.addEventListener('click', () => sf.click());
  if (sf) sf.addEventListener('change', async () => {
    const files = Array.from(sf.files || []);
    sf.value = '';
    if (!files.length) return;
    upBtn.disabled = true;
    let imported = false, failed = false;
    try {
      for (const file of files) {
        setStatus('status.importingSvg', 'busy');
        try {
          const source = { name: file.name, svgText: await file.text() };
          const result = await configureSvg(source);
          if (!result) continue;
          source.partModes = result.modes; source.svgOptions = result.options;
          state.uploadedSvgs.push(source);
          state.legendSource = { kind: 'svg', ...source };
          imported = true;
          setLegendTab('svg'); renderSvgGallery();
        } catch (err) {
          failed = true;
          setStatus(err.message === 'err.coreMissing' ? 'err.coreMissing' : 'err.svgParse', 'error');
        }
      }
    } finally { upBtn.disabled = false; }
    if (imported) scheduleBuild();
    else if (!failed) setStatus('status.ready', 'ok');
  });

  // export buttons
  const b3 = $('#btn-export-3mf'); if (b3) b3.addEventListener('click', export3MF);
  const bc = $('#btn-export-stl-cap'); if (bc) bc.addEventListener('click', () => exportSTL('cap'));
  const bl = $('#btn-export-stl-legend'); if (bl) bl.addEventListener('click', () => exportSTL('legend'));
  const bs = $('#btn-export-stl-stem'); if (bs) bs.addEventListener('click', () => exportSTL('stem'));
  const bm = $('#btn-export-stl-merged'); if (bm) bm.addEventListener('click', () => exportSTL('merged'));
  const bb = $('#btn-export-blank'); if (bb) bb.addEventListener('click', exportBlank);
  if (bl) bl.disabled = true;
  if (bs) bs.disabled = true;

  // project
  const sp = $('#btn-save-project'); if (sp) sp.addEventListener('click', saveProject);
  const lp = $('#btn-load-project'); const pf = $('#file-project');
  if (lp && pf) lp.addEventListener('click', () => pf.click());
  if (pf) pf.addEventListener('change', async () => {
    const file = pf.files && pf.files[0];
    pf.value = '';
    if (!file) return;
    try { await loadProjectText(await file.text()); }
    catch (_) { setStatus('err.projectLoad', 'error'); }
  });

  // reset buttons per section
  $$('.reset[data-reset]').forEach((btn) => btn.addEventListener('click', () => resetSection(btn.dataset.reset)));

  // language change → relabel dynamic bits
  window.addEventListener('langchange', () => {
    state.lang = getLang();
    if (ui.currentStatus) {
      const c = ui.currentStatus;
      const text = $('#status-text');
      if (text) text.textContent = t(c.key, c.vars);
    }
    renderWarnings(ui.warnings);
    renderSvgGallery();
    updatePresetRowVisibility();
    updatePresetBadge();
    updateDerived();
    updateLangButton();
    refreshAccessibility();
    const st = $('#stats');
    if (st && ui.lastParts) {
      if (lastResult) setStats(lastResult, ui.lastParts);
    }
  });
}

async function exportBlank() {
  if (!core.exporter || (!core.exporter.toSTL && !core.exporter.to3MF)) {
    setStatus('err.coreMissing', 'warn'); return;
  }
  let blank = null;
  try {
    const wasm = await ensureWasm();
    blank = await core.keycap.buildModel(wasm, state.params, null, { quality: 'export' });
    // A blank keycap has no legend. With a separate stem, keep the two printed
    // parts separate in a 3MF; otherwise the single-part STL is unchanged.
    if (blank.stem && core.exporter.to3MF) {
      const parts = [{ name: 'Keycap', manifold: blank.cap, color: state.params.capColor }];
      parts.push({ name: 'Stem', manifold: blank.stem, color: state.params.stemColor });
      const bytes = core.exporter.to3MF(parts, exportMeta());
      downloadBytes(bytes, `keycap_${state.params.unitW}u_blank.3mf`, 'model/3mf');
    } else if (core.exporter.toSTL) {
      const parts = [{ name: 'Keycap', manifold: blank.cap }];
      if (blank.stem) parts.push({ name: 'Stem', manifold: blank.stem });
      const bytes = core.exporter.toSTL(parts);
      downloadBytes(bytes, `keycap_${state.params.unitW}u_blank.stl`, 'model/stl');
    }
  } catch (e) { setStatus('err.exportFailed', 'error'); }
  finally { freeResult(blank); }
}

function resetSection(section) {
  const d = DEFAULTS();
  const keysBySection = {
    profile: ['height', 'tiltX', 'tiltY', 'insetL', 'insetR', 'insetF', 'insetB', 'rBottom', 'rTop', 'dishType', 'dishDepth',
      'sculptRim', 'sculptDrop', 'skirtStyle', 'skirtStraight', 'skirtRadius', 'wall', 'topThickness'],
    size: ['unitW', 'unitD', 'pitch', 'pitchY', 'gap', 'sizeStandard', 'stemType'],
    topface: ['insetL', 'insetR', 'insetF', 'insetB'],
    ext: ['extL', 'extR', 'extF', 'extB'],
    height: ['height', 'tiltX', 'tiltY'],
    corners: ['rBottom', 'rTop', 'skirtStyle', 'skirtStraight', 'skirtRadius'],
    dish: ['dishType', 'dishDepth', 'sculptRim', 'sculptDrop'],
    shell: ['wall', 'topThickness'],
    stem: ['stemType', 'stemTolerance', 'stemZ', 'stemFillet', 'stemRibs', 'ribThickness', 'ribHeight', 'stemSeparate', 'stabilizers', 'homingBump',
      'stemRotate', 'chocProngW', 'chocProngL', 'chocSpacing', 'chocProngZ', 'homingType'],
    placement: ['legendSize', 'legendDepth', 'legendRot', 'legendX', 'legendY', 'legendMirror'],
    mode: ['legendMode'],
    colors: ['capColor', 'legendColor', 'stemColor'],
  };
  const keys = keysBySection[section];
  if (!keys) return;
  for (const k of keys) state.params[k] = d[k];
  if (section === 'profile') {
    state.activePreset = null;
    syncPresetControls();
    refitRequested = true;
  }
  syncAllRows();
  updateDerived();
  scheduleBuild(0);
}

// ---------------------------------------------------------------------------
// theme + lang button
// ---------------------------------------------------------------------------
function setTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  try { localStorage.setItem('kcg-theme', state.theme); } catch (_) { /* ignore */ }
}
function restoreTheme() {
  let th = 'dark';
  try { th = localStorage.getItem('kcg-theme') || 'dark'; } catch (_) { /* ignore */ }
  setTheme(th);
}
function updateLangButton() {
  const l = $('#lang-label');
  if (l) l.textContent = getLang() === 'zh' ? 'EN' : '中文';
}

function refreshAccessibility() {
  $$('.prow[data-key]').forEach(row => {
    const key = row.dataset.key;
    const label = $('.prow-label [data-i18n]', row);
    if (!label) return;
    label.id = `label-${key}`;
    $$('input, select, [role="group"]', row).forEach((input, i) => {
      input.id = `control-${key}-${i}`;
      input.setAttribute('aria-labelledby', label.id);
      input.setAttribute('aria-label', label.textContent);
    });
  });
  $$('[data-i18n-title]').forEach(node => {
    if (!node.classList.contains('tip')) node.setAttribute('aria-label', t(node.dataset.i18nTitle));
  });
}

// ---------------------------------------------------------------------------
// session persistence (params + legend text only, never uploaded files)
// ---------------------------------------------------------------------------
let persistTimer = null;
function writeSession() {
  try {
    const payload = {
      params: state.params,
      activePreset: state.activePreset,
      legendSource: state.legendSource.kind === 'text'
        ? { kind: 'text', text: state.legendSource.text, fontId: state.legendSource.fontId }
        : { kind: 'none' },
    };
    localStorage.setItem('kcg-last', JSON.stringify(payload));
  } catch (_) { /* ignore */ }
}
function persistSession() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(writeSession, 400);
}
function restoreSession() {
  try {
    const raw = localStorage.getItem('kcg-last');
    if (!raw) return;
    const obj = JSON.parse(raw);
    state.activePreset = validPreset(obj.activePreset);
    if (obj.params) {
      // Stem dimensions without a UI control always come from the current
      // defaults, so a default change is not pinned by an old session.
      const params = { ...obj.params };
      for (const k of ['stemOuterD', 'stemCrossLen', 'stemCrossH', 'stemCrossV']) delete params[k];
      state.params = { ...DEFAULTS(), ...params };
    }
    if (obj.legendSource && obj.legendSource.kind === 'text') {
      state.legendSource = obj.legendSource;
    }
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
async function init() {
  assertDictionaryParity();
  bindChrome();
  restoreTheme();
  updateLangButton();

  await loadCore();

  buildStaticUI();
  rebuildFontSelect();
  renderSvgGallery();
  setLegendTab(state.legendSource.kind);

  restoreSession();
  syncPresetControls();
  syncAllRows();
  const ti = $('#legend-text');
  if (ti && state.legendSource.kind === 'text') ti.value = state.legendSource.text || '';
  if (state.legendSource.kind === 'text' && $('#legend-font')) {
    $('#legend-font').value = state.legendSource.fontId;
  }

  applyI18n(document);
  refreshAccessibility();
  for (const section of ['placement', 'mode', 'colors']) {
    const head = $(`[data-section="${section}"] .card-head`);
    if (head && !$('.reset', head)) {
      const button = el('button', 'reset');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.4h4.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
      button.type = 'button';
      button.setAttribute('data-i18n-title', 'btn.reset');
      button.setAttribute('data-i18n-aria', 'btn.reset');
      button.title = t('btn.reset');
      button.setAttribute('aria-label', t('btn.reset'));
      button.addEventListener('click', () => resetSection(section));
      head.appendChild(button);
    }
  }
  setupViewer();

  updateDerived();

  // Flush debounced changes when the user reloads or leaves the page.
  window.addEventListener('pagehide', writeSession);

  scheduleBuild(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
