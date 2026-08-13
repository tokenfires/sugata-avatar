/**
 * TRAAPost — temporal antialiasing, and the one honest note about why it is not free here.
 *
 * Punch-list 3.12. Two nodes, one decision:
 *
 *   - `traa`  — `TRAANode`, full input resolution. Jitters the camera on a 32-entry Halton
 *               sequence, reprojects last frame's resolve through the motion vectors, and
 *               variance-clips the history against the current 3x3 neighbourhood.
 *   - `taau`  — `TAAUNode`, the same idea with the scene pass rendered SMALLER than the drawing
 *               buffer and reconstructed by a 9-tap Blackman-Harris filter. This is the lever
 *               that pays for the skin shader: `docs/PROGRESS.md` measures the full
 *               five-attachment G-buffer at **0.721 ms** at 1080p and **0.393 ms** at
 *               `resolutionScale` 0.66 — 44% off the shaded pixels, and everything the scene
 *               pass draws scales with it.
 *
 * ## MSAA and TRAA are mutually exclusive, and that is not a style preference
 *
 * Both `TRAANode` and `TAAUNode` say so in their own headers ("MSAA must be disabled when TRAA is
 * in use"). The mechanism is the jitter: MSAA resolves coverage inside a pixel whose centre has
 * already been moved by up to half a pixel, so the two filters fight and the result is a soft
 * image that still crawls. `Stage` refuses the combination rather than letting a caller discover
 * it by eye.
 *
 * ## ⚠️ Morph targets hand this node a motion vector that is wrong, not merely absent
 *
 * Source-verified at r185 and re-verified here: `nodes/accessors/Skinning.js` assigns
 * `positionPrevious` (:166, :233) so bone motion reprojects correctly, and
 * `nodes/accessors/Morph.js` never does — it only ever `addAssign`s into `positionLocal` (:242).
 * `VelocityNode.setup()` then differences a MORPHED current position against an UN-MORPHED
 * previous one, so a morph held at a **constant** weight reports a **constant non-zero** motion
 * vector. Measured by the G-buffer round: **35.5 px/frame at 1280x720**, byte-identical whether
 * the weight is held or swept.
 *
 * This rig has no jaw bone and no eye bones, so the face is 100% morph-driven. What that costs
 * is bounded rather than catastrophic, and the bound is worth knowing:
 *
 *   - `TRAANode` clips the reprojected history into the current 3x3 neighbourhood's variance box
 *     before it blends (`varianceClipping` / `clipAABB`). A history sample fetched from the wrong
 *     place is therefore pulled back to something the neighbourhood already contains, so the
 *     failure mode is **lost temporal detail on the face**, not a smeared ghost of it.
 *   - `maxVelocityLength` (default 128 px) and the `motionFactor` term already push the blend
 *     towards the current frame as the reported velocity grows, which is exactly the direction a
 *     bogus large velocity wants.
 *
 * `velocityConfidence` below exists so that a caller can turn the reprojection off entirely and
 * MEASURE the difference rather than argue about it — see `post.html?velocity=0`.
 *
 * ✅ The real repair LANDED. `render/MorphVelocity.js` gives morph targets a previous-frame
 * position, which three.js does not, and that is punch-list 3.12's blocker fixed at source rather
 * than worked around here. The request is `docs/OPEN-REQUESTS.md` REQ-009, resolved; the pointer
 * this paragraph used to carry was to a round report that does not exist in this repository.
 */

import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { taau } from 'three/addons/tsl/display/TAAUNode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';

/** The modes `Stage` accepts. `off` leaves the scene colour untouched. */
export const TEMPORAL_AA_MODES = [ 'off', 'traa', 'taau' ];

/**
 * The TAAU operating point from `docs/research/rendering-stack.md`, quoted rather than chosen:
 * 0.66 of the drawing buffer in each axis, i.e. 44% of the shaded pixels.
 */
export const TAAU_RESOLUTION_SCALE = 0.66;

/**
 * RCAS sharpness for the resolve, in `SharpenNode`'s scale where **0 is maximum and 2 is none**.
 *
 * 🎯 **It is `null` — the temporal resolve does not sharpen — and that is a change made on a
 * measurement, not on taste.** It used to be 0.4, and 0.4 put gate G4 outside the look spec's own
 * band. Measured 2026-08-08 on `alive.html?bare&freeze` at **3840x5120**, which is the width G4's
 * 1.5-2.1/255 band is stated at, converged to frame 60 with a zero simulation step:
 *
 *   | configuration                                  | G4 sigma /255 | verdict |
 *   |------------------------------------------------|---------------|---------|
 *   | 4x MSAA, forward (what ships today)            |    1.7457     | PASS    |
 *   | TRAA + grade, RCAS 0.4 HERE (the old default)  |    2.3867     | **FAIL** |
 *   | TRAA + grade, no sharpen anywhere              |    1.8893     | PASS    |
 *   | TRAA + grade, RCAS 0.2 in the GRADE            |    2.6611     | **FAIL** |
 *   | TAAU 0.66 + grade, RCAS 0.4 HERE               |    1.7799     | PASS    |
 *   | TAAU 0.66 + grade, RCAS 0.2 in the grade       |    1.9034     | PASS    |
 *
 * A temporal resolve is a low-pass filter and FSR2 pairs its upscale with RCAS to get the detail
 * back, so a sharpen is the reference design — but the amount matters and this rig did not need
 * one. At full input resolution TRAA removes 25% of the flat-skin high-pass band (2.1871 -> 1.6318
 * measured at 900 px with everything else fixed), and the grade's tone curve gives most of it back:
 * TRAA + grade with **no** sharpen lands at 1.8893, mid-band. Adding either RCAS on top overshoots.
 *
 * `TAAUNode` at 0.66 removes 61% (2.1871 -> 0.8428) and does want one — so `taau` callers should
 * pass a sharpness explicitly, and `TRAAPost.selftest.mjs` prints the table above rather than
 * letting the next reader rediscover it.
 *
 * ⚠️ And a claim that used to justify the placement DOES NOT REPRODUCE. `Grade.js` recorded that
 * RCAS 0.4 run here, in linear HDR, took the iris to luma 0.4159 / saturation 0.1268 against
 * 0.1237 / 0.2997 unsharpened — "a brown iris rendering grey". Re-measured on the same page and
 * the same rect, converged: **0.1164 / 0.4032 with it and 0.1169 / 0.4086 without**, a 1.3%
 * difference in saturation, not a 2.4x one. The sharpen IS in the graph — it moves G4 by 1.26x —
 * it simply does not do that to the iris. See `Grade.js`'s header, corrected.
 */
export const DEFAULT_SHARPNESS = null;

/**
 * How many frames the camera jitter takes to come back round, so a gate can say what phase a
 * capture of N frames must be in.
 *
 * ⚠️ It is **31, not 32**, and the off-by-one is the node's and not a typo here. Both files build
 * `_haltonOffsets` with `Array.from( { length: 32 }, ... )` (`TRAANode.js:751`, `TAAUNode.js:819`)
 * and then advance with `this._jitterIndex % ( _haltonOffsets.length - 1 )` (`:337`, `:370`) — so
 * the last entry of the table is never used and the sequence repeats every 31 frames. Verified by
 * execution as well as by reading: 60 captured steps from a reset epoch leave `_jitterIndex` at
 * **29**, and 60 % 31 = 29.
 *
 * Source-verified at three r185. If an upgrade changes the table, this number is wrong and the
 * jitter-phase check in `alive-capture-determinism.selftest.mjs` is what will say so.
 */
export const HALTON_JITTER_PERIOD = 31;

/**
 * Builds the temporal resolve for one `Stage`.
 *
 * The node has to be constructed once and kept, because it owns two render targets and a frame
 * of history; rebuilding it every time the output node is recompiled would reset the history
 * every frame and the image would never converge.
 *
 * @param {Object} options
 * @param {'traa'|'taau'} options.mode
 * @param {GBuffer} options.gbuffer - Supplies beauty, depth and velocity.
 * @param {Camera} options.camera - The same camera the scene pass renders with. The node writes
 *   a per-frame view offset onto it, so it must not be a copy.
 * @param {?Node} [options.beauty] - What the resolve treats as the scene colour. Defaults to the
 *   G-buffer's `output` attachment, which is the shipping path. Punch-list 3.6 passes the hair OIT
 *   resolve here instead, because the temporal filter has to see the composited groom: 3.12
 *   measured this resolve as the project's best card antialiaser, and hair is the most
 *   aliasing-prone geometry in the repository. **Whatever is passed must already be a texture
 *   node** — `taau()` and `traa()` wrap their input in `convertToTexture` (`TAAUNode.js:835`), which
 *   does not recognise a computed node and falls through to a full-resolution `rtt()`; see the
 *   block below on why that is worth 5.62 ms and why it also gives TAAU an input whose size
 *   disagrees with the depth and velocity it reads beside it.
 * @param {?number} [options.sharpness] - RCAS strength, 0 = maximum and 2 = none. `null` skips
 *   the sharpen pass entirely, which is now the default — see `DEFAULT_SHARPNESS` for the G4
 *   table that decided it. `taau` callers should pass a number; `traa` callers should not.
 * ## The resolve carries FRAME STATE, and a deterministic capture has to reset it
 *
 * Both nodes accumulate across frames, and both keep that accumulation in places a caller cannot
 * see: a `_jitterIndex` selecting this frame's Halton camera offset, and a history render target
 * holding the previous resolve. Neither is reset when a page hands its frame loop to a capture
 * tool, so both start the capture wherever the requestAnimationFrame frames that ran during the
 * page's async boot happened to leave them — a count of how many frames the machine fitted into
 * loading a GLB.
 *
 * `resetFrameEpoch()` below is the repair, and the size of the hole it closes is measured in
 * `alive.js`'s `takeOverFrameLoop`: with the node clock pinned and this left alone, three
 * back-to-back loads of the SHIPPED DEFAULT still produced three distinct plates.
 *
 * @returns {{ node: Node, mode: string, dispose: function(): void, setVelocityConfidence: function(number): void, resetFrameEpoch: function(): void, frameEpoch: function(): Object }}
 */
export function createTemporalResolve( { mode, gbuffer, camera, sharpness, beauty: beautyOverride = null } ) {

    if ( mode !== 'traa' && mode !== 'taau' ) {

        throw new Error( `TRAAPost: mode must be 'traa' or 'taau', not '${ mode }'.` );

    }

    const beauty = beautyOverride ?? gbuffer.node( 'output' );
    const depth = gbuffer.depthNode;
    const velocity = gbuffer.velocityNode;

    const resolved = mode === 'traa'
        ? traa( beauty, depth, velocity, camera )
        : taau( beauty, depth, velocity, camera );

    const strength = sharpness === undefined ? DEFAULT_SHARPNESS : sharpness;

    // `denoise` is left false: it attenuates the sharpening where the neighbourhood is noisy, and
    // on this figure the "noise" is the skin micro-normal, i.e. exactly the signal G4 measures and
    // exactly what the sharpen pass is here to bring back.
    const sharpenNode = strength === null ? null : sharpen( resolved, strength, false );

    // 🚩 THE RESOLVE IS HANDED OUT AS ITS TEXTURE, NOT AS THE NODE, AND THAT IS WORTH A FULL-
    // RESOLUTION RENDER PASS PER FRAME.
    //
    // `TAAUNode` and `TRAANode` are `TempNode`s, so `node.isTextureNode` is undefined on both.
    // Anything downstream that needs a texture-backed input — and `Grade.compose` does, because
    // `BloomNode` samples its source — calls `convertToTexture()`, which does not recognise them
    // and falls through to `rtt( node )`. That is a full-resolution HalfFloat render target and a
    // full-resolution pass whose entire job is to copy `TAAUNode.resolve`, which is ALREADY a
    // full-resolution HalfFloat texture. `RTTNode` defaults to `HalfFloatType` and so does
    // `_resolveRenderTarget` (`TAAUNode.js:171`), so the copy is bit-exact and therefore
    // bit-pointless.
    //
    // ATTRIBUTED BY TOGGLE, not by reading a per-pass timestamp — the per-pass numbers on this
    // machine put the pass at 1.4 ms and the toggle puts it at four times that, and the toggle is
    // the one that says what removing it is worth. `alive.html?bare&seed=1&capture`, 1920x1080
    // portrait, 250 samples after 150 warm-up frames, three rounds alternating between the two
    // arms on one tree in one session:
    //
    //   handing out the texture   10.371  10.292  11.218   ms p50
    //   handing out the node      15.880  16.519  15.991   ms p50
    //
    // **5.62 ms at the medians, with no overlap between the two sets.** And it is free: the
    // 3840x5120 plate is byte-identical across the change, 0 of 19,660,800 pixels differing, so
    // every objective gate reads the same number it read before. Both nodes expose
    // `getTextureNode()` (`TAAUNode.js:297`, `TRAANode.js:261`) and it returns the `passTexture`
    // wrapper around exactly that target — and a `PassTextureNode` carries its owner into the
    // builder's node properties (`PassNode.js:63`), so the resolve's `updateBefore` still runs.
    // Handing that out instead of the node is the whole fix.
    const node = ( sharpenNode ?? resolved ).getTextureNode();

    return {

        node,
        mode,
        sharpenNode,

        /**
         * How far the history is allowed to be dragged by the motion vectors, in pixels.
         *
         * Both nodes fade the history out as the reported velocity approaches this length, so
         * lowering it is the blunt instrument that says "trust the velocity buffer less". Setting
         * it to a small value turns the effect into a static-scene accumulator: correct where
         * nothing moves, and self-limiting where something does.
         *
         * @param {number} pixels
         */
        setVelocityConfidence( pixels ) {

            resolved.maxVelocityLength = pixels;

        },

        /**
         * Puts the resolve back at frame zero: jitter phase at the start of the Halton sequence,
         * and history holding nothing a previous frame put there.
         *
         * The history is discarded by shrinking its render target rather than by clearing it,
         * which looks like a trick and is the node's own mechanism. `updateBefore` compares the
         * history target's size against the beauty buffer's and, when they differ, reinitialises
         * the target and copies THIS FRAME'S BEAUTY into it — `TRAANode.js:387`, `TAAUNode.js:421`.
         * That is a better epoch than a cleared buffer: clearing to black makes the first captured
         * frames fade up out of the dark, which is a different determinism-preserving wrong answer.
         *
         * Both `_jitterIndex` and `_historyRenderTarget` are private. They are reached rather than
         * re-implemented because there is no public reset, and if an upgrade renames either, the
         * optional chaining leaves the capture correct-but-not-reproducible instead of throwing —
         * the same failure posture `takeOverFrameLoop` takes with `_animation`.
         */
        resetFrameEpoch() {

            resolved._jitterIndex = 0;
            resolved._historyRenderTarget?.setSize( 1, 1 );

        },

        /**
         * What the resolve's frame counters read right now, for a gate that wants to say what they
         * SHOULD read rather than only whether two runs agree.
         *
         * `jitterPeriod` is reported rather than assumed: `TRAANode` and `TAAUNode` both advance
         * with `index % ( _haltonOffsets.length - 1 )`, so the period is one SHORT of the table
         * and a gate that hardcoded 32 would be off by one for every capture longer than 31
         * frames.
         */
        frameEpoch() {

            return {
                jitterIndex: resolved._jitterIndex ?? null,
                jitterPeriod: HALTON_JITTER_PERIOD,

                // 1 exactly between `resetFrameEpoch()` and the next render, and the beauty
                // buffer's width thereafter. It is reported because the history leg of the reset
                // is the one a pixel check can barely see: a temporal resolve on a STATIC scene
                // converges to the same fixed point from any starting history, so the residue of
                // a wrong one falls under 8-bit quantisation within a few frames. Measured with
                // the history reset deleted, `?bare&freeze&capture&seed=1` at 900x1200:
                // byte-identical at 2 steps and at 24, and 2 distinct plates of 3 at 60. An
                // intermittent, sub-code-value defect needs an observation that is not a pixel.
                historyWidth: resolved._historyRenderTarget?.width ?? null
            };

        },

        dispose() {

            resolved.dispose();
            sharpenNode?.dispose?.();

        }

    };

}
