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

import { Quaternion, Vector3 } from 'three';

import { MotionStack, createMotionTarget } from './MotionStack.js';
import {
    Gaze,
    GAZE_TOWARD_PROBABILITY,
    EYE_MORPH_EXCURSION_DEGREES,
    saccadePeakVelocityDegreesPerSecond,
    saccadeDurationSeconds,
    saccadeProgress
} from './Gaze.js';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here looks at a
// pixel, so the two smallest possible stubs get the loader as far as the morph and skin data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const FIGURE_PATH = path.resolve( HERE, '../../../../assets/figures/figure_g050.glb' );

const MINIMUM_INTERSACCADIC_SECONDS = 0.15;
const FIXATION_MEAN_SECONDS = 0.35;

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
            fixationDurations.push( gaze.fixationRemaining );
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

    // The ocular range is small on this asset, so some frames legitimately have the eye pinned at
    // its limit and unable to compensate. Those are excluded and counted, not silently averaged in.
    // BOTH runs have to be checked: a frame where the still run is pinned and the turned run is
    // not has a perfectly valid difference that is nevertheless not the head angle.
    const yawLimit = Math.min( EYE_MORPH_EXCURSION_DEGREES.in, EYE_MORPH_EXCURSION_DEGREES.out );

    const isPinned = ( sample ) => {

        const pitchLimit = sample.eyePitch >= 0
            ? EYE_MORPH_EXCURSION_DEGREES.up : EYE_MORPH_EXCURSION_DEGREES.down;

        return Math.abs( sample.eyeYaw ) >= yawLimit - 1e-6 ||
            Math.abs( sample.eyePitch ) >= pitchLimit - 1e-6;

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
    const THRESHOLD = 12;           // HEAD_RECRUITMENT_THRESHOLD_DEGREES
    const EYE_RANGE = Math.min( EYE_MORPH_EXCURSION_DEGREES.in, EYE_MORPH_EXCURSION_DEGREES.out );

    const rows = [ [ 'gaze shift', 'expected head', 'commanded head', 'settled head', 'settled eye', 'note' ] ];

    for ( const amplitude of [ 5, 10, 12, 20, 30, 45 ] ) {

        const { stack, gaze } = buildRig( { withHead: true } );

        gaze.lookAt( { yawDegrees: amplitude, pitchDegrees: 0 } );

        // 25 frames: past the 200 ms latency and the head's release, but before the earliest
        // possible exploratory saccade (150 ms fixation floor + 100 ms predicted delay after
        // onset at 200 ms = 450 ms = frame 27) can change the head's target.
        for ( let frame = 0; frame < 25; frame ++ ) stack.update( 1 / 60 );

        const commanded = gaze.head.targetYawDegrees;

        for ( let frame = 0; frame < 45; frame ++ ) stack.update( 1 / 60 );

        const settledHead = gaze.headYawDegrees;
        const settledEye = gaze.eyeYawDegrees;

        const expected = Math.max(
            HEAD_ALIGNMENT * Math.max( 0, amplitude - THRESHOLD ),
            Math.max( 0, amplitude - EYE_RANGE ) );

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

        check( `head recruitment: ${ amplitude }° eye angle stays inside the measured ocular range`,
            Math.abs( settledEye ) <= EYE_RANGE + 1e-6,
            `eye at ${ settledEye.toFixed( 2 ) }°, range ±${ EYE_RANGE }°` );

    }

    lines.push( '  Note that at the default alignment of 0.7 the binding constraint above ~20° is' );
    lines.push( '  not the social register at all — it is that the eyes stop at 14.27° on this asset,' );
    lines.push( '  so the head has to take the rest or the gaze never arrives.' );
    lines.push( '' );

    for ( const row of formatTable( rows ) ) lines.push( `  ${ row }` );
    lines.push( '' );
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

    // A stand-in for motion/Blink.js, which does not exist yet. The contract under test is the
    // duck-typed lookup, not the blink itself: gaze must not care whether a blink layer is there.
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
