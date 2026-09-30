# Independent ordinary-motion capture critique

## Disposition

**The all-three-outfit appearance objective fails.** The exact candidate preserves the smoother exposed band and removes the casual neckline islands in the inspected frames, but introduces two conspicuous grey patches over the elegant blouse. Keep this candidate isolated and unchanged. The subsequently completed four-pose body audit also fails at all four times; its separate [clearance critique](CLEARANCE-CRITIQUE.md) preserves the concrete geometric witness and image limits.

Reviewed completed [capture report](../../../../captures/foundation-domain-motion-2026-09-30-v1/report.json), SHA256 `24071200867f77630521e51202fe3c9de6069173cee905d0a5ecda713176953b`, PID 7526, finished `2026-09-30T22:52:23.362Z`. Candidate SHA remains `3793206f8f7a95a632705b02756bff9c35c5a934f266dc6bd790d076278671cd`. No browser/native job or duplicate clearance audit was launched by the critic.

## Independently verified receipts

- All 372 PNG hashes verify: 366 sequence images and six separately labelled rear stills. The 24 geometry snapshots and six rear before/after receipts match both compressed and decoded hashes.
- All 281 archived source files and 99 separately retained current asset/dependency files match the capture bindings. Received GLB hashes match the appropriate actual arm or fixed source asset.
- Six owners completed with empty recorded errors and `{disposed:true, leaked:[]}`. Warnings remain recorded; this is not an assertion that there were no warnings.
- For every outfit, all 61 recorded image-step states match exactly between shipped and candidate, including the reported hair/pose state and renderer clock. The four non-foundation full mesh snapshots also match exactly, including rig and time. Setup camera, lights, projection, seed and layer state match.
- The rear correction succeeds in actual receipts: before/after full snapshots and body morphs are exact, physical state is exact after excluding only camera fields, and each pre-rear full snapshot equals the corresponding saved step-720 snapshot. These are true alternate views of the terminal recorded physical pose; exact temporal image return is not claimed.
- At each of the four times, candidate body and band positions, full indices, rig and time match exactly across foundation/casual/elegant. This supports sharing the declared full-body audit across those exact candidate surfaces. Drawn topology correctly differs by outfit.

| Outfit | Shipped drawn foundation triangles | Candidate drawn foundation triangles |
| --- | ---: | ---: |
| Foundation | 22,090 | 15,401 |
| Casual | 327 | 0 |
| Elegant | 284 | 1,024 |

These counts are constant at all four snapshots. The candidate's largest world-space band-vertex displacement from step 0 is approximately 6.775 / 7.025 / 7.497 mm at steps 240 / 480 / 720. The sequence therefore contains measured ordinary movement, while remaining a mild, fixed-seed observation rather than a gesture envelope.

## Actual images inspected

I directly inspected both arms at steps **0, 240, 480, 720**, in all three outfits, plus all six rear stills: **30 originals**. This is ordered keyframe inspection, not a continuous-playback judgment or inspection of all 366 sequence frames.

### Exposed foundation

The [candidate step 0](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/frame-0000.png), [240](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/frame-0240.png), [480](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/frame-0480.png), and [720](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/frame-0720.png) retain the continuous upper contour and smooth broad lower boundary. The matched shipped images retain their large stepped/sawtooth edges. I see no newly attributable exposed opening or abrupt edge break in these four candidate images or the [terminal rear](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-foundation/rear-720.png).

Fine dark hem marks persist, for example around x150–465/y796–820 in candidate step 480. They remain the previously recorded close-view finish limitation; no new cause is established by their persistence. Two useful alternatives remain: **A**, defer polish while resolving the materially larger outfit failure; **B**, separately attribute the frozen hem's geometry/normal/shadow ownership before any finish change. A avoids distracting from the visible regression; B would answer a polish question but supplies no missing outfit qualification. No hem tuning is recommended here.

### Casual

The [shipped step 0](../../../../captures/foundation-domain-motion-2026-09-30-v1/shipped-casual/frame-0000.png) grey tab at approximately x181–199/y320–351 is absent in [candidate step 0](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-casual/frame-0000.png). The same difference persists at 240, 480 and 720. The inspected candidate neckline remains visually continuous. The terminal rear introduces no obvious new exposed foundation island.

Because the candidate has **zero drawn band triangles** in casual at the saved times, these images demonstrate the neckline outcome, not visible band deformation or complete hidden fit.

### Elegant: actionable failure

The [candidate step 0](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/frame-0000.png) has two large grey patches, approximately **x110–183/y583–663** and **x282–341/y582–655**, over the chest. The [matched shipped image](../../../../captures/foundation-domain-motion-2026-09-30-v1/shipped-elegant/frame-0000.png) has uninterrupted blouse stripes in those regions. Both patches remain visible at [240](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/frame-0240.png), [480](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/frame-0480.png), and [720](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/frame-0720.png). This is a clear introduced outfit appearance regression, already present at the initial held pose.

The 1,024 candidate drawn foundation triangles versus 284 shipped, and exact paired blouse geometry, make foundation/mask/garment ordering a useful next attribution question. The images and counts alone do not prove which individual triangles own every patch pixel, prove triangle crossing, or justify deleting a mask region.

1. **Recommended and selected A: preserve this failed combination and perform one exact-frame surface attribution.** Bind the actual step-0 owner, identify primary pixel/triangle hits and drawn/full topology, and inspect implicated band/blouse geometry and mask provenance. A rendering-only colour tag can complement those receipts. This identifies a repairable mechanism without changing geometry or masks, but adds diagnostic work and may reveal a broader garment-coupling constraint.
2. **B: retain the band as an experimental foundation/casual-only lead and keep shipped foundation for elegant.** This avoids modifying the failed combination and preserves the demonstrated local gain. It requires an explicit outfit-selection contract and further qualification, and cannot satisfy a shared replacement-foundation objective. It is not a promotion shortcut.

In the rear still, the [shipped elegant](../../../../captures/foundation-domain-motion-2026-09-30-v1/shipped-elegant/rear-720.png) grey collar-side patch is absent in the [candidate](../../../../captures/foundation-domain-motion-2026-09-30-v1/band-elegant/rear-720.png), which leaves a thin skin-coloured strip beneath the left part of the collar. This separate observation does not offset the large front failure or establish the ownership of that strip.

## Remaining numerical and visual boundaries

The four-pose full-body audit, initially unfinished when the images were reviewed, completed at `2026-09-30T23:12:43.162Z`. All four times fail the declared body-exterior gate: **436 / 429 / 433 / 431** candidate triangles cross the full body at steps **0 / 240 / 480 / 720**. See the [final report](../../../../captures/foundation-domain-motion-clearance-2026-09-30-v1/report.json) and [independent clearance critique](CLEARANCE-CRITIQUE.md). Runtime step 0 is the relaxed-standing captured pose; it is not the earlier source-rest mesh. The passing source-rest result and finite native/export skin arithmetic cannot qualify this runtime fit. These body contacts also do not, by themselves, establish the cause of the elegant blouse patches.

Moving chest-ray coverage has not been measured. The camera intentionally crops the upper face and excludes the lower body; hair and full-body appearance remain outside this review. No continuous collision, intermediate-time clearance, all-view, other-body, or asset-promotion conclusion follows. The next selected step is attribution of the elegant failure, with the exact candidate and all accepted defaults preserved.
