# Isolated expression comparison implementation

2026-09-26. Fixed study controls only; no production source, page or asset was changed. Hair remains unchanged. Fifteen CPU groups pass and the independent critic reran them. Native capture and visual judgment remain separate gates.

## Capture API

```js
import { ExpressionStudyArm } from './ExpressionStudyArm.mjs';
const owner = new ExpressionStudyArm(avatar, { arm: 'B' }); // or 'C'
owner.start(avatar.stage.camera); // C does not need the camera
owner.report();
owner.cancel();                  // smooth .3-second release
owner.cancel({ immediate: true });
owner.dispose();                 // remove this owner's actual instances
```

A installs no helper. The module does not set PAD, call `say`, choose a view, or change natural motion. The capture host owns those controls. Only one study owner may be installed in one stack. There is no amplitude option: C is fixed at 45%. The helper exposes `control` (order 50) and C-only `output` (order 701) for lifecycle witnesses, not product UI.

B acquires one native calibrated gaze hold at invocation time zero, with a copied world point. Only its returned point-weight handle is eased; point refinement starts at .25 seconds. It introduces no AttentionAction pose, smile, or noise-suppression lease. Normal completion releases the hold at 3.4 seconds. Explicit cancellation restores native policy immediately and allows only that token's native .3-second point fade; cancellation before nonzero refinement has no fade to retain. Repeats begin from the current envelope. Invalid new targets preserve a still-valid invocation. Newer native gaze commands retire B; old-token cleanup cannot release the newer owner.

C reads current accumulator writer records after the captured actual expression instance. It never reads `faceResult` or a contribution left stale by a disabled expression layer. Missing current expression output gives zero correction. Initial expression weight must be finite/nonnegative and remains pinned, including a valid non-unit starting weight; C reads its already-weighted output once. Replacing/removing the expression instance, changing its order/weight, or changing/removing/disabling study layers retires the action. Re-enabling a control does not restart it. Disabled expression itself supplies zero correction while retaining an independently running study envelope. C owns no gaze token, so unrelated gaze commands do not cancel C.

`report()` returns phase/time/envelope, invocation count, retirement reason, target/point, actual token flags, and per-eye current expression/requested/expected-admitted/actual-admitted/committed values plus native writer order. `sampleFrame` and `sampleCurrent` distinguish the output sample from a stale prior report. The native owner and returned token remain the authority; study bookkeeping is not a second gaze system.

## Numeric oracle and tested limits

MotionStack admits a **raw layer contribution** when `abs(raw) >= 1e-6`, then multiplies by layer weight. It does not filter the resulting weighted writer again. C's output weight is required to be exactly one, so its requested correction uses the same admission boundary. Native commit clamps the accumulated sum; it does **not** zero a small final sum. In particular:

- An admitted expression writer `E=1.5e-6` requests `-6.75e-7`; the correction is omitted and E survives.
- A correction exactly `-1e-6` is admitted.
- A raw expression `1.5e-6` at weight .5 produces a valid weighted writer `.75e-6`.
- Admitted writers `+2e-6` and `-1.5e-6` leave the positive residual `5e-7` (subject to its ordinary binary representation).

The exported `expectedCommit(E, other, correction)` is an algebraic/tolerance oracle. A bit-exact capture assertion must reduce the actual writer list in native order, rather than regrouping floating-point additions. The report preserves that list. Neither MotionStack's threshold nor its commit behavior was changed.

The CPU suite uses real ExpressionLayer, MotionStack and VisemeLayer for controlled numeric cases. Its g050 cases parse the installed GLB and calibrate actual eye geometry, then exercise native Gaze, IdleMotion, Blink, FacialIdle, expression and paired posture. Only image decoding is stubbed for CPU loading; there is no renderer or browser. The A/C comparison covers 270 matched frames after 150 Determined warm-up steps, and checks identical native time/PAD/prescription/shared gaze state/bone transforms and all unaffected committed morphs, with actual eyeWide differences required. It is not full Avatar.say, physical-hair, render or perception evidence.

The focused suite also checks foreign eye writers before/after C, blink/brow/corners/OVR preservation, zero and disabled expression, invalid negative/nonfinite owner output, repeats/cancellation, same-name expression replacement, removal/reset/rebind/disposal, partial-registration failure cleanup, real calibrated B holds, both prior policy values, native superseding commands, ordinary speaking/viseme preservation, and disabled required layers. Two initial test-harness assumptions were corrected against native source: a disposed stack cannot be stepped, and partial point refinement reports `aiming`, not `aimed`. No runtime was changed for those corrections.

```sh
node docs/evidence/nonhair-2026-09-26/expression-next/ExpressionStudyArm.selftest.mjs
```

The native supplement exports `runNativeLifecycle(page)` from `native-lifecycle.mjs`. It takes one fresh, ready captured Portrait, reuses the capture host's clock setup/step/finish, runs B and C separately, and returns numerical checks plus actual final retirement. It never launches a browser. It invokes real Avatar.say and requires actual committed aa/PP motion before awaiting the already-finished promise; ordinary speech side effects are retained. Its deliberately stateful sequence is separate from appearance clips. The caller must require `completed === true`, no leaked study layers, and clean final disposal; a returned error is a failed gate.

`cpu-selftest.txt` is the passing CPU output. `cpu-provenance.json` pins this helper, its test, native CPU dependency sources and g050 input. Parent-owned capture scripts, native outputs and critique retain their own provenance. No automatic production promotion or further amplitude iteration follows a favorable image.
