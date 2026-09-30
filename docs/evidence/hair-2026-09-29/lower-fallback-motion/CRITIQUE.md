# Independent critique — lower fallback motion

## Final disposition

**Retain the frozen fallback as a useful, scoped lower-curve candidate.** Both complete candidate body audits have zero selected triangle/body intersections and zero negative selected-vertex samples. The modest inward lower contour remains visible in the inspected head and ordinary poses, without a newly obvious square secondary hem or sharp join.

Two limits remain concrete: head clearance reaches only **0.0781307504 mm** at one sampled vertex, and candidate front frame 373 shows a small horizontal brow dash. These facts do not erase the sampled improvement or establish a broad failure. They do prevent presenting this evidence as robust all-motion clearance or flawless frontal appearance. No further shape or physics adjustment is justified from the numerical metrics alone.

This critique covers the exact fallback SHA below. It does not qualify the separate front-sector authoring proposal or change the accepted default asset.

## Exact experiment and evidence

- Candidate: `captures/bob-lower-fallback-v1/candidate.glb`, SHA-256 `8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7`.
- Control: `captures/bob-side-envelope-v3/candidate.glb`, SHA-256 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.
- The candidate restores the 19 demonstrated contact cards of failed lower-v1 exactly from the side control, retaining 317 inward-curve cards. Its construction and static appearance are recorded in the frozen [static critique](/Users/robault/GitHub/sugata-avatar/docs/evidence/hair-2026-09-29/lower-fallback/CRITIQUE.md).
- Head: one 9.25-second sequence, yaw ±30°, pitch +20°/−15°, roll ±15°, original procedural layers disabled; 556 geometry states and 186 PNGs per profile arm. The last two seconds are return/recovery, not a proved settled gate.
- Ordinary: 12 seconds with the normal procedural stack and seed 20260807; 721 geometry states and 241 PNGs per arm.
- Geometry is captured at every 60 Hz update; PNGs at 20 fps. Front replay adds exact frame 373, giving 187 PNGs per head/front arm.
- All six capture reports are `captured`, with empty recorded errors and `disposed: true, leaked: []`. [The driver](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-lower-fallback-motion.mjs:35) monitors page errors and HTTP responses of 400 or greater. This is not a guarantee about uncollected console errors.

I directly inspected 42 PNGs: nine head pairs previously, nine ordinary pairs now, and three front witness pairs. I also independently checked their image hashes, the declared tools/packages source snapshots, paired-report pins, audit-to-capture report hashes, complete final row coverage and negative/pair totals. I did not rerun the body oracle or native captures.

## Complete numerical outcomes

Both fresh candidate audits cover the full selected set of 338 cards / 10,816 triangles against the posed body.

| Protocol | Complete states | Triangle/body pairs | Negative vertex samples | Minimum signed vertex clearance |
| --- | ---: | ---: | ---: | --- |
| [Candidate head](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/candidate-right-profile-brown/numerical-checks.json) | 556 | 0 | 0 | 0.0781307504 mm, frame 255, card 123, ring 16, side 1 |
| [Candidate ordinary](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/candidate-left-profile-brown/numerical-checks.json) | 721 | 0 | 0 | 2.3110994011 mm, frame 718, card 164, ring 16, side 0 |

Head completed at 2026-09-30 10:23:20.682 UTC; ordinary completed at 10:45:25.905 UTC. These are final files, not conclusions from progress prefixes. The earlier failed lower-v1 head result remains preserved; fallback success does not rewrite that failure.

The unchanged side-control body results are reused through [head exact replay](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/control-replay.json) and [ordinary exact replay](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/control-replay.json), not a fresh control oracle. Each replay records exact physical samples and 36 verified capture-source snapshots, including the distinct drivers. Reused control minima are 1.3796651129 mm for head and 2.3314974994 mm for ordinary. Candidate audits are fresh.

### Close positive head sample: two alternatives

**Witness:** frame 255 is the upward-pitch extreme. Card 123's terminal edge is only 0.0781307504 mm outside the body at world point approximately `[-0.04702045, 1.42776823, -0.00551558]`. Card 123 was not one of the 19 restored cards. The final audit finds no intersection or negative vertex there; the inspected profile image does not establish visible clipping.

- **A — recommended for the current checkpoint:** retain the frozen candidate with the exact sampled claim, preserve frame 255/card 123 as a regression witness and continue the separately scoped front work. This avoids inventing a correction for a contact that was not found, while leaving robustness explicitly unqualified.
- **B:** before making a broader moving-clearance claim, run one targeted nearby head trajectory around the upward-pitch/roll poses on the same frozen bytes, with full selected-card/body checks and actual images. This tests sensitivity to a real close approach; it costs another qualification run and still cannot establish all-motion safety.

Do not add an outward offset or restore another card merely to improve this scalar minimum. Neither alternative requires a geometry change now.

## Paired controls and runtime isolation

[Head paired controls](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/paired-controls.json) and [ordinary paired controls](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/paired-controls.json) show exact body positions/normals, rig, head/command, clock, steps, capsule settings and recorded setup in all 556/721 states. Skull radius and centre are also exact between these arms.

Other hair is **not** dynamically isolated:

- Head: maximum unchanged-card displacement 6.6356507126 mm at frame 373, fringe card 494, ring 16, side 1; other-card hashes differ in 555 states.
- Ordinary: maximum 0.5396343918 mm at frame 397, card 238, ring 16, side 1; other-card hashes differ in 720 states.

The source computes compliance from the whole groom's median arc at [HairDynamics.js:524](/Users/robault/GitHub/sugata-avatar/packages/core/src/motion/HairDynamics.js:524). That is a real possible dependency, but this fallback review does not provide a causal ablation or assign the brow dash solely to it. Static authored equality and fixed colliders are insufficient to infer equal dynamics.

[Front/profile replay](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/view-repeat.json) establishes bit-exact physical state for all 556 states within each arm: head matrix, degrees, clock, steps, colliders, hashes, selected vertices/centres, other vertices and body positions/normals. Thus the front images below show the same simulated witness as the profile run, from another camera. [Front paired controls](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/paired-controls.json) reproduce the same fringe maximum.

Continuity records report a head maximum selected-vertex step of 1.004195492 mm, card 86 tip, frames 231→232; ordinary maximum 8.181301737 mm, card 40 root edge, frames 353→354. Root-midpoint departures remain at most 0.000186584 mm and 0.000168035 mm respectively. These are not evidence of root detachment. The actual 351/354/357 pairs do not show an attributable new interruption from that root-edge statistic.

## Actual appearance review

### Head profile

Previously inspected paired frames: **0, 90, 150, 210, 255, 315, 360, 435, 555**.

The inward rear turn survives through the sampled turns/tilts and return. At [candidate 210](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/candidate-right-profile-brown/frames/0210.png), x450–555/y470–540 is more rounded inward than [control 210](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/baseline-right-profile-brown/frames/0210.png). At [candidate 255](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/candidate-right-profile-brown/frames/0255.png), x400–500/y570–635 keeps that turn against [control 255](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/baseline-right-profile-brown/frames/0255.png), without an obvious new square ledge or sharp join. The existing crown gaps and soft outer boundary remain in both arms. This visual review does not locate the nearly contacting interior vertex by alpha ownership.

### Ordinary left profile

Inspected paired frames: **0, 120, 240, 351, 354, 357, 396, 480, 720**, in temporal order.

- [Candidate 0](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/candidate-left-profile-brown/frames/0000.png) versus [control 0](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/baseline-left-profile-brown/frames/0000.png): the screen-left rear corner around x350–480/y490–610 curves inward more clearly. The side field remains coherent, with no new squared interior hem.
- The same modest curve persists at 120, 240 and 480. The skin-coloured division near x505–530/y520–605 at 240 is already present in the control; it is not evidence of a newly opened broad hole.
- In the 351/354/357 sequence, lower separations are present in both arms. [Candidate 357](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/candidate-left-profile-brown/frames/0357.png) and [control 357](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/baseline-left-profile-brown/frames/0357.png) both have a softer/noisier boundary than their earlier neighbours. No visible witness justifies changing the root frame because of the numerical step maximum.
- [Candidate 396](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/candidate-left-profile-brown/frames/0396.png) and [control 396](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/baseline-left-profile-brown/frames/0396.png) both show separated lower sections and soft outline. The actual paired image does not establish a new broad gap attributable to the measured card 238 consequence at nearby frame 397.
- At [candidate 720](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/candidate-left-profile-brown/frames/0720.png) versus [control 720](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/baseline-left-profile-brown/frames/0720.png), the rear contour remains gently turned inward. The separate long front section and existing crown irregularities persist.

### Front 372/373/375: localized appearance exception

Directly inspected all six originals. [Candidate 373](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0373.png) contains a small horizontal brown dash around **x507–519/y342–347**, just above the screen-right eyebrow, absent as the same isolated mark in [control 373](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/baseline-front-brown/frames/0373.png). [Candidate 372](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0372.png) and [375](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0375.png) do not show the same conspicuous isolated dash. The overall face framing remains similar. The samples do not establish continuous-playback flicker or a broad bang gap.

The frame agrees with the maximum card 494 displacement, but that concurrence alone does not prove which alpha-covered triangle produces the dash.

- **A — recommended:** retain this as an explicit small appearance exception and a required comparison frame in the separately scoped front work. This preserves the useful lower-contour result and avoids a speculative physics change; it leaves the dash unresolved for now.
- **B:** perform a same-state render-only card 494 visibility intervention at 372/373/375 on the exact fallback, retaining the full groom solver and consistent visibility through temporal settling. Disappearance would establish the card's contribution, at the cost of another narrow capture. It would not establish compliance as the sole cause or make card deletion a finished design.

## Scope and stop point

The exact fallback has a positive sampled body outcome and retains the inspected inward-contour improvement. Keep the close approach and small brow exception with that result. There is no supported reason for another tiny lower-curve, width-frame or solver tuning pass now.

Limits: only one g050/bob02 figure, outfit, seed and the stated protocols; only the 338 selected hair cards; cap/fringe/other-card body clearance is not comprehensively qualified; garments and hair-to-hair contact are excluded; no alpha is sampled by the body oracle; times between 60 Hz updates remain unobserved. Actual image inspection sampled the stated frames rather than every PNG or continuous playback. Neither the final return interval nor zero geometric counts establish universal settling, style completion or production readiness.
