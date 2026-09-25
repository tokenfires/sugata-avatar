# Lock delivery reaches the runtime; static groom qualification rejects promotion

Starting from clean `9851db100d61da60f49eeb072c2066af7d7becce`, the isolated `copy-lock`
response from the preceding fixture was tested on the accepted bob01/g050 runtime groom.
**Do not promote this correction on this evidence.** Lock delivery works, but tip speckle
increases and all three existing T1/T2/C4 appearance clauses remain red. The confirmed missing
history delivery remains a separate renderer defect; proving its delivery is insufficient to
accept its visual effect.

Only the served TAAU module differs between arms. `identity` serves the original bytes;
`copy-lock` adds the second resolve attachment and copies it to lock history. No installed
package, production source, geometry, material, atlas, calibration or threshold changed.
Shipping shared coverage, phase zero, default TAAU scale 0.66 and HairNodeMaterial remain fixed.
There is no inner-phase, spatial-swap or distinct-rate candidate in this experiment.

| Static runtime measure | Identity | Copied lock | Existing criterion |
| --- | --- | --- | --- |
| T1 tip speckle, 10,593 pixels | 7.12% | 7.60% | ≤3% |
| T2 cheek speckle, 53,250 pixels | 19.23% | 19.18% | ≤3% |
| C4 portrait curtain transmission, 28,700 pixels | 0.543930 | 0.532372 | ≤0.35 |
| Portrait L2 detached/hidden ratio | 0.995063 | 0.994654 | 0.97–1.03 |
| Portrait L3 detached/hidden curtain ratio | 0.992339 | 0.991653 | 0.97–1.03 |
| Rear L2 detached/hidden ratio | 0.991332 | 0.990993 | 0.97–1.03 |

T1 rises by 0.48145 percentage points. The small T2/C4 decreases do not qualify a repair.
Both arms exit 1 on tips solely for T1/T2 and on opacity solely for portrait C4. Other reported
clauses pass. Rear C4 has zero eligible pixels and is not gated; it is not a pass.

The production probes were copied into scratch with route/readback instrumentation and output
serialization. Their measurement expressions and thresholds are unchanged; the zero-context
`probe-instrumentation.patch` records every alteration. The probes use 900×1200 ordinary plates,
24 zero-second convergence draws per capture and frozen time. The actual runtime reports WebGPU,
TAAU and stochastic hair. Exact served source and before/after hashes verify both routes.

Native checks at startup and every captured plate give 38 snapshots across the four final runs
(including step and independently detached reference plates), repeated in four pilot runs.
Snapshot frame IDs are 1/25 for tips and 1,25,…,385 for opacity. All sampled RGBA16F components
are finite. Color history always equals resolve bit-for-bit. Identity has one resolve attachment
and all-zero lock history; the candidate has two, and its lock history equals its emitted lock
bit-for-bit at every snapshot, with positive lock means. Its portrait frame-25 lock mean is
0.211180. This audits capture points, not every intervening convergence draw.

An initial instrumentation-only attempt failed because the old 256-wide fixture assumed tightly
packed readback. Installed `WebGPUTextureUtils.js` aligns rows to 256 bytes and omits padding
after the final row. At width 900, RGBA16F has 7,200 payload bytes within a 7,424-byte stride.
The corrected unpacker strips the 224 padding bytes per row. Synthetic tests place NaNs in
padding and in real pixels to prove that only padding is excluded, and check aligned/invalid
layouts. The failed attempt is archived and contributes no quality result. Neither renderer nor
probe thresholds were changed to address it.

The four pilot runs were repeated after adding read-only geometry/mask serialization. All 26
PNGs, six measurement files and every native target/copy record repeat exactly. Identity also
reproduces the preceding shipping baseline's 13 PNGs and three measurement files exactly.
Both arms' full CPU geometry rasters and final mask membership match bit-for-bit for tips and
both opacity views, including the denominator eligibility mask. The accepted bob GLB remains
`d425444f3d478c63e4842f7a789aa89ac1968c7d13b5aac87ca6717700df56e7`.

Ordinary portrait/rear hair and bald plates and worst-hair crops were visually inspected.
Card slabs, crown openings, visible layered edges and stippled tips remain. There is no clear
whole-image improvement that justifies the T1 regression. Body and boundaries are not identical:

| Ordinary image / region | Changed pixels | RGB RMS code values | Maximum channel difference |
| --- | --- | --- | --- |
| Portrait hair, whole image | 77,671 / 1,080,000 | 0.934256 | 103 |
| Portrait hair, stable skin mask | 1,892 / 385,376 | 0.307401 | 103 |
| Portrait hair, excluded stability boundary | 2,112 / 22,457 | 0.810182 | 47 |
| Portrait bald, whole image | 16,302 / 1,080,000 | 0.278887 | 58 |
| Rear hair, whole image | 81,763 / 1,080,000 | 0.560146 | 54 |
| Rear bald, whole image | 36,267 / 1,080,000 | 0.179399 | 37 |

These are paired RGB image differences in 8-bit code values, not temporal noise or acceptance
thresholds. The boundary is the complement of the probe's geometry-stability mask. The stable
backdrop mask is exactly unchanged. Static images cannot establish general motion quality,
ghosting, AA quality or performance; no such result, full suite, build or new geometry
qualification is claimed. All GPU commands were serialized and their exits collected.

The archive includes all 26 final PNGs, measurements, pipeline snapshots, compressed geometry
rasters/masks, pilot native records, exact served modules, source/instrument hashes, logs and
verifier. Pilot images are not duplicated because the exact-repeat verifier binds their hashes
to the final files. `manifest.json` hashes every other archive file.

Replay from the repository root into scratch after checking `source-hashes.json`. Copy
`candidate.mjs`, `route.mjs`, `half-audit.mjs`, `readback-layout.test.mjs`, `prepare.py`,
`summarize.mjs` and `source-hashes.json` into `tmp/hair-sep25/lock-runtime/`; run:

```sh
python3 tmp/hair-sep25/lock-runtime/prepare.py
node tmp/hair-sep25/lock-runtime/readback-layout.test.mjs
LOCK_ARM=identity node tmp/hair-sep25/lock-runtime/tips.mjs --arms stochastic --steps 24 --out tmp/hair-sep25/lock-runtime/identity-tips
LOCK_ARM=copy-lock node tmp/hair-sep25/lock-runtime/tips.mjs --arms stochastic --steps 24 --out tmp/hair-sep25/lock-runtime/copy-lock-tips
LOCK_ARM=identity node tmp/hair-sep25/lock-runtime/opacity.mjs --steps 24 --out tmp/hair-sep25/lock-runtime/identity-opacity
LOCK_ARM=copy-lock node tmp/hair-sep25/lock-runtime/opacity.mjs --steps 24 --out tmp/hair-sep25/lock-runtime/copy-lock-opacity
```

Wait for each GPU process to exit before starting the next. The known quality failures produce
exit 1; check that the logs contain the expected clauses rather than an exception. Copy the four
output directories to `pilot-identity-tips`, `pilot-copy-lock-tips`, `pilot-identity-opacity` and
`pilot-copy-lock-opacity`, then repeat the four commands to verify determinism. Finally run
`node tmp/hair-sep25/lock-runtime/summarize.mjs`. Historical shipping comparisons use old scratch
files when available, otherwise the hashes recorded in this archive's `summary.json`.
