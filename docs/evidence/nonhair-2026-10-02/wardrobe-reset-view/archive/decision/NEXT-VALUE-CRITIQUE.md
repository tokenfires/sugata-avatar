# One next wardrobe usability slice

Recommend an explicit **Reset view** action for the wardrobe showcase, paired with a bounded camera-recovery question. Worth one25-minute implementation/verification slice; no new expression cue, hair edit, wardrobe geometry or broad appearance claim. This is a discoverability improvement, not a claim that current recovery is impossible or that existing angle controls are broken.

Read-only value review within06:49–06:54UTC. Current source inspected: showcase HTML/handlers, presets, ViewerFraming, Portrait Reset view, and roadmap expression/wardrobe work order. Actual originals viewed: Oct2 `captures/saved-look-export-2026-10-02-v1/desktop-saved-export.png`; Sept30 `captures/neutral-studio-ui-2026-09-30-v2/desktop-neutral-body.png`; Sept26 `docs/evidence/nonhair-2026-09-26/neutral/native-v1/desktop-warm-warm-attending-ui.png`. No browser, GPU, implementation, new image or geometry job was launched.

## Proved gap and value

`packages/testbed/src/showcase.html:25` offers Front/Side/Back and a drag/scroll hint, with no explicit reset. In the actual Oct2 desktop original the three angle buttons occupy approximately x62–235/y810–860 beneath the canvas; there is no reset alongside them. The Sept30 body original likewise has these three and selected Full look. `showcase.js:414–420` calculates its angle radius from the **current** camera distance and retains the current orbit target; therefore clicking Front after zooming does not restore the canonical zoom/distance. This is intentional angle selection, but it is not a discoverable full view reset.

A recovery path already exists: `showcase.js:239–247` reselects a canonical framing and saves that camera state, and framing buttons call it even for the currently selected mode. This should remain acknowledged. The UI does not tell users that re-clicking the selected Full look/Portrait can recover their view. An explicit Reset view would let them inspect outfit details and return to the same framing with one clearly named action.

The interaction is already established elsewhere: the actual Sept26 Portrait original visibly offers Reset view near x1150/y1158, and current `portrait.js:183–187` cancels attention, flushes damping and calls `controls.reset()`. This is a useful existing convention, not proof that copy/pasting the handler into wardrobe has been exercised.

- Alternative A, recommended: add one explicitly named Reset view button to the wardrobe's existing view actions, restoring OrbitControls' saved state for the current Full look/Portrait after flushing residual damping. Keep the current configuration and Avatar. Highest clarity with a small implementation; adds one action whose mobile layout and availability need review.
- Alternative B: explain the existing re-click-current-Framing recovery in visible help and leave the three angle controls unchanged. Smallest code/UI scope; recovery remains indirect and users must locate Framing after inspecting the canvas. It cannot be described as an explicit reset action.

## Changed decision and finite admission

**Question:** can the explicit action restore the current framing's canonical camera after orbit/zoom, including responsive viewport changes, while preserving the supported wardrobe recipe and motion-clock/pause ownership? If yes, integrate the bounded control. If camera state drifts, framing/viewport ownership is ambiguous, or reset alters settings, preserve the failed evidence and stop before widening the slice.

The saved baseline is concrete. Initial showcase setup calls `frameView(selected.frame)` before attachment/export availability; `frameView` calls `controls.saveState()`. `ViewerFraming.update()` updates `controls.zoom0` when responsive portrait fitting changes camera zoom. `flushOrbitDamping()` deliberately settles input via the public OrbitControls path. These facts make the question useful, but do not yet prove the new action works after resizing or mode switches.

Suggested finite gates before execution:

1. One current g050 wardrobe case, Full look and Portrait, desktop/mobile; one root-owned native packet. Record each canonical camera position, target, quaternion, zoom and viewport before disturbance, deliberately orbit and zoom, then reset by actual button/keyboard action. Independently compare recovery and a few subsequent controlled updates for damping drift. For resize, compare with the declared current-viewport canonical expectation rather than an obsolete aspect/zoom. Define numerical tolerances before the run.
2. Check the same Avatar/configuration, attached garments/colours, room/light, selected framing, URL and saved-look storage before/after. No reload, storage write, recipe replacement, default outfit switch or new geometry/material work. Preserve pause state and avoid resetting the clock; use controlled capture stepping for exact clock assertions, since ordinary live animation naturally advances time.
3. Match existing explicit camera-action attention cancellation semantics. An active attention action may be cancelled; do not claim to preserve it or alter its expressive cue weights/ownership. The roadmap explicitly warns against expanding cue infrastructure without a proved need, and Portrait's existing Ease to neutral is already implemented.
4. Button availability follows busy/image-export/failure states; desktop/mobile layout and keyboard focus remain usable. Name the action and intended current-frame restoration clearly. Review actual images/source plus cleanup/byte pins; run the appropriate page build. No tests that simply restate the new handler are needed.

Stop after one implemented candidate and its meaningful recovery packet. Do not treat camera-control success as wardrobe fit, expression readability, performance, full-body-range or AAA qualification. No stronger expression defect was proved in this five-minute triage; the retained Portrait controls already include Ease to neutral, so that is not a new nomination.
