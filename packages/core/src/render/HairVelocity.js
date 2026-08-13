/**
 * HairVelocity — the groom's motion vector, and why it was 259.9 pixels of a lie every frame.
 *
 * Punch-list 3.22. This is `MorphVelocity.js`'s finding one subsystem over, and the two files are
 * deliberately siblings: three's contract is that **anything which overwrites `positionLocal` must
 * also assign `positionPrevious`**, and a path that forgets does not lose its velocity, it INVENTS
 * one. `Skinning.js` honours the contract (:162, :229, both guarded on `builder.needsPreviousData()`).
 * `Morph.js` does not — that is `MorphVelocity.js`. `motion/HairDynamics.js`'s `positionNode` does
 * not either, and that is this file.
 *
 * ## What the buffer contained, measured off the real artefact
 *
 * `VelocityNode.setup()` (r185, `nodes/accessors/VelocityNode.js:164`) differences
 * `projection · modelView · positionLocal` against `previousProjection · previousModelView ·
 * positionPrevious`. `positionPrevious` defaults to `positionGeometry` and is reassigned by
 * skinning; the DFTL solver then replaces `positionLocal` with its own card-vertex buffer through
 * `material.positionNode`, and nothing touches `positionPrevious` after it. So the groom's
 * reported motion vector is **the displacement between where the solver put the card and where the
 * skinned rest pose would have put it** — a POSE ERROR reported as a per-frame velocity, present in
 * full on a frame where nothing moved at all.
 *
 * Measured this session by reading the G-buffer's `velocity` attachment (RG16F) back on the CPU
 * and converting NDC to pixels of the 594x792 scene pass, `alive.html?bare&freeze&seed=1&grain=0&
 * hair=1&capture`, 96 steps, the figure yawed 35 degrees so the solver has actually displaced the
 * groom:
 *
 *     | stimulus                                   | non-zero px | p50    | p90     | max     |
 *     |--------------------------------------------|------------:|-------:|--------:|--------:|
 *     | 35 deg yaw, solver ON (shipped)            |     173,797 | 91.159 | 259.887 | 297.924 |
 *     | 35 deg yaw, `?hairmotion=0`                |      79,402 |  0.379 |   0.379 |   0.379 |
 *     | 0 deg, `?freeze`, solver ON                |     172,809 |  0.0003 |  0.379 |   0.379 |
 *
 * The 0.379 px/frame floor is the Halton camera jitter and is on every pixel of the figure in every
 * arm. Read the three rows together and the diagnosis is forced: with the solver at rest the groom
 * reports **nothing** (row 3 — the solver reproduces the skinned pose, so the pose error is zero),
 * and with the solver displaced it reports a p90 of **259.9 px/frame** on a groom whose geometry is
 * static to within the resolve's own noise floor. `TAAUNode.maxVelocityLength` is **128**.
 *
 * ## What that cost the picture, and it is the largest defect at three-quarter view
 *
 * Round 21 reported it as a framing defect — *"at 35 degrees of figure yaw the 4x crop is dominated
 * by a coarse stochastic-coverage dither the temporal resolve does not integrate away"*. It is not
 * a framing defect and it is not the dither. Same page, same 96 steps, mean |px − 3x3 mean| and the
 * per-pixel temporal sd over four CONSECUTIVE converged frames, 510,000 px of the hair band, 8-bit
 * code values:
 *
 *     | arm                                  | local grain | temporal sd |
 *     |--------------------------------------|------------:|------------:|
 *     | 0 deg (solver at rest)               |      1.5665 |      0.6604 |
 *     | 35 deg, shipped                      |      4.2935 |      5.8333 |
 *     | 35 deg, `?hairmotion=0`              |      1.7730 |      0.6595 |
 *     | 35 deg, `?hairoit=blend`             |      1.4281 |      0.8818 |
 *
 * `blend` is the row that closes it. It draws the same geometry through the same resolve with the
 * same false velocity and reads 0.8818 — so the groom is geometrically static and the 5.8333 is
 * entirely the stochastic coverage failing to integrate. The coverage estimator is not at fault
 * either: it is the same estimator that reads 0.6604 one row up.
 *
 * ## 🚩 The mechanism is NOT the one on file, and six knobs say so
 *
 * `HairOIT.js`'s header and round 16 both attribute this to `TAAUNode.js:678` —
 * `isDisocclusion = closestDepth − previousDepth > 0.0005` forcing the frame weight to 1 where a
 * stochastic alpha test writes depth from its own coin flip. That is a real mechanism and it is
 * **not this one**. Measured by rewriting the resolve's source in flight (a Playwright route over
 * vite's dep bundle, so nothing in the tree was touched) and re-running the 35 deg plate:
 *
 *     | knob                                            | grain  | temporal sd |
 *     |-------------------------------------------------|-------:|------------:|
 *     | shipped                                         | 4.2935 |      5.8333 |
 *     | `depthThreshold` 5e-4 -> 1e9 (disocclusion off) | 4.3074 |      5.8420 |
 *     | `maxVelocityLength` 128 -> 1e9 (motionFactor 0) | 4.8119 |      5.9752 |
 *     | `currentFrameWeight` 0.025 -> 0                 | 4.3348 |      5.8263 |
 *     | variance clip removed                           | 4.5595 |      5.8784 |
 *     | `hasValidHistory` forced true                   | 4.2912 |      5.8332 |
 *     | lock forced 0                                   | 4.2891 |      5.8335 |
 *     | **reprojection velocity forced to zero**        | **1.6175** |  **0.6669** |
 *
 * Every knob inside the resolve is worth less than 12% and the velocity is worth 8.7x. The harness
 * was red-proved on the same plate before any of those rows were believed — replacing the resolve's
 * `colorOutput.assign(output)` with a constant red turns the frame red (centre pixel 252,56,46) —
 * so a row that did not move is a knob that does not matter, not a patch that did not land.
 *
 * ## What this file does, and the one thing it deliberately does not do
 *
 * It restores the invariant, and no more: the groom's `positionPrevious` becomes the position the
 * solver just wrote, so the groom reports **zero** velocity of its own. That is exactly right on
 * the frame the solver is at rest, and it is an UNDER-estimate while the groom swings.
 *
 * Under-reporting is the right direction to be wrong in, and it is the direction three's own
 * default is wrong in for every unhandled path — but say what it costs rather than only what it
 * buys. A history that is not reprojected is fetched from the pixel the geometry occupied last
 * frame instead of the one it came from, and the resolve's variance clip pulls it back into the
 * current 3x3 neighbourhood, so the failure mode is lost temporal detail on a swinging lock, not a
 * ghost of one. What it replaces is a 259.9 px/frame reprojection that lands two thirds of a screen
 * away and takes the accumulator with it.
 *
 * ⚠️ **The exact repair is one buffer away and it is not in this file's ownership.** The solver
 * would have to keep last frame's card vertices — one more `instancedArray( particleCount, 'vec3' )`
 * and a copy at the top of the rebuild kernel — and expose them as a second node, at which point
 * `HAIR_VELOCITY_MODES` gains `exact` and this file assigns that instead. Filed as REQ-073 against
 * `packages/core/src/motion/HairDynamics.js`. `MorphVelocity.js` ships both arms for exactly this
 * reason and its `hold` arm is this arm; the difference is that the morph path could reach its own
 * previous state and this one cannot.
 */

import { NodeMaterial } from 'three/webgpu';

import { Fn, positionLocal, positionPrevious } from 'three/tsl';

/**
 * `hold` gives the groom the previous position it is standing at, so the solver contributes no
 * velocity. `off` is three's behaviour — the pose error, reported as motion — kept as the control
 * every number in this header is stated against.
 */
export const HAIR_VELOCITY_MODES = [ 'off', 'hold' ];

/** The arm a page gets when it does not ask, and the arm the measurements above recommend. */
export const HAIR_VELOCITY_DEFAULT_MODE = 'hold';

/**
 * The materials whose `positionLocal` a solver overwrites. A `WeakSet` rather than a flag on the
 * material because the wrap below runs for every material in the scene and must be able to say
 * "not this one" without reading a property that a future material could happen to define.
 */
const _solverDrivenMaterials = new WeakSet();

let originalSetupPosition = null;

/**
 * Registers one material as solver-driven and installs the wrap that repairs its motion vector.
 *
 * Call it beside the `material.positionNode = …` assignment it repairs — the two lines are one
 * decision, and separating them is how the contract got broken in the first place.
 *
 * @param {Object} material - the material carrying the solver's `positionNode`.
 * @param {'off'|'hold'} [mode] - `off` registers nothing and leaves three's behaviour in place.
 * @returns {{ mode: string, registered: boolean }}
 */
export function installHairVelocity( material, mode = HAIR_VELOCITY_DEFAULT_MODE ) {

    if ( HAIR_VELOCITY_MODES.includes( mode ) === false ) {

        throw new Error( `HairVelocity: mode must be one of ${ HAIR_VELOCITY_MODES.join( ', ' ) }, not '${ mode }'.` );

    }

    if ( mode === 'off' ) return { mode, registered: false };

    _solverDrivenMaterials.add( material );

    // 🚩 THE WRAP HAS TO RUN AFTER THE ORIGINAL, WHICH IS THE OPPOSITE OF `MorphVelocity.js`.
    //
    // That file assigns BEFORE `originalSetupPosition` because `skinning()` READS `positionPrevious`
    // and adds the bone transform onto it. This file assigns AFTER, because `positionLocal` does not
    // hold the solver's answer until `setupPosition` has run to its last statement
    // (`NodeMaterial.js:802`, `positionLocal.assign( subBuild( this.positionNode, 'POSITION' ) )`) —
    // and the whole repair is "previous is where the solver just put it". Assigning first would
    // copy the skinned rest pose, which is the number that is wrong.
    //
    // Both wraps compose: this one calls whatever `setupPosition` was there, which on this page is
    // MorphVelocity's, which calls three's.
    if ( originalSetupPosition === null ) {

        originalSetupPosition = NodeMaterial.prototype.setupPosition;

        NodeMaterial.prototype.setupPosition = function ( builder ) {

            const position = originalSetupPosition.call( this, builder );

            // `needsPreviousData()` is false in the shadow pass and in every forward frame this
            // project renders, where `positionPrevious` is never read — the same guard
            // `Skinning.js` puts on its own assignment, for the same reason.
            if ( _solverDrivenMaterials.has( this ) && builder.needsPreviousData() === true ) {

                previousIsWhereTheSolverPutIt();

            }

            return position;

        };

    }

    return { mode, registered: true };

}

/** Whether one material is registered, so a gate can assert the wiring rather than the picture. */
export function hasHairVelocity( material ) {

    return _solverDrivenMaterials.has( material );

}

/**
 * The vertex-stage assignment, written as a `Fn` for `MorphVelocity.js`'s reason: it lands on the
 * builder's current stack in the same way `skinning()` does, and the emitted statement order in the
 * vertex shader is the whole of the fix.
 */
const previousIsWhereTheSolverPutIt = /*@__PURE__*/ Fn( () => {

    positionPrevious.assign( positionLocal );

}, 'void' );
