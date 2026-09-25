# Moving the screen-space threshold pattern — rejected

Base: `5606973415cd372ae99f031dc54302531d132f1d`. The isolated candidate adds an inner temporal
phase to the screen-space interleaved-gradient expression, keeping the original outer golden
step. The inner phase is `fract((frame + materialPhase) * (sqrt(2) - 1))`, evaluated on the CPU
in double precision and passed through a render-group uniform. Geometry, atlas, HairMaterial,
default TAAU scale 0.66 and all acceptance thresholds remain unchanged.

`candidate.mjs` patches only Vite's response for `HairOIT.js`. Each route is checked and its
transformed source hashes are recorded in `pipeline.json`. The zero arm uses the same expression
and uniform wiring with inner phase pinned to zero. Its three native tip images reproduce the
preceding checkpoint's shipping images byte-for-byte. The candidate must change rendered pixels,
and every CPU geometry-mask count matches the zero arm. No runtime file was edited on disk.

| Measurement | Shipping / zero control | Candidate |
| --- | --- | --- |
| 24-step tip speckle, ceiling 3% | 7.12% | 7.19% |
| 24-step cheek speckle, ceiling 3% | 19.23% | 18.89% |
| Portrait C4 transmission, ceiling 0.35 | 0.5439 | 0.5419 |
| Portrait C3 mass transmission | 0.0650 | 0.0637 |
| 128-step phase-pair RMS | 3.0944 code values | 4.4455 code values |

The ordinary image retains visible stipple, transparent curtain and broad card layers. Small
reductions in cheek speckle and transmission do not clear either gate, while tips worsen and
phase dependence increases. **Rejected; no renderer or asset promotion.** Independent opacity
controls pass: portrait detached/hidden ratios are 0.9951 over the footprint and 0.9924 over the
curtain; rear ratio is 0.9913. Portrait C4 is the only opacity failure. Rear C4 has zero eligible
pixels and is not gated.

The double-precision arithmetic probe records gaps and empirical CDF discrepancy for seven
screen seeds, two phases and three starting indices, through one billion frames. All samples
are finite/in-range, zero phase is algebraically identical, and the frozen defect remains
frozen while responding to phase. Distribution is worse: at 256 samples the largest observed
gap rises from 0.005025 to 0.118120; at 4096 samples the largest CDF discrepancy is 0.009754
versus 0.000695. These are sampled diagnostics, not a claim of GPU precision or asymptotic
unbiasedness. The unchanged outer offset still has its own original bound; that bound does not
establish the quality of this modified final threshold.

`phase-controls.mjs` replays the existing HairOIT C1–C3 portrait protocol: 128 zero-second steps,
phases 0/977 and default grading/shadows, distinct from the 24-step tip/opacity fixture. It uses
one **shipping hair-minus-bald mask** for all arms, so a candidate cannot shrink the measured
region. The mask also includes pixels affected by the groom outside its visible triangles.
Nine separate captures verify actual Apple/Metal WebGPU, TAAU, scale, applied route and live
uniforms. This is a focused comparison, not the full HairOIT gate.

- C1's unchanged 8-code-value ceiling passes for both baseline and candidate.
- Candidate frozen-dither RMS is 11.9974: above 10, but only 2.70× its regular RMS, below C2's
  required 3×. C2 fails. Both offsets are explicitly frozen and still respond to phase.
- Candidate white-dither RMS is 3.2596, below rather than above 1.15× its regular RMS. C3 fails.
  This defect replaces the outer sequence only; the candidate's inner phase keeps advancing.
  It does not establish that white noise is generally a better estimator.

All GPU jobs ran serially and completed. Browser, console and HTTP checks found no errors.
Source and asset hashes are unchanged. Native plates here include candidate tip/residual/tile,
both opacity views and curtain heatmap, plus four representative phase-control plates. The
summary hashes every scratch image; the phase report includes all nine capture hashes and
per-frame uniform traces. Text logs have trailing whitespace normalized only in the archive.

Replay from the repository root, using the recorded source versions. The preparation script
checks `source-hashes.json` before creating copies of the native instruments. Their adjacent
patches show that measurement and gate logic are unchanged. Each GPU command must finish
before the next starts; exit 1 is expected for the recorded red clauses, not for exceptions.

```sh
mkdir -p tmp/hair-sep25/pattern-phase
cp docs/evidence/hair-2026-09-25/pattern-phase/candidate.mjs tmp/hair-sep25/pattern-phase/
cp docs/evidence/hair-2026-09-25/pattern-phase/arithmetic.mjs tmp/hair-sep25/pattern-phase/
cp docs/evidence/hair-2026-09-25/pattern-phase/phase-controls.mjs tmp/hair-sep25/pattern-phase/
cp docs/evidence/hair-2026-09-25/pattern-phase/prepare.py tmp/hair-sep25/pattern-phase/
cp docs/evidence/hair-2026-09-25/pattern-phase/source-hashes.json tmp/hair-sep25/pattern-phase/
python3 tmp/hair-sep25/pattern-phase/prepare.py
node tmp/hair-sep25/pattern-phase/arithmetic.mjs
PATTERN_ARM=zero node tmp/hair-sep25/pattern-phase/tips.mjs --arms stochastic --steps 24 --out tmp/hair-sep25/pattern-phase/zero-tips
PATTERN_ARM=candidate node tmp/hair-sep25/pattern-phase/tips.mjs --arms stochastic --steps 24 --out tmp/hair-sep25/pattern-phase/candidate-tips
PATTERN_ARM=candidate node tmp/hair-sep25/pattern-phase/opacity.mjs --steps 24 --out tmp/hair-sep25/pattern-phase/candidate-opacity
node tmp/hair-sep25/pattern-phase/phase-controls.mjs
```

`summarize.py` verifies the original scratch layout against the preceding runtime-coverage
captures and measurements; those historical files must be present to rerun that verifier.
No motion, geometry, build, performance or full-suite run is claimed for this rejected candidate.
The [overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md) holds the next bounded step.
