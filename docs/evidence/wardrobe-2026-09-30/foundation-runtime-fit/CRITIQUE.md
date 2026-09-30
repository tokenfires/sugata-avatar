# Independent runtime-fit reconstruction review

## Disposition

**The finite source-to-pose reconstruction is accepted; the candidate's fit remains failed.** Independent arithmetic exactly reproduces every saved body and band Float32 coordinate at all four times. The named contact is an arm-weighted body triangle meeting a predominantly torso-weighted band triangle under the saved pose. It is unchanged by the isolated body-morph counterfactual. This does not establish incorrect binding, weight truncation, insufficient offset, or body self-overlap as the cause.

Reviewed [report](../../../../captures/foundation-runtime-fit-2026-09-30-v1/report.json), SHA256 `cc39d179e1c3c1943da54dbeff33294ec7fa22d5895bdd1bcf971678b0375ee9`, PID 13415, `23:31:01.652–23:31:02.054Z`. All 23 current input hashes and archived copies, plus nine compressed/decoded artifact hashes, independently verify. No native/GPU job, asset mutation, or repeated parent instrument was run by the critic.

## Independent reconstruction

I parsed the actual body and candidate GLBs independently in Python, including sparse morph accessors, joint-name remapping and body inverse binds. NumPy arithmetic uses the saved double-precision bone-world matrices, the loader's reciprocal-L1 normalization followed by Float32 weight storage, and ordered morph accumulation before skinning. The body inverse binds are used for both surfaces, matching [Wardrobe adoption](../../../../packages/core/src/wardrobe/Wardrobe.js), rather than the discarded garment skeleton. This implementation does not call Three's `SkinnedMesh` or the parent reconstruction function.

For each pose and vertex, the calculation is:

1. Add each active indexed body morph delta to source position in source target order; the band has no such morph contribution.
2. Form each adopted transform as saved `boneWorld × bodyInverseBind` using the same ordinary double arithmetic order.
3. Sum the four weighted transformed XYZ positions, with the declared identity mesh/bind transforms, then store Float32.

| Step | Body components compared | Band components compared | Changed components / maximum difference |
| --- | ---: | ---: | --- |
| 0 | 43,551 | 24,732 | 0 / 0 |
| 240 | 43,551 | 24,732 | 0 / 0 |
| 480 | 43,551 | 24,732 | 0 / 0 |
| 720 | 43,551 | 24,732 | 0 / 0 |

All reconstructed artifact arrays also equal their corresponding captured snapshots. The independently calculated four complete zero-morph body arrays equal their saved counterfactual artifacts exactly. The original body mesh and source ancestor matrices are recorded as identity. Matching outputs demonstrates that this declared representation reproduces these observations; it does not uniquely identify unrecorded runtime binding parameters or qualify GPU skinning.

The corrected omitted-skin control preserves the actual step-0 morphs. Independent unskinned arrays match its artifacts. It fails exact equality as intended, with maximum component errors **387.653112 mm body** and **49.210921 mm band**. These are component maxima, not Euclidean vertex distances.

## Concrete contact and source-rest distinction

The fixed pair is band **26 [1950,11,1225]** and body **2215 [1519,1530,1520]**.

Their source-rest minimum separation is independently established as **34.3775625686385 mm**. The closest reported pair is band vertex 1950 versus body vertex 1520. A separating-plane certificate using their unit difference gives band vertex projections relative to the closest band point of **0 / +0.562622 / +2.755103 mm**, and body projections relative to the closest body point of **−2.836752 / −9.776676 / 0 mm**. Convexity therefore supplies the matching lower bound for these two complete triangles. This is their pair separation, **not the minimum distance from the band to the whole source body**.

Independent edge/triangle calculations find two intersections for this pair in each saved pose. The best-matching contact agrees with each stored witness within **3.13e-16 m** per component across all four times. At step 0 the point is approximately **(-0.1762569325084941,1.2244314947201507,0.034415769467256385) m**, already reviewed against the actual image in [CLEARANCE-CRITIQUE](../foundation-domain-motion/CLEARANCE-CRITIQUE.md).

All three target body vertices remain exactly unchanged when body morphs are zeroed, and the pair still crosses at all four times. Elsewhere on the body the saved morphs do have an effect: reported maximum component differences are approximately **0.677 / 0.793 / 0.721 / 1.169 mm**. Thus zeroing body morphs is a meaningful counterfactual that leaves this particular witness unaffected; it does not demonstrate that morphs are irrelevant to every contact.

The actual normalized weight witnesses explain the useful next descriptive classification:

- Body vertices 1519/1530/1520 have `upperarm_r` weights approximately **0.960400 / 0.996400 / 0.974900**.
- Band vertices 1950/11/1225 have `spine_03` weights approximately **0.725623 / 0.769100 / 0.777450**, with `upperarm_r` approximately **0.245261 / 0.189200 / 0.184800**.

This is differential arm/torso participation under one reproduced skinning calculation. Dominant joint names are descriptors, not independent anatomical segmentation or proof that one set of weights should replace another.

## Prelaunch observer corrections retained

Two actual source issues were corrected before execution in [the instrument](../../../../tools/critic/foundation-runtime-fit.mjs):

1. The original `if (difference)` residual ignored NaN. **A, selected:** retain explicit nonfinite string witnesses and require none for exact equality; NaN and Infinity controls now reject. **B:** validate finiteness before subtraction, with separate failed-array preservation. A retains more useful failure evidence; B is simpler but must avoid losing the bad array on an early throw. This was an observer bug, not evidence of nonfinite values in the actual assets.
2. The original source-position negative omitted both morphs and skin, despite its skin-only label; actual step 0 has 13 nonzero morph influences. **A, selected:** retain those morphs and bypass only skin using `Mesh.prototype.getVertexPosition`. **B:** retain the old arrays and label the control as combined morph-and-skin omission. A isolates the intended mechanism; B only demonstrates sensitivity to a broadly invalid observation.

The completed run passes the exact reconstruction gate before producing any counterfactuals. No tolerance or matrix search was introduced.

## Two bounded next alternatives

1. **A — selected: inspect retained contact-target ownership and one concrete body-overlap witness.** Inventory mean normalized joint weights on the stored crossing targets at all four poses, then examine the named arm target and one predeclared winding/parity-disagreement witness against nonadjacent full-body triangles. Keep the existing source-rest welded-neighbour exclusion explicit. This may discriminate body overlap from other local fit constraints without changing the candidate, but a stored target is only one retained target per crossing row, not an inventory of every intersection. Absence or ambiguity must end this bounded observation rather than expand a search.
2. **B — close attribution here and carry these arm/torso contacts into a new pose-aware construction contract.** This avoids further diagnosis and preserves the failed candidate as a clear baseline, but leaves the overlap hypothesis unresolved and cannot justify a particular weight, pose or offset correction. Any future construction still needs independent body/outfit, coverage, binding and motion qualification.

The [elegant attribution](../foundation-elegant-attribution/CRITIQUE.md) remains a separate failure. Smooth exposed imagery and exact arithmetic cannot turn either fit gate into a pass. No all-motion, continuous clearance, normal/tangent, general binding, or product-promotion claim follows.
