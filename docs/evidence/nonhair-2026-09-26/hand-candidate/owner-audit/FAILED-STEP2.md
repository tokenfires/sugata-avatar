# Preserved first native stop: dependent face morphs

`candidate-primary-v1` correctly stopped at step 2 / stack frame 4 because the controller asserted that the entire committed morph vector must equal accepted A. That invariant is too broad for a freshly rebound rest pose. The run remains incomplete and unsealed. It retained numerical geometry at steps 0 and 1 and the final actual owner frame in its clean retirement receipt; there is no 721-state archive, no fit result and no rendered acceptance.

The failed report is hash-bound by `stopped-step2-v1.json` (`9ba0cf99d2cb42053a5b11e51136c3c009cdade83f48fae610e212b528c5a75a`). Its exact executed script independently verified all 1,582 frozen source entries before diagnosis. All 17 actual owner metadata/status/PRNG records equal accepted A step2. Every returned raw contribution equals its effective contribution. The candidate retains cap0 and uses the original native writers. Retirement is disposed with no lost descriptors, leaks or remaining renderer memory.

## Exact observed owner changes at this frame

| Owner | Changed channels | Largest absolute component difference |
| --- | --- | ---: |
| affectPosture | upperarm_l/r rotations | 5.5511e-16 |
| sway | pelvis, spine_01/02/03, neck_01, thigh_l/r, calf_l/r, foot_l/r, ball_r rotations; pelvis and foot_l/r offsets | 2.6469e-6 |
| bodyIdle | upperarm_l/r, lowerarm_l/r, hand_l/r rotations | 4.1003e-4 |
| handIdle | all 30 finger-joint rotations | 3.6102e-10 |
| gaze | eyeLookInLeft, eyeLookOutRight, eyeLookUpLeft/Right | 2.600960666e-7 |
| facialIdle | browInnerUp, browOuterUpLeft/Right, eyeWideLeft/Right | 4.332529753e-8 |

All other owners and every other owner channel are exact, including `gazeHead`, `expression`, `blink`, mouth/viseme writers and the current null gesture output. The receipt lists each changed vector/value and signed delta, not just these maxima. Quaternion and offset components have different units; the table is a comparison summary, not a physical clearance metric.

The native morph-fold oracle reproduces all 89 accepted actual body influences exactly using raw per-writer epsilon admission, then weight multiplication, ordered summation and final clamp. Folding the candidate's retained owners predicts precisely the nine committed changes listed by the failed assertion. Its largest delta is −2.6009606660256333e-7 in both eyeLookUp channels. The candidate's final body vector was not separately persisted before the assertion; label this a prediction from actual owners, not an independent saved mesh readback.

## Why the dependency exists

All paths below refer to the verified frozen sources beneath `candidate-primary-v1/source/`.

1. `Avatar.js:3091–3139` applies the authored RestPose and then binds the native stack. `Sway.js:1663–1670` binds its BodyMass model and freshly measures pendulum, stance and foot response. The COM table explicitly includes upper arms, forearms and hands (`figure/BodyMass.js:109–128`). `Sway.js:2337–2372,2544–2570` reads the complete rig during those probes, including hands carried by the posed trunk. Its runtime solves posture/pendulum response from those measurements (`Sway.js:1700–1750,2146–2172,2772–2783`). A changed shoulder rest can therefore change native trunk, neck and foot output even though the authored Sway-chain rotations were retained.
2. `initial-coupling-v1.json` (`141297a77a1446d4e1b424498b0cb4fbaaf52d893af9e3365d2afb623ba2b032`) evaluates the actual source BodyMass model on retained preparation-frame matrices. The COM shift is `[+0.003063,+0.305415,−0.004538]` mm. The initial head, neck and foot world matrices remain exact. This quantifies a changed input to the native response measurement; it does not invent the unrecorded COM lever/cache values. The separate native Sway output difference at frame4 proves that its output did change.
3. `Gaze.js:1063–1077,1931–2007` reads the **previous committed external head pose**, subtracts its own prior head share, and composes that external term with its current own head share for the vestibulo-ocular reflex. Consequently, unchanged `gazeHead` output does not imply unchanged eye output. This explains the first delayed eye divergence after positive-time sway begins. The preserved `initial-coupling-step1-addendum.json` corrects the earlier missing-trace claim without rewriting the original receipt: step1's head world matrix is retained and differs by at most 1.5852976733860685e-7 per component, with translation distance 1.3101194126801894e-7 m. That is direct evidence of changed prior committed head pose before step2. The local-ancestry/VOR cache decomposition remains unrecorded, so this is not an exact reconstruction of Gaze's internal calculation. The addendum SHA is `12d6fb43d60e90e00f78d0e1931f5b6ccb87503f791ebbe190e48c7cdc056c5e`.
4. `Gaze.js:2152–2205` converts ocular angles to eyeLook weights and publishes `eyePitchDegrees`. `FacialIdle.js:594–628` derives lid following from that pitch, and `651–663` derives the three up-brow terms. The observed eye-up fraction difference predicts the eyebrow changes with at most 2.51e-18 subtraction roundoff; the inferred left/right lid scales are identical before/after (1.0222319536143913 / 1.041088829562068). Thus all five observed FacialIdle changes match its existing dependency without an expression or speech change.
5. The arm noise owners bind their own rest frames (`BodyIdle.js:688–708`) and measured finger hinges/rest frames (`HandIdle.js:671–716`). Fresh shoulder initialization legitimately changes those coordinate inputs. BodyIdle's arm deltas differ materially in component space; HandIdle's measured hinge/rest conjugation differs only by about 3.6e-10 here. These are recorded as actual native output differences, never hidden with an epsilon.

## Narrow invariant revision recommended to the parent

Preserve exact clocks, commands/schedules, metadata/status, PRNG, raw-versus-effective equality, fixed assets/masks, native cap telemetry and cleanup. Replace global morph-vector identity with **owner-specific** comparison:

- Gaze may change only its eight declared eyeLook channels, owing to actual eye/head compensation.
- FacialIdle may change only eyeBlink/eyeSquint/eyeWide Left/Right plus browInnerUp/browOuterUpLeft/Right, its nine source-defined lid-follow/upgaze outputs. Downward gaze can legitimately activate the currently unchanged blink/squint subset later.
- Every other owner's morph outputs remain exact, including Blink and Expression when they write the very same final channel names. FacialIdle's mouth, jaw, cheek, nose, browDown and other channels remain exact. Do not grant an exception to a whole final channel regardless of writer.
- Save exact before/after owner values and final committed differences for the 17-channel union, with no new numerical tolerance. Require ordered native fold agreement with each actual committed candidate body vector. Any other divergence stops for source-level explanation.

The allowance follows the declared source dependency, not the small measured error's magnitude. It is not permission to accept appearance, suppress telemetry or rerun a different pose/cap. The parent owns the revised controller and manifest; no capture source or gate was edited by this audit.

The exact original comparator, CPU witness and unexecuted full audit are preserved in `preparatory-v1/`. The full candidate audit scripts in this folder are preparatory. Their original manifest binding/global morph identity still targets the first attempted protocol; they must be explicitly revised to the parent's admitted successor protocol before use. That was the preparatory status at this stop; the completed successor is now recorded separately in `OWNER-ANALYSIS.md` and `owner-comparison-v3.json`.
