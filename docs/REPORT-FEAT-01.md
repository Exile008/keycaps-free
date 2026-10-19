# REPORT FEAT-01: legend depth preview and stem reinforcement / separate stem part (2026-10-19)

## Features
1. **Legend depth section preview.** `js/depth-preview.js` sits under the legend Depth control. It draws a 2D section through the top face along local X at `legendY`, showing:
   - the dish curve and the inner top surface
   - the legend band for each of the 4 modes
   - labels for depth, top thickness and remaining material
   - a red warning when the remaining material is < 0.4 mm or the depth is ≥ `topThickness`

   `computeLayout` and `dishSurfaceZ` are injected from `main.js` (`core.keycap`), so loading still tolerates a missing module. The section is schematic: the legend band uses the bbox width and the vertical scale is exaggerated.
2. **Stem reinforcement.**
   - `stemFillet` (0–3 mm, default 1): a quarter-circle flare at the stem–ceiling junction, clipped to the inner body.
   - `stemRibs` `none|cross`, with `ribThickness` (0.6–2, default 1) and `ribHeight` (0.5–6, default 2): ribs from the main stem to the inner walls.
   - The cross hole is cut from everything.
3. **Separate stem part.** With `stemSeparate` and `stemColor`, `buildModel` returns `stem`:
   - `stem = (stems ∪ flare) ∩ inner`, so it stops under the top plate.
   - `cap = joinedCap − stem` exactly. Ribs stay with the cap.
   - The 3MF gets a third part, "Stem". There is a new "STL (stem)" button, and the merged STL includes the stem.
   - A blank export with a separate stem produces a Keycap + Stem 3MF.
   - In shine mode with `stemSeparate`, the stems are no longer part of the legend.

The geometry details are in SPEC §4.1, §5.4–5.6 and §6.

## Verification
- `node tests/geometry.test.mjs`: 4220/4220 PASS. `node tests/legend-export.test.mjs`: 470 PASS.
- Volume checks: cap + stem equals the joined cap, cap ∩ stem ≈ 0, the top-plate volume is the same in both modes, and the cross hole is clear.
- Headless Chromium: depth preview 56/56 and stem UI 53/53, with 0 console errors. The 3MF has 2 or 3 parts as expected and STL sizes are valid. kcg-last and the project JSON round-trip correctly. FIX-01/02 regressions pass.
- Preview build for the default 1u: about 7.6 ms (it was 1.1 ms; the fillet adds geometry).

## Notes
- The stem controls stay visible when `stemType = 'none'` (they have no effect then).
- Only Chromium was tested.
