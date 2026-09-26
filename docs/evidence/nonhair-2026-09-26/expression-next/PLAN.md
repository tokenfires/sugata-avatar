# Next expression experiment: separate gaze from eye opening

Frozen comparison design, 2026-09-26. Implementation and subsequent native evidence are reported separately; this plan is not a completion claim. No amplitude search is authorized by this design.

Run **one three-arm comparison** of current Determined, gaze hold alone, and moderate attenuation
of expression-owned eye opening alone. The September inventory found alert/wary readings; the
later study found coordinated motion useful as attention and rejected the combined 85% attenuation
with sustained browDown/squint profile as guarded/skeptical. Those are bounded historical judgments,
not evidence that a 45% isolated change works. No new product defect was proved by this audit.

| Arm | Fixed difference from current Determined |
| --- | --- |
| A — control | Actual Portrait Determined PAD `{pleasure:0, arousal:0.4, dominance:0.85}`; all natural layers continue. |
| B — native gaze hold | Same PAD; one camera-derived `Gaze.holdTarget` acquisition. No added head/spine pose, head-noise suppression or smile. Natural gaze-induced head following remains, so this is not an eyes-only intervention. |
| C — eye-opening attenuation | Same PAD and natural gaze policy; subtract exactly **45% × envelope** of the current expression owner's weighted `eyeWideLeft/Right` contribution. No added brow, squint, smile, head pose or gaze hold. |

Do not add a fourth combined arm or substitute full `AttentionAction` for B. The existing full
action bundles resources whose value this comparison is trying to separate. Keep the 45% authored
starting point from the prior critique fixed even if the first images are disappointing.

## Existing entry points and exact mechanism

- [`portrait.js`](../../../../packages/testbed/src/portrait.js), `expressions.determined`, calls
  public `Avatar.feel(PAD)`. [`Avatar.js`](../../../../packages/core/src/Avatar.js), `feel` and
  `attachAffect`, route the vector into the existing state; `ExpressionLayer` owns its single update
  clock. Named `feel(label)` also installs persistent triggers, so use the actual PAD button and
  do not introduce a named emotion as a shortcut.
- [`AttentionAction.js`](../../../../packages/core/src/motion/AttentionAction.js), exported
  `attentionTargetFromCamera(camera, gaze.headBone, gaze.rigRoot)`, supplies rig yaw/pitch from the
  actual view. [`Gaze.js`](../../../../packages/core/src/motion/Gaze.js), `holdTarget`, is the
  existing native ownership entry point on `avatar.layers.gaze`. Require the existing frontal
  reach and `pointAimSupport() === null` for this g050 study; acquire once with `predicted:true`,
  a copied camera world point and point weight zero. Ease only the returned handle's point weight.
  Call `handle.release()` at normal completion or `release({pointFadeSeconds:0.3})` on cancellation.
  Never keep issuing `lookAt`, write `policyEnabled` directly, or use `say` as an action timer.
- There is **no public Avatar eye-opening attenuation API**. C would need one isolated experimental
  `Layer`, not an invented claim of an existing API. Use native `stack.add(instance)` /
  `stack.remove(instance)` and declare only the two eyeWide channels. Run immediately after
  `MOTION_ORDER.EXPRESSION` (700), before Viseme (800), Blink (900) and FacialIdle (910).
  During its own update, read the current accumulator's `writerNames`/`writerValues` entry for
  the actual registered expression owner; the value is already weighted. Contribute
  `-0.45 * envelope * expressionWriterValue` for each side. Record this internal instrumentation
  dependency explicitly; it is not a new stable API.
- [`MotionStack.js`](../../../../packages/core/src/motion/MotionStack.js), `beginFrame`,
  `accumulate` and `commit`, clear writer lists each frame, add weighted contributions, then clamp
  once. Read the current writer entry, **not** `expression.faceResult` or a disabled layer's stale
  contribution object. Missing current expression contribution means zero attenuation. Refuse
  unexpected registration/order, a changed own layer weight, negative/non-finite owner values
  instead of subtracting the whole eyeWide sum.
- [`ExpressionMap.js`](../../../../packages/core/src/affect/ExpressionMap.js), `face` and
  AU5 mapping, supplies expression eye opening. [`FacialIdle.js`](../../../../packages/core/src/motion/FacialIdle.js)
  independently writes eyeWide for lid follow; preserve it. Preserve Blink, brow, mouth corners,
  visemes and the affect/posture map. MotionStack drops raw morph contributions with
  magnitude below 1e-6 before multiplying by layer weight. This study output has weight one. Let `correction = -0.45 * envelope * expression`, then set
  `admittedCorrection = abs(correction) < 1e-6 ? 0 : correction`. Expected final channel is
  `clamp(expression + otherOwners + admittedCorrection, 0, 1)`. Preserve the runtime threshold;
  never change it to force the study's algebra. This differs from scaling the final mesh value.

## Fixed capture and release contract

Use fresh native g050/bob02, existing Studio lighting, seed 20260807, one fixed frontal/eye-level
upper-torso view, unchanged hair and all current natural layers. Inspect visibility before the
comparison; if the eyes cannot be reviewed, record presentation-limited/inconclusive instead of
changing hair or searching cameras. Pin selected sources/assets and actual initial states. Allow
at least 64 zero-delta draws after projection settles; PNG byte equality is not required.

Click Determined, step 150 native frames at 60Hz (2.5s), then call this point action-time zero.
The target remains Determined throughout release; action release is not a neutral reset. Use the
existing authored pose envelope shape solely as the fixed timing reference:
`smooth((t-.25)/.6) * (1-smooth((t-2.6)/.8))`, clamped through the current smooth function.
B dispatches its one native gaze request at t=0 and eases point refinement with that envelope.
Record that immediate native hold separately from point refinement beginning at t=.25; B and
C therefore have different effective onsets. C eases its attenuation. Hold through 2.6s,
finish the normal envelope/hold at 3.4s, observe through
4.5s. B restores prior policy ownership but does not rewind random gaze history.

Capture three quiet clips and three matched speech clips, continuously stepped at 60Hz and sampled
at 15Hz plus explicit onset/hold/release endpoints. Label image sampling honestly. Store actual PAD,
expression prescription/current writer values, final morphs, gaze token/policy/point output, bones,
physical hair state, camera and timing at matched samples. A versus C must match every unaffected
state and committed channel; geometry carrying authored eyeWide targets may differ on more than
one mesh. B intentionally changes gaze/head and consequent lid-follow/physical state.

For the speech clips, call real `Avatar.say` with an explicit saved aa/PP/FF/U timeline and identical
speech plan in all arms, then reapply the same Determined PAD immediately in all arms because
`say` pushes reflex affect and schedules gestures. Preserve those real side effects in the record.
Store the returned promise, advance the native clock, and await it after the timeline completes;
awaiting it before manual stepping would deadlock. Derive sample times from the normalized native
viseme windows and lead, assert `speaking:true` and actual committed peaks, and compare all OVR
weights exactly. Do not infer speech safety from silence or claim TTS/audio synchronization.

## Ownership gates before judging images

Keep this a specific temporary study owner with elapsed invocation time. Its control runs before
native head/gaze (order 50, like AttentionAction), so point weights and retirement reach the current
gaze update rather than arriving one frame late; C applies that same-frame envelope at order 701.
This is experiment-local ownership, not a new generic cue system. CPU checks must cover:
current weighted expression-only subtraction, no stale subtraction when expression is disabled,
zero/no-expression behavior, preserved other-writer values and blink/visemes, repeat/cancel continuity,
and reset/bind/removal/disposal retirement. A disabled study control must retire its resources and
must not resurrect them when re-enabled. Remove instances, never layer names; commit the restored
pose on the next native update.

Include the admission boundary: with current expression writer E=1.5e-6 and envelope=1,
the admitted expression remains but the -6.75e-7 study correction is dropped. The expected
final result must preserve E. Include the exact 1e-6 correction boundary as specified by the
current runtime. This correction follows the independent DESIGN-CRITIQUE.md before any run.

For B, test explicit cancel during onset/hold, a newer `lookAt`/`holdTarget`, policy change,
`markFilledPause`, `markTurnEnd`, reset/bind and disabled required gaze/head layers. An old token
cannot reclaim or release a newer target. Ordinary `say`, viseme activity and
`setConversationState('speaking')` alone must not be mistaken for gaze supersession. C owns no
gaze, so gaze supersession must not silently end its independent facial cue; explicit study cancel,
invalidated owner or runtime retirement does. Include one short native lifecycle witness after CPU
gates, with B and C tested separately, not as an additional combined appearance arm.

Independent review uses hidden labels and matched onset/hold/release/speech moments, with ordinary
clips available. Ask whether either isolated change improves engaged/focused intent while retaining
openness, natural release and readable speech, or introduces guardedness. “Inconclusive” and “neither”
are valid outcomes. No shipping, resolve label, broad intent infrastructure, global PAD retune,
population recognition claim or further amplitude iteration follows automatically.

Historical basis: [expression inventory](../../../EXPRESSION-INVENTORY-2026-09-13.md),
[attention study](../../../ATTENTION-STUDY-2026-09-13.md),
[smile integration](../../../SMILE-INTEGRATION-2026-09-13.md). Current source was read for ownership;
this design did not reopen their raw archives or rerun their visual evidence.
