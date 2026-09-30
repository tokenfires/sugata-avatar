# Independent critique — posterior support envelope

## Disposition

**Preserve the final v3 candidate as a meaningful static posterior improvement and proceed to one matched ordinary-motion qualification. Do not promote it to the accepted groom yet.**

The actual images show the first substantial improvement in the broad rear flow from this sequence of probes. The central crossed field, low tongue, and lateral nape hook are replaced by substantially continuous downward strands. This gain survives the neutral inspection material and the original dark material under Studio lighting. Restoring original card 47 does not introduce an obvious new diagonal in the inspected intact views.

The full medium-bob target remains unfinished. The hem is relatively blunt, crown and forward-side irregularities remain, and the reference's rounded body with inward lower return is only partly expressed. Motion has not been qualified for these bytes. Freeze the current construction while establishing that next piece of evidence; do not change hem, material, frame, or clearance parameters concurrently.

Final candidate SHA-256, independently rehashed:

`d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`

The accepted source remains `a666a80777f0b93a824857dc2e2cbffe27cd2c8991a3f4ec8215ebc1d94298bd`. The separate nape/distal lead remains frozen and is not combined into this prototype.

## Evidence actually inspected

I directly viewed all five neutral candidate views at each of v1, v2, and v3; all five matching v1 control views; and all six v3 original-dark/Studio control/candidate images. These are original native PNGs, not generated illustrations or image edits. I also re-viewed the user's [medium rear-flow reference](../../../../reference/bob-appearance-2026-09-29/01-medium-rear-flow.jpg) and [medium side-volume reference](../../../../reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg).

All completed capture reports record `status: captured` with empty recorded error arrays. For each final neutral pair and each final dark pair, the recorded fixed state is identical except groom positions, velocities, and vertices. Material vectors and renderer clocks match exactly within each pair. Thus the visible comparison does not depend on changing the material between control and candidate. The reports cover their recorded error channels; this is not a blanket assertion about uncollected diagnostics.

### Back: the large crossed field is replaced by connected flow

Compare the neutral [accepted control](../../../../captures/bob-posterior-envelope-v1/control/casual-back-medium-brown.png) with [final v3](../../../../captures/bob-posterior-envelope-v3/neutral/casual-back-medium-brown.png), both 900×868. The central rear field, approximately x350–650/y230–570, changes from overlapping diagonal/short angular strips into longer, largely continuous downward runs. The low central tongue no longer interrupts the nape edge.

The same distinction is clearly visible in the original-dark [control](../../../../captures/bob-posterior-envelope-v3/dark-control/casual-back-exact-default.png) and [candidate](../../../../captures/bob-posterior-envelope-v3/dark-candidate/casual-back-exact-default.png). The strong blue Studio rim remains in both images. It illuminates smoother directional structure in the candidate, so the improvement is not merely lighter color making details easier to see.

### Both rear obliques: gain retained after the clearance fit and fallback

The final [rear-oblique](../../../../captures/bob-posterior-envelope-v3/neutral/casual-rear-oblique-medium-brown.png) and [opposite-rear](../../../../captures/bob-posterior-envelope-v3/neutral/casual-rear-left-medium-brown.png) show continuous posterior coverage. The rear-oblique central field around x300–600/y220–570 no longer carries the original dense crossed stack, and the outward hook at approximately x560–620/y545–610 is absent.

The original-dark [control](../../../../captures/bob-posterior-envelope-v3/dark-control/casual-rear-oblique-exact-default.png) and [candidate](../../../../captures/bob-posterior-envelope-v3/dark-candidate/casual-rear-oblique-exact-default.png) corroborate both changes. Original card 47's return does not create a conspicuous new diagonal in either final rear oblique. This is an intact-image observation, not proof that card 47 is individually invisible from every direction.

### Profile and front: posterior improvement, unfinished forward region

In the neutral [right profile](../../../../captures/bob-posterior-envelope-v3/neutral/casual-right-profile-medium-brown.png), the rear field around x360–535/y250–550 becomes a continuous fall. The forward-side crossed feature around x190–330/y310–455 persists. The corresponding original-dark [control](../../../../captures/bob-posterior-envelope-v3/dark-control/casual-right-profile-exact-default.png) and [candidate](../../../../captures/bob-posterior-envelope-v3/dark-candidate/casual-right-profile-exact-default.png) retain that same distinction.

The final [front](../../../../captures/bob-posterior-envelope-v3/neutral/casual-front-medium-brown.png) retains the existing bangs and face framing, including their irregularities. Selected posterior shafts can still be seen from the front; a protected root plane does not define a protected screen region. I see no new obvious front seam attributable to the card 47 fallback. I do not claim the requested face-opening asymmetry has been completed.

### Hem and surface character

The final back hem around x320–690/y550–600 has small strand variation, but reads more bluntly than the inward-curving lower silhouette in references 1 and 3. The posterior surface also remains broader and straighter than those photographs. I do not see the conspicuous repeated wide panels or evenly spaced comb slots from the earlier added-curtain failures in these inspected views. That is a bounded comparison, not a guarantee against panel-like behavior in motion or other views.

## Construction and controls

The [v1 construction](../../../../captures/bob-posterior-envelope-v1/bob-posterior-envelope.mjs), lines 14–46, selects 266 existing cards, including 42 root-layer cards, by original root `z < 0.015`, excluding fringe. It gives these cards a shared meridional direction field around an elliptical support envelope. Cubic guides carry each original root centre to a layer-dependent hem; width axes are transported along the guide. Card count, topology, material, both UV sets, and skin attributes are retained. This is a replacement of existing paths, not an added curtain over the old disorder.

The source includes body-derived horizontal radii encompassing the ear region (lines 18–20), a rounded upper support and 8mm lower tuck (lines 30–36). Cubic control points on that support do not guarantee that the curve or the ribbon between them stays outside the body. The initial failures demonstrate this distinction directly.

V1's report records root-centre preservation within 0.000002083mm and width-magnitude preservation within 0.000006584mm. Its regenerated width axes are not the original axes. The v2 fit likewise preserves root/tip centres and width magnitudes while allowing edge orientation to change; its measured maximum root-edge shift is 0.028293mm and tip-edge shift 0.012592mm relative to v1.

An independent raw GLB accessor comparison confirms that v2→v3 changes exactly card 47's 34 POSITION and 34 NORMAL records. Every restored record matches the accepted card byte for byte. Other position/normal records, UV/UV1, joints and weights are unchanged from v2. The fallback source asserts equal accepted/v2 indices, and restores only position/normal bytes.

For v3's held back and front captures, I independently compared the nonselected rest/live vertex arrays with the accepted control. Nonselected rest coordinates are exact. Live coordinates have only two changed components: both x coordinates of card 49, ring 14, one on each edge, each +0.0000149012mm. Head matrices are identical. This microscopic residual is not a visible defect, but the final candidate should not be described as having bit-exact nonselected live vertices. The earlier v1 comparison was exact and should not be silently generalized to v3.

## Finding 1 — the coherent first prototype failed actual rest clearance

**Actual mismatch:** the [v1 report](../../../../captures/bob-posterior-envelope-v1/candidate-report.json) records 469 selected triangle/body intersection pairs, involving 139 hair triangles, with 64 inside vertices. The worst is original card 47, vertex 2259 (ring 4, right edge), at −7.080926mm. All negative vertices are in rings 2–7, while all root edges remain outside. This localizes the failure to the upper guide/ribbon rather than proving detached roots.

The original-card intersection set is `[10,18,24,25,37,39,47,70,76,77,86,109,118,190,196,228,255,434]`. Cards `[10,24,76,190,228,255,434]` intersect without an inside vertex, so fitting only negative vertices would miss actual crossings. The raw oracle's `cards` values index filtered components, not original card IDs; use the saved [mapping](../../../../captures/bob-posterior-envelope-v1/contact-card-mapping.json). Pair count is not a count of visible defects. Alpha sampling is disabled and rendered occlusion has not been established for these contacts.

Two alternatives were justified by the visible flow gain:

1. **Selected: one bounded curve-level clearance fit.** Lift the first cubic control point outward along its horizontal meridian, retain the root/tip centres and width magnitudes, regenerate the complete smooth ribbon, and audit every selected card. This preserves the demonstrated directional field while addressing the upper chord intrusion. Tradeoff: clearance need not vary monotonically with control-point lift, and edge frames can move despite fixed centres. Passing samples do not prove a continuous clearance floor.
2. **Alternative: direct support-surface meridians.** Construct each path on a smooth support surface with explicit root transition, instead of assuming a cubic between supported controls stays outside it. This avoids the specific convex-body chord issue and can preserve coherent directions. Tradeoff: it introduces a new path representation and requires new edge, width, root-transition, coverage and motion qualification. It is a larger change than the first bounded fit.

The [v2 fit](../../../../captures/bob-posterior-envelope-v2/bob-envelope-clearance.mjs), lines 23–39, evaluates all 266 selected cards, each with 34 vertices and an order-4 lattice on all 32 triangles. It seeks a 3.5mm sampled floor using recorded 4mm control-point probes, a 40mm bound and seven refinement steps. It asserts that zero lift reproduces the frozen v1 card exactly. All probe values are retained, and the report explicitly disclaims a globally minimal lift or monotone response. A separate exact triangle audit follows the sample-based fit.

This fit resolves 27 cards while preserving the visible flow. It leaves one explicit failure rather than hiding it with individual vertex push-outs.

## Finding 2 — card 47 exceeded that bounded fit

**Actual mismatch:** the [v2 report](../../../../captures/bob-posterior-envelope-v2/candidate-report.json) records card 47 reaching only 2.486166mm sampled minimum at the 40mm control-point bound. It therefore remains exactly v1; all 30 remaining selected rest triangle/body pairs map to card 47. V2 is still unqualified despite its improved intact appearance.

Two concrete recovery alternatives:

1. **Selected: exact accepted-card fallback.** Restore only original card 47's position and normal bytes, leaving the 265 other reshaped cards unchanged. The independent [original47 audit](../../../../captures/bob-posterior-envelope-v2/accepted-card47-audit.json) records 32 triangles, zero body pairs and 3.612022mm minimum vertex clearance. This avoids exceeding the declared fit bound and keeps the result easy to attribute. Tradeoff: the old path is not intrinsically smooth—the source trace gives a maximum finite turn of 46.036°, approximately 93.747mm arc length and 53.526mm lateral tip displacement—so its return could have reintroduced a visible diagonal. The final intact images were required to judge that risk.
2. **Alternative: direct support-surface construction for card 47.** Keep its meridional styling intent and replace its cubic with a surface-constrained path. This could preserve a more uniform directional field than the fallback. Tradeoff: a second curve family would need its own root/edge/triangle and visible-transition evidence. It is not justified merely by an aesthetically imperfect numerical angle when the exact fallback passes the current intact-image check.

The [v3 fallback source](../../../../captures/bob-posterior-envelope-v3/bob-envelope-fallback.mjs), lines 7–12, pins both input hashes, restores the exact original card, and repeats the audit over all 266 selected cards. The [final report](../../../../captures/bob-posterior-envelope-v3/candidate-report.json) records **8,512 selected triangles, zero rest triangle/body pairs, and minimum selected-vertex clearance 3.612022mm**. The minimum remains on original card 47. This is an audited rest result against the figure body; it does not establish a 3.5mm floor over every continuous triangle point, garment clearance, whole-groom clearance or motion acceptance.

The final neutral and dark images preserve the visible flow gain without an obvious new fallback diagonal. Therefore retain this measured recovery. Do not raise the lift bound, repeatedly swap card 47 between recipes, or tune it again without a new actual failure witness.

## Finding 3 — held-pose isolation does not establish runtime isolation

**Actual source example:** `packages/core/src/motion/HairDynamics.js:1129–1138` fits the skull centre from roots and its radius from the nearest rest centre over the entire groom. Lines 1164–1175 similarly constrain the shared shoulder capsule radius from all rest centres. A change in selected posterior paths can therefore change shared collision parameters used by authored-unchanged front cards. Root/edge preservation and the tiny held-pose nonselected residual do not settle this question in motion.

Two concrete next alternatives:

1. **Recommended: one matched 12-second ordinary-stack capture.** Freeze final v3 and accepted control; use seed `20260807`, the ordinary procedural layers, a camera covering opposite-rear hair/neck/shoulders, owned 60Hz stepping, 20fps original image frames, and per-step selected-card/full-posed-body readback. Record actual head, rig, clock and fitted skull/capsule values. Audit all 266 selected cards against the posed body, and compare nonselected live geometry to distinguish direct authored changes from shared runtime effects. This addresses a real gap in the current evidence without changing the recipe. Tradeoff: one seed, camera and finite interval are limited coverage; the images still require direct judgment for continuity, roots, silhouette and garment contact. Numerical zero contacts alone would not establish a convincing moving bob.
2. **Alternative: hold this candidate as static-only evidence.** Preserve the final images, reports and exact bytes, then defer motion qualification. This avoids expanding the accepted asset on incomplete evidence and allows broader authoring work to resume from a useful static checkpoint. Tradeoff: it leaves the practical runtime value of the larger representation unproven, so it does not support integration as a replacement groom.

Root selected the ordinary-stack qualification. A separate matched head-turn/tilt sequence can follow if useful; do not combine new motion evidence with hem/material/path changes. If a contact or visible failure appears, retain its exact frame and geometry witness before proposing a correction. Differences in fitted colliders should be recorded and interpreted, not silently forced equal when they are an actual consequence of the asset.

## Remaining style mismatch and sequencing

The actual blunt lower edge and forward-side crossed patches described above are valid remaining appearance findings. They do not negate the posterior gain, and they do not justify concurrent tweaks during motion qualification.

Two alternatives for the next appearance decision after motion:

1. **Preferred sequencing: qualify motion first, then make one terminal-path study if the hem remains the largest visible mismatch.** Use the same back/profile reference pair to constrain the lower curvature and collective inward return. Preserve the upper field and capture one isolated candidate. Tradeoff: this postpones a known styling gap, but leaves motion evidence interpretable and avoids a broad length/width/curtain sweep.
2. **Keep the current blunt posterior as an explicit experimental variant.** Preserve its demonstrated directional cleanup while pursuing the rounded medium cut separately. Tradeoff: this protects the current advance but does not complete the user's primary reference target. It must not be relabeled as the finished medium bob merely because it is cleaner than the control.

For the persistent forward-side patch at profile x190–330/y310–455, two later alternatives are available: **A**, use a small card-identity/ablation probe to establish which protected paths own that visible crossing before extending the shared field; or **B**, apply one explicitly bounded continuation of the envelope to the neighboring side sector and judge it against the frozen front/profile controls. A gives stronger attribution and lower risk to the requested face framing, but postpones another appearance candidate. B could address the remaining field more directly, but changes protected styling and risks a seam or loss of the current face opening. A is preferred if this region becomes the next priority. This review does not assign every remaining fragment to a particular card or claim that the protected region is already correct.

## Scope and stop conditions

- V1 and v2 remain preserved failures; v3's recovery does not retroactively qualify them.
- Final v3 is a useful static candidate for bob02/g050, not a default asset or whole-style acceptance.
- No visible contact is inferred solely from the rest oracle, and no geometric clearance is inferred solely from clean-looking pixels.
- No new material/light calibration is needed to explain this result: the final paired dark images retain the gain.
- Do not reopen the rejected two-card endpoint/frame loops or added-curtain construction. The larger representation now has its own positive image evidence and bounded qualification path.
- Only this assigned critique file was written. The critic ran no native browser, Blender or GPU jobs.
