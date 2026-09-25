# Runtime coverage and scene-resolution comparison

Starting point: `c70c8c71da978d25a61fead87aba9f46372f2e48`. These captures use supported
bob01/g050, its real runtime HairMaterial and WebGPU TAAU on `alive.html`. The fixed GLB's
SHA-256 is `d425444f3d478c63e4842f7a789aa89ac1968c7d13b5aac87ca6717700df56e7`.
No groom, atlas, lighting, material or runtime implementation changes were promoted.

The ordinary three-arm tip probe reproduces the known default stochastic failures: tips
7.12%, cheek 19.23%, against the unchanged 3% ceilings. Cutout gives 6.21% / 15.10%; sorted
blend gives 2.41% / 7.22%. Blend is a diagnostic, remains draw-order dependent and still exceeds
the cheek ceiling. The stock probe only gates the stochastic arm.

Changing the existing whole-scene `scale` query from 0.66 to 1 makes the stochastic result
25.61% / 28.50%. The native image has stronger fine stipple, including a regular pattern at the
nape. Portrait curtain transmission is 0.5468 versus 0.5439 at the default scale; both exceed
0.35. **Scale 1 is rejected.** The two opacity runs pass their independently captured
detached/hidden-hair controls. Their rear views pass the applicable opacity clauses; C4 has
no eligible curtain pixels there and is not gated. These are fixed 24-step measurements, not
a proof of full temporal convergence. The scale query changes body/background rendering too;
there is no cross-scale claim of identical body pixels, and no performance comparison was run.

The production change is confined to `hair_tips.mjs`'s report. Previously it consulted the
weighted-OIT pass object and printed “no hairOIT on the stage” for all three depth/sorted arms.
It now distinguishes stage configuration, weighted-pass presence, actual temporal AA and scene
scale; existing live material flags still describe the coverage implementation. Stage
configuration alone cannot establish a material path, particularly for an MSAA fallback.
All **11 native before/after images** match byte-for-byte. Every non-metadata report line,
including measurements, masks, material flags and verdicts, matches exactly. The report repair
does not clear T1/T2 or any other appearance failure.

`tips.mjs` and `opacity.mjs` are isolated copies of the starting instruments. The adjacent
patches show all changes: scratch-path resolution, the existing `scale` query, JSON export,
live WebGPU/TAAU assertions, and page/console/HTTP checks. The measurement, masking and gating
logic is unchanged. Their old `coveragePath` field is retained as historical source; use
`ACTUAL PIPELINE` for the resolution experiment's live configuration. The first scale-one tip
run accidentally read nonexistent AA/report properties. The corrected probe was rerun alone
after all other GPU jobs finished: all three images and exact numerical JSON match the first
run. The corrected run verifies live TAAU as well as scale 1 and WebGPU. No browser/shader
errors were raised by these augmented probes.

`summary.json` binds sources and every scratch image. Native archived plates cover all three
default tip arms, the scale-one stochastic image/residual/worst tile, both opacity views per
scale and their portrait curtain heatmaps. The remaining images are hash-bound and remain in
the ignored scratch folder. Logs preserve complete printed rows; only trailing text whitespace
was normalized in this archive. `manifest.json` hashes the archived files themselves.

Replay the actual probes from the repository root. Run each command to completion before the
next; exit 1 is expected from the existing appearance failures, not a reason to ignore an
unexpected exception:

```sh
mkdir -p tmp/hair-sep24/runtime-coverage-replay
cp docs/evidence/hair-2026-09-24/runtime-coverage/tips.mjs tmp/hair-sep24/runtime-coverage-replay/
cp docs/evidence/hair-2026-09-24/runtime-coverage/opacity.mjs tmp/hair-sep24/runtime-coverage-replay/
node tools/figure-pipeline/hair_tips.mjs --arms stochastic,cutout,blend --steps 24 --out tmp/hair-sep24/runtime-coverage-replay/default-tips
COVERAGE_SCALE=1 node tmp/hair-sep24/runtime-coverage-replay/tips.mjs --arms stochastic --steps 24 --out tmp/hair-sep24/runtime-coverage-replay/scale-one-tips
node tmp/hair-sep24/runtime-coverage-replay/opacity.mjs --steps 24 --out tmp/hair-sep24/runtime-coverage-replay/default-opacity
COVERAGE_SCALE=1 node tmp/hair-sep24/runtime-coverage-replay/opacity.mjs --steps 24 --out tmp/hair-sep24/runtime-coverage-replay/scale-one-opacity
```

Check `probe-sources.json` before treating a replay as the same experiment. Only the production
tip report should differ from the starting source; `metadata-report.patch` records that diff.
The archived `summarize.py` is the verifier used against the original scratch layout, including
its pre-change captures and first scale-one run; it is not a runner that regenerates missing
historical files. Its output is `validation.txt`. Source syntax, request ledger 27/27 and
quoted-number checks 25/25 pass. No geometry, motion, cost, build or full-suite rerun is claimed
for this reporting change and rejected scene-resolution diagnostic.

The remaining-work section of [the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md)
describes the next isolated test. Keep the default scene scale and calibrated bob geometry.
