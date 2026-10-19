# REPORT T1 — Parametric keycap geometry core (agent: codex)

Status: **done**. `node tests/geometry.test.mjs` passes (1478/1478 checks, 202 fuzz
cases). `tests/run-tests.bat` runs every `tests/*.test.mjs`.

## What was built

- `js/manifold-loader.js` — `getManifold()` singleton. Browser detects
  `typeof window === 'undefined'` and supplies `locateFile`; Node uses the
  vendored module's default resolver. `wasm.setup()` is called once.
- `js/params.js` — `DEFAULT_PARAMS`, `PARAM_RANGES` (min/max/step, UI-ready),
  `PRESETS`, `PRESET_FAMILIES`, `PRESET_ROWS`, `SIZE_LIST`, `normalizeParams`,
  `applyPreset`. Values per SPEC §4.1/§4.3.
- `js/keycap.js` — `computeLayout`, `toWorld`, `dishSurfaceZ`, `makeRotation`,
  `stemPositions`, `buildKeycap`, `buildModel`; internal `buildOuter`,
  `buildInner`, `buildStems`, `buildHomingBump`. Pure, no DOM.
- `tests/geometry.test.mjs`, `tests/run-tests.bat`.

## Coverage of the required tests

- Presets × rows × unitW ∈ {1, 1.25, 2, 2.25, 6.25}: `NoError`, volume > 0,
  bbox X/Y == footprint ±0.05, max Z ≈ top corner height ±0.6.
- Asymmetric insets (`insetF=4, insetB=0.8`) shift top centre back; `extR=3`
  gives bbox maxX = 12.
- Tilt signs proven with `toWorld`: `tiltX>0` raises the back edge, `tiltY>0`
  raises the right edge (and negative inverts).
- `frame.mat4` maps local (1,2,0) to `toWorld([1,2,0])` (±1e-4).
- Stem: material present at (2.6, 0, stemZ+2); cross hole empty at
  (0, 0, stemZ+1).
- Stabilizers: 2u → 3 stems at ±11.938; 6.25u → 3 stems at ±50; vertical 2u
  stabilizes along Y; `'none'` → single stem.
- Dish: cylindrical / spherical / flat valid; spherical centre is `dishDepth`
  below flat.
- Extremes (min & max corners) + 200 seeded-random fuzz cases: `normalizeParams`
  never throws and returns warnings; every build is `NoError` with volume > 0.
- `buildModel`: legend `null` without contours; missing `legend-core.js` yields
  `warn.legendUnavailable` and still returns a valid cap.
- Performance: default preview cap ≈ 1 ms in Node (limit 150 ms).

## Deviations from SPEC (with reasons)

1. **`capBody` distinct from `shell`.** SPEC §5.5 sets `capBody = shell ∪ stems`.
   When there are no stems (`stemType:'none'`, or no extra stems) that alias makes
   `shell` and `capBody` the same WASM handle; deleting both double-freed and
   corrupted later builds. `buildKeycap` now copies via `shell.asOriginal()` in
   that case so the two returned handles are always independently disposable.
2. **`buildModel(wasm, p, legendCS, opts)` takes `wasm`.** SPEC §5.6 omits it, but
   the delegation to `applyLegend(wasm, parts, legendCS, p)` requires the module.
3. **`computeLayout`/`buildKeycap` normalise internally.** They call
   `normalizeParams` so tests and the UI can pass raw/partial params; the
   normalised object is exposed as `layout.params`. `layout.warnings` carries the
   normalize warnings.
4. **Warning keys invented** (core emits, i18n must provide): `warn.topTooSmall`,
   `warn.dishTooDeep`, `warn.topTooThick`, `warn.bodyTooThin`,
   `warn.wallThinTilt`, `warn.legendUnavailable`, `warn.legendOverflow`.
5. **Dish radius** for the inner body is recomputed from the inner top chord with
   the same depth (the SPEC only fixes "same dish depth"); the shell's top
   thickness at centre stays `topThickness`.

## Known limitations

- Sloped walls are slightly thinner than `wall` measured normally (SPEC §5.3
  v1 approximation), as documented there.
- `homingBump` is implemented (capsule 5×1 r0.5 on the dish surface, sunk
  0.15) but not asserted by a dedicated geometry test.
- Spherical dish uses `Manifold.sphere`, whose segment count is rounded up to a
  multiple of four.
- `normalizeParams` clamps insets so both the outer top (≥4 mm) and inner top
  (≥1 mm) stay valid, and clamps `wall`/`topThickness` against `height`; some
  pathological min/max combinations therefore build a slightly different shape
  than requested and report a warning instead of throwing.
