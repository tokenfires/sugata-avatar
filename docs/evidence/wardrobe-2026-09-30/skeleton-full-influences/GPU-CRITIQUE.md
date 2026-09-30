# Independent critique: eight-influence WebGPU position probe

## Disposition

**Accept V2's finite GPU position comparisons and the inspected visible regions of its static images.** All nine clean body/pose cases pass against both actual full-native skin and the packed CPU calculation under the unchanged strict **less than 0.342 mm** maximum-distance bar. The two deliberately changed controls fail against native while agreeing with their corresponding CPU predictions. The full-target context views crop the feet, so the planned full-body visual coverage is incomplete. This is a framing limitation, not a demonstrated skinning defect.

The [V2 report](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/report.json) has SHA256 `0b272c6531241d18992d8e99c90bc723654c233cf110aa832042e4d3133a478d`, status `observed`, `passed: true`, and no recorded errors. PID 11942 ran 18:36:51.367–18:36:56.118 UTC. Every case records WebGPU, Apple / metal-3, Three revision 185 and four-component output stride. The report records five private storage attributes released, renderer disposal, and closure of the owned browser and temporary server. I launched no native/GPU/browser job.

This is an isolated compute and static plain-material result. It does not qualify production eight-weight skinning, animated normal/tangent transforms, velocity history, wardrobe coupling, live body changes, wider identities or performance. Accepted assets remain unchanged.

## Independent numerical and binding review

I verified all **40 declared input hashes**, **17 preserved source/report copies**, the 11 compressed and decoded output hashes, and all eight original PNG hashes. Prepared data SHA256 is `7b6880c44fe4ccbcd3453c00ad1f00cc86a6ccb9a9e9ce732826983896488cea`. Prepared data and kernel source are exactly the V1 bytes. All 11 V2 GPU position arrays are also exactly equal to the corresponding V1 observations; this does not change V1's failed run status.

I checked the prepared eight-slot rows against the CPU representation, accepted-four rows against the parsed accepted asset, shaped positions and references against the frozen parent packets, and the 26,756 body triangles against the previously admitted actual topology. Independently reconstructing pose × inverse(rest) with row-major multiplication and an affine adjugate inverse agrees with the prepared matrix arrays within 5.45e-16. Every returned coordinate round-trips exactly through float32, and each case contains all 14,517 exported vertices.

I independently recomputed **319,374 Euclidean vertex residuals across 22 metric sets** from actual GPU readbacks and their frozen expected arrays. Maximum disagreement with the stored residuals is 2.85e-14 mm; all maximum vertices, RMS values, pass flags and neutral/identity control dependencies agree.

| Actual GPU comparison | Independently recomputed maximum, mm | Witness |
| --- | ---: | --- |
| Clean GPU versus full native | 0.000716118630 | Full-target coupled, vertex 8953 |
| Clean GPU versus packed CPU | 0.000250959832 | Target 0.25 coupled, vertex 1503 |
| Restored accepted-four versus full native | 1.589272119700 | Neutral coupled, vertex 4561 |
| Restored accepted-four versus its CPU prediction | 0.000250419679 | Vertex 9203 |
| Stale neutral binds versus full native | 106.885741027618 | Full-target coupled, vertex 14356 |
| Stale neutral binds versus its CPU prediction | 0.000249558805 | Vertex 1812 |

The original accepted-four and stale-bind failures remain interpretable because their clean parents pass. Neither is counted as a clean case. The finite arithmetic result preserves the native reference and original threshold; it does not replace them with a self-comparison. The earlier [CPU critique](CRITIQUE.md) records the actual omitted thigh influence at vertex 4561 and the complete row distribution.

## What the rendering source actually does

The bound [browser source](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/source/tools/critic/eight-influence-gpu.mjs) uploads shaped positions and matrices as float32 and expands the stored uint8 joint IDs to uint32 for storage access. Lines 27–34 sum both four-component groups inside the GPU kernel. CPU skinned positions are not uploaded as its answer. Line 41 makes the candidate position node read the actual compute output storage; lines 53–57 read that same output back for measurement.

For inspection, lines 61–63 use each arm's observed positions to recompute geometric vertex normals and bounds. The candidate surface still draws from the live storage output. This shared static-normal method makes the images useful for comparing the observed surfaces; it does **not** exercise or qualify eight-influence skinned normals/tangents. No displacement is amplified. Expanding joint indices to uint32 also means this run does not establish the bandwidth of an eventual uint8 vertex-attribute implementation.

All four native/candidate camera, target, light, normal-method and topology record pairs match exactly. Source code and the geometry references support those pairings. The declared hashes bind the saved sources and dependencies; they are not a claim that every browser-internal or transformed Vite module was separately inventoried.

## Actual image review

I directly inspected all eight original 1200 × 1000 PNGs.

- **Neutral coupled context:** [native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-context-native.png) and [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-context-gpu.png). The body silhouette, bent arms, torso and visible feet show no attributable mismatch at this display scale.
- **Neutral coupled waist:** [native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-waist-native.png) and [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-0-waist-gpu.png). The left outline around x110–325 and the broad surface/shading through approximately x400–1050, y250–800 remain visually consistent. I see no candidate-specific crease, hole or displaced silhouette in this crop.
- **Full-target coupled context:** [native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-context-native.png) and [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-context-gpu.png). Visible upper-body and leg shapes match in this fixed view. Both feet extend below the image boundary, discussed below.
- **Full-target coupled waist:** [native](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-waist-native.png) and [GPU](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v2/body-1-waist-gpu.png). The outline and subtle tonal transition across the same 180 mm vertical crop are consistent between arms. No newly attributable local break is visible.

This is direct static inspection, not pixel identity, continuous motion perception or complete-avatar appearance acceptance. The images use an untextured plain body and recomputed normals, with no clothes, ordinary skin material or hair. The numerical result covers all exported vertices, including the cropped feet; visual inspection covers only visible image regions.

## Actionable framing shortfall and alternatives

**Witness:** in both full-target context originals, the lower limbs meet the bottom border around x475–530 and x705–765 at y999; the feet are cut off. Browser source lines 64–67 use the same fixed target and 1.95 m vertical span for both bodies. Consequently, these two images do not fulfill the plan's full-body visual coverage. They do not show a candidate-specific deformation failure.

- **Recommended alternative A for this checkpoint:** retain these originals as partial-body context and explicitly leave full-target feet visually unqualified. This preserves the actual evidence without another capture and is sufficient for the narrow visible-region disposition above. It cannot support a full-body appearance claim.
- **Alternative B:** add exactly two supplementary full-target native/GPU context images with one shared wider framing that includes both feet, keeping all geometry, material, light and numerical inputs fixed. This completes the planned coverage at the cost of a small additional capture and reduced on-screen detail. Preserve the original V2 views and their limitation; no kernel or geometry adjustment is justified.

No observed visual mismatch supports a skinning correction or another parameter pass here. Root's choice to retain the scoped views is compatible with this acceptance, provided the full-body visual claim remains open.

## Preserved V1 failure and bounded recovery

The [V1 report](../../../../captures/skeleton-full-influences-gpu-2026-09-30-v1/report.json) remains **failed** at its empty-console-error assertion after completing 11 numerical cases and eight images. Its missing-resource message did not include a URL. The separate [initial-load diagnostic](../../../../captures/skeleton-full-influences-network-2026-09-30-v1/report.json) made no `runCase` or `drawCase` calls and reproduced the error with `/favicon.ico` identified by console location, CDP Log and Network 404 receipts. Document, module and input-data requests were successful in that replay. This identifies the replay's missing resource rather than inventing a request-level receipt for V1.

- **Selected recovery A:** provide an explicit inline favicon and retain the unchanged error gate in a fresh output root. It avoids another network dependency. V2 also records console locations for any future failure.
- **Recovery alternative B:** serve an actual pinned favicon asset. It would address the same missing request but adds a resource and binding. Suppressing generic 404 errors would not preserve the declared gate.

V2 uses the same kernel and prepared data, with the page-resource correction and reporting/output-root changes. Its empty recorded errors and complete disposition close this bounded recovery; they do not retroactively make V1 pass. The previous failed accepted-four native-reference packet likewise remains failed.

## Next boundary

The results justify carrying full influences forward to a deliberately scoped integration design. The next decision must explicitly address normal/tangent transformation, the current four-influence production and CPU-query paths, previous-frame positions, and how rest/bind state updates with body changes. None of those is established merely by this static GPU position result. There is no reason from this evidence to tune weights, weaken the native gate or alter source geometry.
