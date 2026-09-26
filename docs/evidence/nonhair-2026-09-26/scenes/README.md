# Wardrobe scene chooser

The previous Wardrobe options hard-coded `scene: 'studio'`, exposed no scene control and refused non-Studio reports in the settings exporter. Wardrobe now exposes Studio and the existing Kitchen scene. Switching rooms preserves the current starting cut, attached outfit, palette and framing, clears the Studio light override and starts a fresh view. The Light fieldset is hidden in Kitchen, which uses the scene's native lighting and exposure. No core renderer, garment, body or hair changes belong to this slice.

Kitchen settings omit `lighting`, so reopening them reconstructs the scene's native exposure rather than overriding it with the Studio preset. Existing Studio files retain their explicit `lighting` value. Both omitted Original fabric style and mixed combinations remain supported. Unsupported explicit Kitchen lighting is rejected before the current Avatar or URL is replaced.

## Verification

- `showcase-presets.selftest.mjs`: 4 groups, including duplicate/unknown scenes and contradictory Kitchen lighting.
- `showcase-settings.selftest.mjs`: 4 groups, including all 72 supported scene/light × cut × outfit × palette × framing combinations through exported JSON and restored URL options.
- Parent's all-page build passed before the production browser gate; only the existing chunk-size warning remained.
- [wardrobe-v1/report.json](wardrobe-v1/report.json): 8 native browser groups passed, 10 configuration/UI states, 7 screenshots and 3 actual downloaded JSON files. All 17 recorded source/asset hashes stayed exact; no page, console or network errors occurred. Browser and preview server were closed afterward.
- Kitchen's resolved exposure was `2.4`, with actual rig/report exposure `2.04` (`0.85 × 2.4`). A Studio lighting override would instead reset the relative exposure to `1`; the test distinguishes these states.
- Actual file chooser restores were exercised for Kitchen mixed/Original files and an existing-form Studio warm file. Invalid Kitchen files with explicit Studio or Warm lighting retained the same Avatar, complete attached configuration and URL, with an accessible error and usable controls.
- Desktop views cover both cuts, portrait/full look, native Kitchen and warm Studio. Fresh mobile navigation/import covers Kitchen portrait and body, then switching back to Studio. Mobile page width and settled camera aspect are checked.

Run from the repository root, serially with other GPU work, using a fresh output directory:

```sh
node packages/testbed/src/showcase-presets.selftest.mjs
node packages/testbed/src/showcase-settings.selftest.mjs
npm run build:pages
node packages/testbed/src/showcase-scenes.gpu.selftest.mjs --production --out=/tmp/sugata-wardrobe-scenes-new
```

The gate records a fixed clock after eight zero-delta settling frames, using the native balanced renderer. These are functional scene/settings/UI witnesses, not a hair, garment-fit, motion, performance or other-body qualification. Existing hair artifacts, neckline/skirt limitations and visible socks are unchanged; the page describes those limits. Free orbit, motion time and attention state are intentionally viewing state and are not stored in look files.

Review links on the persistent service:

- `http://127.0.0.1:5173/src/showcase.html?scene=kitchen`
- `http://127.0.0.1:5173/src/showcase.html?scene=kitchen&preset=elegant`

The durable evidence URLs in `report.json` point to the temporary production preview server used for this test, which is closed.
