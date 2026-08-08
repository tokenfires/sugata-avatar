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

import { Box3, Object3D, PerspectiveCamera, Vector3 } from 'three';

import { Skeleton } from './Skeleton.js';
import { RestPose } from './RestPose.js';

// The pose FILES, not the compiled poses. The articulation gate has to rebuild a pose with a few
// bones replaced by the angles they carried before the fix, and `RestPose` deliberately keeps only
// compiled quaternions — reasonably, since nothing at runtime wants the source.
import weightLeftSource from './poses/weight-left.json' with { type: 'json' };
import weightRightSource from './poses/weight-right.json' with { type: 'json' };
import relaxedStandingSource from './poses/relaxed-standing.json' with { type: 'json' };

const POSE_SOURCE = { 'weight-left': weightLeftSource, 'weight-right': weightRightSource };

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

/**
 * How far the inter-thigh gap must move between relaxed-standing and a contrapposto, in pixels at
 * the framing `alive.js?frame=body` uses — 700 x 1200, 26 degree field of view, camera 12 degrees
 * off axis, the figure's own height plus a tenth.
 *
 * Four pixels, and each part of that has a reason. The floor is this project's own measured
 * visibility threshold: docs/PROGRESS.md records a weight shift moving "~4.5 mm ML — 1.6 pixels at
 * full-body framing. Side-by-side plates before and after a shift are indistinguishable." The
 * ceiling is what the poses now measure — 9.06 px on weight-left and 7.89 px on weight-right — and
 * the gate sits between, at 2.5x the invisibility floor and a little over half the delivered
 * amplitude, so a re-authored pose has room to move without having to re-solve this number.
 *
 * The old poses measure 0.35 px and 0.07 px, which is where the 26x and 113x in the commit message
 * come from and why no tolerance narrow enough to be useful could have admitted them.
 */
const MINIMUM_GAP_CHANGE_PIXELS = 4;

/**
 * The gap change as a fraction of how far the band TRAVELLED, because the defect was reported as a
 * ratio: 0.81 px of shape against 8.2 px of translation.
 *
 * Measured now: 0.436 on weight-left, 0.372 on weight-right, against 0.023 and 0.004 before. The
 * gate is set at 0.15 — above anything the old data can reach by a factor of six, and below the
 * delivered figures by a factor of two and a half, because the numerator and the denominator move
 * together when a pose is re-authored and a tight ratio would be brittle for no gain.
 */
const MINIMUM_SHAPE_PER_TRAVEL = 0.15;

/**
 * The rows of the frame the gap is read from, as fractions of frame height so the same numbers read
 * a 1200 px capture and a 600 px one.
 *
 * 0.583–0.642 is the mid-thigh: below the hands, so no arm contamination, and above the knees, so
 * the taper does not dominate. It is the band the judge reported the defect in, kept deliberately
 * rather than chosen afresh — a gate written on a different band from the finding it answers is a
 * gate that cannot be compared with the finding.
 */
const THIGH_BAND_ROWS = [ 0.583, 0.642 ];

/**
 * The free limb as it was authored BEFORE the swivel, per pose. This is the gate's known-bad input
 * and it is committed on purpose: see checkContrappostoArticulates.
 */
const PRE_SWIVEL_FREE_LIMB = {
    'weight-left': {
        rightUpperLeg: [ -4.0, -7.06, 0.94 ],
        rightLowerLeg: [ 8.0, 0, 0 ],
        rightFoot: [ -6.26, -0.85, -10.63 ]
    },
    'weight-right': {
        leftUpperLeg: [ -4, 7.06, 3.71 ],
        leftLowerLeg: [ 8, 0, 0 ],
        leftFoot: [ -6.57, 1.36, 6.03 ]
    }
};

// The camera `alive.js` builds for ?frame=body, reconstructed. Changing any of these changes every
// pixel figure in this section, so they are named rather than inlined.
const FRAME_WIDTH = 700;
const FRAME_HEIGHT = 1200;
const FRAME_FIELD_OF_VIEW_DEGREES = 26;
const FRAME_AZIMUTH_DEGREES = 12;
const FRAME_MARGIN = 1.10;

const DOWN = new Vector3( 0, -1, 0 );

/** The GLB is parsed once and re-posed, because parsing it is the expensive part. */
let cachedFigure = null;

/**
 * The skinned figure and the Skeleton that drives it, parsed once for the whole run.
 *
 * 🚩 The Skeleton is cached WITH the figure, and that is load-bearing rather than an optimisation.
 * A Skeleton reads the rig's current bone rotations as its bind reference at construction, so
 * building a second one over an already-posed figure treats the pose as bind and applies the next
 * pose on top of it. That silently halved one stance measurement and doubled the other before this
 * existed — see LEARNINGS 1.12.
 */
async function loadFigureOnce() {

    if ( cachedFigure === null ) {

        const bytes = readFileSync( GLB_PATH );

        const figure = await Figure.parse(
            bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );

        cachedFigure = { figure, root: figure.root, skeleton: new Skeleton( figure.root ) };

    }

    return cachedFigure;

}

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
    await checkContrappostoArticulates();
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
 *
 * 🚩 AND THEN THE PELVIS NEEDED A THIRD RULE, because it does not obey ONE mirror rule — it obeys
 * a different one per axis, and no comparison of whole quaternions can express that. Its two axes
 * are authored against different references on purpose (weight-right.json's `hips` note is the
 * primary source, and it predicted this check would read 2.400 degrees before anyone ran it):
 *
 *   y, the transverse rotation, mirrors as a DELTA. It decides whether the free foot's turn-out is
 *   released at all, and relaxed-standing carries +1.2 degrees of its own; mirroring the absolute
 *   angle gave one pelvis a −3.7 degree twist against the other's +1.3, so one foot articulated
 *   and one stayed welded. Commit 60b4d73 is the record.
 *
 *   z, the frontal-plane obliquity, mirrors ABSOLUTELY. The legs' counter-rotations are authored
 *   against the absolute −5.5 roll, so the absolute is the number that has to stay true.
 *
 * Composing those into a quaternion and comparing that is what produced 2.400 degrees on a bone
 * whose every authored component is an EXACT mirror under its own rule. The residual is not error;
 * it is the two rules interfering. Asserted per component, both read 0.000 — which is a strictly
 * stronger claim than the quaternion check ever made, not a weakened one.
 *
 * This is LEARNINGS 1.11 in a new place: a single scalar was structurally unable to say the thing
 * the data actually claims.
 */
function checkMirrorSymmetry() {

    console.log( '\nweight-left / weight-right — mirror' );

    const relaxed = RestPose.load( 'relaxed-standing' );
    const left = RestPose.load( 'weight-left' );
    const right = RestPose.load( 'weight-right' );

    // The bones that carry the shared, deliberately unmirrored stance correction.
    const STANCE_BONES = new Set( [ 'leftUpperLeg', 'rightUpperLeg', 'leftFoot', 'rightFoot' ] );

    // The pelvis mirrors per axis, not per quaternion. See the note above.
    const PER_AXIS_BONES = new Set( [ 'hips' ] );

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

        if ( PER_AXIS_BONES.has( humanoidName ) ) {

            continue;   // asserted below, one axis at a time

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

    // The pelvis, one axis at a time, read off the authored degrees rather than the compiled
    // quaternion — the claim is about the pose DATA, and this is where it is exactly true.
    const hipsRelaxed = relaxedStandingSource.bones.hips.euler;
    const hipsLeft = weightLeftSource.bones.hips.euler;
    const hipsRight = weightRightSource.bones.hips.euler;

    // y mirrors as a delta: the free foot's turn-out depends on it, and relaxed-standing is not
    // symmetric about zero. Mirroring flips the sign, so the two deltas must SUM to nothing.
    const twistLeft = hipsLeft[ 1 ] - hipsRelaxed[ 1 ];
    const twistRight = hipsRight[ 1 ] - hipsRelaxed[ 1 ];

    assert( `pelvis transverse rotation mirrors in its delta  (${ round( twistLeft, 3 ) } vs ` +
        `${ round( twistRight, 3 ) } deg about relaxed-standing's ${ hipsRelaxed[ 1 ] })`,
        Math.abs( twistLeft + twistRight ) < 1e-9 );

    // z mirrors absolutely: the legs' counter-rotations are authored against this number itself.
    assert( `pelvis obliquity mirrors absolutely  (${ round( hipsLeft[ 2 ], 3 ) } vs ` +
        `${ round( hipsRight[ 2 ], 3 ) } deg)`,
        Math.abs( hipsLeft[ 2 ] + hipsRight[ 2 ] ) < 1e-9 );

    // x is zero in all three, and a pelvis that starts flexing is a different pose.
    assert( `pelvis carries no sagittal flexion  (${ hipsLeft[ 0 ] }, ${ hipsRight[ 0 ] } deg)`,
        hipsLeft[ 0 ] === 0 && hipsRight[ 0 ] === 0 );

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

/**
 * 🎯 A CONTRAPPOSTO MUST ARTICULATE THE LEG PAIR, NOT ONLY TRANSLATE IT — the second finding no
 * gate in this repo was looking for, and the reason both weight poses read as a cut-out.
 *
 * A blind visual judge measured 840 frames of a 420 s capture and found the thigh band's camera-left
 * edge moving with SD 8.08 px and its camera-right edge with SD 8.41 px, while the band's WIDTH
 * moved 0.81 px and the gap between the thighs moved 0.17 px — the two edges correlated at r = 0.995.
 * The lower body slid sideways and never changed shape. Traced back to the pose data: at full blend
 * the inter-thigh gap differed from relaxed-standing by **0.35 px** on weight-left and **0.07 px** on
 * weight-right, so no amount of blend could produce articulation that was not authored.
 *
 * WHY IT HAPPENED, because the mechanism is the useful part. With both feet planted, a leg's hip is
 * carried by the pelvis and its ankle is pinned to the floor, so the knee is the only thing on it
 * that can move — and it can only move on a circle, the intersection of a sphere of radius L1 about
 * the hip with a sphere of radius L2 about the ankle. That circle's radius is
 *
 *     (L1 . L2 / D) . sin( knee flexion )
 *
 * which measures 23.8 mm on this figure's near-straight stance leg and 51.5 mm on its free leg at
 * 14.76 degrees of flexion. A LOADED LIMB IS A COLUMN AND HAS NO ARTICULATION TO SPEND; every
 * millimetre the lower body has is on the free side. The poses spent none of it: both legs carried
 * the same counter-rotation to within half a degree, which is COMMON MODE, and common mode is by
 * construction the shape-preserving mode. The only authored asymmetry between the loaded limb and
 * the free one was 8 degrees of knee flexion in the SAGITTAL plane, which a front-on camera cannot
 * resolve at all.
 *
 * WHAT THIS GATE ASSERTS. That each contrapposto changes the inter-thigh gap, measured on the real
 * skinned mesh at the framing `alive.js?frame=body` uses, by more than a stated number of pixels —
 * and that the change is large against the band's translation, because a ratio is what the defect
 * was reported as. Stated in PIXELS AT A NAMED FRAMING rather than in degrees, per LEARNINGS 1.10b:
 * the finger idle was authored at a perfectly reasonable-sounding 0.45 degrees and measured 0.48 px.
 *
 * 🚩 AND IT IS PROVED RED IN BOTH DIRECTIONS, on the committed pre-swivel angles below rather than
 * behind a constructor option. docs/PROGRESS.md records the stance-width gate as the one gate in
 * this repo NOT proven by reintroduction, precisely because its defect lived in JSON data; this one
 * carries its own known-bad data, so that excuse does not survive here.
 */
async function checkContrappostoArticulates() {

    console.log( '\ncontrapposto — the leg pair articulates, it does not only translate' );

    const relaxed = await measureThighBand( RestPose.load( 'relaxed-standing' ) );

    for ( const [ poseName, knownBad ] of Object.entries( PRE_SWIVEL_FREE_LIMB ) ) {

        const shipped = await measureThighBand( RestPose.load( poseName ) );
        const gapChange = Math.abs( shipped.gapPixels - relaxed.gapPixels );
        const travel = Math.abs( shipped.centroidPixels - relaxed.centroidPixels );

        assert( `${ poseName }: inter-thigh gap changes by at least ${ MINIMUM_GAP_CHANGE_PIXELS } px` +
            `  (${ round( gapChange, 2 ) } px, on ${ round( travel, 2 ) } px of band travel)`,
            gapChange >= MINIMUM_GAP_CHANGE_PIXELS );

        assert( `${ poseName }: shape is at least ${ MINIMUM_SHAPE_PER_TRAVEL } of travel` +
            `  (${ round( gapChange / travel, 3 ) })`,
            gapChange / travel >= MINIMUM_SHAPE_PER_TRAVEL );

        // 🚩 The other direction. Same pose, free limb put back the way it was authored before the
        // swivel — the exact angles the judge measured — and the gate has to name it.
        const reintroduced = await measureThighBand( poseWithBones( poseName, knownBad ) );
        const badGapChange = Math.abs( reintroduced.gapPixels - relaxed.gapPixels );

        assert( `${ poseName }: the pre-swivel free limb FAILS this gate` +
            `  (${ round( badGapChange, 2 ) } px, and the gate wants ${ MINIMUM_GAP_CHANGE_PIXELS })`,
            badGapChange < MINIMUM_GAP_CHANGE_PIXELS );

        console.log( `        free-limb knee circle ${ round( kneeCircleRadiusMetres( poseName ) * 1000 ) } mm` +
            `  — the entire articulation budget a planted-foot stance leaves in that leg` );

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

    const { root, skeleton } = await loadFigureOnce();

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

/**
 * The thigh band's silhouette, in pixels, for one pose.
 *
 * 🚩 This RASTERISES rather than projecting joints, and that is load-bearing. The inter-thigh gap is
 * a property of the SKIN — where two thighs stop overlapping on screen — and no bone knows it. Every
 * skinned triangle of every mesh is posed, projected through a reconstruction of `alive.js`'s body
 * camera and filled into a coverage mask, then each row of the band is read as runs: the outermost
 * two edges are the band's extent and the largest interior run of empty pixels is the gap.
 *
 * Rows with anything other than exactly two runs are skipped. Near the crotch the two limbs merge
 * into one run and near the knees a hand can clip the outline; either way the row is not measuring
 * two thighs and averaging it in would quietly dilute the very statistic this exists for.
 */
async function measureThighBand( pose ) {

    const { root, skeleton } = await loadFigureOnce();

    pose.applyTo( skeleton );
    skeleton.update();
    root.updateMatrixWorld( true );

    const camera = bodyFrameCamera( root );
    const mask = new Uint8Array( FRAME_WIDTH * FRAME_HEIGHT );
    const vertex = new Vector3();

    root.traverse( ( object ) => {

        if ( object.isSkinnedMesh !== true ) return;

        const position = object.geometry.attributes.position;
        const index = object.geometry.index;
        const screenX = new Float64Array( position.count );
        const screenY = new Float64Array( position.count );

        for ( let i = 0; i < position.count; i ++ ) {

            vertex.fromBufferAttribute( position, i );
            object.applyBoneTransform( i, vertex );
            object.localToWorld( vertex );
            vertex.project( camera );

            screenX[ i ] = ( vertex.x * 0.5 + 0.5 ) * FRAME_WIDTH;
            screenY[ i ] = ( - vertex.y * 0.5 + 0.5 ) * FRAME_HEIGHT;

        }

        const corners = index === null ? position.count : index.count;

        for ( let t = 0; t < corners; t += 3 ) {

            const a = index === null ? t : index.getX( t );
            const b = index === null ? t + 1 : index.getX( t + 1 );
            const c = index === null ? t + 2 : index.getX( t + 2 );

            fillTriangle( mask, screenX[ a ], screenY[ a ], screenX[ b ], screenY[ b ], screenX[ c ], screenY[ c ] );

        }

    } );

    const firstRow = Math.round( THIGH_BAND_ROWS[ 0 ] * FRAME_HEIGHT );
    const lastRow = Math.round( THIGH_BAND_ROWS[ 1 ] * FRAME_HEIGHT );

    let gapTotal = 0;
    let rowsRead = 0;
    let centroidTotal = 0;
    let pixels = 0;

    for ( let row = firstRow; row <= lastRow; row ++ ) {

        const runs = rowRuns( mask, row );

        if ( runs.length === 2 ) {
            gapTotal += runs[ 1 ][ 0 ] - runs[ 0 ][ 1 ] - 1;
            rowsRead ++;
        }

        for ( const [ from, to ] of runs ) {
            for ( let x = from; x <= to; x ++ ) { centroidTotal += x; pixels ++; }
        }

    }

    assert( `${ pose.name }: the thigh band resolves two limbs on most rows  (${ rowsRead } of ${ lastRow - firstRow + 1 })`,
        rowsRead > ( lastRow - firstRow ) / 2 );

    return { gapPixels: gapTotal / rowsRead, centroidPixels: centroidTotal / pixels };

}

/** Contiguous runs of covered pixels in one row, as [from, to] pairs. */
function rowRuns( mask, row ) {

    const runs = [];
    let start = -1;

    for ( let x = 0; x < FRAME_WIDTH; x ++ ) {

        const covered = mask[ row * FRAME_WIDTH + x ] === 1;

        if ( covered && start < 0 ) start = x;
        if ( covered === false && start >= 0 ) { runs.push( [ start, x - 1 ] ); start = -1; }

    }

    if ( start >= 0 ) runs.push( [ start, FRAME_WIDTH - 1 ] );

    return runs;

}

/** Flat scanline fill, barycentric. No depth: a silhouette is a union, not a visibility problem. */
function fillTriangle( mask, x0, y0, x1, y1, x2, y2 ) {

    const minY = Math.max( 0, Math.floor( Math.min( y0, y1, y2 ) ) );
    const maxY = Math.min( FRAME_HEIGHT - 1, Math.ceil( Math.max( y0, y1, y2 ) ) );
    const minX = Math.max( 0, Math.floor( Math.min( x0, x1, x2 ) ) );
    const maxX = Math.min( FRAME_WIDTH - 1, Math.ceil( Math.max( x0, x1, x2 ) ) );

    if ( minY > maxY || minX > maxX ) return;

    const area = ( x1 - x0 ) * ( y2 - y0 ) - ( x2 - x0 ) * ( y1 - y0 );

    if ( area === 0 ) return;

    for ( let y = minY; y <= maxY; y ++ ) {

        const pixelY = y + 0.5;

        for ( let x = minX; x <= maxX; x ++ ) {

            const pixelX = x + 0.5;
            const u = ( ( x1 - x0 ) * ( pixelY - y0 ) - ( pixelX - x0 ) * ( y1 - y0 ) ) / area;
            const v = ( ( pixelX - x0 ) * ( y2 - y0 ) - ( x2 - x0 ) * ( pixelY - y0 ) ) / area;

            if ( u >= 0 && v >= 0 && u + v <= 1 ) mask[ y * FRAME_WIDTH + x ] = 1;

        }

    }

}

/** `alive.js`'s ?frame=body camera, rebuilt from the figure's own bounding box. */
function bodyFrameCamera( root ) {

    const bounds = new Box3().setFromObject( root );
    const focus = new Vector3( 0, ( bounds.min.y + bounds.max.y ) / 2, 0 );
    const framedHeight = ( bounds.max.y - bounds.min.y ) * FRAME_MARGIN;
    const distance = ( framedHeight / 2 ) / Math.tan( ( FRAME_FIELD_OF_VIEW_DEGREES / 2 ) * Math.PI / 180 );
    const azimuth = FRAME_AZIMUTH_DEGREES * Math.PI / 180;

    const camera = new PerspectiveCamera(
        FRAME_FIELD_OF_VIEW_DEGREES, FRAME_WIDTH / FRAME_HEIGHT, 0.01, 100 );

    camera.position.set( Math.sin( azimuth ) * distance, focus.y, Math.cos( azimuth ) * distance );
    camera.lookAt( focus );
    camera.updateMatrixWorld( true );
    camera.updateProjectionMatrix();

    return camera;

}

/** A pose with some bones overwritten — how the gate reintroduces the defect it was written for. */
function poseWithBones( poseName, eulersByBone ) {

    const data = structuredClone( POSE_SOURCE[ poseName ] );

    for ( const [ bone, euler ] of Object.entries( eulersByBone ) ) {
        data.bones[ bone ] = { euler };
    }

    return new RestPose( data, `${ poseName } (pre-swivel)` );

}

/**
 * The radius of the free limb's reachable knee circle, in metres — the articulation budget a
 * planted-foot stance leaves in that leg. Reported rather than gated: it is the quantity that
 * explains the gate's numbers, and it is a property of the figure as much as of the pose.
 */
function kneeCircleRadiusMetres( poseName ) {

    const skeleton = poseSkeleton( poseName );
    const side = poseName === 'weight-left' ? 'r' : 'l';

    const hip = worldPosition( skeleton, `thigh_${ side }` );
    const knee = worldPosition( skeleton, `calf_${ side }` );
    const ankle = worldPosition( skeleton, `foot_${ side }` );

    const thigh = hip.distanceTo( knee );
    const shank = knee.distanceTo( ankle );
    const span = hip.distanceTo( ankle );

    return thigh * shank * Math.sin( kneeFlexionDegrees( skeleton, side ) * Math.PI / 180 ) / span;

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
