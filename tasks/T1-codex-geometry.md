# Task T1 — Parametric keycap geometry core  (agent: **codex**)

You are implementing the geometry engine of an offline browser keycap generator.
**Read `docs/SPEC.md` fully first — especially §1, §4, §5.** It is the contract; follow it exactly.
Also read `vendor/manifold/manifold.d.ts` for the manifold-3d API (v3.5.4).

## Files you own (create these, touch nothing else)
- `js/manifold-loader.js`
- `js/params.js`
- `js/keycap.js`
- `tests/geometry.test.mjs`
- `tests/run-tests.bat` (runs every `tests/*.test.mjs` with `node`, exits non-zero on failure)

## Requirements
1. `js/manifold-loader.js`: `export async function getManifold()` — singleton; imports `../vendor/manifold/manifold.js`, calls `Module({ locateFile: f => new URL('../vendor/manifold/' + f, import.meta.url).href })` in the browser; in Node the default locateFile works (detect `typeof window === 'undefined'`). Calls `wasm.setup()` once. Returns the module.
2. `js/params.js`: `DEFAULT_PARAMS`, `PARAM_RANGES` (min/max/step per key, used by UI sliders too), `PRESETS`, `SIZE_LIST`, `normalizeParams(p) → {params, warnings}`, `applyPreset(params, family, row)`. Values per SPEC §4.
3. `js/keycap.js`: `computeLayout`, `toWorld`, `dishSurfaceZ`, `buildKeycap`, `buildModel` per SPEC §5. Pure functions, no DOM. Delete all temporary Manifold/CrossSection objects.
   - `buildModel(wasm, p, legendCS, opts)`: if `legendCS` is non-null, dynamically `import('./legend-core.js')` and call `applyLegend(wasm, parts, legendCS, p)`; if that module doesn't exist yet, catch and return the cap without legend plus warning `warn.legendUnavailable`.
4. Sign conventions are critical: +Y = back, `tiltX > 0` raises the back edge, `tiltY > 0` raises the right edge. Write a test that proves each sign.

## Tests (`tests/geometry.test.mjs`, plain Node ESM, no test framework; print a summary, `process.exit(1)` on failure)
- For every preset family × row × unitW ∈ {1, 1.25, 2, 2.25, 6.25}: `buildKeycap` → `capBody.status()==='NoError'`, volume > 0, bounding box X/Y equals footprint (±0.05), max Z ≈ expected top edge height (±0.6).
- Asymmetric case: `insetF=4, insetB=0.8` → top centre Y > 0 (shifted back). `extR=3` → bbox maxX = 9+3.
- Tilt signs: `tiltX=10` → Z at back edge of top > Z at front edge; `tiltY=10` → right > left (use `toWorld`).
- `frame.mat4` test: transforming a tiny cube at local (1,2,0) lands at `toWorld([1,2,0])`.
- Stem present: intersect capBody with a 0.3 mm cube centred at (2.6, 0, stemZ+2) (inside the stem wall) → volume > 0; cube at (0,0,stemZ+1) (inside cross hole) → volume ≈ 0.
- Stabilizers: 2u has 3 stems, 6.25u stems at ±50.
- Dish: cylindrical/spherical/flat all valid; spherical centre Z lower than flat by ≈ dishDepth.
- Extreme params from `PARAM_RANGES` (min & max corners, random fuzz 200 cases with fixed seed) → never throws, `normalizeParams` returns warnings instead.
- Performance: default cap at `preview` quality < 150 ms in Node (print timing).

## Done when
`node tests/geometry.test.mjs` passes. Then append a short report to `docs/REPORT-T1.md`: what you built, any deviations from SPEC (with reasons), known limitations. Do **not** build UI.
