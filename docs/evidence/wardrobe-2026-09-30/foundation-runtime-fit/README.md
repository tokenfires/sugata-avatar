# Exact source-to-runtime contact trace

## Result

**Every saved body and band coordinate is reproduced exactly at all four poses. The band still fails fit.** The fixed contact is between an upper-arm-weighted body triangle and a predominantly torso-weighted band triangle. Their source-rest separation is34.377562569mm; they cross at every recorded runtime pose. Removing the saved body morph contribution leaves those contact coordinates unchanged.

Read the [plan](PLAN.md) and [independent critique](CRITIQUE.md). The critic independently parses the GLBs, including sparse morphs, and reproduces all four states with separate NumPy arithmetic. No new native/GPU capture, candidate or asset change was needed.

## Admission and observations

The observer uses the adopted BODY inverse binds for both meshes, actual saved double-precision bone-world matrices, garment-to-body joint-name remapping, one loader normalization into Float32 weights, and body morph accumulation before skinning. All43,551body and24,732band components match exactly at every time. Source full indices and all bound input/artifact hashes match. The declared identity mesh/bind transforms reproduce the observations; runtime bind identity was not separately captured and is not uniquely established by matching output.

The named pair is band26[1950,11,1225] and body2215[1519,1530,1520]. The critic proves their complete source-rest pair distance with a convex separating-plane certificate and independently reproduces the four runtime intersections. This34.38mm is the distance between those two particular source triangles, not the band’s closest source-body clearance.

Body vertices1519/1530/1520 are approximately96.0%/99.6%/97.5% weighted to `upperarm_r`. Band vertices1950/11/1225 are approximately72.6%/76.9%/77.7% weighted to `spine_03`, with18.5–24.5% upper-arm participation. Those names describe the source weights; they are not an independent anatomical segmentation or evidence to copy one set of weights onto the other.

The saved body morphs affect other vertices, with maximum coordinate-component changes about0.677/0.793/0.721/1.169mm at0/4/8/12s, but the known contact triangle is identical without them. The skin-omission negative preserves actual step0 morphs and fails as intended. Explicit NaN/Infinity controls also reject. Both observer flaws identified before launch are recorded in the plan and critique; no tolerance or matrix search followed.

## Completed region inventory

The [bounded inventory](REGION-PLAN.md) and [independent review](REGION-CRITIQUE.md) confirm three specific runtime body self-intersections. Body triangle 2246 crosses nonadjacent triangles 2212, 2650 and 2651 at step 0. The corresponding source-rest pairs are separated by 7.695 / 16.562 / 16.562 mm. The other predeclared body target, 2215, has no reported nonadjacent contact. This is a two-face investigation, not a global collision inventory.

The first selected winding/parity disagreement has winding 2 and two intersections on each of five parity rays. Both measurements remain recorded. At step 0, the stored targets of 436 band crossings have 90 right-upper-arm, 99 left-upper-arm and 247 spine-dominant mean weight descriptors. These are selected witnesses, not all pairs or anatomical segmentation. Body self-contact does not explain all band crossings or the separate blouse failure.

In the actual exposed-band image, the projected witness region looks smooth. Projection alone does not identify the visible surface; no local visible defect is attributed to this body/body witness.

## Decision — close this lead

Root selects the critic's **B: freeze the structural improvement with its failed runtime/outfit qualification and switch workstreams**. The alternative, A, is a separately declared pose-aware body/foundation/outfit feasibility study. That is a useful future prerequisite, but this result does not justify more offset, weight, mask or pose adjustments. The current foundation stays the default.

The exact trace establishes no GPU correctness, all-motion fit, binding bug, weight-truncation cause or product readiness. The subsequent region inventory establishes only its three named body/body intersections. Actual image limits remain those in the [runtime review](../foundation-domain-motion/README.md).

## Exact command and recovery

`node tools/critic/foundation-runtime-fit.mjs > tmp/foundation-runtime-fit-sep30/v1.log 2>&1`

PID13415 completed23:31:01.652–23:31:02.054UTC,exit0. Report SHA256 `cc39d179e1c3c1943da54dbeff33294ec7fa22d5895bdd1bcf971678b0375ee9`; independent critique `930bed1cf66caf5d855dd420de0c839079f1a651017c0bf5729a87024f1f4f56`. All23input/current/archive bindings and nine compressed/decoded artifacts were independently checked. No job remains from this run; the existing review server remains available.

The [local archive](archive-manifest.json) freezes34files /120,831,750bytes; manifest SHA256 `a3eaa4533a7008fffce5be18e5ad626257e42d18f0c725e4cc291dfc361b0e28`. It preserves source assets, reconstruction and counterfactual arrays, complete rig inputs and the failed-fit witness. This is local preservation, not an off-machine backup.

Region command: `node tools/critic/foundation-contact-regions.mjs > tmp/foundation-runtime-fit-sep30/regions-v1.log 2>&1`.

PID 15011 completed 23:42:21.223–23:42:21.647 UTC, exit 0. Report SHA256 `32f3ab5fb46e362187c27e3da5957b66efc99723edc8276c765533939277e648`; independent critique `63126b073eea41ffd9cd2f4782befcd3477d122f55fc9a16874a39ee65510632`. Sources, full retained rows, witnesses and log are frozen in the [region archive](region-archive-manifest.json). No job remains from either study.
