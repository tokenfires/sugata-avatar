# Overlapping layers share their coverage decision

This isolated fixture confirms a defect in the current stochastic coverage rule relative to
independent-layer alpha compositing. It starts from `4f12a97333662a214ba7d1d28526295b2a920830`
and changes no production source or asset. Black, constant-alpha cards use the real
`configureHairMaterial` function over an opaque white body plane. They are unlit basic node
materials, not the fibre BSDF or real groom. The result establishes the mechanism in this
fixture; it does not measure how much of the real groom's C4 failure it explains.

At one pixel the threshold depends on screen coordinates and a shared frame offset. Two
overlapping cards therefore accept or reject against the same threshold. In the uniform
sampling limit, their transmission is `1 - max(alpha1, alpha2)`, whereas the independent-layer
reference is `(1 - alpha1) * (1 - alpha2)`.

| Card alphas | Unfiltered 128-frame mean | Shared-threshold prediction | Independent-layer reference |
| --- | --- | --- | --- |
| 0.25 + 0.25 | 0.749994 | 0.75 | 0.5625 |
| 0.50 + 0.50 | 0.499992 | 0.50 | 0.2500 |
| 0.75 + 0.75 | 0.250004 | 0.25 | 0.0625 |
| 0.25 + 0.75 | 0.250004 | 0.25 | 0.1875 |

Every equal-alpha pair exactly reproduces its single-card control: all 128 frame means, all
12,544 per-pixel temporal means and the entire final image match. The result survives reversal
of mesh render order and a two-card **single indexed mesh**, including reversed triangle order.
Live offset values are equal across the separate materials. This rules out a fixture limited
to one object or one submission order.

The 38-case final run includes raw forward rendering and TAAU with its default 0.66 scene
scale. Linear RGBA8 targets omit output transfer, tone mapping, grading and AO for this
measurement. TAAU keeps its scene pass, depth, velocity, history and normal resolve behavior.
The geometry-derived mask is the intersection of both projected quads, eroded by eight pixels,
at output coordinates `[72,184) × [72,184)`. It is fixed across every case; no image threshold
selects the measured pixels. The camera and geometry are static and the renderer clock advances
exactly once per draw, from 1 through 128, with time and delta pinned to zero.

Zero-alpha, no-card and front-opaque-body controls are uniformly 1; the opaque-card endpoint
is uniformly 0, for every frame in both paths. At frame 128, sorted-blend references produce 0.501961
for a half-opacity card, 0.250980 for two and 0.188235 for the mixed pair, within one RGBA8
quantization step of the analytic references. Sorted blend is a diagnostic here, not a proposed
runtime replacement. These black cards have no color-order ambiguity.

TAAU does not recover the missing layer opacity. Its equal-half single/pair controls still
match exactly: mean 0.485466 across 128 frames and 0.481629 at frame 128. The blend pair remains
0.250980. The unequal-alpha case has a small post-resolve difference from its single-card
control; exact equivalence is claimed only for the equal-alpha and order/mesh controls. The
128-frame averages include startup history; neither those nor the final frame prove convergence.

Two additional arms use only the existing per-material phase handle. They show why assigning
a different **fixed phase** is not enough to guarantee independent coverage. For half-opacity
cards, phases 0/1 transmit 0.118025 in the raw mean; phases 0/977 transmit 0.319203, against the
same 0.25 independent reference. Their shared-recurrence predictions are 0.118034 and 0.319207.
At TAAU frame 128 the values are 0.028154 and 0.298912, respectively. The strong resolve effect
on the first arm is another reason a raw sampling improvement cannot qualify a shipping change.
Neither fixed-phase arm is proposed for promotion.

An initial four-case raw pilot established the readback and half-pair result. The first full
run contained 34 cases. After adding the fixed-phase controls, the final run repeats all 34
with identical per-frame traces, per-pixel temporal means and final images, then adds four new
cases. All GPU jobs ran serially and completed on Apple/Metal WebGPU. Browser, console and
HTTP error checks were clean. JavaScript/Python syntax and the evidence verifier pass. No
motion, asset geometry, cost, build or full runtime suite was repeated for this isolated fixture.

`case-records.jsonl` retains each final case's configuration, live pipeline/material flags,
geometry projection, all 128 frame measurements and offsets, and final image hash. `summary.json`
also hashes the full per-pixel mean arrays (little-endian float64); those arrays remain in the
scratch JSON files and can be regenerated. `first-run-hashes.json` binds the preceding 34-case
image and frame traces. All 38 final plates are archived under `plates/`; their grayscale values
are **linear diagnostic values**, without a display transfer. `manifest.json` hashes this archive.

Replay from the repository root after checking the production source hashes in `summary.json`:

```sh
mkdir -p tmp/hair-sep25/layer-correlation
cp docs/evidence/hair-2026-09-25/layer-correlation/fixture.html tmp/hair-sep25/layer-correlation/
cp docs/evidence/hair-2026-09-25/layer-correlation/fixture.js tmp/hair-sep25/layer-correlation/
cp docs/evidence/hair-2026-09-25/layer-correlation/capture.mjs tmp/hair-sep25/layer-correlation/
RUN_NAME=final-captures node tmp/hair-sep25/layer-correlation/capture.mjs
```

The archived `summarize.py` additionally compares against the original first-run scratch files;
it needs that history to reproduce the serial-repeat proof. Its recorded output is
`validation.txt`. Normal capture/verifier exits are zero. The next bounded step is recorded in
[the overnight checkpoint](../../../PROGRESS-2026-09-24-OVERNIGHT.md). Accepted grooms and all
four existing red gates remain unchanged.
