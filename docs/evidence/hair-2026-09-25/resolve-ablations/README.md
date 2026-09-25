# Separate clipping and lock-selection ablations — both rejected

Starting from clean `8b5e6133cc644eb9859a12e412b87f38222a8e27`, this isolated experiment changes
one TAAU expression at a time in the verified constant-alpha fixture. No production source,
dependency, accepted groom, material, calibration or threshold changes. No real-groom, motion,
performance or full-suite acceptance is claimed.

- `identity`: exact original served module.
- `no-clip`: assign `clippedHistoryColor = historyColor`; retain the lock interpolation and
  original new-frame/flicker weighting.
- `no-lock`: assign `lockedHistoryColor = clippedHistoryColor`; retain clipping and original
  new-frame/flicker weighting. This bypasses selection, not the earlier missing-lock-copy defect.

Every arm retains the original one-attachment resolve, color-only history copy, zero lock
history, depth/disocclusion rules, scale 0.66, stable card IDs, sampler, geometry, masks and clock.
No extra observation attachment is used. The source router accepts exactly one expression
replacement in both original and bundled source and rejects stacked or repeated interventions.

## Results

Native linear transmission and byte-domain frame-to-frame pixel RMS below use the last 64 of
512 frames. Independent references are 0.25 for two half-alpha cards and 0.5625 for two
quarter-alpha cards. The shared sampler's approximately 0.48 output remains incorrect.

| Case | Identity transmission | No clipping | No lock selection | Identity RMS | No clipping RMS | No lock RMS |
| --- | --- | --- | --- | --- | --- | --- |
| Shared half, phase 0 | 0.481219 | 0.481206 | 0.481219 | 0.007987 | 0.007986 | 0.007987 |
| Counter half, phase 0 | 0.060387 | 0.218435 | 0.076360 | 0.026456 | 0.009063 | 0.038347 |
| Counter half, phase 977 | 0.060040 | 0.218007 | 0.075849 | 0.025892 | 0.009036 | 0.037364 |
| Counter quarter, phase 0 | 0.593923 | 0.523585 | 0.575862 | 0.046724 | 0.011654 | 0.051540 |

Bypassing clipping greatly reduces the half-pair dark bias and temporal variation in this
fixture, but retains an approximately 0.032 transmission deficit. Quarter pairs become too dark
and their absolute error increases. Ordinary plates look smoother but have softer boundaries;
this is not enough for acceptance. Bypassing lock selection gives a much smaller half-pair mean
change, leaves substantial dark bias and raises temporal noise. Its quarter mean gets closer to
the reference while noise rises. Neither intervention qualifies for promotion.

**The no-clipping arm also fails the unchanged exact opaque endpoint control.** Beginning at
frame 72, 436 of 512 frames contain nonzero ROI pixels even though both cards are opaque.
The first violating maximum is 1/255; the maximum over the run is 2/255. Last-64 native ROI mean
is 0.000200206, ordinary mean 0.000150788, and temporal RMS 0.000214799. The identity and no-lock
opaque controls remain exactly black throughout. The absent-card white endpoint passes for all
arms. Independent blend references remain within the existing one-byte comparison tolerance,
but no-clipping introduces small blend drift and nonzero temporal noise; they are not exact
image matches to identity. The source of the endpoint leakage is not established here.

The initial final verifier stopped at that exact endpoint assertion. It now collects and records
all violations before returning **exit 1**, preserving the same criterion and rejected outcome.
`initial-verify.py` retains the fail-fast version. The completed verifier's failure is an
experimental result, not a waived check or an uncollected job. No-clipping is rejected despite
its attractive half-pair averages. No-lock is rejected for unresolved bias and increased noise.

## Validation and evidence

All 24 Apple WebGPU cases finish 512 frames. All 24 pilot cases reproduce their first 24 native
frame traces and images exactly, and eight identity cases reproduce all preceding stage-audit
traces and checkpoint images. Geometry/material state, fixed ROI (12,544 pixels), phase clocks,
source hashes and actual backend/scale checks pass. Every native resolve component is finite;
color-history copies, native formats and unchanged zero lock history verify at frames
24/128/512. These integrity checks pass while the opaque candidate control fails.

A subsequent serial repeat of no-clipping half pairs at phases 0/977 and its opaque control
reproduces every one of 512 native hashes, frame records, per-pixel temporal means and nine PNGs
exactly, including all opaque-control failures. All GPU jobs have exited and been collected.
72 final PNGs, nine replay PNGs, complete compressed frame/native records, per-pixel temporal
arrays/distributions, pilot records, source snapshots and validation logs are archived.
`manifest.json` hashes every other archive file. Full original report files also remain in
`tmp/hair-sep25/resolve-ablations/`; durable records do not depend on those scratch files.

## Replay and next step

Check the repository source/asset hashes in `captures-summary.json`, then copy the archived
fixture, sampler, decoder, capture, route and verification scripts into
`tmp/hair-sep25/resolve-ablations/`. Run each GPU command serially, waiting for exit before the next:

```sh
FRAMES=24 RUN_NAME=pilot node tmp/hair-sep25/resolve-ablations/capture.mjs
python3 tmp/hair-sep25/resolve-ablations/verify.py pilot
node tmp/hair-sep25/resolve-ablations/capture.mjs
python3 tmp/hair-sep25/resolve-ablations/verify.py
# The preceding verifier intentionally exits 1 for the reproduced opaque endpoint failure.
node tmp/hair-sep25/resolve-ablations/validate-routes.mjs
CASES=opaque-pair,counter-half DIAGNOSTICS=no-clip RUN_NAME=replay node tmp/hair-sep25/resolve-ablations/capture.mjs
python3 tmp/hair-sep25/resolve-ablations/verify-replay.py
```

The clipping ablation has now established a causal contribution to this fixture's bias; a
wholesale bypass is rejected. Luminance-dependent new/history weighting remains a separate
hypothesis for residual bias. In a future authorized session, first measure that factor alone
with clipping retained, then decide whether a controlled interaction experiment is warranted.
Do not stack it silently with the rejected no-clipping arm or reopen the lock-copy candidate.
Robert requested pausing after this round. All GPU jobs finished, the automation is paused and
the isolated Blender mount is detached. No further wake will run; future experiments require
resumption. See the [overnight handoff](../../../PROGRESS-2026-09-24-OVERNIGHT.md).
