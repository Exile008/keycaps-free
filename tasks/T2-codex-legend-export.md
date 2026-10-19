# Task T2 — Legend booleans + 3MF/STL export  (agent: **codex**, run after T1 passes)

**Read `docs/SPEC.md` (§1, §2, §6, §7) and `docs/REPORT-T1.md` first.** Use the existing `js/keycap.js` / `js/params.js` API — do not modify them (put requests in `docs/QUESTIONS.md`).

## Files you own
- `js/legend-core.js` (Node + browser)
- `js/svg-legend.js` (browser only, uses `three/addons/loaders/SVGLoader.js` via the import map)
- `js/export.js` (Node + browser)
- `tests/legend-export.test.mjs`
- `tests/fixtures/` (small SVGs: one filled path with a hole e.g. a ring, one stroke-only Lucide-style icon, one with a `transform` on a `<g>`)

## Requirements
1. `legend-core.js`: `loadFont`, `BUNDLED_FONTS` (id → relative URL + display name), `textToContours`, `contoursToCrossSection`, `fitLegend`, `applyLegend` exactly per SPEC §6. Adaptive bezier flattening (tolerance in font units scaled so result ≈ 0.02 mm at size 8). Ignore zero-area contours. Text with only spaces → empty → return cap without legend + warning `warn.legendEmpty`.
2. `svg-legend.js`: `svgToContours(svgText)` per SPEC §6 — must support filled paths with holes, `fill-rule="evenodd"`, stroke-only icons (stroke-width, round caps/joins approximated by circles), basic shapes (`rect`, `circle`, `ellipse`, `polygon`, `polyline`, `line` — SVGLoader handles these), group transforms, `viewBox`. Throw `Error('err.svgNoShapes')` if nothing usable.
3. `applyLegend` must return valid manifolds (`status()==='NoError'`) for all four modes and must `.delete()` temporaries. For `shine` the stems move to the legend part (SPEC §6).
4. `export.js`: `meshData`, `toSTL`, `to3MF`, `projectToJSON`, `projectFromJSON`, `safeFileName` per SPEC §7. 3MF XML must be well-formed and use the core 3MF namespace `http://schemas.microsoft.com/3dmanufacturing/core/2015/02`. Write vertices with ≤ 4 decimals.

## Tests (`tests/legend-export.test.mjs`, Node)
- Text "A", "Esc", and "⌘" (a glyph the bundled fonts lack → warning `warn.glyphMissing`, no crash) with each bundled font (read files with `fs`) × modes {inlay, recessed, raised, shine} on presets cherry-R3 1u and sa-R1 2.25u: all parts valid; inlay legend volume ≈ glyph area × depth (±25%); recessed cap volume < plain cap volume.
- Legend overflow (size 16 on 1u) → warning `warn.legendOverflow`, still valid.
- STL: byte length == 84 + 50·tris; header tri count matches.
- 3MF: `unzipSync` → 3 required files exist; model XML parses (simple regex/structure check is fine in Node), vertex/triangle counts match `meshData`; two `<base>` entries with the right colours; one `<build><item>`.
- Project JSON round-trip equality (params + legendSource incl. base64 font).
- SVG parsing cannot run in Node (DOMParser) — instead create `tests/svg-legend.html` (a manual browser test page that loads each fixture, runs `svgToContours`, and draws the polygons on a canvas with pass/fail text). Keep it self-contained, offline.

## Done when
`node tests/legend-export.test.mjs` and `node tests/geometry.test.mjs` both pass. Append `docs/REPORT-T2.md` (built, deviations, limitations, how to open `tests/svg-legend.html` via `start.bat` → `http://localhost:8765/tests/svg-legend.html`).
