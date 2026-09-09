# Calibrated long-bob body contact

The core owner is integrated into Avatar for the exact corrected bob01/g050 geometry. The shipping original GLB is still unchanged at this checkpoint, so it reports an explicit calibration mismatch and keeps the existing solver. Routing the reproducible corrected groom exercises the actual runtime path; prototype renderer monkey-patches are no longer needed. Final persistent-motion, frame-budget and visual acceptance remain pending.

## Selection and loading

`HairBodyContactCalibration.js` snapshots and hashes actual attribute components as canonical Float32/Uint32 values using Web Crypto. It validates positions, normals, UVs, normalized skin weights, skin indices, full topology, bone order and inverse binds. Counts alone cannot identify card order. The current data comes from the tracked anatomy correspondence and immutable original groom transformed by `tools/figure-pipeline/hair_long_fall.mjs`. The selftest regenerates that groom without ignored capture inputs.

Avatar captures style/bake/wardrobe topology at the attach call, validates after its initial dynamic imports, and checks load token/disposed/stage immediately after each new import or digest await. It refreshes the pending groom's world transform after all awaits. Only a matching selection imports/constructs the body-contact owner. A mismatching or unsupported bake records `report().hair.bodyContactUnavailableReason`; active contact reports its actual owner settings under `bodyContact`. Bob02 does not enter this calibration path.

Wardrobe compacts the draw index. Contact receives `Wardrobe.fullIndex`, preserving original oriented triangle ordinals while current morphs and skinning come from the live body. The validated index/positions/normals are copied for construction. Body/groom geometry is expected to remain immutable after acceptance, apart from draw masking and supported morph/pose state; geometry or skeleton replacement requires a new selection/owner.

## Solver ownership and submission

`createHairBodyContactFactory({body, groomMesh, selection, outerIterations=16, resetIterations=64})` returns the synchronous private factory consumed by HairDynamics. It owns one CPU patch, one three-buffer GPU query and one six-buffer/four-kernel contact stage for each of four solver substeps. Renderer, body mesh/skeleton/geometry, groom and the solver's position/velocity/rest-length buffers are borrowed.

For each submitted frame, the owner atomically skins/refits and advances previous/current body history once. It then uploads the shared surface and assigns substep interpolation fractions. No-step frames do not advance submitted history. The body surface interpolates vertices/normals, not intermediate skeletal poses, and uses bounds covering both endpoint poses. This is not continuous collision detection.

Normal contact runs after each DFTL step and before the single final ribbon rebuild. The current default executes sixteen query/projection pairs, adding contact displacement divided by the supplied substep duration to velocity. Reset uses sixty-four full-query settling passes, collapses body history and omits velocity finalization. Both test schedules share this exact reset. The every-two-projection query control failed sustained nod compliance (2.1825mm/43.52% link error) and has been removed from the core owner. Its matched experiment is preserved in the source snapshots. The report gives actual regular/reset query counts.

The query finds the closest witness over the entire span and conservatively uses the maximum endpoint half-width norm. Cross-product segment math avoids near-parallel Float32 cancellation. At numerically coincident contact, the stage uses the authored outward normal rather than normalizing tiny tangent residue. Root-AABB rejection is conservative; cached triangles seed a full bounded traversal. Dispatch order groups the same ring across chains while keeping projection/output records card-major. Each particle root has zero inverse mass.

Disposal retires the owner first and attempts every stage, shared buffer and CPU patch even if another release throws. Partial construction releases earlier resources before the solver cleans its borrowed buffers. A submission or preparation failure retires the contact-enabled solver; partially advanced history cannot be reused as if it had been submitted. Contact's35 total storage attributes with the solver are released once (8solver +3surface +4×6stage); actual allocated-byte/GPU lifetime checks are separate from CPU ownership checks.

## Domain and evidence limits

The calibrated patch contains1,872 neck/shoulder triangles and1,069 vertices, and current active chains include all496 cards. It is an open local surface, so signed nearest-normal distance is not global body containment. Higher neck/scalp and garments remain separate full-triangle gates. Broadening the patch produced infeasible fixed-root norm contacts and was not installed. The radius bound adds conservative stand-off and is not an exact tapered ribbon distance.

All six frozen controls at sixteen/sixty-four passes clear face and selected neck triangles; outside-patch body intersections remain. A large pose jump can temporarily stretch a short link by10.74% at sixteen passes, reduced below0.571% after sixty-four. Those are convergence controls, not sustained-frame results. Query-every2 changes some outside-patch pair identities; persistent matched captures must establish its quality/performance tradeoff. The full test suite has four known HairMaterial failures and is not claimed green.

Core smoke evidence is in `captures/body-contact-core-2026-09-09/smoke-nod`: actual Avatar/corrected GLB, two nod poses, enabled contact report, stable sources/assets and zero browser errors. Exact face/neck replay passes. More complete results and the current source freeze are in `docs/OVERNIGHT-2026-09-08.md`.

Run the focused gates:

```sh
node packages/core/src/motion/HairBodyContactCalibration.selftest.mjs
node packages/core/src/Avatar.hair-contact.selftest.mjs
node packages/core/src/motion/HairSurface.selftest.mjs
node packages/core/src/motion/HairDynamics.contact.selftest.mjs
node tools/critic/portrait-clearance.selftest.mjs
node packages/core/src/Avatar.selftest.mjs
```

The calibration/owner tests cover fifteen CPU groups, including actual TSL node construction, reset/normal ordering, canonical masked topology, altered assets, partial stage failure, reentrant retirement and cleanup errors. The two Avatar tests defer actual Web Crypto digests and retire the caller by disposal or a new identity token. These do not replace GPU motion, appearance, frame-time or renderer-memory acceptance. Twelve portable primitive groups now include actual core GPU queries/contact planes/bounds and both historical rejection controls; see docs/HAIR-SURFACE-PRIMITIVES.md.

## Full skin transform

Avatar now folds both bind matrices into the rigid head inputs: M=mesh.matrixWorld,
A=bindMatrixInverse×headBone.matrixWorld, B=headInverseBind×bindMatrix. HairDynamics uses M×A×B
for world particles and inverse(M) for object-space rebuilt vertices. Omitting the attached-mode
inverse bind doubles common parent transforms; native Three witnesses reject the old path by
374mm for one translation and80mm for one rotation. Identity binds retain exactly the old
operand grouping. See docs/HAIR-SKIN-TRANSFORM.md.

Calibration refuses nonfinite, nonaffine, scaled, sheared or reflected full skin transforms.
Valid rigid translations/rotations and nonidentity binds remain supported. The owner checks
again at construction and each preparation; a later direct solver call with nonrigid input
retires contact without submitting. Avatar additionally refuses invalid input before feeding
the solver, leaving the last submitted contact history intact. Body skinning itself supports
nonuniform transforms; the restriction is the hair solver's fixed width/rest-length contract.
