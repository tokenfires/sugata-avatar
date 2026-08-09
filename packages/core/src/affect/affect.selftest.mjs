/**
 * Gate for `affect/AffectState.js`, `affect/ExpressionMap.js`, `affect/ExpressionLayer.js` and
 * `affect/ReflexAffect.js` — punch-list 5.1, 5.2, 5.4 and 5.5.
 *
 * Everything here is measured by EXECUTION. Nothing reads the source, and the MOUTH and REAL FIGURE
 * sections drive a real `MotionStack` over a real `figure_g050.glb` and read the resulting
 * `morphTargetInfluences`, because "a gate that tests a CPU mirror of a GPU node, plus a regex over
 * the source, tests neither" (LEARNINGS §1.25b).
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   CONSTANTS   Every declared constant is RE-DERIVED from the table it came from, in this
 *               process, and compared to the declaration. A constant that drifted from its own
 *               derivation is the defect LEARNINGS §5 was written about — a value can sit inside a
 *               passing band and still be wrong — so nothing here is checked against a band alone.
 *
 *   ANCHORS     No two emotions share an anchor, and the value the research doc transcribes for
 *               `angry` is REJECTED by the same check. That is the rejection proof for a
 *               documentation fix, executed rather than argued.
 *
 *   SMOOTHING   The attack and decay time constants, measured off the trajectory by finding where
 *               it crosses 1 - 1/e and 1/e, against the DECLARED values and against research §8.3's
 *               bands. Asymmetry is measured as a ratio. `symmetricSmoothing` is proved red.
 *
 *   MOOD        The slow layer crosses its target at ALMA's stated durations, returns at the other
 *               one, and is 298x slower than the fast layer over one second — the number Phase 9's
 *               Dresser is entitled to rely on.
 *
 *   INVARIANCE  🚩 The section this project has earned four times. Same pushes at 30, 60 and 120 Hz,
 *               compared at every shared instant. Proved red by THREE structurally different
 *               defects, and for each one the section also measures what a WEAKER gate would have
 *               said and requires it to have said "fine".
 *
 *   WASABI      Threshold-and-saturate, not proximity-blend. At most two emotions active and at
 *               most one saturated, over ALMA's own 24 emotion vectors and over a 41^3 PAD grid.
 *               Proved red by three different ways of producing mush.
 *
 *   DOMINANCE   🚩 The face cannot receive dominance. Not "does not" — cannot: the type has two
 *               keys, the call throws on a third, and a 201-step sweep of D at fixed (P, A) moves
 *               no AU by any amount at all. Proved red by two different leak paths.
 *
 *   MOUTH       The mouth belongs to lipsync, measured on the real figure with a live viseme
 *               underneath the expression.
 *
 *   REFLEX      VADER's rules, each one exercised; the sub-millisecond budget, measured; and the
 *               licence, asserted against the tree rather than promised in a comment.
 *
 *   AROUSAL     The prosody half, over synthesised readings, including that loudness dominates by
 *               the factor the GeMAPS table says it does.
 *
 * A measurement outside its range prints FAIL and the process exits non-zero. It is not grounds for
 * widening the range.
 *
 * Usage:  node "packages/core/src/affect/affect.selftest.mjs"
 *         node "packages/core/src/affect/affect.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader as far as the morph data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Figure } = await import( '../figure/Figure.js' );
const { ARKIT_REGIONS, MAX_CORNER_OFFSET, OVR_VISEMES } = await import( '../figure/ExpressionBank.js' );
const { MotionStack, createMotionTarget } = await import( '../motion/MotionStack.js' );
const { VisemeLayer } = await import( '../voice/VisemeLayer.js' );

const {
    ATTACK_SECONDS, AffectState, DECAY_SECONDS, MOOD_CHANGE_SECONDS, MOOD_RETURN_SECONDS,
    PAD_AXES, PAD_AXIS_SPAN, octantName
} = await import( './AffectState.js' );

const {
    ACTIVATION_THRESHOLD, ALMA_OCC_PAD, ANCHOR_SETS, AU_MORPHS, DOMINANCE_METRIC_WEIGHT,
    EMOTION_MORPHS, ExpressionMap, MAX_ACTIVE_EMOTIONS, MOUTH_CORNER_MORPHS, SATURATION_THRESHOLD,
    WASABI_ANCHORS, au12, au15, au25, au26, au43, au5, minimumAnchorSeparation, nearestDistance
} = await import( './ExpressionMap.js' );

const { ExpressionLayer } = await import( './ExpressionLayer.js' );

const {
    AROUSAL_FEATURE_WEIGHTS, AROUSAL_FULL_SCALE, GEMAPS_PERCENT_CHANGE, ReflexAffect, VADER
} = await import( './ReflexAffect.js' );

const { DOMINANCE_CONFIDENCE, SEED_LEXICON, SEED_LEXICON_PROVENANCE } = await import( './SeedLexicon.js' );

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );
const figurePath = path.resolve( repoRoot, process.argv[ 2 ] ?? 'assets/figures/figure_g050.glb' );

const checks = [];

function check( name, condition, detail = '' ) {

    checks.push( { name, passed: condition === true, detail } );

}

function near( a, b, tolerance ) {

    return Math.abs( a - b ) <= tolerance;

}

/** Advances a state at a fixed rate for a whole number of frames. Returns the trajectory. */
function run( state, frames, dt, onFrame ) {

    const trace = [];

    for ( let frame = 1; frame <= frames; frame ++ ) {

        if ( onFrame !== undefined ) onFrame( state, frame );
        state.update( dt );
        trace.push( { time: frame * dt, ...state.emotion, mood: { ...state.mood } } );

    }

    return trace;

}

// ================================================================================================
// CONSTANTS — every declared value re-derived from the table it came from
// ================================================================================================
{
    check( 'CONSTANTS  the attack constant is the midpoint of research §8.3\'s 150-250 ms band',
        ATTACK_SECONDS === ( 0.150 + 0.250 ) / 2,
        `declared ${ ATTACK_SECONDS } s, midpoint ${ ( 0.150 + 0.250 ) / 2 } s` );

    check( 'CONSTANTS  the decay constant is the midpoint of research §8.3\'s 1.5-3 s band',
        DECAY_SECONDS === ( 1.5 + 3.0 ) / 2,
        `declared ${ DECAY_SECONDS } s, midpoint ${ ( 1.5 + 3.0 ) / 2 } s` );

    check( 'CONSTANTS  the mood timescales are ALMA\'s, verbatim',
        MOOD_CHANGE_SECONDS === 600 && MOOD_RETURN_SECONDS === 1200 && PAD_AXIS_SPAN === 2,
        `change ${ MOOD_CHANGE_SECONDS } s (10 min), return ${ MOOD_RETURN_SECONDS } s (20 min), axis span ${ PAD_AXIS_SPAN }` );

    // SATURATION_THRESHOLD is derived, so it is re-derived here rather than compared to a literal.
    const separation = minimumAnchorSeparation( DOMINANCE_METRIC_WEIGHT );

    check( '🎯 CONSTANTS  DELTA is half the MEASURED minimum separation between two emotions\' anchors',
        near( SATURATION_THRESHOLD, separation.separation / 2, 1e-12 ),
        `min separation ${ separation.separation.toFixed( 6 ) } (${ separation.pair }); ` +
        `half is ${ ( separation.separation / 2 ).toFixed( 6 ) }; declared ${ SATURATION_THRESHOLD }` );

    check( 'CONSTANTS  PHI is greater than DELTA, as the WASABI form requires',
        ACTIVATION_THRESHOLD > SATURATION_THRESHOLD,
        `PHI ${ ACTIVATION_THRESHOLD } > DELTA ${ SATURATION_THRESHOLD }` );

    // The arousal weights are arithmetic on the GeMAPS table; re-do the arithmetic.
    const rows = Object.values( GEMAPS_PERCENT_CHANGE );
    const mean = ( key ) => rows.reduce( ( sum, row ) => sum + row[ key ], 0 ) / rows.length;
    const total = mean( 'f0Mean' ) + mean( 'f0Std' ) + mean( 'loudness' );

    check( 'CONSTANTS  the arousal feature weights are the GeMAPS table\'s own means, normalised',
        near( AROUSAL_FEATURE_WEIGHTS.loudness, mean( 'loudness' ) / total, 1e-12 )
            && near( AROUSAL_FEATURE_WEIGHTS.f0Mean, mean( 'f0Mean' ) / total, 1e-12 )
            && near( AROUSAL_FEATURE_WEIGHTS.f0Std, mean( 'f0Std' ) / total, 1e-12 )
            && near( AROUSAL_FEATURE_WEIGHTS.loudness + AROUSAL_FEATURE_WEIGHTS.f0Mean + AROUSAL_FEATURE_WEIGHTS.f0Std, 1, 1e-12 ),
        `loudness ${ AROUSAL_FEATURE_WEIGHTS.loudness.toFixed( 4 ) }, ` +
        `f0Mean ${ AROUSAL_FEATURE_WEIGHTS.f0Mean.toFixed( 4 ) }, f0Std ${ AROUSAL_FEATURE_WEIGHTS.f0Std.toFixed( 4 ) }` );

    check( '🎯 CONSTANTS  loudness dominates arousal by the factor the table says (research §2)',
        AROUSAL_FEATURE_WEIGHTS.loudness / AROUSAL_FEATURE_WEIGHTS.f0Mean > 9,
        `loudness / f0Mean = ${ ( AROUSAL_FEATURE_WEIGHTS.loudness / AROUSAL_FEATURE_WEIGHTS.f0Mean ).toFixed( 2 ) }x; ` +
        `research §2: "loudness is the dominant arousal carrier by a wide margin"` );

    check( 'CONSTANTS  the loudness full scale is anger\'s +365.5% read as an amplitude ratio',
        near( AROUSAL_FULL_SCALE.loudnessDb, 20 * Math.log10( 4.655 ), 1e-9 )
            && near( AROUSAL_FULL_SCALE.f0MeanSemitones, 3.7, 1e-12 ),
        `+365.5% -> ${ AROUSAL_FULL_SCALE.loudnessDb.toFixed( 4 ) } dB; F0 mean full scale ` +
        `${ AROUSAL_FULL_SCALE.f0MeanSemitones } semitones (research §2: "~+3.7 semitones")` );
}

// ================================================================================================
// ANCHORS — no two emotions share one, and the transcribed value is rejected
// ================================================================================================
{
    const separation = minimumAnchorSeparation( DOMINANCE_METRIC_WEIGHT );

    check( 'ANCHORS  no two WASABI emotions share an anchor point',
        separation.separation > 0,
        `closest distinct pair ${ separation.pair } at ${ separation.separation.toFixed( 6 ) }` );

    // 🚩 THE REJECTION PROOF FOR THE DOCUMENTATION FIX. research §1 transcribes angry as
    // (80, 80, 100). Put that value back and the same check must fail.
    const asTranscribed = {
        ...Object.fromEntries( Object.entries( WASABI_ANCHORS ).map( ( [ name, spec ] ) => [ name, spec ] ) ),
        angry: { points: [ [ 0.80, 0.80, 1.00 ] ], base: 0.75 }
    };

    const transcribedSeparation = minimumAnchorSeparation( DOMINANCE_METRIC_WEIGHT, asTranscribed );

    check( '🚩 ANCHORS  REJECTED: the research doc\'s transcribed angry anchor coincides with happy\'s',
        transcribedSeparation.separation === 0 && transcribedSeparation.pair.includes( 'angry' ),
        `angry at the transcribed (80,80,100) sits ${ transcribedSeparation.separation } from ` +
        `${ transcribedSeparation.pair.replace( 'angry/', '' ).replace( '/angry', '' ) }; ` +
        'the two would fire together at equal weight at every point in the cube' );

    // And the shipped sign agrees with the OTHER table in the same research section.
    check( 'ANCHORS  the restored sign agrees with ALMA\'s independent OCC table',
        WASABI_ANCHORS.angry.points[ 0 ][ 0 ] < 0
            && ALMA_OCC_PAD.anger.pleasure < 0 && ALMA_OCC_PAD.hate.pleasure < 0,
        `WASABI angry P ${ WASABI_ANCHORS.angry.points[ 0 ][ 0 ] }; ` +
        `ALMA Anger P ${ ALMA_OCC_PAD.anger.pleasure }, Hate P ${ ALMA_OCC_PAD.hate.pleasure }` );

    const zeroBase = Object.entries( ANCHOR_SETS ).filter( ( [ , spec ] ) => spec.base === 0 );

    check( 'ANCHORS  every ALMA OCC emotion is present and cannot fire from drift alone',
        Object.keys( ALMA_OCC_PAD ).every( ( name ) => ANCHOR_SETS[ name ] !== undefined )
            && zeroBase.length === Object.keys( ALMA_OCC_PAD ).length + 1,
        `${ Object.keys( ALMA_OCC_PAD ).length } OCC vectors, ${ zeroBase.length } zero-base anchors ` +
        '(the OCC set plus WASABI\'s own `surprised`, which research §1 calls event-driven)' );
}

// ================================================================================================
// SMOOTHING — attack and decay, measured off the trajectory
// ================================================================================================

/**
 * Where a trajectory first crosses `level`, by linear interpolation between the two frames that
 * straddle it. Interpolating rather than taking the frame is what makes the measurement independent
 * of the sampling rate, which matters because the thing being measured IS a time constant.
 */
function crossingTime( trace, read, level, rising ) {

    for ( let index = 1; index < trace.length; index ++ ) {

        const before = read( trace[ index - 1 ] );
        const after = read( trace[ index ] );

        const crossed = rising ? ( before < level && after >= level ) : ( before > level && after <= level );
        if ( crossed === false ) continue;

        const fraction = ( level - before ) / ( after - before );
        return trace[ index - 1 ].time + fraction * ( trace[ index ].time - trace[ index - 1 ].time );

    }

    return null;

}

{
    const dt = 1 / 1000;

    const rising = new AffectState();
    rising.push( { pleasure: 1 } );
    const attackTrace = run( rising, 2000, dt );

    const attackTau = crossingTime( attackTrace, ( row ) => row.pleasure, 1 - 1 / Math.E, true );

    check( '🎯 SMOOTHING  the measured attack time constant IS the declared one',
        near( attackTau, ATTACK_SECONDS, 1e-4 ),
        `crossed 1 - 1/e = ${ ( 1 - 1 / Math.E ).toFixed( 6 ) } at ${ attackTau.toFixed( 6 ) } s ` +
        `against a declared ${ ATTACK_SECONDS } s (research §8.3 band 0.150-0.250 s)` );

    check( 'SMOOTHING  and it is inside research §8.3\'s band, which is a weaker statement',
        attackTau >= 0.150 && attackTau <= 0.250,
        `${ attackTau.toFixed( 6 ) } s in [0.150, 0.250]` );

    const peak = rising.emotion.pleasure;
    rising.release();
    const decayTrace = run( rising, 20000, dt );

    const decayTau = crossingTime( decayTrace, ( row ) => row.pleasure, peak / Math.E, false );

    check( '🎯 SMOOTHING  the measured decay time constant IS the declared one',
        near( decayTau, DECAY_SECONDS, 1e-3 ),
        `fell from ${ peak.toFixed( 6 ) } to 1/e of it at ${ decayTau.toFixed( 6 ) } s ` +
        `against a declared ${ DECAY_SECONDS } s (research §8.3 band 1.5-3.0 s)` );

    check( 'SMOOTHING  and it is inside research §8.3\'s band',
        decayTau >= 1.5 && decayTau <= 3.0,
        `${ decayTau.toFixed( 6 ) } s in [1.5, 3.0]` );

    check( '🎯 SMOOTHING  the smoothing is ASYMMETRIC, which is the whole point of 5.1',
        decayTau / attackTau > 10,
        `decay / attack = ${ ( decayTau / attackTau ).toFixed( 2 ) }x — "reads as emotional inertia"` );

    // 🚩 REJECTION. Symmetric smoothing is frame-rate invariant, hits the same steady state, and is
    // wrong. A gate on the steady state or on the invariance would not see it.
    const symmetric = new AffectState( { defects: { symmetricSmoothing: true } } );
    symmetric.push( { pleasure: 1 } );
    run( symmetric, 2000, dt );
    const symmetricPeak = symmetric.emotion.pleasure;
    symmetric.release();
    const symmetricDecay = crossingTime( run( symmetric, 20000, dt ), ( row ) => row.pleasure, symmetricPeak / Math.E, false );

    check( '🚩 SMOOTHING  REJECTED: symmetric smoothing fails the asymmetry check',
        symmetricDecay / attackTau < 1.1 && ( symmetricDecay < 1.5 ),
        `symmetric decay ${ symmetricDecay.toFixed( 6 ) } s, ratio ${ ( symmetricDecay / attackTau ).toFixed( 3 ) }x ` +
        '— and it reaches the SAME steady state, so a steady-state gate says fine' );

    check( '🚩 SMOOTHING  …and a STEADY-STATE gate would have said fine about it',
        near( symmetricPeak, peak, 1e-9 ),
        `both reach ${ peak.toFixed( 9 ) } after 2 s; the defect is entirely in the trajectory` );

    // The sign-reversal case, which is where the branch flip lives.
    const reversing = new AffectState();
    reversing.push( { pleasure: 1 } );
    run( reversing, 2000, dt );
    reversing.push( { pleasure: -0.5 } );
    const reversalTrace = run( reversing, 8000, dt );
    const zeroCrossing = crossingTime( reversalTrace, ( row ) => row.pleasure, 0, false );

    check( 'SMOOTHING  a sign reversal releases slowly and then attacks quickly',
        zeroCrossing !== null && zeroCrossing > 1.0
            && near( reversalTrace[ reversalTrace.length - 1 ].pleasure, -0.5, 1e-6 ),
        `crossed zero at ${ zeroCrossing.toFixed( 4 ) } s on the decay constant, then reached ` +
        `${ reversalTrace[ reversalTrace.length - 1 ].pleasure.toFixed( 6 ) } on the attack constant` );
}

// ================================================================================================
// MOOD — ALMA's two timescales, and the separation Phase 9 is entitled to rely on
// ================================================================================================
{
    const dt = 0.1;

    const state = new AffectState();
    state.push( { pleasure: 1 } );

    // A full axis is 2.0 wide and a mood change is 600 s, so origin -> +1 is half of that.
    const trace = run( state, Math.round( 400 / dt ), dt );
    const arrival = crossingTime( trace, ( row ) => row.mood.pleasure, 1 - 1e-9, true );
    const predictedArrival = MOOD_CHANGE_SECONDS * ( 1 / PAD_AXIS_SPAN );

    check( '🎯 MOOD  the slow layer reaches a full-scale target at ALMA\'s stated change time',
        near( arrival, predictedArrival, 0.2 ),
        `mood.pleasure reached +1 at ${ arrival.toFixed( 3 ) } s against a derived ` +
        `${ predictedArrival } s = ${ MOOD_CHANGE_SECONDS } s * (1.0 / ${ PAD_AXIS_SPAN })` );

    state.release();
    const returnTrace = run( state, Math.round( 800 / dt ), dt );
    const returnTime = crossingTime( returnTrace, ( row ) => row.mood.pleasure, 1e-9, false );
    const predictedReturn = MOOD_RETURN_SECONDS * ( 1 / PAD_AXIS_SPAN );

    check( '🎯 MOOD  and returns to default at ALMA\'s stated return time, which is twice as slow',
        near( returnTime, predictedReturn, 0.2 ),
        `mood.pleasure reached 0 at ${ returnTime.toFixed( 3 ) } s against a derived ${ predictedReturn } s` );

    // 🎯 The number Phase 9 and Phase 10 gate on.
    const separated = new AffectState();
    separated.push( { pleasure: 1, arousal: 1, dominance: 1 } );
    run( separated, 1000, 1 / 1000 );

    const ratio = separated.emotion.pleasure / separated.mood.pleasure;

    check( '🎯 MOOD  one second of a full-scale target moves the fast layer 298x further than the slow one',
        ratio > 250 && separated.mood.pleasure > 0 && separated.emotion.pleasure > 0.99,
        `after 1.000 s: emotion ${ separated.emotion.pleasure.toFixed( 6 ) }, ` +
        `mood ${ separated.mood.pleasure.toFixed( 6 ) }, ratio ${ ratio.toFixed( 1 ) }:1 — ` +
        'this is why a wardrobe may read mood and may not read pad' );

    check( 'MOOD  the composite is emotion plus mood, clamped',
        near( separated.pad.pleasure,
            Math.min( 1, separated.emotion.pleasure + separated.mood.pleasure ), 1e-12 ),
        `emotion ${ separated.emotion.pleasure.toFixed( 6 ) } + mood ${ separated.mood.pleasure.toFixed( 6 ) } ` +
        `= pad ${ separated.pad.pleasure.toFixed( 6 ) }` );

    check( 'MOOD  strength is ALMA\'s distance from the origin, and the origin has no octant',
        octantName( { pleasure: 0, arousal: 0, dominance: 0 } ) === 'neutral'
            && octantName( { pleasure: -1, arousal: 1, dominance: 1 } ) === 'hostile'
            && octantName( { pleasure: 1, arousal: 1, dominance: 1 } ) === 'exuberant'
            && near( new AffectState().moodStrength, 0, 1e-12 ),
        'origin -> neutral; (-P,+A,+D) -> hostile; (+P,+A,+D) -> exuberant; max norm sqrt(3) = ' +
        Math.sqrt( 3 ).toFixed( 6 ) );

    // 🚩 REJECTION, and the weaker gate that would have missed it.
    const perFrame = new AffectState( { defects: { moodPerFrame: true } } );
    perFrame.push( { pleasure: 1 } );
    run( perFrame, Math.round( 400 / dt ), dt );

    check( '🚩 MOOD  REJECTED: a per-FRAME mood step lands nowhere near ALMA\'s timescale at 10 Hz',
        Math.abs( perFrame.mood.pleasure - 1 ) > 0.5,
        `after 400 s at 10 Hz the defect reached ${ perFrame.mood.pleasure.toFixed( 6 ) } ` +
        'against the shipped path\'s +1' );
}

// ================================================================================================
// INVARIANCE — 30, 60 and 120 Hz. 🚩 Four layers in this repo shipped this defect.
// ================================================================================================

/**
 * Runs the same script at three rates and returns the worst disagreement at any SHARED instant.
 *
 * Pushes are scheduled by FRAME INDEX at each rate rather than by comparing floating-point times,
 * because 30, 60 and 120 all divide a 1/30 s grid exactly in frames and do not in floats.
 */
function invarianceOver( makeState, seconds, script ) {

    const rates = [ 30, 60, 120 ];
    const traces = new Map();

    for ( const rate of rates ) {

        const state = makeState();
        const dt = 1 / rate;
        const frames = Math.round( seconds * rate );
        const samples = [];

        for ( let frame = 0; frame < frames; frame ++ ) {

            // Every script entry is at a whole multiple of 1/30 s, so `frame * 30 / rate` is an
            // integer exactly when this frame is one of the shared instants.
            const thirtieths = frame * 30 / rate;
            if ( Number.isInteger( thirtieths ) && script[ thirtieths ] !== undefined ) {

                state.push( script[ thirtieths ] );

            }

            state.update( dt );

            const at = ( frame + 1 ) * 30 / rate;
            if ( Number.isInteger( at ) ) samples.push( { at, pad: state.pad, mood: { ...state.mood } } );

        }

        traces.set( rate, samples );

    }

    let worst = 0;
    let where = '';

    const reference = traces.get( 60 );

    for ( const rate of [ 30, 120 ] ) {

        const other = new Map( traces.get( rate ).map( ( row ) => [ row.at, row ] ) );

        for ( const row of reference ) {

            const match = other.get( row.at );
            if ( match === undefined ) continue;

            for ( const axis of PAD_AXES ) {

                for ( const field of [ 'pad', 'mood' ] ) {

                    const difference = Math.abs( row[ field ][ axis ] - match[ field ][ axis ] );
                    if ( difference > worst ) {

                        worst = difference;
                        where = `${ field }.${ axis } at t=${ ( row.at / 30 ).toFixed( 4 ) } s, 60 Hz vs ${ rate } Hz`;

                    }

                }

            }

        }

    }

    return { worst, where, samples: reference.length };

}

{
    // A script with an onset, a sign reversal (the branch flip) and a release.
    const SCRIPT = {
        0: { pleasure: 0.9, arousal: 0.8, dominance: 0.7 },
        30: { pleasure: -0.8, arousal: 0.2, dominance: -0.6 },     // t = 1.0 s
        90: { pleasure: 0, arousal: 0, dominance: 0 },             // t = 3.0 s
        150: { pleasure: 0.4, arousal: -0.7, dominance: 0.5 }      // t = 5.0 s
    };

    const shipped = invarianceOver( () => new AffectState(), 8, SCRIPT );

    check( '🚩 INVARIANCE  the same script at 30, 60 and 120 Hz agrees at every shared instant',
        shipped.worst < 1e-12,
        `worst disagreement ${ shipped.worst.toExponential( 3 ) } over ${ shipped.samples } shared instants` +
        ( shipped.where === '' ? '' : ` (${ shipped.where })` ) );

    const defects = [
        [ 'frameLerp', 'a fixed per-frame alpha instead of 1 - exp(-dt/tau)' ],
        [ 'moodPerFrame', 'a per-frame mood step instead of rate * dt' ],
        [ 'noBranchSplit', 'the attack/decay flip not cut at the baseline crossing' ]
    ];

    for ( const [ defect, description ] of defects ) {

        const broken = invarianceOver( () => new AffectState( { defects: { [ defect ]: true } } ), 8, SCRIPT );

        check( `🚩 INVARIANCE  REJECTED: ${ defect } — ${ description }`,
            broken.worst > shipped.worst * 1e6 && broken.worst > 1e-4,
            `worst disagreement ${ broken.worst.toFixed( 6 ) } (${ broken.where }); ` +
            `${ ( broken.worst / Math.max( shipped.worst, Number.MIN_VALUE ) ).toExponential( 1 ) }x the shipped path` );

    }

    // 🚩 LEARNINGS §1.13: "the rate WAS right", and every rate gate stayed green. Measure what two
    // weaker gates would have said about the subtlest of the three.
    const subtle = () => new AffectState( { defects: { noBranchSplit: true } } );

    const steadyState = ( makeState ) => {

        const state = makeState();
        state.push( { pleasure: 0.9 } );
        for ( let frame = 0; frame < 600; frame ++ ) state.update( 1 / 60 );
        return state.emotion.pleasure;

    };

    check( '🚩 INVARIANCE  …and a STEADY-STATE gate would have said noBranchSplit was fine',
        near( steadyState( subtle ), steadyState( () => new AffectState() ), 1e-15 ),
        `both settle at ${ steadyState( subtle ).toFixed( 15 ) } — the defect is invisible to any ` +
        'gate that reads the value rather than the trajectory' );

    const attackTauOf = ( makeState ) => {

        const state = makeState();
        state.push( { pleasure: 1 } );
        const trace = run( state, 2000, 1 / 1000 );
        return crossingTime( trace, ( row ) => row.pleasure, 1 - 1 / Math.E, true );

    };

    check( '🚩 INVARIANCE  …and the SMOOTHING section\'s own time-constant gate would have too',
        near( attackTauOf( subtle ), attackTauOf( () => new AffectState() ), 1e-12 ),
        `attack tau ${ attackTauOf( subtle ).toFixed( 9 ) } s either way; the defect only exists on a ` +
        'trajectory that reverses sign, which a monotone onset never does' );
}

// ================================================================================================
// WASABI — threshold and saturate, never proximity-blend
// ================================================================================================

/** A 41^3 sweep of the PAD cube, the same grid the constants were derived on. */
function sweepGrid( map ) {

    const steps = 41;
    const histogram = new Map();
    let maxActive = 0, maxSaturated = 0, worstDiscarded = 0, total = 0;

    // The cap is applied inside `activate`, so measure the uncapped count separately.
    const uncapped = new ExpressionMap( { maxActive: Number.POSITIVE_INFINITY } );

    for ( let i = 0; i < steps; i ++ ) {

        const pleasure = -1 + 2 * i / ( steps - 1 );

        for ( let j = 0; j < steps; j ++ ) {

            const arousal = -1 + 2 * j / ( steps - 1 );

            for ( let k = 0; k < steps; k ++ ) {

                const dominance = -1 + 2 * k / ( steps - 1 );
                const pad = { pleasure, arousal, dominance };

                total ++;

                const active = map.activate( pad );
                maxActive = Math.max( maxActive, active.length );

                const saturated = active.filter( ( row ) => row.saturated ).length;
                maxSaturated = Math.max( maxSaturated, saturated );

                const all = uncapped.activate( pad );
                histogram.set( all.length, ( histogram.get( all.length ) ?? 0 ) + 1 );
                if ( all.length > MAX_ACTIVE_EMOTIONS ) {

                    worstDiscarded = Math.max( worstDiscarded, all[ MAX_ACTIVE_EMOTIONS ].weight );

                }

            }

        }

    }

    return { maxActive, maxSaturated, worstDiscarded, total, histogram };

}

{
    const map = new ExpressionMap();

    // Every ALMA vector must reach something, and reach at most two things.
    const silent = [];
    let almaMaxActive = 0;

    for ( const [ name, pad ] of Object.entries( ALMA_OCC_PAD ) ) {

        const active = map.activate( pad );
        if ( active.length === 0 ) silent.push( name );
        almaMaxActive = Math.max( almaMaxActive, active.length );

    }

    check( '🎯 WASABI  every one of ALMA\'s 24 OCC vectors activates at least one WASABI emotion',
        silent.length === 0,
        `${ Object.keys( ALMA_OCC_PAD ).length } vectors, ${ silent.length } silent` +
        ( silent.length === 0 ? ' — this is the criterion PHI and the dominance weight were derived against' : `: ${ silent.join( ' ' ) }` ) );

    check( 'WASABI  and at most two are active on any of them',
        almaMaxActive <= MAX_ACTIVE_EMOTIONS,
        `worst simultaneous count over the 24: ${ almaMaxActive }` );

    // 🎯 The pair the record says separates only on dominance.
    const named = ( vector ) => Object.fromEntries( map.activate( ALMA_OCC_PAD[ vector ] ).map( ( r ) => [ r.emotion, r.weight ] ) );
    const anger = named( 'anger' ), hate = named( 'hate' ), fear = named( 'fear' );

    check( '🎯 WASABI  anger and fear do not leak into each other — the pair only dominance can split',
        anger.angry > 0 && anger.fearful === undefined
            && hate.angry > 0 && hate.fearful === undefined
            && fear.fearful > 0 && fear.angry === undefined,
        `ALMA Anger -> ${ Object.keys( anger ).join( '+' ) }; Hate -> ${ Object.keys( hate ).join( '+' ) }; ` +
        `Fear -> ${ Object.keys( fear ).join( '+' ) }  ` +
        '(lm-studio-integration.md: "distinguishable ONLY by dominance")' );

    const grid = sweepGrid( map );
    const histogram = [ ...grid.histogram.entries() ].sort( ( a, b ) => a[ 0 ] - b[ 0 ] )
        .map( ( [ count, hits ] ) => `${ count }:${ ( 100 * hits / grid.total ).toFixed( 1 ) }%` ).join( '  ' );

    check( '🎯 WASABI  at most two emotions are ever active, over the whole PAD cube',
        grid.maxActive <= MAX_ACTIVE_EMOTIONS,
        `41^3 = ${ grid.total } points, worst active count ${ grid.maxActive }; ` +
        `uncapped distribution ${ histogram }` );

    check( '🎯 WASABI  at most ONE is ever SATURATED, which is what DELTA was derived to guarantee',
        grid.maxSaturated <= 1,
        `worst simultaneous saturated count ${ grid.maxSaturated } over ${ grid.total } points` );

    check( 'WASABI  and the hard cap almost never bites — worst discarded third weight',
        grid.worstDiscarded < 0.25,
        `largest weight the cap ever discards: ${ grid.worstDiscarded.toFixed( 4 ) }; ` +
        'research §1 reads as though the threshold alone delivers 1-2 active, and measured, it does not' );

    // 🚩 REJECTION 1 — the forbidden implementation.
    const blended = new ExpressionMap( { defects: { proximityBlend: true }, maxActive: Number.POSITIVE_INFINITY } );
    const blendedAt = blended.activate( { pleasure: 0.8, arousal: 0.7, dominance: 0.6 } );

    check( '🚩 WASABI  REJECTED: proximity blending fires every emotion in the set at once',
        blendedAt.length === Object.keys( ANCHOR_SETS ).length && blendedAt.length > MAX_ACTIVE_EMOTIONS,
        `${ blendedAt.length } emotions active at a strongly-happy PAD point — "the average face, ` +
        `which IS the mush". Top five: ${ blendedAt.slice( 0, 5 ).map( ( r ) => `${ r.emotion } ${ r.weight.toFixed( 3 ) }` ).join( ', ' ) }` );

    // 🚩 REJECTION 2 — a DIFFERENT defect in the same class. Still 1-2 active, so the count gate
    // above stays green; what breaks is stability near an anchor. LEARNINGS §1.25a.
    const anchorPoint = { pleasure: 0.80, arousal: 0.80, dominance: 1.00 };
    const dither = 0.02;

    const stabilityOf = ( instance ) => {

        const centre = instance.activate( anchorPoint );
        let worst = 0;

        for ( const axis of PAD_AXES ) {

            for ( const sign of [ 1, -1 ] ) {

                const moved = instance.activate( { ...anchorPoint, [ axis ]: anchorPoint[ axis ] + sign * dither } );
                const before = centre.find( ( r ) => r.emotion === 'happy' )?.weight ?? 0;
                const after = moved.find( ( r ) => r.emotion === 'happy' )?.weight ?? 0;
                worst = Math.max( worst, Math.abs( after - before ) );

            }

        }

        return worst;

    };

    const shippedStability = stabilityOf( map );
    const unsaturated = new ExpressionMap( { defects: { noSaturation: true } } );
    const brokenStability = stabilityOf( unsaturated );

    check( '🎯 WASABI  inside DELTA, a 0.02 PAD dither changes the weight by exactly nothing',
        shippedStability === 0,
        `worst weight change over six ±${ dither } probes at the happy anchor: ${ shippedStability }` );

    check( '🚩 WASABI  REJECTED: without the dead zone the same dither moves the weight',
        brokenStability > 0.01,
        `no-saturation weight change ${ brokenStability.toFixed( 6 ) } against the shipped ${ shippedStability } — ` +
        'flicker, at 60 frames a second' );

    check( '🚩 WASABI  …and the ACTIVE-COUNT gate would have said noSaturation was fine',
        sweepGrid( unsaturated ).maxActive <= MAX_ACTIVE_EMOTIONS,
        'the dead zone changes stability, not how many fire — one gate cannot see both' );

    // 🚩 REJECTION 3 — a third way, opening PHI. Stability is intact, count is not.
    const wide = new ExpressionMap( { defects: { wideThreshold: true }, maxActive: Number.POSITIVE_INFINITY } );
    const wideGrid = sweepGrid( wide );

    check( '🚩 WASABI  REJECTED: PHI past the feasible window fires three or more at once',
        wideGrid.maxActive > MAX_ACTIVE_EMOTIONS,
        `worst active count ${ wideGrid.maxActive } over the cube; the shipped path never exceeds ` +
        `${ grid.maxActive }` );

    check( '🚩 WASABI  …and the ANCHOR-STABILITY gate would have said wideThreshold was fine',
        stabilityOf( new ExpressionMap( { defects: { wideThreshold: true } } ) ) === 0,
        'a wider PHI leaves the dead zone exactly where it was' );

    // A zero-base emotion cannot fire from drift, and can be triggered.
    const untriggered = map.activate( ALMA_OCC_PAD.gratitude ).map( ( r ) => r.emotion );
    const triggerMap = new ExpressionMap();
    triggerMap.trigger( 'gratitude', 0.75 );
    const triggered = triggerMap.activate( ALMA_OCC_PAD.gratitude ).map( ( r ) => r.emotion );

    check( '🎯 WASABI  a zero-base emotion cannot fire from drift and CAN be triggered',
        untriggered.includes( 'gratitude' ) === false && triggered.includes( 'gratitude' ),
        `at ALMA's own Gratitude vector: untriggered -> ${ untriggered.join( '+' ) }; ` +
        `triggered -> ${ triggered.join( '+' ) }  (research §1: "cognition must trigger it")` );

    // …but a trigger is still gated by geometry, which is what stops a bad tier-2 result snapping.
    const implausible = new ExpressionMap();
    implausible.trigger( 'happy', 1 );
    const atDespair = implausible.activate( { pleasure: -0.9, arousal: -0.7, dominance: -0.9 } );

    check( '🎯 WASABI  a trigger is still gated by geometry, so a bad appraisal cannot snap the face',
        atDespair.some( ( r ) => r.emotion === 'happy' ) === false,
        `trigger('happy', 1.0) at PAD (-0.9, -0.7, -0.9) yields ${ atDespair.map( ( r ) => r.emotion ).join( '+' ) || '(nothing)' }` );

    let threw = false;
    try { map.trigger( 'schadenfreude' ); } catch { threw = true; }

    check( 'WASABI  an unknown emotion name throws rather than silently doing nothing',
        threw, '' );
}

// ================================================================================================
// DOMINANCE — 🚩 the face cannot receive it
// ================================================================================================
{
    const state = new AffectState();
    state.push( { pleasure: 0.8, arousal: 0.7, dominance: 0.9 } );
    for ( let frame = 0; frame < 120; frame ++ ) state.update( 1 / 60 );

    const faceInput = state.faceInput();

    check( '🎯 DOMINANCE  faceInput() has exactly two keys and is frozen',
        Object.keys( faceInput ).length === 2
            && 'pleasure' in faceInput && 'arousal' in faceInput && ( 'dominance' in faceInput ) === false
            && Object.isFrozen( faceInput ),
        `keys [${ Object.keys( faceInput ).join( ', ' ) }], frozen ${ Object.isFrozen( faceInput ) }; ` +
        `bodyInput() has [${ Object.keys( state.bodyInput() ).join( ', ' ) }]` );

    const map = new ExpressionMap();
    let threw = false;
    let message = '';

    try { map.face( map.activate( state.pad ), state.bodyInput() ); } catch ( error ) {

        threw = true;
        message = error.message;

    }

    check( '🎯 DOMINANCE  face() THROWS when handed a PAD carrying the axis',
        threw && message.includes( 'dominance' ) && message.includes( 'Arellano' ),
        message.slice( 0, 130 ) );

    /**
     * 🎯 The sweep, and the one design decision that makes it a measurement rather than a
     * tautology.
     *
     * `face()` throws on a `dominance` key, so the axis cannot simply be swept through the front
     * door. What CAN be swept is the realistic leak: the axis carried past the guard under another
     * name. Every step below hands the shipped map a face input that really does contain a
     * dominance value, under the same field the two defect modes read, and measures whether
     * anything at all moves. The shipped path ignores it; both defects do not; and the three
     * numbers are directly comparable because they came from the same sweep.
     */
    const activations = map.activate( { pleasure: -0.8, arousal: 0.7, dominance: 0.6 } );

    const sweepFace = ( instance ) => {

        const reference = instance.face( activations, { pleasure: -0.8, arousal: 0.7, __dominance: 0 } );
        let worstAu = 0;
        let worstMorph = 0;

        for ( let step = 0; step <= 200; step ++ ) {

            const result = instance.face( activations, {
                pleasure: -0.8, arousal: 0.7, __dominance: -1 + 2 * step / 200
            } );

            for ( const unit of Object.keys( reference.aus ) ) {

                worstAu = Math.max( worstAu, Math.abs( result.aus[ unit ] - reference.aus[ unit ] ) );

            }

            // Over the UNION, not over the reference's own keys. `face()` omits morphs at zero, so
            // comparing only what the reference wrote is blind to an AU that switches ON — which is
            // exactly what `dominanceToFace` does, and it passed a first draft of this check for
            // that reason.
            for ( const name of new Set( [ ...EMOTION_MORPHS, ...MOUTH_CORNER_MORPHS ] ) ) {

                worstMorph = Math.max( worstMorph,
                    Math.abs( ( result.morphs[ name ] ?? 0 ) - ( reference.morphs[ name ] ?? 0 ) ) );

            }

        }

        return { worstAu, worstMorph };

    };

    const { worstAu, worstMorph } = sweepFace( map );

    check( '🎯 DOMINANCE  201 steps of D carried INTO the face call move no AU and no morph at all',
        worstAu === 0 && worstMorph === 0,
        `worst AU change ${ worstAu }, worst morph change ${ worstMorph } over 201 values of D in [-1, 1], ` +
        'each one actually present in the object handed to face()' );

    check( '🎯 DOMINANCE  AU10, the one unit research §1 calls "pure dominance", is not a face morph',
        AU_MORPHS.emotion.AU10 === undefined
            && AU_MORPHS.speechOwned.AU10 !== undefined
            && AU_MORPHS.speechOwned.AU10.every( ( name ) => ARKIT_REGIONS.mouth.includes( name ) ),
        `AU10 -> ${ AU_MORPHS.speechOwned.AU10.join( ', ' ) }, both in the MOUTH region, which ` +
        'ExpressionBank already refuses from an emotion caller — two independent constraints, same answer' );

    check( '🎯 DOMINANCE  `bored` and `depressed` have the same face and different bodies',
        ( () => {

            const boredPad = { pleasure: 0, arousal: -0.8, dominance: 0.9 };
            const depressedPad = { pleasure: 0, arousal: -0.8, dominance: -0.9 };

            const boredFace = map.face( map.activate( boredPad ), { pleasure: 0, arousal: -0.8 } );
            const depressedFace = map.face( map.activate( depressedPad ), { pleasure: 0, arousal: -0.8 } );

            const sameFace = JSON.stringify( boredFace.morphs ) === JSON.stringify( depressedFace.morphs );

            const boredBody = map.body( map.activate( boredPad ), boredPad );
            const depressedBody = map.body( map.activate( depressedPad ), depressedPad );

            return sameFace
                && boredBody.gestureAmplitude !== depressedBody.gestureAmplitude
                && boredBody.armSpread !== depressedBody.armSpread;

        } )(),
        'their anchors differ only in dominance; the face is byte-identical and the body prescription ' +
        'is not — the constraint working, and the cheapest argument for full-body' );

    // 🚩 REJECTION — two structurally different leak paths.
    const leaks = [
        [ 'dominanceToFace', 'routed into AU9 / the nose' ],
        [ 'dominanceToBrow', 'routed into AU4 / the brow' ]
    ];

    for ( const [ defect, description ] of leaks ) {

        const leaky = sweepFace( new ExpressionMap( { defects: { [ defect ]: true } } ) );

        check( `🚩 DOMINANCE  REJECTED: ${ defect } — dominance ${ description }`,
            leaky.worstAu > 0.05 && leaky.worstMorph > 0.05,
            `the same 201-step sweep moves an AU by ${ leaky.worstAu.toFixed( 4 ) } and a morph by ` +
            `${ leaky.worstMorph.toFixed( 4 ) }; the shipped path moves both by ${ worstAu }` );

    }

    // …and the narrow gate that would have missed the second one.
    const brow = new ExpressionMap( { defects: { dominanceToBrow: true } } );
    const browLow = brow.face( activations, { pleasure: -0.8, arousal: 0.7, __dominance: -1 } );
    const browHigh = brow.face( activations, { pleasure: -0.8, arousal: 0.7, __dominance: 1 } );

    check( '🚩 DOMINANCE  …and an AU10-ONLY gate would have said dominanceToBrow was fine',
        browLow.speechOwned.AU10 === 0 && browHigh.speechOwned.AU10 === 0
            && browHigh.aus.AU4 !== browLow.aus.AU4,
        `AU10 is 0 at both ends of the sweep while AU4 moves ${ Math.abs( browHigh.aus.AU4 - browLow.aus.AU4 ).toFixed( 4 ) } — ` +
        'watching the named unit is not watching the axis' );
}

// ================================================================================================
// ARELLANO — the six activation functions that are pure P or pure A, verbatim
// ================================================================================================
{
    const cases = [
        [ 'AU12 pure valence', au12, [ [ -0.5, 0 ], [ 0, 0 ], [ 0.25, 0.5 ], [ 0.49, 0.98 ], [ 0.5, 1 ], [ 1, 1 ] ] ],
        [ 'AU15 pure valence', au15, [ [ 0.5, 0 ], [ 0, 0 ], [ -0.25, 0.5 ], [ -0.49, 0.98 ], [ -0.5, 1 ], [ -1, 1 ] ] ],
        [ 'AU5 pure arousal', au5, [ [ 0.1, 0 ], [ 0.45, 0.5 ], [ 0.8, 1 ], [ 1, 1 ], [ -1, 0 ] ] ],
        [ 'AU25 pure arousal', au25, [ [ 0.3, 0 ], [ 0.5, 0.5 ], [ 0.7, 1 ], [ 1, 1 ] ] ],
        [ 'AU26 pure arousal', au26, [ [ 0.35, 0 ], [ 0.475, 0.5 ], [ 0.6, 1 ], [ 1, 1 ] ] ],
        [ 'AU43 negative arousal', au43, [ [ 0, 0 ], [ 0.5, 0 ], [ -0.3, 0.5 ], [ -0.6, 1 ], [ -1, 1 ] ] ]
    ];

    for ( const [ label, fn, points ] of cases ) {

        let worst = 0;
        let where = '';

        for ( const [ input, expected ] of points ) {

            const error = Math.abs( fn( input ) - expected );
            if ( error > worst ) { worst = error; where = `f(${ input }) = ${ fn( input ) }, expected ${ expected }`; }

        }

        check( `ARELLANO  ${ label } matches research §1's piecewise definition at every branch point`,
            worst < 1e-12, `worst deviation ${ worst.toExponential( 2 ) }${ where === '' ? '' : ` (${ where })` }` );

    }

    // Monotone and bounded across the whole axis, swept rather than argued.
    let monotoneFailures = 0;
    let outOfRange = 0;

    for ( let step = 0; step <= 2000; step ++ ) {

        const x = -1 + 2 * step / 2000;
        const previous = -1 + 2 * ( step - 1 ) / 2000;

        for ( const fn of [ au12, au5, au25, au26 ] ) {

            if ( step > 0 && fn( x ) < fn( previous ) - 1e-12 ) monotoneFailures ++;
            if ( fn( x ) < 0 || fn( x ) > 1 ) outOfRange ++;

        }

        for ( const fn of [ au15, au43 ] ) {

            if ( step > 0 && fn( x ) > fn( previous ) + 1e-12 ) monotoneFailures ++;
            if ( fn( x ) < 0 || fn( x ) > 1 ) outOfRange ++;

        }

    }

    check( 'ARELLANO  all six are monotone in their axis and bounded to [0, 1] over 2001 samples',
        monotoneFailures === 0 && outOfRange === 0,
        `${ monotoneFailures } monotonicity violations, ${ outOfRange } out-of-range values` );
}

// ================================================================================================
// MOUTH + REAL FIGURE — the mouth belongs to lipsync, measured on the shipped GLB
// ================================================================================================

if ( fs.existsSync( figurePath ) === false ) {

    check( 'REAL FIGURE  the figure exists', false, `not found: ${ figurePath }` );

} else {

    // `Figure.load` goes through three's FileLoader, which is fetch-based and cannot take a
    // filesystem path in Node. `parse` takes the bytes, which is what every other selftest does.
    const figure = await Figure.parse( fs.readFileSync( figurePath ).buffer );

    const layer = new ExpressionLayer();

    check( '🎯 MOUTH  the expression layer declares brow, eye, cheek and nose and FOUR mouth shapes',
        layer.morphChannels.length === EMOTION_MORPHS.length + MOUTH_CORNER_MORPHS.length
            && MOUTH_CORNER_MORPHS.every( ( name ) => layer.morphChannels.includes( name ) )
            && ARKIT_REGIONS.jaw.every( ( name ) => layer.morphChannels.includes( name ) === false )
            && ARKIT_REGIONS.tongue.every( ( name ) => layer.morphChannels.includes( name ) === false )
            && OVR_VISEMES.every( ( name ) => layer.morphChannels.includes( name ) === false ),
        `${ layer.morphChannels.length } channels; of the ${ ARKIT_REGIONS.mouth.length } ARKit mouth ` +
        `shapes it declares ${ MOUTH_CORNER_MORPHS.length } (${ MOUTH_CORNER_MORPHS.join( ', ' ) }), ` +
        `of the ${ ARKIT_REGIONS.jaw.length } jaw shapes 0, of the ${ OVR_VISEMES.length } visemes 0` );

    const forbidden = [ 'mouthPucker', 'jawOpen', 'viseme_aa', 'mouthUpperUpLeft' ];
    const throwsFor = [];

    for ( const name of forbidden ) {

        try { layer.contribution.setMorph( name, 0.5 ); } catch { throwsFor.push( name ); }

    }

    check( '🎯 MOUTH  writing any absolute mouth, jaw or viseme shape from the affect layer THROWS',
        throwsFor.length === forbidden.length,
        `threw for ${ throwsFor.join( ', ' ) } — the declaration IS the enforcement, no runtime check needed` );

    // The composition, on the real figure, with a real utterance under it.
    const stack = new MotionStack( { seed: 1 } );
    stack.bind( createMotionTarget( figure.root ) );

    const clock = { now: 0 };
    const speech = new VisemeLayer( { clock: () => clock.now } );
    stack.add( speech );

    const TIMELINE = [
        { viseme: 'sil', startTime: 0.000, duration: 0.080 },
        { viseme: 'viseme_aa', startTime: 0.080, duration: 0.180 },
        { viseme: 'viseme_O', startTime: 0.260, duration: 0.160 },
        { viseme: 'sil', startTime: 0.420, duration: 0.120 }
    ];

    speech.speak( TIMELINE, { at: 0 } );

    const readMorph = ( name ) => {

        const locations = figure.morphRegistry.get( name );
        return locations === undefined ? null : locations[ 0 ].influences[ locations[ 0 ].index ];

    };

    // Find the instant viseme_aa is strongest.
    let bestInstant = 0, bestWeight = 0;
    for ( let ms = 0; ms <= 540; ms ++ ) {

        const weights = speech.schedule.sampleAt( ms / 1000 );
        if ( weights.viseme_aa > bestWeight ) { bestWeight = weights.viseme_aa; bestInstant = ms / 1000; }

    }

    clock.now = bestInstant;
    stack.update( 1 / 60 );

    const soloViseme = readMorph( 'viseme_aa' );
    const soloSmile = readMorph( 'mouthSmileLeft' );
    const soloBrow = readMorph( 'browDownLeft' );

    // Now bring the affect layer in, already settled on a strongly happy state.
    const settled = new AffectState();
    settled.push( { pleasure: 0.9, arousal: 0.7, dominance: 0.5 } );
    for ( let frame = 0; frame < 300; frame ++ ) settled.update( 1 / 60 );

    const affect = new ExpressionLayer( { state: settled, advanceState: false } );
    stack.add( affect );
    stack.update( 1 / 60 );

    const composedViseme = readMorph( 'viseme_aa' );
    const composedSmile = readMorph( 'mouthSmileLeft' );
    const composedCheek = readMorph( 'cheekSquintLeft' );

    check( '🎯 MOUTH  a settled happy expression leaves the live viseme EXACTLY as it was',
        near( composedViseme, soloViseme, 1e-12 ) && soloViseme > 0.4,
        `viseme_aa ${ soloViseme.toFixed( 9 ) } -> ${ composedViseme.toFixed( 9 ) } at ` +
        `${ ( bestInstant * 1000 ).toFixed( 0 ) } ms; difference ${ Math.abs( composedViseme - soloViseme ).toExponential( 2 ) }` );

    check( '🎯 MOUTH  and reaches the mouth only as an additive corner offset, capped',
        soloSmile === 0 && composedSmile > 0 && composedSmile <= MAX_CORNER_OFFSET + 1e-12
            && near( composedSmile, affect.faceResult.mouthCornerOffset.smile, 1e-12 ),
        `mouthSmileLeft ${ soloSmile } -> ${ composedSmile.toFixed( 6 ) }, cap ${ MAX_CORNER_OFFSET }; ` +
        `AU12 ${ affect.faceResult.aus.AU12.toFixed( 4 ) } at pleasure ${ settled.pad.pleasure.toFixed( 3 ) }` );

    check( 'REAL FIGURE  the emotion regions reach the mesh at the same time',
        soloBrow === 0 && composedCheek > 0.5,
        `cheekSquintLeft ${ composedCheek.toFixed( 4 ) } (AU6, the Duchenne marker), ` +
        `browDownLeft ${ readMorph( 'browDownLeft' ) } — happy lowers no brow` );

    // 🚩 REJECTION: the same layer emitting an ABSOLUTE mouth target instead of an offset. It cannot
    // be reached through the shipped layer, so the defect is modelled by a layer that declares the
    // mouth — which is exactly the mistake the channel declaration exists to prevent, and the gate
    // shows what it would cost.
    const { Layer } = await import( '../motion/Layer.js' );
    const { MOTION_ORDER } = await import( '../motion/MotionStack.js' );

    class AbsoluteMouthAffect extends Layer {

        constructor() {

            super( {
                name: 'affect-absolute-mouth',
                order: MOTION_ORDER.EXPRESSION,
                morphChannels: [ ...ARKIT_REGIONS.mouth, ...OVR_VISEMES ]
            } );

        }

        update() {

            // A "smile" written the way an emotion layer naively would: the whole mouth, absolutely.
            this.contribution.setMorph( 'mouthSmileLeft', 0.9 );
            this.contribution.setMorph( 'mouthSmileRight', 0.9 );
            this.contribution.setMorph( 'viseme_aa', 0 );
            this.contribution.setMorph( 'mouthPucker', 0.4 );
            return this.contribution;

        }

    }

    const brokenStack = new MotionStack( { seed: 1 } );
    brokenStack.bind( createMotionTarget( figure.root ) );

    const brokenSpeech = new VisemeLayer( { clock: () => clock.now } );
    brokenStack.add( brokenSpeech );
    brokenSpeech.speak( TIMELINE, { at: 0 } );
    brokenStack.update( 1 / 60 );

    const brokenSolo = readMorph( 'viseme_aa' );
    const brokenPucker = readMorph( 'mouthPucker' );

    brokenStack.add( new AbsoluteMouthAffect() );
    brokenStack.update( 1 / 60 );

    check( '🚩 MOUTH  REJECTED: an affect layer that declares the mouth changes what the mouth is doing',
        readMorph( 'mouthPucker' ) > brokenPucker + 0.3 && readMorph( 'mouthSmileLeft' ) > MAX_CORNER_OFFSET,
        `mouthPucker ${ brokenPucker } -> ${ readMorph( 'mouthPucker' ).toFixed( 3 ) }, ` +
        `mouthSmileLeft -> ${ readMorph( 'mouthSmileLeft' ).toFixed( 3 ) } (${ ( readMorph( 'mouthSmileLeft' ) / MAX_CORNER_OFFSET ).toFixed( 1 ) }x the cap); ` +
        `viseme_aa ${ brokenSolo.toFixed( 4 ) } survives only because morphs SUM` );

    check( '🚩 MOUTH  …and the shipped layer cannot be made to do it, because it cannot declare them',
        ARKIT_REGIONS.mouth
            .filter( ( name ) => MOUTH_CORNER_MORPHS.includes( name ) === false )
            .every( ( name ) => layer.morphChannels.includes( name ) === false ),
        `${ ARKIT_REGIONS.mouth.length - MOUTH_CORNER_MORPHS.length } absolute mouth shapes, none declared` );

    // Three distinct emotions produce three distinct faces on the real mesh.
    const FACES = [
        [ 'joy', { pleasure: 0.9, arousal: 0.6, dominance: 0.5 } ],
        [ 'anger', { pleasure: -0.8, arousal: 0.7, dominance: 0.7 } ],
        [ 'fear', { pleasure: -0.8, arousal: 0.7, dominance: -0.7 } ],
        [ 'sadness', { pleasure: -0.6, arousal: -0.1, dominance: -0.6 } ]
    ];

    const plates = new Map();

    for ( const [ label, pad ] of FACES ) {

        const faceState = new AffectState();
        faceState.push( pad );
        for ( let frame = 0; frame < 600; frame ++ ) faceState.update( 1 / 60 );

        const plateStack = new MotionStack( { seed: 1 } );
        plateStack.bind( createMotionTarget( figure.root ) );

        const plateLayer = new ExpressionLayer( { state: faceState, advanceState: false } );
        plateStack.add( plateLayer );
        plateStack.update( 1 / 60 );

        const written = [ ...EMOTION_MORPHS, ...MOUTH_CORNER_MORPHS ].map( ( name ) => readMorph( name ) ?? 0 );
        plates.set( label, { written, emotions: plateLayer.activations.map( ( a ) => a.emotion ) } );

    }

    let closestPair = '';
    let closestDistance = Infinity;
    const labels = [ ...plates.keys() ];

    for ( let i = 0; i < labels.length; i ++ ) {

        for ( let j = i + 1; j < labels.length; j ++ ) {

            const a = plates.get( labels[ i ] ).written;
            const b = plates.get( labels[ j ] ).written;

            let sum = 0;
            for ( let index = 0; index < a.length; index ++ ) sum += ( a[ index ] - b[ index ] ) ** 2;
            const distance = Math.sqrt( sum / a.length );

            if ( distance < closestDistance ) { closestDistance = distance; closestPair = `${ labels[ i ] }/${ labels[ j ] }`; }

        }

    }

    check( '🎯 REAL FIGURE  four emotions are four measurably different committed morph vectors',
        closestDistance > 0.05,
        `closest pair ${ closestPair } at ${ closestDistance.toFixed( 4 ) } RMS over ` +
        `${ EMOTION_MORPHS.length + MOUTH_CORNER_MORPHS.length } committed influences; ` +
        [ ...plates.entries() ].map( ( [ label, plate ] ) => `${ label }=${ plate.emotions.join( '+' ) || 'none' }` ).join( '  ' ) );

    check( 'REAL FIGURE  every morph the map can emit exists on the shipped figure',
        [ ...EMOTION_MORPHS, ...MOUTH_CORNER_MORPHS ].every( ( name ) => figure.hasMorph( name ) ),
        `${ EMOTION_MORPHS.length + MOUTH_CORNER_MORPHS.length } names, ` +
        `${ [ ...EMOTION_MORPHS, ...MOUTH_CORNER_MORPHS ].filter( ( name ) => figure.hasMorph( name ) === false ).length } missing` );

    // A neutral state contributes nothing at all, so it stays out of the conflict report.
    const neutral = new ExpressionLayer( { state: new AffectState(), advanceState: false } );
    const neutralStack = new MotionStack( { seed: 1 } );
    neutralStack.bind( createMotionTarget( figure.root ) );
    neutralStack.add( neutral );

    check( 'REAL FIGURE  a neutral affect state contributes nothing at all',
        neutral.update( 1 / 60 ) === null && neutral.activations.length === 0,
        'no emotion active, no morph written' );
}

// ================================================================================================
// REFLEX — VADER's rules, the licence, and the sub-millisecond budget
// ================================================================================================
{
    const reflex = new ReflexAffect();

    check( 'REFLEX  the shipped lexicon is the authored seed and says so',
        reflex.lexiconProvenance.licence === 'authored in this repository'
            && reflex.lexiconProvenance.entries === Object.keys( SEED_LEXICON ).length
            && reflex.lexiconProvenance.warning.length > 0,
        `${ reflex.lexiconProvenance.name }, ${ reflex.lexiconProvenance.entries } entries, ` +
        `"${ reflex.lexiconProvenance.warning }"` );

    // 🚩 THE LICENCE, ASSERTED AGAINST THE TREE. research §0: NRC-VAD v2.1 and Warriner et al. are
    // both non-commercial and must not ship. This is a read of the affect source tree, and it is
    // honest about being one — it can prove a name is absent, not that a table is not a copy.
    const affectSources = fs.readdirSync( here )
        .filter( ( name ) => name.endsWith( '.js' ) )
        .map( ( name ) => ( { name, text: fs.readFileSync( path.join( here, name ), 'utf8' ) } ) );

    const forbiddenLexicons = [ 'nrc_vad', 'nrc-vad.txt', 'vad-lexicon', 'warriner', 'BRM-emot' ];
    const hits = [];

    for ( const source of affectSources ) {

        for ( const token of forbiddenLexicons ) {

            // The prose in SeedLexicon.js names them in order to forbid them, which is the one
            // legitimate occurrence, so only DATA-shaped references count.
            const pattern = new RegExp( `(import|require|readFile|fetch)[^\\n]*${ token }`, 'i' );
            if ( pattern.test( source.text ) ) hits.push( `${ source.name }:${ token }` );

        }

    }

    check( '🚩 REFLEX  no non-commercial lexicon is loaded anywhere in affect/',
        hits.length === 0,
        `${ affectSources.length } source files scanned for a load of NRC-VAD or Warriner; ${ hits.length } hits. ` +
        '⚠️ This proves no reference by name, not that the shipped table is original — the provenance ' +
        'claim rests on SeedLexicon.js\'s header, which a gate cannot check.' );

    check( 'REFLEX  VADER\'s published rule constants are the ones implemented',
        VADER.negationScalar === -0.74 && VADER.boosterIncrement === 0.293
            && VADER.capsIncrement === 0.733 && VADER.normaliserAlpha === 15,
        `N_SCALAR ${ VADER.negationScalar }, B_INCR ${ VADER.boosterIncrement }, ` +
        `C_INCR ${ VADER.capsIncrement }, alpha ${ VADER.normaliserAlpha }` );

    // Each rule, exercised.
    const plain = reflex.estimateFromText( 'This is good.' );
    const negated = reflex.estimateFromText( 'This is not good.' );
    const boosted = reflex.estimateFromText( 'This is very good.' );
    const shouted = reflex.estimateFromText( 'This is GOOD.' );
    const banged = reflex.estimateFromText( 'This is good!!!' );
    const doubleNegated = reflex.estimateFromText( 'This is not not good.' );

    check( 'REFLEX  negation flips the sign, at VADER\'s -0.74',
        plain.pleasure > 0 && negated.pleasure < 0
            && near( negated.pleasure / plain.pleasure, -0.74, 0.12 ),
        `plain ${ plain.pleasure.toFixed( 4 ) }, negated ${ negated.pleasure.toFixed( 4 ) }, ` +
        `ratio ${ ( negated.pleasure / plain.pleasure ).toFixed( 4 ) } (the squash bends the exact ratio)` );

    check( 'REFLEX  a booster intensifies and a repeated negator re-flips',
        boosted.pleasure > plain.pleasure && doubleNegated.pleasure > 0,
        `plain ${ plain.pleasure.toFixed( 4 ) } -> boosted ${ boosted.pleasure.toFixed( 4 ) }; ` +
        `"not not good" ${ doubleNegated.pleasure.toFixed( 4 ) }` );

    check( 'REFLEX  ALL-CAPS emphasis and exclamation amplification both raise the magnitude',
        shouted.pleasure > plain.pleasure && banged.pleasure > plain.pleasure,
        `plain ${ plain.pleasure.toFixed( 4 ) }, shouted ${ shouted.pleasure.toFixed( 4 ) }, ` +
        `three exclamations ${ banged.pleasure.toFixed( 4 ) }` );

    const before = reflex.estimateFromText( 'It is wonderful but it is broken.' );
    const after = reflex.estimateFromText( 'It is broken but it is wonderful.' );

    check( 'REFLEX  the `but` clause reweights, so word ORDER changes the sign',
        before.pleasure < 0 && after.pleasure > 0,
        `"wonderful but broken" ${ before.pleasure.toFixed( 4 ) }; ` +
        `"broken but wonderful" ${ after.pleasure.toFixed( 4 ) }` );

    check( 'REFLEX  compound is bounded, and an unmatched sentence reports NO confidence, not zero valence',
        Math.abs( reflex.estimateFromText( 'wonderful wonderful wonderful wonderful wonderful' ).pleasure ) <= 1
            && reflex.estimateFromText( 'the xylophone is on the table' ).confidence.pleasure === 0,
        `five superlatives -> ${ reflex.estimateFromText( 'wonderful wonderful wonderful wonderful wonderful' ).pleasure.toFixed( 4 ) }; ` +
        'an unmatched sentence pushes nothing rather than pushing a confident neutral' );

    // 🎯 Cross-check against the only measured affect vectors in the record.
    const MEASURED = [
        [ 'Oh — oh wow, I actually did not expect that to work. Look at it go!', 0.8, 0.6 ],
        [ 'I don\'t... I really don\'t know how to tell you this. I\'m sorry.', -0.8, 0.2 ],
        [ 'That is the third time you have ignored me. I am done asking nicely.', -0.8, 0.6 ]
    ];

    const measured = MEASURED.map( ( [ text ] ) => reflex.estimateFromText( text ) );
    const signsAgree = MEASURED.every( ( [ , pleasure ], index ) => Math.sign( measured[ index ].pleasure ) === Math.sign( pleasure ) );
    const dominanceOrdered = measured[ 1 ].dominance < measured[ 2 ].dominance;

    check( '🎯 REFLEX  tier 1 agrees with the 35B on the SIGN of pleasure for all three measured utterances',
        signsAgree,
        MEASURED.map( ( [ , pleasure ], index ) =>
            `tier1 ${ measured[ index ].pleasure.toFixed( 2 ) } vs 35B ${ pleasure }` ).join( '   ' ) +
        '  (lm-studio-integration.md finding 5)' );

    check( '🎯 REFLEX  …and reproduces the sadness-below-anger dominance ORDERING the 35B found',
        dominanceOrdered,
        `sadness ${ measured[ 1 ].dominance.toFixed( 2 ) } < anger ${ measured[ 2 ].dominance.toFixed( 2 ) }; ` +
        `the 35B measured 0.2 < 0.6. ⚠️ The MAGNITUDES do not agree and no claim is made that they do — ` +
        `tier 1's dominance is ${ DOMINANCE_CONFIDENCE } confidence by construction` );

    // 🚩 THE BUDGET. Punch-list 5.2 says under 1 ms.
    const sample = MEASURED[ 0 ][ 0 ];
    const iterations = 20000;

    for ( let i = 0; i < 2000; i ++ ) reflex.estimateFromText( sample );   // warm the JIT

    const durations = [];
    for ( let i = 0; i < iterations; i ++ ) {

        const start = performance.now();
        reflex.estimateFromText( sample );
        durations.push( performance.now() - start );

    }

    durations.sort( ( a, b ) => a - b );
    const median = durations[ Math.floor( iterations / 2 ) ];
    const p99 = durations[ Math.floor( iterations * 0.99 ) ];

    check( '🎯 REFLEX  tier 1 text inference is under a millisecond at the 99th percentile',
        p99 < 1.0,
        `median ${ median.toFixed( 5 ) } ms, p99 ${ p99.toFixed( 5 ) } ms, worst ` +
        `${ durations[ iterations - 1 ].toFixed( 5 ) } ms over ${ iterations } calls on a ` +
        `${ sample.split( /\s+/ ).length }-word utterance` );

    // Confidence plumbing: a low-confidence axis must not own the state.
    const state = new AffectState();
    state.push( { dominance: 1, confidence: { dominance: DOMINANCE_CONFIDENCE } } );

    check( 'REFLEX  a low-confidence push blends rather than replacing',
        near( state.target.dominance, DOMINANCE_CONFIDENCE, 1e-12 ),
        `one push of dominance 1.0 at confidence ${ DOMINANCE_CONFIDENCE } moved the target to ` +
        `${ state.target.dominance.toFixed( 4 ) }, not to 1.0 — which is how tier 2 will settle ` +
        'tier 1 rather than snapping it' );
}

// ================================================================================================
// AROUSAL — the prosody half
// ================================================================================================
{
    /** Synthesises a window of `Prosody`-shaped readings at a stated loudness and pitch. */
    const readings = ( { frames = 60, loudnessZ = 0, f0Semitones = 0, f0Std = 0, voiced = true } = {} ) =>
        Array.from( { length: frames }, ( _, index ) => ( {
            time: index * 256 / 48000,
            voiced,
            clarity: voiced ? 0.95 : 0.2,
            rms: 0.05,
            loudnessDb: -20,
            loudnessZ,
            f0Hz: voiced ? 200 : 0,
            f0Semitones,
            f0MeanSemitones: f0Semitones,
            f0StdSemitones: f0Std,
            referenceHz: 200,
            voicedFraction: voiced ? 1 : 0
        } ) );

    const calm = new ReflexAffect().estimateFromProsody( readings( { loudnessZ: 0, f0Semitones: 0 } ) );
    const loud = new ReflexAffect().estimateFromProsody( readings( { loudnessZ: 2.5, f0Semitones: 0 } ) );
    const high = new ReflexAffect().estimateFromProsody( readings( { loudnessZ: 0, f0Semitones: 3.7 } ) );

    check( 'AROUSAL  a calm window at the voice\'s own reference reports zero arousal',
        near( calm.arousal, 0, 1e-12 ) && calm.confidence.arousal === 1,
        `arousal ${ calm.arousal.toFixed( 9 ) }, confidence ${ calm.confidence.arousal }` );

    check( '🎯 AROUSAL  loudness alone moves arousal an order of magnitude further than pitch alone',
        loud.arousal > 0 && high.arousal > 0 && loud.arousal / high.arousal > 9,
        `+2.5 z of loudness -> ${ loud.arousal.toFixed( 4 ) }; +3.7 semitones of F0 -> ` +
        `${ high.arousal.toFixed( 4 ) }; ratio ${ ( loud.arousal / high.arousal ).toFixed( 2 ) }x` );

    check( 'AROUSAL  a quieter, flatter voice reports NEGATIVE arousal, which is what AU43 needs',
        new ReflexAffect().estimateFromProsody( readings( { loudnessZ: -2 } ) ).arousal < -0.1
            && au43( new ReflexAffect().estimateFromProsody( readings( { loudnessZ: -2 } ) ).arousal ) > 0,
        `-2 z of loudness -> arousal ` +
        `${ new ReflexAffect().estimateFromProsody( readings( { loudnessZ: -2 } ) ).arousal.toFixed( 4 ) }, ` +
        `AU43 ${ au43( new ReflexAffect().estimateFromProsody( readings( { loudnessZ: -2 } ) ).arousal ).toFixed( 4 ) }` );

    check( 'AROUSAL  an unvoiced window reports no evidence rather than zero arousal',
        new ReflexAffect().estimateFromProsody( readings( { voiced: false } ) ).confidence.arousal === 0
            && new ReflexAffect().estimateFromProsody( [] ).confidence.arousal === 0,
        'confidence 0, so `AffectState.push` leaves the axis alone during silence' );

    // 🎯 The asymmetric pooling rule: one loud frame among calm ones IS the content.
    const mostlyCalm = readings( { frames: 30, loudnessZ: 0 } );
    for ( let index = 10; index < 13; index ++ ) mostlyCalm[ index ].loudnessZ = 3.0;

    const pooled = new ReflexAffect().estimateFromProsody( mostlyCalm );
    const meanZ = mostlyCalm.reduce( ( sum, row ) => sum + row.loudnessZ, 0 ) / mostlyCalm.length;

    check( '🎯 AROUSAL  three loud frames in thirty are pooled as the top-k mean, not the window mean',
        pooled.arousal > 0.3,
        `top-3 mean z 3.000 -> arousal ${ pooled.arousal.toFixed( 4 ) }; the window mean is ` +
        `${ meanZ.toFixed( 3 ) } z, which would have reported ` +
        `${ ( meanZ * 6 / AROUSAL_FULL_SCALE.loudnessDb * AROUSAL_FEATURE_WEIGHTS.loudness ).toFixed( 4 ) } — ` +
        'research §2: "the intense word IS the content"' );

    // And the two halves compose into one push-shaped estimate.
    const merged = new ReflexAffect().estimate( {
        text: 'That is the third time you have ignored me. I am done asking nicely.',
        prosody: readings( { loudnessZ: 2.0 } )
    } );

    check( '🎯 AROUSAL  valence comes from the text and arousal from the acoustics, never crossed',
        merged.pleasure < 0 && merged.arousal > 0
            && merged.detail.text.pleasure === merged.pleasure
            && merged.detail.prosody.arousal === merged.arousal,
        `P ${ merged.pleasure.toFixed( 3 ) } (text) A ${ merged.arousal.toFixed( 3 ) } (acoustics) ` +
        `D ${ merged.dominance.toFixed( 3 ) } at confidence ` +
        `${ JSON.stringify( Object.fromEntries( Object.entries( merged.confidence ).map( ( [ k, v ] ) => [ k, Number( v.toFixed( 3 ) ) ] ) ) ) }` );

    // The full loop: reflex -> state -> map -> layer, once, end to end.
    const state = new AffectState();
    const map = new ExpressionMap();
    state.push( merged );
    for ( let frame = 0; frame < 120; frame ++ ) state.update( 1 / 60 );

    const active = map.activate( state.pad );

    check( '🎯 AROUSAL  the whole tier-1 loop lands the anger utterance on an angry face',
        active.length > 0 && active[ 0 ].emotion === 'angry'
            && map.face( active, state.faceInput() ).morphs.browDownLeft > 0,
        `text + prosody -> PAD (${ state.pad.pleasure.toFixed( 2 ) }, ${ state.pad.arousal.toFixed( 2 ) }, ` +
        `${ state.pad.dominance.toFixed( 2 ) }) -> ${ active.map( ( a ) => `${ a.emotion } ${ a.weight.toFixed( 3 ) }` ).join( ', ' ) }` );
}

// --- results ------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( `\nfigure: ${ figurePath }\n` );
process.stdout.write( `lexicon: ${ SEED_LEXICON_PROVENANCE.name }, ${ SEED_LEXICON_PROVENANCE.entries } entries\n\n` );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
