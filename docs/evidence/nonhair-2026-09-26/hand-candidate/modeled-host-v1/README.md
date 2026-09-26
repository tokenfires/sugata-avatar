# Accepted pose-family control mechanism

September 26, 2026. **CPU preparation only. No candidate angles/caps, native Avatar run, GPU work, asset export or product changes.** The current attribution's rendered/owner review still decides whether and how to proceed. This mechanism admits only the exact accepted three-pose family and a passthrough native arm budget.

`AcceptedPoseControl.mjs` exports `withAcceptedPoseControl({poseFiles, sourceHashes, budget, construct, run})`. `poseFiles` contains the exact UTF-8 texts for relaxed-standing, weight-left and weight-right; their byte hashes are hard-pinned. `budget` must be the literal `passthrough`. Unknown options, changed bytes (including otherwise harmless extra whitespace), missing poses, source-pin differences and numeric caps are rejected before construction.

The transaction installs temporary descriptors on the actual native `RestPose.load` and `PostureLayer.prototype.bindArmBudget`. Each pose load returns a fresh native `RestPose`, compiles identically to the bundled accepted version, and is tied afterward to the actual Sway family or Avatar rest-pose object. The current native source establishes the four pose loads: Sway's relaxed/left/right family, followed by Avatar's relaxed pose. Wrong/extra/missing consumers are refused. Sway's accumulated relaxed quaternions and inverse references are independently recomputed in native chain order and compared exactly.

The budget hook first calls the saved native method and records its actual result. Passthrough performs **no budget assignment, reduction, scale or pose operation**. All callbacks must belong to one native PostureLayer on one MotionStack/target at frame/time zero. The transaction records how many native construction/onBind calls occurred instead of inventing a one-bind rule. A later budget mutation or pre-applied arm delta is refused.

After construction, the transaction requests the same native torso foundation preference and absolute casual/shoes dress path used by attribution, verifies the four worn IDs, and requires unchanged owner/target and zero simulation clocks. It does not call reset, bind, update, step or captureRestPose. An unexpectedly dirty channel inventory fails closed. **Native preparation integration remains pending:** the previously proved channel-rebuild receipt can be integrated in a separately reviewed successor at this boundary if required; this CPU mechanism deliberately does not duplicate or silently invoke that preparation.

Both prototype descriptors are restored exactly before `run` can execute. If another owner replaced a descriptor, the transaction reports lost ownership, leaves that newer descriptor intact and refuses capture. Returned hosts are then guarded by the existing `HandAttributionArm` A passthrough adapter; capture-time reset/rebind/rest recapture, direct binding helpers and identity/wardrobe replacement remain prohibited. The guard and same host are disposed after `run`, including failure. No live Avatar is returned. A factory that rejects before returning a handle keeps its native partial-build cleanup obligation; native `Avatar.create` already disposes its own failed build. The interposer restores descriptors regardless, but cannot claim to retire a handle the factory never returned.

The intended future native route is structurally:

```js
// Example contract only — do not launch before native control approval.
await withAcceptedPoseControl({
  poseFiles: verifiedAcceptedTexts,
  sourceHashes: verifiedFrozenSources,
  budget: 'passthrough',
  construct: () => Avatar.create({
    ...acceptedCaptureOptions,
    canvas,
    autoStart: false,
    seed: 20260807,
    pose: 'relaxed-standing'
  }),
  run: async (avatar, receipt) => {
    // Independently approved capture; no interactive reuse.
    // Restore controls/helpers before native teardown. AttentionAction disposal,
    // which removes a layer, follows native guard/Avatar retirement.
  }
});
```

The caller must run this in an isolated page with actual native `Avatar.create`, source/asset response binding and no unrelated construction while temporary prototypes are owned. A supplied factory and hash map are not proof that a native Avatar or those loader bytes actually ran. The callback is intentionally injectable for the CPU host tests; this is a capture mechanism, not a security boundary. Native accepted-control geometry, bind-cache, schedule, RNG and physical parity against the approved control remain required before any changed candidate is admitted.

## Focused CPU evidence

Run `node docs/evidence/nonhair-2026-09-26/hand-candidate/AcceptedPoseControl.selftest.mjs`.

Seven groups pass using real RestPose, Sway, MotionStack, Expression/Posture and Gesture classes with the exact retained g050 bone hierarchy/transforms. The construction and wardrobe host is explicitly modeled; there is no renderer, native asset loading or mesh skinning in these tests.

- Accepted inputs compile exactly; fresh pose instances reach the expected consumers; native budget values remain unchanged; both descriptors restore before guarded use.
- Missing/wrong pose bytes, source pins and candidate caps fail before factory invocation.
- Unknown/missing pose consumers and a wrong returned posture owner fail and dispose any returned host.
- Partial-factory failure restores descriptors while the factory retires its unreturned partial host; a later run failure is retired by the A guard.
- Preexisting descriptor changes are refused; newer descriptor owners are left intact and reported rather than overwritten.
- One and two factory-owned native binds retain their respective counts; the interposer adds no bind/reset/update. Dirty, stepped and subsequently budget-mutated hosts fail closed.
- A capture-time rebind is rejected by the existing A guard without reaching the native bind; disposal follows.

This is an accepted-input mechanism gate. It does not select a posture or inward allowance, establish hand clearance, approve geometry/perception, qualify lifecycle replacement/reset, or reopen hair work.
