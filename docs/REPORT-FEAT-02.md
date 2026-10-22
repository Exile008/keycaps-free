# FEAT-02 report — KLP Lamé–style caps, Choc stems and sizes (Claude, 2026-10-22)

The opencode run failed and changed nothing (see REVIEW-02). Claude implemented the task directly in this session. Details are in `docs/SPEC.md` §10.

## Changed files
- `js/params.js`: new keys (`pitchY`, `sizeStandard`, `stemRotate`, `choc*`, `skirt*`, `sculptRim`, `sculptDrop`, `homingType`), `rBottom` max 6, `SIZE_STANDARD_VALUES`, KLP families with per-family rows, `presetRows` / `presetDefaultRow` / `isKlpFamily` / `PRESET_PARAM_KEYS`, plus the `warn.chocStabs` and `warn.chocRibs` warnings.
- `js/keycap.js`: `sculptZ` with the height-field cutter (outer and inner), the rounded skirt, Choc prongs with a tip chamfer and ceiling chamfer, `stemRotate`, `dots3` homing, and `pitchY` in the layout.
- `js/main.js`, `js/i18n.js`, `css/style.css`: Switch / size selector, family-specific rows, new controls in collapsible Advanced sub-sections, the credit link and 3MF metadata. The zh and en dictionaries both have 334 keys.
- `js/topview.js`: Choc prong rectangles, rounded skirt, and the KLP sculpt line in the side profile. `js/depth-preview.js`: inner sculpt surface.
- `js/export.js` (outside the task's file list, an additive change): `to3MF(parts, {description})` writes `<metadata name="Description">`. The output is unchanged when no description is passed.
- Tests: `tests/geometry.test.mjs` has the KLP matrix (3 families × rows × 4 switch/size combinations × 1/1.5u × rotation 0/90), bbox, `sculptZ` table, thumb/saddle edges, prongs/rotation, dots3, skirt width and timing checks. The reinforcement loop now uses each family's own rows. `tests/legend-export.test.mjs` covers every legend mode on KLP Saddle tilted (Choc/MX, joined/separate), the 3MF metadata, and the KLP and old-project JSON round trip.
- `README.md` (credit in both languages and a feature line) and `docs/SPEC.md` §10.

## Deviations
- **MX ribs and the cross cut (affects all presets):** the reinforcement loop showed spurious genus > 0 on KLP caps with ribs. The cause was coincident faces. Ribs are now trimmed against cylinders 0.05 mm thinner than the stems, so they overlap the stem wall. The final cross cut is skipped when it cannot reach the ceiling. This slightly changes classic caps with ribs: rib volume grows by about 0.05 mm per stem. All existing tests still pass.
- Choc reinforcement uses a 45° chamfer of `min(stemFillet, 0.5)` instead of a revolved fillet. Choc + ribs is skipped with a warning.
- `stemRotate` rotates the geometry at each stem position and does not move the stabilizer positions.

## Results
- `node tests/geometry.test.mjs`: 5673/5673 pass. Default preview build 7 ms; KLP Saddle tilted preview build ≈ 85 ms (limit 250 ms).
- `node tests/legend-export.test.mjs`: 522 pass.
- Browser (localhost:8765): KLP Saddle → Tilted with Choc + Choc size matches `docs/klp/klp_proto.png`. The rows, credit link and Advanced sections work, the language switch shows no raw keys, and the console has no errors.
- Not verified: opening the exported 3MF in a slicer, or test-printing the Choc fit.

FIX-COMPLETE
