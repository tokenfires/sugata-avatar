# Independent native and finite-comparison critique

## Disposition

The exact domain-band candidate `3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd` meets the declared finite export, topology, and source-rest coverage prerequisites. This supports the next qualification step. It does not establish moving coverage, garment/body clearance in the three posed observations, continuous motion, or production readiness.

Reviewed [native V3](../../../../captures/foundation-domain-native-2026-09-30-v3/report.json), SHA `1fe19dbc023d78e4ee0eb73d04fccf823eeb51251f044bb8a83b644a52d24582`, and [comparison V1](../../../../captures/foundation-domain-comparison-2026-09-30-v1/report.json), SHA `452c05c2df7927f9173bf948f5aad1fb9ceeb79530fa32f152656e524c0f255e`. No native or browser work was launched by the critic. Prior failed observations remain unchanged.

## Construction receipts

Independent reads of the archived emission and rebuilt pre-offset mesh reproduce their exact positions, polygon order, corner UVs, masks, and complete group rows. The original 10,602 vertices are retained exactly; 267 field intersections were added. The original 204 named group definitions were restored in order after the mesh assignment emptied that collection. The actual before/after receipt closes the bookkeeping failure documented in [RECONSTRUCTION-CRITIQUE.md](RECONSTRUCTION-CRITIQUE.md).

The emitted representation preserves homogeneous polygons, decomposes the 138 mixed polygons using their frozen nondegenerate loop triangles, and propagates four shared cuts into their outside neighbours. The actual adjacency changes from 20,664 to 21,348 edges: 824 additions and 140 removals. These changes can affect the inherited offset taper and relaxation. The packet does not isolate each stage's contribution. The retained observation set is the one declared before execution.

The upper boundary has 625 vertices, including the domain contour under the arms; the lower boundary has 392. Their height ranges agree with the archived construction receipt. There is no claim that the entire upper boundary is a horizontal plane. The pre-rebuild editor-selection arrays are all false; the corresponding attributes are absent after rebuilding. This result does not fill in the missing V1 boolean arrays.

I verified 92 archived source/artifact bindings across the native and comparison packets, including encoded and decoded native payloads. The candidate and construction-control GLB hashes match their native receipts.

## Independently reproduced export and skin results

I parsed the actual GLB accessors with Python/NumPy, mapped `_NATIVE_VERTEX`, applied the established left multiplication `C * M`, used the actual exported inverse binds, and reproduced the loader's reciprocal-L1 weight normalization followed by float32 storage. The independent computed positions agree with the saved comparator predictions within `4.440892098500626e-16 m`.

| Observation | Construction control | Domain candidate |
| --- | ---: | ---: |
| Native / exported vertices | 7,047 / 7,070 | 8,209 / 8,244 |
| Triangles | 13,218 | 15,401 |
| Rest position / custom attribute difference | Exactly zero | Exactly zero |
| Matched corner UV difference | Exactly zero | Exactly zero |
| Maximum 1 m rest-frame witness error | 0.001958841 mm | 0.001958841 mm |
| Identity / elbow maximum skin error | 0.000174651 mm | 0.000174652 mm |
| Coupled maximum skin error | 0.123488117 mm | 0.123485236 mm |

All six comparisons against the actual full-native weight observations meet the unchanged strict `< 0.342 mm` bar. Identity and elbow have the same measured garment result here; they should not be described as independently stressing the bust band. The coupled candidate witness is exported vertex 1267, native vertex 1256. Native rows can have six influences; the export has one four-slot stream. The finite result measures that representation difference rather than erasing it.

The deliberately translated outputs fail against their passing clean parents: approximately 50.000025 mm in identity/elbow and 50.086598 mm in the coupled case. These controls check detectable displacement. They do not prove sensitivity to every possible skinning defect.

## Independently reproduced coverage and topology

Direct triangle-ray calculations using the actual accepted body and its `_DECENCY_CHEST` values reproduce all 110 required hits and all 3,780 supplementary fan hits for both control and candidate. Maximum query-distance difference from the stored receipts is `2.168404344971009e-18 m`; there are no new fan losses. The required query retains the original raw-normal parameterization, while the fan uses normalized normals. Neither set is a continuous or moving coverage certificate.

Topology recomputed using the native vertex IDs gives:

| Property | Construction control | Domain candidate |
| --- | ---: | ---: |
| Vertices / edges / triangles | 7,047 / 20,265 / 13,218 | 8,209 / 23,610 / 15,401 |
| Euler characteristic | 0 | 0 |
| Boundary loop sizes | 484 and 392 | 625 and 392 |
| Nonmanifold edges / orientation errors / degenerate triangles | 0 / 0 / 0 | 0 / 0 / 0 |

Both boundaries have degree two throughout. The reported vertex-link checks have no failures. Candidate minimum triangle area is `4.2526282449639084e-9 m²`, triangle 9526. This is a locator and a measured scale, not an invented rejection threshold or evidence of a visible problem.

## Retained control limitation and alternatives

The rebuilt construction control is still **not exactly shading-identical** to the frozen parent. Its canonical oriented polygon/triangle sets and mapped corner UVs are exact, while the maximum vertex and matched-corner normal component difference is `1.1920928955078125e-7`. The original exact-normal control failure remains failed. Native-to-export corner normal component differences are separately measured: approximately `6.17206e-5` for control and `6.13332e-5` for candidate. Do not combine these distinct comparisons.

1. **Selected: use the declared semantic geometry/data control and the frozen exact parent asset for appearance comparisons.** This permits the isolated construction observation while retaining every normal residual and the failed exact-shading gate. It cannot support an exact-shading or exact-image claim.
2. **Require a byte-reproducible native rebuild before further construction.** This would strengthen reproducibility, but is a separate builder investigation and would delay the useful finite candidate qualification. No post-hoc normal tolerance is needed for the selected contract.

The actual views and full accepted-body source-rest clearance are reviewed separately in [VISUAL-CRITIQUE.md](VISUAL-CRITIQUE.md).
