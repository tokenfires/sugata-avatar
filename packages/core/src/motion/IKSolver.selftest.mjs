/**
 * Gate for `packages/core/src/motion/IKSolver.js` — punch-list 6.5, and the thing 6.2(a) is
 * blocked on.
 *
 * 🎯 GATED BY ARITHMETIC FIRST, ON PURPOSE, AND THAT IS THE WHOLE DESIGN OF THIS FILE.
 *
 * An IK solver is the easiest thing in a motion stack to check wrongly. It produces two
 * quaternions; the natural way to check them is to apply them and see whether the end joint
 * landed on the target — and a solver with the knee bending the wrong way, the hip swung from the
 * wrong pose, or the plane spun a hundred and eighty degrees still lands the end joint on the
 * target. Every one of those is a leg that reaches the floor with its knee pointing backwards.
 *
 * So the first section is a chain whose answer is known before any code runs. A 3-4-5 triangle has
 * a right angle at the knee — `cos β = (9 + 16 − 25) / 24 = 0` — and no implementation bug can
 * agree with 90.000000° by accident. `docs/LEARNINGS.md` §1.1: a gate that has never failed is not
 * known to work, so every clause below carries a RED PROOF that reintroduces the defect it exists
 * to catch and asserts the clause goes red on it. The red proofs are built out of the shipped
 * solver's own exported primitives wherever possible, so a red proof cannot drift away from the
 * thing it is proving.
 *
 * ## The sections, and the ONE defect each clause is rejected by
 *
 *   | § | clause                          | red proof                                            |
 *   |---|---------------------------------|------------------------------------------------------|
 *   | 1 | the law of cosines is right     | 3-4-5's right angle, computed before the solver ran   |
 *   | 1 | every degenerate branch finite  | the same expression unclamped → NaN / Infinity        |
 *   | 1 | the end joint lands on target   | hip swung from the PRE-knee chain → 3685 mm miss      |
 *   | 1 | the knee lands on the right side| the bent-side test dropped → 1497 mm of chain error   |
 *   | 1 | space-agnostic                  | the chain-space rotation compared instead → 78.7°     |
 *   | 1 | a >180° blend takes the short way| the w-positive fixup dropped → 0.5 overshoots 1.0     |
 *   | 1 | soften matches ozz on both sides| the `ds > 0` guard dropped → the default softens      |
 *   | 2 | the hinge comes from the pose   | derived at 0.5° of flexion → 13.6× the axis jitter    |
 *   | 2 | the pole is conditioned         | ozz's own +Y default on a standing leg → 51× the swing|
 *   | 3 | on stilts, in millimetres       | a straight leg AND this rig's actual rest pose        |
 *   | 4 | the ankles stay planted         | the knee bent with the root held → 10.8 / 93.5 mm     |
 *   | 4 | the lowest foot decides         | the MEAN of the two travels → a foot floats 18.5 mm   |
 *   | 4 | travel happens BEFORE the solve | solve then translate → the ankle misses by the travel |
 *   | 4 | ray/sphere, not a subtraction   | `wanted − current` → 25 µm at 3.89° of leg tilt       |
 *   | 5 | it composes through MotionStack | the chain-space rotation as the delta → 9.9 mm        |
 *   | 5 | the root offset is reframed     | the raw rig-space drop into `offsetBone` → 10.8 mm    |
 *   |   |                                 |   of pelvis, forwards instead of down                 |
 *   | 6 | frame-rate invariant            | a per-frame ease → 2.43° between 30 Hz and 120 Hz     |
 *
 * ⚠️ EVERY ROW ABOVE WAS RUN AS A MUTATION, NOT ASSUMED. Twelve defects were reintroduced into
 * `IKSolver.js` one at a time and the suite re-run against each; all twelve go red, and the file
 * was restored byte-identically (same SHA-256) afterwards. One of them — the `w`-positive fixup —
 * survived the first pass and §1.12's last two clauses exist because of it: at weight 1 the fixup
 * changes nothing observable, so nothing but a >180° correction blended at a partial weight can
 * see it. A red proof written from the defect list alone would have missed it.
 *
 * ## What is NOT gated here, so its absence is not read as a clean bill
 *
 * **How far to bend the knee.** `ExpressionMap.js` prescribes `kneeActivation: 1.77` for fear and
 * nothing in `docs/research/` says what 1.0 is in degrees — Coulson Table 1 has six columns and
 * none is a knee. Every angle below is a probe, not a prescription.
 *
 * **Where the foot points.** ozz's `foot_ik` recipe has a seventh step, an aim solve that puts the
 * sole on the floor. §4 holds the ankles still so the soles stay flat by construction; the moment
 * a caller supplies its own `ankleTarget` — which §4.3 does, deliberately — the sole's orientation
 * is unmanaged and this file does not measure it.
 *
 * **The picture.** Whether a 20° knee bend reads as fear is for a pair of eyes.
 *
 * Usage:  node "packages/core/src/motion/IKSolver.selftest.mjs"
 *         node "packages/core/src/motion/IKSolver.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here looks at a
// pixel, so the two smallest possible stubs get the loader as far as the skin data. Same trick,
// same reason, as `MotionStack.selftest.mjs` and `bodymass.selftest.mjs`.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Matrix4, Quaternion, Vector3 } = await import( 'three' );

const {
    IK_BRANCH, IK_DEGENERATE, PlantedKneeBendPlan, TwoBoneSetup, TwoBoneSolution,
    chainLengthAtFlexion, flexionAtChainLength, isTravelLimited, planPlantedKneeBend,
    rootTravelForChainLength, solveTwoBone, toBoneOffsetFrame
} = await import( './IKSolver.js' );

const { Layer } = await import( './Layer.js' );
const { MOTION_ORDER, MotionStack, createMotionTarget } = await import( './MotionStack.js' );
const { restRotationRelativeToRig } = await import( './Breath.js' );
const { Figure } = await import( '../figure/Figure.js' );
const { HUMANOID_TO_FIGURE_BONE, Skeleton } = await import( '../figure/Skeleton.js' );
const { RestPose } = await import( '../figure/RestPose.js' );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const REPOSITORY_ROOT = path.resolve( HERE, '../../../..' );

const FIGURE_PATH = process.argv[ 2 ]
    ? path.resolve( process.cwd(), process.argv[ 2 ] )
    : path.join( REPOSITORY_ROOT, 'assets/figures/figure_g050.glb' );

const DEGREES = 180 / Math.PI;

/**
 * The repo's own full-body framing constant: 1200 px over a 1825.4 mm frame, printed by
 * `idle-motion.selftest.mjs` and recorded in LEARNINGS §1.10a. Written as the division rather than
 * as 0.6574 so the two numbers it comes from stay visible.
 */
const PIXELS_PER_MM = 1200 / 1825.4;

/**
 * 🚩 THE VISIBILITY BRACKET, NOT A FLOOR. LEARNINGS §1.14a audited this project's 1.6 px
 * indistinguishability floor and found it quoted out of a superseded block, internally
 * inconsistent by 1.85×, and never a threshold measurement: *"the honest statement is a bracket,
 * 0.48 px to 10.6 px — a factor of 22 — and 1.6 px is a point inside it with no measurement behind
 * it."* Both ends are blind-judge anchors with provenance. The stilts section reports the crossover
 * at all three and gates on none of them, because gating on 1.6 px would be gating on nothing.
 */
const VISIBILITY_BRACKET_PIXELS = [ 0.48, 1.6, 10.6 ];

/**
 * How far an ankle that is supposed to be planted may move, in metres.
 *
 * Not a taste value: it is one float32 ULP at metre scale, which is the precision the joint
 * positions arrive from the glTF accessors with. A solve that plants the foot to better than the
 * asset can express the foot's position is planted. Measured below at ~1e-16 — the solve is
 * float64 arithmetic over float32 inputs — so this leaves nine orders of magnitude of headroom and
 * is still a floor with a source rather than a number that happened to pass.
 */
const PLANTED_TOLERANCE_METRES = Math.fround( 1 + 2 ** -23 ) - 1;

/** Radians. Used where an angle is required to be exact rather than merely close. */
const EXACT_ANGLE_TOLERANCE = 1e-12;

const checks = [];
const notes = [];

// ================================================================================================
// The figure, and the rig facts every section from 2 onward is about.
//
// ⚠️ TRAP (a) FROM THE PUNCH-LIST: `createMotionTarget` SNAPSHOTS the scene graph at call time and
// has no invalidate (`MotionStack.js:754-777`). It is built once, here, after the rest pose has
// been applied and the world matrices are current — which is also the state `MotionStack.bind()`
// captures as rest.
// ================================================================================================

const bytes = fs.readFileSync( FIGURE_PATH );
const figure = await Figure.parse( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

const skeleton = new Skeleton( figure.root );
const absentBones = RestPose.load( 'relaxed-standing' ).applyTo( skeleton );

if ( absentBones.length > 0 ) console.warn( `relaxed-standing: this figure has no ${ absentBones.join( ', ' ) }` );

skeleton.update();
figure.root.updateMatrixWorld( true );

const motionTarget = createMotionTarget( figure.root );

const LEGS = [
    { key: 'left', hip: 'leftUpperLeg', knee: 'leftLowerLeg', ankle: 'leftFoot' },
    { key: 'right', hip: 'rightUpperLeg', knee: 'rightLowerLeg', ankle: 'rightFoot' }
];

/**
 * 🚩 THE SHIPPED RIG IS NOT A RIGID CHAIN, AND THIS IS THE MEASUREMENT THAT SAYS BY HOW MUCH.
 *
 * Every two-bone solver models a skeleton as rotations and fixed lengths — `TwoBoneSetup.readChain`
 * decomposes the joint matrices and DISCARDS the scale, and says so. `figure_g050` does not oblige:
 * **36 of its 53 bones carry non-unit scale**, worst on `thigh_l` and `thigh_r` at 3.9339e-6 off
 * unity with 3.6955e-6 of ANISOTROPY between axes — float32 quantisation of the GLB's node TRS,
 * baked in by the exporter. A non-uniform parent scale means a child's world offset is not a pure
 * rotation of its local offset, so a rigid-chain model and the real skeleton disagree no matter how
 * exact the arithmetic is.
 *
 * So §5's tolerance is that disagreement, measured off this bake at load and multiplied by the leg
 * it acts over. It is a property of the ASSET, not of the solver, and it is derived here rather
 * than typed so that a cleaner bake tightens the gate automatically. Measured: bound 3.155e-3 mm,
 * realised 3.19e-4 mm — the solve sits an order of magnitude inside the rig's own non-rigidity.
 *
 * ⚠️ §1–§4 do NOT use it. They compare a rigid model against a rigid model and hold to
 * `PLANTED_TOLERANCE_METRES`, which is 375× tighter. Only the clauses that go through real bones
 * pay this.
 */
const worstBoneScaleDeviation = measureWorstBoneScaleDeviation();
const RIGID_CHAIN_TOLERANCE_METRES = worstBoneScaleDeviation * 0.802038;

// ================================================================================================
// 1. ARITHMETIC — chains whose answers are known before any code runs
// ================================================================================================

/**
 * 🎯 THE ORACLE. Segments of 3 and 4, target at 5: `cos β = (9 + 16 − 25) / (2·3·4) = 0`, so the
 * interior angle at the knee is exactly 90° and the swing at the hip is
 * `acos( (9 + 25 − 16) / (2·3·5) ) = acos( 0.6 ) = 53.130102°`. Both are arithmetic on paper, not
 * a reading off the implementation, so an implementation bug cannot agree with them.
 */
function measureThreeFourFive() {

    const setup = planarChain( 3, 4, 0.4 );
    setup.targetPosition.set( 5, 0, 0 );

    const solution = solveTwoBone( setup );

    checkClose( '1.1  3-4-5: interior angle at the knee', solution.interiorRadians * DEGREES, 90,
        EXACT_ANGLE_TOLERANCE * DEGREES, 'law of cosines: (9 + 16 − 25) / 24 = 0' );

    checkClose( '1.1  3-4-5: knee flexion', solution.flexionRadians * DEGREES, 90,
        EXACT_ANGLE_TOLERANCE * DEGREES, 'flexion is π − interior' );

    const solved = applySolution( setup, solution );

    checkClose( '1.2  3-4-5: end joint lands on the target', solved.end.distanceTo( setup.targetPosition ), 0,
        1e-12, 'metres' );

    // 🎯 THE SECOND HALF OF THE ORACLE. With the end joint on the target, the triangle is closed:
    // |AB| = 3, |BT| = 4, |AT| = 5, so the angle at A between A→B and A→T is
    // acos( (9 + 25 − 16) / 30 ) = acos( 0.6 ) = 53.130102°. That is the hip's share of the answer,
    // and it is a different number from the knee's — so an implementation that got one from the
    // other cannot satisfy both.
    checkClose( '1.2  3-4-5: the knee sits at acos(0.6) off the hip→target line',
        angleBetween( solved.start, solved.mid, setup.targetPosition ) * DEGREES, 53.13010235415598, 1e-9,
        'the angle at A in the closed 3-4-5 triangle' );

    // Before the solve the chain ran straight along +X at the target, so the whole 53.130102° is
    // the swing the hip had to make. Stated so the reader can see the correction was not zero.
    const before = angleBetween( setup.startPosition, setup.midPosition, setup.targetPosition );
    checkClose( '1.2  3-4-5: …and it started on that line, so the swing was the whole angle',
        before * DEGREES, 0, 1e-12, 'the pre-solve chain runs along +X toward the target' );

    check( '1.3  3-4-5: reached', solution.reached === true,
        `branch ${ solution.branch }, d ${ solution.targetDistance }` );

}

/**
 * The four degenerate cases §1.3 of the research doc names, plus the fifth it does not: a pole
 * parallel to the start→target axis. Every one is red-proved by the SAME expression with the guard
 * removed, so the proof cannot drift from the thing it proves.
 */
function measureDegenerateBranches() {

    const upper = 394.707, lower = 407.331;           // millimetres, this rig, measured in §4
    const reach = upper + lower;
    const inner = Math.abs( upper - lower );

    // (a) BEYOND REACH. The failure is at the boundary, not at "obviously too far": one micron
    // past reach the unclamped cosine is already below −1.
    for ( const distance of [ reach + 1e-6, reach + 100, 900 ] ) {

        const solution = solveAtDistance( upper, lower, distance );

        check( `1.4  beyond reach d=${ distance.toFixed( 6 ) }: finite`, isFiniteSolution( solution ),
            `interior ${ ( solution.interiorRadians * DEGREES ).toFixed( 4 ) }°` );

        checkClose( `1.4  beyond reach d=${ distance.toFixed( 6 ) }: chain straightens`,
            solution.interiorRadians * DEGREES, 180, 1e-9, 'the chain can do no better than straight' );

        check( `1.4  beyond reach d=${ distance.toFixed( 6 ) }: reached is false`,
            solution.reached === false && solution.branch === IK_BRANCH.BEYOND_REACH, solution.branch );

    }

    const unclampedAtBoundary = Math.acos( kneeCosine( upper, lower, reach + 1e-6 ) );
    check( '1.4  RED PROOF — the same cosine unclamped is NaN one micron past reach',
        Number.isNaN( unclampedAtBoundary ),
        `acos( ${ kneeCosine( upper, lower, reach + 1e-6 ).toFixed( 12 ) } ) = ${ unclampedAtBoundary }` );

    // (b) INSIDE THE INNER RADIUS — a 12.6 mm sphere around the hip on this rig.
    for ( const distance of [ inner - 1e-6, 10, 1 ] ) {

        const solution = solveAtDistance( upper, lower, distance );

        check( `1.5  inside inner radius d=${ distance }: finite`, isFiniteSolution( solution ),
            `interior ${ ( solution.interiorRadians * DEGREES ).toFixed( 4 ) }°` );

        checkClose( `1.5  inside inner radius d=${ distance }: chain folds flat`,
            solution.interiorRadians * DEGREES, 0, 1e-9, '' );

        check( `1.5  inside inner radius d=${ distance }: reached is false`,
            solution.reached === false && solution.branch === IK_BRANCH.INSIDE_INNER_RADIUS, solution.branch );

    }

    check( '1.5  RED PROOF — the same cosine unclamped is NaN inside the inner radius',
        Number.isNaN( Math.acos( kneeCosine( upper, lower, 10 ) ) ),
        `cos β = ${ kneeCosine( upper, lower, 10 ).toFixed( 9 ) }` );

    note( 'inner radius on this rig', `${ inner.toFixed( 3 ) } mm — a sphere about a fingertip wide around the hip` );

    // (d) TARGET AT THE START JOINT. `d` is the DENOMINATOR of the hip cosine, so this needs a
    // branch and not a clamp — which is exactly what the research doc says and what the red proof
    // below demonstrates.
    const atStart = solveAtDistance( upper, lower, 0 );

    check( '1.6  target at the start joint: finite', isFiniteSolution( atStart ), '' );
    check( '1.6  target at the start joint: reports its own degeneracy',
        atStart.degenerate === IK_DEGENERATE.TARGET_AT_START, String( atStart.degenerate ) );
    checkClose( '1.6  target at the start joint: the knee still folds as far as it goes',
        atStart.interiorRadians * DEGREES, 0, 1e-9, '' );

    const hipCosineAtZero = ( upper * upper + 0 - lower * lower ) / ( 2 * upper * 0 );
    check( '1.6  RED PROOF — the hip cosine is ±Infinity at d = 0, so a clamp is not enough',
        Number.isFinite( hipCosineAtZero ) === false, `cos α = ${ hipCosineAtZero }` );

    // (c) ZERO-LENGTH SEGMENT. ozz's answer is structural: an uninvertible joint matrix yields the
    // identity correction. A limb that cannot be solved must contribute nothing.
    for ( const [ label, upperLength, lowerLength ] of [ [ 'upper', 0, 4 ], [ 'lower', 3, 0 ], [ 'both', 0, 0 ] ] ) {

        const setup = planarChain( upperLength, lowerLength, 0.4 );
        setup.targetPosition.set( 2, 1, 0 );

        const solution = solveTwoBone( setup );

        check( `1.7  zero ${ label } segment: identity corrections, not NaN`,
            isIdentity( solution.startCorrection ) && isIdentity( solution.midCorrection )
            && solution.degenerate === IK_DEGENERATE.ZERO_SEGMENT,
            `degenerate ${ solution.degenerate }` );

    }

    check( '1.7  RED PROOF — the same cosine with a zero segment is NaN',
        Number.isNaN( Math.acos( kneeCosine( 0, 4, 2 ) ) ),
        `(0 + 16 − 4) / 0 = ${ kneeCosine( 0, 4, 2 ) }` );

    // 🚩 THE FIFTH CASE, WHICH THE SURVEY DOES NOT NAME AND ozz's OWN DEFAULT WALKS INTO.
    const aligned = planarChain( 3, 4, 0.4 );
    aligned.targetPosition.set( 5, 0, 0 );
    aligned.poleVector.set( 1, 0, 0 );  // exactly along start→target

    const alignedSolution = solveTwoBone( aligned );

    check( '1.8  pole parallel to start→target: finite', isFiniteSolution( alignedSolution ),
        `poleConditioning ${ alignedSolution.poleConditioning.toExponential( 2 ) }` );
    check( '1.8  pole parallel to start→target: reports its own degeneracy',
        alignedSolution.degenerate === IK_DEGENERATE.POLE_ALIGNED, String( alignedSolution.degenerate ) );

    const alignedSolved = applySolution( aligned, alignedSolution );
    checkClose( '1.8  pole parallel: the end joint still lands on the target',
        alignedSolved.end.distanceTo( aligned.targetPosition ), 0, 1e-12,
        'the plane rotation is skipped; the swing is not' );

    // The red proof is the division a naive port writes: normalise the reference plane normal.
    const zeroNormal = new Vector3().crossVectors( new Vector3( 1, 0, 0 ), new Vector3( 1, 0, 0 ) );
    const naiveNormalised = zeroNormal.clone().divideScalar( zeroNormal.length() );
    check( '1.8  RED PROOF — normalising the zero plane normal gives NaN',
        Number.isNaN( naiveNormalised.x ), `${ naiveNormalised.toArray().join( ', ' ) }` );

}

/**
 * 🎯 THE ORDERING CLAUSE. ozz builds the hip's swing from the chain the KNEE CORRECTION HAS
 * ALREADY BEEN APPLIED TO (`ik_two_bone_job.cc:235-239`). Reversing the two reaches the target
 * with the wrong knee angle — or, stated as something measurable, misses the target.
 *
 * The red proof is built from the shipped solver's own output: take its knee correction, and swing
 * the hip from the PRE-correction chain direction instead of the post-correction one.
 */
function measureAssemblyOrder() {

    let worstCorrect = 0;
    let worstReversed = 0;

    const setup = new TwoBoneSetup();
    const solution = new TwoBoneSolution();

    // A deterministic sweep rather than a random one: 400 targets over the reachable annulus, at
    // angles and distances chosen so the chain has to swing, fold and unfold.
    for ( let index = 0; index < 400; index ++ ) {

        planarChain( 3, 4, 0.4, setup );

        const fraction = ( index + 0.5 ) / 400;
        const distance = 1.5 + fraction * 5.4;                 // inner radius 1, reach 7
        const azimuth = fraction * Math.PI * 4;
        const elevation = ( fraction - 0.5 ) * Math.PI * 1.2;

        setup.targetPosition.set(
            distance * Math.cos( elevation ) * Math.cos( azimuth ),
            distance * Math.cos( elevation ) * Math.sin( azimuth ),
            distance * Math.sin( elevation )
        );

        solveTwoBone( setup, solution );

        if ( solution.reached === false ) continue;

        const correct = applySolution( setup, solution );
        worstCorrect = Math.max( worstCorrect, correct.end.distanceTo( setup.targetPosition ) );

        const reversed = applyReversedOrder( setup, solution );
        worstReversed = Math.max( worstReversed, reversed.end.distanceTo( setup.targetPosition ) );

    }

    checkClose( '1.9  400 reachable targets: the end joint lands on every one', worstCorrect, 0, 1e-12,
        'worst residual, metres' );

    check( '1.9  RED PROOF — the hip swung from the PRE-knee chain misses',
        worstReversed > 1e-3, `worst miss ${ ( worstReversed * 1000 ).toFixed( 3 ) } mm against ${ ( worstCorrect * 1e9 ).toFixed( 3 ) } nm correct` );

}

/**
 * 🚩 THE SIGN TEST. `acos` returns [0, π] and cannot tell a knee bent forwards from one bent
 * backwards, so without the bent-side test a chain that is already inverted is "corrected" to the
 * right number on the wrong side and stays inverted forever.
 *
 * Measured as a scalar rather than described: after the knee correction alone, the hip→ankle
 * distance must equal the distance the solve aimed at. With the sign dropped it does not.
 */
function measureBentSide() {

    for ( const bendSign of [ +1, -1 ] ) {

        const setup = planarChain( 3, 4, 0.4 * bendSign );
        setup.targetPosition.set( 5, 0, 0 );

        const solution = solveTwoBone( setup );

        const withSign = chainLengthAfterMidDelta( setup, solution.midDeltaRadians );

        checkClose( `1.10 bend ${ bendSign > 0 ? 'with' : 'against' } the hinge: the knee alone reaches the solve distance`,
            withSign, solution.solveDistance, 1e-12, 'metres' );

        // The defect: the initial angle taken as unsigned, which is what dropping the test does.
        const unsignedInitial = Math.abs( solution.interiorRadians - solution.midDeltaRadians );
        const withoutSign = chainLengthAfterMidDelta( setup, solution.interiorRadians - unsignedInitial );
        const error = Math.abs( withoutSign - solution.solveDistance );

        if ( bendSign < 0 ) {

            check( '1.10 RED PROOF — dropping the bent-side test leaves the chain the wrong length',
                error > 1e-3, `${ ( error * 1000 ).toFixed( 3 ) } mm off the ${ ( solution.solveDistance * 1000 ).toFixed( 3 ) } mm it aimed at` );

        } else {

            check( '1.10 …and on the correctly-bent side the test is a no-op, so it cannot be the thing passing',
                error < 1e-12, `${ error.toExponential( 2 ) } m` );

        }

    }

}

/**
 * The solve must not care which space it is handed, as long as it is handed ONE. Both
 * `startRotation` and the chain-space rotation transform by the same left-multiplication, and it
 * cancels in the conjugation that produces the local correction — so the corrections come out
 * identical. This is the clause that lets a caller pass `bone.matrixWorld` without thinking.
 */
function measureSpaceInvariance() {

    const rigSpace = planarChain( 3, 4, 0.4 );
    rigSpace.targetPosition.set( 4.2, 1.5, -0.6 );
    rigSpace.poleVector.set( 0, 0, 1 );

    const rigSolution = solveTwoBone( rigSpace );

    // An arbitrary rigid transform standing in for "the character has been moved and turned".
    const shift = new Vector3( -7.3, 2.9, 11.1 );
    const turn = new Quaternion().setFromAxisAngle( new Vector3( 0.3, -0.8, 0.5 ).normalize(), 1.234 );

    const worldSpace = new TwoBoneSetup().copy( rigSpace );

    for ( const key of [ 'startPosition', 'midPosition', 'endPosition', 'targetPosition' ] ) {

        worldSpace[ key ].applyQuaternion( turn ).add( shift );

    }

    worldSpace.startRotation.premultiply( turn );
    worldSpace.midRotation.premultiply( turn );
    worldSpace.poleVector.applyQuaternion( turn );

    const worldSolution = solveTwoBone( worldSpace );

    // ⚠️ COMPARED COMPONENT BY COMPONENT, NOT AS AN ANGLE, and that is not a convenience. Near
    // identity `2·acos(dot)` amplifies: a dot 1.5e-13 short of 1 reads as 1.1e-6 rad, because
    // `acos(1−ε) ≈ √(2ε)`. Asserting on the angle would put a √ between the defect and the gate.
    // LEARNINGS §1.14 — a floor and a measurement must be the same KIND of statistic.
    checkClose( '1.11 the start correction is the same in world space as in rig space',
        quaternionComponentDifference( rigSolution.startCorrection, worldSolution.startCorrection ), 0, 1e-12,
        'worst component' );

    checkClose( '1.11 the mid correction is the same in world space as in rig space',
        quaternionComponentDifference( rigSolution.midCorrection, worldSolution.midCorrection ), 0, 1e-12,
        'worst component' );

    check( '1.11 RED PROOF — the CHAIN-SPACE rotation is not, which is why it is not the output',
        quaternionComponentDifference( rigSolution.startCorrectionInChainSpace,
            worldSolution.startCorrectionInChainSpace ) > 0.01,
        `${ ( quaternionAngleBetween( rigSolution.startCorrectionInChainSpace, worldSolution.startCorrectionInChainSpace ) * DEGREES ).toFixed( 3 ) }° apart` );

}

/** ozz's weight blend and soften band, both matched to the primary and both measured. */
function measureWeightAndSoften() {

    const setup = planarChain( 3, 4, 0.4 );
    setup.targetPosition.set( 4.2, 1.5, -0.6 );

    setup.weight = 0;
    const none = solveTwoBone( setup );

    check( '1.12 weight 0: identity corrections and reached false',
        isIdentity( none.startCorrection ) && isIdentity( none.midCorrection ) && none.reached === false, '' );

    setup.weight = 1;
    const full = solveTwoBone( setup );
    const fullAngle = quaternionAngleBetween( full.startCorrection, new Quaternion() );

    setup.weight = 0.5;
    const half = solveTwoBone( setup );
    const halfAngle = quaternionAngleBetween( half.startCorrection, new Quaternion() );

    check( '1.12 weight 0.5: between identity and the full solve, and reached is false',
        halfAngle > 1e-6 && halfAngle < fullAngle && half.reached === false,
        `half ${ ( halfAngle * DEGREES ).toFixed( 4 ) }° of full ${ ( fullAngle * DEGREES ).toFixed( 4 ) }°` );

    note( 'weight 0.5 is NLerp, not Slerp', `${ ( halfAngle / fullAngle ).toFixed( 6 ) } of the full angle — ozz's choice, matched deliberately` );

    // 🚩 THE `w`-POSITIVE FIXUP, AND THE ONLY CHAIN THAT CAN SEE IT.
    //
    // ozz forces `w` positive before blending, *"which is required for NLerp (with identity
    // quaternion) to lerp the shortest path"* (`ik_two_bone_job.cc:306-308`). At weight 1 removing
    // it changes nothing observable — a quaternion and its negation are the same rotation — so
    // every clause above stays green without it. It bites only where a correction exceeds 180°,
    // and that needs a limb bent hard the WRONG way: §1.10's chain, whose knee has to turn
    // **247.08°** to reach a straight target, giving a raw `w` of −0.5525.
    //
    // Without the fixup the blend runs the LONG way round: at weight 0.5 the correction comes out
    // at 123.54°, which is BIGGER than the full solve's own 112.92°. A blend that overshoots the
    // thing it is blending toward is a limb that snaps outward as an IK layer fades in.
    const inverted = planarChain( 3, 4, -0.4 );
    inverted.targetPosition.set( 5, 0, 0 );

    const invertedFull = solveTwoBone( inverted );
    const invertedFullAngle = quaternionAngleBetween( invertedFull.midCorrection, new Quaternion() );

    check( '1.12 the wrongly-bent chain really does need a correction past 180°, or this proves nothing',
        Math.abs( invertedFull.midDeltaRadians ) * DEGREES > 180 && Math.cos( invertedFull.midDeltaRadians / 2 ) < 0,
        `${ ( invertedFull.midDeltaRadians * DEGREES ).toFixed( 2 ) }° of knee, raw w ${
            Math.cos( invertedFull.midDeltaRadians / 2 ).toFixed( 4 ) }` );

    let previousAngle = 0;
    let monotone = true;

    // ⚠️ −Infinity, not 0. Seeding a running maximum at zero floors it there, and the clause then
    // reads "worst overshoot 0.000°" and fails on correct code while still failing on broken code
    // — a gate that is red either way says nothing. Caught by running the mutation, not by reading.
    let worstOvershoot = -Infinity;

    for ( const amount of [ 0.1, 0.25, 0.5, 0.75, 0.9 ] ) {

        inverted.weight = amount;

        const angle = quaternionAngleBetween( solveTwoBone( inverted ).midCorrection, new Quaternion() );

        if ( angle <= previousAngle ) monotone = false;
        worstOvershoot = Math.max( worstOvershoot, angle - invertedFullAngle );
        previousAngle = angle;

    }

    check( '1.12 …and blending it stays between identity and the full solve, monotonically — the short way round',
        monotone === true && worstOvershoot < 0,
        `full ${ ( invertedFullAngle * DEGREES ).toFixed( 3 ) }°, worst blended overshoot ${
            ( worstOvershoot * DEGREES ).toFixed( 3 ) }° — without the w-positive fixup weight 0.5 reads 123.54°` );

    // 🚩 SOFTEN, AND THE CORRECTION TO THE SURVEY. §1.4 reads *"The default is `soften = 1.f`,
    // which places the band's start at the full chain length — i.e. the softening only shapes the
    // region beyond reach, turning the hard clamp of §1.3(a) into a smooth asymptote."* At the
    // default the band has ZERO WIDTH and ozz's own fourth guard (`ds > 0`) skips the branch
    // entirely, so the hard clamp is exactly what you get. Measured on both sides of 1.
    setup.weight = 1;

    let worstDefaultSoftening = 0;

    for ( const beyond of [ 1e-6, 0.01, 0.1, 1, 10, 1000 ] ) {

        const far = solveAtDistance( 3, 4, 7 + beyond, { soften: 1 } );
        worstDefaultSoftening = Math.max( worstDefaultSoftening,
            Math.abs( far.solveDistance - far.targetDistance ) );

    }

    check( '1.13 soften 1 (ozz\'s default) does not soften AT ALL — the band has zero width',
        worstDefaultSoftening === 0,
        `worst |solveDistance − targetDistance| ${ worstDefaultSoftening } over targets 1 µm to 1000 m past reach; ` +
        'so the acos clamp is load-bearing, not belt-and-braces' );

    // Below 1 the band engages, and its published property is the one worth gating: the solve
    // distance approaches the chain length from below and NEVER EXCEEDS IT, at any target.
    //
    // ⚠️ "Never reaches it" is true of the function and false of float64. The curve leaves a
    // shortfall of `ds · 3⁴/(α+3)⁴`, which at a target 1000 km past reach is 1e-25 m and rounds
    // onto the chain length exactly. So the clause is stated as "never exceeds", which is the
    // property that matters — a solve distance past the chain length is the NaN of §1.3(a) — and
    // the strict shortfall is asserted separately, at a magnitude anything real would use.
    let worstBandOvershoot = -Infinity;

    for ( const beyond of [ 1e-6, 0.01, 0.1, 1, 10, 1000, 1e6 ] ) {

        const far = solveAtDistance( 3, 4, 7 + beyond, { soften: 0.8 } );
        worstBandOvershoot = Math.max( worstBandOvershoot, far.solveDistance - far.chainLength );

    }

    check( '1.13 soften 0.8: the softened distance never exceeds the chain length, out to 1000 km',
        worstBandOvershoot <= 0, `closest approach ${ worstBandOvershoot.toExponential( 3 ) } m past the 7 m chain` );

    const nearBand = solveAtDistance( 3, 4, 7.7, { soften: 0.8 } );

    check( '1.13 …and at a target 10% past reach it is strictly short, so the asymptote is real',
        nearBand.solveDistance < nearBand.chainLength,
        `${ ( nearBand.chainLength - nearBand.solveDistance ).toFixed( 6 ) } m short of the chain length` );

    const softened = solveAtDistance( 3, 4, 7.5, { soften: 0.8 } );
    const unsoftened = solveAtDistance( 3, 4, 7.5, { soften: 1 } );

    check( '1.13 soften 0.8: the chain falls short of a target soften 1 would straighten to',
        softened.solveDistance < unsoftened.solveDistance
        && softened.interiorRadians < unsoftened.interiorRadians,
        `${ softened.solveDistance.toFixed( 6 ) } against ${ unsoftened.solveDistance.toFixed( 6 ) }, ` +
        `knee ${ ( softened.interiorRadians * DEGREES ).toFixed( 3 ) }° against ${ ( unsoftened.interiorRadians * DEGREES ).toFixed( 3 ) }° — ` +
        'a leg that visibly never locks' );

    // ⚠️ ozz's own comment on this curve claims a derivative of 1 at the band start. It is 4/3.
    const softenCurve = ( alpha ) => 1 - 3 ** 4 / ( alpha + 3 ) ** 4;
    const slope = ( softenCurve( 1e-8 ) - softenCurve( 0 ) ) / 1e-8;

    checkClose( '1.13 ozz\'s soften curve slope at the band start is 4/3, not the 1 its comment claims',
        slope, 4 / 3, 1e-4, 'C⁰ but not C¹ at the join; harmless at soften 1, worth knowing below it' );

}

// ================================================================================================
// 2. THE HINGE AND THE POLE — the degree of freedom no algebra removes
// ================================================================================================

/**
 * 🚩 §1.3(d)'s RULE, MEASURED. Read the knee direction ONCE from the rest pose and never from the
 * live pose: at full extension the bend plane is undefined to within numerical noise, so a
 * per-frame read jitters, which rotates the whole chain plane, which snaps the knee sideways.
 *
 * And the pole, which is the same problem one level up — with a measurement that says ozz's own
 * default is the worst available choice for a standing leg.
 */
function measureHingeAndPole() {

    for ( const leg of LEGS ) {

        const setup = readLeg( leg );
        const determination = setup.readMidAxisFromPose();
        const restFlexion = flexionAtChainLength(
            setup.startPosition.distanceTo( setup.midPosition ),
            setup.midPosition.distanceTo( setup.endPosition ),
            setup.startPosition.distanceTo( setup.endPosition ) );

        checkClose( `2.1  ${ leg.key }: the hinge derived from the pose is sin(rest flexion)`,
            determination, Math.sin( restFlexion ), 1e-9,
            `rest flexion ${ ( restFlexion * DEGREES ).toFixed( 4 ) }°, determination ${ determination.toFixed( 6 ) }` );

        const chainAxis = setup.midAxis.clone().applyQuaternion( setup.midRotation );

        // 🎯 THE CONVENTION, WHICH IS WHAT `readMidAxisFromPose` PROMISES AND THE ONLY THING ABOUT
        // THE AXIS THAT IS CHECKABLE. ozz: *"a positive rotation around this axis will open the
        // angle between the two bones"* (`ik_two_bone_job.h:74-76`). Get it backwards and every
        // knee correction goes the wrong way while still reaching the target.
        const rest = interiorAngleAfterHingeTurn( setup, 0 );

        check( `2.1  ${ leg.key }: a positive turn about the derived hinge OPENS the knee, as ozz requires`,
            interiorAngleAfterHingeTurn( setup, 1e-3 ) > rest && interiorAngleAfterHingeTurn( setup, -1e-3 ) < rest,
            `interior ${ ( rest * DEGREES ).toFixed( 4 ) }° → ${ ( interiorAngleAfterHingeTurn( setup, 1e-3 ) * DEGREES ).toFixed( 4 ) }° at +0.057°` );

        // ⚠️ AND IT IS NOT THE PURE MEDIO-LATERAL AXIS, WHICH IS CORRECT AND WORTH SAYING OUT LOUD
        // BEFORE SOMEBODY "FIXES" IT. `relaxed-standing.json` turns the femurs out by 9.56° and
        // 9.06°, and an externally rotated femur carries its knee hinge round with it. A rig
        // constant transcribed as (±1, 0, 0) would be wrong by this much.
        note( `${ leg.key } hinge, off the medio-lateral axis`,
            `${ ( Math.acos( Math.min( Math.abs( chainAxis.x ), 1 ) ) * DEGREES ).toFixed( 2 ) }° — ` +
            `[${ chainAxis.toArray().map( ( v ) => v.toFixed( 4 ) ).join( ', ' ) }], the femur's own external rotation` );

        // The pole, at ozz's default and at the one a knee actually wants.
        for ( const [ name, pole ] of [ [ '+Y (ozz default)', new Vector3( 0, 1, 0 ) ], [ '+Z (forward)', new Vector3( 0, 0, 1 ) ] ] ) {

            setup.poleVector.copy( pole );
            setup.targetPosition.copy( setup.endPosition );

            const solution = solveTwoBone( setup );

            note( `${ leg.key } pole conditioning, ${ name }`, solution.poleConditioning.toFixed( 6 ) );

        }

    }

    // 🚩 THE RED PROOF, AND IT IS ozz's SHIPPED DEFAULT. A micron of target noise, with the pole
    // 1.16° off the leg axis, swings the whole chain plane — because the plane normal it is being
    // measured against is 2% of unit length.
    for ( const leg of LEGS ) {

        const swingWithDefaultPole = measurePlaneSwingUnderTargetNoise( leg, new Vector3( 0, 1, 0 ) );
        const swingWithForwardPole = measurePlaneSwingUnderTargetNoise( leg, new Vector3( 0, 0, 1 ) );

        check( `2.2  ${ leg.key }: a forward pole holds the chain plane under 1 µm of target noise`,
            swingWithForwardPole * DEGREES < 0.01,
            `${ ( swingWithForwardPole * DEGREES ).toFixed( 6 ) }° of plane swing` );

        check( `2.2  ${ leg.key }: RED PROOF — ozz's +Y default swings it ${ ( swingWithDefaultPole / Math.max( swingWithForwardPole, 1e-30 ) ).toFixed( 0 ) }× further`,
            swingWithDefaultPole > swingWithForwardPole * 10,
            `${ ( swingWithDefaultPole * DEGREES ).toFixed( 6 ) }° against ${ ( swingWithForwardPole * DEGREES ).toFixed( 6 ) }°` );

    }

    // The hinge read at near-extension, which is the state §1.3(d) warns about: at full extension
    // the bend plane is undefined to within numerical noise, so a per-frame read jitters, which
    // rotates the whole chain plane, which snaps the knee sideways.
    //
    // ⚠️ THE PERTURBATION HAS TO BE OUT OF PLANE. An in-plane one leaves the bend plane exactly
    // where it was and reads zero jitter at every flexion angle — which is a test measuring its own
    // construction rather than the defect, and it is what this clause did on its first run.
    const straight = measureHingeJitterUnderJointNoise( 0.5 / DEGREES );
    const bent = measureHingeJitterUnderJointNoise( 6.8176 / DEGREES );

    check( '2.3  RED PROOF — deriving the hinge at 0.5° of flexion makes it jitter under 1 µm of joint noise',
        straight.jitter > bent.jitter * 5,
        `0.5°: ${ ( straight.jitter * DEGREES ).toFixed( 5 ) }° of axis swing at determination ${ straight.determination.toFixed( 6 ) }  |  ` +
        `6.8176°: ${ ( bent.jitter * DEGREES ).toFixed( 5 ) }° at ${ bent.determination.toFixed( 6 ) } — ` +
        `${ ( straight.jitter / bent.jitter ).toFixed( 1 ) }×` );

    check( '2.3  …so this rig\'s rest pose is a safe place to read it, which is why the rule is "read it once"',
        bent.jitter * DEGREES < 0.01, `${ ( bent.jitter * DEGREES ).toFixed( 6 ) }°` );

}

// ================================================================================================
// 3. ON STILTS — what a knee bend without a pelvis drop actually costs, in millimetres
// ================================================================================================

/**
 * 🎯 THE HEADLINE, AND THE CORRECTION TO THE SURVEY.
 *
 * `docs/research/ik-and-springbones.md` §2.2 computes the ankle lift by flexing a STRAIGHT leg.
 * This figure does not stand on one: `relaxed-standing` carries 6.8176° of knee flexion, and the
 * lift is quadratic in the angle, so every added degree from a bent knee costs more than the same
 * degree from a straight one. Both columns are computed here from the rig's own measured segment
 * lengths.
 */
function measureStilts() {

    const setup = readLeg( LEGS[ 0 ] );

    const upper = setup.startPosition.distanceTo( setup.midPosition );
    const lower = setup.midPosition.distanceTo( setup.endPosition );
    const restDistance = setup.startPosition.distanceTo( setup.endPosition );
    const restFlexion = flexionAtChainLength( upper, lower, restDistance );
    const reach = upper + lower;

    note( 'femur / tibia', `${ ( upper * 1000 ).toFixed( 3 ) } / ${ ( lower * 1000 ).toFixed( 3 ) } mm` );
    note( 'reach / inner radius', `${ ( reach * 1000 ).toFixed( 3 ) } / ${ ( Math.abs( upper - lower ) * 1000 ).toFixed( 3 ) } mm` );
    note( 'rest flexion, relaxed-standing', `${ ( restFlexion * DEGREES ).toFixed( 4 )
    }° — the hip sits ${ ( ( reach - restDistance ) * 1000 ).toFixed( 4 ) } mm inside full reach` );

    console.log( '\n      added flexion   lift from a STRAIGHT leg     lift from THIS RIG\'S REST POSE' );

    for ( const added of [ 1, 2, 5, 8.9306, 10, 15, 20, 30 ] ) {

        const fromStraight = reach - chainLengthAtFlexion( upper, lower, added / DEGREES );
        const fromRest = restDistance - chainLengthAtFlexion( upper, lower, restFlexion + added / DEGREES );

        console.log(
            `      ${ String( added ).padStart( 8 ) }°   ` +
            `${ ( fromStraight * 1000 ).toFixed( 4 ).padStart( 10 ) } mm = ${ ( fromStraight * 1000 * PIXELS_PER_MM ).toFixed( 4 ).padStart( 8 ) } px   ` +
            `${ ( fromRest * 1000 ).toFixed( 4 ).padStart( 10 ) } mm = ${ ( fromRest * 1000 * PIXELS_PER_MM ).toFixed( 4 ).padStart( 8 ) } px` );

    }

    const liftAt20FromStraight = reach - chainLengthAtFlexion( upper, lower, 20 / DEGREES );
    const liftAt20FromRest = restDistance - chainLengthAtFlexion( upper, lower, restFlexion + 20 / DEGREES );

    check( '3.1  the survey\'s straight-leg figure reproduces exactly',
        Math.abs( liftAt20FromStraight * 1000 - 12.182 ) < 0.001,
        `${ ( liftAt20FromStraight * 1000 ).toFixed( 4 ) } mm at 20°, against §2.2's 12.182` );

    check( '3.1  …and this rig\'s rest pose costs more, because the lift is quadratic in the angle',
        liftAt20FromRest > liftAt20FromStraight * 1.5,
        `${ ( liftAt20FromRest * 1000 ).toFixed( 4 ) } mm against ${ ( liftAt20FromStraight * 1000 ).toFixed( 4 ) } — ` +
        `${ ( liftAt20FromRest / liftAt20FromStraight ).toFixed( 3 ) }×` );

    // 🚩 THE CROSSOVER IS A BAND, NOT A POINT. See VISIBILITY_BRACKET_PIXELS.
    console.log( '\n      crossover in ADDED flexion, across LEARNINGS §1.14a\'s 0.48–10.6 px bracket' );

    for ( const pixels of VISIBILITY_BRACKET_PIXELS ) {

        const wantedMetres = pixels / PIXELS_PER_MM / 1000;
        const fromStraight = solveAddedFlexionForLift( upper, lower, 0, wantedMetres );
        const fromRest = solveAddedFlexionForLift( upper, lower, restFlexion, wantedMetres );

        console.log(
            `      ${ String( pixels ).padStart( 5 ) } px = ${ ( wantedMetres * 1000 ).toFixed( 4 ).padStart( 8 ) } mm   ` +
            `from a straight leg ${ ( fromStraight * DEGREES ).toFixed( 4 ).padStart( 8 ) }°   ` +
            `from this rig's rest pose ${ ( fromRest * DEGREES ).toFixed( 4 ).padStart( 8 ) }°` );

    }

    const crossoverAtQuotedFloor = solveAddedFlexionForLift( upper, lower, restFlexion, 1.6 / PIXELS_PER_MM / 1000 );

    check( '3.2  the crossover at the repo\'s own (unsupported) 1.6 px is HALF the survey\'s 8.93°',
        crossoverAtQuotedFloor * DEGREES < 5,
        `${ ( crossoverAtQuotedFloor * DEGREES ).toFixed( 4 ) }° of added flexion from the rest pose, against 8.9306° from a straight leg` );

    // Conditioning: the √(reach − d) blow-up, and where this rig actually sits in it.
    console.log( '\n      conditioning, d(flexion)/d(distance)' );

    for ( const gapMm of [ 100, 10, ( reach - restDistance ) * 1000, 1, 0.1, 0.01 ] ) {

        const distance = reach - gapMm / 1000;
        const step = 1e-9;
        const derivative = ( flexionAtChainLength( upper, lower, distance + step )
            - flexionAtChainLength( upper, lower, distance - step ) ) / ( 2 * step );

        console.log( `      reach − ${ gapMm.toFixed( 4 ).padStart( 9 ) } mm : flexion ${
            ( flexionAtChainLength( upper, lower, distance ) * DEGREES ).toFixed( 4 ).padStart( 8 ) }°   ` +
            `${ ( Math.abs( derivative ) * DEGREES / 1000 ).toFixed( 4 ).padStart( 9 ) } °/mm${
                Math.abs( gapMm - ( reach - restDistance ) * 1000 ) < 1e-9 ? '   ← this rig at rest' : '' }` );

    }

    const restStep = 1e-9;
    const restSensitivity = Math.abs(
        ( flexionAtChainLength( upper, lower, restDistance + restStep )
            - flexionAtChainLength( upper, lower, restDistance - restStep ) ) / ( 2 * restStep ) ) * DEGREES / 1000;

    check( '3.3  this rig\'s rest pose is not in the ill-conditioned region',
        restSensitivity < 5,
        `${ restSensitivity.toFixed( 4 ) } °/mm at rest, against 28.6 °/mm at reach − 0.01 mm — a micron of target noise is ${
            ( restSensitivity / 1000 ).toFixed( 6 ) }° of knee` );

}

// ================================================================================================
// 4. THE PLANTED KNEE BEND — on figure_g050, through createMotionTarget
// ================================================================================================

function measurePlantedBend() {

    // The base of support, re-measured here rather than quoted, because `Sway.js`'s header says
    // 183 mm forward / 50 mm behind and the punch-list says 179.4 / 54.4. This bake gives one of
    // them. It is a REPORTED number: nothing below is gated on it, because this file does not move
    // the feet and therefore cannot change it.
    const footprint = measureFootprint();
    note( 'base of support, this bake', `${ footprint.forward.toFixed( 1 ) } mm forward, ${
        footprint.behind.toFixed( 1 ) } mm behind the ankle midpoint (Sway.js's header says 183 / 50)` );

    // --- 4.1 symmetric, both feet planted --------------------------------------------------
    const commandedFlexion = 20 / DEGREES;

    const setups = LEGS.map( ( leg ) => {

        const setup = readLeg( leg );
        setup.readMidAxisFromPose();
        setup.poleVector.set( 0, 0, 1 );

        return setup;

    } );

    const restFlexion = flexionAtChainLength(
        setups[ 0 ].startPosition.distanceTo( setups[ 0 ].midPosition ),
        setups[ 0 ].midPosition.distanceTo( setups[ 0 ].endPosition ),
        setups[ 0 ].startPosition.distanceTo( setups[ 0 ].endPosition ) );

    const ankleBefore = setups.map( ( setup ) => setup.endPosition.clone() );

    const plan = planPlantedKneeBend( {
        legs: setups.map( ( setup ) => ( { setup, flexionRadians: commandedFlexion } ) )
    } );

    // ⚠️ 20° is the TOTAL joint angle, not an increment — `flexionRadians` is measured from a
    // straight leg, because that is what a joint angle is. This rig rests at 6.8176°, so the
    // command is 13.18° of ADDED flexion and the drop is §3's table read at 13.18, not at 20.
    note( 'pelvis drop at a 20° knee', `${ ( plan.travelDistance * 1000 ).toFixed( 4 ) } mm along (0, −1, 0), ` +
        `set by the ${ LEGS[ plan.limitingLegIndex ].key } leg — 20° TOTAL, ie ${
            ( 20 - restFlexion * DEGREES ).toFixed( 4 ) }° above this rig's rest flexion` );

    for ( let index = 0; index < plan.legs.length; index ++ ) {

        const planned = plan.legs[ index ];
        const solved = applySolution( planned.setup, planned.solution );

        checkClose( `4.1  ${ LEGS[ index ].key }: the ankle does not move`,
            solved.end.distanceTo( ankleBefore[ index ] ), 0, PLANTED_TOLERANCE_METRES, 'metres' );

        check( `4.1  ${ LEGS[ index ].key }: reached, interior branch, no degeneracy`,
            planned.solution.reached === true && planned.solution.branch === IK_BRANCH.INTERIOR
            && planned.solution.degenerate === null,
            `${ planned.solution.branch } / ${ planned.solution.degenerate }` );

    }

    // 🎯 ONLY THE LIMITING LEG LANDS EXACTLY ON THE COMMAND, AND THAT IS GEOMETRY RATHER THAN
    // SLOP. Two planted feet and ONE vertical pelvis translation is three constraints on one
    // degree of freedom. This rig's legs lean 1.16° and 3.89° off vertical and its hips sit at
    // different heights, so the same drop produces slightly different knee angles: whichever leg
    // demands the most travel gets its command exactly and the other overshoots. Asserting both
    // legs at exactly 20° would be asserting something no body can do.
    checkClose( '4.1  the limiting leg lands exactly on the commanded flexion',
        plan.legs[ plan.limitingLegIndex ].solution.flexionRadians * DEGREES, 20, 1e-9, 'degrees' );

    const other = plan.legs[ 1 - plan.limitingLegIndex ];

    check( '4.1  …and the other leg overshoots it rather than falling short, so no foot has to leave the floor',
        other.solution.flexionRadians >= commandedFlexion
        && ( other.solution.flexionRadians - commandedFlexion ) * DEGREES < 0.1,
        `${ ( other.solution.flexionRadians * DEGREES ).toFixed( 4 ) }° against 20° commanded — ` +
        `${ ( ( other.solution.flexionRadians - commandedFlexion ) * DEGREES ).toFixed( 4 ) }° of unavoidable asymmetry` );

    // 🚩 RED PROOF — the figure on stilts, in its two naive forms. Neither of them can be produced
    // by this solver, because a solver takes a TARGET rather than an angle; both are what a layer
    // writes when it drives the knee joint directly and forgets the pelvis.
    const stilts = measureAnkleLiftWithoutTravel( setups, commandedFlexion );

    check( '4.2  RED PROOF — knee bent with the hip pinned and the leg axis kept: the ankle rises off the floor',
        stilts.alongLegAxis > PLANTED_TOLERANCE_METRES * 1000,
        `${ ( stilts.alongLegAxis * 1000 ).toFixed( 4 ) } mm = ${ ( stilts.alongLegAxis * 1000 * PIXELS_PER_MM ).toFixed( 3 ) } px, ` +
        `${ ( stilts.alongLegAxis / PLANTED_TOLERANCE_METRES ).toExponential( 1 ) }× the planted tolerance — ` +
        'and above the whole 0.48–10.6 px visibility bracket at its lower end' );

    check( '4.2  RED PROOF — knee bent with the FEMUR pinned: the ankle swings even further',
        stilts.aboutTheKnee > stilts.alongLegAxis * 5,
        `${ ( stilts.aboutTheKnee * 1000 ).toFixed( 3 ) } mm of ankle travel, of which ${
            ( stilts.aboutTheKneeVertical * 1000 ).toFixed( 3 ) } mm is vertical — the arc, not the shortening` );

    check( '4.2  …and the drop the plan computed is the leg-axis lift, to the cosine of the leg\'s tilt',
        Math.abs( plan.travelDistance - stilts.alongLegAxis ) / stilts.alongLegAxis < 0.01,
        `drop ${ ( plan.travelDistance * 1000 ).toFixed( 4 ) } mm against lift ${ ( stilts.alongLegAxis * 1000 ).toFixed( 4 ) } mm ` +
        `(the legs lean 1.16° and 3.89°, so the two are not identical and must not be asserted equal)` );

    // --- 4.3 the lowest foot decides ---------------------------------------------------------
    //
    // ozz's `foot_ik` step 5, the case that only shows up when the two ankle targets differ: a
    // 40 mm step down under the right foot. Both legs are commanded their rest flexion, so the
    // right leg needs the root 40 mm lower and the left needs it where it is. The MAX plants both;
    // anything less leaves the right foot in the air, because its target is then beyond reach.
    const stepDown = 0.040;

    const stepSetups = LEGS.map( ( leg ) => {

        const setup = readLeg( leg );
        setup.readMidAxisFromPose();
        setup.poleVector.set( 0, 0, 1 );

        return setup;

    } );

    const stepTargets = [
        stepSetups[ 0 ].endPosition.clone(),
        stepSetups[ 1 ].endPosition.clone().setY( stepSetups[ 1 ].endPosition.y - stepDown )
    ];

    const stepRequest = {
        legs: stepSetups.map( ( setup, index ) => ( {
            setup, flexionRadians: restFlexion, ankleTarget: stepTargets[ index ]
        } ) )
    };

    const stepPlan = planPlantedKneeBend( stepRequest );

    check( '4.3  a 40 mm step down under one foot: the LOWER foot is the one that decides the drop',
        stepPlan.limitingLegIndex === 1,
        `travels ${ stepPlan.legs.map( ( planned ) => ( planned.requiredTravel * 1000 ).toFixed( 3 ) ).join( ' / ' ) } mm, drop ${
            ( stepPlan.travelDistance * 1000 ).toFixed( 3 ) } mm` );

    for ( let index = 0; index < stepPlan.legs.length; index ++ ) {

        const solved = applySolution( stepPlan.legs[ index ].setup, stepPlan.legs[ index ].solution );

        checkClose( `4.3  ${ LEGS[ index ].key }: reaches its own ankle target`,
            solved.end.distanceTo( stepTargets[ index ] ), 0, PLANTED_TOLERANCE_METRES, 'metres' );

    }

    // 🚩 RED PROOF — the mean of the two travels, which is what "split the drop between the legs"
    // means in arithmetic. The lower foot's target goes beyond reach and the foot floats.
    const meanTravel = stepPlan.legs.reduce( ( total, planned ) => total + planned.requiredTravel, 0 )
        / stepPlan.legs.length;

    let worstFloat = 0;
    let floatedBeyondReach = false;

    for ( let index = 0; index < stepSetups.length; index ++ ) {

        const setup = new TwoBoneSetup().copy( stepSetups[ index ] );
        setup.translate( new Vector3( 0, -meanTravel, 0 ) );
        setup.targetPosition.copy( stepTargets[ index ] );

        const solution = solveTwoBone( setup );
        const solved = applySolution( setup, solution );

        worstFloat = Math.max( worstFloat, solved.end.distanceTo( stepTargets[ index ] ) );
        if ( solution.branch === IK_BRANCH.BEYOND_REACH ) floatedBeyondReach = true;

    }

    check( '4.3  RED PROOF — the MEAN of the two travels leaves a foot in the air',
        worstFloat * 1000 > 1 && floatedBeyondReach === true,
        `${ ( worstFloat * 1000 ).toFixed( 3 ) } mm of float, branch beyondReach, against ${
            ( PLANTED_TOLERANCE_METRES * 1000 ).toExponential( 2 ) } mm with the max` );

    // --- 4.4 an asymmetric command on planted feet -------------------------------------------
    //
    // Both feet planted, 20° commanded on the left and 0° on the right. With planted targets no
    // foot can float — the solve always reaches — so the defect a wrong travel produces is not a
    // floating foot but a SILENTLY WRONG ANGLE, and that is what this clause measures.
    const asymmetricSetups = LEGS.map( ( leg ) => {

        const setup = readLeg( leg );
        setup.readMidAxisFromPose();
        setup.poleVector.set( 0, 0, 1 );

        return setup;

    } );

    const asymmetric = planPlantedKneeBend( {
        legs: [
            { setup: asymmetricSetups[ 0 ], flexionRadians: 20 / DEGREES },
            { setup: asymmetricSetups[ 1 ], flexionRadians: 0 }
        ]
    } );

    checkClose( '4.4  20° left / 0° right: the commanded leg gets exactly its 20°',
        asymmetric.legs[ 0 ].solution.flexionRadians * DEGREES, 20, 1e-9, 'degrees' );

    check( '4.4  …and the other leg picks up the drop rather than staying straight, which is what a body does',
        asymmetric.legs[ 1 ].solution.flexionRadians * DEGREES > 15,
        `right realised ${ ( asymmetric.legs[ 1 ].solution.flexionRadians * DEGREES ).toFixed( 4 ) }° against 0° commanded — ` +
        'reported, not hidden: a caller that needs both angles must move the root sideways, which is a balance decision' );

    for ( let index = 0; index < asymmetric.legs.length; index ++ ) {

        const solved = applySolution( asymmetric.legs[ index ].setup, asymmetric.legs[ index ].solution );

        checkClose( `4.4  ${ LEGS[ index ].key }: still planted`,
            solved.end.distanceTo( asymmetric.legs[ index ].ankleTarget ), 0, PLANTED_TOLERANCE_METRES, 'metres' );

    }

    const meanOfAsymmetric = ( asymmetric.legs[ 0 ].requiredTravel + asymmetric.legs[ 1 ].requiredTravel ) / 2;
    const underMean = new TwoBoneSetup().copy( asymmetricSetups[ 0 ] );
    underMean.translate( new Vector3( 0, -meanOfAsymmetric, 0 ) );
    underMean.targetPosition.copy( asymmetric.legs[ 0 ].ankleTarget );

    const underMeanFlexion = solveTwoBone( underMean ).flexionRadians * DEGREES;

    check( '4.4  RED PROOF — the MEAN travel silently under-delivers the commanded bend',
        Math.abs( underMeanFlexion - 20 ) > 3,
        `${ underMeanFlexion.toFixed( 4 ) }° realised against 20° commanded, with both feet still on the floor` );

    // --- 4.5 the two ordering / arithmetic traps ---------------------------------------------

    // 🚩 RED PROOF — solve first, translate after. ozz's step 5 precedes its step 6 for a reason:
    // the translation invalidates every solve it follows, by exactly its own magnitude.
    const solveThenMove = new TwoBoneSetup().copy( setups[ 0 ] );
    solveThenMove.targetPosition.copy( ankleBefore[ 0 ] );

    const preSolution = solveTwoBone( solveThenMove );
    const preSolved = applySolution( solveThenMove, preSolution );
    const afterMove = preSolved.end.clone().add( plan.rootOffset );

    check( '4.5  RED PROOF — translating AFTER the solve misses by the whole travel',
        Math.abs( afterMove.distanceTo( ankleBefore[ 0 ] ) - plan.travelDistance ) < 1e-12,
        `${ ( afterMove.distanceTo( ankleBefore[ 0 ] ) * 1000 ).toFixed( 4 ) } mm, which is the drop itself` );

    // 🚩 RED PROOF — the drop as a subtraction rather than a ray/sphere intersection. The legs are
    // 1.16° and 3.89° off vertical, so `wanted − current` is wrong by the cosine.
    let worstSubtraction = 0;

    for ( const setup of setups ) {

        const upper = setup.startPosition.distanceTo( setup.midPosition );
        const lower = setup.midPosition.distanceTo( setup.endPosition );
        const current = setup.startPosition.distanceTo( setup.endPosition );
        const wanted = chainLengthAtFlexion( upper, lower, commandedFlexion );

        const exact = rootTravelForChainLength(
            setup.startPosition, setup.endPosition, new Vector3( 0, -1, 0 ), wanted );

        worstSubtraction = Math.max( worstSubtraction, Math.abs( exact - ( current - wanted ) ) );

    }

    // ⚠️ SCOPED HONESTLY: 25 µm is 0.016 px, three orders below the bottom of the visibility
    // bracket. This clause is a CORRECTNESS clause, not a legibility one. It is here because the
    // error goes as the leg's tilt off the travel axis — 1.16° and 3.89° at rest — and `Sway`'s
    // fore-and-aft pendulum tilts them further, while a stride tilts them past 30°, where the same
    // mistake is worth millimetres. Fixing it costs one line; discovering it later costs a round.
    check( '4.5  RED PROOF — the drop as a subtraction is wrong by the leg tilt\'s cosine',
        worstSubtraction > PLANTED_TOLERANCE_METRES,
        `${ ( worstSubtraction * 1e6 ).toFixed( 2 ) } µm on a ${ ( plan.travelDistance * 1000 ).toFixed( 2 ) } mm drop = ${
            ( worstSubtraction * 1000 * PIXELS_PER_MM ).toFixed( 4 ) } px at 3.89° of tilt — invisible now, and linear in the tilt` );

    check( '4.5  …and the ray/sphere solve has a real root here, so the closest-approach fallback is not what passed',
        plan.legs.every( ( planned ) => planned.travelLimited === false )
        && isTravelLimited( setups[ 0 ].startPosition, ankleBefore[ 0 ], new Vector3( 1, 0, 0 ),
            chainLengthAtFlexion( 0.394707, 0.407331, commandedFlexion ) ) === true,
        'and a SIDEWAYS travel axis, which cannot reach that chain length at all, is correctly reported as limited' );

}

// ================================================================================================
// 5. THROUGH THE MOTION STACK — the corrections are deltas, the offset is not
// ================================================================================================

/**
 * 🎯 THE CLAIM THE HEADER MAKES, PUT ON THE REAL BONES. `MotionStack` commits
 * `bone.quaternion = restLocal × δ₁ × δ₂ × …`; ozz's corrections post-multiply onto the joint's
 * local rotation. So a correction IS a delta and no wrapper is needed. If that is wrong, the ankle
 * moves — and the two red proofs below are the two ways it is naturally got wrong.
 */
function measureThroughStack() {

    const pelvisBone = motionTarget.getBone( HUMANOID_TO_FIGURE_BONE.hips );
    const parentRestFrame = restRotationRelativeToRig( pelvisBone.parent, null, new Quaternion() );

    note( 'pelvis parent rest frame', `${ pelvisBone.parent.name } [${
        parentRestFrame.toArray().map( ( v ) => v.toFixed( 6 ) ).join( ', ' ) }]` );

    note( 'rig non-rigidity, worst bone scale', `${ worstBoneScaleDeviation.toExponential( 4 ) } off unity → ${
        ( RIGID_CHAIN_TOLERANCE_METRES * 1000 ).toExponential( 3 ) } mm over the leg — this section's tolerance` );

    const ankleBefore = LEGS.map( ( leg ) => worldPositionOf( leg.ankle ) );
    const kneeBefore = LEGS.map( ( leg ) => flexionOnRig( leg ) );

    const plan = buildPlanFromRig( 20 / DEGREES );

    // The angular equivalent of the position tolerance, pushed through the solver's own inverse so
    // it is derived rather than guessed: how much knee angle a chain-length error of one tolerance
    // is worth, at the length a 20° knee actually sits at.
    const chainAt20 = chainLengthAtFlexion( 0.394707, 0.407331, 20 / DEGREES );
    const angleTolerance = ( flexionAtChainLength( 0.394707, 0.407331, chainAt20 - RIGID_CHAIN_TOLERANCE_METRES )
        - flexionAtChainLength( 0.394707, 0.407331, chainAt20 + RIGID_CHAIN_TOLERANCE_METRES ) ) * DEGREES;

    // --- the correct wiring -------------------------------------------------------------------
    const committed = runStackWith( plan, { correctionSpace: 'local', offsetFrame: 'bone' }, parentRestFrame );

    for ( let index = 0; index < LEGS.length; index ++ ) {

        checkClose( `5.1  ${ LEGS[ index ].key }: the ankle stays where it was, on the real bones`,
            committed.ankles[ index ].distanceTo( ankleBefore[ index ] ), 0, RIGID_CHAIN_TOLERANCE_METRES,
            'metres, after MotionStack.commit()' );

    }

    // Same asymmetry as §4.1, and for the same reason: two planted feet and one vertical drop is
    // three constraints on one degree of freedom, so only the limiting leg lands on the command.
    checkClose( '5.1  the limiting leg reads its commanded 20° on the real bones',
        committed.knees[ plan.limitingLegIndex ] * DEGREES, 20, angleTolerance,
        `rest was ${ ( kneeBefore[ plan.limitingLegIndex ] * DEGREES ).toFixed( 4 ) }°` );

    checkClose( '5.1  …and the other leg reads what the plan predicted for it, on the real bones',
        committed.knees[ 1 - plan.limitingLegIndex ] * DEGREES,
        plan.legs[ 1 - plan.limitingLegIndex ].solution.flexionRadians * DEGREES, angleTolerance,
        'the plan and the rig agree about the asymmetry, which is what makes it geometry rather than error' );

    // 🚩 THE PELVIS IS ASSERTED AGAINST WHAT THE RIG CAN ACTUALLY DELIVER, NOT AGAINST THE IDEAL
    // DROP, AND THE GAP BETWEEN THE TWO IS REPORTED RATHER THAN ABSORBED INTO A TOLERANCE.
    //
    // `Root.quaternion` is stored float32 — `-0.7071067690849304` against an exact
    // `-0.7071067811865476` — and `restRotationRelativeToRig` NORMALISES what it reads, on purpose
    // (`Breath.js:433-436`: `Quaternion.invert()` is a conjugate, true only for unit quaternions,
    // and the error would compound down a chain). So the frame the offset is reframed THROUGH and
    // the frame the skeleton composes WITH differ by 1.21e-8 per component, and a reframed offset
    // is exact only to that. It is a property of the asset, and asserting the exact drop would be
    // asserting the asset were float64.
    const localOffset = toBoneOffsetFrame( plan.rootOffset, parentRestFrame, new Vector3() );
    const deliverableDrop = localOffset.clone().applyQuaternion( pelvisBone.parent.quaternion );
    const reframingResidual = deliverableDrop.distanceTo( plan.rootOffset );

    note( 'reframing residual, float32 Root.quaternion',
        `${ ( reframingResidual * 1e9 ).toFixed( 2 ) } nm on a ${ ( plan.travelDistance * 1000 ).toFixed( 3 ) } mm drop` );

    const pelvisTravel = new Vector3().subVectors( committed.pelvis, committed.pelvisRest );

    checkClose( '5.1  the pelvis moved by exactly the offset the reframing handed the stack',
        pelvisTravel.distanceTo( deliverableDrop ), 0, 1e-15, 'metres — exact, no tolerance to hide in' );

    // The bound is one float32 ULP of RELATIVE error on the drop, which is what a float32-stored
    // frame can cost a reframed vector. Derived, not fitted: measured 0.52 nm against a 1.29 nm
    // bound. Asserting the residual's exact value instead would be asserting the asset's rounding.
    checkClose( '5.1  …and that offset is the planned drop, to one float32 ULP of the drop itself',
        pelvisTravel.distanceTo( plan.rootOffset ), 0, PLANTED_TOLERANCE_METRES * plan.travelDistance,
        'metres' );

    check( '5.1  …downward, and nowhere else',
        pelvisTravel.y < 0 && Math.abs( pelvisTravel.x ) < reframingResidual
        && Math.abs( pelvisTravel.z ) < reframingResidual,
        `Δ [${ pelvisTravel.toArray().map( ( v ) => ( v * 1000 ).toFixed( 6 ) ).join( ', ' ) }] mm` );

    // 🚩 RED PROOF — write the CHAIN-SPACE rotation as the delta. The thigh's rest rotation is
    // ~160° off identity on this rig (`Skeleton.js` header), so the conjugation is not a rounding
    // detail; skipping it puts the leg somewhere else entirely.
    const chainSpaceRun = runStackWith( plan, { correctionSpace: 'chain', offsetFrame: 'bone' }, parentRestFrame );

    const chainSpaceError = Math.max(
        ...LEGS.map( ( leg, index ) => chainSpaceRun.ankles[ index ].distanceTo( ankleBefore[ index ] ) ) );

    check( '5.2  RED PROOF — the chain-space rotation written as the delta throws the ankle off',
        chainSpaceError > RIGID_CHAIN_TOLERANCE_METRES * 1000,
        `${ ( chainSpaceError * 1000 ).toFixed( 2 ) } mm = ${ ( chainSpaceError * 1000 * PIXELS_PER_MM ).toFixed( 1 ) } px, ` +
        `${ ( chainSpaceError / RIGID_CHAIN_TOLERANCE_METRES ).toFixed( 0 ) }× this section's tolerance — ` +
        'the thigh rests ~160° off identity, so the conjugation is not a rounding detail' );

    // 🚩 RED PROOF — write the rig-space drop straight into `offsetBone`. `Root` carries a −90°
    // turn about X, so the pelvis goes FORWARD at full magnitude instead of down.
    const rawOffsetRun = runStackWith( plan, { correctionSpace: 'local', offsetFrame: 'raw' }, parentRestFrame );

    const forwardTravel = rawOffsetRun.pelvis.z - rawOffsetRun.pelvisRest.z;
    const downwardTravel = rawOffsetRun.pelvis.y - rawOffsetRun.pelvisRest.y;

    check( '5.3  RED PROOF — the raw rig-space offset sends the pelvis forward instead of down',
        Math.abs( Math.abs( forwardTravel ) - plan.travelDistance ) < reframingResidual
        && Math.abs( downwardTravel ) < reframingResidual,
        `Δy ${ ( downwardTravel * 1000 ).toFixed( 4 ) } mm, Δz ${ ( forwardTravel * 1000 ).toFixed( 4 ) } mm — ` +
        `the full ${ ( plan.travelDistance * 1000 ).toFixed( 4 ) } mm, on the wrong axis, because Root rests −90° about X` );

    // --- 5.4 composition: the delta lands on top of a layer that already moved the same bones ---
    //
    // The header claims the correction needs no wrapper BECAUSE `MotionStack` post-multiplies
    // deltas in layer order. That claim is only worth anything if it survives another writer, so
    // here a layer at SWAY order turns both thighs first, the chain is re-read from the composed
    // pose, and the IK layer at GESTURE order is asked to plant the ankle anyway.
    const composed = runComposedStack( parentRestFrame );

    for ( let index = 0; index < LEGS.length; index ++ ) {

        checkClose( `5.4  ${ LEGS[ index ].key }: the ankle lands on target on top of a prior writer`,
            composed.ankles[ index ].distanceTo( composed.targets[ index ] ), 0, RIGID_CHAIN_TOLERANCE_METRES,
            'metres, with a 6° thigh rotation already composed underneath' );

    }

    check( '5.4  …and the prior writer really did move the leg, so this is not a null test',
        composed.disturbance * 1000 > 10,
        `the prior layer alone moved the ankle ${ ( composed.disturbance * 1000 ).toFixed( 1 ) } mm` );

}

// ================================================================================================
// 6. FRAME-RATE INVARIANCE — mandatory, and easy here because the solver has no state
// ================================================================================================

/**
 * LEARNINGS §1.13: anything advanced once per FRAME has a trajectory that depends on the frame
 * rate. This solver integrates nothing and holds nothing, so the clause is that the same commanded
 * trajectory sampled at 30, 60 and 120 Hz produces IDENTICAL output at every shared instant —
 * exactly zero difference, not a tolerance.
 *
 * 🚩 That is only worth asserting because the obvious way to build the layer around it breaks it.
 * The red proof is the one-liner everybody writes: ease the commanded angle toward its target once
 * per frame. Same seed, same trajectory, three frame rates, three different figures.
 */
function measureFrameRateInvariance() {

    const rates = [ 30, 60, 120 ];
    const commandedAt = ( seconds ) => ( 0.20 + 0.15 * Math.sin( 2 * Math.PI * 0.5 * seconds ) );

    const traces = new Map();
    const easedTraces = new Map();

    for ( const rate of rates ) {

        const trace = [];
        const eased = [];
        let easedState = commandedAt( 0 );

        for ( let frame = 0; frame <= rate * 4; frame ++ ) {

            const seconds = frame / rate;

            // The shipped path: a pure function of the commanded angle at this instant.
            const plan = buildPlanFromRig( commandedAt( seconds ) );

            // The defect: state advanced once per frame with a per-FRAME coefficient.
            easedState += ( commandedAt( seconds ) - easedState ) * 0.2;
            const easedPlan = buildPlanFromRig( easedState );

            if ( Math.abs( seconds * 30 - Math.round( seconds * 30 ) ) < 1e-9 ) {

                trace.push( { seconds, travel: plan.travelDistance, flexion: plan.legs[ 0 ].solution.flexionRadians } );
                eased.push( { seconds, flexion: easedPlan.legs[ 0 ].solution.flexionRadians } );

            }

        }

        traces.set( rate, trace );
        easedTraces.set( rate, eased );

    }

    let worstDifference = 0;
    const reference = traces.get( 60 );

    for ( const rate of rates ) {

        const trace = traces.get( rate );

        for ( let index = 0; index < reference.length; index ++ ) {

            worstDifference = Math.max( worstDifference,
                Math.abs( trace[ index ].travel - reference[ index ].travel ),
                Math.abs( trace[ index ].flexion - reference[ index ].flexion ) );

        }

    }

    check( '6.1  30, 60 and 120 Hz agree EXACTLY at every shared instant',
        worstDifference === 0,
        `worst difference ${ worstDifference } — the solver integrates nothing, so this is exact rather than close` );

    let worstEased = 0;
    const easedReference = easedTraces.get( 120 );

    for ( let index = 0; index < easedReference.length; index ++ ) {

        worstEased = Math.max( worstEased,
            Math.abs( easedTraces.get( 30 )[ index ].flexion - easedReference[ index ].flexion ) );

    }

    check( '6.1  RED PROOF — one per-frame ease in front of it and the same clause goes red',
        worstEased * DEGREES > 1,
        `${ ( worstEased * DEGREES ).toFixed( 4 ) }° of knee between 30 Hz and 120 Hz at the same instant` );

    // Statelessness, stated separately because "same input, same output" is what makes a critic run
    // comparable to the one before it, and because a scratch-buffer bug shows up here first.
    const first = buildPlanFromRig( 0.25 );
    const firstTravel = first.travelDistance;
    const firstFlexion = first.legs[ 0 ].solution.flexionRadians;

    buildPlanFromRig( 0.05 );
    buildPlanFromRig( 0.40 );

    const repeat = buildPlanFromRig( 0.25 );

    check( '6.2  stateless: the same command after two others reproduces bit for bit',
        repeat.travelDistance === firstTravel && repeat.legs[ 0 ].solution.flexionRadians === firstFlexion,
        `travel ${ repeat.travelDistance } vs ${ firstTravel }` );

}

// ================================================================================================
// helpers
// ================================================================================================

/**
 * A two-bone chain in the XY plane with a known bend, in the frame the arithmetic section reasons
 * in: the start joint at the origin, the chain running along +X, the hinge along +Z.
 *
 * `flexion` is signed so the bent-side test has something to be right and wrong about.
 */
function planarChain( upperLength, lowerLength, flexion, setup = new TwoBoneSetup() ) {

    setup.startPosition.set( 0, 0, 0 );
    setup.startRotation.identity();
    setup.midPosition.set( upperLength, 0, 0 );
    setup.midRotation.identity();

    setup.endPosition.set(
        upperLength + lowerLength * Math.cos( flexion ),
        -lowerLength * Math.sin( flexion ),
        0
    );

    setup.targetPosition.copy( setup.endPosition );
    setup.midAxis.set( 0, 0, 1 );
    setup.poleVector.set( 0, 1, 0 );
    setup.soften = 1;
    setup.twistRadians = 0;
    setup.weight = 1;

    return setup;

}

/** A solve at a given start→target distance along +X, on a chain of the given lengths. */
function solveAtDistance( upperLength, lowerLength, distance, options = {} ) {

    const setup = planarChain( upperLength, lowerLength, 0.4 );

    setup.targetPosition.set( distance, 0, 0 );
    setup.soften = options.soften ?? 1;

    return solveTwoBone( setup );

}

/**
 * Applies a solution to its own chain and returns where the three joints ended up.
 *
 * This is the honest way to check a correction: it composes the corrections the way a skeleton
 * does — the start joint's rotation carries the middle joint with it — rather than re-deriving the
 * solver's arithmetic somewhere else and comparing it against itself.
 */
function applySolution( setup, solution ) {

    const chainStart = new Quaternion().copy( setup.startRotation ).multiply( solution.startCorrection )
        .multiply( new Quaternion().copy( setup.startRotation ).invert() );

    const mid = new Vector3().subVectors( setup.midPosition, setup.startPosition )
        .applyQuaternion( chainStart ).add( setup.startPosition );

    const midChainRotation = new Quaternion().copy( chainStart ).multiply( setup.midRotation );
    const midCorrectionChain = new Quaternion().copy( midChainRotation )
        .multiply( solution.midCorrection )
        .multiply( new Quaternion().copy( midChainRotation ).invert() );

    const end = new Vector3().subVectors( setup.endPosition, setup.midPosition )
        .applyQuaternion( chainStart ).applyQuaternion( midCorrectionChain ).add( mid );

    return { start: setup.startPosition.clone(), mid, end };

}

/**
 * The red proof for §1.9: the same knee correction, with the hip swung from the chain BEFORE the
 * knee moved instead of after. Built out of the shipped solution so it cannot drift.
 */
function applyReversedOrder( setup, solution ) {

    const startToMid = new Vector3().subVectors( setup.midPosition, setup.startPosition );
    const midToEnd = new Vector3().subVectors( setup.endPosition, setup.midPosition );
    const startToTarget = new Vector3().subVectors( setup.targetPosition, setup.startPosition );

    // The defect: the swing is computed from the ORIGINAL end direction.
    const before = new Vector3().addVectors( startToMid, midToEnd ).normalize();
    const swing = new Quaternion().setFromUnitVectors( before, startToTarget.clone().normalize() );

    const hinge = setup.midAxis.clone().applyQuaternion( setup.midRotation );

    const mid = startToMid.clone().applyQuaternion( swing ).add( setup.startPosition );
    const end = midToEnd.clone()
        .applyAxisAngle( hinge, solution.midDeltaRadians )
        .applyQuaternion( swing )
        .add( mid );

    return { mid, end };

}

/** The hip→end distance after the middle joint alone has turned by `delta`. §1.10's scalar. */
function chainLengthAfterMidDelta( setup, delta ) {

    const startToMid = new Vector3().subVectors( setup.midPosition, setup.startPosition );
    const midToEnd = new Vector3().subVectors( setup.endPosition, setup.midPosition );
    const hinge = setup.midAxis.clone().applyQuaternion( setup.midRotation );

    return midToEnd.applyAxisAngle( hinge, delta ).add( startToMid ).length();

}

/** Reads one leg of the real figure through `createMotionTarget`, in world space. */
function readLeg( leg, setup = new TwoBoneSetup() ) {

    const hip = motionTarget.getBone( HUMANOID_TO_FIGURE_BONE[ leg.hip ] );
    const knee = motionTarget.getBone( HUMANOID_TO_FIGURE_BONE[ leg.knee ] );
    const ankle = motionTarget.getBone( HUMANOID_TO_FIGURE_BONE[ leg.ankle ] );

    for ( const bone of [ hip, knee, ankle ] ) bone.updateWorldMatrix( true, false );

    return setup.readChain( hip.matrixWorld, knee.matrixWorld, ankle.matrixWorld );

}

/** The realised knee flexion on the real bones, read off world positions. */
function flexionOnRig( leg ) {

    const hip = worldPositionOf( leg.hip );
    const knee = worldPositionOf( leg.knee );
    const ankle = worldPositionOf( leg.ankle );

    return flexionAtChainLength( hip.distanceTo( knee ), knee.distanceTo( ankle ), hip.distanceTo( ankle ) );

}

function worldPositionOf( humanoidName ) {

    const bone = motionTarget.getBone( HUMANOID_TO_FIGURE_BONE[ humanoidName ] );

    bone.updateWorldMatrix( true, false );

    return new Vector3().setFromMatrixPosition( bone.matrixWorld );

}

/** Both legs, read fresh off the rig's rest pose and planned to one commanded flexion. */
function buildPlanFromRig( flexionRadians, plan = new PlantedKneeBendPlan() ) {

    const legs = LEGS.map( ( leg ) => {

        const setup = readLeg( leg );

        setup.readMidAxisFromPose();
        setup.poleVector.set( 0, 0, 1 );

        return { setup, flexionRadians };

    } );

    return planPlantedKneeBend( { legs }, plan );

}

/**
 * §4.2's red proof: the two naive knee bends, both with the root held still.
 *
 * They differ in which joint is pinned, and the difference is a factor of nine on this rig:
 *
 *   ALONG THE LEG AXIS — the hip is pinned and the whole chain keeps its hip→ankle direction, so
 *   the leg simply shortens and the ankle climbs the leg axis. This is the geometry §3's table
 *   computes and the one the pelvis drop cancels.
 *
 *   ABOUT THE KNEE — the hip AND the femur are pinned, so the shank swings on an arc. This is what
 *   a layer writes when it rotates the knee bone and stops there, and the ankle travels the chord
 *   of that arc: mostly backwards, partly up.
 */
function measureAnkleLiftWithoutTravel( setups, flexionRadians ) {

    const result = { alongLegAxis: 0, aboutTheKnee: 0, aboutTheKneeVertical: 0 };

    for ( const source of setups ) {

        const setup = new TwoBoneSetup().copy( source );
        const upper = setup.startPosition.distanceTo( setup.midPosition );
        const lower = setup.midPosition.distanceTo( setup.endPosition );
        const restDistance = setup.startPosition.distanceTo( setup.endPosition );
        const restFlexion = flexionAtChainLength( upper, lower, restDistance );

        result.alongLegAxis = Math.max( result.alongLegAxis,
            restDistance - chainLengthAtFlexion( upper, lower, flexionRadians ) );

        const hinge = setup.midAxis.clone().applyQuaternion( setup.midRotation );
        const swung = new Vector3().subVectors( setup.endPosition, setup.midPosition )
            .applyAxisAngle( hinge, flexionRadians - restFlexion )
            .add( setup.midPosition );

        result.aboutTheKnee = Math.max( result.aboutTheKnee, swung.distanceTo( setup.endPosition ) );
        result.aboutTheKneeVertical = Math.max( result.aboutTheKneeVertical, swung.y - setup.endPosition.y );

    }

    return result;

}

/**
 * The worst any bone's scale departs from unity, over the whole rig. See
 * `RIGID_CHAIN_TOLERANCE_METRES` — this is what makes the shipped skeleton not quite a rigid chain.
 */
function measureWorstBoneScaleDeviation() {

    let worst = 0;

    figure.root.traverse( ( object ) => {

        if ( object.isBone !== true ) return;

        worst = Math.max( worst,
            Math.abs( 1 - object.scale.x ), Math.abs( 1 - object.scale.y ), Math.abs( 1 - object.scale.z ) );

    } );

    return worst;

}

/** §2.3's instrument: how far the derived hinge swings under a micron of OUT-OF-PLANE joint noise. */
function measureHingeJitterUnderJointNoise( flexion ) {

    const chain = planarChain( 0.394707, 0.407331, flexion );
    const determination = chain.readMidAxisFromPose();
    const axis = chain.midAxis.clone();

    chain.midPosition.z += 1e-6;
    chain.readMidAxisFromPose();

    return { determination, jitter: axis.angleTo( chain.midAxis ) };

}

/** The interior angle at the middle joint after turning the shank by `turn` about the chain hinge. */
function interiorAngleAfterHingeTurn( setup, turn ) {

    const hinge = setup.midAxis.clone().applyQuaternion( setup.midRotation );
    const toStart = new Vector3().subVectors( setup.startPosition, setup.midPosition );
    const toEnd = new Vector3().subVectors( setup.endPosition, setup.midPosition ).applyAxisAngle( hinge, turn );

    return toStart.angleTo( toEnd );

}

/** §2.2's red proof: how far the chain plane swings under a micron of target noise. */
function measurePlaneSwingUnderTargetNoise( leg, pole ) {

    const setup = readLeg( leg );

    setup.readMidAxisFromPose();
    setup.poleVector.copy( pole );

    const reference = new Vector3();
    let worst = 0;
    let first = true;

    for ( const jitter of [ 0, 1e-6, -1e-6 ] ) {

        setup.targetPosition.copy( setup.endPosition );
        setup.targetPosition.x += jitter;
        setup.targetPosition.z -= jitter;

        const solution = solveTwoBone( setup );
        const solved = applySolution( setup, solution );

        // Where the knee ends up, as a direction off the hip→ankle line — which is what the chain
        // plane IS, and what a viewer sees as "which way the knee points".
        const axis = new Vector3().subVectors( solved.end, solved.start ).normalize();
        const knee = new Vector3().subVectors( solved.mid, solved.start );

        knee.addScaledVector( axis, -knee.dot( axis ) ).normalize();

        if ( first === true ) {

            reference.copy( knee );
            first = false;

        } else {

            worst = Math.max( worst, reference.angleTo( knee ) );

        }

    }

    return worst;

}

/**
 * Runs one MotionStack frame with the plan wired in a chosen way, and reads the result off the
 * real bones. `correctionSpace` and `offsetFrame` select the shipped wiring or one of the two
 * defects §5 exists to reject.
 */
function runStackWith( plan, wiring, parentRestFrame ) {

    const stack = new MotionStack( { seed: 1 } );
    const layer = new PlantedKneeBendLayer( plan, wiring, parentRestFrame );

    stack.add( layer );
    stack.bind( motionTarget );

    const pelvisRest = worldPositionOf( 'hips' );

    stack.update( 1 / 60 );

    figure.root.updateMatrixWorld( true );

    const result = {
        ankles: LEGS.map( ( leg ) => worldPositionOf( leg.ankle ) ),
        knees: LEGS.map( ( leg ) => flexionOnRig( leg ) ),
        pelvis: worldPositionOf( 'hips' ),
        pelvisRest
    };

    // Put the figure back, because every later section reads the rest pose off it. `reset()`
    // rewinds the stack and not the figure — `MotionStack.js:286` says so in as many words.
    stack.dispose();
    skeleton.update();
    figure.root.updateMatrixWorld( true );

    return result;

}

/**
 * §5.4: a layer that already turned both thighs, then the IK layer on top of it, with the chain
 * re-read from the composed pose in between. This is the ordering the header describes and the one
 * a real layer has to arrange for itself.
 */
function runComposedStack( parentRestFrame ) {

    const targets = LEGS.map( ( leg ) => worldPositionOf( leg.ankle ) );

    const stack = new MotionStack( { seed: 1 } );
    const disturber = new ThighTwistLayer( 6 / DEGREES );

    stack.add( disturber );
    stack.bind( motionTarget );

    // Pass one: commit the prior writer alone, so the composed pose is on the bones.
    stack.update( 1 / 60 );
    figure.root.updateMatrixWorld( true );

    const disturbance = worldPositionOf( LEGS[ 0 ].ankle ).distanceTo( targets[ 0 ] );

    // Read the chain from the COMPOSED pose and solve against it. The corrections that come back
    // are this layer's deltas, to be post-multiplied after the disturber's.
    const plan = planPlantedKneeBend( {
        legs: LEGS.map( ( leg, index ) => {

            const setup = readLeg( leg );

            setup.readMidAxisFromPose();
            setup.poleVector.set( 0, 0, 1 );

            return { setup, flexionRadians: 20 / DEGREES, ankleTarget: targets[ index ] };

        } )
    } );

    stack.add( new PlantedKneeBendLayer( plan, { correctionSpace: 'local', offsetFrame: 'bone' }, parentRestFrame ) );

    // Pass two: both layers, composed in MOTION_ORDER.
    stack.update( 1 / 60 );
    figure.root.updateMatrixWorld( true );

    const result = {
        ankles: LEGS.map( ( leg ) => worldPositionOf( leg.ankle ) ),
        targets,
        disturbance
    };

    stack.dispose();
    skeleton.update();
    figure.root.updateMatrixWorld( true );

    return result;

}

/** Writes a plan into the stack. The whole of what an IK layer has to do with this solver. */
class PlantedKneeBendLayer extends Layer {

    constructor( plan, wiring, parentRestFrame ) {

        super( {
            name: 'plantedKneeBend',
            order: MOTION_ORDER.GESTURE,
            boneChannels: [
                HUMANOID_TO_FIGURE_BONE.hips,
                ...LEGS.flatMap( ( leg ) => [ HUMANOID_TO_FIGURE_BONE[ leg.hip ], HUMANOID_TO_FIGURE_BONE[ leg.knee ] ] )
            ]
        } );

        this.plan = plan;
        this.wiring = wiring;
        this.parentRestFrame = parentRestFrame;
        this.offset = new Vector3();

    }

    update() {

        if ( this.wiring.offsetFrame === 'bone' ) {

            toBoneOffsetFrame( this.plan.rootOffset, this.parentRestFrame, this.offset );

        } else {

            this.offset.copy( this.plan.rootOffset );

        }

        this.contribution.offsetBone( HUMANOID_TO_FIGURE_BONE.hips, this.offset.x, this.offset.y, this.offset.z );

        for ( let index = 0; index < LEGS.length; index ++ ) {

            const solution = this.plan.legs[ index ].solution;

            const start = this.wiring.correctionSpace === 'local'
                ? solution.startCorrection
                : solution.startCorrectionInChainSpace;

            this.contribution.rotateBone( HUMANOID_TO_FIGURE_BONE[ LEGS[ index ].hip ], start );
            this.contribution.rotateBone( HUMANOID_TO_FIGURE_BONE[ LEGS[ index ].knee ], solution.midCorrection );

        }

        return this.contribution;

    }

}

/** A prior writer of the same bones, so §5.4 is not a null test. */
class ThighTwistLayer extends Layer {

    constructor( radians ) {

        super( {
            name: 'thighTwist',
            order: MOTION_ORDER.SWAY,
            boneChannels: LEGS.map( ( leg ) => HUMANOID_TO_FIGURE_BONE[ leg.hip ] )
        } );

        this.radians = radians;

    }

    update() {

        for ( const leg of LEGS ) {

            this.contribution.rotateBoneEuler( HUMANOID_TO_FIGURE_BONE[ leg.hip ], this.radians, 0, 0 );

        }

        return this.contribution;

    }

}

/**
 * The base of support, off this bake's own mesh: every vertex below the ankle joints, projected
 * fore and aft of their midpoint. Reported, never gated — `Sway` owns this quantity and this file
 * does not move the feet.
 */
function measureFootprint() {

    const left = worldPositionOf( 'leftFoot' );
    const right = worldPositionOf( 'rightFoot' );
    const ankleHeight = Math.max( left.y, right.y );
    const midpointZ = ( left.z + right.z ) / 2;

    let forward = -Infinity;
    let behind = Infinity;

    const vertex = new Vector3();

    figure.root.traverse( ( object ) => {

        const positions = object.geometry?.attributes?.position;
        if ( object.isMesh !== true || positions === undefined ) return;

        for ( let index = 0; index < positions.count; index ++ ) {

            vertex.fromBufferAttribute( positions, index ).applyMatrix4( object.matrixWorld );

            if ( vertex.y > ankleHeight ) continue;

            forward = Math.max( forward, vertex.z - midpointZ );
            behind = Math.min( behind, vertex.z - midpointZ );

        }

    } );

    return { forward: forward * 1000, behind: -behind * 1000 };

}

/** The added flexion at which the ankle lift reaches `wantedMetres`, by bisection. */
function solveAddedFlexionForLift( upperLength, lowerLength, restFlexion, wantedMetres ) {

    const restDistance = chainLengthAtFlexion( upperLength, lowerLength, restFlexion );

    let low = 0;
    let high = Math.PI / 2;

    for ( let step = 0; step < 200; step ++ ) {

        const middle = ( low + high ) / 2;
        const lift = restDistance - chainLengthAtFlexion( upperLength, lowerLength, restFlexion + middle );

        if ( lift < wantedMetres ) low = middle;
        else high = middle;

    }

    return ( low + high ) / 2;

}

function kneeCosine( upperLength, lowerLength, distance ) {

    return ( upperLength * upperLength + lowerLength * lowerLength - distance * distance )
        / ( 2 * upperLength * lowerLength );

}

function angleBetween( apex, first, second ) {

    return new Vector3().subVectors( first, apex ).angleTo( new Vector3().subVectors( second, apex ) );

}

function quaternionAngleBetween( a, b ) {

    const dot = Math.min( Math.abs( a.dot( b ) ), 1 );

    return 2 * Math.acos( dot );

}

/**
 * The largest component the two rotations differ by, after aligning their signs.
 *
 * Used wherever two rotations are asserted EQUAL rather than merely close, because `2·acos(dot)`
 * is ill-conditioned near identity — `acos(1−ε) ≈ √(2ε)`, so float64 round-off at 1e-13 reads as
 * 1e-6 rad and a gate on the angle would be gating on the square root of the thing it means to
 * measure. `quaternionAngleBetween` stays, for reporting a difference that is genuinely large.
 */
function quaternionComponentDifference( a, b ) {

    const sign = a.dot( b ) < 0 ? -1 : 1;

    return Math.max(
        Math.abs( a.x - sign * b.x ),
        Math.abs( a.y - sign * b.y ),
        Math.abs( a.z - sign * b.z ),
        Math.abs( a.w - sign * b.w )
    );

}

function isIdentity( quaternion ) {

    return Math.abs( Math.abs( quaternion.w ) - 1 ) < 1e-12;

}

function isFiniteSolution( solution ) {

    for ( const rotation of [ solution.startCorrection, solution.midCorrection ] ) {

        if ( [ rotation.x, rotation.y, rotation.z, rotation.w ].every( Number.isFinite ) === false ) return false;

    }

    return Number.isFinite( solution.interiorRadians ) && Number.isFinite( solution.midDeltaRadians );

}

// Keeps the Matrix4 import honest for readers scanning the header: it is the type `readChain`
// takes, and `bone.matrixWorld` is the only instance this file ever passes.
void Matrix4;

// --- reporting -----------------------------------------------------------------------------

function section( title ) {

    console.log( `\n${ title }` );
    console.log( '-'.repeat( title.length ) );

}

function note( label, value ) {

    notes.push( { label, value } );
    console.log( `  ....  ${ label.padEnd( 44 ) } ${ value }` );

}

function check( name, passed, detail = '' ) {

    checks.push( { name, passed: passed === true, detail } );

    console.log( `  ${ passed === true ? 'PASS' : 'FAIL' }  ${ name }${ detail ? `\n            ${ detail }` : '' }` );

}

function checkClose( name, actual, expected, tolerance, detail = '' ) {

    const difference = Math.abs( actual - expected );

    check( name, difference <= tolerance,
        `${ detail } — expected ${ expected }, got ${ actual } (Δ ${ difference.toExponential( 2 ) }, tolerance ${ tolerance.toExponential( 2 ) })` );

}

function report() {

    const failed = checks.filter( ( result ) => result.passed === false ).length;

    console.log( `\n${ checks.length - failed }/${ checks.length } gates passed, ${ notes.length } measurements reported\n` );

    process.exit( failed === 0 ? 0 : 1 );

}

// ================================================================================================
// THE RUN
//
// ⚠️ LAST IN THE FILE, AND THAT IS STRUCTURAL RATHER THAN TIDY. `function` declarations hoist and
// `class` declarations DO NOT — they sit in the temporal dead zone until the line that declares
// them is evaluated — so a run block placed beside §1, where it reads best, throws
// `Cannot access 'PlantedKneeBendLayer' before initialization` the moment §5 constructs a layer.
// ================================================================================================

section( '1. ARITHMETIC — a chain whose answer is known on paper' );
measureThreeFourFive();
measureDegenerateBranches();
measureAssemblyOrder();
measureBentSide();
measureSpaceInvariance();
measureWeightAndSoften();

section( '2. THE HINGE AND THE POLE — the one degree of freedom that must be supplied' );
note( 'figure', path.relative( REPOSITORY_ROOT, FIGURE_PATH ) );
measureHingeAndPole();

section( '3. ON STILTS — the defect 6.2(a) is blocked on, measured' );
measureStilts();

section( '4. THE PLANTED KNEE BEND — the deliverable' );
measurePlantedBend();

section( '5. THROUGH THE MOTION STACK — on the real bones, committed by the stack' );
measureThroughStack();

section( '6. FRAME-RATE INVARIANCE' );
measureFrameRateInvariance();

report();
