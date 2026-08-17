/**
 * Gesture.selftest.mjs — punch-list 6.3 and the two expressivity dials of 6.4.
 *
 * ## What this gate is actually for
 *
 * The number that matters in `Gesture.js` is not an amplitude, it is a SIGN. McNeill's rule is
 * one-sided — a gesture precedes or ends at, but does not follow, the phonological peak — and a
 * scheduler that gets the sign wrong still produces gestures, still hits every rate target, and
 * still looks busy on a HUD. Research §5 measures what it costs: *"recall declines sharply after
 * 400 ms of stroke delay."* So §SYNCHRONY does not merely check the shipped output; it builds the
 * schedule a DELAYING scheduler would emit and proves the same predicate rejects it. A check that
 * cannot fail on the defect is not a check on the defect (LEARNINGS §1.11).
 *
 * ## Constants are checked against the research file, not against this file's memory of it
 *
 * §SOURCES re-reads `docs/research/affect-and-animation.md` §5 and greps the numbers back out of
 * it. Four audits in this repository have found a constant that drifted from the document it cited
 * while both still looked right in isolation. A constant transcribed into code and asserted
 * against itself proves only that the transcription is self-consistent.
 *
 * ## The blind spot, printed every run
 *
 * Node has no renderer, so nothing here sees an arm move. Everything below is scheduling, envelope
 * arithmetic and channel bookkeeping against a parsed GLB skeleton. Whether a 30-degree shoulder
 * excursion READS as a beat is a judgement this process cannot make and does not claim to.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Vector3 } from 'three';

import {
    BEAT_EXCURSION, BEAT_HZ, ELBOW_RAISE_FULL_DEGREES, GESTURE_PHASES, GESTURE_RATE_PER_MINUTE, GestureLayer,
    PREPARATION_SECONDS, SHOULDER_RAISE_FULL_DEGREES, SPATIAL_EXTENT_RANGE, STROKE_LEAD_SECONDS,
    STROKE_SD_SECONDS, STROKE_SECONDS, amplitudeFor, gestureEnvelope, planGestures, postureYield,
    SAGITTAL_SHARE, rateForArousal, strokeDurationFor, syntheticSpeechPlan
} from './Gesture.js';
import { MOTION_ORDER, MotionStack } from './MotionStack.js';
import { MotionRandom } from './Signals.js';

// GLTFLoader reaches for `self` when it resolves texture sources. Five other gates in this
// directory carry the same line for the same reason.
globalThis.self ??= globalThis;

const results = [];

function check( label, passed, detail = '' ) {

    results.push( { label, passed } );
    const mark = passed ? 'PASS' : 'FAIL';
    console.log( `  ${ mark }  ${ label }${ detail ? `\n        ${ detail }` : '' }` );

}

function section( title ) {

    console.log( `\n--- ${ title } ${ '-'.repeat( Math.max( 0, 78 - title.length ) ) }` );

}

const here = path.dirname( fileURLToPath( import.meta.url ) );
const repoRoot = path.resolve( here, '../../../..' );

// A deterministic stream, so every count below is reproducible.
const stream = new MotionRandom( 20260817 );
const draw = () => stream.next();

// ================================================================================================
section( 'SOURCES — the constants, re-read out of the research file' );
// ================================================================================================

const researchPath = path.join( repoRoot, 'docs/research/affect-and-animation.md' );
const research = fs.readFileSync( researchPath, 'utf8' );

// §5 only. A number that appears somewhere else in an 886-line document is not a citation.
const bodySection = research.slice( research.indexOf( '## 5. Body' ), research.indexOf( '## 6. VTuber' ) );

check(
    'the research file has a §5 Body section to cite',
    bodySection.length > 1000,
    `${ bodySection.length } characters between "## 5. Body" and "## 6. VTuber"`
);

const sourceClaims = [
    { label: 'stroke mean 0.38 s', value: STROKE_SECONDS, pattern: /mean 0\.38 s/ },
    { label: 'stroke SD 0.14 s', value: STROKE_SD_SECONDS, pattern: /SD 0\.14 s/ },
    { label: 'stroke lead max 200 ms', value: STROKE_LEAD_SECONDS.max, pattern: /0–200 ms BEFORE/ },
    { label: 'preparation 400 ms', value: PREPARATION_SECONDS.min, pattern: /400–600 ms before/ },
    { label: 'preparation 600 ms', value: PREPARATION_SECONDS.max, pattern: /400–600 ms before/ },
    { label: 'rate band 9/min', value: GESTURE_RATE_PER_MINUTE.min, pattern: /~9–26 gestures\/min/ },
    { label: 'rate band 26/min', value: GESTURE_RATE_PER_MINUTE.max, pattern: /~9–26 gestures\/min/ },
    { label: 'whole-arm 1.36 Hz', value: BEAT_HZ.wholeArm, pattern: /1\.36 Hz whole-arm/ },
    { label: 'wrist 1.44 Hz', value: BEAT_HZ.wrist, pattern: /1\.44 Hz wrist/ },
    { label: 'shoulderRaise 1 = 30°', value: SHOULDER_RAISE_FULL_DEGREES, pattern: /shoulderRaise` \[−1,1\] where \*\*1 = 30°/ },
    { label: 'elbowRaise 1 = 90°', value: ELBOW_RAISE_FULL_DEGREES, pattern: /elbowRaise` \*\*1 = 90°/ }
];

for ( const claim of sourceClaims ) {

    check(
        `§5 states ${ claim.label }`,
        claim.pattern.test( bodySection ),
        claim.pattern.test( bodySection ) ? `code carries ${ claim.value }` : `NOT FOUND in §5: ${ claim.pattern }`
    );

}

check(
    'the 400 ms recall cliff is in §5, which is why a late stroke is dropped rather than delayed',
    /recall declines sharply after \*\*400 ms\*\*|recall declines sharply after 400 ms/.test( bodySection ),
    'this is the measured cost of the defect §SYNCHRONY refuses'
);

check(
    'SPATIAL_EXTENT_RANGE is declared authored rather than sourced',
    /🚩 CHOSEN, NOT SOURCED/.test( fs.readFileSync( path.join( here, 'Gesture.js' ), 'utf8' ) ),
    `band ${ SPATIAL_EXTENT_RANGE.min } to ${ SPATIAL_EXTENT_RANGE.max }; no source in the record states one`
);

// ================================================================================================
section( 'SYNCHRONY — the one-sided rule, and a delaying scheduler that must be caught' );
// ================================================================================================

/**
 * The predicate the gate is built on. Every stroke must start at or before its peak, and by no
 * more than the measured lead. Stated once, applied to the shipped output and to the defect.
 */
function synchronyViolations( gestures ) {

    const violations = [];

    for ( const gesture of gestures ) {

        const lead = gesture.peakTime - gesture.strokeStart;

        if ( lead < STROKE_LEAD_SECONDS.min - 1e-9 ) {
            violations.push( { gesture, why: 'stroke FOLLOWS the peak', lead } );
        } else if ( lead > STROKE_LEAD_SECONDS.max + 1e-9 ) {
            violations.push( { gesture, why: 'stroke leads by more than 200 ms', lead } );
        }

    }

    return violations;

}

// A corpus wide enough that a rule holding by accident on one sentence does not survive.
const CORPUS = [
    'I am glad you came back, and I have been thinking about what you said yesterday.',
    'No.',
    'Absolutely remarkable, genuinely unprecedented, thoroughly documented evidence.',
    'the and but for with from that this',
    'Sugata renders a complete figure with subsurface skin and refracting eyes at sixty frames.',
    'What do you mean by that exactly, because I think we might be talking past each other here.'
];

let totalGestures = 0;
let totalViolations = 0;

for ( const text of CORPUS ) {

    const plan = syntheticSpeechPlan( text );
    const schedule = planGestures( plan, { random: draw } );

    totalGestures += schedule.gestures.length;
    totalViolations += synchronyViolations( schedule.gestures ).length;

}

check(
    'the corpus produced gestures to check',
    totalGestures > 0,
    `${ totalGestures } gestures across ${ CORPUS.length } utterances`
);

check(
    'every shipped stroke starts at or before its peak, by at most 200 ms',
    totalViolations === 0,
    `${ totalViolations } violations in ${ totalGestures } gestures`
);

// 🚩 THE DEFECT. This is what a scheduler that slides a gesture later — instead of dropping it —
// actually emits: the stroke lands AFTER the peak. If the predicate above cannot see this, it is
// not a check on the rule, it is a check on the arithmetic that already passed.
const delayedSchedule = [
    { word: 'delayed', peakTime: 1.0, strokeStart: 1.25, strokeEnd: 1.63, preparationStart: 0.75, endTime: 2.1 },
    { word: 'slightly', peakTime: 3.0, strokeStart: 3.05, strokeEnd: 3.43, preparationStart: 2.55, endTime: 3.9 }
];

const caught = synchronyViolations( delayedSchedule );

check(
    'the same predicate REJECTS a delaying scheduler',
    caught.length === delayedSchedule.length,
    caught.map( ( v ) => `"${ v.word ?? v.gesture.word }" ${ v.why } by ${ ( -v.lead * 1000 ).toFixed( 0 ) } ms` ).join( '; ' )
);

// And the other direction: an over-eager scheduler that leads by too much is equally wrong.
const overEager = [ { word: 'early', peakTime: 2.0, strokeStart: 1.5, strokeEnd: 1.88, preparationStart: 1.0, endTime: 2.35 } ];

check(
    'the same predicate REJECTS a stroke leading by more than 200 ms',
    synchronyViolations( overEager ).length === 1,
    `500 ms lead rejected; the rule is a band, not a floor`
);

// ================================================================================================
section( 'DROPPING — what cannot fit is refused, not repaired' );
// ================================================================================================

// A stressed word in the first 400 ms cannot have its preparation. There is no legal repair.
const earlyPlan = {
    words: [
        { text: 'Absolutely', startTime: 0.05, endTime: 0.5, stressed: true },
        { text: 'remarkable', startTime: 3.0, endTime: 3.6, stressed: true }
    ],
    durationSeconds: 4
};

const earlySchedule = planGestures( earlyPlan, { random: draw } );

check(
    'a peak inside the preparation window is dropped',
    earlySchedule.dropped.tooEarly === 1,
    `dropped.tooEarly ${ earlySchedule.dropped.tooEarly }, scheduled ${ earlySchedule.gestures.length }`
);

check(
    'and the survivor is the one that had room',
    earlySchedule.gestures.length === 1 && earlySchedule.gestures[ 0 ].word === 'remarkable',
    earlySchedule.gestures.map( ( g ) => g.word ).join( ', ' ) || '(none)'
);

check(
    'no dropped gesture reappears later in the schedule',
    earlySchedule.gestures.every( ( g ) => g.preparationStart >= 0 ),
    'preparationStart >= 0 for every survivor, so nothing was slid forward to make it fit'
);

// Rate budget: dense stress must not produce 60 gestures a minute.
const densePlan = {
    words: Array.from( { length: 60 }, ( unused, index ) => ( {
        text: `word${ index }`, startTime: 1 + index * 0.4, endTime: 1.35 + index * 0.4, stressed: true
    } ) ),
    durationSeconds: 25
};

const denseSchedule = planGestures( densePlan, { random: draw, gesturesPerMinute: 20 } );
const denseRate = denseSchedule.gestures.length / ( densePlan.durationSeconds / 60 );

check(
    'dense stress is thinned by the refractory rather than gestured on every word',
    denseSchedule.dropped.refractory > 0 && denseSchedule.gestures.length < densePlan.words.length,
    `${ densePlan.words.length } candidates -> ${ denseSchedule.gestures.length } gestures, ` +
    `${ denseSchedule.dropped.refractory } refused on rate`
);

check(
    'and the realised rate does not exceed the asked rate',
    denseRate <= 20 + 1e-6,
    `asked 20/min, realised ${ denseRate.toFixed( 2 ) }/min`
);

check(
    'the realised rate sits inside the measured 9 to 26/min band',
    denseRate >= GESTURE_RATE_PER_MINUTE.min && denseRate <= GESTURE_RATE_PER_MINUTE.max,
    `${ denseRate.toFixed( 2 ) }/min`
);

check(
    'gestures never overlap, which is what the refractory buys',
    denseSchedule.gestures.every( ( g, i ) => i === 0 || g.preparationStart >= denseSchedule.gestures[ i - 1 ].strokeEnd ),
    'each preparation starts no earlier than the previous stroke ends'
);

// ================================================================================================
section( 'RATE — arousal maps across the band rather than picking a constant' );
// ================================================================================================

check(
    'neutral arousal lands on the band midpoint',
    Math.abs( rateForArousal( 0 ) - 17.5 ) < 1e-9,
    `${ rateForArousal( 0 ) }/min, midpoint of ${ GESTURE_RATE_PER_MINUTE.min } to ${ GESTURE_RATE_PER_MINUTE.max }`
);

check(
    'full arousal reaches the top of the band and no further',
    rateForArousal( 1 ) === GESTURE_RATE_PER_MINUTE.max && rateForArousal( 5 ) === GESTURE_RATE_PER_MINUTE.max,
    `arousal 1 -> ${ rateForArousal( 1 ) }/min; arousal 5 clamps to ${ rateForArousal( 5 ) }/min`
);

check(
    'full negative arousal reaches the bottom and no further',
    rateForArousal( -1 ) === GESTURE_RATE_PER_MINUTE.min && rateForArousal( -5 ) === GESTURE_RATE_PER_MINUTE.min,
    `arousal −1 -> ${ rateForArousal( -1 ) }/min`
);

check(
    'the mapping is monotonic in arousal',
    [ -1, -0.5, 0, 0.5, 1 ].every( ( a, i, all ) => i === 0 || rateForArousal( a ) > rateForArousal( all[ i - 1 ] ) ),
    'more activated speakers gesture more often'
);

// ================================================================================================
section( 'EXPRESSIVITY — 6.4, and the difference between the sourced dial and the authored one' );
// ================================================================================================

check(
    'temporal extent 0 is the measured mean',
    strokeDurationFor( 0 ) === STROKE_SECONDS,
    `${ strokeDurationFor( 0 ) } s`
);

check(
    'temporal extent +1 is exactly one SD faster',
    Math.abs( strokeDurationFor( 1 ) - ( STROKE_SECONDS - STROKE_SD_SECONDS ) ) < 1e-9,
    `${ strokeDurationFor( 1 ).toFixed( 3 ) } s, mean ${ STROKE_SECONDS } − SD ${ STROKE_SD_SECONDS }`
);

check(
    'temporal extent −1 is exactly one SD slower',
    Math.abs( strokeDurationFor( -1 ) - ( STROKE_SECONDS + STROKE_SD_SECONDS ) ) < 1e-9,
    `${ strokeDurationFor( -1 ).toFixed( 3 ) } s`
);

check(
    'no temporal-extent value can leave the recorded range',
    [ -100, -3, 0, 3, 100, NaN, Infinity ].every( ( value ) => {
        const d = strokeDurationFor( value );
        return d >= STROKE_SECONDS - STROKE_SD_SECONDS - 1e-9 && d <= STROKE_SECONDS + STROKE_SD_SECONDS + 1e-9;
    } ),
    `every setting produces a duration in [${ ( STROKE_SECONDS - STROKE_SD_SECONDS ).toFixed( 2 ) }, ` +
    `${ ( STROKE_SECONDS + STROKE_SD_SECONDS ).toFixed( 2 ) }] s — a duration somebody was recorded producing`
);

check(
    'spatial extent 0 is unity, so the sourced amplitude shows through undisturbed',
    amplitudeFor( 0 ) === 1,
    `${ amplitudeFor( 0 ) }x on ${ SHOULDER_RAISE_FULL_DEGREES }° — the eBMLController unit is what moves`
);

check(
    'spatial extent spans the authored band and clamps',
    amplitudeFor( -1 ) === SPATIAL_EXTENT_RANGE.min && amplitudeFor( 1 ) === SPATIAL_EXTENT_RANGE.max
        && amplitudeFor( 9 ) === SPATIAL_EXTENT_RANGE.max,
    `${ SPATIAL_EXTENT_RANGE.min }x to ${ SPATIAL_EXTENT_RANGE.max }x 🚩 authored, not sourced`
);

// ================================================================================================
section( 'ENVELOPE — BML sync points, and a stroke that accents rather than waves' );
// ================================================================================================

const sample = planGestures(
    { words: [ { text: 'measured', startTime: 2.0, endTime: 2.5, stressed: true } ], durationSeconds: 4 },
    { random: draw }
).gestures[ 0 ];

check(
    'a gesture is silent before its preparation and after its end',
    gestureEnvelope( sample, sample.preparationStart - 0.01 ).activation === 0
        && gestureEnvelope( sample, sample.endTime + 0.01 ).activation === 0,
    'the layer contributes nothing outside the gesture, so it stays out of the conflict report'
);

check(
    'every phase name it emits is a BML sync point',
    [ -0.1, 0, 0.25, 0.5, 0.75, 0.99, 1.2 ]
        .map( ( t ) => gestureEnvelope( sample, sample.preparationStart + t * ( sample.endTime - sample.preparationStart ) ).phase )
        .every( ( phase ) => GESTURE_PHASES.includes( phase ) ),
    GESTURE_PHASES.join( ' -> ' )
);

const readyPeak = gestureEnvelope( sample, sample.strokeStart - 1e-4 ).activation;
const strokePeak = gestureEnvelope( sample, sample.strokeEnd - 1e-4 ).activation;

check(
    'preparation reaches the ready pose, well short of full excursion',
    readyPeak > 0.3 && readyPeak <= 0.41,
    `ready ${ readyPeak.toFixed( 3 ) } vs stroke ${ strokePeak.toFixed( 3 ) } — the stroke is the accent`
);

check(
    'the stroke reaches full excursion',
    strokePeak > 0.98,
    `${ strokePeak.toFixed( 4 ) }`
);

// The accent test: a beat's excursion is abrupt. Compare the slope through the stroke's first
// fifth against the slope through preparation. A symmetric bell fails this.
const attackSpan = sample.strokeSeconds * 0.2;
const attackSlope = ( gestureEnvelope( sample, sample.strokeStart + attackSpan ).activation
    - gestureEnvelope( sample, sample.strokeStart ).activation ) / attackSpan;
const prepSpan = sample.strokeStart - sample.preparationStart;
const prepSlope = 0.4 / prepSpan;

check(
    'the stroke attack is steeper than the preparation, so it reads as an accent',
    attackSlope > prepSlope * 2,
    `attack ${ attackSlope.toFixed( 2 ) }/s vs preparation ${ prepSlope.toFixed( 2 ) }/s ` +
    `(${ ( attackSlope / prepSlope ).toFixed( 1 ) }x)`
);

check(
    'activation never leaves [0, 1] anywhere in the gesture',
    Array.from( { length: 400 }, ( unused, i ) => {
        const t = sample.preparationStart + ( i / 399 ) * ( sample.endTime - sample.preparationStart );
        return gestureEnvelope( sample, t ).activation;
    } ).every( ( a ) => a >= 0 && a <= 1 ),
    '400 samples'
);

// ================================================================================================
section( 'POSTURE YIELD — the asymmetry, which is the whole point' );
// ================================================================================================

check(
    'an open posture does not suppress gesture at all',
    postureYield( 21.20 ) === 1 && postureYield( 0 ) === 1,
    "joy's measured +21.20° arms gesture at full size"
);

check(
    'a closed posture suppresses toward the floor',
    postureYield( -10 ) < 0.4 && postureYield( -5 ) < 1 && postureYield( -5 ) > postureYield( -10 ),
    `−5° -> ${ postureYield( -5 ).toFixed( 3 ) }, −10° -> ${ postureYield( -10 ).toFixed( 3 ) }`
);

check(
    'but never to silence — an angry speaker still beats, tightly',
    postureYield( -90 ) > 0.3,
    `−90° -> ${ postureYield( -90 ).toFixed( 3 ) }; a floor of zero would freeze the figure at peak affect`
);

check(
    'the yield is monotonic in adduction',
    [ 0, -2, -4, -6, -8, -10 ].every( ( d, i, all ) => i === 0 || postureYield( d ) <= postureYield( all[ i - 1 ] ) ),
    'no non-monotonic step that would read as a stutter'
);

check(
    'a missing posture reads as no claim rather than as full suppression',
    postureYield( undefined ) === 1 && postureYield( NaN ) === 1,
    'a stack with no PostureLayer gestures normally'
);

// ================================================================================================
section( 'LAYER — channel discipline, determinism, and silence while idle' );
// ================================================================================================

const layer = new GestureLayer();

check(
    'the layer sits at MOTION_ORDER.GESTURE',
    layer.order === MOTION_ORDER.GESTURE,
    `order ${ layer.order }`
);

check(
    'it declares exactly the four arm bones',
    layer.boneChannels.length === 4
        && [ 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r' ].every( ( b ) => layer.boneChannels.includes( b ) ),
    layer.boneChannels.join( ', ' )
);

check(
    'it declares no morph channels — the face is not gesture\'s to write',
    layer.morphChannels.length === 0,
    'ExpressionLayer and VisemeLayer own the face'
);

check(
    'an unspoken layer contributes nothing',
    layer.update( 0.016, { shared: {} } ) === null,
    'returns null, so it never appears in the conflict report while silent'
);

// Drive a whole utterance and confirm it claims the arm and then lets go.
const speakingLayer = new GestureLayer();
speakingLayer.random = new MotionRandom( 7 );
const spokenSchedule = speakingLayer.speak( syntheticSpeechPlan( CORPUS[ 0 ] ) );

let claimedFrames = 0;
let maxShoulder = 0;
let frames = 0;

for ( let t = 0; t < 12; t += 1 / 60 ) {

    const contribution = speakingLayer.update( 1 / 60, { shared: {} } );
    frames += 1;
    if ( contribution !== null ) {
        claimedFrames += 1;
        maxShoulder = Math.max( maxShoulder, Math.abs( speakingLayer.applied.shoulderDegrees ) );
    }

}

check(
    'the utterance scheduled gestures and the layer claimed the arm on some frames',
    spokenSchedule.gestures.length > 0 && claimedFrames > 0,
    `${ spokenSchedule.gestures.length } gestures, ${ claimedFrames }/${ frames } frames claimed`
);

check(
    'peak shoulder excursion is a fraction of the eBMLController unit, not the whole of it',
    maxShoulder > 1 && maxShoulder <= SHOULDER_RAISE_FULL_DEGREES * BEAT_EXCURSION + 1e-6,
    `${ maxShoulder.toFixed( 2 ) }° = ${ BEAT_EXCURSION } x ${ SHOULDER_RAISE_FULL_DEGREES }° parameter range`
);

// 🚩 THE RELATION THAT SETS BEAT_EXCURSION, checked against PostureLayer's own constant rather
// than against a transcribed 10.5. A beat is an accent laid over a posture; a beat larger than the
// posture it accents swamps the one affect axis a face cannot carry. The first version of this
// file had no BEAT_EXCURSION at all, which silently set it to 1.0 and produced exactly that.
const { POSTURE_FULL_SCALE_DEGREES } = await import( '../affect/PostureLayer.js' );
const fullBeatDegrees = SHOULDER_RAISE_FULL_DEGREES * BEAT_EXCURSION;

check(
    'a full beat is visibly smaller than the postural arm scale it accents',
    fullBeatDegrees < POSTURE_FULL_SCALE_DEGREES.armSpread * 0.5,
    `beat ${ fullBeatDegrees.toFixed( 2 ) }° against PostureLayer's armSpread full scale of ` +
    `${ POSTURE_FULL_SCALE_DEGREES.armSpread }° (joy applies +21.20° of it on this bake)`
);

check(
    'and BEAT_EXCURSION is declared authored rather than sourced',
    /🚩 CHOSEN, AND THE REASON IT IS NOT SIMPLY 1/.test( fs.readFileSync( path.join( here, 'Gesture.js' ), 'utf8' ) ),
    'no source in the record states a beat angle, so the number is named where a critic can find it'
);

check(
    'the layer falls silent once the schedule runs out',
    speakingLayer.speaking === false,
    `utteranceTime ${ speakingLayer.utteranceTime.toFixed( 2 ) } s`
);

// Determinism: two layers on the same seed and the same text must schedule identically.
function scheduleWithSeed( seed ) {

    const l = new GestureLayer();
    l.random = new MotionRandom( seed );
    return l.speak( syntheticSpeechPlan( CORPUS[ 0 ] ) ).gestures.map( ( g ) => `${ g.word }@${ g.strokeStart.toFixed( 6 ) }` ).join( '|' );

}

check(
    'the same seed schedules the same gestures',
    scheduleWithSeed( 11 ) === scheduleWithSeed( 11 ),
    'a critic run twice in one process does not diverge'
);

check(
    'a different seed schedules differently',
    scheduleWithSeed( 11 ) !== scheduleWithSeed( 12 ),
    'the draws are actually reaching the schedule'
);

// reset() must return the layer to its start-of-run state; LEARNINGS says rewinding the stream
// alone is not enough, and a layer holding an utterance clock is exactly that case.
speakingLayer.reset();

check(
    'reset() clears the schedule and the utterance clock',
    speakingLayer.schedule === null && speakingLayer.utteranceTime === 0 && speakingLayer.speaking === false,
    'a second capture run starts from silence rather than mid-stroke'
);

// The posture yield, end to end through the layer rather than through the helper.
const angryLayer = new GestureLayer();
angryLayer.random = new MotionRandom( 7 );
angryLayer.speak( syntheticSpeechPlan( CORPUS[ 0 ] ) );

const openLayer = new GestureLayer();
openLayer.random = new MotionRandom( 7 );
openLayer.speak( syntheticSpeechPlan( CORPUS[ 0 ] ) );

let angryPeak = 0;
let openPeak = 0;

for ( let t = 0; t < 12; t += 1 / 60 ) {

    angryLayer.update( 1 / 60, { shared: { posture: { appliedDegrees: { armSpreadLeft: -10 } } } } );
    openLayer.update( 1 / 60, { shared: { posture: { appliedDegrees: { armSpreadLeft: 21.2 } } } } );

    angryPeak = Math.max( angryPeak, Math.abs( angryLayer.applied.shoulderDegrees ) );
    openPeak = Math.max( openPeak, Math.abs( openLayer.applied.shoulderDegrees ) );

}

check(
    'a clamped angry body gestures smaller than an open joyful one, on identical text and seed',
    angryPeak > 0 && angryPeak < openPeak * 0.5,
    `anger ${ angryPeak.toFixed( 2 ) }° vs joy ${ openPeak.toFixed( 2 ) }° — ` +
    `${ ( angryPeak / openPeak ).toFixed( 2 ) }x, and non-zero`
);

// And the defect toggle, which proves the yield is doing the work rather than the seed.
const unyielding = new GestureLayer( { yieldToPosture: false } );
unyielding.random = new MotionRandom( 7 );
unyielding.speak( syntheticSpeechPlan( CORPUS[ 0 ] ) );

let unyieldingPeak = 0;
for ( let t = 0; t < 12; t += 1 / 60 ) {
    unyielding.update( 1 / 60, { shared: { posture: { appliedDegrees: { armSpreadLeft: -10 } } } } );
    unyieldingPeak = Math.max( unyieldingPeak, Math.abs( unyielding.applied.shoulderDegrees ) );
}

check(
    'yieldToPosture:false reproduces the defect — a beat that overrides the angry clamp',
    unyieldingPeak > angryPeak * 2,
    `defect ${ unyieldingPeak.toFixed( 2 ) }° vs shipped ${ angryPeak.toFixed( 2 ) }° on the same clamp`
);

// ================================================================================================
section( 'AFFECT — dominance reaches gesture amplitude, which is a contract not a choice' );
// ================================================================================================

/**
 * 🎯 THE CLAIM, AND WHY IT IS SHAPED LIKE THE ANGER/FEAR TRUNK PROOF.
 *
 * `AffectState.faceInput()` carries Arellano et al. (AMDO 2014), n=109: pleasure reads off a static
 * face, arousal mostly, *"dominance not at all"*. Research §1 turns that into this project's
 * structural rule — *"dominance must be carried by posture, gaze policy, interruption behaviour and
 * GESTURE AMPLITUDE, never by the face"* — and `AffectState.bodyInput()` names the consumer:
 * *"All three axes, for posture, gaze policy and gesture amplitude. Phase 6 consumes this."*
 *
 * So the gate holds pleasure and arousal FIXED and moves dominance alone, exactly as the posture
 * gate does for the trunk. If amplitude moves, the axis a face cannot carry has a second body-level
 * channel. If it does not, `Avatar.js` is quoting a contract it does not implement.
 */
function peakShoulderAtDominance( dominance ) {

    const layer = new GestureLayer();
    layer.random = new MotionRandom( 7 );

    layer.speak( syntheticSpeechPlan( CORPUS[ 0 ] ), { arousal: 0.5 } );

    // 🚩 DRIVEN THROUGH THE SHARED BAG, WHICH IS THE SHIPPED PATH. An earlier version of this gate
    // set `layer.spatialExtent` directly and passed — while the live avatar gestured every sentence
    // at the PREVIOUS sentence's amplitude, because `Avatar.say()` snapshotted `pad` before the
    // affect state had integrated the `feel()` that preceded it. The gate could not see it: it
    // never went through an AffectState at all. Driving the real channel is the repair.
    const shared = { affect: { pad: { pleasure: 0.5, arousal: 0.5, dominance } } };

    let peak = 0;

    for ( let t = 0; t < 12; t += 1 / 60 ) {

        layer.update( 1 / 60, shared === null ? { shared: {} } : { shared } );
        peak = Math.max( peak, Math.abs( layer.applied.shoulderDegrees ) );

    }

    return peak;

}

const dominant = peakShoulderAtDominance( 0.9 );
const submissive = peakShoulderAtDominance( -0.9 );
const neutralDominance = peakShoulderAtDominance( 0 );

check(
    'dominance changes gesture amplitude with pleasure and arousal held constant',
    dominant > submissive * 1.5,
    `dominance +0.9 -> ${ dominant.toFixed( 2 ) }°, −0.9 -> ${ submissive.toFixed( 2 ) }°, ` +
    `${ ( dominant / submissive ).toFixed( 2 ) }x on identical text, seed and arousal`
);

check(
    'and it is monotonic through neutral',
    dominant > neutralDominance && neutralDominance > submissive,
    `${ submissive.toFixed( 2 ) }° < ${ neutralDominance.toFixed( 2 ) }° < ${ dominant.toFixed( 2 ) }°`
);

check(
    'a submissive speaker still gestures rather than freezing',
    submissive > 1,
    `${ submissive.toFixed( 2 ) }° — low dominance reads as small movement, not as absence`
);

// The two body channels for dominance are genuinely different mechanisms, and the gate says so
// rather than leaving a reader to assume gesture is reading the trunk twice.
check(
    'gesture amplitude and postural lean are independent channels for the same axis',
    ( () => {
        const withPosture = new GestureLayer();
        withPosture.random = new MotionRandom( 7 );
        withPosture.speak( syntheticSpeechPlan( CORPUS[ 0 ] ), { arousal: 0.5 } );

        // A dominant speaker whose posture happens to be adducted: amplitude is high, yield is low.
        // If gesture were reading the trunk, these could not disagree.
        let peak = 0;
        for ( let t = 0; t < 12; t += 1 / 60 ) {
            withPosture.update( 1 / 60, { shared: {
                affect: { pad: { pleasure: 0.5, arousal: 0.5, dominance: 0.9 } },
                posture: { appliedDegrees: { armSpreadLeft: -10 } }
            } } );
            peak = Math.max( peak, Math.abs( withPosture.applied.shoulderDegrees ) );
        }

        return peak < dominant && peak > 0;
    } )(),
    'high dominance under an adducted posture gestures large-but-suppressed, a state the trunk alone cannot express'
);

/**
 * 🚩 THE SNAPSHOT DEFECT, REPRODUCED ON DEMAND.
 *
 * This is the bug the first version of this file shipped and the first version of this gate could
 * not see, found only by driving a live browser. `Avatar.say()` read `pad.dominance` once, when the
 * schedule was built — but `AffectState.push()` sets a TARGET that `pad` integrates toward over
 * later frames, so the value at `say()` time is the emotion of the PREVIOUS utterance. Measured in
 * the browser on 2026-08-17: `feel({ dominance: +0.9 })` read back −0.892.
 *
 * `dominanceDrivesAmplitude: false` is that behaviour, kept reachable so this has something to go
 * red on. With it off, the live affect state is ignored and amplitude is frozen at the authored
 * knob — which is why a moving affect produces no change at all.
 */
function frozenPeakAtDominance( dominance ) {

    const layer = new GestureLayer( { dominanceDrivesAmplitude: false } );
    layer.random = new MotionRandom( 7 );
    layer.speak( syntheticSpeechPlan( CORPUS[ 0 ] ), { arousal: 0.5 } );

    let peak = 0;

    for ( let t = 0; t < 12; t += 1 / 60 ) {
        layer.update( 1 / 60, { shared: { affect: { pad: { pleasure: 0.5, arousal: 0.5, dominance } } } } );
        peak = Math.max( peak, Math.abs( layer.applied.shoulderDegrees ) );
    }

    return peak;

}

check(
    'the snapshot defect is reproducible — a frozen amplitude ignores the affect entirely',
    Math.abs( frozenPeakAtDominance( 0.9 ) - frozenPeakAtDominance( -0.9 ) ) < 1e-9,
    `+0.9 and −0.9 both give ${ frozenPeakAtDominance( 0.9 ).toFixed( 2 ) }° — the separation above ` +
    'is the live read doing the work, not the seed'
);

check(
    'and the shipped layer reports which of the two it is running',
    new GestureLayer().report().dominanceDrivesAmplitude === true
        && new GestureLayer( { dominanceDrivesAmplitude: false } ).report().dominanceDrivesAmplitude === false,
    'report().dominanceDrivesAmplitude, beside the applied extent it resolved to'
);

// ================================================================================================
section( 'WIRING — the layer is reachable from the runtime, not merely correct in isolation' );
// ================================================================================================

/**
 * 🚩 THIS SECTION EXISTS BECAUSE OF `physics/SpringBones.js`.
 *
 * That file passes 86 of 86 of its own gates and, measured on 2026-08-17, has ZERO call sites
 * outside its own selftest — nothing imports it, nothing constructs it, and the shipped rig has no
 * joint it could drive. A green gate proves the algorithm; it says nothing whatever about whether
 * the avatar can reach it. `measure-the-frame-not-the-execution` in one file.
 *
 * ⚠️ These are SOURCE assertions, and they are weaker than every behavioural check above. Node has
 * no canvas or adapter so an `Avatar` cannot be built here to prove the wiring by running it. What
 * they buy is that the specific way this module could die — quietly never being constructed — fails
 * loudly instead. The live proof is the browser gate.
 */
const avatarSource = fs.readFileSync( path.join( here, '../Avatar.js' ), 'utf8' );

for ( const [ label, needle ] of [
    [ 'imports the layer', "from './motion/Gesture.js'" ],
    [ 'constructs it', 'new GestureLayer()' ],
    [ 'adds it to the stack', 'this.stack.add( this.gesture )' ],
    [ 'drives it from say()', 'this.gesture?.speak(' ],
    [ 'publishes the posture it yields to', 'this.stack.context.shared.posture = this.posture' ],
    [ 'publishes the affect state gesture reads live', 'this.stack.context.shared.affect = this.affectState' ],
    [ 'schedules rate from the affect TARGET, not the integrated pad', 'this.affectState?.target?.arousal' ],
    [ 'stops it with the mouth', 'this.gesture?.stop()' ],
    [ 'reports it', 'gesture: this.gesture?.report() ?? null' ],
    [ 'nulls it on dispose', 'this.gesture = null' ]
] ) {

    check( `Avatar.js ${ label }`, avatarSource.includes( needle ), needle );

}

check(
    'gesture is driven ABOVE the timeline check, so a host without TTS still gets a body',
    avatarSource.indexOf( 'this.gesture?.speak(' ) < avatarSource.indexOf( 'const timeline = options.timeline ?? null;' ),
    'below it, say() without a timeline would move the eyebrows and nothing else'
);

// ================================================================================================
section( 'PROVENANCE — synthetic timing is flagged on the data, not in a docstring' );
// ================================================================================================

const syntheticPlan = syntheticSpeechPlan( 'this timing is not real' );

check(
    'syntheticSpeechPlan flags its output',
    syntheticPlan.synthetic === true,
    'the flag rides on the plan'
);

check(
    'the flag survives into the schedule',
    planGestures( syntheticPlan, { random: draw } ).synthetic === true,
    'planGestures propagates rather than dropping it'
);

const reportingLayer = new GestureLayer();
reportingLayer.random = new MotionRandom( 3 );
reportingLayer.speak( syntheticPlan );

check(
    'and into report(), so a caller that never read a docstring still cannot mistake it for measurement',
    reportingLayer.report().schedule.syntheticTiming === true,
    'report().schedule.syntheticTiming'
);

const measuredPlan = {
    words: [ { text: 'measured', startTime: 1.5, endTime: 2.0, stressed: true } ],
    durationSeconds: 3
};

check(
    'a supplied plan is NOT flagged synthetic',
    planGestures( measuredPlan, { random: draw } ).synthetic === false,
    'a real TTS timeline reports as real'
);

check(
    'a plan carrying stress marks uses them rather than the fallback',
    planGestures( measuredPlan, { random: draw } ).stressSource === 'plan',
    'stressSource: plan'
);

check(
    'a plan without stress marks says so',
    planGestures( syntheticPlan, { random: draw } ).stressSource === 'content-word-fallback',
    'stressSource: content-word-fallback — the heuristic is named in the output, not hidden'
);

check(
    'planGestures refuses a malformed plan rather than inventing one',
    ( () => { try { planGestures( { nope: true } ); return false; } catch ( e ) { return e instanceof TypeError; } } )(),
    'TypeError naming syntheticSpeechPlan()'
);

// ================================================================================================
section( 'STACK — it composes with the layers that already claim the arm' );
// ================================================================================================

const stack = new MotionStack( { seed: 5 } );
const stackLayer = new GestureLayer();
stack.add( stackLayer );

check(
    'the stack accepts the layer and forks it a stream',
    stackLayer.random !== null && stackLayer.stack === stack,
    `stream forked on the name "${ stackLayer.name }"`
);

check(
    'BodyIdle also declares the arm bones, so this is a DECLARED overlap the stack can name',
    fs.readFileSync( path.join( here, 'BodyIdle.js' ), 'utf8' ).includes( 'boneChannels' ),
    'idle sway and a beat genuinely both want the arm; the stack composing them is the mechanism'
);

// ================================================================================================
section( 'DIRECTION — REQ-084, and the plane the old gate could not see' );
// ================================================================================================

/**
 * 🎯 THE CLAUSE THAT NEEDED A FIGURE.
 *
 * Every check above measures the excursion in DEGREES, so all 86 of them stayed green while the
 * arm swung out sideways like a wing. REQ-084 was found by looking at a render, not by running the
 * gate, and a defect a gate cannot observe is one it will ship again. So this section binds the
 * real skeleton and asks where the HAND actually went.
 *
 * Research §5 puts the rhythm on "co-speech ARM movement" with acoustic peaks landing "just before
 * maximum EXTENSION" — a forward quantity — and eBMLController keeps `shoulderRaise` separate from
 * its DIRECTED motion default for the same reason. Beats are mostly sagittal.
 */
const { Figure } = await import( '../figure/Figure.js' );
const { createMotionTarget } = await import( './MotionStack.js' );

const figureBytes = fs.readFileSync( path.join( repoRoot, 'assets/figures/figure_g050.glb' ) );
const figure = await Figure.parse(
    figureBytes.buffer.slice( figureBytes.byteOffset, figureBytes.byteOffset + figureBytes.byteLength ) );

figure.root.updateMatrixWorld( true );

/** Where the hand goes at the stroke peak, in rig space, relative to where it rested. */
function handTravelAtStrokePeak( layerOptions = {} ) {

    // A fresh scene per measurement: the stack commits to the figure, so a second run would start
    // from the pose the first one left behind.
    const bytes = fs.readFileSync( path.join( repoRoot, 'assets/figures/figure_g050.glb' ) );
    return Figure.parse( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) )
        .then( ( fresh ) => {

            fresh.root.updateMatrixWorld( true );

            const stack = new MotionStack( { seed: 7 } );
            const layer = new GestureLayer( layerOptions );
            stack.add( layer );
            stack.bind( createMotionTarget( fresh.root ) );

            const hand = fresh.root.getObjectByName( 'hand_r' );
            const rest = hand.getWorldPosition( new Vector3() ).clone();

            layer.speak( syntheticSpeechPlan( CORPUS[ 0 ] ), { arousal: 0 } );

            let best = -1;
            let travel = null;

            for ( let i = 0; i < 720; i++ ) {

                stack.update( 1 / 60 );

                // The right hand only moves on a right-handed gesture; measure at ITS peak.
                if ( layer.applied.hand !== 'right' && layer.applied.hand !== 'both' ) continue;

                if ( layer.applied.activation > best ) {

                    best = layer.applied.activation;
                    fresh.root.updateMatrixWorld( true );
                    const now = hand.getWorldPosition( new Vector3() );
                    travel = { x: now.x - rest.x, y: now.y - rest.y, z: now.z - rest.z };

                }

            }

            return { travel, peakActivation: best, armSidesMeasured: layer.armSidesMeasured,
                armSides: { ...layer.armSides } };

        } );

}

/**
 * 🚩 WHICH WAY IS FORWARD, MEASURED OFF THE RIG RATHER THAN ASSUMED TO BE +Z.
 *
 * The toes point forward by anatomy, so `ball_r − foot_r` in Z is the rig's own answer and it
 * survives a rig that was authored facing the other way. Same measure-don't-transcribe rule
 * `PostureLayer` applies to the arm sides, and the same rule this gate FAILED to apply below.
 */
const toeAnchor = figure.root.getObjectByName( 'foot_r' ).getWorldPosition( new Vector3() );
const toeTip = figure.root.getObjectByName( 'ball_r' ).getWorldPosition( new Vector3() );
const forwardSign = Math.sign( toeTip.z - toeAnchor.z ) || 1;

check(
    'the rig states which way is forward, and it is measured off the toes',
    Math.abs( toeTip.z - toeAnchor.z ) > 0.05,
    `ball_r sits ${ ( ( toeTip.z - toeAnchor.z ) * 1000 ).toFixed( 1 ) } mm of Z from foot_r, so forward is ` +
    `${ forwardSign > 0 ? '+Z' : '−Z' } on this bake`
);

const shipped = await handTravelAtStrokePeak();

check(
    'the layer measured both arm sides off the bound rig rather than transcribing them',
    shipped.armSidesMeasured === true,
    `left ${ shipped.armSides.left }, right ${ shipped.armSides.right } — a mirrored rig flips these, ` +
    'which is why PostureLayer measures them too'
);

check(
    'the stroke peak was reached on the bound figure',
    shipped.peakActivation > 0.9 && shipped.travel !== null,
    `activation ${ shipped.peakActivation.toFixed( 3 ) }`
);

// 🚩 SIGNED, NOT ABSOLUTE, AND THIS IS THE WHOLE LESSON OF REQ-084's SECOND HALF.
//
// The first version of this clause compared `Math.abs( travel.z )` against `Math.abs( travel.x )`.
// It passed — while the arm swung 71.9 mm BEHIND the figure, because a backward swing is sagittal
// and an absolute value cannot tell the two apart. The property being tested is a DIRECTION and it
// was being measured as a magnitude. Found by measuring the toes, not by running the gate.
const forward = shipped.travel.z * forwardSign;
const lateral = Math.abs( shipped.travel.x );

check(
    'REQ-084: the hand travels FORWARD, in the direction the toes point',
    forward > 0,
    `${ ( forward * 1000 ).toFixed( 1 ) } mm along the rig's own forward. A magnitude test passes on ` +
    'a backward swing too, which is exactly what this file shipped for one round'
);

check(
    'and it travels forward further than it travels sideways',
    forward > lateral,
    `forward ${ ( forward * 1000 ).toFixed( 1 ) } mm against lateral ${ ( lateral * 1000 ).toFixed( 1 ) } mm ` +
    `(${ ( forward / lateral ).toFixed( 2 ) }x) — beats are sagittal`
);

check(
    'and the hand rises rather than dropping, which is what an accent does',
    shipped.travel.y > 0,
    `${ ( shipped.travel.y * 1000 ).toFixed( 1 ) } mm up`
);

check(
    'and it still travels sideways enough to keep the hand off the thigh',
    lateral * 1000 > 5,
    `${ ( lateral * 1000 ).toFixed( 1 ) } mm of lateral, from a ${ ( 1 - SAGITTAL_SHARE ).toFixed( 2 ) } frontal share`
);

// 🚩 THE DEFECT, REPRODUCED. This is what the file shipped before REQ-084 — an all-frontal stroke.
const wing = await handTravelAtStrokePeak( { sagittalShare: 0 } );
const wingForward = wing.travel.z * forwardSign;
const wingLateral = Math.abs( wing.travel.x );

check(
    'sagittalShare 0 reproduces the wing, and this clause goes red on it',
    wingLateral > wingForward,
    `defect: lateral ${ ( wingLateral * 1000 ).toFixed( 1 ) } mm against forward ` +
    `${ ( wingForward * 1000 ).toFixed( 1 ) } mm — the shape seen on the live render, now gated`
);

check(
    'the shipped split moves the hand markedly further forward than the defect does',
    forward > Math.abs( wingForward ) * 2,
    `${ ( forward * 1000 ).toFixed( 1 ) } mm against ${ ( wingForward * 1000 ).toFixed( 1 ) } mm`
);

check(
    'SAGITTAL_SHARE is declared authored, like every other ratio here',
    /🚩 THE SPLIT ITSELF IS AUTHORED/.test( fs.readFileSync( path.join( here, 'Gesture.js' ), 'utf8' ) ),
    `${ SAGITTAL_SHARE } — the literature says beats are sagittal; no source states a ratio`
);

// ================================================================================================
section( 'BLIND SPOT — what this process cannot see' );
// ================================================================================================

console.log( `
  This gate ran in node. There is no renderer, no figure and no observer in it, so:

    • nothing here saw an arm move. Every excursion above is a number written into a
      MotionContribution, not a pixel.
    • whether ${ fullBeatDegrees.toFixed( 1 ) }° of shoulder READS as a beat rather than as a twitch or a wave is a
      perceptual judgement, and this process cannot make it. BEAT_EXCURSION is set from an
      INTERNAL relation — a beat must be smaller than the posture it accents — which is a
      real constraint and is not the same thing as looking right. It is one constant, in one
      place, and it is the obvious thing for a blind critic to move.
    • the timing is SYNTHETIC in every utterance above. Words are spaced uniformly at 150 wpm,
      which no speaker does. The synchrony rule is gated against the plan it was given; whether
      the plan resembles speech is punch-list 4.3's question, not this file's.
    • the posture yield was driven from a hand-written armSpread, not from a live PostureLayer
      inside a bound stack. The wiring is checked; the interaction on a real figure is not.
` );

// ================================================================================================

const failed = results.filter( ( result ) => result.passed === false );

console.log( `\n${ results.length - failed.length }/${ results.length } gates passed` );

if ( failed.length > 0 ) {

    console.log( 'FAILED:' );
    for ( const result of failed ) console.log( `  - ${ result.label }` );

    process.exitCode = 1;

}

console.log( '' );
