# Extended body audit: a shared front-strand exception

The additional 158 front cards complete the ribbon-card coverage of the recorded sequences. **Ordinary motion clears all 496 ribbons in both arms. The head sequence fails on the same unchanged front card in both arms.** The cap is excluded. This is not a finished-hair or all-motion acceptance.

| Remaining 158 front cards | States | States with intersections | Triangle/body pair count across states | Minimum signed vertex clearance |
| --- | ---: | ---: | ---: | ---: |
| Side control, head | 556 | 5 | 10 | −0.167944 mm |
| Inward candidate, head | 556 | 4 | 8 | −0.100925 mm |
| Side control, ordinary | 721 | 0 | 0 | 1.054124 mm |
| Inward candidate, ordinary | 721 | 0 | 0 | 1.192699 mm |

The earlier 338-card rear/side audits remain clear. Their minimum candidate head margin is only 0.078131 mm. Combining the disjoint card sets preserves that successful regional result while exposing the front exception; it does not turn the head result into a pass.

## Exact witness and actual images

Card **58**, ring **16**, side **1** contacts the body during the upward-tilt interval: control frames 254–258 and candidate frames 255–258. Each affected state contains two triangle/body pairs. Card 58's authored POSITION/NORMAL records are exact between the two assets. The candidate's smaller penetration is a changed dynamic response, not evidence of a perceptual improvement.

At frame 256, a separate Three.js segment/triangle calculation reproduces both contacts against body triangle 14630. Its intersection endpoints match the original oracle within 1e-8 metres. The [witness packet](../../../../captures/lower-fallback-front58-witness-v1/report.json) preserves the original triangles, source hashes, sample pins and comparison.

Root and critic inspected the original front pairs at 252, 255, 258 and 261. Neither identifies a new attributable opening or crease in that interval. The geometric contact still exists. Its front projection is near (406,184) in the 900×868 image, but projection does not prove alpha-visible ownership. Exact frame 256 was not photographed; the preserved 255/258 images bracket it.

- [Control at frame 255](../../../../captures/lower-fallback-head-front-v1/baseline-front-brown/frames/0255.png).
- [Candidate at frame 255](../../../../captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0255.png).
- [Independent critique](CRITIQUE.md).

## Reproduction and scope

`audit-other-hair-motion.mjs --directory=<frozen capture directory> --out=<new audit directory>` consumes the existing raw `otherVertices` readback. It reconstructs the original triangle topology for the exact complement of the earlier 338-card selection. The 158 ordered components contain 5,056 triangles; there are no cross-component triangles. Every sample hash, Float32 other-vertex hash and source topology is checked. Fully skinned/morphed body positions and hair positions come from the same world-space sample.

The four outputs under `captures/lower-fallback-front-audit-v1` retain complete numerical checks, final progress, source snapshots, process IDs and timestamps. Sessions 18036, 39562, 46992 and 48579 completed and were collected. No new native capture or simulation was needed. Prior 338-card control results are linked through their existing exact physical-replay proof.

The two card sets cover all 496 ribbons and 15,872 ribbon triangles. The 1,128 cap triangles, garments, hair/hair contact, alpha coverage and intervals between captured updates remain outside this check. A geometric pair count is not a visible-clipping count. Only one figure, outfit, seed and the two recorded protocols are covered.

## Decision and alternatives

Retain the inward candidate as an isolated appearance lead with this explicit shared front exception. Carry card 58 into the [front constraint study](../front-support/README.md). Keep the accepted asset and avoid another small shape or stiffness adjustment based solely on this metric.

The second alternative is a same-state, render-only identity/hide experiment for card 58 if its visible contribution becomes decision-critical. That could attribute pixels while preserving all solver buffers, but would not fix the contact or qualify the rest of the front. The current images do not justify that extra render or a new geometry candidate.

## Preservation

The [manifest](archive-manifest.json) freezes 26 files / 4,587,441 bytes across the supplementary audits and independent contact witness. The [summary](summary.json) records the exact disjoint union, linked prior audits and final critic hash. Original images and physical readbacks remain in their earlier frozen archives.
