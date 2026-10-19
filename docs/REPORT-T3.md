# T3 — UI, viewer, diagrams and bilingual interface

## Scope

Read `tasks/T3-deepseek-ui-i18n.md` and all of `docs/SPEC.md`. Inspected and completed the existing partial implementation rather than replacing it. Edited only T3-owned implementation files, README, and this required report. The six protected core modules were not edited or created.

## Completed implementation

- Preserved the three-column shell, dark/light palettes, compact parameter rows, switches, segmented controls and sticky export footer. Below 1000 px, the viewport precedes the stacked sidebars. Improved narrow-screen overlay spacing and reduced-motion behavior.
- Kept the exact local import map and plain ES modules, system fonts and inline SVG icons. Added a data favicon to eliminate the browser's favicon 404.
- Numeric controls read core parameter ranges. Fixed custom width synchronization and profile selectors leaking UI-only keys into params; uniform presets hide row selection. Insets, extensions, tilt and derived dimensions update live. Added meaningful profile/right-panel resets.
- Corrected inset explanation direction. Bilingual dictionaries cover dynamic controls, help diagram labels, warnings/status/errors and accessibility names; parity assertions run at startup. Labels and inputs are associated and names refresh on language change. Help supports Escape and keyboard focus containment.
- Viewer uses local three.js, creased normals, lit standard materials, a Z-up model root, orbit controls, grid and ResizeObserver. Mesh replacement preserves the camera unless footprint size changes. Front/side are axis-aligned. Disposes replaced geometry and materials/grid on teardown. Legend polygon offset removes visible coplanar z-fighting without changing exported geometry.
- Top diagram projects a sampled rounded top outline through `frame.R`, shows rounded footprint, stems, direction labels and pre-tilt inset dimensions. Y–Z profile shows height and tilt. Both rerender in the current language; diagrams are stacked for larger available drawing area.
- Fixed SVG contour cache identity to include content, temporary CrossSection disposal, stale-build cancellation cleanup, glyph-missing feedback and invalid-font feedback.
- Fixed project restoration so switching panels no longer replaces the loaded text/font/SVG source. Restores selected SVG to gallery, decodes custom fonts as ArrayBuffers, and respects core project validation instead of bypassing it after rejection.
- Preview is debounced 120 ms, exports rebuild at export quality. Legend-only STL is disabled when no separate legend exists. Blank STL independently builds with null legend input, including when the active design is recessed. Last successful preview is retained on build failure.
- Added Chinese-first bilingual README with start.bat instructions, feature list, coordinate/parameter explanations, manufacturing caveats and requested credits.

## Actual verification

Server launched through `start.bat`; tested the real page at `http://localhost:8765/` with Playwright Chromium.

| Check | Observed result |
| --- | --- |
| `node tests/geometry.test.mjs` | 1478/1478 checks passed; default core preview 2.6 ms, 702 triangles |
| `node tests/legend-export.test.mjs` | 367 checks passed |
| `node --check` on all four T3 JavaScript modules | Exit 0 |
| Browser initial preview | 702 triangles, approximately 7 ms reported geometry time; canvas present |
| Text `A`, all four modes | Model builds; recessed has no separate legend as intended |
| Front inset numeric edit | Slider/number and derived dimensions update; 4.2 mm front inset gives 12.8 × 12.6 mm top |
| Language switch | Chinese/English content and document language switch; identical dictionary key sets |
| 3MF, three STL buttons, blank STL, project JSON | Actual browser download events, no download failure |
| Text project round trip | Changed A to B, loaded saved JSON, restored A |
| Stroked SVG upload and project round trip | Model generated; SVG tab and gallery selection restored |
| Local TTF import | Imported bundled Inter as custom font successfully |
| Uniform DSA selector | R1–R4 row hidden |
| Help | Opens and closes with Escape |
| Widths 1280, 768, 375 px | Canvas present, no horizontal document overflow |
| Fresh browser error/request listeners | No page exceptions and no external requests observed |

## Screenshot descriptions

Screenshots saved outside the project at `C:\Users\Greed\AppData\Local\Temp\opencode\`:

- `T3-final-1280.png`: dark desktop, three columns, smooth dark cap with clean white A, compact placement/mode controls and export footer; stacked live diagram lower-left.
- `T3-1280-zh.png`, `T3-1280-en.png`: initial bilingual dark/light checks. These earlier captures exposed legend z-fighting, which was subsequently fixed; they are not final acceptance images.
- `T3-current-1280.png`, `T3-current-768.png`, `T3-current-375.png`: refreshed responsive captures after functional fixes. Desktop retains sidebars; narrower views put preview first and controls below without horizontal overflow.

## Limits and contract observations

- LSP diagnostics could not run because the configured TypeScript/JavaScript language server is not installed and installation was previously declined. Syntax checks and actual browser execution were used instead.
- No external slicer was available to visually open 3MF. Core export tests and browser downloads passed; slicer material assignment remains a downstream manufacturing check.
- A real imported CJK font was not available in the supplied font set. Custom-font plumbing was exercised using local Inter; actual CJK outline quality remains dependent on the chosen user font.
- The default-preview number is geometry generation time, not a measured end-to-end first-paint latency guarantee.
- No blocking core API mismatch was found that required changing protected files or adding a question to `docs/QUESTIONS.md`.
- Specialist delegation repeatedly returned inactivity timeouts without deliverables. Browser screenshots and direct functional checks were completed, but an independent dual-reviewer visual-QA signoff was not obtained. Do not interpret this report as that independent signoff.
