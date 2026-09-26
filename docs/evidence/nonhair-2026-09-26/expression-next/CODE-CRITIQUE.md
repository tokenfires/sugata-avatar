# Independent review: experiment-local expression owners

Reviewer: `/root/critic`, 2026-09-26. Static review and independent CPU execution; no new browser/GPU run or perceptual judgment.

**Verdict: the reviewed B/C owners may proceed to the short native lifecycle gate, then the planned fixed appearance comparison if that gate passes.** This does not approve production integration, a new public action API, or the appearance of either arm.

Reviewed hashes:

- `ExpressionStudyArm.mjs`: `5b7edd36ed48198bfc1abb0b366f1c1e7102d053e092348bcfce2d56f4f7236d`
- `ExpressionStudyArm.selftest.mjs`: `49f48d00a6c6a35b4901056081c8559b7a0f6f050ced0c9ddb90212ee2c9b76d`

I reread the implementation, tests and current MotionStack/ExpressionLayer/Gaze ownership paths, then independently reran all 15 CPU groups successfully.

## Numerical and facial ownership

C reads the expression writer from the current frame accumulator after the actual pinned expression instance has run. The source validates identity, registration, declaration, order and the captured expression weight; it does not rely on a stale contribution object or `faceResult`. Missing current output produces zero subtraction. A negative or nonfinite owner value rejects the entire two-channel correction before either side writes. C declares only the two eyeWide channels and leaves Blink, FacialIdle, mouth corners, visemes, posture and other writers with their existing owners.

The corrected oracle observes native admission precisely: raw contributions below `1e-6` are omitted before weighting; the study correction has required weight one. Tests cover the `1.5e-6` expression whose requested correction is omitted, an exact `-1e-6` admitted correction, an admitted expression subsequently scaled below epsilon, and the ExpressionLayer's own boundary. Actual commit only clamps the final sum. The opposing-writer regression correctly preserves a positive sub-epsilon residual instead of applying the unrelated exclusive-contributor helper.

The fixed 45% attenuation is weighted only once and uses the same-frame envelope at order 701. No amplitude search or extra brow/squint/head channel is present. A/C tests use real native controllers and require exact unaffected morph/bone/shared-state equality through release, with a witness that eyeWide actually differs.

For later capture, a bit-exact expected sum should replay the actual writer order. Regrouping `E + sum(otherOwners) + correction` can create floating-point reassociation differences even when the owner arithmetic is correct. This is an oracle detail, not a reason to change native summation or loosen unrelated state equality.

## Gaze and lifecycle ownership

B samples the actual camera and acquires one calibrated native hold. It adds no posture, smile, head-noise lease or facial output layer. The native hold starts at time zero; point refinement begins at .25 seconds, which the report labels separately. Invalid reach/support is checked before replacing a valid token. Repeats retain the current envelope, and cancellation hands residual point fading to the existing native token contract.

Current gaze/head membership and support are checked while active. New native look, hold, policy and speech-gaze cues retire the old study without allowing its cleanup to alter the newer owner. Ordinary speaking state and actual Viseme output do not supersede B. C owns no gaze and correctly continues through unrelated gaze commands.

Control/output disable, reset, bind, removal and disposal retire in place; re-enabling does not resurrect the old action. The constructor handles partial registration failures by removing only its actual instances. Tests also preserve an unrelated replacement using the same layer name. These checks address the specific ownership failures that would invalidate a perceptual comparison.

## Remaining gates

The CPU native fixture uses actual g050 geometry and controllers with texture decoding stubbed. It is not a render or a complete Avatar run. Real Avatar.say side effects, native appearance, physical hair state and pixel evidence remain for the coordinator's short lifecycle witness and six fixed quiet/speech clips. No hair changes, alternate camera search, fourth combined arm or favorable perceptual result is implied by these passing checks.

## Stable native lifecycle follow-up

The completed `captures/expression-isolation-2026-09-26/lifecycle-v3/report.json` has SHA-256 `0ce3a157e3de7cca1a6d7f6b6b07d6c21ea003436e67198d592f454c20254c52`. I independently verified its 313 current source hashes, ten completed native groups, zero unexpected errors, disposal with no leaks, and zero renderer memory counters. Its native speech witness records aa peak .6, PP peak .9, 24 speaking frames and a finished say promise. I independently compared all 420 recorded carrying-mesh values to their native committed channels across the 60 speech samples; all match.

The earlier speech failure was an instrument error: `Figure.getMorph` reads the direct-write intended state, while this Avatar's bound MotionStack writes through `createMotionTarget` to live mesh influences. Those direct-path values remained zero despite actual mouth movement. The corrected helper checks native channel commits and every carrying mesh for aa/PP, while retaining the direct values as a labeled diagnostic. The intervening v2 numerical pass was correctly rejected because source bytes changed during the run. Neither earlier run is substituted for the stable v3 result.

I reread the corrected six-clip capture instrument before appearance capture. It uses committed OVR weights plus exact live body-mesh agreement, records the real pre-step viseme sample clock, and accounts for Avatar's post-stack clock advance in endpoint sampling. It preserves say/reflex/gesture side effects, reapplies the fixed PAD target, records the final say outcome, and keeps per-writer accumulation order for the native clamp oracle. It checks all unaffected non-eyeWide mesh weights and card bone state, while retaining rather than assuming equality of vertex hashes that may carry authored eyeWide geometry. PNG size/nonuniform checks and source binding are present. This closes the mechanism gate; perceptual judgment still requires the fixed blind clips.

Signed: independent critic agent `/root/critic`.
