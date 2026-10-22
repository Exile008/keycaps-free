# FEAT-02 — KLP Lamé–style low-profile keycaps (Choc stem, Choc size, sculpted tops)  (agent: opencode)

User request (2026-10-22): support the keycap type in https://github.com/braindefender/KLP-Lame-Keycaps.
Decision: implement it **parametrically** ("KLP-style"). Do not bundle the author's meshes. It must still work with every slider, legend mode, export and project save.
Claude measured the author's STEP files and prototyped the geometry. **Read first:** `docs/SPEC.md` §4–§5, `docs/klp/klp-prototype.mjs` (working manifold code for every piece below) and `docs/klp/klp_proto.png` (the expected look).

Attribution is required by the author ("leave a mention of this repository/author"). See §7.

## Files you may edit
`js/params.js`, `js/keycap.js`, `js/main.js`, `js/i18n.js`, `js/topview.js`, `js/depth-preview.js` (only if needed for the new dish types), `README.md`, `docs/SPEC.md` (append §10 describing what you built), `tests/geometry.test.mjs`, `tests/legend-export.test.mjs` (add cases only).
Do not change existing behaviour for current presets: every existing test must still pass unchanged.

## 1. Measured reference data (KLP Lamé v1.5u, from the STEP files; units mm)
| item | value |
| --- | --- |
| Choc size footprint, 1u | 17.5 × 16.5 (Choc pitch 18 × 17, gap 0.5); 1.5u = 26.5 × 16.5 |
| MX size footprint, 1u | 18 × 18 (pitch 19.05, gap 1.05) |
| rim (top plane) height, flat variants | 5.65 |
| top face inset, all sides | **1.44** (fitted so the skirt arc meets the rim; edge vertices read ≈1.15 because of the rim rounding) |
| footprint corner radius | ≈ 4.3 |
| skirt | vertical from z 0 to **1.5**, then a convex circular arc **R ≈ 6.7** curving in to the rim |
| wall / top thickness | ≈ 0.9 / ≈ 1.5 at the centre |
| recess depth at centre | 0.85 (centre z 4.80) |
| tilted variants | 15°, back edge up; top-centre height ≈ 7.45 |
| homing (3 bumps) | spheres r 0.8 at (0, 0) and r 0.75 at (±1.5, 0), centres 0.5 below the recess surface → protrude ≈ 0.3 |
| **Choc stem** | two prongs **1.20 (X) × 3.00 (Y)**, corner r ≈ 0.35, centres **x = ±2.85**, from the inner ceiling down to **z = −0.5** (0.5 below the cap bottom), 0.25 fillet at the ceiling, ≈ 0.2 tip chamfer |
| Variants | Normal, Normal Tilted, Normal Homing, Thumb (front cut), Saddle (front + back cut), Saddle Tilted, Saddle Homing; 1.5U: Normal, Thumb H/V, Saddle H/V (V = stem rotated 90°) |

## 2. New parameters (`params.js`: DEFAULT_PARAMS, PARAM_RANGES, normalizeParams)
| key | default | range / values | meaning |
| --- | --- | --- | --- |
| `pitchY` | `null` (= `pitch`) | 15–20 | separate Y pitch. Choc = 17. `computeLayout` uses `D = unitD*pitchY − gap`. |
| `sizeStandard` | `'mx'` | `'mx' \| 'choc' \| 'custom'` | UI helper. `mx` sets pitch 19.05 / pitchY 19.05 / gap 1.05; `choc` sets 18 / 17 / 0.5. Editing pitch/gap manually → `custom`. |
| `stemType` | `'mx'` | add **`'choc'`** | Kailh Choc v1 prongs (§1). `stemTolerance` + = looser = prongs thinner by `tol` in X and Y. |
| `stemRotate` | 0 | 0 \| 90 | rotate the whole stem pattern about Z (MX and Choc). Covers KLP "90° rotated" and the 1.5U "V" variants. |
| `chocProngW` `chocProngL` `chocSpacing` `chocProngZ` | 1.20, 3.00, 5.70, −0.5 | ±0.5 around defaults | expose the dimensions for fit tuning (advanced section). |
| `skirtStyle` | `'straight'` | `'straight' \| 'rounded'` | `rounded` = vertical to `skirtStraight`, then an arc of `skirtRadius` (§3.2). |
| `skirtStraight` `skirtRadius` | 1.5, 6.7 | 0–4, 2–20 | |
| `dishType` | — | add **`'klp'`, `'klp-thumb'`, `'klp-saddle'`** | sculpted tops via a heightfield cutter (§3.1). `dishDepth` is the recess depth D. |
| `sculptRim` | 0.86 | 0.3–3 | rim width between the top edge and the recess |
| `sculptDrop` | 0.85 | 0–3 | how far the thumb/saddle cut drops at the top edge |
| `homingType` | `'bar'` | `'bar' \| 'dots3'` | `dots3` = the KLP three bumps (§1), at the top centre. The existing bar is unchanged. |
| `rBottom` range | max 4 → **6** | | KLP needs 4.3 |
Old projects without these keys must load exactly as before (`pitchY` null → `pitch`, `skirtStyle` straight, etc.).

## 3. Geometry (`keycap.js`). Port from `docs/klp/klp-prototype.mjs`
### 3.1 Sculpted top = heightfield cutter
Pure function (export it): `sculptZ(type, a, b, p, x, y)` in top-local coordinates (z = 0 is the rim plane; negative is below). `a = tw/2`, `b = td/2`, `ax = a − sculptRim`, `ay = b − sculptRim`, `D = dishDepth`, `drop = sculptDrop`:
```
Gx(x) = (1 − min(1,|x|/ax)^2.5)^1.3          Gy(y) = (1 − min(1,|y|/ay)^1.7)^1.2
klp:         z = −D·Gx(x)·Gy(y)
klp-thumb:   y < 0 → z = −D·Gx(x) − drop·(|y|/b)^2.77 ;  y ≥ 0 → as klp
klp-saddle:  z = −D·Gx(x) − drop·(|y|/b)^2.77            (both sides)
```
With the KLP preset values these match the measured KLP surface to **≤ 0.07 mm** at 15 sample points, and the skirt to ≤ 0.06 mm (Claude verified).
- Cutter: closed grid mesh between `min(sculptZ,0) + 0.02` and z = +30 over ±(max(a,b)+6) mm, so the thumb/saddle cut also shaves the skirt beyond the top face. Build it with `new wasm.Mesh({numProp:3, vertProperties, triVerts})`, `mesh.merge()`, `new Manifold(mesh)`. Faces must be CCW outward (copy the prototype's winding). Grid 48×48 (preview) / 120×120 (export). Add `sculptGrid` to QUALITY.
- Outer: hull − cutter transformed by `frame.mat4`. Inner: same function with the inner `a, b` (shrunk by `wall`), placed at `height − topThickness` in the inner frame. This keeps the top thickness roughly uniform.
- `dishSurfaceZ(layout, x, y)` must return `sculptZ(...)` for the new types. The legend modes, depth preview, homing and stem fillet all depend on it.
- Every temporary Manifold/Mesh must be `.delete()`d.
### 3.2 Rounded skirt
When `skirtStyle==='rounded'`, the hull gets these rings: footprint at z=0 (and z=−1 for inner), footprint at `skirtStraight`, then 8 rings (preview) / 16 (export) for t ∈ (0,1]. Each ring point = index-matched bottom point → top point, with z linear in t and horizontal fraction `f(t) = (R − √(R² − (t·dz)²)) / (R − √(R² − dz²))`, where `dz` = that top point's z − skirtStraight and `R = max(skirtRadius, dz + 1e-3)`. Bottom and top rounded rects must use the same `cornerSeg` so the points line up. See `body()` in the prototype. The profile is convex, so `hull` keeps it.
### 3.3 Choc stem (`stemType:'choc'`)
For each stem position: two prongs (rounded-rect prisms, `chocProngW` − tol × `chocProngL` − tol, corner 0.35) at x = ±`chocSpacing`/2, spanning from z = `chocProngZ` to above the ceiling. Clip them with `intersect(outer ∪ slab below z=0)`, as in the prototype, so they can protrude 0.5 mm below the bottom. Add a 0.2 × 45° tip chamfer (hull of the tip ring and a ring inset 0.2) and a 0.25 ceiling fillet (reuse the flare approach or skip if `stemFillet`=0). No cross hole. Stabilizers for Choc: not supported in v1; for ≥ 2u emit `warn.chocStabs` and add only the centre stem. `stemSeparate`, ribs and flare must still work, or be skipped for Choc with a warning (document which).
`stemRotate=90` rotates the stem geometry (and the stab axis) about Z at each stem position.

## 4. Presets (`params.js` + `main.js`)
Add families with **per-family rows** (the UI currently hard-codes R1–R4: make the row list come from `Object.keys(preset.rows)`, translated via `row.<key>`). Each family must not change legend, colour, unit size, extensions or stem type (same rule as the existing `applyPreset`):
| family | dishType | rows |
| --- | --- | --- |
| `klp` (KLP Normal) | `klp` | `flat`: height 5.65, tiltX 0 · `tilted`: 7.45, 15 · `homing`: 5.65, 0 + `homingBump:true, homingType:'dots3'` |
| `klp-thumb` | `klp-thumb` | `flat` only |
| `klp-saddle` | `klp-saddle` | `flat` · `tilted` · `homing` (as for `klp`) |
Common KLP keys: `dishDepth 0.85, sculptRim 0.86, sculptDrop 0.85, insetL/R/F/B 1.44, rTop 3.2, rBottom 4.3, skirtStyle 'rounded', skirtStraight 1.5, skirtRadius 6.7, wall 0.9, topThickness 1.5`.
Add a **"Switch / Size" quick selector** in the Size section with KLP's four combinations: Choc stem + Choc size, Choc stem + MX size, MX stem + MX size, MX stem + Choc size. It sets `stemType` + `sizeStandard` (pitch/pitchY/gap). Also add a "stem rotated 90°" toggle.

## 5. UI / i18n
- New controls generated from `PARAM_RANGES` like the others. Advanced items (prong dimensions, skirt radius/straight, sculpt rim/drop) go in collapsible "高级 / Advanced" sub-sections.
- `dishType` segmented control gets 3 new options (KLP 凹面 / KLP 拇指 / KLP 马鞍; KLP recess / KLP thumb / KLP saddle) with `?` tooltips.
- `topview.js`: for `stemType:'choc'`, draw two small rectangles instead of the "+". In the side profile, draw the rounded skirt and the sculpt line `sculptZ(·,0,y)`.
- All new keys exist in both `zh` and `en` (parity assert): `warn.chocStabs`, the `row.*` names, `label.*`, `tip.*`, `preset.klp*`, and the attribution text.

## 6. Tests (`tests/geometry.test.mjs`, Node)
- For each KLP family × row × {Choc stem + Choc size, MX + MX, Choc stem + MX size, MX stem + Choc size} × unitW {1, 1.5} × stemRotate {0, 90}: `status()==='NoError'`, volume > 0.
- Choc size 1u bbox X/Y = 17.5 / 16.5 (±0.05); MX size 18 / 18. Flat KLP max Z ≈ 5.65 (±0.1); bbox min Z = −0.5 with a Choc stem.
- `sculptZ` matches this table (world Z, rim 5.65, Choc 1u with KLP preset: tw 14.62, td 13.62) within 0.1 mm:
  `klp (0,0) 4.81 · (3,0) 4.95 · (5,0) 5.27 · (0,3) 5.12 · (3,3) 5.19 · (5,3) 5.43 · klp-thumb (0,−3) 4.70 · (0,−5) 4.45 · (0,−7) 3.90 · klp-saddle (0,5) 4.45 · (0,7) 3.90`
- Thumb: front-edge top z < back-edge top z by > 0.8. Saddle: front ≈ back (±0.05) and both < the centre-row rim.
- Choc prongs: material at (±2.85, 0, 1.0), none at (0, 0, 1.0); rotated 90° → material at (0, ±2.85, 1.0).
- Homing dots3: max Z near (0,0) > recess centre + 0.2.
- Rounded skirt: at z = 3.0 the outer half-width (from a 0.2 mm-thick slice: intersect with a thin box, bbox) is within 0.1 of 8.57 for the Choc 1u.
- Every legend mode works on `klp-saddle` tilted (add to `legend-export.test.mjs`).
- Default MX preview build stays < 150 ms. KLP preview < 250 ms.

## 7. Attribution (required by the author)
- Show a line in the UI when a KLP family is active: "造型参考 KLP Lamé，作者 braindefender（链接）/ Shape based on KLP Lamé by braindefender (link)". It is a plain link to `https://github.com/braindefender/KLP-Lame-Keycaps` that opens in a new tab. No fetch: the app stays offline.
- Add the same credit to `README.md` (both languages).
- In the 3MF metadata, add `<metadata name="Description">… KLP Lamé–style (braindefender) …</metadata>` when a KLP family is active.

## Acceptance (Claude re-checks in headless Chromium + Node)
All tests pass. Selecting KLP Saddle → Tilted with Choc stem + Choc size renders a shape matching `docs/klp/klp_proto.png`, with two prongs visible from below. Language switch shows no raw keys. Export a 3MF and reload a saved project: identical model. Write `docs/REPORT-FEAT-02.md` and end with `FIX-COMPLETE`.
