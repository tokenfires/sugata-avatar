#!/usr/bin/env node
//
// ocular.selftest.mjs — proves Blink.js and Pupil.js do what their headers claim.
//
// Run: node packages/core/src/motion/ocular.selftest.mjs
//
// Punch-list 2.1 and 2.8. The claims under test are the ones the perceptual result hangs on:
//
//   BLINK
//     (a0) the morph weight at which the lid actually seals, measured off all five GLBs of the
//         gender sweep rather than assumed, and checked against the constant Blink drives to.
//         The morph is linear and keeps going past the seal, so "1.0" is not "shut" — it is
//         shut plus 3.8 mm of lid pushed through the lower lid.
//     (a) the downphase is measurably shorter — and faster — than the upphase, for EVERY blink,
//         not merely on average. This is the whole reason the file exists; Live2D ships it the
//         other way round.
//     (b) full eyelid closure is reached, at 30, 60 and 120 fps and under jittered frame times.
//         Trutoiu et al. found partial-closure blinks read as wrong. Measured on the perceptual
//         aperture, which is what the snap logic works in; the mapping onto the morph is linear
//         and exact and is checked separately.
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

import { Box3, Vector3 } from 'three';

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

// The shipped figures, unless SUGATA_FIGURES_DIR says otherwise. The override exists so the
// lid-seal probe below can be pointed at a KNOWN-BAD sweep and shown to fail — build one with
// `tools/figure-pipeline/build.sh --eye-proxy low-poly.mhclo` into a scratch directory. A probe
// that has only ever been run against the asset it was tuned on is not known to work
// (docs/LEARNINGS.md 1.1).
const FIGURES = process.env.SUGATA_FIGURES_DIR
    ? path.resolve( process.env.SUGATA_FIGURES_DIR )
    : path.resolve( HERE, '../../../../assets/figures' );
const FIGURE_PATH = path.join( FIGURES, 'figure_g050.glb' );
const GENDER_SWEEP = [ 'g000', 'g025', 'g050', 'g075', 'g100' ];

/** Cells across the eyeball in the lid-seal probe. 160 puts a grid cell at about 0.2 mm. */
const SEAL_PROBE_GRID = 160;

// Every mesh that makes up the eye itself. MakeHuman names its eyeball proxy for its topology
// rather than its anatomy, so the globe is 'Human.high-poly' and the clear shell over it is
// 'Human.cornea'; GLTFLoader strips the dot. Matching on /eye/ would find the lashes and the brows
// and never find the eyeballs. 'low-poly' stays in the pattern so the probe still runs against a
// figure built with the superseded single-shell proxy.
const EYEBALL_MESH_PATTERN = /high-poly|low-poly|cornea|eyeball/i;

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

// --- (a0) where the lid actually shuts, measured off the GLB --------------------------------------
//
// Blink's output constant claims the eye is sealed at a particular morph weight. That is a claim
// about the ASSET, so it is re-derived from the asset here rather than trusted: the eye-region
// skin and the eyeball are rasterised into a frontal depth map and the weight is bisected for
// until no eyeball is visible from straight ahead. No assumption is made about which vertices are
// "the lid" — the eye is open exactly where the eyeball is in front of the skin.
//
// This is the check that stops the constant drifting away from the figure when the figure is
// rebuilt, which is the failure mode a hand-tuned magic number always eventually has.

{
    const rows = [];
    let worstUnderClosure = 0;
    let worstOvershoot = 0;

    for ( const name of GENDER_SWEEP ) {

        const measured = await measureLidSeal( path.join( FIGURES, `figure_${ name }.glb` ) );

        rows.push( `  ${ name }  seals at ${ measured.seal.toFixed( 3 ) }   ` +
            `lashes clear at ${ measured.sealWithLashes.toFixed( 3 ) }   ` +
            `open aperture ${ ( measured.openArea * 1e6 ).toFixed( 1 ) } mm2` );

        worstUnderClosure = Math.max( worstUnderClosure, measured.seal - BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT );
        worstOvershoot = Math.max( worstOvershoot, BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT - measured.seal );

    }

    process.stdout.write( `\nLID SEAL, measured off each GLB (Blink drives to ${ BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT })\n` );
    for ( const row of rows ) process.stdout.write( `${ row }\n` );
    process.stdout.write( '\n' );

    check(
        'blink: the configured full-closure weight actually shuts the eye on every figure in the sweep',
        worstUnderClosure <= 0,
        `worst shortfall ${ worstUnderClosure.toFixed( 4 ) } of a weight; Trutoiu found partial-closure blinks read as wrong`
    );

    // The other side of the same trade: sealing every figure means over-driving the ones that seal
    // early. Held to a tenth of a weight, which on this lid is under a millimetre of travel —
    // against the 0.30 of a weight, ~3.8 mm, the layer used to push through the lower lid.
    check(
        'blink: and does not drive any of them far past the seal',
        worstOvershoot < 0.1,
        `worst overshoot ${ worstOvershoot.toFixed( 4 ) } of a weight past the seal`
    );
}

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
    let amplitudeThisBlink = blink.closureAmplitude;
    const peaks = [];
    const amplitudes = [];
    const onsets = [];

    while ( elapsed < seconds ) {

        const dt = jitterRandom === null
            ? frameSeconds
            : frameSeconds * jitterRandom.range( 0.6, 1.4 );

        stack.update( dt );
        elapsed += Math.min( dt, stack.maxDeltaSeconds );

        if ( blink.blinkCount !== previousCount ) {

            if ( previousCount > 0 ) {

                peaks.push( peakThisBlink );
                amplitudes.push( amplitudeThisBlink );

            }

            onsets.push( elapsed );
            peakThisBlink = 0;
            amplitudeThisBlink = blink.closureAmplitude;
            previousCount = blink.blinkCount;

        }

        peakThisBlink = Math.max( peakThisBlink, blink.closure );
        trace.push( blink.closure );

    }

    peaks.push( peakThisBlink );
    amplitudes.push( amplitudeThisBlink );
    stack.dispose();

    return { blink, trace, peaks, amplitudes, onsets, elapsed };

}

/**
 * The largest gap between what a blink sampled and what the frames actually rendered.
 *
 * This is the claim the closure snap makes, and since amplitude became a mixture it covers every
 * blink rather than only the complete ones: a partial blink's peak is skippable in exactly the
 * same way a complete one's is, and the snap has to catch both.
 */
function worstRenderedShortfall( peaks, amplitudes ) {

    let worst = 0;

    for ( let index = 0; index < peaks.length; index ++ ) {

        worst = Math.max( worst, Math.abs( peaks[ index ] - amplitudes[ index ] ) );

    }

    return worst;

}

for ( const [ label, frameSeconds ] of [ [ '120 fps', 1 / 120 ], [ '60 fps', 1 / 60 ], [ '30 fps', 1 / 30 ] ] ) {

    const { peaks, amplitudes } = runBlinkTrace( { frameSeconds, seconds: 600 } );

    const complete = peaks.filter( ( peak, index ) => amplitudes[ index ] === 1 );
    const worstComplete = Math.min( ...complete );

    check(
        `blink: full closure (exactly 1.0) is reached on every complete blink at ${ label }`,
        worstComplete === 1,
        `${ complete.length } complete of ${ peaks.length } blinks, worst rendered peak ${ worstComplete.toFixed( 6 ) }`
    );

    check(
        `blink: every blink renders exactly the amplitude it sampled at ${ label }`,
        worstRenderedShortfall( peaks, amplitudes ) === 0,
        `worst shortfall ${ worstRenderedShortfall( peaks, amplitudes ).toExponential( 2 ) } over ${ peaks.length } blinks`
    );

}

{
    const jitter = new MotionRandom( 99 );
    const { peaks, amplitudes } = runBlinkTrace( { frameSeconds: 1 / 30, seconds: 900, jitterRandom: jitter } );

    const complete = peaks.filter( ( peak, index ) => amplitudes[ index ] === 1 );

    check(
        'blink: full closure survives jittered 30 fps frame times (20-46 ms steps)',
        Math.min( ...complete ) === 1,
        `${ complete.length } complete blinks, worst rendered peak ${ Math.min( ...complete ).toFixed( 6 ) }`
    );

    check(
        'blink: a partial blink survives them too, at exactly its own amplitude',
        worstRenderedShortfall( peaks, amplitudes ) === 0,
        `worst shortfall ${ worstRenderedShortfall( peaks, amplitudes ).toExponential( 2 ) } over ${ peaks.length } blinks`
    );
}

// --- (b2) amplitude is a mixture, and the ceiling never moves --------------------------------------
//
// The defect this section exists for: eleven blinks in a 20-second capture, ONE peak value between
// them. What is checked is that the variety is real (many distinct peaks, both populations
// present), that it is variety in the right DIRECTION (never above the seal, which is where the
// lash cards start punching through the lid), and that complete blinks still complete.

{
    const { peaks, amplitudes } = runBlinkTrace( { frameSeconds: 1 / 60, seconds: 600 } );

    const distinct = new Set( peaks.map( ( peak ) => peak.toFixed( 4 ) ) );
    const partials = amplitudes.filter( ( amplitude ) => amplitude < 1 );
    const partialShare = partials.length / amplitudes.length;

    process.stdout.write(
        `\nBLINK AMPLITUDE over ${ peaks.length } blinks: ${ distinct.size } distinct peaks, ` +
        `${ ( partialShare * 100 ).toFixed( 1 ) }% partial, ` +
        `range ${ Math.min( ...peaks ).toFixed( 3 ) }..${ Math.max( ...peaks ).toFixed( 3 ) }\n` );

    check(
        'blink: blink amplitude actually varies — not one value repeated',
        distinct.size > peaks.length * 0.2,
        `${ distinct.size } distinct peaks over ${ peaks.length } blinks (was 1 over 11)`
    );

    check(
        'blink: genuine partial blinks happen, and completing ones still dominate',
        partialShare > 0.15 && partialShare < 0.5,
        `${ ( partialShare * 100 ).toFixed( 1 ) }% partial against a configured ${ ( BLINK_CONSTANTS.PARTIAL_BLINK_PROBABILITY * 100 ).toFixed( 0 ) }%`
    );

    check(
        'blink: no blink ever closes PAST full closure',
        Math.max( ...peaks ) <= 1,
        `largest rendered peak ${ Math.max( ...peaks ).toFixed( 6 ) }; past 1.0 the lash cards punch through the lower lid`
    );

    check(
        'blink: the partial population stays inside its configured band',
        partials.every( ( amplitude ) =>
            amplitude >= BLINK_CONSTANTS.PARTIAL_CLOSURE_RANGE[ 0 ] &&
            amplitude <= BLINK_CONSTANTS.PARTIAL_CLOSURE_RANGE[ 1 ] ),
        `${ partials.length } partials in ${ BLINK_CONSTANTS.PARTIAL_CLOSURE_RANGE.join( '..' ) }`
    );

    // The morph is the thing that can actually break the asset, so the ceiling is checked in morph
    // units as well as in aperture units.
    const worstMorphWeight = Math.max( ...peaks ) * BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT;

    check(
        'blink: and the morph weight never passes the measured seal',
        worstMorphWeight <= BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT + 1e-12,
        `worst ${ worstMorphWeight.toFixed( 6 ) } against a seal of ${ BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT }`
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
    // Blink alone: the committed morph must reach the seal and stop there. A peak of 1.0 here is
    // the defect, not the goal — it means the lid has been driven a third of a range past shut.
    const solo = new MotionStack( { seed: 3 } ).bind( target );
    const soloBlink = solo.add( new Blink() );

    soloBlink.blinkNow();

    let soloPeak = 0;

    for ( let frame = 0; frame < 40; frame ++ ) {

        solo.update( 1 / 60 );
        soloPeak = Math.max( soloPeak, solo.morphChannels.get( 'eyeBlinkLeft' ).committed );

    }

    check(
        'blink: eyeBlinkLeft commits exactly the measured full-closure weight, and not 1.0',
        Math.abs( soloPeak - BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT ) < 1e-9,
        `committed peak ${ soloPeak.toFixed( 6 ) } against a seal at ${ BLINK_CONSTANTS.FULL_CLOSURE_MORPH_WEIGHT }`
    );

    solo.dispose();
}

{
    const stack = new MotionStack( { seed: 3 } ).bind( target );
    const blink = stack.add( new Blink() );

    // A stand-in for the expression layer, so the sum-and-clamp path is exercised too. The squint
    // is deep enough that the sum overshoots 1.0, because the clamp is the thing under test.
    class SquintLayer extends Layer {

        constructor() {

            super( { name: 'squint', order: MOTION_ORDER.EXPRESSION, morphChannels: [ 'eyeBlinkLeft', 'eyeBlinkRight' ] } );

        }

        update() {

            this.contribution.setMorph( 'eyeBlinkLeft', 0.4 );
            this.contribution.setMorph( 'eyeBlinkRight', 0.4 );
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

// --- the lid-seal probe -------------------------------------------------------------------------
//
// An orthographic depth test, done by hand rather than with a renderer so it runs in node and is
// deterministic to the last bit. The eye is "open" wherever the eyeball's frontmost surface is in
// front of the skin's, seen from straight ahead — which is the definition a viewer uses.

async function measureLidSeal( figurePath ) {

    const buffer = fs.readFileSync( figurePath );
    const gltf = await new GLTFLoader().parseAsync(
        buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ), '' );

    gltf.scene.updateMatrixWorld( true );

    const meshes = { eyeball: [] };
    gltf.scene.traverse( ( object ) => {

        if ( object.isMesh !== true ) return;
        if ( object.name === 'Human' ) meshes.skin = object;
        if ( object.name === 'Humaneyelashes01' ) meshes.lashes = object;
        // BOTH shells of the eye, not just the globe. The high-poly proxy is a globe carrying the
        // iris with a clear corneal shell over it, and the cornea's apex sits 2.15-2.40 mm in
        // front of the globe's (measured by tools/figure-pipeline/verify_glb.mjs). A lid that
        // covers the globe but not the cornea is not shut — the cornea is what protrudes, and
        // being transmissive does not stop it drawing through the lid.
        //
        // Matched by pattern rather than by name equality: this line used to read
        // `object.name === 'Humanlow-poly'`, and an equality against a name that changed leaves
        // `meshes.eyeball` undefined for the whole probe.
        if ( EYEBALL_MESH_PATTERN.test( object.name ) ) meshes.eyeball.push( object );

    } );

    if ( meshes.eyeball.length === 0 ) {

        throw new Error( `no mesh matching ${ EYEBALL_MESH_PATTERN } in ${ figurePath }` );

    }

    // The character's own left eye. The two are mirror images and measure identically, so one is
    // the measurement and the other would be a second copy of it.
    const box = eyeballBox( meshes.eyeball, 1 );
    const view = frontalGrid( box );

    const eyeball = meshes.eyeball.flatMap( ( mesh ) => eyePatch( mesh, box, 'eyeBlinkLeft' ) );
    const eyeballDepth = depthMap( eyeball, view, 0 );
    const skin = eyePatch( meshes.skin, box, 'eyeBlinkLeft' );
    const lashes = eyePatch( meshes.lashes, box, 'eyeBlinkLeft' );

    return {
        openArea: visibleArea( eyeballDepth, depthMap( skin, view, 0 ), view ),
        seal: bisectSealWeight( eyeballDepth, skin, view ),
        sealWithLashes: bisectSealWeight( eyeballDepth, [ ...skin, ...lashes ], view )
    };

}

/** Bounds of one eye, over every mesh that makes it up — the globe and the corneal shell. */
function eyeballBox( meshes, side ) {

    const point = new Vector3();
    const box = new Box3();

    for ( const mesh of meshes ) {

        const position = mesh.geometry.attributes.position;

        for ( let index = 0; index < position.count; index ++ ) {

            point.fromBufferAttribute( position, index ).applyMatrix4( mesh.matrixWorld );
            if ( Math.sign( point.x ) === side ) box.expandByPoint( point );

        }

    }

    return box;

}

/** A square frontal grid a little larger than the eyeball, in world units. */
function frontalGrid( box ) {

    const size = box.getSize( new Vector3() );
    const extent = Math.max( size.x, size.y );

    return {
        originX: box.min.x - extent * 0.1,
        originY: box.min.y - extent * 0.1,
        step: extent * 1.2 / SEAL_PROBE_GRID
    };

}

/** Triangles of one mesh near the eye, each with the morph displacement that applies to it. */
function eyePatch( mesh, box, morphName ) {

    if ( mesh === undefined ) return [];

    const geometry = mesh.geometry;
    const index = geometry.index;
    const position = geometry.attributes.position;
    const morphIndex = mesh.morphTargetDictionary?.[ morphName ];
    const displacement = morphIndex === undefined ? null : geometry.morphAttributes.position[ morphIndex ];

    const meshScale = new Vector3().setFromMatrixScale( mesh.matrixWorld );
    const centre = box.getCenter( new Vector3() );
    const reach = box.getSize( new Vector3() ).length();

    const triangles = [];
    const count = index !== null ? index.count / 3 : position.count / 3;

    for ( let triangle = 0; triangle < count; triangle ++ ) {

        const base = [];
        const move = [];
        let near = false;

        for ( let corner = 0; corner < 3; corner ++ ) {

            const vertex = index !== null ? index.getX( triangle * 3 + corner ) : triangle * 3 + corner;

            const point = new Vector3().fromBufferAttribute( position, vertex ).applyMatrix4( mesh.matrixWorld );

            base.push( point );
            move.push( displacement === null
                ? new Vector3()
                : new Vector3( displacement.getX( vertex ), displacement.getY( vertex ), displacement.getZ( vertex ) )
                    .multiply( meshScale ) );

            if ( point.distanceTo( centre ) < reach ) near = true;

        }

        if ( near ) triangles.push( { base, move } );

    }

    return triangles;

}

/** Frontmost z of these triangles per grid cell, with the morph applied at `weight`. */
function depthMap( triangles, view, weight ) {

    const depth = new Float64Array( SEAL_PROBE_GRID * SEAL_PROBE_GRID ).fill( -Infinity );

    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();

    for ( const triangle of triangles ) {

        a.copy( triangle.base[ 0 ] ).addScaledVector( triangle.move[ 0 ], weight );
        b.copy( triangle.base[ 1 ] ).addScaledVector( triangle.move[ 1 ], weight );
        c.copy( triangle.base[ 2 ] ).addScaledVector( triangle.move[ 2 ], weight );

        // Twice the signed screen-space area. Zero means the triangle is edge-on and covers
        // nothing; the barycentric signs below stay consistent whichever way it winds.
        const area = ( b.x - a.x ) * ( c.y - a.y ) - ( c.x - a.x ) * ( b.y - a.y );
        if ( Math.abs( area ) < 1e-15 ) continue;

        const fromColumn = gridIndex( Math.min( a.x, b.x, c.x ) - view.originX, view.step );
        const toColumn = gridIndex( Math.max( a.x, b.x, c.x ) - view.originX, view.step );
        const fromRow = gridIndex( Math.min( a.y, b.y, c.y ) - view.originY, view.step );
        const toRow = gridIndex( Math.max( a.y, b.y, c.y ) - view.originY, view.step );

        for ( let row = fromRow; row <= toRow; row ++ ) {

            const y = view.originY + ( row + 0.5 ) * view.step;

            for ( let column = fromColumn; column <= toColumn; column ++ ) {

                const x = view.originX + ( column + 0.5 ) * view.step;

                const alpha = ( ( b.x - x ) * ( c.y - y ) - ( c.x - x ) * ( b.y - y ) ) / area;
                const beta = ( ( c.x - x ) * ( a.y - y ) - ( a.x - x ) * ( c.y - y ) ) / area;
                const gamma = 1 - alpha - beta;

                if ( alpha < 0 || beta < 0 || gamma < 0 ) continue;

                const z = alpha * a.z + beta * b.z + gamma * c.z;
                const cell = row * SEAL_PROBE_GRID + column;

                if ( z > depth[ cell ] ) depth[ cell ] = z;

            }

        }

    }

    return depth;

}

function gridIndex( offset, step ) {

    return Math.min( SEAL_PROBE_GRID - 1, Math.max( 0, Math.round( offset / step ) ) );

}

/** Square metres of eyeball still in front of the skin. */
function visibleArea( eyeballDepth, skinDepth, view ) {

    let cells = 0;

    for ( let cell = 0; cell < eyeballDepth.length; cell ++ ) {

        if ( eyeballDepth[ cell ] === -Infinity ) continue;
        if ( eyeballDepth[ cell ] > skinDepth[ cell ] ) cells ++;

    }

    return cells * view.step * view.step;

}

/** Smallest morph weight at which not one grid cell of eyeball is left showing. */
function bisectSealWeight( eyeballDepth, occluders, view ) {

    if ( visibleArea( eyeballDepth, depthMap( occluders, view, 1 ), view ) > 0 ) return Number.POSITIVE_INFINITY;

    let open = 0;
    let sealed = 1;

    for ( let step = 0; step < 20; step ++ ) {

        const middle = ( open + sealed ) / 2;

        if ( visibleArea( eyeballDepth, depthMap( occluders, view, middle ), view ) > 0 ) open = middle;
        else sealed = middle;

    }

    return sealed;

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
