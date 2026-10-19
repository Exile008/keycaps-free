# REPORT T2 — Legend geometry and model export

Status: **done**. Both required Node suites pass on the delivered files.

## Files delivered

- `js/legend-core.js`: bundled font registry and ArrayBuffer/typed-array font
  loading; adaptive quadratic/cubic subdivision; Y-up contours with zero-area
  rejection; CrossSection conversion and fit; inlay, recessed, raised and shine
  booleans. Inputs are borrowed; intermediate boolean/transform handles are freed.
  `applyLegend` returns `{cap, legend, warnings}` and adds warning keys to
  `parts.layout.warnings`. Contours are arrays per SPEC, with non-enumerable
  `warnings`; warning metadata also follows CrossSection conversion/fitting.
- `js/svg-legend.js`: local SVGLoader conversion of filled shapes and holes,
  even-odd fills, basic shapes, baked group transforms and Y flip. Stroke segments
  become positive-winding rectangles plus 16-segment vertex circles, combined
  through NonZero filling so overlaps union rather than cancel.
- `js/export.js`: property-stride-aware mesh extraction, binary STL with normals,
  3MF ZIP with core namespace, named colored meshes and one component parent,
  four-decimal vertex serialization, escaped XML, sanitized file names and
  defaulted/filtered project JSON. Embedded SVG text, source font base64 and
  the existing UI's `customFonts: [{id,name,data}]` representation round-trip.
- `tests/legend-export.test.mjs`: Node acceptance suite.
- `tests/fixtures/{ring,stroke,transform}.svg` and `tests/svg-legend.html`:
  offline browser checks and canvas previews.

No T1/T3 source files, vendored files, server scripts or dependencies were changed.

## Verification

Final commands, both exit code 0:

```text
node tests/legend-export.test.mjs
367 checks — ALL PASS

node tests/geometry.test.mjs
1478/1478 checks passed — ALL PASS
fuzz cases: 202
```

The legend matrix covers four bundled fonts × `A`, `Esc`, `⌘` × four modes ×
Cherry R3 1u and SA R1 2.25u. Checks include valid positive-volume parts, inlay
volume within 25% of area × depth, recessed volume reduction, unchanged raised
cap, shine stem inclusion and the specified shine cap formula. Additional checks
cover truly missing glyphs, spaces, overflow, T1 `buildModel` integration, STL byte
length/count, 3MF archive entries/XML nesting/namespace/counts/colors/parent,
project round trips/defaults, mesh property stride and Windows filename edges.

Node syntax checks pass for all three new JS modules and the Node test.
LSP diagnostics were unavailable because `typescript-language-server` is not
installed; no packages were installed.

Real Chromium/Playwright browser verification at
`http://localhost:8765/tests/svg-legend.html` returned **5/5 PASS** at viewport
widths 375, 768 and 1280, without horizontal overflow or JavaScript exceptions.
The browser checks ring area (hole excluded), rounded stroke area, exact group
transform bounds, basic shapes and the empty-SVG error. Canvas screenshot review
confirmed the hole, rounded check-mark stroke and transformed rectangular shape.
The page includes a data favicon to avoid an unrelated favicon 404.

## Deviations and limitations

1. **Actual glyph coverage differs from the task premise.** Inter and JetBrains
   Mono contain `⌘` (glyph indices 1872 and 981); Orbitron and Bebas do not.
   Tests require missing warnings only when the font really lacks that glyph.
   Unassigned U+0378 verifies `warn.glyphMissing` for every bundled font.
2. **Vendored opentype.js shaping limitation.** Inter's `Esc` triggers the
   unsupported contextual GSUB type 6 / format 2 error in opentype.js 2.0.
   Only that explicit unsupported-substitution exception uses direct cmap glyph
   outlines and kerning as a fallback. Other errors still propagate. Complex
   shaping is not preserved on this fallback; imported CJK fonts were not supplied
   for live verification. Normal fonts use `font.getPath` as specified.
3. **Vendored empty-CrossSection binding.** Its constructor accesses the first
   contour even for an empty array. Empty contours therefore use the documented
   zero-size square constructor to create an empty CrossSection safely.
4. **SVG API spelling.** r186 deprecates `SVGLoader.createShapes(path)` in favor
   of `path.toShapes()`; this implementation uses the latter without a deprecation
   warning. SVGLoader handles viewBox/user coordinates; legend fitting removes
   absolute source scale. Nonuniform stroke transforms use SVGLoader's scalar
   width approximation. Caps/joins are always rounded, as permitted by T2.
5. **Shine follows SPEC exactly.** `cap = shell − L`, `legend = L ∪ stems`.
   T1 shell and stems share junction material (about 34.99 mm³ for defaults),
   so the colored parts can overlap there. This is a specification limitation,
   not silently changed to a different cap formula.
6. **Warnings and borrowed handles.** `applyLegend` must not delete its borrowed
   `parts` or input CrossSection; callers own those lifetimes. T1 `buildModel`
   copies its warnings before calling T2, so legend warnings are available on
   its returned `layout.warnings`, not necessarily its top-level `warnings`.
   Existing T3 main.js also ignores metadata on Array contour results, so missing
   glyph warning display there needs a future owner-approved integration change.
   Core callers and tests receive the warnings; T1/T3 were left untouched.
7. **External slicers not run.** Archive structure and XML were tested, but
   PrusaSlicer/OrcaSlicer/Bambu Studio import was not interactively verified.
   The manual test page's English diagnostic labels are local to the test harness;
   production i18n dictionaries were not edited.

## Opening the browser tests

Run `start.bat`, then open:

```text
http://localhost:8765/tests/svg-legend.html
```

The page loads only local vendored modules, WASM and fixture SVGs; it requires no
CDN, install, build step or internet connection. Do not open it via `file://`.
