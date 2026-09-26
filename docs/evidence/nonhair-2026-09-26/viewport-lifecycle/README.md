# Stage DPR listener ownership

The regression proves a retained listener after `Stage.dispose()`. The old code installed an anonymous, once-only `MediaQueryList` callback but dropped the query reference without removing that callback. `once` only removes it when delivered. Fifty independent Stage construction/watch/dispose cycles therefore left fifty pending callbacks. Explicit repinning also retained the obsolete callback, and `unwatchViewport()` while the renderer remained live allowed a later old-query event to resize and recreate observation.

The change in `packages/core/src/render/Stage.js` retains the exact callback alongside its query, removes it before repinning and during viewport teardown, and checks query identity before executing a captured callback. Normal DPR delivery still updates the viewport once and repins to the current **raw** DPR; render sizing still applies the existing maximum DPR. No rendering, timing, asset, dependency, or hair behavior is changed.

The same focused regression ran against the real old and fixed Stage methods. It uses Node's actual `EventTarget` for once-only listener dispatch; the observable MediaQueryList adapter tracks callback registrations/removals and deliveries. ResizeObserver and renderer sizing boundaries are instrumented. The test calls `new Stage()`, `watchViewport()`, `watchPixelRatio()`, `unwatchViewport()`, `updateViewport()`, and `dispose()`; it does **not** call the GPU-allocating `Stage.create()` or claim a browser heap/GC measurement.

- Baseline: 2/9 groups passed; seven lifecycle groups failed. The fifty-cycle witness retained50 callbacks.
- Fixed: 9/9 groups passed, including once delivery, explicit repinning, unwatch/rewatch, disposal before delivery, zero retained callbacks across fifty cycles, DPR clamp/resize behavior, and cleanup before a renderer-disposal error.
- Two adversarial checks explicitly replay a captured old callback to prove the identity guard. Those calls are labeled callback replays, not claimed browser event deliveries.
- Existing `Stage.resize.selftest.mjs`: 4/4 groups passed, retaining the actual PassNode sizing and first TAAU jitter contract.

Source and retained receipts:

| Artifact | SHA256 |
|---|---|
| `Stage.baseline-v1.js` | `75408b157fe12286c04d9d327bf7e313bfe65f9c349780506da3f48096386295` |
| Fixed `packages/core/src/render/Stage.js` | `726f4002297ee2bd328c9fbc09cfe0c9c6b18c06537d6b8fe7434fc71e3800b0` |
| `Stage.viewport-lifecycle.selftest.mjs` | `d0d2d27ea2bbb950a3db0e26378d1c5aa4614f31a850155562b0a9cae1b19ac4` |
| `baseline-v1.json` | `7aaad471c001bc3461b5d9b9e8bbf9f4026e053fd7fd352ec99c6ac9bc48b104` |
| `fixed-v1.json` | `a1950192770503156592ec226de5387180c5717e3f8b7345c3702f773f67e74d` |

Run from the repository root:

```sh
node docs/evidence/nonhair-2026-09-26/viewport-lifecycle/Stage.viewport-lifecycle.selftest.mjs
node packages/core/src/render/Stage.resize.selftest.mjs
```

An optional fresh JSON output path on the first command records source hashes and all group outcomes. The baseline receipt and source are preserved unchanged. Native browser lifecycle confirmation is a separate root-owned check; no browser/GPU run was made for these receipts.

## Native listener census

Root's `native-v2/report.json` SHA256
`5ef62287ae9e1d49761572baaf05ea140c8738ddea7fcacfc31d41ea3d268ba2`
passes four additional browser groups on actual empty WebGPU Stages. Chrome's
`DOMDebugger.getEventListeners` directly observes each real MediaQueryList: one registered
change listener while active, zero on every retired query after replacement, unwatch and
Stage disposal. Three successive create/dispose cycles in one document leave no such listeners.
Each renderer reports zero tracked counters at retirement; browser/page/network errors are empty.

The callback-delivery checks in this native probe deliberately dispatch **synthetic**
MediaQueryListEvent objects. They prove actual DOM listener removal and once semantics,
including inert old targets and successful repinning, without claiming a physical monitor move.
The original CPU regression retains the varied-DPR/clamp and stale-callback checks. No Avatar,
asset, appearance, timing, GC or whole-process GPU-memory measurement is implied.

The first native probe attempted to drive automatic media-query notifications using CDP device
metrics overrides. It timed out after the initial native listener census. A separate minimal
about:blank probe observed devicePixelRatio and query.matches changing without the expected
change-event delivery under that emulation. Therefore native-v1 remains a rejected instrumentation
attempt; its report and exact source are preserved. Native-v2 changes the explicitly declared
browser check to registration/retirement with controlled synthetic events. It does not declare
the automatic display-transition test passed, change the production fix, or relax the nine CPU
groups. Automatic physical-display transition remains unobserved.

All18 configured HTML pages build after the Stage change and the comment-only Avatar disposal
update (200 modules). The build retains its existing large-chunk warning. No full-suite rerun,
asset promotion or push occurred.
