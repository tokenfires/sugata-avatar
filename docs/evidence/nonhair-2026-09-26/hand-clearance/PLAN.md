# Hand clearance: retained native witness and next bounded slice

2026-09-26, CPU/read-only diagnosis. **The crossing is reproduced from retained geometry; it is not only a historical critique.** No new GPU run, pose, solver, garment export, production edit or hair work occurred. Preserve the broader goal of convincing, expressive, clothed full-body embodiment; this is one independent defect within it.

## Proved and current

The directly inspected [accepted full-body angry image](../../../../captures/collar-stress-2026-09-22/gpu-v1/bob02-previous/body-637.png) shows hands disappearing into the trousers. Its SHA256 matches that capture's report. Its accompanying posed body, bra, briefs, casual outfit and shoes have **exactly equal position arrays and full indices** to the new September 26 accepted bob02/bra snapshot at step 637. Thus the older, useful full-body view is bound to actual retained geometry rather than treated as an illustration of a guessed current pose.

The new inputs are `captures/collar-replacement-2026-09-26/capture-v2/bob02-expressive-foundation_bra-accepted-installed/meshes-{0,637,720}.json.gz`. Each compressed/decoded hash was checked against the completed case's report. That larger capture is explicitly partial (8/16 cases); these three complete-case inputs do not turn it into a full qualification. Installed g050 body and accepted casual outfit hashes, source full topology, and current PostureLayer/Gesture/BodyIdle/HandIdle hashes match the frozen capture.

The [numerical receipt](retained-witness.json) retains source/input hashes, exact vertex/face identities and coordinates, intersection segments, native telemetry, drawn-mask membership and visual binding. Hand regions use source skin weights: every vertex of each selected triangle has at least .5 summed weight on that side's hand/finger joints. There are 3,166 selected triangles per side, all currently drawn. The accepted outfit has two components after source-position seam welding at 1e-7m: top 2,524 triangles, trousers **1,712 triangles / 950 raw vertices**, source faces 2524–4235. Identification uses this complete lower component, not a posed screen rectangle. The separate lower-body test selects triangles whose three vertices each have at least .5 pelvis/thigh weight.

| Retained native step | Hand–trouser crossing pairs, left/right | Hand–selected lower-body pairs, left/right |
| --- | ---: | ---: |
| 0, initial geometry | 86 / 0 | 84 / 0 |
| 637, second angry stroke | 125 / 205 | 156 / 238 |
| 720, final angry geometry | 112 / 153 | 148 / 129 |

These are floating-point triangle-pair counts, **not depth, visible area or severity**. The existing `intersectTriangles` predicate in `tools/figure-pipeline/hair_surface.mjs` was used only as a reusable geometry function, with no hair data. Saved witnesses are transverse segments at 1e-10m and remain intersections at 1e-9/1e-11m. For example step 637 crosses drawn left-hand body face 16436 against drawn trouser face 3922, and drawn right-hand face 3142 against drawn trouser face 2622. Underlying lower-body witnesses are masked by clothing, which does not make physical overlap acceptable; they are a distinct anatomical check, not a claim that masked skin is visible.

At 637 the actual returned gesture is bilateral, activation 1, yield .35, shoulder 5.5125° and elbow 5.788125°. Posture asks for -40.338° arm spread and caps it at -10.180° left / -11.945° right. Step 720 follows the scheduled angry gesture's end; the next fearful command has been issued but not simulated, so its telemetry must not be mislabeled as a fearful geometry witness. Step 0 is the actual initialized/zero-delta-converged native pose, not the raw GLB bind pose or a pure RestPose-only ablation. Its left crossing means a gesture-only remedy cannot be assumed sufficient.

## Mechanism and remaining uncertainty

- `packages/core/src/figure/poses/relaxed-standing.json:50–63` supplies asymmetric shoulder placement and inward forearm carrying angles (7° left / 6° right). `RestPose.js` applies this before stack binding; Sway blends standing/weight-left/weight-right poses later. The carrying-angle commentary intentionally places the wrist over the hip region, but a wrist location is not a full finger-envelope clearance check.
- `packages/core/src/affect/PostureLayer.js:664–717` measures humerus angle as an adduction budget; `:908–924` caps inward rotation at vertical. This guards the upper arm against the ribcage. It does not query the wrist, fingers, hip, thigh or clothed surface.
- `packages/core/src/motion/BodyIdle.js` (order 360) and `HandIdle.js` (370) add arm/wrist and finger state. `Gesture.js:794–871` (400) adds the native shoulder/elbow stroke with posture yield and .75 sagittal share. `Avatar.js:1533–1600` preserves their separate ownership. Bone deltas compose; no measured whole-hand clearance guard was found in these paths.

The retained crossings prove the outcome, **not which single writer causes each contact**. There is no new isolated rest/posture/idle/gesture ablation, global body containment/depth audit, interval proof, other-identity qualification or current full-body video. Fingers outside the selected >=.5 skin-weight region and intermediate times could add contacts; clear selected triangles would not certify the rest. Exact geometry correspondence makes the old image useful, but does not certify the current renderer or all views.

## Smallest useful next experiment

First isolate **complete hanging-arm/hand placement and its inward posture limit**, retaining the accepted trousers and body. Run one bounded native attribution comparison on g050 at initial pose, angry onset, both stroke peaks, return and final hold: unchanged control; posture arm-adduction contribution suppressed only; and gesture arm contribution suppressed only. Preserve/restatement-check the actual native deltas and all other owners, rather than removing/rebinding layers mid-run. This distinguishes an inherited resting contact, a posture-induced contact and a gesture contribution before authoring a fix. It is diagnostic, not an acceptable shipped pose.

Two concrete subsequent axes, to choose after that evidence:

1. **Preferred narrow axis:** a geometry-qualified hanging-chain placement plus an existing PostureLayer adduction limit that reserves the complete hand envelope. Correct the proven neutral contact and prevent affect from reclaiming that clearance. A neutral shoulder offset alone may be cancelled by the current vertical-humerus budget, so it must not be declared a fix from one idle still. Preserve asymmetry, elbow flexion, finger motion, trunk approach and the timed gesture.
2. A later composed-pose arm adjustment using the existing `motion/IKSolver.js`, accounting for the full hand and clothed hip after idle/posture/gesture. This can address combined-state contacts more generally, but adds ownership, temporal continuity and intent-preservation work; it is not the first change justified by these three snapshots.

Before promotion require actual full hand/forearm triangle clearance against full relevant body and worn garment surfaces, positive margins with stated tolerances, dense onset/stroke/retraction samples, and controls that reject deliberately reintroduced crossings. Verify seed/time/dt and retained unrelated morph/bone owners, reset/bind/disable/remove behavior, left/right and weight-shift continuity. Then inspect ordinary full-body and predeclared bilateral close views through motion, keeping the same outfit/lighting/hair; judge relaxed silhouette, expressive gesture, finger integrity and absence of popping. Expand to representative identities/outfits only after the bounded g050 result passes. Do not shrink trousers, hide hands/body, retune global emotion amplitude, reopen collar support, or claim whole-avatar/AAA completion from this slice.

**Stop boundary:** plan and retained witness only. No candidate or solver has been implemented.

Follow-up: [the read-only replay](replay-retained-witness.mjs) reproduces the unchanged receipt byte-for-byte; [audit-replay.json](audit-replay.json) records the pass. [ATTRIBUTION-DESIGN.md](ATTRIBUTION-DESIGN.md) specifies the proposed three-arm native comparison and its disposable-capture lifecycle boundary. This remains design only, with no new GPU evidence.
