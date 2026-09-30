# Independent static appearance and rest-clearance critique

## Disposition

The frozen domain-band candidate shows a substantial static contour improvement over the frozen whole-face band. It also preserves removal of the grey foundation islands visible at the shipped casual neckline. Keep the candidate isolated and unchanged for ordinary motion and outfit qualification. Small repeated dark hem marks remain a close-view finish limitation; their cause is unproved. This is not a promotion recommendation.

I directly inspected all 30 original PNGs in [the completed visual packet](../../../../captures/foundation-domain-visual-2026-09-30-v1/report.json), SHA `72adba1d6e7179d1137cef80c46551c8c565c8783abaf1bdec18f05aabc2266d`: shipped, frozen whole-face band, and domain band in four foundation torso views, two foundation body views, and four casual portraits each. No generated, altered, or amplified images were used.

## Evidence controls

All 30 PNG and compressed/decoded state hashes verify. The packet has 30 clean owner retirements and no recorded errors; recorded warnings remain in the report. The 283 archived source files match their bindings, as do the 99 separately retained current asset/dependency files. The three actual foundation assets are copied and pinned in the packet.

For each of the ten matched view groups, all three arms have identical recorded hair physical buffers, head/clock/step state, camera, projection, lights, rig, and mesh snapshot excluding the intentionally replaced foundation bra. Every image has the recorded frame-99, zero-time, zero-delta sequence. These controls support the structural appearance comparison. They do not claim exact pixel reproducibility or complete renderer-state equivalence.

## What changed visibly

- In the [domain front torso](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso-0.png), the upper contour and lower edge form continuous curves. The large staircase and sawtooth cuts visible in the [whole-face front](../../../../captures/foundation-domain-visual-2026-09-30-v1/whole-face-band-foundation-torso-0.png) are substantially gone. The two obliques show the same improvement through the underarm transitions.
- The [domain rear torso](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso-180.png) removes the large stepped central and lower contour interruptions of the [whole-face rear](../../../../captures/foundation-domain-visual-2026-09-30-v1/whole-face-band-foundation-torso-180.png). A faint fine scallop remains on the upper edge, especially around image x110–220, y380–390.
- At [front body scale](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-body-0.png) and [rear body scale](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-body-180.png), the new band reads as a continuous garment boundary. The unchanged hip foundation still has its own stepped cut; this packet does not qualify or repair it.
- The [shipped casual front](../../../../captures/foundation-domain-visual-2026-09-30-v1/shipped-casual-portrait-0.png) has grey islands beside the neck, approximately x116–155/y802–850 and x493–515/y814–845. They are absent in the [candidate front](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-casual-portrait-0.png). The same disappearance is visible in both obliques, including the near-neck island in the [shipped −45° view](../../../../captures/foundation-domain-visual-2026-09-30-v1/shipped-casual-portrait--45.png), x271–335/y821–863, compared with the [candidate](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-casual-portrait--45.png). I see no newly attributable neckline hole in these sampled static views.

## Remaining hem marks: witness and two alternatives

Repeated small dark notches or pucker-like marks remain along the lower hem in the [front torso](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso-0.png), approximately x90–290 and x390–610, y718–731. They are also visible in the [−45° view](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso--45.png), x250–715/y713–741, and [+45° view](../../../../captures/foundation-domain-visual-2026-09-30-v1/band-foundation-torso-45.png), x60–220 and x385–505/y705–728. These are actual close-view finish irregularities. The broad contour improvement does not make them disappear.

Their appearance alone does not distinguish rolled-edge geometry, interpolated normals, shadow response, or a combination. The existing [builder](../../../../tools/figure-pipeline/build_figure.py) creates the rolled hem after offset, relaxation, and selection; the current packet does not isolate those contributions. The tiny minimum-area triangle is not an attribution for these marks.

1. **Recommended and selected next: freeze the exact candidate and qualify ordinary motion with foundation and casual outfits.** Foundation views expose the real band, while casual views examine the intended neckline outcome. This addresses the larger unqualified question—moving fit and coverage—and carries the fine static marks as an explicit finish limitation. It postpones close-up polish and does not imply that the marks are acceptable for final presentation.
2. **First perform one read-only geometry/shading attribution on this exact asset.** Locate actual hem triangles in one declared image region, relate them to rolled-edge geometry/normals, and, only if needed, use a separately declared render-only control to distinguish illumination from contour effects. This may identify a useful later finish task, but it adds diagnostic work before moving coverage is known. It gives no reason to adjust hem dimensions, offsets, or normals without a discriminating result.

No geometry tuning or reversal is justified by the current marks alone.

## Full accepted-body source-rest clearance

The completed [clearance report](../../../../captures/foundation-domain-clearance-2026-09-30-v1/report.json), SHA `8bca6b1cf782aeccf83d49724f0b1530dd9b06dcb38e73e88f90b4d4e974a6f6`, covers every candidate triangle exactly once: IDs 0–15,400. Independently reducing the stored rows gives zero crossing triangles, winding-contained centroids, parity-contained or ambiguous centroids, and negative vertex samples. Its 12 predicate controls pass. All 12 archived source/asset bindings verify. The accepted body is the full closed, consistently oriented surface; the casual mask does not exclude body triangles from this audit.

I independently parsed both GLBs and solved the closest segment parameters for the minimum witness:

- Band triangle 15006, indices `[6339, 7440, 7362]`, edge 1.
- Body triangle 20664, indices `[11565, 11566, 11579]`, edge 2.
- Parameters `s = 0.5481909728987011`, `t = 0.43916809117232425`.
- Closest band point `[0.12112744721413077, 1.1523346535219716, -0.01799048841227821] m`.
- Closest body point `[0.12088643329366433, 1.152426119542302, -0.017831440985073894] m`.
- Distance **0.3029023387727363 mm**, matching the report to `5.421010862427522e-20 m`; closest points agree exactly.

This accepted-body minimum is distinct from the author's approximately 0.800040 mm refined-skin standoff. Different compared surfaces explain why the numbers must be retained separately. The rest audit does not identify the visible hem marks as contact, certify self-intersection freedom, or establish moving clearance.

## Next qualification boundary

Casual rendering retains zero candidate band triangles in this held state. A casual-only sequence could confirm the visible neckline benefit while hiding every band defect; it cannot substitute for foundation views and independent posed coverage/contact checks. The finite native/export skin comparison in [COMPARISON-CRITIQUE.md](COMPARISON-CRITIQUE.md) likewise measures deformation agreement, not garment/body separation in those poses.

The exact candidate therefore warrants the bounded ordinary-motion/outfit observation chosen above. Keep the original assets as defaults, preserve the exact-normal and exact-image limits, record actual posed surfaces and sampled coverage, and stop on a concrete failure. Any later passing sequence remains limited to its declared frames, motions, body, and outfits.
