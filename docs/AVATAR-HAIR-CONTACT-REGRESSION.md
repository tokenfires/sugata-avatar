# Avatar hair contact integration regression

```sh
node packages/core/src/Avatar.hair-contact.gpu.selftest.mjs --report=/tmp/avatar-contact.json
```

This portable WebGPU test reproduces the calibrated corrected bob01/g050 candidate from the tracked original LFS fixture using `hair_long_fall.mjs`. It routes only the canonical development URL for that groom, verifies its exact `db3565bb…` GLB hash, and leaves shipping assets unchanged. The browser runs the actual portrait and Avatar lifecycle, with the real body-contact owner and shaders.

Eight groups passed on the 2026-09-09 frozen integration:

- Canonical nod at 0 and 0.1 seconds is bit-identical to the earlier core smoke: all 25,296 centre coordinates, 50,592 ribbon vertex coordinates, 43,551 body vertex coordinates and 16 Float64 head matrix values at both poses. The tracked golden includes original capture/source hashes.
- All 496 roots agree with native Three skinning under identity, a common translation `(0.1,0.2,0.3)`, a Y rotation of `0.4` radians, and both together. Maximum GPU centre error was `0.00016617 mm`, rebuilt root midpoint error `0.00016628 mm`, and width-length error `0.00011113 mm`, within the `0.002 mm` gate.
- Unsupported scale is a recoverable Avatar input refusal before submission: zero compute calls, unchanged centre/vertex hashes, solver steps, contact frame count and resources. The solver stays owned and resumes after restoring the valid pose. A direct owner-prepare failure has a separate retirement contract.
- On the same renderer, corrected g050 contact uses 35 storage buffers / 4,976,528 bytes. Bob02 and uncalibrated g000 use eight buffers / 980,096 bytes. Removing hair returns storage, bytes and compute pipelines to zero. The sequence covers contact → bob02 → off → contact → same-identity rebuild → g000 → g050, without accumulation.
- Six retained old solver handles are disposed and refuse every tested update/read operation.
- Disposing while 14 real browser geometry digests are deferred leaves no published hair owner, zero storage, and zero later compute submissions.
- All six routed corrected-g050 requests match the candidate hash, with zero browser errors.
- The production/test source hashes remain unchanged throughout the integration run.

The initial test incorrectly required the two rebuilt root edge positions to equal static skinning. The existing ribbon rebuild transports width along the changed first-span tangent, so its static-edge difference was approximately `0.438 mm` even at identity. The corrected test checks the actual attachment invariants—native centre, rebuilt midpoint and width length—and retains static-edge deltas as diagnostics. Both reports and their test source snapshots are preserved; no production change was made to satisfy that assertion.

The existing bob02 `HairDynamics.selftest.mjs --quick` also passed 24/24 in 24 seconds, and `HairDynamics.disposal.selftest.mjs` passed 21/21, including old-retirement rejection and exact matched vertex equivalence. Quick mode excludes its broader expensive rejection proofs. Contact pipelines number 17 after reset-only submission and 21 after all four regular velocity finalizers have compiled; both return to zero on removal.

[The compact evidence ledger](evidence/avatar-hair-contact-transform-2026-09-09.json) records counts, hashes, measurements and limits. Full reports, logs, the initial assertion correction and frozen sources are in ignored `captures/avatar-contact-transform-2026-09-09/` with a hash manifest. The tracked golden makes runtime captures unnecessary for rerunning this test.

The portrait selector still reloads documents for style changes; the test exercises Avatar's internal attachment boundary on one renderer and does not claim to uninstall global material prototype patches. Native-root correctness does not prove whole-hair rigid equivariance, contact convergence, all-bake fit, scalp/garment clearance or visual quality. This run contains no performance claim. Exact canonical hashes should be reviewed against their recorded engine/source baseline when changing backend or arithmetic, never silently regenerated.
