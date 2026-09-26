# Native hand attribution: independent owner audit

The sealed `primary-v4` comparison passes the bounded ownership audit. Across all 721 recorded frames of each arm, every native owner's raw output, PRNG state, enabled/weight/order/return status, and all schedules are identical. The only differing owner fields are the intended **effective** rotations: B's two posture upper arms, or C's four gesture arm rotations. No other owner changes. This qualifies the experiment's attribution boundary; it does not qualify either treatment as a correction.

## Exact inputs and checks

Input directory: `captures/hand-attribution-2026-09-26/primary-v4/`. The seal admits a completed primary run containing A, B and C, with no browser errors and actual clean disposal for each. It binds:

| File | SHA-256 |
| --- | --- |
| `manifest.json` | `fc0e017fba7da12f6c511b53e705b2441b440fa8cb8731bd65f36a839514793d` |
| `report.json` | `bb12301ca0fd0db5097ad8fe6221498228612c2fcd314dac4377ca686d22a74e` |
| This audit's `owner-audit-receipt.json` | `931b8c62baac8bc05516db2f5f5c59ce1f08927f7d8256ca12837de6acf9083e` |

The independent CPU pass verified all **1,562 frozen files / 501,452,349 bytes**: 1,558 manifest source/asset entries plus four retained baseline inputs. Each file matched its explicit hash; the frozen index matched the ordered manifest union. Current live source files were not substituted for the archived sources. All three state archives passed both compressed-byte and decoded-byte hashes and contained exactly 721 records. All **327 geometry archives** passed both hashes, and their telemetry exactly matched the corresponding recorded state at the same step. Actual loaded asset receipts matched the frozen source hashes, byte sizes and route fulfilments.

Comparisons use exact decoded JSON values and ordered contribution-map arrays, without a numeric tolerance. JSON has already collapsed signed zero; this is not a bitwise preservation claim for `-0`. The compact receipt retains archive hashes, trajectory hashes, complete changed-field/channel unions, frame ranges and owner return-status counts.

There are 17 owners, giving **36,771 owner-frame checks** across three arms. Every arm preserves the native clocks and increments, with first recorded stack frame 2, last frame 722, and 721 instrument-completed frames. The single pre-install native channel rebuild reports unchanged pre/post clock, skeleton, morph, owner, PRNG and affect/gesture state and preserved existing identities; the archived state values independently compare equal. The three pre-filter setups also compare equal.

## Complete changed-field union

| Comparison | Changed effective contribution | Exact changed steps | Count |
| --- | --- | --- | --- |
| A versus B | `affectPosture.rotations.upperarm_l`, `upperarm_r` | 458–720 inclusive | 263 |
| A versus C | `gesture.rotations.upperarm_l`, `upperarm_r`, `lowerarm_l`, `lowerarm_r` | 56–140, 227–313, 418–491, 594–680 inclusive | 333 |

For every frame, the audit reconstructed the expected effective contribution from that frame's raw contribution: B substitutes identity only where the corresponding current native posture arm angle is negative; C substitutes identity for the gesture's four returned arm rotations. All other values and map order are exact. A passes its original contribution unchanged. Null-return frames remain null; no stale output was treated as current output.

Outside the instrumentation record, the only changed state field is `bones`, the body's **skinning matrix palette**. In both comparisons, its changed-bone union is precisely the 36 upper-arm/forearm/hand/finger bones below the two upper arms. The ranges are the same as the effective-contribution ranges above. Clavicles, torso, head, pelvis and leg palette entries are unchanged. This is a downstream hierarchy result, not evidence that 36 separate owners or local rotations changed.

Inside the instrumentation record, `arm` differs for all 721 frames by design. `samples` and `owners` differ only over the stated effective-contribution ranges. No other instrument field differs. Across both comparisons, all raw rotation/offset/morph arrays, all other owners' effective arrays, and the final body morph vector are identical. The unchanged owner list is `attentionControl`, `breath`, `sway`, `idle`, `bodyIdle`, `handIdle`, `attentionPose`, `gazeHead`, `gaze`, `pupil`, `expression`, `viseme`, `blink`, `facialIdle`, and `attentionSmile`; the nonselected posture/gesture owner is also unchanged in each comparison.

Posture returned output on 695 frames and returned nothing on 26; gesture returned output on 333 and returned nothing on 388. These exact statuses match all three arms. No owner was disabled. The selected owners' raw trajectory hashes, complete schedule trajectory, shared-posture trajectory, clocks, and all 17 PRNG trajectories match across A/B/C. Thus there is no observed downstream change in another owner's authored output to explain in this prefix.

## Native mechanism and preserved dependencies

These source references refer to the hash-verified copies beneath `primary-v4/source/`, with the paths and line numbers shown here relative to that frozen root:

- `docs/evidence/nonhair-2026-09-26/hand-clearance/HandAttributionArm.mjs:29–99,170–217`: installation requires the real native stack, posture and gesture instances; the selected owners' update functions equal their native prototype methods. It saves each actual registered owner's update function and PRNG object, guards them before/after native frames, calls the original stack update once, and records actual accumulator calls. It never replaces a layer's `update`. The accumulator verifies that it received that actual owner's current contribution, then copies only the selected contribution and passes the effective value to the original accumulator. The successful source/configuration guards support the native update-path claim; this is not a separate instruction trace.
- `packages/core/src/motion/MotionStack.js:248–288,682–710,799–822`: the original loop clears each enabled layer's reusable buffer, calls that layer once, and accumulates only a returned contribution. Bone deltas compose by postmultiplication in layer order; commit applies the resulting delta to the stored rest rotation. Identity-filtering the selected term consequently changes descendant palette matrices without creating a competing bone writer.
- `packages/core/src/affect/PostureLayer.js:916,944–947` and `packages/core/src/motion/Gesture.js:771–795,987–996`: posture still publishes its native limited arm angles and applied-degree telemetry. Gesture still reads the same shared posture and uses its native yield calculation. In B, reported native posture angles therefore describe the authored contribution **before** the experimental filter; they do not describe the effective rendered arm rotation. Keeping that dependency intact is deliberate for this diagnostic. A production posture-limit change could legitimately change gesture yield and must be assessed separately.
- `docs/evidence/nonhair-2026-09-26/hand-clearance/hand-attribution-runtime.mjs:13–78,81–98,129`: native channels are prepared before instrument installation; the existing helper performs the actual zero-delta setup and subsequent 1/60-second updates. Commands use the real Avatar API. The public happy and angry command receipts at steps 0 and 360, including the actual returned schedules, match exactly across arms. There is no fearful command in this prefix. Teardown restores owned descriptors and immediately disposes the real Avatar; each final renderer-memory value is zero, with no reported leak or lost descriptor.

Core bindings include `MotionStack.js` SHA `fbbee9c9608d9cf33e59596a147c24a14c270ad2fadb0edee47fd7aeed6ad9c9`, `PostureLayer.js` SHA `9f72fb58dfdb1646934b61e75c6187fe4bfc7c1c642198842c9eb57dbe31470c`, and `Gesture.js` SHA `c52205441a5d963579813a68fe1642097df7ba44a1166b66d2b7c4f20e9ac1ea`. The adapter is `614cf2db48236909337e696029cf0e4fbe743ab24c0631bb9f7998d685839f14`; the runtime is `86f9c9c75d10bf63415339c96fc5ff3ee9fc3d41a09115ec1add611ce66b2356`. The manifest binds the remaining owner, renderer, dependency and asset sources.

## What the controls establish

B isolates removal of inward posture arm deltas while retaining the native authored posture state and gesture yield. C isolates removal of native gesture arm deltas while retaining the native schedule, gesture clock and raw prescription. Both controls preserve the initialized step-0 pose. C returns exactly to A outside the four active ranges, including step 720. This experiment provides clean bounded comparisons of those terms; it does not demonstrate that either term is the sole source of a hand/garment defect or that suppressing it improves all poses.

The geometric pair counts and rendered views are separate evidence. Count reduction alone cannot establish clearance, depth, visual quality or a safe correction. This ownership result covers one fixed identity, outfit, seed and 12-second happy-to-angry prefix at recorded native frame boundaries. It does not cover continuous collision, other outfits/body shapes, all emotions/gestures, or product lifecycle reuse. No accepted asset, native motion source or hair configuration was changed by this audit.
