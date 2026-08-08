#!/usr/bin/env node
//
// Gaze.selftest.mjs — proves the gaze layer matches the numbers it claims to be built from.
//
// Run: node packages/core/src/motion/Gaze.selftest.mjs
//
// Users fixate the eyes before they assess anything else about a character, so an error here is
// seen first and forgiven last. That makes this the one motion layer where "it looks right" is
// not evidence — every claim below is measured off the layer's own output while it drives the
// real figure, not off a mock and not off the constants the layer was written with.
//
// What is proved, in order:
//
//   1. The main sequence. Peak velocity is measured by finite-differencing the gaze trace of a
//      commanded saccade at 5, 10, 20 and 30° and compared against the literature anchors
//      (10° ≈ 300°/s, 30° ≈ 500°/s). The whole curve is printed for a reviewer to check.
//   2. Minimum intersaccadic interval ≥ 150 ms, over a long unattended run.
//   3. Fixation durations are exponentially distributed — KS-tested against the exact
//      distribution, using the durations the layer actually scheduled.
//   4. Microsaccades at 1-2/s, 30 arcmin, 25 ms.
//   5. VOR cancels head rotation: turn the head and the eyes counter-rotate by the same angle,
//      leaving the gaze point where it was.
//   6. Head recruitment and the predicted/reactive lead-lag.
//   7. BEAT's conversational proportions, over 1000 gaze decisions per state.
//   8. Determinism: the same seed gives the same trace.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Box3, Euler, Quaternion, Vector3 } from 'three';

import { MotionStack, createMotionTarget } from './MotionStack.js';
import {
    Gaze,
    GAZE_TOWARD_PROBABILITY,
    EYE_MORPH_EXCURSION_DEGREES,
    saccadePeakVelocityDegreesPerSecond,
    saccadeDurationSeconds,
    saccadeProgress
} from './Gaze.js';
import { Blink } from './Blink.js';
import { MotionRandom } from './Signals.js';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here looks at a
// pixel, so the two smallest possible stubs get the loader as far as the morph and skin data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const FIGURE_PATH = path.resolve( HERE, '../../../../assets/figures/figure_g050.glb' );

const MINIMUM_INTERSACCADIC_SECONDS = 0.15;
const FIXATION_MEAN_SECONDS = 0.35;

// Mirrors of the layer's own constants, restated here so a change to either side has to be made
// deliberately in two places rather than silently agreeing with itself.
const HEAD_RECRUITMENT_THRESHOLD_DEGREES = 12;
const EYE_COMFORT_FRACTION = 0.85;
const SUSTAINED_EYE_ECCENTRICITY_FRACTION = 0.35;

const EYE_RANGE_DEGREES = Math.min(
    EYE_MORPH_EXCURSION_DEGREES.in, EYE_MORPH_EXCURSION_DEGREES.out );

/** How far the eye is allowed to go on a transit, and where the layer stops it. */
const EYE_REACH_DEGREES = EYE_RANGE_DEGREES * EYE_COMFORT_FRACTION;

/** The camera in the testbed sits here, so this is the eccentricity a square head has to carry. */
const CAMERA_AZIMUTH_DEGREES = 12;

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

function checkWithin( name, actual, expected, tolerance, unit = '' ) {

    const difference = Math.abs( actual - expected );

    check( name, difference <= tolerance,
        `expected ${ format( expected ) }${ unit } ± ${ format( tolerance ) }, got ${ format( actual ) }${ unit }` );

}

function format( value ) {

    if ( Number.isInteger( value ) ) return String( value );

    return value.toPrecision( 4 ).replace( /0+$/, '' ).replace( /\.$/, '' );

}

// --- the figure ---------------------------------------------------------------------------------

const figureBytes = fs.readFileSync( FIGURE_PATH );

const gltf = await new Promise( ( resolve, reject ) => {

    new GLTFLoader().parse(
        figureBytes.buffer.slice( figureBytes.byteOffset, figureBytes.byteOffset + figureBytes.byteLength ),
        '', resolve, reject );

} );

const figureRoot = gltf.scene;
figureRoot.updateMatrixWorld( true );

const restPose = capturePose( figureRoot );

/**
 * A fresh stack driving the real figure. The rest pose is restored first, because MotionStack
 * snapshots rest from whatever pose the rig is in at bind time — a stack bound after another
 * test has rotated the neck captures a displaced rest and every angle downstream is wrong. This
 * is the reproducibility trap MotionStack's own header warns about, and it is real.
 */
function buildRig( { seed = 20260807, withHead = true, gazeOptions = {} } = {} ) {

    restorePose( restPose );

    const stack = new MotionStack( { seed } );
    stack.bind( createMotionTarget( figureRoot ) );

    const gaze = new Gaze( { rigRoot: figureRoot, ...gazeOptions } );

    if ( withHead ) stack.add( gaze.head );
    stack.add( gaze );

    return { stack, gaze };

}

// --- 1. the main sequence -------------------------------------------------------------------------

const lines = [];

lines.push( 'MAIN SEQUENCE — model against measured, and against the literature' );
lines.push( '' );
lines.push( '  The model is V(A) = 552.9 * ( 1 - exp( -A / 12.788 ) ), solved from the two anchors' );
lines.push( '  the research gives (10 deg = 300 deg/s, 30 deg = 500 deg/s). Duration is derived,' );
lines.push( '  not independent: A = integral of v dt, so D = A / ( 0.75 * V(A) ) for this profile.' );
lines.push( '  "measured" columns are finite-differenced from the layer\'s own gaze trace at 0.5 ms.' );
lines.push( '' );

const mainSequenceRows = [
    [ 'amplitude', 'model peak', 'measured peak', 'model dur', 'measured dur', 'literature' ]
];

const LITERATURE_NOTE = {
    5: '30-40 ms',
    10: '~300 deg/s',
    20: 'saturating',
    30: '~500 deg/s, <100 ms'
};

for ( const amplitude of [ 1, 2, 5, 10, 15, 20, 30, 40, 60 ] ) {

    const measured = measureCommandedSaccade( amplitude );

    mainSequenceRows.push( [
        `${ amplitude }°`,
        `${ saccadePeakVelocityDegreesPerSecond( amplitude ).toFixed( 1 ) } °/s`,
        `${ measured.peakVelocity.toFixed( 1 ) } °/s`,
        `${ ( saccadeDurationSeconds( amplitude ) * 1000 ).toFixed( 1 ) } ms`,
        `${ ( measured.duration * 1000 ).toFixed( 1 ) } ms`,
        LITERATURE_NOTE[ amplitude ] ?? ''
    ] );

    if ( [ 5, 10, 20, 30 ].includes( amplitude ) === false ) continue;

    // 3% of the model value: the measurement is a finite difference over a flat-topped profile,
    // so anything larger than sampling error means the layer is not running the curve it prints.
    checkWithin(
        `main sequence: measured peak velocity at ${ amplitude }°`,
        measured.peakVelocity,
        saccadePeakVelocityDegreesPerSecond( amplitude ),
        saccadePeakVelocityDegreesPerSecond( amplitude ) * 0.03,
        ' °/s'
    );

    checkWithin(
        `main sequence: saccade of ${ amplitude }° actually travels ${ amplitude }°`,
        measured.amplitude, amplitude, 0.02, '°' );

}

for ( const row of formatTable( mainSequenceRows ) ) lines.push( `  ${ row }` );
lines.push( '' );

// The two literature anchors, checked against the model directly rather than through a trace.
checkWithin( 'main sequence: 10° is ~300 °/s (Ruhland et al.)',
    saccadePeakVelocityDegreesPerSecond( 10 ), 300, 1, ' °/s' );
checkWithin( 'main sequence: 30° is ~500 °/s (Ruhland et al.)',
    saccadePeakVelocityDegreesPerSecond( 30 ), 500, 1, ' °/s' );

check( 'main sequence: saturates beyond 15-20° (40° adds under 8% over 30°)',
    saccadePeakVelocityDegreesPerSecond( 40 ) / saccadePeakVelocityDegreesPerSecond( 30 ) < 1.08,
    `ratio ${ ( saccadePeakVelocityDegreesPerSecond( 40 ) / saccadePeakVelocityDegreesPerSecond( 30 ) ).toFixed( 3 ) }` );

check( 'main sequence: 30° saccade completes in under 100 ms',
    saccadeDurationSeconds( 30 ) < 0.1,
    `${ ( saccadeDurationSeconds( 30 ) * 1000 ).toFixed( 1 ) } ms` );

check( 'main sequence: typical 5-10° saccades land in the 30-40 ms band',
    saccadeDurationSeconds( 5 ) >= 0.03 && saccadeDurationSeconds( 10 ) <= 0.045,
    `5° ${ ( saccadeDurationSeconds( 5 ) * 1000 ).toFixed( 1 ) } ms, 10° ${ ( saccadeDurationSeconds( 10 ) * 1000 ).toFixed( 1 ) } ms` );

// The velocity profile has to conserve amplitude exactly, or every saccade lands short or long.
checkWithin( 'velocity profile: progress( 0 ) is 0', saccadeProgress( 0 ), 0, 1e-12 );
checkWithin( 'velocity profile: progress( 1 ) is 1', saccadeProgress( 1 ), 1, 1e-12 );
checkWithin( 'velocity profile: symmetric about the midpoint',
    saccadeProgress( 0.3 ) + saccadeProgress( 0.7 ), 1, 1e-12 );

/**
 * Commands one saccade of a known amplitude and finite-differences the gaze trace it produces.
 *
 * The layer is sampled at 0.5 ms so that even a 25 ms movement gets 50 samples, and the head is
 * left out so that nothing but the saccade itself moves the gaze trace.
 */
function measureCommandedSaccade( amplitudeDegrees ) {

    const { stack, gaze } = buildRig( { withHead: false } );

    const sampleSeconds = 0.0005;

    // Commanded BEFORE the first frame, deliberately. The policy decides a region on the frame
    // it first runs, and that decision would otherwise be the thing being measured; issuing the
    // command first sets the region hold, which is what keeps the policy out of the way.
    const startYaw = gaze.gazeYawDegrees;
    gaze.lookAt( { yawDegrees: startYaw + amplitudeDegrees, pitchDegrees: 0 } );

    // 200 ms of saccade latency, then the movement, then a margin.
    const samples = [];

    for ( let step = 0; step < 700; step ++ ) {

        stack.update( sampleSeconds );
        samples.push( gaze.gazeYawDegrees );

    }

    // The first contiguous run of motion is the commanded saccade; anything after it is the
    // policy resuming, and is deliberately not measured.
    let peakVelocity = 0;
    let firstMovingSample = -1;
    let lastMovingSample = -1;

    for ( let index = 1; index < samples.length; index ++ ) {

        const velocity = Math.abs( samples[ index ] - samples[ index - 1 ] ) / sampleSeconds;

        if ( velocity < 1 ) {

            if ( firstMovingSample !== -1 ) break;
            continue;

        }

        if ( firstMovingSample === -1 ) firstMovingSample = index - 1;
        lastMovingSample = index;

        if ( velocity > peakVelocity ) peakVelocity = velocity;

    }

    return {
        peakVelocity,
        duration: ( lastMovingSample - firstMovingSample ) * sampleSeconds,
        amplitude: Math.abs( samples[ lastMovingSample ] - samples[ firstMovingSample ] )
    };

}

// --- 2, 3, 4. fixation statistics, from a long unattended run --------------------------------------

const RUN_SECONDS = 900;
const RUN_STEP_SECONDS = 1 / 120;

const statistics = runUnattended( RUN_SECONDS, RUN_STEP_SECONDS );

lines.push( `UNATTENDED RUN — ${ RUN_SECONDS } s at ${ ( 1 / RUN_STEP_SECONDS ).toFixed( 0 ) } Hz, idle conversation state` );
lines.push( '' );
lines.push( `  saccades                ${ statistics.saccadeCount } (${ ( statistics.saccadeCount / RUN_SECONDS ).toFixed( 2 ) } /s)` );
lines.push( `  microsaccades           ${ statistics.microsaccadeCount } (${ ( statistics.microsaccadeCount / RUN_SECONDS ).toFixed( 2 ) } /s, research says 1-2 /s)` );
lines.push( `  shortest gap end->start ${ ( statistics.minimumGapSeconds * 1000 ).toFixed( 1 ) } ms (floor is 150 ms)` );
lines.push( `  mean saccade amplitude  ${ statistics.meanAmplitudeDegrees.toFixed( 2 ) }°` );
lines.push( '' );
lines.push( '  fixation durations the layer scheduled, in ms:' );

for ( const row of histogram( statistics.fixationDurations.map( ( value ) => value * 1000 ), 0, 1600, 16 ) ) {

    lines.push( `    ${ row }` );

}

lines.push( '' );

check( 'intersaccadic interval: no gap shorter than 150 ms',
    statistics.minimumGapSeconds >= MINIMUM_INTERSACCADIC_SECONDS - 1e-9,
    `shortest observed ${ ( statistics.minimumGapSeconds * 1000 ).toFixed( 2 ) } ms over ${ statistics.gapCount } gaps` );

// The layer draws from `exponential( 0.35, { min: 0.15 } )`, which CLAMPS rather than shifts, so
// the exact distribution is an exponential with an atom at the floor. KS-testing against that
// exact CDF is the honest test; testing against a plain exponential would fail for the right
// reason and be reported as the wrong one.
const fixationKs = kolmogorovSmirnov( statistics.fixationDurations, ( x ) => {

    if ( x < MINIMUM_INTERSACCADIC_SECONDS ) return 0;

    return 1 - Math.exp( -x / FIXATION_MEAN_SECONDS );

} );

// 1.63 / sqrt(n) is the 1% two-sided critical value. At this sample size a wrong distribution —
// uniform, or gaussian — misses by an order of magnitude, so the test has real power.
const fixationCritical = 1.63 / Math.sqrt( statistics.fixationDurations.length );

check( 'fixation durations are exponentially distributed (KS, α = 0.01)',
    fixationKs < fixationCritical,
    `D = ${ fixationKs.toFixed( 4 ) }, critical ${ fixationCritical.toFixed( 4 ) }, n = ${ statistics.fixationDurations.length }` );

checkWithin( 'fixation durations: mean matches the exponential it is drawn from',
    mean( statistics.fixationDurations ),
    expectedClampedExponentialMean( FIXATION_MEAN_SECONDS, MINIMUM_INTERSACCADIC_SECONDS ),
    0.01, ' s' );

// A uniform distribution over the same range would have CV ≈ 0.35; the exponential's tail is the
// thing that makes fixation timing read as alive rather than as a metronome.
const fixationCv = standardDeviation( statistics.fixationDurations ) / mean( statistics.fixationDurations );

check( 'fixation durations: coefficient of variation is exponential-like, not uniform',
    fixationCv > 0.6,
    `CV = ${ fixationCv.toFixed( 3 ) } (uniform over the same support would be ~0.35)` );

check( 'microsaccades: rate is inside the 1-2 /s the research gives',
    statistics.microsaccadeRate >= 1 && statistics.microsaccadeRate <= 2,
    `${ statistics.microsaccadeRate.toFixed( 3 ) } /s` );

checkWithin( 'microsaccades: mean amplitude is 30 arcmin',
    statistics.meanMicrosaccadeAmplitudeDegrees, 0.5, 0.05, '°' );

check( 'microsaccades: offset stays bounded, so there is no ocular drift',
    statistics.maximumMicrosaccadeOffsetDegrees <= 1.0001,
    `largest offset from the fixation centre ${ statistics.maximumMicrosaccadeOffsetDegrees.toFixed( 3 ) }°` );

function runUnattended( totalSeconds, stepSeconds ) {

    const { stack, gaze } = buildRig( { withHead: true } );

    const fixationDurations = [];
    const amplitudes = [];
    const microsaccadeAmplitudes = [];

    let previousSaccadeCount = 0;
    let previousMicrosaccadeCount = 0;
    let wasSaccading = false;

    let lastSaccadeEndTime = 0;
    let minimumGapSeconds = Infinity;
    let gapCount = 0;
    let maximumOffset = 0;

    let elapsed = 0;

    while ( elapsed < totalSeconds ) {

        stack.update( stepSeconds );
        elapsed += stepSeconds;

        if ( gaze.saccadeCount !== previousSaccadeCount ) {

            previousSaccadeCount = gaze.saccadeCount;
            // The DRAWN interval, not the countdown. Reading `fixationRemaining` here samples it
            // after part of a frame has already been taken off, which pushes draws below the
            // 0.15 s floor where the reference CDF is exactly zero — worth D = 0.343 of KS
            // statistic on a test whose critical value is 0.035, all of it instrument.
            fixationDurations.push( gaze.lastFixationSeconds );
            amplitudes.push( gaze.lastSaccadeAmplitudeDegrees );

            // The gap that matters physiologically is end of one movement to start of the next.
            const gap = elapsed - lastSaccadeEndTime;
            if ( lastSaccadeEndTime > 0 ) {

                gapCount ++;
                if ( gap < minimumGapSeconds ) minimumGapSeconds = gap;

            }

        }

        const isSaccading = gaze.saccade !== null;
        if ( wasSaccading === true && isSaccading === false ) lastSaccadeEndTime = elapsed;
        wasSaccading = isSaccading;

        if ( gaze.microsaccadeCount !== previousMicrosaccadeCount ) {

            previousMicrosaccadeCount = gaze.microsaccadeCount;

            microsaccadeAmplitudes.push( Math.hypot(
                gaze.microsaccadeToYaw - gaze.microsaccadeFromYaw,
                gaze.microsaccadeToPitch - gaze.microsaccadeFromPitch ) );

        }

        const offset = Math.hypot( gaze.microsaccadeYawDegrees, gaze.microsaccadePitchDegrees );
        if ( offset > maximumOffset ) maximumOffset = offset;

    }

    return {
        saccadeCount: gaze.saccadeCount,
        microsaccadeCount: gaze.microsaccadeCount,
        microsaccadeRate: gaze.microsaccadeCount / totalSeconds,
        meanMicrosaccadeAmplitudeDegrees: mean( microsaccadeAmplitudes ),
        maximumMicrosaccadeOffsetDegrees: maximumOffset,
        meanAmplitudeDegrees: mean( amplitudes ),
        fixationDurations,
        minimumGapSeconds,
        gapCount
    };

}

// --- 5. the vestibulo-ocular reflex ----------------------------------------------------------------

lines.push( 'VESTIBULO-OCULAR REFLEX — head turns, gaze point holds' );
lines.push( '' );

/*
 * VOR is tested as a DIFFERENCE between two runs rather than as an absolute, because gaze itself
 * is a stochastic process: the eye angle on frame 400 is a saccade target the policy drew, and
 * comparing it to a hand-computed number would only prove that the test knows the seed.
 *
 * Two runs, same seed, identical in every respect except that one has its head turned by hand.
 * Nothing in the policy reads head rotation, so the two gaze traces must be identical — that is
 * itself asserted below — and every difference in the EYE trace is therefore the reflex and
 * nothing else. With gain 1.0 that difference has to be exactly minus the head angle.
 *
 * The head layer is left out on purpose. VOR's job is to compensate for head motion gaze did NOT
 * ask for: breath, sway, a backchannel nod. Turning the bone by hand is that case exactly.
 */
{
    const HEAD_TEST_YAW_DEGREES = 5;
    const HEAD_TEST_PITCH_DEGREES = 3;
    const FRAMES = 900;

    const still = traceEyes( { headYawDegrees: 0, headPitchDegrees: 0, frames: FRAMES } );
    const turned = traceEyes( {
        headYawDegrees: HEAD_TEST_YAW_DEGREES,
        headPitchDegrees: HEAD_TEST_PITCH_DEGREES,
        frames: FRAMES
    } );

    checkWithin( 'VOR: the turned run reads its head rotation back exactly',
        turned[ FRAMES - 1 ].headYaw, HEAD_TEST_YAW_DEGREES, 0.02, '°' );
    checkWithin( 'VOR: the turned run reads its head pitch back exactly',
        turned[ FRAMES - 1 ].headPitch, HEAD_TEST_PITCH_DEGREES, 0.02, '°' );

    check( 'VOR: turning the head does not perturb the gaze policy',
        still.every( ( sample, frame ) =>
            sample.gazeYaw === turned[ frame ].gazeYaw && sample.gazePitch === turned[ frame ].gazePitch ),
        'if this fails, the difference measured below is not the reflex' );

    // The ocular range is small on this asset, so some frames legitimately have the eye at the end
    // of its REACH and unable to compensate. Those are excluded and counted, not silently averaged
    // in. BOTH runs have to be checked: a frame where the still run is pinned and the turned run is
    // not has a perfectly valid difference that is nevertheless not the head angle.
    //
    // The bound is the reach — EYE_COMFORT_FRACTION of the morph range — and not the morph range
    // itself, because that is where the layer now stops the eye. See applyVestibuloOcularReflex().
    const isPinned = ( sample ) => {

        const pitchReach = EYE_COMFORT_FRACTION * ( sample.eyePitch >= 0
            ? EYE_MORPH_EXCURSION_DEGREES.up : EYE_MORPH_EXCURSION_DEGREES.down );

        return Math.abs( sample.eyeYaw ) >= EYE_REACH_DEGREES - 1e-6 ||
            Math.abs( sample.eyePitch ) >= pitchReach - 1e-6;

    };

    let compared = 0;
    let clamped = 0;
    let largestYawError = 0;
    let largestPitchError = 0;

    for ( let frame = 0; frame < FRAMES; frame ++ ) {

        if ( isPinned( still[ frame ] ) || isPinned( turned[ frame ] ) ) { clamped ++; continue; }

        compared ++;

        largestYawError = Math.max( largestYawError, Math.abs(
            ( turned[ frame ].eyeYaw - still[ frame ].eyeYaw ) + HEAD_TEST_YAW_DEGREES ) );
        largestPitchError = Math.max( largestPitchError, Math.abs(
            ( turned[ frame ].eyePitch - still[ frame ].eyePitch ) + HEAD_TEST_PITCH_DEGREES ) );

    }

    lines.push( `  head turned ${ HEAD_TEST_YAW_DEGREES }° yaw / ${ HEAD_TEST_PITCH_DEGREES }° pitch, ${ FRAMES } frames against an identical run with the head still` );
    lines.push( `  frames compared          ${ compared }` );
    lines.push( `  frames at the eye limit  ${ clamped } (eyes physically cannot compensate; excluded)` );
    lines.push( `  largest yaw residual     ${ largestYawError.toExponential( 2 ) }°` );
    lines.push( `  largest pitch residual   ${ largestPitchError.toExponential( 2 ) }°` );
    lines.push( '' );

    check( 'VOR: enough unclamped frames to be worth measuring', compared > 200,
        `${ compared } of ${ FRAMES }` );

    check( 'VOR: eyes counter-rotate the head yaw exactly, gain 1.0',
        largestYawError < 1e-9, `largest residual ${ largestYawError.toExponential( 3 ) }° over ${ compared } frames` );

    check( 'VOR: eyes counter-rotate the head pitch exactly, gain 1.0',
        largestPitchError < 1e-9, `largest residual ${ largestPitchError.toExponential( 3 ) }° over ${ compared } frames` );
}

/** One run of the eye layer with the head held at a fixed rig-space angle throughout. */
function traceEyes( { headYawDegrees, headPitchDegrees, frames, seed = 31415 } ) {

    const { stack, gaze } = buildRig( { seed, withHead: false } );

    // Listening, and pinned on the partner before the policy gets its first frame: 90% of gaze
    // acts then land on the partner and the eye stays inside its small range often enough for
    // the comparison to have samples to work with.
    gaze.setConversationState( 'listening' );
    gaze.lookAt( { yawDegrees: 0, pitchDegrees: 0 } );

    const headBone = figureRoot.getObjectByName( 'head' );
    const restLocal = headBone.quaternion.clone();
    const restInRig = rotationRelativeTo( headBone, figureRoot );

    const samples = [];

    for ( let frame = 0; frame < frames; frame ++ ) {

        // Re-applied every frame because nothing else is holding the bone there; the head is not
        // a stack channel in this configuration.
        turnHeadInRigSpace( headBone, restLocal, restInRig, headYawDegrees, headPitchDegrees );

        stack.update( 1 / 60 );

        samples.push( {
            gazeYaw: gaze.gazeYawDegrees,
            gazePitch: gaze.gazePitchDegrees,
            eyeYaw: gaze.eyeYawDegrees,
            eyePitch: gaze.eyePitchDegrees,
            headYaw: gaze.headYawDegrees,
            headPitch: gaze.headPitchDegrees
        } );

    }

    turnHeadInRigSpace( headBone, restLocal, restInRig, 0, 0 );

    return samples;

}

/** Puts the head bone at a known rig-space yaw and pitch, conjugating through its rest rotation. */
function turnHeadInRigSpace( headBone, restLocal, restInRig, yawDegrees, pitchDegrees ) {

    const toRadians = Math.PI / 180;
    const restInverse = restInRig.clone().invert();

    const yaw = new Quaternion().setFromAxisAngle(
        new Vector3( 0, 1, 0 ).applyQuaternion( restInverse ), yawDegrees * toRadians );
    const pitch = new Quaternion().setFromAxisAngle(
        new Vector3( 1, 0, 0 ).applyQuaternion( restInverse ), -pitchDegrees * toRadians );

    headBone.quaternion.copy( restLocal ).multiply( yaw.multiply( pitch ) );

}

function rotationRelativeTo( object, ancestor ) {

    const rotation = new Quaternion();

    for ( let node = object; node !== null && node !== ancestor; node = node.parent ) {

        rotation.premultiply( node.quaternion );

    }

    return rotation.normalize();

}

// --- 6. head recruitment, and the predicted/reactive lead-lag ---------------------------------------

lines.push( 'EYE-HEAD COORDINATION' );
lines.push( '' );

{
    const HEAD_ALIGNMENT = 0.7;     // the layer's default
    const THRESHOLD = HEAD_RECRUITMENT_THRESHOLD_DEGREES;
    const COMFORT = EYE_COMFORT_FRACTION;
    const EYE_RANGE = EYE_RANGE_DEGREES;

    check( 'head recruitment: the comfort fraction leaves the literature threshold intact',
        COMFORT * EYE_RANGE >= THRESHOLD,
        `comfort limit ${ ( COMFORT * EYE_RANGE ).toFixed( 2 ) }° must not fall below the ${ THRESHOLD }° ` +
        'recruitment threshold, or shifts under the threshold stop being eyes-only' );

    const rows = [ [ 'gaze shift', 'expected head', 'commanded head', 'settled head', 'settled eye', 'note' ] ];

    for ( const amplitude of [ 5, 10, 12, 20, 30, 45 ] ) {

        const { stack, gaze } = buildRig( { withHead: true } );

        gaze.lookAt( { yawDegrees: amplitude, pitchDegrees: 0 } );

        // 25 frames: past the 200 ms latency and the head's release, but before the earliest
        // possible exploratory saccade (150 ms fixation floor + 100 ms predicted delay after
        // onset at 200 ms = 450 ms = frame 27) can change the head's target.
        for ( let frame = 0; frame < 25; frame ++ ) stack.update( 1 / 60 );

        // The SHARE, not the head's aim. They differ once recentring has taken a hand — see the
        // separate check below, which is about where the head ends up rather than about how much
        // of the shift itself it took.
        const commanded = gaze.commandedHeadYawDegrees;

        for ( let frame = 0; frame < 45; frame ++ ) stack.update( 1 / 60 );

        const settledHead = gaze.headYawDegrees;
        const settledEye = gaze.eyeYawDegrees;

        const expected = Math.max(
            HEAD_ALIGNMENT * Math.max( 0, amplitude - THRESHOLD ),
            Math.max( 0, amplitude - EYE_RANGE * COMFORT ) );

        rows.push( [
            `${ amplitude }°`,
            `${ expected.toFixed( 2 ) }°`,
            `${ commanded.toFixed( 2 ) }°`,
            `${ settledHead.toFixed( 2 ) }°`,
            `${ settledEye.toFixed( 2 ) }°`,
            amplitude <= THRESHOLD ? 'below recruitment threshold' : ''
        ] );

        checkWithin( `head recruitment: ${ amplitude }° shift commands the right head share`,
            commanded, expected, 1e-9, '°' );

        if ( amplitude <= THRESHOLD ) {

            check( `head recruitment: ${ amplitude }° shift is eyes-only`,
                commanded === 0, `head commanded ${ commanded.toFixed( 3 ) }°` );

        }

        // Checked on the COMMANDED share rather than on the settled column: by the time the head
        // has arrived the policy has already chosen its next target, so the settled numbers in
        // the table are a live layer being live and are printed rather than gated. What the rule
        // promises is that the eye's share of the shift never needs the top of its range.
        check( `head recruitment: ${ amplitude }° leaves the eye inside its comfort margin`,
            amplitude - commanded <= EYE_RANGE * COMFORT + 1e-6,
            `eye asked for ${ ( amplitude - commanded ).toFixed( 2 ) }°, comfort limit ` +
            `±${ ( EYE_RANGE * COMFORT ).toFixed( 2 ) }° of a ±${ EYE_RANGE }° range` );

    }

    lines.push( '  Note that at the default alignment of 0.7 the binding constraint above ~20° is' );
    lines.push( '  not the social register at all — it is that the eyes stop at 14.27° on this asset,' );
    lines.push( '  so the head has to take the rest or the gaze never arrives. The head now takes' );
    lines.push( '  enough to leave the eye at 85% of its range rather than exactly ON the limit.' );
    lines.push( '' );

    for ( const row of formatTable( rows ) ) lines.push( `  ${ row }` );
    lines.push( '' );
}

// --- 6a. the head takes over an eccentricity the eyes have been holding ------------------------------
//
// The defect this section exists for. The camera sits 12° off-axis, so a figure looking at whoever
// is behind it has to carry 12° somewhere — and 12° is exactly ON the recruitment threshold and
// inside the comfort margin, so the two rules above BOTH decline to move the head and the eyes hold
// the whole of it for as long as the figure keeps looking. Measured over a five-minute run that was
// 26% of frames within 1.3° of the mechanical limit, and the critic pass read the result as sullen.
//
// What real gaze does instead is settle: the eyes go, the head comes round, and the eyes come back
// toward the middle of the orbit. That is what is checked here — that the head arrives, that the
// eye is left near centre rather than in the corner, and that a glance too brief to be worth
// turning for is still eyes-only.

lines.push( 'HEAD RECENTRING — a held eccentricity is handed to the head' );
lines.push( '' );

// ⚠️ THE THREE GATES BELOW USED TO RUN WITH THE AUTONOMOUS POLICY LIVE, AND TWO OF THEM PASSED
// ON THE DRAW RATHER THAN ON THE BEHAVIOUR. §1.1a. A three-second window contains about 1.7 region
// changes, and a listening figure averts on 10% of them; when it averted, the head was commanded
// somewhere the gate had no expectation about. Re-measured over twelve seeds ON THE PRE-FIX LAYER,
// "the head is no longer left square to the room" passed on 9 of 12 and "setHeadRecentring( false )
// leaves the head alone" on **6 of 12** — a coin toss that had been reading green for two phases
// because the committed seed happened to be a quiet one. (The fix re-drew the arrival times and
// landed on a noisy one, which is the only reason it was ever noticed.)
//
// They now run with `setPolicyEnabled( false )`, so `lookAt()` is the only thing aiming gaze and
// the scenario is the one the gate describes, and they assert over the SAME twelve seeds.

{
    const SUSTAINED_EYE_DEGREES = EYE_RANGE_DEGREES * SUSTAINED_EYE_ECCENTRICITY_FRACTION;
    const SEEDS = [ 20260807, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ];

    /** Three seconds of looking at a partner 12° off-axis, with nothing else deciding anything. */
    function settleOnPartner( seed, gazeOptions = {} ) {

        const { stack, gaze } = buildRig( {
            seed,
            withHead: true,
            gazeOptions: { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES, policy: false, ...gazeOptions }
        } );

        gaze.setConversationState( 'listening' );
        gaze.lookAt( { yawDegrees: CAMERA_AZIMUTH_DEGREES, pitchDegrees: 0 } );

        const eyeYawTrace = [];

        for ( let frame = 0; frame < 180; frame ++ ) {

            stack.update( 1 / 60 );
            eyeYawTrace.push( gaze.eyeYawDegrees );

        }

        // Frame 30 is 0.5 s: the saccade has landed and the head's share (zero, at 12°) has been
        // commanded, but the recentring hold-off has only just expired.
        const result = {
            eyeAtLanding: Math.abs( eyeYawTrace[ 29 ] ),
            eyeAfterSettle: Math.abs( eyeYawTrace[ 179 ] ),
            headYaw: gaze.head.yawDegrees,
            headTarget: gaze.head.targetYawDegrees
        };

        stack.dispose();

        return result;

    }

    const settled = SEEDS.map( ( seed ) => settleOnPartner( seed ) );
    const opted = SEEDS.map( ( seed ) => settleOnPartner( seed, { headRecentring: false } ) );

    lines.push( `  partner ${ CAMERA_AZIMUTH_DEGREES }° off-axis, listening, policy off, ${ SEEDS.length } seeds` );
    lines.push( `  eye yaw at landing (0.5 s)   ${ settled[ 0 ].eyeAtLanding.toFixed( 2 ) }°` );
    lines.push( `  eye yaw after settle (3 s)   ${ settled[ 0 ].eyeAfterSettle.toFixed( 2 ) }°` );
    lines.push( `  head yaw after settle        ${ settled[ 0 ].headYaw.toFixed( 2 ) }°` );
    lines.push( '' );

    check( 'recentring: the eyes carry the whole eccentricity at first, as they should',
        settled.every( ( run ) => run.eyeAtLanding > SUSTAINED_EYE_DEGREES ),
        `worst ${ Math.min( ...settled.map( ( run ) => run.eyeAtLanding ) ).toFixed( 2 ) }° at 0.5 s over ` +
        `${ SEEDS.length } seeds — the eyes lead, the head has not been asked yet` );

    check( 'recentring: the head then comes round and the eyes return toward centre',
        settled.every( ( run ) => run.eyeAfterSettle <= SUSTAINED_EYE_DEGREES + 1.5 ),
        `worst eye ${ Math.max( ...settled.map( ( run ) => run.eyeAfterSettle ) ).toFixed( 2 ) }° against a ` +
        `sustained comfort of ${ SUSTAINED_EYE_DEGREES.toFixed( 2 ) }°, over ${ SEEDS.length } seeds` );

    check( 'recentring: the head is no longer left square to the room',
        settled.every( ( run ) => run.headYaw > CAMERA_AZIMUTH_DEGREES - SUSTAINED_EYE_DEGREES - 1.5 ),
        `worst head ${ Math.min( ...settled.map( ( run ) => run.headYaw ) ).toFixed( 2 ) }° of the ` +
        `${ CAMERA_AZIMUTH_DEGREES }° it is looking at, over ${ SEEDS.length } seeds ` +
        `(the pre-fix gate ran on one seed and held on 9 of these 12)` );

    // The opt-out, so an application driving its own neck can have the old behaviour back.
    check( 'recentring: setHeadRecentring( false ) leaves the head where the shift put it',
        opted.every( ( run ) => Math.abs( run.headTarget ) < 1e-9 ),
        `worst |head target| ${ Math.max( ...opted.map( ( run ) => Math.abs( run.headTarget ) ) ).toExponential( 2 ) }° ` +
        `over ${ SEEDS.length } seeds (the pre-fix gate ran on one seed and held on 6 of these 12)` );

}

{
    // A dart out and back inside the hold-off must NOT drag the head along. This is the whole
    // reason recentring waits before acting: a glance is eyes-only and always was.
    const { stack, gaze } = buildRig( { withHead: true, gazeOptions: { policy: false } } );

    gaze.setHeadRecentring( true );
    gaze.lookAt( { yawDegrees: 10, pitchDegrees: 0 } );

    for ( let frame = 0; frame < 24; frame ++ ) stack.update( 1 / 60 );

    gaze.lookAt( { yawDegrees: 0, pitchDegrees: 0 } );

    for ( let frame = 0; frame < 60; frame ++ ) stack.update( 1 / 60 );

    check( 'recentring: a glance shorter than the hold-off stays eyes-only',
        Math.abs( gaze.head.targetYawDegrees ) < 0.5,
        `head asked for ${ gaze.head.targetYawDegrees.toFixed( 3 ) }° after a 10° dart out and back` );

    stack.dispose();
}

{
    const reactive = measureOnsets( { predicted: false } );
    const predicted = measureOnsets( { predicted: true } );

    lines.push( `  reactive  target: eyes move at ${ ( reactive.eyeOnset * 1000 ).toFixed( 0 ) } ms, head at ${ ( reactive.headOnset * 1000 ).toFixed( 0 ) } ms  (head follows by ${ ( ( reactive.headOnset - reactive.eyeOnset ) * 1000 ).toFixed( 0 ) } ms)` );
    lines.push( `  predicted target: eyes move at ${ ( predicted.eyeOnset * 1000 ).toFixed( 0 ) } ms, head at ${ ( predicted.headOnset * 1000 ).toFixed( 0 ) } ms  (head LEADS by ${ ( ( predicted.eyeOnset - predicted.headOnset ) * 1000 ).toFixed( 0 ) } ms)` );
    lines.push( '' );

    checkWithin( 'reactive target: saccade latency is ~200 ms', reactive.eyeOnset, 0.2, 0.01, ' s' );

    check( 'reactive target: head follows the eyes by 20-50 ms',
        reactive.headOnset - reactive.eyeOnset >= 0.015 && reactive.headOnset - reactive.eyeOnset <= 0.06,
        `${ ( ( reactive.headOnset - reactive.eyeOnset ) * 1000 ).toFixed( 1 ) } ms` );

    checkWithin( 'predicted target: head LEADS the eyes by ~100 ms',
        predicted.eyeOnset - predicted.headOnset, 0.1, 0.015, ' s' );

    check( 'predicted target: the head moves before the eyes, not after',
        predicted.headOnset < predicted.eyeOnset,
        `head ${ ( predicted.headOnset * 1000 ).toFixed( 1 ) } ms, eyes ${ ( predicted.eyeOnset * 1000 ).toFixed( 1 ) } ms` );
}

/** When do the eyes and the head first move after a 30° shift is commanded? */
function measureOnsets( { predicted } ) {

    const { stack, gaze } = buildRig( { withHead: true } );

    const stepSeconds = 0.001;

    const startGaze = gaze.gazeYawDegrees;
    gaze.lookAt( { yawDegrees: startGaze + 30, pitchDegrees: 0 }, { predicted } );

    let eyeOnset = -1;
    let headOnset = -1;

    for ( let step = 1; step <= 400; step ++ ) {

        stack.update( stepSeconds );

        const time = step * stepSeconds;

        if ( eyeOnset === -1 && Math.abs( gaze.gazeYawDegrees - startGaze ) > 0.05 ) eyeOnset = time;
        if ( headOnset === -1 && Math.abs( gaze.head.yawDegrees ) > 0.05 ) headOnset = time;

    }

    return { eyeOnset, headOnset };

}

// --- 6b. how long the eyes spend jammed against the morph limit ---------------------------------------
//
// The one number in this file that is about a PICTURE rather than about a statistic. An eye held
// at the end of eyeLookUp* has its iris tucked under the upper lid with a band of sclera showing
// beneath it — the "rolled back eyes" look — and it is seen instantly because users fixate the
// eyes first. Before the vertical fix this layer spent 15.6% of frames there (8.2% up, 7.4%
// down) with the eyes-only-clamp doing all the work the head should have been doing.
//
// Two measures, because they mean different things. TOTAL counts every frame at the limit,
// including the fifth of a second in which the eyes have arrived and the head is still swinging
// — which is what a real eye does on a large shift and is not a defect. SETTLED counts only
// frames where the head has already reached its target, so an eye still at its limit there is
// PARKED, and parked is the thing that reads as broken.

lines.push( 'OCULAR SATURATION — fraction of frames with an eye pinned at the morph limit,' );
lines.push( 'and how eccentric the eye sits on average. Partner at the testbed camera azimuth.' );
lines.push( '' );

{
    const SECONDS = 300;
    const rows = [ [
        'state', 'seed', 'up', 'down', 'vertical', 'horizontal', 'near limit', 'mean |eye yaw|',
        'settled frames'
    ] ];

    let worstVertical = 0;
    let worstSettledVertical = 0;
    let worstSettledHorizontal = 0;
    let worstNearLimit = 0;
    let worstMeanYaw = 0;

    for ( const state of [ 'idle', 'listening', 'speaking' ] ) {

        for ( const seed of [ 11, 555, 2027, 8123 ] ) {

            const measured = measureSaturation( { state, seed, seconds: SECONDS } );

            rows.push( [
                state,
                String( seed ),
                percent( measured.up ),
                percent( measured.down ),
                percent( measured.vertical ),
                percent( measured.horizontal ),
                percent( measured.nearYawLimit ),
                `${ measured.meanAbsoluteYaw.toFixed( 2 ) }°`,
                String( measured.settledFrames )
            ] );

            worstVertical = Math.max( worstVertical, measured.vertical );
            worstSettledVertical = Math.max( worstSettledVertical, measured.settledVertical );
            worstSettledHorizontal = Math.max( worstSettledHorizontal, measured.settledHorizontal );
            worstNearLimit = Math.max( worstNearLimit, measured.nearYawLimit );
            worstMeanYaw = Math.max( worstMeanYaw, measured.meanAbsoluteYaw );

        }

    }

    for ( const row of formatTable( rows ) ) lines.push( `  ${ row }` );
    lines.push( '' );

    check( 'saturation: vertical eye deflection is at the morph limit on under 2% of frames',
        worstVertical < 0.02,
        `worst of 12 five-minute runs: ${ percent( worstVertical ) } (was 15.6% before the vertical fix)` );

    check( 'saturation: no eye is ever PARKED at its vertical limit once the head has settled',
        worstSettledVertical < 0.005,
        `worst settled vertical ${ percent( worstSettledVertical ) }` );

    check( 'saturation: no eye is ever PARKED at its horizontal limit once the head has settled',
        worstSettledHorizontal < 0.005,
        `worst settled horizontal ${ percent( worstSettledHorizontal ) }` );

    // The two numbers the critic pass actually named. Both are about the picture rather than about
    // any single mechanism, which is why they are gated on the finished layer over five minutes
    // instead of on a commanded shift.
    check( 'saturation: under 5% of frames sit within 2° of the horizontal ocular limit',
        worstNearLimit < 0.05,
        `worst of 12 five-minute runs: ${ percent( worstNearLimit ) } (was 25.9% within 1.3° before recentring)` );

    check( 'saturation: the eye sits under 7° off head-centre on average, not 12',
        worstMeanYaw < 7,
        `worst of 12 five-minute runs: ${ worstMeanYaw.toFixed( 2 ) }° (was 11.3° before recentring)` );
}

function percent( fraction ) {

    return `${ ( fraction * 100 ).toFixed( 2 ) }%`;

}

/**
 * One unattended run, counting the frames on which an eye sits on the edge of its morph range.
 *
 * "Settled" means the head has arrived: within a tenth of a degree of the target Gaze gave it.
 * Anything at the limit before that is the eyes leading a shift the head has not finished.
 */
function measureSaturation( { state, seed, seconds } ) {

    // The partner sits where the testbed camera sits, because that 12° is the eccentricity the
    // whole defect is about — a figure looking at whoever is behind the lens.
    const { stack, gaze } = buildRig( {
        seed,
        withHead: true,
        gazeOptions: { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES }
    } );

    gaze.setConversationState( state );

    const yawLimit = EYE_RANGE_DEGREES;
    const frames = Math.round( seconds * 60 );

    const counts = {
        up: 0, down: 0, horizontal: 0, nearYawLimit: 0, settledVertical: 0, settledHorizontal: 0
    };
    let settledFrames = 0;
    let absoluteYawTotal = 0;

    for ( let frame = 0; frame < frames; frame ++ ) {

        stack.update( 1 / 60 );

        const pitch = gaze.eyePitchDegrees;
        const yaw = gaze.eyeYawDegrees;

        const atTop = pitch >= EYE_MORPH_EXCURSION_DEGREES.up - 1e-6;
        const atBottom = pitch <= -EYE_MORPH_EXCURSION_DEGREES.down + 1e-6;
        const atSide = Math.abs( yaw ) >= yawLimit - 1e-6;

        if ( atTop ) counts.up ++;
        if ( atBottom ) counts.down ++;
        if ( atSide ) counts.horizontal ++;
        if ( Math.abs( yaw ) >= yawLimit - 2 ) counts.nearYawLimit ++;

        absoluteYawTotal += Math.abs( yaw );

        const headSettled =
            Math.abs( gaze.head.yawDegrees - gaze.head.targetYawDegrees ) < 0.1 &&
            Math.abs( gaze.head.pitchDegrees - gaze.head.targetPitchDegrees ) < 0.1;

        if ( headSettled === false ) continue;

        settledFrames ++;
        if ( atTop || atBottom ) counts.settledVertical ++;
        if ( atSide ) counts.settledHorizontal ++;

    }

    stack.dispose();

    return {
        up: counts.up / frames,
        down: counts.down / frames,
        vertical: ( counts.up + counts.down ) / frames,
        horizontal: counts.horizontal / frames,
        nearYawLimit: counts.nearYawLimit / frames,
        meanAbsoluteYaw: absoluteYawTotal / frames,
        // Printed so the two "settled" rates below can be read as the sample sizes they are: the
        // head is in motion most of the time, so settled frames are a minority of the run.
        settledFrames,
        settledVertical: counts.settledVertical / Math.max( settledFrames, 1 ),
        settledHorizontal: counts.settledHorizontal / Math.max( settledFrames, 1 )
    };

}

// --- 7. BEAT's conversational proportions -----------------------------------------------------------

lines.push( 'CONVERSATIONAL GAZE POLICY — BEAT\'s proportions, 1000 gaze decisions per state' );
lines.push( '' );
lines.push( '  ⚠️ TalkingHead ships 0.2 listening / 0.5 speaking, which inverts the Kendon/Argyle' );
lines.push( '  finding — a listener looks at the speaker almost all the time. These are BEAT\'s.' );
lines.push( '' );

{
    const rows = [ [ 'state', 'expected toward', 'measured (decisions)', 'measured (time)', 'n' ] ];

    const scenarios = [
        { label: 'theme (speaking)', expected: GAZE_TOWARD_PROBABILITY.theme,
            apply: ( gaze ) => gaze.setConversationState( 'speaking' ).setDiscourse( 'theme' ) },
        { label: 'rheme (speaking)', expected: GAZE_TOWARD_PROBABILITY.rheme,
            apply: ( gaze ) => gaze.setConversationState( 'speaking' ).setDiscourse( 'rheme' ) },
        { label: 'listening', expected: GAZE_TOWARD_PROBABILITY.listening,
            apply: ( gaze ) => gaze.setConversationState( 'listening' ) },
        { label: 'speaking', expected: GAZE_TOWARD_PROBABILITY.speaking,
            apply: ( gaze ) => gaze.setConversationState( 'speaking' ) },
        { label: 'speaking, fluent', expected: GAZE_TOWARD_PROBABILITY.fluent,
            apply: ( gaze ) => gaze.setConversationState( 'speaking' ).setFluency( 'fluent' ) },
        { label: 'speaking, hesitant', expected: GAZE_TOWARD_PROBABILITY.hesitant,
            apply: ( gaze ) => gaze.setConversationState( 'speaking' ).setFluency( 'hesitant' ) },
        { label: 'idle', expected: GAZE_TOWARD_PROBABILITY.idle,
            apply: ( gaze ) => gaze.setConversationState( 'idle' ) }
    ];

    for ( const scenario of scenarios ) {

        const measured = measureGazeProportions( scenario.apply, 1000 );

        rows.push( [
            scenario.label,
            scenario.expected.toFixed( 3 ),
            measured.decisionProportion.toFixed( 3 ),
            measured.timeProportion.toFixed( 3 ),
            String( measured.decisions )
        ] );

        // 1000 Bernoulli draws have SD ≤ 0.016, so ±0.04 is beyond three sigma at every p here.
        checkWithin( `gaze policy: ${ scenario.label } looks toward the partner as often as BEAT says`,
            measured.decisionProportion, scenario.expected, 0.04 );

        // Region dwell is drawn from the same distribution whichever way the decision goes, so
        // the proportion of TIME has to agree with the proportion of ACTS. This is the check that
        // catches an implementation where "70% away" quietly became "70% of the shifts".
        checkWithin( `gaze policy: ${ scenario.label } spends that share of TIME looking toward`,
            measured.timeProportion, scenario.expected, 0.06 );

    }

    for ( const row of formatTable( rows ) ) lines.push( `  ${ row }` );
    lines.push( '' );
}

function measureGazeProportions( apply, wantedDecisions ) {

    const { stack, gaze } = buildRig( { withHead: true } );

    apply( gaze );

    // A test seam rather than a counter inside the layer: the layer should not carry statistics
    // it only needs when something is measuring it.
    const chooseRegion = gaze.chooseRegion.bind( gaze );
    let towardDecisions = 0;
    let decisions = 0;

    gaze.chooseRegion = () => {

        const region = chooseRegion();
        decisions ++;
        if ( region === 'toward' ) towardDecisions ++;
        return region;

    };

    const stepSeconds = 1 / 60;
    let towardSeconds = 0;
    let totalSeconds = 0;

    while ( decisions < wantedDecisions ) {

        stack.update( stepSeconds );

        totalSeconds += stepSeconds;
        if ( gaze.region === 'toward' ) towardSeconds += stepSeconds;

    }

    return {
        decisions,
        decisionProportion: towardDecisions / decisions,
        timeProportion: towardSeconds / totalSeconds
    };

}

// --- discourse events -------------------------------------------------------------------------------

{
    const { stack, gaze } = buildRig( { withHead: true } );

    gaze.setConversationState( 'speaking' );
    stack.update( 1 / 60 );

    gaze.markFilledPause();

    let avertedThroughout = true;
    for ( let frame = 0; frame < 40; frame ++ ) {

        stack.update( 1 / 60 );
        if ( gaze.isAverting === false ) avertedThroughout = false;

    }

    check( 'filled pause: gaze averts and stays averted for the whole pause', avertedThroughout,
        'aversion during a filled pause is a speech-planning signal, not decoration' );
}

{
    const { stack, gaze } = buildRig( { withHead: true } );

    gaze.setConversationState( 'speaking' );
    stack.update( 1 / 60 );

    gaze.markTurnEnd();
    for ( let frame = 0; frame < 20; frame ++ ) stack.update( 1 / 60 );

    check( 'mutual-break: a speaker ending its turn looks AT the listener',
        gaze.region === 'toward', `region is "${ gaze.region }"` );
}

{
    const { stack, gaze } = buildRig( { withHead: true } );

    gaze.setConversationState( 'listening' );
    stack.update( 1 / 60 );

    gaze.markTurnEnd();
    for ( let frame = 0; frame < 20; frame ++ ) stack.update( 1 / 60 );

    check( 'mutual-break: a listener taking the floor BREAKS mutual gaze',
        gaze.region === 'away', `region is "${ gaze.region }"` );
}

// --- eye morph output ---------------------------------------------------------------------------------

{
    const { stack, gaze } = buildRig( { withHead: false } );

    stack.update( 1 / 60 );
    gaze.lookAt( { yawDegrees: -EYE_MORPH_EXCURSION_DEGREES.in, pitchDegrees: 0 } );
    for ( let frame = 0; frame < 40; frame ++ ) stack.update( 1 / 60 );

    // Gaze to the figure's right: nasal for the LEFT eye, temporal for the RIGHT.
    const inLeft = stack.morphChannels.get( 'eyeLookInLeft' ).committed;
    const outRight = stack.morphChannels.get( 'eyeLookOutRight' ).committed;
    const outLeft = stack.morphChannels.get( 'eyeLookOutLeft' ).committed;

    check( 'eye morphs: a rightward look drives eyeLookInLeft and eyeLookOutRight together',
        inLeft > 0.8 && outRight > 0.8,
        `inLeft ${ inLeft.toFixed( 3 ) }, outRight ${ outRight.toFixed( 3 ) }` );

    check( 'eye morphs: the opposing pair stays at zero, so the eyes do not fight themselves',
        outLeft === 0, `outLeft ${ outLeft }` );

    check( 'eye morphs: no morph is driven past 1.0 by the ocular clamp',
        [ 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeLookDownLeft',
            'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeLookDownRight' ]
            .every( ( name ) => stack.morphChannels.get( name ).peak <= 1.0001 ),
        'the clamp is the measured morph excursion, so weight 1.0 is the asset\'s real limit' );

    check( 'eye morphs: all eight channels exist on the figure',
        stack.conflictReport().missingChannels.length === 0,
        JSON.stringify( stack.conflictReport().missingChannels ) );
}

// --- blink co-occurrence ------------------------------------------------------------------------------

{
    const { stack, gaze } = buildRig( { withHead: true } );

    const requested = [];

    // A stand-in rather than the real Blink, because the contract under test here is the
    // duck-typed lookup: gaze must not care what a blink layer is, only that it can be asked.
    // The real layer is driven in the section below this one.
    stack.add( {
        name: 'blink',
        order: 900,
        enabled: true,
        weight: 1,
        morphChannels: [],
        boneChannels: [],
        contribution: { clear() {} },
        onBind() {},
        reset() {},
        dispose() {},
        update() { return null; },
        triggerWithSaccade( amplitude ) { requested.push( amplitude ); }
    } );

    stack.update( 1 / 60 );
    gaze.lookAt( { yawDegrees: 40, pitchDegrees: 0 } );
    for ( let frame = 0; frame < 30; frame ++ ) stack.update( 1 / 60 );

    check( 'blink co-occurrence: a 40° gaze shift asks the blink layer to fire',
        requested.length === 1 && requested[ 0 ] > 30,
        `requests: ${ JSON.stringify( requested.map( ( value ) => Number( value.toFixed( 1 ) ) ) ) }` );
}

{
    const { stack, gaze } = buildRig( { withHead: true } );

    // No blink layer at all. Gaze must survive that, because Blink.js is a separate punch-list item.
    stack.update( 1 / 60 );
    gaze.lookAt( { yawDegrees: 40, pitchDegrees: 0 } );

    let survived = true;
    try {

        for ( let frame = 0; frame < 30; frame ++ ) stack.update( 1 / 60 );

    } catch ( error ) {

        survived = false;
        check( 'blink co-occurrence: absent blink layer is not an error', false, String( error ) );

    }

    if ( survived ) check( 'blink co-occurrence: absent blink layer is not an error', true );
}

// The same claim against the REAL Blink layer, over a long unattended run. A mock proves the call
// is made; only the real layer proves the wiring survives contact with a stack that has its own
// Poisson clock, its own refractory rule and its own opinion about whether to fire at all. This is
// the check that would have caught the coupling being present in the source and dead in the app.
{
    const measured = measureBlinkCoOccurrence( { coupled: true } );
    const uncoupled = measureBlinkCoOccurrence( { coupled: false } );

    lines.push( 'BLINK CO-OCCURRENCE — the real Blink layer, five minutes unattended' );
    lines.push( '' );
    lines.push( `  large gaze shifts (>=30°)         ${ measured.largeShifts }` );
    lines.push( `  of those, blinked with the shift  ${ measured.coupledBlinks } (${ percent( measured.coupledBlinks / measured.largeShifts ) })` );
    lines.push( `  same run, coupling turned off     ${ uncoupled.coupledBlinks }` );
    lines.push( `  blink rate, coupled / uncoupled   ${ measured.ratePerMinute.toFixed( 1 ) } / ${ uncoupled.ratePerMinute.toFixed( 1 ) } per minute` );
    lines.push( '' );

    check( 'blink co-occurrence: a real Blink layer actually blinks on large gaze shifts',
        measured.coupledBlinks > 0.25 * measured.largeShifts,
        `${ measured.coupledBlinks } of ${ measured.largeShifts } large shifts, against a configured 0.5 probability` );

    check( 'blink co-occurrence: setBlinkCoupling( false ) turns it off',
        uncoupled.coupledBlinks === 0,
        `${ uncoupled.coupledBlinks } coupled blinks with the coupling off` );

    check( 'blink co-occurrence: coupling does not run the blink rate out of its band',
        measured.ratePerMinute <= 32.5,
        `${ measured.ratePerMinute.toFixed( 2 ) }/min against Doughty's 32.5 conversational ceiling` );
}

/**
 * Runs gaze and blink together and counts how often a blink starts on the same frame as a large
 * saccade. Same frame, not "near": the trigger is synchronous with saccade launch, so anything
 * looser would also count the spontaneous blinks that happen to land nearby.
 */
function measureBlinkCoOccurrence( { coupled, seed = 11, seconds = 300 } ) {

    const { stack, gaze } = buildRig( {
        seed,
        withHead: true,
        gazeOptions: { partnerYawDegrees: CAMERA_AZIMUTH_DEGREES }
    } );

    const blink = stack.add( new Blink() );
    gaze.setBlinkCoupling( coupled );

    let largeShifts = 0;
    let coupledBlinks = 0;
    let previousSaccadeCount = gaze.saccadeCount;
    let previousBlinkCount = blink.blinkCount;

    for ( let frame = 0; frame < seconds * 60; frame ++ ) {

        stack.update( 1 / 60 );

        const saccaded = gaze.saccadeCount !== previousSaccadeCount;
        const blinked = blink.blinkCount !== previousBlinkCount;

        previousSaccadeCount = gaze.saccadeCount;
        previousBlinkCount = blink.blinkCount;

        if ( saccaded === false ) continue;
        if ( gaze.lastSaccadeAmplitudeDegrees < 30 ) continue;

        largeShifts ++;
        if ( blinked ) coupledBlinks ++;

    }

    const result = {
        largeShifts,
        coupledBlinks,
        ratePerMinute: blink.blinkCount / ( seconds / 60 )
    };

    stack.dispose();

    return result;

}

// --- 9. the head turns in place: no lateral slide -------------------------------------------------------
//
// 🎯 THE GATE THIS FILE DID NOT HAVE. Every check above measures an ANGLE. The defect that got
// through measured a DISTANCE: a visual judge and then `tools/critic/travel.mjs` reported the head
// out-travelling the hip on screen, and the residue turned out to be this layer swinging the head
// joint sideways every time it turned the head.
//
// The mechanism, and why nothing here saw it. `neck_01` sits below AND BEHIND the head joint, so
// yawing the neck about the room's vertical carries the skull through an arc of radius equal to
// that anterior offset. The head's ORIENTATION was correct throughout — which is all this file
// was measuring — while its POSITION described a 47 mm arc. LEARNINGS §1.11a: a constant justified
// on one quantity (`neckShare`, argued as the smoothest curve from two joints) silently deciding
// another (how far the head slides).
//
// So the gate is stated as a distance, and — LEARNINGS §1.10b — in the unit the defect was judged
// in as well as in millimetres, with the conversion printed beside it. The threshold is this
// project's own recorded indistinguishability floor, 1.6 px at full-body framing (§1.10a).
//
// Four things are checked, and the last three exist because the obvious way to pass the first is
// to break something else:
//
//   1. The head joint does not slide when the head turns.
//   2. The head still turns as far as it was asked to. A "fix" that just moves the head less
//      would pass check 1 and make the figure deader, which is the wrong direction entirely.
//   3. The head stays level. Turning the neck about a forward-leaning column tips the skull
//      toward one shoulder; the head joint has to take that back out.
//   4. The neck still bends. Handing the whole rotation to the head joint also passes check 1,
//      and gives a head bolted to a rigid neck.
//
// Measured in relaxed-standing, because the cervical column's lean is a property of the pose the
// stack actually runs in, and the bind pose is not that pose.

{
    const { Skeleton } = await import( '../figure/Skeleton.js' );
    const { RestPose } = await import( '../figure/RestPose.js' );

    /** LEARNINGS §1.10a — travel below this is not distinguishable at full-body framing. */
    const INDISTINGUISHABLE_PIXELS = 1.6;

    /** alive.js frames the body at the figure's own height plus this margin, over 1200 px. */
    const BODY_FRAME_MARGIN = 1.08;
    const BODY_FRAME_PIXELS = 1200;

    const skeleton = new Skeleton( figureRoot );
    RestPose.load( 'relaxed-standing' ).applyTo( skeleton );
    skeleton.update();
    figureRoot.updateMatrixWorld( true );

    const posedRest = capturePose( figureRoot );

    const bounds = new Box3().setFromObject( figureRoot );
    const framedHeightMillimetres = ( bounds.max.y - bounds.min.y ) * BODY_FRAME_MARGIN * 1000;
    const pixelsPerMillimetre = BODY_FRAME_PIXELS / framedHeightMillimetres;

    const neckBone = figureRoot.getObjectByName( 'neck_01' );
    const headBone = figureRoot.getObjectByName( 'head' );

    const neckAtRest = neckBone.getWorldPosition( new Vector3() );
    const headAtRest = headBone.getWorldPosition( new Vector3() );
    const anteriorOffsetMillimetres = ( headAtRest.z - neckAtRest.z ) * 1000;

    lines.push( 'HEAD TRAVEL — the head turns, and the head joint stays put' );
    lines.push( '' );
    lines.push( `  framed height        ${ framedHeightMillimetres.toFixed( 1 ) } mm over ` +
        `${ BODY_FRAME_PIXELS } px = ${ pixelsPerMillimetre.toFixed( 4 ) } px/mm` );
    lines.push( `  neck_01 -> head      ${ ( ( headAtRest.y - neckAtRest.y ) * 1000 ).toFixed( 1 ) } mm up, ` +
        `${ anteriorOffsetMillimetres.toFixed( 1 ) } mm forward` );

    /**
     * Holds one commanded head angle until the smoother has settled, then reports where the head
     * ended up — in position and in orientation. `axis` selects the cervical axis: 'column' is
     * what ships, 'vertical' restores the pre-fix behaviour so the gate can be proven red.
     */
    function settleHeadAt( yawDegrees, { axis = 'column' } = {} ) {

        restorePose( posedRest );

        const stack = new MotionStack( { seed: 20260807 } );
        stack.bind( createMotionTarget( figureRoot ) );

        // This section is about the cervical CHAIN — where a commanded head angle puts the skull —
        // so nothing else may aim the head. The policy is off and recentring is off, which leaves
        // `setTarget` below as the only thing writing a target.
        //
        // ⚠️ It used to rely on ordering instead: "HEAD runs before GAZE, so the value set here is
        // the value the head bone uses on this frame." That stopped being true when the whole
        // ocular walk moved into the head slot so that the bone could carry the CURRENT frame's
        // decisions (see `Gaze.advanceOcularState`), and the policy then overwrote this target
        // inside the frame — worth 5.65° of realised-yaw error. Turning the other authors off is
        // what the test meant all along; the ordering was scaffolding.
        const gaze = new Gaze( { rigRoot: figureRoot, policy: false, headRecentring: false } );
        stack.add( gaze.head );
        stack.add( gaze );

        if ( axis === 'vertical' ) gaze.head.cervicalColumn.set( 0, 1, 0 );

        const column = {
            tiltDegrees: gaze.head.cervicalTiltDegrees,
            lengthMillimetres: gaze.head.cervicalLengthMetres * 1000
        };

        for ( let frame = 0; frame < 180; frame ++ ) {

            gaze.head.setTarget( yawDegrees, 0 );
            stack.update( 1 / 60 );

        }

        figureRoot.updateMatrixWorld( true );

        const headPosition = headBone.getWorldPosition( new Vector3() );
        const headRotation = rotationRelativeTo( headBone, figureRoot );
        const neckRotation = rotationRelativeTo( neckBone, figureRoot );

        stack.dispose();

        return { column, headPosition, headRotation, neckRotation };
    }

    /** Yaw / pitch / roll of a rig-space rotation, relative to the same rotation at yaw zero. */
    function relativeAngles( rotation, reference ) {

        const relative = reference.clone().invert().premultiply( rotation );
        const euler = new Euler().setFromQuaternion( relative, 'YXZ' );

        return {
            yaw: euler.y * 180 / Math.PI,
            pitch: euler.x * 180 / Math.PI,
            roll: euler.z * 180 / Math.PI
        };

    }

    const SWEEP_DEGREES = [ 10, 20, 30, 40, 55 ];

    for ( const axis of [ 'column', 'vertical' ] ) {

        const zero = settleHeadAt( 0, { axis } );

        if ( axis === 'column' ) {

            lines.push( `  cervical column      ${ zero.column.lengthMillimetres.toFixed( 1 ) } mm, ` +
                `leaning ${ zero.column.tiltDegrees.toFixed( 2 ) }° forward of vertical` );
            lines.push( '' );
            lines.push( [ 'commanded', 'head slide', 'in pixels', 'realised yaw', 'head roll', 'neck yaw' ]
                .map( ( heading ) => heading.padStart( 13 ) ).join( '' ) );

        }

        let worstSlideMillimetres = 0;
        let worstYawErrorDegrees = 0;
        let worstRollDegrees = 0;
        let smallestNeckShare = Infinity;

        for ( const commanded of SWEEP_DEGREES ) {

            const settled = settleHeadAt( commanded, { axis } );

            const slideMillimetres =
                Math.abs( settled.headPosition.x - zero.headPosition.x ) * 1000;
            const head = relativeAngles( settled.headRotation, zero.headRotation );
            const neck = relativeAngles( settled.neckRotation, zero.neckRotation );

            worstSlideMillimetres = Math.max( worstSlideMillimetres, slideMillimetres );
            worstYawErrorDegrees = Math.max( worstYawErrorDegrees, Math.abs( head.yaw - commanded ) );
            worstRollDegrees = Math.max( worstRollDegrees, Math.abs( head.roll ) );
            smallestNeckShare = Math.min( smallestNeckShare, Math.abs( neck.yaw ) / commanded );

            if ( axis === 'column' ) {

                lines.push( [
                    `${ commanded }°`,
                    `${ slideMillimetres.toFixed( 2 ) } mm`,
                    `${ ( slideMillimetres * pixelsPerMillimetre ).toFixed( 2 ) } px`,
                    `${ head.yaw.toFixed( 2 ) }°`,
                    `${ head.roll.toFixed( 2 ) }°`,
                    `${ neck.yaw.toFixed( 2 ) }°`
                ].map( ( cell ) => cell.padStart( 13 ) ).join( '' ) );

            }

        }

        const worstSlidePixels = worstSlideMillimetres * pixelsPerMillimetre;

        if ( axis === 'column' ) {

            check( 'head travel: turning the head does not slide the head joint sideways',
                worstSlidePixels < INDISTINGUISHABLE_PIXELS,
                `worst over ${ SWEEP_DEGREES.join( '/' ) }°: ${ worstSlideMillimetres.toFixed( 2 ) } mm = ` +
                `${ worstSlidePixels.toFixed( 2 ) } px, against the ${ INDISTINGUISHABLE_PIXELS } px floor` );

            check( 'head travel: the head still turns as far as it was asked to',
                worstYawErrorDegrees < 0.5,
                `worst realised-yaw error ${ worstYawErrorDegrees.toFixed( 3 ) }° — a fix that moved the ` +
                'head LESS would pass the slide check and make the figure deader' );

            check( 'head travel: the head stays level while it turns',
                worstRollDegrees < 1,
                `worst head roll ${ worstRollDegrees.toFixed( 3 ) }°; turning about the leaning column ` +
                'tips the skull toward one shoulder and the head joint has to take it back out' );

            check( 'head travel: the neck still carries its share of the turn',
                smallestNeckShare > 0.25,
                `smallest neck yaw share ${ smallestNeckShare.toFixed( 3 ) } of the commanded angle — ` +
                'handing the whole turn to the head joint also stops the slide, and reads as bolted-on' );

        } else {

            // §1.1: the gate is only trustworthy once it has been seen to fail. This is the
            // shipped-before behaviour, restored by putting the cervical axis back on the room's
            // vertical, and it is the arc the anterior offset predicts.
            const predictedMillimetres = Math.abs( anteriorOffsetMillimetres ) *
                Math.sin( Math.max( ...SWEEP_DEGREES ) * 0.5 * Math.PI / 180 );

            check( 'head travel: KNOWN-BAD — the pre-fix vertical axis fails this gate',
                worstSlidePixels >= INDISTINGUISHABLE_PIXELS,
                `${ worstSlideMillimetres.toFixed( 2 ) } mm = ${ worstSlidePixels.toFixed( 2 ) } px, ` +
                `against ${ INDISTINGUISHABLE_PIXELS } px` );

            checkWithin( 'head travel: KNOWN-BAD — the slide is the arc the anterior offset predicts',
                worstSlideMillimetres, predictedMillimetres, 1.5, ' mm' );

        }

    }

    lines.push( '' );

    // And the same quantity over the layer's own unattended behaviour, which is the form the
    // defect was reported in: how far does this layer alone move the head sideways over minutes?
    // Sway is not in this stack, so every millimetre here is gaze's.
    {
        const UNATTENDED_SECONDS = 300;

        for ( const axis of [ 'column', 'vertical' ] ) {

            restorePose( posedRest );

            const stack = new MotionStack( { seed: 1 } );
            stack.bind( createMotionTarget( figureRoot ) );

            const gaze = new Gaze( { rigRoot: figureRoot, partnerYawDegrees: CAMERA_AZIMUTH_DEGREES } );
            stack.add( gaze.head );
            stack.add( gaze );

            if ( axis === 'vertical' ) gaze.head.cervicalColumn.set( 0, 1, 0 );

            const lateral = [];
            const yawTrace = [];

            for ( let frame = 0; frame < UNATTENDED_SECONDS * 30; frame ++ ) {

                stack.update( 1 / 30 );
                figureRoot.updateMatrixWorld( true );
                lateral.push( headBone.getWorldPosition( new Vector3() ).x * 1000 );
                yawTrace.push( gaze.headYawDegrees );

            }

            stack.dispose();

            const lateralSd = standardDeviation( lateral );
            const lateralPixels = lateralSd * pixelsPerMillimetre;

            lines.push( `  unattended ${ UNATTENDED_SECONDS } s, ${ axis.padEnd( 8 ) } ` +
                `head lateral ${ lateralSd.toFixed( 2 ) } mm SD = ${ lateralPixels.toFixed( 2 ) } px, ` +
                `head yaw ${ standardDeviation( yawTrace ).toFixed( 2 ) }° SD` );

            if ( axis === 'column' ) {

                check( 'head travel: unattended, this layer alone keeps the head under the floor',
                    lateralPixels < INDISTINGUISHABLE_PIXELS,
                    `${ lateralSd.toFixed( 2 ) } mm SD = ${ lateralPixels.toFixed( 2 ) } px over ` +
                    `${ UNATTENDED_SECONDS } s, against the ${ INDISTINGUISHABLE_PIXELS } px floor` );

            } else {

                check( 'head travel: KNOWN-BAD — unattended, the pre-fix axis fails it',
                    lateralPixels >= INDISTINGUISHABLE_PIXELS,
                    `${ lateralSd.toFixed( 2 ) } mm SD = ${ lateralPixels.toFixed( 2 ) } px` );

            }

        }
    }

    // --- how far the head TURNS in idle, which is a different claim from how far it TRAVELS ------
    //
    // 🎯 The section above gates head SLIDE — the joint must not translate. Nothing gated how far
    // the head ROTATES, and a visual judge reported the head out-travelling the pelvis. Measured on
    // this layer at seed 1 over 420 s: the head yaw's median MAGNITUDE is 19.29 degrees, it is past
    // five degrees on 81% of frames, and it sweeps 63 degrees inside a median 15-second window. A
    // silent figure waiting is not looking around a room.
    //
    // ⚠️ BOTH STATES ARE MEASURED AND ONLY ONE IS GATED, deliberately. `idleAversionScaled` fixes
    // the amplitude and takes the FRAME-RATE INVARIANCE section red; it ships OFF for that reason,
    // and the amplitude is therefore a RECORDED SHORTFALL rather than a passing gate. Recording it
    // as a gate is what stops the next reader assuming the head amplitude is settled.
    {
        const IDLE_SECONDS = 420;
        const measured = {};

        for ( const scaled of [ false, true ] ) {

            restorePose( posedRest );

            const stack = new MotionStack( { seed: 1 } );
            stack.bind( createMotionTarget( figureRoot ) );

            const gaze = new Gaze( {
                rigRoot: figureRoot,
                partnerYawDegrees: CAMERA_AZIMUTH_DEGREES,
                idleAversionScaled: scaled
            } );

            stack.add( gaze.head );
            stack.add( gaze );

            const magnitudes = [];
            let pastFive = 0;

            for ( let frame = 0; frame < IDLE_SECONDS * 30; frame ++ ) {

                stack.update( 1 / 30 );

                const magnitude = Math.abs( gaze.headYawDegrees );

                magnitudes.push( magnitude );
                if ( magnitude > 5 ) pastFive ++;

            }

            stack.dispose();

            magnitudes.sort( ( a, b ) => a - b );

            measured[ scaled ? 'scaled' : 'shipped' ] = {
                median: magnitudes[ Math.floor( 0.5 * magnitudes.length ) ],
                p90: magnitudes[ Math.floor( 0.9 * magnitudes.length ) ],
                pastFivePercent: 100 * pastFive / magnitudes.length
            };

        }

        lines.push( `  idle head yaw |deg|, ${ IDLE_SECONDS } s at seed 1:` );

        for ( const [ label, report ] of Object.entries( measured ) ) {

            lines.push( `    ${ label.padEnd( 8 ) } median ${ report.median.toFixed( 2 ) }, ` +
                `p90 ${ report.p90.toFixed( 2 ) }, past 5 deg on ${ report.pastFivePercent.toFixed( 1 ) }% of frames` );

        }

        // The forward claim, on the state that is actually shipped, stated as the shortfall it is.
        check( 'idle head yaw: RECORDED SHORTFALL — the shipped default is past 5 deg on most frames',
            measured.shipped.pastFivePercent > 50,
            `${ measured.shipped.pastFivePercent.toFixed( 1 ) }% of frames, median ` +
            `${ measured.shipped.median.toFixed( 2 ) } deg. Recorded, not tolerated: head recruitment ` +
            'is supposed to be the exception. See IDLE_AVERSION_CEILING_IN_RECRUITMENT_THRESHOLDS' );

        // And the fix is measured beside it, so the size of the available win is a number rather
        // than a claim in a comment.
        check( 'idle head yaw: the available fix is measured, not asserted',
            measured.scaled.median < 0.5 * measured.shipped.median,
            `idleAversionScaled halves it: median ${ measured.shipped.median.toFixed( 2 ) } -> ` +
            `${ measured.scaled.median.toFixed( 2 ) } deg, past-5 ${ measured.shipped.pastFivePercent.toFixed( 1 ) } -> ` +
            `${ measured.scaled.pastFivePercent.toFixed( 1 ) }%. It is OFF because it takes the ` +
            'invariance section red; see the constant' );

    }

    lines.push( '' );

    // Leave the rig in the bind pose the rest of this file was written against.
    restorePose( restPose );
    figureRoot.updateMatrixWorld( true );
}

// --- 8. determinism ------------------------------------------------------------------------------------

{
    const trace = ( seed ) => {

        const { stack, gaze } = buildRig( { seed, withHead: true } );
        const samples = [];

        for ( let frame = 0; frame < 1800; frame ++ ) {

            stack.update( 1 / 60 );
            samples.push( gaze.eyeYawDegrees, gaze.eyePitchDegrees, gaze.head.yawDegrees );

        }

        return samples;

    };

    const first = trace( 4242 );
    const second = trace( 4242 );
    const different = trace( 9999 );

    check( 'determinism: the same seed gives an identical 1800-frame trace',
        first.every( ( value, index ) => value === second[ index ] ),
        `${ first.length } samples compared` );

    check( 'determinism: a different seed gives a different trace',
        first.some( ( value, index ) => value !== different[ index ] ) );
}

{
    const { stack, gaze } = buildRig( { seed: 777, withHead: true } );

    const collect = () => {

        const samples = [];
        for ( let frame = 0; frame < 600; frame ++ ) {

            stack.update( 1 / 60 );
            samples.push( gaze.eyeYawDegrees );

        }
        return samples;

    };

    const before = collect();

    restorePose( restPose );
    stack.captureRestPose();
    stack.reset();

    const after = collect();

    check( 'reset(): the layer returns to frame zero, not merely to a rewound random stream',
        before.every( ( value, index ) => value === after[ index ] ),
        'a layer that resets only its stream restarts mid-saccade and diverges' );
}

// --- 10. frame-rate invariance ----------------------------------------------------------------------
//
// 🎯 THE ONE GATE EVERY OTHER GATE IN THIS FILE IS BLIND TO. LEARNINGS §1.13.
//
// Everything above is measured at a single frame rate, so all of it is satisfied by a layer whose
// trajectory depends on how often it is looked at. This layer's did. Same seed, same simulated
// instants, 300 s: 691 saccades at 30 Hz against 721 at 60 Hz, head yaw agreeing to pearson
// r = 0.017, worst disagreement 76.6°. A judge captures at 30 fps and every gate here ran at 60,
// so every head number in the repo described a trajectory no camera had rendered.
//
// The measurement is world-space, because degrees are not what a viewer sees. The two eyeball
// globes are weighted 100% to the head bone, so their centroids — measured off the asset, not
// declared — are landmarks rigidly attached to it, 88.73 mm from the head joint in the transverse
// plane. That lever turns a head angle into on-screen travel: 1° of head yaw is 1.04 px at the
// body framing, so the pre-fix 76.6° was about 70 px of it.

lines.push( 'FRAME-RATE INVARIANCE — the same seed at 30, 60 and 120 Hz' );
lines.push( '' );

{
    const { Skeleton } = await import( '../figure/Skeleton.js' );
    const { RestPose } = await import( '../figure/RestPose.js' );

    const INVARIANCE_SEEDS = [ 1, 20260807, 4242 ];
    const INVARIANCE_RATES = [ 30, 60, 120 ];
    const INVARIANCE_SECONDS = 300;

    /** LEARNINGS §1.10a — travel below this is not distinguishable at full-body framing. */
    const INDISTINGUISHABLE_PIXELS = 1.6;

    /**
     * Worst permitted disagreement between two frame rates, at a matched simulated instant, over
     * every landmark. Measured worst across the three seeds is 0.207 mm, so this is 2.4× headroom,
     * and in the unit the defect is judged in it is 0.33 px — a fifth of the floor above. It is not
     * zero because two residues are inherent and are named in `Gaze.advanceOcularState`; the
     * frame-coupled rebuild below misses it by more than two orders of magnitude either way.
     */
    const INVARIANCE_TOLERANCE_MM = 0.5;

    /**
     * The same statement for the eyes. Measured worst across the three seeds is 0.082°, so this is
     * 2.4× headroom as well, and at the portrait framing — the close crop where an iris is worth
     * pixels — it is 0.09 px of pupil travel against a 1.6 px floor.
     */
    const INVARIANCE_EYE_TOLERANCE_DEGREES = 0.2;

    /**
     * LEARNINGS Part 3: the committed portrait region files are authored at 0.42 m of framed
     * height over 1200 px. Quoted rather than re-derived, because it is a property of the page's
     * camera constants and not of this rig.
     */
    const PORTRAIT_PIXELS_PER_MILLIMETRE = 1200 / 420;

    /**
     * Eyeball globe radius, quoted from LEARNINGS Part 2 ("the globe radius (15.11–15.50 mm)")
     * rather than re-measured here. The top of the recorded range is used deliberately: it is the
     * radius that turns a given eye rotation into the MOST pupil travel, so every pixel figure
     * below is the worst case rather than a flattering one.
     *
     * ⚠️ It is not re-derived because a naive re-derivation gets it wrong. The mean vertex distance
     * from the `high-poly` centroid is 11.13 mm on this asset — the mesh is not a bare sphere, and
     * fitting a reference surface through the feature is the mistake §1.11d is about. When a number
     * is already measured and recorded, quote it.
     */
    const GLOBE_RADIUS_MILLIMETRES = 15.50;

    // The framing, measured in relaxed-standing because that is the pose alive.js renders, then
    // the rig is put back so the traces run in the same pose every other section used.
    const skeleton = new Skeleton( figureRoot );
    RestPose.load( 'relaxed-standing' ).applyTo( skeleton );
    skeleton.update();
    figureRoot.updateMatrixWorld( true );

    const framedHeightMillimetres = new Box3().setFromObject( figureRoot ).getSize( new Vector3() ).y * 1.08 * 1000;
    const pixelsPerMillimetre = 1200 / framedHeightMillimetres;

    restorePose( restPose );
    figureRoot.updateMatrixWorld( true );

    const headBone = figureRoot.getObjectByName( 'head' );

    const eyeLandmarks = measureEyeLandmarksInHeadBindFrame();

    const leverMillimetres = Math.hypot( eyeLandmarks[ 0 ].x, eyeLandmarks[ 0 ].z ) * 1000;
    const pixelsPerDegreeOfHeadYaw = leverMillimetres * ( Math.PI / 180 ) * pixelsPerMillimetre;

    lines.push( `  eye-globe centroids, head bind frame  ±${ ( eyeLandmarks[ 0 ].x * 1000 ).toFixed( 2 ) } mm lateral, ` +
        `${ ( eyeLandmarks[ 0 ].z * 1000 ).toFixed( 2 ) } mm anterior of the head joint` );
    lines.push( `  interpupillary distance               ${ ( eyeLandmarks[ 0 ].distanceTo( eyeLandmarks[ 1 ] ) * 1000 ).toFixed( 2 ) } mm (measured, not declared)` );
    lines.push( `  lever in the transverse plane         ${ leverMillimetres.toFixed( 2 ) } mm` );
    lines.push( `  body framing                          ${ framedHeightMillimetres.toFixed( 1 ) } mm over 1200 px = ${ pixelsPerMillimetre.toFixed( 4 ) } px/mm` );
    lines.push( `  so one degree of head yaw is          ${ pixelsPerDegreeOfHeadYaw.toFixed( 3 ) } px of eye-landmark travel` );
    lines.push( '' );

    const shipped = INVARIANCE_SEEDS.map( ( seed ) => compareAcrossRates( seed, {} ) );
    const coupled = INVARIANCE_SEEDS.map( ( seed ) => compareAcrossRates( seed, { frameCoupledArrivals: true } ) );
    const laggedVor = INVARIANCE_SEEDS.map( ( seed ) => compareAcrossRates( seed, { frameCoupledVestibuloOcular: true } ) );

    lines.push( '            seed   worst landmark      worst head    worst eye   saccades at 30/60/120   microsaccades/s' );

    for ( const [ label, group ] of [ [ 'shipped', shipped ], [ 'KNOWN-BAD', coupled ], [ 'lagged VOR', laggedVor ] ] ) {

        for ( const run of group ) {

            lines.push( `  ${ label.padStart( 9 ) } ${ String( run.seed ).padStart( 9 ) }   ` +
                `${ run.worstMillimetres.toFixed( 4 ).padStart( 9 ) } mm = ${ ( run.worstMillimetres * pixelsPerMillimetre ).toFixed( 3 ).padStart( 7 ) } px   ` +
                `${ run.worstHeadDegrees.toFixed( 4 ).padStart( 8 ) }°   ${ run.worstEyeDegrees.toFixed( 4 ).padStart( 8 ) }°   ` +
                `${ run.saccades.join( ' / ' ).padStart( 21 ) }   ${ run.microsaccadeRates.map( ( rate ) => rate.toFixed( 2 ) ).join( ' / ' ) }` );

        }

    }

    lines.push( '' );

    const worstShippedMillimetres = Math.max( ...shipped.map( ( run ) => run.worstMillimetres ) );
    const worstCoupledMillimetres = Math.max( ...coupled.map( ( run ) => run.worstMillimetres ) );

    check( 'frame rate: the same seed puts the head in the same place at 30, 60 and 120 Hz',
        worstShippedMillimetres <= INVARIANCE_TOLERANCE_MM,
        `worst ${ worstShippedMillimetres.toFixed( 4 ) } mm = ${ ( worstShippedMillimetres * pixelsPerMillimetre ).toFixed( 3 ) } px ` +
        `over ${ INVARIANCE_SEEDS.length } seeds × ${ INVARIANCE_SECONDS } s, against a ${ INVARIANCE_TOLERANCE_MM } mm tolerance` );

    check( 'frame rate: and that is well under the indistinguishability floor',
        worstShippedMillimetres * pixelsPerMillimetre < INDISTINGUISHABLE_PIXELS,
        `${ ( worstShippedMillimetres * pixelsPerMillimetre ).toFixed( 3 ) } px against the ${ INDISTINGUISHABLE_PIXELS } px floor` );

    // The eye is a separate assertion because the landmark gate above structurally cannot make it:
    // the eight ARKit morphs rotate the globes INSIDE a head bone the gate is measuring the
    // position of, so an eye angle can be wrong by the whole orbit with every landmark exact.
    const pixelsPerDegreeOfEyeYaw = GLOBE_RADIUS_MILLIMETRES * ( Math.PI / 180 ) * PORTRAIT_PIXELS_PER_MILLIMETRE;

    const worstShippedEyeDegrees = Math.max( ...shipped.map( ( run ) => run.worstEyeDegrees ) );
    const worstLaggedEyeDegrees = Math.max( ...laggedVor.map( ( run ) => run.worstEyeDegrees ) );

    lines.push( `  eye globe radius ${ GLOBE_RADIUS_MILLIMETRES.toFixed( 2 ) } mm (quoted, LEARNINGS Part 2), portrait framing ` +
        `${ PORTRAIT_PIXELS_PER_MILLIMETRE.toFixed( 4 ) } px/mm, so one degree of eye yaw is ` +
        `${ pixelsPerDegreeOfEyeYaw.toFixed( 3 ) } px of pupil travel` );
    lines.push( '' );

    check( 'frame rate: the eyes point the same way at 30, 60 and 120 Hz too',
        worstShippedEyeDegrees <= INVARIANCE_EYE_TOLERANCE_DEGREES,
        `worst ${ worstShippedEyeDegrees.toFixed( 4 ) }° = ${ ( worstShippedEyeDegrees * pixelsPerDegreeOfEyeYaw ).toFixed( 3 ) } px ` +
        `of pupil travel at portrait framing, against a ${ INVARIANCE_EYE_TOLERANCE_DEGREES }° tolerance` );

    check( 'frame rate: KNOWN-BAD — a vestibulo-ocular reflex latency of one FRAME fails it',
        laggedVor.every( ( run ) => run.worstEyeDegrees > INVARIANCE_EYE_TOLERANCE_DEGREES ),
        `${ laggedVor.filter( ( run ) => run.worstEyeDegrees > INVARIANCE_EYE_TOLERANCE_DEGREES ).length } of ` +
        `${ INVARIANCE_SEEDS.length } seeds caught; worst ${ worstLaggedEyeDegrees.toFixed( 3 ) }° = ` +
        `${ ( worstLaggedEyeDegrees * pixelsPerDegreeOfEyeYaw ).toFixed( 2 ) } px, past the ${ INDISTINGUISHABLE_PIXELS } px floor ` +
        `— and note its HEAD is still exact at ${ Math.max( ...laggedVor.map( ( run ) => run.worstMillimetres ) ).toFixed( 4 ) } mm, ` +
        `so the landmark gate alone would have shipped it` );

    check( 'frame rate: every event lands at the same instant, so the counts are identical',
        shipped.every( ( run ) => new Set( run.saccades ).size === 1 && new Set( run.microsaccades ).size === 1 ),
        `saccades ${ shipped.map( ( run ) => run.saccades.join( '/' ) ).join( ', ' ) }; ` +
        `microsaccades ${ shipped.map( ( run ) => run.microsaccades.join( '/' ) ).join( ', ' ) }` );

    check( 'frame rate: the sub-frame walk never runs out of its step budget',
        shipped.every( ( run ) => run.exhausted === 0 ),
        `worst ${ Math.max( ...shipped.map( ( run ) => run.worstSteps ) ) } sub-steps in a frame, against a budget of 64` );

    // 🚩 §1.1 — the rejection, over the SAME seeds as the gate, asserting the count rather than
    // one verdict (§1.1a).
    check( 'frame rate: KNOWN-BAD — the gate rejects frame-coupled arrivals, on every seed',
        coupled.filter( ( run ) => run.worstMillimetres > INVARIANCE_TOLERANCE_MM ).length === INVARIANCE_SEEDS.length,
        `${ coupled.filter( ( run ) => run.worstMillimetres > INVARIANCE_TOLERANCE_MM ).length } of ` +
        `${ INVARIANCE_SEEDS.length } seeds caught; worst ${ worstCoupledMillimetres.toFixed( 2 ) } mm = ` +
        `${ ( worstCoupledMillimetres * pixelsPerMillimetre ).toFixed( 1 ) } px` );

    check( 'frame rate: KNOWN-BAD — and by a margin the tolerance did not decide',
        worstCoupledMillimetres / INVARIANCE_TOLERANCE_MM > 100,
        `${ ( worstCoupledMillimetres / INVARIANCE_TOLERANCE_MM ).toFixed( 0 ) }× the tolerance` );

    // 🚩 RECORDED AS GATES, §1.3 AND §1.13. Everything else in this file passed on the coupled
    // layer, which is why it shipped for two phases. Asserted here so nobody reads the green
    // matrix above as covering it.
    const coupledRates = coupled.flatMap( ( run ) => run.microsaccadeRates );

    check( 'frame rate: KNOWN-BAD — a RATE gate would NOT have caught it',
        coupledRates.every( ( rate ) => rate >= 1 && rate <= 2 ),
        `recorded, not tolerated: the coupled layer's microsaccade rate is ` +
        `${ Math.min( ...coupledRates ).toFixed( 2 ) }-${ Math.max( ...coupledRates ).toFixed( 2 ) } /s at 30/60/120 Hz, ` +
        `every one of them inside the research's 1-2 /s band` );

    // §1.11 — stated as an overlap rather than as a threshold, because a threshold here would be
    // a number invented to make the point. The point is that there is no threshold: any band on
    // head yaw amplitude wide enough to admit the CORRECT layer across seeds also admits the
    // coupled one at every rate, so this statistic cannot separate them at any tolerance.
    const shippedAmplitudes = shipped.flatMap( ( run ) => run.headYawSds );
    const coupledAmplitudes = coupled.flatMap( ( run ) => run.headYawSds );

    const amplitudesOverlap = Math.min( ...coupledAmplitudes ) < Math.max( ...shippedAmplitudes ) &&
        Math.max( ...coupledAmplitudes ) > Math.min( ...shippedAmplitudes );

    check( 'frame rate: KNOWN-BAD — an AMPLITUDE gate would NOT have caught it either',
        amplitudesOverlap,
        `recorded, not tolerated: head yaw SD is ${ Math.min( ...shippedAmplitudes ).toFixed( 2 ) }-` +
        `${ Math.max( ...shippedAmplitudes ).toFixed( 2 ) }° on the shipped layer and ` +
        `${ Math.min( ...coupledAmplitudes ).toFixed( 2 ) }-${ Math.max( ...coupledAmplitudes ).toFixed( 2 ) }° on the ` +
        `coupled one — overlapping ranges, so no threshold on this statistic separates a ` +
        `${ ( worstCoupledMillimetres * pixelsPerMillimetre ).toFixed( 0 ) } px trajectory error from none at all` );

    // §1.1a again, pointed at the cheapest gate here: event counts are the easy thing to check and
    // they are NOT a proof on their own, because a coupled run can still land the same total.
    const coupledCountsAgreeSomewhere = coupled.some( ( run ) => new Set( run.saccades ).size === 1 );

    check( 'frame rate: KNOWN-BAD — an EVENT-COUNT gate alone would not have been a proof',
        coupledCountsAgreeSomewhere,
        `recorded, not tolerated: on seed ${ ( coupled.find( ( run ) => new Set( run.saccades ).size === 1 ) ?? coupled[ 0 ] ).seed } ` +
        `the coupled layer produces the same saccade count at all three rates and a ` +
        `${ ( worstCoupledMillimetres * pixelsPerMillimetre ).toFixed( 0 ) } px trajectory difference` );

    // The walk is a loop, and a loop is the one failure mode this change introduces that none of
    // the gates above can produce: they all step at a constant dt. A real frame time jitters and
    // occasionally stalls, and a stall arrives at the layer as MotionStack's clamp — a single
    // 100 ms step containing several transitions.
    {
        const { stack, gaze } = buildRig( { seed: 99, withHead: true } );

        const jitter = new MotionRandom( 99 );
        let elapsed = 0;

        while ( elapsed < 300 ) {

            // One frame in a few hundred is a 2 s stall, which the stack clamps to its
            // maxDeltaSeconds. Everything else is a 30-120 fps loop with no fixed rate at all.
            const delta = jitter.chance( 0.003 ) ? 2 : jitter.range( 1 / 120, 1 / 30 );

            stack.update( delta );
            elapsed = stack.time;

        }

        const saccadeRate = gaze.saccadeCount / elapsed;

        lines.push( `  jittering 30-120 fps with stalls, ${ elapsed.toFixed( 0 ) } s: ` +
            `${ gaze.worstStepsInAFrame } sub-steps in the worst frame, ` +
            `${ gaze.exhaustedStepBudgetFrames } frames out of budget, ` +
            `${ saccadeRate.toFixed( 2 ) } saccades/s` );
        lines.push( '' );

        check( 'frame rate: a jittering frame time never exhausts the sub-step budget',
            gaze.exhaustedStepBudgetFrames === 0,
            `worst ${ gaze.worstStepsInAFrame } sub-steps in a frame over ${ elapsed.toFixed( 0 ) } s including ` +
            `clamped 2 s stalls, against a budget of 64` );

        check( 'frame rate: and the layer still behaves, rather than merely not hanging',
            saccadeRate > 1.5 && saccadeRate < 4,
            `${ saccadeRate.toFixed( 2 ) } saccades/s, against ${ ( shipped[ 0 ].saccades[ 1 ] / INVARIANCE_SECONDS ).toFixed( 2 ) } on a fixed 60 Hz loop` );

        stack.dispose();
    }

    // 🚩 §1.11 — AND A CHECK OF A DIFFERENT KIND, BECAUSE THE ONE ABOVE STRUCTURALLY CANNOT MAKE
    // IT. The head smoother's own contribution to the coupling measures 0.0286° = 0.044 mm, a
    // ninth of the tolerance the landmark gate is stated at — so reverting `CriticallyDampedAngle`
    // to its Padé approximation of exp(−x) would pass everything above. The tolerance cannot be
    // tightened to catch it without first removing the recentring residue that sets it. So the
    // smoother is gated separately, on a step target where it is EXACTLY invariant or not at all.
    {
        const SMOOTH_TARGET_DEGREES = 30;
        const SMOOTH_SECONDS = 3;

        /** The shipped smoother, driven by a held target with nothing else aiming the head. */
        function smootherTraceAtRate( rateHz ) {

            const { stack, gaze } = buildRig( {
                withHead: true,
                gazeOptions: { policy: false, headRecentring: false }
            } );

            const samples = [];

            for ( let frame = 0; frame < Math.round( SMOOTH_SECONDS * rateHz ); frame ++ ) {

                gaze.head.setTarget( SMOOTH_TARGET_DEGREES, 0 );
                stack.update( 1 / rateHz );

                if ( ( frame + 1 ) % ( rateHz / 30 ) === 0 ) samples.push( gaze.head.yawDegrees );

            }

            stack.dispose();

            return samples;

        }

        /**
         * A local copy of the SmoothDamp recurrence, so the rejection below can vary one term.
         * `decay` is the only difference between the shipped form and the one it replaced.
         */
        function referenceSmootherTrace( rateHz, decay ) {

            const smoothTime = 0.18;
            const omega = 2 / smoothTime;
            const step = 1 / rateHz;

            let value = 0;
            let velocity = 0;
            const samples = [];

            for ( let frame = 0; frame < Math.round( SMOOTH_SECONDS * rateHz ); frame ++ ) {

                const factor = decay( omega * step );
                const change = value - SMOOTH_TARGET_DEGREES;
                const temp = ( velocity + omega * change ) * step;

                velocity = ( velocity - omega * temp ) * factor;
                value = SMOOTH_TARGET_DEGREES + ( change + temp ) * factor;

                if ( ( frame + 1 ) % ( rateHz / 30 ) === 0 ) samples.push( value );

            }

            return samples;

        }

        const exact = ( x ) => Math.exp( -x );
        const pade = ( x ) => 1 / ( 1 + x + 0.48 * x * x + 0.235 * x * x * x );

        const shippedSpread = worstDisagreement( smootherTraceAtRate( 30 ), smootherTraceAtRate( 60 ) );
        const referenceSpread = worstDisagreement( referenceSmootherTrace( 30, exact ), referenceSmootherTrace( 60, exact ) );
        const padeSpread = worstDisagreement( referenceSmootherTrace( 30, pade ), referenceSmootherTrace( 60, pade ) );

        // The copy has to be proven faithful before its rejection means anything: it must
        // reproduce the shipped smoother's own trace, not merely behave similarly.
        const fidelity = worstDisagreement( smootherTraceAtRate( 60 ), referenceSmootherTrace( 60, exact ) );

        lines.push( `  head smoother, 30° step, 30 vs 60 Hz:  shipped ${ shippedSpread.toExponential( 2 ) }°, ` +
            `exact-exp reference ${ referenceSpread.toExponential( 2 ) }°, Padé reference ${ padeSpread.toFixed( 6 ) }°` );
        lines.push( '' );

        check( 'frame rate: the head smoother is EXACTLY invariant, not approximately',
            shippedSpread < 1e-9,
            `worst ${ shippedSpread.toExponential( 3 ) }° between 30 and 60 Hz on a held 30° target — ` +
            `with decay = exp(−ωΔt) the recurrence is the analytic solution, so two half-steps are one whole step` );

        check( 'frame rate: the reference smoother reproduces the shipped one, so its rejection counts',
            fidelity < 1e-9,
            `worst ${ fidelity.toExponential( 3 ) }° between the shipped smoother and the local copy at 60 Hz` );

        check( 'frame rate: KNOWN-BAD — the Padé approximation this replaced fails that gate',
            padeSpread > 1e-9,
            `${ padeSpread.toFixed( 6 ) }° = ${ ( padeSpread * pixelsPerDegreeOfHeadYaw ).toFixed( 4 ) } px — under the ` +
            `${ INVARIANCE_TOLERANCE_MM } mm landmark tolerance above, which is exactly why it needs its own gate` );

    }

    /**
     * Where the two eyeball globes sit in the head bone's BIND frame, in metres.
     *
     * Bind, not current (LEARNINGS §1.16): `boneInverses` is pose-independent by construction, and
     * reading `matrixWorld` here would bake in whatever pose the rig happened to be left in.
     */
    function measureEyeLandmarksInHeadBindFrame() {

        let landmarks = null;

        figureRoot.traverse( ( node ) => {

            // `high-poly` is the eyeball globes; the name is about topology, not anatomy.
            if ( node.isSkinnedMesh !== true || node.name.endsWith( 'high-poly' ) === false ) return;

            const position = node.geometry.attributes.position;
            const headIndex = node.skeleton.bones.findIndex( ( bone ) => bone.name === 'head' );

            const left = new Vector3();
            const right = new Vector3();
            let leftCount = 0;
            let rightCount = 0;

            for ( let index = 0; index < position.count; index ++ ) {

                const vertex = new Vector3().fromBufferAttribute( position, index );

                if ( vertex.x > 0 ) { left.add( vertex ); leftCount ++; }
                else { right.add( vertex ); rightCount ++; }

            }

            left.divideScalar( leftCount );
            right.divideScalar( rightCount );

            landmarks = [
                left.applyMatrix4( node.skeleton.boneInverses[ headIndex ] ),
                right.applyMatrix4( node.skeleton.boneInverses[ headIndex ] )
            ];

        } );

        return landmarks;

    }

    /** One seed at all three rates, compared against the 60 Hz run at matched simulated instants. */
    function compareAcrossRates( seed, gazeOptions ) {

        const traces = INVARIANCE_RATES.map( ( rate ) => traceAtRate( seed, rate, gazeOptions ) );
        const reference = traces[ 1 ];

        return {
            seed,
            worstMillimetres: 1000 * Math.max( ...traces.map( ( trace ) => worstDisagreement( trace.landmarks, reference.landmarks ) ) ),
            worstHeadDegrees: Math.max( ...traces.map( ( trace ) => worstDisagreement( trace.headYaw, reference.headYaw ) ) ),
            worstEyeDegrees: Math.max( ...traces.map( ( trace ) => worstDisagreement( trace.eyeYaw, reference.eyeYaw ) ) ),
            saccades: traces.map( ( trace ) => trace.saccades ),
            microsaccades: traces.map( ( trace ) => trace.microsaccades ),
            microsaccadeRates: traces.map( ( trace ) => trace.microsaccades / INVARIANCE_SECONDS ),
            headYawSds: traces.map( ( trace ) => standardDeviation( trace.headYaw ) ),
            exhausted: traces.reduce( ( total, trace ) => total + trace.exhausted, 0 ),
            worstSteps: Math.max( ...traces.map( ( trace ) => trace.worstSteps ) )
        };

    }

    /**
     * One trace, sampled at whole seconds so that two rates are compared at the SAME simulated
     * instants rather than at the same frame index.
     */
    function traceAtRate( seed, rateHz, gazeOptions ) {

        const { stack, gaze } = buildRig( { seed, withHead: true, gazeOptions } );

        const landmarks = [];
        const headYaw = [];
        const eyeYaw = [];
        const scratch = new Vector3();

        for ( let frame = 0; frame < Math.round( INVARIANCE_SECONDS * rateHz ); frame ++ ) {

            stack.update( 1 / rateHz );

            if ( ( frame + 1 ) % rateHz !== 0 ) continue;

            figureRoot.updateMatrixWorld( true );

            for ( const landmark of eyeLandmarks ) {

                scratch.copy( landmark ).applyMatrix4( headBone.matrixWorld );
                landmarks.push( scratch.x, scratch.y, scratch.z );

            }

            headYaw.push( gaze.head.yawDegrees );
            eyeYaw.push( gaze.eyeYawDegrees );

        }

        const trace = {
            landmarks, headYaw, eyeYaw,
            saccades: gaze.saccadeCount,
            microsaccades: gaze.microsaccadeCount,
            exhausted: gaze.exhaustedStepBudgetFrames,
            worstSteps: gaze.worstStepsInAFrame
        };

        stack.dispose();

        return trace;

    }

    function worstDisagreement( samples, reference ) {

        let worst = 0;

        for ( let index = 0; index < Math.min( samples.length, reference.length ); index ++ ) {

            worst = Math.max( worst, Math.abs( samples[ index ] - reference[ index ] ) );

        }

        return worst;

    }

}

lines.push( '' );

// --- statistics helpers ------------------------------------------------------------------------------

function mean( values ) {

    if ( values.length === 0 ) return 0;

    let total = 0;
    for ( const value of values ) total += value;

    return total / values.length;

}

function standardDeviation( values ) {

    const average = mean( values );

    let total = 0;
    for ( const value of values ) total += ( value - average ) ** 2;

    return Math.sqrt( total / values.length );

}

/**
 * The mean of `exponential( mean, { min } )`, which CLAMPS rather than shifts: everything below
 * the floor piles up at the floor. E[max(X, m)] = m·P(X<m) + E[X | X≥m]·P(X≥m), and for an
 * exponential the memoryless property makes the second term (m + mean)·exp(−m/mean).
 */
function expectedClampedExponentialMean( distributionMean, floor ) {

    const belowFloor = 1 - Math.exp( -floor / distributionMean );

    return floor * belowFloor + ( floor + distributionMean ) * ( 1 - belowFloor );

}

/**
 * One-sample Kolmogorov-Smirnov statistic against a supplied CDF.
 *
 * Ties are handled explicitly, and here that is not pedantry: `exponential( mean, { min } )`
 * clamps rather than shifts, so a third of the fixation durations are the floor value exactly.
 * Walking the samples one at a time would compare the empirical CDF *before* that whole block of
 * ties against the theoretical CDF *after* it, and report the atom's own height — 0.35 — as the
 * discrepancy. The distribution would be right and the test would say it was wrong.
 */
function kolmogorovSmirnov( samples, cumulative ) {

    const sorted = [ ...samples ].sort( ( a, b ) => a - b );
    const count = sorted.length;

    let largest = 0;
    let index = 0;

    while ( index < count ) {

        const value = sorted[ index ];

        let next = index;
        while ( next < count && sorted[ next ] === value ) next ++;

        // Both the value and its left limit, because the theoretical CDF has a jump at the atom
        // too. Comparing the empirical CDF just BELOW the atom against the theoretical CDF AT it
        // reports the atom's own height as the discrepancy — which is what this test did first,
        // and it declared a perfectly correct distribution wrong by exactly 0.348.
        const theoretical = cumulative( value );
        const theoreticalBelow = cumulative( value - 1e-12 );

        const empiricalBelow = index / count;
        const empiricalAt = next / count;

        largest = Math.max( largest,
            Math.abs( theoreticalBelow - empiricalBelow ),
            Math.abs( empiricalAt - theoretical ) );

        index = next;

    }

    return largest;

}

function histogram( values, minimum, maximum, bins ) {

    const counts = new Array( bins ).fill( 0 );
    const width = ( maximum - minimum ) / bins;

    for ( const value of values ) {

        const bin = Math.min( Math.floor( ( value - minimum ) / width ), bins - 1 );
        if ( bin >= 0 ) counts[ bin ] ++;

    }

    const peak = Math.max( ...counts, 1 );
    const rows = [];

    for ( let bin = 0; bin < bins; bin ++ ) {

        const label = `${ ( minimum + bin * width ).toFixed( 0 ) }-${ ( minimum + ( bin + 1 ) * width ).toFixed( 0 ) }`;
        const bar = '#'.repeat( Math.round( ( counts[ bin ] / peak ) * 44 ) );

        rows.push( `${ label.padStart( 9 ) } | ${ bar.padEnd( 44 ) } ${ counts[ bin ] }` );

    }

    return rows;

}

function formatTable( rows, gap = '  ' ) {

    const widths = [];

    for ( const row of rows ) {

        row.forEach( ( cell, column ) => {

            widths[ column ] = Math.max( widths[ column ] ?? 0, cell.length );

        } );

    }

    return rows.map( ( row ) =>
        row.map( ( cell, column ) => cell.padEnd( widths[ column ] ) ).join( gap ).trimEnd() );

}

function capturePose( root ) {

    const pose = [];

    root.traverse( ( object ) => {

        pose.push( { object, quaternion: object.quaternion.clone(), position: object.position.clone() } );

    } );

    return pose;

}

function restorePose( pose ) {

    for ( const entry of pose ) {

        entry.object.quaternion.copy( entry.quaternion );
        entry.object.position.copy( entry.position );

    }

}

// --- results ---------------------------------------------------------------------------------------------

process.stdout.write( `${ lines.join( '\n' ) }\n` );

let failed = 0;

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
