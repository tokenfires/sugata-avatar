# Core hair surface primitive regression

Run the portable CPU oracle checks, then the optional actual WebGPU checks:

```sh
node packages/core/src/motion/HairSurface.primitives.selftest.mjs
node packages/core/src/motion/HairSurface.primitives.selftest.mjs --gpu --report=/tmp/hair-surface-primitives.json
```

The test imports the production `HairSurface`, `HairSurfaceQuery` and `HairSurfaceContact` modules. Its tracked fixture contains 20 original segment/triangle cases and 15 near-parallel counterexamples, retaining source capture hashes where applicable. No ignored captures directory is required at runtime. The independent CPU oracle uses dominant-axis barycentrics and cross-product line solving; 300 deterministic cases also compare it with Three's point/triangle distance under independent convex minimization.

The WebGPU gate checks finite distance, sign, segment parameter, triangle barycentrics and reconstructed witnesses. Distance and reconstruction tolerance is **0.001 mm** at the fixture's metre scale. Cases with a unique minimum also require the actual closest points to agree; tied minima may choose different parameters. A generated nine-triangle BVH adds 144 checks over three interpolated poses and four valid, distant or out-of-range seeds. Seeds must remain upper bounds, never replace the complete search.

Eight contact-normal cases distinguish coplanar Float32 residue from a separated distance gradient. The separated open-edge case compares the plane with the actual query's gradient; its approximately `0.00596` ideal-axis deviation remains a diagnostic, not a reason to replace that valid direction with the authored normal. Twelve bounds cases cover static and swept union boxes. A separate check seeds stale planes and telemetry, then verifies that a disjoint span clears them while retaining triangle seed IDs.

Two isolated browser controls restore the historical segment denominator or contact-normal threshold. They must fail the saved witnesses without browser errors. The source files stay unchanged, their hashes are checked across the run, and all test storage/compute resources must return to the same renderer's starting counts.

The first core run passed **12 groups**: four CPU groups and eight WebGPU groups. Maximum primitive distance error was `0.00006638 mm`; maximum generated BVH distance error was `0.00010726 mm`, with zero seeded distance difference. The historical near-parallel implementation failed 13 of 15 cases; its first distance error was `0.00725363 mm`, with `t=0.49264705` instead of `0.5`. The old contact threshold produced a lateral `(1,0,0)` plane where the coplanar case requires `(0,0,1)`.

The compact result and exact source hashes are in [the evidence ledger](evidence/hair-surface-primitives-2026-09-09.json). The full report, source snapshots and transform witnesses are preserved under ignored `captures/hair-surface-primitives-2026-09-09/` with a hash manifest. Chromium 149 and the WebGPU backend were confirmed; the adapter's identity was not serialized. This is a correctness gate, not a timing claim. Open-patch signs do not establish whole-body inside/outside, and these primitives do not establish final contact convergence, all-bake hair clearance, garment coverage or visual quality.
