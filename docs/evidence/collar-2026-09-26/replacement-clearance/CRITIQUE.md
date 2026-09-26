# Independent constraint and immutable-contact review — 2026-09-26

**Verdict: stop the joint bra/vest fixed-support attempt; no solver or export.** Four actual retained-vest intersections are proved on cloth triangles whose every vertex is fixed by the allowed support. The original bra-only bounded problem remains untested. This distinction matters: `COLLAR-REQUALIFICATION-2026-09-26.md` names full-body/retained-bra clearance in its bounded paragraph, while `CONSTRAINT-INTERFACE.md` additionally requires actual retained-vest clearance. The coordinator's decision to stop broader work does not retroactively prove bra-only infeasibility.

Reviewer: independent critic agent `/root/critic`. I reviewed `inventory.mjs`, its reused clearance/containment code, the constraint interface, the approved support, and the exact bob02 expressive frozen-interior vest snapshot at step 98. I wrote and ran `independent-fixed-witness.py`, which reads GLB accessors independently and uses Python exact rational arithmetic for edge/plane intersections and triangle barycentrics. It does not use Three, the reused intersection predicate, the inventory's contact tolerance, a solver, or a GPU. Its complete receipt is `independent-fixed-witness.json`.

The snapshot compressed SHA-256 is `c22de9d7e43174529744209d78ac789150c1ed10d82155ee0950006bf4040c13`; decoded SHA-256 is `66866406502735f0e5af97369481cccdfea574dbbb8e599c5e586f448cdeb182`. I verified the inventory's immutable capture-report copy, manifest, completed selected run, actual loader receipts, all 257 frozen capture source files, exact d81/vest GLB hashes, and the approved support digest. Both full snapshot index arrays equal their source GLBs. Rebuilding the any-corner vest mask yields exactly the actual 1,411 retained source triangles and the snapshot's drawn index array.

| Cloth source face | Cloth raw vertices, all fixed | Retained vest source face | Retained-array index | Exact transverse segment length |
| --- | --- | ---: | ---: | ---: |
| 1503 | 368, 881, 886 | 18271 | 426 | 0.762 mm |
| 1515 | 371, 884, 889 | 6120 | 42 | 1.612 mm |
| 1516 | 261, 371, 889 | 19672 | 568 | 0.0613 mm |
| 1517 | 261, 889, 885 | 26194 | 1163 | 0.0198 mm |

For each pair, two distinct exact intersection endpoints exist and their midpoint has strictly positive barycentric coordinates in both triangles. Their planes are nonparallel. These are actual transverse intersections of the saved Float32 geometry, not contacts inferred from a near-zero tolerance or unsigned distance alone. Every listed cloth vertex lies outside the 43 movable raw vertices in the 34 approved groups. Every vertex of the last three cloth faces also belongs to the fixed rear guard. Thus every point of those cloth triangles is unchanged under the permitted authored displacements at the unchanged native pose, and the vest target is unchanged. Other support vertices, smoothing within that support, or a larger iteration count cannot remove these intersections.

I inspected the hash-bound ordinary frames 96 and 99 around the snapshot. They show the raised jagged light collar edge/opening during the pose. Those images support the continuing visible quality problem; they do not localize the hidden rear contacts by themselves. The exact geometry and source-ID mapping establish the fixed rear witnesses.

The inventory's 180-face union is appropriate: the 91 moving-support incident faces and 25 rear-incident faces overlap the original 180 changed faces. Rear-incident does not mean every vertex of every such face is fixed; six rear-incident faces also contain another movable vertex. The four stop witnesses above avoid that ambiguity by checking all three raw vertices individually. Full-body contact/containment and retained-foundation contact have distinct tests. Hidden-mask footprint coverage is a separate property: the four fresh step-98 coverage controls report d81 passing both bra/vest additional-removal footprints while retained-vest geometry still intersects. A projected-coverage pass cannot clear this stop.

The prospective linearization is sensibly anchored to actual native d81 positions with current pose matrices and independent replay of the loaded asset. Its measured maximum LBS difference is about `1.053e-7 m`, below its `1e-6 m` instrument check but above the proposed `1e-9 m` no-regression allowance. That replay is a prerequisite for a future Jacobian, not precision sufficient to certify the tighter acceptance rule. Whole-triangle contacts, containment and nonlinear normal/area limits still require reevaluation on the exact proposed/native bytes. A zero coefficient in one projected scalar linear row alone must never be generalized to global infeasibility; the current proof instead has wholly immutable cloth triangles and fixed target geometry.

Two distinct future alternatives remain:

1. A separately scoped bra-only bounded study could retain the 34 groups and original rear guard, but must explicitly leave vest compatibility unresolved. Its feasibility and appearance are not established by this work.
2. A redesigned joint-foundation fit/support study could address the fixed vest contacts, but would require a newly reviewed support/fit contract and its own coverage, clearance and appearance qualification. It is not permission to expand the current support or weaken thresholds automatically.

The full capture matrix was stopped early and remains incomplete. The selected completed run and exact snapshot are sufficient to refute joint clearance under the fixed degrees of freedom, but do not qualify all motion, bob01, a candidate, GPU-deformed geometry, or between-sample safety. No trial was generated, and hair remains deferred.
