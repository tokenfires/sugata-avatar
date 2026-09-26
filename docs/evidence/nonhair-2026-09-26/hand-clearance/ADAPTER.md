# Disposable hand attribution adapter

The isolated [HandAttributionArm.mjs](HandAttributionArm.mjs) implements the three arms in [ATTRIBUTION-DESIGN.md](ATTRIBUTION-DESIGN.md). It changes no production module, asset, historical capture script or hair behavior. It is an attribution instrument, not a proposed correction or evidence that hand clearance improved.

## API and timing

```js
const study = new HandAttributionArm(avatar, {
    arm: 'A', // A: unchanged; B: negative posture arm delta; C: gesture arm deltas
    sourceHashes // actual caller-verified file hashes, including REQUIRED_SOURCE_HASHES
});
// Use the existing native stepping path. Never reset/rebind/change outfit while installed.
const receipt = study.report();
study.dispose(); // restores owned descriptors, then immediately calls native Avatar.dispose()
```

Install on the actual ready, manually stepped avatar after all identity/foundation/outfit setup, before the controlled zero-delta setup/warmup. Source pins cover the current native stack/contribution/posture/gesture/skeleton implementations and g050 body. **These are caller-provided bindings, not proof that the browser loaded those bytes.** The future capture runner must verify the full runtime source freeze, actual loaded asset hashes, chosen identity/configuration, commands and time provenance.

`report().samples.posture` and `.gesture` distinguish `returned-output`, `no-returned-output`, and `disabled`. Only an actual current accumulator call produces raw/effective maps. This prevents stale `applied` angles after gesture completion from being mistaken for active output. `report().owners` supplies the same return classification for every native owner in original order, with name/order/weight/enabled, ordered raw/effective morph/rotation/offset maps, and native PRNG seed/state/spare after the completed frame. Failed frames do not receive a false completed-frame/RNG receipt. Reports are deep copies.

A passes the original contribution object unchanged. B copies the actual native posture contribution, replacing only upper-arm rotations whose current `appliedArmRadians` is negative. C copies only the actual gesture contribution and neutralizes its four arm rotations. All other maps/owners pass unchanged. The native accumulator remains the only writer and retains weighting, identity admission, ordering and final commit. Native updates execute once; original telemetry, schedule, random streams and shared posture prescription remain native. In particular B leaves gesture posture yield unchanged. Effective filtered output is labeled separately from the unmodified authored prescription.

## Mutation and teardown boundary

The constructor pins actual owner objects, target/bone identities, layer order/weights/enabled state, declarations and relevant motion configuration. Supported reset/bind/rest-recapture/add/remove/declaration/identity/outfit mutation APIs, including posture's direct `bindArmBudget` and `bindKneeChains` helpers, are replaced with capture-local rejecting guards. Direct assignments to pinned owner/configuration fields reject before assignment. The next native frame checks descriptors, direct array/Map edits, bone replacement, cached arm budgets/rest frames and configuration drift **before advancing the stack**. This is a cooperative capture instrument, not a sandbox against arbitrary JavaScript or saved-prototype-method bypasses.

A failed guard poisons further stepping. If a mutation is attempted within a native update, earlier owners may already have advanced their internal clock; the frame fails before final commit and is not counted complete. There is no rollback claim. Mid-frame disposal is rejected. Native stack reset/rebind remains forbidden because B's unmodified `appliedArmRadians` no longer represents its physically filtered contribution for adduction-budget rebinding.

There is no public detach/resume method. `study.dispose()` and the installed `avatar.dispose()` wrapper restore only exact descriptors still owned by this instrument, then synchronously call saved native Avatar teardown. A foreign replacement is retained and reported as lost ownership; teardown is still attempted and failure is surfaced. Repeated study disposal/stepping/reinstallation on the retired avatar is rejected. Constructor acquisition failure restores exact acquired descriptors without disposing the caller's unused avatar; ordinary native teardown remains available.

The existing collar helper's `dispose(avatar, probe)` is compatible: it restores its own tracing, releases its coverage owner, then invokes instrumented `avatar.dispose()`. Do **not** call `showcase.attention.dispose()` first: that action removes stack layers, which is intentionally rejected during the trace. Dispose ordinary camera controls, retire the study/native avatar through the helper, then clear the separate attention action object against the already empty native stack if necessary. No further native step may occur. The native capture must verify actual resources/disposal; the CPU gate's host teardown is a controlled fixture.

## CPU evidence

```sh
node docs/evidence/nonhair-2026-09-26/hand-clearance/HandAttributionArm.selftest.mjs
```

[adapter-selftest.log](adapter-selftest.log) records **18 passing groups**; [adapter-cpu-receipt.json](adapter-cpu-receipt.json) binds its source, module, test and log hashes plus the command and Node version. They use real `MotionStack`, `PostureLayer`, `ExpressionLayer` and `GestureLayer` over the shipped g050 bone hierarchy/rest transforms, with a controlled overlapping arm/offset/mouth writer plus null and disabled owners. They prove A equals an untouched stack over 120 frames, B preserves positive spread and unrelated outputs, and C preserves native scheduling/clock/RNG. The real gesture reaches its stroke, with B's shared yield remaining .35. A deliberately wrong late inverse differs from B, showing why a competing cancellation writer is unsuitable. Source drift, foreign wrappers, guarded mutations, direct-array/cache drift, current-return classification, partial acquisition, descriptor theft, teardown failure and forbidden reuse are exercised.

The [rejected first version](adapter-v1-rejected/REJECTION.md) and its original 17-group receipt are preserved. Independent critique found that direct `posture.bindArmBudget(target)` bypassed the first guard list after filtered motion. The new regression was observed failing on those original bytes, with the changed budgets saved in [binding-regression.log](adapter-v1-rejected/binding-regression.log), before both direct binding helpers were guarded. The corrected regression now rejects each helper before any budget or chain mutation after 100 B frames. No native capture was run on the rejected instrument.

This gate has no renderer or skinned hand/garment geometry and uses a minimal Avatar-shaped teardown host. It does not establish actual Avatar disposal, source-loader equivalence, retained A geometry reproduction, B/C hand clearance or perceptual quality. Those remain the native runner and independent critic's work. The original [retained-witness.json](retained-witness.json) remains unchanged at SHA-256 `39639e07c9cb47c07bad6ed8a8a0502d7aeafade3478b51d83218968e364f377`.
