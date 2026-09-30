# Independent critique — raised crew-neck shape observation

## Disposition

**Close this exact candidate as an unsuccessful shape study. Keep accepted44 installed.** The front view conceals the original grey neckline chips, but both oblique views retain a grey island and the raised rim exposes black wedge-shaped regions beside the neck. The saved-pose audit independently confirms body intersections. Do not retune the declared 12/4/80 mm recipe or add lining to rescue this packet.

This is useful evidence about a specific construction and boundary. It is not proof that a higher crew neckline, the existing topology, or garment fitting generally is infeasible.

Reviewed candidate: `9ba24c2fa72499e3e29f10850c147bfc5a174cd4b38ec8f8eacea1865cd62e35`; accepted input: `44ebc3eb3a09408a3563d369ae74be15a5bc4beb8040bc43c2c5446d6e65c783`.

## Construction and capture validity

I read the [construction source](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/neckline_construct.mjs:21), [declared plan](/Users/robault/GitHub/sugata-avatar/docs/evidence/wardrobe-2026-09-30/neckline-construction/PLAN.md:9), and [capture source](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/neckline_shape_capture.mjs:14). No material implementation mismatch with the declared shape observation was found:

- Source lines 21–47 recover positional welds, check joint/weight equality, use source-edge distances and apply the declared quintic displacement inside 80 mm. This is graph distance on source edges, not an exact geodesic on a continuous surface.
- Lines 48–75 check affected face areas/orientation, reconstruct normals in the original coincident smoothing partitions, restrict binary edits to permitted POSITION/NORMAL records, retain all other metadata, reread Float32 output, and verify weld coincidence.
- The [construction report](/Users/robault/GitHub/sugata-avatar/captures/neckline-construction-2026-09-30-v1/report.json) records 112 moving groups, 124 vertices, 234 affected faces and 156 normal records. Maximum displacement is 15.9513 mm; face area ratios are 1.000815–1.332756, minimum orientation dot 0.937208. These are construction sanity results, not clearance or appearance acceptance. Former fixed vest witness faces 1503/1515/1516/1517 participate in this new support.
- V1 correctly stopped when the styled-look asset allowlist rejected the unqualified candidate. V2 uses `style=original` in **both** arms, preserving the original material rather than bypassing that guard.
- V2 completed all eight original PNGs at yaw 0, −45, +45 and 180 on Apple metal-3 WebGPU. Recorded errors are empty; all eight owners disposed with no recorded leaks. Actual loaded GLB bodies are hashed. At each matched yaw, I independently compared the saved state after excluding only the changed garment mesh: recorded physical hashes, body/foundation geometry, rig, lights and camera agree exactly. Final frame/grain are 99 and time/delta are zero.
- I verified all eight PNG hashes, compressed and decoded state hashes, and available archived source hashes against their reports. The capture and audit both pin the construction report. This does not assert zero pixel differences outside the collar or complete renderer-history identity.

## 1. Front concealment does not satisfy the all-view neckline objective

I directly inspected all eight original 900 × 868 images. Coordinate windows below are approximate visual locators, not pixel ownership or triangle attribution.

| View | Actual paired evidence | Observation |
|---|---|---|
| Front | [accepted](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/accepted-0.png), [candidate](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/candidate-0.png) | The grey chips near the former inner edge disappear from this view. The neckline rises and the transition broadens. New black wedges are visible near x209–250/y642–670 and x512–558/y628–669. |
| −45° | [accepted](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/accepted--45.png), [candidate](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/candidate--45.png) | The near-side grey chip is covered, but a narrow grey island remains around x583–602/y690–730, now visibly separated from the blue rim. Black wedges appear near the near rear corner x313–338/y644–666 and the far side below the hair. |
| +45° | [accepted](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/accepted-45.png), [candidate](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/candidate-45.png) | A grey strip remains around x216–239/y676–724, with skin separating it from the raised rim. Black wedge-shaped regions appear near x216–240/y644–671 and x470–490/y632–651. |
| Rear | [accepted](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/accepted-180.png), [candidate](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-2026-09-30-v2/candidate-180.png) | The higher rear rim and broad transition remain readable without an obvious new sharp crease. Strong blue light limits subtle surface assessment. This view cannot qualify the concealed interior. |

The previous attribution established retained-bra ownership of the original chips. These new oblique islands are visually consistent with the unchanged foundation, but they have not received a new material tag or per-pixel ownership audit. Likewise, the black regions are a visible continuity failure; I do not equate them with topological holes, prove culling as their sole cause, or identify a body-intersection triangle from the image alone. Topology was deliberately unchanged.

**Two defensible future approaches:**

- **A — construct a new neckline patch with an explicit exterior rim, shoulder/chest join and inner finish.** Choose those boundaries against the actual body and retained foundations before authoring the surface. Preserve the lower garment and establish new coverage and skinning evidence. This directly addresses the floated rim and oblique openings, but changes the construction contract and requires fit, foundation compatibility and motion qualification.
- **B — author a compatible lower-cut foundation and retain a supported outer-neckline design.** This can remove the visible foundation islands without trying to cover them by lifting the whole rim. It creates a new wardrobe compatibility obligation and cannot by itself repair this candidate’s black openings or body contacts. It is a genuine foundation-shape alternative, not mask deletion or recolouring.

Neither alternative is a request for another amplitude pass in this study.

## 2. Saved-pose body failure and a concrete fixed-boundary conflict

I read the [audit source](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/neckline_shape_audit.mjs:14) and [completed result](/Users/robault/GitHub/sugata-avatar/captures/neckline-shape-audit-2026-09-30-v1/report.json). It uses the exact hashed front snapshots, all three vertices of each of the 234 affected garment faces, the full 26,756-triangle body, and the actually retained 327 bra triangles. Source IDs are preserved for garment/body; bra target indices are compact retained-array indices with a recorded mapping. It does not audit vest or the whole garment.

| Saved zero-time pose, 234 garment faces | Accepted44 | Candidate |
|---|---:|---:|
| Faces intersecting body surface | 27 | 11 |
| Face centroids inside closed body | 11 | 1 |
| Faces intersecting retained bra | 5 | 0 |
| Minimum triangle distance to retained bra | 0 mm | 11.650904 mm |

Candidate body-intersection faces are 578, 579, 662, 663, 1447, 1496, 1497, 1515, 1516, 1517 and 1521. For example, garment578 intersects body15668 at approximately `(0.00040609, 1.27911675, 0.12847716)` metres. Its centroid winding is 1, corroborated by five unambiguous inside parity results. Counts are **intersecting garment faces**, not total triangle pairs. The closed body has no reported welded boundary, nonmanifold or orientation-error edges. The open bra receives no global containment claim; negative local-normal signs there are not penetration depths.

The [boundary check](/Users/robault/GitHub/sugata-avatar/captures/neckline-boundary-check-2026-09-30-v1/report.json) adds a stronger contract-specific witness. Of 32 fixed raw vertices incident to the affected patch, vertex **312**, incident to faces578/579, is unchanged between accepted and candidate at world `(0.0246194154, 1.2751214504, 0.1302341372)` metres. Its winding is 1 and all five parity rays are unambiguously inside. I checked its saved coordinate equality and independently recomputed its solid-angle winding in Python as 1.0000000000000002. [Source lines 8–15](/Users/robault/GitHub/sugata-avatar/tools/figure-pipeline/neckline_boundary_check.mjs:8) state exactly how the fixed set and witnesses are selected.

Keeping that vertex, its weights, and this pose fixed prevents an all-exterior patch under the present support contract. This does not say which new support is sufficient, nor make the remaining contacts visible in the render.

**Two concrete structural alternatives:**

- **A — inventory an exterior attachment loop first, then define a new patch contract.** Inspect the full triangle interfaces and posed boundary points, including the region containing312, and select a join only after it is outside the body with a declared allowance. This is a bounded boundary feasibility step before any construction. It may force a larger region, but avoids an arbitrary next support-width increment.
- **B — replace or reauthor the upper bodice with newly fitted topology and skinning.** An intentional garment-level design can place both neckline and chest/shoulder boundaries coherently, without inheriting312 as an immutable join. This is a larger asset and compatibility task with substantial UV, weight, foundation and motion work; the current evidence does not prove it necessary or successful.

Prefer A if collar work resumes. For now, freeze the failed observation and its original images. There is no justification to promote the candidate, inherit an old clearance pass, or relax the closed September26 34-group gates.

## Evidence pins and limits

- Construction report SHA256: `aedb000a208c5e06da11cc8f6e2e2e146d750fa96bfafd7a7d0af227f5e5aa87`.
- V2 capture report: `347adaaf07d555891c3aece56167590c0b3f17c9c8f48c816873848ef3c30a39`.
- Saved-pose audit report: `9db40bab64e152cb415c23f00f3e1aaa01dc7f45ace2789f7bedc14b7181b41f`.
- Boundary report: `448bbe5db27ecd94e6910edbf039370950ad048f06ff574689daacf3c810cf08`.

One identity, original material, lighting rig, relaxed pose and four cameras were inspected. Geometry snapshots are CPU-skinned world positions, not GPU garment readback. Surface calculations use floating-point predicates; centroid containment is not an exhaustive volumetric clearance certificate. No new motion, vest, all-garment, natural-material or product acceptance is claimed.
