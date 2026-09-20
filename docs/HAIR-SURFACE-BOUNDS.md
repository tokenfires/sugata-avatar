# Core triangle-bounds regression

Run the CPU source-control and numerical checks, then the optional actual WebGPU parity gate:

```sh
node packages/core/src/motion/HairSurface.bounds.selftest.mjs
node packages/core/src/motion/HairSurface.bounds.selftest.mjs --gpu --report=/tmp/hair-surface-bounds.json
```

The test requires both promoted triangle guards in production `HairSurfaceQuery.js`. It fails if either guard is absent, incomplete or changed beyond the exact extraction contract. The comparison browser receives a predecessor through a response route that removes exactly those two guards; the production arm receives the unchanged module. Neither arm changes a file. Strict round-trip extraction, different raw and served hashes, and source hashes before/after prevent an identical-arm comparison from passing silently. No ignored captures, scratch query module or external candidate file is required.

The tracked fixture contains **18 adversarial records with 17 unique named geometries**. The zero-origin ULP control appears twice; its duplicate is retained to preserve the original fixture hash and is not independent coverage. Cases include exact zero and equal-distance ties, different authored normals, shared edges, collapsed/thin triangles, an intersection between distant endpoints, Float32 coordinate boundaries, and two moving panels sampled on both sides of the exact midpoint. A nine-triangle case puts tied minima across BVH leaves. Four valid or out-of-range seeds exercise cached candidate behavior.

Those records plus the existing 35 primitive inputs produce **244 batches / 732 additional queries**: 488 direct point queries and 244 whole-segment queries. Every returned Float32 bit must match the predecessor, including closest and segment witnesses, sign, parameter, barycentrics, normal, boundary flag, validity, source/ordered triangle IDs and visited-node/triangle counts. The existing 35 primitive, 144 generated BVH, eight normal, 12 bounds and stale-record clearing cases also retain every returned value and pass their independent oracle checks. `trianglesTested` continues to count visited triangles; it does not count expensive feature evaluations skipped by the guard.

The CPU gate checks 3,072 deterministic finite cases at scales from `1e-6` through `1e6`. It compares the Float32 guarded box lower bound with an independent double-precision feature distance. All 2,330 positive bounds stayed below that distance. This is finite test coverage, not a proof for every ill-conditioned closest-feature computation or arbitrary coordinate magnitude.

The first portable production run passed **eight groups: four CPU and four WebGPU**. Both browser arms had zero console, page or network errors, different attested served modules, stable source hashes, and storage/compute resource counts returned to their respective baselines. The tested production SHA is `f19425b8208dcb15d22a8e1c5b348d008d478ba9eb31b00e48426850ab9770c1`, which preserves the previously measured `e3b680d` candidate's arithmetic with only two whitespace-only lines trimmed. The compact [evidence ledger](evidence/hair-surface-bounds-2026-09-09.json) binds the result to its sources; full reports and snapshots are under ignored `captures/hair-surface-bounds-2026-09-09/`.

A separate CPU-only leaf-size-one estimate in that archive reproduced the historical leaf-size-four patch exactly and remapped cached IDs through canonical source triangle IDs. On its historical 384-active-chain workload, leaf size one increased node visits by about 79.44% while saving only 25/24 exact triangle evaluations at 16/64 iterations. That branch stopped without a GPU run. Its counts are not a timing prediction and do not describe the later all-496-chain benchmark.

This portable gate makes no timing, contact-convergence, all-bake clearance or appearance claim. Those require the separately recorded full-stage and actual Avatar checks.
