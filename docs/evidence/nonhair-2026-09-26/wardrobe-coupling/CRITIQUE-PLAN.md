# Independent scope and source review

September 26, 2026. Signed: `/root/critic`.

The proposed cached-data CPU check is a useful next step and does not require an installation or changes to the accepted assets. I reviewed the inventory/plan and the pinned cached MPFB source paths directly. No reconstruction was independently run during this review; the implementation and output still require review when complete.

The key coordinate conventions in the plan match the cached source: OBJ import applies rotation before base scale; `create_human` grounds the evaluated shape-key mix using only body indices below 13,380, applies that translation to the object data, and the historical pipeline then reapplies macro values. Mhclo converts source offsets to Blender `(x,-z,y)` and multiplies them by `(x_size,z_size,y_size)`. Those six-reference sizes must be recomputed for each reshaped body.

Preserve the signed, slightly non-unit barycentric weights. Renormalizing them or treating the refit as a translated neutral garment plus a simple delta would change the source calculation. Native Vector storage/intermediate arithmetic and shape-key storage have float32 boundaries; Python scalar parsing and ordinary JS doubles do not by themselves reproduce those boundaries. Record the modeled ordering and measured residuals without quietly tuning translation, scale, weights or axis signs to make a comparison pass.

The current body map covers 13,380 source vertices, including glTF seam duplicates. A close match there is an external consistency check against actual accepted body coordinates. It cannot independently validate omitted helpers, even though every garment triangle reference uses helper vertices. A source-derived helper array and two source-derived arithmetic implementations are not a substitute for native evaluated coordinates.

The plan's opening statement about reproducing native MPFB applies to its later native-oracle stage. Today's CPU follow-through must remain labeled cached-source reconstruction and arithmetic checks. The native all-19,158-coordinate and 2,197-garment-coordinate oracle is still missing. Original OBJ-to-glTF split correspondence, the accepted trouser correction, skeleton coupling and real fit/motion tests also remain outside this slice.

No source/data blocker is apparent in the bounded plan. The author has been advised to preserve source-derived order, per-case scales, non-unit weights and explicit native-evaluation limits. Native fit, installed garment replacement and production acceptance remain unqualified.

## Completed CPU follow-through

I reviewed the stable `read-cache.py`, `cpu-refit.mjs`, `prove-refit.mjs`, focused tests and portable verifier. Kernel SHA `ef7d111cd220a555abe0cb225ab5d18a6715903bc6d20e1526269b86777791e4`; proof report SHA `4a3e861e3b744929c5f664c81787c59dd2b84de090bab468b45e3b08aae09277`. No consequential source/axis/weight blocker was found for their explicitly modeled scope. I independently ran all nine focused CPU groups and the hash-bound portable replay; both pass. I did not duplicate the full cached reconstruction.

The mapped body consistency result is below the unchanged strict 0.001 mm gate, with nonzero residual and zero exactly equal positions retained. The grounding comes from the derived evaluated body minimum, not a fitted offset. TargetService's cached implementation uses scalar additions into a Python coordinate buffer followed by float32 shape-key storage; the model preserves that distinction from the later relative-key mix. Native importer/evaluator details remain explicitly unobserved.

The original garment's per-case six-reference scales are recalculated. Signed weights and slight non-unit sums survive; `(x,-z,y)` offsets are multiplied in the correct `(x_size,z_size,y_size)` order. Full IdentityTargets and the 1,885-dependency portable packet reproduce the same CPU coordinates at all three weights. The independent analytic example tests the axes and signed/non-unit weights rather than merely calling the same function twice.

The portable replay verifies the five compressed/decoded artifact hashes and reproduces all 5,655 body-dependency and 6,591 garment components in each case. Its actual-data corruptions visibly change the CPU answer: omitted helper deltas, wrong offset sign, valid-but-wrong helper index and clamped/normalized weights all exceed the prospective 0.1 mm native comparison threshold. That proves sensitivity of this packet/replay, not truth of the reconstructed helper positions. The retained reports state that limit correctly.

Verdict: accept this as coherent, reproducible CPU feasibility evidence and a portable future-oracle input. Native full-body/helper and original-garment coordinates remain the next external check. No native MPFB equivalence, installed corrected-garment fit, skeleton coupling or production behavior is accepted here.
