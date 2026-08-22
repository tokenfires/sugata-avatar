# R31 — the strand-count-to-millisecond ladder for OUR groom in THEIR renderer

Machine: Apple M5 Max, 40-core GPU. Renderer: the frostbitten-hair-webgpu clone in the
session scratchpad, at upstream `4478dd1` plus the harness files in `tools/`.
Everything below was measured 2026-08-22 with exclusive use of the GPU.

## How to read every number here

* **All timings are `ms/frame`, wall-clock over a batch of 40 frames encoded back-to-back
  into ONE command buffer with ONE submit and ONE `onSubmittedWorkDone`, divided by 40.**
  This is the previous agent's `index.timing.ts` method, inherited unchanged; it is
  batch-size independent from BATCH=16 up.
* **All figures are MINIMA over 7 such batches**, never means.
* **Every arm is round-robined inside ONE process** — 12 grooms x 6 arms plus 4 extra arms,
  76 configurations, all in a single Deno process per resolution. Process-to-process drift
  on this machine is ~11%, larger than most of the differences extracted here, so a
  cross-process comparison would not have been measurable.
* **The contention gate** is a fixed compute workload (8 dispatches x 256 workgroups x 64
  threads x 4096 fma) that touches nothing the renderer touches, run once per repeat round.
  It is printed beside every table. 720x900 run: min 14.430 ms, spread 12.20% of min,
  seven of eight rounds inside 3%. 1920x1080 run: min 13.617 ms, spread 18.83%.
* **The author's per-pass GPU timestamps are NOT used.** Their render-pass scopes are
  inflated on this TBDR GPU (their medians sum to 23.14 ms for a 4.45 ms frame). Everything
  here is ablation: display-mode and LOD differences of whole frames.
* Pixel statistics state their mask. The hair mask is exact, not thresholded off a beauty
  render: each plate is rendered twice, once in the control's brown and once with the hair
  albedo forced to pure green, and the mask is `G > R + 12` on the 8-bit sRGB PNG. Skin and
  background in this scene are achromatic, so nothing else can forge that condition.
* Repeatability: two independently-built grooms of the same strand count (`bob4960`, a real
  export, and `strat4960`, a stratified draw from the 11,408 export) agree to **2.0%** on
  LOD-gated hair cost. Treat 2% as this ladder's noise floor.

## Harness validation: their reference ladder, reproduced in this process

Their published Sintel ladder was taken in a different process at a different time, so it
cannot be compared to our numbers directly — running their own `index.timing.ts` unmodified
at the start of this session gave 5.27 ms for the arm they recorded as 4.32, i.e. the machine
was 22% slower at that moment. That is exactly why the Sintel groom is carried as a twelfth
groom inside our own process. Its row there:

| group | their published | this harness, in-process | delta |
|---|--:|--:|--:|
| whole frame + sim | 4.319 | 4.4608 | +3.3% |
| sim | 0.337 | 0.3078 | −8.7% |
| sw OIT | 0.695 | 0.6813 | −2.0% |
| binning | 0.708 | 0.7414 | +4.7% |
| hw raster + shading | 0.858 | 0.9406 | +9.6% |
| floor (mode3 lod0) | 1.720 | 1.7897 | +4.1% |

Every group agrees within 10% and four of six within 5%. **All ratios in this document are
taken against the in-process Sintel row, never against the published numbers.**

One process not belonging to this task was running on the machine throughout
(`experiments/exp9-pool/learnability_test.py`, 11.6% of one core, CPU only). It was left
alone rather than killed. The contention gate is the record of what that cost.

## Pass groups

`MODE` is `CONFIG.displayMode`; `cmdDrawScene()` in `renderer.ts` branches on it.

| group | ablation | passes |
|---|---|---|
| whole frame + sim | mode0 sim1 lod100 | everything |
| sim | (mode0 sim1) − (mode0 sim0) | gridPreSim, hairSimIntegration, gridPostSim |
| sw OIT | (mode0 sim0) − (mode1 sim0) | hairTileSort, hairFine |
| binning | (mode1 sim0) − (mode3 sim0) | clears, hairTiles, hairCombine |
| hw raster + shading | (mode3 lod100) − (mode3 lod0) | shadowmap-hair, hwHair (LOD-gated part) |
| LOD-0 residual | mode3 lod0 | scene floor **plus hairShadingPass**, see the defect below |
| LOD-gated hair total | (mode0 sim0 lod100) − (mode0 sim0 lod0) | all hair work the LOD knob controls |

### Defect found in the inherited ladder: LOD=0 is not zero hair

`hairShadingPass.cmdComputeShadingPoints` dispatches over `hairObject.strandsCount`
(`hairShadingPass.ts:57`), **not** `getRenderedStrandCount()`. The LOD knob does not gate it.
So the arm the previous agent reported as "floor 1.720" is not a floor: it contains a compute
pass whose cost scales with the groom's total strand count. Measured, at 720x900:

* true scene floor, a 16-strand groom at mode3 lod0: **0.7832 ms**
* the same arm on the 11,400-strand Sintel groom: **1.7897 ms**
* the same arm on our 24,800-strand groom: **4.5920 ms**

So **1.006 ms of their published 1.720 ms "floor" is hairShadingPass**, and the arm is
groom-dependent by a factor of 5.9 across the grooms tested. Two consequences:

1. Their reported slope of 0.1159 ms per 1000 strands, obtained by sweeping LOD on one
   groom, **excludes hairShadingPass's per-strand cost entirely** — it is held constant at
   the full count in every point of their sweep.
2. Every per-groom figure in this document differences a groom against **itself** at lod0,
   so the un-gated term cancels and the "LOD-gated hair total" column is clean.

## 1. The ladder

### 720x900 — contention gate min 14.430 ms, spread 12.20%

true scene floor (16-strand groom, mode3 lod0): **0.7832 ms**

| groom | strands | whole+sim | sim | sw OIT | binning | hw+shad | LOD0 resid | hair total |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| bob496 | 496 | 1.9478 | 0.2070 | 0.3499 | 0.4885 | 0.0838 | 0.8186 | 0.8652 |
| bob992 | 992 | 2.1845 | 0.2007 | 0.4494 | 0.4803 | 0.1117 | 0.9425 | 0.9433 |
| bob2480 | 2480 | 2.9782 | 0.1954 | 0.7069 | 0.5917 | 0.3782 | 1.1060 | 1.5695 |
| bob4960 | 4960 | 4.2613 | 0.2504 | 0.8806 | 0.9323 | 0.6848 | 1.5132 | 2.3825 |
| bob11408 | 11408 | 7.1390 | 0.3560 | 1.1854 | 1.7377 | 1.3669 | 2.4929 | 4.2149 |
| bob24800 | 24800 | 12.8545 | 0.6931 | 1.3922 | 3.3815 | 2.7957 | 4.5920 | 7.4521 |
| **sintel11400** | 11400 | 4.4608 | 0.3078 | 0.6813 | 0.7414 | 0.9406 | 1.7897 | 2.2349 |

### 1920x1080 — contention gate min 13.617 ms, spread 18.83%

true scene floor: **0.8955 ms**

| groom | strands | whole+sim | sim | sw OIT | binning | hw+shad | LOD0 resid | hair total |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| bob496 | 496 | 2.3817 | 0.1654 | 0.4500 | 0.7002 | 0.1330 | 0.9331 | 1.1100 |
| bob992 | 992 | 2.5699 | 0.1350 | 0.5900 | 0.6767 | 0.1380 | 1.0301 | 1.2770 |
| bob2480 | 2480 | 3.4919 | 0.1603 | 0.8792 | 0.8761 | 0.3368 | 1.2395 | 1.9001 |
| bob4960 | 4960 | 4.9353 | 0.2599 | 1.0887 | 1.3061 | 0.6475 | 1.6331 | 2.8847 |
| bob11408 | 11408 | 8.0808 | 0.4216 | 1.3823 | 2.3191 | 1.3701 | 2.5877 | 4.9546 |
| bob24800 | 24800 | 14.1961 | 0.7165 | 1.7726 | 4.3987 | 2.8132 | 4.4951 | 8.7667 |
| **sintel11400** | 11400 | 4.6980 | 0.3904 | 0.7104 | 0.8976 | 0.7676 | 1.9320 | 2.2045 |

### Slopes on OUR ladder (genuinely different exports, not prefixes)

| resolution | quantity | ms / 1000 strands | intercept | R² |
|---|---|--:|--:|--:|
| 720x900 | whole frame, mode0 sim0 | 0.4272 | 1.6964 | 0.9982 |
| 720x900 | LOD-gated hair only | 0.2716 | 0.8612 | 0.9948 |
| 1920x1080 | whole frame, mode0 sim0 | 0.4625 | 2.1537 | 0.9980 |
| 1920x1080 | LOD-gated hair only | 0.3144 | 1.1168 | 0.9959 |

Linear across the whole 496–24,800 range, R² ≥ 0.998. Note the whole-frame slope is **3.7x
their published 0.1159**, and the two are not comparable: theirs holds hairShadingPass fixed
(see the defect above) and thins by prefix; ours varies everything a real density change
varies. The like-for-like comparison is in §4.

## 2. Our groom vs their Sintel groom at matched strand count

11,408 vs 11,400 — within 0.07%. Both in the same process, same camera, same frame.

| group | sintel 11,400 | ours 11,408 | ratio | | sintel @1080 | ours @1080 | ratio |
|---|--:|--:|--:|--|--:|--:|--:|
| whole frame + sim | 4.4608 | 7.1390 | **1.600x** | | 4.6980 | 8.0808 | **1.720x** |
| sim | 0.3078 | 0.3560 | 1.157x | | 0.3904 | 0.4216 | 1.080x |
| sw OIT | 0.6813 | 1.1854 | 1.740x | | 0.7104 | 1.3823 | 1.946x |
| binning | 0.7414 | 1.7377 | 2.344x | | 0.8976 | 2.3191 | 2.584x |
| hw raster + shading | 0.9406 | 1.3669 | 1.453x | | 0.7676 | 1.3701 | 1.785x |
| LOD-gated hair total | 2.2349 | 4.2149 | 1.886x | | 2.2045 | 4.9546 | 2.247x |

### Named: our groom is bigger, not denser

At the same strand count and the same 16 points per strand:

| | sintel 11,400 | ours 11,408 | ratio |
|---|--:|--:|--:|
| mean arc length per strand | 0.1031 m | 0.2320 m | **2.250x** |
| total curve length | 1,175.8 m | 2,646.8 m | **2.251x** |
| mean segment length | 6.88 mm | 15.47 mm | 2.249x |
| segment length in px at head depth (~1578 px/m) | 10.9 px | 24.4 px | 2.249x |
| screen coverage, front view, green-key mask `G>R+12` | 60,000 px (9.26%) | 160,459 px (24.76%) | **2.674x** |
| same at `G>R+24`, to show the ratio is not a threshold artefact | 56,289 px | 152,798 px | 2.714x |
| mean overdraw (curve px x 2 px width / covered px) | 61.9 | 52.1 | 0.84x |
| groom bbox X x Y x Z | 0.219 x 0.279 x 0.264 m | 0.420 x 0.364 x 0.258 m | — |

**The cost difference is arc length and screen area, not density and not depth complexity.**
Our overdraw is if anything *lower* than theirs. The binning group — `hairTiles`, which
scatters each segment into every tile it touches — tracks the 2.25x arc-length ratio almost
exactly (2.34x at 720x900). Their groom is a compact high-overdraw mass in 9% of the frame;
ours is a wide bob across 25% of it, made of strands 2.25x longer.

Second-order term, worth naming because it is the part arc length does *not* explain: at
**matched total arc length** (bob4960 = 1,147 m vs sintel11400 = 1,176 m) our groom still
costs 1.31x (2.8847 vs 2.2045 ms at 1080p). The remaining factor is screen area — 21.9% vs
9.3% coverage for the same curve length — which is a per-covered-tile cost in the tile
clears, sort, and fine pass, not a per-segment one.

Cost per metre of curve, LOD-gated hair total, 1920x1080: sintel **1.875 µs/m**,
bob11408 **1.872 µs/m**. At this resolution the two grooms are, to three digits, the same
renderer eating the same amount of curve.

## 3. WHAT STRAND COUNT DOES OUR BOB ACTUALLY NEED?

Rendered at each density, three azimuths (front, 40°, profile), 720x900, guide curves only —
no interpolated children. Reference for the outline is the 24,800-strand export.
`coverage` = hair pixels; `solidity` = hair pixels falling inside the reference's filled
silhouette, as a fraction of that silhouette's area — the "can you see through it" number;
`outline IoU` = intersection-over-union of the FILLED silhouette (close r=6 px, then flood-fill
holes from the border) against the reference's.

| strands | front IoU | 40° IoU | profile IoU | front solidity | profile solidity | 720p ms | 1080p ms |
|--:|--:|--:|--:|--:|--:|--:|--:|
| 496 | 0.8016 | 0.8711 | 0.7859 | 0.320 | 0.316 | 1.948 | 2.382 |
| 992 | 0.8687 | 0.9015 | 0.8656 | 0.424 | 0.482 | 2.185 | 2.570 |
| 2,480 | 0.9232 | 0.9300 | 0.9273 | 0.566 | 0.679 | 2.978 | 3.492 |
| **4,960** | **0.9339** | **0.9487** | **0.9540** | 0.646 | 0.793 | **4.261** | **4.935** |
| 11,408 | 0.9574 | 0.9705 | 0.9708 | 0.731 | 0.881 | 7.139 | 8.081 |
| 24,800 | 1.0000 | 1.0000 | 1.0000 | 0.797 | 0.934 | 12.855 | 14.196 |

IoU between *consecutive* densities, which needs no reference groom at all:

| step | front | 40° | profile |
|---|--:|--:|--:|
| 496 → 992 | 0.8980 | 0.9584 | 0.8723 |
| 992 → 2,480 | 0.9274 | 0.9605 | 0.9264 |
| 2,480 → 4,960 | 0.9427 | 0.9704 | 0.9507 |
| 4,960 → 11,408 | 0.9609 | 0.9702 | 0.9734 |
| 11,408 → 24,800 | 0.9574 | 0.9705 | 0.9708 |

**The answer: 4,960.** From 4,960 upward the consecutive-step IoU stops rising — 0.96–0.97
for every further 2.3x in density, which is the band inside which two independent exports of
the same groom already differ. The silhouette has stopped converging and started drifting.
Below 4,960 it is still genuinely moving (0.87→0.93→0.95 in profile). The eye agrees with
the number: at 992 and 2,480 the chest and shoulder read straight through the hair mass;
4,960 is the first density that reads as hair rather than as strings.
See `plates/beauty-00992-az00.png`, `beauty-02480-az00.png`, `beauty-04960-az00.png`.

11,408 buys +2.4 percentage points of front-view outline IoU and +0.085 of solidity for
**+2.88 ms at 720x900 and +3.15 ms at 1080p — a 40% larger frame**. It was chosen to match
frostbitten's shipped count. Nothing in this measurement supports it.

### The cheaper lever: fibre radius is free

`solidity` never saturates at any tested density — even 24,800 guide curves reach only 0.797
front-view. **Density is the wrong knob for opacity.** Fibre radius is the right one, and on
this pipeline it costs nothing measurable:

| configuration | coverage px | solidity | outline IoU | 720x900 ms |
|---|--:|--:|--:|--:|
| 4,960 @ radius x1.0 | 141,832 | 0.646 | 0.9339 | 4.2322 |
| 4,960 @ radius x1.35 | 150,080 | 0.683 | 0.9370 | 4.2176 |
| 4,960 @ radius x1.6 | 154,341 | 0.702 | 0.9378 | 4.2255 |
| **4,960 @ radius x2.0** | **160,039** | **0.726** | 0.9387 | **4.1921** |
| 11,408 @ radius x1.0 | 160,459 | 0.731 | 0.9574 | 7.0487 |
| 24,800 @ radius x1.0 | 174,488 | 0.797 | 1.0000 | 12.7279 |

Doubling `CONFIG.hairRender.fiberRadius` moved the frame by −0.9% at 4,960 and +1.5% at
11,408 — both inside the 2% noise floor. **4,960 strands at radius x2 reproduces the
11,408-strand groom's coverage and solidity to within 0.3%, at 4.19 ms instead of 7.05 ms.**
The pipeline is bound by per-segment binning and per-tile sorting, not by fragment coverage,
so widening fibres is free and adding strands is not. Outline IoU is the one thing radius
cannot buy (0.9387 vs 0.9574) — fringe silhouette needs strands in the right places.

Recommendation: **4,960 strands, fibre radius x2.0**, saving 2.86 ms/frame at 720x900 and
~3.1 ms at 1080p against the current 11,408 with no visible loss except a slightly softer
fringe. See `plates/beauty-r2.0-04960-az00.png` against `plates/beauty-11408-az00.png`.

## 4. The prefix-LOD artefact, measured

Their LOD takes the first `ceil(N * pct/100)` strands (`hairObject.ts:52-57`) — a prefix of
the file, not a spatially stratified thinning. **Our ladder does not have that defect: the
six `.tfx` files are independent exports of the same groom at six densities, each one a
fresh, spatially complete emitter solve.** Verified: the bounding boxes agree across all six
to within 9 mm, and mean arc length agrees to 0.35% (0.2313–0.2321 m).

To size the artefact, both thinnings were run on the SAME source groom (the 11,408 export)
in the SAME process. Each is differenced against its own lod-0 arm, so the un-gated
hairShadingPass term cancels on both sides and only LOD-gated hair work remains.

720x900:

| strands | prefix Δms | stratified Δms | prefix / stratified |
|--:|--:|--:|--:|
| 496 | 0.4831 | 0.7464 | **0.647** |
| 992 | 0.5490 | 0.9367 | **0.586** |
| 2,480 | 1.6832 | 1.4840 | 1.134 |
| 4,960 | 2.2924 | 2.3356 | 0.981 |
| 11,408 | 4.2149 | 4.2149 | 1.000 (same object) |

1920x1080:

| strands | prefix Δms | stratified Δms | prefix / stratified |
|--:|--:|--:|--:|
| 496 | 0.5343 | 1.0343 | **0.517** |
| 992 | 0.6284 | 1.3087 | **0.480** |
| 2,480 | 1.9503 | 1.8966 | 1.028 |
| 4,960 | 2.7780 | 2.8760 | 0.966 |

| resolution | prefix slope | stratified slope | ratio |
|---|--:|--:|--:|
| 720x900 | 0.3388 ms/1000 (R² 0.972) | 0.3164 ms/1000 (R² 0.997) | 1.071x |
| 1920x1080 | 0.4019 ms/1000 (R² 0.970) | 0.3552 ms/1000 (R² 0.996) | 1.131x |

**The artefact is not a uniform bias, and the previous agent's read of it is only half
right.** At low percentages the prefix is *cheaper* than the truth by up to a factor of two
(0.48x at 992 strands / 1080p), because the prefix block is spatially clustered and covers
far less screen. The slope is then steeper than the truth — 1.07x at 720x900, 1.13x at
1080p — because it has to climb from an artificially low start to the same fixed endpoint.
So: their **slope** is an upper bound by 7–13%, but their **low-count points are lower
bounds by up to 2x**, and the R² of their linearity claim is inflated by neither. The
stratified ladder is the better-behaved one on every measure (R² 0.996–0.997 vs 0.970–0.972).

## 5. The fixed-cost knee

Theirs: 0 → 114 strands cost 0.606 ms while 114 → 11,400 cost 1.562 ms, so two thirds of the
low-count cost was fixed setup. **Ours is nothing like that**, because our lowest genuine
density is 496 and because a proper hairless floor is now available:

720x900, mode0 sim0, minima:

| | ms |
|---|--:|
| true scene floor (16-strand groom) | 1.2312 |
| 0 → 496 strands | +0.5096 |
| 496 → 11,408 strands | +5.0421 |

* the first 496 strands cost **9.2%** of the 0 → 11,408 hair bill
* the hairless scene is **18.2%** of the 11,408-strand frame, and **70.7%** of the
  496-strand frame (1080p: 19.6% and 67.7%)
* 1920x1080: floor 1.5013 ms, 0→496 costs +0.7150, 496→11,408 costs +5.4428; the first 496
  strands are **11.6%** of the hair bill

**There is no knee on our ladder.** The regression is linear from 496 to 24,800 with
R² 0.998 and no curvature; the previous agent's "two thirds is fixed setup" was an artefact
of sampling their ladder at 114 strands *by prefix*, where §4 shows the prefix under-reports
by roughly 2x. The honest statement for our groom is a fixed cost of **1.70 ms at 720x900 /
2.15 ms at 1080p** (the whole-frame regression intercept, which agrees with the measured
16-strand floor of 1.23/1.50 ms plus the hairShadingPass term the intercept also absorbs)
and a marginal cost of **0.427 / 0.463 ms per 1000 strands**.

## Files

* `data/ladder-720x900.json`, `data/ladder-1920x1080.json` — every arm, every repeat, gate
* `data/fibre-radius-720x900.json` — the radius sweep
* `data/silhouette.json`, `data/groom-geometry.json`, `data/ladder-report.txt`
* `tools/index.ladder.ts` — the multi-groom, single-process harness (drop into `src/`)
* `tools/index.plate.ts` — one groom, one mode, one PNG, with the green-key knob
* `tools/tfx_xform.py` — rigid registration into the Sintel scene frame (translation only:
  +0.00161, −0.01803, −0.03996 m; max arc-length change 1.2e-8 m across all six densities)
* `tools/tfx_subset.py` — prefix vs stratified subsetting
* `tools/silhouette.py`, `tools/pngread.py`, `tools/report.py`, `tools/run.sh`, `tools/plates.sh`
* `plates/` — beauty renders, front and profile, every density, plus the radius sweep

## What was NOT established

* Whether the 24,800-strand export is itself converged. Coverage was still rising 1.05
  px/1000 strands at the top of the ladder and the filled silhouette still grew 1–2.6% over
  the last 2.2x step. The outline IoU numbers in §3 are against a reference that is close to
  but not at the limit, which is why the consecutive-step table is given alongside.
* Anything about a groom with interpolated children. Everything here is guide curves.
  Density economics change completely once children exist, and `solidity` never saturating
  is the sign that the shipped groom is missing them.
* Whether the registration translation is the *correct* one for the Sintel head — it was
  inherited from the previous agent's `.reg` files and only verified to be rigid and
  shape-preserving, not anatomically right.
