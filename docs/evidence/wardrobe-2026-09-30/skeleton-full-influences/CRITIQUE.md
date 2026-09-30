# Independent critique: complete influence storage and CPU arithmetic

## Disposition

**Accept this finite CPU representation result.** All nine combinations of the three admitted bodies and three poses pass against actual full-native skin under the unchanged strict maximum-distance bar of **less than 0.342 mm**. The complete double rows and their eight-slot float32 representation both reach at most **0.000594698250 mm**. This does not revise the failed accepted-four packet, change any shipping asset, or qualify GPU rendering, normals, animation or runtime rebinding.

Evidence: [declared plan](PLAN.md), [actual report](../../../../captures/skeleton-full-influences-2026-09-30-v1/report.json), [comparison source](../../../../tools/critic/compare-skeleton-full-influences.mjs). Report SHA256: `eac81ac3b1f5e66b17e0dbdb1606bdc0d479290c2b7cd0d85c6ebd6a71f13df3`. The single execution was PID 90157, 18:23:14.180–18:23:17.004 UTC. I did not execute the authored comparator or launch a native/browser job.

## Independent reconstruction

I checked the 30 declared input bindings, eight preserved source/report copies, compressed and decoded artifact bindings, and the frozen parent references. Using an independent Python calculation, I reconstructed complete normalized weight rows from the actual native observations and exported vertex map; round-tripped joint indices through uint8 and weights through float32; and rebuilt the padded rows. I used row-major matrix multiplication and an affine adjugate inverse rather than the comparator's Three `Matrix4.invert` implementation. Shaped positions and constructed rest/pose matrices remained the frozen parent inputs.

The reconstruction covered every full/packed position, all three comparisons in all nine cases, both negative controls, their mutation/reproduction checks, and the declared neutral/identity control dependencies: **464,544 vertex residuals across 32 metric sets**. The largest coordinate disagreement with stored predictions was 8.89e-16 m; the largest residual disagreement was 8.94e-13 mm. Two locator IDs changed under independent near-zero/tied roundoff in the four-output reproduction and stale-output mutation measurements; neither changes a maximum, gate, or substantive witness.

| Independently recomputed maximum | Millimetres |
| --- | ---: |
| Complete rows versus full native, all nine cases | 0.000594698250 |
| Packed rows versus full native, all nine cases | 0.000594698250 |
| Packed versus complete rows | 0.000064632080 |
| Restored accepted-four versus full native | 1.589239584043 |
| Neutral binds retained on the full-target coupled body | 106.885736742497 |

All clean parents pass before their dependent cases are interpreted. Both corruptions have passing clean parents, materially different outputs, and failed native comparisons. The accepted-four output also reproduces the previously failed prediction within approximately 6.01e-13 mm. No tolerance was relaxed to obtain these outcomes.

## Storage and the actual omitted influence

The representation contains 14,517 exported vertices with the following positive-influence counts: 7,105 with one, 4,575 with two, 1,501 with three, 698 with four, **623 with five and 15 with six**. These 638 exported vertices with more than four influences include split copies of original body vertices; they are not 638 distinct original vertices. No exported row requires seven or eight positive influences. All 116,136 stored joint entries and equally many stored weight entries round-trip through the declared types exactly. Unused slots contain joint zero and weight zero.

The complete native rows are equal across all three admitted bodies. Complete rows are normalized once, then individually rounded for storage; blending does not normalize them again. Packed sums range from **0.9999999515712261 to 1.0000000447034836**. The resulting full-versus-packed residual is separately retained rather than assumed zero. This exported-body representation does not claim to contain the 5,778 helper vertices preserved in upstream native observations.

The decisive earlier witness remains exported vertex **4561**, mapped to original **4169**. Its native row contains pelvis, spine_01, spine_02, spine_03 and **thigh_r weight 0.029205841943621635**; the accepted-four representation omitted thigh_r and renormalized the remaining four. With the same positions, constructed matrices and binds, the packed full row now differs from native at that vertex by approximately **0.000018952 mm** in neutral coupled, **0.000012227 mm** at target 0.25, and **0.000029765 mm** at target 1. Restoring the old four weights restores the 1.589239584 mm failure. This is strong finite evidence for preserving the missing information; it is not a newly observed conspicuous appearance improvement. The earlier [numeric and actual-image critique](../skeleton-posed-skin/CRITIQUE.md) remains applicable to that distinction.

## Resolved prelaunch instrument finding

Before execution, the coordinate-transform literal contained 15 entries. Passing that list to `Matrix4.set` would leave the final element undefined. The recorded execution uses the corrected 16-entry matrix and finite length admission at comparison source lines 18–19. This was repaired before the first run and is not a failed representation experiment.

- **Selected alternative A:** correct the literal and assert exactly 16 finite values. This preserves the declared coordinate mapping and catches the same class of error directly.
- **Alternative B:** construct explicit basis vectors with `Matrix4.makeBasis`. This avoids counting a flattened literal but introduces another construction path that would need its own mapping check.

No remaining material arithmetic, normalization, storage or control defect was established in the executed CPU source.

## Next qualification boundary

The CPU observation is sufficient to proceed to a bounded GPU position experiment. It is not sufficient to attach eight values to the current production skinning path and claim it uses them. The installed Three source still fetches only `skinIndex`/`skinWeight` as four-component attributes: [Skinning.js](../../../../node_modules/three/src/nodes/accessors/Skinning.js) lines 134–135. Its position sum uses x/y/z/w at lines 40–44; its normal/tangent sum is likewise four-component at lines 65–76. The CPU mesh query in [SkinnedMesh.js](../../../../node_modules/three/src/objects/SkinnedMesh.js) lines 324–351 also loops over four influences. This is a concrete integration boundary, not a defect in this isolated result.

- **Recommended alternative A:** keep an isolated eight-influence GPU kernel, read back every output for the same nine cases and both corruptions, and draw actual candidate geometry from that output in matched native/candidate views. Record upload precision and inspect unamplified images. Explicitly separate a shared geometric-normal inspection method from qualification of skinned normals/tangents. This gives a falsifiable hardware result with little product coupling, but leaves dynamic rebinding, velocity history, ordinary avatar materials and CPU surface queries open.
- **Alternative B:** extend the normal production vertex path and corresponding CPU queries together, then qualify normals/tangents, shadow and motion-history behavior as part of that integration. This addresses the eventual product architecture directly but expands the number of interacting mechanisms before GPU position arithmetic has been observed.

The selected next [GPU plan](GPU-PLAN.md) follows alternative A. No GPU result or new image is incorporated in this CPU disposition. Broader body identities, other poses, wardrobe coupling, actual motion and performance remain separate evidence requirements; the unchanged accepted assets remain default.
