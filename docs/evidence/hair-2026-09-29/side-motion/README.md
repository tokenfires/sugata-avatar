# Side extension during movement

**The cleaner side flow survives the reviewed head and ordinary poses. Both complete candidate protocols have zero selected triangle/body intersections.** The frozen side candidate remains isolated; no accepted asset has changed.

| Frozen posterior control, upward tilt | Side extension, same pose |
| --- | --- |
| ![Posterior control with remaining side crossings](../../../../captures/side-head-v1/baseline-right-profile-brown/frames/0255.png) | ![Side extension retains coherent curves in upward tilt](../../../../captures/side-head-v1/candidate-right-profile-brown/frames/0255.png) |

The [head-turn preview and original PNG slider](../../../../captures/side-head-v1/review.html) presents the two arms. The convenience video has verified uniform 20 Hz presentation timestamps; original geometry is retained at every 60 Hz update. The native-browser check passed desktop/mobile layout, all nine overview images, Home/End/previous/next controls and an advancing video playhead; root inspected the actual mobile page. Neither video encoding nor individual-frame inspection establishes continuous perceptual quality.

## Exact comparison

Baseline is frozen posterior-v3, SHA256 `d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`. Candidate is side-v3, SHA256 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`. Both are explicitly routed into fresh native owners; the production asset is untouched. The [static side evidence](../side-envelope/README.md) establishes how the second asset was constructed and why it merits qualification.

Both protocols retain the complete 338-card union (10,816 triangles and 11,492 vertices), all other card coordinates, posed body positions/normals, rig/head transforms, clocks and collider values. The side candidate inherits no moving pass from the earlier posterior result.

### Head sequence: captures complete

The 9.25-second sequence applies yaw ±30°, downward pitch 20°, upward pitch 15° and roll ±15°, with returns. Other procedural layers are disabled before the initial state. There are 555 advancing updates plus frame 0, 556 full geometry states and 186 PNGs per arm. Right profile exposes the initially attributed near-side slash. The last two seconds show recovery without a settled-state gate.

The [paired raw audit](../../../../captures/side-head-v1/paired-controls.json) verifies identical setup and all 556 body positions, body normals, rig/head transforms, command angles, clock/step records and shoulder capsules. The new side geometry increases the fitted skull radius by 0.920332870 mm relative to posterior-v3; its fitted centre difference is below 0.000000012 mm.

The largest other-card displacement is **0.216609592 mm** at update 373, fringe card 494, ring 16, side 0. This is a measured indirect consequence. Its individual visibility is unassigned, and the profile does not qualify every front-fringe pose. It is not an observed defect or a reason by itself to retune the fringe or collider.

The candidate continuity diagnostic has maximum head-relative selected vertex step 1.073408 mm and root-midpoint departure below 0.000187 mm. These locate witnesses; they are not appearance, temporal or settling acceptance thresholds.

The [independent critic](CRITIQUE.md) inspected 11 matched original pairs at neutral, axis extrema and returns. The side improvement survives these poses without a new obvious broad crease, opened side patch, ear dome or returning diagonal. Crown/fringe irregularities, blunt lower edge and soft noisy boundaries remain. A single profile does not expose the opposite ear at every head extreme.

### Ordinary sequence: captures complete

The second protocol uses the normal 17-layer stack for 12 seconds, seed 20260807, and the opposite left-profile view. Both recordings are complete. Each arm has 720 advancing updates plus frame 0, geometry at 60 Hz and original PNGs at 20 fps. The [paired audit](../../../../captures/side-ordinary-v1/paired-controls.json) verifies matching setup and all 721 body/normals/rig/head/clock/step/capsule records. The shared skull radius difference remains +0.920332870 mm. Other-card displacement peaks at 0.080536642 mm, update 400, fringe 494's right tip. The largest head-relative selected vertex step is 8.179378 mm: the previously identified anchored card-40 root-edge rotation. It is not new evidence of root detachment.

Root inspected matched updates 180/360/600. The opposite-side zigzag patch stays removed; soft moving boundaries persist in both arms. The critic's broader temporal sample is recorded separately. The [ordinary preview and original-frame viewer](../../../../captures/side-ordinary-v1/review.html) has 241 uniformly spaced video presentation frames and a 12.05-second duration including the last image hold. Its native browser controls and desktop/mobile layout passed; root inspected the actual mobile page.

## Completed contact audits and recovery

Both head audits are complete:

| Head protocol | States | States with body pairs | Triangle/body pairs | Minimum vertex clearance |
| --- | ---: | ---: | ---: | ---: |
| Frozen posterior control | 556 | 556 | 29,713, all card 68 | 1.712008 mm |
| Side candidate | 556 | 0 | 0 | 1.379665 mm |

The candidate minimum occurs at update 391, original card 47, ring 12, side 0. Positive vertex distances in the control do not exclude triangle-interior contact. Card 68 belongs to the newly added side region; the previous 266-card posterior audit did not claim to cover it. These geometric contacts are not visible-clipping counts.

Both ordinary audits are also complete:

| Ordinary protocol | States | States with body pairs | Triangle/body pairs | Minimum vertex clearance |
| --- | ---: | ---: | ---: | ---: |
| Frozen posterior control | 721 | 721 | 38,723, all card 68 | -0.348883 mm |
| Side candidate | 721 | 0 | 0 | 2.331497 mm |

The control minimum is at update 357, card 68, ring 13, side 1; two vertex samples over the sequence have negative signed distance. The candidate minimum is at update 355, card 2, ring 0, side 1. These witnesses and every audited state remain in the final numerical reports. Both candidate protocols now support sampled selected-body clearance for this exact asset; this is not all-motion or whole-groom acceptance. The audits evaluate selected triangles against the full posed/morphed body and signed vertex distances. Garments, hair-hair contact, nonselected-card contact, rendered alpha/occlusion and continuous time between updates remain outside their scope.

All four CPU audits and native jobs have completed and their sessions were collected. The [archive manifest](archive-manifest.json) pins 3,528 local files, 3,934,219,052 bytes and 862 PNGs, including 854 original motion images and the native page checks. It also preserves hash-verified audit dependency sources. The archive step verifies every retained image and geometry hash, capture-source snapshots, paired-data pins and native-review report pins before publishing its completion manifest. These raw files remain local under ignored captures directories.

Exact commands and job identities remain in the [overnight checkpoint](../../../OVERNIGHT-2026-09-29.md). The independent critic's final scope and actual image examples are in [CRITIQUE.md](CRITIQUE.md). The decision is to preserve this candidate as the current experimental lead and next try the separately specified inward lower segment. That next asset will require its own intact images and qualification; this result does not transfer to changed geometry.
