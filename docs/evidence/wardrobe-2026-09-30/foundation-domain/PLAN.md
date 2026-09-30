# Read-only torso-domain contour feasibility

## Evidence and question

The plane-only cut failed on 128 genuine underarm boundary vertices. Retained vertex 25 and excluded neighbour 5262 both lie within the height band; their winning torso/arm weights differ. The [closed study](../foundation-cut-band/README.md) preserves that conflict. A continuous upper contour must account for this domain boundary instead of requiring the entire top loop to remain horizontal.

Root first chooses a read-only feasibility calculation on the exact archived `upper-after-cut.json.gz`, SHA256 `c1a74bc80e1e38d1054e77ba2a153fe4699b001173c32e2343955132d842d218`. No Blender job, new garment, offset or asset edit is part of this observation. The broader alternative is an explicitly authored anatomical rim with a new contour/fit contract.

## Fixed representation

Use the source's recorded loop triangles as its exact piecewise planar surface. Retain the original effective anatomical planes. Define at each vertex D as its largest torso-bone weight minus its largest other deform-bone weight. The original interior rule is D greater than zero, with source tie handling observed separately. Along a mixed-sign source triangle, require the same winning torso and non-torso bone at all three corners. Only then is the difference of those two affine weight fields exactly affine throughout that triangle; a changing winner pair stops this simple representation. Do not substitute a fitted scalar field for an unproved active pair.

Intersect each admitted triangle with D=0, keeping the D-positive side and intersection vertices. Use one globally shared cut vertex for each crossing edge; derive its parameter from the exact original endpoint weights, then store positions, all weights and point masks in float32 as native storage would. Keep per-face UV interpolation separate across seams. Record every edge parameter and its expected/actual values, including residual winning-weight equality after storage. Cut membership follows exact intersection provenance; do not modify bone weights to force a float32 tie.

The source height cuts already exist. Require every input triangle to lie wholly inside, outside or on the existing height interval; any unsplit crossing is a failed precondition. The final contour may now combine height-plane segments with continuous torso/arm weight-boundary segments. This is the explicitly changed boundary contract after the concrete underarm conflict; anatomical heights, weights, masks and refinement counts stay fixed.

## Receipts and limits

Inspect oriented topology, every vertex link, exactly two simple boundary loops, one component, Euler zero, triangle area/degeneracy and float32 coincident welds. Require every final boundary edge to be accounted for by either an existing effective plane or a recorded domain-cut segment. Record loop composition and the range of its height so an underarm dip is explicit. Count all source mixed triangles, their active pairs and cut edges. Preserve excluded geometry in the input; the output is a diagnostic surface only.

A pass would support one separately declared native construction retaining the padded outside surface through normal/offset/relaxation and final roll. It would not prove interpolated native custom-data behavior, final skin, coverage, body clearance or appearance. Original chest targets and the strict finite full-native/export gate remain unchanged. Require fresh actual images and independent critic review for any future garment. A failure remains failed without moving planes, sweeping thresholds, loosening topology or changing the field after seeing it.
