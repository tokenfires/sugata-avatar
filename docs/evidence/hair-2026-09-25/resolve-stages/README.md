# Native resolve-stage attribution with unchanged color feedback

This observation experiment starts from clean `1d680b5f240e3b3f4346c154081d69b4df96652d`.
It uses the preceding verified counter-coverage fixture to locate where native color changes
inside shipping TAAU. It does not propose or install a renderer or sampler repair. Production
source, dependencies, accepted grooms, materials, calibration and thresholds remain unchanged.

Six served-source arms retain the exact original arithmetic and color-history copy. `identity`
serves unchanged module bytes. Each other arm adds a third RGBA16F resolve attachment and emits
one existing RGB intermediate into it: `currentColor`, neighborhood `mean`, sampled `historyColor`,
`clippedHistoryColor` or `lockedHistoryColor`. Color and lock stay in slots 0/1; only original
color is copied to history. Missing lock delivery is preserved, not corrected. Each arm's
auxiliary alpha is fixed at one. The initial seed path copies the beauty sample into the extra
slot; frame one is excluded from the last-64 analysis.

The initial full-vec4 observation failed its stronger native equality check, even though ordinary
RGB images and reported means matched. In the shared-half frame-24 audit, observing current
color changed 386 native alpha components between 1 and 0.99951171875, with no RGB changes.
That instrument was rejected. Observing RGB with a fixed auxiliary alpha removes the measured
perturbation. The initial source snapshots, 48 short-run records, direct binary16 comparisons
and corrected audit are retained. No original renderer arithmetic was changed to accommodate
this instrument.

All 48 Apple WebGPU cases completed 512 frames. The 40 observer cases preserve the full native
RGBA resolve hash on every frame, ordinary measurements, per-pixel temporal means and all three
ordinary checkpoint images exactly. All 48 corrected pilots repeat their first 24 frames; the
eight identity cases reproduce the preceding counter-coverage traces and checkpoint images.
Endpoint/blend, native finiteness, source-route and history-copy checks pass. The archive contains
144 ordinary and 120 diagnostic final PNGs.

The native last-64-frame ROI means locate net adjustments inside accumulation:

| Case | Current | Neighborhood mean | Sampled history | Clipped history | Locked history | Output |
| --- | --- | --- | --- | --- | --- | --- |
| Shared half, phase 0 | 0.499814 | 0.499755 | 0.481221 | 0.481221 | 0.481221 | 0.481219 |
| Counter half, phase 0 | 0.250103 | 0.250164 | 0.060441 | 0.058035 | 0.056198 | 0.060387 |
| Counter half, phase 977 | 0.249529 | 0.249650 | 0.060025 | 0.057635 | 0.055855 | 0.060040 |
| Counter quarter, phase 0 | 0.562274 | 0.562024 | 0.594028 | 0.594762 | 0.596070 | 0.593923 |
| Empty | 0.999984 | 1.000000 | 1.000000 | 1.000000 | 1.000000 | 1.000000 |
| Opaque pair | 0 | 0 | 0 | 0 | 0 | 0 |
| Blend half | 0.249996 | 0.250000 | 0.250000 | 0.250000 | 0.250000 | 0.250000 |
| Blend quarter | 0.562378 | 0.562500 | 0.562012 | 0.562012 | 0.562012 | 0.562012 |

Counter half-pair current and neighborhood means retain the expected 0.25 transmission; quarter
pairs retain approximately 0.5625. Sampled history already contains the feedback bias. For the
phase-zero half pair, clipping subtracts 0.002406 and lock selection subtracts another 0.001837
on average, opposing the subsequent 0.004189 increase from new-sample blending. For the quarter
pair, those stages instead add 0.000734 and 0.001308, opposing the subsequent 0.002147 decrease.
The second half-pair phase reproduces the direction. Sampled history differs from the preceding
output mean by only 0.000002–0.000004 in these cases. These are measured stage adjustments, not
proof that bypassing either operation would produce a qualified image.

Ordinary and diagnostic plates retain the previously observed dark half-pair mottling and bright
quarter-pair specks. Observation has not improved the renderer. A bounded causal ablation of
clipping and lock selection separately is the next experiment. No shipping fix is promoted.

All cases retain the 256×256 linear diagnostic output, fixed 12,544-pixel geometry ROI, frozen
time with increasing frame counter and original TAAU scale 0.66. The counter sampler, stable
card IDs and original shared-field control are unchanged. Eight cases per arm cover shared-half,
counter-half at phases 0/977, counter-quarter at phase 0, absent cards, opaque cards and independent
half/quarter sorted-blend references. The rejected counter sampler is a mechanism probe, not a
candidate on the real groom.

Readback checks classify every native resolve and diagnostic component for every frame and hash
the full native RGBA resolve buffer. This catches changes below ordinary byte quantization and
in alpha. Color-history copy, lock-history zero, target format and attachment topology are
checked at frames 24/128/512. The original color feedback, per-pixel temporal means and ordinary
whole images must match identity exactly before any diagnostic result can be used. The separate
history sample makes the effect of reprojection distinguishable from clipping without changing
reprojection or depth logic.

The stage means and differences are native linear grayscale values. A difference of stage means
measures the net adjustment across the fixed ROI; it does not prove a counterfactual repair will
work. The locked result uses spatially varying weights, so its mean need not lie between the
means of its two inputs. Diagnostic PNGs clamp to [0,1] and quantize; native values, not these
previews, are authoritative. No new quality threshold, full-suite result, real-groom, motion or
performance qualification is claimed.

The archive contains the exact original/served modules, fixture, source hashes, full per-frame
native records in deterministic gzip, ordinary and diagnostic plates, initial instrument
rejection evidence, verifier and replay instructions. Full per-pixel temporal arrays remain in
scratch. `manifest.json` hashes every other archive file.

Replay from the repository root after checking source hashes in `summary.json`: copy `fixture.html`,
`fixture.js`, `sampler.js`, `half-audit.mjs`, `route.mjs`, `capture.mjs`, `verify-pilot.py`,
`summarize.py` and `validate-routes.mjs` into `tmp/hair-sep25/resolve-stages/`. Run serially:

```sh
FRAMES=24 RUN_NAME=pilot-fixed node tmp/hair-sep25/resolve-stages/capture.mjs
python3 tmp/hair-sep25/resolve-stages/verify-pilot.py
node tmp/hair-sep25/resolve-stages/capture.mjs
python3 tmp/hair-sep25/resolve-stages/summarize.py
node tmp/hair-sep25/resolve-stages/validate-routes.mjs
```

Explicitly wait for each GPU command to exit before starting the next. The verifier uses the
preceding counter-coverage archive for identity proof. `NATIVE_BITS=1` optionally saves native
checkpoint buffers; the two-case alpha audits used `CASES=shared-half DIAGNOSTICS=identity,current
FRAMES=24`. Initial source snapshots are review/replay evidence for the rejected observation,
not the final instrument. The [overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md)
records the next bounded step and morning stop rule.
