# Independent review: Portrait room chooser

Reviewer: `/root/critic`, 2026-09-26. CPU/source/image review only; no additional browser or GPU run.

## Verdict

**Integrate the room chooser with the reviewed lifecycle correction.** Forward selection, rendering, and the conditional persisted-history recovery are acceptable. This is a functional room chooser review, not a new qualification of hair, clothing, motion, or Kitchen lighting across arbitrary cameras.

## Evidence and result

I reviewed `viewer-scenes.mjs`, its tests, the Portrait integration, and the native probe. I reran the shared scene helper's four CPU groups. I independently verified all 310 capture-time source hashes and all 16 image hashes in `portrait-v1/report.json` against the current files before the restoration correction. The report completed with no errors. Its eight focused native groups cover both existing cuts, desktop/mobile Studio/Kitchen views, keyboard room activation, native exposure, selected controls, same-room no-ops, lifecycle disposal, and invalid scene rejection.

Kitchen correctly omits an explicit Studio lighting override: its actual native exposure is 2.04; Studio is 0.85. This avoids the earlier capture mistake of selecting a room while retaining Studio's exposure. The scene helper rejects duplicate or unknown room selections. Room changes visibly disclose that pose and expression restart, and preserve the starting identity and hair selection.

I inspected all four Kitchen compositions (desktop/mobile and bob01/bob02), their available UI plates, and representative Studio controls. The face, eyes, and neutral head region remain readable. The narrow view uses the previously reviewed framing fit. Kitchen's warmer background remains recognizable. Existing hair-card and neckline limitations remain visible and are not room-chooser regressions.

## History restoration finding and correction

The captured source disables the Portrait fieldsets, Pause, and Reset while navigating to another room. Its persisted `pageshow` branch restarts the animation loop but does not restore those controls or the status. A document restored from a back-forward cache would therefore retain its navigation-disabled UI. This is a definite missing recovery in that conditional code path; it is **not** an observed native back-forward-cache failure. All eight recorded native `pagehide` events had `persisted: false`.

The coordinator accepted a bounded correction: track room navigation separately, restore the existing healthy Avatar's controls/status on a persisted return, preserve camera/clock/pause state, and bound the animation loop to one scheduled request. A controlled persisted-event regression must distinguish running, paused, capture, and failed states. Native browser cache eligibility remains unqualified unless actually observed.

**Final correction review:** the current source implements those guards without resetting the owned Avatar. `lifecycle-baseline/report.json` reproduces seven disabled Portrait controls (fourteen for Wardrobe) and the stuck Preparing status in four retained-document fixtures. `lifecycle-fixed/report.json` passes five contexts: capture and live-paused on both pages, plus live-running Portrait. The actual Room click is served HTTP 204 to retain its document, then explicit synthetic persisted hide/show events exercise the handlers. This is a native-page handler test, not native back-forward-cache admission.

I reread the final probe, independently verified the 16 source snapshots and eight PNGs in the red fixture, the 16 current/frozen sources and ten PNGs in the green fixture, and independently compared recorded owner, camera, URL, identity, pause, control and RAF state. I inspected four restored green UI images across both pages. Controls recover; capture has zero live animation callbacks and live pages retain exactly one across two cycles. Atomic transition time stays unchanged; running Portrait resumes its clock afterward. The failed/disposed-owner guard was inspected in source rather than exercised as an additional failure injection.

The same report records a real forward Portrait-to-Kitchen navigation after the correction: fresh document, native exposure 2.04, initial clock zero, retained identity/cut, and clean prior-owner retirement. It reports no unexpected errors; the HTTP 204 fixture's navigation aborts are separated explicitly. The conditional recovery blocker is resolved.

## Nonblocking usability observation

On desktop the new Room row sits below the initial fold, so finding it can scroll the portrait out of view. The current controls are readable and usable. Two later alternatives are a sticky desktop viewport (keeps the visual alongside the controls but needs short-window/scroll testing), or moving Room beside the existing view controls (improves discovery but changes the established ordering). No layout change is required for this slice.

Signed: independent critic agent `/root/critic`.
