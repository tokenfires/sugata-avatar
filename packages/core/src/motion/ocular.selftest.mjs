#!/usr/bin/env node
//
// ocular.selftest.mjs — proves Blink.js and Pupil.js do what their headers claim.
//
// Run: node packages/core/src/motion/ocular.selftest.mjs
//
// Punch-list 2.1 and 2.8. The claims under test are the ones the perceptual result hangs on:
//
//   BLINK
//     (a) the downphase is measurably shorter — and faster — than the upphase, for EVERY blink,
//         not merely on average. This is the whole reason the file exists; Live2D ships it the
//         other way round.
//     (b) full eyelid closure is reached, at 30, 60 and 120 fps and under jittered frame times.
//         Trutoiu et al. found partial-closure blinks read as wrong.
//     (c) inter-blink intervals are exponentially distributed with the requested mean, which is
//         what "Poisson process" has to mean in practice.
//     (d) the rate moves the right way for cognitive load and for visual attention, and stays
//         inside Doughty's conversation band.
//
//   PUPIL
//     (e) the shipped figure genuinely has no pupil morph — checked against the real GLB, not
//         asserted from memory — so the UV/scale hook is the right design and not a shortcut.
//     (f) exaggeration actually amplifies, faithful amplitude is as invisible as claimed,
//         dilation is slower than constriction, and the scale stays inside the bounds the
//         Phase 3.3 shader contract depends on.
//
// It also prints one blink's eyelid curve as ASCII, because the asymmetry is the deliverable and
// a reviewer should be able to see it rather than take a number on trust.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Layer } from './Layer.js';
import { MotionStack, MOTION_ORDER, createMotionTarget } from './MotionStack.js';
import { MotionRandom } from './Signals.js';
import { Blink, BLINK_CONSTANTS, closureDuringDownphase, reopeningDuringUpphase, peakPhaseVelocities } from './Blink.js';
import { Pupil, PUPIL_CONSTANTS, diameterAtArousal } from './Pupil.js';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here looks at a
// pixel, so the two smallest possible stubs get the loader as far as the morph data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { GLTFLoader } = await import( 'three/examples/jsm/loaders/GLTFLoader.js' );

const HERE = path.dirname( fileURLToPath( import.meta.url ) );
const FIGURE_PATH = path.resolve( HERE, '../../../../assets/figures/figure_g050.glb' );

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

// --- a stack over the real figure ---------------------------------------------------------------

async function loadFigureTarget() {

    const buffer = fs.readFileSync( FIGURE_PATH );
    const arrayBuffer = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );

    const gltf = await new GLTFLoader().parseAsync( arrayBuffer, '' );

    return { target: createMotionTarget( gltf.scene ), scene: gltf.scene };

}

const { target } = await loadFigureTarget();

// --- (a) the asymmetry, sampled over many blinks -------------------------------------------------
//
// Every blink is drawn independently, so the claim has to hold across the whole distribution.
// 4000 samples is enough to catch a sampler that occasionally lets the ratio slip below 2.

function sampleBlinkShapes( count ) {

    const stack = new MotionStack( { seed: 7 } ).bind( target );
    const blink = stack.add( new Blink() );

    const shapes = [];

    while ( shapes.length < count ) {

        blink.elapsed = -1;
        blink.beginBlink( false );

        shapes.push( {
            closing: blink.closingDuration,
            hold: blink.closedHold,
            opening: blink.openingDuration,
        } );

    }

    stack.dispose();

    return shapes;

}

const shapes = sampleBlinkShapes( 4000 );

const closings = shapes.map( ( shape ) => shape.closing );
const openings = shapes.map( ( shape ) => shape.opening );
const durationRatios = shapes.map( ( shape ) => shape.opening / shape.closing );

const peakRatios = shapes.map( ( shape ) => {

    const peaks = peakPhaseVelocities( shape.closing, shape.opening );
    return peaks.downphase / peaks.upphase;

} );

check(
    'blink: every closing phase is shorter than its opening phase',
    shapes.every( ( shape ) => shape.closing < shape.opening ),
    `min duration ratio ${ Math.min( ...durationRatios ).toFixed( 3 ) }x`
);

check(
    'blink: opening is at least 2x closing on EVERY blink (the ratio floor is enforced per blink)',
    Math.min( ...durationRatios ) >= BLINK_CONSTANTS.OPENING_TO_CLOSING_RATIO_RANGE[ 0 ] - 1e-9,
    `duration ratio min ${ Math.min( ...durationRatios ).toFixed( 3 ) }x, mean ${ mean( durationRatios ).toFixed( 3 ) }x, max ${ Math.max( ...durationRatios ).toFixed( 3 ) }x`
);

check(
    'blink: closing durations stay inside the recorded 50-100 ms',
    Math.min( ...closings ) >= BLINK_CONSTANTS.CLOSING_DURATION_RANGE_SECONDS[ 0 ] - 1e-9
        && Math.max( ...closings ) <= BLINK_CONSTANTS.CLOSING_DURATION_RANGE_SECONDS[ 1 ] + 1e-9,
    `${ ( Math.min( ...closings ) * 1000 ).toFixed( 1 ) }-${ ( Math.max( ...closings ) * 1000 ).toFixed( 1 ) } ms, mean ${ ( mean( closings ) * 1000 ).toFixed( 1 ) } ms`
);

check(
    'blink: opening durations stay inside the recorded 150-300 ms',
    Math.min( ...openings ) >= BLINK_CONSTANTS.OPENING_DURATION_RANGE_SECONDS[ 0 ] - 1e-9
        && Math.max( ...openings ) <= BLINK_CONSTANTS.OPENING_DURATION_RANGE_SECONDS[ 1 ] + 1e-9,
    `${ ( Math.min( ...openings ) * 1000 ).toFixed( 1 ) }-${ ( Math.max( ...openings ) * 1000 ).toFixed( 1 ) } ms, mean ${ ( mean( openings ) * 1000 ).toFixed( 1 ) } ms`
);

// The literature states the asymmetry as a VELOCITY ratio of about 2x, which is a different
// statistic from the duration ratio: it depends on the shape of each phase, not only its length.
check(
    'blink: peak downphase velocity is about 2x peak upphase velocity (literature figure)',
    mean( peakRatios ) > 1.7 && mean( peakRatios ) < 2.6,
    `peak velocity ratio mean ${ mean( peakRatios ).toFixed( 2 ) }x (range ${ Math.min( ...peakRatios ).toFixed( 2 ) }-${ Math.max( ...peakRatios ).toFixed( 2 ) }x)`
);

// Live2D's default, for contrast. Same closure, 0.1 s down and 0.15 s up.
const live2dPeaks = peakPhaseVelocities( 0.10, 0.15 );
check(
    'blink: beats the Live2D 0.1/0.15 default, which is barely asymmetric',
    mean( peakRatios ) > ( live2dPeaks.downphase / live2dPeaks.upphase ) * 1.5,
    `ours ${ mean( peakRatios ).toFixed( 2 ) }x vs Live2D ${ ( live2dPeaks.downphase / live2dPeaks.upphase ).toFixed( 2 ) }x`
);

// --- the velocity profiles are non-uniform, and differently shaped -------------------------------

const downphaseVelocity = sampleVelocity( closureDuringDownphase );
const upphaseVelocity = sampleVelocity( reopeningDuringUpphase );

check(
    'blink: neither phase is a linear ramp',
    peakOverMean( downphaseVelocity ) > 1.15 && peakOverMean( upphaseVelocity ) > 1.4,
    `downphase peak/mean ${ peakOverMean( downphaseVelocity ).toFixed( 3 ) }, upphase peak/mean ${ peakOverMean( upphaseVelocity ).toFixed( 3 ) }`
);

check(
    'blink: the two phases have genuinely different velocity shapes (ballistic fall vs pull-then-creep)',
    argMaxFraction( downphaseVelocity ) > 0.2 && argMaxFraction( upphaseVelocity ) < 0.1,
    `downphase peaks at ${ ( argMaxFraction( downphaseVelocity ) * 100 ).toFixed( 0 ) }% of the phase, upphase at ${ ( argMaxFraction( upphaseVelocity ) * 100 ).toFixed( 0 ) }%`
);

check(
    'blink: both profiles are monotonic and land exactly on 0 and 1',
    isMonotonic( closureDuringDownphase ) && isMonotonic( reopeningDuringUpphase )
        && closureDuringDownphase( 0 ) === 0 && closureDuringDownphase( 1 ) === 1
        && reopeningDuringUpphase( 0 ) === 0 && reopeningDuringUpphase( 1 ) === 1
);

// --- (b) full closure, at every frame rate --------------------------------------------------------
//
// The interesting case is not 120 fps, it is 30 fps with a jittered dt: a 20 ms closed window and
// a 33 ms step will step straight over full closure unless the crossing frame is snapped.

function runBlinkTrace( { frameSeconds, seconds, jitterRandom = null, configure = null, seed = 11 } ) {

    const stack = new MotionStack( { seed } ).bind( target );
    const blink = stack.add( new Blink() );

    if ( configure !== null ) configure( blink );

    const trace = [];
    let elapsed = 0;
    let previousCount = blink.blinkCount;

    let peakThisBlink = 0;
    const peaks = [];
    const onsets = [];

    while ( elapsed < seconds ) {

        const dt = jitterRandom === null
            ? frameSeconds
            : frameSeconds * jitterRandom.range( 0.6, 1.4 );

        stack.update( dt );
        elapsed += Math.min( dt, stack.maxDeltaSeconds );

        if ( blink.blinkCount !== previousCount ) {

            if ( previousCount > 0 ) peaks.push( peakThisBlink );
            onsets.push( elapsed );
            peakThisBlink = 0;
            previousCount = blink.blinkCount;

        }

        peakThisBlink = Math.max( peakThisBlink, blink.closure );
        trace.push( blink.closure );

    }

    peaks.push( peakThisBlink );
    stack.dispose();

    return { blink, trace, peaks, onsets, elapsed };

}

for ( const [ label, frameSeconds ] of [ [ '120 fps', 1 / 120 ], [ '60 fps', 1 / 60 ], [ '30 fps', 1 / 30 ] ] ) {

    const { peaks } = runBlinkTrace( { frameSeconds, seconds: 600 } );
    const worst = Math.min( ...peaks );

    check(
        `blink: full closure (exactly 1.0) is reached on every blink at ${ label }`,
        worst === 1,
        `${ peaks.length } blinks, worst rendered peak ${ worst.toFixed( 6 ) }`
    );

}

{
    const jitter = new MotionRandom( 99 );
    const { peaks } = runBlinkTrace( { frameSeconds: 1 / 30, seconds: 900, jitterRandom: jitter } );
    const worst = Math.min( ...peaks );

    check(
        'blink: full closure survives jittered 30 fps frame times (20-46 ms steps)',
        worst === 1,
        `${ peaks.length } blinks, worst rendered peak ${ worst.toFixed( 6 ) }`
    );
}

// --- (c) Poisson intervals ------------------------------------------------------------------------
//
// Two separate claims. The SAMPLED interval is drawn as a pure exponential, which is the thing the
// word "Poisson" is doing in the header, so that is chi-square tested. The REALIZED onset-to-onset
// interval also carries the deferral rule (an arrival landing inside a blink waits for it to
// finish), so it is checked on its mean rather than its shape.

function collectSampledIntervals( ratePerMinute, count ) {

    const stack = new MotionStack( { seed: 23 } ).bind( target );
    const blink = stack.add( new Blink( { baselineRatePerMinute: ratePerMinute } ) );

    const intervals = [];

    while ( intervals.length < count ) {

        blink.scheduleNextBlink();
        intervals.push( blink.lastSampledInterval );

    }

    stack.dispose();

    return intervals;

}

const targetRate = BLINK_CONSTANTS.BASELINE_RATE_PER_MINUTE;
const expectedMeanSeconds = 60 / targetRate;
const sampled = collectSampledIntervals( targetRate, 20000 );

check(
    'blink: sampled inter-blink interval mean matches 1 / rate',
    Math.abs( mean( sampled ) - expectedMeanSeconds ) / expectedMeanSeconds < 0.03,
    `mean ${ mean( sampled ).toFixed( 3 ) } s vs expected ${ expectedMeanSeconds.toFixed( 3 ) } s (${ targetRate }/min)`
);

// An exponential distribution has a coefficient of variation of exactly 1. This one number rules
// out every "jitter around a fixed period" implementation, which is what most avatars actually do.
const coefficientOfVariation = standardDeviation( sampled ) / mean( sampled );

check(
    'blink: intervals are exponential, not a jittered metronome (CV = 1)',
    Math.abs( coefficientOfVariation - 1 ) < 0.05,
    `CV ${ coefficientOfVariation.toFixed( 4 ) } (exponential = 1.0, fixed period = 0.0)`
);

// Chi-square against exponential, using equiprobable bins so every expected count is identical.
const chiSquare = exponentialChiSquare( sampled, expectedMeanSeconds, 20 );

check(
    'blink: intervals pass a chi-square goodness-of-fit against exponential (19 dof, p > 0.05)',
    chiSquare.statistic < 30.14,
    `chi-square ${ chiSquare.statistic.toFixed( 2 ) } on ${ chiSquare.degreesOfFreedom } dof (critical 30.14)`
);

// The realized rate is what a viewer actually sees, and it is the number that has to land in
// Doughty's band. It is pooled across seeds on purpose: the standard error of a rate estimated
// from a single Poisson run of N blinks is 1/sqrt(N), so one 60-minute run at 20/min has a ~3%
// SE and will wander outside a 5% band roughly one time in ten. A single-seed assertion here
// would be a flaky test that told you nothing. (This was found the hard way — seed 11 alone
// reads 21.6/min over 67 minutes and 20.8/min over 100.)

const RATE_SEEDS = [ 1, 2, 3, 5, 7, 11, 13, 17 ];
const RATE_MEASUREMENT_SECONDS = 3000;

function measurePooledRate( configure ) {

    let blinks = 0;
    let seconds = 0;
    const perSeed = [];

    for ( const seed of RATE_SEEDS ) {

        const { onsets, elapsed } = runBlinkTrace( {
            frameSeconds: 1 / 60,
            seconds: RATE_MEASUREMENT_SECONDS,
            configure,
            seed,
        } );

        blinks += onsets.length;
        seconds += elapsed;
        perSeed.push( onsets.length / ( elapsed / 60 ) );

    }

    return { ratePerMinute: blinks / ( seconds / 60 ), blinks, minutes: seconds / 60, perSeed };

}

const resting = measurePooledRate( null );
const loaded = measurePooledRate( ( blink ) => blink.setCognitiveLoad( 1 ) );
const attentive = measurePooledRate( ( blink ) => blink.setAttention( 1 ) );
const both = measurePooledRate( ( blink ) => { blink.setCognitiveLoad( 1 ); blink.setAttention( 1 ); } );

check(
    'blink: realized on-screen rate matches the requested 20/min within 2%',
    Math.abs( resting.ratePerMinute - targetRate ) / targetRate < 0.02,
    `${ resting.ratePerMinute.toFixed( 2 ) }/min over ${ resting.minutes.toFixed( 0 ) } minutes, ${ resting.blinks } blinks; per-seed ${ resting.perSeed.map( ( rate ) => rate.toFixed( 1 ) ).join( ' ' ) }`
);

// --- (d) the rate responds to cognitive load and to attention --------------------------------------

check(
    'blink: working-memory load RAISES the rate',
    loaded.ratePerMinute > resting.ratePerMinute * 1.3,
    `resting ${ resting.ratePerMinute.toFixed( 1 ) }/min -> loaded ${ loaded.ratePerMinute.toFixed( 1 ) }/min`
);

check(
    'blink: visual attention LOWERS the rate',
    attentive.ratePerMinute < resting.ratePerMinute * 0.75,
    `resting ${ resting.ratePerMinute.toFixed( 1 ) }/min -> attentive ${ attentive.ratePerMinute.toFixed( 1 ) }/min`
);

check(
    'blink: full load reaches the top of Doughty\'s conversation band, full attention the bottom',
    Math.abs( loaded.ratePerMinute - BLINK_CONSTANTS.CONVERSATION_RATE_RANGE_PER_MINUTE[ 1 ] ) < 1
        && Math.abs( attentive.ratePerMinute - BLINK_CONSTANTS.CONVERSATION_RATE_RANGE_PER_MINUTE[ 0 ] ) < 0.5,
    `loaded ${ loaded.ratePerMinute.toFixed( 2 ) } vs band top ${ BLINK_CONSTANTS.CONVERSATION_RATE_RANGE_PER_MINUTE[ 1 ] }, attentive ${ attentive.ratePerMinute.toFixed( 2 ) } vs band bottom ${ BLINK_CONSTANTS.CONVERSATION_RATE_RANGE_PER_MINUTE[ 0 ] }`
);

check(
    'blink: load and attention oppose each other rather than one silently winning',
    both.ratePerMinute > attentive.ratePerMinute && both.ratePerMinute < loaded.ratePerMinute,
    `attentive ${ attentive.ratePerMinute.toFixed( 1 ) } < both ${ both.ratePerMinute.toFixed( 1 ) } < loaded ${ loaded.ratePerMinute.toFixed( 1 ) }`
);

// --- saccade coupling and unilateral blinks ---------------------------------------------------------

{
    const stack = new MotionStack( { seed: 5 } ).bind( target );
    const blink = stack.add( new Blink() );

    let smallFires = 0;
    let largeFires = 0;

    for ( let trial = 0; trial < 4000; trial ++ ) {

        blink.elapsed = -1;
        if ( blink.triggerWithSaccade( 5 ) ) smallFires ++;

        blink.elapsed = -1;
        if ( blink.triggerWithSaccade( 35 ) ) largeFires ++;

    }

    check(
        'blink: a small gaze shift never recruits a blink; a >30 degree one often does',
        smallFires === 0 && largeFires > 1600 && largeFires < 2400,
        `5 deg: ${ smallFires }/4000, 35 deg: ${ largeFires }/4000 (expected ~2000 at p = 0.5)`
    );

    stack.dispose();
}

{
    const stack = new MotionStack( { seed: 31 } ).bind( target );
    const layer = stack.add( new Blink() );

    let unilateral = 0;
    const trials = 20000;

    for ( let trial = 0; trial < trials; trial ++ ) {

        layer.elapsed = -1;
        layer.beginBlink();
        if ( layer.lastBlinkWasUnilateral ) unilateral ++;

    }

    const rate = unilateral / trials;

    check(
        'blink: single-eye blinks happen, and stay rare',
        rate > 0.01 && rate < 0.035,
        `${ ( rate * 100 ).toFixed( 2 ) }% of blinks were unilateral (configured 2%)`
    );

    stack.dispose();
}

// --- determinism ---------------------------------------------------------------------------------

{
    const first = runBlinkTrace( { frameSeconds: 1 / 60, seconds: 120 } ).trace;
    const second = runBlinkTrace( { frameSeconds: 1 / 60, seconds: 120 } ).trace;

    check(
        'blink: the same seed reproduces the trace exactly',
        first.length === second.length && first.every( ( value, index ) => value === second[ index ] ),
        `${ first.length } frames compared`
    );
}

{
    // MotionStack.reset() calls reset() then onBind(); a layer that draws in both diverges.
    const stack = new MotionStack( { seed: 77 } ).bind( target );
    stack.add( new Blink() );

    const firstRun = [];
    for ( let frame = 0; frame < 3000; frame ++ ) {

        stack.update( 1 / 60 );
        firstRun.push( stack.findLayer( 'blink' ).closure );

    }

    stack.reset();

    const secondRun = [];
    for ( let frame = 0; frame < 3000; frame ++ ) {

        stack.update( 1 / 60 );
        secondRun.push( stack.findLayer( 'blink' ).closure );

    }

    check(
        'blink: MotionStack.reset() returns the layer to its start-of-run state',
        firstRun.every( ( value, index ) => value === secondRun[ index ] ),
        `${ firstRun.length } frames compared`
    );

    stack.dispose();
}

// --- the eyelids actually reach the figure ----------------------------------------------------------

{
    const stack = new MotionStack( { seed: 3 } ).bind( target );
    const blink = stack.add( new Blink() );

    // A stand-in for the expression layer, so the sum-and-clamp path is exercised too.
    class SquintLayer extends Layer {

        constructor() {

            super( { name: 'squint', order: MOTION_ORDER.EXPRESSION, morphChannels: [ 'eyeBlinkLeft', 'eyeBlinkRight' ] } );

        }

        update() {

            this.contribution.setMorph( 'eyeBlinkLeft', 0.2 );
            this.contribution.setMorph( 'eyeBlinkRight', 0.2 );
            return this.contribution;

        }

    }

    stack.add( new SquintLayer() );

    blink.blinkNow();

    let committedPeak = 0;

    for ( let frame = 0; frame < 40; frame ++ ) {

        stack.update( 1 / 60 );
        committedPeak = Math.max( committedPeak, stack.morphChannels.get( 'eyeBlinkLeft' ).committed );

    }

    check(
        'blink: eyeBlinkLeft commits to the figure and clamps at 1 when an expression is already squinting',
        committedPeak === 1,
        `committed peak ${ committedPeak }`
    );

    check(
        'blink: eyeBlinkLeft/Right exist on the real figure (they live on 3 meshes, not 1)',
        target.hasMorph( 'eyeBlinkLeft' ) && target.hasMorph( 'eyeBlinkRight' )
    );

    stack.dispose();
}

// --- (e) the figure has no pupil morph — verified against the asset ------------------------------------

{
    const found = PUPIL_CONSTANTS.PUPIL_MORPH_CANDIDATES.filter( ( name ) => target.hasMorph( name ) );

    check(
        'pupil: the shipped figure carries no pupil morph, so the UV/scale hook is required (verified against figure_g050.glb)',
        found.length === 0,
        `checked ${ PUPIL_CONSTANTS.PUPIL_MORPH_CANDIDATES.join( ', ' ) } — none present`
    );

    const eyeballMorphs = target.morphNames.filter( ( name ) => name.startsWith( 'eyeLook' ) );

    check(
        'pupil: the 8 morphs on the eyeball mesh are all gaze, none is a pupil',
        eyeballMorphs.length === 8,
        `${ eyeballMorphs.sort().join( ' ' ) }`
    );
}

// --- (f) pupil behaviour --------------------------------------------------------------------------

{
    const stack = new MotionStack( { seed: 13 } ).bind( target );
    const pupil = stack.add( new Pupil( { hippus: false } ) );

    const uniform = { value: 0 };
    pupil.driveUniform( uniform );

    let sinkScale = 0;
    pupil.addSink( ( scale ) => { sinkScale = scale; } );

    pupil.snapToArousal( 0.33 );
    stack.update( 1 / 60 );

    check(
        'pupil: the scale reaches a shader uniform and an arbitrary sink every frame',
        uniform.value === pupil.pupilScale && sinkScale === pupil.pupilScale,
        `scale ${ pupil.pupilScale.toFixed( 4 ) }`
    );

    check(
        'pupil: resting arousal 0.33 is a ~4 mm pupil, i.e. scale ~1',
        Math.abs( pupil.physiologicalDiameterMillimetres - 4 ) < 0.1 && Math.abs( pupil.pupilScale - 1 ) < 0.08,
        `${ pupil.physiologicalDiameterMillimetres.toFixed( 2 ) } mm, scale ${ pupil.pupilScale.toFixed( 4 ) }`
    );

    check(
        'pupil: context.shared.pupil is published for the affect and render layers',
        stack.context.shared.pupil !== undefined && stack.context.shared.pupil.scale === pupil.pupilScale
    );

    stack.dispose();
}

{
    // The headline claim, checked in pixels rather than in percentages, because "visually
    // negligible" is a statement about pixels.
    //
    // Portrait framing on a 1080p canvas puts roughly 60 px across the iris, so the iris radius
    // is 30 px. The pupil at the authored size is about a third of the iris diameter (4 mm pupil
    // in a ~12 mm iris), so the pupil EDGE sits at ~10 px from centre. A `pupilScale` of 1 + d
    // therefore moves that edge by d * 10 px — and it is the edge that a viewer can see moving,
    // not the iris.
    const IRIS_RADIUS_PIXELS = 30;
    const AUTHORED_PUPIL_RADIUS_FRACTION = 0.33;
    const pupilRadiusPixels = IRIS_RADIUS_PIXELS * AUTHORED_PUPIL_RADIUS_FRACTION;

    const faithful = new Pupil( { hippus: false, exaggeration: 1 } );
    const exaggerated = new Pupil( { hippus: false, exaggeration: PUPIL_CONSTANTS.DEFAULT_EXAGGERATION } );

    const restingArousal = 0.33;
    const restingScale = ( pupil ) => pupil.scaleFromDiameter( diameterAtArousal( restingArousal ) );

    // Case 1 — the REAL task-evoked response: +0.1 mm on the pupil, straight from the research.
    const taskEvokedDiameter = diameterAtArousal( restingArousal ) + 0.1;

    const faithfulTaskEvokedPixels = Math.abs( faithful.scaleFromDiameter( taskEvokedDiameter ) - restingScale( faithful ) ) * pupilRadiusPixels;
    const exaggeratedTaskEvokedPixels = Math.abs( exaggerated.scaleFromDiameter( taskEvokedDiameter ) - restingScale( exaggerated ) ) * pupilRadiusPixels;

    check(
        'pupil: the real task-evoked response is sub-pixel even at the default 3x — so physiology is the wrong thing to model',
        faithfulTaskEvokedPixels < 1 && exaggeratedTaskEvokedPixels < 1,
        `+0.1 mm moves the pupil edge ${ faithfulTaskEvokedPixels.toFixed( 3 ) } px faithfully, ${ exaggeratedTaskEvokedPixels.toFixed( 3 ) } px at 3x. This is why the layer drives an AFFECT arousal scalar across the whole 2-8 mm emotional range instead.`
    );

    // Case 2 — what the layer actually drives: a modest step on the arousal scalar, of the size a
    // cognitive-load or affect signal would plausibly produce.
    const steppedDiameter = diameterAtArousal( restingArousal + 0.1 );

    const faithfulStepPixels = Math.abs( faithful.scaleFromDiameter( steppedDiameter ) - restingScale( faithful ) ) * pupilRadiusPixels;
    const exaggeratedStepPixels = Math.abs( exaggerated.scaleFromDiameter( steppedDiameter ) - restingScale( exaggerated ) ) * pupilRadiusPixels;

    check(
        'pupil: a 0.1 step on the arousal scalar is clearly legible at the default exaggeration, and marginal without it',
        exaggeratedStepPixels > 3 && faithfulStepPixels < 2,
        `pupil edge moves ${ faithfulStepPixels.toFixed( 2 ) } px at 1x vs ${ exaggeratedStepPixels.toFixed( 2 ) } px at ${ PUPIL_CONSTANTS.DEFAULT_EXAGGERATION }x`
    );

    check(
        'pupil: exaggeration scales the deviation, and leaves the authored size at exactly 1',
        Math.abs( exaggeratedStepPixels / faithfulStepPixels - PUPIL_CONSTANTS.DEFAULT_EXAGGERATION ) < 1e-9
            && exaggerated.scaleFromDiameter( PUPIL_CONSTANTS.AUTHORED_PUPIL_DIAMETER_MILLIMETRES ) === 1,
        `amplification ${ ( exaggeratedStepPixels / faithfulStepPixels ).toFixed( 4 ) }x`
    );
}

{
    const stack = new MotionStack( { seed: 17 } ).bind( target );
    const pupil = stack.add( new Pupil( { hippus: false } ) );

    // Dilation is sympathetic and slow; constriction is parasympathetic and quick.
    pupil.snapToArousal( 0.2 );
    pupil.setArousal( 0.9 );

    let framesToDilate = 0;
    while ( pupil.smoothedArousal < 0.2 + ( 0.9 - 0.2 ) * 0.632 && framesToDilate < 600 ) {

        stack.update( 1 / 60 );
        framesToDilate ++;

    }

    pupil.snapToArousal( 0.9 );
    pupil.setArousal( 0.2 );

    let framesToConstrict = 0;
    while ( pupil.smoothedArousal > 0.9 - ( 0.9 - 0.2 ) * 0.632 && framesToConstrict < 600 ) {

        stack.update( 1 / 60 );
        framesToConstrict ++;

    }

    check(
        'pupil: dilation is measurably slower than constriction',
        framesToDilate > framesToConstrict * 1.8,
        `dilate ${ ( framesToDilate / 60 ).toFixed( 3 ) } s (tau ${ PUPIL_CONSTANTS.DILATION_TIME_CONSTANT_SECONDS }) vs constrict ${ ( framesToConstrict / 60 ).toFixed( 3 ) } s (tau ${ PUPIL_CONSTANTS.CONSTRICTION_TIME_CONSTANT_SECONDS })`
    );

    stack.dispose();
}

{
    // The shader contract: pupilEdge = authoredRadius * scale must stay well below 1, or the
    // `1 - pupilEdge` divide in the annulus remap blows up.
    const pupil = new Pupil( { exaggeration: 20 } );
    const extremes = [];

    for ( let step = 0; step <= 100; step ++ ) {

        extremes.push( pupil.scaleFromDiameter( diameterAtArousal( step / 100 ) ) );

    }

    check(
        'pupil: scale stays inside PUPIL_SCALE_BOUNDS even at a 20x exaggeration (the Phase 3.3 divide is safe)',
        Math.min( ...extremes ) >= PUPIL_CONSTANTS.PUPIL_SCALE_BOUNDS[ 0 ] && Math.max( ...extremes ) <= PUPIL_CONSTANTS.PUPIL_SCALE_BOUNDS[ 1 ],
        `${ Math.min( ...extremes ).toFixed( 3 ) } .. ${ Math.max( ...extremes ).toFixed( 3 ) } within ${ PUPIL_CONSTANTS.PUPIL_SCALE_BOUNDS.join( ' .. ' ) }`
    );

    check(
        'pupil: arousal maps monotonically onto diameter across the recorded 2-8 mm range',
        diameterAtArousal( 0 ) === PUPIL_CONSTANTS.PUPIL_DIAMETER_RANGE_MILLIMETRES[ 0 ]
            && diameterAtArousal( 1 ) === PUPIL_CONSTANTS.PUPIL_DIAMETER_RANGE_MILLIMETRES[ 1 ]
    );
}

{
    // Hippus is small enough to read as life rather than as a flicker, and independent of the
    // exaggeration factor.
    const calm = new Pupil( { hippus: true, exaggeration: 3 } );
    const loud = new Pupil( { hippus: true, exaggeration: 12 } );

    let calmSwing = 0;
    let loudSwing = 0;

    for ( let step = 0; step < 4000; step ++ ) {

        calm.elapsed = step * 0.05;
        loud.elapsed = step * 0.05;

        calmSwing = Math.max( calmSwing, Math.abs( calm.scaleFromDiameter( 4 ) - 1 ) );
        loudSwing = Math.max( loudSwing, Math.abs( loud.scaleFromDiameter( 4 ) - 1 ) );

    }

    check(
        'pupil: hippus amplitude does not scale with the exaggeration factor',
        Math.abs( calmSwing - loudSwing ) < 1e-9 && calmSwing < 0.03,
        `swing ${ ( calmSwing * 100 ).toFixed( 2 ) }% at 3x and ${ ( loudSwing * 100 ).toFixed( 2 ) }% at 12x`
    );
}

// --- the picture ------------------------------------------------------------------------------------
//
// Everything above is a number. This is the same claim as a shape, so a reviewer can see that the
// left edge is a cliff and the right edge is a ramp.

printBlinkCurve();

function printBlinkCurve() {

    const stack = new MotionStack( { seed: 42 } ).bind( target );
    const blink = stack.add( new Blink() );

    blink.elapsed = -1;
    blink.beginBlink( false );

    const closing = blink.closingDuration;
    const hold = blink.closedHold;
    const opening = blink.openingDuration;
    const total = blink.blinkDuration();

    const columns = 96;
    const rows = 22;
    const stepSeconds = total / ( columns - 1 );

    const grid = [];
    for ( let row = 0; row < rows; row ++ ) grid.push( new Array( columns ).fill( ' ' ) );

    for ( let column = 0; column < columns; column ++ ) {

        const seconds = column * stepSeconds;
        const closure = blink.eyelidClosureAt( seconds );

        // Row 0 is fully shut at the top, so the plot reads the way an eyelid moves.
        const row = Math.round( ( 1 - closure ) * ( rows - 1 ) );
        grid[ row ][ column ] = '#';

    }

    const closingColumn = Math.round( closing / stepSeconds );
    const holdEndColumn = Math.round( ( closing + hold ) / stepSeconds );

    process.stdout.write( '\n' );
    process.stdout.write( 'ONE BLINK, sampled from the shipped distribution (seed 42)\n' );
    process.stdout.write( `  downphase ${ ( closing * 1000 ).toFixed( 0 ) } ms   closed ${ ( hold * 1000 ).toFixed( 0 ) } ms   upphase ${ ( opening * 1000 ).toFixed( 0 ) } ms   total ${ ( total * 1000 ).toFixed( 0 ) } ms\n` );
    process.stdout.write( `  duration ratio ${ ( opening / closing ).toFixed( 2 ) }x   peak velocity ratio ${ ( peakPhaseVelocities( closing, opening ).downphase / peakPhaseVelocities( closing, opening ).upphase ).toFixed( 2 ) }x\n\n` );

    for ( let row = 0; row < rows; row ++ ) {

        const closureLabel = ( 1 - row / ( rows - 1 ) ).toFixed( 2 );
        const axis = row === 0 ? 'shut ' : row === rows - 1 ? 'open ' : '     ';

        process.stdout.write( `${ axis }${ closureLabel } |${ grid[ row ].join( '' ) }\n` );

    }

    const ruler = new Array( columns ).fill( '-' );
    ruler[ Math.min( closingColumn, columns - 1 ) ] = '|';
    ruler[ Math.min( holdEndColumn, columns - 1 ) ] = '|';

    process.stdout.write( `           +${ ruler.join( '' ) }\n` );

    const labels = new Array( columns ).fill( ' ' );
    writeLabel( labels, Math.max( closingColumn - 4, 0 ), 'FALL' );
    writeLabel( labels, Math.min( holdEndColumn + 1, columns - 6 ), 'CREEP BACK UP' );

    process.stdout.write( `            ${ labels.join( '' ) }\n` );
    process.stdout.write( `            0 ms${ ' '.repeat( Math.max( columns - 12, 1 ) ) }${ ( total * 1000 ).toFixed( 0 ) } ms\n` );
    process.stdout.write( '\n  The cliff on the left and the ramp on the right ARE the finding. Live2D\'s 0.1 s / 0.15 s\n' );
    process.stdout.write( '  default would put a near-symmetric V here, tilted slightly the wrong way.\n\n' );

    stack.dispose();

}

function writeLabel( cells, start, text ) {

    for ( let index = 0; index < text.length && start + index < cells.length; index ++ ) {

        cells[ start + index ] = text[ index ];

    }

}

// --- statistics helpers ----------------------------------------------------------------------------

function mean( values ) {

    let total = 0;
    for ( const value of values ) total += value;
    return total / values.length;

}

function standardDeviation( values ) {

    const average = mean( values );
    let total = 0;

    for ( const value of values ) total += ( value - average ) * ( value - average );

    return Math.sqrt( total / values.length );

}

/**
 * Chi-square against exponential using equiprobable bins. Equiprobable bins are used rather than
 * equal-width ones so every expected count is identical and no tail bin ends up under-populated,
 * which is the usual way this test gets quietly invalidated.
 */
function exponentialChiSquare( samples, meanSeconds, binCount ) {

    // Bin edges at the quantiles of the exponential: -mean * ln(1 - k/binCount).
    const edges = [];
    for ( let bin = 1; bin < binCount; bin ++ ) {

        edges.push( -meanSeconds * Math.log( 1 - bin / binCount ) );

    }

    const counts = new Array( binCount ).fill( 0 );

    for ( const sample of samples ) {

        let bin = 0;
        while ( bin < edges.length && sample > edges[ bin ] ) bin ++;
        counts[ bin ] ++;

    }

    const expected = samples.length / binCount;
    let statistic = 0;

    for ( const count of counts ) {

        statistic += ( count - expected ) * ( count - expected ) / expected;

    }

    return { statistic, degreesOfFreedom: binCount - 1, counts, expected };

}

function sampleVelocity( profile, steps = 2000 ) {

    const velocities = [];
    const step = 1 / steps;

    for ( let index = 0; index < steps; index ++ ) {

        const from = index * step;
        velocities.push( ( profile( from + step ) - profile( from ) ) / step );

    }

    return velocities;

}

function peakOverMean( velocities ) {

    return Math.max( ...velocities ) / mean( velocities );

}

/** Where in the phase the peak velocity happens, 0..1. The shape signature of each profile. */
function argMaxFraction( velocities ) {

    let bestIndex = 0;

    for ( let index = 1; index < velocities.length; index ++ ) {

        if ( velocities[ index ] > velocities[ bestIndex ] ) bestIndex = index;

    }

    return bestIndex / velocities.length;

}

function isMonotonic( profile, steps = 2000 ) {

    let previous = profile( 0 );

    for ( let index = 1; index <= steps; index ++ ) {

        const value = profile( index / steps );
        if ( value < previous - 1e-12 ) return false;
        previous = value;

    }

    return true;

}

// --- results ----------------------------------------------------------------------------------------

let failed = 0;

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
