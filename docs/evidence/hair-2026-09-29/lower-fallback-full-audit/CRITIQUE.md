# Independent critique — complete ribbon-card body audit

## Disposition

**Retain the frozen lower fallback as an experimental lead. Both assets fail contact-free head qualification across all 496 ribbon cards because of a shared front-root contact on card 58.** The candidate has fewer and shallower sampled contacts, but that is not clearance, perceptual improvement or a reason to promote it.

The sampled ordinary sequence has zero triangle/body pairs and zero negative vertex samples across the union of all 496 ribbon cards in both arms. The 1,128 cap triangles are excluded. These are finite, posed-body results for the recorded protocols, not a complete hairstyle, garment, continuous-time or all-motion qualification.

All four supplementary audits are now complete. No running-prefix result is used as a final result below. The earlier 338-card result remains valid within its original scope; the newly examined 158-card complement reveals the shared front contact that it could not have detected.

## Assets and complete results

- Baseline: side-v3, SHA-256 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`.
- Candidate: frozen lower fallback, SHA-256 `8c458428551ca546d2aac511dec3b516067d53050de9663a563b9884a4ae5fe7`.

The supplementary audits cover 158 cards / 5,056 triangles. The previously audited selection covers 338 cards / 10,816 triangles. Their IDs are disjoint and their union is exactly integers 0–495; the combined ribbon topology therefore comprises 15,872 triangles. Cap geometry is not included in this union.

| Protocol / arm | Samples | Prior 338-card pairs | Remaining 158-card pairs | Combined crossing frames | Combined negative vertex samples | Minimum signed vertex clearance across 496 cards |
| --- | --- | --- | --- | --- | --- | --- |
| Head baseline | 556 | 0 | 10 | 5 | 5 | −0.167944314 mm |
| Head candidate | 556 | 0 | 8 | 4 | 4 | −0.100925357 mm |
| Ordinary baseline | 721 | 0 | 0 | 0 | 0 | +1.054123996 mm |
| Ordinary candidate | 721 | 0 | 0 | 0 | 0 | +1.192698642 mm |

Final supplementary reports: [head baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-front-audit-v1/head-baseline/numerical-checks.json), [head candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-front-audit-v1/head-candidate/numerical-checks.json), [ordinary baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-front-audit-v1/ordinary-baseline/numerical-checks.json), [ordinary candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-front-audit-v1/ordinary-candidate/numerical-checks.json).

The earlier candidate results are [head 338-card audit](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/candidate-right-profile-brown/numerical-checks.json) and [ordinary 338-card audit](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/candidate-left-profile-brown/numerical-checks.json). For the unchanged control, [head replay provenance](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-v1/control-replay.json) and [ordinary replay provenance](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-ordinary-v1/control-replay.json) link the exact same-asset physical sequences to the completed side-v3 audits. The supplementary reports reference those replayed capture reports. This is explicit reuse of exact recorded geometry, not inherited qualification from a similar asset.

I independently checked complete status, final/progress equality, row counts and frame order, row time and raw-file pins against the source captures, summed pair/negative counts, saved audit-source hashes and the selection union. The linked 338-card rows have zero pairs and negative samples in every frame, so the combined pair counts and crossing frames above equal the complementary audit's counts. Minimum clearance is the lesser of the two selections' minima. No expensive oracle was rerun.

## Source and topology review

No material remapping or body-pose flaw was found for these pinned captures.

1. **The retained vertex order matches the declared card order.** [The capture helper](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-envelope-motion-browser.mjs:71) declares `otherCards` by filtering ascending IDs 0–495 against the selected set. [The readback](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-envelope-motion-browser.mjs:98) applies the same ascending complement to the GPU vertex array, extracting each card's 34 vertices. The audit uses that descriptor order when constructing its compact index map.
2. **Original triangle topology is preserved.** [Audit lines 7–14](/Users/robault/GitHub/sugata-avatar/tools/critic/audit-other-hair-motion.mjs:7) select source-GLB triangles and remap each vertex as `compactCard*34 + (originalVertex-652)%34`. Included triangles must belong entirely to one card. The audit also reconstructs the prior selected descriptor from the same source topology. Independently inspected both routed GLBs: no triangle crosses a component; every complementary card contributes 32 triangles; 158 compact connected components appear in descriptor order, each with 34 vertices and the expected ribbon topology. All 1,128 cap triangles are excluded.
3. **The body is the complete posed body.** [Helper lines 82–106](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-envelope-motion-browser.mjs:82) require world-space GPU hair, read morphed/skinned body vertex positions into world coordinates, and record corresponding posed normals. The body index descriptor uses the full wardrobe-preserved body index where available. Its indices exactly match the full pinned figure topology in all four reports. The oracle consumes `otherVertices`, `bodyPositions` and `bodyNormals` from the same raw sample; it does not substitute the rest body.
4. **Hash and incomplete-state boundaries are sound for these runs.** [Audit line 20](/Users/robault/GitHub/sugata-avatar/tools/critic/audit-other-hair-motion.mjs:20) checks each compressed raw hash, frame, recorded hash object, complement length and recomputed Float32 other-vertex hash. I independently checked raw frames 0 and 255, including recomputed other-vertex and body Float32 hashes, body/normal lengths, source report/asset pins and source snapshots in all four runs. The entire raw compressed-file hash binds the body arrays as well. [Final publication](/Users/robault/GitHub/sugata-avatar/tools/critic/audit-other-hair-motion.mjs:26) occurs only after the complete loop; a failure writes failed progress and throws. All four final files now match complete progress.

The cardinality guard alone would not establish an arbitrary future descriptor's validity. For these inputs, the explicit independent check confirmed unique 338-card IDs, the exact sorted complement, the valid 0–495 range, and original full topology. No source change is requested on the strength of a hypothetical future input.

## Concrete shared head-contact witness

Both final head audits identify **card 58, ring 16, side 1**, with the minimum at frame 256:

| Arm | Contact frames | Minimum point in captured world metres | Minimum signed distance |
| --- | --- | --- | --- |
| Baseline | 254–258, two pairs per frame | `[-0.01828536205, 1.62575447559, 0.13501535356]` | −0.167944314 mm |
| Candidate | 255–258, two pairs per frame | `[-0.01829387434, 1.62579393387, 0.13507191837]` | −0.100925357 mm |

All 34 authored POSITION and NORMAL records of card 58 are exactly equal between baseline and fallback; I independently checked the GLB slices. The contact is shared by the baseline front geometry with a slightly different live response. The measurements do not establish which shared solver input caused that response, and they do not show a candidate-authored change to card 58.

The separately saved [independent contact witness](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-front58-witness-v1/report.json) corroborates the frame-256 geometry. Its [source](/Users/robault/GitHub/sugata-avatar/tools/critic/witness-front58-contact.mjs:6) uses two-way Three.js segment/triangle intersections for compact hair triangles 638 and 639 against body triangle 14630. These are card 58's final two ribbon triangles (component 19, local triangles 30 and 31). The reconstructed endpoints agree with the original oracle within 1e-8 metres. This validates those two geometric pairs in each arm, not a second full-sequence oracle. I verified the witness source and linked final-audit pins.

The exact frame-256 front/profile raw samples are equal. The minimum point projects to roughly **(405.69,184.09)** in baseline and **(405.67,183.98)** in candidate front views. Exact frame-256 PNGs were not captured. Those coordinates are geometric locators only, not alpha-visible pixel ownership or a diagnosis of a particular brown strand.

## Actual image review

I directly inspected and hash-verified all eight original front images surrounding the interval:

| Frame | Actual pair |
| --- | --- |
| 252 | [Baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/baseline-front-brown/frames/0252.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0252.png) |
| 255 | [Baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/baseline-front-brown/frames/0255.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0255.png) |
| 258 | [Baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/baseline-front-brown/frames/0258.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0258.png) |
| 261 | [Baseline](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/baseline-front-brown/frames/0261.png) / [candidate](/Users/robault/GitHub/sugata-avatar/captures/lower-fallback-head-front-v1/candidate-front-brown/frames/0261.png) |

Short broken forehead panels and crown steps remain in both arms, including the broad vicinity of the locator. I do not see a new attributable gap or crease in the candidate in these stills. That observation does not negate the geometric contact or prove that the crossing is hidden. Alpha, depth overlap and exact frame-256 visibility have not been isolated. This contact is also separate from the previously recorded tiny frontal frame-373 dash and its fringe-card motion witness.

## Actionable finding and two alternatives

**Finding:** the expanded scope discovers a real shared front-card contact. The exact geometry, independent intersection reconstruction and contact interval are valid evidence. The sampled images do not establish a new visible fallback failure. A submillimetre metric alone is insufficient grounds for another endpoint, width, compliance or outward-offset adjustment.

### A — selected: retain the scoped lead and carry card 58 into front representation work

Preserve the exact fallback, side control, contact witnesses and failed front prototypes. Keep the lower-contour result experimental, explicitly recording that all-card head clearance fails on the shared front root. Include card 58 and its final ribbon segment in the next front attachment/support constraint review, alongside the already identified front flow and coverage obligations. Any future front construction should be checked against this recorded pose as well as the existing ordinary sequence.

**Tradeoff:** this preserves demonstrated lower-contour progress and avoids another unsupported local tuning loop. It leaves the shared contact unresolved, so the asset cannot be described as contact-free across the head protocol. It does not imply that the failed front generators should be resumed; the existing representation/boundary review still governs that work.

### B — alternative: isolate card 58's visual contribution before a targeted repair decision

If deciding whether this contact has an observable effect becomes necessary, use one exact-state render-only card-58 identity/hide comparison, preserving every solver card, geometry buffer, material alpha, time and camera. Include a contact state and a clear neighbour. A capture of exact frame 256 would close the current image gap; an intervention should only attribute visibility, not be treated as deletion of the card from the finished hairstyle.

**Tradeoff:** this can distinguish contact geometry from visible strand contribution with a narrow intervention. It requires additional native evidence, which was not launched here, and it would neither repair the contact nor resolve the broader broken front flow. Prefer A unless a concrete product decision depends on visibility of this specific contact.

**Decision:** A, consistent with the root's choice. No geometry adjustment is selected by this audit. A shallower candidate crossing is not relabelled as a pass.

## Limits

- Combined results cover all 496 ribbon cards, not the cap, and only the recorded body poses and update times. The cap remains outside this audit.
- Ordinary zero contacts and positive sampled vertices do not grant an all-motion, garment, hair-hair, alpha/occlusion or continuous-time guarantee.
- The exact replay links permit combination with prior 338-card results on the same physical samples. They do not permit reuse for a different asset or a changed solver.
- No complete playback judgment follows from eight bracketing stills. The exact worst-frame screenshot is absent; projected coordinates are locators only.
- All earlier packets remain frozen. This document expands the qualification scope; it does not erase the prior selected-card success, the remaining front appearance defects, the close selected-card head margin or the rejected front constructions.
