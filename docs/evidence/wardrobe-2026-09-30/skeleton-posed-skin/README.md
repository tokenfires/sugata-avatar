# Posed skin: four-influence arithmetic passes, full-native gate fails

The [declared study](PLAN.md) preserves a full native reference and a separate native control using the actual accepted export's four influences. **Overall result: FAILED** under the unchanged strict below 0.342 mm full-native bar. Matched four-influence arithmetic passes. Neither outcome changes the accepted figure or qualifies runtime body updates.

## What was observed

The native oracle created three g050 bodies with the same coupled detail targets at 0, 0.25 and 1, applying identity, elbow and coupled poses to each. Native full weights were recorded before replacing only original body vertices 0–13379 with the accepted GLB's exact loader-normalized four influences. All 5,778 helper weight lists remained intact. Actual rest and posed matrices agree between weight arms. The setup admits standard linear armature deformation, identity object transforms, full scale inheritance and no pose constraints. All 18 observations completed.

The comparator uses actual exported body positions plus SDK deltas, independently constructed rest/pose matrices and inverse binds derived from the new rest. Each row includes 14,517 exported vertices. Values below are maximum distances in millimetres.

| Body target weight | Pose | Proposed → native four | Proposed → native full | Native four → full |
| ---: | --- | ---: | ---: | ---: |
| 0 | identity | 0.000477782 | 0.000477782 | 0.000119267 |
| 0 | elbow | 0.000477782 | 0.000477782 | 0.000126441 |
| 0 | coupled | 0.000594698 | 1.589239584 | 1.589217064 |
| 0.25 | identity | 0.000477782 | 0.000477782 | 0.000119326 |
| 0.25 | elbow | 0.000477782 | 0.000477782 | 0.000126441 |
| 0.25 | coupled | 0.000516308 | 1.590665829 | 1.590643282 |
| 1 | identity | 0.000478827 | 0.000478827 | 0.000119209 |
| 1 | elbow | 0.000548516 | 0.000548516 | 0.000126441 |
| 1 | coupled | 0.000587087 | 1.592797756 | 1.592814541 |

The identity-pose and neutral-body controls are required. The neutral coupled pose already fails against native-full, so shaped coupled full-reference comparisons cannot be interpreted as clean identity/refit errors. All matched controls pass. The linear check using complete native weight lists reaches at most 0.000423459 mm; constructed pose basis witnesses reach 0.008110915 mm under the unchanged 0.1 mm bar.

Two negative controls fail against their passing matched parents: stale neutral inverse binds produce 106.885736742 mm; omitted elbow propagation produces 247.117799112 mm. These do not erase the full-reference failure.

## Concrete discrepancy

Exported vertex 4561 maps to native 4169 at the waist. Its full list includes pelvis 0.262452483, spine_01 0.506001234, spine_02 0.162632525, spine_03 0.039707944 and thigh_r 0.029205842. The accepted export drops thigh_r and renormalizes the remaining four. In the neutral coupled pose, actual native arms differ **1.589217064 mm**; the proposed four-weight result differs from the native-four control by only 0.000044362 mm at that vertex. All bone matrices remain identical between arms. This is evidence of a representation discrepancy, not a skeleton-propagation defect.

49 exported vertices exceed 0.342 mm between native arms in the neutral coupled pose. The full source has 597 body vertices with five influences and 11 with six. Helpers may have seven, and their complete lists are preserved in native arithmetic.

## Actual visual inspection

The [separate visual plan](VISUAL-PLAN.md) renders actual native full/four positions using the accepted figure's 26,756 body triangles. Shared cameras/lights, recomputed normals and a plain neutral material were used. Positions are unamplified. The marked fifth image assigns orange to vertices whose arm distance is at least 0.342 mm; interpolated triangle colour is not a per-pixel threshold test.

- [Full native context](../../../../captures/skeleton-posed-visual-2026-09-30-v1/context-full.png)
- [Four-influence context](../../../../captures/skeleton-posed-visual-2026-09-30-v1/context-four.png)
- [Full native waist](../../../../captures/skeleton-posed-visual-2026-09-30-v1/waist-full.png)
- [Four-influence waist](../../../../captures/skeleton-posed-visual-2026-09-30-v1/waist-four.png)
- [Marked location diagnostic](../../../../captures/skeleton-posed-visual-2026-09-30-v1/waist-four-marked.png)

Root inspected all five actual PNG originals. At full-body scale there is no obvious gross defect. The waist close-ups show subtle local shading/surface differences; the marked view makes the affected region easy to locate. These are plain body-geometry diagnostics, not complete avatar candidates. No claim that this numerical failure is a conspicuous product appearance defect follows.

## Independent review and decision log

The critic independently recomputed 794,871 vertex residuals and 4,770 matrix witnesses using a separate matrix inverse/axis-angle implementation; maximum residual difference was1.36e-12 mm. Both corruption controls, the full-reference failure and matched arithmetic pass were reproduced. Source/decoded-artifact bindings were checked. Read [the critique](CRITIQUE.md) for the visual review and limits.

Before capture, the critic caught a source instrumentation error: `base.001` is the mesh name; the actual body node is `Human`. Root chose unique referenced-mesh selection with a Human assertion. The alternative was the pinned bridge bodyId with identity assertions. This correction preceded the first launch; no rejected capture was overwritten.

Next two directions:

1. **Chosen:** isolate full native influences mapped onto the unchanged exported body, with the same poses, constructed matrices and new binds. This directly addresses the lost influence and can retain the native full-reference gate; runtime encoding, GPU support and performance remain separate work.
2. **Deferred alternative:** retain four slots and predeclare constrained reweighting across broader poses. This preserves the existing format but risks fitting the sampled poses and requires additional qualification.

Do not tweak skeleton translations or relax the 0.342 mm bar to hide the weight discrepancy. The original failed packet remains frozen. No runtime integration, all-body range, moving appearance, normal/shader or wardrobe/foundation claim follows.

## Commands, ownership and recovery

```sh
tmp/wardrobe-sep30/blender-isolated.sh --background --python-exit-code 1 --python tools/critic/skeleton-native-pose-oracle.py > tmp/skeleton-pose-sep30/native-oracle-v1.log 2>&1
node tools/critic/compare-skeleton-posed.mjs
node tools/critic/capture-posed-skin-witness.mjs
```

- Native PID 43700 / session 85575 ran 17:56:06.736570–17:56:17.967909 UTC, exit 0; report `226a55bc568bec712c847b5a12b91b6c7a019170d91dd26c2d56e60c140f2be1`.
- CPU PID 52932 / session 12332 ran 18:01:48.276–18:01:51.929 UTC, exit 0; report `ea6f19c3cef8e60e5d9bd8f9936cf0c83eeeb0d363bd08d7f7c635897a0a83ef`.
- Visual PID 73048 / session 70060 ran 18:14:12.861–18:14:16.220 UTC, exit 0; report `00e66b52d462d9be2f97995a335f211a474872db064d01ef952200c04772e79c`. Actual renderer: ANGLE Metal Apple M5 Max, Three 185; five originals, no page/HTTP errors.

Raw roots are `captures/skeleton-native-pose-2026-09-30-v1`, `captures/skeleton-posed-comparison-2026-09-30-v1`, and `captures/skeleton-posed-visual-2026-09-30-v1`. Original sources/data remain bound by hashes. New output roots refuse overwrite. Root verified the exact owned Blender disk14 image/device and absent native job before detaching at 17:56:58.648155 UTC; receipt `tmp/skeleton-pose-sep30/runtime-detach.json` is also archived. Browser and temporary server closed after capture. No job remains. Main review PID 2323 remains available; no accepted asset was changed.
