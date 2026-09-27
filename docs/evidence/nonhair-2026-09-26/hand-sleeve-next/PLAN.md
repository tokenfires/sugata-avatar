# Sampled proximal sleeve/body diagnosis

This CPU-only packet tests the unchanged isolated 4-degree outward rest/common native inward-cap-zero candidate. It does not tune, promote, export, or render it.

Retained native candidate D geometry exists at steps 592, 593 and 594. Native baseline A has step 592 only. All five meshes include posed positions, full source indices, and actual drawn indices. Reports, manifests, encoded/decoded snapshots, installed assets and the prior corridor analysis will be hash-bound before and after use.

Two explicit source regions are examined:

1. The fixed union, per side, of body face IDs whose full-distal/all-worn outward corridor certificate failed at any of these three candidate steps. Compare these whole triangles with every worn triangle and the full body. This selector diagnoses the recorded uncertainty; it is not an exhaustive sleeve/body selection.
2. Casual garment triangles with any vertex carrying a strictly positive stored weight on the ipsilateral upperarm or lowerarm joint. Compare these whole triangles with the full body. Report the exact IDs and influence range; small cross-side influences remain included. This is an explicit arm-influenced garment region, not a claim of anatomical sleeve completeness.

An independent Python-standard-library rational triangle predicate uses each stored binary64 coordinate exactly. Inclusive AABB pruning only removes strictly disjoint pairs. Noncoplanar plane sections and coplanar polygon clipping establish the complete convex intersection. No epsilon decides contact. Self-comparisons exempt only intersections wholly contained in the actual shared indexed vertex/edge; an adjacent pair crossing beyond that simplex remains a finding. IDs from different meshes are never shared. Identical self-face comparisons are recorded separately. Masked triangles remain targets, and witnesses record both faces' drawn membership.

Analytic controls cover interior crossing missed by vertex-only tests, disjointness, coplanar overlap, winding reversal, exact shared vertex/edge, crossing beyond a shared simplex, tiny gaps, degeneracy/nonfinite rejection and broad-phase boundaries. Actual source/topology corruption must be rejected before analysis.

Output distinguishes transverse interior crossing, coplanar overlap, boundary contact and expected common-simplex contact. No crossing is a sampled surface result, not proof of containment, garment fit, positive clearance, continuous motion or visual severity. Baseline/candidate comparison is limited to step 592. The candidate's wider, less contracted angry upper-arm silhouette remains a separate visual tradeoff regardless of this result.
