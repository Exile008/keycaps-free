# REPORT FIX-02: SVG import dialog and UI integration

The core parts API is described in `REPORT-FIX-02-core.md`.

## Changed files
- `js/svg-import-dialog.js` (new): `openSvgImportDialog({name, svgText, parsed, modes, options, wasm, legendSize?}) → Promise<{modes, options} | null>`
- `js/main.js`: upload and Edit flow, legend built with `buildSvgCrossSection`, a cache key that includes `partModes` and `svgOptions`, warnings, and project restore. Cleanup of the base CrossSection around `fitLegend` is now exception-safe.
- `js/i18n.js`: dialog strings and `warn.svgTextIgnored`. The zh and en key sets are identical.
- `css/style.css`: the dialog, the gallery Edit button, both themes, and the responsive layout.

No core module was modified, and no bug was found in `svg-legend.js`.

## Behaviour
- The original file and the printable result appear side by side on checkerboards, using the same viewBox. The preview is debounced by 60 ms.
- Each part has a Fill / Outline / Cut / Off control. With more than 12 parts the list is grouped by style, and grouped rows indicate mixed settings. Hovering or focusing a row highlights that part.
- Global options:
  - an outline-width slider showing SVG units and approximate mm
  - Invert
  - Reset to auto, All fill and All off
- The footer shows the part count and how many are off. An empty result shows a warning and disables "Use this".
- Keyboard: focus is trapped in the dialog, Esc cancels and Enter accepts.
- Uploads are configured one after another. Cancelling a new upload discards it. Edit reopens the saved settings.
- Projects round-trip `partModes` and `svgOptions`. Older projects fall back to `defaultModes` and `defaultSvgOptions`.
- Every temporary CrossSection is deleted inside `finally`. Instrumented runs counted 91 deletions with 0 leaks.

## Verification (2026-10-19, Chromium 1234)
- Node tests: geometry 1478/1478 and legend-export 376 PASS.
- Browser tests: `svg-parts.test.html` 25/25 and `svg-legend.html` 6/6 PASS.
- End to end: 107 + 32 checks PASS, with zero console errors and zero external requests.
- `candles-app-icon.svg`:
  - The default modes give a legend STL with 6 separate candle components and 3 through-holes.
  - With the background set to Fill and the candles to Cut, the legend has 6 through-holes.
- Saving, reloading and loading a project restores the modes exactly. Older projects restore the automatic defaults.
- The dialog was checked at 1100×800, 800×700 and 390×844.
- FIX-01 regression: legend "A", the immediate SA R1 preset, all 15 family × row combinations in view, and the diagram overlay all still work.

## Remaining
- Only Chromium was tested.
- SVG `<text>` must be converted to paths first. The app shows a warning.
- At a 1480×1000 viewport the Export panel covers part of the Legend mode panel. This is intentional (`.export-footer` is `position: sticky`), and the content above scrolls underneath it.

FIX-COMPLETE
