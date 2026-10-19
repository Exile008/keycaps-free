// Parametric keycap generator — parameter defaults, ranges, presets and
// normalisation. Pure module: no DOM, no window. Runs in Node for tests.
// See docs/SPEC.md §4.

export const DEFAULT_PARAMS = {
  // size
  unitW: 1,
  unitD: 1,
  pitch: 19.05,
  gap: 1.05,
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
  // dish
  dishType: 'cylindrical',
  dishDepth: 0.8,
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
  rBottom: { min: 0.1, max: 4, step: 0.1 },
  rTop: { min: 0.1, max: 6, step: 0.1 },
  dishDepth: { min: 0, max: 2.5, step: 0.05 },
  wall: { min: 0.8, max: 3, step: 0.05 },
  topThickness: { min: 0.8, max: 4, step: 0.05 },
  stemOuterD: { min: 4.5, max: 6.5, step: 0.1 },
  stemCrossDepth: { min: 3.6, max: 6, step: 0.1 },
  stemTolerance: { min: -0.2, max: 0.3, step: 0.05 },
  stemZ: { min: 0, max: 3, step: 0.1 },
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

const DISH_TYPES = ['cylindrical', 'spherical', 'flat'];
const STEM_TYPES = ['mx', 'none'];
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

export const PRESET_FAMILIES = Object.keys(PRESETS);
export const PRESET_ROWS = ['R1', 'R2', 'R3', 'R4'];

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

  // enum validation
  if (!DISH_TYPES.includes(p.dishType)) p.dishType = DEFAULT_PARAMS.dishType;
  if (!STEM_TYPES.includes(p.stemType)) p.stemType = DEFAULT_PARAMS.stemType;
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
  const bottomD = p.unitD * p.pitch - p.gap + p.extF + p.extB;

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

  // wall thinness under tilt
  if ((Math.abs(p.tiltX) >= 12 || Math.abs(p.tiltY) >= 12) && p.wall < 1.2) {
    warnings.push('warn.wallThinTilt');
  }

  return { params: p, warnings };
}

// §4.3 — apply a family/row preset, keeping legend/colour/size/ext/stem.
export function applyPreset(params, family, row) {
  const base = { ...DEFAULT_PARAMS, ...(params || {}) };
  const preset = PRESETS[family];
  if (!preset) return base;
  const next = { ...base };
  next.dishType = preset.dishType;
  next.dishDepth = preset.dishDepth;
  next.insetL = preset.insetL;
  next.insetR = preset.insetR;
  next.insetF = preset.insetF;
  next.insetB = preset.insetB;
  next.rTop = preset.rTop;
  if (preset.uniform) {
    next.height = preset.uniform.height;
    next.tiltX = preset.uniform.tiltX;
  } else if (preset.rows) {
    const r = preset.rows[row] || preset.rows.R3;
    if (r) {
      next.height = r.height;
      next.tiltX = r.tiltX;
    }
  }
  const { params: normalized } = normalizeParams(next);
  return normalized;
}
