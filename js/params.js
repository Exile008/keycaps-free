// Parametric keycap generator — parameter defaults, ranges, presets and
// normalisation. Pure module: no DOM, no window. Runs in Node for tests.
// See docs/SPEC.md §4.

export const DEFAULT_PARAMS = {
  // size
  unitW: 1,
  unitD: 1,
  pitch: 19.05,
  pitchY: null,          // null = same as pitch (Choc: 17)
  gap: 1.05,
  sizeStandard: 'mx',    // UI helper: 'mx' | 'choc' | 'custom'
  // bottom footprint per-side extension (mm)
  extL: 0, extR: 0, extF: 0, extB: 0,
  // top face per-side inset (mm)
  insetL: 2.6, insetR: 2.6, insetF: 3.4, insetB: 1.2,
  // height & tilt
  height: 8.0,
  tiltX: 5,
  tiltY: 0,
  // corners
  rBottom: 0.6,
  rTop: 2.0,
  // skirt profile
  skirtStyle: 'straight',
  skirtStraight: 1.5,
  skirtRadius: 6.7,
  // dish
  dishType: 'cylindrical',
  dishDepth: 0.8,
  sculptRim: 0.86,
  sculptDrop: 0.85,
  // shell
  wall: 1.5,
  topThickness: 1.5,
  // stem
  stemType: 'mx',
  stemOuterD: 5.5,
  stemCrossLen: 4.0,
  stemCrossH: 1.25,
  stemCrossV: 1.10,
  stemCrossDepth: 4.0,
  stemTolerance: 0,
  stemZ: 0.0,
  stemRotate: 0,
  // Kailh Choc v1 prongs
  chocProngW: 1.2,
  chocProngL: 3.0,
  chocSpacing: 5.7,
  chocProngZ: -0.5,
  // stem/top reinforcement
  stemFillet: 1.0,
  stemRibs: 'none',
  ribThickness: 1.0,
  ribHeight: 2.0,
  // separate stem part (multi-colour / multi-material printing)
  stemSeparate: false,
  stemColor: '#f2f2f2',
  stabilizers: 'auto',
  homingBump: false,
  homingType: 'bar',
  // legend
  legendMode: 'inlay',
  legendSize: 8,
  legendDepth: 0.6,
  legendRot: 0,
  legendX: 0,
  legendY: 0,
  legendMirror: false,
  // colours
  capColor: '#1c1c1e',
  legendColor: '#f2f2f2',
};

// min/max/step per key — also consumed by the UI sliders.
export const PARAM_RANGES = {
  unitW: { min: 1, max: 7, step: 0.25 },
  unitD: { min: 1, max: 3, step: 0.25 },
  pitchY: { min: 15, max: 20, step: 0.05 },
  gap: { min: 0, max: 3, step: 0.05 },
  extL: { min: -3, max: 6, step: 0.1 },
  extR: { min: -3, max: 6, step: 0.1 },
  extF: { min: -3, max: 6, step: 0.1 },
  extB: { min: -3, max: 6, step: 0.1 },
  insetL: { min: 0.3, max: 8, step: 0.1 },
  insetR: { min: 0.3, max: 8, step: 0.1 },
  insetF: { min: 0.3, max: 8, step: 0.1 },
  insetB: { min: 0.3, max: 8, step: 0.1 },
  height: { min: 3, max: 18, step: 0.1 },
  tiltX: { min: -20, max: 20, step: 0.5 },
  tiltY: { min: -20, max: 20, step: 0.5 },
  rBottom: { min: 0.1, max: 6, step: 0.1 },
  rTop: { min: 0.1, max: 6, step: 0.1 },
  dishDepth: { min: 0, max: 2.5, step: 0.05 },
  sculptRim: { min: 0.3, max: 3, step: 0.01 },
  sculptDrop: { min: 0, max: 3, step: 0.05 },
  skirtStraight: { min: 0, max: 4, step: 0.1 },
  skirtRadius: { min: 2, max: 20, step: 0.1 },
  wall: { min: 0.8, max: 3, step: 0.05 },
  topThickness: { min: 0.8, max: 4, step: 0.05 },
  stemOuterD: { min: 4.5, max: 6.5, step: 0.1 },
  stemCrossDepth: { min: 3.6, max: 6, step: 0.1 },
  stemTolerance: { min: -0.2, max: 0.3, step: 0.05 },
  stemZ: { min: 0, max: 3, step: 0.1 },
  chocProngW: { min: 0.7, max: 1.7, step: 0.05 },
  chocProngL: { min: 2.5, max: 3.5, step: 0.05 },
  chocSpacing: { min: 5.2, max: 6.2, step: 0.05 },
  chocProngZ: { min: -1, max: 0, step: 0.05 },
  stemFillet: { min: 0, max: 3, step: 0.1 },
  ribThickness: { min: 0.6, max: 2.0, step: 0.05 },
  ribHeight: { min: 0.5, max: 6, step: 0.1 },
  legendSize: { min: 2, max: 16, step: 0.5 },
  legendDepth: { min: 0.2, max: 1.5, step: 0.05 },
  legendRot: { min: -180, max: 180, step: 1 },
  legendX: { min: -8, max: 8, step: 0.1 },
  legendY: { min: -8, max: 8, step: 0.1 },
};

export const SIZE_LIST = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 3, 6, 6.25, 7];

export const SCULPT_TYPES = ['klp', 'klp-thumb', 'klp-saddle'];
const DISH_TYPES = ['cylindrical', 'spherical', 'flat', ...SCULPT_TYPES];
const STEM_TYPES = ['mx', 'choc', 'none'];
const SIZE_STANDARDS = ['mx', 'choc', 'custom'];
const SKIRT_STYLES = ['straight', 'rounded'];
const HOMING_TYPES = ['bar', 'dots3'];

// pitch / pitchY / gap set by the size-standard helper (SPEC §10).
export const SIZE_STANDARD_VALUES = {
  mx: { pitch: 19.05, pitchY: 19.05, gap: 1.05 },
  choc: { pitch: 18, pitchY: 17, gap: 0.5 },
};
const STAB_MODES = ['auto', 'none'];
const STEM_RIBS = ['none', 'cross'];
const LEGEND_MODES = ['inlay', 'recessed', 'raised', 'shine'];

// §4.3 — approximate starting points. rows override height & tiltX.
export const PRESETS = {
  cherry: {
    dishType: 'cylindrical', dishDepth: 0.6,
    insetL: 2.6, insetR: 2.6, insetF: 3.4, insetB: 1.2, rTop: 2.0,
    rows: {
      R1: { height: 9.4, tiltX: 9 },
      R2: { height: 7.9, tiltX: 5 },
      R3: { height: 7.4, tiltX: 1 },
      R4: { height: 7.6, tiltX: -6 },
    },
  },
  oem: {
    dishType: 'cylindrical', dishDepth: 0.7,
    insetL: 2.5, insetR: 2.5, insetF: 3.6, insetB: 1.0, rTop: 2.0,
    rows: {
      R1: { height: 11.9, tiltX: 10 },
      R2: { height: 9.9, tiltX: 6 },
      R3: { height: 9.4, tiltX: 2 },
      R4: { height: 10.4, tiltX: -6 },
    },
  },
  sa: {
    dishType: 'spherical', dishDepth: 1.0,
    insetL: 2.3, insetR: 2.3, insetF: 2.6, insetB: 2.0, rTop: 3.0,
    rows: {
      R1: { height: 14.9, tiltX: 13 },
      R2: { height: 12.9, tiltX: 7 },
      R3: { height: 12.4, tiltX: 0 },
      R4: { height: 12.9, tiltX: -7 },
    },
  },
  dsa: {
    dishType: 'spherical', dishDepth: 1.0,
    insetL: 2.65, insetR: 2.65, insetF: 2.65, insetB: 2.65, rTop: 2.0,
    uniform: { height: 7.6, tiltX: 0 },
  },
  xda: {
    dishType: 'spherical', dishDepth: 0.6,
    insetL: 1.0, insetR: 1.0, insetF: 1.0, insetB: 1.0, rTop: 2.5,
    uniform: { height: 9.1, tiltX: 0 },
  },
  flat: {
    dishType: 'flat', dishDepth: 0,
    insetL: 2.0, insetR: 2.0, insetF: 2.0, insetB: 2.0, rTop: 1.5,
    uniform: { height: 6.0, tiltX: 0 },
  },
};

// KLP Lamé–style low-profile families, shaped after braindefender's KLP Lamé
// (https://github.com/braindefender/KLP-Lame-Keycaps). This is a parametric
// re-creation; none of the author's meshes are bundled.
const KLP_COMMON = {
  dishDepth: 0.85, sculptRim: 0.86, sculptDrop: 0.85,
  insetL: 1.44, insetR: 1.44, insetF: 1.44, insetB: 1.44,
  rTop: 3.2, rBottom: 4.3,
  skirtStyle: 'rounded', skirtStraight: 1.5, skirtRadius: 6.7,
  wall: 0.9, topThickness: 1.5,
};
const KLP_ROWS = {
  flat: { height: 5.65, tiltX: 0, homingBump: false },
  tilted: { height: 7.45, tiltX: 15, homingBump: false },
  homing: { height: 5.65, tiltX: 0, homingBump: true, homingType: 'dots3' },
};
PRESETS.klp = { dishType: 'klp', ...KLP_COMMON, rows: { ...KLP_ROWS }, defaultRow: 'flat' };
PRESETS['klp-thumb'] = { dishType: 'klp-thumb', ...KLP_COMMON, rows: { flat: KLP_ROWS.flat }, defaultRow: 'flat' };
PRESETS['klp-saddle'] = { dishType: 'klp-saddle', ...KLP_COMMON, rows: { ...KLP_ROWS }, defaultRow: 'flat' };

// Keys a preset may set besides its row keys. Everything else is kept.
export const PRESET_PARAM_KEYS = [
  'dishType', 'dishDepth', 'insetL', 'insetR', 'insetF', 'insetB', 'rTop',
  'rBottom', 'sculptRim', 'sculptDrop', 'skirtStyle', 'skirtStraight', 'skirtRadius',
  'wall', 'topThickness',
];

export const PRESET_FAMILIES = Object.keys(PRESETS);
export const PRESET_ROWS = ['R1', 'R2', 'R3', 'R4'];

export function isKlpFamily(family) {
  return typeof family === 'string' && family.startsWith('klp');
}

export function presetRows(family) {
  const preset = PRESETS[family];
  return preset && preset.rows ? Object.keys(preset.rows) : [];
}

export function presetDefaultRow(family) {
  const preset = PRESETS[family];
  if (!preset || !preset.rows) return null;
  return preset.defaultRow || (preset.rows.R3 ? 'R3' : Object.keys(preset.rows)[0]);
}

function num(v, fallback) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function clampToRange(key, v) {
  const r = PARAM_RANGES[key];
  if (!r) return v;
  return clamp(v, r.min, r.max);
}

// §4.2 — fill missing keys, clamp, emit warning keys. Never throws.
export function normalizeParams(input) {
  const src = input && typeof input === 'object' ? input : {};
  const warnings = [];
  const p = {};

  for (const key of Object.keys(DEFAULT_PARAMS)) {
    const def = DEFAULT_PARAMS[key];
    const raw = src[key];
    if (raw === undefined || raw === null) {
      p[key] = def;
      continue;
    }
    if (typeof def === 'number') {
      p[key] = num(raw, def);
    } else if (typeof def === 'boolean') {
      p[key] = Boolean(raw);
    } else {
      p[key] = raw;
    }
  }

  // pitchY: null (= pitch) or a number
  if (src.pitchY === undefined || src.pitchY === null || src.pitchY === '') {
    p.pitchY = null;
  } else {
    const n = num(src.pitchY, NaN);
    p.pitchY = Number.isFinite(n) ? n : null;
  }

  // enum validation
  if (!DISH_TYPES.includes(p.dishType)) p.dishType = DEFAULT_PARAMS.dishType;
  if (!STEM_TYPES.includes(p.stemType)) p.stemType = DEFAULT_PARAMS.stemType;
  if (!SIZE_STANDARDS.includes(p.sizeStandard)) p.sizeStandard = DEFAULT_PARAMS.sizeStandard;
  if (!SKIRT_STYLES.includes(p.skirtStyle)) p.skirtStyle = DEFAULT_PARAMS.skirtStyle;
  if (!HOMING_TYPES.includes(p.homingType)) p.homingType = DEFAULT_PARAMS.homingType;
  p.stemRotate = Math.round(((p.stemRotate % 180) + 180) % 180) === 90 ? 90 : 0;
  if (!STAB_MODES.includes(p.stabilizers)) p.stabilizers = DEFAULT_PARAMS.stabilizers;
  if (!STEM_RIBS.includes(p.stemRibs)) p.stemRibs = DEFAULT_PARAMS.stemRibs;
  if (!LEGEND_MODES.includes(p.legendMode)) p.legendMode = DEFAULT_PARAMS.legendMode;
  if (!(typeof p.capColor === 'string')) p.capColor = DEFAULT_PARAMS.capColor;
  if (!(typeof p.legendColor === 'string')) p.legendColor = DEFAULT_PARAMS.legendColor;
  if (!(typeof p.stemColor === 'string')) p.stemColor = DEFAULT_PARAMS.stemColor;

  // clamp numerics
  for (const key of Object.keys(PARAM_RANGES)) {
    if (typeof p[key] === 'number') {
      const before = p[key];
      p[key] = clampToRange(key, before);
    }
  }
  if (!Number.isFinite(p.pitch) || p.pitch <= 0) p.pitch = DEFAULT_PARAMS.pitch;
  p.pitch = clamp(p.pitch, 5, 50);

  // ---- derived constraints (warnings + safe clamps) ----
  const bottomW = p.unitW * p.pitch - p.gap + p.extL + p.extR;
  const bottomD = p.unitD * (p.pitchY ?? p.pitch) - p.gap + p.extF + p.extB;

  // wall vs inner body
  let innerW = bottomW - 2 * p.wall;
  let innerD = bottomD - 2 * p.wall;
  if (innerW <= p.stemOuterD + 1 || innerD <= p.stemOuterD + 1) {
    warnings.push('warn.bodyTooThin');
  }
  if (innerW < 4) {
    p.wall = clamp((bottomW - 4) / 2, PARAM_RANGES.wall.min, PARAM_RANGES.wall.max);
    innerW = bottomW - 2 * p.wall;
  }
  if (innerD < 4) {
    p.wall = clamp((bottomD - 4) / 2, PARAM_RANGES.wall.min, PARAM_RANGES.wall.max);
    innerD = bottomD - 2 * p.wall;
  }

  // insets: keep outer top >= 4 mm and inner top >= 1 mm
  function fitInsets(aKey, bKey, bottom) {
    let a = p[aKey];
    let b = p[bKey];
    const cap = bottom - Math.max(4, 2 * p.wall + 1);
    const limit = Math.max(PARAM_RANGES[aKey].min + PARAM_RANGES[bKey].min, cap);
    if (a + b > limit) {
      warnings.push('warn.topTooSmall');
      const f = limit / (a + b);
      a = Math.max(PARAM_RANGES[aKey].min, a * f);
      b = Math.max(PARAM_RANGES[bKey].min, b * f);
    }
    p[aKey] = a;
    p[bKey] = b;
  }
  fitInsets('insetL', 'insetR', bottomW);
  fitInsets('insetF', 'insetB', bottomD);

  const topW = Math.max(0.1, bottomW - p.insetL - p.insetR);
  const topD = Math.max(0.1, bottomD - p.insetF - p.insetB);
  const topMin = Math.min(topW, topD);

  // dish depth vs top width
  const maxDish = 0.3 * topMin;
  if (p.dishDepth > maxDish) {
    warnings.push('warn.dishTooDeep');
    p.dishDepth = clamp(maxDish, PARAM_RANGES.dishDepth.min, PARAM_RANGES.dishDepth.max);
  }

  // top thickness vs height & dish
  const maxTop = p.height - 1 - p.dishDepth;
  const maxTop2 = p.height - 0.5;
  const capTop = clamp(Math.min(maxTop, maxTop2), PARAM_RANGES.topThickness.min, PARAM_RANGES.topThickness.max);
  if (p.topThickness > capTop) {
    warnings.push('warn.topTooThick');
    p.topThickness = capTop;
  }
  if (p.topThickness + p.dishDepth >= p.height - 1) {
    if (!warnings.includes('warn.topTooThick')) warnings.push('warn.topTooThick');
  }

  // Choc stems: centre prongs only (no stabilizers or ribs yet)
  if (p.stemType === 'choc' && p.stabilizers === 'auto' && Math.max(p.unitW, p.unitD) >= 2) {
    warnings.push('warn.chocStabs');
  }
  if (p.stemType === 'choc' && p.stemRibs === 'cross') warnings.push('warn.chocRibs');

  // wall thinness under tilt
  if ((Math.abs(p.tiltX) >= 12 || Math.abs(p.tiltY) >= 12) && p.wall < 1.2) {
    warnings.push('warn.wallThinTilt');
  }

  return { params: p, warnings };
}

// §4.3 — apply a family/row preset, keeping legend/colour/size/ext/stem.
// KLP families also set rBottom, the skirt, the sculpt keys, the shell and
// (per row) the homing bump; classic families switch the skirt back to straight.
export function applyPreset(params, family, row) {
  const base = { ...DEFAULT_PARAMS, ...(params || {}) };
  const preset = PRESETS[family];
  if (!preset) return base;
  const next = { ...base };
  for (const key of PRESET_PARAM_KEYS) {
    if (Object.hasOwn(preset, key)) next[key] = preset[key];
  }
  if (!isKlpFamily(family)) next.skirtStyle = 'straight';
  if (preset.uniform) {
    next.height = preset.uniform.height;
    next.tiltX = preset.uniform.tiltX;
  } else if (preset.rows) {
    const r = preset.rows[row] || preset.rows[presetDefaultRow(family)];
    if (r) Object.assign(next, r);
  }
  const { params: normalized } = normalizeParams(next);
  return normalized;
}
