# Distinct temporal rates alone are rejected

This isolated follow-up starts from `671ee3294fb9f1ea9c61e3664bd434bea38c51ae`.
It tests the next step from the overlapping-layer fixture: retain the first card's golden
temporal step, but advance the second card's offset by `sqrt(2) - 1`. The raw averages approach
independent-layer transmission; TAAU strongly biases several pairs toward black and increases
resolved half-pair temporal noise. **Rejected.** No production source, accepted groom, contact
calibration, default scale or appearance threshold changes.

Black, constant-alpha basic node materials use the existing `configureHairMaterial` coverage
function over an opaque white body plane. Only each material's existing offset update is
overridden. Both cards retain the same screen-space spatial field. Shared-sequence controls
override both rates with the original golden step. A merged pair deliberately has one material
and one uniform, exposing that this is a two-material mechanism control, not a general per-card
sampler for a merged groom. This does not measure the fibre BSDF or the real groom's C4 deficit.

There are 42 cases, each with 512 draws and images at draws 24, 128 and 512. The five main arms
use starting phases 0 and 977. Additional arms cover reversed submission order, a merged pair,
single/absent/zero/opaque cards, an opaque body in front, and four sorted-blend references.
The raw path uses scale 1; TAAU retains its default 0.66 scale, scene pass, depth, velocity and
history. Linear RGBA8 output omits transfer, tone mapping, grading and AO. The fixed 12,544-pixel
mask is the projected quad intersection eroded eight pixels, `[72,184) × [72,184)`.

| Card alphas | Independent reference | Raw mean, phase 0 / 977 | TAAU mean, phase 0 / 977 | TAAU last-64 mean, phase 0 / 977 |
| --- | --- | --- | --- | --- |
| 0.25 + 0.25 | 0.5625 | 0.562290 / 0.562344 | 0.534812 / 0.531862 | 0.534144 / 0.534371 |
| 0.50 + 0.50 | 0.2500 | 0.249740 / 0.249644 | 0.035067 / 0.033778 | 0.029851 / 0.031796 |
| 0.75 + 0.75 | 0.0625 | 0.062289 / 0.062338 | 0.002109 / 0.002024 | 0.002024 / 0.001994 |
| 0.25 + 0.75 | 0.1875 | 0.187089 / 0.187336 | 0.024184 / 0.025423 | 0.024966 / 0.022330 |

These are finite 512-frame means, not a convergence guarantee. Sorted-blend references are
within one 8-bit quantization step of the independent analytic values on every draw. Their
transmission is stable: the half-pair reference is 0.250980. The shared-half control remains
too transparent: phase-zero TAAU mean 0.482343 and last-64 mean 0.481269.

The candidate's half-pair last-64 mean consecutive-frame pixel RMS is 0.015664 / 0.016816,
versus shared controls 0.007987 / 0.007990. These use linear values in `[0,1]`, a static camera
and static cards; they are **temporal noise measurements, not motion tests**. The raw log's
`motion=` label refers to this same quantity. At draw 24 the first frame has no predecessor
and contributes zero to the 24-frame average. All other reported tails have 64 predecessors.

Native TAAU plates visually confirm the excessive darkening. At draw 512 the candidate
half-pair is almost black, with spatial stipple and phase-dependent residual squares, whereas
the blend reference is a uniform dark gray. These plates contain linear diagnostic values
without a display transfer. A lower transmission number alone would falsely reward this
over-opaque result; it cannot qualify a groom improvement.

The raw frame means reveal a remaining correlation. At each frame the two thresholds have
one relative offset `delta = fract(offset2 - offset1)` across the entire patch. For two half
alphas and a uniform spatial field, transmission is `abs(0.5 - delta)`. Changing the rates
moves this value over time rather than decorrelating pixels between cards. Observed raw
half-pair frame means range from 0.002471 to 0.499841 for phase zero and 0.001515 to 0.499283
for phase 977, despite whole-run means near 0.25. The largest discrepancy from that per-frame
prediction is 0.001031 / 0.000784. The analogous interval-overlap predictions for other pairs
are also recorded. These finite-sample diagnostics explain the coherent raw coverage swings;
they do not identify which TAAU internal operation creates the resolved bias.

Validation:

- All 42 actual Apple/Metal WebGPU captures complete, with the expected per-frame uniforms,
  clocks, scale, fixed mask and source/asset hashes; browser/console/HTTP checks are clean.
- Endpoint and opaque-body depth controls pass on all 512 draws in both paths. All four
  sorted-blend references agree with their analytic values within RGBA8 quantization.
- Reversing the candidate's render order preserves all frame measurements, per-pixel temporal
  means and all three images. Shared single/separate/merged controls likewise match exactly.
- The ten-case 128-frame pilot ran before the full run, with identical instrument hashes.
  Every repeated frame trace and both checkpoint images match exactly.
- Eighteen controls reproduce the preceding fixture's first 128 frame means/ranges and final
  images. Some endpoint/depth controls now use a different card count or offset sequence;
  their uniform arrays are intentionally not claimed identical.
- GPU jobs were serialized and have exited. Script syntax and the evidence verifier pass.
  No real-groom geometry, motion, cost, build or full runtime suite acceptance is claimed.

`case-records.jsonl` retains every final case's configuration, live pipeline and material flags,
geometry, 512 frame measurements/offsets and checkpoint summaries/image hashes.
`pilot-records.jsonl` binds the original pilot traces and images. `summary.json` includes source
hashes, reference values, equivalences and relative-phase predictions. Full per-pixel temporal
mean arrays remain in scratch; their little-endian float64 hashes are retained. All 126 native
plates are archived. `manifest.json` hashes every other archive file.

Replay from the repository root after checking the production hashes in `summary.json`:

```sh
mkdir -p tmp/hair-sep25/temporal-sequences
cp docs/evidence/hair-2026-09-25/temporal-sequences/fixture.html tmp/hair-sep25/temporal-sequences/
cp docs/evidence/hair-2026-09-25/temporal-sequences/fixture.js tmp/hair-sep25/temporal-sequences/
cp docs/evidence/hair-2026-09-25/temporal-sequences/capture.mjs tmp/hair-sep25/temporal-sequences/
CASES=shared-half,distinct-half,blend-half FRAMES=128 RUN_NAME=pilot node tmp/hair-sep25/temporal-sequences/capture.mjs
node tmp/hair-sep25/temporal-sequences/capture.mjs
python3 docs/evidence/hair-2026-09-25/temporal-sequences/summarize.py
```

Each GPU command must finish before the next starts. The verifier also reads the prior
layer-correlation archive to establish identity. Its first draft required correction for
Python's compensated float sum versus JavaScript's sequential reduction, and for intentionally
changed endpoint uniform arrays; no capture result or acceptance threshold was altered.
The next bounded step is in [the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md).
