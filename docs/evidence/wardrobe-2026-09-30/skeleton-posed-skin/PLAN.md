# Posed skin under observed rest transforms

The endpoint, rest-orientation and accepted neutral export bridges pass their declared finite comparisons. The next question is deformation under nonidentity pose. Keep this an isolated observation: no runtime body controls, product assets, inverse-bind arrays or defaults are changed.

## Known source difference and chosen controls

The pinned native `weights.game_engine.json` has 597 body vertices with five positive influences and 11 with six; the accepted GLB has four slots. Source vertex 10991 carries 0.0335999988 on spine_02 beyond its four strongest influences. `RigService.apply_weights` loads all mapped deform-bone entries; no four-slot reduction is present there. Actual loaded membership must still be observed before attributing a deformation mismatch.

Two alternatives were considered before execution:

- **Chosen:** retain the unmodified full native weights and also capture a separately labelled native control whose body weights are the actual accepted GLB's four loader-normalized influences. This isolates arithmetic and propagation while preserving the unmodified-reference discrepancy.
- **Alternative:** expand exported influence capacity before comparison. That would alter a shipping representation and require renderer, performance and appearance qualification, broadening this prerequisite unnecessarily.

The chosen control changes only in-memory weights on original body vertices 0–13379, after preserving the unmodified native arm. Helper weights and all frozen assets stay intact. Require each duplicated export vertex to give the same canonical bone/weight set for its mapped original vertex; refuse ambiguous mapping. Read back the control's actual assigned native weights and compare them exactly to the declared float32 values.

## Native observations

Use the same g050 macro recipe and two detail targets at weights 0, 0.25 and 1. Build a fresh native rig after applying each body shape. Admit exact agreement of unrigged coordinates and rest matrices with the already retained fresh native case. Preserve the real loaded weight lists, deform flags, modifier settings, parent/scale-inheritance properties and constraints. Require identity body/armature transforms, no pose constraints, full scale inheritance, rotation inheritance enabled, local-location behavior enabled, disconnected bones, one standard linear armature modifier, vertex-group deformation, and no preserve-volume/envelope/multi-modifier behavior. A different actual setup is a recorded refusal, never silently changed to fit the comparison.

For each body and each weight arm, capture three poses, resetting every pose basis between them:

1. **Identity** — all bases identity.
2. **Elbow** — lowerarm_l local X rotation +0.6 radians.
3. **Coupled** — pelvis local Z +0.08; spine_02 local X +0.15; upperarm_l local Z −0.35; lowerarm_l local X +0.6; thigh_r local X −0.35; calf_r local X +0.65; head local Y +0.2 radians.

These are deterministic arithmetic probes, not authored animations or ergonomic/appearance claims. Preserve requested commands, actual pose quaternions/bases and evaluated pose matrices for every bone, plus the full evaluated body positions. Confirm unrigged coordinates still match the frozen shape in every pose. Total: three bodies × two weight arms × three poses = 18 native observations.

## Independent comparisons

Use each observation's actual body and source weights to check linear skinning independently against native full-weight output. Separately check the native four-influence control using its observed weight lists. Normalize the complete native weight sum when evaluating native linear blending; do not silently drop influences, including the seven-influence helper vertices. Keep the proposed export arm’s already loader-normalized float32 weights unchanged; native normalization belongs only to the separately labelled native arithmetic control.

Reconstruct posed bone matrices by traversing the admitted hierarchy: parent posed matrix × inverse(parent rest) × child rest × child pose basis. Use both actual native rest/basis observations and the independent rest construction with command-derived pose bases. Compare origin, tail and three one-metre basis witnesses for all 53 bones under the existing strict **below 0.1 mm** matrix-witness bar.

For the proposed exported path, deform actual exported body positions with the existing SDK target deltas, use independently reconstructed rest/pose matrices in the admitted glTF frame, and derive new inverse binds from those new rest matrices. Keep the actual accepted four loader-normalized influences. Compare all 14,517 vertices to the mapped native four-influence control under the unchanged strict **below 0.342 mm** maximum distance bar. Require identity-pose and neutral-body controls before interpreting posed/shaped cases.

Also compare that same proposed path to the unmodified native full-weight reference under the same 0.342 mm bar. Report this pass or failure separately. A passing matched-weight control cannot erase a failing unmodified-native comparison, establish a whole-range claim, or relax any threshold.

Negative controls: retain neutral inverse binds while moving to the full-weight body's refitted skeleton, and deliberately omit the elbow pose propagation. Each must have a passing clean parent, a nonzero mutation and a failure at the same skin-distance bar. Preserve actual changed arrays and worst vertices. If a required parent fails, label its negative control uninterpretable.

## Ownership and limits

Root serializes the isolated native process, verifies and records a new temporary read-only runtime mount, preserves all previous receipts and source pins, then detaches only the owned mount. The existing review service stays available. Native and JS code will be reviewed independently before execution; numerical results need independent recomputation afterward.

This finite study does not qualify every body identity, motion range, skin normal, GPU shader result, runtime animation-layer rebinding, face-part placement, garment/foundation coupling or visual quality. No appearance acceptance follows from numerical passes; actual rendered candidate inspection is required before product integration. No old failed gate is replaced or reclassified.
