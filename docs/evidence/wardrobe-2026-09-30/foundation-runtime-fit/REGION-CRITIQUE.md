# Independent bounded contact-region review

## Disposition

**A specific nonadjacent body self-intersection in the recorded runtime pose is confirmed.** The retained-target inventory and selected winding/parity disagreement also reproduce independently. This establishes a local complication in the fit environment; it does not explain all band/body contacts, remove the elegant blouse failure, or change the failed full-body gate. All candidate and accepted bytes remain frozen.

Reviewed [report](../../../../captures/foundation-contact-regions-2026-09-30-v1/report.json), SHA256 `32f3ab5fb46e362187c27e3da5957b66efc99723edc8276c765533939277e648`, PID 15011, completed `2026-09-30T23:42:21.647Z`. All 15 current input hashes and archived copies independently verify. No native/GPU job or asset edit was performed.

## Inventory checks and limits

I independently parsed the actual source GLB joint names, joint indices, Float32 weights and body indices. Reciprocal-L1 normalization with Float32 storage reproduces every recorded target descriptor. Recounting the original crossing rows produces:

| Step | Stored target dominant `upperarm_r` | `upperarm_l` | `spine_03` | Total crossing band triangles | Winding/parity-disagreement rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 90 | 99 | 247 | 436 | 126 |
| 240 | 84 | 89 | 256 | 429 | 150 |
| 480 | 87 | 86 | 260 | 433 | 152 |
| 720 | 90 | 82 | 259 | 431 | 145 |

Each descriptor is the largest **mean normalized joint weight** of the one stored target triangle selected by the preceding distance audit. These counts are neither all intersecting pairs nor anatomical segmentation. The spine-dominant majority at each time prevents an unsupported conclusion that all band crossings are arm contacts.

Exact source-rest position welding independently gives **13,380** positions. For each selected face, exactly **13** body triangles share at least one such position and are excluded; **26,743** nonadjacent faces remain. Only the two predeclared targets **2215 and 2246** were examined. The report records no nonadjacent contact for 2215 and three transverse contacts for 2246. I independently confirmed all three reported positive pairs; the review does not expand the source study into a global body self-collision inventory.

## Selected disagreement is real, not a replacement inside rule

The first predeclared step-0 row is band triangle **13415**. Its centroid is approximately **(-0.1736669341723124, 1.2516326109568277, 0.03550520911812782) m**. Its stored nearest body target is **2246**, at a positive triangle distance of approximately **0.229892 mm**; the selected band triangle itself is not a zero-distance crossing row.

Independent NumPy solid-angle summation gives winding **2.0**, consistent with the recorded **2.0000000000000004**. Independent vectorized casts in all five declared directions give **2 / 2 / 2 / 2 / 2** hits, none ambiguous; even parity reports outside. Both observations are preserved. Neither is relabelled to manufacture an exterior result. Winding 2 alone would not locate a surface intersection; the separate witness below supplies it.

## Concrete nonadjacent body/body witness

At step 0, body triangle **2246 [1547,1521,1522]** intersects body triangle **2212 [1545,1775,1765]**. Their raw vertex IDs and exact source-rest welded positions are disjoint. A separate segment/triangle calculation finds a strictly interior transverse hit at approximately:

**(-0.173423847559224, 1.2493074417591155, 0.0451270249400009) m**.

This agrees with the saved witness within **6.25e-17 m** per component. On triangle 2212's edge 0 the segment parameter is **0.5912863365346173**, with barycentric coordinates **(0.14098812608338174, 0.17911886132031316)** on triangle 2246. This is a valid crossing, not merely shared topology or a near-distance label.

The source-rest pair is separated by **7.6950515373600235 mm**. An independent separating-plane certificate at the reported closest endpoints has triangle-2246 projection gaps **+1.256670 / 0 / +11.679011 mm** and triangle-2212 gaps **−9.523083 / −6.275902 / 0 mm**. Convexity establishes the matching minimum-distance lower bound. The crossing therefore appears under the recorded pose, whereas this exact pair is separated in source rest.

The two additional reported contacts, **2246↔2650** and **2246↔2651**, also have independently reproduced transverse hits, within **1.05e-16 m** of their respective stored witnesses. Their source-rest separation is **16.561708856864424 mm**, independently supported by the same convex projection argument.

Triangle 2246 has mean `spine_03` weight **0.602104** and `upperarm_r` **0.386994**. Triangle 2212 has mean `upperarm_r` **0.838908**. These support the arm/torso-region description; they do not prove a weight-authoring error or specify corrected weights.

## Actual image boundary

I reinspected the original [exposed-band step-0 image](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/frame-0000.png). The 2246↔2212 point projects to approximately **(90.86,586.97)**; the band-13415 centroid projects to **(99.73,581.80)** on the 800×1000 canvas. Both lie in a smooth-looking grey band region. I cannot attribute a visible crease, hole or surface ownership to those pixels from this view.

All five mentioned body triangles occur in the actual drawn body index, but projection plus draw membership still does not establish visible ownership through the nearer foundation. The separate [elegant patches](../foundation-elegant-attribution/CRITIQUE.md) remain visibly and geometrically attributed to band/blouse interaction. This body/body finding does not explain them.

## Prelaunch predicate correction

The original outer AABB skip in [the inventory source](../../../../tools/critic/foundation-contact-regions.mjs) rejected any positive axis gap, while the bound triangle predicate permits its own squared-box-distance allowance of `1e-20` before its intersection calculation. That was a semantic mismatch, not evidence of a missed pair in this dataset.

- **A:** use exactly the helper's squared-box allowance, retaining a faster broad phase and its explicit numerical meaning.
- **B, selected:** remove the extra filter and call the bound predicate for every nonadjacent face. This costs more CPU but avoids a second admission rule.

The completed source uses B. No distance threshold, neighbour definition or failed garment gate was relaxed.

## Two next directions

1. **A — stop local band edits and declare a pose-aware body/foundation/outfit feasibility contract before construction.** Use the reproduced four-time surfaces, named body/body and band/body witnesses, and the independently established band/blouse crossings as simultaneous constraints; retain required chest coverage and explicit binding/mask boundaries. First determine whether the proposed local fit has conflicting surfaces rather than assuming an outward shift or weight change is sufficient. This targets the actual coupled problem, but is a larger authoring prerequisite and may show that a body or pose constraint needs separate work. No such change is approved by this observation.
2. **B — close this experimental foundation lead at its demonstrated structural gain and failed runtime/outfit qualification, keeping shipped assets as defaults.** Continue a separate bounded product workstream and preserve these exact witnesses for later authoring. This avoids an unsupported repair cycle and retains useful evidence, but defers the neckline improvement and does not satisfy replacement-foundation acceptance.

No further face search is needed for this declared study: it answered its local question. The lack of a body self-contact on target 2215 and the numerous torso-dominant stored targets remain counterweights to a global causal story. No all-motion, general body-self-intersection, visible-defect, fit feasibility or promotion certificate follows.
