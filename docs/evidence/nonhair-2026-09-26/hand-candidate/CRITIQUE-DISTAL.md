# Distal corridor: independent mathematical and source review

**Accepted as a sufficient separation diagnostic for its explicitly selected triangle sets. It is not a complete avatar/clothing acceptance gate.** I reviewed both numerical modules and the measurement/region construction, independently ran the nine corridor controls and positive-bound controls, and verified the completed result/source/snapshot bindings. No GPU or full measurement rerun was performed.

The reviewed sources are `distal-corridor.mjs` SHA-256 `1326c14c10aef045de0b674cf6feba6d2259b8d70f52c3fb0b790974d76bc9b9` and `distal-margin-bound.mjs` `74cb3a397a214596668de53d3803b6af2a2d1b2909b81b868472bce81bb4c7cf`. The final v3 result is `40f1047e3c81fb7c783529c17376db51e0a1203c6f6626e981b5d26fab5c0602`. These bytes did not change for the interpretation correction below.

## Why the sufficient test is valid

The extrema of a closed linear triangle are attained at vertices. For each selected query/target triangle pair, an outward x gap greater than the requested margin separates every pair of their points by more than that margin. If the target is outside the query's margin-expanded y or z interval, that other axis supplies separation instead. Requiring the outward-x condition for every remaining pair is therefore sufficient. Its direction matters: an inward x displacement is not made positive by taking an absolute value. At zero margin, every query point has an unobstructed outward ray through the selected target set; a complete enclosing surface could not satisfy that condition.

Outward rounding of query intervals and downward rounding of gaps are conservative for these retained finite coordinates. The inclusive grid bins only accelerate enumeration. For the positive lower bound, a target outside the seed-expanded y/z neighborhood cannot lower the result below the proposed seed because one of those separating gaps already exceeds it. Enumerated pairs can only reduce the result. The proof concerns the selected piecewise-linear surfaces and the retained metre/root-axis convention, not anatomical completeness or unsampled motion.

I additionally compared the grid path with exhaustive pair enumeration on 200 deterministic small synthetic cases, both sides, zero and 5 mm requested margins, and three grid widths: 1,200 comparisons matched certificate status and failed-face sets. For the 153 positive cases, the returned positive lower bound never exceeded the exhaustive minimum of the downward-rounded pairwise axis bounds. These finite tests support the implementation; the mathematical argument supplies the general selected-set claim. They do not validate arbitrary malformed inputs or extreme-coordinate/grid-size domains.

## Corrected tightness claim

The original prose described the result as the exact minimum over all pairs of `max(gx, gy, gz)`, with an actual minimizing pair supplying its initial value. I proved a boundary counterexample: a query at x=`1e-300`, y=[0,1] and a target at x=0, y=[`nextUp(1)`, `nextUp(1)+1`] with overlapping z bounds. Outward-rounded zero-margin y intervals admit the pair. Its outward-x seed is approximately `1e-300`, while its largest rounded axis gap is approximately `2.2204460492503128e-16`. The implementation validly returns the smaller seed and no minimizing witness.

The operator remains conservative; only the tightness/attainment claim was wrong. The corrected `DISTAL-CLEARANCE.md` now states that the returned value is a lower bound which may stay below the global pairwise minimum and may have a null witness. The old note and a correction receipt are preserved. No numerical result or gate was changed to make the claim true.

## Region and evidence checks

I verified the original CPU receipt's source/result hashes, accounting for the preserved pre-correction note, and all twelve compressed/decoded native snapshot bindings. Every final-body positive witness maps exactly to its native snapshot's source face indices and world coordinates. The final target is a strict superset of the literal target: it restores 64 left and 51 right faces, removes no additional faces, and retains all 68 midline-touching faces. The 3,909/3,907 distal query sets contain the full legacy hand face sets and retain the stated support-boundary faces.

The half-space partition solves the specific stray cross-side weight problem without a new weight cutoff. It does not convert skin weights into anatomical segmentation. Excluding a whole incident face when it belongs to the ipsilateral arm-support region still removes some mixed torso faces. A positive body result consequently means separation from that declared remaining body target, not from every body surface.

The full clothing target keeps the sleeve and masked foundation surfaces. Failure of the broad distal query at A455 can arise from skin lying inward of its own sleeve even where the limiting triangles are disjoint. Such a failure is neither contact nor penetration depth. Conversely, C637's zero legacy right-hand/trouser crossing count does not establish an exterior hand: its corridor remains unproven and the ordinary views lose the hand silhouette. The operator appropriately prevents promoting that zero count into a clearance claim, without pretending to prove global containment.

## Use in the next bounded step

Keep this certificate alongside the original crossing witnesses, actual draw-mask membership and ordinary rendered views. Preserve exact query and target face IDs across a candidate comparison. Report the declared-body result and full-clothing failures separately. A corrected native initialization must first reproduce the accepted control, and a future pose change must retain truthful native posture/gesture dependencies.

Before using this as a final clothing gate, the sleeve/attachment policy needs an explicit geometric definition and review, or a different local signed-surface method. Silently removing every failed sleeve face or enlarging the body exclusion until a candidate passes would change the question. No angle, inward cap, product margin, complete body fit or production correction is selected by this diagnostic review.

Signed: `/root/critic` — September 26, 2026; CPU/source and retained-data review only.
