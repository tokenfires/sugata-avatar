# Current review-page performance baseline — proposed protocol

2026-09-26. Read-only source/device inventory; **no browser or GPU run has been performed for this plan**. The first deliverable is a measurement of the current default Wardrobe and Portrait pages on this Mac. It does not complete the representative-avatar Phase 1 performance requirement in `docs/PRODUCT-ROADMAP.md:22,48`, establish a frame-rate target, or qualify appearance/fit. No production, asset, hair, or dependency change is proposed.

## Small first run

Use four fresh, serial page sessions: Wardrobe live, Portrait live, Wardrobe stepped, Portrait stepped. Require root's GPU handoff and no other rendering/capture job. Use the existing watcher-disabled `MotionProbe.startProbeServer` on a separate port, preserving the persistent review service on 5173. This first result is explicitly a **Vite-served review-page baseline**, not a production-bundle benchmark. Preserve server/browser configuration and never mix build modes in a comparison.

| Case | Original URL | Required attached workload |
| --- | --- | --- |
| Wardrobe default | `/src/showcase.html` | g050, seed 20260807, relaxed-standing, body framing, Studio, balanced quality, ecru, bob02, `female_casualsuit01`, `shoes01`, `foundation_bra`, `foundation_briefs` |
| Portrait default | `/src/portrait.html` | g050, seed 20260807, relaxed-standing, portrait framing, Studio, bob02, requested quality auto; actual WebGPU tier expected balanced; **wardrobe is false**, so this is not a clothed-avatar workload |

The stepped sessions add only `?capture`; timestamp instrumentation is described below. Preserve current accepted assets, native owners, motion, solver, temporal history, material settings, shadows, coverage/draw masks, camera, and outfit. Do not substitute historical `alive.html` defaults, disable any hair component, use an isolated body, or inject a candidate rest pose. No speech, emotion command, attention cue, orbit, zoom, pause, scrolling, export, saved-look operation, or room switch during the default-idle samples. Assert `prefers-reduced-motion: no-preference`, visible document, unpaused page, idle attention, no pending asset/outfit work, and the actual `avatar.report()` configuration before sampling. Wardrobe's entire four-garment set must be attached even when part is occluded. Record actual mesh/index/draw-range/material counts; do not substitute source total triangles for submitted triangles.

Start with **1440 × 1000 CSS window viewport, deviceScaleFactor 2**, dark colour scheme, unchanged page CSS, scroll position zero. This is desktop-window emulation on this Mac, not a phone or a full-display test. Do not force the canvas to the window size. Record at readiness, sample start/end and disposal:

- `innerWidth/Height`, `visualViewport`, screen values, devicePixelRatio, canvas CSS rect/client dimensions, canvas backing width/height, renderer logical/drawing-buffer size and pixel ratio;
- actual scene-pass target dimensions, temporal/history/output target dimensions, resolution scale, MSAA, effective camera FOV/zoom/aspect, and backend/tier;
- DOM/layout and camera stability through the measured interval. Abort on resize, DPR/visibility change, navigation, device loss, failed asset load, or unexpected UI/state mutation.

`Stage.updateViewport()` caps DPR at 2 and follows the canvas CSS box. TAAU defaults to scene scale **0.66**; rounding and the temporal view offset mean scene target and camera aspect must be read, not inferred from window dimensions. Neither “1440p” nor “2K rendering” describes this setup precisely. Mobile, Kitchen, the second outfit, gestures, other bodies, and production-bundle comparisons are subsequent separate cases only if the first result warrants them.

## Host and runtime receipt

Read-only inventory at planning time: **MacBook Pro Mac17,6; Apple M5 Max; 18 CPU cores (6 Super + 12 Performance); 40 GPU cores; 128 GB unified memory; macOS 27.0 build 26A428; Metal 4; internal 3456 × 2234 display.** Installed packages read as Three 0.185.1, Vite 8.2.1, Node v24.13.1. Do not retain hardware serials/UUIDs. These facts are not measurements of an active browser adapter or performance.

At run time record OS/device again, browser binary/version/hash, Playwright version/resolved path, headed/headless mode, every launch flag, actual WebGPU adapter/device information exposed by the browser, device features/limits, timestamp-query availability, power source/battery/low-power setting and available thermal-pressure status before/after. Missing telemetry is `unavailable`, not nominal. Parent must finish its other GPU work first; report other active GPU workloads if they cannot be excluded. Do not change power mode, force clocks, assume 120 Hz, or install a browser/dependency.

Reuse the already available Chromium and MotionProbe's browser setup only with its exact flags recorded. Its headless hardware path is a starting configuration, not proof of hardware acceleration: require actual WebGPU, reject software/fallback adapters for this hardware baseline. Do **not** copy `alive-perf`'s unthrottled `--disable-gpu-vsync`/`--disable-frame-rate-limit` options. A headless run remains a headless result. A later visible-browser run is needed for actual user presentation conclusions.

## Warmup and sample windows

1. Retain navigation-to-ready and asset-ready times as startup observations; the filesystem/OS caches are not controlled, so do not call them cold-load performance. Keep one ready workload screenshot outside the sample window.
2. Live sessions: at least 5 seconds of native page updates and two consecutive 60-update windows with stable pipeline/pass census and GPU resource counts/bytes. Record warmup duration and actual update count. Extend to at most 15 seconds; if still changing, preserve the trace and stop that steady-state case as unready.
3. Stepped sessions: native startup remains intact, including the page's initial `avatar.step(0)`. Then at least 180 calls to the page's public `step(1/60)`, with the same two-window stability rule; extend in 60-step blocks to at most 600. Resolve both timestamp pools throughout warmup. Never reset the avatar, renderer node clock, temporal history, PRNG, simulation clock, or counters to manufacture a clean interval.
4. Measure **30 seconds live** and **240 stepped updates at 1/60 simulation seconds**. Keep every sample, including stutters/GC; no percentile-based rejection. No screenshots, GPU mesh/texture readbacks, trace profiler, full `report()` traversal, JSON serialization, or console output inside a timed update. Use bounded in-page numeric buffers and collect after the window. Record actual clocks/update indices and first/last state, then take an ending screenshot outside the window.

Warmup means observed stabilization for this idle workload, not proof that every future shader or gesture has been warmed. Keep warmup counts and pass signatures so a run with missing late passes cannot look like a speedup. One four-session pass is a descriptive pilot with no significance claim. If it will support a comparison or budget decision, repeat the same four sessions once in reverse order, report per-session distributions/ranges, and investigate materially inconsistent results before interpreting them. Do not pool them into one apparent sample size.

## Measurement definitions

| Quantity | Instrument and scope | Do not call it |
| --- | --- | --- |
| Synchronous Avatar CPU cost | Pass-through timer directly around original `Avatar.update(dt)`; identical receiver/arguments/return/error; includes native advance and draw submission, excludes asynchronous GPU completion | Full page CPU cost, GPU time, or frame latency |
| Native update cadence | `performance.now()` at successive actual page-owned `Avatar.update` entries plus observed simulation dt/clock; record browser rAF cadence separately | Presented FPS or a 60 Hz simulation (native page clamps dt at 50 ms) |
| Render/compute pass durations | Fresh WebGPU timestamp pairs, associated with their owning measured update; report render sum, compute sum and combined pass sum separately | Display latency, queue wall time, or a guaranteed sustained frame rate |
| Controlled step wall time | Wall timer around the public page `step(1/60)` | CPU time: it includes GPU waiting and two browser rAF waits |
| Queue-completion latency | In stepped profiling only, pass-through timer around the original `queue.onSubmittedWorkDone()` promise; preserve its invocation/return/rejection and add no queue drain | GPU execution duration: it includes queued work and scheduling |
| Page/presentation behaviour | Live callback intervals, supported long-task observations collected outside callbacks, visibility and compositor capability receipt | Actual physical frames presented without a separate presentation instrument |

Both review pages call `Avatar.update → Stage.draw`; they do **not** call `Stage.renderFrame`. Therefore `stage.frameMs`, `stage.fps` and its cached draw counters are not valid measurements here. Read native renderer counters at the synchronous update boundaries and use differences of cumulative calls where appropriate; renderer `Info.reset()` is driven by Three's own animation chain. Do not switch `info.autoReset` or stop that chain.

The Avatar CPU timer deliberately excludes `ViewerFraming.update`, OrbitControls and page attention/status DOM work. A full-page callback timer would need a separately reviewed pass-through observer bound to the original page callback, distinguished from Three's internal callback; until implemented, mark that metric unavailable. Browser callback cadence includes scheduling/backpressure but is still not compositor presentation. For the first baseline, explicitly leave **presented FPS / dropped presented frames unavailable**. A visible, source-bound browser compositor trace can be a later diagnostic run, with its overhead and supported event semantics validated separately; screenshots, two rAF waits and reciprocal GPU milliseconds do not provide that proof.

Report count, median, p90, p95, p99 and maximum with declared percentile convention, raw samples and time series. Show live interval counts above 16.667/33.333/50 ms as **reference thresholds only**, alongside measured callback cadence; do not turn them into a pass/fail refresh-rate or Phase 1 budget. CPU and GPU overlap, so do not add CPU ms to pass-sum ms to predict FPS. Stepped frames idle the device during waits and change DVFS/queue pressure; do not extrapolate their GPU timings to continuous live throughput. If live timing points to a GPU bottleneck, the next run should add asynchronous timestamp draining to the original live loop and measure its overhead; that is outside the four-session pilot.

## Timestamp admission and completeness

The native default does not request timestamp tracking. For stepped profiling only, defer exactly the original page module startup in a harness-owned HTML response, install a small construction observer, then import the **unchanged original page module**. Temporarily wrap the exact native `Stage.prototype.create` and forward all original options plus `trackTimestamp: true`, exactly once; restore its descriptor after startup/failure. Preserve all native initialization, page controls, initial step and owners. No product-file edit or second Avatar. Archive the original and harness-served HTML, wrapper source/hash and actual import response hashes. Live sessions leave timestamp tracking off and use only the timing observer. Constructor option delta must be exactly the timestamp flag; workload admission remains identical.

Before retaining GPU data, require actual WebGPU backend, `device.features.has('timestamp-query')`, backend `trackTimestamp === true`, timestamp capability and both pools when the workload submits both types. Use source-bound pass-through observation of `WebGPUBackend.initTimestampQuery(type, uid, descriptor)` plus native render/compute pass-entry counts. Record the actual descriptor's begin/end timestamp writes and owning update. Current native solver submissions and the committed card-history copy use `renderer.compute`; a render-only timestamp report would omit them. This is observation of the unchanged workload, not a hair ablation.

For each measured step:

1. Begin an application update ID, collect **all** render and compute timestamp UIDs emitted synchronously during that update, then let the original step finish. Read-only counter snapshots distinguish rendering passes, compute passes and renderer calls; these are not interchangeable.
2. Resolve `render` and `compute` pools sequentially after the original step, outside CPU/step-wall timers. Match every expected UID to a fresh finite, nonnegative duration via the backend timestamp accessors. Reject missing/duplicate UIDs, disabled writes, overwritten records, pending resolutions confused with new work, pool overflow warnings, GPU errors, and unexpected submissions outside an attributed update. Zero duration is retained with query-resolution/quantization limits, not automatically called zero cost.
3. Map by captured UID ownership, **not** by assuming one Three frame number per Avatar step. Three's `Animation` chain still advances its node/frame clock under `autoStart:false`. It is required for skinning and must stay intact.
4. Persist pass labels/types/counts, UID-to-update mapping, resolve epochs and freshness checks. A pool holds 2048 queries / 1024 timestamped passes, not 1024 Avatar frames. Resolve during warmup as well as samples; do not increase capacity to conceal a missed drain.

In Three 0.185.1, `resolveTimestampsAsync()` can return a previous value, while the query pool's successful scalar result represents **only the last Three frame in the resolved batch**. Neither that scalar nor `renderer.info.render.timestamp` is sufficient. The UID maps persist across resolves; previously seen records must never be counted again. Timestamp coverage is pass execution routed through this Three backend; it excludes query resolve/copy/readback overhead, GPU transfers outside those passes, browser composition and display. The current core scan found solver/history compute through Three rather than direct application command encoders; still bind that source and verify actual pass coverage at runtime. If coverage cannot be established, publish only the supported subset and mark total GPU workload unavailable; never replace absent timestamps with CPU wall time.

Before the full sample, one short smoke must demonstrate complete per-update UID coverage, source/option identity and no observer-caused extra frame. The instrument should have CPU tests for stale/last-frame-only results, missing/duplicate/overflow queries, render-only omission, and mismatched update IDs. These tests validate accounting, not native GPU capability. Future live timestamp draining needs its own bounded asynchronous accounting and overhead check.

## Memory, retirement and provenance

Capture `renderer.info.memory` counts and byte fields at ready, warmup end and sample end, plus report-owned subsystem buffers/resources and JS heap information only if supported. Record instrument arrays/query-map growth separately. These are renderer estimates/observable ownership, not total resident GPU memory or macOS unified-memory pressure. Do not force GC in timed runs. Keep retained renderer/backend references only for the final receipt, then release them.

After the measured window, use the original page's non-persisted `pagehide` cleanup (record the event and completion), retain the final Avatar disposal report, and require disposed state, empty `leakedHandles()`, retired controls/attention/renderer, no subsequent Avatar updates/submissions, and no errors/rejections. Resolve outstanding queries before teardown, record query-pool retirement and ensure browser/server finally blocks run even on failure. Close the fresh browser context/document after the receipt. A callback/lifecycle observer must not swallow cleanup exceptions.

**Known source limit:** `Stage.watchPixelRatio()` installs an anonymous once-only media-query listener; `unwatchViewport()` currently disconnects ResizeObserver but only nulls the media-query handle. A pending listener can retain a closure until DPR changes or the document is destroyed. Also, Three `Info.dispose()` explicitly zeros tracked memory counters. Thus a clean Avatar report plus zero counters is not proof of complete DOM/GPU/OS reclamation. Report the listener limitation and fresh-context closure; do not claim a repeated same-document leak test or fix it in this performance slice.

Freeze a new manifest before startup: git revision and dirty-file inventory, SHA-256 for all executed page/core/harness modules, lockfile, actual Three source **and served build/prebundle bytes**, Vite/browser/Playwright versions, every loaded asset/texture/configuration, and observed response URL/status/body hash. Pin the accepted default outfit bytes; reject any candidate route. A watcher-disabled server prevents HMR but does not freeze later HTTP reads: verify source/asset hashes before **and after every session**, retain served-byte hashes, and reject stale/mutated inputs. Copy exact instrument sources into the fresh output directory. Never overwrite a failed run or earlier evidence.

Proposed outputs: `captures/review-performance-2026-09-26/baseline-v1/` with manifest, per-session raw samples (lossless gzip), capability/pass-coverage receipt, ready/end PNGs, errors and disposal receipts; compact summary/hash mapping under this evidence directory. Seal `completed:true` only after all required admissions, source checks and cleanup. Keep partial/error records with `completed:false`; unavailable metrics stay explicit. No performance pass is declared from this pilot; a later representative-build protocol must set device/resolution/frame-time/memory budgets before testing those builds.

## Source anchors checked for this plan

- `packages/testbed/src/showcase-presets.mjs`: default selection, complete outfit/foundation, balanced quality; `showcase.js:100,256,309`: live loop/native startup/manual hook.
- `packages/testbed/src/portrait.js:68,95,197`: live loop, default no-wardrobe construction, manual hook; `Avatar.js:723,1931,1996`: defaults, synchronous update, step barriers.
- `Stage.js:289,341,758,793,941,986`: timestamp option, resolution scale, stage-only timing, draw, actual sizing and listener retirement.
- Three `Animation.js:70`, `Backend.js:474`, `WebGPUBackend.js:294,839,1577,2255`, `WebGPUTimestampQueryPool.js:75,102,192`, `Info.js`: independent node clock, UID mapping, capability/pass coverage, stale/last-frame resolution semantics and memory counters.
- `MotionProbe.mjs` supplies the watcher-disabled server and existing Chromium launcher only. `tools/spikes/alive-perf.mjs` is historical reference for warmup/clock/query pitfalls; its page, CPU counter, unthrottled flags, render-only scalar sampling and toggle matrix are not this protocol.

Planning-source anchors at git `74db3b9ffa47d5fb3724222ce11f818ab9a6bef5`:

| File | SHA-256 |
| --- | --- |
| `packages/core/src/Avatar.js` | `9e44e981d48a835b57b0badf4b2e675f2b10fc64da8bbfcd316e3201e586407c` |
| `packages/core/src/render/Stage.js` | `75408b157fe12286c04d9d327bf7e313bfe65f9c349780506da3f48096386295` |
| `packages/testbed/src/showcase.js` | `1debe294b31fc00df9ff63f97b64ec43dd9453e609bb6308eb446206b36bc497` |
| `packages/testbed/src/portrait.js` | `d62d9d190d9fd00a0309821ea6432ce999d0514a96b6bf7f94497e638adbf5c0` |
| `node_modules/three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js` | `a8b5374d5fd05ab4712f771ffe9b7c054b6fbc333e560f599c0311cc173b2806` |
| `node_modules/three/build/three.webgpu.js` | `50e4013dd3903e8afb09a4829962dbf105488de7bd47f61308f44bd2e66b3340` |

These planning anchors are not a future run manifest; freeze the complete live dependency/asset set when root authorizes the baseline.

## 2026-09-26 implementation addendum

The earlier Stage listener limitation above describes the inspected baseline, not the current source: the independent lifecycle worker fixed explicit DPR listener removal and stale-callback rejection at Stage SHA-256 `726f4002297ee2bd328c9fbc09cfe0c9c6b18c06537d6b8fe7434fc71e3800b0`. Nine focused lifecycle groups and four existing resize groups passed, and the critic independently accepted the CPU/source change. See `../viewport-lifecycle/README.md`. Root also corrected Avatar's stale explanatory comment. A root-owned native check is separate; this addendum does not claim its outcome. The original hash anchors remain historical. The smoke manifest must freeze the new accepted files; an existing manifest is never silently refreshed.

The first implementation is deliberately only the 8-warmup/12-sample **instrument smoke**, not the four-session performance controller. It requests timestamp capability during native construction, immediately disables `backend.trackTimestamp` after native Stage.create returns, then restores tracking only after the original stopped page is ready and its queue idle. Any already allocated startup records are retained in a discard/drain receipt and must drain fully before warmup. No native frame, reset, private clock mutation, or pool-map clearing is added. This profiling-window gate avoids overflowing timestamp pools while the native page loads assets; it does not measure startup GPU cost. All sample descriptor indices are copied synchronously, since Three reuses its timestamp-writes object. Smoke retirement exercises the original page handler using an explicitly labeled synthetic non-persisted pagehide event, then closes the document; real navigation is not qualified by that event.

The source-bound native Backend CPU check also found that Array compute groups receive an `r:` UID because they lack `isComputeNode`. The pool is still compute, so the original plan's generic backend timestamp accessors would choose the wrong pool. Use the **actual observed pass type's pool** to test freshness/read duration, preserving the native UID, and admit an `r:` compute UID only with actual Array context evidence. `native-uid-proof-v1.json` retains the native CPU witness and repeated-array collision limit. The current solver batches its two fixed substeps into one Array submission, followed by a distinct single-node history copy; it does not make two identical Array calls. Actual duplicate UIDs remain a hard capability failure, never repaired through renaming or workload changes.
