# Independent critique — measured distal nape release

## Disposition

**Keep the released card281 candidate frozen as the lead for further qualification. Do not promote it to the default asset yet.** The measured intervention resolved the selected card's previously demonstrated neck intersection at all 38 sampled poses in this sequence. Its short nape outline survives the inspected neutral-brown, original-dark Studio, and rear views. I found no new visible ledge, gap, hook, or crease in the inspected images.

This is a supported local advance. It does not qualify the whole groom, ordinary procedural motion, all viewpoints, or the unsampled times between geometry readbacks. The earlier contact was geometrically established beneath overlapping hair; I cannot describe this as a visibly demonstrated clipping repair. The visible gain remains removal of the original lateral hook.

Reviewed candidate SHA-256: `b418d97eacd6edd4312fb198959b69f0cb6dbf0531abe17bda7f0791ef9d04e4`. I independently rehashed the file. The prior guide remains frozen at `dc6d17fbd6b98facd81e420ee24b46e28c2514243e065446e30ab2ef6de27427`. The accepted source asset remains a separate control.

## Evidence and isolation

The [archived recipe](../../../../captures/nape-distal-v1/bob-nape-distal-candidate.mjs), lines 8–25, pins the exact prior guide, reads the three inside-vertex witnesses at frame 255, averages their measured outward directions, and translates both edges of each non-root ring by `(ring/16)^3` times a 7mm vector. The translation is approximately `[−0.0263, +3.4873, −6.0694]`mm at the tip. Normals are recomputed. This is a new intervention justified by the measured distal contact, rather than a return to endpoint or width-axis tuning.

The [rest audit](../../../../captures/nape-distal-v1/rest-checks.json) records exactly 32 changed positions and normals; the root ring and other geometry remain unchanged. Maximum authored width-vector difference is only `0.000002083`mm of Float32 rounding. The selected 32 rest triangles have zero body intersection pairs. This rest result alone would not qualify the candidate.

I compared the completed reports for `motion-brown`, `baseline-motion-dark`, `motion-dark`, `baseline-motion-back`, and `motion-back`. Each contains 186 PNGs and 38 geometry samples. All have status `captured`, empty monitored errors, and disposal `{disposed:true, leaked:[]}`. The harness monitors **page errors and HTTP responses at or above 400**; it does not collect all browser console messages, so “no console errors” would be an unsupported expansion.

Relative to the prior guide's brown run, every one of the 38 head matrices, motion keys, clocks, collider values, other-card vertex hashes, body-position hashes, and rig hashes matches exactly. Brown setup differs only in the intended geometry descriptor. Within the new dark and back baseline/candidate pairs, setup also differs only in that descriptor. The dark arm intentionally uses the original material and Studio lighting; the back arm intentionally changes camera. Selected candidate vertices and centres are exactly identical across its three color/view runs. Those repeat the same physics; they are additional appearance observations, not independent motion coverage.

The whole-groom velocity hash changes with card281, as expected; I do not claim every recorded hash is identical. The browser helper SHA is unchanged from the prior guide run: `7c5acaae73510517e94b25c6385e6b4f626d97f8a65baebbdff85a48e971031d`. Source hashes are scoped to the recorded files, not a full dependency closure.

## Contact prediction: supported at sampled poses

| Geometry | Selected triangle/body pairs across the sequence | Minimum selected vertex clearance | Frame255 result |
| --- | ---: | ---: | --- |
| Accepted source | 26 | −5.087829mm | Contact present |
| Frozen first guide | 13 | −3.864073mm | Contact present |
| Measured distal release | 0 | +2.389214mm | No selected contact |

Sources: [first guide audit](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/numerical-checks.json), [accepted source dark audit](../../../../captures/nape-distal-v1/baseline-motion-dark/numerical-checks.json), and [released brown audit](../../../../captures/nape-distal-v1/motion-brown/numerical-checks.json). The new dark and back audits reproduce the same source/candidate numbers.

The actual prior mismatch was narrow and reproducible: at frame 255, time 4.25s, upward head tilt 15°, guide vertices26/31/33 lay inside the body by approximately 0.823/0.720/3.864mm. Their measured outward directions agree near `[0,+0.50,−0.866]` in authored coordinates. The new recipe addresses that specific distal envelope. Its minimum clearance remains at this same sampled pose. The observed margin is **2.389mm**, not the recipe's simple static arithmetic margin of `7−3.864mm`.

There is no witness here supporting another displacement, width, or root-angle pass. Freeze the successful probe while changing the qualification conditions.

## Actual image review

I directly inspected these original PNGs, not generated reconstructions:

- Released brown rear-oblique: frames 0, 75, 120, 210, 255, 345, 390, 555.
- Frozen guide brown rear-oblique: frames 75, 120, 210, 255, 345, 390.
- Accepted source and release, original-dark rear-oblique: frames 0, 210, 255 in each arm.
- Accepted source and release, neutral-brown back: frames 0, 210, 255 in each arm.

I did not review every stored frame or play the complete sequence at its intended speed. These observations therefore do not exclude a temporal pop between the inspected frames.

### Hook removal persists; a new visible defect was not established

In the [original-dark source at frame 0](../../../../captures/nape-distal-v1/baseline-motion-dark/frames/0000.png), the broad lateral hook extends through approximately x545–620, y535–608 in the 900×868 canvas. The [released frame0](../../../../captures/nape-distal-v1/motion-dark/frames/0000.png) removes that protrusion while retaining the surrounding outline. The same distinction is clear at downward tilt in [source frame210](../../../../captures/nape-distal-v1/baseline-motion-dark/frames/0210.png) versus [released frame210](../../../../captures/nape-distal-v1/motion-dark/frames/0210.png), around x565–645, y485–550.

The rear view is useful additional evidence. At upward tilt, the [source frame255](../../../../captures/nape-distal-v1/baseline-motion-back/frames/0255.png) has a low, broad right-side projection toward the shoulder, around x585–665, y565–656. In the [released frame255](../../../../captures/nape-distal-v1/motion-back/frames/0255.png), that projection is absent; I do not see a replacement outward ledge. The back comparisons include the shortened first-guide path as well as its distal release, so they must not be attributed to the 7mm release alone.

For the effect of that last release specifically, I compared the prior guide and new brown images at both yaw extrema and both roll extrema. For example, [guide frame390](../../../../captures/nape-motion-v2/candidate-rear-oblique-brown/frames/0390.png) and [release frame390](../../../../captures/nape-distal-v1/motion-brown/frames/0390.png) preserve essentially the same visible lower outline. The small separate shape near x558–580, y550–583 exists in both; it is not evidence of a new release defect. No new visible failure justifies changing the recipe.

### Root transition remains partly hidden

Released frame 210 still records a large root-to-ring1 width-axis angle, with a sequence maximum of 64.584°, and maximum root-edge displacement from rigid rest of 5.340mm. Those are close to the first guide's 64.564°/5.326mm. The earlier critique established why an edge departure can represent permitted runtime ribbon rotation rather than root detachment: the root midpoint and width magnitude remained essentially fixed, and `HairDynamics.js` reconstructs ribbon offsets from current versus rest tangents.

The [brown released frame210](../../../../captures/nape-distal-v1/motion-brown/frames/0210.png) does not expose a new root crease. The projected root lies beneath the overlapping rear patch, approximately x502–525, y402–452 in this view. Absence of a visible crease there is not direct inspection of every hidden part of the card. Do not optimize the angle statistic as if it were an established appearance defect.

If later promotion requires direct root visibility, two concrete alternatives are available:

1. **One card281 identity pass at frame 210, with the same geometry, production alpha, depth, and occluders retained.** This can establish which pixels are actually visible; if the root stays hidden, record that rather than removing the occluders and calling the result a beauty view. Cost: another diagnostic render and a changed material that cannot itself qualify appearance.
2. **Keep the visibility limitation and assess the intact groom from the opposite rear side during the next ordinary-motion run.** This better represents what a viewer sees and may expose the transition. Cost: the root may remain hidden, leaving no direct visual root qualification. This is sufficient to continue qualification without inventing a crease failure.

## Remaining qualification gap and two alternatives

**Actual mismatch:** the completed protocol is deliberately head-only, whereas the normal product combines head, torso, and shoulder motion. In [the captured browser helper](../../../../captures/nape-distal-v1/motion-brown/source/tools/critic/bob-nape-motion-browser.mjs), lines 31–44 disable every existing layer and add one `head`-only layer with isolated yaw/pitch/roll keys. The report explicitly lists `breath`, `sway`, `idle`, and `bodyIdle` among the disabled layers. `BodyIdle.js` lines 12–16 owns the clavicles and trunk; `IdleMotion.js` lines 85–92 defines head drift. Those ordinary combined motions have not been exercised by this packet. Geometry is read only every 15 frames, at 4Hz; this also leaves unsampled contact intervals.

Two concrete choices, with the recipe held fixed:

1. **Recommended next qualification: one matched ordinary procedural-motion pair.** Keep the same g050/bob02, garment, seed, initialization, owned renderer clock, and frozen asset hashes, but retain the normal layer stack instead of installing the head-only driver. Use a bounded 12s interval as an initial observation window, record the enabled layers and effective seed, and use an opposite-rear view that includes the whole hair outline, neck, and shoulders. Twelve seconds is a pragmatic sample, not an acceptance threshold or guarantee that a rare shoulder event occurs. Read selected card/body geometry at every rendered 60Hz frame for this short pair if practical; otherwise state the remaining sample interval explicitly. Compare source and release under the same body/rig/collider trajectory. Review the sequence at speed as well as the closest-clearance frames. This directly adds ordinary compound motion and temporal appearance evidence without more geometry tuning. It still leaves other figures, cuts, garments, wind, larger gestures, full frontal/profile visibility, and all-motion acceptance open.
2. **Hold both experimental candidates while inspecting the restored authoring stages.** Preserve this successful contact result, the accepted asset, and every failed control; determine where the broader rear zigzags enter the authoring flow before doing more geometry work. This avoids qualifying an isolated correction that may later be replaced by a more coherent groom. The tradeoff is that the already demonstrated hook repair remains unavailable as a product asset and ordinary-motion uncertainty remains unresolved. Restoration of a Blender runtime is a prerequisite for a real stage trace, not itself evidence of the cause.

Before any default promotion, the reviewer should also inspect the already stored sequence continuously and close the ordinary-motion and remaining-view gaps appropriate to that promotion. A zero count for one card at 38 poses is insufficient on its own. No additional recipe pass is justified without a new, localized mismatch.

## Scope retained

The rear still contains prominent angular crossings and a low central tongue. For example, [released back frame0](../../../../captures/nape-distal-v1/motion-back/frames/0000.png), approximately x375–530, y330–600, remains far from the clean continuous flow of the medium-bob references. That is the previously documented layer/authoring problem, not a regression caused by this distal release. The next source-stage investigation should use the existing attribution evidence; it should not reopen the rejected five-card endpoint/frame loops without a new witness.

Two seconds at the end of the head-only sequence remain a **return/recovery observation**, not a settled-state or all-motion gate. The reported final tip lag is very small, but neither that statistic nor unchanged nonselected geometry establishes whole-groom appearance quality.

This critique used read-only source/report inspection and direct image viewing. No native browser/GPU job or asset modification was performed by the critic.
