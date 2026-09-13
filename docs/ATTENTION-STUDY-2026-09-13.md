# Directed attention and resolve study — September 13, 2026

**A coordinated look and small posture change communicate attention more clearly than the existing Determined control. The stronger facial variant reads as guarded or skeptical and is not selected as a resolve preset.** This is the primary agent's and independent critic's bounded visual reading, not a population recognition study. Both candidates remain unshipped; a distinct determination action and broader humanlike intent vocabulary remain open.

This follows the [current expression inventory](EXPRESSION-INVENTORY-2026-09-13.md) and preserves the full [product direction](PRODUCT-ROADMAP.md). No production Avatar, affect mapping, asset, shader or live expression target changed in this study.

## First remove the presentation ambiguity

Three fresh current Avatars used actual neutral/Curious/Determined Portrait inputs with the expression layer alone enabled, frontal camera and hidden hair. Bones remain fixed and both eyes/brows are visible. Six requested samples (0 and 2.5 s) completed in three clean runtime runs; all six raw PNGs are nonempty. The late frames show that the difference is primarily eye widening and a slight Curious mouth lift, with no brow shaping. This earns a targeted authored comparison rather than a global PAD change.

This is explicitly a face diagnostic. It does not represent the natural whole character; the previous inventory remains alongside it. One early scratch attempt used the wrong hair visibility property and failed before capture; it is retained separately. A critic viewing-copy anomaly briefly looked like a black zero frame, but both independent raw-PNG decoders disproved a capture defect. No rendered frame was replaced to hide that discrepancy.

## Three authored-motion arms

The local interactive gallery is `captures/attention-study-2026-09-13/motion/review.html`. It contains replayable clips, a shared time slider and optional hidden labels. The live preview can serve it through `/@fs/Users/robault/GitHub/sugata-avatar/captures/attention-study-2026-09-13/motion/review.html`.

| Arm | What changed | Observed reading |
| --- | --- | --- |
| Existing control | Current Determined PAD target with all natural layers. | Alert face, often looking away; hair obscures one eye. |
| Coordinated motion | Same PAD. One predicted gaze target at nominal rig yaw12°/pitch0°, temporary autonomous-policy pause, idle-head weight eased to25%, additive rig-space head+2.6° and spine−1° with onset/hold/release. | A more engaged forward relationship; both eyes become visible. Promising as attention, not proof of uniquely communicating resolve. |
| Motion plus facial cue | Exact same motion. Removes85% of expression-owned eye opening, adds browDown0.07 and eyeSquint0.05 during the hold. | More guarded/skeptical at the viewed holds. Preserve as a counterexample; do not select this as finished determination. |

The timings and angles are authored design choices, not claimed physiological norms. The two candidates restore the prior policy/idle weight and fade their own pose and face additions after approximately3.4s. The underlying mood remains selected. They do not return to the baseline's random gaze history, because pausing policy changed that history.

The capture contains207originalPNGs:69samples per arm across4.5simulated seconds, stepped at60Hz and captured everyfoursteps plus the endpoint. Each MP4 contains68samples at15fps (0–4.4667s sampled motion,4.5333s encoded playback); the4.5s endpointPNG is separate. No motion interpolation or audio is added. The critic viewed18representative onset/hold/release images, not continuous playback. The gallery is a viewing tool, not a synchronization-performance claim.

All207PNG hashes and nonempty content pass independent verification. Allthree runtime runs are clean, have no missing channels and dispose Avatar with zero storage attributes, render participants and leaked handles. At all69motion/facial-variant pairs, PAD, gaze, bones, hair and camera states match exactly. Expression-map output and all other committed Human morphs, including mouth and blink, match. Facial card deformation intentionally differs. This isolates the added face profile as a whole; it does not isolate its three ingredients or prove a unique contribution from the head-settling angle.

## Ownership boundaries and repairs to the scratch prototype

The source audit proved why the prototype uses one gaze command per target. Repeated predicted `lookAt` calls keep restarting the pending shift, while leaving autonomous policy active can replace the commanded hold. A silent action also cannot safely borrow `Avatar.say` as a scheduler: the actual method changes affect, utterance ownership and speech gestures.

The frozen appearance helper had two prototype limitations: it passed names rather than instances to MotionStack.remove, and used absolute stack time. Its fresh zero-clock images still show the intended action; final Avatar disposal closes its layers. The corrected helper removes actual instances and measures time since invocation. A separate real-Avatar probe passes two groups: early cancellation removes all temporary layers/restores prior values, and later replay honors elapsed action time plus nondefault prior policy/idle weight. This is useful prototype ownership evidence, not full runtime integration.

The critic also proved a shallow-copy issue in report(): its events array could acquire a later release after an earlier snapshot. This affects the old owner probe's in-evaluate held.events array; the appearance samples serialize each report immediately and are unaffected. The final scratch helper clones event entries; the independent actual-source CPU probe preserves the old red and checks stable fixed snapshots. No GPU rerun is claimed for this report-only correction.

The prototype remains restricted to serialized actions on this avatar. It does not arbitrate arbitrary external policy/weight writers, reset/rebind, identity replacement or all quality tiers. Gaze's compensation for a separately authored head delta observes the previous committed pose; the study does not claim zero latency. Existing head/trunk channels have other owners; the separate source proof about removing the sole owner of a new bone is conditional and not a current Avatar failure.

The final gallery loads allthree videos, seeks matched samples, hides labels, restarts, plays/pauses, and fits a430px viewport in three real-browser groups. A first probe exposed the fractional-step slider's invalid exact-time fill; the gallery now uses integer sample indices. This is an artifact correction, not a runtime/avatar change.

## Two alternatives and the next useful slice

For the skeptical face, the critic recommends moderate attenuation of expression-owned eye opening alone (45% as an authored starting point), without added brow/squint. This tests whether less wide-eyed uncertainty helps while preserving openness. The alternative is keeping the open face and timing a brief brow cue near the decision instead of holding it throughout. Neither warrants a global affect-map rewrite.

For the motion result, compare a gaze hold alone against the complete action to isolate whether head/posture contributes useful commitment. The alternative is retaining the complete action as an explicitly named attention study and reviewing it in a wider, clothed body view. A full determination label remains unearned.

The next integration slice should target the actual camera direction rather than assuming nominal yaw/pitch, then expose one explicitly experimental, user-invoked attention action with owned interruption/release/cancel behavior. Preserve natural eye/head mechanics and speech. Do not introduce a broad stable intent API from this one study, or claim that attention completes the humanlike embodiment objective. Representative starter looks, complete outfits and broader expressive action remain part of Phase1.

The local archive contains the original frontal and action evidence, both critic audits and alternatives, fixed ownership probes, source snapshots and gallery checks. Its tracked manifest and final checkpoint record the exact inventory and source hashes.

Archive verified: 323 files / 120,286,887 bytes. Tracked [manifest](evidence/attention-study-2026-09-13.manifest.json) SHA-256 `1de4f72bf21ee4887e416c6a8039507037f26b3380f9dd9bfe4bda6bf020861a`. Final scratch helper SHA-256 `225b0c0d5ffef1770f79fd129eae34130f6aaa26e8743ef78e662b082fbbe58a`.
