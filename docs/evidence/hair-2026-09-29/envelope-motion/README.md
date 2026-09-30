# Posterior bob during ordinary movement

**The sampled moving images retain the rear-flow improvement. Full selected-body contact audits are still running.** The candidate stays isolated; no accepted hair asset has changed.

| Accepted source at 12 seconds | Frozen posterior v3 at 12 seconds |
| --- | --- |
| ![Accepted bob in the final ordinary pose](../../../../captures/envelope-motion-v1/baseline-rear-left-brown/frames/0720.png) | ![Coherent candidate in the matching final pose](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/frames/0720.png) |

The [paired preview and exact-frame viewer](../../../../captures/envelope-motion-v1/review.html) presents both arms together. Its video is a compressed convenience copy; the slider loads the original PNGs. Browser playback and frame controls were exercised at desktop and mobile sizes. That functional check is not a claim of continuous perceptual review.

## Fixed comparison

Each arm runs the normal 17-layer stack for 12 seconds with seed `20260807`, the same casual outfit, opposite-rear camera, medium-brown diagnostic material and neutral light chromaticity. The renderer's ambient loop is stopped; its node and temporal clocks are owned by the capture. There are 720 advancing updates, 721 full selected-hair/posed-body readbacks at 60 Hz and 241 original PNGs at 20 fps per arm.

The complete [paired raw-data comparison](../../../../captures/envelope-motion-v1/paired-controls-full.json) verifies matching seed, layers, configuration, camera, material, lighting and parameters. All 721 body positions, body normals, rig/head transforms, clock and step records match. Original image and raw geometry hashes are checked.

The shared skull collision radius grows by 1.024609650444 mm with the candidate; capsule parameters remain exact. Nonselected vertex hashes differ at all updates, but this first ordinary capture retains only those hashes. Their displacement magnitude is unquantified. The new asset's indirect effects must not be described as absent or assumed microscopic from the static comparison.

Frozen candidate SHA256: `d477f9079577f1205b706941a789b608a3dbb6974a022a6888251737abb26146`.

## Image evidence and limits

The [independent critic](CRITIQUE.md) inspected matched original frames 0, 30, 60, 120, 180, 240, 360, 480, 600 and 720, then neighboring frames for particular observations. The coherent rear field and cleaner nape remain in these poses. The blunt lower edge and existing crown/forward-side fragments remain unfinished. Both arms have a soft or speckled outer boundary in some moving frames; no candidate-specific geometry cause is established by those pixels.

Root additionally inspected candidate 351/354/357 around the largest measured head-relative vertex step. The affected card 40 root midpoint remains anchored while the edge frame rotates. No attributable new intact-image interruption was observed there. The critic independently measured the local frame rotation and checked the second-largest root witness. A large geometric step is not automatically a visible defect, and these 20 fps images do not show every 60 Hz update.

The [continuity diagnostic](../../../../captures/envelope-motion-v1/candidate-rear-left-brown/continuity.json) locates frames for inspection. It does not score hairstyle quality or define a stability/settling pass. Its root-midpoint measurement deliberately distinguishes an anchored width-frame rotation from root detachment.

## Contact qualification

The existing root-owned CPU audits evaluate all 8,512 selected hair triangles and 9,044 selected vertices against the fully morphed/skinned body at every captured update. Progress and ownership are recorded in each arm's `audit-progress.json`; do not duplicate them. The final results belong in `numerical-checks.json` when each run completes.

This is a selected-hair versus body audit. It excludes garments, hair-hair contact, other groom cards and times between updates. Alpha and rendered occlusion are not modeled, so pair counts cannot be read as visible clipping counts. A separate frozen head-turn/tilt sequence is underway to cover motions underrepresented by this single ordinary interval; it retains nonselected coordinates for a measured comparison.

## Recovery and reproduction

The captures record process IDs, timestamps, source snapshots, candidate routing and clean owner disposal. Capture driver: `tools/critic/bob-envelope-motion.mjs`; original helper snapshots are retained in each arm's `source/` directory. Numerical support: `audit-envelope-motion.mjs`, `audit-envelope-pair.mjs` and `audit-envelope-continuity.mjs`. The later head-protocol extension does not rewrite these earlier source snapshots.

The first review-page probe used an incorrect dev-root URL and failed its page-content assertion. Its report is preserved. The corrected probe used the existing Vite `/@fs/` URL and passed with all seven overview images loaded, no horizontal overflow at 1440/390 widths, working Home/End/previous/next controls, and an advancing video playhead. Recorded page-error and HTTP-error arrays are empty; separate console channels were not collected.

Read the [overnight checkpoint](../../../OVERNIGHT-2026-09-29.md) for current jobs. Preserve this candidate and the accepted baseline while qualification completes. No further geometry edit is supported by the currently inspected moving frames.

### Preview correction

The first convenience encoding used PNG concat durations, whose default 25 Hz timebase quantized the intended 50 ms intervals into 40/80 ms input intervals. That video is retained as a rejected preview. Explicit 20 Hz image-sequence inputs produce the current v2 preview: all 241 presentation timestamps equal frame index × 50 ms. The original PNGs and geometry were unaffected. See the [cadence record](../../../../captures/envelope-motion-v1/preview-v2-cadence.json).
