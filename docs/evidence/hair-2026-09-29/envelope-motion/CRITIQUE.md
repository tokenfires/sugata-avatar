# Independent critique — ordinary motion of posterior envelope v3

## Disposition at this review

**The inspected images preserve the posterior styling improvement through the sampled ordinary poses. The completed ordinary audit found zero selected-card/body triangle pairs at all 721 captured updates, with minimum signed vertex clearance 2.331416mm. Keep the exact candidate frozen as a bounded experimental checkpoint; this is a scoped ordinary-motion result, not an all-motion or promotion recommendation. The separate completed head result is linked below.**

Candidate SHA-256: `d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`.

I directly inspected twelve baseline/candidate frame pairs: 0, 30, 60, 120, 180, 240, 360, 480, 600 and 720 in temporal order, then neighboring frames 357 and 363 to examine the outer edge around frame 360. This is a review of actual discrete PNGs. I did not watch continuous playback, inspect every captured image, or infer naturalness, flicker freedom or all-time continuity from these selected stills.

The candidate remains substantially cleaner than the accepted control in these frames. Its broad posterior field maintains downward flow and a relatively coherent nape edge as the head turns. I found no obvious new buckle, large opening in the changed posterior field, or conspicuous diagonal attributable to restored card 47 in this sample. The relatively blunt hem and existing crown/forward-side irregularities remain unfinished aspects of the medium-bob target.

The [static critique](../posterior-envelope/CRITIQUE.md) carries the preceding five-view, dark-material, rest-clearance and exact-fallback evidence. This review extends its appearance observation to selected poses and completes the selected-card/body audit for one ordinary procedural sequence; it does not replace the separate head-motion or broader qualification.

## Completed capture and ordinary audits

Both [baseline report](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/report.json) and [candidate report](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/report.json) have `status: captured`, 721 geometry readbacks, 241 PNGs and empty recorded error arrays. The run covers 12 seconds at 60Hz; images are every third update, or 20fps. It uses the ordinary production layers, seed `20260807`, rear-left camera, diagnostic brown material and neutralized lighting.

The recorded [paired controls](../../../../captures/envelope-motion-v1/paired-controls.json) match seed, layers, configuration, camera, projection, canvas, light/material settings, backend, parameters and setup clock. At all 721 updates, recorded time, clock, head matrix, step count, body hash and rig hash match. The fitted skull radius changes from 0.07630462888263419m to 0.0773292385331m, approximately +1.024610mm. Shoulder capsule values remain the same. This shared-runtime consequence is recorded rather than silently forced equal.

Both ordinary audits are now complete. I read the final reports and their per-frame minimum witnesses:

| Audit | Captured updates | Triangle/body pairs | Minimum signed vertex clearance |
| --- | --- | --- | --- |
| [Accepted baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/numerical-checks.json) | 721/721 have crossing pairs | 123,429 total; maximum 229 in one update | −9.884827mm at frame 720, card 55, ring 16, right edge |
| [Candidate v3](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/numerical-checks.json) | All 721 audited; zero crossing updates | Zero total and maximum | +2.331416mm at frame 355, card 2, root ring, right edge |

These final results supersede the earlier unequal progress prefixes. They establish the candidate's selected-card/body clearance at the recorded updates under this protocol. The positive value is the minimum over sampled vertices, not a lower bound on the distance of every triangle interior. Alpha and rendered occlusion are not part of the contact counts, so the baseline's numerical contacts are not automatically proven visible clipping.

The audit is over the 266 selected cards (8,512 triangles per update) and the full posed/morphed body. It excludes garments, hair-to-hair contact and time between 60Hz updates. Root completed both CPU jobs; the critic did not duplicate or interrupt them. The separate head-motion audits have since completed and are incorporated in their own critique.

## Actual frame review

All coordinates below refer to the 900×868 original PNGs. The changing head orientation means a screen region is approximate and should be read with its specified frame.

| Frame / time | Actual comparison | Observation |
| --- | --- | --- |
| 0 / 0s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0000.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0000.png) | Candidate's broad field around x390–700/y210–565 is directional and continuous. The control has a bulging angular rear field and an uneven lower tongue around x520–635/y550–630. |
| 30 / 0.5s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0030.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0030.png) | With the head turned closer to a back view, the control exposes a large crossed field around x390–575/y240–535. The candidate retains downward strands there and has no equivalent low centre tongue. |
| 60 / 1s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0060.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0060.png) | The same relative gain remains. The candidate hem is blunt but coherent around y575–600; no new conspicuous fold appears in the central posterior field. |
| 120 / 2s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0120.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0120.png) | The candidate keeps the smoother field and short nape edge. The control retains the central descending tab and lateral lower irregularity. |
| 180 / 3s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0180.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0180.png) | At a different turn, the candidate's posterior coverage remains joined and directional. A separation near the face-framing section on screen-right is present in both arms; this pair does not establish a new candidate-only opening. The outer edges look softer/noisier than the earlier stills. |
| 240 / 4s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0240.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0240.png) | More of the forward side is exposed. The candidate's reshaped rear field remains smooth, while the known crossed side feature around x660–780/y310–465 persists. It is not evidence that the protected side is finished. |
| 360 / 6s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0360.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0360.png) | The posterior flow gain remains, but both arms show a speckled/soft boundary, especially along screen-left x355–420/y210–535. Do not equate the soft boundary with a geometric hole or a proven new groom failure. |
| 480 / 8s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0480.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0480.png) | Candidate posterior strands remain continuous; the control retains the rear bulge and long irregular nape section. The forward-side fragment cluster remains visible in both versions. |
| 600 / 10s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0600.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0600.png) | Cleaner posterior field and hem are retained. No new local diagonal associated with the fallback is apparent in this image. |
| 720 / 12s | [Baseline](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0720.png), [candidate](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0720.png) | The final sampled pose again exposes the control's central angular patch and lower tab; the candidate retains the coherent field. This is an ordinary-motion endpoint, not a settled or return-to-rest gate. |

The neighboring [candidate frame 357](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0357.png), frame 360 and [frame 363](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0363.png) all retain the cleaner central field. Their boundaries remain soft/speckled. The matched [baseline 357](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0357.png) and [363](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0363.png) show comparable boundary noise. I have not isolated the rendering cause, and this small neighborhood is not proof of temporal smoothness during playback.

## Finding 1 — positive pose evidence still leaves the qualification decision open

**Actual example and mismatch:** candidate frames 30 and 720 maintain a continuous rear field where the baseline exposes angular crossings and the low tab. The final audit adds zero selected triangle/body pairs at all 721 ordinary updates, including the smallest vertex clearance at frame 355. Those are positive appearance and sampled geometry results. The inspected PNGs remain sparse, and the audit excludes garments and time between updates; natural motion throughout the sequence and broad groom acceptance are not established by these results alone.

Two concrete alternatives:

1. **Recommended: retain frozen v3 as the bounded posterior checkpoint and combine the completed ordinary/head evidence for the next scoped decision.** The separate head protocol covers motions underrepresented by the ordinary seed. Tradeoff: this preserves attribution while broader acceptance remains deferred. A zero audit alone does not establish visual quality, and any new side candidate must receive its own qualification.
2. **Alternative: hold v3 as a static-plus-sampled-pose candidate and stop qualification at this boundary.** Preserve these images and reports while retaining the accepted asset as default. Tradeoff: the visual advance remains recoverable, but the larger candidate is still not ready to replace the accepted groom. This is appropriate if further qualification cannot be completed reliably; it should not be presented as the finished medium bob.

Root captured a separate matched head-only sequence using the previously reviewed nape keys, with 555 updates and nonselected coordinates retained. Its rear/front image, source review and completed body audits are recorded in the [head-motion critique](../envelope-head/CRITIQUE.md): the candidate has zero selected triangle/body pairs at all 556 updates and minimum sampled vertex clearance +1.780458mm. It is independently measured complementary evidence on the same frozen asset.

There is no visible failure in the inspected changed posterior field that currently justifies another endpoint, frame, width or hem adjustment. The remaining blunt-hem/reference mismatch was already documented in the static critique and should not be mixed into this motion result.

## Finding 2 — nonselected live geometry is not shown to be isolated

**Actual source/data example:** [paired-controls.json](../../../../captures/envelope-motion-v1/paired-controls.json) records differing nonselected-vertex hashes at all 721 updates and a larger fitted skull radius. In the [archived browser helper](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/source/tools/critic/bob-envelope-motion-browser.mjs), lines 68 and 73, nonselected coordinates are reduced to a hash and then discarded. Their difference cannot be measured from these files.

`HairDynamics.js:1129–1138` derives the shared skull fit using roots and all rest centres; lines 1164–1175 similarly bound the capsule. The asset can therefore alter live behavior outside its edited cards. The prior static comparison already demonstrated that two nonselected components can differ by only 0.0000149012mm, so a hash difference is not evidence of a visibly large displacement. Conversely, that microscopic static case does not establish the magnitude of this moving difference.

Two concrete alternatives:

1. **Recommended for the current record: qualify only what was retained.** Report the selected-card/body measurements and observed intact appearance, retain the changed collider as part of the candidate's runtime behavior, and state that nonselected displacement magnitude is unmeasured. Tradeoff: no duplicate capture is required, but exact runtime front isolation cannot be claimed.
2. **Alternative if a visible boundary/front concern appears: one matched exact-seed replay retaining nonselected coordinates.** Preserve the current batch, then compare per-card displacement magnitudes and locate any visible witness. Tradeoff: this costs another capture but answers a concrete question the hashes cannot. Do not replay merely to turn a meaningful but microscopic difference into an exact-equality claim, and do not silently force shared colliders to the baseline values.

## Finding 3 — the shared noisy outer boundary limits temporal interpretation

**Actual image example:** frames 357/360/363 in both arms show a speckled or soft outline at the left hair boundary, even though the candidate's interior guide flow is visibly improved. These pixels do not establish a candidate-specific root/frame defect. The source uses the production renderer and temporal system, but this review has not separated those contributions from geometry, coverage or opacity.

Two concrete alternatives:

1. **Recommended: preserve the geometry and inspect the existing paired playback as rendering evidence.** Compare the same frame interval in both arms, retain the shared limitation and keep geometric contact judgments separate. Tradeoff: this can judge whether the noise is perceptually objectionable without another asset pass, but it does not identify the rendering mechanism.
2. **Alternative if the playback warrants investigation: a separate frozen-geometry rendering diagnostic.** Reproduce an actual noisy pose with the same asset and compare the relevant temporal/coverage behavior under a declared instrument change. Tradeoff: this could identify a rendering contribution, but it is separate work and must not be conflated with a hair-guide improvement or used to reopen arbitrary geometry tuning. There is no recommendation to change the production renderer during this qualification.

## Instrument review

I read the capture driver, browser helper and CPU audit. No material coordinate, packing, selected-triangle or card-ID error was found in the completed baseline data or reviewed source.

- The renderer's ambient loop is stopped; node and temporal epochs are reset. Each manual step advances the node frame and pins time/delta to the avatar clock. This follows the existing `alive.takeOverFrameLoop` pattern.
- The ordinary layers remain enabled. Seed and layer state are recorded. Baseline contains each frame index 0–720 once, and body/rig hashes change across the sequence.
- GPU vertices are explicitly returned in world space and are not head-transformed a second time. The selected stream contains 266 sorted, unique card IDs, 32 triangles each, and no triangles crossing card blocks.
- The posed body has 14,517 vertices and 26,756 triangles, using the wardrobe's full body index stream. Positions come from `getVertexPosition` plus the world matrix. The current Three implementation explicitly supports `Vector4` with `w=0` in `applyBoneTransform`, so the helper's direction-vector normal path is valid for that API.
- The audit checks sample-file hashes, uses posed body coordinates with world hair coordinates, and maps selected connected-component IDs back to original cards. Its signed vertex checks supplement the exact triangle-shell audit.
- Only page errors and HTTP responses of 400 or greater are collected by this harness. Empty `errors` does not claim a separately monitored console-error guarantee.
- Garments, hair-to-hair intersections, motion between updates and full visual continuity remain outside the numerical audit.

## Additional continuity diagnostic — root-edge rotations

The completed [candidate continuity diagnostic](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/continuity.json) identifies the largest selected vertex displacement after removal of each frame's head transform: 8.179434mm at card 40's left root edge, frame 353→354. The [baseline diagnostic](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/continuity.json) has a larger maximum of 22.918129mm, but at a different location, card 264's tip at frame 44→45. These maxima locate intervals for review; their ratio is not a visual-quality or dynamic-stability score.

The [archived diagnostic source](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/audit-envelope-continuity.mjs), lines 20–47, reads the actual world-space GPU vertices, removes the recorded head transform, compares successive coordinates, and measures root midpoints against the authored rest midpoints. It reports the candidate's maximum root-midpoint departure as 0.000168035mm over the sequence. It does not mistake an edge rotation for root translation.

I independently compared the two root-edge pairs from the retained 60Hz samples, using inverse `headMatrix` and the descriptor's selected-card ordering:

| Witness | Left/right edge step | Root-midpoint step | Width before → after | Width-axis turn |
| --- | --- | --- | --- | --- |
| Card 40, frame 353→354 | 8.179434 / 8.179219mm | 0.000128850mm | 48.477832 → 48.477845mm | 19.427160° |
| Card 34, frame 625→626 | 6.163177 / 6.163149mm | 0.000014598mm | 56.153264 → 56.153240mm | 12.602514° |

The width magnitudes remain effectively fixed while their axes rotate around anchored midpoints. These witnesses do **not** establish root detachment.

### Actual image check and limits

I directly inspected candidate [351](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0351.png), [354](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0354.png), and 357. The saved [card 40 projection witness](../../../../captures/envelope-motion-v1/root40-witness.json) places the affected root/ring-1 region roughly at x405–430/y420–450 near the largest event. The intact PNGs do not show an attributable new opening, crease or strand interruption there. Projection alone does not prove that the card is occluded, and its individual final-shader visibility remains unestablished.

I also directly inspected candidate [624](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0624.png), [627](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0627.png), and [630](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0630.png). Projecting actual card 34 root/ring-1 coordinates through the recorded setup view/projection matrices places them around x378–430/y371–406 at frames 624–628. Again, the intact images retain the continuous posterior field without a newly attributable local break. The exact second root event is 625→626; frame 628's separate large-step witness concerns card 347's tip, not card 34's root.

The image stream is 20fps while geometry is 60Hz. Frame 354 is available, but frame 353 is not; frames 625 and 626 are both between captured PNGs. Therefore these intact-image checks cannot exclude a one-update visible event at the missing image times. They also do not prove the event would be perceptible in continuous playback.

### Two alternatives and decision

1. **Recommended: preserve the groom and retain the completed bounded qualification.** Record these exact anchored width-frame rotations as diagnostic witnesses while retaining the positive intact-image result. Tradeoff: one-update visibility at the omitted image times remains unknown, but no guide/frame tweak is justified by an actual visible defect in the inspected material. The previously rejected frame-tuning loop should not be resumed to reduce a statistic alone.
2. **Alternative if this visibility question becomes consequential: one frozen, attributable witness capture.** Reproduce the exact ordinary seed and narrow intervals around 353→354 and 625→626, retain every update as an image, and use a separate card-identity view if needed to establish whether the affected surface contributes to the intact render. Tradeoff: this requires a new diagnostic capture and identity rendering changes appearance, so it must accompany the intact control rather than replace it. It should answer visibility, without changing guide geometry or claiming that the anchored rotation itself is a defect.

**Decision:** no newly observed defect from these root-edge diagnostics warrants a geometry follow-up now. The final ordinary selected-card/body audit is clear at all captured updates, including the intervals containing these root-edge events. That does not prove their visibility at omitted PNG times or change the no-promotion disposition. The separate head-only qualification adds independent visibility and nonselected-motion evidence and retains its own audit boundary.

## Remaining qualification boundary

Both ordinary audits are incorporated above, and the separate head-motion disposition incorporates its own final results. Do not backfill an all-motion or whole-groom acceptance from these selected-card results, and do not convert the discrete-image review into a claim of having watched the complete animation. Any altered candidate starts a new qualification boundary.

Only this assigned critique file was written. The critic ran no browser, Blender, GPU capture or duplicate CPU audit.
