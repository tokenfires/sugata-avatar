# Accepted pose-family control mechanism

September 26, 2026. **CPU preparation only. No candidate angles/caps, native Avatar run, GPU work, asset export or product changes.** The current attribution's rendered/owner review still decides whether and how to proceed. This mechanism admits only the exact accepted three-pose family and a passthrough native arm budget.

`AcceptedPoseControl.mjs` exports `withAcceptedPoseControl({poseFiles, sourceHashes, budget, construct, prepareChannels, run, retire})`. `poseFiles` contains the exact UTF-8 texts for relaxed-standing, weight-left and weight-right; their byte hashes are hard-pinned. `budget` must be the literal `passthrough`. Unknown options, changed bytes (including otherwise harmless extra whitespace), missing poses, source-pin differences and numeric caps are rejected before construction.

The transaction installs temporary descriptors on the actual native `RestPose.load` and `PostureLayer.prototype.bindArmBudget`. Each pose load returns a fresh native `RestPose`, compiles identically to the bundled accepted version, and is tied afterward to the actual Sway family or Avatar rest-pose object. The current native source establishes the four pose loads: Sway's relaxed/left/right family, followed by Avatar's relaxed pose. Wrong/extra/missing consumers are refused. Sway's accumulated relaxed quaternions and inverse references are independently recomputed in native chain order and compared exactly.

The budget hook first calls the saved native method and records its actual result. Passthrough performs **no budget assignment, reduction, scale or pose operation**. All budget callbacks must belong to one native PostureLayer on one MotionStack/target at frame/time zero. The transaction records how many native construction/onBind calls occurred instead of inventing a one-bind rule. A later budget mutation is refused.

The source-derived startup boundary is now explicit. Original `showcase.js:256–264` creates Avatar, attaches AttentionAction/OrbitControls/ViewerFraming, then performs one `avatar.step(0)` before its ready handle is exposed. `construct` must execute that original startup and return at **stack frame 1, motion/Avatar time 0**, while native budget binding remains at frame 0. Missing or extra initial steps are refused by the boundary checks. This wrapper records the observed bind/ready frames; the source-bound native bootstrap must still establish that the original startup ran rather than a callback merely assigning counters.

After that boundary, the transaction requests the same native torso foundation preference and absolute casual/shoes dress path used by attribution, verifies the four worn IDs, and requires unchanged owner/target and frame 1/time 0. **Correction preserved:** `Avatar.dress:2421–2455` calls wardrobe.dress; it does not call stack.bind. A foundation re-dress is not a new budget-bind phase. The wrapper adds no reset, bind, update, step or captureRestPose.

After both temporary descriptors restore, the required caller-owned `prepareChannels(avatar)` callback supplies the previously proved native channel-rebuild routine and its exact unchanged-state/identity receipt. The wrapper does not duplicate that proof or silently drain channels. It records the receipt, requires both proof flags, the same owner/target/budget, frame 1/time 0 and clean channels before installing its guard. The callback's source and actual execution must be bound in the future native capture manifest. A callback that omits its receipt, leaves dirty channels or adds a step is refused.

Both prototype descriptors are restored exactly before `prepareChannels` or `run` can execute. If another owner replaced a descriptor, the transaction reports lost ownership, leaves that newer descriptor intact and refuses capture. Returned hosts are then guarded by the existing `HandAttributionArm` A passthrough adapter; capture-time reset/rebind/rest recapture, direct binding helpers and identity/wardrobe replacement remain prohibited. `run(avatar, receipt, instrument)` receives a frozen report-only interface whose `report()` returns the existing guard's cloned report. Existing semantic capture can use this interface without installing a second guard.

`run` must return with the guard still **active and failure-free**. Caught guard errors and all early caller disposal are refused, including a caller that caught an error thrown after native retirement. The required `retire(avatar, receipt, observer)` callback is invoked only by the wrapper's `finally`, where its exceptions cannot be swallowed by `run`. Native capture supplies its existing helper teardown there: restore draw/coverage ownership, dispose the guarded Avatar, then retire attention. If this callback throws before native disposal, the wrapper attempts direct guard disposal once as fallback while retaining the original failure. If disposal already occurred, it does not call it twice. A callback that returns without disposing also fails and triggers fallback.

Completion requires no earlier failure, disposed Avatar with null stack, disposed instrument with null failure, and no lost descriptor ownership. No live Avatar is returned. A factory that rejects before returning a handle keeps its native partial-build cleanup obligation; native `Avatar.create` already disposes its own failed build. The interposer restores descriptors regardless, but cannot claim to retire a handle the factory never returned.

The intended future native route is structurally:

```js
// Example contract only — do not launch before native control approval.
await withAcceptedPoseControl({
  poseFiles: verifiedAcceptedTexts,
  sourceHashes: verifiedFrozenSources,
  budget: 'passthrough',
  construct: async () => {
    // Root bootstrap defers original showcase startup until interposition is active.
    await import('/src/showcase.js');
    if (!window.showcase) throw Error('Original Showcase startup did not complete');
    return window.showcase.avatar;
  },
  prepareChannels: verifiedNativeChannelPreparation,
  run: async (avatar, receipt, instrument) => {
    window.handStudy = instrument; // Report-only reuse; no second A guard.
    // Independently approved capture; no interactive reuse.
    // Leave the guard active and failure-free. Do not dispose here.
  },
  retire: () => sourceBoundNativeTeardown()
});
```

The caller must run this in an isolated page with actual native `Avatar.create`, source/asset response binding and no unrelated construction while temporary prototypes are owned. A supplied factory and hash map are not proof that a native Avatar or those loader bytes actually ran. The callback is intentionally injectable for the CPU host tests; this is a capture mechanism, not a security boundary. Native accepted-control geometry, bind-cache, schedule, RNG and physical parity against the approved control remain required before any changed candidate is admitted.

## Focused CPU evidence

Run `node docs/evidence/nonhair-2026-09-26/hand-candidate/AcceptedPoseControl.selftest.mjs`.

Ten groups pass using real RestPose, Sway, MotionStack, Expression/Posture and Gesture classes with the exact retained g050 bone hierarchy/transforms. The CPU host models Showcase's single zero-time native MotionStack update, plus foundation/dress and channel preparation. It does not run original Showcase/Avatar startup, a renderer, native asset loading or mesh skinning.

- Accepted inputs compile exactly; fresh pose instances reach the expected consumers; native budget values remain unchanged; both descriptors restore before guarded use.
- Missing/wrong pose bytes, source pins and candidate caps fail before factory invocation.
- Unknown/missing pose consumers and a wrong returned posture owner fail and dispose any returned host.
- Partial-factory failure restores descriptors while the factory retires its unreturned partial host; a later run failure is retired by the A guard.
- Preexisting descriptor changes are refused; newer descriptor owners are left intact and reported rather than overwritten.
- One and two factory-owned native construction binds retain their respective counts; the interposer adds no bind/reset/update. Zero or two initial zero-time updates, advanced clocks and subsequently budget-mutated hosts fail closed.
- A capture-time rebind is rejected by the existing A guard without reaching the native bind; disposal follows.
- A post-dress callback must supply its proof and leave clean channels at the same frame/time. Missing proof, pending dirty channels or an extra step is refused. The report-only interface cannot mutate guard state.
- A caught forbidden-bind error cannot become completion. Early caller disposal is rejected whether clean or followed by a caught native-disposal error; native disposal is not repeated.
- Normal wrapper-owned retirement runs exactly once. Errors before disposal trigger fallback while remaining failed; errors after disposal remain failed without a duplicate attempt.

The earlier frame-0-only mechanism, tests, receipt and documentation are preserved with exact hashes in `modeled-host-v1/`. Its seven CPU groups remain valid for that modeled host, but it is **not equivalent to actual Showcase startup**. The corrected frame-1 design's v2 bytes and eight-group receipt are preserved in `modeled-host-v2/`; two independently proved caught-error cases exposed its false completion metadata. That directory retains the critic's exact red scripts and their outputs, executed against the still-active v2 source before the correction. Those scripts name the original active path and document that run; rerunning them against a later API is not a v2 replay.

`CPU-v3.json` binds the ten-group retirement correction and the two retained red cases. Native control integration still has not run in this worker. A read-only API consistency pass found the root-owned `accepted-control-runtime.mjs` and `accepted-control-capture.mjs` supply the required callbacks and await wrapper/native retirement; those files were not edited here.

This is an accepted-input mechanism gate. It does not select a posture or inward allowance, establish hand clearance, approve geometry/perception, qualify lifecycle replacement/reset, or reopen hair work.
