# Independent critique — motion of the side-envelope candidate

## Current disposition

**The cleaner side flow survives eleven inspected matched head poses and ten matched ordinary poses spanning twelve seconds. No new obvious side opening, broad crease, ear dome or reintroduced long diagonal appears in these samples. Both capture pairs and their physical-control comparisons are complete. The completed head audit finds zero selected triangle/body intersections in all 556 candidate states; the control has card-68 intersections in every state. Both ordinary body audits remain pending. Keep the exact candidate frozen: this is a bounded head-protocol result and positive discrete-image evidence, not all-motion acceptance or a promotion recommendation.**

- Baseline is **frozen posterior v3**, SHA `d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`.
- Candidate is **side v3**, SHA `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.

This comparison measures the side extension beyond the posterior lead. It is not a new direct comparison against the original production groom. The committed [side static critique](../side-envelope/CRITIQUE.md) retains the attribution, fit failure, exact-original-card-182 fallback and original-dark confirmation. It is unchanged by this review.

## Completed head captures and controls

The [baseline report](../../../../captures/side-head-v1/baseline-right-profile-brown/report.json) and [candidate report](../../../../captures/side-head-v1/candidate-right-profile-brown/report.json) are both `captured`, with 556 geometry states, 186 PNGs and empty recorded errors. They use the right-profile camera, diagnostic brown material and neutralized light chromaticity.

There are 555 advancing updates plus frame zero, covering 9.25 seconds at 60Hz. PNGs are every third update, or 20fps. Ordinary layers are disabled, and the previously reviewed head protocol commands yaw ±30°, pitch +20°/−15° and roll ±15°, separated by neutral returns. The final two seconds are recovery, not an established settling gate.

The completed [paired raw-state comparison](../../../../captures/side-head-v1/paired-controls.json) records:

- equal source hashes and all declared setup fields, including seed, layers, protocol, keys, configuration, camera/projection/canvas, material, lights, backend, runtime parameters and initial clock;
- exact selected-card/triangle streams, full body index stream and nonselected-card ordering;
- all 556 recorded time, clock, head matrix, commanded angles, steps, body positions/normals, rig and capsule states equal;
- fitted skull radius larger by **0.920332869869mm** in the side candidate, with maximum skull-centre difference approximately **1.10×10⁻⁸mm**;
- retained nonselected coordinates at all 556 samples, with maximum displacement **0.216609592mm**, frame 373, fringe card 494, ring 16, side 0. Nonselected hashes differ at 555 updates.

The increased fitted skull radius is recorded as an asset-dependent consequence. It must not be silently forced equal to the baseline, and authored isolation must not be reported as live isolation. This comparison's nonselected maximum uses a different baseline from the earlier original-versus-posterior result; comparing those two maxima is not a visual-quality score.

## Actual image review

I directly inspected these eleven matched pairs in temporal order. All coordinates refer to the original 900×868 PNGs and are approximate. This is not continuous playback perception, inspection of all 186 images, or proof of absence of one-update events between PNGs.

| Frame / pose | Baseline | Candidate | Observation |
| --- | --- | --- | --- |
| 0, initial neutral | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0000.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0000.png) | The long crossing around x190–340/y350–460 is absent in the candidate. The surrounding side field falls coherently toward the hem. Forward/crown fragments remain. |
| 75, yaw +30° | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0075.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0075.png) | The rotated view exposes more face. The side crossing around x320–440/y340–435 remains absent; the face stays open. The lower side contour is more joined near x430–475/y555–600 than the control's larger separation. |
| 120, yaw −30° | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0120.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0120.png) | The view exposes more posterior surface. The candidate retains directional flow at the side/posterior boundary where the control shows the diagonal stack. Both have soft/noisy outer edges during this pose. |
| 165, neutral after yaw | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0165.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0165.png) | Cleaner side flow remains after reversal. No new broad opening or crease is apparent in the changed field. |
| 210, pitch +20° downward | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0210.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0210.png) | The side field follows the downward tilt while the crossing remains absent around x180–325/y330–475. The lower edge slopes with the head. No newly obvious ear dome or detached strip appears. |
| 255, pitch −15° upward | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0255.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0255.png) | The side gain persists with tips closer to the neck/collar region. No new obvious broad fold or surface clipping is established by this intact image; contact remains a separate audit question. |
| 300, neutral after pitch | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0300.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0300.png) | The candidate retains its continuous side field and absent slash after the pitch return. |
| 345, roll +15° | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0345.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0345.png) | More cheek/neck is exposed by the tilt. The candidate's side shafts remain joined, with the conspicuous control diagonal absent. Existing crown/fringe irregularities remain visible. |
| 390, roll −15° | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0390.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0390.png) | The opposite tilt retains the side improvement. The lower side band around x250–450/y580–645 looks more continuous than the control, without a newly obvious side opening. |
| 435, neutral after roll | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0435.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0435.png) | The cleaner side field remains after the last axis reversal. The blunt lower contour is still a styling limitation. |
| 555, end of recovery | [Image](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0555.png) | [Image](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0555.png) | The side gain remains at the final sampled state. Its similar appearance to frame zero does not prove exact physical recovery or settling. |

The smoother side field still contains some forward/crown fragments and an almost straight lower fall. Those are inherited unfinished aspects of this frozen candidate. This head-pose review does not alter the medium-bob brief to accept them, nor does it supply a reason to mix a new hem/volume intervention into the current qualification.

## Completed head body audit; ordinary audits pending

I independently read the final [head baseline audit](../../../../captures/side-head-v1/baseline-right-profile-brown/numerical-checks.json), completed at 07:48:58.402 UTC, and [head candidate audit](../../../../captures/side-head-v1/candidate-right-profile-brown/numerical-checks.json), completed at 07:56:23.145 UTC on September 30. Their selected union is **338 cards / 10,816 triangles**, compared with the full posed/morphed body at each of the 556 captured updates.

| Head protocol result | Frozen posterior-v3 control | Side-v3 candidate |
| --- | --- | --- |
| Audited states | 556 | 556 |
| States with triangle/body intersections | 556 | 0 |
| Total triangle/body pairs over the sequence | 29,713 | 0 |
| Maximum pairs in one state | 57 | 0 |
| Contact cards | 68 only | None |
| Minimum sampled signed vertex clearance | +1.712008033mm | +1.379665113mm |
| Negative sampled vertices | 0 | 0 |

The control's concrete frame-zero witness is selected hair triangle 1418 (selected component 44, original card 68) against body triangle 23485, with retained transverse intersection endpoints around `[0.04739, 1.54803, 0.05947]` metres. Positive vertex clearances do not exclude a triangle-interior crossing: this control has no negative sampled vertices yet intersects throughout the sequence. The candidate minimum is frame **391**, card **47**, ring **12**, side **0**; the control minimum is frame **351**, card **74**, ring **16**, side **1**. These minima come from different cards and are not an appearance-quality score.

The paired physical controls above make the head comparison useful, including its explicitly recorded shared-collider change. It supports sampled selected-body clearance for this candidate, protocol and figure. The two ordinary body audits are still pending at this checkpoint; no conclusion is drawn from their prefixes.

The audit excludes garments, hair-to-hair contact, the remaining nonselected cards and time between 60Hz updates. It does not sample final shader alpha/occlusion. A geometric contact, if found, must therefore be distinguished from proven visible clipping; an attractive image cannot negate an exact contact. Conversely, a zero selected-body result would not establish shirt clearance or all-motion acceptance.

The [candidate continuity report](../../../../captures/side-head-v1/candidate-right-profile-brown/continuity.json) is complete. It records a maximum head-local selected vertex step of **1.073408479mm**, card 296's right tip, frame 230→231, and maximum root-midpoint departure **0.000186550mm**, card 155 at frame 387. These are descriptive measurements, not perceptual jump thresholds. The midpoint result does not establish that ribbon-width frames remain fixed. No root-detachment claim is supported.

## Finding 1 — the positive pose images support finishing qualification

**Actual witness and remaining mismatch:** frames 75, 210, 255 and 390 retain coherent side coverage where the control retains the long crossing. Frames 435 and 555 retain that gain after returns. The head audit now resolves the control's card-68 contacts within its sampled scope. However, both ordinary body audits are unfinished and these are discrete views; the broader claim that the side candidate is clear and visually sound throughout motion is not established.

Two concrete alternatives:

1. **Recommended: retain the exact candidate while the two existing ordinary body audits finish.** Preserve the completed head result and combine the ordinary-left-profile images and controls below with their final audits and any exact contact witness before choosing another geometry step. Tradeoff: this preserves attribution and complementary side visibility, but the candidate remains unpromoted until the scoped result is known.
2. **Alternative: stop at the static-plus-head-pose experimental checkpoint.** Preserve this positive appearance evidence while retaining the qualified posterior lead. Tradeoff: no new investigation is needed, but a moving-clearance claim or product replacement would remain unsupported.

No inspected image justifies reversing the side representation or reopening a local card/frame/width loop. The planned lower-curve discussion is separate future work and should wait for the current qualification.

## Finding 2 — small nonselected displacement is a measured consequence, not a proved defect

**Actual data/source witness:** the paired comparison records the 0.216609592mm fringe-494 tip displacement at frame 373 and the larger fitted skull radius. `HairDynamics.js` fits the shared skull using the groom's roots/rest centres, so an authored side change can affect other live cards. The driver and helper retain `otherVertices`, avoiding the earlier ordinary run's hash-only limitation. The right-profile PNG sample does not establish the exact frontal visual contribution of this tip.

Two concrete alternatives:

1. **Recommended: record the measured consequence and retain the current geometry.** Do not describe runtime fringe as identical, but do not retune a collider or guide solely to eliminate this displacement. Retain the completed opposite-side ordinary review below and inspect any actual failure witness. Tradeoff: exact frontal appearance at frame 373 remains unqualified, while avoiding another capture without a demonstrated visual concern.
2. **Alternative if frontal impact becomes consequential: one exact front replay containing PNG 373 and neighboring frames.** Verify same-arm physical arrays against this completed head run before interpreting the front images as the same witness. Tradeoff: that would directly expose the affected region but costs another replay; a nonzero displacement alone is not a reason to change the asset.

The ordinary-left-profile camera also does not expose the left ear at every head-protocol extreme. If an audit finds a hidden left-side witness, the exact opposite view is preferable to inferring appearance from the right-profile image. Until then, no all-view claim is made.

## Finding 3 — body and visible outfit remain separate qualification scopes

**Actual witness:** at frame 255 the rear tips approach the neck/collar region near x440–505/y600–655. The shirt is visible, while the audit's retained `bodyPositions`/`bodyIndices` describe the body mesh. The intact pair does not prove a new garment intersection, and a later clear body audit could not prove garment clearance.

Two concrete alternatives:

1. **Recommended: retain the explicit garment limit and keep the shape unchanged.** Preserve frame 255 as the actual proximity witness while completing the selected-body audits. Tradeoff: garment clearance remains unqualified, but no unsupported hem adjustment is introduced.
2. **Alternative if garment qualification is required: retain actual posed garment triangles around the relevant extreme and neighboring updates.** Audit them in the same world coordinates as the hair and compare any witness with intact images. Tradeoff: this is a separate bounded measurement, not evidence for an outfit sweep or speculative tip shortening.

## Instrument and interpretation limits

- The reviewed driver routes explicitly pinned assets in both arms, reuses the previously reviewed head helper and owned clock, and retains all selected/body states at 60Hz. These completed reports record clean disposal and empty monitored errors.
- The monitored errors cover page exceptions and HTTP responses of 400 or greater; there is no separate console-error guarantee.
- The static 338-card rest result does not substitute for this posed-body audit. The posterior control's prior moving results do not qualify newly added side cards.
- Soft/noisy boundaries appear in both arms at rotated poses, particularly frame 120. Their mechanism has not been isolated; they are not automatically a new geometric gap or a candidate-specific instability.
- A root midpoint can remain anchored while width axes rotate. No dynamic stability, continuous-time clearance, perceptual smoothness or settled-state result is inferred from the continuity maxima.
- Only this assigned motion critique was written. The critic launched no native browser/GPU/Blender job and no duplicate body audit. The committed static critique remains unchanged.

## Required update

Replace the remaining ordinary body-audit disposition with the two actual final reports when complete. The head result above is final within its declared scope. The completed ordinary-left-profile capture review follows. Retain any contact or visible failure with its exact card/frame/triangle or image region and two concrete alternatives. Keep all-motion, garment and discrete-image boundaries explicit even if both candidate protocols are clear.

## Completed ordinary-left-profile capture review

The [ordinary baseline report](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/report.json) and [ordinary candidate report](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/report.json) are both `captured`: 721 geometry states and 241 PNGs over 12 seconds, empty monitored errors and disposal with `leaked: []`. Both retain nonselected coordinates. The baseline/candidate assets are the same frozen posterior-v3/side-v3 pair identified above.

The completed [ordinary paired comparison](../../../../captures/side-ordinary-v1/paired-controls.json) records equal source hashes, all declared setup fields and descriptor ordering. All 721 body positions/normals, rig, head, commands, times, clocks, step counts and capsules match. The fitted skull-radius increase is again **0.920332869869mm**. Maximum nonselected displacement is **0.080536642mm**, at frame 400, fringe card 494, ring 16, side 1. Nonselected hashes differ at 720 updates. These measured differences remain runtime consequences rather than proven visible defects.

I directly inspected the following ten matched pairs in temporal order. This spans the sequence but is not inspection of every frame or continuous playback.

| Frame / time | Baseline | Candidate | Observation |
| --- | --- | --- | --- |
| 0 / 0s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0000.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0000.png) | The conspicuous opposite-side zigzag around x550–700/y285–480 is absent. Downward curves cross that region. The pre-existing pale lower channel remains without a demonstrated new hole. |
| 30 / 0.5s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0030.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0030.png) | The turn exposes more rear surface. The candidate replaces the control's side cluster near x680–770/y300–480 with coherent flow. The long forward section remains separated at its lower edge in both versions. |
| 60 / 1s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0060.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0060.png) | The same relative gain persists; no broad new side opening is apparent. The candidate's lower transition has less exposed irregularity than the control around the former cluster. |
| 120 / 2s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0120.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0120.png) | The side/posterior field remains directional. Forward-section separation persists in both; it is not proof of a candidate-created gap. |
| 180 / 3s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0180.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0180.png) | The head turns back toward a side view. The central zigzag patch and descending tab are absent; a narrow pale lower channel remains. Both outer boundaries look soft/noisy. |
| 240 / 4s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0240.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0240.png) | More face is exposed. The candidate retains downward side flow at x470–615/y280–500. The narrow pale split near x500/y520–585 occupies an existing control boundary; no new ear dome or broad crease is apparent. |
| 360 / 6s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0360.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0360.png) | The candidate's interior remains cleaner while both versions have a pronounced speckled/soft silhouette, especially x350–420/y235–570. This does not identify the cause or prove a geometry hole. |
| 480 / 8s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0480.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0480.png) | The zigzag and low tab remain absent. No obvious restored-card-182 patch or new side/rear seam appears. The lower field remains relatively straight and blunt. |
| 600 / 10s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0600.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0600.png) | The candidate retains coherent flow at the former cluster around x520–665/y290–480. The lower pale split is comparable or narrower than the control's fragmented opening, rather than demonstrated new exposure. |
| 720 / 12s | [Image](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0720.png) | [Image](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0720.png) | The final sampled turn again retains the side gain. This ordinary endpoint is not a return-to-rest or settling condition. |

The broad side benefit is visible across both motion protocols. This does not finish the hairstyle: the crown/fringe, near-vertical lower fall, blunt hem and shared noisy rendering boundary remain separate limitations. None of these sampled poses supplies a new candidate-specific failure that justifies changing the frozen geometry during its audit.

### Ordinary continuity and neighborhood review

The completed [ordinary continuity report](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/continuity.json) records the maximum selected head-local vertex step as **8.179378477mm**, card 40's left root edge at frame 353→354. The next listed event is **6.163173280mm**, card 34's left root edge at frame 625→626. Maximum root-midpoint departure is only **0.000168035mm**. This is the already observed scale of anchored root-edge rotation in the posterior field; it is not evidence of root detachment or a new visible interruption by itself.

I additionally inspected candidate [351](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0351.png), [354](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0354.png), [357](../../../../captures/side-ordinary-v1/candidate-left-profile-brown/frames/0357.png), and the matched [baseline 354](../../../../captures/side-ordinary-v1/baseline-left-profile-brown/frames/0354.png). The intact candidate's side field stays joined, and the baseline's crossed cluster remains absent. No new broad break is apparent in this neighborhood. These images do not establish card 40's individual visibility from this camera. Frame 353 itself is absent from the 20fps PNG stream, so a one-update event at the exact preceding state cannot be excluded.

Two concrete alternatives for this continuity witness:

1. **Recommended: preserve the geometry and carry the anchored-edge statistic with the intact-image limits.** Finish the body audits without reopening frame tuning. Tradeoff: individual-card visibility and the omitted update remain unknown, but no observed defect supports a corrective shape pass.
2. **Alternative if that event becomes consequential: one frozen 60Hz image/identity witness around frames 353–354.** Retain the intact appearance control and separate identity from style judgment. Tradeoff: this can expose a one-update contribution, but it is another capture and should not be used simply to reduce a numerical maximum.

### Shared noisy boundary

**Actual witness:** both ordinary frame-360 images show a soft, speckled outer boundary at x350–420/y235–570 even though their interior flow differs substantially. Candidate 357 similarly shows boundary noise. This limits what these stills establish about perceived animation quality; it does not demonstrate a candidate-specific guide or collision error.

Two concrete alternatives:

1. **Recommended: keep the geometry frozen and use the existing paired image sequence for a separate playback-perception review.** Retain the shared limitation in the qualification record. Tradeoff: no asset iteration is introduced, but this does not isolate the rendering mechanism. This critic has not watched continuous playback.
2. **Alternative if playback shows a consequential artifact: a separate fixed-geometry rendering diagnostic at a saved noisy pose.** Compare an explicitly declared temporal/coverage condition while retaining the current production-render image as control. Tradeoff: this could distinguish rendering contributions, but it is separate work and should not be conflated with a groom improvement or reopened as an unsupported shader/geometry sweep.

## Final pending-audit boundary for this checkpoint

Both head and ordinary capture pairs, actual-image reviews and paired-control reports are now incorporated. **Both head body audits are complete; only the ordinary baseline and candidate body audits remain pending at this checkpoint.** No partial progress count is treated as clearance acceptance. The next required evidence is the completed ordinary baseline/candidate selected-body comparison, with exact witnesses retained for any failure. Candidate bytes remain frozen and unpromoted; the critic launched no native job or duplicate audit.

## Read-only scoping of a future anchored lower-segment probe

This is a proposed next mechanism, not a constructed candidate or qualification result. The frozen side-v3 asset above remains unchanged, and the ordinary results must be incorporated before choosing to build.

### Actual appearance and source witnesses

I re-opened [R1, medium rear](../../../../reference/bob-appearance-2026-09-29/01-medium-rear-flow.jpg), [R3, medium side](../../../../reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg), and the side-v3 [right profile](../../../../captures/bob-side-envelope-v3/neutral/casual-right-profile-medium-brown.png), [back](../../../../captures/bob-side-envelope-v3/neutral/casual-back-medium-brown.png) and [front](../../../../captures/bob-side-envelope-v3/neutral/casual-front-medium-brown.png). R1's underside and R3's nape visibly turn inward. The candidate's profile field around x280–530/y480–590 falls almost straight to its square edge; its back corners around x310–390 and x630–705/y490–590 retain their width almost to the hem. These are valid remaining mismatches to the medium brief. They support changing the lower continuation before enlarging the crown or changing the whole support volume. They do not supply a physical target angle or displacement.

The [side generator](../../../../tools/critic/bob-side-envelope.mjs), lines 30–46, puts a tuck into the support samples, evaluates an entire cubic, computes tangents from neighboring rings, and transports width axes over the entire card. The [clearance generator](../../../../tools/critic/bob-side-clearance.mjs), lines 16–20, likewise regenerates every ring after changing the first control point. Reusing either complete reconstruction would violate the proposed requirement that the frozen upper part remain exact; it could also lose the later fits and fallback paths. The next recipe must start from the final side-v3 POSITION/NORMAL bytes.

### Proposed displacement and short cards

For each of the 336 eligible changed cards, excluding exact-original fallbacks 47 and 182, the proposed read-only evaluation used:

- `drop = rootCentreY - tipCentreY`;
- `L = min(0.060, 0.65 * drop)` metres and continuous transition height `tipCentreY + L`;
- `u = clamp((transitionY - centreY) / L, 0, 1)`;
- `h(u) = 2u^3 - u^4`, amplitude `A = 0.010 * L / 0.060` metres;
- inward XZ direction from the frozen centre toward `[0, centreY, 0.03419020026922226]`.

The polynomial has zero value, first derivative and second derivative at the transition, but nonzero terminal derivative: `h(1)=1`, `h'(1)=2`. This can add an inward terminal slope. The scale is an explicitly bounded experiment, not a measurement from R1/R3. Under the chosen amplitude scaling, the scalar offset magnitude's terminal derivative with respect to height has magnitude `2A/L = 1/3`; retaining a fixed 10mm amplitude for short spans would defeat that bound. The full vector derivative also includes the changing radial direction; this scalar bound is not a full-vector slope guarantee.

The frozen GLB has monotonically descending centre Y for the selected cards. Card 16's root-to-tip drop is only **32.471299mm**, giving `L=21.106344mm` and `A=3.517724mm`; card 281's drop is **41.835546mm**, giving `L=27.193105mm` and `A=4.532184mm`. These are real short-guide witnesses. A continuous height threshold leaves all rings above it byte-identical and avoids extending a nominal 60mm span by snapping to an earlier ring. Sufficient anchored vertices and the first moved ring must still be recorded per card; a continuous C2 offset is not proof of smoothness in a 17-ring ribbon.

### Two concrete implementations and their tradeoffs

1. **Preferred bounded first probe: translate each ring's two frozen edge vertices by the same XZ offset.** This preserves their width vector and both edge Y values algebraically, subject to the explicitly measured Float32 write rounding. Copy all protected upper POSITION/NORMAL bytes exactly; recompute only the declared distal normals. This isolates the inward continuation and does not introduce a second change to width-frame orientation. Tradeoffs: widths can cease to be exactly perpendicular to the changed centreline, and the first recomputed normal can still create a shading transition. Neither clearance nor appearance is guaranteed by the construction.
2. **Alternative: keep the same displaced centres but transport distal widths from the exact frozen join frame.** Copy the protected upper vertices and normals, seed the lower transport from that retained frame, and never recompute it through a central difference that includes a moved lower neighbor. Tradeoff: this can enforce perpendicular widths, but it changes width axes and can change terminal edge Y while the terminal centre Y stays fixed. Report those displacements; unchanged centre Y is insufficient to claim an unchanged complete hem edge. This introduces more geometric variables than the first alternative.

I evaluated the first alternative mathematically without writing an output asset or modifying vertex buffers. Centre and width vectors were read directly from the frozen GLB using `globalVertex = 652 + card*34 + ring*2 + side`. For each affected ring I added the difference of its neighboring proposed offsets to the frozen central-difference tangent, then measured `asin(abs(dot(normalizedWidth, normalizedProposedTangent)))`. Across **336 cards / 2,451 affected rings**, the maximum predicted departure from perpendicularity is **0.092171469°**, card 1/ring 16; its baseline departure is **0.000120472°**, and its frozen normalized width dot inward radial direction is **−0.005220126**. Representative per-card maxima are **0.010940901°** for 382, **0.033982283°** for 391 and **0.000259906°** for 281. These values make the fixed-width alternative concrete for this asset; they are not a perceptual tolerance or target hairstyle angle. The calculation omits subsequent Float32 writes, normals, dynamics and contact.

The implementation pitfall is evidenced directly at side-generator line 38: the tangent at ring `r` uses ring `r+1`. A moved first lower ring can therefore rotate the last protected frame even when the analytic offset is zero at the transition. The first alternative avoids that frame reconstruction; the second must explicitly anchor it. [updateMovedFrames](../../../../tools/figure-pipeline/hair_fall.mjs), lines 59–75, computes geometry normals globally but copies results only for listed moved vertices, so its supplied vertex list controls whether upper normal bytes are preserved. That byte protection does not itself prove the first updated normal blends well.

The existing frame-255 neck/collar proximity and completed head audit remain reasons to repeat bounded qualification after any inward change. Excluding 47 and 182 preserves those fallback geometries, but does not establish contact clearance for all other inward-shifted ribbons. No whole-cubic control edit, broad volume change, material adjustment or new target-angle claim is justified as part of this one future probe.

### Reproducible read-only prediction command

Run from the repository root with the exact frozen side-v3 SHA above. This is the calculation actually used for the reported witness. **The inward direction is recomputed independently at each frozen ring centre**, pointing horizontally toward the fixed XZ centre. It is not fixed per card from its tip. No candidate GLB or buffers are written. `offsets` contains only proposed displacement vectors; the calculation predicts the effect on the finite-difference tangent while retaining each original width vector.

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import {readGlb,readPrimitive} from './tools/lut-bake/glb.mjs';
const p=readPrimitive(readGlb('captures/bob-side-envelope-v3/candidate.glb'),'hair_bob02');
const selected=JSON.parse(fs.readFileSync('captures/bob-side-envelope-v3/candidate-report.json')).selected.filter(c=>c!==47&&c!==182);
const ctrZ=.03419020026922226;
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a)),add=(a,b)=>a.map((v,k)=>v+b[k]);
const pos=(c,r,s)=>Array.from(p.positions.slice((652+c*34+r*2+s)*3,(652+c*34+r*2+s)*3+3));
const angle=(a,b)=>Math.asin(Math.min(1,Math.abs(dot(unit(a),unit(b)))))*180/Math.PI;
const rows=[];
for(const c of selected){
 const ps=Array.from({length:17},(_,r)=>pos(c,r,0).map((v,k)=>(v+pos(c,r,1)[k])/2));
 const drop=ps[0][1]-ps[16][1],L=Math.min(.060,.65*drop),joinY=ps[16][1]+L,A=.010*(L/.060);
 const offsets=ps.map(q=>{const u=Math.max(0,Math.min(1,(joinY-q[1])/L)),h=2*u**3-u**4,d=unit([-q[0],0,ctrZ-q[2]]);return d.map(v=>A*h*v);});
 for(let r=0;r<17;r++){
  if(ps[r][1]>=joinY)continue;
  const prev=Math.max(0,r-1),next=Math.min(16,r+1),w=sub(pos(c,r,1),pos(c,r,0)),t=sub(ps[next],ps[prev]),delta=sub(offsets[next],offsets[prev]),radial=unit([-ps[r][0],0,ctrZ-ps[r][2]]);
  rows.push({card:c,ring:r,spanMm:L*1000,amplitudeMm:A*1000,baselineDepartureDegrees:angle(w,t),radialDot:dot(unit(w),radial),predictedDepartureDegrees:angle(w,add(t,delta)),firstMovedRing:ps.findIndex(q=>q[1]<joinY)});
 }
}
rows.sort((a,b)=>b.predictedDepartureDegrees-a.predictedDepartureDegrees);
console.log(JSON.stringify({kind:'Read-only mathematical evaluation of proposed offsets; no vertex arrays/assets written, no frame transport simulated',cards:selected.length,rows:rows.length,scale:'A=10mm*(L/60mm), L=min(60mm,.65*root-tip Y); continuous join; current-position radial direction; fixed original width vectors',maximum:rows[0],top:rows.slice(0,8),representatives:[281,322,382,391,16].map(c=>rows.find(v=>v.card===c))},null,2));
JS
```

Compact retained result:

```json
{
  "predictionOnly": true,
  "cards": 336,
  "affectedRings": 2451,
  "maximum": {
    "card": 1,
    "ring": 16,
    "spanMm": 60,
    "amplitudeMm": 10,
    "baselineDepartureDegrees": 0.00012047235455297031,
    "radialDot": -0.005220126408247261,
    "predictedDepartureDegrees": 0.0921714692270313,
    "firstMovedRing": 9
  }
}
```

The result is an angle between a frozen width axis and a proposed sampled tangent, expressed as departure from perpendicularity. It is not the hair's terminal angle relative to gravity, a constructed candidate's measurement, a pass criterion, or a substitute for future intact appearance and clearance evidence.
