# Calibrated long-bob body contact

The corrected bob01/g050 is now the shipping asset. The live portrait loads it without test substitutions and activates `bob01-g050-long-fall-nape-v2`: the cheek-wrap rest correction plus separate neck protection for nine inner-nape cards. Bob02 and the other four bob01 bakes are unchanged. The composed g025 candidate remains unshipped; its complete motion failures are documented in [the g025 record](HAIR-BODY-CONTACT-G025.md).

The measured g050 improvement is scoped: exact face and selected-nine full-triangle gates pass across22 original paired poses and85 additional directional poses. Original22-pose exhaustive opacity passes20,354,620 evaluations; further85-pose enumeration is still running. Other attachment, cap and curtain contacts remain under extreme poses. Rear layer organization and final appearance remain separate work; this is not whole-body zero-collision certification.

## Selection and loading

`HairBodyContactCalibration.js` snapshots and hashes actual attribute components as canonical Float32/Uint32 values using Web Crypto. It validates positions, normals, UVs, normalized skin weights, skin indices, full topology, bone order and inverse binds. Counts alone cannot identify card order. The current data comes from the tracked anatomy correspondence and immutable original groom transformed by `tools/figure-pipeline/hair_long_fall.mjs`. The selftest regenerates that groom without ignored capture inputs.

Avatar captures style/bake/wardrobe topology at the attach call, validates after its initial dynamic imports, and checks load token/disposed/stage immediately after each new import or digest await. It refreshes the pending groom's world transform after all awaits. Only a matching selection imports/constructs the body-contact owner. A mismatching or unsupported bake records `report().hair.bodyContactUnavailableReason`; active contact reports its actual owner settings under `bodyContact`. Bob02 does not enter this calibration path.

Wardrobe compacts the draw index. Contact receives `Wardrobe.fullIndex`, preserving original oriented triangle ordinals while current morphs and skinning come from the live body. The validated index/positions/normals are copied for construction. Body/groom geometry is expected to remain immutable after acceptance, apart from draw masking and supported morph/pose state; geometry or skeleton replacement requires a new selection/owner.

## Solver ownership and submission

`createHairBodyContactFactory({body, groomMesh, selection, outerIterations=16, resetIterations=64})` returns the synchronous private factory consumed by HairDynamics. A validated calibration with explicit multiple domains selects `HairBodyContactForest`; the existing single-domain path remains unchanged for g025 and legacy controls. Both own three shared query buffers and one six-buffer/four-kernel contact stage per solver substep. The forest keeps two independent CPU patches/skin histories and packs them atomically after both updates succeed. Renderer, body mesh/skeleton/geometry, groom and the solver's position/velocity/rest-length buffers are borrowed.

For each submitted frame, the owner atomically skins/refits and advances previous/current body history once. It then uploads the shared surface and assigns substep interpolation fractions. No-step frames do not advance submitted history. The body surface interpolates vertices/normals, not intermediate skeletal poses, and uses bounds covering both endpoint poses. This is not continuous collision detection.

Normal contact runs after each DFTL step and before the single final ribbon rebuild. The current default executes sixteen query/projection pairs, adding contact displacement divided by the supplied substep duration to velocity. Reset uses sixty-four full-query settling passes, collapses body history and omits velocity finalization. Both test schedules share this exact reset. The every-two-projection query control failed sustained nod compliance (2.1825mm/43.52% link error) and has been removed from the core owner. Its matched experiment is preserved in the source snapshots. The report gives actual regular/reset query counts. Every pair still evaluates its contact inputs. An optional cache reuses collision results only when their Float32 input bits are identical within the current batch; it changes no scheduled solve passes.

The query finds the closest witness over the entire span and conservatively uses the maximum endpoint half-width norm. Cross-product segment math avoids near-parallel Float32 cancellation. At numerically coincident contact, the stage uses the authored outward normal rather than normalizing tiny tangent residue. Root-AABB rejection is conservative; cached triangles seed a full bounded traversal. Dispatch order groups the same ring across chains while keeping projection/output records card-major. Each particle root has zero inverse mass.

Disposal retires the owner first and attempts every stage, shared buffer and CPU patch even if another release throws. Partial construction releases earlier resources before the solver cleans its borrowed buffers. A submission or preparation failure retires the contact-enabled solver; partially advanced history cannot be reused as if it had been submitted. Contact's35 total storage attributes with the solver are released once (8solver +3surface +4×6stage); actual allocated-byte/GPU lifetime checks are separate from CPU ownership checks.

## Exact input reuse

The owner enables `cacheQueryInputs` on each contact stage. Direct stage callers default to false. Every normal and reset batch begins with `snapshotNode`, which invalidates all query records. Body positions/normals, interpolation alpha and contact metadata stay fixed inside that batch. Reuse is forbidden across snapshots, body updates or substeps. Standalone callers opting in must preserve this contract.

Point queries compare the endpoint bits; spans compare both endpoints, including signed zero and one-ULP differences. A hit retains plane, segment parameter, nearest triangle and active state. Traversal counts become zero because no traversal ran; a separate metadata reuse flag distinguishes this from root-bound rejection. `contactReport().queryInputReuse` exposes the layout and contract. Two extra metadata blocks add2,031,616 bytes across four stages without adding a query storage binding or increasing the35-buffer count.

## Domain and evidence limits

The original patch contains1,872 neck/shoulder triangles and1,069 vertices. Current g050 keeps487 cards on that patch and gives nine inner-nape cards a2,076-triangle/1,201-vertex superset, retaining all original coverage. Both trees keep separate boundary masks and histories inside three GPU buffers; their3,948 triangle records/2,270 vertices are summed storage, not anatomical union. A frozen chain-to-domain table shares the topology buffer, preserving eight query storage bindings. All496 cards retain16 full correction rounds per substep.

These are open local surfaces, so signed nearest-normal distance is not global body containment. Broadening the domain for every card produced infeasible fixed-root constraints and remains rejected. The chosen nine-card subset has feasible roots/first spans in all107 sampled poses, with a tightest measured first-span margin+2.430mm in reverse nod. Other fixed-root overconstraints remain: complete reverse-nod comparison proves the other487 chains and caps are bit-exact with the original-domain control. The radius bound adds conservative stand-off and is not an exact tapered ribbon distance.

All six frozen controls at sixteen/sixty-four passes clear face and selected neck triangles; outside-patch body intersections remain. A large pose jump can temporarily stretch a short link by10.74% at sixteen passes, reduced below0.571% after sixty-four. Those are convergence controls, not sustained-frame results. Both cheaper schedules have now failed sustained short-link compliance: queryEvery2 reaches43.52% on nod, once-per-frame reaches28.22%, versus6.66% for the unchanged substep control. Both are rejected. The full test suite has four known HairMaterial failures and is not claimed green.

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

The calibration/owner tests cover sixteen CPU groups, including actual TSL node construction, reset/normal ordering, canonical masked topology, altered assets, partial stage failure, reentrant retirement and cleanup errors. Four Avatar cases across g050/g025 defer actual Web Crypto digests and retire the caller by disposal or a new identity token. These do not replace GPU motion, appearance, frame-time or renderer-memory acceptance. Twelve portable primitive groups now include actual core GPU queries/contact planes/bounds and both historical rejection controls; see docs/HAIR-SURFACE-PRIMITIVES.md.

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

## Measured query optimization and frame budget

The promoted triangle-AABB query preserves every field in primitive/adversarial GPU tests
and six496-chain full-contact fixtures at16/64 passes. Its exact source hashes and portable predecessor comparison are in the overnight checkpoint,
performance ledger and HAIR-SURFACE-BOUNDS.md. It changes no contact
policy or schedule.

In the actual core Avatar portrait at716×750,720 rAF-paced fixed60 frames each submit two solver
steps. Compute median improves18.239→14.836ms; update-to-GPU wall median21.1→18.0ms and
p9522.7→21.4ms. That predecessor still exceeds the16.7ms60FPS target. Timestamp resolution and compositor
waits are excluded; summed render timestamps overlap. This is not a measured interactive60FPS
claim. See `docs/evidence/hair-body-contact-performance-2026-09-09.json`.

The actual Avatar transform/lifetime regression passes eight GPU groups, including moved and
rotated common parents, bind transforms, pre-submit scale refusal/resume, style transitions and
pending-digest disposal. Existing bob02 quick24/disposal21 still pass; see
`docs/AVATAR-HAIR-CONTACT-REGRESSION.md`. This older regression retains its immutable legacy calibration/golden; the shipping g050 change has a separate independent-golden forest regression.

The subsequent exact-input cache passes six496-chain fixtures at16/64, eleven actual GPU
invalidation/input cases and nine actual Avatar lifecycle groups. A separate720-frame actual
portrait comparison preserves final particle positions, velocities, rebuilt vertices, head and
step count exactly. Update-to-GPU wall median improves18.2→14.3ms (p9521.4→15.7); compute
median14.876898→11.665822ms (p9518.529468→12.896095). The same timing exclusions apply.
This tested workload fits a16.7ms budget at median and p95, but interactive frame pacing and
other poses/bakes/hardware remain separate. See `docs/evidence/hair-body-contact-input-cache-2026-09-09.json`.

## Inner-nape domain and forest execution

The original g050 inner-nape intersections sat above the original1872-triangle domain. A CPU
check over22 saved natural/nod poses supports a separate anatomical2076-triangle superset for
nine curtains, retaining all original neck/shoulder triangles. All198 roots and complete first
spans clear their width bounds; the lowest margins are5.706mm and3.672mm respectively.
All74 saved opaque negative witnesses are covered. This is a bounded domain-feasibility result,
not arbitrary-pose clearance.

An isolated owner partitions487 original-domain and9 expanded-domain chains into complete
sequential batches. Its same-domain control preserves all496 positions, velocities and rebuilt
vertices exactly after720 frames; the expanded arm preserves the other487 and every pinned root.
However update-to-GPU wall median rises14.2→18.5ms for partition overhead and22.1ms for the
expanded domain. This prototype is not promoted. Its3948 triangles/2270vertices are summed
storage records; anatomical union is2076/1201. See
`docs/evidence/hair-body-contact-nape-prototype-2026-09-09.json`.

The forest version is now integrated. It matches the independently sequenced two-domain result exactly while reducing actual portrait update-to-GPU median22.0→15.1ms andp9523.3→16.7ms. The matched720-frame test preserves all496 final positions, velocities, rebuilt vertices, head and steps. A separate untimed four-substep allocation observes35 buffers/7,177,952bytes/21 compute pipelines, all returning to0 after disposal. Timing excludes timestamp readback and compositor/rAF waits; it is not a general60FPS guarantee.

Portable promoted-core gates pass25 groups:9 forest query/contact groups,8 legacy Avatar groups with an explicit immutable v1 calibration route, and8 production forest Avatar groups using canonical outputs from the independent two-domain owner. The legacy golden is unchanged. Actual transform, scale refusal/resume, same-renderer35→8→0 lifetime and pending-digest retirement pass. Existing CPU gates pass16 calibration/owner,137 Avatar and4 async retirement groups.

See [forest implementation/evidence](HAIR-SURFACE-FOREST.md), [nape acceptance](HAIR-NAPE-ACCEPTANCE.md), and `docs/evidence/hair-body-contact-forest-frame-cost-2026-09-09.json`. The live5197 portrait verification uses zero routes, loads exact GLB SHA`db3565bb7272dcc82a2892ce042886f23c1a09aed66ea563a9e33cfa7ee1b72b`, reports the new nape calibration, and preserves full simulation/camera state across four views. Its evidence is `captures/bob01-g050-shipped-2026-09-09`.
