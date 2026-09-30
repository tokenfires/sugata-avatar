# Independent critique: bob02 authored attribution and nape-guide-v1

Reviewed September 29, 2026, with the final static confirmation packet captured September 30 UTC. Reviewer: hair_critic. This review used direct inspection of the archived images, current and archived source, and the recorded geometry/control data. The reviewer ran no browser, GPU capture, or motion job and changed no asset or implementation.

## Decision

**Keep nape-guide-v1 as a frozen, isolated static improvement.** The confirmed sideways nape hook is absent in the candidate across the sampled colors and views. The additional opposite-rear view does not show a new visible crease or protrusion that warrants changing this recipe. This result earns retention as a useful component; it does not qualify a finished medium bob or justify changing the default asset.

**The next appearance problem is the central rear layer arrangement.** The exposed backing, crossed paths, angular crown pieces, and separate low central tongue remain visible. They require their own attribution and authoring decision. Further changes to card281 would not address these witnesses.

Frozen candidate: [candidate.glb](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/candidate.glb), SHA-256 `dc6d17fbd6b98facd81e420ee24b46e28c2514243e065446e30ab2ef6de27427`.

Accepted source: `assets/hair/bob02/g050.glb`, SHA-256 `a666a80777f0b93a824857dc2e2cbffe27cd2c8991a3f4ec8215ebc1d94298bd`.

## What the evidence establishes

### The visible hook belongs to authored card281

- In the original rear-oblique images, an outward, upturned extension occupies approximately x535–625, y510–615 in the 900 × 868 image. [Original neutral view](../../../../captures/hair-colour-2026-09-29/attribution-v1/casual-rear-oblique-medium-brown.png).
- Hiding only card281 removes this extension. This isolates its visible ownership; hiding triangles is not a proposed production repair. [Single-card attribution](../../../../captures/hair-colour-2026-09-29/hook281-removal-v1/casual-rear-oblique-medium-brown.png).
- In the held pose, the whole groom's maximum authored-to-live centre displacement is 0.000449 mm and maximum vertex displacement is 0.001679 mm. This cannot explain the large hook as runtime deformation in this pose. The original card281 positions also match the original fixture, preceding the later correction passes.
- Card281's original path travels about 68 mm sideways and has a 107.020 mm arc. The candidate redirects it to a 32.865 mm downward/inward path, preserving the root ring and transporting the existing widths. This is a substantial one-card reauthoring, not just removal of the terminal rise.

### The static gain survives the confirmation views

| Comparison | Direct observation |
| --- | --- |
| [Original studio rear-oblique](../../../../captures/hair-colour-2026-09-29/studio-rear-control-v1/casual-rear-oblique-exact-default.png) → [candidate](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/studio/casual-rear-oblique-exact-default.png) | The blue-lit hook at the lower right disappears; the larger crossed patch remains. |
| [Opposite rear original](../../../../captures/hair-colour-2026-09-29/attribution-opposite-v1/casual-rear-left-medium-brown.png) → [candidate](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/opposite/casual-rear-left-medium-brown.png) | The former draped segment near x480–565, y540–635 retreats, exposing more nape. I see no new isolated projection or root crease. The existing uneven hem remains. |
| Candidate [exact dark](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/colour-confirm/casual-rear-oblique-exact-default.png) and [pale neutral](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/colour-confirm/casual-rear-oblique-pale-neutral.png) | The hook stays absent. Pale material makes endpoints easier to read but reduces some internal contrast; brightness is not itself evidence of a better groom. |
| Candidate [back, exact dark](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/colour-confirm/casual-back-exact-default.png), [back, pale](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/colour-confirm/casual-back-pale-neutral.png), and [back, studio](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/studio/casual-back-exact-default.png) | The repaired nape area does not introduce an obvious new spike; the central low tongue and disconnected rear flow persist. |

The earlier three medium-brown neutral views, including right profile, were also directly inspected. There was no comparable replacement hook in those views.

For the opposite-rear and studio rear-oblique pairs, all recorded fixed-state fields except hair positions, velocities, and vertices match. The scoped source hashes match except for the deliberately added candidate asset. Clock, applied color, camera angle, and image dimensions match. The accepted asset is still the baseline.

The studio back comparison uses the earlier [pilot-v4 baseline](../../../../captures/hair-colour-2026-09-29/pilot-v4/casual-back-exact-default.png). Its recorded clock, color, camera, render state, lights, and non-hair state match the candidate, and production source hashes match; the diagnostic harness subsequently gained attribution and candidate-loading support. This is corroboration with a documented harness revision, rather than a freshly captured baseline with the identical harness.

The candidate color confirmation has independent exact-dark repeats: back differs in 25 pixels, maximum 2/255; rear-oblique is pixel-identical. Both repeats were directly viewed. FrameId and grain frame are 98, temporal jitter index is 5 of 31, history width is 900. Reports are `captured`, native Apple/Metal WebGPU, with empty errors. These controls support the large static shape comparison; they do not promise universal pixel determinism.

### Numerical checks support the narrow scope

[Numerical checks](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/numerical-checks.json) and [candidate report](../../../../captures/hair-colour-2026-09-29/nape-guide-v1/candidate-report.json) record:

- Only the 32 non-root vertices of card281 and their normals change. Indices, UVs, joints, weights, root ring, cap, and other cards are unchanged.
- All noncandidate live vertices are bit-identical in the compared held pose.
- Minimum moved-vertex signed rest-body clearance is 10.975 mm.
- All 32 candidate-card triangles were selected against 26,756 body triangles using an unbounded region; zero triangle/body candidate pairs and intersections were reported. The JSON's null bound values represent serialized unbounded axes, not a small head-only selection.

These are rest/held-pose results. The crossing report explicitly does not establish positive clearance everywhere, exclude a wholly enclosed triangle by itself, or qualify moving contacts. No full-groom or all-motion acceptance follows.

The preserved root ring and redirected next ring also change the local width-frame relationship. An earlier geometry audit measured root-to-first-ring offset angle from about 4.16° to 51.61°. This is a specific reason to watch the attachment in future motion and angles. It is **not a demonstrated visible failure** in this packet, so it is not a reason to adjust the frozen candidate now.

## Actionable findings and alternatives

### 1. Retain the confirmed local gain without conflating it with the remaining groom

**Actual mismatch:** the original studio rear-oblique hook violates the reference's downward/inward nape flow; the corresponding candidate removes it. Yet the candidate exact-dark back image still has a separate central tongue around x470–530, y495–605 and crossed paths above it. Those surviving shapes are distinct from the repaired card.

**Alternative A — qualify this exact candidate next.** Use the existing serialized motion/contact workflow on the frozen bytes and inspect the attachment and hem in moving rear views. This advances a small component toward adoption, with the cost of qualification work on a groom whose major appearance defect remains.

**Alternative B — preserve this candidate and address the rear layer arrangement first (recommended).** Keep a baseline and candidate pair available and treat card281 as a fixed experimental component. This gives the next appearance pass greater visual value and avoids retuning a successful local change. The cost is that the useful repair remains unqualified longer, and later combined geometry must receive its own qualification.

Neither alternative calls for another change to card281 without a new visible or contact witness.

### 2. Resolve why the central backing is exposed before adding another broad cover

**Actual mismatch:** in [back layer attribution](../../../../captures/hair-colour-2026-09-29/layers-v1/casual-back-medium-brown.png), red root cards and gray cap remain exposed in the central vertical band around x395–525, y180–480. In [rear-oblique attribution](../../../../captures/hair-colour-2026-09-29/layers-v1/casual-rear-oblique-medium-brown.png), the red band sits around x430–525, y210–475 while longer blue/orange/cyan sections sweep around and across it. The exact-dark candidate still shows angular crossing in the corresponding region. This differs from the coherent curved downward flow in reference 01, even allowing for lighting and occlusion.

The calibrated source-group mapping in [hair-attribution-browser.mjs](../../../../tools/critic/hair-attribution-browser.mjs) is root cards 0–77, surface 296–343, veil 372–461, with gray cap vertices before 652. Group colors preserve geometry and alpha but pass through production lighting and grade. They establish group ownership, not exact per-pixel visibility or an authoring solution.

**Alternative A — one bounded posterior-root ablation (recommended next probe).** Use the archived projected geometry to shortlist root cards crossing that band, then temporarily hide that posterior subset's triangles while retaining cap and all longer cards. Capture back and rear-oblique against the existing medium-brown neutral baseline. If the jagged crossing largely disappears and leaves smooth exposed backing, the short root geometry is a principal contributor; if crossing persists, identify the surviving longer-card owners before authoring. This reuses the successful card281 ownership method and has a clean causal interpretation. Its tradeoff is two additional diagnostic views rather than an immediate appearance candidate. Selection by projected overlap alone is only a shortlist because occluded cards can overlap the same region.

**Alternative B — redirect a small identified set of existing posterior surface/veil cards into one narrow exposed band.** Hold card count, widths, UVs, materials, and unrelated paths fixed, and change only those curves to provide downward coverage. This directly tests an authoring solution without adding a new sheet. It risks transferring a gap elsewhere or creating another wide visible panel, and the causal story is weaker until the chosen cards' actual visibility is confirmed. Reject a trial that closes the band by producing a flat strip, repeated teeth, or new slots in either rear view.

Keep the trial local. A global root-length, layer-width, or curtain-density sweep would conflate multiple explanations and revisit earlier failed patterns.

## What earlier curtain work changes about the next decision

[September 13 shape studies](../../../HAIR-SHAPE-STUDIES-2026-09-13.md) already document the exposed cap/root backing. Sparse followers had little effect; a uniform curtain covered the opening but produced broad panels and comb-like ends; seven-lock variation reopened slots and retained broad highlights. [The inner-hem study](../../../HAIR-INNER-HEM-2026-09-13.md) reports that raising the inner ends by 12 mm removed bob02 backing too early. These are prior documented findings; their original render archives were not available in this checkout for renewed direct inspection.

The new layer images corroborate the exposure diagnosis. They do not invalidate those failures or justify rerunning their width, hem, or lock-count loops. The proposed local ownership probe asks which existing cards actually create the surviving patch. A subsequent local path change should have a named witness, one predicted improvement, and explicit rejection conditions before it runs.

## Critique gates for the next candidate

Evaluate the same back and rear-oblique patch first, then the opposite rear and relevant side. Require visibly coherent downward flow through the chosen region, retained rounded volume, a connected lower edge, and no newly exposed slot or broad flat panel. Compare exact-dark as well as the medium diagnostic material; use pale only when an endpoint is ambiguous. Keep clocks, camera, lighting, material parameters, and unrelated geometry fixed.

A candidate earns further motion/contact qualification only after an actual appearance gain. If the same adjustment is reversed or repeated without a new discriminating observation, change the diagnosis or representation before another parameter pass. The current packet calls for no additional color or lighting tuning.
