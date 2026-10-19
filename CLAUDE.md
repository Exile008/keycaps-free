# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An offline, no-build, browser-based parametric keycap generator (three.js viewer + manifold-3d WASM CSG). It outputs 3MF and STL files and saves project JSON. UI is bilingual (zh/en). `docs/SPEC.md` is the source of truth for every contract: parameter table, geometry algorithm, legend modes, export format and UI layout. Read the relevant section before changing behaviour. If the spec itself is wrong, record the issue in `docs/QUESTIONS.md` instead of quietly deviating from it.

## Commands

- Run the app: `start.bat`, which runs `powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8765`, then open `http://localhost:8765/`. A `file://` URL does not work because WASM and ES modules need HTTP.
- Run all Node tests: `tests\run-tests.bat`
- Run a single test file: `node tests/geometry.test.mjs` or `node tests/legend-export.test.mjs`. These are plain Node ESM scripts with hand-rolled `ok`/`approx` assertions and no test framework, so there is no way to filter individual cases.
- Browser-only tests (SVG parsing needs `DOMParser`/`SVGLoader`): serve the app and open `http://localhost:8765/tests/svg-legend.html`.
- Deploy: pushing to `main` triggers `.github/workflows/pages.yml`, which runs both Node tests and then publishes only `index.html css js vendor fonts` to GitHub Pages (see `docs/DEPLOY.md`).

There is no npm, bundler, TypeScript or linter. Don't add a build step or any CDN or network dependency. Every runtime asset is vendored under `vendor/` (three r186, manifold-3d 3.5.4, opentype.js 2.0.0, fflate 0.8.3) and `fonts/`. For manifold API details, read `vendor/manifold/manifold.d.ts`.

## Architecture

**Core and browser split (hard rule).** These modules must not touch `window`, `document` or the DOM, so that the Node tests can import them:
- `js/params.js`: `DEFAULT_PARAMS`, `PARAM_RANGES`, `PRESETS`, `normalizeParams(p) → {params, warnings}`, which never throws and returns i18n warning *keys*, and `applyPreset`.
- `js/keycap.js`: `computeLayout` (bottom rect, top rect, tilt frame with `mat4`), `buildKeycap` (outer hull of the bottom and tilted-top rounded rects, minus the dish, minus the inner hull, plus stems ∩ outer, the stem fillet flare and optional ribs, plus the homing bump), and `buildModel`, which returns `{cap, legend, stem, ...}`; `stem` is non-null only when `stemSeparate` is set and is clipped to the inner body, with `cap = joinedCap − stem`. `buildModel` dynamically imports `legend-core.js` to apply the legend.
- `js/legend-core.js`: font loading, text → polygons → `CrossSection`, `fitLegend`, and `applyLegend`, which implements the four modes inlay/recessed/raised/shine with booleans against `parts.outer` along the top-face normal.
- `js/export.js`: `meshData`, binary STL, 3MF (one parent object with Keycap/Legend component parts and basematerials colours), and project JSON (`{app, version:1, params, legendSource}` with embedded fonts and SVG).
- `js/manifold-loader.js`: WASM singleton. `locateFile` is used only in the browser.

The browser-only modules are `js/svg-legend.js` (SVGLoader; `parseSvgParts` splits an SVG into parts with auto roles, and `buildSvgCrossSection` composes them using per-part fill/outline/cut/off modes), `js/svg-import-dialog.js` (the per-part import dialog), `js/depth-preview.js` (legend depth section diagram; keycap functions are injected by main.js), `js/viewer.js` (three.js, Y-up, with the root group rotated −90° about X so model Z is up), `js/topview.js` (2D SVG top/side diagrams), `js/i18n.js` and `js/main.js`.

**`js/main.js`** owns all app state, including `state.params` and `state.legendSource` (`none | text | svg`; this is not part of params). It loads every core module through a `tryImport` that tolerates failure, and falls back to built-in defaults when a module is missing. Regeneration is debounced (~120 ms) and builds at `quality:'preview'`. Exports rebuild at `quality:'export'`. On error it keeps the last good mesh. localStorage keys: `kcg-last` (params and text only, not fonts or SVGs), `kcg-lang` and `kcg-theme`.

**Coordinates:** mm and degrees. The origin is the stem centre on the bottom plane, with +X right, +Y back (away from the typist) and +Z up. Positive `tiltX` raises the back edge, and positive `tiltY` raises the right edge. Insets are measured before tilt. Footprint extensions never move the stem.

**WASM memory:** every intermediate Manifold or CrossSection that isn't returned must be `.delete()`d. This applies in core code, `main.js` and tests (see `dispose()` in `tests/legend-export.test.mjs`).

**i18n:** every user-visible string goes through `t('key')`. HTML elements carry `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` or `data-i18n-tip`. The `zh` and `en` dictionaries in `js/i18n.js` must have identical key sets (`assertDictionaryParity`). Any `warn.*` or `err.*` key emitted by a core module needs an entry in both.

## Multi-agent workflow

Work is split into task files under `tasks/` (T1 geometry, T2 legend/export, T3 UI/i18n, FIX-xx). External agents run them through `run-agents.ps1 -Task <T1|T2|T3|FIX> [-FixFile tasks/FIX-xx.md]` with opencode. Each task file lists the files that task may edit (ownership table in SPEC §3). Agents write `docs/REPORT-*.md`, and Claude's reviews go in `docs/REVIEW-*.md`. Before you edit, check which task owns the file and whether a pending FIX task is changing it.
