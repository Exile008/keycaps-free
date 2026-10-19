# FIX-01 — Profile presets, camera framing, defaults  (agent: opencode)

Review by Claude (2026-10-19), reproduced in headless Chromium. Read `docs/SPEC.md` §4.3 and §8 first.

## Files you may edit
`js/main.js`, `js/viewer.js`, `js/topview.js`, `js/i18n.js`, `css/style.css`, `index.html`. Do NOT edit core modules (`params.js`, `keycap.js`, `legend-core.js`, `svg-legend.js`, `export.js`).
Note: task FIX-02 runs after you and will also edit `main.js`/`i18n.js`/`css`; keep your changes focused.

## Bugs (all reproduced)

### B1 — Profile preset "doesn't work" (user report)
Choosing a Family or Row in the dropdown changes nothing; values only change after the user finds and clicks the small "Apply" button. Then the camera doesn't refit, so a tall preset (SA R1, 14.9 mm) blows the cap out of the view, which looks broken.
Fix:
1. Apply the preset **immediately** on Family change and on Row change (`applyPreset(state.params, fam, row)` → `syncAllRows()` → `updateDerived()` → build). Remove the Apply button (or turn it into a small "re-apply" icon button next to the reset icon).
2. Track `state.activePreset = {family,row}`. When the user later edits any preset-controlled key (`dishType, dishDepth, insetL/R/F/B, rTop, height, tiltX`), show a badge "自定义（基于 Cherry R3）/ Custom (from Cherry R3)" in the section header. Re-selecting the same family/row re-applies it.
3. Persist `activePreset` in `kcg-last` and in the saved project (as a UI field next to params; main.js already owns the project state object).
4. After a preset change, call the viewer's refit (B2).

### B2 — Camera framing
- On first load the default 1u cap fills the whole viewport (camera too close). Frame so the cap's bounding sphere takes ~45 % of the smaller viewport dimension.
- Re-frame automatically when the model bounding box changes by more than 15 % in any dimension (preset, height, unit size, extensions). Keep the camera for small edits (sliders) so the view doesn't jump while dragging; refit after the slider is released (`change` event) if the threshold is exceeded.
- The "Frame" button must always refit.

### B3 — Empty default legend
On a fresh profile (no `kcg-last`) the text legend is empty, so the status shows "Legend is empty — generated a cap without legend". The default text must be `A` (SPEC §4.1 note). An empty text field typed by the user is still allowed.

### B4 — 2D diagram is too small to read
In the bottom-left overlay the top-view drawing is about 50 px wide inside a 200 px panel, and its labels are about 6 px. Fix:
- Scale both drawings to fill their panel width with 8 px padding. Minimum label font is 10 px.
- Overlay is 260 px wide by default. Add a collapse/expand toggle (persisted).
- Show the four inset values next to their sides (F/B/L/R) and the tilt angle in the side profile with a visible arc.
- Colours readable in both themes.

## Acceptance (Claude will re-run headless Chromium checks)
- Selecting `SA` + `R1` immediately gives height 14.9 / tiltX 13 / insetF 2.6 / dish spherical (the dish segment shows as active), and the whole cap is visible.
- Cycling all families × rows gives no console errors, and every result stays fully in view.
- Fresh load shows the legend "A" on the cap, with no "legend empty" warning.
- Diagram labels ≥ 10 px; collapse toggle works; both languages render fully, with no raw `label.*` keys.
- Write `docs/REPORT-FIX-01.md` and end with `FIX-COMPLETE`.
