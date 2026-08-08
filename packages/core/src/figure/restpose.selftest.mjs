/**
 * RestPose selftest — the numeric half of the gate.
 *
 * The other half is `restpose.browsercheck.html`, and it answers the question that matters most:
 * does the figure read as a person? A number cannot answer that. What a number CAN do is stop the
 * pose data from quietly drifting away from the anatomy it was authored against, which is exactly
 * what happens to hand-tuned angles over a few months of "just two more degrees".
 *
 * So this file asserts the measurements, not the inputs. Nothing here checks that
 * `leftUpperArm.euler[2]` is -28.5; it checks that the humerus ends up 8-12 degrees out from
 * vertical. That is the claim the pose file makes in prose, it is the claim a reviewer cares
 * about, and it survives someone rewriting how the angle is reached.
 *
 * Runs against the shipped GLB with no GPU, by rebuilding the bone tree straight out of the file's
 * JSON chunk and driving the real Skeleton and RestPose classes over it. Skinning, materials and
 * morphs are irrelevant to a pose; joints are not.
 *
 *     node packages/core/src/figure/restpose.selftest.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Object3D, Vector3 } from 'three';

import { Skeleton } from './Skeleton.js';
import { RestPose } from './RestPose.js';

// three's GLTFLoader assumes a browser when it decodes embedded textures. The stance-width check
// needs real skinned vertices — a heel is not a joint — so the GLB is loaded properly for that one
// section, and nothing here inspects a pixel. Both stubs must be in place before the import.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Figure } = await import( './Figure.js' );

const GLB_PATH = fileURLToPath( new URL( '../../../../assets/figures/figure_g050.glb', import.meta.url ) );

// Anatomical targets. Each is the prose claim in the pose file, restated as an interval.
const RELAXED_TARGETS = {
    humerusAbductionDegrees: [ 8, 12 ],
    elbowFlexionDegrees: [ 8, 16 ],
    wristForwardOfHipMetres: [ 0.02, 0.09 ],
    knuckleFlexionDegrees: [ 12, 45 ],
    middleJointFlexionDegrees: [ 25, 60 ]
};

// How far a foot may move between relaxed-standing and a contrapposto, in metres. There is no foot
// IK, so some travel is unavoidable; this is the line between "the stance repositioned" and "the
// figure skated".
const FOOT_TRAVEL_LIMIT_METRES = 0.045;

/**
 * 🎯 McIlroy WE and Maki BE (1997), "Preferred placement of the feet during quiet stance:
 * development of a standardized foot placement for balance testing", Clinical Biomechanics
 * 12(1):66-70. N = 262, aged 19-97, standing as they preferred: **0.17 m between heel centres,
 * 14 degrees between the long axes of the feet.**
 *
 * This gate exists because every measured gate in this repo was green while the figure stood with
 * its heels 379.9 mm apart — more than twice a preferred stance — and a blind visual judge called
 * it in one line. A wide base is not a cosmetic choice: it is how a body STOPS moving sideways, so
 * a stance this wide mechanically suppresses the medio-lateral sway that `motion/Sway.js` spends
 * most of its effort producing. Nothing in the repo was measuring the base of support.
 *
 * The tolerance is per-pose scatter, not uncertainty in the source. All three poses are solved to
 * the same target and land within 1.5 mm and 1.2 degrees of it; the band is wide enough that a
 * re-authored contrapposto does not have to be re-solved to four figures, and far too narrow to
 * admit the stance this gate was written against.
 */
const PREFERRED_HEEL_SEPARATION_METRES = 0.17;
const HEEL_SEPARATION_TOLERANCE_METRES = 0.020;
const PREFERRED_FOOT_ANGLE_DEGREES = 14;
const FOOT_ANGLE_TOLERANCE_DEGREES = 4;

/**
 * How far the heel midpoint may sit from the figure's own bind-pose heel midpoint, in metres.
 *
 * Narrowing the stance by adducting the two hips by DIFFERENT amounts — which the asymmetric bind
 * pose forces — narrows it about the pelvis rather than about the floor, and left the figure
 * standing 32.6 mm to one side of where it had been. That is a quarter of the new half-stance and
 * it reads on screen as a lean. It is fixed by translating the whole figure through the pelvis
 * offset, and this is the gate that would catch it coming back.
 */
const BIND_HEEL_MIDPOINT_METRES = -0.00715;
const HEEL_MIDPOINT_TOLERANCE_METRES = 0.006;

/**
 * How far a contrapposto may carry the heel midpoint away from the rest pose's, in metres.
 *
 * A real weight shift does reposition the feet slightly and there is no foot IK here to pin them,
 * which weight-left.json says in its own notes. Measured: 4.0 mm one way and 8.2 mm the other, where
 * the poses this replaced drifted 2.4 and 11.9. So this is not a new residue and it is a little
 * smaller than it was.
 */
const CONTRAPPOSTO_FOOT_DRIFT_LIMIT_METRES = 0.012;

const DOWN = new Vector3( 0, -1, 0 );

/** The GLB is parsed once and re-posed, because parsing it is the expensive part. */
let cachedFigure = null;

let failures = 0;

await run();

async function run() {

    const relaxedSkeleton = poseSkeleton( 'relaxed-standing' );

    checkArmsHang( relaxedSkeleton );
    checkFingersCascade( relaxedSkeleton );
    checkStandingIsNotSquare( relaxedSkeleton );

    checkContrapposto( 'weight-left', +1 );
    checkContrapposto( 'weight-right', -1 );

    checkMirrorSymmetry();
    await checkStanceWidth();
    checkBlendEndpoints();
    checkAuthoringErrorsAreLoud();

    console.log( failures === 0 ? '\nAll RestPose checks passed.' : `\n${ failures } RestPose check(s) FAILED.` );
    process.exit( failures === 0 ? 0 : 1 );

}

// ---- the checks ---------------------------------------------------------------------------------

/** Arms hang: humerus a little off vertical, elbow bent but nowhere near locked, hand by the hip. */
function checkArmsHang( skeleton ) {

    console.log( '\nrelaxed-standing — arms' );

    for ( const side of [ 'l', 'r' ] ) {

        const upperArm = direction( skeleton, `upperarm_${ side }`, `lowerarm_${ side }` );
        const foreArm = direction( skeleton, `lowerarm_${ side }`, `hand_${ side }` );

        // Frontal-plane component only, so hanging the arm forward does not inflate the reading.
        const frontal = new Vector3( upperArm.x, upperArm.y, 0 ).normalize();

        within( `arm ${ side } humerus abduction`, degreesBetween( frontal, DOWN ),
            RELAXED_TARGETS.humerusAbductionDegrees );

        within( `arm ${ side } elbow flexion`, degreesBetween( upperArm, foreArm ),
            RELAXED_TARGETS.elbowFlexionDegrees );

        const wrist = worldPosition( skeleton, `hand_${ side }` );
        const hip = worldPosition( skeleton, `thigh_${ side }` );

        within( `arm ${ side } wrist forward of hip`, wrist.z - hip.z,
            RELAXED_TARGETS.wristForwardOfHipMetres );

        assert( `arm ${ side } wrist is below the hip`, wrist.y < hip.y );

    }

}

/**
 * The cascade: curl increases index -> little, strictly, at both the knuckle and the middle joint.
 *
 * Strictly, not approximately. The gradient is the whole point of the detail — a hand where the
 * middle finger is the most curled reads as a gesture rather than as a hand at rest.
 */
function checkFingersCascade( skeleton ) {

    console.log( '\nrelaxed-standing — hands' );

    const fingers = [ 'index', 'middle', 'ring', 'pinky' ];

    for ( const side of [ 'l', 'r' ] ) {

        const knuckle = [];
        const middleJoint = [];

        for ( const finger of fingers ) {

            const metacarpal = direction( skeleton, `hand_${ side }`, `${ finger }_01_${ side }` );
            const proximal = direction( skeleton, `${ finger }_01_${ side }`, `${ finger }_02_${ side }` );
            const intermediate = direction( skeleton, `${ finger }_02_${ side }`, `${ finger }_03_${ side }` );

            knuckle.push( degreesBetween( metacarpal, proximal ) );
            middleJoint.push( degreesBetween( proximal, intermediate ) );

        }

        within( `hand ${ side } index knuckle flexion`, knuckle[ 0 ], RELAXED_TARGETS.knuckleFlexionDegrees );
        within( `hand ${ side } index middle-joint flexion`, middleJoint[ 0 ], RELAXED_TARGETS.middleJointFlexionDegrees );
        within( `hand ${ side } little knuckle flexion`, knuckle[ 3 ], RELAXED_TARGETS.knuckleFlexionDegrees );
        within( `hand ${ side } little middle-joint flexion`, middleJoint[ 3 ], RELAXED_TARGETS.middleJointFlexionDegrees );

        assert( `hand ${ side } knuckle curl increases index->little  [${ knuckle.map( round ).join( ', ' ) }]`,
            increasing( knuckle ) );

        assert( `hand ${ side } middle-joint curl increases index->little  [${ middleJoint.map( round ).join( ', ' ) }]`,
            increasing( middleJoint ) );

    }

}

/** Nobody stands square. Assert the asymmetry is present and that it stays small enough to be a tell rather than a lean. */
function checkStandingIsNotSquare( skeleton ) {

    console.log( '\nrelaxed-standing — asymmetry' );

    const leftAbduction = frontalAbduction( skeleton, 'l' );
    const rightAbduction = frontalAbduction( skeleton, 'r' );
    const difference = Math.abs( leftAbduction - rightAbduction );

    within( 'arms differ, but only just', difference, [ 0.5, 4 ] );
    within( 'hip line is off level, but only just', Math.abs( hipLineTiltDegrees( skeleton ) ), [ 0.1, 2 ] );

}

/**
 * Contrapposto, stated as the four things that have to be true at once.
 *
 * `stanceSign` is +1 when the weighted leg is the character's left (+X), -1 for the right.
 */
function checkContrapposto( poseName, stanceSign ) {

    console.log( `\n${ poseName } — contrapposto` );

    const skeleton = poseSkeleton( poseName );
    const relaxed = poseSkeleton( 'relaxed-standing' );

    const hipTilt = hipLineTiltDegrees( skeleton ) * stanceSign;
    const shoulderTilt = shoulderLineTiltDegrees( skeleton ) * stanceSign;

    // 🚩 Pelvis TRAVEL, which is a displacement from the resting stance — not the pelvis's absolute
    // x, which is what this used to read. The two were the same number only because relaxed-standing
    // happened to sit near x = 0, and they stopped being the same the moment the whole figure was
    // translated to recentre the narrowed stance. An absolute position was never the claim: the
    // pose file says "the pelvis translates over the stance foot", and translation is a difference.
    const pelvisShift = ( worldPosition( skeleton, 'pelvis' ).x
        - worldPosition( relaxed, 'pelvis' ).x ) * stanceSign;

    within( 'weighted hip is raised', hipTilt, [ 3, 9 ] );
    assert( `shoulder line opposes the hip line  (shoulder ${ round( shoulderTilt ) }°, hip ${ round( hipTilt ) }°)`,
        shoulderTilt < -1 );
    within( 'pelvis has travelled over the stance foot', pelvisShift, [ 0.02, 0.07 ] );

    const freeSide = stanceSign > 0 ? 'r' : 'l';
    const stanceSide = stanceSign > 0 ? 'l' : 'r';

    within( 'free knee is softly flexed', kneeFlexionDegrees( skeleton, freeSide ), [ 10, 22 ] );
    within( 'stance knee stays near straight', kneeFlexionDegrees( skeleton, stanceSide ), [ 0, 10 ] );

    for ( const side of [ 'l', 'r' ] ) {
        for ( const joint of [ `foot_${ side }`, `ball_${ side }` ] ) {

            const travel = worldPosition( skeleton, joint ).distanceTo( worldPosition( relaxed, joint ) );

            assert( `${ joint } stays planted within ${ FOOT_TRAVEL_LIMIT_METRES * 1000 } mm  (${ round( travel * 1000 ) } mm)`,
                travel <= FOOT_TRAVEL_LIMIT_METRES );

        }
    }

    assert( 'no joint is driven below the floor',
        lowestJointHeight( skeleton ) >= lowestJointHeight( relaxed ) - 0.005 );

}

/**
 * weight-right must be the sagittal mirror of weight-left. It is generated, so this is a real risk.
 *
 * 🚩 THIS CHECK HAD TO CHANGE SHAPE, AND THE REASON IS WORTH READING. It used to compare the two
 * poses' absolute world joint positions and demand they mirror to a tenth of a micron. That worked
 * only because the legs of the two poses really were exact numeric mirrors of each other. They no
 * longer are: the narrowing that brings the heels to a preferred stance width is a correction to
 * the FIGURE — whose two ankles sit 12.5 mm off centre from each other — so it belongs to the left
 * leg and the right leg rather than to the stance leg and the free leg, and it is deliberately
 * IDENTICAL in all three poses rather than mirrored. Mirroring it instead would move the whole
 * stance 15 mm sideways every time the figure shifted its weight, which is a skating foot.
 *
 * And comparing the world positions of the CONTRAPPOSTO — each pose's displacement from
 * relaxed-standing — does not work either, measured: the residue is 14 mm, because
 * relaxed-standing's own left/right asymmetry is deliberate and large (the arms differ by 1.8
 * degrees, the toe-out by 0.5, the pelvis travel by 4 mm) and it enters both differences unequally.
 * A 14 mm tolerance is not a gate.
 *
 * So the claim is asserted where it is exactly true — in the pose DATA — and in two parts:
 *
 *   Every bone the stance correction does not touch must mirror EXACTLY, angle for angle. That is
 *   two thirds of the file and the part a generator would corrupt.
 *
 *   The four leg and foot bones, and the pelvis offset, must mirror in their DIFFERENCE from
 *   relaxed-standing, because the stance correction is a common additive term there and cancels.
 *   The tolerance is 0.6 degrees, which is relaxed-standing's own authored toe-out asymmetry (3.5
 *   against 3.0) and was already present before any of this.
 */
function checkMirrorSymmetry() {

    console.log( '\nweight-left / weight-right — mirror' );

    const relaxed = RestPose.load( 'relaxed-standing' );
    const left = RestPose.load( 'weight-left' );
    const right = RestPose.load( 'weight-right' );

    // The bones that carry the shared, deliberately unmirrored stance correction.
    const STANCE_BONES = new Set( [ 'leftUpperLeg', 'rightUpperLeg', 'leftFoot', 'rightFoot' ] );

    let worstExact = 0;
    let worstStance = 0;

    for ( const humanoidName of left.rotations.keys() ) {

        const mirroredName = mirrorHumanoidName( humanoidName );
        const a = left.rotations.get( humanoidName );
        const b = right.rotations.get( mirroredName );

        if ( b === undefined ) {
            assert( `weight-right has a mirror for ${ humanoidName }`, false );
            continue;
        }

        if ( STANCE_BONES.has( humanoidName ) ) {

            const deltaLeft = relaxed.rotations.get( humanoidName ).clone().invert().multiply( a );
            const deltaRight = relaxed.rotations.get( mirroredName ).clone().invert().multiply( b );

            worstStance = Math.max( worstStance, degreesApart( mirrorQuaternion( deltaLeft ), deltaRight ) );

        } else {

            worstExact = Math.max( worstExact, degreesApart( mirrorQuaternion( a ), b ) );

        }

    }

    assert( `every bone outside the stance mirrors exactly  (worst ${ worstExact.toExponential( 2 ) } deg)`,
        worstExact < 1e-3 );

    assert( `the four stance bones mirror in their contrapposto delta  (worst ${ round( worstStance, 3 ) } deg)`,
        worstStance < 0.6 );

    // The pelvis offset is data too, and its travel is what the contrapposto is FOR.
    const travelLeft = left.hipsOffset.clone().sub( relaxed.hipsOffset );
    const travelRight = right.hipsOffset.clone().sub( relaxed.hipsOffset );

    assert( `pelvis travel mirrors in x to under 5 mm  (${ round( ( travelLeft.x + travelRight.x ) * 1000, 2 ) } mm,` +
        ` deliberate: the two shifts were authored 38 and 42 mm)`,
        Math.abs( travelLeft.x + travelRight.x ) < 0.005 );

    assert( `pelvis travel mirrors in y exactly  (${ round( ( travelLeft.y - travelRight.y ) * 1000, 4 ) } mm)`,
        Math.abs( travelLeft.y - travelRight.y ) < 1e-6 );

}

/**
 * 🎯 THE BASE OF SUPPORT — the finding no gate in this repo was looking for.
 *
 * Measured off skinned vertices rather than joints, because a heel is not a bone: every vertex of
 * every skinned mesh below its own side's ankle joint is the footprint, the rearmost fifth of each
 * foot is its heel, and the frontmost fifth is its toe. See PREFERRED_HEEL_SEPARATION_METRES for the
 * source and for why this matters mechanically rather than cosmetically.
 *
 * All three poses are checked, not just the rest pose. A contrapposto that quietly splays the feet
 * would put the figure back in a braced stance for the whole duration of a weight shift, which is
 * exactly the window in which the lateral motion is supposed to be most legible.
 */
async function checkStanceWidth() {

    console.log( '\nbase of support — McIlroy & Maki 1997' );

    // Filled by the rest pose, which is checked first because the other two are checked against it.
    let restMidpoint = 0;

    for ( const poseName of RestPose.names ) {

        const stance = await measureStance( poseName );

        within( `${ poseName }: heel separation (m)`, stance.heelSeparation,
            [ PREFERRED_HEEL_SEPARATION_METRES - HEEL_SEPARATION_TOLERANCE_METRES,
                PREFERRED_HEEL_SEPARATION_METRES + HEEL_SEPARATION_TOLERANCE_METRES ] );

        within( `${ poseName }: included foot angle (deg)`, stance.includedAngleDegrees,
            [ PREFERRED_FOOT_ANGLE_DEGREES - FOOT_ANGLE_TOLERANCE_DEGREES,
                PREFERRED_FOOT_ANGLE_DEGREES + FOOT_ANGLE_TOLERANCE_DEGREES ] );

        // Where the figure STANDS is a property of the rest pose. A contrapposto is allowed to
        // reposition the feet a little — it does in life, and there is no foot IK here to stop it —
        // so the two weight poses are checked against the rest pose rather than against the bind
        // one, at the amplitude the pose files already claim.
        if ( poseName === 'relaxed-standing' ) {

            restMidpoint = stance.heelMidpoint;

            within( `${ poseName }: heel midpoint, so the figure is not standing off centre (m)`,
                stance.heelMidpoint,
                [ BIND_HEEL_MIDPOINT_METRES - HEEL_MIDPOINT_TOLERANCE_METRES,
                    BIND_HEEL_MIDPOINT_METRES + HEEL_MIDPOINT_TOLERANCE_METRES ] );

        } else {

            within( `${ poseName }: heel midpoint moves with the shift, but only a little (m)`,
                stance.heelMidpoint - restMidpoint,
                [ -CONTRAPPOSTO_FOOT_DRIFT_LIMIT_METRES, CONTRAPPOSTO_FOOT_DRIFT_LIMIT_METRES ] );

        }

        console.log( `        outer-to-outer ${ round( stance.outerToOuter * 1000 ) } mm,` +
            ` inner gap ${ round( stance.innerGap * 1000 ) } mm` +
            `   — reported; the bind pose measured 480.0 and 300.6` );

    }

}

/** blendTo has to actually reach both ends, or a crossfade never arrives. */
function checkBlendEndpoints() {

    console.log( '\nblendTo — endpoints and midpoint' );

    const relaxed = RestPose.load( 'relaxed-standing' );
    const weightLeft = RestPose.load( 'weight-left' );

    const atZero = buildSkeleton();
    relaxed.blendTo( atZero, weightLeft, 0 );
    atZero.update();

    const atOne = buildSkeleton();
    relaxed.blendTo( atOne, weightLeft, 1 );
    atOne.update();

    assert( 'blend at t=0 equals relaxed-standing', posesMatch( atZero, poseSkeleton( 'relaxed-standing' ) ) );
    assert( 'blend at t=1 equals weight-left', posesMatch( atOne, poseSkeleton( 'weight-left' ) ) );

    // t is clamped, so a caller overshooting an eased shift lands on the pose rather than past it.
    const overshoot = buildSkeleton();
    relaxed.blendTo( overshoot, weightLeft, 1.4 );
    overshoot.update();

    assert( 'blend clamps above 1', posesMatch( overshoot, atOne ) );

    // The midpoint must be genuinely between, not a jump. Hip tilt is the cleanest single readout.
    const half = buildSkeleton();
    relaxed.blendTo( half, weightLeft, 0.5 );
    half.update();

    const tilt = hipLineTiltDegrees( half );
    const endTilt = hipLineTiltDegrees( atOne );

    assert( `midpoint hip tilt sits between the ends  (${ round( tilt ) }° of ${ round( endTilt ) }°)`,
        tilt > endTilt * 0.3 && tilt < endTilt * 0.7 );

}

/** A typo in a pose file has to fail at load, not silently leave a bone at bind. */
function checkAuthoringErrorsAreLoud() {

    console.log( '\nauthoring errors' );

    throws( 'an unknown pose name', () => RestPose.load( 'no-such-pose' ) );

    throws( 'a rig bone name instead of a humanoid one',
        () => new RestPose( { bones: { upperarm_l: { euler: [ 0, 0, 0 ] } } } ) );

    throws( 'an axis name that is not in the axes block',
        () => new RestPose( { bones: { leftUpperArm: { axis: 'nope', degrees: 10 } } } ) );

    throws( 'a bone entry with neither euler nor axis',
        () => new RestPose( { bones: { leftUpperArm: { degrees: 10 } } } ) );

}

// ---- the figure ---------------------------------------------------------------------------------

/**
 * Rebuilds the GLB's node tree as plain Object3Ds.
 *
 * Reading the JSON chunk directly rather than going through GLTFLoader keeps this runnable in node
 * with no DOM, no GPU and no image decoding — and a pose is entirely a question of the node
 * hierarchy's translations and rotations, which is exactly what the JSON chunk holds.
 */
function buildSkeleton() {

    const buffer = readFileSync( GLB_PATH );
    const jsonLength = buffer.readUInt32LE( 12 );
    const gltf = JSON.parse( buffer.toString( 'utf8', 20, 20 + jsonLength ) );

    const objects = gltf.nodes.map( ( node ) => {

        const object = new Object3D();

        // GLTFLoader strips dots from node names, so 'Human.rig' arrives as 'Humanrig'. Match it,
        // or a lookup that works in the browser fails here for a reason nobody would guess.
        object.name = ( node.name ?? '' ).replace( /\./g, '' );

        if ( node.translation !== undefined ) object.position.fromArray( node.translation );
        if ( node.rotation !== undefined ) object.quaternion.fromArray( node.rotation );
        if ( node.scale !== undefined ) object.scale.fromArray( node.scale );

        return object;

    } );

    const root = new Object3D();
    const parented = new Set();

    gltf.nodes.forEach( ( node, index ) => {
        for ( const child of node.children ?? [] ) {
            objects[ index ].add( objects[ child ] );
            parented.add( child );
        }
    } );

    objects.forEach( ( object, index ) => { if ( parented.has( index ) === false ) root.add( object ); } );

    root.updateMatrixWorld( true );

    return new Skeleton( root );

}

function poseSkeleton( poseName ) {

    const skeleton = buildSkeleton();

    RestPose.load( poseName ).applyTo( skeleton );
    skeleton.update();
    skeleton.rigRoot.updateMatrixWorld( true );

    return skeleton;

}

/**
 * The figure's footprint, in world metres, for one pose.
 *
 * Loaded through `Figure` rather than through the JSON-chunk tree the rest of this file uses,
 * because this is the one measurement that needs the SKIN: a heel centre and a foot's long axis are
 * properties of the mesh, and the rig has no landmark for either. `applyBoneTransform` gives the
 * skinned position of a vertex in the pose the bones are currently in, which is exactly what a
 * force plate would see.
 *
 * Each foot is cut at its OWN ankle height and the two are split at the midline between the ankles.
 * A single shared cutoff empties the set for a foot the pose has lifted, and an empty set turns
 * every statistic here into NaN — which reads as a crash rather than as a failure.
 */
async function measureStance( poseName ) {

    if ( cachedFigure === null ) {

        const bytes = readFileSync( GLB_PATH );

        const figure = await Figure.parse(
            bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

        // 🚩 The Skeleton is cached WITH the figure, and that is load-bearing rather than an
        // optimisation. A Skeleton reads the rig's current bone rotations as its bind reference at
        // construction, so building a second one over an already-posed figure treats the pose as
        // bind and applies the next pose on top of it. That silently halved one stance and doubled
        // the other before this line existed.
        cachedFigure = { figure, skeleton: new Skeleton( figure.root ) };

    }

    const { root } = cachedFigure.figure;
    const { skeleton } = cachedFigure;

    RestPose.load( poseName ).applyTo( skeleton );
    skeleton.update();
    root.updateMatrixWorld( true );

    const ankle = {
        left: new Vector3().setFromMatrixPosition( root.getObjectByName( 'foot_l' ).matrixWorld ),
        right: new Vector3().setFromMatrixPosition( root.getObjectByName( 'foot_r' ).matrixWorld )
    };

    const midline = ( ankle.left.x + ankle.right.x ) / 2;
    const sides = { left: [], right: [] };
    const vertex = new Vector3();

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;

        for ( let index = 0; index < position.count; index ++ ) {

            vertex.fromBufferAttribute( position, index );
            object.applyBoneTransform( index, vertex );
            object.localToWorld( vertex );

            const isLeft = vertex.x >= midline;

            if ( vertex.y > ( isLeft ? ankle.left.y : ankle.right.y ) ) continue;

            ( isLeft ? sides.left : sides.right ).push( vertex.clone() );

        }

    } );

    const describe = ( points ) => {

        const depths = points.map( ( point ) => point.z );
        const rearmost = Math.min( ...depths );
        const frontmost = Math.max( ...depths );
        const span = frontmost - rearmost;

        const heel = points.filter( ( point ) => point.z < rearmost + 0.2 * span );
        const toe = points.filter( ( point ) => point.z > frontmost - 0.2 * span );
        const mean = ( set, axis ) => set.reduce( ( total, point ) => total + point[ axis ], 0 ) / set.length;

        return {
            heelX: mean( heel, 'x' ), heelZ: mean( heel, 'z' ),
            toeX: mean( toe, 'x' ), toeZ: mean( toe, 'z' ),
            innerEdge: points.reduce( ( best, point ) => Math.min( best, Math.abs( point.x - midline ) ), Infinity ),
            outerEdge: points.reduce( ( best, point ) => Math.max( best, Math.abs( point.x - midline ) ), 0 )
        };

    };

    const left = describe( sides.left );
    const right = describe( sides.right );

    const angleOf = ( foot ) => Math.abs( Math.atan2( foot.toeX - foot.heelX, foot.toeZ - foot.heelZ ) * 180 / Math.PI );

    return {
        heelSeparation: left.heelX - right.heelX,
        heelMidpoint: ( left.heelX + right.heelX ) / 2,
        includedAngleDegrees: angleOf( left ) + angleOf( right ),
        outerToOuter: left.outerEdge + right.outerEdge,
        innerGap: left.innerEdge + right.innerEdge
    };

}

// ---- measurement ---------------------------------------------------------------------------------

function worldPosition( skeleton, boneName ) {

    skeleton.rigRoot.updateMatrixWorld( true );

    return new Vector3().setFromMatrixPosition( skeleton.rigRoot.getObjectByName( boneName ).matrixWorld );

}

function direction( skeleton, fromBone, toBone ) {

    return worldPosition( skeleton, toBone ).sub( worldPosition( skeleton, fromBone ) ).normalize();

}

function degreesBetween( a, b ) {

    return ( Math.acos( Math.min( 1, Math.max( -1, a.dot( b ) ) ) ) * 180 ) / Math.PI;

}

function frontalAbduction( skeleton, side ) {

    const upperArm = direction( skeleton, `upperarm_${ side }`, `lowerarm_${ side }` );

    return degreesBetween( new Vector3( upperArm.x, upperArm.y, 0 ).normalize(), DOWN );

}

function kneeFlexionDegrees( skeleton, side ) {

    return degreesBetween(
        direction( skeleton, `thigh_${ side }`, `calf_${ side }` ),
        direction( skeleton, `calf_${ side }`, `foot_${ side }` ) );

}

/** Positive means the character's LEFT is higher. */
function lineTiltDegrees( skeleton, leftBone, rightBone ) {

    const left = worldPosition( skeleton, leftBone );
    const right = worldPosition( skeleton, rightBone );

    return ( Math.atan2( left.y - right.y, left.x - right.x ) * 180 ) / Math.PI;

}

function hipLineTiltDegrees( skeleton ) {

    return lineTiltDegrees( skeleton, 'thigh_l', 'thigh_r' );

}

function shoulderLineTiltDegrees( skeleton ) {

    return lineTiltDegrees( skeleton, 'clavicle_l', 'clavicle_r' );

}

function lowestJointHeight( skeleton ) {

    let lowest = Infinity;

    for ( const name of skeleton.boneNames ) {
        lowest = Math.min( lowest, worldPosition( skeleton, skeleton.rawBoneOf( name ).name ).y );
    }

    return lowest;

}

function posesMatch( a, b ) {

    for ( const name of a.boneNames ) {
        if ( worldPosition( a, a.rawBoneOf( name ).name )
            .distanceTo( worldPosition( b, b.rawBoneOf( name ).name ) ) > 1e-5 ) return false;
    }

    return true;

}

/** 'leftUpperLeg' -> 'rightUpperLeg', and anything unsided back to itself. */
function mirrorHumanoidName( humanoidName ) {

    if ( humanoidName.startsWith( 'left' ) ) return `right${ humanoidName.slice( 4 ) }`;
    if ( humanoidName.startsWith( 'right' ) ) return `left${ humanoidName.slice( 5 ) }`;

    return humanoidName;

}

/**
 * A rotation reflected across the sagittal plane. Reflecting a frame reverses handedness, so the
 * quaternion's x component and its angle survive and y and z flip — which is the quaternion form of
 * the (x, -y, -z) Euler rule the pose files state.
 */
function mirrorQuaternion( rotation ) {

    return rotation.clone().set( rotation.x, -rotation.y, -rotation.z, rotation.w );

}

function degreesApart( a, b ) {

    return a.angleTo( b ) * 180 / Math.PI;

}

function increasing( values ) {

    return values.every( ( value, index ) => index === 0 || value > values[ index - 1 ] );

}

// ---- assertions ---------------------------------------------------------------------------------

function assert( label, condition ) {

    console.log( `  ${ condition ? 'ok  ' : 'FAIL' }  ${ label }` );

    if ( condition === false ) failures ++;

}

function within( label, value, [ low, high ] ) {

    assert( `${ label }: ${ round( value, 3 )} in [${ low }, ${ high }]`, value >= low && value <= high );

}

function throws( label, body ) {

    let threw = false;

    try {
        body();
    } catch {
        threw = true;
    }

    assert( `throws on ${ label }`, threw );

}

function round( value, places = 1 ) {

    return Number( value.toFixed( places ) );

}
