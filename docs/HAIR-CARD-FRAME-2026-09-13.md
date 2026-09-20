# Continuous hair shading — September 13, 2026

Both moving bobs now interpolate their shading frame from the existing dynamic card edges. This reduces the blocky, checkerboard-like highlights within each strip while preserving the accepted hair positions, collision work, root feather, strand texture, and temporal history. The broad strip boundaries, exposed rear backing, and lower silhouette still need authored shape work. This is a bounded visual improvement, not AAA completion.

## What changed

The old material derived its along/across directions separately within each rendered triangle. The new frame interpolates unnormalised derivatives at the original card vertices and uses them for both the lighting tangent and the view-facing fiber normal. The across-card length also drives strand phase and its screen-frequency fade. The controlled isolation shows that smoothing direction and length together produces the useful result; neither isolated arm reproduces it.

`HairCardFrame` borrows the existing dynamic edge buffer and transforms difference vectors with the current model-view matrix, excluding translation. It adds no geometry attributes, solver buffers, history buffers, or CPU readback. Caps keep their original fragment derivatives. Collapsed or unavailable frames use that same fallback.

The material's object update checks source readiness, reset generation, untracked compute use, and the attached mesh/geometry/material/position identity before binding the frame. Source retirement synchronously detaches the frame; Avatar also explicitly retires it during replacement and disposal. `Avatar.report().hair.cardFrame` identifies the current mode and fallback reason. Unsupported custom atlas layouts retain derivative shading and release the pending borrow. Unexpected source, installation, and cleanup failures remain errors.

All six bundled bob bakes satisfy the actual solver topology and atlas contract. Rigid MSAA fallback avatars retain derivative shading. No asset or physics equation changed.

## Evidence and its limits

| Study | Evidence | Result |
| --- | --- | --- |
| Continuous inner curtain | 18 PNGs, 12 exact physical pairs, both bobs at three angles | Fills the upper rear opening but retains a panel and comb-like lower teeth. Rejected; no motion qualification earned. |
| Direction/metric isolation | 24 PNGs for baseline, copied passthrough, combined edge frame, and direction-only; 12 further PNGs for metric-only | Combined frame visibly reduces within-strip patchwork. The two isolated mechanisms are insufficient individually. |
| CPU frame vs live GPU prototype | 18 PNGs, 12 exact physical pairs, six clean disposals | CPU/GPU differences affect 12–337 pixels of each 608,600-pixel canvas, by at most one 8-bit code value. This is an unmasked full-canvas comparison. |
| Selected live prototype in motion | 72 PNGs, 36 exact baseline/candidate physical pairs, eight clean disposals | Improvement survives independently inspected natural and opposing head-shake samples. Three simulated seconds and nine recorded samples per run. |
| Owned integration equivalence | 18 still PNGs and 72 motion PNGs | All six selected-prototype/integrated still pairs and all 36 corresponding motion pairs are pixel-identical. Each motion pair also has identical recorded hair, head, face, camera and clock state. |
| Actual owner lifecycle | 24 recorded cases, seven PNGs | Reset-before-update fallback and rebuild recovery; off/TRAA/TAAU, debug and direct cameras; repeated install/remove with unchanged storage; raw-source fallback, source retirement, all bob bakes, final cleanup, both rigid MSAA styles. |
| High quality and image export | Two high-tier renders; 13 export groups | Both bobs compile/render with the high-tier lighting pipeline. PNG export preserves the actual canvas and physical state. This does not establish a frame-rate or high-tier motion target. |
| Custom atlas recovery | Three real browser loads | A routed copy changes only the first card's atlas width. Both original bobs remain smooth; the custom bob attaches, simulates, renders with derivative shading, and disposes cleanly. Repository assets are untouched. |

The final local CPU checks cover 12 frame-owner groups, all six actual bob layouts, 137 Avatar assertions, 22 history groups, 13 native callback/MRT controls, five root-profile groups, and 92 catalogue assertions. Browser/runtime evidence remains separate from these CPU checks. The all-page build and source inventory are recorded in the evidence ledger.

The independent critic proved the custom-atlas compatibility regression in the initial candidate, offered two alternatives, and reviewed the typed fallback. Its source/ownership and saved-image reviews, including the initial red control, are archived under `critic/`. The original shader path and the matched fixed-layout graphs are unchanged by the fallback correction; a fresh browser check verifies the final source on both original bobs and the altered fixture.

These sampled sequences do not exclude flicker between recorded frames, establish long-duration stability, or prove 60 fps. Broad rear coverage and hairstyle quality remain open. The existing solver settling and g025 contact calibration limitations are unchanged. No model inference or model selection changed during this work.

## Preserved rejected/partial evidence

The first layered-curtain run failed because the harness passed an import option in the wrong shape, before rendering. The corrected run is preserved beside it. The first smooth-frame campaign includes a partial guide-centre arm: actual guide differences collapse at bob02 card348/ring0 and nearly collapse at card424/ring0. It was not silently patched with an arbitrary tangent. The selected edge-difference arm remains valid.

The raw live-prototype motion report incorrectly describes a CPU comparison; its actual arms are baseline fragment derivatives and GPU frame. Its per-sample source check runs after drawing, so it is not evidence of a pre-draw guard. The integrated owner has a separate native object-update guard and real reset-before-draw qualification. Raw reports are retained unchanged with these corrections here and in the critic review.

One historical CPU static control differs from the earlier edge-frame capture at 303 one-code pixels; 11/12 historical controls are byte-identical. Current paired reference and integrated equivalence checks are independent of that historical residual.

## Recovery and next action

Complete local evidence is under `captures/hair-card-frame-2026-09-13/`; its re-read hash inventory and source/gate ledger are in `docs/evidence/hair-card-frame-2026-09-13*.json`. The archive contains baseline source at `aede7d3`, initial and final integrated source, all raw studies, partial failures, probe helpers, selected prototype, and independent reviews. Original absolute scratch paths are retained in raw reports; archived helpers and sources allow reconstruction without relying on those directories.

Next: return to authored rear layering with the accepted shading improvement held constant. Start by measuring and varying the outer locks' bend/release heights and overlap against the now-clearer rear backing. A shorter continuous inner layer with sustained lower overlap is a separate alternative. Compare matched fixed views before adding dynamics or more history machinery. Preserve the accepted face, collision, wardrobe and Converse work.
