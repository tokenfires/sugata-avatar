# Experimental attention in Portrait — September 13, 2026

Portrait now offers **Look toward me** and **Release**. The action samples the current view, briefly settles the head and upper spine, and releases after 3.4 seconds of motion time. Repeating it blends from the current pose. Dragging, resetting the view or a newer explicit gaze command releases it; pausing removes its temporary pose immediately. The reduced-motion preference keeps invocation disabled until the user explicitly resumes motion.

This integrates the motion-only direction from [the authored study](ATTENTION-STUDY-2026-09-13.md). It is deliberately labeled experimental. It is directed attention, not a calibrated eye-contact solution or completed determination/coyness/teasing. The stronger skeptical face remains unshipped. The [product roadmap](PRODUCT-ROADMAP.md), including representative starter characters and complete outfits, remains the governing ambition.

## Scope and boundaries

`AttentionAction` is an exported experimental helper used by Portrait, not a general stable Avatar action API. It contributes only head/spine rotation and a temporary head-idle multiplier. It does not write affect, expressions, mouth shapes, speech timing, arm idle or the avatar's base idle settings. Natural gaze/head mechanics continue during the hold.

Camera and head world positions are converted through the **currently resolved Gaze rig**, including its full inverse transform. The actual figure has no eye bones: the head-origin direction is documented and is not a new binocular calibration. The view is sampled once on invocation; this action does not track a moving camera. Its conservative experimental reach is yaw ±55° and pitch ±25°. Rear/extreme views give a recoverable inline message; there is no whole-body turn.

Gaze owns an exclusive hold token. New explicit look, policy, partner-direction or speech-gaze commands invalidate it; an obsolete handle cannot restore over newer settings. IdleMotion separately multiplies only head motion through individually owned handles. Bind/reset/disposal invalidate those handles. Normal release restores the prior gaze-policy setting and removes only this action's idle multiplier; it does not rewind the natural motion sequence to an earlier random state.

The critic proved and root fixed two candidate defects before qualification: failed secondary resource acquisition could strand a gaze hold; removal of the native gaze-head layer could leave attention active. The selected fixes acquire resources transactionally and check ongoing source membership. Alternative remedies and preserved red/green controls are in the archived independent review. Lifecycle callbacks cancel in place; only the public disposer removes registered layer instances.

## Evidence

- Nine focused CPU groups pass: hold ownership and supersession, head-only damping, transformed camera targeting, repeat/cancel, invalid-view atomicity, reset/rebind/disposal, failed registration/acquisition and loss of the native head layer.
- Existing Gaze suite: 114 passed, 0 failed. Existing MotionStack suite: 47 passed, 0 failed.
- Independent critic: eight final CPU groups plus both original red controls now green. No additional source blocker within this scope.
- Two actual WebGPU runs, bob02 near the original view and bob01 from the opposite side. Each has 69 saved PNGs over 4.5 seconds, stepped at 60 Hz and sampled at 15 fps plus the final endpoint. All natural layers remain enabled and the selected PAD stays neutral throughout these motion captures.
- Twelve browser interaction groups pass across the two grooms: repeat/release, pause/resume, actual pointer-drag cancellation, explicit speech-gaze supersession, unsupported-view recovery and mobile fit. No page errors. Normal holds reach recorded rig targets of approximately (14.905°, 0.647°) and (-19.697°, 0.658°); policy is restored and owned head scales are gone afterward.
- Five additional live-page groups pass: normal playback/status, reduced-motion opt-in and resumed playback, and native silent mouth-shape activity during attention under both preferences. Both page lifecycle shutdowns report zero storage attributes, zero render participants and no leaked Avatar handles. No inference or spoken audio was used.
- The two MP4 review clips contain the first 68 original PNG samples at 15 fps, without interpolation or audio. Last included sample is 4.4667 s; encoded duration is 4.5333 s. The separate endpoint PNG is at 4.5 s. These captures are not a frame-rate benchmark.

The first browser capture probe incorrectly read `avatar.affect.value`, failing before its first action sample; the corrected probe uses the actual `affectState.pad`. A separate live probe watched `jawOpen`, although this rig's speech layer writes native OVR viseme channels; its corrected check watches `viseme_aa`. The corrected live probe also returns a small diagnostic snapshot instead of serializing the entire live VisemeLayer through the test bridge. All earlier harness failures are preserved and are not attributed to the product.

The independent critic inspected eight representative integration images and found no new visible blocker for this experimental control. The long-bob pupils retain a lateral appearance in the held samples; precise contact remains unqualified. Alternatives are to retain the limited “look toward” wording (chosen here), or measure rendered eye axes/centers across camera offsets before adding an eye-contact mode.

Visual review is bounded to the saved views and representative frames. This milestone does not establish population-level emotional recognition, arbitrary rig calibration, full-body gesture quality, a complete performance pass, or AAA completion.


Archive: `captures/attention-action-2026-09-13`, 234 files / 79,693,199 bytes, all reread and hash-verified. Tracked [summary](evidence/attention-action-2026-09-13.json) and [manifest](evidence/attention-action-2026-09-13.manifest.json); manifest SHA-256 `a2893f54c89fb6e2fe84ef7a039df7afeca4ac8e4d0fb68bd2d7c9f8a8d439a8`.
