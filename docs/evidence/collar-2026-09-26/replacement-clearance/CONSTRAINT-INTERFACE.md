# Prospective bounded collar constraint interface

This is an inventory/design for a future solve, not a solver, asset export, fit qualification or change to any threshold. The fixed support is reproduced with `deriveFitSupport` from exact accepted `44eb…` topology/weights plus `d81a…` interior IDs, then compared with the existing support report.

## Geometry that must participate

The 91 moving-support incident faces and 25 faces incident to the fixed rear-guard vertices are already contained in the original 180 changed faces. Their union is **exactly 180 faces**, not 296 distinct faces. The 10 rear-guard raw vertices remain fixed bit-for-bit. Six of their incident faces (592, 593, 594, 595, 1506, 1507) also contain a movable vertex outside the guard; therefore “all 25 guard-incident faces are unchanged” would be false. All 25 remain in clearance checks, while the specified guard vertices remain fixed. No support is expanded.

For every pose, use the snapshot's **full** body index array, matching the body GLB exactly. For the actually worn torso foundation, reconstruct the current casual any-corner mask (`all corners <=0.5` means retained), map each retained triangle back to its original source ID, and require exact equality with the snapshot's actual `drawnIndices`. The checked native captures contain 327 retained bra triangles or 1,411 retained vest triangles. Do not use the additionally hidden coverage selections as collision obstacles, or infer vest geometry from bra.

Use `compare(patch, fullBody, {gridSteps:4, globalInside:true})` and `compare(patch, retainedFoundation, {gridSteps:4, globalInside:false})` from the existing clearance review. The minimum uses triangle intersections plus vertex/face and edge/edge features with conservative AABB pruning. It is not a vertex-only test. The closed, oriented full-body topology is checked; compensated winding and five ray-parity directions classify centroids. For disjoint triangles, consistent exterior classification extends to the triangle; intersecting triangles never inherit an all-points exterior claim from their centroids. Open bra/vest surfaces have unsigned separation only.

The reused intersection predicate has its existing 1e-10 m contact tolerance. The 12 analytic controls cover transverse/coplanar intersection, edge-edge distance, winding, grazing/parity ambiguity, and a wholly contained triangle whose surface separation is positive. The old `compare` dense local-normal and “belowSolverTolerance” counters are retained as **diagnostics only**; its old 1.48 mm stencil counter is not a new acceptance threshold.

## Degrees of freedom and rows

The unknown vector has 102 scalar entries: one authored displacement `delta_g ∈ R³` for each of the existing 34 welded groups. Every raw vertex in a group receives the same delta from its **d81 authored position**. All other vertices and all rear-guard vertices have zero delta. The total norm of each group delta, including smoothing, must remain <=0.003 m.

A prospective row should contain these fields:

```text
pose: {captureManifestHash, snapshotEncodedHash, snapshotDecodedHash, run, step}
baseline: {assetHash: d81…, nativeBodyFoundationParityVerified, nativeOuterAnchorHash}
target: {kind: body | foundation_bra | foundation_vest, sourceTriangleId}
cloth: {sourceTriangleId, sourceVertexIds, barycentricAtWitness}
witness: {clothPointWorld, targetPointWorld, featureKind,
          minimumUnsigned, bodyWinding, bodyParity,
          separatingDirection | null, orientedContactStatus}
terms: [{weldGroup, jacobian3x3, coefficient3IfDirectionKnown}]
requirements: {strictlyPositive, noRegressionFloor,
               seedBraFloor | null, baselineMinimum, arithmeticAllowance: 1e-9}
```

Preserve original target triangle IDs alongside compact retained-array indices. Keep unclassifiable/ambiguous status explicitly; do not drop it from a feasible-row list. A failure with no nonzero movable terms is infeasible under this support and must stop the experiment, rather than grow the support.

For an unmodified pose and vertex `v`, define the linear blend-skinning derivative
`J_v = Σ normalizedWeight(v,j) * upper3x3(boneWorld_j * inverseBind_j)`.
Use the runtime body skeleton's inverse binds and the fragment's actual joint-name map. Before using it, independently replay the **actually loaded** outer GLB and require parity with the native snapshot. The inventory performs this check on all 2,377 vertices. Native snapshots are Float32; this check is an instrument prerequisite, not permission to replace the 1e-9 m no-regression allowance with the larger replay error.

For a barycentric cloth witness `p` with weights `alpha_v`,
`J_pg = Σ(v in g) alpha_v * J_v`. Anchor `p0` to the exact native **d81** snapshot, not a reconstructed accepted44 point. With a justified unit separation direction `n` and fixed obstacle witness `q`, the local row is
`n · (p0 - q) + Σ_g (nᵀ J_pg) delta_g >= requiredGap`.
This linearization only supplies a search direction; closest features/normals may change. Recompute whole-triangle intersections/separation after proposed steps and again on exact exported/native bytes.

For a disjoint exterior point pair, `n=(p0-q)/distance` is available. At an intersection distance is zero, so this division is undefined. For a contained body point, unsigned distance points the wrong way if blindly treated as clearance. Such rows require an explicitly oriented local contact witness consistent with the closed body's outside, or an anatomical outside interpretation for an open foundation. Preserve the body/target winding normal and classification for that choice; reject ambiguous sidedness. Do not fabricate a global signed distance for the open bra/vest or normalize a zero separation vector.

## Unchanged acceptance gates

- All 180 checked faces: no crossing, body containment or ambiguous body classification; strictly positive whole-triangle distance from full body and the actual retained foundation.
- Six seed faces: bra separation >=0.0005 m in every checked bra pose. This is the written **bra** target; no new 0.5 mm vest target is introduced here.
- No reduction of an existing positive per-pose d81 minimum, with the existing 1e-9 m arithmetic allowance; strict positivity still applies. Save per-face and whole-patch baselines, and the unchanged rear witness. Do not substitute accepted44 or a different pose family for paired d81.
- Before any export, every affected authored face relative to d81: normal dot >=0.95, area ratio in [0.8,1.25], no inversion/degeneracy/nonfinite values or seam separation. These nonlinear shape checks are independent of the linear contact rows. Preserve hard-edge normal partitions and all non-position/non-affected-normal bytes.
- Keep the original topology, 2,377 slots, UVs, weights/joints/bindings, materials, 140 interior IDs, masks and unrelated assets unchanged. Displacement is capped at 3 mm; support/thresholds do not grow on failure.

The inventory now includes native accepted44 controls and matched native d81 expressive bra/vest step 98. It verifies identical rig/time/full-body geometry between the paired roles, and identical full-body/outer geometry between native d81 bra and vest families at that step. Their current-runtime d81 rows can supply this pose's baseline after the full capture seals. They do not substitute for the remaining stored poses.

The d81 vest state contains four intersecting faces whose **three vertices are all fixed**:
1503, 1515, 1516 and 1517. The last three belong to the rear guard. The later sealed partial
archive preserves those snapshots, and the independent exact-rational witness confirms all
four contacts without an epsilon. This rules out joint bra/vest clearance under this interface,
not the older plan's body-plus-bra-only problem. No solve or export followed. The original
measurement receipts remain provisional records of what was available when read; the later
seal is bound separately. See README.md and CRITIQUE.md for the stop decision and two future
alternatives. No full matrix, between-sample or arbitrary-motion qualification is claimed.
