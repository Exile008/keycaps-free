# Keycap Generator — Technical Spec (v1)

> 中文摘要：离线运行的参数化 3D 键帽 + 字符（Legend）生成器。复刻 vostoklabs/SVG-keycap-generator 的功能（字符嵌入、双色 3MF 导出），
> 但把"固定的方形键帽网格"替换为参照 zk_phi（Qiita）文章的参数化建模：底面矩形 + 倾斜顶面矩形取 hull，
> 圆柱/球面碟形凹陷，抽壳，十字轴裁切。新增：前后/左右倾斜角、顶面四边各自内缩、底面四边各自延伸。支持中英切换。
> This document is the single source of truth for all agents. If something is ambiguous, follow this file; if this file is wrong, write the issue into `docs/QUESTIONS.md` instead of silently deviating.

---

## 1. Hard constraints

1. **Fully offline.** No CDN, no network requests at runtime. Only use files under `vendor/` and `fonts/`.
2. **No build step.** Plain ES modules loaded by the browser. No npm install, no bundler, no TypeScript.
3. Served by `start.bat` → `serve.ps1` (PowerShell static server at `http://localhost:8765/`). Opening `index.html` via `file://` is NOT supported (WASM + modules need http).
4. **Environment-agnostic core.** `js/params.js`, `js/keycap.js`, `js/legend-core.js`, `js/export.js`, `js/manifold-loader.js` must not touch `window`/`document`/DOM so they can run under Node for tests (`node tests/*.test.mjs`). Browser-only code lives in `js/svg-legend.js`, `js/viewer.js`, `js/topview.js`, `js/i18n.js`, `js/main.js`.
5. All user-visible strings go through i18n (`t('key')`). No hard-coded UI text in JS or HTML except inside the i18n dictionaries (HTML may contain the English text as fallback, but must carry `data-i18n`).
6. Units: millimetres, degrees.

## 2. Vendored libraries (already present — do not re-download)

| Path | Library | Notes |
| --- | --- | --- |
| `vendor/three/three.module.js` (+ `three.core.js`) | three.js r186 | Import via import map key `"three"` |
| `vendor/three/addons/OrbitControls.js` | | imports `'three'` |
| `vendor/three/addons/SVGLoader.js` | | browser only (uses DOMParser) |
| `vendor/three/addons/BufferGeometryUtils.js` | | use `toCreasedNormals(geom, 30°)` for shading |
| `vendor/manifold/manifold.js` + `manifold.wasm` | manifold-3d 3.5.4 | `export default Module`; API typings in `vendor/manifold/manifold.d.ts` — READ IT |
| `vendor/opentype/opentype.mjs` | opentype.js 2.0.0 | ESM, works in Node and browser |
| `vendor/fflate/fflate.js` | fflate 0.8.3 | ESM browser build; use `zipSync`, `strToU8`, `unzipSync` |
| `fonts/*.ttf` | inter-bold, jetbrains-mono-bold, orbitron-bold, bebas-neue | OFL |

`index.html` must contain:
```html
<script type="importmap">
{ "imports": { "three": "./vendor/three/three.module.js", "three/addons/": "./vendor/three/addons/" } }
</script>
```

## 3. File layout & ownership

```
index.html            UI shell                                  (Task T3)
css/style.css         styles, dark+light themes                 (T3)
js/i18n.js            zh/en dictionaries + t()/setLang()         (T3)
js/viewer.js          three.js viewport                         (T3)
js/topview.js         2D SVG diagrams (top view + side profile) (T3)
js/main.js            app state, UI binding, regen loop         (T3)
js/manifold-loader.js WASM singleton                            (T1)
js/params.js          defaults, presets, normalize/validate     (T1)
js/keycap.js          parametric keycap body                    (T1)
js/legend-core.js     text→contours, contours→CrossSection, fit, legend boolean modes (T2)
js/svg-legend.js      SVG text → contours (browser, SVGLoader)  (T2)
js/export.js          mesh extraction, STL, 3MF, project JSON   (T2)
tests/*.test.mjs      Node tests                                (T1, T2)
docs/SPEC.md          this file                                 (Claude)
docs/REVIEW-*.md      review notes                              (Claude)
docs/QUESTIONS.md     agents write blocking questions here      (any)
```
**Only edit files you own.** If you need a change in someone else's file, write it in `docs/QUESTIONS.md`.

## 4. Coordinate system & parameters

Origin = switch centre on the keycap's bottom plane. **+X = right, +Y = back (away from the typist), +Z = up.**

### 4.1 Parameter object (flat, JSON-serialisable) — defined in `js/params.js` as `DEFAULT_PARAMS`

| key | default | range | meaning |
| --- | --- | --- | --- |
| `unitW` | 1 | 1–7 | key width in u |
| `unitD` | 1 | 1–3 | key depth in u (vertical keys e.g. numpad +) |
| `pitch` | 19.05 | | 1u pitch |
| `gap` | 1.05 | 0–3 | nominal bottom = unit·pitch − gap (1u → 18.0) |
| `extL` `extR` `extF` `extB` | 0 | −3…+6 | **bottom footprint per-side extension** (mm). Stem stays at origin. (zk_phi's "0.125u longer thumb key") |
| `insetL` `insetR` `insetF` `insetB` | 2.6, 2.6, 3.4, 1.2 | 0.3…8 | **top face per-side inset**: horizontal distance from bottom edge to top edge, measured *before* tilt. Asymmetric F/B is what real sculpted keycaps have. |
| `height` | 8.0 | 3–18 | Z of top-face centre (before dish) |
| `tiltX` | 5 | −20…+20 | pitch, degrees. **+ = back edge higher** (face tilts towards typist) |
| `tiltY` | 0 | −20…+20 | roll, degrees. **+ = right edge higher** |
| `rBottom` | 0.6 | 0.1–4 | bottom corner radius |
| `rTop` | 2.0 | 0.1–6 | top corner radius |
| `dishType` | `'cylindrical'` | `'cylindrical' \| 'spherical' \| 'flat'` | |
| `dishDepth` | 0.8 | 0–2.5 | sagitta at centre |
| `wall` | 1.5 | 0.8–3 | side wall thickness |
| `topThickness` | 1.5 | 0.8–4 | top thickness (measured along Z at centre) |
| `stemType` | `'mx'` | `'mx' \| 'none'` | |
| `stemOuterD` | 5.5 | 4.5–6.5 | |
| `stemCrossLen` | 4.0 | | cross arm length (both arms) |
| `stemCrossH` | 1.25 | | width (in X) of the Y-direction bar |
| `stemCrossV` | 1.10 | | width (in Y) of the X-direction bar |
| `stemCrossDepth` | 4.0 | 3.6–6 | depth of cross hole from stem bottom |
| `stemTolerance` | 0 | −0.2…+0.3 | added to `stemCrossH` and `stemCrossV` (+ = looser) |
| `stemZ` | 0.0 | 0–3 | stem bottom Z |
| `stemFillet` | 1.0 | 0–3 | reinforcement flare where each stem meets the inner top: a solid of revolution widening from `stemOuterD/2` at `junction − stemFillet` to `stemOuterD/2 + stemFillet` at the junction, with a concave quarter-circle profile. Clipped to the inner body (0.05 mm union overlap into the shell) so it merges with tilted/dished tops and never pokes through the outer surface. |
| `stemRibs` | `'none'` | `'none' \| 'cross'` | `'cross'` adds ribs from the main stem outward along ±X and ±Y to the inner walls |
| `ribThickness` | 1.0 | 0.6–2.0 | rib width (mm) |
| `ribHeight` | 2.0 | 0.5–6 | rib depth measured along Z from the local inner top surface |
| `stemSeparate` | false | | build the stem cylinders + cross hole + fillet flare as an additional `stem` part (multi-colour / multi-material). The stem part is clipped at the inner ceiling, so it never reaches the top plate; the cap keeps its full, unbroken top face and removes exactly the stem volume below it. |
| `stemColor` | `#f2f2f2` | | colour/material of the separate stem part |
| `stabilizers` | `'auto'` | `'auto' \| 'none'` | add Cherry stab stems for ≥2u |
| `homingBump` | false | | |
| `legendMode` | `'inlay'` | `'inlay' \| 'recessed' \| 'raised' \| 'shine'` | see §6 |
| `legendSize` | 8 | 2–16 | max(bboxW, bboxH) of legend |
| `legendDepth` | 0.6 | 0.2–1.5 | |
| `legendRot` | 0 | −180…180 | |
| `legendX` `legendY` | 0 | −8…8 | offset in top-face local frame |
| `legendMirror` | false | | mirror X |
| `capColor` `legendColor` | `#1c1c1e` `#f2f2f2` | | |

Legend *source* is not in params: `{kind:'none'} | {kind:'text', text, fontId} | {kind:'svg', name, svgText}` (owned by main.js state).

### 4.2 `normalizeParams(p) → { params, warnings }`
Fill missing keys from defaults, clamp to ranges, and emit warning *keys* (i18n keys, e.g. `warn.topTooSmall`) when: top width/depth < 4 mm (clamp insets so top ≥ 4 mm), `dishDepth` > 0.3·topWidth, `topThickness + dishDepth ≥ height − 1`, inner body would be invalid (bottom − 2·wall ≤ stemOuterD + 1), wall too thin for tilt. Never throw for user input.

The reinforcement keys are handled by the same generic path: `stemFillet`, `ribThickness` and `ribHeight` are numbers clamped to their ranges; `stemRibs` is one of `'none' | 'cross'` (invalid → `'none'`); `stemSeparate` is coerced to boolean; `stemColor` is a string (invalid → default). They emit no additional warnings because the geometry clips the flare/ribs to the inner cavity. `applyPreset` keeps all stem/reinforcement/colour settings.

### 4.3 Presets — `PRESETS` in `js/params.js`
Approximate starting points only (label them "approx." in UI). 1u bottom 18×18. Each preset = partial params; rows override `height` & `tiltX`.

| family | dish | insets L/R/F/B | rTop | rows (height mm / tiltX °) |
| --- | --- | --- | --- | --- |
| `cherry` | cyl 0.6 | 2.6/2.6/3.4/1.2 | 2.0 | R1 9.4/+9, R2 7.9/+5, R3 7.4/+1, R4 7.6/−6 |
| `oem` | cyl 0.7 | 2.5/2.5/3.6/1.0 | 2.0 | R1 11.9/+10, R2 9.9/+6, R3 9.4/+2, R4 10.4/−6 |
| `sa` | sph 1.0 | 2.3/2.3/2.6/2.0 | 3.0 | R1 14.9/+13, R2 12.9/+7, R3 12.4/0, R4 12.9/−7 |
| `dsa` | sph 1.0 | 2.65 all | 2.0 | uniform 7.6/0 |
| `xda` | sph 0.6 | 1.0 all | 2.5 | uniform 9.1/0 |
| `flat` | flat | 2.0 all | 1.5 | uniform 6.0/0 |

Export helper `applyPreset(params, family, row)` → new params (keeps legend/colour/size/extension/stem settings).
Size list for UI: 1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 3, 6, 6.25, 7 (+ custom numeric).

## 5. Keycap geometry — `js/keycap.js`

Proven feasible by Claude with manifold-3d in Node (~10 ms per cap). Follow zk_phi:

### 5.1 Layout — `computeLayout(p) → Layout`
```
W = unitW*pitch - gap,  D = unitD*pitch - gap
bottom: x0 = -W/2 - extL, x1 = W/2 + extR, y0 = -D/2 - extF, y1 = D/2 + extB
top (pre-tilt, horizontal): tx0 = x0+insetL, tx1 = x1-insetR, ty0 = y0+insetF, ty1 = y1-insetB
tw = tx1-tx0, td = ty1-ty0, tc = ((tx0+tx1)/2, (ty0+ty1)/2)
R  = Rx(+tiltX) · Ry(-tiltY)            // 3×3, applied to top-local points
frame.origin = (tc.x, tc.y, height),  frame.R = R,  frame.normal = R·(0,0,1)
toWorld(local) = R·local + origin
```
`Layout = { bottom:{x0,x1,y0,y1,w,d,cx,cy}, top:{w,d,cx,cy}, frame:{origin,R,normal,mat4}, stems:[[x,y],...], dish:{type,r,depth}, warnings }`
`frame.mat4` = column-major 4×4 suitable for `Manifold.prototype.transform` (check `manifold.d.ts` for the exact Mat4 layout and verify with a unit test: transforming local (1,0,0) must equal `toWorld([1,0,0])`).
Provide `export function toWorld(layout, [x,y,z])` and `export function dishSurfaceZ(layout, x, y)` (local Z of the dish surface at local (x,y); 0 for flat).

### 5.2 Outer body — `buildOuter(wasm, p, layout, q)`
1. Bottom ring: rounded rect (x0..x1, y0..y1, `rBottom`) at z=0, `q.cornerSeg` points per corner.
2. Top ring: rounded rect (tw×td, `rTop`) in top-local XY plane at local z=0, transformed by `toWorld`.
3. `Manifold.hull([...bottomPts, ...topPts])`.
4. Dish (in top-local frame, then `.transform(frame.mat4)`):
   - cylindrical: chord c = tw, `r = (c² + 4d²)/(8d)`, cylinder axis = local Y, length td+40, centre at local (0,0,r−d).
   - spherical: chord c = √(tw² + td²) (diagonal, per zk_phi), sphere centre local (0,0,r−d).
   - flat or d < 0.05: none.
   Subtract from hull.
### 5.3 Inner body — same function with
`x0+wall, x1−wall, y0+wall, y1−wall`; **same insets** (zk_phi: 18→14 outer, 15→11 inner); `height − topThickness`; same tilt; same dish depth; `rBottom' = max(0.1, rBottom − wall/2)`, `rTop' = max(0.3, rTop − wall/2)`. The inner hull gets the bottom ring at z = 0 **and an identical copy at z = −1** (so subtraction cleanly opens the bottom without changing the wall slope).
v1 approximation: sloped walls are slightly thinner than `wall` measured normally — acceptable, document it.
### 5.4 Stems, fillet flare and ribs
- Stem positions: always (0,0). If `stabilizers==='auto'`, along the long axis (X if unitW ≥ unitD else Y), add ± offset: 2 ≤ L < 3 → 11.938; 3 ≤ L < 6 → 19.05; 6 → 47.625 ; 6.25 → 50.0 ; 6.5 → 52.385 ; 7 → 57.15 (L = units along that axis; pick the nearest listed size ≥ 6).
- Each stem: cylinder d=`stemOuterD` from z=`stemZ` to z=`height+5`; the union is intersected with `outer` (`stemSolid`, zk_phi's trick so stems never poke through the top). A cross (two boxes, X-arm `stemCrossLen × (stemCrossV+tol)`, Y-arm `(stemCrossH+tol) × stemCrossLen`, from z=`stemZ−1` to `stemZ+stemCrossDepth`) is subtracted as a separate `crossCut` manifold from `stemSolid`, the flare and the final cap body. This keeps the cross clear when `stemCrossDepth` reaches the flare or even the shell plate.
- **Fillet flare** (`stemFillet > 0`): for every stem, compute the local inner top surface Z at the stem axis (tilt + dish included). Revolve a cross-section profile about Z: radius `r0 = stemOuterD/2` at `junction − f`, following a concave quarter-circle to `r0 + f` at the junction, then a cylinder of radius `r0 + f` extended to `height+5`. Union the per-stem flares, intersect with the inner body translated up by 0.05 mm (volumetric union overlap; `topThickness ≥ 0.8` means it cannot reach the outer surface), then subtract `crossCut`. The 0.05 mm overlap makes the union with the shell robust while remaining visually flush.
- **Ribs** (`stemRibs === 'cross'`): only for `stemType === 'mx'` and only around the main centre stem (stabilizer stems are skipped). Build two tall box slabs of width `ribThickness`, one along X and one along Y, centred on the stem and spanning the key; intersect with the inner body (plus the same 0.05 mm upward overlap); subtract the inner body translated down by `ribHeight − 0.05` to obtain a layer hanging from the tilted/dished inner ceiling. Trim against `stemSolid` for every stem (so no rib enters a cross hole or a stabilizer stem). Ribs never extend below `stemZ`. Ribs are identical in joined and separate modes; in separate mode the cap complement (`joinedCap − stemPart`) removes any rib volume that would overlap the stem part.
- When `stemSeparate` is true, `stemPart = (stems ∪ flare) ∩ inner`; ribs stay with the cap. The cap is the exact complement of `stemPart` (see §5.5).
### 5.5 Assembly — `buildKeycap(wasm, p, {quality}) → { outer, inner, shell, stems, stemSolid, crossCut, flare, ribs, stemPart, capBody, layout, quality }`
`shell = outer − inner`. Then `stems = stemSolid − crossCut`, `flare` (§5.4), `ribs` (§5.4).
- Joined (default): `capBody = (shell ∪ stems ∪ flare ∪ ribs) − crossCut`. The final cross cut is a no-op unless `stemCrossDepth` reaches into the shell plate.
- `stemSeparate: true`:
  - `stemPart = (stems ∪ flare) ∩ inner`. Clipping at the inner ceiling keeps the stem entirely below the top plate; the stem's top face is flush with the underside of the plate (no exposure on the outer top face).
  - `capBody = joined capBody − stemPart`, where the joined cap body is built exactly as in the non-separate case (shell ∪ stems ∪ flare ∪ ribs, homing bump, cross cut). The cap therefore keeps the former stem plug as part of its unbroken top plate.
  - Cap and stem share no volume and leave no gap: `volume(cap) + volume(stemPart) = volume(joined capBody)` exactly, and `cap ∩ stemPart ≈ 0` (floating-point residue only). `ribs` stay attached to the cap; ribs are identical in joined and separate modes, and the complement removes any rib portion that would cross the stem part. Ribs are trimmed against the full stem cylinders (and are mode-independent).
  - Exact coplanar cuts can leave zero-volume sliver shells in the separate cap; they are harmless and deliberately not "repaired" with decompose/re-union (that perturbs the mesh and breaks the exact volume identity).
- `stemType: 'none'` (or no stems) → `stemPart = null` regardless of `stemSeparate`.
- The cap's top-plate volume (`cap ∩ (outer − inner)`) is identical between separate and joined models because the stem part is clipped strictly to `inner`; only the stem volume below the plate is reassigned.
- Homing bump: capsule 5×1 mm, radius 0.5, centred on local (0, −td/2+3) placed on `dishSurfaceZ`, sunk 0.15 into the surface, unioned to capBody (always part of the cap, including when the stem is separate).

Quality: `preview` = {cornerSeg:6, circleSeg:48, dishSeg:128}; `export` = {cornerSeg:12, circleSeg:96, dishSeg:360}.
All intermediate Manifolds that are not returned must be `.delete()`d (WASM memory). The flare/ribs use the inner body (plus 0.05 mm) for clipping; `crossCut` is a shared manifold subtracted from several intermediates and is returned so `buildModel` can release it.

### 5.6 Full model — `buildModel(wasm, p, legendCS, {quality}) → { cap, legend|null, stem|null, layout, warnings, stats:{ms, tris} }`
Lives in `js/keycap.js` but delegates the legend boolean to `applyLegend` from `legend-core.js` (T2). `stem` is non-null only when `stemSeparate` is true and `stemType !== 'none'`; it is the `stemPart` from §5.5 and is independent of the legend source. Callers that ignore `stem` keep the previous 2-part behaviour. `stats.tris` counts cap + legend + stem. After the legend is applied, `buildModel` deletes every intermediate it does not return (`outer`, `inner`, `shell`, `stems`, `stemSolid`, `crossCut`, `flare`, `ribs`, and `capBody` when it was replaced), so the caller only owns `cap`, `legend` and `stem`.

## 6. Legend — `js/legend-core.js`, `js/svg-legend.js`

- `textToContours(font /*opentype Font*/, text, {tolerance=0.05}) → Polygons` — use `font.getPath(text, 0, 0, 100)`, flatten Q/C beziers adaptively, flip Y (opentype path is Y-down) so output is Y-up. Multi-line not required. Must handle CJK glyphs from user fonts.
- `loadFont(arrayBuffer) → Font` via `opentype.parse`. Bundled font ids: `inter-bold`, `jetbrains-mono-bold`, `orbitron-bold`, `bebas-neue` → `fonts/<id>.ttf`.
- `svgToContours(svgText) → { polygons, fillRule }` (browser): `SVGLoader.parse` → filled paths via `SVGLoader.createShapes` + `extractPoints(12)` (shape + holes); **stroked paths** (fill none, stroke set — e.g. Lucide/Tabler icons) → union of per-segment capsules of width = stroke-width (rect per segment + circle per vertex, 16 segments). Apply path/group transforms (SVGLoader already bakes them). Flip Y.
- `contoursToCrossSection(wasm, polygons, fillRule='NonZero') → CrossSection`.
- `fitLegend(cs, {size, rot, x, y, mirror}) → CrossSection`: centre bbox at origin → uniform scale so max(w,h)=size → mirror X → rotate → translate (x,y).
- `applyLegend(wasm, parts /* from buildKeycap */, legendCS, p) → { cap, legend }`. Let `n` = frame.normal, `prism = legendCS.extrude(40).translate([0,0,-20]).transform(frame.mat4)`, `O = parts.outer`, and `separate = p.stemSeparate && parts.stemPart`:
  - `inlay` (two colour, flush): `L = prism ∩ (O − O.translate(−n·depth))`; `cap = capBody − L`; `legend = L` (when separate, `legend = L − stemPart`).
  - `recessed` (single colour engrave): `cap = capBody − L`; `legend = null`.
  - `raised`: `legend = prism ∩ (O.translate(+n·depth) − O)`, unioned with a 0.05 mm overlap into the surface; `cap = capBody` (when separate, subtract `stemPart` from the raised legend; it is normally a no-op).
  - `shine` (shine-through): `L = prism ∩ (O − O.translate(−n·(topThickness+dishDepth+0.5)))`.
    - Joined: `cap = shell − L`, `legend = L ∪ stems ∪ flare` (stem + flare printed in legend colour, like the original).
    - `stemSeparate: true`: `cap = capBody − L` (capBody already excludes the stem), `legend = L − stemPart`. The legend no longer contains the stems; they are their own part.
- When `stemSeparate` is true, the stem lies under the top plate and legend material is clipped by `stemPart` (typically a no-op for shallow legends and a guarantee for `shine`), so all printed parts (cap / legend / stem) are volume-disjoint. The cap keeps its complete top face; no stem-coloured disc is exposed on top.
- Legend outside the top face is allowed but emit warning `warn.legendOverflow` if legend bbox exceeds tw/td.

## 7. Export — `js/export.js`

- `meshData(manifold) → { positions: Float32Array, indices: Uint32Array }` from `getMesh()` (respect `numProp`; first 3 props are xyz).
- `toSTL(parts:[{name, manifold}]) → Uint8Array` — binary STL, all parts merged. 84 + 50·tris bytes.
- `to3MF(parts:[{name, manifold, color}]) → Uint8Array` — zip (fflate `zipSync`) with `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`. `unit="millimeter"`, one `<basematerials id="1">` with a `<base name displaycolor="#RRGGBBFF">` per part, one mesh `<object type="model">` per part with `pid="1" pindex="i"`, plus one parent object containing `<components>` of the parts; `<build>` has one `<item>` for the parent. The function is part-count agnostic: 2 parts open as one object with "Keycap"/"Legend"; with `stemSeparate` and a visible legend there are **3 parts — "Keycap"/"Legend"/"Stem"** (stem uses `stemColor`), and with `legendMode: 'recessed'` (no legend part) there are 2 parts "Keycap"/"Stem". All must open in PrusaSlicer / OrcaSlicer / Bambu Studio as one object with N parts.
- `toSTL(parts)` already merges any number of parts, so "STL (merged)" includes the stem when separate. Callers may also pass a single part or the `stem` part on its own to produce a standalone stem STL (same position/orientation as in the assembly).
- `projectToJSON(state) / projectFromJSON(text)` — `{app:"keycap-generator", version:1, params, legendSource}`; embed SVG text and custom font as base64. Unknown keys ignored; missing keys → defaults. The new `stemFillet`, `stemRibs`, `ribThickness`, `ribHeight`, `stemSeparate` and `stemColor` keys are members of `DEFAULT_PARAMS`, so they round-trip automatically through `normalizeParams`.
- File names: `keycap_<unitW>u_<legend>.3mf` / `.stl` (sanitised).
- STL button exports a zip? No — v1: buttons "STL (keycap)", "STL (legend)" (legend disabled when null), plus "STL (merged)". When `stemSeparate` is enabled an additional "STL (stem)" export should be offered (UI task); the core only requires that `toSTL([{name:'Stem', manifold: stem}])` is valid.

## 8. UI — `index.html`, `js/main.js`, `js/viewer.js`, `js/topview.js`, `js/i18n.js`

Layout follows the original: top bar + 3 columns (left params / centre 3D viewport / right legend & export). Dark default, light theme toggle. Language toggle button in top bar (`中文 / EN`), persisted in `localStorage['kcg-lang']`, default from `navigator.language` (zh* → zh). Theme in `localStorage['kcg-theme']`.

**Left sidebar (Keycap):**
1. Profile preset: family select + row select (R1–R4, hidden for uniform families) + "Apply" — label "approx.".
2. Size: unit width select (+custom number), unit depth.
3. **Top face (顶面)**: 4 inset sliders L/R/F/B with a link toggle "symmetric L/R"; read-only derived top size `tw × td`.
4. **Footprint extension (底面延伸)**: 4 sliders L/R/F/B.
5. **Height & tilt (高度与倾斜)**: height, tiltX (前后倾斜), tiltY (左右倾斜).
6. Corners: rBottom, rTop. Dish: type segmented control + depth.
7. Shell: wall, topThickness.
8. Stem: type, tolerance stepper (−/+ 0.05), stem Z, stabilizers toggle, homing bump toggle.
Every numeric control = slider + number input (like the original `.prow`). Each section has a reset button.

**Centre:** three.js viewport (orbit/zoom/pan, grid, view buttons Iso/Top/Front/Side), status line, stats (triangles, ms), warning chips (translated). Bottom-left overlay: `topview.js` live SVG mini-diagram (≈180×180) showing **top view** (bottom rect, top rect, stem positions, F/B/L/R labels) and **side profile** (Y–Z section showing heights & tilt). This makes asymmetric insets understandable.

**Right sidebar (Legend):** tabs Text / SVG / None. Text: input (maxlength 6), font select (bundled + imported), "Import font (.ttf/.otf)". SVG: upload (multiple), thumbnail gallery, select one. Placement: size, depth, rotation, X, Y, mirror. Mode: inlay / recessed / raised / shine (segmented, with ? tooltips). Colours: cap, legend. Export: **Download 3MF** (primary), STL buttons, Export blank keycap. Project: Save / Load JSON. Help modal (translated) explaining the parameters with a small diagram.

**Regeneration:** debounce 120 ms on input; build with `quality:'preview'`; export rebuilds with `quality:'export'`. Show "generating…" badge. Catch errors → status (translated) and keep last good mesh. Free old Manifolds.

**Viewer contract (`js/viewer.js`):** `createViewer(container) → { setParts([{name, positions, indices, color}]), setColor(name, hex), setView('iso'|'top'|'front'|'side'), frame(), dispose() }`. Use `toCreasedNormals(geom, 30°·π/180)`, MeshStandardMaterial, hemisphere + directional light, ground grid at z=0. three.js is Y-up: rotate the root group −90° about X so model Z is up.

**i18n contract (`js/i18n.js`):** `t(key, vars?)`, `setLang('zh'|'en')`, `getLang()`, `applyI18n(root=document)` (handles `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-tip`), dispatches `window` event `langchange`. Both dictionaries must have identical key sets (test it with a console assert at load in dev). Include all `warn.*` and `err.*` keys used by core modules.

## 9. Acceptance checklist (Claude reviews against this)

- [ ] `start.bat` → page loads with zero console errors and zero network requests outside localhost.
- [ ] Default cap renders < 300 ms (preview).
- [ ] Changing any inset / extension / tilt updates the 3D view and the 2D diagram; asymmetric F/B insets are visibly asymmetric.
- [ ] All presets × rows × sizes {1, 1.25, 2, 2.25, 6.25} produce `status()==='NoError'` manifolds (Node test).
- [ ] Text legend (bundled font + imported CJK font) and SVG legend (filled + stroked) work in all 4 modes.
- [ ] 3MF opens as one object / two parts with colours in PrusaSlicer/Orca/Bambu; STL valid.
- [ ] Language toggle switches every visible string including tooltips, warnings, status, help.
- [ ] Save → reload page → Load restores identical model.
- [ ] `node tests/geometry.test.mjs` and `node tests/legend-export.test.mjs` pass.

## 10. KLP Lamé–style caps, Choc stems and sizes (FEAT-02, 2026-10-22)

Shape after braindefender's [KLP Lamé Keycaps](https://github.com/braindefender/KLP-Lame-Keycaps), re-created parametrically (no meshes bundled). Attribution is required: the UI shows a credit link (`#klp-credit`) whenever a `klp*` dish is active, README credits it in both languages, and the 3MF gets `<metadata name="Description">… KLP Lamé–style shape (braindefender, URL)</metadata>` (`to3MF(parts, {description})`; no metadata otherwise).

### 10.1 New parameters
| key | default | range / values | meaning |
| --- | --- | --- | --- |
| `pitchY` | `null` | 15–20 | Y pitch; `null` = `pitch`. `D = unitD·(pitchY ?? pitch) − gap`. |
| `sizeStandard` | `'mx'` | `'mx' \| 'choc' \| 'custom'` | UI helper. `SIZE_STANDARD_VALUES`: mx = 19.05/19.05/1.05, choc = 18/17/0.5 (pitch/pitchY/gap). |
| `stemType` | `'mx'` | + `'choc'` | Kailh Choc v1 prongs. |
| `stemRotate` | 0 | 0 \| 90 (anything else → 0) | rotates the stem pattern about Z at each stem position (MX cross or Choc prongs). Stem positions are not moved. |
| `chocProngW` `chocProngL` `chocSpacing` `chocProngZ` | 1.2, 3.0, 5.7, −0.5 | 0.7–1.7, 2.5–3.5, 5.2–6.2, −1–0 | prong size (X × Y), centre distance, tip Z. `stemTolerance` shrinks W and L. |
| `skirtStyle` | `'straight'` | `'straight' \| 'rounded'` | |
| `skirtStraight` `skirtRadius` | 1.5, 6.7 | 0–4, 2–20 | rounded skirt: vertical part, arc radius. |
| `dishType` | | + `'klp' \| 'klp-thumb' \| 'klp-saddle'` | sculpted tops (§10.2). `dishDepth` = recess depth. |
| `sculptRim` `sculptDrop` | 0.86, 0.85 | 0.3–3, 0–3 | recess rim width; thumb/saddle edge drop. |
| `homingType` | `'bar'` | `'bar' \| 'dots3'` | dots3 = three spheres (r 0.8 at the centre, r 0.75 at ±1.5 mm in X), centres 0.5 below the top surface. |
| `rBottom` range | max **6** | | KLP needs 4.3. |

Old projects without these keys load exactly as before. New warnings: `warn.chocStabs` (Choc with `stabilizers:'auto'` at ≥ 2u: only the centre stem is built), `warn.chocRibs` (ribs are skipped with Choc stems; they would block the switch stem between the prongs).

### 10.2 Geometry (`js/keycap.js`)
- `sculptZ(type, a, b, p, x, y)` (exported), top-local, z = 0 is the rim plane. `ax = a − sculptRim`, `ay = b − sculptRim`, `Gx = (1 − min(1,|x|/ax)^2.5)^1.3`, `Gy = (1 − min(1,|y|/ay)^1.7)^1.2`. `klp`: `−D·Gx·Gy`. `klp-thumb`: for y < 0 `−D·Gx − drop·(|y|/b)^2.77`, else as `klp`. `klp-saddle`: `−D·Gx − drop·(|y|/b)^2.77` on both sides. `dishSurfaceZ` returns it for `klp*` dishes.
- Cutter: closed height-field mesh between `min(sculptZ,0) + 0.02` and +30, dense over ±(half + 1.5) (`QUALITY.sculptGrid` 48 / 120 cells, scaled up to 4× along the long axis) and coarser out to ±(half + 6 + height), so thumb/saddle cuts also shave the skirt. Placed with `frame.mat4`. The inner hull gets the same cutter built from its own (wall-shrunk) top size at `height − topThickness`.
- Rounded skirt: footprint at z = 0 (and −1 for the inner hull), at `zs = min(skirtStraight, lowest top point − 0.2)`, then `QUALITY.skirtRings` (8 / 16) rings: each footprint point moves to its index-matched top point with z linear in t and horizontal fraction `f(t) = (R − √(R² − (t·dz)²)) / (R − √(R² − dz²))`, `R = max(skirtRadius, dz + 1e-3)`.
- Choc: per stem position two rounded-rect prongs (corner 0.35) at ±`chocSpacing`/2, hull from `chocProngZ` (inset 0.2 → 0.2 × 45° tip chamfer) up into the top, clipped to `outer ∪ slab below z = 0`, so tips protrude below the cap bottom. No cross hole. Reinforcement: a 45° chamfer of `min(stemFillet, 0.5)` around each prong at the ceiling, clipped to the inner cavity. `stemSeparate` works (stem part = prongs + chamfer ∩ inner).
- Ribs (MX) are trimmed against cylinders 0.05 mm thinner than the stems, so the rib overlaps the stem wall (a touching-only union could leave spurious tunnels). The final cross-hole cut through the joined cap is skipped when the cross top stays below the inner ceiling at every stem (it is volumetrically empty then).

### 10.3 Presets
`PRESETS.klp`, `klp-thumb`, `klp-saddle` with per-family rows (`presetRows(family)`, `presetDefaultRow(family)`): `flat` (height 5.65, tiltX 0), `tilted` (7.45, 15), `homing` (5.65, 0, `homingBump:true`, `homingType:'dots3'`); thumb has `flat` only. Common keys: dishDepth 0.85, sculptRim 0.86, sculptDrop 0.85, insets 1.44, rTop 3.2, rBottom 4.3, skirt rounded 1.5 / 6.7, wall 0.9, topThickness 1.5. `applyPreset` sets `PRESET_PARAM_KEYS` the preset defines plus the row keys; classic families set `skirtStyle:'straight'`. Legend, colour, size, extensions and stem settings are kept.

### 10.4 UI
Profile: row select built from the family's rows (`R1–R4`, or `row.flat/tilted/homing`). Size: "Switch / size" select (Choc or MX stem × Choc or MX size; shows Custom otherwise). Corners: skirt style + Advanced (vertical part, arc radius). Dish: 3 KLP options + Advanced (rim, edge drop). Stem: Choc option, "Rotate stem 90°", Advanced Choc prong dimensions (Choc only; stem Z hidden for Choc), homing style (when the homing bump is on). Top view draws two prong rectangles for Choc; the side profile draws the rounded skirt and, for KLP tops, the centre-line sculpt clipped against the skirt. Depth preview uses `sculptZ` for the inner surface.
