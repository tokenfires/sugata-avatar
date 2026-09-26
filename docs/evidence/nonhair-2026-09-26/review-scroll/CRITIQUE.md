# Independent review: desktop preview during scrolling

Reviewer: `/root/critic`, 2026-09-26. Source, retained-image and independent CPU verification only; no browser/GPU execution by this reviewer.

**Verdict: integrate the two CSS rules.** They keep the complete desktop preview beside lower controls while preserving the existing ordinary scrolling behavior on mobile and short windows. No JavaScript, camera, renderer, asset or hair change is needed.

## Defect and measured result

The live baseline confirms the visible usability issue. At the tested lower-control scroll positions, Portrait retains only 472 of 850 preview pixels; Wardrobe retains 450 of 868 at 1440×1000 and 282 of 700 at 1024×800. At the latter's document end the entire preview has left the viewport. The viewport PNGs make this loss clear: the controls remain present while the face is cropped or absent.

The candidate adds only guarded `position:sticky; top:16px; align-self:start` rules. I inspected the exact two-file diff. I independently recomputed all nine candidate sidebar-wheel, keyboard-focus and document-end rectangles from `candidate-v1/report.json`: preview top is 16 and its full height is visible (850, 868 or 700 respectively). I verified all 19 candidate PNG hashes and 313 current source/asset hashes; the only changed capture-source hash was the subsequently strengthened probe. All 17 baseline-v1 PNG hashes were also verified. Non-HTML product sources match between baseline and candidate.

The bound native gate checks unchanged camera, target, aspect, zoom, canvas/buffer dimensions, fixed clock, configuration and active attention through pure document scrolling. Real drag and canvas-wheel dolly remain functional and cancel attention through the existing interaction route. Portrait reset and one forward Kitchen switch work; a real Wardrobe PNG download keeps dimensions and projection. I inspected both initial instrument PNG and later native export: the composition is retained. Pixel equality is not claimed.

## Visual evidence correction

The first 1024×800 end-scroll screenshot did **not** match its recorded DOM state. Independent pixel inspection found the footer border at y695 instead of the recorded y751.859, and the canvas ending around y659 instead of y716. I withheld visual acceptance despite the passing rectangles. The original report/image remain evidence of this mismatch; they must not be relabeled as a complete settled preview.

The author ran a focused follow-up using the unchanged candidate CSS/build, bounded real wheel increments and at least one second of compositor settling. `settled-1024-v1/report.json` binds identical before/after screenshot state for sidebar, keyboard focus and document end. I verified its 314 source hashes, 103 production build-output hashes and three image hashes, and independently recomputed its end image's pixel witness: footer border y752 agrees with DOM y751.859; body pixels outside and canvas pixels inside y16/y716 agree with the measured preview edges. The new end image visibly contains the complete preview and controls with no footer overlap.

The resolved discrepancy is consistent with a capture/scroll transient after an oversized wheel event. The precise compositor mechanism was not proved. It did not require another CSS change. This focused follow-up closes the evidence gap without inventing pixel/DOM agreement for the earlier plate.

## Scope and limits

I inspected desktop before/after control and footer views, Kitchen after switching, representative mobile/short-window fallback images, and the paired PNG exports. At the tested sizes the result is a clear usability improvement. Mobile and short-window screenshots intentionally show ordinary document cropping during scrolling; the guarded CSS preserves that existing fallback.

The executed functional scope is narrower than the initial PLAN: it does not repeat the complete expression/Light, outfit-frame, JSON and chooser-error matrices. Those prior qualifications are not newly claimed here. The new head coordinates are the existing cached neutral framing proxy used for invariance, not an independent posed-hair quality test. Existing hair, neckline and image-quality limits remain unchanged.

If short-window preview persistence is wanted later, two concrete alternatives are reducing the preview's minimum height (improves simultaneous visibility but changes composition and needs framing qualification), or leaving the current full-size preview with normal page scrolling (preserves composition but cannot keep it alongside every control). Neither is required for this bounded desktop improvement.

Signed: independent critic agent `/root/critic`.
