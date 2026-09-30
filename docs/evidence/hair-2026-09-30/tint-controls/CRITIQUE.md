# Independent tint-controls critique

Reviewed 2026-09-30. This review covers the frozen V3 product evidence and the one declared repeat diagnostic. No native job, renderer change, asset change, or additional capture was performed by the critic.

## Disposition

Support bounded integration of the editable base/tint recipe and the inspected static colour controls. **The original exact-image gate FAILED and remains failed.** Functional integration is not full exact-render qualification; retain image reproducibility as a separate unresolved rendering issue. Do not describe this packet as an all-checks pass, a diagnosed reset fix, or proof that tint cannot contribute to any rendering difference.

The inspected controls provide useful product behavior requested in the [appearance brief](../../../research/bob-appearance-brief-2026-09-29.md). They do not qualify new hair geometry, motion, natural dye fidelity, strand highlights, or arbitrary scene/colour combinations. The accepted asset pins remain the existing bob01 and bob02 assets; experimental geometry was not introduced.

## Evidence and source boundaries

- [V3 report](../../../../captures/hair-tint-controls-v3/report.json): 15 canvas/UI cases; three recorded functional-check groups completed; no recorded page/console/HTTP errors; 15 observed owners disposed with empty `leaked` arrays. Its final status is `failed` because all six zero-pixel comparisons failed.
- [Repeat-diagnostic report](../../../../captures/hair-tint-repeat-diagnostic-v1/report.json): status `observed`, 12 captures, three independent page loads, two epochs and two repeats per epoch, Apple metal-3 WebGPU. Report SHA-256: `1a374d6d702b807f33577453f7e9feae7215ff310f12a057a3693687a98ef9e9`. This diagnostic monitors page errors; its empty error array is not a new console/HTTP-error guarantee.
- The critic verified every declared diagnostic source hash against current bytes and its saved source copy, plus every diagnostic PNG/state hash. No mismatches. V3 source/image/state pins were independently checked during the preceding review.
- Inspected V3 UI images: base, zero, mixed, full-tint, tint-off, long-bob, mobile-long-bob and picker-precision. Inspected original-size canvases: base, mixed, zero, full-tint, full-tint-red-base, picker-precision, Original and Original-restored. Also inspected diagnostic load-0 epoch-0 repeat-0/repeat-1 and epoch-10000 repeat-0 canvases.

## Product observations

The [mixed UI](../../../../captures/hair-tint-controls-v3/mixed-ui.png) separates Base colour, Base lightness, Add a tint, Tint colour, Tint amount and Colour to apply. Brown, 35% lavender and full lavender are visibly distinguishable. [Zero](../../../../captures/hair-tint-controls-v3/zero-ui.png) keeps an enabled editable tint recipe with the base resolved colour. [Tint off](../../../../captures/hair-tint-controls-v3/tint-off-ui.png) restores the current Red base after the base was edited under 100% tint. Those observations agree with recorded configuration and actual attached material values; they do not establish pixel identity.

The [mobile long-bob page](../../../../captures/hair-tint-controls-v3/mobile-long-bob-ui.png) fits its captured 390-pixel width, with labels, pickers, sliders and Apply inside the panel. The Kitchen long-bob rendering is a useful additional instance, not an isolated comparison with the short Studio cut. Existing crown/fringe irregularity remains visible and is outside this control qualification.

The precision repair is supported by source and the native path. In `showcase-hair-colours.mjs` lines 68–79, toggling restores the canonical remembered recipe, picker input preserves its amount, and only amount input reconstructs amount from the slider. The V3 harness lines 126–129 loads `0.12345678912345678`, toggles off/on, changes the native picker to `#224466`, applies, and confirms the exact stored amount. The [picker image](../../../../captures/hair-tint-controls-v3/picker-precision-ui.png) displays 12.35%; this display rounding is not persisted as the recipe value. No remaining precision defect was demonstrated.

The source endpoint shortcuts, recipe-aware Apply, strict validation, and URL/JSON/named-look restoration preserve the intended distinctions between omission, zero amount and full amount. Original removes both options and restores the original attached linear value. I found no demonstrated product-source defect requiring another tint implementation change in this scope.

## Finding 1: image reproducibility is unresolved after the bounded diagnostic

### Actual witnesses

V3 recorded these changed-pixel counts: independent base reload 267; base versus zero 223; mixed versus JSON reopening 207; full tint versus changed base under full tint 373; Original versus restored Original 96; mixed versus named reopening 145. Maximum channel differences are approximately 4–5/255. All six `pass` fields are false. The harness preserves the zero-pixel assertion at `hair-tint-controls-review.mjs` line 135.

The additional untinted-brown diagnostic produced:

| Comparison | Changed pixels | Maximum channel difference |
| --- | ---: | ---: |
| Same page, epoch 0 repeat, loads 0/1/2 | 70,048 / 70,034 / 70,049 | 22/255 |
| Independent loads at epoch 0, first plate | 268 / 231 | 5/255 / 4/255 |
| Same page, epoch 10,000 repeat, each load | 172 | 3/255 |
| Independent loads at epoch 10,000, first plate | 0 / 0 | 0 |

Every compared expanded fixed field agrees within its comparison: bones, morphs, mesh transforms/renderOrder, scalar/vector material data, lights, grade and clock observations, camera, GPU hair buffers and configuration. This is equality of recorded observations, not exhaustive equality of hidden render state or temporal texture contents. `frameEpoch()` exposes jitter index/period/history width; it does not expose the history image.

The source loop at `hair-tint-repeat-diagnostic.mjs` line 26 always executes both epoch-0 sequences before epoch 10,000. Thus the exact cross-load high-epoch images are confounded by prior draw history. Its remaining same-page difference also prevents a reset-fix claim. Incomplete capture-history reset is a plausible hypothesis, not an attributed cause. The same-base observation does not waive the original feature gate or identify tint as either responsible or exonerated.

### Two alternatives and decision

- **A — Selected and supported:** Integrate the verified editing/persistence behavior and the actually inspected static controls, preserving V3's failed status and a separately tracked exact-render issue. This delivers the demonstrated product capability without inventing a render pass; the limitation must remain visible in acceptance notes and future comparison work.
- **B:** Hold the product changes until a separately scoped capture-state investigation achieves the original exact gate. This gives a single stronger acceptance boundary but delays working controls for an unattributed comparison failure that also occurs without tint.

The bounded diagnostic is complete. Neither alternative calls for more epoch/seed trials, a tolerance change, or another feature rewrite from these results alone.

## Finding 2: identifier identity must not be claimed across all loads

### Actual witness and mismatch

The raw [load-0 state](../../../../captures/hair-tint-repeat-diagnostic-v1/load-0-epoch-0-repeat-0.json) versus [load-2 state](../../../../captures/hair-tint-repeat-diagnostic-v1/load-2-epoch-0-repeat-0.json) differs outside `fixed`:

- `idOrder[6]`, `Humanhigh-poly`: id 92 becomes 91.
- `idOrder[8]`, `Humantongue01`: id 91 becomes 92; materialIds `[38]` becomes `[40]`.

Traversal names/order and the compared fixed fields agree. Source lines 34/38 save `idOrder` outside `fixed`; line 19 compares only `fixed`. Therefore a blanket claim that all IDs were identical is incorrect. This does not attribute the pixel differences: same-page repeat differences also occur with identical IDs, and scene traversal is not a trace of actual GPU draw execution.

### Two alternatives and decision

- **A — Recommended:** Correct the archive narrative to record these exact metadata exceptions while preserving all raw evidence and the valid fixed-field equality. This is sufficient for the present bounded disposition and needs no recapture.
- **B:** Include identifiers and an actual render-order observation in a future dedicated determinism study. This would investigate whether ordering matters, but adds instrumentation and cannot infer causation from identifier changes alone.

## Finding 3: the long desktop screenshot is content evidence, not normalized layout evidence

### Actual witness and mismatch

The [long-bob full-page screenshot](../../../../captures/hair-tint-controls-v3/long-bob-ui.png) places the avatar far down the left side beside a long control panel. Desktop `.viewport` is sticky (`showcase.html` line 15); the harness captures `fullPage:true` at line 90 without recording/resetting scroll, after the frame-control interaction at line 117. The image therefore does not establish a newly broken desktop layout or support a normalized placement comparison with the base screenshot.

### Two alternatives and decision

- **A:** For future layout qualification, record scroll and element bounds, then capture a normalized top viewport and the actual interaction viewport. This separates sticky placement from layout defects at the cost of additional observations.
- **B — Selected and supported:** Retain this desktop image as content/control evidence, with the directly inspected mobile width-fit observation stated separately. This completes the present product review without a new capture, while leaving desktop sticky-placement qualification open.

## Stop boundary

No tint shader/material algorithm change, render tolerance waiver, new colour calibration, geometry adjustment, or additional native diagnostic is justified by this review. Preserve the failed gate and the observed-state limits alongside the functional integration. The supported claim is that the inspected editable base/tint controls work and retain their recipe through the exercised paths.
