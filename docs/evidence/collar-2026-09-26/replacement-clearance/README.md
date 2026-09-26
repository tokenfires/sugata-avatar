# Clearance and bounded-support inventory

No solve, asset transform or export was run. The current support is **infeasible for joint bra/vest clearance under the proposed interface**: the d81 expressive vest pose below contains four intersecting cloth faces with no movable vertices, including three immutable rear-guard faces. The coordinator stopped the larger capture safely after eight completed bob02 runs; the interrupted ninth run is not an input to this inventory. The older bounded plan specifies body plus bra; this does not prove a bra-only solution impossible.

The original measurement receipts retain their provisional status as read during capture.
The subsequent [sealed partial receipt](../replacement-capture/stop-v2.json) preserves those
completed cases and exact hashes. The [independent critique](CRITIQUE.md) verifies all four
contacts with exact-rational geometry and no epsilon, confirming positive-length transverse
intersection segments whose midpoints lie strictly inside both triangles. This later seal and
proof complete the fixed-support counterexample without rewriting the earlier receipts.

`inventory-v1.json` is the compact receipt. It binds four numerical inventories, their encoded/decoded hashes, immutable copies of the capture report as read, exact source/asset/snapshot/support hashes and paired-pose checks. Full per-face clearance rows and world-coordinate witnesses live under `captures/collar-replacement-2026-09-26/clearance-inventory-v1/` as lossless gzip files. `CONSTRAINT-INTERFACE.md` specifies the prospective 102-variable interface and unchanged rejection gates; it implements no solver.

## Measured controls

All rows use native CPU-skinned snapshots at step 98. The full expressive runs had completed before they were read, while their enclosing capture was still open. The earlier vest mild smoke was already sealed.

| Actual asset / sequence / foundation | Body crossings | Body-inside centroids | Foundation crossings | Status |
| --- | ---: | ---: | ---: | --- |
| Accepted44 / expressive / bra | 22 | 11 | 6 | Provisional full-capture control |
| Accepted44 / mild / vest | 23 | 12 | 20 | Sealed smoke control |
| d81 / expressive / bra | 0 | 0 | 4 | Provisional new-runtime baseline |
| d81 / expressive / vest | 0 | 0 | 16 | Provisional new-runtime baseline; fixed-face blocker |

Every body row tested five parity directions; none was ambiguous. The source full-body mesh is closed and consistently oriented. Actual retained foundation arrays exactly match the current frozen any-corner masks: **327 bra triangles**, **1,411 vest triangles**. The 91 support faces plus 180 original changed faces plus 25 rear-incident faces form a union of **180 distinct faces**. The 10 fixed rear vertices are not confused with all 25 incident faces being immovable; six incident faces also contain a movable vertex outside the guard.

Independent linear blend-skinning reconstruction of all 2,377 actual outer vertices agrees with the native snapshots within 1.053e-7 m for expressive poses and 1.083e-7 m for mild vest. This validates a prospective pose Jacobian; it does not relax the 1e-9 m clearance-regression allowance. Exact native d81 snapshot positions remain the baseline anchors.

The accepted44 controls are useful diagnostics, not the starting asset of a new trial. Their face 1515 is entirely inside the body despite **positive unsigned surface separation** (0.93689 mm in expressive bra, 0.45862 mm in mild vest). This demonstrates why a distance-only or vertex-only test would be insufficient.

## d81 contact witnesses

In the d81 expressive step-98 bra pose, all 180 cloth faces are outside the full body; minimum body separation is **0.56838 mm**, between cloth face 580 and body face 15666, with an edge/edge minimum. Rear face 1515 retains **0.69959 mm** from body face 15580.

The bra repair still needs all six seeds: faces **544/545** are only **0.25678 mm** from bra face **9777**, below the written 0.5 mm seed requirement; **1327/1328/1329/1331** cross source bra faces **15016/4845/18574/4846**. All six have movable-support terms. This is not proof that a 3 mm bounded solution exists.

The actual d81 expressive vest pose has identical time, rig, full-body geometry and outer geometry to its bra counterpart. Sixteen cloth faces cross the actually retained vest. Four are wholly fixed:

| Cloth face | Native vest source face | Fixed raw cloth vertices | Rear guard |
| --- | --- | --- | --- |
| 1503 | 18271 | 368, 881, 886 | No |
| 1515 | 6120 | 371, 884, 889 | Yes |
| 1516 | 19672 | 261, 371, 889 | Yes |
| 1517 | 26194 | 261, 889, 885 | Yes |

Each face's three vertices is outside the allowed 34 welded groups. `inventory-v1.json` includes both triangles' exact world coordinates, barycentric witnesses and explicit null movable-group membership. An independent exhaustive segment/triangle check using Three's ray predicate finds **two strict edge-through-face hits per pair**, with segment fractions and target barycentrics strictly inside their valid ranges. These are not merely near vertices or local-normal signed-distance diagnostics.

For example, face **1515 ↔ vest 6120** intersects at approximately **[0.0117299619, 1.4227245609, -0.0149617245] m**. Face 1515 cannot move under the current guard, and the vest, masks, skin weights, bindings and pose are fixed. Consequently no choice of the permitted 102 displacement components can remove this intersection. The other three fixed pairs provide additional witnesses. If the sealed partial archive retains their exact snapshot hashes, strict positive vest clearance is impossible under this support; do not export a trial or change thresholds/support to conceal it.

## Reproduce one inventory

The read-only CPU instrument verifies frozen capture-source files, the completed run, actual loader response, compressed/decoded snapshot hashes, source topology, retained masks and body topology before comparison. It reuses the unchanged `collar_clearance_review.mjs` whole-triangle comparison and its twelve analytic controls. Its historical dense local-normal stencil counters are diagnostic only.

```sh
node docs/evidence/collar-2026-09-26/replacement-clearance/inventory.mjs \
  captures/collar-replacement-2026-09-26/capture-v2 \
  bob02-expressive-foundation_vest-frozen-interior \
  98 foundation_vest \
  captures/collar-replacement-2026-09-26/clearance-inventory-repeat
```

Use a fresh output directory. A completed run from an unsealed capture produces an explicitly provisional inventory. The copied report records precisely what was available at measurement time. The live capture report may later acquire a sealed-partial status; that must be bound separately, without rewriting prior evidence as if it had already been sealed.

No result here certifies unmeasured poses, between-frame motion, GPU-deformed positions, arbitrary identities, complete coverage, appearance, or garment promotion. The fixed-contact counterexample is useful even though the full sixteen-case qualification was intentionally stopped.
