# Eye focus through native motion ownership

The point-aim candidate now runs through Gaze's declared contribution before the normal single motion commit. The existing eyelid and brow following receive the corrected authored eye direction. **This remains a scratch prototype; the live Portrait action and production sources are unchanged.**

[Open the local comparison](http://127.0.0.1:5197/@fs/Users/robault/GitHub/sugata-avatar/captures/eye-aim-owner-2026-09-13/gallery/review.html). The original and candidate have twelve matched moments over four seconds. Earlier full/half diagnostic motion is in [the preceding study](EYE-CONTACT-STUDY-2026-09-13.md).

## What this step establishes

The bounded solver uses measured neutral and four unit eyeLook responses per eye. Against 162 fresh morphed-geometry grid cases, its maximum axis error is 0.16376 degrees and centre error is 0.03938 mm, below the predeclared 0.25-degree/0.2-mm model gates. It recovers 648 reachable model-generated targets at four distances. Those synthetic targets test the optimizer, not visual contact. Ninety-six broader directions are all outside the selected tolerance and correctly report limited; their results are no worse than an independently sampled 441-control grid. This is a numerical comparator, not a global optimality proof.

Other CPU controls cover twenty positive uniform transforms, eleven malformed/unsupported inputs, degenerate responses, tiny positive bounds and ten direction-specific comfort cases. Physical comparison deforms actual g050 vertices but reuses production measureEye fitting mathematics; texture decode is stubbed and these are not renderer tests. Relative morph and single-head skinning assumptions are explicitly checked.

The final browser prototype preserves Gaze's old nominal horizontal reach of 12.1295 degrees. The corresponding In cap is 0.821225457; Out, Up and Down remain at most 0.85. A constrained miss reports limited. This is a software movement policy, not a measured physiological comfort threshold.

Gaze receives a read-only prediction of this frame's accumulated head pose and writes its own eight channels. Every corrected frame's predicted head and rig matrices match the eventual committed matrices exactly. The browser checks the committed eye weights and exclusive Gaze writer. No post-commit mesh correction is applied. An enabled later ancestor writer is rejected by the prototype because a partial accumulator would otherwise be stale; the critic proves that failure with actual MotionStack code.

## Appearance and downstream behavior

At 1.5 seconds, the fitted axes' camera errors change from 6.311/6.209 degrees to 0.4824/0.4829 degrees. The roughly half-degree existing microsaccade is retained. Eye error is a geometry proxy, not a human eye-contact score.

The corrected mean authored eye pitch reaches FacialIdle before it evaluates lid and brow following. At this moment eyeWide changes from 0.0300/0.0306 to 0.0868/0.0884. That is intentional propagation through existing owners. It is a different visual candidate from the previous study that froze all non-eyeLook weights. The primary reviewer inspected final candidate onset, hold and release images and saw no obvious new startled-eye failure; that limited review does not establish warmth or continuous motion quality. Independent observations and two alternatives per actionable issue are in the archived critic reports.

The final two Avatar runs each cover 240 simulation steps and twelve PNG/state samples. All twelve paired samples preserve recorded native gaze scheduling, action, head, hair, camera and clock. At the initial sample and idle steps 205 and 240, the recorded eye morphs, available body-eye morphs and posed globe/cornea clouds return exactly to the original. Both runs finish with empty error lists, all native memory counters zero and no leaked handles. The corrected contribution trace has 189 samples. Uncorrected frames are not reported as solver evaluations.

The gallery checks all twelve image pairs and PNG/state links, previous/next endpoints and a 390-pixel layout. It presents sampled moments, not a continuous movie. Rendered PNGs are not generally byte-identical across separate runs, even where physical controls agree.

## Corrections retained in the evidence

Browser v1 stopped on negative zero in a live camera matrix compared with JSON-normalized positive zero. V2 canonicalizes the physical record through JSON before comparing saved records, without adding a numerical tolerance. V2 passed, but its uniform 0.85 solver bounds permitted a 0.425-degree nominal In-policy excess. Only three early unblended solves used that larger bound, with very small action blend weights. This is a policy mismatch, not evidence of physical discomfort.

Browser v3 rejected the newly derived Out cap because floating-point arithmetic produced 0.8500000000000001. V4 caps that policy-derived ratio at 0.85; the solver input validator is unchanged. The two stopped attempts and all intermediate sources remain archived. Their completed original arms and recorded candidate retirements are not counted as successful final candidate qualifications.

## Next implementation boundary

The selected design keeps the current direction API unchanged and adds an optional copied point target to the existing Gaze hold. MotionStack should own a narrow read-only pose query and explicit supported-order guard. Gaze must publish final per-eye authored output and a documented scalar mean before facial consumers. Validate exclusive supported eye ownership and Gaze weight, rather than defeating a caller's fade.

Bind calibration to the current eye geometry and rigid skinning model. Validate a new request before superseding a valid hold. Prove ordinary release, cancellation, repeat/supersession, speech takeover, reset, rebind, figure changes and disposal. Unsupported transforms/order/geometry need an honest fallback to existing direction behavior. The scratch method hooks, one sampled invocation and static g050 profile are not that production API. A separate warm Node microbenchmark records 5,670 paired solves with batch medians 0.023–0.025 ms; all samples are retained. It uses prebuilt matrices and zero micro offset, excluding pose prediction, profile creation, browser and GPU work. It is not a frame-time or allocation acceptance result. Runtime allocation/cost, continuous visual behavior, other distances/identities and wider expressive warmth remain open.

Alternative: introduce a broader explicit bone-pose/ocular-output phase to support arbitrary later bone writers. The critic recommends the narrower guarded query for the current Avatar because it preserves existing sequencing with less framework change. Per-eye lid following is another future alternative to the documented scalar mean. Keep the original AAA appearance and humanlike embodiment ambition in PRODUCT-ROADMAP.md.

## Evidence

The local archive is `captures/eye-aim-owner-2026-09-13/`. The [ledger](evidence/eye-aim-owner-2026-09-13.json) and [manifest](evidence/eye-aim-owner-2026-09-13.manifest.json) bind all copied sources, reports, images and independent critic evidence. Runtime hashes are unchanged from source revision 0679770. Probe files retain their executed absolute scratch paths and no-overwrite guards; replay only into a fresh location, updating related paths together. Serialize Avatar GPU runs.
