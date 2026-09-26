# Live Studio and Kitchen review

Both current preview pages now offer the existing Studio and the reviewed Kitchen scene.
Kitchen retains its native lighting recipe: no explicit Studio override is supplied to Avatar.
The actual rig exposure is 2.04 (relative 2.4 × calibration 0.85), compared with Studio's 0.85.
The Studio light controls are hidden in Kitchen. No asset or core renderer changes belong to
this viewer slice.

- [Portrait](http://127.0.0.1:5173/src/portrait.html?scene=kitchen) preserves its selected cut
  and body URL options when changing rooms, then starts a fresh neutral view. Its existing
  expression, attention, pause and orbit controls remain available.
- [Wardrobe](http://127.0.0.1:5173/src/showcase.html?scene=kitchen) preserves the current cut,
  attached outfit, palette and framing. Kitchen settings omit `lighting`, so a saved file
  reopens with the scene recipe. Existing Studio files preserve their explicit light choice.
  The supported study remains g050; unsupported SDK configurations are not silently imported.

## Evidence and exact limits

The [Portrait report](portrait-v1/report.json) passes eight focused native WebGPU groups across
both cuts, desktop and reduced-motion mobile. Sixteen PNGs bind eight paired Studio/Kitchen
views. Enter/Space, same-room no-op, fresh pose/affect/clock, exposure, useful controls and mobile
head bounds pass. Eight observed real pagehide events were **not persisted** and disposed cleanly;
four final manual retirements also pass. Its 310 selected source/asset hashes are bound before
the later history-restoration correction.

The [Wardrobe evidence](../scenes/README.md) passes 72 CPU configuration round trips and eight
production-browser groups, including actual JSON downloads/file selection, mixed outfits,
Original fabrics, invalid-file retention, both cuts and mobile body/portrait views. Seventeen
selected sources/assets, seven PNGs and three downloaded JSON files are hash-bound. No normal
browser errors occurred in either forward-navigation gate. The all-page build passes with
only the existing chunk-size warning. Catalogue checks pass all 92 assertions; older diagnostic
pages keep their actual September 13 source-review dates.

Independent review accepted these forward-path visuals but found a source-level history issue:
the page could retain navigation-disabled controls after a persisted pageshow. A controlled
fixture reproduced it in four native contexts by running the actual Room handler, intercepting
its navigation with HTTP 204, then dispatching synthetic persisted pagehide/pageshow events.
This deliberately retained document is **not proof of actual browser BFcache admission**.
Its expected navigation-aborted events are separated from unexpected browser errors.

The correction tracks pending navigation separately from unfinished file/dress work. A persisted
restore re-enables only the navigation-held UI while retaining the live owner, camera, pause and
motion state. It cancels any previous page animation callback before rescheduling; capture mode
does not start one. The [fixed-source regression](lifecycle-fixed/report.json) passes five
focused contexts: captured and paused live pages, plus running Portrait. Two restore cycles
keep zero page-animation callbacks in capture mode and one in live mode. A real pending
`File.text` read stays busy across restoration, then an invalid file completes normally and
restores controls. One ordinary forward navigation on the corrected source independently
confirms a new Kitchen owner/exposure and actual retirement of the old document. All 16
selected hashes remain exact, all cases complete and unexpected errors are empty. The
[independent review](CRITIQUE.md) approves integration after reviewing the correction, archived
hashes and restored UIs. Frozen JS/HTML and ordinary screenshots are tracked; the two 26 MB
exact asset-copy sets remain locally retained and hash-bound without duplicating them in Git.

This feature qualifies review controls and supported settings reconstruction. It does not
establish all-angle or all-motion scene quality, garment fit, hair quality, human expression
recognition, other-body wardrobe coverage or a performance budget. The Kitchen recipe's earlier
numerical and visual qualification is separately recorded in `../scene/README.md`.
