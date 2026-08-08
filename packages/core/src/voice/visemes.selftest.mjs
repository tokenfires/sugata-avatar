/**
 * Gate for `voice/Visemes.js`, `voice/Coarticulation.js`, `voice/VisemeSchedule.js` and
 * `voice/VisemeLayer.js` — punch-list 4.1, 4.2 and 4.4.
 *
 * Everything here is measured by EXECUTION. No section reads the source, and no section tests a
 * mirror of the thing that ships: the MOUTH OWNERSHIP and REAL FIGURE sections drive a real
 * `MotionStack` over a real `figure_g050.glb` and read the resulting `morphTargetInfluences`
 * arrays, because "a gate that tests a CPU mirror of a GPU node, plus a regex over the source,
 * tests neither."
 *
 *
 * WHAT EACH SECTION CLAIMS, AND HOW IT CAN FAIL
 *
 *   VOCABULARY     The 22 Microsoft and 15 OVR shapes this module names are the shapes the shipped
 *                  GLB actually carries — read out of the GLB, not asserted against a list. Every
 *                  Azure id resolves. Every alias in research §3's naming-gotcha list resolves.
 *
 *   TIMELINE       Sorting, the 0.7x repeat merge, diphthong expansion, /h/ dropped, degenerate
 *                  entries dropped. Failure here is a timeline the scheduler was allowed to assume.
 *
 *   ENVELOPE       The four durations against research §3's numbers at three speaking rates, the
 *                  200 ms cap, the PP/FF 0.9-vs-0.6 peaks, and the key-ordering invariant that the
 *                  header derives algebraically — swept over 2000 durations rather than argued.
 *
 *   SCHEDULE       The schedule fires at the right SIMULATED instants: peak weight lands at the
 *                  peak key, zero outside the window, and consecutive visemes overlap in the way
 *                  coarticulation means by the word.
 *
 *   LEAD           4.4. The mouth is ahead of the audio by exactly the lead, the default is the
 *                  derived midpoint of ITU-R BT.1359-1's asymmetric window, and a negative lead is
 *                  refused rather than honoured.
 *
 *   INVARIANCE     🚩 The section this project has earned the hard way. The same timeline at 30, 60
 *                  and 120 Hz must produce identical weights at every shared instant. Proved red by
 *                  THREE structurally different reintroduced defects, and — because a gate that
 *                  only catches its own known-bad is decorative — the section also measures what
 *                  two WEAKER gates would have said about each defect, and requires them to have
 *                  said "fine".
 *
 *   OWNERSHIP      The mouth belongs to lipsync. The layer physically cannot write an ARKit mouth
 *                  shape, and an additive AU12/AU15 corner offset from a separate layer composes
 *                  over a live viseme without changing it. Measured on the real figure.
 *
 *   REAL FIGURE    The weights reach `morphTargetInfluences` on all seven meshes, and the fifteen
 *                  shapes are actually DIFFERENT shapes — pairwise vertex-space distance, not name
 *                  inequality. A GLB that baked fifteen copies of the neutral face would pass every
 *                  other section in this file.
 *
 * A measurement outside its range prints FAIL and the process exits non-zero. It is not grounds
 * for widening the range.
 *
 * ⚠️ THE THREE "SPEAKING RATES" ARE TIME-SCALINGS, NOT MEASURED RATES. `docs/research/` contains no
 * speaking-rate or phoneme-duration figure, and none was measured for this item. The three rates
 * are one canned timeline scaled by 0.55x / 1.0x / 1.9x, chosen so the scaled durations straddle
 * every branch point of the envelope's `min()` clauses (50 ms, 90 ms, 120 ms, 200 ms). No claim is
 * made that any of them is a human speaking rate. See LEARNINGS §1.9.
 *
 * Usage:  node "packages/core/src/voice/visemes.selftest.mjs"
 *         node "packages/core/src/voice/visemes.selftest.mjs" assets/figures/figure_g100.glb
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// three's GLTFLoader assumes a browser when it decodes embedded textures. Nothing here inspects
// pixels, so two stubs get the loader as far as the morph data.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ( { width: 1, height: 1, close() {} } );

const { Figure } = await import( '../figure/Figure.js' );
const {
    ARKIT_REGIONS, MAX_CORNER_OFFSET, addMouthCornerOffset, applyRegion
} = await import( '../figure/ExpressionBank.js' );
const { Layer } = await import( '../motion/Layer.js' );
const { MOTION_ORDER, MotionStack, createMotionTarget } = await import( '../motion/MotionStack.js' );

const {
    DIPHTHONG_NUCLEUS_FRACTION, MICROSOFT_TO_OVR, MICROSOFT_VISEMES, OVR_VISEMES,
    REPEAT_MERGE_FACTOR, TRANSPARENT, canonicalViseme, normaliseTimeline, peakFor
} = await import( './Visemes.js' );

const {
    MAX_ANTICIPATION_SECONDS, MAX_ATTACK_SECONDS, MAX_RELEASE_SECONDS, MAX_VISEME_SECONDS,
    envelopeKeys, weightAt
} = await import( './Coarticulation.js' );

const {
    DEFAULT_LEAD_SECONDS, MAX_TOTAL_VISEME_WEIGHT, MOUTH_EARLY_DETECTABLE_SECONDS,
    MOUTH_LATE_DETECTABLE_SECONDS, VisemeSchedule
} = await import( './VisemeSchedule.js' );

const { VisemeLayer } = await import( './VisemeLayer.js' );

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

// ============================================================================================
// The canned timeline. One synthetic utterance, hand-written, exercising every branch the
// scheduler has: a bilabial (the 0.9 peak), a labiodental, a repeat, a diphthong, a transparent
// /h/, a viseme past the 200 ms cap, and a silence at each end.
//
// Times are seconds. This is NOT a transcription of real speech and is not claimed to be.
// ============================================================================================

const CANNED_TIMELINE = [
    { viseme: 'sil',        startTime: 0.000, duration: 0.080 },
    { viseme: 'viseme_PP',  startTime: 0.080, duration: 0.070 },   // strong peak, mid regime
    { viseme: 'viseme_aa',  startTime: 0.150, duration: 0.110 },
    { viseme: 'viseme_nn',  startTime: 0.260, duration: 0.045 },   // short: attack = d/2
    { viseme: 'viseme_nn',  startTime: 0.305, duration: 0.045 },   // adjacent repeat -> merged
    { viseme: 11,           startTime: 0.350, duration: 0.140 },   // Azure aɪ -> diphthong split
    { viseme: 12,           startTime: 0.490, duration: 0.040 },   // Azure /h/ -> transparent
    { viseme: 'f_v_18',     startTime: 0.530, duration: 0.075 },   // MS name -> viseme_FF, 0.9 peak
    { viseme: 'ou',         startTime: 0.605, duration: 0.260 },   // Oculus tail name, past the cap
    { viseme: 'sil',        startTime: 0.865, duration: 0.120 }
];

/** research has no speaking-rate figure; see the header. These are time-scalings and nothing more. */
const RATE_SCALES = Object.freeze( { fast: 0.55, normal: 1.0, slow: 1.9 } );

function scaleTimeline( timeline, scale ) {

    return timeline.map( ( entry ) => ( {
        viseme: entry.viseme,
        startTime: entry.startTime * scale,
        duration: entry.duration * scale
    } ) );

}

// ============================================================================================
// VOCABULARY — against the GLB, not against a list
// ============================================================================================

const figure = await Figure.parse( fs.readFileSync( figurePath ).buffer );
const figureName = path.basename( figurePath );

{
    const missingOvr = OVR_VISEMES.filter( ( name ) => ! figure.hasMorph( name ) );
    const missingMicrosoft = MICROSOFT_VISEMES.filter( ( name ) => ! figure.hasMorph( name ) );

    check( `VOCABULARY  all 15 OVR shapes exist on ${ figureName }`,
        missingOvr.length === 0,
        missingOvr.length === 0 ? `${ OVR_VISEMES.length } named morph targets` : `missing: ${ missingOvr.join( ', ' ) }` );

    check( `VOCABULARY  all 22 Microsoft shapes exist on ${ figureName }`,
        missingMicrosoft.length === 0,
        missingMicrosoft.length === 0
            ? `${ MICROSOFT_VISEMES.length } named morph targets, Azure id order`
            : `missing: ${ missingMicrosoft.join( ', ' ) }` );

    check( 'VOCABULARY  MICROSOFT_VISEMES is exactly 22 entries in Azure id order',
        MICROSOFT_VISEMES.length === 22
            && MICROSOFT_VISEMES.every( ( name, index ) => name.endsWith( String( index ).padStart( 2, '0' ) ) ),
        MICROSOFT_VISEMES.slice( 0, 3 ).join( ' ' ) + ' … ' + MICROSOFT_VISEMES[ 21 ] );

    // Every Azure id resolves to something deliberate: an OVR shape, a diphthong pair, or
    // TRANSPARENT. An `undefined` here is a hole in the collapse table.
    const unresolved = [];
    for ( let id = 0; id < 22; id ++ ) {

        const resolved = canonicalViseme( id );
        const deliberate = resolved === TRANSPARENT || resolved === 'DIPHTHONG'
            || OVR_VISEMES.includes( resolved );
        if ( deliberate === false ) unresolved.push( id );

    }

    check( 'VOCABULARY  every Azure id 0-21 resolves deliberately',
        unresolved.length === 0,
        `transparent: ${ Object.entries( MICROSOFT_TO_OVR ).filter( ( [ , v ] ) => v === TRANSPARENT ).map( ( [ k ] ) => k ).join( ',' ) || 'none' }` +
        `  diphthongs: ${ Object.entries( MICROSOFT_TO_OVR ).filter( ( [ , v ] ) => v === 'DIPHTHONG' ).map( ( [ k ] ) => k ).join( ',' ) }` +
        ( unresolved.length > 0 ? `  UNRESOLVED: ${ unresolved.join( ',' ) }` : '' ) );

    // research §3's naming gotcha: OVR's own tail names are ih/oh/ou, everyone else ships I/O/U.
    check( 'VOCABULARY  Oculus tail names ih/oh/ou normalise to the shipped I/O/U',
        canonicalViseme( 'ih' ) === 'viseme_I'
            && canonicalViseme( 'oh' ) === 'viseme_O'
            && canonicalViseme( 'ou' ) === 'viseme_U'
            && canonicalViseme( 'viseme_ou' ) === 'viseme_U',
        'research §3: "Ready Player Me, VRM and TalkingHead all ship viseme_I / viseme_O / viseme_U"' );

    check( 'VOCABULARY  bare shape names and MS names both resolve',
        canonicalViseme( 'PP' ) === 'viseme_PP'
            && canonicalViseme( 'p_b_m_21' ) === 'viseme_PP'
            && canonicalViseme( '21' ) === 'viseme_PP'
            && canonicalViseme( 21 ) === 'viseme_PP',
        'four spellings of the same shape' );

    check( 'VOCABULARY  a non-viseme is rejected rather than silently mapped',
        canonicalViseme( 'jawOpen' ) === undefined
            && canonicalViseme( 99 ) === undefined
            && canonicalViseme( null ) === undefined,
        '' );

    // research §3: "PP and FF peak at 0.9; everything else peaks at 0.6"
    const strong = OVR_VISEMES.filter( ( name ) => peakFor( name ) === 0.9 );
    const ordinary = OVR_VISEMES.filter( ( name ) => peakFor( name ) === 0.6 );

    check( 'VOCABULARY  PP and FF peak at 0.9, the other thirteen at 0.6',
        strong.length === 2 && strong.includes( 'viseme_PP' ) && strong.includes( 'viseme_FF' )
            && ordinary.length === 13,
        `strong: ${ strong.join( ', ' ) }` );
}

// ============================================================================================
// TIMELINE — normalisation
// ============================================================================================

const normalised = normaliseTimeline( CANNED_TIMELINE );

{
    check( 'TIMELINE  output is sorted by start time',
        normalised.every( ( entry, index ) => index === 0 || entry.startTime >= normalised[ index - 1 ].startTime ),
        `${ normalised.length } entries, ${ normalised[ 0 ].startTime.toFixed( 3 ) }..${ normalised[ normalised.length - 1 ].startTime.toFixed( 3 ) } s` );

    check( 'TIMELINE  every entry carries a canonical OVR name',
        normalised.every( ( entry ) => OVR_VISEMES.includes( entry.viseme ) ),
        normalised.map( ( entry ) => entry.viseme.slice( 7 ) ).join( ' ' ) );

    // Azure /h/ contributes no shape of its own.
    const spansTransparent = normalised.some(
        ( entry ) => entry.startTime >= 0.490 && entry.startTime < 0.530 );

    check( 'TIMELINE  Azure id 12 (/h/) is dropped, not guessed at',
        spansTransparent === false,
        'no oral constriction; the neighbouring envelopes cover the interval' );

    // The two adjacent viseme_nn entries: 0.260 + 0.045 and 0.305 + 0.045, joint span 0.090.
    const merged = normalised.filter( ( entry ) => entry.viseme === 'viseme_nn' );
    const expectedMergedDuration = 0.090 * REPEAT_MERGE_FACTOR;

    check( 'TIMELINE  adjacent identical visemes merge at 0.7x the joint span',
        merged.length === 1 && near( merged[ 0 ].duration, expectedMergedDuration, 1e-12 ),
        `${ merged.length } nn entry, duration ${ merged[ 0 ]?.duration.toFixed( 5 ) } s ` +
        `(expected ${ expectedMergedDuration.toFixed( 5 ) } = 0.090 x ${ REPEAT_MERGE_FACTOR })` );

    // Azure 11 = aɪ, 0.350 for 0.140 -> viseme_aa for 0.084 then viseme_I for 0.056.
    const nucleus = normalised.find( ( entry ) => near( entry.startTime, 0.350, 1e-12 ) );
    const offglide = normalised.find( ( entry ) => near( entry.startTime, 0.350 + 0.140 * DIPHTHONG_NUCLEUS_FRACTION, 1e-12 ) );

    check( 'TIMELINE  a diphthong expands into two timed targets, not one guess',
        nucleus?.viseme === 'viseme_aa' && offglide?.viseme === 'viseme_I'
            && near( nucleus.duration + offglide.duration, 0.140, 1e-12 ),
        `aɪ -> ${ nucleus?.viseme } ${ nucleus?.duration.toFixed( 4 ) } s then ` +
        `${ offglide?.viseme } ${ offglide?.duration.toFixed( 4 ) } s` );

    const degenerate = normaliseTimeline( [
        { viseme: 'PP', startTime: 0, duration: 0 },
        { viseme: 'PP', startTime: 0.1, duration: -0.05 },
        { viseme: 'PP', startTime: NaN, duration: 0.05 },
        { viseme: 'not-a-viseme', startTime: 0.2, duration: 0.05 }
    ] );

    check( 'TIMELINE  degenerate entries are dropped, not scheduled',
        degenerate.length === 0,
        'zero duration, negative duration, NaN start, unknown name' );

    // LEARNINGS §1.3 — what would a degenerate input score? An empty timeline must be silent, and
    // the sections below would all pass trivially on one, so it is checked here explicitly.
    const emptySchedule = new VisemeSchedule( { clock: () => 0 } ).speak( [] );
    const emptyWeights = emptySchedule.sampleAt( 0.5 );

    check( 'TIMELINE  an empty timeline is silent at every instant',
        OVR_VISEMES.every( ( name ) => emptyWeights[ name ] === 0 )
            && emptySchedule.isSpeakingAt( 0.5 ) === false,
        'the degenerate input this file must not score green on' );
}

// ============================================================================================
// ENVELOPE — research §3's four numbers, at three speaking rates
// ============================================================================================

{
    for ( const [ label, scale ] of Object.entries( RATE_SCALES ) ) {

        const timeline = normaliseTimeline( scaleTimeline( CANNED_TIMELINE, scale ) );

        let worstAnticipation = 0;
        let worstAttack = 0;
        let worstRelease = 0;
        let worstEffective = 0;

        for ( const entry of timeline ) {

            const keys = envelopeKeys( entry );
            const effective = Math.min( entry.duration, MAX_VISEME_SECONDS );

            worstAnticipation = Math.max( worstAnticipation,
                Math.abs( keys.anticipation - Math.min( MAX_ANTICIPATION_SECONDS, 2 * effective / 3 ) ) );
            worstAttack = Math.max( worstAttack,
                Math.abs( keys.attack - Math.min( MAX_ATTACK_SECONDS, effective / 2 ) ) );
            worstRelease = Math.max( worstRelease,
                Math.abs( keys.release - Math.min( MAX_RELEASE_SECONDS, effective / 2 ) ) );
            worstEffective = Math.max( worstEffective, Math.abs( keys.effective - effective ) );

        }

        const durations = timeline.map( ( entry ) => Math.round( entry.duration * 1000 ) );

        check( `ENVELOPE  ${ label } (x${ scale }) — anticipation min(60 ms, 2d/3), attack min(25 ms, d/2), release min(60 ms, d/2)`,
            worstAnticipation < 1e-15 && worstAttack < 1e-15 && worstRelease < 1e-15 && worstEffective < 1e-15,
            `${ timeline.length } entries, durations ${ durations.join( '/' ) } ms; ` +
            `worst deviation ${ Math.max( worstAnticipation, worstAttack, worstRelease ).toExponential( 1 ) } s` );

    }

    // The scaled durations have to actually straddle the min() branch points or the three rates
    // are three copies of the same test.
    const branchPoints = [ 0.050, 0.090, 0.120, MAX_VISEME_SECONDS ];
    const allDurations = Object.values( RATE_SCALES )
        .flatMap( ( scale ) => normaliseTimeline( scaleTimeline( CANNED_TIMELINE, scale ) ).map( ( entry ) => entry.duration ) );

    const straddled = branchPoints.filter(
        ( point ) => allDurations.some( ( d ) => d < point ) && allDurations.some( ( d ) => d > point ) );

    check( 'ENVELOPE  the three rates straddle every min() branch point',
        straddled.length === branchPoints.length,
        `branch points ${ branchPoints.map( ( p ) => `${ p * 1000 } ms` ).join( ', ' ) }; ` +
        `durations span ${ ( Math.min( ...allDurations ) * 1000 ).toFixed( 0 ) }-${ ( Math.max( ...allDurations ) * 1000 ).toFixed( 0 ) } ms` );

    // The key-ordering invariant the header derives. Swept rather than argued.
    let worstOrderViolation = 0;
    let orderSamples = 0;

    for ( let index = 0; index <= 2000; index ++ ) {

        const duration = 0.001 + index * 0.0005;   // 1 ms .. 1001 ms
        const keys = envelopeKeys( { startTime: 0.5, duration } );

        worstOrderViolation = Math.max( worstOrderViolation, keys.peak - keys.releaseStart );
        orderSamples ++;

        if ( keys.onset > keys.peak ) worstOrderViolation = Infinity;

    }

    check( 'ENVELOPE  onset <= peak <= releaseStart <= end for every duration',
        worstOrderViolation <= 0,
        `${ orderSamples } durations, 1-1001 ms; worst (peak - releaseStart) = ${ worstOrderViolation.toExponential( 2 ) } s` );

    // The four keys carry the four values the header says they do.
    const entry = { startTime: 1.000, duration: 0.150, peak: 0.6 };
    const keys = envelopeKeys( entry );

    check( 'ENVELOPE  weight is 0 at onset, peak at peak, peak at releaseStart, 0 at end',
        weightAt( entry, keys.onset ) === 0
            && near( weightAt( entry, keys.peak ), 0.6, 1e-12 )
            && near( weightAt( entry, keys.releaseStart ), 0.6, 1e-12 )
            && weightAt( entry, keys.end ) === 0
            && weightAt( entry, keys.onset - 0.001 ) === 0
            && weightAt( entry, keys.end + 0.001 ) === 0,
        `onset ${ keys.onset.toFixed( 4 ) }  peak ${ keys.peak.toFixed( 4 ) }  ` +
        `releaseStart ${ keys.releaseStart.toFixed( 4 ) }  end ${ keys.end.toFixed( 4 ) }` );

    // The release is slower than the attack — "pops open, closes smoothly" — for every duration
    // long enough for the two caps to differ.
    const asymmetric = [ 0.06, 0.09, 0.12, 0.20, 0.40 ].every( ( duration ) => {

        const k = envelopeKeys( { startTime: 0, duration } );
        return k.release > k.attack;

    } );

    check( 'ENVELOPE  release is slower than attack at every duration past 50 ms',
        asymmetric,
        'research §3: attack "fast, pops open"; release "slower, closes smoothly"' );

    // The 200 ms cap. The `ou` entry is 260 ms nominal.
    const long = normalised.find( ( item ) => item.duration > MAX_VISEME_SECONDS );
    const longKeys = envelopeKeys( long );

    check( 'ENVELOPE  a viseme past 200 ms is capped at 200 ms of sustain',
        near( longKeys.end - long.startTime, MAX_VISEME_SECONDS, 1e-12 ),
        `${ long.viseme } nominal ${ ( long.duration * 1000 ).toFixed( 0 ) } ms -> envelope ends ` +
        `${ ( ( longKeys.end - long.startTime ) * 1000 ).toFixed( 1 ) } ms after nominal start` );

    check( 'ENVELOPE  PP reaches 0.9 and aa reaches 0.6 at their peaks',
        near( weightAt( { startTime: 0, duration: 0.07, peak: peakFor( 'viseme_PP' ) },
            envelopeKeys( { startTime: 0, duration: 0.07 } ).peak ), 0.9, 1e-12 )
            && near( weightAt( { startTime: 0, duration: 0.11, peak: peakFor( 'viseme_aa' ) },
                envelopeKeys( { startTime: 0, duration: 0.11 } ).peak ), 0.6, 1e-12 ),
        '' );
}

// ============================================================================================
// SCHEDULE — fires at the right simulated instants
// ============================================================================================

const AUDIO_START = 12.345;   // an arbitrary non-zero audio-clock origin, so an off-by-origin shows

{
    const schedule = new VisemeSchedule( { clock: () => 0 } );
    schedule.speak( CANNED_TIMELINE, { at: AUDIO_START } );

    // For each entry: sample at the audio-clock instant whose timeline time is the peak key, and
    // require that shape to be at its authored peak. This is the "fires at the right simulated
    // instant" claim, stated per entry rather than once.
    let worstPeakError = 0;
    let peakChecks = 0;
    const capEngagedAtPeak = [];
    let worstStrongError = 0;

    for ( const entry of schedule.timeline ) {

        const keys = envelopeKeys( entry );
        const audioTime = AUDIO_START + keys.peak - schedule.leadSeconds;
        const weights = schedule.sampleAt( audioTime );

        // The cap is applied AFTER the envelopes are summed, so the expectation has to be built
        // from the UNCAPPED sum. Reading the total back out of the capped weights would define
        // the cap in terms of itself and pass whatever the schedule happened to do.
        let uncapped = 0;
        let uncappedStrong = 0;

        for ( const other of schedule.timeline ) {

            const contribution = weightAt( other, keys.peak );
            uncapped += contribution;
            if ( peakFor( other.viseme ) === 0.9 ) uncappedStrong += contribution;

        }

        const strong = peakFor( entry.viseme ) === 0.9;
        let expected = entry.peak;

        if ( uncapped > MAX_TOTAL_VISEME_WEIGHT ) {

            capEngagedAtPeak.push( entry.viseme );

            if ( uncappedStrong >= MAX_TOTAL_VISEME_WEIGHT ) {

                expected = entry.peak * ( MAX_TOTAL_VISEME_WEIGHT / uncapped );

            } else if ( strong === false ) {

                expected = entry.peak
                    * ( MAX_TOTAL_VISEME_WEIGHT - uncappedStrong ) / ( uncapped - uncappedStrong );

            }

        }

        const error = Math.abs( weights[ entry.viseme ] - expected );
        worstPeakError = Math.max( worstPeakError, error );
        if ( strong ) worstStrongError = Math.max( worstStrongError, Math.abs( weights[ entry.viseme ] - entry.peak ) );
        peakChecks ++;

    }

    check( 'SCHEDULE  every viseme is at its authored peak at its own peak instant',
        worstPeakError < 1e-12,
        `${ peakChecks } entries; worst error ${ worstPeakError.toExponential( 2 ) }; ` +
        `total-weight cap engaged at ${ capEngagedAtPeak.length } of them ` +
        `(${ capEngagedAtPeak.join( ', ' ) || 'none' })` );

    check( '🎯 SCHEDULE  an overlapping vowel never scales a PP/FF closure below its 0.9',
        worstStrongError < 1e-12,
        `worst deviation of a strong shape from 0.9 at its own peak: ${ worstStrongError.toExponential( 2 ) }` );

    // Silence before and after the utterance.
    const beforeWeights = { ...schedule.sampleAt( AUDIO_START - 1.0 ) };
    const afterWeights = { ...schedule.sampleAt( AUDIO_START + schedule.durationSeconds + 1.0 ) };

    check( 'SCHEDULE  silent before the utterance and after it',
        OVR_VISEMES.every( ( name ) => beforeWeights[ name ] === 0 )
            && OVR_VISEMES.every( ( name ) => afterWeights[ name ] === 0 ),
        '' );

    // Coarticulation: consecutive shapes must actually overlap. Sample at 1 ms and count the
    // instants where two or more shapes are simultaneously above 5% — if that number is zero the
    // envelopes are a slideshow and the word "coarticulation" is decorative.
    let overlapInstants = 0;
    let instants = 0;
    let maxSimultaneous = 0;
    let maxTotal = 0;
    let capEngagedInstants = 0;

    for ( let ms = -100; ms <= Math.round( schedule.durationSeconds * 1000 ) + 100; ms ++ ) {

        const weights = schedule.sampleAt( AUDIO_START + ms / 1000 );

        let active = 0;
        let total = 0;
        for ( const name of OVR_VISEMES ) {

            if ( weights[ name ] > 0.05 ) active ++;
            total += weights[ name ];

        }

        if ( active >= 2 ) overlapInstants ++;
        if ( total >= MAX_TOTAL_VISEME_WEIGHT - 1e-9 ) capEngagedInstants ++;

        maxSimultaneous = Math.max( maxSimultaneous, active );
        maxTotal = Math.max( maxTotal, total );
        instants ++;

    }

    check( 'SCHEDULE  consecutive visemes overlap — this is what coarticulation means',
        overlapInstants > 0 && maxSimultaneous >= 2,
        `${ overlapInstants } of ${ instants } ms-instants have 2+ shapes above 0.05; ` +
        `max simultaneous ${ maxSimultaneous }` );

    check( 'SCHEDULE  the total-weight cap holds and is not the thing shaping the mouth',
        maxTotal <= MAX_TOTAL_VISEME_WEIGHT + 1e-12 && capEngagedInstants < instants * 0.25,
        `max total ${ maxTotal.toFixed( 6 ) } (cap ${ MAX_TOTAL_VISEME_WEIGHT }); ` +
        `engaged on ${ capEngagedInstants } of ${ instants } instants ` +
        `(${ ( 100 * capEngagedInstants / instants ).toFixed( 1 ) }%)` );

    // Sampling out of order, backwards and repeatedly must give the same answers — the property
    // that makes the whole invariance argument work.
    const forward = [];
    for ( let ms = 0; ms <= 900; ms += 7 ) forward.push( { ...schedule.sampleAt( AUDIO_START + ms / 1000 ) } );

    let seekError = 0;
    for ( let index = forward.length - 1; index >= 0; index -- ) {

        const weights = schedule.sampleAt( AUDIO_START + ( index * 7 ) / 1000 );
        for ( const name of OVR_VISEMES ) {

            seekError = Math.max( seekError, Math.abs( weights[ name ] - forward[ index ][ name ] ) );

        }

    }

    check( 'SCHEDULE  sampling backwards gives identical weights — the schedule has no memory',
        seekError === 0,
        `${ forward.length } instants replayed in reverse; worst difference ${ seekError }` );

    // The discrete-landmark API Phase 6 will need.
    const onsets = schedule.onsetsBetween( AUDIO_START - 0.2, AUDIO_START + schedule.durationSeconds + 0.2 );

    check( 'SCHEDULE  onsetsBetween reports one landmark per entry, in order',
        onsets.length === schedule.timeline.length
            && onsets.every( ( onset, index ) => index === 0 || onset.audioTime >= onsets[ index - 1 ].audioTime ),
        `${ onsets.length } onsets for ${ schedule.timeline.length } entries` );
}

// ============================================================================================
// LEAD — punch-list 4.4
// ============================================================================================

{
    check( 'LEAD  the default is the derived midpoint of ITU-R BT.1359-1\'s asymmetric window',
        near( DEFAULT_LEAD_SECONDS, 0.040, 1e-15 )
            && near( DEFAULT_LEAD_SECONDS,
                ( MOUTH_EARLY_DETECTABLE_SECONDS - MOUTH_LATE_DETECTABLE_SECONDS ) / 2, 1e-15 ),
        `(${ MOUTH_EARLY_DETECTABLE_SECONDS } − ${ MOUTH_LATE_DETECTABLE_SECONDS }) / 2 = ` +
        `${ DEFAULT_LEAD_SECONDS * 1000 } ms early; ` +
        `${ ( ( MOUTH_EARLY_DETECTABLE_SECONDS - DEFAULT_LEAD_SECONDS ) * 1000 ).toFixed( 0 ) } ms of margin to the early edge, ` +
        `${ ( ( MOUTH_LATE_DETECTABLE_SECONDS + DEFAULT_LEAD_SECONDS ) * 1000 ).toFixed( 0 ) } ms to the late edge` );

    check( 'LEAD  the default sits strictly inside both detectability thresholds',
        DEFAULT_LEAD_SECONDS > 0 && DEFAULT_LEAD_SECONDS < MOUTH_EARLY_DETECTABLE_SECONDS,
        '' );

    // The measurement that matters: at audio-clock instant t the mouth shows what the audio will
    // be doing at t + lead. Compared against a zero-lead schedule on the same timeline.
    const led = new VisemeSchedule( { clock: () => 0 } ).speak( CANNED_TIMELINE, { at: AUDIO_START } );
    const flat = new VisemeSchedule( { clock: () => 0, leadSeconds: 0 } ).speak( CANNED_TIMELINE, { at: AUDIO_START } );

    let worstLeadError = 0;
    let samples = 0;

    for ( let ms = -100; ms <= 1100; ms ++ ) {

        const t = AUDIO_START + ms / 1000;
        const withLead = { ...led.sampleAt( t ) };
        const shifted = flat.sampleAt( t + DEFAULT_LEAD_SECONDS );

        for ( const name of OVR_VISEMES ) {

            worstLeadError = Math.max( worstLeadError, Math.abs( withLead[ name ] - shifted[ name ] ) );

        }

        samples ++;

    }

    // ⚠️ Not bit-exact, and it cannot be: the led path computes `t − start + lead` and the
    // reference computes `(t + lead) − start`, which is the same real number and a different
    // double. The residue below is that reassociation and nothing else — 4.8e-14 measured, eleven
    // orders of magnitude below anything a morph weight can express.
    check( 'LEAD  the mouth at t equals the un-led mouth at t + lead',
        worstLeadError < 1e-12,
        `${ samples } instants; worst difference ${ worstLeadError.toExponential( 2 ) } ` +
        '(floating-point reassociation of t − start + lead)' );

    // The mouth must be visibly ahead. Measured as the shift in the first instant anything moves.
    const firstMotion = ( schedule ) => {

        for ( let ms = -300; ms <= 1200; ms ++ ) {

            const weights = schedule.sampleAt( AUDIO_START + ms / 1000 );
            if ( OVR_VISEMES.some( ( name ) => weights[ name ] > 0 ) ) return ms;

        }

        return null;

    };

    const ledFirst = firstMotion( led );
    const flatFirst = firstMotion( flat );

    check( 'LEAD  the mouth starts moving earlier than it would with no lead',
        flatFirst - ledFirst === Math.round( DEFAULT_LEAD_SECONDS * 1000 ),
        `first motion at ${ ledFirst } ms with lead vs ${ flatFirst } ms without — ` +
        `${ flatFirst - ledFirst } ms earlier` );

    // A negative lead is the one setting the research says is three times worse. Refused.
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = ( message ) => warnings.push( message );

    const negative = new VisemeSchedule( { leadSeconds: -0.05 } );
    const excessive = new VisemeSchedule( { leadSeconds: 0.4 } );

    console.warn = originalWarn;

    check( 'LEAD  a negative lead is refused and a past-threshold lead is clamped, both loudly',
        negative.leadSeconds === 0
            && excessive.leadSeconds === MOUTH_EARLY_DETECTABLE_SECONDS
            && warnings.length === 2,
        warnings.map( ( message ) => message.slice( 0, 72 ) ).join( ' | ' ) );
}

// ============================================================================================
// INVARIANCE — 🚩 the section this project has earned
// ============================================================================================

const INVARIANCE_RATES = [ 30, 60, 120 ];

/**
 * How far two frame rates may disagree on a morph weight.
 *
 * Stated against something real rather than picked: the smallest morph-weight step that can move
 * a vertex further than the project's own indistinguishability bracket. The bracket's floor is
 * 0.48 px at full-body framing (PUNCHLIST standing constraints — and it is a BRACKET, 0.48-10.6 px,
 * not a threshold), the head is ~11% of frame height there, and a viseme moves lip vertices by a
 * few millimetres at full weight. 1e-6 is many orders of magnitude below any of that; the shipped
 * schedule measures exactly 0, so the tolerance is not what decides this result.
 */
const INVARIANCE_TOLERANCE = 1e-6;

/**
 * Runs a schedule through a real frame loop at `rateHz` and records the weights at every SHARED
 * instant.
 *
 * 🚩 CHOOSING THE SHARED INSTANTS IS ITSELF A GATE PARAMETER (LEARNINGS §1.4). The first version of
 * this used a fixed 10 ms grid, and because 1/30 s is not a whole number of 10 ms, the three rates
 * only ever coincided every 100 ms — **12 instants for the whole utterance**, which is not a
 * trajectory comparison, it is twelve spot checks. The rates are all multiples of 30, so the
 * instants they genuinely share are the 30 Hz FRAME instants: every rate lands on `k/30` exactly,
 * every time. Keying on `k` gives ~37 shared instants per second per speaking rate with no
 * interpolation and no tolerance on the time axis.
 *
 * The loop is the real one: `update(dt, audioTime)` once per frame, in order, exactly as the
 * motion stack calls it, so a defect that needs a frame loop to express itself gets one.
 */
function traceAtRate( rateHz, defects, timeline ) {

    const schedule = new VisemeSchedule( { clock: () => 0, defects } );
    schedule.speak( timeline, { at: AUDIO_START } );

    const dt = 1 / rateHz;
    const framesPerSharedInstant = rateHz / 30;
    const endTime = schedule.durationSeconds + 0.2;
    const trace = new Map();

    let frame = 0;
    let audioTime = 0;

    while ( audioTime <= endTime ) {

        const weights = { ...schedule.update( dt, AUDIO_START + audioTime ) };

        if ( frame % framesPerSharedInstant === 0 ) trace.set( frame / framesPerSharedInstant, weights );

        frame ++;
        audioTime = frame * dt;

    }

    return trace;

}

function worstDisagreement( traces ) {

    const shared = [ ...traces[ 0 ].keys() ].filter( ( key ) => traces.every( ( trace ) => trace.has( key ) ) );

    let worst = 0;
    let worstAt = null;
    let worstName = null;

    for ( const instant of shared ) {

        for ( const name of OVR_VISEMES ) {

            const values = traces.map( ( trace ) => trace.get( instant )[ name ] );
            const spread = Math.max( ...values ) - Math.min( ...values );

            if ( spread > worst ) {

                worst = spread;
                worstAt = instant;
                worstName = name;

            }

        }

    }

    return { worst, worstAt, worstName, sharedInstants: shared.length };

}

/** The invariance sweep runs at all three speaking rates, not just one. */
const INVARIANCE_TIMELINES = Object.entries( RATE_SCALES )
    .map( ( [ label, scale ] ) => ( { label, timeline: scaleTimeline( CANNED_TIMELINE, scale ) } ) );

function sweepInvariance( defects ) {

    let worst = 0;
    let worstAt = null;
    let worstName = null;
    let worstRate = null;
    let sharedInstants = 0;

    for ( const { label, timeline } of INVARIANCE_TIMELINES ) {

        const result = worstDisagreement(
            INVARIANCE_RATES.map( ( rate ) => traceAtRate( rate, defects, timeline ) ) );

        sharedInstants += result.sharedInstants;

        if ( result.worst > worst ) {

            worst = result.worst;
            worstAt = result.worstAt;
            worstName = result.worstName;
            worstRate = label;

        }

    }

    return { worst, worstAt, worstName, worstRate, sharedInstants };

}

{
    const shipped = sweepInvariance( {} );

    check( '🚩 INVARIANCE  the same timeline produces the same weights at 30, 60 and 120 Hz',
        shipped.worst <= INVARIANCE_TOLERANCE,
        `${ shipped.sharedInstants } shared instants x ${ OVR_VISEMES.length } shapes across ` +
        `${ INVARIANCE_TIMELINES.length } speaking rates; worst disagreement ${ shipped.worst.toExponential( 2 ) } ` +
        `(tolerance ${ INVARIANCE_TOLERANCE.toExponential( 0 ) })` );

    // --- proving the gate red, three structurally different ways ---------------------------
    //
    // 🚩 A GATE THAT ONLY CATCHES ITS OWN KNOWN-BAD IS DECORATIVE. Defect 1 is the one the gate was
    // written against (LEARNINGS §1.13a's countdown). Defects 2 and 3 were invented AFTERWARDS to
    // try to get past it, and they attack different parts of the mechanism: 2 leaves every arrival
    // instant untouched and corrupts only the trajectory between them; 3 leaves both the arrivals
    // and the sampling alone and corrupts only the envelope's SHAPE.

    const defectCases = [
        {
            label: 'countdown discarding its overshoot (LEARNINGS §1.13a mechanism 2)',
            defects: { frameCoupledCursor: true }
        },
        {
            label: 'smoother with a constant PER-FRAME coefficient (§1.13a mechanism 3)',
            defects: { frameRateDependentSmoothing: true }
        },
        {
            label: 'anticipation authored in FRAMES instead of seconds — arrivals untouched',
            defects: { anticipationInFrames: true }
        }
    ];

    for ( const defectCase of defectCases ) {

        const result = sweepInvariance( defectCase.defects );

        check( `🚩 INVARIANCE  proved red by: ${ defectCase.label }`,
            result.worst > INVARIANCE_TOLERANCE,
            `worst disagreement ${ result.worst.toFixed( 6 ) } on ${ result.worstName } at ` +
            `${ ( result.worstAt / 30 * 1000 ).toFixed( 1 ) } ms of the "${ result.worstRate }" rate — ` +
            `${ ( result.worst / INVARIANCE_TOLERANCE ).toExponential( 1 ) }x the tolerance` );

    }

    // --- and proving that two WEAKER gates would have said nothing was wrong ------------------
    //
    // LEARNINGS §1.13: "Every rate, amplitude and spectral gate in the repo stayed green through
    // all of it, because the rate WAS right." The same trap is available here, so it is measured.

    for ( const defectCase of defectCases ) {

        const traces = INVARIANCE_RATES.map(
            ( rate ) => traceAtRate( rate, defectCase.defects, CANNED_TIMELINE ) );

        // Weak gate A: peak amplitude reached per shape, across the whole utterance.
        const peaks = traces.map( ( trace ) => {

            const perShape = {};
            for ( const name of OVR_VISEMES ) perShape[ name ] = 0;
            for ( const weights of trace.values() ) {

                for ( const name of OVR_VISEMES ) perShape[ name ] = Math.max( perShape[ name ], weights[ name ] );

            }
            return perShape;

        } );

        let peakSpread = 0;
        for ( const name of OVR_VISEMES ) {

            const values = peaks.map( ( perShape ) => perShape[ name ] );
            peakSpread = Math.max( peakSpread, Math.max( ...values ) - Math.min( ...values ) );

        }

        // Weak gate B: how many shapes fired at all — an "event count" gate.
        const counts = traces.map( ( trace ) => {

            const fired = new Set();
            for ( const weights of trace.values() ) {

                for ( const name of OVR_VISEMES ) if ( weights[ name ] > 0.05 ) fired.add( name );

            }
            return fired.size;

        } );

        const countSpread = Math.max( ...counts ) - Math.min( ...counts );

        // The claim is not that both weak gates are always blind — it is that at least one is, for
        // every defect, which is exactly how three of these shipped in `motion/` undetected.
        const aBlind = peakSpread <= 0.02;
        const bBlind = countSpread === 0;

        check( `🚩 INVARIANCE  a weaker gate would have missed: ${ defectCase.label }`,
            aBlind || bBlind,
            `peak-amplitude gate spread ${ peakSpread.toFixed( 4 ) } (${ aBlind ? 'BLIND' : 'would catch' }); ` +
            `shapes-fired gate spread ${ countSpread } (${ bBlind ? 'BLIND' : 'would catch' })` );

    }

    // --- and then trying to walk past the gate on purpose --------------------------------------
    //
    // 🚩 The three defects above all make the trajectory a function of dt, which is exactly the
    // shape the rate-vs-rate comparison is built to see. So a fourth was written specifically to
    // EVADE it: timing authored in frames again, but resolved against a hardcoded 60 Hz instead of
    // the real dt. It is wrong at every frame rate and wrong in the SAME way at every frame rate,
    // so comparing 30 Hz with 120 Hz is structurally incapable of noticing. It worked.
    //
    // The answer is a second gate with a different reference: an ORACLE that restates research
    // §3's four durations from scratch — its own `min()` clauses, its own key placement, its own
    // curve — and never calls `Coarticulation.js` or `VisemeSchedule.js`. Every frame of every
    // rate is compared against it. That gate does not care whether two rates agree; it cares
    // whether either of them is right.
    //
    // ⚠️ The oracle shares one thing with the implementation and it is stated rather than hidden:
    // the raised-cosine interpolant, which the research does not specify and which had to be
    // chosen. The oracle re-derives the four KEY TIMES independently; it does not independently
    // derive the curve between them.

    const oracleWeights = ( normalisedTimeline, timelineTime ) => {

        const weights = {};
        for ( const name of OVR_VISEMES ) weights[ name ] = 0;

        let total = 0;
        let strongTotal = 0;

        for ( const entry of normalisedTimeline ) {

            // research §3, transcribed here a second time on purpose.
            const effective = Math.min( entry.duration, 0.200 );
            const anticipation = Math.min( 0.060, 2 * effective / 3 );
            const attack = Math.min( 0.025, effective / 2 );
            const release = Math.min( 0.060, effective / 2 );

            const onset = entry.startTime - anticipation;
            const peakAt = onset + attack;
            const releaseAt = entry.startTime + effective - release;
            const end = entry.startTime + effective;

            if ( timelineTime <= onset || timelineTime >= end ) continue;

            let shape;
            if ( timelineTime < peakAt ) {

                shape = 0.5 - 0.5 * Math.cos( Math.PI * ( timelineTime - onset ) / ( peakAt - onset ) );

            } else if ( timelineTime <= releaseAt ) {

                shape = 1;

            } else {

                shape = 0.5 - 0.5 * Math.cos( Math.PI * ( end - timelineTime ) / ( end - releaseAt ) );

            }

            const value = entry.peak * shape;
            weights[ entry.viseme ] += value;
            total += value;
            if ( entry.peak === 0.9 ) strongTotal += value;

        }

        if ( total > MAX_TOTAL_VISEME_WEIGHT ) {

            if ( strongTotal >= MAX_TOTAL_VISEME_WEIGHT ) {

                for ( const name of OVR_VISEMES ) weights[ name ] *= MAX_TOTAL_VISEME_WEIGHT / total;

            } else {

                const scale = ( MAX_TOTAL_VISEME_WEIGHT - strongTotal ) / ( total - strongTotal );
                for ( const name of OVR_VISEMES ) {

                    if ( peakFor( name ) === 0.9 ) continue;
                    weights[ name ] *= scale;

                }

            }

        }

        return weights;

    };

    const worstAgainstOracle = ( defects ) => {

        let worst = 0;
        let worstRate = null;
        let frames = 0;

        for ( const { label, timeline } of INVARIANCE_TIMELINES ) {

            const reference = normaliseTimeline( timeline );

            for ( const rate of INVARIANCE_RATES ) {

                const schedule = new VisemeSchedule( { clock: () => 0, defects } );
                schedule.speak( timeline, { at: AUDIO_START } );

                const dt = 1 / rate;
                const endTime = schedule.durationSeconds + 0.2;

                for ( let frame = 0; frame * dt <= endTime; frame ++ ) {

                    const audioTime = AUDIO_START + frame * dt;
                    const produced = schedule.update( dt, audioTime );
                    const expected = oracleWeights( reference, frame * dt + DEFAULT_LEAD_SECONDS );

                    for ( const name of OVR_VISEMES ) {

                        const error = Math.abs( produced[ name ] - expected[ name ] );
                        if ( error > worst ) {

                            worst = error;
                            worstRate = `${ label } @ ${ rate } Hz`;

                        }

                    }

                    frames ++;

                }

            }

        }

        return { worst, worstRate, frames };

    };

    const oracleShipped = worstAgainstOracle( {} );

    check( '🚩 ORACLE  every frame of every rate matches an independently derived envelope',
        oracleShipped.worst < 1e-12,
        `${ oracleShipped.frames } frames across 3 speaking rates x ${ INVARIANCE_RATES.length } frame rates; ` +
        `worst error ${ oracleShipped.worst.toExponential( 2 ) }` );

    const evasive = { anticipationAssumes60Hz: true };
    const evasiveInvariance = sweepInvariance( evasive );
    const evasiveOracle = worstAgainstOracle( evasive );

    check( '🚩 ORACLE  catches the defect built to evade the rate-vs-rate gate, which is blind to it',
        evasiveInvariance.worst <= INVARIANCE_TOLERANCE && evasiveOracle.worst > 1e-3,
        'anticipation resolved against a hardcoded 60 Hz: ' +
        `rate-vs-rate gate sees ${ evasiveInvariance.worst.toExponential( 1 ) } (BLIND), ` +
        `oracle sees ${ evasiveOracle.worst.toFixed( 4 ) } at ${ evasiveOracle.worstRate }` );

    // And the oracle must also reject the three the invariance gate already catches, or it is a
    // second gate that only knows about the fourth defect.
    for ( const defectCase of defectCases ) {

        const result = worstAgainstOracle( defectCase.defects );

        check( `🚩 ORACLE  also red on: ${ defectCase.label }`,
            result.worst > 1e-3,
            `worst error ${ result.worst.toFixed( 4 ) } at ${ result.worstRate }` );

    }

    // The shipped path must not merely be invariant — it must be invariant because it ignores dt.
    // Measured, not read: feed the same audio instants with wildly wrong dt values.
    const honest = new VisemeSchedule( { clock: () => 0 } ).speak( CANNED_TIMELINE, { at: AUDIO_START } );
    let dtSensitivity = 0;

    for ( let ms = 0; ms <= 1000; ms += 3 ) {

        const audioTime = AUDIO_START + ms / 1000;
        const sane = { ...honest.update( 1 / 60, audioTime ) };
        const absurd = honest.update( 3.7, audioTime );

        for ( const name of OVR_VISEMES ) {

            dtSensitivity = Math.max( dtSensitivity, Math.abs( sane[ name ] - absurd[ name ] ) );

        }

    }

    check( '🚩 INVARIANCE  the shipped path is indifferent to deltaSeconds entirely',
        dtSensitivity === 0,
        `dt = 1/60 s vs dt = 3.7 s at the same audio instants; worst difference ${ dtSensitivity }` );
}

// ============================================================================================
// OWNERSHIP — the mouth belongs to lipsync, measured on the real figure
// ============================================================================================

/**
 * A stand-in for Phase 5's emotion layer: it declares the four AU12/AU15 corner shapes and adds a
 * corner offset. It exists to prove the composition works BEFORE Phase 5 is written, which is the
 * whole point of designing the boundary now.
 */
class CornerOffsetLayer extends Layer {

    constructor( smile ) {

        super( {
            name: 'affect-corner',
            order: MOTION_ORDER.EXPRESSION,
            morphChannels: [ 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight' ]
        } );

        this.smile = smile;

    }

    update() {

        this.contribution.setMorph( 'mouthSmileLeft', this.smile );
        this.contribution.setMorph( 'mouthSmileRight', this.smile );
        return this.contribution;

    }

}

{
    const target = createMotionTarget( figure.root );
    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );

    const clockValue = { now: AUDIO_START };
    const visemeLayer = new VisemeLayer( { clock: () => clockValue.now } );
    stack.add( visemeLayer );

    visemeLayer.speak( CANNED_TIMELINE, { at: AUDIO_START } );

    check( 'OWNERSHIP  the speech layer declares the 15 viseme shapes and no ARKit shape',
        visemeLayer.morphChannels.length === OVR_VISEMES.length
            && visemeLayer.morphChannels.every( ( name ) => OVR_VISEMES.includes( name ) )
            && ARKIT_REGIONS.mouth.every( ( name ) => visemeLayer.morphChannels.includes( name ) === false )
            && ARKIT_REGIONS.jaw.every( ( name ) => visemeLayer.morphChannels.includes( name ) === false ),
        `${ visemeLayer.morphChannels.length } channels, none of the ${ ARKIT_REGIONS.mouth.length } ARKit mouth ` +
        `or ${ ARKIT_REGIONS.jaw.length } jaw shapes` );

    // The enforcement, exercised rather than described.
    let threw = false;
    let message = '';
    try {

        visemeLayer.contribution.setMorph( 'mouthSmileLeft', 0.5 );

    } catch ( error ) {

        threw = true;
        message = error.message;

    }

    check( 'OWNERSHIP  routing an emotion shape through the speech layer THROWS',
        threw && message.includes( 'mouthSmileLeft' ),
        message.slice( 0, 110 ) );

    // ExpressionBank's other door: emotion cannot reach the mouth through applyRegion either.
    const bankWarnings = [];
    const originalWarn = console.warn;
    console.warn = ( text ) => bankWarnings.push( text );

    figure.beginFrame();
    applyRegion( figure, 'brow', { mouthSmileLeft: 1.0, browInnerUp: 0.4 } );
    const browApplied = figure.weights.browInnerUp;
    const mouthLeaked = figure.weights.mouthSmileLeft;

    console.warn = originalWarn;

    check( 'OWNERSHIP  ExpressionBank.applyRegion refuses a mouth shape from an emotion region',
        browApplied === 0.4 && mouthLeaked === 0 && bankWarnings.length >= 1,
        `browInnerUp ${ browApplied }, mouthSmileLeft ${ mouthLeaked }; ` +
        `warned: "${ ( bankWarnings[ 0 ] ?? '' ).slice( 0, 70 ) }"` );

    // Composition: an additive corner offset over a live viseme, through the real stack.
    // Find the instant viseme_aa is strongest, and compare with and without the emotion layer.
    let bestInstant = 0;
    let bestWeight = 0;

    for ( let ms = 0; ms <= 900; ms ++ ) {

        const weights = visemeLayer.schedule.sampleAt( AUDIO_START + ms / 1000 );
        if ( weights.viseme_aa > bestWeight ) {

            bestWeight = weights.viseme_aa;
            bestInstant = ms / 1000;

        }

    }

    const readMorph = ( name ) => {

        const locations = figure.morphRegistry.get( name );
        return locations === undefined ? null : locations[ 0 ].influences[ locations[ 0 ].index ];

    };

    clockValue.now = AUDIO_START + bestInstant;
    stack.update( 1 / 60 );

    const soloViseme = readMorph( 'viseme_aa' );
    const soloSmile = readMorph( 'mouthSmileLeft' );

    const smileAmount = MAX_CORNER_OFFSET;
    stack.add( new CornerOffsetLayer( smileAmount ) );
    stack.update( 1 / 60 );

    const composedViseme = readMorph( 'viseme_aa' );
    const composedSmile = readMorph( 'mouthSmileLeft' );

    check( '🎯 OWNERSHIP  an additive AU12 corner offset composes over a live viseme without changing it',
        near( composedViseme, soloViseme, 1e-9 ) && soloViseme > 0.4
            && soloSmile === 0 && near( composedSmile, smileAmount, 1e-9 ),
        `viseme_aa ${ soloViseme.toFixed( 6 ) } -> ${ composedViseme.toFixed( 6 ) } (unchanged); ` +
        `mouthSmileLeft ${ soloSmile } -> ${ composedSmile.toFixed( 3 ) } at instant ${ ( bestInstant * 1000 ).toFixed( 0 ) } ms` );

    check( 'OWNERSHIP  ExpressionBank caps the corner offset well below full deflection',
        MAX_CORNER_OFFSET < 0.5 && ( () => {

            figure.beginFrame();
            addMouthCornerOffset( figure, { smile: 1.0 } );
            return figure.weights.mouthSmileLeft === MAX_CORNER_OFFSET;

        } )(),
        `MAX_CORNER_OFFSET ${ MAX_CORNER_OFFSET }; a request for 1.0 yields ${ MAX_CORNER_OFFSET }` );

    // The layer stays out of the conflict report while silent.
    clockValue.now = AUDIO_START + 5.0;
    const silentContribution = visemeLayer.update( 1 / 60 );

    check( 'OWNERSHIP  the speech layer contributes nothing at all during silence',
        silentContribution === null && visemeLayer.speaking === false,
        '' );
}

// ============================================================================================
// REAL FIGURE — the weights reach the mesh, and the fifteen shapes are fifteen shapes
// ============================================================================================

{
    const target = createMotionTarget( figure.root );
    const stack = new MotionStack( { seed: 1 } );
    stack.bind( target );

    const clockValue = { now: 0 };
    const layer = new VisemeLayer( { clock: () => clockValue.now, leadSeconds: 0 } );
    stack.add( layer );

    // Multi-mesh reach: a viseme that lives on more than one mesh must land on all of them.
    const spread = OVR_VISEMES.map( ( name ) => ( { name, meshes: figure.morphLocationCount( name ) } ) );
    const multiMesh = spread.filter( ( item ) => item.meshes > 1 );

    layer.speak( [ { viseme: 'viseme_aa', startTime: 0, duration: 0.2 } ], { at: 0 } );
    clockValue.now = 0.1;
    stack.update( 1 / 60 );

    const aaLocations = figure.morphRegistry.get( 'viseme_aa' );
    const allWritten = aaLocations.every(
        ( location ) => location.influences[ location.index ] > 0.4 );

    check( `REAL FIGURE  a viseme reaches every mesh that carries it (${ aaLocations.length } for viseme_aa)`,
        allWritten,
        `viseme shapes span ${ Math.min( ...spread.map( ( s ) => s.meshes ) ) }-${ Math.max( ...spread.map( ( s ) => s.meshes ) ) } meshes; ` +
        `${ multiMesh.length } of 15 live on more than one` );

    // 🚩 LEARNINGS §1.3 — what would a degenerate asset score? A GLB that baked fifteen copies of
    // the neutral face passes every other check in this file. So the shapes are compared in VERTEX
    // space: the RMS displacement each viseme applies to the body mesh's positions, and the
    // pairwise distance between them.
    const body = figure.body;
    const morphAttributes = body.geometry.morphAttributes.position;
    const dictionary = body.morphTargetDictionary;
    const relative = body.geometry.morphTargetsRelative === true;
    const basePosition = body.geometry.attributes.position;

    const displacementOf = ( name ) => {

        const attribute = morphAttributes[ dictionary[ name ] ];
        const out = new Float64Array( attribute.count * 3 );

        for ( let index = 0; index < attribute.count; index ++ ) {

            out[ index * 3 + 0 ] = relative ? attribute.getX( index ) : attribute.getX( index ) - basePosition.getX( index );
            out[ index * 3 + 1 ] = relative ? attribute.getY( index ) : attribute.getY( index ) - basePosition.getY( index );
            out[ index * 3 + 2 ] = relative ? attribute.getZ( index ) : attribute.getZ( index ) - basePosition.getZ( index );

        }

        return out;

    };

    const rms = ( values ) => {

        let sum = 0;
        for ( let index = 0; index < values.length; index += 3 ) {

            sum += values[ index ] ** 2 + values[ index + 1 ] ** 2 + values[ index + 2 ] ** 2;

        }
        return Math.sqrt( sum / ( values.length / 3 ) );

    };

    const displacements = new Map();
    for ( const name of OVR_VISEMES ) {

        if ( dictionary[ name ] === undefined ) continue;
        displacements.set( name, displacementOf( name ) );

    }

    const magnitudes = [ ...displacements.entries() ]
        .map( ( [ name, values ] ) => ( { name, rmsMm: rms( values ) * 1000 } ) )
        .sort( ( a, b ) => a.rmsMm - b.rmsMm );

    // `viseme_sil` is the neutral mouth and is legitimately near zero. Everything else must move.
    const moving = magnitudes.filter( ( item ) => item.name !== 'viseme_sil' );

    check( 'REAL FIGURE  every non-silence viseme actually displaces vertices',
        moving.every( ( item ) => item.rmsMm > 0.01 ),
        `RMS displacement ${ moving[ 0 ].rmsMm.toFixed( 4 ) } mm (${ moving[ 0 ].name }) .. ` +
        `${ moving[ moving.length - 1 ].rmsMm.toFixed( 4 ) } mm (${ moving[ moving.length - 1 ].name }); ` +
        `viseme_sil ${ magnitudes.find( ( item ) => item.name === 'viseme_sil' ).rmsMm.toFixed( 4 ) } mm` );

    let closestPair = null;
    let closestDistance = Infinity;

    const names = [ ...displacements.keys() ];
    for ( let a = 0; a < names.length; a ++ ) {

        for ( let b = a + 1; b < names.length; b ++ ) {

            const left = displacements.get( names[ a ] );
            const right = displacements.get( names[ b ] );

            let sum = 0;
            for ( let index = 0; index < left.length; index ++ ) sum += ( left[ index ] - right[ index ] ) ** 2;
            const distance = Math.sqrt( sum / ( left.length / 3 ) ) * 1000;

            if ( distance < closestDistance ) {

                closestDistance = distance;
                closestPair = `${ names[ a ] } / ${ names[ b ] }`;

            }

        }

    }

    check( '🚩 REAL FIGURE  the fifteen visemes are fifteen DIFFERENT shapes in vertex space',
        closestDistance > 0.05,
        `closest pair ${ closestPair } at ${ closestDistance.toFixed( 4 ) } mm RMS apart ` +
        `(${ ( names.length * ( names.length - 1 ) / 2 ) } pairs compared)` );

    // And the committed influences differ frame to frame as the utterance runs — a still mouth
    // would pass everything above.
    layer.speak( CANNED_TIMELINE, { at: 0 } );

    const trajectories = [];
    for ( let ms = 0; ms <= 1000; ms += 10 ) {

        clockValue.now = ms / 1000;
        stack.update( 1 / 60 );
        trajectories.push( OVR_VISEMES.map( ( name ) => {

            const locations = figure.morphRegistry.get( name );
            return locations[ 0 ].influences[ locations[ 0 ].index ];

        } ) );

    }

    let maxFrameToFrame = 0;
    for ( let index = 1; index < trajectories.length; index ++ ) {

        for ( let shape = 0; shape < OVR_VISEMES.length; shape ++ ) {

            maxFrameToFrame = Math.max( maxFrameToFrame,
                Math.abs( trajectories[ index ][ shape ] - trajectories[ index - 1 ][ shape ] ) );

        }

    }

    check( 'REAL FIGURE  the committed influences move over the utterance',
        maxFrameToFrame > 0.05,
        `largest 10 ms change in a committed morph influence: ${ maxFrameToFrame.toFixed( 4 ) }` );
}

// --- results ------------------------------------------------------------------------------------

let failed = 0;

process.stdout.write( `\nfigure: ${ figurePath }\n\n` );

for ( const result of checks ) {

    const status = result.passed ? 'PASS' : 'FAIL';
    if ( result.passed === false ) failed ++;

    process.stdout.write( `${ status }  ${ result.name }${ result.detail ? `\n        ${ result.detail }` : '' }\n` );

}

process.stdout.write( `\n${ checks.length - failed } passed, ${ failed } failed\n` );
process.exit( failed === 0 ? 0 : 1 );
