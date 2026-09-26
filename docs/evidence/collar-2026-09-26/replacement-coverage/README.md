# Replacement coverage operator

`sugata-collar-replacement-coverage-v2` is a new, deterministic, CPU-only projected-coverage protocol. It does not reproduce the unavailable historical implementation or establish historical 23,310-check equivalence. No asset, mask, accepted successor allowlist, runtime source, or hair bytes were changed.

The runnable operator is `tools/figure-pipeline/collar_coverage_v2.mjs`; its analytic checks are `collar_coverage_v2.selftest.mjs`. `final/summary.json` binds the current operator, selftest, proof runner and output files. The top-level authored reports and exhaustive-check report are retained preliminary measurements from before final instrument hashing/failure-witness additions; use **final/** for current evidence.

## Conventions

The frozen calibration supplies 3,669 bra and 4,101 vest additional casual-mask triangle IDs and its coverage contract. Current foundation GLBs and the full body are SHA-256 pinned to that calibration. The outer garment and optional posed snapshot require explicit SHA-256 arguments. Snapshot full index arrays must exactly match the supplied outer/current body/current foundation sources. No masks are generated or modified.

For each selected foundation triangle, find the nearest full-body triangle to its centroid using Euclidean point-to-triangle distance. Exact ties choose the lowest body triangle ID. Use that body's winding-derived geometric normal `n`. Choose the world axis least aligned with `n`, breaking ties X/Y/Z, then `u = normalize(axis × n)` and `v = n × u`. The chart plane passes through the foundation centroid. These nearest-query/tangent-basis conventions were missing from the surviving historical specification and are explicitly new.

Project the foundation triangle and take its Minkowski sum with a square of 1 mm half-extent; this is a convex polygon, **not its bounding rectangle**. Only outer faces with strictly positive face-normal dot `n` contribute. Clip their geometry to the inclusive centroid-relative depth slab `[-4, +30] mm` before projection. Subtract each convex cover polygon from the remaining footprint fragments; overlaps therefore cannot double-count coverage. Sum all remaining areas and require **≤ 1e-14 m²**. There is no clipping epsilon, snapping, or deletion of small fragments. A conservative Float64 pad broadens spatial search only; it never expands accepted cover. Nonfinite data, exact-zero-area input triangles, invalid topology/selection, excessive fragmentation and other unclassifiable cases throw without a qualifying report.

## Results

| Authored control | Bra failures / selected | Vest failures / selected | Result |
| --- | ---: | ---: | --- |
| Installed accepted `44eb…` | 2 / 3,669 | 3 / 4,101 | Fails this new protocol |
| Frozen interior `d81a…` | 0 / 3,669 | 0 / 4,101 | Passes this authored-pose check |
| `d81a…`, 180 changed-incident outer faces omitted | 3,669 / 3,669 | 3,967 / 4,101 | Negative control fails as required |

The accepted failures are bra triangles 8866/8869 and vest triangles 15506/15508/15509. Maximum uncovered areas are 2.382565938617081e-9 and 5.202186564050573e-10 m², respectively. Replaying all outer triangles without broad-phase filtering reproduces these failures (largest difference 5.97e-22 m²). A separately implemented exhaustive 3D line/triangle intersection also finds no outward in-slab cloth at each uncovered-fragment centroid. `final/accepted-independent-hole-witnesses.json` includes foundation/world/chart geometry, nearest-body face, cover geometry and these independent witness points. This supports real failures under the **new** convention; it does not reinterpret the old protocol's pass.

The d81 authored maximum uncovered residual is 3.23e-20 m². This is one authored geometry state; no posed/runtime/all-motion qualification follows. The unchanged 1e-14 m² threshold is about six orders larger than this residual and far below the accepted-control failures.

## Current native bra smoke integration

`smoke-coverage-v1.json` binds the completed capture report/manifest, all 15 compressed and decoded snapshot hashes, actual installed `44eb…` outer bytes, operator/probe sources, and compressed/decoded per-pose output hashes. The probe checks only the actually captured native `foundation_bra` on bob02's new six-second mild sequence. There is no vest reconstruction.

All **55,035** footprint evaluations completed without input/operator errors. Steps **0, 120 and 360 pass**; the remaining **12 sampled poses fail**, each at bra triangles 8866 and 8869. The largest uncovered area is **6.350297726696895e-9 m² at step 60**. The 1e-14 m² limit was unchanged. Full per-pose raw reports and lossless gzip copies, including failure geometry, are retained in `captures/collar-replacement-2026-09-26/coverage-smoke-v1/`.

These are 15 discrete states of the accepted asset in one native bra/bob02/mild trace. They establish neither continuous-motion coverage nor a new fit, d81/trial runtime behavior, expressive stress, vest coverage, all-view occlusion, historical parity or promotion.

The reusable CPU-only probe command is:

```sh
node docs/evidence/collar-2026-09-26/replacement-coverage/probe-smoke.mjs \
  docs/evidence/collar-2026-09-26/replacement-capture/smoke-v1 \
  captures/collar-replacement-2026-09-26/coverage-smoke-repeat \
  captures/collar-replacement-2026-09-26/coverage-smoke-repeat-summary.json
```

## Compact evidence

`compact-rest-v1/manifest.json` maps all ten final rest-proof files to lossless gzip copies, with original-file, encoded and decoded SHA-256 hashes and byte counts. It reduces **67,421,890 raw-source bytes to 9,325,121 encoded bytes**. All raw files remain available locally in `final/`; compact copies can be committed in their place. For an ordinary JSON/log entry, gunzip its compact copy to recover its exact original file. For entries marked `sourceWasGzip`, the compact encoded copy already is the exact original gzip file; do not decompress it when restoring that source filename. The original `final/summary.json` hashes remain verifiable after restoration.

`compress-evidence.mjs RAW_DIRECTORY FRESH_COMPACT_DIRECTORY` creates and verifies these copies without deleting or overwriting any input. The top-level/pre-finite-guard preliminary raw reports are retained locally to document the evidence correction; they are not the current qualification result.

Fourteen analytic test groups cover the true expanded triangle, shared seams, overlapping covers, a 1e-12 m² interior hole, cover ordering, inclusive slab boundaries, triangles crossing both slab planes, reversed/edge-on faces, nearest-face/tie handling, BVH/exhaustive nearest parity, removed-cover controls, translation/scale relations, malformed geometry and finite-input nearest-point arithmetic overflow. Five adapter checks cover identical authored geometry through the snapshot adapter, wrong asset hash, wrong snapshot hash, overwrite refusal and forged topology. The adapter fixture is deliberately labelled **CPU-authored positions, not a runtime capture**.

The critic found that extremely large finite coordinates could overflow Three's closest-point arithmetic, yielding NaN distances while a coverage row still passed. The operator now rejects every nonfinite closest point/distance before ranking a body candidate, validates the query and chart distance, and includes the exact regression. `pre-finite-guard/` retains the earlier instrument-bound evidence; **final/** was regenerated with the correction. The actual authored-asset results did not change.

## Re-run

From the repository root:

```sh
node tools/figure-pipeline/collar_coverage_v2.selftest.mjs
node docs/evidence/collar-2026-09-26/replacement-coverage/run.mjs captures/collar-coverage-v2-cpu-check
```

The second command requires a fresh output directory and reads the retained `captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb`. It executes no browser, GPU job, solver or asset export.

To evaluate a separately hashed outer file:

```sh
node tools/figure-pipeline/collar_coverage_v2.mjs \
  --outer captures/collar-stress-2026-09-22/gpu-v1/assets/collar-interior.glb \
  --outer-sha256 d81a6730bde9d8fee4641e18d6f9f0e3922af420bb68eea3f44b661896aeec3a \
  --foundation both \
  --output captures/new-coverage-report.json
```

For posed data, additionally supply `--snapshot PATH.json.gz --snapshot-sha256 HASH` and choose the actually captured `--foundation foundation_bra` or `foundation_vest`. Both requires both actual foundation meshes in the snapshot; the operator never invents an uncaptured vest. Snapshot input uses the existing `{time, meshes:[{id, positions, fullIndices, drawnIndices}]}` schema. The capture manifest must independently establish loader/runtime provenance; this operator establishes input hashes and geometry/index binding only. Exit status is 0 for all selected footprints passing, 2 for a completed coverage report with failures, and 1 for invalid input/instrument errors.

The API exports `runCoverage({outerPath, outerSha256, snapshotPath, snapshotSha256, foundationIds, outputPath, excludedOuterTriangles})` and a pure `evaluateCoverage` function for geometric cases. The omission list is for explicit negative controls and is included in reports.

No result here establishes original-mask coverage, all-view ray occlusion, collision clearance, GPU deformation correctness, motion continuity, body-build generality or asset promotion. A trial still needs its own exact-byte posed coverage, support/shape audit, full-body/retained-foundation clearance, visual obliques and motion review.
