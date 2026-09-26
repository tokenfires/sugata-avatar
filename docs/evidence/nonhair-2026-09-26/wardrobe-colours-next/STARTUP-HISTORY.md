# Capture startup history: diagnosed gap and bounded control

Subsequent native result: the coordinator's two-page unchanged-code run under the combined startup/epoch control also failed exact PNG equality. Its source-stable report has no browser errors and SHA-256 `581df0412df3ffbc39f108d6121545d6ab09ef83022c310e7f2787b47e0ca83d`, retained in main `captures/wardrobe-colours-2026-09-26/boot-old-repeat-v1`. The declared control did not close the rendered variation. The stop boundary applies: no further retries, added warmup or tolerance adjustment; the feature remains isolated. The diagnosis and original proposal below are preserved as the rationale for that now-rejected experiment.

The unchanged-code repeat also fails exact PNG equality. This rules out blaming the colour feature for the observed failure; it does not admit the feature or prove a sole renderer cause. The retained report is `captures/wardrobe-colours-2026-09-26/old-repeat-v1/report.json` in the main checkout, SHA-256 `b1f9bae538d2c6aaf8847415180106432e6c16231d2da66d36fedb69275f39e1`. Both native owners retired cleanly; browser errors were empty. The repeat remains rejected.

`audit-startup-history.mjs` independently reads that packet, verifies both exact state archives and PNG hashes, compares the declared export histories, and binds twelve relevant archived sources. Its output is `startup-history-receipt.json`, SHA-256 `e5e9a6f4f3a03fcacb12811cc4519736bbcd9594e3e2d564a1e7ee25052a157b`.

| Actual observation | First fresh base | Second fresh base |
| --- | --- | --- |
| Pre-capture node frame | 132 | 128 |
| Pre-capture temporal jitter index | 13 | 9 |
| Pre-capture grain uniform | 75 | 71 |
| Motion clock | 0 | 0 |
| Complete retained state SHA-256 | `cffae4e9bf408a8849ea8314d175978a4bcd91982b93917f8c0d8366ad3a0ea8` | same |
| Export node frame / indexed draws | 1000065 / 65 | same |
| PNG SHA-256 | `7d9a36801a4c8177eec32ecf932c1978977307cf479070970c206fb4b032a6cd` | `b7902a95252bbc3877afc2709bda873aca15b47d4006e69b862219a9540bf978` |

These are the verified numbers; an intermediate conversational update misstated the second startup frame/jitter values. The receipt is authoritative. The matched export history comparison preserves the existing protocol's explicit exclusions of the unchanged micro-normal parameter and stale pre-first-draw grain uniform; all actually rendered grain phases agree.

## Source-supported mechanism and limits

- `Stage.js:321–366` initializes the renderer and ultimately sets `renderFrame` as its animation callback before returning from `Stage.create`. `renderFrame` calls `Stage.draw` (`762–775`).
- Three `Renderer.js:767–835` creates and starts `Animation` during initialization. `Animation.js:70–88` immediately ticks the node clock and schedules RAF even with a null draw callback; `Renderer.setAnimationLoop` (`1921–1925`) only changes that callback.
- `Avatar.js:1235` awaits Stage creation long before asset construction finishes. The posed, dressed figure is added to the Stage at `3085`; `swapFigure` later awaits `attachHair` at `3174`, whose module and GLB awaits are at `3330–3337`. The figure is already visible across that asynchronous interval. This is an initialization window, not a proposed groom change.
- Only after figure construction does Avatar register its motion frame callback (`1508`) and clear the Stage animation callback for `autoStart:false` (`1526`). Consequently, zero motion time does not imply zero earlier beauty draws.
- The existing micro capture installs after `window.showcase` readiness. It stops the underlying animation and resets node epoch/time plus temporal history, but cannot erase prior per-object renderer history. `MorphVelocity.js:272–343` retains previous/last-seen influence arrays in a WeakMap; Three `VelocityNode.js` separately retains prior model/camera matrices. `TRAAPost.js:255–261` resets resolve jitter/history dimensions only. The current epoch of 1000000 already avoids the old literal small-frame-ID guard collision; that specific collision is not established here.
- `alive.js:2998–3078` documents the earlier dressed-boot defect and its incomplete internal-counter attribution. Its fix holds the figure invisible across asynchronous dressing; `2018–2024` additionally holds it through asynchronous final attachment. That precedent motivates removing a variable startup input, but its historical pixel results are not measurements of current Showcase.

The current receipt lacks a complete before-ready Stage draw census and per-mesh cache observation. Startup frame and jitter differences are observed; the assertion that one of those caches fully causes this PNG difference remains unproved.

## Two bounded alternatives

**Preferred: hold Stage rendering before native Avatar construction resumes.** A capture-only wrapper awaits the unchanged `Stage.create`, immediately clears the native callback and stops its animation chain, then lets native construction continue. It records actual calls rather than suppressing or pretending to count draws. A shared pre-ready node epoch/time removes clock differences from the native page's own initial public draw. This controls both startup beauty and early node time; a positive result is a combined diagnostic condition, not sole-cause attribution. Native room PMREM/offscreen work remains intact and outside the Stage.draw census.

**Alternative: hold the complete figure invisible only during its native asynchronous final attachment.** This more closely follows the existing Alive approach and leaves background startup drawing intact. A capture-local wrapper would have to preserve/restore the actual visible flag on every success/failure, without removing the object, changing assets, or changing attachment order. It would not control room/camera/background history or node timing, and therefore is a narrower, potentially insufficient intervention. It is not implemented or recommended as a parallel experiment now.

Neither alternative changes the PNG equality rule or adds arbitrary warmup draws. The first diagnostic should be exactly two unchanged old-code pages with the preferred shared condition. If exact return still fails, preserve the result and stop; do not fish for warmup counts or thresholds. If it passes, feature qualification still needs matched old-code and feature controls under this same newly named protocol. Previously rejected images cannot become accepted defaults retroactively.

## Implemented helper API and source review

`showcase-boot-hold.mjs` exports `BOOT_FRAME = 999999` and `installShowcaseBootHold({Stage, Avatar})`. The caller installs it before executing the untouched original Showcase module through the same Vite graph. The value is the immediate predecessor of the existing capture helper's 1000000 reset, so the single native page-ready draw has an explicit epoch below that reset; it is not a warmup parameter.

- `receipt()` returns a copied trace.
- `admitReady(showcase)` requires the actual native returned Avatar and Stage, zero Stage draws at Avatar.create resolution, exactly the original page's one zero-dt ready draw, motion time zero, and an unchanged stopped node clock. It restores only exact owned descriptors, then publishes the ready admission. It must run before `createMicroCapture` installs another draw hook.
- `restoreForRetirement()` restores owned descriptors on a failed/unfinished boot. It does not restart the animation. A successful native factory return that fails this wrapper's postchecks is still unpublished, so the wrapper retires that actual native owner exactly once before throwing. Original factory rejections keep the factory's own disposal; after the wrapper returns successfully, the page's original handler owns teardown. Primary and retirement errors remain distinct in the failure receipt. Foreign descriptor changes are preserved and reported as errors.

Native signatures are pinned and preserved: Stage.create arity 1, Avatar.create arity 0, Stage.draw arity 0. Receivers, original argument references, native returned objects and the one original ready draw remain unchanged. Partial installation and construction failures restore owned descriptors and cannot manufacture a ready admission.

The timing argument is narrow: after Stage's final synchronous callback setter, the wrapper continuation runs in the promise microtask chain before Avatar continues. It clears the callback and cancels RAF before its own await can yield. The only immediate node tick during renderer initialization has a null Stage callback. The native run must still prove the observed zero-draw boundary rather than accepting this argument alone.

`boot-hold-cpu-v5.json` records fourteen passing groups: normal identity/arguments/signatures, stopped asynchronous window, detected early draws, native failures, unpublished-owner retirement and cleanup-error preservation, wrong ready counts, foreign owners/clock drift, descriptor drift, no phantom ready on failed cleanup, partial installation, reuse/manual-clock refusal, signature refusal, and strict illustrative HTML substitution. These synthetic observable classes test ownership and admission, not GPU behaviour or browser scheduling. Exact prior unlaunched sources/receipts remain in `boot-unlaunched-v1` through `boot-unlaunched-v4`.

Root owns the actual Vite pre-HTML bootstrap and native controller. `showcase-boot-entry.mjs` and `showcase-boot-route.mjs` are unused illustrative alternatives authored before that ownership handoff; they are not an admitted native route. The chosen controller must bind its exact transformed entry/HTML, native module sources and actual assets, retain the complete boot receipt before the existing micro helper, compare the full native geometry/physical/camera state, preserve exact A/A PNG equality and clean retirement, and refuse incomplete or failed boot admission. No product source, asset, dependency or hair parameter was changed by this work.
