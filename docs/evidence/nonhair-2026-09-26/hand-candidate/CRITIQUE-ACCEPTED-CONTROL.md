# Accepted construction control: independent source review

**Approved to run the bounded native accepted-control comparison. No candidate or native equivalence is approved by this source review.** I reviewed the final wrapper, runtime and controller and independently ran all ten corrected CPU groups successfully.

Reviewed SHA-256 bindings:

| Source | SHA-256 |
| --- | --- |
| `AcceptedPoseControl.mjs` | `b6cb711fb2509cfb0cc22a0c5e0337bf63f98ee1826f50368ae8a3ec0793d49d` |
| `AcceptedPoseControl.selftest.mjs` | `106fd8aefc367ceb9b586ff09252fb78f3622fba4e1f84ddb0fef8ddc3d16eb1` |
| `accepted-control-runtime.mjs` | `aaba1440d96b201ac305510e1aaea6fec418e8fc758f3c394d7d9d0346c7d93e` |
| `accepted-control-capture.mjs` | `ac628ac0eae3ff611cf6c3967a0095324f4b8fe87da8302e29546b12e2318c75` |

The initialization boundary matches the native source: construction budget hooks operate at frame/time zero, original Showcase performs one `avatar.step(0)` before exposing its ready handle, and construction returns at stack frame 1/time 0. Native `Avatar.dress` delegates wardrobe dressing and does not rebind MotionStack. The wrapper requires that frame/owner/budget boundary to remain unchanged through foundation preparation. It does not add a simulation step, reset, bind or rest recapture.

Accepted pose bytes and their compiled representations are pinned; fresh native RestPose instances must reach the four expected Sway/Avatar consumers. The Sway accumulated reference and inverse caches are recomputed and compared. Budget interposition calls the original native method and performs no assignment or reduction. The temporary descriptors restore before channel preparation and capture; a foreign replacement is retained and reported as failure rather than overwritten. This is an isolated cooperative capture mechanism, not a general interception/security API.

I independently compared the new runtime's complete `prepareChannels` function body to the previously proved attribution implementation: they are identical, apart from making the new declaration exported. The preparation's recorded state/identity proof is intentionally caller-owned and source-bound; flags supplied by an arbitrary callback would not prove native execution. The native controller defers exactly one original HTML module tag, imports unchanged Showcase under interposition, binds assets, and requires 721 complete native semantic records and 109 five-mesh/full-physical comparisons against sealed primary A. The existing signed-zero-only retained-JSON policy remains explicit. Source drift and failed cleanup prevent a completed native result.

## Two proved false-success cases corrected

In the rejected v2 wrapper, I reproduced both cases using its modeled CPU host:

- `run` caught a prohibited `stack.bind` error and returned. The native bind was blocked, but the wrapper resolved `completed:true` while the retired instrument's `failure` still named the violation.
- `run` caught native disposal throwing after the host was retired. The existing guard reported `disposed` with `failure:null` and no lost descriptor, so the wrapper again resolved `completed:true`.

Both were completion-reporting defects, not evidence that the forbidden bind executed. The author preserved the exact v2 bytes, red scripts and outputs. The final wrapper requires `run` to return with an active, failure-free guard and rejects every early caller retirement. Only its own finalizer invokes the separately supplied, source-bound retirement callback. Callback exceptions remain observable there; failure before native disposal triggers fallback guard retirement, while an exception after disposal is retained without a second dispose. Final disposed state, null instrument failure, empty lost-descriptor list and retired native stack are required. The ten-group suite covers both red cases, clean single retirement and errors on either side of disposal. The frozen attribution adapter did not change.

The CPU host still models factory/wardrobe/renderer integration. Counter values and native motion classes alone do not prove that original Showcase ran, that the expected assets loaded, or that initialization reproduces accepted geometry. Those are the pending native control gates. This module admits no changed pose, numeric inward cap, clearance margin or production behavior.

Signed: `/root/critic` — September 26, 2026; source/CPU review only, no GPU job.

## Subsequent native admission

The accepted-byte control has now passed the actual native gate and my independent receipt/data review. Report `25d1aa1e845090fac55b4e74465b583b77d128cd6674993d3a38a5aae45551b6` is sealed against manifest `1eeda6f9cb06b300289a62ef658f1b87026b63fc7cfe965044df43d82807eefa`. `CRITIC-NATIVE-CONTROL.json` records my verification of 1,562 archived and current source bindings, eight actual asset responses, and the exact HTML deferral.

The entire 721-state compressed archive and decoded bytes exactly match original primary A. I independently compared all 109 actual five-mesh/time/rig snapshots to the retained control. All 941 expected comparison labels are present and pass: two commands, 721 complete native semantic states, 109 geometry comparisons and 109 full physical-state comparisons. The latter were exercised by the pinned native controller; I verified their bound comparison receipts rather than running a second GPU job.

The native receipt records precisely the four expected pose loads and one frame-0 native arm-budget bind. Native/effective passthrough budgets are exactly `0.17766836756218315` left and `0.20847278526539728` right radians. Original Showcase, foundation re-dress and channel preparation retain frame 1/time 0. One native channel rebuild preserves the recorded state and existing identities. Both temporary descriptors restore, the A guard remains active and failure-free through `run`, and wrapper-owned retirement ends disposed with null instrument failure, no lost descriptors, no leaked handles, no browser errors and zero renderer-memory counters.

This establishes accepted-input equivalence for this specific construction/capture route. It does not qualify modified pose bytes or a changed budget. The mechanism's earlier `nativeQualification:false` field remains its original self-description; the external source-bound native gate and this review supply the now-completed control evidence.

Signed: `/root/critic` — native control admitted; no changed candidate reviewed.
