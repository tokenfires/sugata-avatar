# Desktop preview during control scrolling — proposed bounded slice

Status: CPU/source/retained-image audit only. No UI implementation or new browser/GPU run in this audit. Root decides whether to proceed after the room chooser is integrated.

Inspected inputs (SHA-256):

```text
50eece8f0b36e98d63e25df1075b607acb7a59a7275569ed749e593d7e7415d9  packages/testbed/src/portrait.html
a13118233d42db2ae4f3d687bda33a70d23cf370064eac58fca713169f58b4d6  packages/testbed/src/showcase.html
658b366df98a50f91cb260a2bc3c73c704bf001a53993e5ea326b2dbc20bf2fe  rooms/portrait-v1/bob02-desktop-studio-ui.png
73f58ac43588565c34d6b158ae8e1ac686721dbed97a73f18c464a1e0731dfc6  scenes/wardrobe-v1/kitchen-mixed-desktop.png
```

## Observed deficiency

- Portrait's retained [1440 × 1000 Studio plate](../rooms/portrait-v1/bob02-desktop-studio-ui.png) is a 1440 × 1466 full-page screenshot. The Room buttons start around document y1038, below the initial viewport; Light and Reset view are lower still. The canvas is document y88–938. Scrolling toward those controls necessarily moves part of the preview above the viewport under current CSS.
- Wardrobe's retained [1440 × 1080 Kitchen plate](../scenes/wardrobe-v1/kitchen-mixed-desktop.png) is 1440 × 1523. Its canvas occupies document y82–1030; Save image, settings exports and Open settings are near/below the initial fold. Kitchen already hides Light, so the longer Studio sidebar has at least the same issue. The footer and study disclosure add more scrolling.
- `portrait.html` uses a two-column grid above 650px, with `.portrait { position:relative; height:calc(100svh - 150px); min-height:580px }` (550px minimum at widths ≤900px). `showcase.html` uses a grid above 760px, with `.viewport { position:relative; height:calc(100svh - 132px); min-height:670px }` (700px minimum at widths ≤1100px). Neither preview has sticky positioning. There is no ancestor overflow clipping or transformed containing block in these page styles.
- Image coordinates above are read from retained screenshots and existing CSS, not a fresh live scroll measurement. The focused gate below must record actual browser rectangles before claiming closure.

## Minimal recommendation

Add only the following CSS to each page, after its current responsive rules:

```css
/* portrait.html */
@media (min-width:651px) and (min-height:612px) {
    .portrait { position:sticky; top:16px; align-self:start; }
}

/* showcase.html */
@media (min-width:761px) and (min-height:732px) {
    .viewport { position:sticky; top:16px; align-self:start; }
}
```

Keep all current heights, minimum heights, widths, grid gaps and mobile rules. Both preview and sidebar remain in normal document layout, with one page scrollbar; the preview becomes sticky after its existing header scrolls out. All existing absolute overlays remain children of the positioned preview. `align-self:start` makes the intended grid-item behavior explicit.

The height guards are deliberate: the largest existing desktop minimums are 580px and 700px, plus 16px top/bottom space. Below those guards retain current ordinary scrolling, because pinning a taller-than-window canvas would itself hide part of the avatar or angle controls. This is a narrow desktop usability improvement, not a short-window redesign. If short-window support is required now, it needs a separate explicit decision to reduce canvas height and requalify framing; do not silently change the accepted desktop composition.

## Geometry and interaction constraints

- Pure scrolling must change only the canvas screen-space `getBoundingClientRect().top`; preserve CSS client dimensions, drawing-buffer dimensions, actual camera aspect/effective FOV/zoom, camera world position/quaternion, OrbitControls target and relative dolly distance. No new JS scroll handler or forced camera reset is needed.
- Stage's ResizeObserver reads `canvas.clientWidth/clientHeight`; ViewerFraming keys width/height plus actual renderer aspect. Sticky positioning should not trigger a size change. Real viewport resizing must still use those existing paths. The renderer's rounded TAAU aspect can differ slightly from CSS aspect; compare against a settled pre-scroll baseline, not an invented exact equality.
- Three OrbitControls uses current client height for drag rotation and current DOM rectangles for pointer coordinates. Test real input after pinning. Wheel over the canvas must retain zoom behavior (including its `preventDefault`); wheel over the sidebar must scroll the document, without changing the camera or triggering OrbitControls `start`.
- AttentionAction samples the camera world position. Pure document scrolling must retain an existing attention hold and the sampled target; a real orbit/zoom interaction still cancels it via the existing `start` listener. No attention cancellation on scroll is justified.
- The PNG exporter captures the canvas buffer, not its screen position. At a fixed clock and camera, moving the sticky preview must not change the export dimensions/configuration or crop. Keep the existing image-export hold/controls behavior.
- Preserve ordinary mobile stacking below each existing breakpoint, keyboard focus order, room navigation and settings error/disclosure expansion. No fixed sidebar, nested scroll area, hidden overflow or sticky header is needed.

## Focused real-browser gate, after approval

Use a watcher-disabled probe server and one serial native GPU browser. Bind both HTML/JS files, viewer-framing/helper and gate hashes; retain baseline and candidate measurements/plates separately. Capture viewport-sized screenshots at actual scroll positions; full-page screenshots alone cannot prove stickiness.

1. **Baseline, desktop:** Portrait 1440×1000; Wardrobe 1440×1000 and 1024×800 (the 700px minimum-height branch). Record preview/canvas/Room/Reset/export rectangles at scroll0, after real wheel scrolling over the sidebar, and after keyboard focus reaches a lower control. Prove the baseline preview loses visible area. Include both Studio and Kitchen heights without duplicating every outfit combination.
2. **Candidate, desktop:** repeat exact scroll/focus targets. After the header clears, require preview top≈16px and its bottom≤viewport height−16px, except when the natural containing-block boundary is reached. Require lower controls to be usable while the complete preview remains visible. Scroll to the study/footer boundary and back; no overlap with sidebar/footer, jump or accumulated offset. Record actual camera/canvas/attention invariants before/after at the same frozen clock.
3. **Functional while pinned:** invoke Portrait expression and Light/Room controls, then reset view; in Wardrobe use Room, full-look/portrait, and actual JSON/PNG downloads plus native settings chooser/error. Room switches may start fresh view state as already documented. Confirm a page scroll does not cancel active attention; a real drag/dolly still cancels it and controls remain responsive at the new canvas screen position. Compare fixed-clock PNG dimensions and crop before/after ordinary page scrolling.
4. **Responsive boundary:** desktop→390×844→desktop round trip on both pages, plus short desktop 1440×600 (Portrait) and 1440×700 (Wardrobe). Mobile and short-window previews must be ordinary scrolling elements, not pinned/clipped panes. Preserve mobile dimensions and current head-region framing after settle; no horizontal overflow. Re-entering desktop must restore sticky behavior without changing the intended camera pose/target.
5. No page/console/network errors, stable source/asset hashes, clean browser/server disposal. One production build after the two CSS edits is sufficient. This gate qualifies scrolling usability only; existing hair, fit, image-quality and all-motion limits remain unchanged.

Suggested source ownership: root or one worker edits only `portrait.html` and `showcase.html`; use a new focused review-scroll gate/evidence folder. No Avatar, renderer, framing, attention, asset or hair source changes are expected.
