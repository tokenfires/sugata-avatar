# An inward turn at the bob ends

**A modest, visible contour improvement in five matched neutral views.** The side and back corners turn inward, while the upper flow and open face remain recognizable. The exact candidate is experimental: source-rest body clearance and three original-dark comparisons are complete. Its own movement qualification is next.

| Frozen side-v3 control | Lower-curve v1 |
| --- | --- |
| ![Control with a nearly square lower back](../../../../captures/bob-side-envelope-v3/neutral/casual-back-medium-brown.png) | ![Candidate with inward-turning back corners](../../../../captures/bob-lower-curve-v1/neutral/casual-back-medium-brown.png) |

## Decision and target

[R1](../../../../reference/bob-appearance-2026-09-29/01-medium-rear-flow.jpg) and [R3](../../../../reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg) show ends turning toward the neck. The frozen side candidate still fell almost straight to a square lower contour. Root and the independent critic chose one anchored lower-segment change over reshaping the entire lower half. The source and visual reasoning, including two implementation alternatives, are preserved in the [completed side-motion critique](../side-motion/CRITIQUE.md).

Each affected ring's two vertices receive the same inward horizontal translation. Its original width vector and edge heights are preserved, subject to reported Float32 rounding. The continuous transition uses `2u³−u⁴`, over at most 60 mm or 65% of the root-to-tip drop, with amplitude scaled to that span and capped at 10 mm. These are bounded probe values, not dimensions measured from a photograph. Original fallback cards 47 and 182 remain exact. The upper part, fringe, cut heights, textures and materials are retained.

The alternative was to transport lower width frames along the new curve. That enforces perpendicular widths but introduces frame and edge-height changes. A read-only calculation found the fixed-width method's departure from perpendicularity to be small for this exact asset, so the simpler method was selected. It still needs intact visual and moving evidence.

## Frozen output and source checks

- Control SHA256: `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.
- Candidate SHA256: `2b0c68c05802d0f515aa84b7e505fd325735befbc0159a50bd37cc887e274802`.
- [Authoring record](../../../../captures/bob-lower-curve-v1/candidate-report.json): 336 eligible cards, 4,902 declared distal vertices; 4,879 position and 4,902 normal records change after Float32 writes.
- Every protected upper/fallback position and normal is exact. Other attributes and topology are exact. Maximum width-vector difference is 0.000004165 mm; every edge Y is exactly unchanged.
- All 338 union cards, 10,816 triangles, clear the source-rest body: zero pairs, minimum vertex clearance 3.506314 mm. Garments, alpha and moving poses are excluded.

The largest measured normal change at a protected-to-moved join is card 337, ring 12→13, side 0: 2.239223° before, 6.666814° after. Each join and its first changed normal are recorded. This locates a possible shading witness; it does not establish a visible crease. The actual back image has a soft lighter lower sweep, without a demonstrated sharp seam. Keep the geometry frozen while checking another lighting condition.

## Held comparison

The [paired audit](../../../../captures/bob-lower-curve-v1/paired-captures.json) verifies matching recorded camera, rig, clock, scene, material and rendering controls and matching common source hashes in all five views. All 11,962 protected authored vertices are exact in the geometry readback. The 160 other cards have bit-exact live vertices. Some protected upper vertices within changed cards differ in live response by at most 0.000119224 mm; authored equality is not silently presented as simulated equality.

Root and critic directly inspected right profile, left profile, back, rear oblique and front. The most visible gain is the inward turn of the rear corners. The posterior shafts remain coherent, and no new broad opening, ear bulge or closed face is apparent in these stills. Crown/fringe irregularities, texture softness and the unfinished face-framing design remain. See the [independent critique](CRITIQUE.md) for exact image regions and alternatives.

Root and critic also inspected all six PNGs in the three original-dark Studio pairs. The inward turn remains visible in both profiles and the back, without a demonstrated new sharp seam or broad hole. [Recorded dark controls](../../../../captures/bob-lower-curve-v1/dark-controls.json) match; Studio’s blue light is an appearance condition, not natural shade fidelity.

Decision: keep these exact bytes and qualify them in matched head and ordinary motion. The prior side-v3 motion result does not qualify this modified asset. The [static archive](archive-manifest.json) preserves 89 files, 59,540,032 bytes and 11 new PNGs; its neutral control remains in the prior frozen side archive. All capture jobs are complete and collected. See [summary](summary.json) for source pins and limits.
