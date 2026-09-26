# First retained Wardrobe stepped timing pilot

The default Wardrobe workload completed one source-bound native pilot:180 total warmup updates followed by240 samples, zero errors, unchanged sample census and clean tracked-resource retirement. The recorded GPU render+compute pass sum was **11.92ms median /18.69ms p95**; the observer-inclusive Avatar CPU update was **3.00ms median /4.30ms p95**. These are stepped measurements, **not FPS**, a live responsiveness verdict or representative-avatar completion.

[Open the timing review](native-pilot-v1/review.html). It contains the complete240-sample series, metric comparison and actual end image. The page is static and creates no avatar/GPU workload. Artifact generation and link validation are CPU-only; a browser visual check of this new HTML is separate from the already completed native run.

| Metric | Median ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: |
| Observed GPU render+compute pass sum |11.924|18.689|22.129|
| GPU render pass sum |11.842|18.547|22.046|
| GPU compute pass sum |0.088|0.133|0.913|
| Avatar CPU, with observation overhead |3.000|4.300|4.600|
| Native queue wait |4.400|7.300|10.800|
| Whole native public step |21.450|25.000|29.900|

The arithmetic middle-pair median and nearest-rank percentiles are reproduced from every retained sample; none were dropped. Metrics overlap and must not be added. GPU pass sums omit transfers/copies outside the observed passes, query readback, browser composition and display. The page step also contains native queue and paint waits. Serial stepping changes queue pressure, idle periods and potentially DVFS compared with live rendering, and the CPU observer overhead is uncalibrated. Thus these data alone do not identify a live bottleneck or support turning11.92ms into a frame-rate estimate.

The actual workload was accepted g050, casual suit/shoes/bra/briefs, Ecru palette, bob02 and Studio at balanced quality, seed20260807. The host reported Apple M5 Max/Mac17,6/128GB, macOS27.0, headless Chrome149.0.7827.55 and a nonfallback Apple Metal adapter with timestamp queries. The viewport was1440×1000 at DPR2; the canvas backing was1800×1736, with a1188×1145 scene target at0.66 resolution scale. Power was AC-attached with no recorded thermal/performance warning; this is not a temperature measurement. Owned jobs were serialized, while unrelated user applications remained uncontrolled.

The first8 tracing steps were unmeasured. Both query pools were enabled for the next172 warmup steps and all240 samples, producing412 fully accounted updates and8,240 unique render/compute pass queries. Each had18 render passes and2 compute passes; no stale scalar fallback was used. The native memory/program/pipeline/resource/pass signature was unchanged over warmup windows60→120 and120→180 and throughout every sample. No extension beyond180 was needed. All420 persistent same-browser camera/control predictions matched the actual native page path, without reseeding or an epsilon; the independently recorded Node portability limit remains.

The six exact diagnosed warnings occurred before timestamp collection: four during startup, followed by the same HairDynamics770/778 source messages at the first tracing step. No later warnings or errors occurred. These are retained dependency diagnostics, not a harmlessness or hair-quality verdict. Native solver steps advanced1→841 and beauty-history commits0→420, with exact/valid history and smooth card draws at every workload checkpoint. The actual end image is retained for visual review.

Tracked renderer memory was635,740,358 bytes (606.3MiB) at the stable census. This is renderer bookkeeping, not total resident GPU/unified memory. Before retirement both typed pools were idle with zero pending queries and no cleanup drain was needed. Native pagehide disposal then retired both pools, cleared Avatar/Stage renderer ownership, left no reported handles and zeroed all tracked counters. No OS allocator/GC or actual-navigation leak qualification is claimed.

`native-pilot-v1/` preserves the exact original pilot gzip, lossless report/manifest/seal,22 selected executed source files from the capture archive, full1,608 source/asset bindings, exact end PNG, summary JSON and static review. `receipt.json` binds every artifact with encoded and decoded hashes. The complete original local capture remains under `captures/review-performance-2026-09-26/pilot-v1/`; selected-source packaging is not a complete copy of every dependency or asset.

```sh
node docs/evidence/nonhair-2026-09-26/review-performance/verify-pilot-package.mjs
```

The verifier checks package bindings, actual asset response hashes, all412 query-accounting records, all420 recorded same-browser prediction equalities, exact warmup/sample census,240 raw sample values/statistics and retirement. It executes the two exact archived pure accounting/policy modules for arithmetic; it does not rerun camera prediction in Node or launch a browser.

**Next action:** retain this useful baseline. This single run does not justify an optimization or a routine repetition of the full suite/matrix. If a concrete live responsiveness issue appears, measure the original live loop's cadence and observation overhead before attributing a bottleneck or changing quality. No such additional run is launched or proposed as automatic follow-up here.
