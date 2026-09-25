# Sugata — September 24–25 overnight continuation

At the 22:00 Pacific deadline, Robert reported a MacBook crash and explicitly authorized
continuing Sugata overnight, with a morning sync. This supersedes the earlier 22:00 stop.
The existing `advance-sugata-avatar-visual-quality` heartbeat remains in this task at its
45-minute cadence. The morning checkpoint is **08:00 America/Los_Angeles on September 25,
2026 (15:00 UTC)** unless Robert supplies a different time. At or near that deadline, save the
handoff, finish or safely stop jobs, detach the isolated Blender mount and pause the automation.
Do not start another substantial step after the deadline. All previous asset, test and scope
boundaries remain: no agents, model changes, reset credits or unrelated worktree changes.

## Recovery checkpoint

Recovery starts from clean `292112b` on `codex/resolve-eleven-gates`, matching origin and draft
[PR #3](https://github.com/tokenfires/sugata-avatar/pull/3). The five September 24 bites are saved
in [the daytime progress note](PROGRESS-2026-09-24.md); no interrupted build, capture or test job
was found. The ribbon-shape and layer-attribution evidence manifests verify all 45 and 38 files
respectively. The unrelated detached worktree remains at `2087931` and is untouched.

The earlier Blender image was no longer mounted. The cached Blender 5.2.2 ARM64 DMG again
matches SHA-256 `dc4125399b8bfefe283cc1624d6cfc7809d1cac20ace51072127eb371f31f210` and is
remounted read-only at `tmp/hair-sep24/blender-volume`, using the existing isolated
`BLENDER_USER_RESOURCES=tmp/hair-sep24/blender-profile`. No normal application or profile was
changed. The reported crash's cause has not been investigated or established by this task.

## First experiment: narrower ribbons at double density — rejected

Starting from recovery commit `872fb12`, crop01/g050 was rebuilt with twice each layer's card
count and half its authored half-width. The exact candidate is
`dc8cac9ab998c149b7f7eed282a0d53d541822e446a022d39bace027ec1df2e7`, isolated under
`tmp/hair-sep24/narrow-density/double/hair/crop01/g050.glb`. No cap, clearance-direction or
root-cut candidate was combined with it. **Rejected; no production code or asset changes.**

The unchanged rebuild matches all shipping card and cap payloads, including normals, UVs,
joints, weights and component-local indices. Both embedded images and material definitions
match. The recipe comparison requires exactly two field changes per layer: `cards × 2` and
`half_width / 2`; all 24 lock positions and random habits match exactly. More cards change root
sampling and per-card RNG consumption, so individual roots and details are not held fixed.
The candidate preserves both cap shells and exported lock metadata.

| Measurement | Shipping | Double count / half width | Existing requirement |
| --- | --- | --- | --- |
| Cards | 384 | 768 | ≥100 |
| Gather index | 0.919 | 0.884 | ≤0.81 |
| Coherent relief / required floor | 1.18 / 2.64 mm | 0.83 / 1.94 mm | relief ≥ floor |
| Largest normal-ray bald patch | 109.7 mm² | 87.6 mm² | ≤50 mm² |
| Worst visible patch | 105.9 mm², side | 111.7 mm², three-quarter | ≤60 mm² |
| Minimum vertex clearance | 3.501 mm | 3.500 mm | ≥3 mm |
| Deepest view, median cards crossed | 7 | 6 | ≤18 |
| Ribbon triangle area, ignoring alpha | 0.466558 m² | 0.381023 m² | diagnostic only |

Both verifier commands exit 1 with the same four failed clauses. Actual ribbon area falls
**18.33%** despite unchanged nominal count-times-width. This recipe therefore does not conserve
rendered coverage or even triangle area. The changed sampling and nonlinear geometry/clamping
prevent attributing that difference to one mechanism without another control.

All five rest views were inspected. The smaller cards still read as overlapping plates, with
strong broken highlights and a more separated fringe. The back has smaller patches but no
convincing continuous locks. The candidate's sampled moving image retains those defects.
Neither the numerical changes nor the visual result justify promotion.

Real Apple/Metal WebGPU capture passes existing segment-length and fitted-skull constraints at
41 sampled states across four seconds of shake per arm. Candidate maximum segment error is
0.000111 mm and fitted-skull penetration 0.000061 mm; sampled positions/velocities are finite.
All five independently captured body-only images match exactly between arms. Camera, head pose
and capture-clock controls pass. These are `hair.html` PBR/fitted-sphere checks, not public
Avatar HairMaterial, full-body contact or all-motion qualification.

GPU cost was measured on four separate pages in **shipping, candidate, candidate, shipping**
order, after the motion capture finished. Each has 60 warmup frames, 120 measured frames and
eight separate 64-frame dispatch batches. Every measured frame has two substeps in one compute
call. Compute p50 is 0.179706 / 0.025915 / 0.031708 / 0.031415 ms, all under the existing
0.25 ms X-gate budget. Render p50 is 1.703057 / 0.113412 / 0.196032 / 0.152909 ms. The first
shipping run is much slower than its closing control; compute p95 reaches 1.484644 ms and render
max reaches 171.685007 ms there. **The cost difference is inconclusive; these runs do not show
that doubling cards is cheaper.** Raw samples, tails and amortized dispatch readings are retained.
The latter exclude per-pass overhead and are not the statistic used by the existing X gate.

Recipes, boundary checks, exact hashes, native plates and reports are in
[narrow-density evidence](evidence/hair-2026-09-24/narrow-density/). GPU jobs ran serially and all
have exited. The isolated Blender image stays mounted for the authorized overnight window.
No full suite or production build was repeated for this experiment-only checkpoint.
Request-ledger checks pass 27/27 and quoted-number checks pass 25/25; script syntax and all
31 archived evidence-file hashes verify. These checks do not turn the rejected groom into a pass.

The four existing red gates remain HairMaterial, GLB verification, opacity and tips. No groom
geometry was promoted during the afternoon/evening work. The runtime suite's earlier full run
remains historical; use the focused evidence recorded for each accepted repair.

## Second experiment: material attribution on fixed geometry

Starting from clean `a0f8ede`, a five-arm, five-view actual Apple/Metal WebGPU comparison keeps
the shipping crop01/g050 bytes fixed:
`de179aea72c55dfc1e0c8a5ced18134277583253fa29ae068f6654972aebe24a`.
The arms are its embedded Principled/PBR material (roughness 0.38), that material without the
normal map, roughness 1 with the normal map retained, diffuse-only Lambert with the normal map,
and Lambert without it. All five are **diagnostics, not proposed shipping materials**.

Removing the normal map leaves the broad white highlights and flat plates. Roughness 1 greatly
reduces the white highlights but leaves gray, overlapping plates. Lambert removes the foil-like
shine while preserving visibly broad, angular layers and the disconnected fringe/nape. The
normal map supplies local strand detail; it is not the main cause of the large white patches in
this fixture. A matte material does not repair the groom's geometry or qualify its appearance.

| View | Baseline p95 | No normal map p95 | Roughness 1 p95 | Lambert p95 |
| --- | --- | --- | --- | --- |
| Front | 0.929 | 0.956 | 0.299 | 0.170 |
| Three-quarter | 0.756 | 0.734 | 0.296 | 0.163 |
| Side | 0.557 | 0.553 | 0.287 | 0.161 |
| Back | 0.446 | 0.439 | 0.278 | 0.146 |
| Top | 0.400 | 0.384 | 0.209 | 0.162 |

These are weighted **sRGB code values** over fully covered visible-hair mask pixels, not linear
radiance, reference-quality scores or new acceptance thresholds. The Lambert arm changes the
lighting model, including its diffuse energy allocation; subtracting it from PBR is not an exact
measurement of PBR's specular term. Local Three source explicitly selects a non-specular Lambert
lighting model for this arm. Its normal-map-free companion leaves the same broad geometric
defects and changes only small details.

The fixture checks all geometry attribute/index hashes, camera/head matrices, light parameters,
albedo/color and cutout settings. Across 25 arm/view combinations, independently rendered
body-only images and white hair masks are pixel-identical. Each view's original PBR image is
reproduced exactly after restoring materials. A zero-cutoff defect changes 9,247 / 9,119 / 7,619 /
5,271 / 12,346 mask pixels across the five views; removing the hair leaves an entirely black
mask. All four ablations actually change rendered hair. No browser or shader errors occurred.
Adding explicit parameter assertions prompted one serial repeat: all **100 captured images**
match exactly, and the five baseline plates also match the preceding checkpoint byte-for-byte.

This confirms an important scope boundary already stated in `HairMaterial.js`: the isotropic
PBR preview is useful for geometry inspection but cannot establish runtime hair appearance.
The runtime shader derives its lighting from fibre directions and substitutes a view-facing
normal; it does not use this generic normal-map/GGX response. `Avatar` currently supports bob01
and bob02, while crop01 remains an experimental manifest style. The present comparison therefore
does **not** clear any of the four red gates or validate public Avatar appearance.

The [material-attribution evidence](evidence/hair-2026-09-24/material-attribution/) contains
the isolated route patch, reports, replay instructions, source hashes and all 25 ordinary plates.
Production code, shipped assets, accepted calibrations and thresholds remain unchanged. Script
syntax and the actual GPU instrument's controls pass; no runtime suite, geometry verifier,
motion or performance test was repeated because no implementation or geometry changed. Both
GPU capture jobs have finished. The read-only Blender mount remains available overnight.

## Third experiment: runtime coverage and scene resolution

Starting from clean `c70c8c7`, the comparison returns to **supported bob01/g050 and the real
runtime HairMaterial**, with unchanged GLB SHA-256
`d425444f3d478c63e4842f7a789aa89ac1968c7d13b5aac87ca6717700df56e7`. All captures use the existing
static 24-step protocol at 900×1200, seed 1, WebGPU and TAAU. This is a fixed capture protocol,
not proof that every temporal quantity has fully converged.

| Runtime coverage / scene scale | Tip speckle T1 | Cheek speckle T2 | Mass speckle |
| --- | --- | --- | --- |
| Stochastic / 0.66 | 7.12% | 19.23% | 10.70% |
| Cutout / 0.66 | 6.21% | 15.10% | 4.59% |
| Sorted blend / 0.66 | 2.41% | 7.22% | 1.37% |
| Stochastic / 1 | 25.61% | 28.50% | 17.97% |

The T1/T2 ceilings remain 3%. Blend supplies a useful comparison but still exceeds the cheek
ceiling and retains its known draw-order dependence; it is not an accepted implementation.
The stock tool gates only stochastic. Native images show the default stipple, cutout's hard
card tips and blend's smoother but still distinct layers. None qualifies the groom's appearance.

The isolated `scale=1` query makes fine stipple and the nape's regular pattern stronger. Both
tip and cheek measurements worsen despite identical CPU mask counts. **Rejected; retain the
default 0.66 scale.** This query changes the whole scene, so skin and backdrop pixels also
change; this is not a hair-only ablation or a performance comparison.

| Opacity, portrait | Default scale 0.66 | Scale 1 | Existing requirement |
| --- | --- | --- | --- |
| C3 mass transmission | 0.0650 | 0.0602 | ≤0.10 |
| C4 curtain transmission | 0.5439 | 0.5468 | ≤0.35 |
| L2 independent detached/hidden ratio | 0.9951 | 0.9949 | 0.97–1.03 |
| L3 independent curtain ratio | 0.9923 | 0.9916 | 0.97–1.03 |

Both opacity runs exit 1 solely for portrait C4. Outside-step controls and the rear view's
applicable clauses pass. The rear view has no eligible C4 pixels and is not counted as a C4
pass. The opacity data prevents treating a softer tip image alone as a coverage improvement.

One **reporting repair is qualified**: `hair_tips.mjs` previously read only the weighted-OIT
pass object and wrongly reported no hair OIT for all three runtime arms. Its output now
separates stage mode, weighted-pass presence, actual AA and scene scale while retaining all
live material flags. The stage mode is configuration, not sufficient proof of a material path
on its own. All 11 native before/after images are byte-identical; every non-metadata report
line, including numerical results, masks and verdicts, matches. Runtime shaders, thresholds,
groom bytes and calibrations are unchanged.

The first scale-one tip capture omitted AA metadata because it read nonexistent properties.
After correcting that isolated reporting code, a serial rerun confirms live WebGPU/TAAU at
scale 1 and reproduces all three images and the exact measurement JSON. The corresponding
opacity captures already asserted those live fields. The augmented probes found no browser,
HTTP or shader errors. The copied instruments' diffs preserve the native measurement logic.

The [runtime-coverage evidence](evidence/hair-2026-09-24/runtime-coverage/) includes source and
image hashes, complete reports, ordinary plates, machine-readable opacity results and replay
instructions. Syntax checks, the image/report comparisons, request ledger 27/27 and quoted
numbers 25/25 pass. The existing tip and opacity failures are explicitly retained. No full
suite, geometry, motion, build or cost qualification was repeated for this diagnostic repair.
All GPU jobs have exited; the isolated read-only Blender mount remains available overnight.

## Fourth experiment: advance the spatial dither pattern — rejected

Starting from clean `5606973`, one isolated candidate adds a temporal phase inside the inner
`fract` of the screen-space interleaved-gradient expression. It retains the original outer
golden step; the inner uniform advances by `sqrt(2) - 1`, computed in CPU doubles. Supported
bob01/g050, runtime HairMaterial, TAAU scale 0.66 and all other controls stay fixed. The
candidate is applied only to Vite's response, leaving production sources and assets untouched.

A zero-inner-phase control uses the same rewritten expression and uniform wiring. All three
tip images reproduce the previous shipping baseline byte-for-byte, and all CPU geometry-mask
counts match between zero and candidate. The candidate changes rendered pixels, but the image
retains the conspicuous stipple, transparent curtain and plate-like layers.

| Measurement | Shipping / zero control | Candidate | Existing ceiling |
| --- | --- | --- | --- |
| 24-step tip speckle | 7.12% | 7.19% | 3% |
| 24-step cheek speckle | 19.23% | 18.89% | 3% |
| Portrait C4 transmission | 0.5439 | 0.5419 | 0.35 |
| Portrait C3 mass transmission | 0.0650 | 0.0637 | 0.10 |
| 128-step phase-pair RMS | 3.0944 code values | 4.4455 code values | 8 for C1 |

The opacity probe's independent detached/hidden controls pass: candidate portrait L2/L3 are
0.9951/0.9924, rear L2 is 0.9913. C4 is the sole opacity failure; rear C4 has zero eligible
pixels and is not gated. Small reductions in cheek noise and transmission do not establish
an acceptable image, and tip speckle gets slightly worse.

CPU finite/range, zero-phase identity and frozen/phase checks pass. Sampled distribution and
convergence get worse: the largest observed gap at 256 samples is 0.118120 versus 0.005025;
the largest empirical CDF discrepancy at 4096 is 0.009754 versus 0.000695. These use seven
screen seeds, two phases and three starting indices through one billion frames. They are
double-precision diagnostics, not a proof of GPU precision or unbiasedness. The original
outer-offset bound cannot be used to claim that the changed final threshold retains it.

A focused actual WebGPU replay of HairOIT's 128-step phase controls holds the shipping
hair-minus-bald mask fixed across all arms. Both C1 values pass, but candidate C2 and C3 fail
their unchanged thresholds: frozen RMS 11.9974 is only 2.70× regular RMS, below the required
3×; white-dither RMS 3.2596 is below the required 1.15× regular RMS. The frozen control pins
both uniforms while preserving phase response. The white control changes only the outer
sequence, retaining the candidate's inner phase; this is not evidence for white noise in
general. Nine captures check live WebGPU/TAAU, applied routes and per-frame uniforms. This
focused replay does not stand in for the full HairOIT order/motion suite.

**Rejected.** There is no renderer, material, geometry or threshold change to promote. All GPU
jobs ran serially and have exited. Script syntax, exact identity images, source/asset hashes
and independent opacity controls verify; unexpected browser/console/HTTP errors were absent.
No full suite, geometry, motion, build or cost run was needed after this rejection. The
read-only Blender mount remains available. Reproducible routes, native plates, raw reports and
the rejection are saved in [pattern-phase evidence](evidence/hair-2026-09-25/pattern-phase/).

## Remaining work and next bounded step

All four existing red gates remain: HairMaterial, GLB verification, opacity and tips. Preserve
the accepted bob, default TAAU scale and all appearance thresholds. Do not repeat the rejected
double-density crop, rest-position dither phase, scene-scale-one or inner-phase experiments.

The next bounded step should test **coverage correlation between overlapping cards** before
trying more noise constants. `hairDitherThresholdNode` currently depends on screen coordinates
and a shared frame offset, without a per-card discriminator. Source inspection therefore
suggests that two fragments at one screen pixel can share the same coverage decision. That is
a hypothesis about the curtain failure, not an established explanation of the groom's image.

Build an isolated actual WebGPU fixture using the existing `configureHairMaterial` path with
one and two overlapping, constant-alpha cards. Compare against explicit independent-layer
alpha compositing: two half-opacity layers transmit 0.25; a shared threshold predicts 0.5.
Include zero/one-alpha endpoints, a single-card reference, reversed draw order, an opaque body
behind the cards and a mask derived from their geometry. Inspect the unfiltered temporal
average separately from default-scale TAAU so the resolve cannot be mistaken for the coverage
rule. Keep the fixed bob untouched. Only after that mechanism is verified should a new
per-card decorrelation candidate be designed and tested on the real groom with tips, opacity,
phase/motion and visual checks. The earlier rest-position phase was rejected and is not that
proof. Check the morning deadline first: 08:00 Pacific, with the final-wake rule above.
