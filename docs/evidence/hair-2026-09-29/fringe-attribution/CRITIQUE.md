# Independent critique — front fringe visibility attribution

## Disposition

**The 34-card fringe contributes to the short eyebrow band, but hiding it does not produce the intended medium bob.** Short broken front panels and crown interruptions remain; some crown gaps become more exposed. The experiment supports a layer-identity diagnostic on the remaining front geometry before another authoring change. It does not support deleting the fringe or assuming that restyling those 34 cards alone will repair the front.

This review directly inspected all six PNGs: intact and hidden arms in front, front-right and front-left views. No native job, asset mutation or additional capture was performed by the critic.

## Evidence and controls

- Asset: `captures/bob-side-envelope-v3/candidate.glb`, SHA-256 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`. This is the qualified side experiment, not the pending lower fallback.
- Both [control report](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/report.json) and [hidden report](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/hidden/report.json) are `captured`, with empty recorded errors. Each contains three views at owned render frame 98, time/delta zero, grain frame 98 and matching temporal epoch.
- The [paired audit](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/paired-controls.json) reports exact recorded state, including physical buffer hashes, and exact exported geometry except indices in all three views. Exactly 1,088 triangles are removed, belonging to cards 462–495; the cap remains rendered.
- Independently read and checked both report pins, all declared tools/packages source snapshots, six PNG hashes, geometry hashes, the asset hash and the saved audit-source hash. Read-only comparison confirmed equal geometry key sets and every exported value except indices, equal fixed state, and the exact filtered index list. No source audit was rerun or overwritten.
- The current GLB has one mesh/primitive. All triangles belong to one card or cap component; the first-index classifier therefore agrees with all three indices for this pinned asset. Every fringe card owns 32 triangles.

The filtering occurs after attachment: [Showcase creation](/Users/robault/GitHub/sugata-avatar/packages/testbed/src/showcase.js:320) awaits `Avatar.create` and an initial step before publishing `window.showcase`; [the visibility filter](/Users/robault/GitHub/sugata-avatar/tools/critic/hair-colour-diagnostic.mjs:146) then replaces only the mesh index. The full groom and compliance buffers have already been derived at [HairDynamics.js](/Users/robault/GitHub/sugata-avatar/packages/core/src/motion/HairDynamics.js:484). This avoids the changed median/compliance that deleting cards before attachment could introduce.

## Actual visual witnesses

Approximate coordinates below refer to the original 900×868 PNGs. They locate regions for comparison, not individual-card alpha ownership.

| Pair | Observed contribution and residual |
| --- | --- |
| [Front intact](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/casual-front-medium-brown.png) / [front hidden](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/hidden/casual-front-medium-brown.png) | The eyebrow-length ends around x325–550/y300–340 are reduced. The hidden image still contains abruptly ending, broken panels around x310–520/y190–305. The crown around x370–505/y65–130 becomes more interrupted, rather than acquiring a continuous part-to-front sweep. |
| [Front-right intact](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/casual-front-right-medium-brown.png) / [front-right hidden](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/hidden/casual-front-right-medium-brown.png) | Much of the eyebrow band around x90–235/y290–345 disappears, but shorter block-like ends remain around x120–230/y215–305. The black slit between upper ribbons around x210–350/y105–135 is more exposed. The long cheek-framing and outer side masses remain. |
| [Front-left intact](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/control/casual-front-left-medium-brown.png) / [front-left hidden](/Users/robault/GitHub/sugata-avatar/captures/bob-fringe-ablation-v1/hidden/casual-front-left-medium-brown.png) | The projecting fringe ledge around x730–785/y270–350 disappears. Long face cards around x605–670/y360–650 and the larger side mass remain; upper crown steps and front angular divisions persist. This view directly separates removal of the short fringe ledge from removal of the long face framing. |

[R2](/Users/robault/GitHub/sugata-avatar/reference/bob-appearance-2026-09-29/02-medium-face-framing.jpg) and [R3](/Users/robault/GitHub/sugata-avatar/reference/bob-appearance-2026-09-29/03-medium-side-volume.jpg), re-inspected directly, differ in face exposure and front-layer length but both show coherent curved paths through the front section. R3 supports shorter swept layers; it does not justify treating any short fringe as a defect. The mismatch here is the broken panel transitions and interrupted coverage. These references do not establish a required part side or a numeric target angle.

The source supplies a concrete reason to test this layer separately: [hair_cards.py:781](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/hair_cards.py:781) defines 34 short fringe cards with a shared forehead cut, and [root_direction](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/hair_cards.py:2235) gives them a separate down-and-forward field without the radial/part terms. That historical authoring intent is evidence about the current asset, not an instruction to redefine Robert's current visual target.

## Two alternatives and selected next discriminator

**Finding:** hiding the fringe removes a specific short band while exposing residual broken front panels and additional crown gaps. The remaining panels cannot yet be assigned to root, mass, veil or cap from these beauty images. Authoring only the fringe at this point would be based on incomplete attribution.

### A — recommended: layer identity with the fringe still hidden

Capture the same three views on the same asset with the same 462–495 index removal and the existing [layer-colour helper](/Users/robault/GitHub/sugata-avatar/tools/critic/hair-attribution-browser.mjs:6). Retain every solver card, full physical buffers, camera, time, light, alpha and visibility. Compare against these hidden beauty images; verify physical/exported geometry equality again, allowing only the explicit identity attribute/material change.

Use three bounded regions: the residual forehead panels, the enlarged crown slit/steps, and the surviving long face cards. Record which layer colours occupy each region and associate projected card IDs only where needed. If a colour boundary remains ambiguous through transparent overlap, one subsequent small render-only ablation can verify the proposed contributing group.

**Tradeoff:** one small matrix quickly separates source groups without changing the groom. Identity colours run through production hair lighting and change the scattering appearance; mixed colours are not exact per-pixel ownership. Judge contour and style from the hidden beauty pair, and use colour only to identify candidate owners.

The next decision should follow the observations:

- If residual short panels and crown interruptions share a front root/mass field, scope one rooted front-sector representation with continuous coverage and coherent sweep; preserve the observed long face framing and posterior/side work.
- If the crown and forehead defects belong to different groups, separate their attribution before choosing a sector. Do not keep altering the fringe to repair a cap or nonfringe defect.
- Any replacement must account for the coverage lost in this ablation. More exposed black wedges are evidence of a coverage dependency, not evidence that an open forehead is undesirable.

### B — alternative: projected source shortlist before another native capture

Use the existing hidden geometry's live projected triangles and known card order to shortlist cards overlapping the three regions. Compare their original layer and authoring trace; then hide only the small candidate set while retaining the full simulation.

**Tradeoff:** this produces a more specific source shortlist and may avoid a full identity matrix. It requires more correspondence work, and projection alone cannot prove visibility through alpha, depth overlap or shading. An actual visibility intervention would still be required before assigning the residual defect to that set.

**Choice:** A is the better next discriminator. It changes the diagnostic perspective from another local card reshape to identifying the remaining front structure. No new geometry recipe is selected by this critique.

## Limits

- This is a held-pose visibility experiment. It does not qualify motion, collisions, garments, a new no-fringe GLB or the pending lower fallback.
- Index removal changes shadows, occlusion and temporal appearance as well as directly visible hair. The pair establishes group contribution, not sole ownership of every changed pixel.
- Black crown wedges are described by their appearance; no unobserved scalp, cap or background ownership is inferred from their colour alone.
- The existing crown interruptions and residual short front panels remain unresolved. A cleaner forehead in one ablated view does not make the ablation a finished medium-bob design.

## Follow-up — actual layer identity, 2026-09-30

The recommended identity matrix is now captured. I directly inspected [front](/Users/robault/GitHub/sugata-avatar/captures/bob-front-layers-v1/casual-front-medium-brown.png), [front-right](/Users/robault/GitHub/sugata-avatar/captures/bob-front-layers-v1/casual-front-right-medium-brown.png) and [front-left](/Users/robault/GitHub/sugata-avatar/captures/bob-front-layers-v1/casual-front-left-medium-brown.png), against the hidden beauty images above. This completes the earlier diagnostic recommendation; it is additional evidence, not a reversal of the ablation findings.

The [identity report](/Users/robault/GitHub/sugata-avatar/captures/bob-front-layers-v1/report.json) is captured with empty recorded errors. The [paired audit](/Users/robault/GitHub/sugata-avatar/captures/bob-front-layers-v1/paired-controls.json) confirms equal full recorded state and every exported geometry value, including indices, against the frozen hidden-fringe beauty arm. I independently rechecked both report pins, saved audit source, tools/packages snapshots, image/geometry pins, full exported geometry equality and fixed-state equality. The explicit added colour attribute/material override is intentional and is not part of the geometry export schema.

### Newly resolved source contributions

1. **The residual forehead stubs are dominated by root coverage, not fringe.** Front x310–520/y185–305 and front-right x110–240/y175–305 are red in the identity images. They are the same short, interrupted panels visible in the hidden beauty images. The legend assigns red to source cards 0–77. [The root layer definition](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/hair_cards.py:585) has 78 cards, `cut: None`, short initial length and low clumping; its documented coverage role does not make its ends invisible. Colour attribution is group evidence, not a claim that every red pixel belongs to a particular card.
2. **The projecting crown structure spans other layers.** Above the front root patch, the silhouette carries purple flyaway, blue surface and yellow mass ribbons. The front-right upper arc/slit around x120–350/y90–155 includes those colours, with a grey cap patch below around x220–330/y125–155. Thus a root-only or fringe-only fix would leave a separate crown continuity problem. The [identity legend](/Users/robault/GitHub/sugata-avatar/tools/critic/hair-attribution-browser.mjs:6) and existing hidden beauty slit are the source and appearance witnesses; colour alone does not establish every boundary's depth ownership.
3. **The long face framing is a third coverage obligation.** The front-left cheek ribbons around x600–685/y250–550 are chiefly mixed blue/purple with green/cyan beneath, continuing much farther than the root ends. They survive the fringe removal. A replacement should preserve their useful length and face exposure while joining the upper field coherently; simply sweeping all visible cards sideways could change the face framing that this experiment was supposed to retain.

### Two concrete next alternatives

**A — preferred: inventory, then one bounded shared front support/flow prototype.** Use the existing live projections and source card layout to declare the actual cards occupying the three regions above, their authored roots, and any overlap with protected side/posterior geometry. Then construct one isolated front-sector experiment that gives root coverage, fringe and relevant overlying front/crown guides a common smooth support and flow. Preserve the current part as the initial condition rather than choosing a new part side from these photographs. Preserve long face-card endpoints and already-qualified side/posterior portions explicitly; preserve root attachment, topology, widths and alpha/material for attribution. The common field must maintain needed scalp/cap coverage rather than merely moving the red stubs out of sight.

The predicted gain is a continuous upper-to-front curve with fewer abruptly exposed short panels and smaller structural gaps. This is a representation hypothesis, not an inferred numeric target or a proven fix. It is warranted by the actual coexistence of root stubs and overlying multi-layer crown breaks. It does not warrant a global groom rewrite or another set of arbitrary per-card endpoints.

**Tradeoff:** this addresses the observed interaction between layers and is more informative than another fringe-only smoothing pass. It changes more than one layer, so the selected records, seam and preserved coverage must be declared before construction, followed by fresh rest/appearance/motion qualification. If the projected crown owners cannot be included without changing a previously protected side/posterior portion, stop at the inventory and scope that boundary explicitly; do not silently expand the experiment or claim isolation.

**B — narrower alternative: render-only front-root shortlist ablation.** Select only the root cards whose projected triangles overlap the red forehead-panel regions, keep fringe hidden, and remove that small set's render indices after attachment while retaining the full solver. Predict disappearance of the red-panel stubs with the mixed crown ribbons still present. Compare front and front-right beauty images and record the newly missing coverage before proposing geometry.

**Tradeoff:** this offers a stronger causal check for the particular root subset and a clear map of its coverage contribution. It is likely to reconfirm the already strong layer attribution and leaves the crown and front joining problem unsolved. The removal is diagnostic; it is not a finished haircut. Prefer it if source correspondence or the protected-region boundary makes A premature.

**Selection:** proceed with A's read-only inventory and explicit boundary first, then one shared-field prototype if that scope is coherent. No additional broad layer ablation is needed merely to reconfirm that the red panels come from root cards. Do not independently smooth, lengthen, delete or recolour the 34 fringe cards as the whole front repair.

### Separate qualification note

The lower-fallback head audit is a different experiment and does not qualify any proposed front changes. Its completed [candidate head report](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/candidate-right-profile-brown/numerical-checks.json) records 556 sampled states with zero selected triangle/body pairs and a minimum signed vertex clearance of 0.0781307504 mm at frame 255, card 123, ring 16, side 1. That close positive sample is not a robustness margin, a continuous-time proof or all-motion acceptance. Ordinary qualification and the separate front moving witness remain outside this front-structure decision.
