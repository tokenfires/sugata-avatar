# Desktop review scroll — bounded result

**Approved for integration after independent review of the follow-up.** `candidate-v1/showcase-1024x800-document-end.png` is retained but rejected for image/measurement correspondence: it was shifted upward about 56px relative to the recorded DOM. The focused [settled-1024-v1/report.json](settled-1024-v1/report.json) verifies unchanged CSS with bounded wheel increments and compositor settling, identical before/after screenshot state, independent canvas-edge pixels and the footer border at pixel 752 matching DOM y751.859. The old mismatch disappears after settling, supporting a capture/scroll transient consistent with elastic overscroll. The exact compositor mechanism is not directly proven; no persistent CSS crop was observed.

Two CSS rules keep the Portrait and Wardrobe preview visible beside lower desktop controls. Each uses `position:sticky; top:16px; align-self:start`. Existing canvas sizes and composition remain unchanged. Mobile and short windows retain ordinary scrolling: sticky applies only at Portrait widths/heights ≥651/612px and Wardrobe ≥761/732px. These guards allow the existing maximum minimum-height plus 16px top/bottom space.

The product diff is one rule each in `portrait.html` and `showcase.html`; no JavaScript, core, renderer, attention, asset or hair changes. The all-page production build passed with only the existing chunk-size warning.

## Measured before/after

The gate used actual sidebar wheel scrolling, keyboard focus on Reset view/Open settings, and document-end scrolling. These are viewport-sized screenshots at the recorded scroll position. All three candidate cases retained the complete preview at top 16px during all three scroll/focus states:

| Page/window | Preview height | Visible after baseline sidebar scroll | Visible with sticky |
|---|---:|---:|---:|
| Portrait 1440×1000 | 850px | 472px | 850px |
| Wardrobe 1440×1000 | 868px | 450px | 868px |
| Wardrobe 1024×800 | 700px | 282px | 700px |

- Baseline: [baseline-v1/report.json](baseline-v1/report.json), 6 groups passed.
- Candidate: [candidate-v1/report.json](candidate-v1/report.json), 9 groups passed using the production build; zero page/console/network errors. Browser/server closed after every run.
- Scrolling preserved canvas CSS/buffer dimensions, camera world pose/target/distance/aspect/zoom, neutral head support projection, fixed clock, active attention and Wardrobe configuration. No sticky overlap with sidebar or containing main was measured.
- Both 1440px pages returned through 390×844 mobile and short desktop windows (Portrait 1440×600, Wardrobe 1440×700). Those layouts remained relative-positioned, ordinary scrolling, with the exact baseline sizes/cameras. Returning to desktop restored the previous view and sticky layout.
- Native drag/dolly worked at the pinned screen position and released attention. Portrait Reset restored the canonical camera, and one real Room click loaded Kitchen with its native exposure 2.04. Wardrobe's actual PNG download while pinned preserved 900×868 buffer dimensions, fixed clock, configuration and camera projection.
- The ordinary initial/native PNG pair was visually inspected for the same framing. **Pixel equality was not asserted**: the native renderer continues its temporal settling at zero clock. These images contain existing hair/neckline artifacts; they are scroll/export witnesses, not appearance acceptance.

Root narrowed the executed functional scope from the planning checklist. This slice did **not** repeat expression/Light, JSON file chooser/error, garment changes or the full room/settings matrix; the separately accepted room/settings gates cover those features. [PLAN.md](PLAN.md) remains the original proposal, not a claim that every proposed test ran.

## Honest instrumentation correction

The original capture gate asserted sticky top, bottom and container bounds but did not separately assert `visibleHeight === preview.height` or nonnegative top. Critic identified that claim gap after candidate-v1 completed. Its exact recorded rectangles nevertheless showed complete visibility in all nine desktop scroll/focus/end states.

[verify-retained.mjs](verify-retained.mjs) recomputes visible height from those retained rectangles and asserts full visibility and nonnegative top. [verification-v1.json](verification-v1.json) binds the original baseline/candidate report hashes, all 36 captured PNG hashes, all 313 current non-harness source/asset hashes and 103 built output hashes. The exact original capture harness is preserved in [captured-instrument-v1/probe.mjs](captured-instrument-v1/probe.mjs); its bytes match the hash in both v1 reports. That is a source snapshot, with imports intended for its original location.

The intermediate two-assertion-only gate is preserved in [strengthened-instrument-v2/probe.mjs](strengthened-instrument-v2/probe.mjs). A baseline-v2 replay had already started when root/critic chose CPU verification instead of another unchanged full candidate rendering; its passing report/plates are retained as supplemental evidence, not required for the v1 result.

After the image discrepancy was found, root authorized only the affected 1024 follow-up. [settled-probe.mjs](settled-probe.mjs) captured three states (sidebar wheel, lower keyboard focus, document end) from the exact production candidate, with no new CSS or asset changes. All three passed before/after screenshot state and canvas-edge pixel checks; the visible end footer also passed the independent pixel-position check. Its 314 source/asset hashes and 103 build hashes stayed exact, errors were empty and browser/server closed. The original end plate remains rejected as a settled-state witness. No full candidate-v2 rendering was run, and no product change was needed for this correction.

The final reusable [probe.mjs](probe.mjs) now also adopts bounded wheel increments, at least one second of stable scroll/compositor settling and screenshot-adjacent state assertions from that successful focused follow-up. Its full matrix was not rerun; the runtime acceptance above belongs to the exact archived v1 gate plus the separately bound affected-case follow-up. The current helper passed syntax checks. Do not relabel the original captures as having run this later helper.

## Rerun

To verify the retained evidence without GPU:

```sh
node docs/evidence/nonhair-2026-09-26/review-scroll/verify-retained.mjs
```

For a new baseline/candidate pair, use isolated checkouts or explicitly controlled HTML snapshots: baseline mode expects the pre-change non-sticky HTML; candidate expects the two rules. Every other bound source, including the chosen gate version, must match between them. Run serially with all other GPU work and choose fresh output directories:

```sh
node docs/evidence/nonhair-2026-09-26/review-scroll/probe.mjs --mode=baseline --out=/tmp/review-scroll-before-new
# Apply the two CSS rules and build the candidate.
npm run build:pages
node docs/evidence/nonhair-2026-09-26/review-scroll/probe.mjs --mode=candidate --baseline=/tmp/review-scroll-before-new/report.json --out=/tmp/review-scroll-after-new --production
```

This result is desktop scroll usability on the current g050 study. It is not a new framing, hair, garment-fit, animation, performance, browser-family or all-window-size qualification.
