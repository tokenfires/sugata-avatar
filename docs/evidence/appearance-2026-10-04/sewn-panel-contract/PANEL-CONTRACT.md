# Two sewn metric panels — complete source proposal

This is a source-only artist proposal, not a constructed mesh, fit result or accepted look. ROOT-WORTH independently admits authorship only. Every coordinate below is in the immutable original ledger's zero-morph initial world frame, in metres. No T-rest transform, body/foundation edit, field extraction, old cross-section ring net, smoothing, point-map or shell selection is used. The new source consists of TWO independently triangulated polygon disks and TWELVE boundary bridges. The entire original required-source responsibility remains.

## 1. Metric panel source

Front IDs F0..F18 and back IDs B0..B18 are distinct global IDs, ordered counterclockwise in their XY projections. Their respective index values are 0..18 and 19..37. They never weld, including at cuffs. Literal decimal numbers are parsed as correctly rounded binary64. Arithmetic below is binary64, left-to-right; save every resulting operand and XYZ before predicates. sqrt is the runtime binary64 square root, with actual result saved. There is no claim that these values have already been evaluated.

Positive-X cuff inward normal n=(-0.5112641203138838,0.5200705037271678,-0.6842044069082285), original intent origin o=(0.44542589397128357,1.0233330556297953,0.17296551767825433). C=o-0.015*n, D=sqrt(nx*nx+ny*ny), U=(ny/D,-nx/D,0), V=cross(U,n). Cross components use the usual first product minus second product in XYZ order. Reject zero/nonfinite D, normal-length residual above1e-12, or any nonfinite value. No normalization after constructing V; its actual normal/tangent residuals must be at most1e-12. Negative cuff uses exact X reflection M(x,y,z)=(-x,y,z) of these literal expressions and reflection of n,o,C. Role labels are cuff_l for positiveX and cuff_r for negativeX, matching the original policy. These planar rim expressions deliberately have different front/back XY and Z; identical XY on a cuff plane with nonzero nZ would collapse the opening.

| i | Front XYZ expression | Back XYZ expression |
|---|---|---|
|0|(-0.20,0.805,0.22)|(-0.20,0.805,-0.15)|
|1|(0.20,0.805,0.22)|(0.20,0.805,-0.15)|
|2|(0.22,1.04,0.27)|(0.22,1.04,-0.17)|
|3|(0.245,1.19,0.27)|(0.245,1.19,-0.17)|
|4|C-0.07*U+0.10*V|C-0.07*U-0.09*V|
|5|C+0.12*V|C-0.11*V|
|6|C+0.07*U+0.10*V|C+0.07*U-0.09*V|
|7|(0.37,1.26,0.24)|(0.37,1.26,-0.16)|
|8|(0.205,1.455,0.24)|(0.205,1.455,-0.16)|
|9|(0.095,1.44,0.19)|(0.095,1.44,-0.14)|
|10|(0,1.44,0.27)|(0,1.44,-0.17)|
|11|(-0.095,1.44,0.19)|(-0.095,1.44,-0.14)|
|12|M(F8)|M(B8)|
|13|M(F7)|M(B7)|
|14|M(F6)|M(B6)|
|15|M(F5)|M(B5)|
|16|M(F4)|M(B4)|
|17|M(F3)|M(B3)|
|18|M(F2)|M(B2)|

Expressions C+a*U+b*V evaluate coordinatewise ((C+a*U)+b*V); subtraction is addition with the negative literal. M(Fi) refers to that panel's already owned expression, not body/source fitting. All noncuff coordinates are artist-authored; these rough dimensions are not measured ease, anatomy or merino fabric. They may fail the full source tests without changing this source.

## 2. Complete panel triangulation and seam ownership

For EACH panel's full 19-point XY polygon, require distinct projected points, positive exact signed polygon area, no nonadjacent projected segment intersection/touch/overlap, and adjacent segments intersecting only at their declared shared endpoint. All tests are exact rationals over the actual binary64 operands. A failed polygon is B; no reorder, deletion, snapping or fallback projection.

Triangulate independently by this fixed ear rule. In the remaining cyclic list, consider every middle ID b in ascending ORIGINAL numeric ID, with predecessor a and successor c. An ear needs strictly positive exact XY cross(a,b,c), no other remaining vertex inside OR ON the closed triangle abc, and diagonal ac intersecting remaining polygon edges only at its declared endpoints. Choose the first eligible ear, emit (a,b,c), remove only b from the active list, and repeat. If no eligible ear exists, refuse. The last three must have strictly positive XY area. All original vertices remain in emitted faces; no collinear vertex removal. Front emits the above order; back emits (c,b,a) for each independently chosen ear. Expected 17 triangles per disk is a combinatorial target, not an observed count. Diagonals and all ear operands/choices are recorded; no adaptive diagonal chosen from clearance or normals.

Front boundary edges are Fi->Fj with j=(i+1)%19. Sew EXACTLY the twelve edges with i in [1,2,3,6,7,8,11,12,13,16,17,18]. For each, emit the fixed two oriented triangles (Fj,Fi,Bi) and (Fj,Bi,Bj), with diagonal Fj-Bi. There are four bridge strips/chains [1,2,3], [6,7,8], [11,12,13], [16,17,18]. No seam corner/edge owns duplicate coordinates or receives a new vertex. This makes front/back/seam ownership literal before evaluating geometry. Physical face IDs are front ears0..16, back ears17..33 and seam faces34..57 in ascending seam-edge order. Each ear carries its panel provenance; each seam triangle carries its chain and original i. No post hoc orientation repair, splitting, welding, dropped triangle or inserted patch.

## 3. Four openings, topology and temporary caps

The four oriented physical boundary cycles are EXACTLY:

- hem: F0,F1,B1,B0 (4 edges), plane y=0.805, inward n=(0,1,0).
- cuff_l: F4,F5,F6,B6,B5,B4 (6), plane through C with the literal n above.
- neck: F9,F10,F11,B11,B10,B9 (6), plane y=1.44, inward n=(0,-1,0).
- cuff_r: F14,F15,F16,B16,B15,B14 (6), plane through M(C) with M(n).

Cycles close to their first vertex. Opening endpoint front/back bridges are supplied by the adjacent sewn edges; they are boundary edges of those strips, not extra fabricated physical caps. Roles follow seam provenance, not nearest position. Every loop point must have absolute signed plane residual <=1e-10m. Exactly these four disjoint cycles, all22boundary edges, one edge-connected component, positive world-triangle area and no unused/duplicate/index-invalid faces are mandatory. Every interior edge has exactly two opposite directed incidences; every boundary edge one. Every interior vertex link must be a single cycle and every boundary vertex link a single path. All triangles must have nonzero exact 3D squared cross norm; tiny positive area is recorded without an invented area cutoff.

Topological source argument: two polygon DISKS are connected by four separate rectangle chains. The first chain joins the two components; each remaining chain joins two distinct boundary intervals on the same connected orientable surface, with no branching or identified endpoint. Oriented seams match opposite panel edges. Each opening arc joins its reversed back arc through its two strip-end edges; the four arcs partition the free perimeter, producing the four named loops. Gluing four contractible strips along two contractible intervals each gives Euler2-4=-2. The required oriented manifold with four boundary loops therefore has genus0. Expected physical counts V38/E98/F58, Euler-2 are source targets; no geometry or data check has occurred. This argument does not prove an embedded self-intersection-free surface or fit; those are separate exact gates.

Testing only: add one arithmetic-mean vertex per loop, IDs38..41 in neck,hem,cuff_l,cuff_r order. Emit cap triangles reversing each physical boundary edge (v,u,mean). Actual binary64 means sum in the listed cycle order then divide by its count; save operands. Fixed basis: select coordinate axis with smallest abs(n dot axis), ties X/Y/Z, Ucap=normalize(cross(n,axis)), Vcap=cross(n,Ucap). Save actual Float64 basis. Project each cap loop; require simple edges and strictly consistent projected mean-fan triangle signs with no overlapping interiors. Refuse non-star-shaped/ambiguous cap; no alternate centre or triangulation. Require closed opposite-edge/link incidences, one connected component, Euler2 and strictly positive exact signed volume for the capped solid. Expected closed V42/E120/F80. Caps are excluded from export/material/appearance.

## 4. Full original-source coverage and continuous separation

Preserve all9 original ledger owners,39,546 original points and71,512 original triangle IDs. REQUIRED SOURCE is exactly every nonempty positive-area required convex polygon in the bound PARTITION, including every22,090 bra triangle; whole-required IDs use the full barycentric unit simplex. Exposed/degenerate IDs retain their diagnostics and original identity. Reconstruct required world corners from the original saved worldPositions and barycentrics in vertex0/1/2 addition order; save those Float64 operands before exact tests. No GLB decode, owner welding, mask, morph, skeleton, foundation/source movement or domain reclassification. Source polygon fan triangulation retains owner UUID/original ID/required ordinal/corner provenance and its complete continuous domain.

Require the physical and capped surface to have no triangle intersection beyond a declared common indexed simplex. Test all inclusive overlapping triangle AABBs; exact binary64-rational orientation/barycentric predicates handle coplanar projected clipping and noncoplanar plane intervals. Adjacent triangles may meet ONLY at their declared vertex or entire edge; any overlap beyond it refuses. No tolerance welding, approximate Boolean or geometric cleanup. All projected polygon, world adjacency/link, cap and intersection failures retain exact offending IDs/operands.

Every complete required source fan triangle must have continuous minimum squared distance to the ENTIRE physical surface >=(0.010m)^2, equality passes. Pair intersection is zero; otherwise test all six vertex-to-triangle face/edge/vertex Voronoi distances and nine clamped segment-to-segment distances, including parallel/zero-length endpoint cases, with exact rational squared comparisons. Inclusive BVH uses full AABBs, longest-axis stable median split, leaves8. A node prunes only when exact triangle-AABB lower bound proves the threshold, or exceeds the current exact best when reporting a true minimum. Save per-source-triangle threshold certificates/evaluated witnesses; never label a threshold certificate an observed global minimum. No vertex/centroid samples replace a whole triangle.

Each complete required polygon must be at least0.015m inside EACH role cap plane, using normalized signed plane distance and1e-12m reconstruction allowance. Literal neck/hem planes are exactly15mm beyond original intent; cuffs derive from the original inward vectors. Convex linear corner checks own the complete polygon domain. Physical10mm checks exclude artificial caps, but source domains must additionally be disjoint from the complete capped boundary. No on-plane exception or omission of shoulders/foundation/underarms.

Finally classify each required polygon's relative-interior arithmetic mean against the complete closed capped solid. Three fixed directions are normalized binary64 (1,sqrt2,sqrt3), (sqrt3,1,sqrt2), (sqrt2,sqrt3,1); save actual Float64 triples BEFORE rays. Inclusive forward BVH slabs test every possible intersecting face. Exact rational ray/triangle operands own intersection counts; abs barycentric coordinate <=1e-12 on edge/vertex or unresolved coplanarity refuses. All three forward counts must be odd. No perturbation, alternate ray search, majority fallback or post-result tolerance change. Connected required polygons are on that side only after complete continuous disjointness from the closed boundary is proved. Count/ID mismatch refuses.

## 5. Acceptance boundary and next decision

This proposal does not promise that its coarse artist surfaces satisfy coverage/ease/fit or look like fine merino. Reference target remains relaxed soft shoulders, full tapered sleeves, untucked hip-length hem, controlled crew/cuff/hem rib trims and a pale steel-blue matte fine-knit finish. Front/back/seam walls are literal first blockout responsibilities; physical knit simulation, refinement and materials remain later authored choices. No fixed old mesh is rescued.

Source A requires independently/root-reviewed COMPLETE responsibilities before01:30:12.096565UTC and root close01:34:12.096565UTC. It admits only considering PREPARATION of a separately reviewed constructor, never this packet's execution. Any future attempt needs fresh worth, complete producer/checker/runtime/accounting source review, a recorded sole CPU job with <=600second external wall bound and full/partial output/return inventory. First topology/intersection/clearance/enclosure refusal closes this exact artist source without coordinate/triangulation/seam/cap/threshold retuning or visual retries. Data A would still need separately reviewed native proposal and actual full front/back/oblique originals independently inspected before appearance. No native/GPU/render job exists here.

Keep accepted/default assets, original references, frozen failures and unrelated worktrees unchanged. Preserve full AAA character, hair/expression/wardrobe/representation and later VTuber/Mii roadmap. This sweater source study does not complete those milestones.
