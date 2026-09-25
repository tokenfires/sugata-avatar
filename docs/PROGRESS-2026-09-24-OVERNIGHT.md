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

## Next bounded step

Return the next appearance/coverage comparison to **supported bob01/g050 and the real runtime
HairMaterial**. The existing `alive.html` switches already expose `hairbsdf=0/1` and
`hairoit=stochastic/cutout/blend`. Inspect those paths and use identical camera/light/pose and
converged frames to separate material appearance from coverage noise. The existing
`hair_tips.mjs --arms stochastic,cutout,blend --steps 24` provides a bounded starting comparison;
retain all original tip/cheek thresholds and pair any proposed change with the independent
opacity controls so reduced speckle cannot be bought with a more transparent curtain. The
sorted-blend arm is a diagnostic floor, not an approved transparency implementation. Preserve
the calibrated bob geometry and do not promote a change based only on these crop PBR plates.
Check the morning deadline before starting another substantial step.
