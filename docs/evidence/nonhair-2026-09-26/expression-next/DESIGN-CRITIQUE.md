# Independent design review: fixed expression comparison

Reviewer: `/root/critic`, 2026-09-26. Design and current source review only; no implementation or new perceptual evidence.

**Verdict:** suitable for one isolated three-arm study after the numerical expectation below is corrected. This is permission to learn from a bounded comparison, not an approval of an expression change.

I verified the historical recommendation in `docs/ATTENTION-STUDY-2026-09-13.md`: 45% expression-owned eye-opening attenuation alone was an authored next comparison, not a previously successful treatment. The plan correctly keeps current Determined as the control, separates a native gaze hold from facial attenuation, preserves the current hair/presentation, and allows neither/inconclusive. It does not silently substitute the bundled AttentionAction, a named persistent emotion, or a global affect-map edit.

## Required numerical correction

`MotionStack.accumulate` ignores each **raw** morph contribution whose absolute value is below `1e-6`, then multiplies admitted values by their layer weight before adding them to the channel. The planned study layer has required weight one and must use that existing admission rule in its expected-output oracle. For example, a current admitted expression value of `1.5e-6` and envelope 1 proposes a correction of `-6.75e-7`; the stack omits that correction. A raw expression value of `1.5e-6` with expression weight .1 is still admitted as a current weighted writer of `1.5e-7`. The final value is therefore not invariably `clamp(E + other - .45*envelope*E)`.

Record both the requested correction and the correction actually admitted to the current accumulator. Add a boundary CPU case around this threshold. Preserve the runtime rule; do not lower the threshold or change the runtime to make the simplified formula true. Reading this frame's weighted expression writer rather than `faceResult` remains the right way to avoid double weighting and stale disabled-layer output.

Actual `commit()` clamps the accumulated sum without applying a second epsilon. `committedMorphValue()` is documented for one exclusive contributor and is unsuitable as the general multiwriter oracle. An independent native-stack CPU reproduction with admitted writers `2e-6` and `-1.5e-6` committed `4.999999999999999e-7`; the exclusive helper returned zero for that same residual. Preserve the native residual and record this distinction in tests.

## Ownership and evidence cautions

- Arm B acquires native gaze at action time zero. The point-refinement envelope begins later, at .25 seconds. Native gaze/head movement can therefore begin before the facial attenuation in C. Keep that distinction in event metadata and interpretation; the timing shape does not make these interventions mechanically identical.
- Bind the actual expression layer instance and verify membership/order/weight rather than trusting an owner-name string alone. An invalidated instance must retire the study; it must not accidentally follow a replacement owner with the same name. Removal must use the study's own instances and tolerate partial construction failure.
- Define the A/C equality set before capture: native clock/delta sequence, affected-state inputs, bones, gaze, Blink/Viseme and other committed channels. Exclude intentional study bookkeeping and asynchronous renderer timing from the claim. A failure is evidence to explain, not a reason to relax comparisons after seeing the images.
- `say` changes reflex affect and schedules gestures before its promise is returned. Reapplying Determined immediately preserves the intended target, but does not erase the real speech side effects. The same saved speech plan and normalized viseme windows must be used in every arm. No audio/TTS synchronization claim follows from the manual clock.
- Current eye visibility is an entrance check. If existing hair or composition prevents a defensible reading, report presentation-limited rather than change the groom, hide it, or search for a favorable camera. Preserve full ordinary clips alongside any predefined matched stills.
- Use hidden arm labels for the first visual judgment, retain the label mapping separately, and compare the same scheduled moments. A single reviewer/starter identity can give a bounded art judgment, not a population recognition result.

The planned separate CPU/lifecycle ownership checks are useful and should finish before the appearance study. They should not grow into a generic cue API. No fourth combined arm, amplitude sweep, automatic production change, or deferred hair work is earned by a favorable result.

Signed: independent critic agent `/root/critic`.
