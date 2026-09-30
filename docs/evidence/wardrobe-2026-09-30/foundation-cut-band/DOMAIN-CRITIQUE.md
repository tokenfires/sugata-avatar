# Independent plane/domain boundary critique

## Disposition

**V3 correctly failed its declared plane-only boundary guard.** The height intersections passed their receipts; the surviving off-plane boundary comes from the original torso-versus-arm selection. No intersected-band candidate was exported. The revised semantic control passed with its separately retained normal differences; see [CONTROL-CRITIQUE](CONTROL-CRITIQUE.md). Neither result restores the failed V1/V2 exact shading control.

Reviewed [V3 report](../../../../captures/foundation-cut-band-2026-09-30-v3/report.json), SHA256 `839835a1d9fae340c2d11e6f0f193cdfcc011a3bc113c39e6342484891afed21`. Independently verified all 40 declared source/artifact bindings, including encoded/decoded snapshots. The decisive `upper-after-cut.json.gz` has encoded SHA256 `c1a74bc80e1e38d1054e77ba2a153fe4699b001173c32e2343955132d842d218`. This review used read-only Python calculations; no native, GPU or browser job.

## Reconstructed failure

The two effective native Z planes are **1.1523144245147705 m** and **1.269508957862854 m**. Each split records 392 new vertices. Maximum position-interpolation errors are 7.43246e-9 m and 8.07662e-9 m, below the predeclared receipt limit. The boundary failure occurs after those splits.

Reconstructing native polygon-edge neighbours and the original strict-maximum bone selection yields:

- 6,925 selected vertices; 878 selected vertices adjacent to exclusion.
- 750 selected vertices on the effective planes.
- **128 off-plane boundary vertices**, with no unpinned plane vertices.
- Their 136 selected-to-excluded polygon edges all have excluded endpoints **inside the height interval**: 68 are excluded by `upperarm_r`, 68 by `upperarm_l`.

Concrete witness: vertex **25**, native XYZ `[-0.1585935354,-0.05935397744,1.2547893524]`, has `spine_03=0.4987499118` exceeding `upperarm_r=0.4957496226`, so it is selected. Neighbour **5262** has Z `1.2554998398`, `upperarm_r=0.5233523846` and `spine_03=0.4704595804`, so it is excluded. Both lie between the planes. Polygon **8** `[9816,5262,25,6289]` contains their shared edge.

This follows [dominant_bone_per_vertex](../../../../tools/figure-pipeline/build_figure.py:1293) and the retained torso predicate, followed by the explicit [boundary guard](../../../../tools/critic/foundation-cut-band.py:249). It is not evidence of a failed bisection.

For diagnosis only, applying the proposed whole-face selection in memory gives 6,272 polygons, 6,925 vertices, 13,197 edges, Euler zero and two degree-two boundary loops:

| Loop | Edges | Plane edges | Native Z range, m |
|---|---:|---:|---|
| Lower | 392 | 392 floor | 1.1523144245 exactly |
| Upper | 494 | 356 ceiling | 1.2456583977–1.2695089579 |

The upper loop has **138 off-ceiling edges**. Thus annulus edge topology alone would not establish the declared horizontal-rim condition. These diagnostic polygons were not exported or appearance-qualified.

## Two structural alternatives

- **A — selected for a separate feasibility study:** intersect the continuous torso/arm weight domain as well as the unchanged height planes. Define the field on the frozen native loop-triangle surface, prove its active-weight classification, and retain explicit intersection membership. The upper rim may then combine ceiling and underarm-domain segments. This preserves the source classification at original vertices but introduces a deliberately declared continuous construction and new rim contract; it does not pass the failed plane-only contract.
- **B:** author anatomical rim curves with explicit underarm transitions. This offers direct contour control but requires new shape, interpolation, coverage and fit decisions, rather than inheriting the bone-domain boundary.

For A, edge 25→5262 has `D=max(torso)-max(other)` changing from `+0.00300028920173645` to `-0.05289280414581299`. Its affine zero is at `t=0.05367906877295769`, native XYZ `[-0.158633295081,-0.059369957054,1.254827490717]`; both winning weights equal `0.497231313142`. Newly generated ties must have explicit boundary ownership. Re-running the original strict-maximum, group-order-dependent vertex selection is not a reliable substitute. An alternative is to reproduce that tie ordering and accept its resulting ownership, but it would make contour membership depend on native storage details.

The subsequent read-only field study and its inherited-degenerate failure are reviewed in [foundation-domain/CRITIQUE](../foundation-domain/CRITIQUE.md). Outside-neighbour preservation, interpolation, final topology, native/export skin, original coverage targets, clearance and actual appearance remain separate obligations. No height, predicate or guard was weakened by this review.
