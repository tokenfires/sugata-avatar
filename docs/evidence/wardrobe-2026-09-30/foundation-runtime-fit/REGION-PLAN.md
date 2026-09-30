# Bounded contact-region inventory

The exact source-to-pose trace reproduces all four saved states. The known contact pairs a torso-dominant band triangle with an upper-arm-dominant body triangle that was34.38mm away in source rest. This supports inspecting contact ownership before changing the band. The alternative is to stop diagnosis and leave a future pose-aware construction contract; that preserves the failure but provides less guidance about affected regions.

Read the completed full-body audit rows at all four times and exact body GLB weights. For each saved crossing band triangle, identify the **stored closest/intersecting body triangle** and its mean normalized joint weights. Tabulate its largest mean joint by native name. This is an inventory of the audit's selected witness per band triangle, not every contact pair, an anatomical segmentation oracle or a change to the full-body gate. Preserve all rows and aggregate counts.

Separately retain winding/parity disagreement as observed values. At step0 select the first band triangle in original audit order with absolute winding greater than1.5 and every nonambiguous parity ray outside. Recompute its centroid winding and all five parity results using the bound full body; do not reinterpret parity as inside or change thresholds. If no such row exists, record that absence.

Run a bounded full-body self-contact observation for body triangle2215 and, if distinct, the stored target triangle from the selected disagreement row. Compare each with every other body triangle whose source-rest welded vertices share no vertex with it. Use actual step0 Float32 positions and the existing exact triangle-distance predicates, preserving every zero-distance pair. This investigates at most two predetermined body faces, not global self-collision. Source-rest exact-position welding only excludes topological neighbours; it is not proof of body manifold geometry. No arm is removed, no model/pose/weight is changed and no result passes the existing failed garment gate.

Actual source triangles, joint weights and existing image projection support a narrow region interpretation. Any claim of body self-intersection requires a valid nonadjacent transverse witness and independent reproduction. Winding2 alone does not locate the cause. If the bounded witnesses are absent or inconclusive, stop; do not search successively through more body faces. Keep the geometric and visible conclusions separate.

## Source review

The critic identified an outer AABB filter stricter than the existing triangle predicate’s1e-20 squared-box allowance. Root selects **B**, removing that outer filter and calling the bound predicate for every nonadjacent face. Alternative **A** would duplicate the helper’s exact allowance for acceleration. B is simpler and costs a small amount of CPU for these at-most-two faces. This fixes observer semantics before launch; it does not prove that the current inputs contained a suppressed pair.
