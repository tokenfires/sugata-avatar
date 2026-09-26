# Kitchen scene and mask check — September 26, 2026

The fresh kitchen baseline reproduces weak image-right silhouette separation. Before changing
the room, its stricter driver exposed a real geometry-mask compilation defect. The mask repair
is independently reproduced and covered by a focused CPU regression; the clean GPU baseline has
zero recorded errors. Scene-candidate acceptance is separate from that instrument repair.

**Final result:** kitchen wall `#b4ac9f` is integrated after all five existing bald clauses,
matched clothed review, and actual-default verification. Studio is unchanged. The darker
`#928b80` remains rejected for whole-scene readability; `#beb5a8` remains below the L3 floor.
Open [the visual comparison](review.html) for both outfits in portrait and full-body views.

## Corrected instrument and baseline

The first [baseline report](baseline/report.json) is retained as a failed run: nine console/resource
errors, stable selected source hashes, and usable diagnostic images. It is not a clean pass.
The live [material census](mask-errors.json) locates the mask-only shader errors on ordinary
teeth/tongue `MeshStandardMaterial` instances, whose optional node properties are absent.

`GeometryMask.js` copied absent `alphaTestNode` and `positionNode` properties as `undefined`.
Installed Three `NodeMaterial` tests each against `null`: this enters `float(undefined)` and
`subBuild(undefined, ...)`, respectively. These produce the two observed error messages.
Undefined `opacityNode` takes a safe truthiness-based fallback and was not a demonstrated error
source. The RGB-color-alpha hypothesis was not established and caused no code change.

The [CPU mechanism reproduction](mask-node-contract.json) exercises ordinary materials and the
actual installed Three primitives. Preserving absent fields as `null` avoids both invalid
branches; explicitly supplied nodes remain intact. The focused
[`GeometryMask.selftest.mjs`](../../../../tools/critic/GeometryMask.selftest.mjs) calls the actual
mask pass with real ordinary/node/mixed-array materials, intercepting submission without a GPU.
Its five groups check null sentinels, retained alpha/deformation nodes and controls, isolated
geometry submission, and unchanged source materials. All five pass. This CPU check supplements
the clean browser rerun; it is not a shader-rendering qualification by itself.

The empty data favicon removes the independently identified resource 404. The geometry-mask fix
does not change the beauty-rendering path or a scene parameter.

The [clean baseline](baseline-clean/report.json) completes with zero errors and stable selected
source hashes. Studio/kitchen beauty and eye-hidden PNGs are byte-identical to the first run.
The geometry-ID images each change **124 raw pixels**, of which **123 newly enter the thresholded
subject mask**, with no removals. Every change is in the mouth rectangle
`x=181..309, y=592..595`; subject membership rises from 644,524 to 644,647 pixels. The repaired
teeth/tongue geometry changes the mouth hole and consequently the eroded face sampling area.
Therefore **the metrics and overlays are not identical**, even though the ordinary images are.
An independent reviewer directly inspected both original beauty/overlays and the clean kitchen
matte/overlay, and independently recomputed both pixel counts from the PNGs.

| Clean scene | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Studio | 0.897231 pass | 1.149187 pass | 0.953294 pass | 0 pass | 4.039798 pass |
| Kitchen | 0.633216 pass | 1.570008 pass | **0.008071 fail** | 0 pass | 1.777495 pass |

Recipe: real WebGPU bald portrait, 900x1200, DPR 1, seed 1, frozen simulation, one renderer step
at 1/60 second. The three arms are ordinary beauty, geometry ID and eyes hidden. Exact image
hashes and selected source hashes are in the clean report. No threshold was changed.

## Independent visual diagnosis and alternatives

The kitchen's image-right temple, ear/neck vicinity and shoulder outline approach the brown
wall's luminance; the room makes that side substantially harder to distinguish than studio.
The geometry overlay tracks the actual external contour and both eye apertures. It does not
show the historical dither cloud extending into the wall. The left forehead/cheek are already
bright, so raising whole-scene exposure would risk a harsher face while moving the background too.
These are observed readings of the ordinary stills, not recognition-study results.

Two bounded scene alternatives were proposed:

1. Author darker warm plaster in the actual kitchen room and rebake its environment. This should
   improve wall/contour contrast, but reduced room bounce can also darken the shadow-side face and
   change eye reflections; measure L1/L2/L5 and inspect the whole face. All analytic light settings,
   studio parameters and gate thresholds stay fixed. This is a physical room-material change,
   not a background-only attribution.
2. Keep the room and world lighting fixed and compare a frontal camera composition against the
   existing 12-degree yaw. This changes which wall gradient sits behind the person without a
   room-material change, but also changes silhouette, facial projection and specular presentation.
   It requires fresh masks and a separate composition judgment.

The selected single candidate is wall `#928b80`, with the full existing kitchen `room` object
spread before replacing `wall`. That full spread matters because `avatar-plate.html` merges
scene overrides shallowly. Its [candidate report](wall-928b80/report.json) completes with zero
errors and stable selected sources; all eight selected source hashes match the clean baseline.
The unchanged geometry mask has the same 644,647 subject pixels and the same contour sample
counts: 660 left, 710 right, 825 top, 50 bottom, with four skipped samples.

| Kitchen comparison | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original wall | 0.633216 pass | 1.570008 pass | **0.008071 fail** | 0 pass | 1.777495 pass |
| Wall `#928b80` | 0.670190 pass | 1.593169 pass | **0.214957 pass** | 0 pass | 1.792371 pass |

Independent inspection of the candidate ordinary image and overlay finds the right
temple/neck/shoulder contour visibly clearer against the darker warm wall. The face retains
its existing light direction. Reduced room bounce is measurable: face median falls from
0.645816 to 0.640227 (about 0.87%), and the image-right cheek median from 0.585304 to 0.576627
(about 1.48%). These results support the wall-and-IBL explanation rather than a mask change.
The candidate is an improvement for this inspected bald portrait. This is not a promotion
verdict for clothed full-body views, motion, or every review page; those are separate checks.

## Full-character comparison and rejected captures

The corrected [eight clothed plates](clothed-verified/report.json) compare both accepted g050
outfits in portrait/body views against the original and candidate wall. They use the native
scene recipe, one real environment bake, frozen simulation, and 24 zero-time update/draw steps.
Readiness requires attached garments/groom, a completed native card rebuild, valid history and
card frame, exact scene exposure/scales, and both simulation clocks held at zero. All checks
pass, selected source/asset hashes stay stable, and browser/page/network errors are empty.
These are ordinary visual comparisons; the bald L1–L5 verdict is not applied to clothing.

Two capture failures remain preserved. `clothed/` accidentally copied an explicit studio lighting
override and skipped the native attachment update under freeze; its eight images are rejected.
`clothed-clean/` stopped before saving images because the driver's readiness checks confused the
absolute calibrated exposure (2.04) with the scene multiplier (2.4), and read a nonexistent motion
clock property. Its corrected successor reads the resolved recipe and both actual clocks.
See each directory's `REJECTED.md`. No accepted hair asset, solver or runtime changed.

Root and independent critic inspection find the improved skin contour but also lost warm wall
and corner depth, with dark skirt/denim outlines harder to distinguish against the near-black
background. **Hold `#928b80`; do not promote it as the kitchen default.** This is a visual
whole-scene tradeoff, not a claimed clothing L3 failure. The next single bounded candidate is
the intermediate warm wall `#beb5a8`; it must earn both the bald clauses and whole-character
review. The kitchen default remains unchanged. This is a physical wall/IBL candidate, not a
background-only effect, and there is no all-motion or overall appearance acceptance.

## Metric limits

The final unchanged-scene control (`baseline-final/`) re-runs the bald instrument after its
clothed extension. All eight PNG hashes and every clause object are exactly identical to
`baseline-clean/`, with zero errors; see `final-instrument-parity.json`.

The intermediate wall `#beb5a8` retains more warm room depth but misses the unchanged L3 floor:
0.039629 versus 0.05. L1/L2/L4/L5 pass and the run is clean. It is not accepted. One final bounded
wall revision, `#b4ac9f`, follows that measurement; if it cannot earn whole-character review,
stop this wall-axis trial and keep the existing kitchen default rather than tune indefinitely.

## Final moderated wall and actual default

The final candidate `#b4ac9f` passes L1 0.656123, L2 1.584469, L3 **0.071812**, L4 0, and
L5 1.789561 without changing a threshold. Its real room/IBL bake preserves the warm wall and
corner while improving the skin/ear/neck outline. Both complete outfits remain readable.
The [independent critique](CRITIQUE-b4ac9f.md) explicitly accepts reduced dark-garment contrast
as the tradeoff; it is not a clothing L3 pass or an overall character-quality verdict.

The actual kitchen default changes only the wall albedo. `promoted-default/` has zero errors,
and all eight bald PNG hashes plus all clause objects exactly match the original studio and
approved kitchen candidate (`default-bald-parity.json`). The scene CPU test passes 83 checks;
the five focused mask groups and existing clause selftests pass. The integrated all-page build
passes with the existing large-chunk advisory.

The first extra clothed byte-binding probe failed and remains in `promoted-clothed/`. The final
`promoted-clothed-measured/` run records exact native scene, motion, affect, hair, identity,
quality and camera equality, and explicit image differences: casual portrait 5 pixels, casual
body 19, elegant portrait 6, elegant body 32, each out of 1,080,000. Maximum channel differences
are 4, 6, 2 and 2 of 255 respectively. No substitute pixel tolerance was introduced. The critic
independently recomputed the counts and inspected all four actual-default images, finding no
material visible change and approving integration. Their small differences are not attributed
to a subsystem; no hair investigation or exact clothed-byte parity is claimed.

The static review page is served by the existing LaunchAgent. Its eight native images load,
desktop/mobile layouts have no horizontal overflow, and browser/resource errors are empty;
`review-service.json` and two UI screenshots preserve that check.

## Remaining metric limits

L3 uses encoded Rec.709 luma Michelson contrast, four-pixel inside/outside samples, and p10 per
side. Its default verdict gates left/right/top; bottom is reported but not included. The floor
remains 0.05. Hue-only contrast, clothing, hair, other viewpoints and motion are outside this
bald portrait result. The geometry mask bypasses grade/bloom/history, while the eye-aperture
mask still comes from the eye-hidden difference. All overlays require inspection.

The present geometry mask also retains ordinary texture RGB when a material has no `colorNode`.
Do not reuse its thresholded membership for clothed metrics without separate qualification;
dark ordinary fabric is not established as a white geometry ID by this repair. The new clothed
extension is used for ordinary visual evidence only.

`scene-gates.mjs` previously printed `NaN` discarded pixels because its new geometry mask did
not set `raw.hits`. Counting those existing mask members repairs that report only. Exporting
`runScene` enables the serial driver to reuse the same L1-L5 and mask path. The driver records
clause results: shell exit zero alone does not mean the scene gates passed.
