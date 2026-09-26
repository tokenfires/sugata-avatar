# Geometry-derived resting arms: bounded authoring proposal

2026-09-26. CPU source/algebra preparation only. No candidate angle, margin or cap is selected here; no production/asset changes or native candidate run. The accepted preconstruction route now has its own native control; this proposal concerns the next isolated family.

## Three measurable parameters

Use `alphaLeft` and `alphaRight` (positive outward rig-frontal rest swing in radians) and one `cap` (nonnegative native inward allowance, radians, identical on both sides). Allow measured rest-placement asymmetry; keep a common cap because `Gesture.armSpreadOf` reads `appliedDegrees.armSpreadLeft` as representative. A different right cap would break that symmetry premise even though Posture supports separate budgets.

For the first diagnostic, leave clavicles, elbow carrying angle/flexion, wrist and all fingers as authored. Carry their complete skin envelope by changing only the upper-arm rest. No wrist-point-only solve: distal selection is the existing 3909 left / 3907 right full triangles, including boundary triangles and every positive lower-arm/hand/finger influence. Preserve the documented tiny cross-side weight rather than thresholding it away. Both body and worn skin must be recomputed from their actual weights.

The geometry worker owns source-bound CPU reconstruction, exact zero parity and feasibility measurement. A useful small result is a **rest-placement / inward-allowance frontier**, not a single angle chosen by appearance:

1. Bind exact body, outfit, family, current initial native geometry, transform convention and source hashes. At zero change require exact reported geometry (or stop and explain any arithmetic representation difference before using nonzero estimates).
2. Verify sign using both signed perturbations of each shoulder: positive `alpha` must increase that side's outward elbow/wrist location and the limiting distal region's outward position. Also record any distal vertices moving inward; a mean/landmark sign alone cannot certify the envelope.
3. For a declared margin `m`, find the first *measured* rest displacement on each side that gives the scoped body separation certificate at zero inward rotation. Do not use zero crossings as a substitute for positive separation. Derive margins and limiting face/pose witnesses from the full envelope. Declare the chosen search domain/resolution and preserve failed bounds; do not infer monotonicity of a changing set of projected triangle pairs or bisect across untested islands.
4. Evaluate inward rotation over the same geometry and choose only a common allowance no greater than the measured safe allowance of **either** side, and no greater than either new native humerus budget. A sampled endpoint pass does not establish the interior. A bounded diagnostic may use explicit discrete inward samples with that limit stated; continuous safety would require a separate angular interval bound.
5. Freeze **one** family and common cap for a fresh native trace. New native rest frames, gesture yield, Sway mass/stance responses and idle caches may change the result; CPU transformed accepted snapshots are feasibility evidence, not native prediction or fit acceptance. Keep initial, happy/angry peak, return and final geometry/view witnesses.

`m=0` remains only a separation diagnostic. No positive production margin has been approved. Full-clothing corridor failure is retained independently: the proximal forearm can legitimately sit inside its own sleeve, so an exterior corridor is stronger than collision freedom and cannot currently certify that clothing scope. Never turn its negative gap into a penetration claim or silently remove sleeves. Actual transverse triangle intersections remain concrete defects; zero intersections still do not exclude containment.

## Exact authoring convention

The current normalized rig is +X character-left, +Y up, +Z forward. `RestPose.compile` premultiplies steps; `Skeleton.update` forms `W(b)=W(parent)*q(b)` and then maps through the actual bind frames. For side `s`, let `W0s` be the accepted relaxed accumulated normalized upper-arm quaternion and `Ds=axisAngle([0,0,side],alpha_s)`, with `side=+1` left / `-1` right. Define:

```
Es = inverse(W0s) * Ds * W0s
qPrime(pose,s) = q(pose,s) * Es
```

Prepend the axis-angle for `Es` to the original selected upper-arm specification in **all three** JSON files. A prepended step is required because the later original steps premultiply it. At relaxed, the accumulated upper-arm orientation becomes exactly the desired `Ds*W0s` (subject to recorded floating arithmetic). Source-derived prepended axes, used with a positive angle on both sides:

| Side | Axis in the prepended spec |
| --- | --- |
| Left | `[0.08402732606424637, 0.17751329146641903, 0.9805245738008054]` |
| Right | `[0.1094513069402043, -0.18714434443926153, -0.9762158602243053]` |

The exact preservation claim is deliberately specific:

- Each selected upper arm's local and cumulative `qPose * inverse(qRelaxed)` relation is preserved. Common right multiplication cancels from that relation.
- All nonselected JSON values, metadata, local joint rotations and hips offsets stay exact. Existing per-pose elbow, wrist and finger relationships remain authored local rotations.
- Current Sway-chain authored references/deltas remain exact: its chain excludes arms/hands. Arm entries in weight-left/right are not a newly active Sway output.
- **Every distal absolute cumulative stance delta is not preserved.** Weight-right has different elbow specs. Moving its upstream frame changes how those differences act in rig space. Preserving that stronger invariant would require extra joint edits. The full distal geometry must therefore be measured.
- Even with unchanged Sway-chain data, native mass/stance response measurements can change when hands move. Do not copy accepted caches or force numerical parity on dependent native outputs.

`inspect-family.mjs` reads source bytes bound to sealed primary-v4, compiles real `RestPose` objects, derives axes from the actual body hierarchy, and writes `family-algebra-v1.json`. Its five checks cover source binding, exact zero data/compiled route, nonselected metadata/joints, the precise relative invariant, and a wrong-order negative control. Synthetic ±1/±7 degree algebra calibrations are not candidate angles. Maximum observed invariant component error is 4.45e-16; the wrong appended order differs by 0.008156875 at the 7-degree fixture. No skinning or geometric sign/clearance claim comes from that algebra test. The script refuses to overwrite its receipt.

## Honest native allowance and telemetry

Native `PostureLayer.bindArmBudget` computes `N_s=max(0,atan2(side*(elbow.x-shoulder.x),shoulder.y-elbow.y)-lastApplied_s)`. Moving rest outward generally enlarges `N_s`; leaving it alone can consume the gained clearance again. In the fresh construction hook only, run the native calculation, record its actual result and require `0 <= cap <= min(N_left,N_right)`, then assign **the same exact `cap`** to both budgets. Do not silently clamp an invalid requested cap and do not filter returned rotations.

Native update then computes `limited_s=max(rawSpread,-cap)` for inward prescriptions, writes its own output and updates both `appliedArmRadians` and `appliedDegrees`. The native positive-spread path is unchanged. Gesture reads this actual shared value and computes `yield=1-min(1,abs(spreadDegrees)/10)*0.65` for negative spread. Thus a cap below 10 degrees also restores some gesture amplitude; cap zero yields 1 rather than attribution B's deliberately retained 0.35 at angry peaks. This dependency is part of the candidate and must appear truthfully in telemetry and rendered review.

Check per sampled state: budget values remain exact, actual spread agrees with the native clamp, left/right applied spread agree, non-arm raw outputs are not overwritten, `raw===effective` for the instrumentation, and gesture's recorded yield agrees with the current native posture when a gesture is active. Preserve schedules/RNG where source says independent; record changed pose-dependent owner outputs and native bind measurements instead of enforcing false global equality. Reset/rebind are prohibited in this disposable first trace; broader lifecycle support remains separate.

## Next bounded handoff

After the geometry worker and root choose one measured family/cap, author fixed JSON under `pose-proposal/family/` and a fresh `CandidatePoseControl.mjs` with the accepted wrapper's option shape. Export fixed `CANDIDATE_POSE_HASHES` and `CANDIDATE_BUDGET`; accept no runtime angles or alternate families. Reuse the already proved construction, native channel preparation, observer and wrapper-owned retirement contracts. Preserve the accepted wrapper/controller/runtime bytes. The native candidate still needs source/loader binding, all109 geometry /721 owner samples, explicit differences from A, actual drawn masks/materials, bilateral/full-body images and independent review. It does not qualify a correction by construction alone.
