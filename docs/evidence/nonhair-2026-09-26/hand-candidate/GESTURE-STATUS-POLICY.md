# Candidate Gesture status admission

The v2 native candidate stopped at step492 because its Gesture returned a contribution while A returned null. The retained schedule, random states and native source explain this event exactly. Candidate yield1 produces shoulder0.06884209321837896°; A yield0.35 produces0.02409473262643264°. Native Gesture returns null only when `abs(shoulderRadians) < 0.05 * (Math.PI/180)`. The threshold, pose family, cap, wrapper and runtime ownership are unchanged.

`candidate-gesture-status.mjs` exports `compareCandidateOwnerStatus(actualCandidateState, expectedAState, {step,sourceHashes})`. It is read-only. Root integrates the same check before morph admission and owner metadata admission; do not replace missing A output with the candidate's contribution.

The policy checks active, failure-free unfiltered A instrumentation, exact owner sequence/order/weight/enabled/PRNG, valid actual raw/null records, exact clocks/schedule/utterance/configuration, exact live PAD and effective spatial extent across the pair, and every non-Gesture owner's exact status. Gesture disabled/error cases are rejected. Equal Gesture statuses retain the previous admission rule and explicitly report `formulaChecked:false`; no exception is used.

Only a Gesture status discrepancy invokes full reconstruction for both sides. It finds the actual active schedule interval, invokes native `gestureEnvelope`, `postureYield`, `amplitudeFor` and exported excursion constants, and preserves native multiplication order:

```
scale = activation * yielded * 1 * amplitudeFor(extent)
shoulderRadians = scale * BEAT_EXCURSION * SHOULDER_RAISE_FULL_DEGREES * (Math.PI/180)
returnNull = abs(shoulderRadians) < 0.05 * (Math.PI/180)
```

Amplitude1 is justified by actual frozen HandAttributionArm admission and per-frame configuration checks, not inferred from reported degrees. Root also reads/asserts the live native scalar configuration before capture. The helper requires the exact Gesture, Avatar and guard source hashes from the independently verified capture manifest. The unexported threshold is an explicit expression bound to that exact Gesture source. Shoulder/elbow degree telemetry, envelope, phase, hand, both posture-radian/degree values, duplicate posture reports and active sample/owner records must agree exactly. Only numeric signed zero follows retained-JSON equality; no other tolerance or rounding is permitted. The decision uses recomputed radians, never a degree round trip.

There is a real temporal limitation: at retained step55, post-frame affect dominance is0.9928347853384093 while Gesture sampled0.9918910034617577 earlier in that frame. Recomputing all equal-status frames against the final affect report would therefore be an instrument error. This policy grants an exception only when the available telemetry independently reproduces both decisions. A future discrepancy with insufficient frame-time evidence fails closed; it does not borrow a nearby state or relax the formula.

Seven focused CPU groups pass. They hash-verify the exact v2 failure report/manifest, encoded+decoded failure state and all493 partial states, and the sealed A reference state archive. Only492 uses the exception. Red controls cover other-owner status, disabled/error state, metadata/PRNG/source changes, wrong yield/posture/envelope/extent/phase/hand/angles, a one-double shoulder-angle change, and false Gesture return records on either side. Both captured inputs remain unchanged and A's null contribution stays null.

A separate native-class predicate fixture locates adjacent representable timestamps0.9666178816406292 and0.9666178816406293. Actual `GestureLayer.update` switches from null to return across those times; recomputed radians are0.0008726646259971638 and0.000872664625997172 around the unchanged0.0008726646259971648 threshold. A forged return at the lower timestamp is rejected. This tests the return boundary, not skinned rotation geometry.

`gesture-status-CPU-v1.json` binds the helper, test, source pins, native stopped inputs and complete test output. No candidate acceptance, motion-clearance result or product change follows from correcting this comparison policy.
