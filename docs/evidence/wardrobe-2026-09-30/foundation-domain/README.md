# Continuous torso-domain feasibility

## Result and limit

The recorded source weight field supports a continuous contour through the underarms without changing anatomical heights or bone weights. The calculation gives one oriented component, Euler zero, valid vertex links and two simple boundary loops. **Its declared all-triangle representation nevertheless fails on five zero-area triangles.** No native garment or actual appearance result follows.

All five are unchanged homogeneous-positive source triangles, already flat before either plane cut. For example output2648 is source3906 `[2624,4198,856]`, belonging to intact native pentagon1832 `[823,2624,4198,856,218]`. Vertex4198 lies exactly between its two neighbours. Field clipping added no vertex to that triangle. The original native pipeline retains the polygon through offset and relaxation; this observation converted the entire intermediate surface to triangles earlier. The source of those flat ears is established, but a broader cause of native triangulation behavior is not.

## Exact contour evidence

The fixed height interval contains 14,256 source loop triangles. Exactly 265 cross the torso/arm field with positive area inside that interval; eight additional crossing triangles merely touch its boundary from outside. All 265 have a fixed active winner pair over all corners: spine_03 versus the corresponding upperarm bone. This admits an affine difference field throughout each mixed triangle.

The operation creates 267 shared cut vertices, retains 7,192 vertices and 13,367 diagnostic triangles. The upper loop has 625 edges: 360 height-plane segments and 265 domain segments, spanning native Z `1.246840477`–`1.269508958 m`. The lower loop has 392 edges at `1.152314425 m`. Every edge is accounted for by one of these boundary definitions. All stored winning-weight differences at cut vertices happen to be zero in this packet; membership still uses explicit intersection provenance, not an assumed stable dominant-bone tie order.

The independent critic identified a missing proof for homogeneous triangles: max-weight differences can change sign inside even when their vertex signs agree. The separate [certificate observation](CERTIFICATES.md) supplies a common dominating torso bone for each of 12,970 positive triangles and a common dominating non-torso bone for each of 1,021 negative triangles. Together with 265 mixed fixed-pair certificates, all 14,256 are covered. These are affine inequalities across the recorded triangles, not a general theorem that corner classification is sufficient.

## Chosen next representation

Preserve homogeneous native polygons and decompose/split only the 138 genuinely mixed slab polygons along their frozen original loop triangles. All 276 triangles belonging to those mixed polygons are nondegenerate in the actual source. Four crossing edges on the ceiling also touch outside-neighbour faces; their shared cut vertices must propagate to those faces before the original normal/offset/relaxation stages. Otherwise the padded surface would have T-junctions. Example edge `[10214,10431]` joins mixed polygon5181 and outside polygon10053.

This is a separately declared representation contract, supported by the actual inherited-zero-area conflict. It does not mark the all-triangle V1 pass or merely delete its degenerate faces. The alternative is a deterministic nondegenerate triangulation of the entire padded patch, which changes more topology and shading. Any native continuation must preserve all weights, masks, corner UVs and outside support, then re-establish final topology, skin, coverage, clearance and actual images. No height, field threshold, offset or refinement sweep is selected.

## Commands and recovery

- `node tools/critic/foundation-domain-feasibility.mjs > tmp/foundation-domain-sep30/feasibility-v1.log 2>&1` — PID4513, 21:43:13.495–21:43:13.707 UTC. Command exit0, **logical status `domain-contour-failed`**. Report SHA256 `509f4028c385d730e005a5d33aa11c2033aa6a7e862e8ab6a58e23a6bd77ef0a`.
- `node tools/critic/foundation-domain-certificates.mjs > tmp/foundation-domain-sep30/certificates-v1.log 2>&1` — PID8963, 21:46:04.551–21:46:04.625 UTC, exit0. Report SHA256 `0d2ee471a68c71e4026e5ba066e419c301a92d431d6f2ded6732d91adb1ec40f`.

The raw roots `captures/foundation-domain-feasibility-2026-09-30-v1` and `captures/foundation-domain-certificates-2026-09-30-v1` are frozen. The [manifest](archive-manifest.json) binds **21 files / 15,922,246 bytes**, SHA256 `a25f2e065f851fb8945f7693b35d4723f266e43b9213777e59bc2071ed6a7593`. Source copies and compressed/decoded bindings were checked. This is a local archive only.

All jobs exited. No native runtime is mounted and no CPU/GPU job is live. The preceding owned disk14 was detached at21:36:15.981484UTC. Preserve Vite2323/5173. Accepted assets, masks, weights and product sources remain unchanged. The [independent field critique](CRITIQUE.md) is complete, SHA256 `77edc99b3581decd6120d26f1ba69af2ec32b58cd232fae7f118b502c9a1fd11`. Root chooses the separately declared [native polygon-preserving contract](../foundation-domain-native/PLAN.md), including measured support-adjacency changes. No new native job or mount has started.
