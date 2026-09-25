# Missing TAAU lock delivery confirmed; correction held for runtime checks

Starting from `c55b923d756a3d911567796b8b133e405eee1f11`, this fixture verifies that the installed
TAAU node computes a lock value but does not carry it into lock history. Giving the resolve a
second attachment emits nonzero locks; history remains zero until that attachment is copied.
The isolated copy transfers exact bits and changes subsequent output. This establishes a
delivery defect. **The correction is held for broader runtime qualification, not promoted.**

Three served-source arms run serially. They modify only the browser response for the installed
TAAU module; installed dependencies, production code, accepted grooms, calibrations and thresholds
remain unchanged:

1. `identity` serves the original module bytes unchanged.
2. `attachment-only` adds `count: 2` to the resolve target and retains the original color-only copy.
3. `copy-lock` also copies resolve attachment 1 into history attachment 1.

The route matches the actual optimized Vite module, as well as the unoptimized source form.
Every case records exactly one route, before/after hashes, and live attachment counts. The
archived served modules equal the declared patch output. No arithmetic, dither sequence,
disocclusion rule, depth rule, resolve weight or scale changes are stacked into the wiring test.

Seven static cases per arm give 21 cases with 512 frames and images at 24, 128 and 512.
They use shared-half and swapped/distinct-half cards at phases 0/977, plus opaque, absent-card
and independent blend controls. These are the existing constant-alpha basic-material fixtures,
not the real groom or fibre BSDF. Actual Apple/Metal WebGPU, default TAAU scale 0.66, the fixed
12,544-pixel geometry mask and pinned clock are retained. Linear RGBA8 output omits tone mapping,
transfer, grade and AO; sharpening is absent.

The native audit reads RGBA16F resolve/color-history/lock-history buffers every frame, adding
resolve-lock readback for two-attachment arms. All sampled components are finite. Original and
attachment-only lock history stays exactly zero. In nonempty two-attachment cases, emitted lock
becomes positive. Without its copy, it differs from the still-zero history; with the copy, the
entire lock buffer matches history bit-for-bit on every frame. Color/history copies and native-
to-byte conversion checks also pass. Blank white remains a valid zero-lock control.

| Half-pair configuration | Last-64 transmission, original | Last-64 transmission, copied lock | Last-64 pixel RMS, original | Last-64 pixel RMS, copied lock |
| --- | --- | --- | --- | --- |
| Shared field/rate, phase 0 | 0.481269 | 0.481267 | 0.007987 | 0.007987 |
| Shared field/rate, phase 977 | 0.481275 | 0.481273 | 0.007990 | 0.007990 |
| Swapped/distinct, phase 0 | 0.118749 | 0.151899 | 0.026708 | 0.019757 |
| Swapped/distinct, phase 977 | 0.118962 | 0.152028 | 0.026685 | 0.019739 |

Attachment-only color output exactly equals the original for every frame, per-pixel temporal
mean and image. The paired copy therefore isolates carrying the lock forward, rather than
merely exposing another output. Copied-lock ROI means over the last 64 frames are about 0.892
for shared coverage and 0.938 for swapped/distinct coverage; these are lock values, not opacity.

The independent half-pair transmission target is 0.25, with blend reading 0.250980. Copying lock
does not fix the shared-coverage bias. It reduces the swapped candidate's excess darkening and
static temporal noise, but that candidate remains too dark and visibly diagonally patterned.
**The spatial sampler remains rejected.** No numerical threshold is relaxed or replaced by the
improvement relative to a bad baseline. Pixel RMS is consecutive-frame noise for a static scene,
not a motion result; whole-prefix means include startup.

Native plates were visually inspected. Shared-field interiors appear unchanged, but the whole
images are not identical: at frame 512, phase zero changes 2,828 of 65,536 pixels, RMS 0.654504
and maximum 10 code values. Inside the eroded ROI only four pixels change, each by one code
value. Phase 977 changes 2,847 whole-frame pixels, again four in the ROI. Thus the interior mask
alone would hide boundary changes. Swapped/distinct interiors lighten while retaining diagonal
bands. All 21 full-image and ROI comparisons are in `plate-differences.json`, using red-channel
8-bit code values from neutral grayscale plates.

Validation:

- All 21 actual WebGPU runs complete with clean browser/console/HTTP checks, live attachment
  and route evidence, native format/finiteness/copy checks, clock and source/asset hashes.
- The seven identity cases reproduce the preceding audit's 512 frame traces, every per-pixel
  temporal mean and all 21 checkpoint images exactly.
- All seven attachment-only color cases reproduce identity frame measurements, per-pixel means
  and images exactly. Positive emitted locks with zero history are the delivery rejection control.
- All 18 pilot cases reproduce their first-24 traces and images in the final run, with identical
  instrument and served-module hashes. Endpoint and independent blend controls remain valid.
- Binary16 decoder/counter checks, source-patch equality, script syntax and the evidence verifier
  pass. All GPU jobs have exited. No full-suite, real-groom, geometry, motion, build or cost result
  is claimed. These heavily instrumented runs do not measure the candidate's rendering cost.

`case-records.jsonl.gz` and `pilot-records.jsonl.gz` retain every frame and native count, using
deterministic gzip to avoid duplicating large uncompressed traces. `summary.json` contains native
topology, lock-delivery observations, image hashes and per-pixel-array hashes (little-endian
float64). Full pixel arrays remain in scratch. All 63 ordinary RGBA8 plates and exact
served modules are archived. PNG values are linear diagnostic values without a display transfer.
`manifest.json` hashes every other archive file.

Replay from the repository root after checking source hashes in `summary.json`:

```sh
mkdir -p tmp/hair-sep25/lock-wiring
cp docs/evidence/hair-2026-09-25/lock-wiring/fixture.html tmp/hair-sep25/lock-wiring/
cp docs/evidence/hair-2026-09-25/lock-wiring/fixture.js tmp/hair-sep25/lock-wiring/
cp docs/evidence/hair-2026-09-25/lock-wiring/capture.mjs tmp/hair-sep25/lock-wiring/
cp docs/evidence/hair-2026-09-25/lock-wiring/route.mjs tmp/hair-sep25/lock-wiring/
cp docs/evidence/hair-2026-09-25/lock-wiring/half-audit.mjs tmp/hair-sep25/lock-wiring/
cp docs/evidence/hair-2026-09-25/lock-wiring/plate-differences.mjs tmp/hair-sep25/lock-wiring/
CASES=shared-half,swapped-distinct-half,opaque-pair,blend-half FRAMES=24 RUN_NAME=pilot node tmp/hair-sep25/lock-wiring/capture.mjs
node tmp/hair-sep25/lock-wiring/capture.mjs
python3 docs/evidence/hair-2026-09-25/lock-wiring/summarize.py
node tmp/hair-sep25/lock-wiring/plate-differences.mjs
```

Wait for each GPU command to finish before starting the next. The Python verifier reads the
prior finiteness archive for identity proof. Exact next steps and
promotion limits are in [the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md).
