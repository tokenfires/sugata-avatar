# Independent critique: front feasibility observations

## Disposition

**Accept this packet as a bounded geometric diagnostic. It produces no groom candidate or demonstrated style improvement.** Four unchanged baseline ribbons and four declared long-card witnesses have zero reported triangle/body pairs and zero negative sampled vertices at authored rest. The long-card witnesses show that body clearance alone does not resolve the joining problem. Neither of the two sampled constructions establishes generally infeasible anchors or a usable new flow.

Reviewed [probe source](/Users/robault/GitHub/sugata-avatar/tools/critic/probe-front-reachability.mjs), [result](/Users/robault/GitHub/sugata-avatar/captures/bob-front-reachability-v1/report.json), and the preserved [four-card constraints](/Users/robault/GitHub/sugata-avatar/captures/bob-front-constraints-v1/report.json). Result SHA-256: `ae4ad28fac664cff456639589eb822593618dbef7c526c96ccf70e1e0e9cf2ae`. Hair input is side-v3 `bbed05d0ce51eccc84fbfb1a9baca9f4e9a36ac2b3176869d2e7bfda27fa8ad9`; body is `b56115d0cb52edb72af7e725bf479d81253b660c298bd95ff9e89456d671ec14`.

## Source and result checks

- All eight input/source pins and all five copied tool snapshots match current bytes. The source checks its inputs again before publishing.
- Independently compared reported geometry/topology with the pinned GLB: each of the eight observations contains the original 32 triangles, with correct source triangle IDs, no cross-card triangles, and all 26,756 body triangles included. The [unbounded oracle call](/Users/robault/GitHub/sugata-avatar/tools/critic/probe-front-reachability.mjs:80) does not restrict the audit to a face box or apply alpha visibility filtering.
- Root and suffix positions are exact; only the two ring-1 vertices change in derived witnesses. Original width vectors are exact in the diagnostic double arrays. Recomputed triangle areas match exactly; centre-turn differences are at most 0.00000121 degrees from equivalent floating-point angle evaluation.
- The observations are JS doubles. Maximum reported Float32 round-trip displacement is 0.0000592011 mm; Float32 geometry is not separately audited or exported. No normals, GLB, capture, or visual result are produced. There is no material source bug requiring repair for this stated scope.

## 1. The short endpoints require a declared change of role or length

[The short-card branch](/Users/robault/GitHub/sugata-avatar/tools/critic/probe-front-reachability.mjs:111) correctly applies the triangle inequality. Both requested endpoints are `(-0.086, 1.52, 0.108)` metres, inherited from the rejected prototype's [neighbor-side heuristic](/Users/robault/GitHub/sugata-avatar/tools/critic/bob-front-support.mjs:72).

| Card | Original centreline arc | Root-to-requested-endpoint chord | Minimum required arc ratio |
|---|---:|---:|---:|
| 7 | 88.287973 mm | 194.206584 mm | 2.199695× |
| 46 | 77.203576 mm | 185.178874 mm | 2.398579× |

Keeping original arc length would make those endpoints impossible even before body clearance. Original-length preservation is an optional diagnostic assumption, not a preexisting style requirement. Card 7's original first tangent points toward positive X while the heuristic requests a negative-X endpoint; the frozen inventory records the actual frame. The photos do not prescribe this side assignment or a shared temple endpoint.

Two concrete alternatives:

- **A: Keep the requested endpoints and permit substantial extension explicitly.** A later full-ribbon reachability study could then examine the fixed attachment frames. Tradeoff: these former short coverage cards acquire a much longer role; a clear individual path would not establish sensible layering or coverage.
- **B: Keep the short-card role and design endpoint/side assignment with neighboring coverage first.** Tradeoff: this is a broader attachment/flow decision, but avoids treating the rejected heuristic as a photographic requirement.

**Recommendation:** choose the intended role before constructing a short-card route. Neither short card received a derived route in this probe; their clearance results are baseline controls only.

## 2. An exact centreline join trades against spacing and preceding bend

[The long-card construction](/Users/robault/GitHub/sugata-avatar/tools/critic/probe-front-reachability.mjs:121) fixes root ring 0 and suffix rings 2–16, leaving only ring 1 free. It uses `c1 = c2 − λt`, where `t` is the fixed suffix tangent. This creates a nontrivial comparison; an endpoint-only solver could simply return the already-clear original path.

With `d = c2 − c0` and original prefix arc `L`, the no-growth diagnostic gives `λ ≤ (L² − |d|²) / (2(L − d·t))`, subject to the checked positive denominator and `λ ≤ L`. Exact zero join and no growth are declared engineering conditions, not reference-derived targets.

| Card / observation | Last prefix span | Prefix arc | Ring-1 centre turn | Ring-2 centre join | Minimum adjacent triangle area |
|---|---:|---:|---:|---:|---:|
| 145 baseline | 7.196505 mm | 15.130478 mm | 17.424361° | 9.311145° | 106.183504 mm² |
| 145 no growth | 4.067323 mm | 15.130478 mm | 19.648277° | ≈0° | 54.839068 mm² |
| 145 original span | 7.196505 mm | 15.380593 mm | 27.034849° | ≈0° | 107.357488 mm² |
| 204 baseline | 6.047888 mm | 12.428277 mm | 5.142871° | 27.988967° | 110.018304 mm² |
| 204 no growth | 0.115147 mm | 12.428277 mm | 27.072154° | ≈0° | 1.015531 mm² |
| 204 original span | 6.047888 mm | 13.578962 mm | 48.081670° | ≈0° | 120.646702 mm² |

The no-growth 204 observation compresses one span to about 1.90% of its original length. It is not numerically degenerate under the oracle's tolerance, but zero contacts cannot make this compressed sampling a groom success. Preserving the old final span avoids that compression with only 1.150685 mm extra prefix length, yet transfers substantial bend to ring 1. Card 145 shows the same upstream-bend tradeoff at smaller scale. These are geometric observations, not rendered crease claims.

Two concrete alternatives:

- **A: Retain current anchors and evaluate the whole prefix and both edges jointly.** Any next numerical formulation should assess both turns, spacing/triangle quality and frame continuity, rather than demand a zero ring-2 turn. Tradeoff: the objective and acceptable changes must be declared; another clear or converged sample still would not prove appearance.
- **B: Explicitly examine a larger transition boundary before solving.** Inventory an additional free ring and the exact protected suffix it would release, while keeping the body and neighboring protected coverage visible in the record. Tradeoff: this changes the existing boundary contract and requires fresh isolation/qualification. The present two samples do not prove that expansion is necessary.

**Recommendation:** retain A as the smaller next formulation; do not adopt either measured witness or run a λ sweep. First define a whole-prefix objective that corresponds to coherent flow. B is a separately declared alternative if that formulation exposes a concrete boundary conflict.

## 3. Full-ribbon continuity remains distinct from centreline clearance

The original width vector is retained by [translating both ring-1 edges](/Users/robault/GitHub/sugata-avatar/tools/critic/probe-front-reachability.mjs:128). This is a useful control, but a zero centre join does not give zero edge joins:

| Card / observation | Left/right edge join angles at ring 2 |
|---|---:|
| 145 no growth | 13.656887° / 18.147221° |
| 145 original span | 5.443467° / 7.131582° |
| 204 no growth | 57.854613° / 110.502179° |
| 204 original span | 11.270976° / 15.291096° |

All reported full-ribbon body audits are clear. Minimum signed vertices are 3.606771 mm for baseline 7, 4.902106 mm for baseline 46, 3.748078 mm for all 145 observations, and 3.667536 mm for all 204 observations. These vertex minima do not establish a continuous ribbon-wide clearance margin. In particular, the failed prior support card 46 had a positive centre and a penetrating edge despite an almost perpendicular width axis; that counterexample remains relevant.

Two concrete alternatives:

- **A: Preserve the fixed-width frame as the next control and report both edge paths.** Tradeoff: it isolates centreline effects but may constrain available smooth ribbons. There is no present body-contact evidence requiring a width repair.
- **B: Allow the free ring's width orientation to participate in a later whole-ribbon formulation.** Tradeoff: additional frame freedom could redistribute edge bends, but introduces twist, root transition and normal continuity questions. It must not be presented as an automatic fix.

**Recommendation:** A until a declared whole-prefix objective supplies a reason to release the frame.

## Bounded next step and limits

Freeze this packet. The next useful work is a small constraint/objective decision for these witnesses: select the short cards' intended role, and formulate coherent whole-prefix flow for long cards without insisting on an isolated zero join. Preserve the already-clear baselines and both measured alternatives. Do not manufacture another whole-front asset from these observations.

No new image was produced or judged in this slice. The earlier front arch/fan failures and photographic target remain unchanged. Rest intersection results do not qualify visible coverage, alpha, normals, cap, hair-to-hair interactions, garments, shared runtime response, or motion. Card 58 remains an independent later motion gate. A failed witness rejects that witness; a failed bounded solver would mean no solution found under its procedure, not general infeasibility.
