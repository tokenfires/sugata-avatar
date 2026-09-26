# Three-arm hand-clearance attribution study

2026-09-26. **Source-level design only; no adapter, candidate or GPU run is implemented here.** The goal is to explain the retained hand–trouser/body crossings before choosing a geometric fix. Preserve expressive full-body behavior as the eventual goal; neither suppressed arm motion nor a single passing pose is a proposed product solution.

## Existing evidence and reproducibility

[PLAN.md](PLAN.md) describes the actual retained geometry and its limits. Run, from the repository root:

```sh
node docs/evidence/nonhair-2026-09-26/hand-clearance/replay-retained-witness.mjs
```

The script reads exact current body/outfit sources, the completed accepted bob02/bra case in `captures/collar-replacement-2026-09-26/capture-v2`, and the matching older full-body image/snapshot in `captures/collar-stress-2026-09-22/gpu-v1/bob02-previous`. Paths and SHA-256 bindings are explicit in the script and immutable receipt. It refuses input/source drift, reconstructs region selection, counts, coordinates, telemetry and visual bindings, and compares the complete regenerated JSON both structurally and byte-for-byte with [retained-witness.json](retained-witness.json). The script performs no writes; stdout may be redirected to a **new** replay log. It does not re-perform the human image inspection represented by the original receipt.

[audit-replay.json](audit-replay.json) records the successful replay. Original and regenerated receipt SHA-256 are both `39639e07c9cb47c07bad6ed8a8a0502d7aeafade3478b51d83218968e364f377`; replay script SHA-256 is `fa31d89ab4c413fe4f54d891b5e2ef4185a00259d343507fb8229925a5c6347d`. The original receipt remains unchanged. Later source drift should produce a new explicitly named study, not updated historical counts.

## Fixed three arms

| Arm | Exact intervention | What remains native |
| --- | --- | --- |
| A: control | Pass every contribution to the original accumulator unchanged. | All updates, declarations, weights, schedules, clocks and outputs. |
| B: no posture adduction | For the actual `avatar.posture` instance only, replace its current negative/adducting `leftUpperArm` or `rightUpperArm` rotation with identity. Positive/zero arm spread passes unchanged. | Posture trunk/head/legs/offsets, affect integration, positive arm spread, gesture and every other owner. |
| C: no gesture arm delta | For the actual `avatar.gesture` instance only, replace its current rotations on its declared left/right upper/lower arm bones with identity. | Native gesture update, scheduling, envelope, randomness, clock and telemetry; posture, idle, fingers and every other owner. |

Names are diagnostic, not quality rankings. Never combine B and C in this bounded study; no amplitude search, elbow/shoulder authoring or geometry correction yet.

## Where to intercept, and why

`packages/core/src/motion/MotionStack.js:248–289` clears each contribution, executes the native layer update exactly once, then calls `accumulate(layer, contribution)` before one final commit. `:682–723` applies native weights and composes bone rotations in layer order. The proposed experiment installs an **own-method wrapper on this one stack instance's `accumulate`**. It calls the saved original method once with the original `this` and actual layer identity; unrelated layers receive the original contribution object. For the selected owner it supplies a preallocated copied `MotionContribution` (`motion/Layer.js:166`) with only the listed rotations set to `(0,0,0,1)`. Copy every map/value in original insertion order, including all morphs and offsets. Do not mutate the native contribution, layer declarations, accumulated channels, committed bones or rest pose. Native identity/weight handling remains authoritative.

This point observes the **current frame's actual returned contribution**, including updates that return null (which never call the accumulator). It does not reread stale report angles when a layer is skipped. A new inverse-rotation layer would be inappropriate: `rest × delta1 × delta2 …` is ordered quaternion composition, so an inverse appended after other writers is not equivalent to removing one earlier factor.

Pin source hashes and require the actual `avatar.posture` and `avatar.gesture` objects to be registered on the captured stack, with the expected target, enabled state, weight, order and channel declarations. Resolve bone names from each instance's `bones`, with g050 expected mappings checked. Refuse foreign methods already wrapping this stack, duplicate study ownership, unexpected channels/DOFs, or a replacement owner. Use no layer name lookup as a substitute for identity.

### B must preserve the gesture's prescribed posture input

`affect/PostureLayer.js:870–950` computes the signed limited arm rotations; `:916` stores them in `appliedArmRadians`. Each upper-arm output is currently exclusively one frontal rotation, converted through the cached rest frame (`:1095–1107`). For each side, filter only when the **current native** `appliedArmRadians[side] < 0`; preserve the complete upper-arm output for nonnegative values. Hash/declaration guards must prevent this rule from silently removing any future additional DOF on that bone.

Do not zero `appliedDegrees.armSpreadLeft/Right` or rewrite `context.shared.posture`. `motion/Gesture.js:794` derives `postureYield` from that shared prescription (`:987–996`); changing it would alter both owners and turn B into a different experiment. Keep the existing .35 yield at the retained angry witness. Also preserve posture trunk and centre-of-pressure claims consumed by Sway. Reports must distinguish **native authored prescription/raw output** from **effective filtered output**; the native field names do not become a claim that the suppressed delta was physically committed.

### C must retain a real running gesture

`motion/Gesture.js:771–868` advances utterance time, chooses the active gesture, computes current affect-dependent amplitude and writes shoulder sagittal/frontal plus elbow sagittal rotations. The actual owner's four arm channels are the complete current gesture rotation set. Filter those contributions after this update; do not set layer `enabled=false`, `weight=0`, `amplitude=0`, alter `sagittalShare`, cancel `say`, replace the schedule or remove/re-add the layer. Native phase/activation/yield and raw output remain independently observable. At times returning null, record effective no-output for that frame rather than treating retained `applied.shoulderDegrees` as an active delta.

## Lifecycle boundary: disposable capture only

There is a specific reason to forbid mid-trace rebinding. `PostureLayer.bindArmBudget` (`:667–717`) subtracts `appliedArmRadians` from the measured live arm angle; `reset` (`:835–852`) intentionally preserves that record because it normally describes what was committed. In B it instead describes the unfiltered prescription. A reset/rebind under this instrument could therefore calculate a false adduction budget.

Use one fresh native page/avatar per arm. Complete identity/outfit/foundation setup before installing the filter, then install immediately before the same controlled zero-delta setup/warmup. Keep the initial pre-filter native state as evidence. No reset, bind, rest recapture, layer add/remove, outfit/figure swap or native owner replacement is allowed during the trace. Capture-local guards should reject these before their native mutation, with partial-install cleanup if a guard cannot be acquired; ordinary per-frame ownership checks additionally reject drift. This is not a reusable lifecycle-safe public API.

On completion/failure, stop further stepping; restore only exact method descriptors still owned by this instrument; dispose that same Avatar immediately without another update, reset or rebind; verify actual disposal/resources. Never resume an interactive avatar in the last filtered pose. Native disposal must remain possible after partial initialization. A reusable reset/rebind contract would require separate effective-angle bookkeeping and tests, and is outside this design.

## Bounded native comparison to authorize next

Use current g050, accepted `44eb…` casual outfit, retained bra/briefs/shoes, bob02, seed `20260807`, and the same physical configuration/API command sequence as the retained accepted case. Reuse the public `feel`/synthetic `say` recipe and native 60 Hz update path from `tools/figure-pipeline/collar_replacement_capture.mjs:125–165`; reuse exact snapshot geometry extraction and controlled rendering from `collar_capture_browser.mjs`, with a separate study helper/manifest. Never edit the historical capture scripts or their report.

For a small first comparison, preserve the original happy→angry timing through step 720 (12 seconds), stop **before issuing the next fearful command**, and label this a prefix study rather than the original 18-second trace. Do not initialize straight into anger: that would lose the witnessed history. Keep source, loader bytes, frame clocks, native command results, actual schedules and seed in the new manifest. If a fresh A cannot reproduce the retained physical witnesses within an explicitly justified numerical comparison, stop and explain drift before interpreting B/C.

Save initial geometry and every 30 steps; add onset/return boundaries and every actual returned gesture peak ±2 steps, including the expected 98/270/455/637 only after deriving them from that run. Keep step 720 and distinct command-before/after semantics. Render ordinary full-body motion at 15 Hz plus those explicit endpoints, with predeclared front and bilateral hand/hip close views at initial state and angry peaks. Extra views use zero-delta draws and must not advance simulation. Keep camera/lighting and accepted assets fixed; no camera trick that hides a failing hand. Numerical samples and image review are discrete, not continuous collision proof.

Before GPU, require meaningful CPU controls: A wrapper equals the untouched accumulator; B preserves positive spread, other posture bones/offsets and raw native output; C preserves schedule/time/random consumption and all non-arm outputs; null/disabled native frames contribute nothing; partial setup restores exact descriptors; ownership/mutation guards fail before unsafe changes. Compare per-frame authored contributions, input/shared state and schedules between arms. Every unaffected owner must retain its original update and output; if a downstream owner legitimately reads a changed physical pose, record and classify that dependency rather than asserting false global equality. Body/hand world geometry and final arm bones are expected to differ.

Reapply the exact retained intersection selection to provide directly comparable witness counts, while separately capturing full relevant hand/forearm vs body/garment geometry for later coverage expansion. Counts remain triangle pairs, not depth or severity. B/C can explain improvement or worsening without qualifying a fix. A contact remaining at initial state or after both separate ablations may involve rest/idle/composition; it does not authorize jumping to a solver. An independent critic must inspect actual motion and the source/geometry receipts before selecting the smallest next authored correction.

**Stop here:** design and exact CPU replay only. No production change, accepted asset write, collar-support restart or hair work.
