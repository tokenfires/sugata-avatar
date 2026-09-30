# Independent critique: frozen nape guide in bounded motion

Reviewed September 30, 2026 UTC by the hair critic. The critic inspected existing sources, native reports, selected actual PNGs and the geometric witness overlay. Capture execution belonged to the root agent; the critic ran no GPU or browser job and changed no asset.

## Disposition

**Retain the frozen guide as a useful local appearance candidate, with a demonstrated failure of sampled moving body clearance. Do not promote it.** The hook is absent in the inspected candidate movement frames, but frame 255 contains real selected-card/body intersections. Fewer intersections than the accepted source do not establish a clearance pass.

**One separate distal-release probe is justified by the new contact witness.** Preserve v1 exactly and make the proposed outward displacement a single hypothesis. This recommendation does not approve the resulting geometry or authorize a sequence of unsourced parameter adjustments. No root-frame edit is justified by the current appearance evidence.

Frozen v1 SHA-256, independently re-read: `dc6d17fbd6b98facd81e420ee24b46e28c2514243e065446e30ab2ef6de27427`.

## What was inspected

- Pilot baseline actual frames 0, 75, 120 and 210, to assess camera coverage as the head turned and nodded.
- Final v2 [baseline frame 210](../../../../captures/nape-motion-v2/baseline-rear-oblique-brown/frames/0210.png), [candidate frame 210](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/frames/0210.png), [baseline frame 255](../../../../captures/nape-motion-v2/baseline-rear-oblique-brown/frames/0255.png) and [candidate frame 255](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/frames/0255.png).
- Both final capture reports and numerical audits, the candidate distal-contact witness, current solver/interfaces and the retained capture/audit source.
- The actual [witness-overlay screenshot](../../../../captures/nape-motion-v2/review-witness-overlay.png). Its cyan geometry and red intersections are projected annotations, not visibility or alpha tests.

This is selected-frame review. It is not a claim that the critic watched every one of the 186 PNGs per arm as an animation.

## Matched protocol and source controls

The 9.25-second sequence is a useful small first probe: one clothed g050/bob02 Showcase owner per arm, the bound relaxed-standing pose, other procedural layers disabled, cosine-interpolated yaw ±30°, pitch +20°/−15°, roll ±15°, then two seconds at neutral. It advances at 60 Hz; PNGs are kept every three frames and geometry every fifteen frames. Extrema 75, 120, 210, 255, 345 and 390 coincide with both sampling grids. The initial pose and intervening return poses make an accidentally static stimulus easier to detect.

The source correctly maps anatomical rig-space turns into the bone delta frame. Existing [Avatar.hair-contact.browser.mjs](../../../../packages/core/src/Avatar.hair-contact.browser.mjs), lines 9–20, already uses the same `Layer`, `restRotationRelativeToRig`, `toBoneDeltaFrame`, reset and stepped readback pattern. [Breath.js](../../../../packages/core/src/motion/Breath.js), lines 409–457, explains why the rest orientation must be taken before active layers and why the conjugation is necessary. [MotionStack.js](../../../../packages/core/src/motion/MotionStack.js), lines 134–147, warns that merely resetting the clock does not restore a displaced bind pose.

The final packet records one owned renderer/node/temporal epoch and then continuous fixed steps; it does not reset temporal history before every screenshot. The initial node/grain frame is 98 and the final frame is 653. The exact archived [capture source](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/source/tools/critic/bob-nape-motion.mjs) and [browser source](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/source/tools/critic/bob-nape-motion-browser.mjs) are the reproducible executed versions; later harness support for other candidate paths must not be confused with this run.

### The shared-collider refinement was necessary and is resolved

**Actual source example:** [HairDynamics.js](../../../../packages/core/src/motion/HairDynamics.js), lines 1131–1139 and 1164–1175, fits skull/capsule radii from all authored rest particles, not only the unchanged roots. A one-card edit could therefore change a shared collision proxy. The pilot omitted those values, so unchanged roots alone did not prove isolation.

- **Alternative A, selected:** add the fitted proxy values and repeat both arms under the same final instrumentation. This adds capture cost but directly establishes the controls needed for local attribution.
- **Alternative B:** retain the pilot with explicit uncertainty about shared proxies and inspect only coarse visual behavior. This is cheaper but cannot support attribution of a new moving difference to card281 alone.

The final v2 pair resolves the concern. I independently compared all 38 paired samples: head matrices, renderer clocks, fitted skull/capsule values, and other-card/body/rig hashes match exactly. The source branch that enables calibrated full-body contact is bob01-only in [Avatar.js](../../../../packages/core/src/Avatar.js), lines 3607–3630. A null `contactReport()` for this bob02 run is therefore not evidence of body clearance; the independent sampled body oracle is necessary.

### Two seconds is recovery observation

The final neutral interval shows return behavior. It is not the older settling gate: [HairDynamics.selftest.mjs](../../../../packages/core/src/motion/HairDynamics.selftest.mjs), lines 119–127, records why that separate gate uses six seconds. Keeping the two seconds with the narrower claim is appropriate here. The alternative would be extending to that exact longer protocol if a quiescence claim were required, at the cost of a broader run. No such claim is needed for the present contact failure.

## Actionable contact finding

**Actual mismatch:** at frame 255, t=4.25 seconds and 15° upward pitch, the candidate's 32 actual GPU triangles have 13 triangle/body intersections, and its minimum sampled signed vertex clearance is −3.864073 mm. The accepted source has 26 pairs and −5.087829 mm in the same pose. Both fail sampled moving clearance. See [candidate numerical audit](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/numerical-checks.json) and [baseline audit](../../../../captures/nape-motion-v2/baseline-rear-oblique-brown/numerical-checks.json).

The contact is specific enough to support a bounded intervention. [Distal witness](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/distal-contact-witness.json) identifies vertex 26/ring 13/left at −0.822872 mm, vertex 31/ring 15/right at −0.719632 mm, and vertex 33/ring 16/right at −3.864073 mm. Their outward directions expressed in authored coordinates agree closely around `[0, +0.50, −0.866]`. Retained intersection examples involve distal triangles 25–31. These are actual posed geometry observations, not an inference from a dark patch in the render.

The audit uses unbounded spatial limits against the same frame's morphed/skinned full body. This avoids the default head-only bounds in `hair_surface.mjs`, which would exclude much of the posterior nape. The browser source skins normals as directions and uses the full body index rather than wardrobe-masked visible triangles. The sign therefore accompanies the sampled posed body; it is not a rest-normal estimate. Garment triangles, hair-to-hair intersections and times between the 4 Hz samples are excluded.

### Two concrete alternatives

**A — one measured distal release, recommended as the next probe.** Starting from frozen v1, translate both edges of each ring by `(r/16)^3 × 7 mm` along the measured mean outward direction. This leaves the root ring and each authored width vector unchanged and concentrates the displacement toward the observed distal contacts. At the tip it provides roughly 3.1 mm beyond the largest measured inside depth under a simple local-normal translation model. That arithmetic is motivation, not a predicted runtime clearance guarantee: the new rest centreline changes tangents, solver response and potentially fitted proxies.

Retain the same paired sequence and inspect at least the contact pose 255, root-deformation pose 210 and nearby actual frames. Check all existing 38 contact samples, proxy equality and other-card hashes. A successful isolated probe should remove the observed selected-card crossing without reintroducing an exposed hook, creating a nape bump, or revealing a new crease in the actual render. If another failure appears, record its new witness before deciding anything further; do not automatically increase the displacement or retune the root angle.

**B — hold v1 while restoring the original authoring-stage workflow.** This avoids accumulating a local clearance patch on a broad, strongly redirected card and keeps the successful static asset recoverable. The tradeoff is leaving a measured, spatially coherent distal contact unresolved even though a narrow causal hypothesis is now available. Given the agreement of the three measured outward directions, alternative A is justified once; a blind width/length sweep is not.

## Root transition and actual visibility

Frame 210, 20° downward pitch, has the candidate's largest root-edge departure from the rigid authored transform: 5.326066 mm versus baseline 0.415029 mm. The candidate root-to-ring1 width-axis angle reaches 64.564279°. **Neither number establishes an attachment failure or visible crease.** The solver intentionally transports each authored ribbon offset according to the changing tangent: [HairDynamics.js](../../../../packages/core/src/motion/HairDynamics.js), lines 840–875. The root centre is kinematic; the two rebuilt edge positions need not equal their rigidly transformed authored positions.

I independently recomputed root midpoint and width errors from the 38 samples and their exact head matrices. Candidate maximum midpoint error is 0.0001274 mm and maximum width-magnitude error is 0.0000889 mm. These support rotation of the root width axis rather than a translated or widened root. They do not qualify the visual transition into ring1.

In the actual frame 210 image the projected root occupies approximately x502–525/y402–452, inside the overlapping rear-card pattern. At frame 255 it projects around x501–504/y498–554. The broad overlying hair makes precise ownership difficult. I see the removed lower-right hook, but cannot identify a new card281 root crease or visibly exposed body penetration. The wire overlay ignores occlusion and alpha, so its folded projection cannot supply that missing appearance proof.

The current view is sufficient to reveal the hook change and locate the contact numerically. It is insufficient for a positive root-appearance qualification. If that question remains after contact work, two bounded alternatives are available:

- **Keep v1/root settings unchanged and retain the explicit visual uncertainty.** This avoids unnecessary diagnostic work before the known contact failure is addressed; it leaves root appearance unqualified.
- **Use one card281 identity pass at frames 210 and 255, retaining normal depth, alpha and other occluders.** This can establish whether the root contributes visible pixels in this view. If it remains covered, an opposite-rear view can answer a different visibility question. Its cost is extra evidence, and the tinted/identity appearance still cannot replace ordinary material review.

## Scope of the result

This is a head-only sequence on one clothed figure and one haircut, not ordinary idle, compound head/neck/torso movement, gait, wind, all garments or all-motion acceptance. The numerical contact witness is sufficient to reject moving-clearance promotion without proving a visible clipping defect. Existing broader rear disorder remains outside this one-card repair. The diagnostic brown is the retained `#765344` inspection colour, not a reopening of the product palette calibration.

**Preserve v1, preserve the failing frame and allow one independently named distal experiment. Keep promotion blocked until its own exact bytes have appropriate numerical and ordinary-image evidence.**
