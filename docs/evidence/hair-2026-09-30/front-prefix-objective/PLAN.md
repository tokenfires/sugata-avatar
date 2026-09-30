# Declared whole-prefix observation

This plan is recorded before the observation is run. It follows the [reachability critique](../front-feasibility/CRITIQUE.md). The independent critic reviewed the formulation and confirmed the closed-form construction; no candidate or result is implied.

## Controlled question

For cards 145 and 204 only, can one shared translation of the two ring-1 edges reduce a whole-prefix smoothing proxy without worsening either centre turn, any edge turn, or local spacing/triangle area? Root ring 0 and suffix rings 2–16 stay exact. The original ring-1 width vector stays fixed. Original short cards and all other geometry are unchanged; no complete front asset will be produced.

For each edge independently, let `h0`, `h1`, `h2` be its **original** first three span lengths. Define velocities `vi = (pi+1 − pi)/hi` in that fixed parameterization. Minimize:

`J(δ) = sum over the two edges [ |v1 − v0|² / mean(h0,h1) + |v2 − v1|² / mean(h1,h2) ]`.

Only `p1` translates by `δ`. The first velocity difference changes by `−δ(1/h0+1/h1)` and the second by `+δ/h1`. With fixed positive weights, `J` is a strictly convex quadratic with a positive scalar Hessian, so one closed-form minimizer is available. Compute it once. Do not sweep offsets, tune weights or run a solver search after seeing the result.

This is a **fixed-parameter second-difference proxy**, not pure geometric curvature. Tangential stretch contributes. Separate original edge spans retain width-dependent information; using shared centre spans would algebraically reduce the minimizer to a centre-only calculation. Neither construction is a photographic requirement.

## Independent observations and conservative gates

Report baseline and derived geometry, both centre turns at rings 1/2, all four edge turns there, each affected edge/centre span, each local triangle area, root outgoing direction changes, actual arc growth, and complete 32-triangle contact against the pinned body. Retain the two earlier exact-join controls in the comparison.

Before regarding this as a promising numerical witness, require:

1. Every one of the six centre/edge turns is no worse than baseline (1e−6 degree numerical allowance).
2. The minimum of the two affected spans is no lower than baseline, independently for centre, edge 0 and edge 1 (1e−9 mm numerical allowance). Report all six spans, so an unchanged downstream minimum cannot conceal compression.
3. Minimum area among the four triangles adjacent to ring 1 is no lower than baseline (1e−9 mm² numerical allowance).
4. Full card/body triangle crossings and negative sampled vertices are zero; preserve the original-clear controls.
5. The proxy decreases by more than 1e−8 relative to baseline; the unchanged baseline cannot count as a useful observation.

These are optional conservative engineering gates, deliberately stricter than a low aggregate score. Rejection means this particular proxy/minimizer failed the declared gate; it does not prove generally infeasible anchors or that a larger boundary is required. Even success earns no appearance, normal, coverage, hair/hair, garment or motion qualification.

## Stop and next decision

After this single observation, preserve the result and independent critique. Do not tweak the objective to force a pass. If the proxy still relocates a bend or compresses geometry, stop this small one-ring authoring line and reconsider a visibly grounded shared front layout or another product workstream. Any revised geometry contract needs its own explicit hypothesis and actual rendered evidence.
