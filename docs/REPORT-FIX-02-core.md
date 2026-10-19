# REPORT FIX-02 (core): SVG parts API

Scope: `js/svg-legend.js` and the `legendSource` persistence in `js/export.js`. The dialog and the UI integration are a separate step.

## Files
- `js/svg-legend.js`: parts API (below)
- `js/export.js`: `source()` keeps `partModes` and `svgOptions`, with type validation
- `tests/legend-export.test.mjs`: round-trip and invalid-type tests
- `tests/svg-legend.html` (extended), `tests/svg-parts.test.html` (new, automated, results in `<pre id="result">`)

## API (named exports of `js/svg-legend.js`)
```js
parseSvgParts(svgText) => {
  viewBox: {x, y, w, h},                 // original SVG coordinates (Y-down)
  parts: [{
    id, index, tag,                      // 'p0', 'p1', … in painter's order
    fill, stroke,                        // '#rrggbb' | null
    strokeWidth, opacity, fillOpacity, strokeOpacity,   // effective values, including ancestor opacity
    fillPolys, fillRule,                 // Polygons | null, 'EvenOdd' | 'NonZero'; SVG units, Y-up
    outlinePaths: [{points, closed}],
    bbox: {minX, minY, maxX, maxY}, area,               // Y-up; area excludes holes
    role: 'artboard'|'background'|'faint'|'fill'|'stroke',
    defaultMode: 'fill'|'outline'|'cut'|'off'
  }],
  groups: [{key, partIds, fill, stroke, role, defaultMode}], // key is opaque; apply changes through partIds
  warnings: [] | ['warn.svgTextIgnored']
}
defaultModes(parsed)        => {[partId]: mode}           // used for "Reset to auto" and for old projects
defaultSvgOptions(parsed)   => {outlineWidth, invert:false} // median stroke width, else 1.5% of the bbox, else 1.5
buildSvgCrossSection(wasm, parsed, modes = {}, opts = {}) => CrossSection  // the caller deletes it; throws Error('err.svgNoShapes')
svgToContours(svgText)      => {polygons, fillRule:'NonZero'}           // legacy wrapper, uses the auto modes
```

## Notes
- SVGLoader r186 copies group opacity instead of multiplying it. The parser therefore resolves ancestor opacity, inherited paint opacity, `currentColor` and RGBA alpha, and CSS, presentation and inline styles in a detached XML copy before parsing.
- Artboard frames are excluded from the bbox used for the background comparison.
- "All off" with invert disabled throws `err.svgNoShapes`. The all-off fallback applies only to the automatic defaults.
- Persistence: `partModes` must be a non-array object with valid enum values. `svgOptions` keeps only a finite `outlineWidth` and a boolean `invert`. Other entries are dropped. Old sources are unchanged.

## i18n keys needed for integration
- `warn.svgTextIgnored`. en: "SVG text was ignored. Convert text to paths before importing." zh: "已忽略 SVG 文字；请先将文字转换为路径再导入。"
- `err.svgNoShapes` already exists in both dictionaries.

## Verification (2026-10-19)
- `node tests/geometry.test.mjs`: 1478/1478 PASS
- `node tests/legend-export.test.mjs`: 376 checks PASS
- Headless Chromium 1234: `tests/svg-parts.test.html` 25/25 PASS and `tests/svg-legend.html` 6/6 PASS, with 0 console errors.
- `candles-app-icon.svg`: the artboard, background and faint grid are off and the candles are on, giving ≥ 6 separate regions with their holes kept. Setting the background to fill and the candles to cut gives a square with ≥ 6 candle-shaped holes.
