/**
 * SpringBones — the VRM spring-bone algorithm, on a FIXED 60 Hz timestep, with depth curves.
 *
 * Punch-list 6.6. The algorithm is `pixiv/three-vrm`'s, read this round straight off
 * `packages/three-vrm-springbone/src/VRMSpringBoneJoint.ts@dev` rather than off a summary, and
 * `docs/research/ik-and-springbones.md` §3 is the survey that pointed at it. Three things here are
 * NOT in three-vrm and each one is an item of 6.6:
 *
 *   1. **A fixed 1/60 s timestep with an accumulator**, because `VRMSpringBoneManager.update`
 *      passes the raw frame delta straight to `VRMSpringBoneJoint.update` and the inertia term
 *      `(currentTail − prevTail)·(1 − dragForce)` has no `delta` in it at all — so the retained
 *      velocity decays per FRAME and the whole trajectory is a function of the frame rate.
 *      LEARNINGS §1.13 / §1.13a: this repository has shipped that defect four separate times, in
 *      four different mechanisms, and every rate, amplitude and spectral gate stayed green through
 *      all of them. `SpringBones.selftest.mjs` is the gate that does not.
 *   2. **Per-substep interpolation of every driving transform** — the chain's anchor, the `center`
 *      node, and every collider. A fixed step alone is NOT frame-rate invariance: if all substeps
 *      of a frame see the frame's end-of-frame anchor pose, 30 Hz and 120 Hz trace different root
 *      paths through the same motion. `HairDynamics.js`'s `substepHeadMatrices` records the same
 *      finding on the groom (4.20 mm mean / 31.10 mm worst at 60 vs 120 Hz), and §"the three red
 *      proofs" below measures it again here.
 *   3. **Depth-distribution curves**. The idea is Unity Dynamic Bone's — *"every scalar [gets] a
 *      matching `AnimationCurve` distribution evaluated along normalized chain depth — root stiff,
 *      tips floppy, from one control"* (`affect-and-animation.md` §7), and VRM has no equivalent,
 *      which is why VRoid emits near-identical numbers on every joint. The reason implemented here
 *      is mechanism rather than authoring taste: VRM's `stiffness` is a LINEAR pull in metres per
 *      second, so the angular restoring rate a joint actually feels is `stiffness / restLength` and
 *      a longer segment is softer at the same authored number. See `stiffnessMode`.
 *
 * ## What `stiffness` means, and why it is not scale-invariant
 *
 * `affect-and-animation.md` §7 says *"The stiffness term is a constant-magnitude pull, not
 * Hookean … There is no `k·x`."* That is true of the LINEAR term and false of the SYSTEM, because
 * of the length projection that follows it. A tail at angle `θ` off the rest axis sits at
 * `L·(sin θ, cos θ)`; adding `S·Δt·û` and renormalising to `L` gives
 *
 *     θ' = atan2( L sin θ, L cos θ + S·Δt )
 *
 * which differentiated at `ε = S·Δt/L → 0` is `dθ'/dε = −sin θ`, so
 *
 *     dθ/dt = −( S / L )·sin θ
 *
 * a pendulum restoring law, linear in `θ` for small `θ`, with angular rate `S/L` per second and
 * time constant `L/S`. The selftest measures the linearisation against the implementation and
 * against the closed form, so this paragraph is a gated claim rather than a comment.
 *
 * Three consequences, all of them practical:
 *
 *   - the same authored `stiffness` on a 70 mm joint and a 400 mm joint is two different materials;
 *   - a chain of unequal segments is therefore not a uniform material under VRM's parameterisation,
 *     which is a mechanism-level argument for depth curves independent of any authoring-UX one;
 *   - `stiffnessMode: 'angular'` states the wanted `rad/s` directly and multiplies by each joint's
 *     own rest length, which removes the spread. Measured both ways in the selftest.
 *
 * ## What the fixed step buys, and what it does not
 *
 * It buys rate invariance, and it buys **nothing in stability**. The length projection renormalises
 * the tail onto the sphere of radius `L` every step, and adding `k·û` to a vector and renormalising
 * approaches `û` asymptotically without ever crossing it, so the update is unconditionally bounded
 * at any stiffness and any timestep. Calling this a stability problem sends the fix in the wrong
 * direction — nothing here needs substepping to avoid blowing up.
 *
 * ⚠️ The selftest re-runs `ik-and-springbones.md` §3.5's five-decade sweep here rather than quoting
 * it, and the reading comes back NARROWER than the survey's. The survey reports `max |θ|` as
 * *exactly* the release angle in every row; with the inertia term in play it is strictly BELOW it —
 * 0.81× at `stiffness 1` — because the first step is a relaxation and the retained displacement then
 * carries the tail toward the axis rather than away from it. The boundedness claim survives; the
 * equality does not.
 *
 * The one genuine singularity is a joint folded exactly onto `−û`, where `sin θ = 0` and the
 * restoring term has no direction. See `antipodalEscapeRadians`; the survey's "sits at 180° forever"
 * is corrected there, with the measurement.
 *
 * ## `center`, stated precisely because it is easy to over-implement
 *
 * `center` applies to the INERTIA TERM ONLY. `_currentTail` and `_prevTail` are stored in center
 * space, so `(currentTail − prevTail)` is a displacement measured in that frame; the tail is then
 * taken to world space and stiffness and gravity are added there. The VRM 1.0 spec says so in as
 * many words — *"External forces (gravity) are calculated in World Space regardless of the
 * `center`."* Implementing `center` as a wholesale change of working space is wrong and gives a
 * ponytail that falls sideways when the character walks.
 *
 * ## The three red proofs, and what each one proves is load-bearing
 *
 *   `perFrameStep: true`        — one `stepJoint()` per frame with the raw delta. This is three-vrm,
 *                                 exactly. Measured 8.41° of divergence across 30/60/120 Hz.
 *   `perFrameAnchor: true`      — the fixed step is KEPT and every substep of a frame is handed the
 *                                 end-of-frame anchor pose instead of its own interpolated one.
 *                                 Measured 1.92°, which is what proves item 2 above is
 *                                 load-bearing rather than decorative — a fixed step is not enough.
 *   `stepEpsilonSeconds: 0`     — the accumulator comparison left exact. Measured 6.42° at 144 Hz
 *                                 against 60 Hz, out of a difference of 3.469e-18 s.
 *
 * @claim 8.41 :: node packages/core/src/physics/SpringBones.selftest.mjs :: perFrameStep, worst divergence #1
 * @claim 1.92 :: node packages/core/src/physics/SpringBones.selftest.mjs :: perFrameAnchor, worst divergence #1
 * @claim 6.42 :: node packages/core/src/physics/SpringBones.selftest.mjs :: NEITHER defence #3
 *
 * All three are settings on the system rather than edits to it, for the reason `Sway` exposes
 * `frameCoupledArrivals` and `HairDynamics` exposes `?hairstep=perframe`: a gate that has never
 * been shown to fail is not known to work. The invariance clause rejects all three, and beside them
 * the selftest computes an AMPLITUDE statistic and a RATE statistic on the same defective build and
 * records both as unmoved — 13.5% and 6.2% against a 15% sensitivity — so that neither can ever be
 * read as covering this.
 *
 * ## Where 6.7 goes, and what is deliberately not here
 *
 * **Collider pruning is 6.7 and it is not in this file.** The seam for it is
 * `SpringBoneSystem.colliderSelector` — a function `( joint, colliders ) => colliders` called once
 * per joint per FRAME (not per substep), whose default is the identity. A pruner that culls by
 * bounding sphere, by chain, or by a VRChat-style wiring budget replaces that function and nothing
 * else. Two counters exist for it to be measured against, and they are deliberately different
 * numbers: `wiredColliderChecks` is the STATIC sum over joints of the colliders each is wired to —
 * which is what VRChat's "PhysBones Collision Check Count" actually counts, *"The sum of how many
 * PhysBone transforms each collider can affect"* — and `colliderTestsLastFrame` is how many
 * narrow-phase tests were executed. `ik-and-springbones.md` §4.2 shows the punch-list conflating
 * the two, so they are reported separately here.
 *
 * Also not here, named so the absence is not read as a claim: angular (cone) limits, which VRM has
 * no field for and which VRChat's own documentation calls *"far more performant than a collider"*;
 * plane colliders from `VRMC_springBone_extended_collider`; and any glTF loading. This module takes
 * `Object3D`s and settings, and knows nothing about files.
 *
 * ## Usage
 *
 *     const system = new SpringBoneSystem();
 *     system.add( new SpringBoneChain( {
 *         name: 'ponytail',
 *         bones: [ tail01, tail02, tail03, tail04 ],   // N bones -> N-1 simulated joints
 *         settings: { stiffness: 1.0, dragForce: 0.4 },
 *         curves: { stiffness: new DepthCurve( [ [ 0, 1 ], [ 1, 0.4 ] ] ) },
 *         colliders: [ sphereCollider( { node: head, offset: skullCentre, radius: 0.0761 } ) ],
 *         center: hips
 *     } ) );
 *
 *     stack.update( deltaSeconds );        // MotionStack commits the figure's bones …
 *     figureRoot.updateMatrixWorld( true );// … the scene graph is brought up to date …
 *     system.update( deltaSeconds );       // … and only then do the springs read their anchors.
 *
 * 🚩 THAT ORDER IS NOT OPTIONAL AND IT IS THE ONLY INTEGRATION RULE. A spring chain hangs off a
 * bone `MotionStack` owns, and the stack commits at the END of its `update()`. Running the springs
 * first hands them last frame's head pose, which is a one-frame lag on the input that drives the
 * entire simulation. This module writes only the bones it was given, and those bones must not be
 * declared as `MotionStack` channels by anything — the stack's ownership rule (`MotionStack.js:23`)
 * is absolute in the other direction too.
 */

import { Matrix4, Quaternion, Vector3 } from 'three';

/**
 * The fixed simulation step, and the most of them one frame may run.
 *
 * 1/60 s is punch-list 6.6's own number. The cap is DERIVED rather than picked: `MotionStack`
 * clamps a frame delta to `DEFAULT_MAX_DELTA_SECONDS = 0.1` (`MotionStack.js:79`), for the reason
 * stated there — a backgrounded tab hands back a multi-second delta on the frame it returns — and
 * `0.1 × 60 = 6` exactly. So six substeps is the largest a caller sharing the stack's clamp can
 * ever ask for, and the cap costs nothing on any frame the stack would have passed through.
 *
 * A frame that somehow arrives longer than that drops the surplus rather than spiralling, which is
 * the trade `HairDynamics.update` already makes: *"Dropping the surplus is a stall, and a stall is
 * what a viewer forgives; a spiral is what they do not."*
 */
export const SUBSTEP_SECONDS = 1 / 60;
export const MAX_DELTA_SECONDS = 0.1;
export const MAX_SUBSTEPS_PER_FRAME = Math.round( MAX_DELTA_SECONDS / SUBSTEP_SECONDS );

/**
 * How close the accumulator may come to a whole substep and still fire it.
 *
 * 🚩 THIS EXISTS BECAUSE OF A MEASURED ONE-ULP TRAP. `ik-and-springbones.md` §3.6 instrumented a
 * 144 Hz accumulator at `t = 1/12 s` — an instant 144 Hz and 60 Hz share exactly — and found it
 * **3.469 × 10⁻¹⁸ short** of the substep, so `>=` failed and the trace ran a whole substep behind.
 * Reproduced here, and it is worse than "a substep behind" sounds: the run never catches up, so the
 * accumulator then holds a FULL substep for the rest of the run. Twelve additions of `fl(1/144)`
 * are not `fl(1/12)`; that is a property of the caller's deltas, not of this file.
 *
 * So there are two lines of defence and the second is the real one:
 *
 * There are TWO independent defences and each one closes the trap on its own. Measured, not
 * reasoned — the reasoning was tried first and got it wrong in both directions:
 *
 *   - **this epsilon.** With `stepEpsilonSeconds: 0`, at 144 Hz the accumulator is 3.469e-18 short
 *     at `t = 1/12 s`, the substep does not fire, and it never catches up: the accumulator then
 *     holds a FULL substep (1.6667e-2 s) for the rest of the run and the trace is permanently one
 *     substep behind 60 Hz's — **6.4154° of joint angle**. Widening one comparison by 1.918e-10 s
 *     recovers it exactly.
 *   - **interpolating the remainder**, independently. A run in arrears is holding a full substep
 *     in its accumulator, so its `alpha` is 1 where the on-time run's is 0 — and
 *     `slerp( state(n−1), state(n), 1 )` is `state(n)`, which is exactly what the on-time run
 *     commits at `alpha = 0`. The constant-lag commit makes the pose a function of simulated time
 *     rather than of the substep COUNT, so a ULP that changes the count cannot change the pose.
 *     Measured: 6.4154° → 0.0000° with the epsilon still at zero.
 *
 * 🎯 THE EPSILON IS STILL THE PRIMARY DEFENCE, because it fixes the CLOCK and not only the pose:
 * `stepsTaken`, `simulatedSeconds` and therefore every scheduled push stay in step with the caller.
 * Interpolation repairs the committed pose and leaves the clock an arrears clock.
 *
 * The value is derived, not chosen. The accumulator holds `a ← fl(a + dt)` then `a ← fl(a − h)`,
 * both bounded in magnitude by `h + MAX_DELTA_SECONDS`, so each operation rounds by at most one
 * ulp of that bound and the error grows by at most two ulps per frame. `EPSILON_FRAME_BUDGET` is
 * the run length it is sized for — eight hours at 240 Hz, which is longer and faster than anything
 * this project renders. The selftest gates it from both sides: above the worst residual its own
 * runs actually produce, and far below any fraction of a substep that could advance a step early
 * by a visible amount.
 */
const EPSILON_FRAME_BUDGET = 8 * 3600 * 240;
export const STEP_EPSILON_SECONDS = 2 * EPSILON_FRAME_BUDGET * unitInLastPlace( SUBSTEP_SECONDS + MAX_DELTA_SECONDS );

/**
 * three-vrm's constructor defaults, which the VRM 1.0 JSON schema agrees with on four fields of
 * five. Read off `VRMSpringBoneJoint.ts:170-176` and `VRMC_springBone.joint.schema.json` this
 * round, both fetched raw rather than through a docs page.
 *
 * ⚠️ `dragForce` DISAGREES: the normative schema's default is **0.5**, three-vrm's `??` is **0.4**,
 * and three-vrm never applies the schema default — `VRMSpringBoneLoaderPlugin` passes the parsed
 * field straight through, so an omitted `dragForce` arrives as `undefined` and 0.4 fires. A VRM 1.0
 * file that omits the field therefore behaves at 0.4 in the reference implementation and at 0.5 per
 * the specification. 0.4 is used here because it is what a `.vrm` authored against three-vrm was
 * tuned in; the discrepancy is recorded so that a future importer can decide the other way on
 * purpose. `hair-motion.md` §7.1's *"the spec gives ranges but no default values"* is wrong on this
 * — the prose table omits them, the schema carries all five.
 */
export const SPRING_BONE_DEFAULTS = {
    /** Metres of tip pull per second — a LINEAR quantity. See `stiffnessMode`. [V] both sources. */
    stiffness: 1.0,
    /** Fraction of the retained per-STEP displacement thrown away each step. [V] three-vrm. */
    dragForce: 0.4,
    /** m/s² along `gravityDir`. [V] both sources. */
    gravityPower: 0.0,
    /** [V] both sources. Not normalised by VRM and not normalised here. */
    gravityDir: [ 0, - 1, 0 ],
    /** The joint's own collision radius, metres. [V] both sources. */
    hitRadius: 0.0
};

/**
 * Punch-list 6.6's stated starting parameters, kept as a NAMED PRESET rather than as the default.
 *
 * 🚩 THE PUNCH-LIST'S "start stiffness 0.75 / drag 0.05 / gravity 0" IS THE **Bust** ROW of
 * `affect-and-animation.md:738`, which is 6.8's soft-tissue item rather than 6.6's general default,
 * and that table cites no `.vrm` file — it is **[U]**, unverified. The Hair row of the same table
 * says `drag 0.4`, which is also three-vrm's own default, so the two halves of the punch-list
 * disagree with each other and only one of them has a primary behind it.
 *
 * ⚠️ AND `drag 0.05` IS THE VALUE THAT MAKES THE FRAME-RATE DEFECT WORST. Retained velocity decays
 * as `(1 − drag)ⁿ` in FRAMES, so the half-life is `ln(0.5)/ln(1 − drag)` frames — rate-independent
 * in frames and therefore inversely proportional to rate in seconds. At `drag 0.05` that is 13.51
 * frames: 450 ms of ring-down at 30 Hz against 113 ms at 120 Hz, a 338 ms spread, against 34 ms at
 * `drag 0.4`. The selftest measures the resulting divergence both ways. So the punch-list's own
 * starting numbers are the strongest case its own fixed timestep could have been given.
 */
export const SOFT_TISSUE_SETTINGS = {
    stiffness: 0.75,
    dragForce: 0.05,
    gravityPower: 0.0,
    /** ⚠️ The punch-list drops this and the row it quotes carries it. Restored, same marker. */
    hitRadius: 0.02
};

/**
 * Below this a vector is treated as having no direction, and whatever wanted its direction is
 * skipped or falls back.
 *
 * One nanometre, in the metres this module works in, and it sits in the wide gap between the two
 * things it has to separate. Above it: the smallest displacement anything here could mean, which is
 * bounded below by the repo's own indistinguishability floor of **2.43 mm** (LEARNINGS §1.10a) —
 * six orders of magnitude up. Below it: double-precision noise on metre-scale coordinates, where
 * `ulp(1 m)` is 2.2e-16 — seven orders of magnitude down. Anything in between is a vector that has
 * genuinely collapsed rather than one that is merely small.
 */
const DEGENERATE_LENGTH_METRES = 1e-9;

const _tail = new Vector3();
const _inertia = new Vector3();
const _axis = new Vector3();
const _origin = new Vector3();
const _direction = new Vector3();
const _childWorld = new Vector3();
const _localTail = new Vector3();
const _matrix = new Matrix4();
const _identityMatrix = /*@__PURE__*/ new Matrix4();

// --- depth curves -------------------------------------------------------------------------------

/**
 * A value as a function of normalised depth along a chain, `t = 0` at the root and `t = 1` at the
 * tip. Piecewise linear through authored control points, clamped outside them.
 *
 * Piecewise linear rather than a spline on purpose. A spline through hand-placed points overshoots,
 * and an overshoot here is a negative `dragForce` or a negative `stiffness` — a joint that gains
 * energy every step. Linear cannot leave the hull of its own control points, so a curve authored
 * inside `[0, 1]` stays inside it by construction rather than by a clamp somebody has to remember.
 *
 * The default is the constant 1, which is exactly VRM: no curve is the same code path as a flat
 * curve, so the module reproduces three-vrm when nobody asks it not to, and the selftest asserts
 * that equivalence rather than assuming it.
 */
export class DepthCurve {

    /**
     * @param {Array<[number, number]>|number} points - Control points `[ depth, value ]` in any
     *   order, or a single number for a constant curve.
     */
    constructor( points = 1 ) {

        if ( typeof points === 'number' ) {

            this.points = [ [ 0, points ], [ 1, points ] ];

        } else {

            if ( Array.isArray( points ) === false || points.length === 0 ) {

                throw new Error( 'DepthCurve needs at least one [ depth, value ] control point, or a number.' );

            }

            this.points = points.map( ( point ) => [ point[ 0 ], point[ 1 ] ] ).sort( ( a, b ) => a[ 0 ] - b[ 0 ] );

        }

    }

    /** The curve's value at normalised depth `t`, clamped to the end points outside `[first, last]`. */
    valueAt( depth ) {

        const points = this.points;

        if ( depth <= points[ 0 ][ 0 ] ) return points[ 0 ][ 1 ];
        if ( depth >= points[ points.length - 1 ][ 0 ] ) return points[ points.length - 1 ][ 1 ];

        for ( let index = 1; index < points.length; index ++ ) {

            const [ rightDepth, rightValue ] = points[ index ];
            if ( depth > rightDepth ) continue;

            const [ leftDepth, leftValue ] = points[ index - 1 ];
            const span = rightDepth - leftDepth;

            if ( span <= 0 ) return rightValue;

            return leftValue + ( rightValue - leftValue ) * ( ( depth - leftDepth ) / span );

        }

        return points[ points.length - 1 ][ 1 ];

    }

    /** True when the curve is the same value everywhere, i.e. when it changes nothing. */
    get isConstant() {

        const first = this.points[ 0 ][ 1 ];

        return this.points.every( ( point ) => point[ 1 ] === first );

    }

}

const CONSTANT_CURVE = /*@__PURE__*/ new DepthCurve( 1 );

// --- colliders ----------------------------------------------------------------------------------

/**
 * A sphere collider, in the exact arithmetic of `VRMSpringBoneColliderShapeSphere.calculateCollision`.
 *
 * `distance = |p − c| − r_joint − r_sphere`, negative meaning penetration, with the direction the
 * unit vector from the centre to the point. `inside: true` inverts both — the sphere becomes a
 * containment volume, which is how the extended-collider extension keeps a fringe out of a hood.
 *
 * `node` is the `Object3D` the collider rides; `offset` is in that node's local space. The two are
 * combined the way `VRMSpringBoneCollider.updateWorldMatrix` combines them — the offset replaces
 * the matrix's translation column — so a collider on a bone follows the bone.
 */
export function sphereCollider( { node = null, offset = [ 0, 0, 0 ], radius = 0, inside = false, name = 'sphere' } = {} ) {

    return {
        name,
        kind: 'sphere',
        node,
        offset: new Vector3().fromArray( toArray3( offset ) ),
        radius,
        inside,
        matrix: new Matrix4(),

        calculateCollision( point, jointRadius, target ) {

            target.subVectors( point, _origin.setFromMatrixPosition( this.matrix ) );

            const length = target.length();
            const distance = this.inside === true
                ? this.radius - jointRadius - length
                : length - jointRadius - this.radius;

            if ( distance < 0 && length > DEGENERATE_LENGTH_METRES ) {

                target.multiplyScalar( 1 / length );
                if ( this.inside === true ) target.negate();

            }

            return distance;

        }
    };

}

/**
 * A capsule collider, in the arithmetic of `VRMSpringBoneColliderShapeCapsule.calculateCollision`:
 * point-to-segment with three branches — before the head, past the tail, or on the shaft — then the
 * same radius subtraction as the sphere.
 *
 * `offset` is the head in the node's local space and `tail` is the other end, also in local space;
 * the segment is `offset → tail` carried by the node's world matrix. That asymmetry is VRM's, not a
 * simplification: the offset moves the matrix origin and the tail is then expressed relative to it.
 */
export function capsuleCollider( { node = null, offset = [ 0, 0, 0 ], tail = [ 0, 0, 0 ], radius = 0, inside = false, name = 'capsule' } = {} ) {

    return {
        name,
        kind: 'capsule',
        node,
        offset: new Vector3().fromArray( toArray3( offset ) ),
        tail: new Vector3().fromArray( toArray3( tail ) ),
        radius,
        inside,
        matrix: new Matrix4(),
        headToTail: new Vector3(),

        calculateCollision( point, jointRadius, target ) {

            _origin.setFromMatrixPosition( this.matrix );

            this.headToTail.subVectors( this.tail, this.offset ).applyMatrix4( this.matrix ).sub( _origin );

            const shaftLengthSquared = this.headToTail.lengthSq();

            target.subVectors( point, _origin );

            const along = this.headToTail.dot( target );

            if ( along <= 0 ) {

                // Nearest to the head; `target` already points from the head to the point.

            } else if ( shaftLengthSquared <= along ) {

                target.sub( this.headToTail );

            } else {

                target.addScaledVector( this.headToTail, - along / shaftLengthSquared );

            }

            const length = target.length();
            const distance = this.inside === true
                ? this.radius - jointRadius - length
                : length - jointRadius - this.radius;

            if ( distance < 0 && length > DEGENERATE_LENGTH_METRES ) {

                target.multiplyScalar( 1 / length );
                if ( this.inside === true ) target.negate();

            }

            return distance;

        }
    };

}

// --- one joint ----------------------------------------------------------------------------------

/**
 * One simulated joint: the bone, its rest geometry, and the two tail positions that are the whole
 * of its state.
 *
 * The tails live in CENTER space. That is the only thing `center` changes, and it is the whole
 * reason a walking character's ponytail does not stream out behind her.
 *
 * ⚠️ The bone's world length is computed from the bone's own world matrix and the child's REST
 * local translation rather than from `child.matrixWorld`. The two are identical for a rig whose
 * bones only rotate — a child's world position is `bone.matrixWorld · child.position` — and the
 * rest form removes a dependency on a descendant matrix that may be a substep stale, which is what
 * `VRMSpringBoneManager` has to patch with `traverseChildrenUntilConditionMet`. A rig that animates
 * a bone's local TRANSLATION would need the other form.
 */
class SpringBoneJoint {

    constructor( bone, childLocalPosition, settings ) {

        this.bone = bone;
        this.settings = settings;

        // three-vrm does the same in its constructor (`VRMSpringBoneJoint.ts:167`). This module
        // writes `bone.matrix` itself on every step, so letting three recompose it from the same
        // three components on every `updateMatrixWorld` is redundant work, not a safety net.
        bone.matrixAutoUpdate = false;
        bone.updateMatrix();

        this.initialLocalMatrix = new Matrix4().copy( bone.matrix );
        this.initialLocalRotation = new Quaternion().copy( bone.quaternion );
        this.initialLocalChildPosition = new Vector3().copy( childLocalPosition );

        this.restLength = this.initialLocalChildPosition.length();

        if ( this.restLength <= DEGENERATE_LENGTH_METRES ) {

            throw new Error( `SpringBones: joint "${ bone.name || '(unnamed)' }" has a rest length of ` +
                `${ this.restLength } m, so it has no rest axis and every quaternion derived from it would be NaN. ` +
                'A spring chain needs a child offset, or the VRM 0.x 7 cm fallback.' );

        }

        this.boneAxis = new Vector3().copy( this.initialLocalChildPosition ).normalize();

        // World-space, recomputed every step so a scaled rig needs no reinitialisation.
        this.worldSpaceBoneLength = this.restLength;

        // The two pieces of state, in CENTER space.
        this.currentTail = new Vector3();
        this.prevTail = new Vector3();

        // The parent's world matrix for this step: the chain's anchor for joint 0, the previous
        // joint's freshly written `matrixWorld` for every other.
        this.parentMatrixWorld = new Matrix4();

        // The pose at the end of the previous substep and at the end of the current one, for the
        // remainder interpolation. Not simulation state — output state.
        this.previousStepRotation = new Quaternion().copy( bone.quaternion );
        this.currentStepRotation = new Quaternion().copy( bone.quaternion );

        // Diagnostics.
        this.colliders = [];
        this.antipodalEscapes = 0;

    }

}

// --- one chain ----------------------------------------------------------------------------------

/**
 * One spring chain: an ordered run of bones, the settings every joint starts from, the depth curves
 * that vary them along the run, and the colliders and `center` node the whole chain shares.
 *
 * **`N` bones produce `N − 1` simulated joints.** The last bone is consumed as a TAIL only, which
 * is VRM 1.0's own import rule — `VRMSpringBoneLoaderPlugin` pairs each schema joint with the next,
 * so the final one contributes a child position and is never itself driven. A chain of one bone has
 * no child, and gets VRM 0.x's fixed **7 cm** fallback bone length
 * (`VRMSpringBoneJoint.ts:191-197`), which is the only place a length appears here that the caller
 * did not supply.
 */
export class SpringBoneChain {

    /**
     * @param {Object} options
     * @param {string} options.name - Unique within a system; it names the chain in `describe()`.
     * @param {Object3D[]} options.bones - Root first. `bones.length − 1` joints are simulated.
     * @param {Object} [options.settings] - Overrides for `SPRING_BONE_DEFAULTS`, applied to every
     *   joint before the curves scale them.
     * @param {Object} [options.curves] - `{ stiffness, dragForce, gravityPower, hitRadius }`, each a
     *   `DepthCurve` or a number. MULTIPLIERS on the settings above, not replacements, so a curve
     *   is a shape and the setting is the scale.
     * @param {'linear'|'angular'} [options.stiffnessMode='linear'] - How to read `stiffness`.
     *   `'linear'` is VRM's: metres of tip pull per second, so the angular rate a joint feels is
     *   `stiffness / restLength` and a long segment is soft. `'angular'` states the wanted rate in
     *   rad/s and multiplies by each joint's own rest length, so one authored number is one material
     *   along a chain of unequal segments. `'linear'` is the default because it is what a `.vrm`
     *   file's numbers mean.
     * @param {'index'|'arc'} [options.depthMode='index'] - How normalised depth is measured for the
     *   curves. `'index'` is `jointIndex / (jointCount − 1)`, which is what an authoring tool's
     *   curve widget shows. `'arc'` is cumulative rest length over total rest length, which is the
     *   physically even one. They agree exactly on a chain of equal segments, and the selftest
     *   asserts that rather than assuming it.
     * @param {Object[]} [options.colliders] - From `sphereCollider()` / `capsuleCollider()`.
     * @param {Object3D} [options.center=null] - The node the inertia term is measured in. `null`
     *   means world space, which is VRM's default and three-vrm's `IDENTITY_MATRIX4`.
     */
    constructor( { name, bones, settings = {}, curves = {}, stiffnessMode = 'linear',
        depthMode = 'index', colliders = [], center = null } = {} ) {

        if ( typeof name !== 'string' || name.length === 0 ) {

            throw new Error( 'A SpringBoneChain needs a name; it identifies the chain in every diagnostic line.' );

        }

        if ( Array.isArray( bones ) === false || bones.length === 0 ) {

            throw new Error( `SpringBoneChain "${ name }" needs at least one bone.` );

        }

        if ( stiffnessMode !== 'linear' && stiffnessMode !== 'angular' ) {

            throw new Error( `SpringBoneChain "${ name }": stiffnessMode must be 'linear' or 'angular', not "${ stiffnessMode }".` );

        }

        if ( depthMode !== 'index' && depthMode !== 'arc' ) {

            throw new Error( `SpringBoneChain "${ name }": depthMode must be 'index' or 'arc', not "${ depthMode }".` );

        }

        this.name = name;
        this.bones = [ ...bones ];
        this.stiffnessMode = stiffnessMode;
        this.depthMode = depthMode;
        this.center = center;
        this.colliders = [ ...colliders ];
        this.enabled = true;

        this.settings = {
            stiffness: settings.stiffness ?? SPRING_BONE_DEFAULTS.stiffness,
            dragForce: settings.dragForce ?? SPRING_BONE_DEFAULTS.dragForce,
            gravityPower: settings.gravityPower ?? SPRING_BONE_DEFAULTS.gravityPower,
            gravityDir: new Vector3().fromArray( toArray3( settings.gravityDir ?? SPRING_BONE_DEFAULTS.gravityDir ) ),
            hitRadius: settings.hitRadius ?? SPRING_BONE_DEFAULTS.hitRadius
        };

        this.curves = {
            stiffness: asCurve( curves.stiffness ),
            dragForce: asCurve( curves.dragForce ),
            gravityPower: asCurve( curves.gravityPower ),
            hitRadius: asCurve( curves.hitRadius )
        };

        this.joints = this.buildJoints();
        this.applyCurves();

        this.pendingPushes = [];

    }

    // --- construction ---------------------------------------------------------------------------

    /**
     * One joint per bone that has a successor. The final bone is a tail, per VRM 1.0's import rule;
     * a lone bone falls back to VRM 0.x's 7 cm along its own rest direction.
     */
    buildJoints() {

        const joints = [];

        if ( this.bones.length === 1 ) {

            const bone = this.bones[ 0 ];
            const fallback = new Vector3().copy( bone.position );

            if ( fallback.lengthSq() <= DEGENERATE_LENGTH_METRES ) fallback.set( 0, 1, 0 );

            // 🚩 VRM 0.x's fixed 7 cm, the one length in this file the caller did not supply.
            fallback.normalize().multiplyScalar( 0.07 );

            joints.push( new SpringBoneJoint( bone, fallback, { ...this.settings } ) );

            return joints;

        }

        for ( let index = 0; index < this.bones.length - 1; index ++ ) {

            joints.push( new SpringBoneJoint( this.bones[ index ], this.bones[ index + 1 ].position, { ...this.settings } ) );

        }

        return joints;

    }

    /**
     * Resolves every per-joint setting from the chain settings, the depth curves and the stiffness
     * mode. Called at construction and again whenever a curve or a setting changes.
     *
     * 🎯 THE STIFFNESS MODE IS APPLIED HERE AND NOWHERE ELSE, which is what keeps the step function
     * identical to VRM's. `'angular'` is a change of units at authoring time — `S = k · L` — not a
     * change of integrator.
     */
    applyCurves() {

        const joints = this.joints;

        // The arc from the FIRST joint's origin to the LAST joint's origin, so that depth 0 is the
        // root joint and depth 1 is the tip joint — the same two ends `'index'` puts them at. Using
        // the whole chain arc instead would leave the tip joint at `1 − Lₙ/total`, and the two
        // parameterisations would then disagree on a chain of EQUAL segments, where there is nothing
        // for them to disagree about.
        const arcTotal = joints.reduce( ( total, joint, index ) =>
            index === joints.length - 1 ? total : total + joint.restLength, 0 );

        let arcSoFar = 0;

        for ( let index = 0; index < joints.length; index ++ ) {

            const joint = joints[ index ];

            let depth;

            if ( this.depthMode === 'arc' ) {

                depth = arcTotal <= 0 ? 0 : arcSoFar / arcTotal;
                arcSoFar += joint.restLength;

            } else {

                depth = joints.length === 1 ? 0 : index / ( joints.length - 1 );

            }

            joint.depth = depth;

            const authoredStiffness = this.settings.stiffness * this.curves.stiffness.valueAt( depth );

            joint.settings = {
                stiffness: this.stiffnessMode === 'angular'
                    ? authoredStiffness * joint.restLength
                    : authoredStiffness,
                dragForce: this.settings.dragForce * this.curves.dragForce.valueAt( depth ),
                gravityPower: this.settings.gravityPower * this.curves.gravityPower.valueAt( depth ),
                gravityDir: this.settings.gravityDir,
                hitRadius: this.settings.hitRadius * this.curves.hitRadius.valueAt( depth )
            };

        }

    }

    // --- state ----------------------------------------------------------------------------------

    /**
     * Puts every bone back on its initial local rotation and drops any pending impulse.
     *
     * ⚠️ THIS IS HALF A REWIND AND `SpringBoneSystem.reset()` IS THE WHOLE ONE. The tails are the
     * simulation's actual state and they are re-snapshotted by `captureRestState`, which needs the
     * anchor's live world matrix and therefore belongs to the system. Calling this alone leaves a
     * chain holding last run's tails — the same shape as `MotionStack.reset`'s own warning that
     * rewinding the streams without resetting the layers leaves a layer holding a phase.
     */
    reset() {

        for ( const joint of this.joints ) {

            joint.bone.quaternion.copy( joint.initialLocalRotation );
            joint.bone.updateMatrix();

            joint.previousStepRotation.copy( joint.initialLocalRotation );
            joint.currentStepRotation.copy( joint.initialLocalRotation );
            joint.antipodalEscapes = 0;

        }

        this.pendingPushes.length = 0;

    }

    /**
     * Schedules a velocity impulse on the whole chain, in metres per second, applied at the first
     * substep boundary at or after `atSeconds` of the system's simulated time.
     *
     * 🚩 SCHEDULED BY SIMULATED TIME RATHER THAN APPLIED ON THE CALLING FRAME, and that is the same
     * lesson as the fixed step one level up. A caller that applies an impulse "on this frame" lands
     * it at a different point in the simulation at every frame rate — at 30 Hz the frame boundary
     * nearest `t` is up to 16.7 ms from it and at 120 Hz up to 4.2 ms — so the impulse itself
     * becomes frame-coupled even though the integrator is not. `Signals.PoissonSchedule` cuts the
     * frame at the arrival for the same reason (LEARNINGS §1.13).
     *
     * The impulse is written into `prevTail`, because `(currentTail − prevTail)` IS the retained
     * per-step displacement: subtracting `v · h` from the previous tail is exactly "the tail was
     * already moving at `v` when this step began".
     */
    push( velocityMetresPerSecond, atSeconds = 0 ) {

        this.pendingPushes.push( {
            at: atSeconds,
            velocity: new Vector3().fromArray( toArray3( velocityMetresPerSecond ) )
        } );

        this.pendingPushes.sort( ( a, b ) => a.at - b.at );

        return this;

    }

    /** The largest angle any joint currently sits at, off its own rest axis, in degrees. */
    get worstDeviationDegrees() {

        let worst = 0;

        for ( const joint of this.joints ) {

            const angle = 2 * Math.acos( Math.min( Math.abs(
                joint.initialLocalRotation.dot( joint.bone.quaternion ) ), 1 ) );

            worst = Math.max( worst, angle * 180 / Math.PI );

        }

        return worst;

    }

}

// --- the system ---------------------------------------------------------------------------------

/**
 * Owns the chains, the accumulator, and every transform the simulation is driven by.
 *
 * The frame, in order:
 *
 *   1. Snapshot every driving transform — each chain's anchor (the parent of its root bone), its
 *      `center` node, and every collider's node — as `from` (last frame's) and `to` (this frame's).
 *   2. Run whole `SUBSTEP_SECONDS` steps out of the accumulator, up to the cap. Each substep gets
 *      its own interpolated pose of every one of those transforms.
 *   3. Commit: write each bone the pose the substeps produced, interpolated across the remainder
 *      the accumulator is still holding.
 *
 * Step 1 is what makes this frame-rate INVARIANT rather than merely fixed-step, and step 3 is what
 * makes it invariant at instants that are not whole substeps.
 */
export class SpringBoneSystem {

    /**
     * @param {Object} [options]
     * @param {boolean} [options.interpolateRemainder=false] - Commit the interpolated pose between
     *   the last two substeps rather than the last substep's. See `commit()` for the four
     *   measurements that decided the default; the short version is that at this project's own
     *   60 Hz target the accumulator is empty on every frame, so interpolation is a pure one-frame
     *   lag with nothing bought, and at 144 Hz it is the difference between 58.3% of frames
     *   committing an unchanged pose and none of them.
     * @param {number} [options.antipodalEscapeRadians=0] - See `projectOntoBoneLength`. 0 disables it.
     * @param {number} [options.stepEpsilonSeconds] - How close the accumulator may come to a whole
     *   substep and still fire it. Defaults to the derived `STEP_EPSILON_SECONDS`. 🚩 RED PROOF at
     *   0: the measured one-ULP trap of `ik-and-springbones.md` §3.6 then fires and the substep
     *   count itself becomes rate-dependent.
     * @param {boolean} [options.perFrameStep=false] - 🚩 RED PROOF. One step per frame with the raw
     *   delta — three-vrm exactly. The invariance clause must reject this.
     * @param {boolean} [options.perFrameAnchor=false] - 🚩 RED PROOF. Keep the fixed step, but hand
     *   every substep the end-of-frame pose of every driving transform instead of its own.
     */
    constructor( { interpolateRemainder = false, antipodalEscapeRadians = 0,
        stepEpsilonSeconds = STEP_EPSILON_SECONDS, perFrameStep = false, perFrameAnchor = false } = {} ) {

        this.chains = [];
        this.tracks = new Map();       // Object3D -> TransformTrack, one per distinct driving node

        this.interpolateRemainder = interpolateRemainder;
        this.antipodalEscapeRadians = antipodalEscapeRadians;
        this.stepEpsilonSeconds = stepEpsilonSeconds;
        this.perFrameStep = perFrameStep;
        this.perFrameAnchor = perFrameAnchor;

        /** 🎯 6.7's seam. `( joint, colliders ) => colliders`, called once per joint per FRAME. */
        this.colliderSelector = null;

        this.accumulatorSeconds = 0;
        this.simulatedSeconds = 0;
        this.stepsTaken = 0;
        this.substepsLastFrame = 0;
        this.colliderTestsLastFrame = 0;
        this.remainderAlpha = 0;

    }

    // --- wiring ---------------------------------------------------------------------------------

    /**
     * Adds a chain and captures its rest state. The scene graph must already be up to date — the
     * rest tail is read through the bone's live world matrix, exactly as `setInitState` does.
     */
    add( chain ) {

        if ( this.findChain( chain.name ) !== null ) {

            throw new Error( `SpringBoneSystem already has a chain named "${ chain.name }"; names must be unique because they name every diagnostic line.` );

        }

        this.chains.push( chain );

        this.trackFor( parentOf( chain.bones[ 0 ] ) );
        this.trackFor( chain.center );

        for ( const collider of chain.colliders ) this.trackFor( collider.node );

        this.captureRestState( chain );

        return chain;

    }

    /**
     * Removes a chain and leaves it alive.
     *
     * ⚠️ Deliberately NOT the shape `MotionStack.remove()` has. That one disposes the layer
     * (`MotionStack.js:205`), so remove-then-re-add hands back a dead object — a trap the punch-list
     * records against 6.1. A chain is a plain object holding bone references; dropping it from the
     * list is the whole of removing it, and the caller may add it back.
     */
    remove( chain ) {

        const index = this.chains.indexOf( chain );
        if ( index === -1 ) return;

        this.chains.splice( index, 1 );

    }

    findChain( name ) {

        for ( const chain of this.chains ) {

            if ( chain.name === name ) return chain;

        }

        return null;

    }

    /**
     * Snapshots a chain's rest tails from the live scene graph.
     *
     * Called by `add()`, and again by the caller after anything moves the rig without the springs
     * having run — a pose change, an identity swap. `VRMSpringBoneManager.setInitState` is the same
     * call under a different name.
     */
    captureRestState( chain ) {

        const centerInverse = new Matrix4();

        if ( chain.center !== null ) centerInverse.copy( chain.center.matrixWorld ).invert();

        // The chain's own world matrices are rebuilt here rather than read, so a caller only has to
        // have brought the ANCHOR up to date. Reading `bone.matrixWorld` instead would silently
        // capture a rest tail from whatever the last `updateMatrixWorld` left behind.
        const anchor = parentOf( chain.bones[ 0 ] );
        let parentMatrix = anchor === null ? _identityMatrix : anchor.matrixWorld;

        for ( const joint of chain.joints ) {

            joint.bone.updateMatrix();
            joint.bone.matrixWorld.multiplyMatrices( parentMatrix, joint.bone.matrix );

            joint.parentMatrixWorld.copy( parentMatrix );
            joint.initialLocalMatrix.copy( joint.bone.matrix );
            joint.initialLocalRotation.copy( joint.bone.quaternion );

            joint.currentTail
                .copy( joint.initialLocalChildPosition )
                .applyMatrix4( joint.bone.matrixWorld )
                .applyMatrix4( centerInverse );

            joint.prevTail.copy( joint.currentTail );

            joint.previousStepRotation.copy( joint.bone.quaternion );
            joint.currentStepRotation.copy( joint.bone.quaternion );

            parentMatrix = joint.bone.matrixWorld;

        }

    }

    /**
     * Tells the system that its driving transforms JUMPED rather than moved.
     *
     * A pose swap, an identity swap, a cut, or simply the first frame after the rig was placed.
     * Without this the next frame's substeps interpolate across the jump and drag every chain
     * through it — an anchor teleported a metre would whip the chain along the whole metre.
     * `HairDynamics` carries the same idea as `previousHeadValid`; here it is a call rather than a
     * flag because a system may be driven by several nodes that jump independently.
     */
    placeTransforms() {

        for ( const track of this.tracks.values() ) track.reset();

    }

    /** Rewinds the accumulator, the clock and every chain, and re-snapshots the rest tails. */
    reset() {

        this.accumulatorSeconds = 0;
        this.simulatedSeconds = 0;
        this.stepsTaken = 0;
        this.substepsLastFrame = 0;
        this.colliderTestsLastFrame = 0;
        this.remainderAlpha = 0;

        for ( const track of this.tracks.values() ) track.reset();

        for ( const chain of this.chains ) {

            chain.reset();
            this.captureRestState( chain );

        }

    }

    // --- the frame ------------------------------------------------------------------------------

    /**
     * One frame. Advances the simulation by whole fixed steps and commits what they produced.
     *
     * @param {number} deltaSeconds - The frame's real time. Clamped to `MAX_DELTA_SECONDS`, the same
     *   clamp `MotionStack` applies, so a system driven beside the stack sees the same clock it does.
     * @returns {number} How many fixed steps ran, so a caller can report the work it paid for.
     */
    update( deltaSeconds ) {

        const delta = Math.min( Math.max( deltaSeconds, 0 ), MAX_DELTA_SECONDS );

        for ( const track of this.tracks.values() ) track.advanceFrame();

        this.colliderTestsLastFrame = 0;

        for ( const chain of this.chains ) {

            if ( chain.enabled === false ) continue;

            for ( const joint of chain.joints ) {

                joint.colliders = this.colliderSelector === null
                    ? chain.colliders
                    : this.colliderSelector( joint, chain.colliders );

            }

        }

        if ( this.perFrameStep === true ) {

            // 🚩 THE DEFECT: one step per frame with the raw delta.
            // `VRMSpringBoneManager.update( delta )` calls `springBone.update( delta )` and that is
            // the whole timestep story — no accumulator, no substepping, no clamp.
            // ⚠️ ONE DEPARTURE, stated so "this is three-vrm" is not overclaimed: the delta arriving
            // here has already been clamped to `MAX_DELTA_SECONDS` and three-vrm's has not. Under
            // the invariance clause's rates every delta is far inside that clamp, so it changes
            // nothing there; a caller reproducing three-vrm's behaviour on a stalled frame needs to
            // know the clamp is this file's and not the reference implementation's.
            this.simulatedSeconds += delta;
            this.runStep( delta, 1, 1 );
            this.substepsLastFrame = 1;
            this.stepsTaken ++;
            this.remainderAlpha = 0;
            this.commit();

            return 1;

        }

        this.accumulatorSeconds += delta;

        let substeps = 0;

        while ( this.accumulatorSeconds >= SUBSTEP_SECONDS - this.stepEpsilonSeconds
            && substeps < MAX_SUBSTEPS_PER_FRAME ) {

            this.accumulatorSeconds -= SUBSTEP_SECONDS;
            substeps ++;

        }

        // A frame far longer than the clamp cannot arrive through `MotionStack`, but a caller
        // driving this directly can produce one. Drop the surplus rather than spiral.
        if ( substeps === MAX_SUBSTEPS_PER_FRAME ) this.accumulatorSeconds = 0;

        for ( let substep = 0; substep < substeps; substep ++ ) {

            this.simulatedSeconds += SUBSTEP_SECONDS;
            this.runStep( SUBSTEP_SECONDS, substep + 1, substeps );

        }

        this.substepsLastFrame = substeps;
        this.stepsTaken += substeps;
        this.remainderAlpha = Math.min( Math.max( this.accumulatorSeconds / SUBSTEP_SECONDS, 0 ), 1 );

        this.commit();

        return substeps;

    }

    /**
     * One fixed step of every chain, at the interpolated pose of every driving transform.
     *
     * `substepIndex` runs 1..`substepCount` so that the last substep of a frame lands exactly on the
     * frame's end pose, which is what makes a chain of frames reconstruct the caller's own path
     * rather than a path shifted half a frame back.
     */
    runStep( stepSeconds, substepIndex, substepCount ) {

        const along = this.perFrameAnchor === true ? 1 : substepIndex / substepCount;

        for ( const track of this.tracks.values() ) track.sampleAt( along );

        for ( const chain of this.chains ) {

            if ( chain.enabled === false ) continue;

            this.applyPendingPushes( chain );

            const anchorTrack = this.tracks.get( parentOf( chain.bones[ 0 ] ) );
            const centerTrack = chain.center === null ? null : this.tracks.get( chain.center );

            const centerToWorld = centerTrack === null ? _identityMatrix : centerTrack.sampled;
            const worldToCenter = centerTrack === null ? _identityMatrix : centerTrack.sampledInverse;

            for ( const collider of chain.colliders ) {

                const colliderTrack = this.tracks.get( collider.node );
                setColliderMatrix( collider, colliderTrack === null || colliderTrack === undefined
                    ? _identityMatrix : colliderTrack.sampled );

            }

            let parentMatrix = anchorTrack === null || anchorTrack === undefined
                ? _identityMatrix : anchorTrack.sampled;

            for ( const joint of chain.joints ) {

                joint.parentMatrixWorld.copy( parentMatrix );
                this.stepJoint( joint, stepSeconds, centerToWorld, worldToCenter );
                parentMatrix = joint.bone.matrixWorld;

            }

        }

    }

    /**
     * The VRM spring-bone update for one joint, one step. Transcribed from
     * `VRMSpringBoneJoint.update`, with the two departures named in the file header and nothing else
     * changed — in particular the three additive terms, their spaces, and the hard length projection
     * are exactly as written there.
     */
    stepJoint( joint, stepSeconds, centerToWorld, worldToCenter ) {

        if ( stepSeconds <= 0 ) return;

        const bone = joint.bone;
        const settings = joint.settings;

        // The bone's own world matrix, from the parent pose this substep was handed, and from the
        // SIMULATION pose rather than whatever `commit()` last interpolated onto it.
        bone.quaternion.copy( joint.currentStepRotation );
        bone.updateMatrix();
        bone.matrixWorld.multiplyMatrices( joint.parentMatrixWorld, bone.matrix );

        _origin.setFromMatrixPosition( bone.matrixWorld );
        _childWorld.copy( joint.initialLocalChildPosition ).applyMatrix4( bone.matrixWorld );
        joint.worldSpaceBoneLength = _childWorld.distanceTo( _origin );

        if ( joint.worldSpaceBoneLength <= DEGENERATE_LENGTH_METRES ) return;

        // The rest axis, carried into world space by the PARENT. This is what makes a chain follow
        // a turning head: the restoring direction tracks the parent, not the bone.
        _axis.copy( joint.boneAxis )
            .transformDirection( joint.initialLocalMatrix )
            .transformDirection( joint.parentMatrixWorld );

        // Inertia in center space, then stiffness and gravity in world space. Three additive terms,
        // in that order and those spaces; see the header on `center`.
        _inertia.subVectors( joint.currentTail, joint.prevTail ).multiplyScalar( 1 - settings.dragForce );

        _tail.copy( joint.currentTail ).add( _inertia )
            .applyMatrix4( centerToWorld )
            .addScaledVector( _axis, settings.stiffness * stepSeconds )
            .addScaledVector( settings.gravityDir, settings.gravityPower * stepSeconds );

        this.projectOntoBoneLength( _tail, _origin, joint.worldSpaceBoneLength, _axis, joint );

        this.resolveCollisions( joint, _tail, _origin );

        joint.prevTail.copy( joint.currentTail );
        joint.currentTail.copy( _tail ).applyMatrix4( worldToCenter );

        // Rebuild the local rotation from the tail, in the bone's own initial space.
        _matrix.multiplyMatrices( joint.parentMatrixWorld, joint.initialLocalMatrix ).invert();
        _localTail.copy( _tail ).applyMatrix4( _matrix );

        if ( _localTail.lengthSq() <= DEGENERATE_LENGTH_METRES * DEGENERATE_LENGTH_METRES ) return;

        joint.previousStepRotation.copy( joint.currentStepRotation );

        joint.currentStepRotation
            .setFromUnitVectors( joint.boneAxis, _localTail.normalize() )
            .premultiply( joint.initialLocalRotation );

        // The simulation reads its own parent's matrix, so the SIMULATION pose is written here and
        // the interpolated one only at commit. Writing the interpolated pose now would feed a
        // half-step-old parent to every joint below this one.
        bone.quaternion.copy( joint.currentStepRotation );
        bone.updateMatrix();
        bone.matrixWorld.multiplyMatrices( joint.parentMatrixWorld, bone.matrix );

    }

    /**
     * The hard length projection: the tail is pulled back onto the sphere of radius `boneLength`
     * about the bone's world origin.
     *
     * 🎯 THIS IS WHAT MAKES THE INTEGRATOR UNCONDITIONALLY BOUNDED, and also what turns the
     * constant linear pull into an angular restoring law — both derivations are in the file header.
     *
     * 🚩 AND IT IS WHERE THE ONE GENUINE SINGULARITY LIVES. A tail folded exactly onto `−axis` has
     * `sin θ = 0`, so the stiffness term adds a vector antiparallel to the tail and the projection
     * puts it straight back: the joint is at an unstable equilibrium and stays there.
     *
     * A tail a HAIR off `−axis` is not stuck, and this is a correction to the survey.
     * `ik-and-springbones.md` §3.5 reads a joint at `π − 10⁻¹²` as sitting *"at 180° forever"* on
     * the strength of a 0.2 s window. The escape is exponential, and its discrete law falls out of
     * the same geometry in one line: a tail at `π − δ` gains `S·Δt` along the axis, and to first
     * order in `δ`
     *
     *     δ' = δ / ( 1 − S·Δt/L )
     *
     * so the perturbation grows by `1/(1−ε)` EVERY SUBSTEP and the escape takes
     * `Δt · ln(1/δ) / ln( 1/(1−ε) )` seconds. At `S = 1`, `L = 70 mm` that is a growth factor of
     * 1.3125 per substep — measured 1.312487 — so 0.2 s buys a factor of 22 and a perturbation of
     * 10⁻¹² is still 10⁻¹¹. The window was too short, not the joint stuck.
     *
     * ⚠️ AND THE DETECTOR HAS TO READ THE TAIL, NOT THE BONE. three r185's
     * `Quaternion.setFromUnitVectors` snaps to a fixed half-turn about a basis-derived axis whenever
     * `vFrom·vTo + 1 < 1e-8` (`Quaternion.js:477`, *"the epsilon value has been discussed in
     * #31286"*), which is every tail within `√(2·10⁻⁸) = 1.414e-4 rad = 0.0081°` of the antipode.
     * Measured here: the tail escapes smoothly from 10⁻⁶ rad while the bone's quaternion reads
     * EXACTLY 180.000000° until the tail passes 1.7534e-4 rad. Anything that watches the bone
     * therefore reports a joint as stuck for tens of substeps after it has started moving — and
     * anything that watches it in an authored pose gets a snap about an axis with no relation to
     * where the joint was going. This guard reads the tail.
     *
     * `antipodalEscapeRadians` is what un-sticks the exact antipode: a caller who cannot afford the
     * natural escape states the angle it may be nudged to, and the escape time follows from the
     * same formula.
     */
    projectOntoBoneLength( tail, origin, boneLength, axis, joint ) {

        _direction.subVectors( tail, origin );

        const length = _direction.length();

        if ( length > DEGENERATE_LENGTH_METRES ) {

            tail.copy( origin ).addScaledVector( _direction, boneLength / length );

        } else {

            // The three terms cancelled exactly. The rest axis is the only defensible direction.
            tail.copy( origin ).addScaledVector( axis, boneLength );

        }

        if ( this.antipodalEscapeRadians <= 0 ) return;

        _direction.subVectors( tail, origin ).divideScalar( boneLength );

        const cosine = _direction.dot( axis ) / Math.max( axis.length(), DEGENERATE_LENGTH_METRES );

        if ( cosine >= - Math.cos( this.antipodalEscapeRadians ) ) return;

        // Rotate the tail back toward the axis by the guard angle, about any axis perpendicular to
        // both. The perpendicular is degenerate at the exact antipode, so a stable rest-frame axis
        // is used there rather than a random one — a random nudge is state a capture has to
        // reproduce, which is the argument `HairDynamics.chainComplianceBuffer` already makes.
        _inertia.crossVectors( _direction, axis );

        if ( _inertia.lengthSq() <= DEGENERATE_LENGTH_METRES * DEGENERATE_LENGTH_METRES ) {

            _inertia.copy( perpendicularTo( axis ) );

        }

        _inertia.normalize();

        // Positive, about `tail × axis`, is the direction that carries the tail TOWARD the axis.
        _direction.applyAxisAngle( _inertia, this.antipodalEscapeRadians );
        tail.copy( origin ).addScaledVector( _direction, boneLength );

        joint.antipodalEscapes ++;

    }

    /**
     * Colliders, sequentially, each push followed by its own re-projection onto the length sphere.
     *
     * ⚠️ TWO PROPERTIES OF THIS LOOP THAT A GATE MUST KNOW, both inherited from the reference
     * implementation on purpose:
     *
     *   (a) The second collider's push can put the tail back inside the first, and nothing revisits
     *       it. There is no iteration and no simultaneous solve.
     *   (b) Push-then-project is not push-to-contact. The final point is at `boneLength` from the
     *       parent and generally NOT at `r_joint + r_collider` from the collider, so **a small
     *       residual penetration is correct behaviour**. A gate asserting zero penetration goes red
     *       on a working solver; the selftest gates the direction — penetration strictly decreases —
     *       instead.
     */
    resolveCollisions( joint, tail, origin ) {

        const colliders = joint.colliders;

        for ( let index = 0; index < colliders.length; index ++ ) {

            const collider = colliders[ index ];

            this.colliderTestsLastFrame ++;

            const distance = collider.calculateCollision( tail, joint.settings.hitRadius, _direction );

            if ( distance >= 0 ) continue;

            tail.addScaledVector( _direction, - distance );

            _direction.subVectors( tail, origin );

            const length = _direction.length();
            if ( length <= DEGENERATE_LENGTH_METRES ) continue;

            tail.copy( origin ).addScaledVector( _direction, joint.worldSpaceBoneLength / length );

        }

    }

    /** Applies any impulse whose scheduled instant has been reached. See `SpringBoneChain.push`. */
    applyPendingPushes( chain ) {

        const pending = chain.pendingPushes;

        while ( pending.length > 0 && pending[ 0 ].at <= this.simulatedSeconds + STEP_EPSILON_SECONDS ) {

            const push = pending.shift();

            for ( const joint of chain.joints ) {

                joint.prevTail.addScaledVector( push.velocity, - SUBSTEP_SECONDS );

            }

        }

    }

    /**
     * Writes each bone the pose the substeps produced.
     *
     * ## 🎯 "Interpolate the remainder, or state precisely why not" — the four measurements
     *
     * The remainder interpolation is implemented and it is OFF by default, and the reason is
     * measured rather than argued. `interpolateRemainder` commits
     * `slerp( state(n−1), state(n), accumulator / h )`, which is the standard constant-lag
     * formulation: the committed pose is then continuous in simulated time, at the price of a
     * CONSTANT one-substep lag. Off, it commits `state(n)` — zero lag, and a staircase at any rate
     * that does not divide the substep. Measured on a driven three-joint chain, share of frames
     * whose committed local rotation is bit-identical to the previous frame's:
     *
     *   | rate   | remainder dropped | remainder interpolated |
     *   |--------|------------------:|-----------------------:|
     *   | 60 Hz  |             0.0 % |                  0.0 % |
     *   | 100 Hz |            40.0 % |                  0.0 % |
     *   | 120 Hz |            50.0 % |                  0.0 % |
     *   | 144 Hz |            58.3 % |                  0.0 % |
     *
     * That column is `1 − 60/rate` exactly, which is the arithmetic rather than a finding: a 60 Hz
     * simulation on a 144 Hz display advances on five frames in twelve and holds on the other seven.
     * It is measured anyway, because a derivation that never met the code is a derivation about a
     * different program.
     *
     * @claim 58.3 :: node packages/core/src/physics/SpringBones.selftest.mjs :: frozen frames at 144 Hz #2
     *
     * 🚩 THE 60 Hz ROW IS WHAT DECIDES THE DEFAULT. The substep IS 60 Hz, so at this project's own
     * frame target (punch-list 8.3: *"60 fps at target resolution"*) the accumulator is empty on
     * every single frame and there is no remainder to interpolate — interpolation there is a pure
     * 16.67 ms lag of the hair behind the head it hangs from, bought for nothing. On a 144 Hz
     * display it earns its keep, so it is one flag away.
     *
     * 🎯 IT ALSO CLOSES THE ONE-ULP TRAP ON ITS OWN, which is the second half of the answer and is
     * measured under `STEP_EPSILON_SECONDS`: an arrears run is holding a full substep, so its alpha
     * is 1 where an on-time run's is 0, and both commit the same pose. That makes the two defences
     * independent rather than redundant — and the epsilon is still the one that ships, because it
     * repairs the CLOCK as well as the pose.
     */
    commit() {

        const alpha = this.interpolateRemainder === true ? this.remainderAlpha : 1;

        // The end-of-frame pose of every driving transform, so that a frame which ran zero substeps
        // still commits its chain against where the anchor actually is.
        for ( const track of this.tracks.values() ) track.sampleAt( 1 );

        for ( const chain of this.chains ) {

            if ( chain.enabled === false ) continue;

            const anchorTrack = this.tracks.get( parentOf( chain.bones[ 0 ] ) );
            let parentMatrix = anchorTrack === undefined ? _identityMatrix : anchorTrack.sampled;

            for ( const joint of chain.joints ) {

                joint.bone.quaternion
                    .copy( joint.previousStepRotation )
                    .slerp( joint.currentStepRotation, alpha );

                joint.bone.updateMatrix();
                joint.bone.matrixWorld.multiplyMatrices( parentMatrix, joint.bone.matrix );

                parentMatrix = joint.bone.matrixWorld;

            }

        }

    }

    // --- diagnostics ----------------------------------------------------------------------------

    /**
     * The static wiring count VRChat's "PhysBones Collision Check Count" actually measures: the sum
     * over joints of how many colliders each is wired to. It is NOT a per-frame execution count, and
     * `colliderTestsLastFrame` is. `ik-and-springbones.md` §4.2 records the punch-list conflating the
     * two, which is why both are here and separately named.
     */
    get wiredColliderChecks() {

        let total = 0;

        for ( const chain of this.chains ) total += chain.joints.length * chain.colliders.length;

        return total;

    }

    /** Every number a HUD or a round summary would want, in one block of text. */
    describe() {

        const lines = [];

        lines.push( `SpringBoneSystem — ${ this.chains.length } chains, ${ this.stepsTaken } steps, ` +
            `${ this.simulatedSeconds.toFixed( 3 ) } s simulated, substep ${ ( SUBSTEP_SECONDS * 1000 ).toFixed( 3 ) } ms` );

        lines.push( `  last frame: ${ this.substepsLastFrame } substeps, remainder alpha ` +
            `${ this.remainderAlpha.toFixed( 4 ) }, ${ this.colliderTestsLastFrame } collider tests ` +
            `(wired ${ this.wiredColliderChecks })` );

        for ( const chain of this.chains ) {

            const escapes = chain.joints.reduce( ( total, joint ) => total + joint.antipodalEscapes, 0 );

            lines.push( `  ${ chain.name.padEnd( 16 ) } ${ String( chain.joints.length ).padStart( 3 ) } joints  ` +
                `${ chain.stiffnessMode }/${ chain.depthMode }  worst ${ chain.worstDeviationDegrees.toFixed( 3 ) }°  ` +
                `${ chain.colliders.length } colliders  ${ escapes } antipodal escapes` );

        }

        if ( this.perFrameStep === true ) lines.push( '  🚩 perFrameStep is ON — this is the three-vrm defect, not the shipped path' );
        if ( this.perFrameAnchor === true ) lines.push( '  🚩 perFrameAnchor is ON — every substep sees the end-of-frame pose' );

        return lines.join( '\n' );

    }

    // --- helpers --------------------------------------------------------------------------------

    /** One `TransformTrack` per distinct driving node, shared by every chain that reads it. */
    trackFor( node ) {

        if ( node === null || node === undefined ) return null;

        let track = this.tracks.get( node );

        if ( track === undefined ) {

            track = new TransformTrack( node );
            this.tracks.set( node, track );

        }

        return track;

    }

}

/**
 * One driving transform, sampled across a frame.
 *
 * 🎯 WHY THIS EXISTS AT ALL, stated once because it is the least obvious half of 6.6. A fixed
 * timestep fixes the INTEGRATOR. It does nothing about the INPUT: a chain whose anchor is read once
 * per frame sees a 30 Hz staircase at 30 Hz and a 120 Hz staircase at 120 Hz, and the two integrate
 * to different trajectories however carefully the steps are sized. `HairDynamics.substepHeadMatrices`
 * records the same finding on the groom — *"this is what makes the solver frame-rate invariant
 * rather than merely fixed-step"* — measured there at 4.20 mm mean and 31.10 mm worst over 294 tips.
 *
 * Decompose–slerp–recompose rather than a component-wise matrix lerp, for the reason `HairDynamics`
 * gives: a lerp of two rotation matrices is not a rotation matrix. Four decompositions per node per
 * frame at most.
 *
 * ⚠️ WHAT THIS CANNOT DO, so the invariance clause is not read as claiming more than it proves. The
 * interpolant has knots at the CALLER's frame boundaries, so two rates reconstruct a curved input
 * path with different piecewise-linear approximations. Where the driving motion is not linear on the
 * grid the rates share, the residual difference is a property of how the caller sampled its own
 * animation and cannot be removed here. The gate therefore drives its anchor with a schedule that is
 * exactly linear on that shared grid, so that what it measures is the solver and nothing else — and
 * it measures the other case too, and reports it as a note rather than as a gate.
 */
class TransformTrack {

    constructor( node ) {

        this.node = node;

        this.fromPosition = new Vector3();
        this.fromRotation = new Quaternion();
        this.fromScale = new Vector3( 1, 1, 1 );

        this.toPosition = new Vector3();
        this.toRotation = new Quaternion();
        this.toScale = new Vector3( 1, 1, 1 );

        this.stepPosition = new Vector3();
        this.stepRotation = new Quaternion();
        this.stepScale = new Vector3( 1, 1, 1 );

        this.sampled = new Matrix4();
        this.sampledInverse = new Matrix4();

        this.reset();

    }

    /**
     * Places the track at the node's current pose, with no previous pose to move from.
     *
     * 🚩 THE PREVIOUS POSE IS SET TO THE CURRENT ONE RATHER THAN LEFT UNSET, and the difference is
     * measurable. An "unset" previous pose that makes the first frame's substeps all see the
     * end-of-frame pose is a per-frame anchor for exactly one frame — which at 30 Hz is a whole
     * substep of the anchor's motion and at 120 Hz is none, so the two rates start from different
     * states and never reconverge. Measured at 1.12° of permanent divergence before this was
     * changed, on a 20 s trace whose steady-state divergence is at the float floor.
     */
    reset() {

        this.node.matrixWorld.decompose( this.toPosition, this.toRotation, this.toScale );

        this.fromPosition.copy( this.toPosition );
        this.fromRotation.copy( this.toRotation );
        this.fromScale.copy( this.toScale );

        this.sampleAt( 1 );

    }

    /** Rolls this frame's pose into `from` and reads the node's live pose into `to`. */
    advanceFrame() {

        this.fromPosition.copy( this.toPosition );
        this.fromRotation.copy( this.toRotation );
        this.fromScale.copy( this.toScale );

        this.node.matrixWorld.decompose( this.toPosition, this.toRotation, this.toScale );

    }

    /** The pose a fraction `along` of the way through this frame, and its inverse. */
    sampleAt( along ) {

        this.stepPosition.lerpVectors( this.fromPosition, this.toPosition, along );
        this.stepRotation.copy( this.fromRotation ).slerp( this.toRotation, along );
        this.stepScale.lerpVectors( this.fromScale, this.toScale, along );

        this.sampled.compose( this.stepPosition, this.stepRotation, this.stepScale );
        this.sampledInverse.copy( this.sampled ).invert();

    }

}

// --- shared helpers -----------------------------------------------------------------------------

/**
 * The collider's world matrix with its offset folded into the translation column, which is what
 * `VRMSpringBoneCollider.updateWorldMatrix` does. Equivalent to
 * `makeTranslation( offset ).premultiply( matrixWorld )` for an affine matrix, and the columns are
 * written directly for the same reason it does: the rotation part is untouched and a full multiply
 * would round it.
 */
function setColliderMatrix( collider, nodeMatrixWorld ) {

    const elements = nodeMatrixWorld.elements;
    const offset = collider.offset;

    collider.matrix.copy( nodeMatrixWorld );

    collider.matrix.elements[ 12 ] = elements[ 0 ] * offset.x + elements[ 4 ] * offset.y + elements[ 8 ] * offset.z + elements[ 12 ];
    collider.matrix.elements[ 13 ] = elements[ 1 ] * offset.x + elements[ 5 ] * offset.y + elements[ 9 ] * offset.z + elements[ 13 ];
    collider.matrix.elements[ 14 ] = elements[ 2 ] * offset.x + elements[ 6 ] * offset.y + elements[ 10 ] * offset.z + elements[ 14 ];

}

/** A chain's anchor is its root bone's parent; a root with no parent is anchored to world. */
function parentOf( bone ) {

    return bone.parent ?? null;

}

function asCurve( value ) {

    if ( value === undefined || value === null ) return CONSTANT_CURVE;
    if ( value instanceof DepthCurve ) return value;

    return new DepthCurve( value );

}

function toArray3( value ) {

    if ( Array.isArray( value ) === true ) return value;

    return [ value.x, value.y, value.z ];

}

/** Any unit vector perpendicular to `vector`, chosen off its own smallest component so it is stable. */
function perpendicularTo( vector ) {

    const absolute = [ Math.abs( vector.x ), Math.abs( vector.y ), Math.abs( vector.z ) ];
    const smallest = absolute.indexOf( Math.min( ...absolute ) );

    const basis = new Vector3(
        smallest === 0 ? 1 : 0,
        smallest === 1 ? 1 : 0,
        smallest === 2 ? 1 : 0
    );

    return basis.cross( vector ).normalize();

}

/**
 * The gap between `value` and the next representable double above it. Used to size
 * `STEP_EPSILON_SECONDS` from the arithmetic rather than from a guess; there is no `Math.ulp` in
 * JavaScript, so the exponent is read off the float's own bits.
 */
function unitInLastPlace( value ) {

    const buffer = new DataView( new ArrayBuffer( 8 ) );

    buffer.setFloat64( 0, Math.abs( value ) );

    const exponent = ( buffer.getUint32( 0 ) >>> 20 ) & 0x7ff;

    return Math.pow( 2, exponent - 1023 - 52 );

}
