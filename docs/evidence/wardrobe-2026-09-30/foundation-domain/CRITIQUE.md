# Independent continuous-domain feasibility critique

## Disposition and bindings

**The declared V1 triangle-surface gate remains failed.** Its five zero-area output triangles were inherited unchanged from the archived native surface before either plane cut. The observed field intersections did not create them. This supports a separately declared polygon-preserving representation study, without converting V1 into a pass.

Reviewed [feasibility report](../../../../captures/foundation-domain-feasibility-2026-09-30-v1/report.json), SHA256 `509f4028c385d730e005a5d33aa11c2033aa6a7e862e8ab6a58e23a6bd77ef0a`; all eight declared input/source bindings and their archived copies, plus both encoded/decoded output artifacts, verify. Also independently checked the [separate certificates](../../../../captures/foundation-domain-certificates-2026-09-30-v1/report.json), SHA256 `0d2ee471a68c71e4026e5ba066e419c301a92d431d6f2ded6732d91adb1ec40f`, against the actual weight rows. No construction, native or GPU job was run by this review.

The preceding plane-only failure is preserved in [DOMAIN-CRITIQUE](../foundation-cut-band/DOMAIN-CRITIQUE.md).

## Sign classification and topology

Independent reconstruction confirms **14,256 slab triangles**: 12,970 certified inside, 1,021 certified outside and 265 mixed. Every mixed triangle has the same active torso/non-torso winner pair at all three vertices, making its weight difference affine throughout that triangle. The follow-up certificate margins match independently recomputed values exactly.

Checking only mixed triangles would have been incomplete: **628 same-positive and four same-negative triangles** change an active winner between vertices. For example triangle314 `[2814,986,195]` changes its non-torso winner from `upperarm_r` to absent, while `spine_03` still dominates all opposition throughout. Triangle3299 `[423,1212,2531]` changes its torso winner, but `upperarm_l` dominates throughout.

Two alternatives for this completeness requirement:

- **A — implemented in the separate receipt:** certify each homogeneous triangle with one bone that beats every opposing bone at all corners. Affine inequalities then establish its sign throughout. All actual homogeneous triangles have this certificate.
- **B:** partition each triangle into active-weight regions before contour extraction. This handles more general data but adds unnecessary machinery for this fully certified packet.

The output uses 267 globally shared domain cuts. Its recorded float32 winning-weight differences are all zero, but membership correctly follows intersection provenance rather than a native tie winner. Independent graph reconstruction agrees with 7,192 used vertices, 20,559 edges, 13,367 triangles, one component, Euler zero, no nonmanifold/orientation errors and no invalid vertex links. Its 1,017 boundary edges form two simple loops: lower 392 plane edges; upper 360 plane edges plus 265 domain edges, Z **1.246840477–1.269508958 m**. These are finite topology observations, not garment acceptance.

## Inherited zero-area witnesses

All five rejected output triangles are unchanged, homogeneous-positive triangles with no new domain vertex:

| Output triangle | Upper-after source triangle | Vertex IDs | Lower-before source triangle |
|---:|---:|---|---:|
| 2648 | 3906 | 2624, 4198, 856 | 3919 |
| 2801 | 4369 | 307, 3196, 1577 | 4385 |
| 2837 | 4405 | 310, 3335, 2129 | 4421 |
| 5086 | 7595 | 3345, 7376, 4778 | 7619 |
| 6766 | 10277 | 4288, 8298, 5172 | 10313 |

Independent cross products are exactly zero at every listed stage. All four pre/post-cut snapshots contain seven zero-area loop triangles overall; five survive domain selection. For example source3906 belongs to pentagon1832 `[823,2624,4198,856,218]`. Vertex4198 is exactly halfway along 2624→856 in the stored coordinates. This distinguishes a native polygon with a collinear boundary sample from the selected all-triangle representation's failed area gate. It does not prove what the final offset/relaxed/exported triangles would become.

Two alternatives:

- **A — selected structural direction:** preserve homogeneous native polygons; decompose only mixed domain polygons along their frozen, nondegenerate loop triangles and split those. Of 6,882 slab polygons, 138 are mixed. Their 276 existing loop triangles are all nondegenerate; minimum area is **2.6631838255e-7 m²**. Declare the pre-offset polygon admission separately and require final post-offset/relaxation/roll triangle qualification. Do not delete the five witnesses from V1 or waive its triangle gate.
- **B:** deterministically retriangulate the complete padded patch while preserving coordinates and corner data. This can provide a nondegenerate triangular input, but changes more topology, shading and support adjacency and needs broader comparison.

## Outside-neighbour construction requirement

Four sign-changing ceiling edges touch outside-neighbour faces. Splitting only the slab side would create a T-junction before normal capture and relaxation. The actual source witnesses are:

| Shared edge | Outside polygon | Frozen triangle owning that edge |
|---|---:|---:|
| 10214–10431 | 10053 | 20940 |
| 10220–10450 | 10043 | 20916 |
| 10462–10463 | 9706 | 20238 |
| 10517–10518 | 9689 | 20199 |

All **14** archived loop triangles in these four outside faces are nondegenerate; minimum area **2.7287223861e-7 m²**, triangle20199. Each shared edge belongs to exactly one of its face's triangles. This supports the proposed limited outside decomposition at the observed source level.

- **A — bounded continuation:** decompose these four faces using their exact archived loop triangles and split the edge-owning triangle with the identical global cut point. Preserve the other triangles and per-face UV provenance. This retains the declared piecewise surface before float32 cut rounding; record that rounding rather than claiming exact new-point coplanarity.
- **B:** perform the domain split throughout the affected padded patch, including outside regions. This supplies a uniform conformity rule but broadens construction changes. Deleting outside neighbours is not a valid substitute: the builder uses them for boundary normals, taper and pinning.

## Remaining source consequence before a native contract

Real triangulation adds support-graph edges. Outside polygon10053 is `[2728,4352,8339,10431,10214,1183]`; its archived triangulation adds diagonals **4352–10431** and **4352–1183**, absent from that polygon's boundary. [shell_offsets](../../../../tools/figure-pipeline/build_figure.py:1735) uses neighbour-graph rings, and the [relaxation](../../../../tools/figure-pipeline/build_figure.py:1641) averages neighbours. Therefore a polygon-preserving construction cannot claim that only final cut membership changes.

- **A — appropriate scope:** explicitly admit and inventory the changed adjacency, normal observations and resulting candidate geometry, then qualify the complete candidate. This keeps the implementation bounded and preserves the unchanged builder operations.
- **B:** maintain a separate original-plus-cut support graph for taper/relaxation while using the new triangulation only for surface construction. This offers stronger graph control but changes the authoring architecture and needs its own evidence.

Before one native observation, declare the exact mixed-face/outside-face sets, shared edge IDs, full weight/mask and per-corner interpolation, explicit domain-cut membership, and final triangle/topology gates. Preserve the exact parent visual baseline and failed control/field packets. Coverage, skin representation, body clearance, rolled-hem finish and appearance have not been established for this unbuilt construction; no parameter sweep or asset promotion follows from these receipts.
