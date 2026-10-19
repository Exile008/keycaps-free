# Review 01 — after T1/T2/T3 (Claude, 2026-10-19)

Verified: `node tests/geometry.test.mjs` 1478/1478 pass and `node tests/legend-export.test.mjs` 367 pass. The page loads in headless Chromium with zero console errors and no external requests, and no raw i18n keys are visible in zh or en.

| # | Issue | Source | Severity | Fix task |
| --- | --- | --- | --- | --- |
| 1 | Profile preset only applies after clicking a small Apply button; the dropdown alone does nothing | user + reproduced | high | FIX-01 B1 |
| 2 | Camera does not refit after large size changes; default framing too close | reproduced | medium | FIX-01 B2 |
| 3 | Default legend text empty → "legend empty" warning on first load | reproduced | low | FIX-01 B3 |
| 4 | 2D inset diagram ~50 px with ~6 px labels | reproduced | medium | FIX-01 B4 |
| 5 | SVG import unions all paths (artboard + background + grid + icon) → white square | user + reproduced (`tests/fixtures/candles-app-icon.svg`) | high | FIX-02 |
| 6 | No per-part control of imported SVG (original has an Import image dialog) | user | high | FIX-02 |
| 7 | `export.js` project JSON drops extra legendSource fields | code review | medium (blocks #6 persistence) | FIX-02 §3 |

Run order: FIX-01, then FIX-02 (both edit main.js / i18n.js).
