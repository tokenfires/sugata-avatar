/**
 * Gate for SpringBones — punch-list 6.6.
 *
 * The item is "the VRM algorithm PLUS a fixed 60 Hz timestep PLUS depth-distribution curves", so
 * this file has to prove three different kinds of thing and it keeps them apart:
 *
 *   FAITHFULNESS   the shipped step really is `VRMSpringBoneJoint.update`. Asserted against the
 *                  primary's own arithmetic, re-derived here — the defaults, the `N` bones to
 *                  `N−1` joints import rule, the 7 cm VRM 0.x fallback, the collider algebra, and
 *                  the property that a chain at rest is an equilibrium. A reimplementation that is
 *                  merely spring-LIKE would pass a wobble test and fail these.
 *
 *   THE LAW        `dθ/dt = −(S/L)·sin θ`. `affect-and-animation.md` §7 states there is no `k·x` in
 *                  the VRM update; there is, in the angular coordinate, and the whole case for
 *                  depth curves and for the `'angular'` stiffness mode rests on it. Measured
 *                  against the closed form and against the dimensionless group `ε = S·Δt/L`.
 *
 *   INVARIANCE     🚩 THE ITEM'S POINT. The same pushes at 30 / 60 / 120 Hz must agree at every
 *                  instant the three rates SHARE — not merely in amplitude, not merely in rate.
 *                  LEARNINGS §1.13 and §1.13a: this repository has shipped that defect four times
 *                  in four different mechanisms, and every rate, amplitude and spectral gate stayed
 *                  green through all four. THREE red proofs reintroduce it three different ways,
 *                  and the clause is asserted to reject all three. Beside them, an amplitude
 *                  statistic and a rate statistic are computed on the SAME defective build and
 *                  recorded as unmoved, so that neither can ever be read as covering this.
 *
 * Everything below is measured by running the module. Where the module's own header quotes a
 * figure, the check that produced it is here.
 *
 * Usage:  node "packages/core/src/physics/SpringBones.selftest.mjs"
 *
 * ⚠️ FIXTURE GEOMETRY IS STATED AS FIXTURE GEOMETRY. This figure has no hair, skirt or tail bones —
 * `figure_g050.glb` has 61 nodes and not one of them is a spring chain — so a chain "measured" off
 * it would be a chain this file invented and then measured. The rigs are built from `Object3D`s and
 * their segment lengths are the test's construction. The one length taken from outside is VRM 0.x's
 * own 7 cm fallback (`VRMSpringBoneJoint.ts:196`), and it is cited where it is used.
 */

import { Object3D, Quaternion, Vector3 } from 'three';

import {
    DepthCurve, SPRING_BONE_DEFAULTS, SOFT_TISSUE_SETTINGS, SpringBoneChain, SpringBoneSystem,
    SUBSTEP_SECONDS, MAX_DELTA_SECONDS, MAX_SUBSTEPS_PER_FRAME, STEP_EPSILON_SECONDS,
    capsuleCollider, sphereCollider
} from './SpringBones.js';

/**
 * VRM 0.x's fixed final-joint bone length. `VRMSpringBoneJoint.setInitState`: *"vrm0 requires a 7cm
 * fixed bone length for the final node in a chain"* — `.normalize().multiplyScalar(0.07)`.
 */
const VRM_FALLBACK_BONE_METRES = 0.07;

/**
 * The frame-rate invariance matrix — the same three rates `sway.selftest.mjs` and
 * `BodyIdle.selftest.mjs` already use. All three divide 60, so every instant they share is a whole
 * substep and the clause can be exact rather than tolerant. 144 Hz is measured separately in §D,
 * where the point is precisely that it does NOT divide 60.
 */
const INVARIANCE_RATES = [ 30, 60, 120 ];

/**
 * Long enough to contain the whole drive and its ring-down many times over: the scripted anchor
 * runs at 0.8 Hz so this is sixteen cycles, and the slowest ring-down in the file is
 * `SOFT_TISSUE_SETTINGS`'s 13.5-frame half-life, 225 ms at 60 Hz. A stochastic layer needs a long
 * window to catch rare arrivals; this one has no arrivals, so the window is sized by the slowest
 * thing in it rather than by a rate.
 */
const INVARIANCE_SECONDS = 20;

/**
 * How far two frame rates may disagree, in degrees at the joint. The same 0.001° that
 * `BodyIdle.selftest.mjs` sets, and for the same reason: it is a small fraction of the smallest
 * motion anything here authors. The measured residue on the shipped path is printed beside the
 * gate, and the red proofs score three to four orders of magnitude above it — which is what makes
 * the tolerance not the thing that decided the verdict.
 */
const INVARIANCE_TOLERANCE_DEGREES = 0.001;

/**
 * How far a weaker statistic must move before it could be said to have caught the defect. 15%,
 * copied from `BodyIdle.selftest.mjs`'s equivalent clause so that the two "a weaker gate would not
 * have seen this" records in this repository are stated in one unit.
 */
const WEAK_GATE_SENSITIVITY = 0.15;

const results = [];

main();

function main() {

    checkTheAlgorithm();
    checkTheRestoringLaw();
    checkFrameRateInvariance();
    checkTheRemainder();
    checkDepthCurves();
    checkCenter();
    checkColliders();
    checkAntipodal();
    checkDrag();
    checkDeterminism();

    report();

}

// --- fixtures -----------------------------------------------------------------------------------

/**
 * A chain of `segmentLengths.length + 1` bones hanging off a fresh anchor, laid out along `axis`.
 *
 * ⚠️ FIXTURE GEOMETRY, and every caller's lengths are the test's own construction rather than a
 * measurement of anything. See the file header: this figure carries no spring chain to measure, so
 * a length dressed as a finding here would be a length this file invented and then cited.
 */
function buildRig( segmentLengths, axis = new Vector3( 0, 0, 1 ) ) {

    const anchor = new Object3D();
    anchor.name = 'anchor';

    const bones = [];
    let parent = anchor;

    for ( let index = 0; index <= segmentLengths.length; index ++ ) {

        const bone = new Object3D();
        bone.name = `joint_${ index }`;

        if ( index > 0 ) bone.position.copy( axis ).multiplyScalar( segmentLengths[ index - 1 ] );

        parent.add( bone );
        bones.push( bone );
        parent = bone;

    }

    anchor.updateMatrixWorld( true );

    return { anchor, bones };

}

/** The joint's deviation from its own rest axis, in degrees, off the pose currently committed. */
function deviationDegrees( joint ) {

    const cosine = Math.min( Math.abs( joint.initialLocalRotation.dot( joint.bone.quaternion ) ), 1 );

    return 2 * Math.acos( cosine ) * 180 / Math.PI;

}

/**
 * Releases a chain from `releaseRadians` by rotating its ANCHOR and telling the system the anchor
 * was placed rather than moved.
 *
 * That is a release with zero velocity: the tails stay where they were, the rest axis has turned
 * under them, and `prevTail === currentTail` still holds. Rotating a BONE instead would fight the
 * simulation, which owns that quaternion.
 */
function release( system, anchor, releaseRadians, axis = 'x' ) {

    anchor.rotation[ axis ] = releaseRadians;
    anchor.updateMatrixWorld( true );
    system.placeTransforms();

}

// --- A. faithfulness to the primary ---------------------------------------------------------------

function checkTheAlgorithm() {

    section( 'A. THE VRM ALGORITHM — is this the same update, or merely something spring-like' );

    gate( 'default stiffness', SPRING_BONE_DEFAULTS.stiffness, 1.0, 1.0,
        'VRMSpringBoneJoint.ts:172 `settings.stiffness ?? 1.0`, and the VRM 1.0 schema agrees' );
    gate( 'default dragForce', SPRING_BONE_DEFAULTS.dragForce, 0.4, 0.4,
        'VRMSpringBoneJoint.ts:175 `?? 0.4`. ⚠️ the normative schema default is 0.5 and nothing applies it' );
    gate( 'default gravityPower', SPRING_BONE_DEFAULTS.gravityPower, 0, 0, 'both sources agree' );
    gate( 'default hitRadius', SPRING_BONE_DEFAULTS.hitRadius, 0, 0, 'both sources agree' );

    const four = new SpringBoneChain( { name: 'four', bones: buildRig( [ 0.1, 0.1, 0.1 ] ).bones } );

    gate( 'four bones make three joints', four.joints.length, 3, 3,
        'VRM 1.0 consumes the last schema joint as a TAIL — VRMSpringBoneLoaderPlugin pairs each with the next' );

    const lone = new Object3D();
    lone.position.set( 0, 0.4, 0 );
    new Object3D().add( lone );

    const single = new SpringBoneChain( { name: 'single', bones: [ lone ] } );

    gate( 'a lone bone gets VRM 0.x\'s 7 cm (m)', single.joints[ 0 ].restLength,
        VRM_FALLBACK_BONE_METRES, VRM_FALLBACK_BONE_METRES,
        'VRMSpringBoneJoint.ts:196 — `.normalize().multiplyScalar(0.07)` whenever `child` is null' );

    gate( 'substep (ms)', SUBSTEP_SECONDS * 1000, 16.666, 16.667, 'punch-list 6.6 asks for 60 Hz' );
    gate( 'substep cap', MAX_SUBSTEPS_PER_FRAME, 6, 6,
        `MotionStack clamps a delta to ${ MAX_DELTA_SECONDS } s (MotionStack.js:79); ${ MAX_DELTA_SECONDS } x 60 = 6 exactly` );

    // The cap and the surplus drop, which is what stops a frame that arrived late from spiralling.
    const late = new SpringBoneSystem();
    late.add( new SpringBoneChain( { name: 'late', bones: buildRig( [ 0.09 ] ).bones } ) );

    const lateSubsteps = late.update( 5.0 );

    gate( 'a five-second frame runs the cap, not 300', lateSubsteps, 6, 6,
        'the delta is clamped to 0.1 s first, and six substeps is exactly that clamp' );
    gate( 'and drops the surplus rather than spiralling', late.accumulatorSeconds, 0, 0,
        'HairDynamics.update: "a stall is what a viewer forgives; a spiral is what they do not"' );

    // remove() must NOT dispose, which is where this deliberately differs from MotionStack.remove.
    const reusable = new SpringBoneChain( { name: 'reusable', bones: buildRig( [ 0.09 ] ).bones } );
    const reuseSystem = new SpringBoneSystem();

    reuseSystem.add( reusable );
    reuseSystem.remove( reusable );
    reuseSystem.add( reusable );
    reuseSystem.update( SUBSTEP_SECONDS );

    gate( 'remove-then-re-add gives back a live chain', reuseSystem.chains.length, 1, 1,
        '⚠️ MotionStack.remove DISPOSES its layer (MotionStack.js:205) and the punch-list records that trap against 6.1; this one does not' );

    // Rest is the equilibrium. Gravity 0, no drive: nothing may move, ever.
    const still = buildRig( [ 0.09, 0.09, 0.09 ] );
    const stillSystem = new SpringBoneSystem();
    const stillChain = stillSystem.add( new SpringBoneChain( { name: 'still', bones: still.bones } ) );

    for ( let frame = 0; frame < 600; frame ++ ) stillSystem.update( SUBSTEP_SECONDS );

    gate( 'a chain at rest never moves (deg)', stillChain.worstDeviationDegrees, 0, 1e-12,
        '10 s at 60 Hz, gravity 0, anchor still — the authored pose must be the equilibrium' );

    // A zero-length joint is refused by name rather than producing NaN quaternions.
    let refused = 0;

    try {

        const degenerate = new Object3D();
        const child = new Object3D();
        degenerate.add( child );
        new SpringBoneChain( { name: 'degenerate', bones: [ degenerate, child ] } );

    } catch ( error ) {

        refused = /rest length/.test( error.message ) ? 1 : 0;

    }

    gate( 'a zero-length joint is refused by name', refused, 1, 1,
        'ozz\'s rule for a degenerate limb is the identity correction, not a NaN; here it cannot be constructed at all' );

    // 🚩 Unconditional boundedness. ik-and-springbones.md §3.5 swept five decades and read max|θ| as
    // exactly the release angle; re-run here rather than quoted, and the reading is REFINED — with
    // inertia in play the peak is BELOW the release angle, because the first step is a relaxation
    // and the retained displacement then carries the tail toward the axis rather than away from it.
    console.log( '' );
    console.log( '   stiffness    S*dt/L      max |theta| (deg)   final |theta| (deg)   finite' );

    const releaseDegrees = 28.6478;
    let worstOvershootRatio = 0;
    let allFinite = 1;

    for ( const stiffness of [ 1, 100, 10000, 100000 ] ) {

        const rig = buildRig( [ VRM_FALLBACK_BONE_METRES ] );
        const system = new SpringBoneSystem();
        const chain = system.add( new SpringBoneChain( {
            name: 'sweep', bones: rig.bones, settings: { stiffness }
        } ) );

        release( system, rig.anchor, releaseDegrees * Math.PI / 180 );

        let peak = 0;

        for ( let frame = 0; frame < 300; frame ++ ) {

            system.update( SUBSTEP_SECONDS );
            peak = Math.max( peak, deviationDegrees( chain.joints[ 0 ] ) );

        }

        const settled = deviationDegrees( chain.joints[ 0 ] );

        if ( Number.isFinite( peak ) === false || Number.isFinite( settled ) === false ) allFinite = 0;

        worstOvershootRatio = Math.max( worstOvershootRatio, peak / releaseDegrees );

        console.log( `  ${ String( stiffness ).padStart( 10 ) }  ${ ( stiffness * SUBSTEP_SECONDS / VRM_FALLBACK_BONE_METRES ).toFixed( 3 ).padStart( 9 ) }` +
            `  ${ peak.toFixed( 6 ).padStart( 18 ) }  ${ settled.toFixed( 8 ).padStart( 20 ) }  ${ Number.isFinite( peak ) }` );

    }

    console.log( '' );

    gate( 'no stiffness makes it overshoot', worstOvershootRatio, 0, 1,
        'the length projection renormalises onto the sphere every step, so adding k*u and renormalising approaches u without crossing it' );
    gate( 'no stiffness makes it NaN', allFinite, 1, 1,
        '5 s at S*dt/L up to 23,810 — substepping buys INVARIANCE here, and nothing at all in stability' );

}

// --- B. the restoring law -------------------------------------------------------------------------

function checkTheRestoringLaw() {

    section( 'B. dθ/dt = −(S/L)·sin θ — the k·x that affect-and-animation.md §7 says is not there' );

    console.log( '' );
    console.log( '     L (mm)      S    theta0        eps     predicted d(theta)   measured d(theta)    ratio' );

    let worstRatioError = 0;

    for ( const [ lengthMetres, stiffness, thetaDegrees ] of [
        [ 0.07, 1.0, 30 ], [ 0.07, 1.0, 5 ], [ 0.25, 1.0, 30 ], [ 0.25, 0.5, 30 ], [ 0.5, 1.0, 30 ] ] ) {

        const measured = - oneStepDeviation( lengthMetres, stiffness, thetaDegrees );
        const epsilon = stiffness * SUBSTEP_SECONDS / lengthMetres;
        const predicted = - epsilon * Math.sin( thetaDegrees * Math.PI / 180 ) * 180 / Math.PI;

        // The linearisation is exact only as ε → 0, so the admissible error IS ε. Subtracting it
        // makes the gate read "no worse than its own truncation order" rather than "within a number
        // somebody picked".
        worstRatioError = Math.max( worstRatioError, Math.abs( measured / predicted - 1 ) - epsilon );

        console.log( `  ${ ( lengthMetres * 1000 ).toFixed( 0 ).padStart( 9 ) }  ${ stiffness.toFixed( 1 ).padStart( 5 ) }` +
            `  ${ String( thetaDegrees ).padStart( 6 ) }  ${ epsilon.toFixed( 5 ).padStart( 9 ) }  ${ predicted.toFixed( 6 ).padStart( 19 ) }` +
            `  ${ measured.toFixed( 6 ).padStart( 18 ) }  ${ ( measured / predicted ).toFixed( 4 ).padStart( 7 ) }` );

    }

    console.log( '' );

    gate( 'the linearisation holds to O(eps)', worstRatioError, - 1, 0,
        'dragForce 1 removes the inertia term, so one step from rest is the stiffness term alone' );

    // The dimensionless group: two joints with the same S*dt/L must move by the same angle whatever
    // L and S separately are. This IS "stiffness is not scale-invariant", stated as a measurement.
    const quarterMetre = oneStepDeviation( 0.25, 1.0, 30 );
    const halfMetreDouble = oneStepDeviation( 0.5, 2.0, 30 );
    const halfMetre = oneStepDeviation( 0.5, 1.0, 30 );

    const epsilonQuarter = 1.0 * SUBSTEP_SECONDS / 0.25;

    note( 'S=1.0 L=250mm, one step (deg)', quarterMetre.toFixed( 8 ), `eps = S*dt/L = ${ epsilonQuarter.toFixed( 5 ) }` );
    note( 'S=2.0 L=500mm, one step (deg)', halfMetreDouble.toFixed( 8 ), 'the same eps by construction' );
    note( 'S=1.0 L=500mm, one step (deg)', halfMetre.toFixed( 8 ), 'half the eps — so half the angle, to O(eps)' );

    gate( 'equal S*dt/L gives an equal angle', Math.abs( quarterMetre - halfMetreDouble ), 0, 1e-12,
        'the dimensionless group is exactly S*dt/L, so `stiffness` is a LENGTH-dependent material' );

    gate( 'and halving it halves the angle', Math.abs( halfMetre / quarterMetre - 0.5 ), 0, epsilonQuarter,
        `to O(eps), and the larger eps here is ${ epsilonQuarter.toFixed( 5 ) } — a 500 mm segment is genuinely softer than a 70 mm one at the same authored number` );

}

/** The angle a single joint recovers in one substep, released from `thetaDegrees` with no inertia. */
function oneStepDeviation( lengthMetres, stiffness, thetaDegrees ) {

    const rig = buildRig( [ lengthMetres ] );
    const system = new SpringBoneSystem();
    const chain = system.add( new SpringBoneChain( {
        name: 'law', bones: rig.bones, settings: { stiffness, dragForce: 1 }
    } ) );

    release( system, rig.anchor, thetaDegrees * Math.PI / 180 );
    system.update( SUBSTEP_SECONDS );

    return thetaDegrees - deviationDegrees( chain.joints[ 0 ] );

}

// --- C. frame-rate invariance ---------------------------------------------------------------------

/**
 * The scripted anchor, designed so that what the comparison measures is the SOLVER.
 *
 * 🚩 The angle is PIECEWISE LINEAR with knots at multiples of 1/30 s, and that is not a
 * convenience. `TransformTrack` reconstructs the anchor's path between frame boundaries by slerp,
 * and slerp between two rotations about one axis is exactly linear in the angle — so at 30, 60 and
 * 120 Hz all three rates reconstruct the SAME continuous function, knots included. Driven by a raw
 * sine instead, the three rates sample three different staircases, which is a genuine difference in
 * the INPUT and would be charged to the solver by mistake. §D measures that case and reports it as
 * a note, because it belongs to the caller.
 */
function anchorAngleAt( seconds ) {

    const knot = 1 / 30;
    const index = Math.floor( seconds / knot + 1e-9 );
    const along = ( seconds - index * knot ) / knot;

    const at = ( step ) => 0.6 * Math.sin( 2 * Math.PI * 0.8 * step * knot );

    return at( index ) + ( at( index + 1 ) - at( index ) ) * along;

}

/**
 * One trace at one frame rate. Samples the COMMITTED pose — what a renderer would draw — at every
 * multiple of 1/30 s, an instant every rate in the matrix has a frame boundary on.
 */
function traceAtRate( rateHz, { systemOptions = {}, chainSettings = {}, moveAnchor = true,
    seconds = INVARIANCE_SECONDS, sampleHz = 30 } = {} ) {

    const rig = buildRig( [ 0.09, 0.08, 0.07, 0.06 ] );
    const system = new SpringBoneSystem( systemOptions );
    const chain = system.add( new SpringBoneChain( {
        name: 'ponytail',
        bones: rig.bones,
        settings: { stiffness: 1.0, dragForce: 0.4, ...chainSettings }
    } ) );

    // The pushes: the same three impulses at the same three SIMULATED instants, whatever the rate.
    chain.push( [ 0, 0, 1.5 ], 0.5 );
    chain.push( [ 0.9, 0, 0 ], 2.0 );
    chain.push( [ 0, - 1.2, 0 ], 6.5 );

    const samples = [];
    const angles = [];
    const frames = Math.round( seconds * rateHz );
    const sampleEvery = Math.round( rateHz / sampleHz );

    const world = new Vector3();
    const tip = chain.joints[ chain.joints.length - 1 ];

    let peakDegrees = 0;

    for ( let frame = 1; frame <= frames; frame ++ ) {

        if ( moveAnchor === true ) {

            rig.anchor.rotation.x = anchorAngleAt( frame / rateHz );
            rig.anchor.updateMatrixWorld( true );

        }

        system.update( 1 / rateHz );

        peakDegrees = Math.max( peakDegrees, chain.worstDeviationDegrees );

        if ( frame % sampleEvery !== 0 ) continue;

        for ( const joint of chain.joints ) {

            samples.push( joint.bone.quaternion.x, joint.bone.quaternion.y,
                joint.bone.quaternion.z, joint.bone.quaternion.w );

        }

        world.setFromMatrixPosition( tip.bone.matrixWorld );
        samples.push( world.x, world.y, world.z, 0 );

        angles.push( deviationDegrees( tip ) );

    }

    return { rateHz, samples, angles, peakDegrees, system, chain };

}

/**
 * The largest disagreement between two traces, as an angle. Quaternion components differenced
 * directly and converted with `q_xyz ≈ axis·θ/2` — `BodyIdle.selftest.mjs`'s own rule, which avoids
 * an `acos` near 1.
 */
function worstDivergenceDegrees( trace, reference ) {

    let worst = 0;
    const count = Math.min( trace.samples.length, reference.samples.length );

    for ( let index = 0; index < count; index ++ ) {

        worst = Math.max( worst, Math.abs( trace.samples[ index ] - reference.samples[ index ] ) );

    }

    return worst * 2 * 180 / Math.PI;

}

function checkFrameRateInvariance() {

    section( 'C. FRAME-RATE INVARIANCE — the same pushes at 30 / 60 / 120 Hz  🚩 THE ITEM' );

    const reference = traceAtRate( 60 );

    console.log( '' );
    console.log( '          rate   peak (deg)   worst divergence vs 60 Hz (deg)' );

    let worstShipped = 0;

    for ( const rate of INVARIANCE_RATES ) {

        const trace = rate === 60 ? reference : traceAtRate( rate );
        const worst = worstDivergenceDegrees( trace, reference );

        worstShipped = Math.max( worstShipped, worst );

        console.log( `  ${ String( rate + ' Hz' ).padStart( 12 ) }   ${ trace.peakDegrees.toFixed( 4 ).padStart( 10 ) }   ` +
            `${ worst.toExponential( 3 ).padStart( 31 ) }` );

    }

    console.log( '' );

    gate( 'the window contains real motion (deg)', reference.peakDegrees, 5, 180,
        'a comparison of two traces that never left rest is a comparison of two zeroes' );

    gate( 'worst divergence, 30/60/120 Hz (deg)', worstShipped, 0, INVARIANCE_TOLERANCE_DEGREES,
        `every joint, every shared instant, over ${ INVARIANCE_SECONDS } s of scripted anchor and 3 scheduled pushes` );

    // --- RED PROOF 1: three-vrm, verbatim. One step per frame with the raw delta. ----------------
    const coupled = INVARIANCE_RATES.map( ( rate ) => traceAtRate( rate, {
        systemOptions: { perFrameStep: true } } ) );
    const coupledWorst = Math.max( ...coupled.map( ( trace ) => worstDivergenceDegrees( trace, coupled[ 1 ] ) ) );

    note( 'perFrameStep, worst divergence (deg)', coupledWorst.toFixed( 4 ),
        'VRMSpringBoneManager.update passes the raw delta straight through — this IS three-vrm' );

    gate( 'the clause REJECTS per-frame stepping', coupledWorst > INVARIANCE_TOLERANCE_DEGREES ? 1 : 0, 1, 1,
        '1 means the gate caught it; 0 means the gate is decorative' );

    gate( 'and by a real margin (x tolerance)', coupledWorst / INVARIANCE_TOLERANCE_DEGREES, 100, Infinity,
        'the error must be large enough that the tolerance is not what decided the verdict' );

    // --- RED PROOF 2: the fixed step KEPT, the per-substep anchor interpolation removed. ---------
    const staircase = INVARIANCE_RATES.map( ( rate ) => traceAtRate( rate, {
        systemOptions: { perFrameAnchor: true } } ) );
    const staircaseWorst = Math.max( ...staircase.map( ( trace ) => worstDivergenceDegrees( trace, staircase[ 1 ] ) ) );

    note( 'perFrameAnchor, worst divergence (deg)', staircaseWorst.toFixed( 4 ),
        'fixed 60 Hz steps, but every substep of a frame sees the END-OF-FRAME anchor pose' );

    gate( 'the clause REJECTS a per-frame anchor', staircaseWorst > INVARIANCE_TOLERANCE_DEGREES ? 1 : 0, 1, 1,
        '🎯 a fixed timestep alone is NOT frame-rate invariance — the DRIVING transforms must be interpolated too' );

    gate( 'and by a real margin (x tolerance)', staircaseWorst / INVARIANCE_TOLERANCE_DEGREES, 100, Infinity,
        'HairDynamics.substepHeadMatrices records the same finding on the groom, at 31.10 mm worst over 294 tips' );

    // --- WHAT A WEAKER GATE WOULD HAVE SAID ABOUT THE SAME DEFECT --------------------------------
    //
    // 🚩 RECORDED AS GATES, not as prose. Both statistics are computed on the DEFECTIVE build and
    // both are asserted to stay put, so that neither an amplitude check nor a rate check can ever be
    // read as covering this. LEARNINGS §1.13: "Every rate, amplitude and spectral gate in the repo
    // stayed green through all of it, because the rate WAS right."

    const peaks = coupled.map( ( trace ) => trace.peakDegrees );
    const peakSpread = Math.max( ...peaks ) / Math.min( ...peaks ) - 1;

    note( 'perFrameStep peak angle by rate (deg)', peaks.map( ( peak ) => peak.toFixed( 3 ) ).join( ' / ' ),
        '30 / 60 / 120 Hz — an amplitude gate reads this column' );

    gate( 'the AMPLITUDE gate would NOT have caught it', peakSpread > WEAK_GATE_SENSITIVITY ? 1 : 0, 0, 0,
        `recorded, not tolerated: the peak spans ${ ( 100 * peakSpread ).toFixed( 1 ) }% across the three rates while the trajectory spans ${ coupledWorst.toFixed( 1 ) }°` );

    const crossings = coupled.map( ( trace ) => crossingsPerSecond( trace.angles, 30 ) );
    const crossingSpread = Math.max( ...crossings ) / Math.min( ...crossings ) - 1;

    note( 'perFrameStep tip crossings/s by rate', crossings.map( ( value ) => value.toFixed( 3 ) ).join( ' / ' ),
        'a RATE or spectral gate reads this column — the drive is 0.8 Hz and stays 0.8 Hz' );

    gate( 'the RATE gate would NOT have caught it', crossingSpread > WEAK_GATE_SENSITIVITY ? 1 : 0, 0, 0,
        `recorded, not tolerated: the crossing rate spans ${ ( 100 * crossingSpread ).toFixed( 1 ) }% while the trajectory spans ${ coupledWorst.toFixed( 1 ) }°` );

}

/** Mean-crossings per second of a series — the cheapest honest rate statistic for an oscillation. */
function crossingsPerSecond( series, sampleHz ) {

    let total = 0;
    for ( const value of series ) total += value;

    const average = total / series.length;

    let crossings = 0;

    for ( let index = 1; index < series.length; index ++ ) {

        if ( ( series[ index - 1 ] - average ) * ( series[ index ] - average ) < 0 ) crossings ++;

    }

    return crossings * sampleHz / series.length;

}

// --- D. the remainder, and the one-ULP trap -------------------------------------------------------

function checkTheRemainder() {

    section( 'D. THE ACCUMULATOR — 144 Hz does not divide 60, and that is where the ULP trap lives' );

    // 144 and 60 share every multiple of 1/12 s. The anchor is held still here and the motion comes
    // from the scheduled pushes, so that the only thing under test is the accumulator: a scripted
    // anchor sampled at 144 Hz is a different INPUT, which §C's note explains and which is measured
    // at the bottom of this section rather than mixed into these gates.
    const shared = { seconds: 12, sampleHz: 12, moveAnchor: false };

    console.log( '' );
    console.log( '   substeps completed at t = 1/12 s, and the accumulator left over' );
    console.log( '' );
    console.log( '     epsilon      rate   substeps   accumulator (s)' );

    const substepsAt = ( rate, epsilon ) => {

        const rig = buildRig( [ 0.09 ] );
        const system = new SpringBoneSystem( { stepEpsilonSeconds: epsilon } );
        system.add( new SpringBoneChain( { name: 'count', bones: rig.bones } ) );

        for ( let frame = 1; frame <= rate / 12; frame ++ ) system.update( 1 / rate );

        return { steps: system.stepsTaken, accumulator: system.accumulatorSeconds };

    };

    let mismatchedWithoutEpsilon = 0;
    let mismatchedWithEpsilon = 0;

    for ( const epsilon of [ 0, STEP_EPSILON_SECONDS ] ) {

        const at60 = substepsAt( 60, epsilon );
        const at144 = substepsAt( 144, epsilon );

        if ( epsilon === 0 ) mismatchedWithoutEpsilon = at144.steps === at60.steps ? 0 : 1;
        else mismatchedWithEpsilon = at144.steps === at60.steps ? 0 : 1;

        for ( const [ rate, measured ] of [ [ 60, at60 ], [ 144, at144 ] ] ) {

            console.log( `  ${ epsilon.toExponential( 1 ).padStart( 10 ) }  ${ String( rate + ' Hz' ).padStart( 8 ) }` +
                `  ${ String( measured.steps ).padStart( 9 ) }   ${ measured.accumulator.toExponential( 3 ).padStart( 15 ) }` );

        }

    }

    console.log( '' );

    gate( 'without the epsilon the substep is LOST', mismatchedWithoutEpsilon, 1, 1,
        '🚩 the measured trap: 3.47e-18 short at t = 1/12 s, so `>=` fails — and the accumulator then holds a FULL substep for the rest of the run' );

    gate( 'the derived epsilon recovers it', mismatchedWithEpsilon, 0, 0,
        'the same instant, the same rates, one comparison widened by 1.9e-10 s' );

    // 🎯 THE TRAJECTORY CONSEQUENCE, AND THE ANSWER TO "interpolate the remainder, or state
    // precisely why not". Two independent defences, each measured alone and both measured removed.
    // Reasoning was tried first and got this wrong in BOTH directions before the run settled it.
    const divergence = ( options ) => worstDivergenceDegrees(
        traceAtRate( 144, { ...shared, systemOptions: options } ),
        traceAtRate( 60, { ...shared, systemOptions: options } ) );

    const shipped = divergence( {} );
    const neither = divergence( { stepEpsilonSeconds: 0, interpolateRemainder: false } );
    const interpolationOnly = divergence( { stepEpsilonSeconds: 0, interpolateRemainder: true } );

    note( '144 vs 60 Hz, epsilon + no interpolation (deg)', shipped.toExponential( 3 ), 'the shipped path' );
    note( '144 vs 60 Hz, NEITHER defence (deg)', neither.toFixed( 4 ), 'one substep in arrears, permanently' );
    note( '144 vs 60 Hz, interpolation only (deg)', interpolationOnly.toExponential( 3 ),
        'an arrears run holds a FULL substep, so its alpha is 1 where the on-time run\'s is 0 — and both commit state(n)' );

    gate( 'the shipped path holds 144 Hz (deg)', shipped, 0, INVARIANCE_TOLERANCE_DEGREES,
        'a rate that does not divide the substep still agrees at every instant it shares with 60 Hz' );

    gate( 'the clause REJECTS losing BOTH defences', neither > INVARIANCE_TOLERANCE_DEGREES ? 1 : 0, 1, 1,
        'RED PROOF 3 — the one the survey warned about by name, reproduced here at 3.469e-18 s' );

    gate( 'and by a real margin (x tolerance)', neither / INVARIANCE_TOLERANCE_DEGREES, 100, Infinity,
        'a whole substep of joint motion out of a difference in the last bit of a double' );

    gate( 'the remainder interpolation closes it alone (deg)', interpolationOnly, 0, INVARIANCE_TOLERANCE_DEGREES,
        '🎯 it makes the committed pose a function of simulated TIME rather than of the substep COUNT, so a ULP in the count cannot reach it' );

    // What interpolating the remainder DOES buy, measured: the staircase at a non-dividing rate.
    console.log( '' );
    console.log( '   share of frames whose committed local rotation is bit-identical to the frame before' );
    console.log( '' );

    let worstStaircase = 0;
    let worstInterpolated = 0;

    for ( const rate of [ 60, 100, 120, 144 ] ) {

        const dropped = frozenFrameShare( rate, false );
        const smoothed = frozenFrameShare( rate, true );

        if ( rate !== 60 ) worstStaircase = Math.min( worstStaircase === 0 ? 1 : worstStaircase, dropped );
        worstInterpolated = Math.max( worstInterpolated, smoothed );

        console.log( `   frozen frames at ${ rate } Hz   dropped ${ ( 100 * dropped ).toFixed( 1 ).padStart( 5 ) } %` +
            `   interpolated ${ ( 100 * smoothed ).toFixed( 1 ).padStart( 5 ) } %` );

    }

    console.log( '' );

    gate( 'dropping it staircases off-rate', worstStaircase, 0.2, 1,
        'every rate that does not divide 60 holds the same pose for whole frames at a time' );

    gate( 'interpolating it removes the staircase', worstInterpolated, 0, 0,
        'the flag exists for a 144 Hz display; it is OFF by default because at this project\'s own 60 Hz target it is a pure one-frame lag' );

    gate( 'and at 60 Hz there is nothing to interpolate', frozenFrameShare( 60, false ), 0, 0,
        'the substep IS 60 Hz, so the accumulator is empty on every frame — which is what decided the default' );

    // The epsilon, gated from both sides.
    note( 'STEP_EPSILON_SECONDS', STEP_EPSILON_SECONDS.toExponential( 3 ),
        '2 ulp per frame over 8 h at 240 Hz, derived from the accumulator arithmetic' );

    gate( 'the epsilon is a rounding, not a step', STEP_EPSILON_SECONDS / SUBSTEP_SECONDS, 0, 1e-6,
        'it must never advance a substep early by anything a viewer could see' );

    gate( 'and it is above the observed residue', STEP_EPSILON_SECONDS / worstAccumulatorResidue(), 1, Infinity,
        'the worst |accumulator| at an instant where it should be empty, over the four rates this file drives' );

    gate( 'the epsilon repairs the CLOCK too', clockDriftSubsteps( STEP_EPSILON_SECONDS ), 0, 0,
        '🎯 why the epsilon ships and interpolation is the option: interpolation repairs the POSE and leaves `simulatedSeconds` — and therefore every scheduled push — an arrears clock' );

    gate( 'and without it the clock drifts', clockDriftSubsteps( 0 ), 1, Infinity,
        'the control for the line above' );

    // ⚠️ The non-linear drive, reported as a NOTE because it is a property of the CALLER's sampling.
    note( 'a NON-linear anchor drive, 30 vs 120 Hz (deg)', curvedDriveDivergence().toExponential( 3 ),
        '⚠️ a caller sampling its own animation per frame hands two rates two different inputs; that residue is theirs, not this module\'s' );

}

/** Share of frames whose committed local rotation is bit-identical to the previous frame's. */
function frozenFrameShare( rateHz, interpolateRemainder ) {

    const rig = buildRig( [ 0.09, 0.08, 0.07 ] );
    const system = new SpringBoneSystem( { interpolateRemainder } );
    const chain = system.add( new SpringBoneChain( { name: 'smooth', bones: rig.bones } ) );

    const tip = chain.joints[ chain.joints.length - 1 ].bone;
    const previous = new Quaternion().copy( tip.quaternion );

    let frozen = 0;
    let counted = 0;

    for ( let frame = 1; frame <= rateHz * 3; frame ++ ) {

        rig.anchor.rotation.x = 0.6 * Math.sin( 2 * Math.PI * 0.8 * frame / rateHz );
        rig.anchor.updateMatrixWorld( true );
        system.update( 1 / rateHz );

        // The first second is skipped: the chain starts at rest and a pose that has not moved
        // because nothing has happened yet is not a staircase.
        if ( frame > rateHz ) {

            counted ++;
            if ( Math.abs( Math.abs( previous.dot( tip.quaternion ) ) - 1 ) < 1e-15 ) frozen ++;

        }

        previous.copy( tip.quaternion );

    }

    return frozen / counted;

}

/** How many substeps 144 Hz is behind 60 Hz after four seconds — a clock statistic, not a pose one. */
function clockDriftSubsteps( epsilon ) {

    const stepsAt = ( rate ) => {

        const rig = buildRig( [ 0.09 ] );
        const system = new SpringBoneSystem( { stepEpsilonSeconds: epsilon, interpolateRemainder: true } );
        system.add( new SpringBoneChain( { name: 'clock', bones: rig.bones } ) );

        for ( let frame = 1; frame <= rate * 4; frame ++ ) system.update( 1 / rate );

        return system.stepsTaken;

    };

    return Math.abs( stepsAt( 60 ) - stepsAt( 144 ) );

}

/**
 * The worst absolute accumulator value at an instant where it should be exactly empty, over the four
 * rates this file drives. Every one of them is a whole number of substeps at 1 s.
 */
function worstAccumulatorResidue() {

    let worst = 0;

    for ( const rate of [ 30, 60, 120, 144 ] ) {

        const rig = buildRig( [ 0.09 ] );
        const system = new SpringBoneSystem();
        system.add( new SpringBoneChain( { name: 'residue', bones: rig.bones } ) );

        for ( let frame = 1; frame <= rate * 4; frame ++ ) {

            system.update( 1 / rate );

            if ( frame % rate !== 0 ) continue;

            worst = Math.max( worst, Math.abs( system.accumulatorSeconds ) );

        }

    }

    return Math.max( worst, Number.MIN_VALUE );

}

/** The same chain driven by a raw sine sampled per frame, which is NOT linear on the shared grid. */
function curvedDriveDivergence() {

    const trace = ( rateHz ) => {

        const rig = buildRig( [ 0.09, 0.08, 0.07, 0.06 ] );
        const system = new SpringBoneSystem();
        const chain = system.add( new SpringBoneChain( { name: 'curved', bones: rig.bones } ) );

        const samples = [];

        for ( let frame = 1; frame <= 6 * rateHz; frame ++ ) {

            rig.anchor.rotation.x = 0.6 * Math.sin( 2 * Math.PI * 0.8 * frame / rateHz );
            rig.anchor.updateMatrixWorld( true );
            system.update( 1 / rateHz );

            if ( frame % ( rateHz / 30 ) !== 0 ) continue;

            for ( const joint of chain.joints ) {

                samples.push( joint.bone.quaternion.x, joint.bone.quaternion.y,
                    joint.bone.quaternion.z, joint.bone.quaternion.w );

            }

        }

        return { samples };

    };

    return worstDivergenceDegrees( trace( 30 ), trace( 120 ) );

}

// --- E. depth curves ------------------------------------------------------------------------------

function checkDepthCurves() {

    section( 'E. DEPTH-DISTRIBUTION CURVES — and the mechanism that makes them necessary' );

    // A constant curve must be exactly no curve, so the module reproduces VRM when nobody asks it
    // not to. Asserted rather than assumed.
    const plain = settledChain( {} );
    const flat = settledChain( { curves: { stiffness: 1, dragForce: 1 } } );

    let worstCurveDifference = 0;

    for ( let index = 0; index < plain.length; index ++ ) {

        worstCurveDifference = Math.max( worstCurveDifference, Math.abs( plain[ index ] - flat[ index ] ) );

    }

    gate( 'a constant curve is exactly no curve (deg)', worstCurveDifference, 0, 0,
        'no curve and a flat curve are the same code path, so a .vrm file behaves as three-vrm would' );

    const curve = new DepthCurve( [ [ 0, 1 ], [ 0.5, 0.25 ], [ 1, 0.6 ] ] );

    gate( 'curve at the root', curve.valueAt( 0 ), 1, 1, 'authored control point' );
    gate( 'curve at mid', curve.valueAt( 0.5 ), 0.25, 0.25, 'authored control point' );
    gate( 'curve interpolates linearly', curve.valueAt( 0.25 ), 0.625, 0.625, 'halfway between 1 and 0.25' );
    gate( 'curve clamps past the tip', curve.valueAt( 4 ), 0.6, 0.6, 'no extrapolation, so no negative drag' );

    let worstHullEscape = 0;

    for ( let step = 0; step <= 200; step ++ ) {

        const value = curve.valueAt( step / 200 );
        worstHullEscape = Math.max( worstHullEscape, Math.max( 0.25 - value, value - 1 ) );

    }

    gate( 'linear cannot leave its own hull', worstHullEscape, - 1, 0,
        'a spline through hand-placed points overshoots, and an overshoot here is a negative dragForce' );

    // 🎯 THE MECHANISM. On a chain of unequal segments, VRM's linear stiffness gives every joint a
    // DIFFERENT angular rate; the 'angular' mode gives them all the same one.
    console.log( '' );
    console.log( '   mode      per-joint relaxation rate S/L (rad/s)          spread' );

    const taper = [ 0.16, 0.12, 0.09, 0.07 ];

    const rates = ( mode ) => new SpringBoneChain( {
        name: 'taper', bones: buildRig( taper ).bones, stiffnessMode: mode, settings: { stiffness: 1.0 }
    } ).joints.map( ( joint ) => joint.settings.stiffness / joint.restLength );

    const linearRates = rates( 'linear' );
    const angularRates = rates( 'angular' );
    const spread = ( values ) => Math.max( ...values ) / Math.min( ...values );
    const lengthRatio = Math.max( ...taper ) / Math.min( ...taper );

    console.log( `   linear    ${ linearRates.map( ( value ) => value.toFixed( 4 ) ).join( '  ' ) }        ${ spread( linearRates ).toFixed( 4 ) }x` );
    console.log( `   angular   ${ angularRates.map( ( value ) => value.toFixed( 4 ) ).join( '  ' ) }        ${ spread( angularRates ).toFixed( 4 ) }x` );
    console.log( '' );

    gate( 'linear stiffness spreads the material', spread( linearRates ), lengthRatio - 1e-9, lengthRatio + 1e-9,
        'exactly the length ratio of the chain, which is what "stiffness is not scale-invariant" costs' );

    gate( 'angular stiffness removes the spread', spread( angularRates ), 1, 1 + 1e-12,
        '🎯 S = k*L, so one authored rad/s is one material along a chain of unequal segments' );

    // The two depth parameterisations must coincide on a chain of equal segments, and must not on a
    // tapered one — or the option would have no reason to exist.
    const equalIndex = jointStiffnesses( [ 0.1, 0.1, 0.1, 0.1 ], 'index' );
    const equalArc = jointStiffnesses( [ 0.1, 0.1, 0.1, 0.1 ], 'arc' );
    const taperIndex = jointStiffnesses( taper, 'index' );
    const taperArc = jointStiffnesses( taper, 'arc' );

    let worstEqualDifference = 0;
    let worstTaperDifference = 0;

    for ( let index = 0; index < equalIndex.length; index ++ ) {

        worstEqualDifference = Math.max( worstEqualDifference, Math.abs( equalIndex[ index ] - equalArc[ index ] ) );
        worstTaperDifference = Math.max( worstTaperDifference, Math.abs( taperIndex[ index ] - taperArc[ index ] ) );

    }

    gate( 'index and arc agree on equal segments', worstEqualDifference, 0, 1e-15,
        'both parameterisations put the root joint at 0 and the tip joint at 1, so an even chain leaves them nothing to disagree about' );

    gate( 'and differ on a tapered one', worstTaperDifference > 1e-6 ? 1 : 0, 1, 1,
        'if they never differed there would be no reason for the option to exist' );

    // 🎯 THE CURVE HAS TO REACH THE INTEGRATOR, and this is asserted as an EXACT EQUIVALENCE rather
    // than as a threshold somebody chose. A constant curve of c on a stiffness of s must produce the
    // same trajectory, bit for bit, as no curve on a stiffness of s*c — which can only be true if
    // the value the curve resolved to is the value the step function used.
    const scaled = recovery( { stiffness: 1.0 }, { stiffness: 0.35 } );
    const folded = recovery( { stiffness: 0.35 }, {} );

    let worstEquivalence = 0;

    for ( let index = 0; index < scaled.length; index ++ ) {

        worstEquivalence = Math.max( worstEquivalence, Math.abs( scaled[ index ] - folded[ index ] ) );

    }

    gate( 'a constant curve IS a scaled stiffness (deg)', worstEquivalence, 0, 0,
        'stiffness 1.0 with curve 0.35, against stiffness 0.35 with no curve — bit-identical, so the curve reached the step function' );

    // And a VARYING curve has to move the pose, joint by joint, in the direction it says. A sign
    // test rather than a magnitude: the root is pinned at curve 1.0 and must not move at all, and
    // every joint below it must hold strictly more angle.
    const uniform = recovery( { stiffness: 1.0 }, {} );
    const tipSoft = recovery( { stiffness: 1.0 }, { stiffness: new DepthCurve( [ [ 0, 1 ], [ 1, 0.1 ] ] ) } );

    note( 'uniform chain, residual after 0.5 s (deg)', uniform.map( ( angle ) => angle.toFixed( 3 ) ).join( ' / ' ),
        'released from 30 deg, equal 100 mm segments, no inertia' );
    note( 'tip-soft curve, residual after 0.5 s (deg)', tipSoft.map( ( angle ) => angle.toFixed( 3 ) ).join( ' / ' ),
        'stiffness curve 1.0 -> 0.1 over the chain' );

    let strictlySofter = 1;

    for ( let index = 1; index < uniform.length; index ++ ) {

        if ( tipSoft[ index ] <= uniform[ index ] ) strictlySofter = 0;

    }

    gate( 'every joint below the root holds more', strictlySofter, 1, 1,
        'a curve that changed a setting and not a pose would be a constant with extra steps' );

    gate( 'and the root joint is bit-identical (deg)', Math.abs( tipSoft[ 0 ] - uniform[ 0 ] ), 0, 0,
        'the curve is exactly 1.0 at depth 0, so the root must not move by a single bit' );

}

/** Per-joint residual angle 0.5 s after a 30° release, with no inertia — pure relaxation. */
function recovery( settings, curves ) {

    const rig = buildRig( [ 0.1, 0.1, 0.1, 0.1 ] );
    const system = new SpringBoneSystem();
    const chain = system.add( new SpringBoneChain( {
        name: 'recover', bones: rig.bones, settings: { dragForce: 1, ...settings }, curves
    } ) );

    release( system, rig.anchor, 30 * Math.PI / 180 );

    for ( let frame = 0; frame < 30; frame ++ ) system.update( SUBSTEP_SECONDS );

    return chain.joints.map( ( joint ) => deviationDegrees( joint ) );

}

function jointStiffnesses( segments, depthMode ) {

    return new SpringBoneChain( {
        name: 'depth', bones: buildRig( segments ).bones, depthMode,
        curves: { stiffness: new DepthCurve( [ [ 0, 1 ], [ 1, 0.2 ] ] ) }
    } ).joints.map( ( joint ) => joint.settings.stiffness );

}

function settledChain( options ) {

    const rig = buildRig( [ 0.16, 0.12, 0.09, 0.07 ] );
    const system = new SpringBoneSystem();
    const chain = system.add( new SpringBoneChain( {
        name: 'settled', bones: rig.bones, settings: { gravityPower: 3.0 }, ...options
    } ) );

    for ( let frame = 0; frame < 600; frame ++ ) system.update( SUBSTEP_SECONDS );

    return chain.joints.map( ( joint ) => deviationDegrees( joint ) );

}

// --- F. center ------------------------------------------------------------------------------------

function checkCenter() {

    section( 'F. `center` — the inertia term only, and gravity stays in world space' );

    // A rig that translates rigidly, ACROSS the chain rather than along it — a translation along the
    // bone axis cannot bend a joint whose tail is re-projected onto the length sphere, so it would
    // read as "center works" whether it did or not.
    const drive = ( useCenter ) => {

        const carrier = new Object3D();
        const rig = buildRig( [ 0.09, 0.08, 0.07 ] );

        carrier.add( rig.anchor );
        carrier.updateMatrixWorld( true );

        const system = new SpringBoneSystem();
        const chain = system.add( new SpringBoneChain( {
            name: 'centered', bones: rig.bones, center: useCenter === true ? carrier : null
        } ) );

        let worst = 0;

        for ( let frame = 1; frame <= 120; frame ++ ) {

            carrier.position.x = 1.5 * frame / 60;
            carrier.updateMatrixWorld( true );
            system.update( SUBSTEP_SECONDS );

            worst = Math.max( worst, chain.worstDeviationDegrees );

        }

        return worst;

    };

    const withCenter = drive( true );
    const withoutCenter = drive( false );

    note( 'rigid 1.5 m/s translation, center ON (deg)', withCenter.toExponential( 3 ), 'the chain rides along and does not stream' );
    note( 'rigid 1.5 m/s translation, center OFF (deg)', withoutCenter.toFixed( 3 ), 'the chain lags — this is the defect `center` exists for' );

    gate( 'center removes the translation lag (deg)', withCenter, 0, 1e-9,
        'the tails are stored in center space, so a rigid translation of that frame is invisible to the inertia term' );

    gate( 'and without it the lag is real (deg)', withoutCenter, 1, 180,
        'if the uncentred chain did not lag there would be nothing for `center` to fix' );

    // Gravity is NOT centred. VRM 1.0 spec: "External forces (gravity) are calculated in World Space
    // regardless of the `center`." A center node rolled on its side must not roll gravity with it.
    const settledTip = ( centerRoll ) => {

        const carrier = new Object3D();
        const rig = buildRig( [ 0.09, 0.08, 0.07 ] );

        carrier.add( rig.anchor );
        carrier.rotation.z = centerRoll;
        carrier.updateMatrixWorld( true );

        const system = new SpringBoneSystem();
        const chain = system.add( new SpringBoneChain( {
            name: 'gravity', bones: rig.bones, center: carrier, settings: { gravityPower: 3.0 }
        } ) );

        for ( let frame = 0; frame < 900; frame ++ ) system.update( SUBSTEP_SECONDS );

        const tip = new Vector3().copy( chain.joints[ 2 ].initialLocalChildPosition )
            .applyMatrix4( chain.joints[ 2 ].bone.matrixWorld );

        return tip;

    };

    const upright = settledTip( 0 );
    const rolled = settledTip( Math.PI / 2 );

    note( 'settled tip, center upright (m)',
        `${ upright.x.toFixed( 4 ) } ${ upright.y.toFixed( 4 ) } ${ upright.z.toFixed( 4 ) }`, 'gravityPower 3.0' );
    note( 'settled tip, center rolled 90 deg (m)',
        `${ rolled.x.toFixed( 4 ) } ${ rolled.y.toFixed( 4 ) } ${ rolled.z.toFixed( 4 ) }`, 'the chain itself is rolled with it' );

    gate( 'gravity still points down (world -Y)', rolled.y, - 10, - 0.1,
        'VRM 1.0 spec: "External forces (gravity) are calculated in World Space regardless of the `center`" — a centred gravity would have hung the rolled chain along world -X' );

    gate( 'and the rolled chain has NOT hung sideways', Math.abs( rolled.x ), 0, 0.05,
        'the control: if gravity had rotated with the center, |x| would be the chain length and y about zero' );

}

// --- G. colliders -----------------------------------------------------------------------------------

function checkColliders() {

    section( 'G. COLLIDERS — the reference arithmetic, and the residual a naive gate would fail on' );

    const node = new Object3D();
    node.position.set( 1, 0, 0 );
    node.updateMatrixWorld( true );

    const sphere = sphereCollider( { node, offset: [ 0, 0, 0 ], radius: 0.2 } );
    sphere.matrix.copy( node.matrixWorld );

    const target = new Vector3();

    gate( 'sphere distance, point outside', sphere.calculateCollision( new Vector3( 1.5, 0, 0 ), 0.05, target ),
        0.25 - 1e-12, 0.25 + 1e-12, '|p - c| - r_joint - r_sphere = 0.5 - 0.05 - 0.2' );

    gate( 'sphere distance, point inside', sphere.calculateCollision( new Vector3( 1.1, 0, 0 ), 0.05, target ),
        - 0.15 - 1e-12, - 0.15 + 1e-12, '0.1 - 0.05 - 0.2' );
    gate( 'and the direction is the outward unit', target.x, 1 - 1e-12, 1 + 1e-12, '(p - c)/|p - c|' );

    const contained = sphereCollider( { node, radius: 0.2, inside: true } );
    contained.matrix.copy( node.matrixWorld );

    gate( 'an `inside` sphere contains', contained.calculateCollision( new Vector3( 1.5, 0, 0 ), 0, target ),
        - 0.3 - 1e-12, - 0.3 + 1e-12, 'r - r_joint - |p - c| = 0.2 - 0 - 0.5' );
    gate( 'and its push points inward', target.x, - 1 - 1e-12, - 1 + 1e-12, 'the direction negates when `inside`' );

    const capsule = capsuleCollider( { node, offset: [ 0, 0, 0 ], tail: [ 0, 1, 0 ], radius: 0.1 } );
    capsule.matrix.copy( node.matrixWorld );

    gate( 'capsule, beside the shaft', capsule.calculateCollision( new Vector3( 1.4, 0.5, 0 ), 0, target ),
        0.3 - 1e-12, 0.3 + 1e-12, 'nearest point is on the shaft at y = 0.5, so 0.4 - 0.1' );
    gate( 'capsule, before the head', capsule.calculateCollision( new Vector3( 1, - 0.6, 0 ), 0, target ),
        0.5 - 1e-12, 0.5 + 1e-12, 'dot <= 0, so the head is nearest: 0.6 - 0.1' );
    gate( 'capsule, past the tail', capsule.calculateCollision( new Vector3( 1, 1.7, 0 ), 0, target ),
        0.6 - 1e-12, 0.6 + 1e-12, 'lengthSq <= dot, so the tail is nearest: 0.7 - 0.1' );

    // A chain swung THROUGH a sphere by gravity, against the same chain with the collider removed.
    // The control matters: `hair-motion.md` §8.1 records a penetration statistic that was green in
    // both arms because the mask never contained an event.
    const colliderRadius = 0.07;
    const colliderCentre = new Vector3( 0, - 0.15, 0.05 );

    const swing = ( withCollider ) => {

        const rig = buildRig( [ 0.09, 0.09, 0.09 ] );
        const skull = new Object3D();
        skull.position.copy( colliderCentre );
        skull.updateMatrixWorld( true );

        const system = new SpringBoneSystem();
        const chain = system.add( new SpringBoneChain( {
            name: withCollider === true ? 'collide' : 'free',
            bones: rig.bones,
            settings: { gravityPower: 6.0 },
            colliders: withCollider === true
                ? [ sphereCollider( { node: skull, radius: colliderRadius, name: 'skull' } ) ]
                : []
        } ) );

        const world = new Vector3();

        let worst = 0;
        let settled = 0;

        for ( let frame = 0; frame < 600; frame ++ ) {

            system.update( SUBSTEP_SECONDS );

            settled = 0;

            for ( const joint of chain.joints ) {

                world.copy( joint.initialLocalChildPosition ).applyMatrix4( joint.bone.matrixWorld );
                settled = Math.max( settled, colliderRadius - world.distanceTo( colliderCentre ) );

            }

            worst = Math.max( worst, settled );

        }

        return { worst, settled, system };

    };

    const collided = swing( true );
    const free = swing( false );

    note( 'deepest penetration over the swing, ON (mm)', ( collided.worst * 1000 ).toFixed( 3 ), 'push, then re-project onto the length sphere' );
    note( 'deepest penetration over the swing, OFF (mm)', ( free.worst * 1000 ).toFixed( 3 ), 'the same chain with the collider removed — the control' );
    note( 'settled penetration, ON (mm)', ( collided.settled * 1000 ).toFixed( 3 ), 'where the collider push and the stiffness balance' );

    gate( 'the control actually penetrates (mm)', free.worst * 1000, 1, Infinity,
        'a penetration statistic over a mask that never contained an event is green in both arms — LEARNINGS §1.14' );

    gate( 'the collider reduces peak penetration', collided.worst / free.worst, 0, 0.75,
        'against the same chain without it' );

    gate( 'and clears the settled penetration (mm)', collided.settled * 1000, 0, 1e-9,
        'the control settles 26 mm inside; with the collider the chain rests on its surface' );

    // ⚠️ THE RESIDUAL, demonstrated directly rather than as a statistic — because it is a property
    // of one step and a statistic over a swing is the wrong instrument for it. One joint, one tail
    // placed inside a collider, one step: the tail comes out at exactly the bone length from its
    // parent and NOT at exactly `r_joint + r_collider` from the collider.
    const single = buildRig( [ 0.09 ] );
    const obstacle = new Object3D();
    obstacle.position.set( 0.03, 0, 0.06 );
    obstacle.updateMatrixWorld( true );

    const oneStep = new SpringBoneSystem();
    const pushed = oneStep.add( new SpringBoneChain( {
        name: 'residual', bones: single.bones, settings: { stiffness: 0 },
        colliders: [ sphereCollider( { node: obstacle, radius: 0.04 } ) ]
    } ) );

    oneStep.update( SUBSTEP_SECONDS );

    const joint = pushed.joints[ 0 ];
    const origin = new Vector3().setFromMatrixPosition( joint.bone.matrixWorld );
    const tail = new Vector3().copy( joint.initialLocalChildPosition ).applyMatrix4( joint.bone.matrixWorld );

    const lengthError = Math.abs( tail.distanceTo( origin ) - joint.restLength );
    const contactError = Math.abs( tail.distanceTo( obstacle.position ) - 0.04 );

    note( 'after one push-then-project, |tail-parent| error (mm)', ( lengthError * 1000 ).toExponential( 2 ),
        'the LENGTH constraint is exact — it is applied last' );
    note( 'after one push-then-project, contact error (mm)', ( contactError * 1000 ).toFixed( 4 ),
        'the COLLIDER constraint is not — the re-projection slides the tail along the length sphere' );

    gate( 'the length constraint is exact (mm)', lengthError * 1000, 0, 1e-9,
        'push, then re-project onto the length sphere — the projection is the last word' );

    gate( 'and a ZERO-penetration gate would be wrong (mm)', contactError * 1000, 1e-6, Infinity,
        '⚠️ push-then-project is not push-to-contact; a residual is correct behaviour and a gate asserting 0 goes red on a working solver' );

    // The 6.7 seam, and the two counters it will be measured against.
    const system = collided.system;

    gate( 'wired collider checks', system.wiredColliderChecks, 3, 3,
        'joints x colliders, which is what VRChat\'s "Collision Check Count" statically counts' );

    gate( 'executed tests, one substep', system.colliderTestsLastFrame, 3, 3,
        'the two coincide on a one-substep frame and diverge the moment a frame runs two' );

    system.update( 2 * SUBSTEP_SECONDS );

    gate( 'executed tests scale with substeps', system.colliderTestsLastFrame, 6, 6,
        '🚩 ik-and-springbones.md §4.2: the punch-list calls the static wiring count "checks/frame"; it is not one' );

    system.colliderSelector = () => [];
    system.update( SUBSTEP_SECONDS );

    gate( 'the 6.7 seam prunes', system.colliderTestsLastFrame, 0, 0,
        '`colliderSelector` is where collider pruning goes; it is called once per joint per FRAME, not per substep' );

    gate( 'and the wiring count is unmoved by it', system.wiredColliderChecks, 3, 3,
        'the two counters answer different questions and a pruner has to be judged on both' );

}

// --- H. the antipodal singularity -------------------------------------------------------------------

function checkAntipodal() {

    section( 'H. THE ANTIPODE — the one genuine singularity, and what the survey got wrong about it' );

    /**
     * Places the joint's tail at `π − offset` from its rest axis by writing the tail directly.
     *
     * White-box on purpose. Driving it there through a rotation cannot express the EXACT antipode —
     * the rotation, the quaternion and the length projection each round — and the exact antipode is
     * the only case that is genuinely stuck, so it has to be constructed rather than approached.
     */
    const stiffness = 1.0;
    const epsilon = stiffness * SUBSTEP_SECONDS / VRM_FALLBACK_BONE_METRES;

    /**
     * Traces a joint released at `π − offset`, reporting the TAIL's own offset from the antipode
     * every substep and the offset at which the bone's quaternion stops reading exactly 180°.
     */
    const run = ( offsetRadians, seconds, escapeRadians ) => {

        const rig = buildRig( [ VRM_FALLBACK_BONE_METRES ] );
        const system = new SpringBoneSystem( { antipodalEscapeRadians: escapeRadians } );
        const chain = system.add( new SpringBoneChain( {
            name: 'folded', bones: rig.bones, settings: { stiffness, dragForce: 1 }
        } ) );

        const joint = chain.joints[ 0 ];
        const folded = new Vector3(
            0,
            VRM_FALLBACK_BONE_METRES * Math.sin( offsetRadians ),
            - VRM_FALLBACK_BONE_METRES * Math.cos( offsetRadians ) );

        joint.currentTail.copy( folded );
        joint.prevTail.copy( folded );

        const offsets = [];
        let quaternionWakesAt = NaN;

        for ( let frame = 0; frame < Math.round( seconds * 60 ); frame ++ ) {

            system.update( SUBSTEP_SECONDS );

            // The rig's rest axis is +Z and the bone sits at the anchor origin, so the tail's own
            // offset from the antipode is read straight off its direction. Reading the TAIL rather
            // than the bone is the whole point — see below.
            const offset = Math.PI - Math.acos( Math.min( Math.max(
                joint.currentTail.clone().normalize().z, - 1 ), 1 ) );

            offsets.push( offset );

            if ( Number.isNaN( quaternionWakesAt ) && Math.abs( joint.bone.quaternion.w ) > 0 ) {

                quaternionWakesAt = offset;

            }

        }

        return { offsets, quaternionWakesAt, escapes: joint.antipodalEscapes };

    };

    const exact = run( 0, 2, 0 );
    const nudged = run( 1e-6, 4, 0 );

    note( 'tail placed at exactly 180 deg, after 2 s (rad off)', exact.offsets[ exact.offsets.length - 1 ].toExponential( 3 ),
        'sin(theta) is exactly 0, so the restoring term is antiparallel to the tail and the projection undoes it' );

    gate( 'the exact antipode IS stuck (rad off)', exact.offsets[ exact.offsets.length - 1 ], 0, 0,
        'a true unstable equilibrium — and the only case in this section that is one' );

    // 🚩 THE CORRECTION. `ik-and-springbones.md` §3.5 reads a joint at π − 1e-12 as sitting "at 180°
    // forever" on the strength of a 0.2 s window. It is not stuck: the perturbation grows by exactly
    // 1/(1−ε) every substep, which falls out of the same geometry as the restoring law —
    // δ' = δ / (1 − S·Δt/L) to first order in δ.
    const growth = nudged.offsets[ 5 ] / nudged.offsets[ 4 ];
    const analyticGrowth = 1 / ( 1 - epsilon );
    const escapeSeconds = SUBSTEP_SECONDS * Math.log( 1 / 1e-12 ) / Math.log( analyticGrowth );

    note( 'measured growth per substep', growth.toFixed( 6 ),
        `analytic 1/(1 - S*dt/L) = ${ analyticGrowth.toFixed( 6 ) }, eps = ${ epsilon.toFixed( 5 ) }` );
    note( 'so escape from 1e-12 rad takes (s)', escapeSeconds.toFixed( 4 ),
        '🚩 the survey read a 0.2 s window and called it "forever"; 0.2 s is a factor of 22, which leaves 1e-12 at 2e-11' );

    gate( 'a near-antipode is NOT stuck (rad off)', nudged.offsets[ nudged.offsets.length - 1 ], 1, Math.PI,
        'only the EXACT antipode sticks; a perturbed one escapes geometrically' );

    gate( 'and it grows at exactly 1/(1-eps)', Math.abs( growth / analyticGrowth - 1 ), 0, 1e-4,
        'derived from the same length projection the restoring law comes from, and it is exact to first order in delta' );

    // ⚠️ AND THE DETECTOR HAS TO READ THE TAIL. three r185 snaps `setFromUnitVectors` to a fixed
    // half-turn whenever `vFrom·vTo + 1 < 1e-8` (`Quaternion.js:477`), i.e. within sqrt(2e-8) rad of
    // the antipode — so the BONE reads exactly 180.000000 deg while the SIMULATION is already
    // escaping. Anything watching the bone reports "stuck" for tens of substeps too long, and this
    // applies to three-vrm itself, which makes the same call.
    const snapThreshold = Math.sqrt( 2e-8 );

    note( 'the bone stops reading 180 deg at (rad off)', nudged.quaternionWakesAt.toExponential( 4 ),
        `three r185 Quaternion.js:477 snaps below r < 1e-8, i.e. within ${ snapThreshold.toExponential( 4 ) } rad` );

    gate( 'the bone quantises near the antipode', nudged.quaternionWakesAt / snapThreshold, 1, analyticGrowth,
        '⚠️ the first sample past the threshold, so it must land within ONE growth step of it — which is what identifies the cause as three\'s epsilon and not a coincidence' );

    const guarded = run( 0, 2, 0.05 );

    gate( 'the guard is off by default', exact.escapes, 0, 0,
        'a nudge is state a capture has to reproduce, so it is opt-in and deterministic when opted into' );

    gate( 'and when asked for, it fires', guarded.escapes, 1, Infinity,
        'counted per joint, so a caller can tell a rescued chain from one that never needed rescuing' );

    gate( 'and it un-sticks the exact antipode', guarded.offsets[ guarded.offsets.length - 1 ], 1, Math.PI,
        'antipodalEscapeRadians 0.05, applied to the TAIL — which is why it works where a bone-reading guard would not' );

}

// --- I. drag ----------------------------------------------------------------------------------------

function checkDrag() {

    section( 'I. DRAG — the punch-list\'s own 0.05 is the value the fixed timestep matters most for' );

    console.log( '' );
    console.log( '    drag   half-life (frames)      30 Hz       60 Hz      120 Hz' );

    let worstHalfLifeError = 0;

    for ( const drag of [ 0.05, 0.4, 0.5 ] ) {

        const analytic = Math.log( 0.5 ) / Math.log( 1 - drag );
        const measured = measureHalfLifeFrames( drag );

        worstHalfLifeError = Math.max( worstHalfLifeError, Math.abs( measured / analytic - 1 ) );

        console.log( `  ${ drag.toFixed( 2 ).padStart( 6 ) }   ${ analytic.toFixed( 4 ).padStart( 17 ) }` +
            `  ${ ( 1000 * analytic / 30 ).toFixed( 2 ).padStart( 9 ) }ms  ${ ( 1000 * analytic / 60 ).toFixed( 2 ).padStart( 8 ) }ms` +
            `  ${ ( 1000 * analytic / 120 ).toFixed( 2 ).padStart( 8 ) }ms` );

    }

    console.log( '' );

    gate( 'retained velocity decays in FRAMES', worstHalfLifeError, 0, 0.05,
        'ln(0.5)/ln(1-drag) frames, measured off the implementation — which is why the wall-clock ring-down is a function of the rate' );

    // The punch-list's own starting parameters against three-vrm's, on the SAME defective build.
    const divergenceAt = ( settings, systemOptions ) => {

        const traces = INVARIANCE_RATES.map( ( rate ) => traceAtRate( rate, {
            systemOptions, chainSettings: settings, seconds: 8 } ) );

        return Math.max( ...traces.map( ( trace ) => worstDivergenceDegrees( trace, traces[ 1 ] ) ) );

    };

    const softTissue = { stiffness: SOFT_TISSUE_SETTINGS.stiffness, dragForce: SOFT_TISSUE_SETTINGS.dragForce };
    const vrmDefault = { stiffness: SPRING_BONE_DEFAULTS.stiffness, dragForce: SPRING_BONE_DEFAULTS.dragForce };

    const softCoupled = divergenceAt( softTissue, { perFrameStep: true } );
    const vrmCoupled = divergenceAt( vrmDefault, { perFrameStep: true } );

    note( 'per-frame divergence at drag 0.05 (deg)', softCoupled.toFixed( 3 ),
        'punch-list 6.6\'s stated start — which is the Bust row of affect-and-animation.md:738, and [U]' );
    note( 'per-frame divergence at drag 0.40 (deg)', vrmCoupled.toFixed( 3 ),
        'three-vrm\'s own default, [V] against the constructor' );

    gate( 'the punch-list\'s own start is the worst case', softCoupled / vrmCoupled, 1, Infinity,
        '🎯 6.6\'s starting numbers are the strongest argument for 6.6\'s own fixed timestep' );

    gate( 'and the fixed step holds it anyway (deg)', divergenceAt( softTissue, {} ), 0, INVARIANCE_TOLERANCE_DEGREES,
        'the soft-tissue parameters at 30/60/120 Hz on the shipped path' );

}

/**
 * The half-life of the retained per-step displacement, measured off the implementation rather than
 * asserted from the formula: one impulse, then the ratio of successive tail displacements.
 *
 * Stiffness 0 leaves the length projection as the only non-linearity, and the decay is read early
 * while the tail is still near where the impulse put it.
 */
function measureHalfLifeFrames( drag ) {

    const rig = buildRig( [ VRM_FALLBACK_BONE_METRES ] );
    const system = new SpringBoneSystem();
    const chain = system.add( new SpringBoneChain( {
        name: 'drag', bones: rig.bones, settings: { stiffness: 0, dragForce: drag }
    } ) );

    // A SMALL impulse on purpose: the tail rides the length sphere, so a step big enough to swing it
    // through a large angle measures the projection's curvature rather than the drag. 0.02 m/s is
    // 0.33 mm a step on a 70 mm bone — 0.27 degrees, where the chord and the arc agree to 1e-5.
    chain.push( [ 0, 0.02, 0 ], 0 );

    const joint = chain.joints[ 0 ];
    const displacements = [];

    for ( let frame = 0; frame < 20; frame ++ ) {

        system.update( SUBSTEP_SECONDS );
        displacements.push( joint.currentTail.distanceTo( joint.prevTail ) );

    }

    const spanFrames = 4;

    return spanFrames * Math.log( 0.5 ) / Math.log( displacements[ 1 + spanFrames ] / displacements[ 1 ] );

}

// --- J. determinism ---------------------------------------------------------------------------------

function checkDeterminism() {

    section( 'J. DETERMINISM — two runs of the same input, bit for bit' );

    const first = traceAtRate( 60, { seconds: 5 } );
    const second = traceAtRate( 60, { seconds: 5 } );

    let identical = 1;

    for ( let index = 0; index < first.samples.length; index ++ ) {

        if ( first.samples[ index ] !== second.samples[ index ] ) identical = 0;

    }

    gate( 'two runs are bit-identical', identical, 1, 1,
        'no random draw and no wall clock: the state after N updates is a pure function of the deltas and the transforms' );

    // reset() must return the system to exactly its start, or a second critic run diverges from the
    // first — MotionStack.reset's own lesson, one module over.
    const rig = buildRig( [ 0.09, 0.08, 0.07 ] );
    const system = new SpringBoneSystem();
    const chain = system.add( new SpringBoneChain( { name: 'rewound', bones: rig.bones } ) );

    chain.push( [ 0, 0, 1.5 ], 0.25 );
    for ( let frame = 0; frame < 120; frame ++ ) system.update( SUBSTEP_SECONDS );

    const afterFirst = new Quaternion().copy( chain.joints[ 0 ].bone.quaternion );

    system.reset();
    chain.push( [ 0, 0, 1.5 ], 0.25 );
    for ( let frame = 0; frame < 120; frame ++ ) system.update( SUBSTEP_SECONDS );

    gate( 'reset() rewinds to the start',
        Math.abs( 1 - Math.abs( afterFirst.dot( chain.joints[ 0 ].bone.quaternion ) ) ), 0, 1e-15,
        'the accumulator, the clock, the tails, the poses and the pending pushes all have to be rewound, not just one of them' );

    console.log( '' );
    console.log( system.describe() );

}

// --- reporting ---------------------------------------------------------------------------------------

function section( title ) {

    console.log( `\n${ title }\n${ '-'.repeat( title.length ) }` );

}

function gate( label, value, low, high, source ) {

    const passed = value >= low && value <= high;

    results.push( { label, passed } );

    const range = high - low < 1e-12 ? `= ${ low }` : `${ format( low ) } .. ${ format( high ) }`;

    console.log(
        `  ${ passed ? 'PASS' : 'FAIL' }  ${ label.padEnd( 42 ) } ${ format( value ).padStart( 12 ) }` +
        `   target ${ range.padEnd( 18 ) } ${ source }`
    );

}

function note( label, value, source ) {

    console.log( `  ....  ${ label.padEnd( 42 ) } ${ String( value ).padStart( 12 ) }   ${ source }` );

}

function format( value ) {

    if ( value === 0 ) return '0';
    if ( value === Infinity ) return 'inf';
    if ( value === - Infinity ) return '-inf';
    if ( Number.isNaN( value ) ) return 'NaN';
    if ( Math.abs( value ) < 1e-3 || Math.abs( value ) > 1e6 ) return value.toExponential( 2 );

    return value.toFixed( 4 );

}

function report() {

    const failed = results.filter( ( result ) => result.passed === false );

    console.log( `\n${ results.length - failed.length }/${ results.length } gates passed` );

    if ( failed.length > 0 ) {

        console.log( 'FAILED:' );
        for ( const result of failed ) console.log( `  - ${ result.label }` );

        process.exitCode = 1;

    }

    console.log( '' );

}
