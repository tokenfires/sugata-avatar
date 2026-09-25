# Native resolve buffers remain finite

Starting from `9d5700e208987b2379e79930ee2a15dcda9c45b4`, this audit tests the preceding
source-level hypothesis that the zero-luminance denominator in `thinFeature` produces nonfinite
buffered state. **No NaN or infinity is reproduced** in the sampled native resolve, color-history
or lock-history buffers. No denominator guard is proposed or installed. This result is scoped to
these buffers and this GPU; it does not establish that all intermediate expressions are finite.

Nine actual Apple/Metal WebGPU cases cover shared-half, temporal-only half and swapped/distinct
half cards at phases 0/977, plus opaque, absent-card and sorted-blend controls. Every case has
512 frames with the same clock, camera, geometry, default TAAU scale 0.66, and fixed 12,544-pixel
ROI as the preceding fixture. The materials are constant-alpha basic materials, not the fibre
BSDF or real groom. No shader, dependency, asset, calibration, setting or threshold changes.

After each draw, the instrument reads native buffers through the observed TAAU owner. All three
are 256×256 RGBA16F textures, returned as `Uint16Array` binary16 bit patterns. It classifies all
four components in the full frame and ROI, independently of the ordinary RGBA8 readback. The
decoder has positive/negative zero, subnormal, normal, maximum-finite, infinity and NaN checks.
Planted NaNs/infinities inside and outside a synthetic ROI prove the counters reject them rather
than interpreting the bit patterns as finite integers.

The resolve and copied color-history buffers are bit-identical on every frame, as expected after
the renderer's copy; this is not an independent reference capture. Every native finite component
rounds to the observed ordinary RGBA8 code value exactly (maximum observed error zero). The
instrument permits one code value for that conversion check, separate from any appearance gate.

| Half-pair arm | Native last-64 ROI mean, phase 0 / 977 | RGBA8 last-64 ROI mean, phase 0 / 977 |
| --- | --- | --- |
| Shared field/rate | 0.481219 / 0.481228 | 0.481269 / 0.481275 |
| Distinct rates only | 0.029858 / 0.031807 | 0.029851 / 0.031796 |
| Swapped field, distinct rates | 0.118750 / 0.118963 | 0.118749 / 0.118962 |

The independent half-pair reference is 0.25. The blend control's native last-64 mean is
0.249999886; its RGBA8 value is 0.250980392. The severe dark bias therefore exists in the native
resolve before RGBA8 conversion. The opaque control has native ROI mean exactly zero on every
frame. Absent-card native ROI means range from 0.999993928 to 1, while every ordinary ROI pixel
remains exactly white. The initial verifier incorrectly required exact native white; it now
records those sub-code-value differences and retains the exact ordinary endpoint and native-to-
byte checks. No appearance threshold changed.

Across the final run, 3,623,878,656 full-frame components are examined, with zero nonfinite values.
The 693,633,024 ROI component observations are a subset of that total. These are repeated buffer
observations, not independent samples or additional tests. Native frame-by-frame counts and
finite ranges are retained in `case-records.jsonl`.

The audit also observes a separate attachment-wiring discrepancy worth testing next. The live resolve
target has **one attachment**, while history has two. The installed source emits color and lock
members, samples the previous lock, and copies only resolved color into history. Lock history
is identically zero in every sampled frame. `lock-wiring-audit.json` pins the inspected source,
installed version, exact lines and observed topology. The effect of adding the missing resolve
attachment and copying its lock into history is **untested**; this audit does not attribute the
hair bias to that wiring or qualify such a change.

Validation:

- All nine native-buffer runs complete with clean browser/console/HTTP checks and verified
  formats, owner, mask, live sequence/field, clock, source and accepted-asset hashes.
- Every original frame trace, per-pixel temporal mean and all 27 ordinary checkpoint images
  match the preceding spatial-field fixture exactly. Additional readback does not change output.
- A six-case, 24-frame pilot initially checks native formats/finiteness. Adding the native-to-byte
  comparison prompts a serial repeat with the final instrument. Both pilots reproduce all common
  first-24 traces and images; the final pilot also reproduces the added comparison fields exactly.
- Binary16 decoder/counter tests, script syntax and the evidence verifier pass. All GPU jobs are
  serialized and have exited. No geometry, motion, cost, build or full-suite acceptance is claimed.

`summary.json` records scoped findings, native metadata, counts, image hashes and per-pixel-array
hashes (little-endian float64). Native arrays are inspected in the browser and summarized per
frame; they are not retained in full. Ordinary full per-pixel temporal means remain in scratch.
Both pilot records, source hashes, initial instrument and all 27 ordinary RGBA8 PNG plates are
archived. `manifest.json` hashes every other archive file. PNG grayscale is linear diagnostic
output without a display transfer.

Replay from the repository root after verifying the source hashes in `summary.json`:

```sh
mkdir -p tmp/hair-sep25/resolve-finiteness
cp docs/evidence/hair-2026-09-25/resolve-finiteness/fixture.html tmp/hair-sep25/resolve-finiteness/
cp docs/evidence/hair-2026-09-25/resolve-finiteness/fixture.js tmp/hair-sep25/resolve-finiteness/
cp docs/evidence/hair-2026-09-25/resolve-finiteness/capture.mjs tmp/hair-sep25/resolve-finiteness/
cp docs/evidence/hair-2026-09-25/resolve-finiteness/half-audit.mjs tmp/hair-sep25/resolve-finiteness/
node docs/evidence/hair-2026-09-25/resolve-finiteness/half-audit.test.mjs
CASES=shared-half,swapped-distinct-half,opaque-pair,blend-half FRAMES=24 RUN_NAME=pilot node tmp/hair-sep25/resolve-finiteness/capture.mjs
node tmp/hair-sep25/resolve-finiteness/capture.mjs
```

Wait for each GPU command to finish before the next. The archived `summarize.py` also reads the
preceding spatial-field archive and original `initial-pilot` scratch/source files for the repeat
proof; it needs that history to rerun all checks. `validation.txt` preserves its completed result.
See [the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md) for the next bounded step.
