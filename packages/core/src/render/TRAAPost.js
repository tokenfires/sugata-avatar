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
 * MEASURE the difference rather than argue about it — see `post.html?velocity=0`. The real repair
 * is a previous-weights path in the morph node, which lives outside this file; the diff request
 * is recorded in the round report.
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
 * RCAS sharpness, in `SharpenNode`'s own scale where **0 is maximum sharpening and 2 is none**.
 *
 * A temporal resolve is a low-pass filter, and this project has a gate that measures exactly the
 * band it removes: G4 asks the flat-skin 5x5 high-pass sigma to land in 1.5-2.1/255. Measured on
 * `post.html?bare` at 900x1200, `regions.lighting-portrait.json`, sigma per 255 at the reference
 * width:
 *
 *   | mode                    | G4 sigma | silhouette maxStep |
 *   |-------------------------|----------|--------------------|
 *   | no AA                   |  1.6357  |             0.9868 |
 *   | 4x MSAA (what ships)    |  1.6366  |             0.7933 |
 *   | TRAA                    |  1.1914  |             0.7284 |
 *   | TAAU 0.66               |  0.6341  |             0.5703 |
 *
 * FSR2 pairs its temporal upscale with RCAS for precisely this reason, so the pairing is the
 * reference design rather than a patch. The default is tuned by measurement, not by eye — see the
 * sweep in the round report.
 */
export const DEFAULT_SHARPNESS = 0.4;

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
 * @param {?number} [options.sharpness] - RCAS strength, 0 = maximum and 2 = none. `null` skips
 *   the sharpen pass entirely; omit it to get `DEFAULT_SHARPNESS`.
 * @returns {{ node: Node, mode: string, dispose: function(): void, setVelocityConfidence: function(number): void }}
 */
export function createTemporalResolve( { mode, gbuffer, camera, sharpness } ) {

    if ( mode !== 'traa' && mode !== 'taau' ) {

        throw new Error( `TRAAPost: mode must be 'traa' or 'taau', not '${ mode }'.` );

    }

    const beauty = gbuffer.node( 'output' );
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

    const node = sharpenNode ?? resolved;

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

        dispose() {

            resolved.dispose();
            sharpenNode?.dispose?.();

        }

    };

}
