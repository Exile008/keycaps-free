// T1 geometry tests — plain Node ESM, no framework.
// Run: node tests/geometry.test.mjs

import { getManifold } from '../js/manifold-loader.js';
import {
  DEFAULT_PARAMS, PARAM_RANGES, PRESETS, SIZE_LIST,
  normalizeParams, applyPreset,
} from '../js/params.js';
import {
  computeLayout, toWorld, dishSurfaceZ, buildKeycap, buildModel,
} from '../js/keycap.js';

const TOL = 0.05;
let failures = 0;
let checks = 0;

function approx(a, b, tol, msg) {
  checks++;
  if (!(Math.abs(a - b) <= tol)) {
    failures++;
    console.error(`  FAIL: ${msg} (${a} vs ${b}, tol ${tol})`);
  }
}

function ok(cond, msg) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}

function section(name) {
  console.log(`\n== ${name}`);
}

const wasm = await getManifold();
const { Manifold } = wasm;

function bboxCenter(m) {
  const b = m.boundingBox();
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

function disposeParts(parts) {
  if (!parts) return;
  const set = new Set([
    parts.outer, parts.inner, parts.shell, parts.stems, parts.stemSolid,
    parts.crossCut, parts.flare, parts.ribs, parts.stemPart, parts.capBody,
  ]);
  for (const m of set) m?.delete();
}

function disposeModel(res) {
  if (!res) return;
  const set = new Set([res.cap, res.legend, res.stem]);
  for (const m of set) m?.delete();
}

function maxTopCornerZ(layout) {
  const tw = layout.top.w / 2;
  const td = layout.top.d / 2;
  let z = -Infinity;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      z = Math.max(z, toWorld(layout, [sx * tw, sy * td, 0])[2]);
    }
  }
  return z;
}

// ---------------------------------------------------------------------------
section('presets × rows × sizes build as valid manifolds');
const SIZE_SET = [1, 1.25, 2, 2.25, 6.25];
for (const family of Object.keys(PRESETS)) {
  for (const row of ['R1', 'R2', 'R3', 'R4']) {
    for (const unitW of SIZE_SET) {
      const p = applyPreset(DEFAULT_PARAMS, family, row);
      p.unitW = unitW;
      const layout = computeLayout(p);
      let parts;
      try {
        parts = buildKeycap(wasm, p, { quality: 'preview' });
      } catch (e) {
        failures++;
        checks++;
        console.error(`  FAIL: ${family}/${row}/${unitW} threw: ${e.message}`);
        continue;
      }
      ok(parts.capBody.status() === 'NoError', `${family}/${row}/${unitW} status`);
      ok(parts.capBody.volume() > 0, `${family}/${row}/${unitW} volume > 0`);
      const bb = parts.capBody.boundingBox();
      approx(bb.min[0], layout.bottom.x0, TOL, `${family}/${row}/${unitW} bbox minX`);
      approx(bb.max[0], layout.bottom.x1, TOL, `${family}/${row}/${unitW} bbox maxX`);
      approx(bb.min[1], layout.bottom.y0, TOL, `${family}/${row}/${unitW} bbox minY`);
      approx(bb.max[1], layout.bottom.y1, TOL, `${family}/${row}/${unitW} bbox maxY`);
      approx(bb.max[2], maxTopCornerZ(layout), 0.6, `${family}/${row}/${unitW} maxZ`);
      disposeParts(parts);
    }
  }
}

// ---------------------------------------------------------------------------
section('presets × rows × sizes: fillet, ribs and separate stem');
{
  // Exact booleans leave zero-volume sliver shells in some separate models;
  // genus is only meaningful per connected solid, so filter them first.
  function solidStats(m) {
    const dec = m.decompose();
    const real = dec.filter(x => Math.abs(x.volume()) > 1e-6);
    const count = real.length;
    const genus = count === 1 ? real[0].genus() : NaN;
    dec.forEach(x => x.delete());
    return { count, genus };
  }
  function validate(label, parts, separate) {
    ok(parts.capBody.status() === 'NoError', `${label} status`);
    ok(parts.capBody.volume() > 0, `${label} volume > 0`);
    const s = solidStats(parts.capBody);
    ok(s.count === 1 && Number.isInteger(s.genus) && s.genus === 0,
      `${label} one genus-0 cap solid (solids ${s.count}, genus ${s.genus})`);
    if (separate) {
      ok(parts.stemPart && parts.stemPart.status() === 'NoError', `${label} stem part valid`);
      ok(parts.stemPart.volume() > 0, `${label} stem volume > 0`);
    }
  }
  for (const family of Object.keys(PRESETS)) {
    for (const row of ['R1', 'R2', 'R3', 'R4']) {
      for (const unitW of SIZE_SET) {
        const base = { ...applyPreset(DEFAULT_PARAMS, family, row), unitW, stemFillet: 2 };
        const label = `${family}/${row}/${unitW}`;
        let joined, joinedRibs, sep, sepRibs;
        try {
          joined = buildKeycap(wasm, base, { quality: 'preview' });
          joinedRibs = buildKeycap(wasm, { ...base, stemRibs: 'cross' }, { quality: 'preview' });
          sep = buildKeycap(wasm, { ...base, stemSeparate: true }, { quality: 'preview' });
          sepRibs = buildKeycap(wasm, { ...base, stemRibs: 'cross', stemSeparate: true }, { quality: 'preview' });
        } catch (e) {
          failures++; checks++;
          console.error(`  FAIL: ${label} reinforcement build threw: ${e.message}`);
          disposeParts(joined); disposeParts(joinedRibs); disposeParts(sep); disposeParts(sepRibs);
          continue;
        }
        validate(`${label} fillet`, joined, false);
        validate(`${label} fillet+ribs`, joinedRibs, false);
        validate(`${label} separate`, sep, true);
        validate(`${label} separate+ribs`, sepRibs, true);
        for (const [tag, s, ref] of [['separate', sep, joined], ['separate+ribs', sepRibs, joinedRibs]]) {
          const inter = s.capBody.intersect(s.stemPart);
          approx(inter.volume(), 0, 1e-4, `${label} ${tag} cap ∩ stem = 0`);
          inter.delete();
          const sum = s.capBody.volume() + s.stemPart.volume();
          approx(sum, ref.capBody.volume(), Math.max(1e-4, ref.capBody.volume() * 1e-6),
            `${label} ${tag} cap + stem matches joined volume`);
        }
        const bb = joined.capBody.boundingBox();
        const layout = joined.layout;
        approx(bb.min[0], layout.bottom.x0, TOL, `${label} reinforced bbox minX`);
        approx(bb.max[0], layout.bottom.x1, TOL, `${label} reinforced bbox maxX`);
        disposeParts(joined);
        disposeParts(joinedRibs);
        disposeParts(sep);
        disposeParts(sepRibs);
      }
    }
  }
}

// ---------------------------------------------------------------------------
section('asymmetric insets & extension');
{
  const p = { ...DEFAULT_PARAMS, insetF: 4, insetB: 0.8 };
  const layout = computeLayout(p);
  const topCentreY = toWorld(layout, [0, 0, 0])[1];
  ok(topCentreY > 0, `insetF>insetB shifts top centre back (Y=${topCentreY})`);

  const p2 = { ...DEFAULT_PARAMS, extR: 3 };
  const layout2 = computeLayout(p2);
  const parts = buildKeycap(wasm, p2, { quality: 'preview' });
  const bb = parts.capBody.boundingBox();
  approx(bb.max[0], 9 + 3, TOL, 'extR=3 -> maxX == 12');
  approx(bb.max[0], layout2.bottom.x1, TOL, 'extR=3 matches layout');
  disposeParts(parts);
}

// ---------------------------------------------------------------------------
section('tilt sign conventions');
{
  const layoutX = computeLayout({ ...DEFAULT_PARAMS, tiltX: 10, tiltY: 0 });
  const td = layoutX.top.d / 2;
  const back = toWorld(layoutX, [0, td, 0])[2];
  const front = toWorld(layoutX, [0, -td, 0])[2];
  ok(back > front, `tiltX=10 raises back edge (${back} > ${front})`);

  const layoutY = computeLayout({ ...DEFAULT_PARAMS, tiltX: 0, tiltY: 10 });
  const tw = layoutY.top.w / 2;
  const right = toWorld(layoutY, [tw, 0, 0])[2];
  const left = toWorld(layoutY, [-tw, 0, 0])[2];
  ok(right > left, `tiltY=10 raises right edge (${right} > ${left})`);

  const negX = computeLayout({ ...DEFAULT_PARAMS, tiltX: -10, tiltY: 0 });
  ok(toWorld(negX, [0, td, 0])[2] < toWorld(negX, [0, -td, 0])[2], 'tiltX<0 lowers back edge');
}

// ---------------------------------------------------------------------------
section('frame.mat4 matches toWorld');
{
  const layout = computeLayout({ ...DEFAULT_PARAMS, tiltX: 7, tiltY: -4 });
  const local = [1, 2, 0];
  const c = Manifold.cube(0.2, true).translate(local);
  const t = c.transform(layout.frame.mat4);
  const cen = bboxCenter(t);
  const expected = toWorld(layout, local);
  for (let i = 0; i < 3; i++) approx(cen[i], expected[i], 1e-4, `mat4 axis ${i}`);
  c.delete(); t.delete();
}

// ---------------------------------------------------------------------------
section('stems');
{
  const parts = buildKeycap(wasm, DEFAULT_PARAMS, { quality: 'preview' });
  const p = DEFAULT_PARAMS;
  const solid = Manifold.cube(0.3, true).translate([2.6, 0, p.stemZ + 2]);
  const hollow = Manifold.cube(0.3, true).translate([0, 0, p.stemZ + 1]);
  const solidHit = parts.capBody.intersect(solid);
  const hollowHit = parts.capBody.intersect(hollow);
  ok(solidHit.volume() > 0, `stem wall present at (2.6,0) vol=${solidHit.volume()}`);
  ok(hollowHit.volume() < 1e-4, `cross hole empty at (0,0) vol=${hollowHit.volume()}`);
  solid.delete(); hollow.delete(); solidHit.delete(); hollowHit.delete();
  disposeParts(parts);
}

// ---------------------------------------------------------------------------
section('stem reinforcement parameters');
{
  const d = normalizeParams({});
  for (const key of ['stemFillet', 'stemRibs', 'ribThickness', 'ribHeight', 'stemSeparate', 'stemColor']) {
    ok(Object.hasOwn(d.params, key), `normalize fills ${key}`);
  }
  ok(DEFAULT_PARAMS.stemFillet === 1 && DEFAULT_PARAMS.stemRibs === 'none' &&
    DEFAULT_PARAMS.ribThickness === 1 && DEFAULT_PARAMS.ribHeight === 2 &&
    DEFAULT_PARAMS.stemSeparate === false && DEFAULT_PARAMS.stemColor === '#f2f2f2',
    'reinforcement defaults');
  const clamped = normalizeParams({
    ...DEFAULT_PARAMS, stemFillet: 99, ribThickness: 0.01, ribHeight: 99,
    stemRibs: 'bogus', stemColor: 5,
  }).params;
  approx(clamped.stemFillet, PARAM_RANGES.stemFillet.max, 1e-9, 'stemFillet clamped');
  approx(clamped.ribThickness, PARAM_RANGES.ribThickness.min, 1e-9, 'ribThickness clamped');
  approx(clamped.ribHeight, PARAM_RANGES.ribHeight.max, 1e-9, 'ribHeight clamped');
  ok(clamped.stemRibs === 'none', 'invalid stemRibs falls back');
  ok(clamped.stemColor === DEFAULT_PARAMS.stemColor, 'invalid stemColor falls back');

  const preset = applyPreset({
    ...DEFAULT_PARAMS, stemFillet: 2.5, stemRibs: 'cross', ribThickness: 1.5,
    ribHeight: 4, stemSeparate: true, stemColor: '#abcdef',
  }, 'sa', 'R1');
  approx(preset.stemFillet, 2.5, 1e-9, 'applyPreset keeps stemFillet');
  ok(preset.stemRibs === 'cross' && preset.stemSeparate === true &&
    preset.stemColor === '#abcdef', 'applyPreset keeps stem settings');
  approx(preset.ribThickness, 1.5, 1e-9, 'applyPreset keeps ribThickness');
  approx(preset.ribHeight, 4, 1e-9, 'applyPreset keeps ribHeight');
}

// ---------------------------------------------------------------------------
section('stem fillet flare');
{
  const plain = buildKeycap(wasm, { ...DEFAULT_PARAMS, stemFillet: 0 }, { quality: 'preview' });
  const flared = buildKeycap(wasm, { ...DEFAULT_PARAMS, stemFillet: 2.5 }, { quality: 'preview' });
  ok(flared.flare && flared.flare.status() === 'NoError', 'flare valid');
  ok(flared.capBody.status() === 'NoError', 'flared cap valid');
  ok(flared.capBody.volume() > plain.capBody.volume() + 1,
    `flare increases volume (${plain.capBody.volume().toFixed(2)} -> ${flared.capBody.volume().toFixed(2)})`);
  const outside = flared.flare.subtract(flared.outer);
  approx(outside.volume(), 0, 1e-5, 'flare never pokes outside the outer body');
  outside.delete();
  disposeParts(plain);
  disposeParts(flared);

  for (const extra of [
    { dishType: 'spherical', dishDepth: 1.2, tiltX: 12, tiltY: -8 },
    { dishType: 'flat', stemFillet: 3, tiltX: -15, tiltY: 10 },
    { unitW: 2, stemFillet: 2, tiltX: 5 },
    { unitW: 6.25, stemFillet: 1.5, tiltY: 15 },
  ]) {
    const p = { ...DEFAULT_PARAMS, ...extra };
    const parts = buildKeycap(wasm, p, { quality: 'preview' });
    ok(parts.capBody.status() === 'NoError', `flare status ${JSON.stringify(extra)}`);
    ok(parts.capBody.volume() > 0, `flare volume ${JSON.stringify(extra)}`);
    if (parts.flare) {
      const out = parts.flare.subtract(parts.outer);
      approx(out.volume(), 0, 1e-5, `flare stays inside outer ${JSON.stringify(extra)}`);
      out.delete();
    }
    disposeParts(parts);
  }
}

// ---------------------------------------------------------------------------
section('cross hole remains clear through flares and ribs');
{
  for (const stemSeparate of [false, true]) {
    const p = {
      ...DEFAULT_PARAMS, stemFillet: 3, stemCrossDepth: 6, stemCrossH: 1.25,
      stemCrossV: 1.1, stemRibs: 'cross', stemSeparate,
    };
    const parts = buildKeycap(wasm, p, { quality: 'preview' });
    ok(parts.capBody.status() === 'NoError', `deep cross cap valid (separate=${stemSeparate})`);
    const targets = [parts.capBody, parts.stemPart].filter(Boolean);
    for (const z of [p.stemZ + 1, p.stemZ + 3, p.stemZ + p.stemCrossDepth - 0.25]) {
      for (const [x, y, tag] of [[0, 0, 'centre'], [1.5, 0, 'X arm'], [0, 1.5, 'Y arm']]) {
        const probe = Manifold.cube(0.3, true).translate([x, y, z]);
        for (const m of targets) {
          const hit = m.intersect(probe);
          approx(hit.volume(), 0, 1e-4, `cross hole empty at ${tag} z=${z.toFixed(2)} separate=${stemSeparate}`);
          hit.delete();
        }
        probe.delete();
      }
    }
    // The stem wall outside the cross must still be solid.
    const wall = Manifold.cube(0.3, true).translate([2.6, 0, p.stemZ + 2]);
    const wallTarget = stemSeparate ? parts.stemPart : parts.capBody;
    const wallHit = wallTarget.intersect(wall);
    ok(wallHit.volume() > 0, `stem wall solid (separate=${stemSeparate})`);
    wall.delete(); wallHit.delete();
    disposeParts(parts);
  }
}

// ---------------------------------------------------------------------------
section('stem ribs');
{
  const p = { ...DEFAULT_PARAMS, stemRibs: 'cross', ribThickness: 1, ribHeight: 2 };
  const noRibs = buildKeycap(wasm, { ...p, stemRibs: 'none' }, { quality: 'preview' });
  const parts = buildKeycap(wasm, p, { quality: 'preview' });
  ok(parts.ribs && parts.ribs.status() === 'NoError', 'ribs valid');
  ok(parts.ribs.volume() > 0, `ribs have volume (${parts.ribs.volume().toFixed(2)})`);
  ok(parts.capBody.volume() > noRibs.capBody.volume(), 'ribs add material');
  const bb = parts.ribs.boundingBox();
  ok(bb.min[2] >= p.stemZ - 1e-6, `ribs do not extend below stem bottom (minZ=${bb.min[2].toFixed(3)})`);
  ok(bb.max[0] - bb.min[0] > 10 && bb.max[1] - bb.min[1] > 10, 'ribs reach out along X and Y');
  disposeParts(noRibs);
  disposeParts(parts);

  // Ribs stay with the cap. The raw ribs may cross the stem/flare volume; the
  // separate cap is joinedCap − stemPart, so that overlap is removed there.
  const sep = buildKeycap(wasm, { ...p, stemSeparate: true }, { quality: 'preview' });
  const inter = sep.capBody.intersect(sep.stemPart);
  approx(inter.volume(), 0, 1e-4, 'cap with ribs does not overlap the separate stem part');
  inter.delete();
  disposeParts(sep);
}

// ---------------------------------------------------------------------------
section('separate stem part');
{
  for (const [tag, extra] of [
    ['fillet=0', { stemFillet: 0 }],
    ['fillet=1.5', { stemFillet: 1.5 }],
    ['fillet=1.5+ribs', { stemFillet: 1.5, stemRibs: 'cross' }],
  ]) {
    const p = { ...DEFAULT_PARAMS, stemSeparate: true, ...extra };
    const joined = buildKeycap(wasm, { ...p, stemSeparate: false }, { quality: 'preview' });
    const parts = buildKeycap(wasm, p, { quality: 'preview' });
    ok(parts.capBody.status() === 'NoError', `separate cap valid (${tag})`);
    ok(parts.stemPart && parts.stemPart.status() === 'NoError', `stem part valid (${tag})`);
    ok(parts.stemPart.volume() > 0, `stem part volume > 0 (${tag})`);
    const inter = parts.capBody.intersect(parts.stemPart);
    approx(inter.volume(), 0, 1e-4, `cap ∩ stem = 0 (${tag})`);
    inter.delete();
    const sum = parts.capBody.volume() + parts.stemPart.volume();
    approx(sum, joined.capBody.volume(), Math.max(1e-4, joined.capBody.volume() * 1e-6),
      `cap + stem = joined volume (${tag})`);

    // The separate stem stops at the inner ceiling: nothing in the shell and
    // therefore no exposed stem disc on the outer top face.
    const outside = parts.stemPart.subtract(parts.inner);
    approx(outside.volume(), 0, 1e-4, `stemPart ∩ (outer − inner) = 0 (${tag})`);
    outside.delete();

    // The cap's top plate (outer − inner region) is identical to the joined
    // cap: the stem plug stays with the cap.
    const shellRegion = parts.outer.subtract(parts.inner);
    const joinedPlate = joined.capBody.intersect(shellRegion);
    const sepPlate = parts.capBody.intersect(shellRegion);
    approx(sepPlate.volume(), joinedPlate.volume(),
      Math.max(1e-4, joinedPlate.volume() * 1e-6), `cap top plate unchanged (${tag})`);
    joinedPlate.delete();
    sepPlate.delete();
    shellRegion.delete();

    // Along the stem axis the stem top sits one topThickness below the outer
    // top, and the cap still covers the outer surface above it.
    const column = Manifold.cube([0.2, 0.2, p.height + 10], true)
      .translate([0, 0, (p.height + 5) / 2]);
    const outerHit = parts.outer.intersect(column);
    const stemHit = parts.stemPart.intersect(column);
    const capHit = parts.capBody.intersect(column);
    const outerTop = outerHit.boundingBox().max[2];
    const stemTop = stemHit.boundingBox().max[2];
    const capTop = capHit.boundingBox().max[2];
    approx(outerTop - stemTop, p.topThickness, 0.1,
      `stem top is topThickness below outer top (${tag})`);
    approx(capTop, outerTop, 0.05, `cap keeps its full top plate (${tag})`);
    outerHit.delete();
    stemHit.delete();
    capHit.delete();
    column.delete();

    disposeParts(joined);
    disposeParts(parts);
  }

  // Stabilizer stems are also separated, and the flare is included.
  const p = { ...DEFAULT_PARAMS, unitW: 2.25, stemSeparate: true, stemFillet: 1 };
  const parts = buildKeycap(wasm, p, { quality: 'preview' });
  ok(parts.stemPart.status() === 'NoError', 'stab stem part valid');
  const c = parts.capBody.decompose();
  const solids = c.filter(m => Math.abs(m.volume()) > 1e-6);
  ok(solids.length === 1, `separate stab cap has one solid (${solids.length})`);
  c.forEach(m => m.delete());
  disposeParts(parts);
}

// ---------------------------------------------------------------------------
section('stabilizers');
{
  const l2 = computeLayout({ ...DEFAULT_PARAMS, unitW: 2 });
  ok(l2.stems.length === 3, `2u has 3 stems (${l2.stems.length})`);
  const off2 = l2.stems.map((s) => s[0]).sort((a, b) => a - b);
  approx(off2[0], -11.938, TOL, '2u stab offset -11.938');
  approx(off2[2], 11.938, TOL, '2u stab offset +11.938');

  const l625 = computeLayout({ ...DEFAULT_PARAMS, unitW: 6.25 });
  ok(l625.stems.length === 3, `6.25u has 3 stems (${l625.stems.length})`);
  const off625 = l625.stems.map((s) => s[0]).sort((a, b) => a - b);
  approx(off625[0], -50, TOL, '6.25u stem at -50');
  approx(off625[2], 50, TOL, '6.25u stem at +50');

  const none = computeLayout({ ...DEFAULT_PARAMS, unitW: 6.25, stabilizers: 'none' });
  ok(none.stems.length === 1, 'stabilizers:none -> single stem');

  const vert = computeLayout({ ...DEFAULT_PARAMS, unitW: 1, unitD: 2 });
  ok(vert.stems.length === 3 && vert.stems[1][1] !== 0, 'vertical 2u stabilizes on Y');
}

// ---------------------------------------------------------------------------
section('dish');
{
  for (const type of ['cylindrical', 'spherical', 'flat']) {
    const p = { ...DEFAULT_PARAMS, dishType: type };
    const parts = buildKeycap(wasm, p, { quality: 'preview' });
    ok(parts.capBody.status() === 'NoError', `${type} status`);
    ok(parts.capBody.volume() > 0, `${type} volume > 0`);
    disposeParts(parts);
  }
  const sph = computeLayout({ ...DEFAULT_PARAMS, dishType: 'spherical', dishDepth: 0.8 });
  const flat = computeLayout({ ...DEFAULT_PARAMS, dishType: 'flat' });
  approx(flat ? dishSurfaceZ(sph, 0, 0) - dishSurfaceZ(flat, 0, 0) : 0, -0.8, 1e-6,
    'spherical centre is dishDepth below flat');
}

// ---------------------------------------------------------------------------
section('extreme params & fuzz never throw');
{
  function corner(mode) {
    const p = { ...DEFAULT_PARAMS };
    for (const k of Object.keys(PARAM_RANGES)) p[k] = mode === 'min' ? PARAM_RANGES[k].min : PARAM_RANGES[k].max;
    return p;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(1234567);
  const enums = {
    dishType: ['cylindrical', 'spherical', 'flat'],
    stemType: ['mx', 'none'],
    stabilizers: ['auto', 'none'],
    stemRibs: ['none', 'cross'],
    legendMode: ['inlay', 'recessed', 'raised', 'shine'],
  };
  const cases = [corner('min'), corner('max')];
  for (let i = 0; i < 200; i++) {
    const p = { ...DEFAULT_PARAMS };
    for (const k of Object.keys(PARAM_RANGES)) {
      const r = PARAM_RANGES[k];
      p[k] = r.min + rand() * (r.max - r.min);
    }
    for (const k of Object.keys(enums)) p[k] = enums[k][Math.floor(rand() * enums[k].length)];
    p.stemSeparate = rand() < 0.35;
    p.unitW = SIZE_LIST[Math.floor(rand() * SIZE_LIST.length)];
    cases.push(p);
  }
  for (let i = 0; i < cases.length; i++) {
    let norm;
    try {
      norm = normalizeParams(cases[i]);
    } catch (e) {
      failures++; checks++;
      console.error(`  FAIL: normalizeParams threw on case ${i}: ${e.message}`);
      continue;
    }
    ok(Array.isArray(norm.warnings) && norm.params, `case ${i} returns params+warnings`);
    try {
      const parts = buildKeycap(wasm, cases[i], { quality: 'preview' });
      ok(parts.capBody.status() === 'NoError', `case ${i} status NoError`);
      ok(parts.capBody.volume() > 0, `case ${i} volume > 0`);
      disposeParts(parts);
    } catch (e) {
      failures++; checks++;
      console.error(`  FAIL: buildKeycap threw on case ${i}: ${e.message}`);
    }
  }
  console.log(`  fuzz cases: ${cases.length}`);
}

// ---------------------------------------------------------------------------
section('buildModel');
{
  const res = await buildModel(wasm, DEFAULT_PARAMS, null, { quality: 'preview' });
  ok(res.cap.status() === 'NoError', 'buildModel cap status');
  ok(res.legend === null, 'buildModel legend null without legendCS');
  ok(res.stem === null, 'buildModel stem null when stemSeparate is false');
  ok(res.layout && res.stats && res.stats.tris > 0, 'buildModel stats present');
  ok(res.stats.tris === res.cap.numTri(), 'stats count cap triangles');
  disposeModel(res);

  const sep = await buildModel(wasm, { ...DEFAULT_PARAMS, stemSeparate: true }, null, { quality: 'preview' });
  ok(sep.stem && sep.stem.status() === 'NoError', 'buildModel separate stem returned');
  ok(sep.stats.tris === sep.cap.numTri() + sep.stem.numTri(), 'stats include stem triangles');
  disposeModel(sep);

  // legend-core.js does not exist yet (T2) -> warning, cap still returned.
  const fakeCS = { fake: true };
  const res2 = await buildModel(wasm, DEFAULT_PARAMS, fakeCS, { quality: 'preview' });
  ok(res2.warnings.includes('warn.legendUnavailable'), 'missing legend-core -> warn.legendUnavailable');
  ok(res2.cap.status() === 'NoError', 'fallback cap valid');
  disposeModel(res2);
}

// ---------------------------------------------------------------------------
section('performance');
{
  // warm up
  const w = buildKeycap(wasm, DEFAULT_PARAMS, { quality: 'preview' });
  disposeParts(w);

  const t0 = performance.now();
  const parts = buildKeycap(wasm, DEFAULT_PARAMS, { quality: 'preview' });
  const ms = performance.now() - t0;
  console.log(`  default preview cap (stemFillet ${DEFAULT_PARAMS.stemFillet}): ${ms.toFixed(1)} ms, ${parts.capBody.numTri()} tris`);
  ok(ms < 50, `default preview cap < 50 ms (${ms.toFixed(1)})`);
  disposeParts(parts);
}

// ---------------------------------------------------------------------------
console.log(`\n${checks - failures}/${checks} checks passed` + (failures ? `, ${failures} FAILED` : ' — ALL PASS'));
if (failures) process.exit(1);
