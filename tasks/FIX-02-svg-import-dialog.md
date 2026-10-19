# FIX-02 — SVG "Import image" dialog with per-part Fill / Outline / Cut / Off  (agent: opencode, run AFTER FIX-01)

Review by Claude (2026-10-19). User report: "after importing an SVG it becomes a blank white square; there should be settings to control how the imported image is used."
The original vostoklabs tool shows an **Import image** dialog for this. It has "Your file" (the original), "What will print" (the resulting legend in black on a checkerboard), and a list of "Parts · N", each with a Fill / Outline / Off switch. Parts are labelled "Filled in the file", "Outline in the file · 1.5 wide" and "Artboard rectangle". Footer: "7 parts. 3 off.", Cancel / Use this. Replicate this and improve it.

## Root cause (verified)
`svgToContours` in `js/svg-legend.js` unions **every** visible path: the artboard frame, the app-icon background (a red rounded square), faint grid lines and the candles. The candles lie inside the background, so the union is just the background square → white square on the cap. Reproduce with `tests/fixtures/candles-app-icon.svg` (Claude added it; it mimics the user's icon).

## Files you may edit / create
- `js/svg-legend.js` (core, browser): new parts API below. Keep `svgToContours(svgText)` working as a thin wrapper (uses default modes).
- `js/svg-import-dialog.js` (new, browser UI)
- `js/main.js`, `js/i18n.js`, `css/style.css`, `index.html`: integration only
- `js/export.js`: **only** to persist the new `legendSource` fields in project JSON (+ its test)
- `tests/svg-legend.html`: extend the manual page; add `tests/svg-parts.test.html`: an automated in-browser test page that prints PASS/FAIL lines into `<pre id="result">`

## 1. Parts API — `js/svg-legend.js`
```js
parseSvgParts(svgText) → {
  viewBox: {x, y, w, h},
  parts: [{
    id: 'p0', index, tag,                      // document order (painter's order)
    fill: '#rrggbb'|null, stroke: '#rrggbb'|null, strokeWidth, opacity,   // effective, incl. group opacity
    fillPolys: Polygons|null, fillRule: 'EvenOdd'|'NonZero',              // Y-up, SVG units
    outlinePaths: [{ points: [[x,y]...], closed: bool }],                  // centre lines of the geometry
    bbox: {minX, minY, maxX, maxY}, area,
    role: 'artboard'|'background'|'faint'|'fill'|'stroke',
    defaultMode: 'fill'|'outline'|'cut'|'off'
  }],
  groups: [{ key, partIds:[...], fill, stroke, role, defaultMode }]      // parts grouped by identical style
}
buildSvgCrossSection(wasm, parsed, modes /* {partId: mode} */, opts) → CrossSection   // SVG units, Y-up
  opts = { outlineWidth: 1.5 /* SVG units; default = median stroke-width or 1.5% of bbox */, invert: false }
```
**Default-mode heuristics** (each covered by a test):
- `artboard`: rect or path whose bbox is at least 97 % of the viewBox in both dimensions and has no fill (or white/transparent fill) → `off`.
- `background`: a filled part whose bbox covers at least 80 % of the union bbox of all other visible parts and contains the bbox centres of at least 50 % of them → `off`.
- `faint`: effective opacity × fill/stroke opacity < 0.5 → `off`.
- Stroke-only → `outline` (uses its own stroke-width). Filled → `fill`.
- If everything ends up `off`, turn on the largest non-artboard part.
- `<text>` cannot be converted (SVGLoader ignores it) → report `warn.svgTextIgnored` once.

**Composition** (painter's order, CrossSection booleans):
`fill` → result ∪= fill. `outline` → result ∪= stroke of `outlinePaths`. Closed paths: `offset(+w/2) − offset(−w/2)` with Round joins. Open paths: capsule union as before. `w` = the part's own stroke-width if it is a stroke part, else `opts.outlineWidth`. `cut` → result −= fill (knock-outs such as a white shape drawn over a coloured one). `off` → skipped.
`invert` → (background-part fill if one exists, else the bbox rect) − result.
Throw `Error('err.svgNoShapes')` if the result is empty. Delete every temporary CrossSection.

## 2. Dialog — `js/svg-import-dialog.js`
`openSvgImportDialog({ name, svgText, parsed, modes, options, wasm }) → Promise<{modes, options} | null>` (null = cancel).
Layout (responsive, max 1100 px wide, translated):
- Title "导入图片 / Import image" plus file name.
- **Your file**: the original SVG (`<img>` data URL) on a checkerboard. When a part row is hovered, draw that part's outline over the image in accent colour.
- **What will print**: live preview of `buildSvgCrossSection(...).toPolygons()` as `<path fill-rule="evenodd">` in near-black on a checkerboard. Use the same viewBox as the original so both previews line up. Debounce 60 ms.
- **Parts · N** list. Each row has a small thumbnail of that part, a label from its role ("填充 / Filled", "描边 · 1.5 宽 / Outline · 1.5 wide", "画板矩形 / Artboard rectangle", "背景 / Background", "半透明 / Faint"), a colour swatch, and a segmented control **填充 Fill / 描边 Outline / 挖空 Cut / 关闭 Off**. With more than 12 parts, default to **grouped by style** (one row per group, showing the count); a toggle switches to individual parts.
- Global options: outline width (slider, SVG units, shown also as ≈ mm at the current legend size), Invert, buttons "Reset to auto", "All fill" and "All off".
- Footer: summary "共 N 个部件，M 个关闭 / N parts. M off.", Cancel, **Use this** (primary). Esc = cancel, Enter = use.
- If the result is empty, show an inline translated warning and disable "Use this".

## 3. Integration — `main.js`
- Upload: parse each file → open the dialog → on "Use this", store `{name, svgText, partModes, svgOptions}` in `state.uploadedSvgs` and select it. On cancel, discard that file.
- Gallery thumbnails get a small ✎ "编辑 / Edit" button that reopens the dialog with the saved modes.
- The SVG legend now uses `buildSvgCrossSection`. The legend cache key must include `partModes` + `svgOptions`.
- `legendSource` for svg = `{kind:'svg', name, svgText, partModes, svgOptions}`. Update `export.js` `source()` to keep `partModes` (object of string→enum) and `svgOptions` (`outlineWidth` number, `invert` bool), validating types. Extend `tests/legend-export.test.mjs` with a round-trip for these fields.
- Old projects without `partModes` → use the default heuristics.

## Acceptance (Claude will verify in headless Chromium with the fixture)
- `candles-app-icon.svg` defaults: artboard → off, red background → off, faint grid → off, candles (filled, even-odd hollow, stroked) → on. The 3D cap shows six or more separate candle shapes, not a square. Hollow candles keep their holes.
- Setting the background to Fill and the candles to Cut gives a square with candle-shaped holes (this is how the user can engrave an app-icon style legend).
- The dialog works in zh and en with no raw keys, is keyboard accessible, and has zero console errors.
- Save project → reload → load restores the same part modes.
- `node tests/legend-export.test.mjs` and `node tests/geometry.test.mjs` still pass. `tests/svg-parts.test.html` shows all PASS.
- Write `docs/REPORT-FIX-02.md` and end with `FIX-COMPLETE`.
