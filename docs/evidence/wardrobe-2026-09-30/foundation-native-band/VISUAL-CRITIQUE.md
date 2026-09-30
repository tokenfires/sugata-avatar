# Independent static appearance and rest-clearance critique

## Disposition

**The lower-cut foundation removes the observed casual neckline islands, but this exact band is not ready for promotion.** Its exposed upper and lower boundaries still read as steps and teeth. The source-rest exterior result is positive and independently supported at the closest witness; it does not cancel the visible finish problem or establish moving fit.

Keep this prototype frozen. A separately declared change to boundary construction is justified by the actual images. Do not repeat refinement, offset, relaxation-strength or mask sweeps on this recipe.

Reviewed packets:

- [Visual report](../../../../captures/foundation-native-band-visual-2026-09-30-v1/report.json), SHA256 `27cd46ba87bb183b65dbb2dfa0d3983409b556599b6e2a67ed2f2df193aeb9f4`.
- [Rest-clearance report](../../../../captures/foundation-native-band-clearance-2026-09-30-v1/report.json), SHA256 `b3eb77fd0172b3d8a25650be736b5bd3a91b385c54deddff114d379e84853290`.
- Exact band GLB `c82805f09177627376a9b6ec821c754c020ef1b2cc7a074e6960523e8f5641bd`; finite native/export and coverage disposition remains in [COMPARISON-CRITIQUE.md](COMPARISON-CRITIQUE.md).

## Actual image observations

I directly inspected all 23 original PNGs: ten shipped, ten band, and three rebuilt construction controls. Coordinates below refer to their original 800 × 1,000 canvases; they locate regions rather than attribute individual pixels to triangles.

### Dressed benefit is real within these views

In [shipped casual front](../../../../captures/foundation-native-band-visual-2026-09-30-v1/shipped-casual-portrait-0.png), grey fragments occupy the left collar edge around x116–155/y802–850 and a smaller opposite region around x493–515/y814–845. Both are absent in [band casual front](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-casual-portrait-0.png). The −45° near-side fragment around x271–335/y821–863 and the +45° opposite-side fragment around x134–153/y786–826 also disappear in the corresponding band originals. I see no new exposed black hole at those locations. The rear collar has no newly obvious change.

This is the declared cut and mask result: actual wardrobe receipts show **327 shipped foundation triangles versus zero band triangles drawn under casual**. Foundation-only receipts separately draw all 13,218 band triangles. The dressed improvement alone does not demonstrate how well the band fits. The rebuilt control draws 3,996 foundation triangles under casual; its front image also shows an extra grey island around x128–144/y911–940 on the blue collar. It is therefore correctly kept distinct from the shipped visual baseline.

### Concrete finish failure: stepped upper boundary and toothed lower hem

In [band foundation front](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-foundation-torso-0.png), the upper line around x60–580/y385–402 consists of flat segments with abrupt height changes. Along x60–630/y713–730, the lower hem has repeated diagonal teeth and rectangular notches. These are not merely tiny texture variations. The [−45° band torso](../../../../captures/foundation-native-band-visual-2026-09-30-v1/band-foundation-torso--45.png) exposes the same lower-edge pattern around x160–680/y710–740. The +45° original confirms it from the other side. The rear upper rim has another central rectangular step around x446–508/y380–391; the rear lower edge is mostly straighter in the centre but remains notched toward the sides.

The shipped and rebuilt foundation controls already have these boundary characteristics. Removing the straps exposes a longer uninterrupted upper line without repairing that inherited construction. At full-body scale the band is readable as a strapless foundation and its teeth are less prominent; the torso originals still fail the intended finished garment contour. I do not infer a new body intersection from their appearance.

## Source-grounded boundary alternatives

**Mechanism witness:** [build_figure.py](../../../../tools/figure-pipeline/build_figure.py:1346) refines and selects vertices with the region predicate, offsets the padded patch, relaxes it, and then calls `keep_only`. That function at line 1799 deletes vertices outside the region and their incident faces. It retains whole surviving faces; it does not intersect faces with the anatomical floor/ceiling. `roll_the_hem` at line 1400 extrudes the resulting boundary toward the skin. Its presence gives depth and changes normals, but does not independently replace the stepped boundary path. The photographed contour failure is consistent with this construction; I have not assigned each rendered tooth to an individual source edge.

- **A — recommended next isolated representation:** intersect the padded refined native patch with the **existing** anatomical floor and ceiling before the normal/offset stages, keeping both sides of each split in the working patch. Explicitly select the interior and cut vertices, then use the unchanged offset/clamp/relax, final retention, and roll stages. This places the cut through faces instead of selecting a staircase of surviving faces. Keeping exterior neighbours respects the current normal snapshot and the pinned-boundary logic in `relax_onto_the_body` (lines 1641–1683). The tradeoff is new topology and interpolated data: exact cut membership, nominal/effective planes, native full weights, masks, UV/corner data, two valid boundary loops and subsequent four-slot deformation must all be re-established. It is not guaranteed to yield a smooth rendered rim after offset and roll.
- **B:** deliberately author continuous upper/lower rim curves from the valid existing boundary loops, reposition those loops onto the body support and rebuild their adjacent strips before rolling. This can retain more existing vertex/weight identity and permits a designed contour rather than a horizontal cut. It requires an additional contour choice, and can distort spacing, adjacent triangles and skin deformation; unchanged weight labels would not prove appropriate binding after moving their vertices. This is broader and less directly tied to the currently declared anatomical planes.

For A, preserve the outside patch through normal/offset construction; clipping an already offset shell or deleting outside faces early would test a different mechanism and can introduce boundary flare or zero-offset interpolation. Float32 plane storage and torso-bone membership at new vertices need explicit receipts, not an epsilon selected after observing a hole. Preserve the existing coverage targets and finite native-reference bar; do not transfer this prototype's pass to the next topology.

## Independent rest-clearance review

The completed report contains every triangle ID 0–13,217 exactly once. I verified its ten live and archived input hashes and re-aggregated all rows: **zero crossing triangles, zero contained centroids, zero parity ambiguities, and zero negative supplementary vertex samples**. The admitted full body is one closed oriented component with 13,380 welded vertices, Euler characteristic two, and zero source-rest weld separation. The unchanged helper's twelve analytic control receipts pass. I reviewed its full triangle intersection/distance, winding and five-direction parity logic; I did not duplicate the complete production audit.

I independently parsed both GLBs and solved the closest stored edge pair using NumPy least squares with segment endpoint constraints. Band triangle **12979**, raw vertices `[4148,6229,6574]`, approaches body triangle **20664**, raw vertices `[11565,11566,11579]`, to **0.282839652710 mm**. The closest edges are band edge 1 and body edge 2, at parameters approximately `0.0276581731164` and `0.4974739611343`. The reconstructed witness points agree within `3.47e-18 m`. An independent solid-angle calculation at that band triangle's centroid gives zero winding to displayed precision; the five independent parity ray counts are **2, 4, 2, 0, 0**, all nonambiguous and outside.

That positive distance supports the declared source-rest exterior observation. It is not the author's 0.8022 mm nearest-vertex receipt: the author measures against its refined working skin, whereas this audit compares complete exported triangles against the accepted body. Do not replace either measurement with the other. The nearest body triangle is masked in casual; this does not affect the full-body audit or establish visibility at another pose. No moving-clearance margin, self-intersection certificate or all-motion coverage claim follows.

## Capture scope and next decision

I verified all 23 image and compressed/decoded state hashes, all recorded GLB response bindings, all 380 current source/asset hashes and their available archived copies. The 13 repeated view comparisons have exactly equal recorded physical state, lights, cameras and non-foundation snapshots. All 23 owners report clean disposal and no captured errors. Existing warnings remain recorded. Every image uses draw 99 at zero time/delta on Apple Metal WebGPU. This is controlled static evidence, not exact image reproducibility or a GPU readback of every skinned garment vertex; saved garment positions are CPU-skinned snapshots.

**Next choice:** archive this complete prototype, then predeclare one boundary-intersection observation under alternative A. The other defensible course is to hold construction and first qualify this unchanged band in moving foundation-only views; that measures its current deformation but cannot fix the already visible hem failure. The stronger appearance priority is the new boundary representation. Neither course authorizes promotion, changed masks, a revised coverage gate, or another offset/refinement sweep.
