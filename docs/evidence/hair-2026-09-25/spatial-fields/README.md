# Swapped spatial fields: raw improvement, resolved rejection

This isolated fixture starts from `b60ed01be58550cd222a0c8d6b9b093f9f7a3849`. It tests
interleaved-gradient noise with the second separate card's screen-coordinate inputs swapped
from `xy` to `yx`, with either shared golden temporal rates or the preceding distinct rates.
It reconstructs the production threshold expression for identity controls. No production shader,
asset, calibration, default scale or appearance threshold changes. **Both spatial candidates are
rejected after TAAU and visual checks.**

The same black, constant-alpha basic node materials use `configureHairMaterial` over an opaque
white body. Only the fixture replaces `alphaTestNode` and the existing offset callbacks. A merged
pair deliberately retains one material/field. This is a two-material control, not a general
per-card sampler, fibre-BSDF evaluation or real-groom opacity measurement.

There are 64 cases, each with 512 frames and images at frames 24, 128 and 512. The main arms use
phases 0 and 977; both rendering paths include identity and prior-rejection controls, four alpha
pairs, reversed draw order for each spatial candidate, a merged pair, single/absent/zero/opaque
cards, an opaque body in front and four sorted-blend references. Actual Apple/Metal WebGPU uses
unfiltered scale 1 or default TAAU scale 0.66. Linear RGBA8 output omits transfer, tone mapping,
grading and AO; default sharpening is null. The geometry mask remains 12,544 pixels at
`[72,184) × [72,184)`, eroded eight pixels inside the quad intersection.

Phase-zero results below use all 512 frames for raw means and the last 64 for TAAU means.
Phase 977 gives the same qualitative result; exact data for both phases is archived.

| Card alphas | Independent reference | Raw, swapped/shared | Raw, swapped/distinct | TAAU tail, swapped/shared | TAAU tail, swapped/distinct |
| --- | --- | --- | --- | --- | --- |
| 0.25 + 0.25 | 0.5625 | 0.562544 | 0.562503 | 0.534317 | 0.534417 |
| 0.50 + 0.50 | 0.2500 | 0.250055 | 0.250005 | 0.125684 | 0.118749 |
| 0.75 + 0.75 | 0.0625 | 0.062528 | 0.062501 | 0.002286 | 0.003894 |
| 0.25 + 0.75 | 0.1875 | 0.187506 | 0.187501 | 0.050012 | 0.061329 |

The raw half-pair averages now look right, but an average alone conceals another correlation:

| Phase-zero half-pair arm | Raw frame-mean SD | Spatial SD of raw per-pixel 512-frame means | TAAU last-64 pixel RMS |
| --- | --- | --- | --- |
| Original field, shared rates | 0.000354 | 0.001701 | 0.007987 |
| Original field, distinct rates | 0.144137 | 0.004063 | 0.015664 |
| Swapped field, shared rates | 0.000494 | 0.144784 | 0.024481 |
| Swapped field, distinct rates | 0.000384 | 0.004084 | 0.026708 |

The spatial swap removes the large coherent patch swings. With shared temporal rates, however,
each pixel retains a different fixed relative threshold offset between cards. The raw spatial
average is near 0.25 while individual pixels' temporal averages remain widely distributed.
Distinct rates reduce this per-pixel spread at the sampled count. This is a measured finite
result, not a theorem of independent sampling or convergence.

Both spatial arms still resolve far darker than their independent references. For half-opacity
cards, native TAAU plates show dark diagonal stipple: a mottled crossing pattern with shared rates
and more regular diagonal bands with distinct rates. The sorted-blend half reference is stable,
uniform gray at 0.250980. Neither candidate qualifies visually. No groom experiment is justified
by these raw improvements.

The last table's RMS is the mean consecutive-frame pixel RMS over the final 64 frames, in linear
`[0,1]` values. Geometry/camera are static; this is temporal noise, not a motion test. The 24-frame
checkpoint treats the first missing predecessor as zero. Native PNG values are linear diagnostic
values without a display transfer. Whole-prefix averages include startup history.

Validation:

- All 64 captures complete with clean browser/console/HTTP checks, expected live rates/fields,
  frame clocks, masks, source/asset hashes and 192 image hashes.
- Endpoint and opaque-body depth controls pass in both paths on every frame. All four blend
  references match the analytic independent values within one RGBA8 quantization step.
- Eight exact equivalences cover shared single/separate/merged rejection controls and both
  candidates' draw-order reversals: frame measurements, per-pixel means and all three images.
- An 18-case 128-frame pilot precedes the final run. Every repeated trace and both checkpoint
  images match exactly, with identical source hashes.
- Twenty-eight controls reproduce the preceding temporal-sequence fixture's 512 frame
  measurements and all three images. Endpoint/depth offset arrays intentionally differ; only
  the corresponding image/measurement equality is claimed there.
- JavaScript/Python syntax and the evidence verifier pass. GPU jobs ran serially and exited.
  No real-groom geometry, motion, cost, build or full runtime suite acceptance is claimed.

A post-capture source audit found `thinFeature` in the installed `TAAUNode.js` divides by
`meanLuma` without a zero guard. Whether that produces nonfinite floating-point state in this
black-card fixture is **unproven**. RGBA8 readback cannot answer that question. `source-audit.json`
pins the inspected source and the next diagnostic: inspect native floating resolve/history/lock
buffers, with identity images, before proposing an arithmetic change. This is distinct from
earlier rejected depth/disocclusion changes; no internal cause is claimed here.

`case-records.jsonl` stores all final frame traces, live pipeline/material flags, configuration,
geometry and checkpoint summaries. `pilot-records.jsonl` binds the original pilot. `summary.json`
includes references, equivalences and per-pixel mean distributions/hashes (little-endian float64).
Full per-pixel arrays remain in scratch and can be regenerated. All 192 native plates are archived;
`manifest.json` hashes every other file.

Replay from the repository root after checking production source hashes in `summary.json`:

```sh
mkdir -p tmp/hair-sep25/spatial-fields
cp docs/evidence/hair-2026-09-25/spatial-fields/fixture.html tmp/hair-sep25/spatial-fields/
cp docs/evidence/hair-2026-09-25/spatial-fields/fixture.js tmp/hair-sep25/spatial-fields/
cp docs/evidence/hair-2026-09-25/spatial-fields/capture.mjs tmp/hair-sep25/spatial-fields/
CASES=shared-half,temporal-half,swapped-shared-half,swapped-distinct-half,blend-half FRAMES=128 RUN_NAME=pilot node tmp/hair-sep25/spatial-fields/capture.mjs
node tmp/hair-sep25/spatial-fields/capture.mjs
python3 docs/evidence/hair-2026-09-25/spatial-fields/summarize.py
```

Wait for each GPU command to finish before the next. The verifier reads the preceding
temporal-sequence archive for identity checks. The four existing red gates remain unchanged;
see [the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md) for the next bounded step.
