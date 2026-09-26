# Provisional blind visual review

Reviewer: `/root/critic`, 2026-09-26. Written before opening the hidden key, original arm-labelled image directories, or original appearance report. I previously reviewed the three study designs and their code, so this is a treatment-label-blind review, not a reviewer naive to the possible treatments. Mapping was taken only from `review-manifest.json`.

**Verdict: View 2 is the clearest provisional improvement in direct engagement in this fixed scene. There is no demonstrated winner for determined/focused intent, natural release, or production adoption. Views 1 and 3 are perceptually too close here for a confident preference. Keep all treatments experimental.**

I inspected 54 original native PNGs: all three views in Quiet and With mouth motion at 0, 0.25, 0.85, 1.6667, 2.6, 3.4, and 4.5 seconds, plus the three speech views at the explicit 0.5, 1.1, 1.7, and 2.3 second mouth samples. `visual-blind-receipt.json` records the exact manifest and image SHA-256 hashes. No crop, compositing, enhancement, or new render was used for this judgment.

## Observations

| Moment | Visible result |
| --- | --- |
| Start | All views look alike. The head is turned strongly to the viewer's right, with much of the far eye and cheek obscured. This pose does not provide a strong initial read of engagement. |
| 0.25 s | View 2 has begun turning toward the viewer sooner; Views 1 and 3 remain a little farther averted. The partly obscured face still limits eye-expression judgment. |
| 0.85–2.6 s | View 2 presents a nearly frontal face and a sustained gaze toward the viewer. Both visible eye openings remain open, and the softly parted mouth reads as available/attentive. Views 1 and 3 mostly look to the viewer's left; their intent reads more as attention to something beside the viewer. |
| View 1 versus View 3 | View 1 looks slightly narrower in the eyes at some held samples, especially 2.6 s. The difference is small and does not overcome the averted gaze. I cannot reliably call it stronger focus; it can also read as a more reserved side glance. I do not find a large, consistent added guardedness across the selected samples. |
| Mouth samples | The open, teeth-visible shape at 0.5 s, closed lips at 1.1 s, narrow teeth-visible opening at 1.7 s, and smaller opening at 2.3 s are distinguishable in each view. I see no view-specific loss of mouth readability. The bright tooth/lip edge in the teeth-visible samples occurs across the views; it does not favor a treatment. This is not a speech intelligibility or lip-sync assessment. |
| 3.4–4.5 s | Views 1 and 3 return to a visually similar eye appearance. View 2 remains more frontal at 3.4 s and turns its eyes aside by 4.5 s. The final faces do not look visibly deformed or stuck in an extreme eye shape. These endpoints alone do not prove a smooth or natural release. |

View 2 retains openness in these samples, but its wide eyes and slightly parted lips can read as alert listening or mild surprise. I would not label that result “more determined” merely because it faces the viewer. Similarly, the quieter lid difference between Views 1 and 3 is insufficient evidence of a useful expression change. These are this reviewer's impressions of one character, lighting condition, camera, and timeline, not population findings.

## Bounded alternatives

The observed limitation is that averted head/gaze direction dominates the small facial difference, while frontal attention is not uniquely a determination cue.

1. Retain the current shipped expression and use the existing explicit attention action when a demo needs the avatar to address the viewer. This preserves the qualified behavior and makes intent controllable, at the cost of leaving “determined” itself ambiguous. Do not silently couple every expression to camera gaze.
2. Keep View 2's exact captured treatment as a candidate for a narrowly described engagement cue, and review this same neutral-labelled packet continuously and in the intended conversational context before making any product decision. That can distinguish an attentive hold from a stare and assess release without adding parameter trials; it still cannot establish general expression semantics from one sequence.

For Views 1 and 3, accepting an inconclusive result is preferable to selecting the smaller eye difference by expectation. No combined treatment, amplitude sweep, hair workaround, or automatic follow-up render is recommended by this note.

## Limits

This judgment used matched stills rather than continuous playback. It cannot establish blink quality, motion smoothness, timing comfort, or natural release. Speech has no audio and a synthetic saved mouth timeline. The initial large head turn and occasional eye occlusion limit interpretation; existing hair appearance remains outside the study. Numerical writer ownership, speech completion, mesh fidelity, and lifecycle checks are separate engineering evidence, not substitutes for this perceptual limit.

Signed: `/root/critic` — provisional verdict sealed while treatment mapping remained unopened.
