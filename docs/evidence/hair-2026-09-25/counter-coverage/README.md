# Counter-based card coverage: raw mechanism repaired; resolved candidate rejected

Starting from clean `f4a7c032ceeb24829cee0ba459587d8533d0e921`, this isolated experiment assigns
explicit card IDs and hashes the pixel, renderer frame and card ID into the coverage threshold.
It corrects the measured raw two-card correlation and works across merged geometry and reversed
order. **Do not promote it to the groom or runtime.** Shipping TAAU still produces a heavily
biased, noisy image. No production source, dependency, asset, calibration or threshold changed.

The original fixture remains two constant-alpha black cards against white, using basic node
materials and the production `configureHairMaterial` setup. The original shared IGN/golden
sequence is reconstructed unchanged for identity controls. Candidate geometry adds a Uint32
`stableCardId` attribute: 101 on all four vertices of the first card, 503 on the second. An
integer varying is flat in the installed WGSL builder. IDs stay with vertices across the
separate, merged and reversed-index controls. No rest/deformed position, triangle index or
material draw order determines identity.

`sampler.js` mixes unsigned pixel x/y, card ID and `(frameId + phase)` counters with fixed integer
multipliers/XOR, then applies the PCG permutation from installed Three's `Hash.js` (archived).
The high 24 result bits convert exactly to float, avoiding a threshold rounded to 1. The lower
endpoint retains the shipping positive clamp. This is a deterministic experimental hash; these
measurements do not establish universal independence or a convergence theorem.

| Card alpha pair, phase 0 | Independent transmission | Raw 512-frame mean | Shipping TAAU last-64 mean | TAAU last-64 pixel RMS |
| --- | --- | --- | --- | --- |
| 0.25 / 0.25 | 0.5625 | 0.562645 | 0.593941 | 0.046724 |
| 0.5 / 0.5 | 0.25 | 0.250118 | 0.060385 | 0.026456 |
| 0.75 / 0.75 | 0.0625 | 0.062460 | 0.002418 | 0.005518 |
| 0.25 / 0.75 | 0.1875 | 0.187398 | 0.024228 | 0.016621 |

Phase 977 reproduces the failure pattern: half-pair raw mean 0.249949 becomes TAAU last-64 mean
0.060037. The original shared-field half pair remains 0.499999 raw and 0.481269 resolved; the
independent sorted-blend reference is 0.250980. Candidate half-pair resolved temporal RMS rises
from the shipping shared-field 0.007987 to 0.026456. Quarter pairs become too bright; half,
three-quarter and mixed pairs become too dark. This is not a simple uniform exposure error.

The raw half-pair distribution of per-pixel 512-frame means has spatial SD 0.018957 / 0.019011
across phases 0/977. These finite-run spreads are retained rather than hidden by the global
mean. Reusing ID 101 on both cards restores the wrong single-layer transmission near 0.5; its
images, all frame statistics and per-pixel means equal the single-card hash control exactly.
This rejection control isolates why a stable distinct ID matters.

All 48 actual Apple WebGPU cases complete 512 frames, with native ordinary images at frames
24, 128 and 512. Raw rendering uses scale 1; TAAU uses shipping scale 0.66 and its unchanged
one-attachment resolve. Frozen time stays zero while frame counters advance. The 12,544-pixel
geometry ROI is the unchanged intersection eroded for resolve support. Linear grayscale output
omits tone mapping, display transfer, AO and sharpening, so these plates are diagnostic values.

Validation:

- Every one of 109,182,976 sampled raw counter-coverage ROI pixels matches an independent CPU
  evaluation using unsigned integer arithmetic. This checks the actual GPU's threshold inputs,
  overflow behavior, alpha discard and ID delivery; it covers 17 raw cases × 512 × 12,544 pixels.
- Ten exact equivalences cover original shared/single behavior, candidate separate versus
  reversed/merged/merged-reversed, and the duplicate-ID versus single-card rejection control,
  in both raw and TAAU paths. All triangles retain a constant ID. Means, every frame measurement,
  per-pixel temporal means, native checkpoints and images agree in each pair.
- Absent/zero/opaque/body-depth controls and four independent blend references pass in both
  paths. The explicit CPU oracle, not a sample-mean tolerance, checks the raw candidate.
- All 28 pilot cases repeat every first-24 trace and image exactly in the final run. All 22
  preceding shared/endpoint/depth/blend controls repeat their 512-frame measurements and
  three checkpoint images exactly.
- The 72 TAAU checkpoints audit RGBA16F resolve/color-history/lock-history. All sampled components
  are finite, color/history copies are bit-identical, and original lock history stays zero.
  No lock-copy correction is stacked into this candidate. Native phase-zero half-pair output at
  frame 512 is 0.058116 versus ordinary 0.058119, so this instance's bias precedes byte conversion.
- Actual adapter/backend, frame/phase uniforms, mask, source/asset hashes, clean browser/HTTP
  execution and JavaScript/Python syntax checks pass. Every GPU process was serialized and exited.

Ordinary final plates were inspected against the original shared field and independent blend.
The hash removes the regular diagonal pattern but produces mottled dark half-pair interiors;
quarter pairs show bright specks and three-quarter pairs are nearly black. Numerical raw
improvement does not qualify this resolved appearance. No groom, fibre BSDF, moving geometry,
camera motion, full-suite, build or rendering-cost acceptance is claimed. The heavily
instrumented captures are unsuitable for performance claims. A specific internal TAAU source
of the bias remains unisolated; no depth/disocclusion or other renderer change is justified here.

The archive contains 144 final PNGs, full frame/native records in deterministic gzip, summary
statistics, per-pixel-array hashes (little-endian float64), all source/asset hashes, fixture,
sampler, verifier and logs. Full per-pixel arrays remain in scratch; pilot images are not
duplicated because their exact repeat is verified against final frame-24 files. `manifest.json`
hashes every other archive file.

Replay from the repository root after checking `summary.json` source hashes: copy `fixture.html`,
`fixture.js`, `sampler.js`, `capture.mjs`, `half-audit.mjs` and `summarize.py` into
`tmp/hair-sep25/counter-coverage/`, then run these serially, waiting for each GPU process to exit:

```sh
CASES=shared-half,counter-half,empty,zero-pair,opaque-pair,front-body,blend-half,reversed,merged,merged-reversed,shared-id,single FRAMES=24 RUN_NAME=pilot node tmp/hair-sep25/counter-coverage/capture.mjs
node tmp/hair-sep25/counter-coverage/capture.mjs
python3 tmp/hair-sep25/counter-coverage/summarize.py
```

The verifier reads the preceding `spatial-fields/case-records.jsonl` archive for identity proof.
The [overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md) records the next bounded
resolve-attribution step and the morning stop rule. The shipping four-gate backlog is unchanged.
