# Independent critique — lower fallback in dark Studio head motion

## Disposition

**The frozen lower fallback retains its modest inward lower contour in the inspected dark Studio poses.** I found no newly obvious gap, sharp joining line or square secondary hem in the nine actual matched pairs. Retain this as additional appearance evidence for the existing lead; it does not justify another shape adjustment or a finished-groom/default-ready claim.

I directly inspected baseline/candidate frames **0, 90, 150, 210, 255, 315, 360, 435 and 555**, in that order: 18 original PNGs. This is a sparse temporal review, not continuous playback or inspection of every captured frame. No capture, replay audit or body oracle was launched by the critic.

The completed replay evidence carries forward the previous **338-card** head-sequence body result. The separately running audit of the other **158 front cards** remains outside this disposition. Do not convert the selected-card result into a claim about all 496 cards.

## Assets, controls and replay provenance

- Baseline: side-v3, SHA-256 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.
- Candidate: exact lower fallback, SHA-256 `8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7`.
- Both [baseline capture](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/report.json) and [candidate capture](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/report.json) are complete, with 556 physical samples, 186 PNGs and empty recorded errors. Both owner disposals report `disposed: true`, `leaked: []`. Recorded errors cover the harness's collection; this is not an uncollected console-error guarantee.
- The [paired control audit](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/paired-controls.json) is complete. Setup, selected/body/other-card ordering, body positions/normals, rig, head command/matrix, time, clock, step count and capsules match. Skull radius and centre match exactly. The lower geometry differs intentionally.
- Other hair is dynamically affected: 555 samples have differing other-card hashes; maximum difference is 6.635650713 mm at frame 373, fringe card 494/ring 16/side 1. This repeats the previous measured consequence. The rear view does not newly qualify its frontal appearance.

The [baseline physical replay](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-physical-replay.json) matches all 556 samples from the previously audited side-v3 head run. The [candidate physical replay](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-physical-replay.json) matches all 556 samples from the previously audited lower-fallback head run. Camera, hair colour and light chromaticity intentionally differ from those brown profile captures; the physical samples are exact per arm.

I read [audit-dark-motion-replay.mjs](/Users/robault/GitHub/sugata-avatar/tools/critic/audit-dark-motion-replay.mjs:15). It requires a completed linked audit with matching report/selection, verifies saved capture and audit sources, hashes and decompresses every raw physical sample, and deep-compares the complete raw objects before emitting reuse provenance. It also checks PNG pins. This supports reuse for the same sampled geometry, without claiming pixel equality or a fresh body oracle in this rendering condition.

Independently verified both asset/report/prior-audit hashes, the replay-source snapshot, 44 recorded capture/input snapshots and three audit-source snapshots per arm, all 18 inspected PNG hashes, and the paired-audit source hash. I did not rerun the full replay comparison or body oracle.

### Body result that can be carried forward

| Arm | Previously audited head samples | Selected triangle/body pairs | Minimum signed selected-vertex clearance |
| --- | --- | --- | --- |
| Side-v3 baseline | 556 | 0 | 1.379665113 mm |
| Lower fallback candidate | 556 | 0 | 0.078130750 mm |

Both linked audits have zero negative selected-vertex samples. Candidate minimum is the previously retained frame-255/card-123/ring-16/side-1 witness. That small positive value is not a robust clearance margin. Frame 255 is the commanded upward 15° pose; the image alone neither proves a contact nor clears garments. The independent triangle result covers the selected 338 cards against the posed body at sampled update times.

## Actual image witnesses

Approximate regions refer to the original 900×868 images. Baseline links precede candidate links.

| Frames | Observation |
| --- | --- |
| [0 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0000.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0000.png) | The lower band around x250–610/y485–590 turns inward more in the candidate. The rear crossed strands around x415–535/y465–555 and rough tips remain visible. There is no new obvious open slot in the inspected hem. |
| [90 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0090.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0090.png) | During the yaw transition, both outer boundaries are soft, especially the bright blue right edge. The changed lower arc persists around x270–590/y510–595; softness limits a finer continuity judgment. |
| [150 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0150.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0150.png) | The opposite yaw transition retains the inward lower ends around x280–605/y510–590. The blue rim and existing diagonal rear strands are present in both. No newly obvious gap appears in the sampled pair. |
| [210 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0210.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0210.png) | At the downward 20° pose, the rear corner around x520–615/y475–570 retains the terminal turn. The lower contour remains continuous at this scale; no sharp new transition or square inner ledge is apparent. |
| [255 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0255.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0255.png) | At the upward 15° pose, the lower arc around x300–575/y555–635 stays more inward in the candidate. Rough individual ends remain; no new obvious neck opening or secondary hem is introduced. The nearby collar/neck projection does not establish garment or hidden-body clearance. |
| [315 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0315.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0315.png) | The roll transition shows the same modest terminal difference, chiefly x265–600/y500–585. No additional sharp line appears in this pair. |
| [360 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0360.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0360.png) | The candidate's lower band curls inward while the central rear crossed patch around x420–530/y440–560 remains. The patch is already present in control; its visibility here does not establish a new fallback defect. |
| [435 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0435.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0435.png) | At the start of the final neutral recovery interval, the useful inward lower contour remains. The upper/crown irregularity persists in both. |
| [555 baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/baseline-rear-oblique-dark/frames/0555.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-dark-head-v1/candidate-rear-oblique-dark/frames/0555.png) | End-of-recovery appearance agrees with the initial qualitative difference: modest inward ends, without an obvious new hem gap. Two seconds of recovery is not a general settled-state or all-motion gate. |

These dark images support the usefulness of the earlier neutral material diagnostic: the lower shape difference survives under the original dark material, but strong blue illumination and dark overlapping strands make fine rear structure harder to separate. There is no basis here for another colour/light calibration or for calling greater brightness a geometry improvement.

## Actionable scope and two alternatives

**Finding:** this rear rendering supplies useful appearance confirmation, while leaving whole-groom and temporal visibility limits. The concrete examples are the soft frame-90 boundary, the rough/crossed patch still present in frame 360, the previously observed frontal card-494 motion consequence, and the report's explicit 338-card selection. None proves a newly introduced fallback defect that needs a geometry tweak.

### A — recommended: freeze this confirmation and finish the existing front-card audit

Keep the exact lower-fallback bytes and these image witnesses. Combine this bounded dark appearance result with the existing neutral/profile/front review, then read the already-running 158-card head/ordinary audits when complete. If those produce contacts, distinguish inherited baseline contacts from new candidate contacts and inspect their actual projected/image witnesses before choosing a repair. Do not regenerate the shape while that evidence is pending.

**Tradeoff:** this uses the existing captures and preserves attribution, while preventing a selected-card pass from being presented as a whole-groom pass. It deliberately leaves the rough ends, known tiny front-frame exception and unsampled visual intervals unresolved. No new body job or native capture is requested by this critique.

### B — alternative: deepen temporal review using the existing saved sequence

Keep the geometry frozen and review the full existing 186-frame dark image sequence alongside the corresponding baseline, using the saved player or a denser ordered selection around any specific observed transition. A newly suspected interruption should first be checked in its actual neighbouring saved frames, then compared with the neutral evidence. This could discriminate an isolated soft frame from a repeated visible temporal defect before a broader appearance claim.

**Tradeoff:** this adds perceptual evidence without a new parameter or capture matrix. It still cannot establish continuous-time collision safety, unseen frontal behaviour or the other 158 cards' body result. It costs review time and is not justified as a prerequisite for retaining the current modest, explicitly scoped lead. Prefer it before claiming smooth playback, or if a concrete temporal witness emerges.

**Selection:** A. Preserve the narrower positive appearance result and the outstanding front-card boundary. The nine pairs do not support another lower-curve, hem, lighting or material adjustment.

## Limits and outstanding evidence

- Separate 158-front-card body audits under `captures/lower-fallback-front-audit-v1` are pending at this review. Their results are not inferred from clear prefixes, other-camera appearance, unchanged authored front records or the 338-card report.
- No all-496-card, garment, hair-hair, continuous-time or universal-motion clearance is claimed.
- The 6.63565 mm other-card displacement is a geometric consequence, not proof of a visible defect in this rear view. The earlier exact frontal replay and tiny frame-373 dash remain separate evidence; dark rear confirmation does not resolve that exception.
- Sparse still images cannot establish flicker-free playback. Neither the blue highlights nor the lack of an obvious hole proves hidden coverage or alpha ownership.
- Both failed front prototypes remain rejected and separate from this frozen lower-fallback asset. This confirmation does not revive those constructions or modify the visual brief.
