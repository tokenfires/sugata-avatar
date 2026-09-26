# Independent retained hand–trouser witness audit

September 26, 2026. **Both selected angry-step-637 transverse intersections are independently confirmed.** This is a CPU-only witness audit by the Wardrobe worker, separate from the author of `retained-witness.json` and its replay. No product, input witness, replay script, asset or pose was edited; no GPU job ran.

The compact certificate is [independent-validation.json](independent-validation.json). It contains exact rational edge parameters, intersection endpoints and barycentric coordinates, plus the input hashes and provenance checks. It validates two intersections, not the original exhaustive pair counts.

## Independent geometry result

All face IDs below are zero-based in the full source index buffers. Positive/negative plane signs are exact, not tolerance classifications.

| Side | Body hand face | Trouser face | Hand vertices against trouser plane | Trouser vertices against hand plane | Intersection segment length |
| --- | ---: | ---: | --- | --- | ---: |
| Left | 16436 | 3922 | `+ − −` | `+ + −` | 0.118877952 mm |
| Right | 3142 | 2622 | `+ + −` | `+ − +` | 2.172243931 mm |

For each pair, both triangles have nonzero area and their normals are nonparallel. Two hand edges cross the trouser plane at strict interior edge parameters. Each resulting point lies inside the trouser triangle. The two points are distinct, and their midpoint has **three strictly positive barycentric coordinates in each triangle**. This proves a transverse crossing through both triangle interiors, beyond a shared boundary or vertex touch. The exact endpoints rounded to binary64 match the retained floating-point endpoints with zero measured difference.

These are lengths of intersection segments, **not penetration depths or severity scores**. The left witness is short but has a strictly nonzero, exact-rational interior crossing.

The calculation used Python standard-library `fractions.Fraction` constructed from each stored IEEE754 coordinate. It imported neither `intersectTriangles` nor any project geometry/parser module. For triangle `B`, its unnormalized plane normal was `n = (B1 − B0) × (B2 − B0)`. Hand-edge signed values were `di = n · (Ai − B0)`. Opposite signs give `t = di / (di − dj)` and `P = Ai + t(Aj − Ai)`. Membership used the exact Gram-matrix barycentric solution; no epsilon was used to decide intersection.

The retained certificate makes this computation reviewable: `segment[].positionExact`, `tExact`, both endpoint barycentric triples and `interiorMidpoint` are rational numerator/denominator strings. The decimal segment length is a derived display value only.

## Binding and face membership

- All **12** current source/asset hashes in the original receipt match. Eleven are also present and identical in the frozen capture's source map; the remaining reusable `hair_surface.mjs` is receipt-bound but was not used by this audit. Nine corresponding archived source copies were independently hashed and matched. The two binary assets match the capture map and current installed bytes.
- The current September 26 capture report matches its recorded SHA-256. The selected bob02/expressive/bra/accepted-installed case completed without recorded errors. Its manifest role, actual loader response and route receipt bind the outer asset to accepted `44ebc3…`. The complete qualification remains **partial: 8 completed cases of 16 planned**, not a full qualification.
- All three referenced snapshot files (steps 0, 637 and 720) match their compressed and decoded hashes in both the original witness and native case report. Full body and outfit topology match the installed GLBs. Snapshot time, posture telemetry and applied gesture match the receipt.
- All **40 retained witness records**, across those three poses and both target categories, have exactly matching face IDs, vertex IDs, coordinates and claimed drawn membership in the hashed snapshots. Only the two selected hand–trouser intersections received the independent intersection predicate; this binding check does not recalculate the other intersections or counts.
- A direct GLB binary/accessor parser confirmed that every vertex of the selected left/right hand faces carries at least 0.5 summed weight on the corresponding hand/finger joint family. The left vertices sum to 1; two right vertices sum to approximately 1.00000003 from source float rounding and the third to 1. All four selected hand/trouser faces occur as exact ordered triples in the actual `drawnIndices` buffers.
- An independent adjacency-graph traversal reproduced the lower garment component after the documented source-position quantization at 1e-7 m: **1,712 triangles, 950 raw vertices, faces 2524–4235**, maximum rest Y = 0.940387070 m. Both selected target faces belong to it. This independently establishes “trousers” membership without a posed screen rectangle. It preserves the author's quantized seam-weld convention; it is not a new Euclidean-distance welding specification.

## Older full-body image correspondence

The [September 22 full-body step-637 image](../../../../captures/collar-stress-2026-09-22/gpu-v1/bob02-previous/body-637.png) was directly inspected and shows the hand/trouser overlap. Its SHA-256 and the paired older snapshot/report hashes match the original capture's receipts.

The older snapshot and September 26 step 637 have the same five mesh IDs: body, bra, briefs, casual outfit and shoes. **All five position arrays, full index arrays and drawn index arrays are exactly equal.** The older image is therefore paired with the same retained clothed geometry, not merely a similar pose. This does not establish current rendered pixel equality, the current camera, GPU deformation, material state, visibility from every angle or a newly captured current full-body image.

## Scope of acceptance

Accepted: current input binding, the two selected drawn transverse hand–trouser crossings, and the older-image/retained-geometry correspondence. The certificate rehashed its checked inputs at the end; none changed during this audit.

Not independently recomputed: all-pair intersection totals, global containment, penetration depth, forearm/other contact families, continuous motion, other poses/identities/outfits or the original script's tolerance sweep. No isolated owner ablation was performed. This confirms a defect outcome and a useful diagnostic starting point; it does not attribute sole causality to posture, gesture, rest pose or any other writer, and it does not approve a clearance remedy.
