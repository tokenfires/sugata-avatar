# Independent review: linked colour-editor entry

## Disposition

**Accept the small navigation change for the observed fresh-entry and idle/ready fragment paths.** The original defect is demonstrated in actual desktop/mobile screenshots, and the candidate opens and focuses the requested editor without changing the applied look. No additional product defect was established in this review. This does not qualify colour application, live asynchronous navigation, cross-document bfcache restoration, rendering repeatability or avatar appearance.

The critic launched no browser/GPU jobs and changed no product or asset files. I read the captured source, independently checked its bindings and state receipts, and directly inspected all four baseline and all five candidate original PNGs.

## Evidence and bindings

- [Baseline report](../../../../captures/showcase-section-entry-baseline-2026-09-30-v1/report.json): SHA `28203e251fed515fa4155bbec90397bce9deb1f0dcdfc5e6288e4a3109f997f6`, four fresh owners. Every target was closed and its fieldset hidden.
- [Candidate report](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/report.json): SHA `5097ca050a23697152db08959c933c0c2b6e76a0f6428390fe8be802fb343cb3`; PID 17837, September 30 23:59:55.030 to October 1 00:00:09.447 UTC. `status: observed`, `errors: []`, five clean disposals with no reported leaks.
- All 378 declared candidate source/asset pins matched the reviewed worktree. The four archived source files and instrument matched their recorded hashes; all five original PNG hashes and the bound baseline-report hash matched. Thirty recorded GLB responses match the declared asset pins. The only baseline-to-candidate difference in the source inventory is `packages/testbed/src/showcase.js`.
- [Captured implementation](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/source/packages/testbed/src/showcase.js), lines 32–41 and 418: only the two exact editor hashes are admitted; the function opens the corresponding details, focuses its summary with `preventScroll`, and scrolls instantly. It is called after readiness and on hash changes. It writes no configuration, colour draft, camera or Avatar state.

## Proved mismatch and alternatives

The review's editor links previously stopped short of exposing the editor. In the [baseline mobile Hair image](../../../../captures/showcase-section-entry-baseline-2026-09-30-v1/mobile-hair-colours.png), the collapsed Hair colour summary is at the top, followed by Framing, Scene and Light; no shade selector is visible. The [baseline desktop Mix image](../../../../captures/showcase-section-entry-baseline-2026-09-30-v1/desktop-mix-colours.png) shows a closed Mix colours section in the general lookbook. These agree with all four recorded `open: false` / `fieldsVisible: false` observations.

Two concrete remedies were considered:

1. **A, selected and now observed:** open/focus the requested section after readiness and on supported fragment navigation. This completes the link's editing intent while retaining its exact look recipe; it adds a small focus/disclosure behavior that needs native checks.
2. **B:** keep product navigation unchanged and tell readers to open the collapsed section after arrival. This avoids product code but preserves the extra discovery step visible in the baseline.

The actual candidate supports A. [Desktop Mix](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/desktop-mix-colours.png) exposes all three part controls beside the avatar; [desktop Hair](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/desktop-hair-colours.png) exposes the Original shade selector and guidance. [Mobile Mix](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/mobile-mix-colours.png) and [mobile Hair](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/mobile-hair-colours.png) fit the 390-pixel width and show the appropriate editor at the top. Their focus outlines are visible. The mobile images establish editor access, not simultaneous avatar visibility.

## Functional observations

The four linked entries retain their corresponding baseline configurations exactly: body framing for Mix and portrait for Hair. Their intended summaries are the active elements, fieldsets are visible, and first editable controls lie entirely within the viewport: Mix begins at approximately y=122, Hair at y=104. The pinned [instrument](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/instrument.mjs), lines 95–97, explicitly asserts Tab reaches that control, then performs Shift+Tab before the screenshots. The resulting originals visibly show summary focus; Shift+Tab has no separate stored focus assertion.

The fifth [ordinary desktop entry](../../../../captures/showcase-section-entry-candidate-2026-09-30-v1/desktop-ordinary.png) has no fragment, both editors closed, BODY focus and no horizontal overflow. This preserves the ordinary entry layout.

In the desktop Mix owner, the four unknown/malformed/Hair/Mix hash transitions preserve the complete configuration, camera matrix, Avatar identity, clock 0, renderer frame 99, enabled Top draft and its unsaved `#123456` value. I independently compared those recorded states. Manual collapse remains respected through unknown/malformed fragments; switching to Hair does not erase the Mix draft, and returning to Mix does not close Hair. Native same-document Back preserves owner, draft and configuration. These are direct interaction observations under the declared zero-time capture protocol, not a continuously running-motion measurement.

## Boundaries and remaining choices

The implementation explicitly returns while `busy` or `failed` at line 35. An in-place dress completion does not replay a hash change that occurred while busy. No such failure was observed or repaired here, and the present acceptance is limited to fresh ready entry and idle/ready fragment navigation. If deferred behavior becomes a requirement, two concrete choices remain:

- **A:** retain only the latest supported hash and process it after the relevant operation becomes ready. This gives deferred entry semantics but adds asynchronous state and ownership cases to qualify.
- **B, retained for this slice:** keep the observed idle/ready contract. This avoids expanding the final bounded change, with busy-operation entry explicitly unqualified.

No claim is made about all browsers or keyboard accessibility, reapplying colours, every saved recipe, browser bfcache, instant lighting convergence, exact screenshot equality, or hair/garment fit. Existing rendering and appearance limitations remain visible and unchanged. The reviewed day-report draft correctly retains the experimental foundation's runtime/outfit rejection and labels automation shutdown as pending; its pause must only be reported after the actual final action.
