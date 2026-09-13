# Viewer eye contact study — September 13, 2026

The existing Portrait attention gesture turns toward the viewer. A measured per-eye correction gives a modest improvement in apparent direction in the reviewed stills. Full and gentle motion candidates are saved for comparison, with natural small eye movements and the action's onset/release. **Both remain experimental study code; Portrait still uses the accepted attention action.**

Open the local [comparison gallery](../captures/eye-contact-study-2026-09-13/gallery/review.html). It has three synchronized recordings, exact-moment original PNG links, and natural/hair-hidden still comparisons from three cameras. Run the normal testbed preview to view it. [The existing action](ATTENTION-ACTION-2026-09-13.md) retains its separate runtime qualification.

## What was measured

The unmodified long-bob g050 Portrait was captured with all natural motion layers, using the actual “Look toward me” button. The first study used the home view, front at eye level and an oblique eye-level view. Actual morphed/skinned globe and cornea points were fitted per eye and compared with the eye shader's animated frame and the direction from each eye centre to the actual camera.

At the open-eye 1.5-second sample, camera distances were 0.773–0.784 m. The two desired eye directions differed 4.224–4.261 degrees. The fitted eye axes missed their camera directions by 5.98–6.79 degrees: outward on opposite sides and downward on both. Shader-versus-posed disagreement was only 0.188–0.266 degrees. These are geometry/renderer proxies, not independently calibrated visual axes or a perceptual eye-contact score. The fitting mathematics reuses production `measureEye` on actual posed points.

The 2.5-second sample caught a blink. It was retained but not used as open-pupil visual proof. The next comparison froze the documented open-eye 1.5-second state. A numerical fit changed the eight eyeLook channels to align the posed corneal axes with the camera. Twelve original/candidate PNGs cover three camera positions in natural and explicitly hair-hidden/reframed presentations. The diagnostic view changes framing and hair shadows.

The independent critic inspected all twelve PNGs. It found a weak, consistent preference toward the viewer, most clearly at home and oblique. The pupils move inward and upward, with more upper-lid overlap. No clear crossed-eye or rolled-up failure was observed, but warmth and a relaxed gaze are not established. The correction also moves the authored eyelid/eyebrow/lash shapes: unchanged non-eyeLook weights do **not** mean unchanged face geometry.

## Motion alternatives

The subsequent natural home-view study compares the existing gesture, full correction, and a half-strength authored alternative. Each uses 240 simulation steps over four seconds; 121 original PNGs per arm record 30 frames per second, including both endpoints. The review MP4s are lossy convenience copies (121 frames, 4.033333 seconds); PNGs and state records remain the primary evidence.

Both candidates target the sampled world camera point plus the existing rig-space microsaccade offsets. Correction follows the attention pose envelope, beginning after 0.25 seconds and releasing with the gesture. All eight eyeLook weights are blended across figure meshes. A diagnostic hook applies them after the native stack commit and before drawing. **That bypass is not a production ownership design.** Gaze scheduling, head, hair, camera, clock, and non-eyeLook weights stay under their existing owners.

At 1.5 seconds the original corneal-axis errors are 6.31/6.21 degrees, the half candidate 3.30/3.27, and full 0.493/0.493. The full candidate retains the existing roughly half-degree microsaccade at that moment rather than pinning the axes to zero. Lower geometric error alone is not a visual acceptance criterion. The fit and partial blend do not constitute a validated anatomical model or an optimized controller.

The independent motion review inspected original/full/half at onset, hold, blink and release (twelve raw PNGs) and audited all 240 candidate trace samples. It recommends the full correction as the next development candidate: full reads most directed toward the viewer, while half is subtle at normal portrait size. No obvious new ocular failure appeared in those sampled moments. Neither reviewer independently watched continuous video, and relaxed warmth or artifacts between inspected frames remain unresolved. This supports a bounded implementation through native gaze ownership; it does not accept either diagnostic writer for production.

## Verification and limits

- Nine completed Avatar browser runs across the initial, still and final motion studies have empty error lists and complete native-memory-zero retirement with no leaked handles.
- Final motion has 363 original PNGs, 33 actual posed-state samples and two 240-frame candidate traces. At eleven matched moments per arm, recorded head, gaze state, hair, camera and clock agree with the original. Available non-eyeLook body weights also agree; the helper guards other mesh weights during application.
- Both candidates return to the exact original globe geometry and eyeLook weights at the actual idle sample (step 205, about 3.417 seconds) and at four seconds. The original action itself was not changed.
- The failed v3 run is preserved. Its harness incorrectly assumed step 204 had already reached idle; accumulated time was 3.399999999999993 seconds, leaving a negligible blend residue. V4 checks the actual phase and adds step 205. This required a probe correction, not a runtime fix.
- A dark-pupil connected-component threshold sweep is saved as exploratory evidence. The front-left component fragments at the strict saturation threshold, so its centroids are not landmark ground truth and do not establish an optics/UV defect.
- Gallery checks cover all three media streams, six still comparisons/twelve images, synchronized playback/pause, exact-moment seek/PNG links and a narrow layout. Continuous human motion perception, other identities/distances, interruption/speech integration and performance remain unqualified.

## Initial model for a runtime controller

A CPU-only follow-on probe fits each eye at neutral and four unit eyeLook morphs, then predicts intermediate axes/centres by an affine blend and axis normalization. The predeclared target was less than 0.25 degrees axis error and 0.2 mm centre error against the 33 recorded posed states. All 66 eye comparisons pass, with maxima 0.07635 degrees and 0.03797 mm. This uses the same physical fitting mathematics, verifies the single-head skinning assumption, and stubs texture decoding. It is a geometry-model result on this g050 sample set, not a browser, range, other-identity or performance qualification. The model has no runtime owner or bounded point solver yet. Sources and results are archived under `aim-model/`.

## Next choices

1. **Proceed with a narrow calibration path owned by the existing gaze controller.** Retain full correction, easing and natural offsets, using the measured eye model as a starting point. Replace the diagnostic post-commit writer and prove cancellation, supersession, reset/rebind, eye/head limits and exact native release. The prediction is that the observed directness survives with truthful final eye state and one clear owner. This is the selected next development step; the frozen numerical solver remains a reference, not a runtime design.
2. **Alternatively, resolve distance dependence first.** Compare the same action at one nearer and one farther camera position, with original/full/half and matched timing. The prediction is that the point-aware full correction retains directness as convergence changes; half might feel softer without maintaining the same geometric aim. This is a bounded art/calibration comparison before wider claims, not grounds to choose arbitrary offsets.

Do not alter eye optics solely because a bind corneal axis differs from rig +Z. Do not promote a post-commit eye writer into production or describe this study as calibrated human-level contact. The AAA character and nuanced-expression goals remain in [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md).

## Evidence and replay

The local archive is `captures/eye-contact-study-2026-09-13/`; tracked index and manifest are [the evidence ledger](evidence/eye-contact-study-2026-09-13.json) and [file manifest](evidence/eye-contact-study-2026-09-13.manifest.json). It includes initial/still/motion reports, the rejected v3 run, original PNGs, software video metadata, gallery checks, helper sources, and separate immutable still and motion critic reports.

Probe sources are preserved as executed, including their original absolute repository/scratch paths and no-overwrite guards. Replay in a fresh scratch location: update `OWN`/`HELP` and corresponding browser-module paths together, retain the recorded source revision/assets, and run only one Avatar GPU job at a time. The first-run and v2 source hashes bind revision `085d27c`; the production files remain unchanged during this study. Archived capture-support modules preserve the external helper inputs. Do not overwrite the evidence directories to rerun a probe.
