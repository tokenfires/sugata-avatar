# Independent review of the colour diagnostic

Reviewer: `hair_critic`, September 29, 2026. The reviewer inspected all six supplied references, the capture source, four original-light pilot images, and all nine distinct neutral-light images. It made no source changes and ran no GPU or browser jobs. Root independently inspected selected captures and checked the saved records.

## Verdict

The visual brief is faithful and sufficient for bounded implementation and critique. Controlled colour changes are useful for inspecting this groom. Medium brown exposes broad overlaps while retaining shadow separation; pale hair reveals boundaries and endpoints but reduces some finer contrast. Dark remains an important confirmation of intended appearance. Another colour sweep is not needed before structural investigation.

The neutral packet is sufficient to investigate large persistent rear-flow defects. Its independent dark repeats differ by 2 pixels at at most 1/255 in the back, exactly match rear oblique, and differ by 74 pixels at at most 2/255 in profile. Those residuals do not explain the large structures below. This does not qualify motion, exact universal repeatability, final hair colours, or a replacement asset.

## Concrete visual evidence

| Image | Approximate pixel region | Visible mismatch |
| --- | --- | --- |
| [Neutral rear oblique in medium brown](../../../../captures/hair-colour-2026-09-29/neutral-v1/casual-rear-oblique-medium-brown.png) | x350–535, y240–540 | Angular sections cross and overlap in several directions instead of forming the long cooperating curves in R1 and R3. |
| Same rear-oblique image | x535–620, y510–615 | A broad lower-rear tail hooks outward, with a separate straight section beside the neck. This conflicts with the medium target's inward settling and composed lower outline. |
| [Neutral right profile in medium brown](../../../../captures/hair-colour-2026-09-29/neutral-v1/casual-right-profile-medium-brown.png) | x205–395, y325–455 | A diagonal strip crosses the downward front curtain. The rear half is markedly more broken than the front; R3's layers retain the larger curved direction. |
| [Neutral back in pale colour](../../../../captures/hair-colour-2026-09-29/neutral-v1/casual-back-pale-neutral.png) | Crown x395–550, y145–235; nape x470–530, y495–605 | Pointed overlapping crown sections and an isolated central nape ending interrupt cooperative flow and the cut boundary. |

These features persist across colours and neighboring views. Their visibility is established; their origin in authored paths, deformation, card orientation, coverage, or shading remains unresolved. The profile does not by itself establish that ears caused the uneven volume.

## Two alternatives for the next structural step

1. **Recommended: trace the image regions to current bob02 geometry, then correct one demonstrated mechanism.** Identify the contributing cards or locks and compare authored paths with final held-pose paths. If a bend, reversal, or displaced endpoint is actually found, make one isolated candidate affecting that mechanism. This requires correspondence work first, but supplies a clear prediction and protects against repeated cosmetic tuning.
2. **Prototype a rear section from smooth root-to-tip guides.** Keep the accepted groom as baseline and replace the implicated rear section only in an experimental candidate, explicitly shaping outward body, downward fall, and inward endpoints. This explores a different representation if local paths cannot cooperate, with more changed variables and greater coverage/contact risk.

Root selected alternative 1 as the next bounded step. Alternative 2 is retained as a meaningful change of perspective if local geometry investigations fail, rather than endlessly adjusting and reversing small parameters.

Judge a candidate first in the same three views and medium brown, then pale and exact dark. Require improvement without a flat rear panel, crown gap, chopped hem, or lost strand hierarchy. Confirm in the original studio lighting. Keep the initial candidate focused on rear flow; face asymmetry and broader variations need their own attribution and views.

## Instrument review and alternatives

The corrected harness follows the existing `alive.js` owned-clock pattern and records actual live lights, grade values, exposures, render scale, AA/OIT, and exact physical state. Frame/grain 98, jitter 5 of 31, and history width 900 were checked from saved records. Two early failures were bookkeeping errors in recording the advancing grain counter, not hairstyle reversals.

The first studio pilot's blue cast prevented a useful natural-colour reading. The two alternatives were neutralizing all live light colours in a separate labelled diagnostic, or changing only the blue rim for a narrower lighting attribution. Root selected neutralization, preserving linear RGB luminance proxies and scalar intensities. The persistent shape defects survived that change.

For the original dark-repeat discrepancy, alternatives were a short matched sequence requiring persistence across neighboring frames, or a bounded investigation of the capture clock. Root selected the documented clock method and retained the remaining measured error rather than reopening the larger unresolved renderer program.

A nonblocking hardening suggestion remains: assert expected temporal jitter/history values inside the harness, or explicitly validate them from every saved report. This slice used the latter and checked all twelve neutral records. Hardware identity is established by the actual Apple adapter records, not by a WebGPU API assertion alone.
