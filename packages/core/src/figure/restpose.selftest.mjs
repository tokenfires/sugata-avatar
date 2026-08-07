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

const DOWN = new Vector3( 0, -1, 0 );

let failures = 0;

run();

function run() {

    const relaxedSkeleton = poseSkeleton( 'relaxed-standing' );

    checkArmsHang( relaxedSkeleton );
    checkFingersCascade( relaxedSkeleton );
    checkStandingIsNotSquare( relaxedSkeleton );

    checkContrapposto( 'weight-left', +1 );
    checkContrapposto( 'weight-right', -1 );

    checkMirrorSymmetry();
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
    const pelvisShift = worldPosition( skeleton, 'pelvis' ).x * stanceSign;

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

/** weight-right must be the exact sagittal mirror of weight-left. It is generated, so this is a real risk. */
function checkMirrorSymmetry() {

    console.log( '\nweight-left / weight-right — mirror' );

    const left = poseSkeleton( 'weight-left' );
    const right = poseSkeleton( 'weight-right' );

    let worst = 0;

    for ( const name of [ 'head', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r', 'pelvis', 'index_03_l' ] ) {

        const mirroredName = name.endsWith( '_l' ) ? `${ name.slice( 0, -2 ) }_r`
            : name.endsWith( '_r' ) ? `${ name.slice( 0, -2 ) }_l` : name;

        const a = worldPosition( left, name );
        const b = worldPosition( right, mirroredName );

        worst = Math.max( worst, Math.abs( a.x + b.x ), Math.abs( a.y - b.y ), Math.abs( a.z - b.z ) );

    }

    assert( `every checked joint mirrors to under 0.1 mm  (worst ${ ( worst * 1000 ).toExponential( 2 ) } mm)`, worst < 1e-4 );

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
