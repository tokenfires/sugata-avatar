# Candidate v1 stop: independent morph-invariant review

September 26, 2026. Signed: `/root/critic`.

**The exact final-morph equality requirement was too broad for a changed-rest experiment. Permit a source-defined, owner-specific dependency set; do not introduce a numerical tolerance or change the candidate.** This is an instrument correction. It does not accept the visual or geometric result of the candidate, and the failed v1 remains failed evidence.

I independently compared the failed report's final guard-retirement owner records at stack frame 4 against accepted A's semantic step 2, also frame 4. Failed report SHA256: `a4e1a615d375acebe07babc80f9d52c7f3cad83953b7176168e0c8f466869658`. Accepted state archive SHA256: `0dc544679d01b3fe6973adf5740b576722659750fd58ec882040e0eadc3facc7`; decoded: `4a87e6d19c4823649b28d2818bda9e5e532c69604ad24cae87f77509692c47f7`.

Only four gaze-owned morph values and five facialIdle-owned values differ in that observation. The largest difference is `2.6009606660256333e-7` in the gaze-owned eyeLookUp channels. Every owner's name/order/weight/enabled/status/random state remains exact; every other morph value is exact; all candidate returned contributions remain raw/effective equal. Native errors and disposal leaks are empty and every recorded disposal-memory counter is zero. Other changed owner bone outputs remain evidence for the separate native-owner audit, not morph exceptions.

The allowed morph sets follow the actual source, not the magnitude or the nine values that happened to differ at step 2:

| Owner | Values that may depend on the changed pose |
| --- | --- |
| `gaze` | `eyeLook{In,Out,Up,Down}{Left,Right}`: eight channels |
| `facialIdle` | `eye{Blink,Squint,Wide}{Left,Right}`, `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`: nine channels |

Gaze reads the last committed head rotation relative to its rig/rest frame in `readHeadRotation`, subtracts its own prior head motion, and applies the vestibulo-ocular reflex before converting eye angles to the eight eyeLook morphs. Sway's measured rest/stance response reads whole-body mass, including moved arms and hands; unchanged source pose data for its driven chain does not imply identical calibrated motion. FacialIdle reads the resulting current shared eye pitch: its lid-follow calculation writes six eye channels, and the upgaze-assist term writes the three raised-brow channels. Its brow-down, cheek, nose, mouth and jaw channels have no such source dependency.

The exemption must be attached to the named **owner and channel together**. Blink's own contribution and Expression's contribution remain exact even where their final channels share names with permitted facialIdle values. Preserve exact owner metadata, PRNG, commands, schedules, camera, masks and topology. Preserve all nonexempt owner morph values and all final morph-vector entries outside the 17-channel union. Retain every permitted difference for postcapture attribution and visual review. Gaze/FacialIdle rotations and offsets are not part of this exception. Existing intended bone-output differences are a separate declared scope.

The v2 controller should retain each just-read semantic state before comparisons can throw and save a hash-bound partial state archive on failure. Store the same failing-step physical/render state without advancing or drawing another frame. This corrects the evidence loss that forced this review to rely on retirement owner records; a partial archive must remain explicitly partial and never satisfy the 721-state completion gate. Any extra failure geometry should be labeled diagnostic and excluded from the planned 109 samples.

This review used source and retained native data only. It did not run a new browser, change a pose/cap, relax a numeric threshold or infer that the failed capture demonstrates acceptable fit.

## Reviewed implementation

The actual v2 rule in `candidate-morph-policy.mjs` (`ebb59a1e341f3abe3131b659f356bb45a56f3a525c83405c130e660c76c25abb`) implements that exact owner/channel scope. Its test source is `1f595ef155cd32620afd2f4e7c3dc07c4b48a36516fcbe5faa7a90fed8e7778c`. I independently ran all ten focused cases successfully, including rejection of a Blink-owned change on a permitted final channel, a speech change, a nonpermitted final value, NaN, changed declarations/owner and a new gaze bone rotation. The controller binds the original source GLB target names to the actual native body dictionary, records all differences, and retains each semantic read before comparison. Runtime's only added operation is reading that dictionary. The fixed wrapper remains `5cad56008a5f41ac40b7ce833fcb8d8c7f2cba60575520a706641a67a5cd9388`.

The separate stopped-step diagnosis (`9ba0cf99d2cb42053a5b11e51136c3c009cdade83f48fae610e212b528c5a75a`) agrees with the independent owner comparison and evaluates the lid/up-brow formula. It accurately distinguishes a reconstructed candidate fold from an independently retained final vector, and a source-supported Sway mass-calibration dependency from numerically observed internal calibration caches. These limits do not justify continuing to require identical final gaze morphs from differently posed native rigs.

Source verdict: admit the revised source-frozen experiment and preflight with the unchanged pose/cap. A diagnostic-label refinement is needed for failures before the next semantic read: attempted step and last retained semantic step may differ, so a later physical read must not automatically be labeled as the earlier semantic frame. Comparison failures have no intervening native step; that narrower same-state claim is supported. No magnitude tolerance or additional morph owner has been introduced.

The controller subsequently closed that labeling issue: it records `attemptedLoopStep` before step/command operations, stores `lastRetainedSemanticStep` separately, and marks correspondence unverified when they differ. The original failed run and its source remain preserved.
