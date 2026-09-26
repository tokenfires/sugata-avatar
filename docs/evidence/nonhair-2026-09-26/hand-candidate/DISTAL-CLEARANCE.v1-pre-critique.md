# A bounded distal-arm clearance diagnostic

The new operator is useful as a **sufficient, source-region-scoped separation certificate**. It catches the important zero-crossing trap: at C637 right, the earlier hand/trouser test reported zero crossing pairs, but none of the 3,166 legacy hand faces satisfies the outward body/clothing corridor. Including the forearm and boundary faces leaves 3,542 of 3,907 faces unproven against the declared body target and 3,600 against the complete worn surfaces. This is evidence against treating zero selected crossings as clearance; it does not independently prove containment or penetration depth.

The same operator also has genuine positive cases. A455's complete selected distal regions have conservative body separation bounds of **0.014317713677883146 m left** and **0.018562048673629757 m right** against the final declared body target. A455's legacy hand-only regions have bounds of about **78.17/88.24 mm** against all worn surfaces. Full distal-versus-clothing certification remains unproven in every measured case because the broader source region includes proximal skin around the sleeve. No product clearance margin or candidate angle has been selected.

## Exact source coverage

All geometry comes from the completed, sealed `captures/hand-attribution-2026-09-26/primary-v4` A/B/C runs. Only steps 0, 455, 637 and 720 were measured here: 12 retained native snapshots, not a new animation or GPU run. Both compressed and decoded snapshot hashes, full source topology and source GLB hashes are checked. Body source is the actually loaded `assets/wardrobe/body/g050.glb`, SHA `fc4445c95ed3f423734ff272ee78ebb44d762a8f16edb94b26039de7a8a96b3a`. World coordinates follow the retained capture's metre convention; its root preserves the lateral x axis. Left is outward +x, right is outward −x.

Query faces are the union of **every full body triangle incident to any vertex with any positive lower-arm, hand or finger joint weight**, including triangles crossing the support boundary. This includes all legacy all-three-vertices ≥0.5 hand faces. The union is partitioned by exact source-rest x half-space; every selected distal face lies wholly on one side. It covers the source's complete distal skin-support region, but skin weights are not an independently reviewed anatomical segmentation.

| Query region | Left | Right |
| --- | ---: | ---: |
| Legacy hand faces | 3,166 | 3,166 |
| Distal faces including support boundary | 3,909 | 3,907 |
| Added beyond legacy selection | 743 | 741 |
| Faces with at least one vertex outside distal support | 57 | 57 |
| Incident raw vertices | 2,214 | 2,213 |

The source has a relevant anomaly: vertex 2070 is on the right hand, with `index_01_r=0.9619961977`, `hand_r=0.02900290117`, `index_02_r=0.008400840685`, and `middle_01_l=0.0006000600406`. A naive left-positive-weight selector includes six right-hand faces. Taking the full distal union before its source-side partition preserves the vertex in the right query region rather than dropping the influence or inventing a cutoff.

Body targets were measured separately:

1. V1 retains all body faces except the query distal faces, then also reports an exact one-ring attachment exclusion. Shared elbow/proximal-arm skin makes positive distance to that target an unsuitable general requirement. No result from this profile is silently promoted to a whole-body claim.
2. The requested literal whole-arm rule removes all faces incident to any positive ipsilateral upper-arm-or-descendant support. It removes 4,870 left / 4,857 right faces, including some spine-dominated torso faces and six opposite-hand faces for the left query. Calling this complete torso/opposite-arm coverage would be false.
3. **The final `sourceHalfSpace` profile** excludes whole-arm-support faces only when every source vertex is strictly in the ipsilateral x half-space. It retains all 68 midline-touching faces and all opposite-half-space faces as obstacles. Each side excludes 4,806 faces and retains 21,950. Its excluded attachment boundary has 141 faces; 157 retained target faces touch the excluded source positions. Compared with the literal rule it restores 64 left / 51 right faces and excludes no additional face. Some mixed ipsilateral torso faces still belong to the removed support region: this is a declared scope hole, not anatomy truth.

The complete face IDs, boundary IDs, exact source weights and limiting posed coordinates are retained in `distal-regions-v1.json` and `ipsilateral-corridor-v3.json`. There is no distance-based seam growth, weight cutoff, dynamic nearest-face removal or hidden clothing exception.

The separate clothing target includes **all 42,144 full source faces** of the worn bra, briefs, casual outfit and shoes, including masked faces. No sleeve face is excluded. Body and clothing certificates must remain separate. Hair, eye/cornea/accessory meshes, intra-hand self-contact and all-motion clearance are outside this diagnostic.

## Certificate and positive numerical bound

For each query triangle A and target triangle B, let `gx` be the signed outward x gap: `min(A.x) − max(B.x)` on the left, or `min(B.x) − max(A.x)` on the right. Let `gy` and `gz` be the signed interval-separation gaps along y and z. A nonpositive gap means the intervals overlap or touch. Triangle extrema are exactly the extrema of their three vertices.

For an explicit nonnegative margin m, every target whose inclusive y/z bounds overlap A's margin-expanded y/z bounds must satisfy `gx > m`. If not, return **unproven**. Otherwise each triangle pair is separated by more than m on at least one axis, so its Euclidean distance is greater than m. At margin zero, an outward x ray from any query point cannot hit a target face. A closed target surface enclosing the query would have to block such a ray, so a complete enclosing target cannot receive this certificate. The argument does not assume that garments are watertight.

The measured positive bound is `min over all triangle pairs of max(gx, gy, gz)`. A positive value is a conservative Euclidean separation lower bound for those selected triangle sets. Inward x separation is deliberately never converted to an absolute distance: an enclosed/inward hand cannot pass merely because it is far inside an outward garment face. Negative output is not penetration depth, and a failed bound is not proof of contact.

The implementation rounds expanded bounds outward and arithmetic gaps downward by one IEEE-754 ULP. A y/z grid only accelerates pair enumeration; exact inclusive bounds still decide relevance. For positive-bound enumeration, an actual pair supplies an initial bound on the minimum. Targets outside that expanded y/z neighborhood already have a larger separating-axis bound and cannot reduce the result. When there are no y/z-overlapping pairs, the first query triangle against every target supplies the initial bound; no arbitrary seed margin or bisection is used. The implementation is a sufficient certificate over the retained piecewise-linear triangles, not a general collision solver or a proof about unsampled motion.

Nine corridor CPU control groups exercise true positive separation, mirrored right-side behavior, exact contact, exact margin boundaries, a fully contained triangle with no surface crossings, disjoint triangles whose y/z boxes overlap, shared connected-boundary geometry, grid invariance and outward rounding/explicit-margin admission. The positive-bound controls also cover a nearby target outside the initial y/z overlap and the entirely non-overlapping-y/z case. Synthetic disjoint projected triangles demonstrate a real false-negative mode: the box test can return unproven even when the triangles are disjoint.

## Measurements and limits

The table reports the final declared body profile. Bounds are approximate millimetres for reading; exact downward-rounded values are in the JSON. `U(n)` means n query faces were unproven at zero margin, not n contacts. Full-clothing results always use the complete distal query region.

| Native case | Body left | Body right | Full-clothing unproven faces L/R |
| --- | ---: | ---: | ---: |
| A0, B0, C0 | U(264) | ≥1.80909 mm | 613 / 102 |
| A455, B455 | ≥14.3177 mm | ≥18.5620 mm | 20 / 32 |
| A637 | U(3,318) | U(3,123) | 3,377 / 3,284 |
| A720, C720 | U(2,923) | U(2,905) | 3,280 / 3,279 |
| B637 | U(164) | ≥12.9748 mm | 407 / 31 |
| B720 | U(741) | ≥2.19970 mm | 963 / 31 |
| C455 | U(749) | ≥3.71885 mm | 1,132 / 65 |
| C637 | U(3,364) | U(3,542) | 3,541 / 3,600 |

The A455 body lower-bound witnesses are body query face 16026 versus body target 20630 on the left, and query 2788 versus target 7394 on the right. Their target vertices have spine/pelvis weights; the query boundary includes upper-arm-dominant vertices and low lower-arm blends. The JSON preserves all coordinates and skin weights for both sides.

For A455 full clothing, the limiting pairs are body face **16009 versus casual face 1202** on the left, and body **2803 versus casual 1250** on the right. Their conservative outward gaps are −75.1463/−81.7188 mm; these are **not penetration depths**. They lie in the proximal arm/sleeve region. Query vertex 9046 has `upperarm_l=0.9836000204`, `lowerarm_l=0.01640000008`; query 1828 has `upperarm_r=0.9792000055`, `lowerarm_r=0.02080000006`. The limiting query and garment triangles are actually disjoint in x, with the garment farther outward. This exposes the distinction between requiring an exterior corridor and permitting skin inside its own sleeve. It does not authorize discarding these faces or treating all other failed pairs as harmless.

The C637 right failure is qualitatively different: the limiting full-clothing pair is body face 3395 versus trouser face 2707, near world y=0.69–0.74 m. The body's x range is approximately −0.079 to −0.074 m while the trouser face is around −0.202 to −0.196 m; the corridor correctly remains unproven despite zero legacy hand/trouser crossing pairs. No global volume/inside label is inferred from this one witness.

## Minimal next experiment

The next geometrically measurable candidate axis is **authored outward placement of the complete resting distal arm through the native shoulder rest**, then a full-distal-aware inward posture budget using that same initialized pose family. The initialized A0 left failure remains when either study term is suppressed, while C455 can lose useful gesture clearance; the experiment therefore does not support choosing gesture suppression as the correction. Do not choose angles or a passing margin from these counts alone.

A candidate should first reproduce the accepted initialization control, then measure its unchanged full hand/finger/forearm face sets at initialized neutral and the retained angry witnesses. Its standing/weight-shift rest inputs and native cached bindings must stay coherent, as mapped in `hand-clearance/CANDIDATE-INITIALIZATION.md`. After a candidate is authored, preserve its exact bytes and report the body certificate, full clothing failures, old crossing witnesses and real rendered views separately. Keep the existing native posture/gesture dependence honest; this diagnostic does not justify changing a prescription while leaving rendered-angle telemetry false.

This operator can certify a positive body-region separation bound for a discrete pose and can prevent zero selected crossings from being mistaken for clearance. It cannot certify omitted mixed torso regions, an anatomical segmentation, full forearm exterior clearance from its own sleeve, perceptual naturalness, or continuous motion. A future clothing gate needs an explicit reviewed attachment/inside-sleeve policy or a more local signed-surface method; none is silently introduced here. The bounded feasibility result is sufficient to inform one authored candidate without building a general anatomical solver today.

## Reproduction and preserved stops

- `distal-corridor.mjs`, `distal-corridor.selftest.mjs`, `measure-distal-corridor.mjs`: v1 operator, controls and complete initial 12-pose measurement. V1 result SHA `604a645efaca2b3d3c83c69cf87c12821cad1959b8f3b23eb3a40307523ae6ed`; region SHA `4fcd74bdf3478895ee538dd38f0f67c53f28434401d417a4f4990b285fedd933`.
- `distal-margin-bound.mjs`, its self-test and `measure-ipsilateral-corridor.mjs`: completed v3 target comparison and positive bounds. Result SHA **`40f1047e3c81fb7c783529c17376db51e0a1203c6f6626e981b5d26fab5c0602`**.
- The first v2 source preflight correctly stopped on 68 midline-touching faces; its witness and exact rejected script are preserved. The next v2 attempt stopped after A0 because the original numerical helper did not handle a null overlap-derived seed. Its partial `completed:false` report, exact helper/test and measurement source remain preserved. V3 repairs the instrument's seed case and keeps all midline faces; it does not relax any native or clearance condition.
- Measurement scripts require fresh output files and never change source assets. Do not delete the retained results to rerun them. Use an isolated copy with the same exact capture inputs and fresh evidence output directory. The CPU self-tests can be run directly; neither launches a browser.

Source hashes, test receipts, preserved-attempt mappings and the final result bindings are in `DISTAL-CPU-RECEIPT.json`. Independent critic review of the operator is separate from this implementation report.
