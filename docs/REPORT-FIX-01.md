# REPORT FIX-01: presets, camera framing, defaults, 2D diagram

## Changes
- `js/main.js`
  - Family or row changes apply the preset immediately. The Apply button is now a small re-apply icon.
  - `activePreset` is validated. Editing a preset-controlled key shows a translated badge saying the preset is now custom.
  - `activePreset` is persisted in `kcg-last` (debounced writes, flushed on `pagehide`) and in the project JSON. It is added and read around the core serializers, which drop unknown fields.
  - The camera refits after a preset change and after a slider is released.
  - A fresh profile starts with the legend "A". A legend the user empties on purpose is still allowed.
- `js/viewer.js`
  - The initial fit is based on the world bounding sphere and fills about 45 % of the smaller viewport dimension.
  - The camera refits automatically when any dimension changes by more than 15 %. Refits wait until a drag ends, and the orbit direction is kept.
  - The Frame button always refits.
  - The projection is offset so the expanded diagram overlay does not cover the model.
- `js/topview.js`
  - The drawings scale to the panel width with 8 px padding, and labels are 11 px.
  - Each side shows its inset value. The side profile shows the height and the signed tilt angle with an arc.
  - The overlay can be collapsed and expanded, and that state is persisted. On short screens the drawings scroll.
- `js/i18n.js`: matching zh/en strings for the preset badge and the diagram.
- `css/style.css`: styles for the badge, a 260 px overlay, readable ink in both themes, and the toggle.
- `index.html`: the preset badge and an accessible group for the diagram.

## Verification (2026-10-19)
- `node tests/geometry.test.mjs`: 1478/1478 PASS. `node tests/legend-export.test.mjs`: 376 PASS.
- Chromium 1234 with Playwright Core: 69 browser checks PASS, with zero console errors and zero external requests.
  - Selecting SA R1 immediately gives height 14.9, tiltX 13, insetF 2.6 and a spherical dish.
  - All 15 family × row combinations stay fully inside the camera frustum.
  - A fresh load shows "A" with no empty-legend warning.
  - Initial framing, the four view buttons, refit on slider release and on size/extension changes, the Frame button and the badge all work.
  - `kcg-last` and the project file round-trip correctly.
  - The collapse state persists, labels are ≥ 10 px, the zh/en key sets match with no raw keys, and the 1100 px and mobile layouts work.
- Diagram contrast: dark theme 14.02:1 (primary) and 6.71:1 (muted). Light theme 16.37:1 and 5.83:1.

## Remaining
- Only Chromium was tested. Firefox and Safari were not.
- Outline-button text in the light theme is faint. This existed before and was not changed.

FIX-COMPLETE
