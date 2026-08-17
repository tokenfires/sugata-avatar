/**
 * Gesture — co-speech beats, scheduled against speech by McNeill's phonological synchrony rule.
 *
 * Punch-list 6.3, and the two expressivity dials of 6.4. `docs/research/affect-and-animation.md`
 * §5 is the spec and every constant below either carries its source line or says out loud that it
 * was chosen. Read that section before changing a number here.
 *
 * ## The one rule this file exists to obey
 *
 * McNeill's phonological synchrony rule: **a gesture precedes or ends at, but does not follow, the
 * phonological peak syllable.** The phase structure is
 *
 *     preparation -> pre-stroke hold -> STROKE -> post-stroke hold -> retraction
 *
 * and *only the stroke is obligatory*. Research §5 turns that into the design rule this file is
 * gated on: **stroke onset 0 to 200 ms BEFORE stressed-syllable onset, never after; ~380 ms of
 * stroke; preparation therefore starts 400 to 600 ms before the target word.**
 *
 * 🎯 **THE CONSEQUENCE THAT IS EASY TO GET WRONG, AND IS THE WHOLE POINT OF `planGestures`.** A
 * stressed word whose preparation would have to start before the utterance began cannot be
 * gestured. The rule is one-sided, so there is no legal repair: sliding the stroke later to make
 * room is precisely the "gesture follows the peak" case the rule forbids, and research §5 measures
 * what that costs — *"recall declines sharply after 400 ms of stroke delay"*. So an unreachable
 * candidate is **DROPPED, not delayed**, and `planGestures` reports how many it dropped and why.
 * A scheduler that silently delays produces the uncanny lag and passes every rate gate while doing
 * it, which is why `dropped.tooEarly` is a reported number rather than an internal detail.
 *
 * ## Where the timing comes from, and what this file refuses to invent
 *
 * Same discipline as `Avatar.say()` and the viseme timeline, for the same reason. A gesture
 * schedule needs **word onsets and which syllables carry stress**, and that comes out of a TTS
 * engine or a forced aligner. This file takes a `SpeechPlan` and will not fabricate one.
 *
 * ⚠️ `syntheticSpeechPlan()` exists and is NOT an exception to that. It spaces words evenly at a
 * stated rate so the mechanism is reachable and gateable before punch-list 4.3 lands a real TTS,
 * and every plan it returns carries `synthetic: true`, which `GestureLayer.report()` propagates.
 * Nothing reads a synthetic plan as measured timing, because the flag travels with the data rather
 * than living in a comment.
 *
 * ## What drives the rate, and why it is arousal rather than a constant
 *
 * Research §5: cartoon narration runs 7.98 representational gestures per 100 words (~13/min),
 * social-dilemma discussion 2.84 (~4.6/min), and beats are ~50% of all gestures, so the whole band
 * is **~9 to 26 gestures per minute**. The paper's own reading of the 3x spread is that it is
 * *"task register, not personality"* — so a single hard-coded rate would be the one thing the
 * source says the number is not. `gesturesPerMinute` is therefore a knob, and its default is
 * arousal read off the affect state and mapped across the measured band. At neutral arousal that
 * is 17.5/min, the midpoint, and it moves with how activated the speaker is.
 *
 * ## How this yields to an emotional posture instead of overwriting it
 *
 * BEAT's Behavior Selection is *"per-DOF conflict resolution + a priority threshold"*, with beats
 * at the LOWEST priority so they *"survive only where nothing else claims the DOF"*. This repo
 * already has the per-DOF half: `MotionStack` masks by channel declaration and names both sides of
 * every conflict. What it does not have is the threshold, and a gesture layer without one produces
 * a specific, bad failure — `affect/PostureLayer.js` clamps the arms to vertical for anger, and a
 * cheerful beat thrown through that clamp destroys the one axis the face cannot carry.
 *
 * 🎯 So the yield keys on **adduction only**, and that is a deliberate asymmetry rather than a
 * blanket suppression. A posture holding the arms *in* (negative `armSpread`: anger, sadness) is a
 * closed body, and a broad beat out of a closed body is a contradiction. A posture holding them
 * *out* (positive: joy at +21.20°) is an open body, and beats belong there at full size. Suppress
 * both and joy stops gesturing, which is the opposite of what the affect literature says. The
 * floor is non-zero on purpose: an angry speaker still beats, tightly and close to the body.
 *
 * ## What is measured here and what is chosen
 *
 * Sourced, and gated against the source: stroke 0.38 s mean / 0.14 s SD; the 0 to 200 ms lead;
 * 400 to 600 ms preparation; the 9 to 26/min band; 1.36 Hz whole-arm and 1.44 Hz wrist rhythm;
 * `shoulderRaise` 1 = 30 deg and `elbowRaise` 1 = 90 deg, which are `upf-gti/eBMLController`'s
 * shipped units.
 *
 * 🚩 **CHOSEN, AND SAID SO: the spatial-extent amplitude range.** Research §5 and the GRETA work
 * establish *which* expressivity parameters read perceptually — Spatial Extent and Temporal Extent,
 * the other four at 43.1% discrimination, which is the finding 6.4 is built on — but no source in
 * this repository's record states the metric range a unit of Spatial Extent spans. So
 * `SPATIAL_EXTENT_RANGE` is an authored multiplier band and it is named here rather than buried,
 * exactly as `PostureLayer` names `KNEE_FULL_SCALE_DEGREES`. Temporal Extent is NOT in this
 * position: it moves stroke duration by one measured standard deviation, so its full range is
 * 0.24 s to 0.52 s and every value inside it is a duration a human being was recorded producing.
 *
 * ## What this file does not do
 *
 * No iconics, no deictics, no metaphorics. BEAT's other generators need a knowledge base and a
 * discourse parse (RHEME/THEME, NEW/OLD), and research §5 records that the modern successor to
 * that is an LLM in the loop (Torshizi et al., AAMAS 2025). `SpeechPlan` carries optional `rheme`
 * and `isNew` flags so that path stays open and so the contrast rule below has something to read,
 * but nothing here parses discourse. Beats are ~50% of all gestures and they are the half that
 * needs no semantics, which is why they are the half that ships first.
 */

import { Quaternion, Vector3 } from 'three';

import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './Breath.js';
import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Rig-space anatomical axes, the same convention `affect/PostureLayer.js` and `motion/Sway.js`
 * verified on figure_g050 and gate by measurement rather than by comment: +X is the character's
 * left-right axis, +Y is up, +Z is forward. So a SAGITTAL rotation (forward/back) is about +X and
 * a FRONTAL one (arm out to the side) is about +Z, and
 *
 *   +θ about +X carries +Y toward +Z, so a positive sagittal angle tips the top FORWARD;
 *   +θ about +Z carries −Y toward +X, so a positive frontal angle swings a hanging limb toward +X.
 */
const RIG_SAGITTAL_AXIS = new Vector3( 1, 0, 0 );
const RIG_FRONTAL_AXIS = new Vector3( 0, 0, 1 );

/**
 * 🚩 AND THE SIGN TRAP THAT COST THIS FILE A ROUND, WRITTEN OUT SO NOBODY RE-DERIVES IT WRONG.
 *
 * The convention above — "+θ about +X tips the top FORWARD" — was derived for the TRUNK, which
 * extends UPWARD from its joint. An arm hangs, so its distal end sits at −Y from the shoulder, and
 * the same +θ about +X therefore carries the hand toward **−Z, backward**. The rule is identical;
 * the limb points the other way.
 *
 * Measured on the raw bind pose: with a positive sagittal angle the right hand travelled −71.9 mm
 * in Z while the toes sit +116.8 mm of Z from the ankle. The arm was swinging BEHIND the figure.
 *
 * ⚠️ The direction gate did not catch it, because the gate compared `Math.abs( travel.z )` against
 * `Math.abs( travel.x )` — a magnitude test on a property whose whole content is a SIGN. A backward
 * swing is sagittal, so the clause passed while the arm went the wrong way. `Gesture.selftest.mjs`
 * now derives "forward" by measuring the toes off the rig and checks the signed component against
 * it, which is the same measure-don't-transcribe rule `PostureLayer` applies to the arm sides.
 */
const HANGING_LIMB_SAGITTAL_SIGN = -1;

// --- the sourced constants --------------------------------------------------------------------

/**
 * BML 1.0's sync points, which are McNeill's phase structure made schedulable. Research §5 records
 * the caveat that matters: the spec wiki last updated in 2020 and there is no 2.0, so this is a
 * design reference rather than a standard we conform to. The names are kept because they are the
 * vocabulary every realizer in the field already speaks.
 */
export const GESTURE_PHASES = Object.freeze( [
    'start', 'ready', 'strokeStart', 'stroke', 'strokeEnd', 'relax', 'end'
] );

/** Research §5: "Stroke duration: mean 0.38 s, SD 0.14 s." */
export const STROKE_SECONDS = 0.38;
export const STROKE_SD_SECONDS = 0.14;

/**
 * Research §5: "stroke onset 0–200 ms BEFORE stressed-syllable onset, never after."
 * `max` is a hard bound the gate checks in both directions; `min` of exactly zero is the
 * "ends at" half of McNeill's rule and is legal.
 */
export const STROKE_LEAD_SECONDS = Object.freeze( { min: 0, max: 0.200 } );

/** Research §5: "Preparation therefore starts 400–600 ms before the target word." */
export const PREPARATION_SECONDS = Object.freeze( { min: 0.400, max: 0.600 } );

/**
 * Research §5: representational gestures 4.6 to 13/min by register, plus beats at ~50% of all
 * gestures, giving the whole band. The spread is register, not personality — see the header.
 */
export const GESTURE_RATE_PER_MINUTE = Object.freeze( { min: 9, max: 26 } );

/**
 * Research §5: "Rhythmic co-speech arm movement: 1.36 Hz whole-arm, 1.44 Hz wrist." Used for the
 * oscillation inside a multi-beat gesture unit, not for the scheduling of separate gestures.
 */
export const BEAT_HZ = Object.freeze( { wholeArm: 1.36, wrist: 1.44 } );

/**
 * `upf-gti/eBMLController`'s shipped units, lifted verbatim in research §5: "`shoulderRaise`
 * [−1,1] where 1 = 30°; `elbowRaise` 1 = 90°."
 */
export const SHOULDER_RAISE_FULL_DEGREES = 30;
export const ELBOW_RAISE_FULL_DEGREES = 90;

/**
 * 🚩 CHOSEN, NOT SOURCED. See the header. Spatial Extent is one of the two GRETA parameters that
 * perceptually read, but no source here states what metric span one unit of it covers. This band
 * is authored: −1 gives half amplitude, +1 gives one and a half. It is a multiplier on an
 * amplitude that IS sourced, so the sourced number stays visible underneath it.
 */
export const SPATIAL_EXTENT_RANGE = Object.freeze( { min: 0.5, max: 1.5 } );

/**
 * 🚩 CHOSEN, AND THE REASON IT IS NOT SIMPLY 1.
 *
 * `SHOULDER_RAISE_FULL_DEGREES` is the full RANGE of eBMLController's `shoulderRaise` parameter,
 * not the amplitude of a beat. No source in this repository's record states a beat's excursion —
 * research §5 gives beats a rate and a rhythm and never an angle — so a number is needed here and
 * it is named rather than left implicit.
 *
 * ⚠️ **Leaving it implicit is a real defect, and it was the first version of this file.** Omitting
 * the constant does not mean "no choice was made"; it means the choice was 1.0, the LARGEST value
 * the parameter can take, made silently. That produced a 30° beat — larger than the whole measured
 * postural arm opening of joy at +21.20°, so every beat would have swamped the strongest emotion in
 * the system. An unlabelled amplitude is `PostureLayer`'s `INVENTED_KNEE_FULL_SCALE_DEGREES` in a
 * different file.
 *
 * The value is derived from the one thing that CAN be measured here, which is internal rather than
 * perceptual: a beat is an accent laid over a posture, so it must be visibly smaller than the
 * posture it accents. `affect/PostureLayer.js` measures joy's applied arm opening at +21.20° on
 * this bake. 0.35 puts a full beat at 10.5°, about half of that. The gate checks the RELATION
 * against `PostureLayer`'s own constant rather than against 10.5, so re-deriving the posture scales
 * moves this too.
 *
 * 🚩 Whether 10.5° READS as a beat is still a perceptual question and this number is the obvious
 * thing for a blind critic to move. It is one constant, in one place, for exactly that reason.
 */
export const BEAT_EXCURSION = 0.35;

/**
 * 🎯 HOW THE STROKE SPLITS BETWEEN THE TWO PLANES, AND WHY IT IS NOT ALL FRONTAL.
 *
 * The first version of this file rotated the arm about the frontal axis alone, which is pure
 * ad/abduction — the arm swings out sideways like a wing. Seen at the stroke peak on a live render
 * (2026-08-17, activation 1.000, shoulder 15.72°) that reads as a shrug rather than as a beat, and
 * the node gate was structurally blind to it because it measures the excursion's MAGNITUDE in
 * degrees and never its DIRECTION. REQ-084.
 *
 * Co-speech beats are mostly sagittal. Research §5 measures the rhythm as "co-speech ARM movement"
 * with acoustic peaks landing "just before maximum EXTENSION", and extension is a forward quantity;
 * eBMLController keeps `shoulderRaise` and a DIRECTED motion default of 0.2 m as separate controls
 * for the same reason. So the stroke is mostly forward flexion with a lateral component that keeps
 * the hand off the thigh.
 *
 * 🚩 THE SPLIT ITSELF IS AUTHORED. The literature says beats are sagittal; no source in this
 * record states a ratio. Named here, like `BEAT_EXCURSION`, so a critic can move one number.
 */
export const SAGITTAL_SHARE = 0.75;

/**
 * How much of the shoulder's excursion the elbow carries. Research §5's "mass matters" finding is
 * that whole-arm movement perturbs the voice (+3.5 Hz F0, p<0.0001) where a wrist flick does not,
 * so the whole arm moves rather than the shoulder alone. 🚩 The fraction itself is authored.
 */
export const ELBOW_FOLLOW = 0.35;

/**
 * Temporal Extent moves stroke duration by exactly one measured standard deviation either way, so
 * the full range is 0.24 s to 0.52 s and every value in it is a duration that was recorded. Signed
 * so that POSITIVE temporal extent is a FASTER stroke, which is the direction arousal pushes.
 */
export const TEMPORAL_EXTENT_SD = 1;

/**
 * Below this the layer contributes nothing and stays out of the conflict report, matching the
 * convention `PostureLayer` and `Breath` already use. 0.05 deg is well under a visible angle.
 */
const NEGLIGIBLE_RADIANS = 0.05 * DEGREES_TO_RADIANS;

/**
 * How far a posture has to adduct before it fully closes gesture down to the floor. The arms
 * clamp at roughly 10 deg of adduction on this bake — `PostureLayer` measures the budget as
 * saturating there — so that is the span the yield is normalised over.
 */
const ADDUCTION_FULL_DEGREES = 10;

/**
 * What survives a fully closed posture. Non-zero on purpose: an angry speaker gestures sharply and
 * close to the body rather than not at all, and a floor of zero would read as a frozen figure at
 * exactly the moment the affect is strongest.
 */
const CLOSED_POSTURE_FLOOR = 0.35;

// --- the speech plan --------------------------------------------------------------------------

/**
 * What the scheduler needs to know about an utterance.
 *
 * @typedef {Object} SpeechWord
 * @property {string} text
 * @property {number} startTime - Seconds from utterance start.
 * @property {number} endTime
 * @property {boolean} [stressed] - Carries a phonological peak. Absent means "unknown", and
 *   `planGestures` then falls back to content-word length rather than pretending it knows.
 * @property {boolean} [rheme] - BEAT's discourse role. Unused by the beat generator; carried so
 *   the iconic and contrast generators have somewhere to read from when they land.
 * @property {boolean} [isNew]
 * @property {string|number} [contrastGroup] - Words sharing a value are contrasted. BEAT: exactly
 *   two contrasted objects get the two-handed gesture.
 *
 * @typedef {Object} SpeechPlan
 * @property {SpeechWord[]} words
 * @property {number} durationSeconds
 * @property {boolean} [synthetic] - True when the timings were generated rather than measured.
 */

/**
 * A word count long enough to carry stress in English. Below this a word is overwhelmingly likely
 * to be a function word, and function words do not take the phonological peak.
 *
 * ⚠️ This is the FALLBACK path and it is a heuristic, not a stress model. It exists so the layer
 * is exercisable on a plan that lacks stress marks; a plan that carries `stressed` never reaches
 * it. `planGestures` reports which path it took in `stressSource`.
 */
const CONTENT_WORD_MIN_LENGTH = 4;

/** Function words that clear the length test but never carry a peak. */
const FUNCTION_WORDS = Object.freeze( new Set( [
    'that', 'this', 'with', 'from', 'they', 'them', 'then', 'than', 'were', 'have', 'been',
    'will', 'would', 'could', 'should', 'their', 'there', 'these', 'those', 'about', 'into',
    'when', 'what', 'which', 'while', 'your', 'ours', 'because', 'and', 'but', 'for', 'the'
] ) );

/**
 * Words per minute for a generated plan. 150 wpm is ordinary conversational English and it is
 * stated here rather than passed in so that a synthetic plan is reproducible from its text alone.
 */
const SYNTHETIC_WORDS_PER_MINUTE = 150;

/**
 * Builds an evenly spaced plan from plain text, flagged `synthetic: true`.
 *
 * 🚩 THE TIMINGS ARE NOT REAL. Words are spaced uniformly, which no speaker does. This exists so
 * the scheduler and the layer are reachable and gateable before punch-list 4.3 lands a TTS that
 * emits word timings, and so that `Avatar.say()` has something to drive the arms with while the
 * mouth is already running a synthetic viseme timeline. The flag rides on the returned object and
 * `GestureLayer.report()` republishes it, so a caller that never reads this docstring still cannot
 * mistake the output for measurement.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {number} [options.wordsPerMinute=150]
 * @returns {SpeechPlan}
 */
export function syntheticSpeechPlan( text, options = {} ) {

    const wordsPerMinute = options.wordsPerMinute ?? SYNTHETIC_WORDS_PER_MINUTE;
    const secondsPerWord = 60 / wordsPerMinute;

    const tokens = String( text ).trim().split( /\s+/ ).filter( ( token ) => token.length > 0 );

    const words = tokens.map( ( token, index ) => ( {
        text: token,
        startTime: index * secondsPerWord,
        endTime: ( index + 1 ) * secondsPerWord
    } ) );

    return {
        words,
        durationSeconds: tokens.length * secondsPerWord,
        synthetic: true
    };

}

/** Strips punctuation so the content-word test sees the word rather than its comma. */
function bareWord( text ) {

    return String( text ).toLowerCase().replace( /[^a-z']/g, '' );

}

/** The fallback stress test. See CONTENT_WORD_MIN_LENGTH for why this is a fallback. */
function looksStressed( word ) {

    const bare = bareWord( word.text );
    return bare.length >= CONTENT_WORD_MIN_LENGTH && ! FUNCTION_WORDS.has( bare );

}

// --- the scheduler ----------------------------------------------------------------------------

/**
 * Turns a speech plan into a gesture schedule that obeys the synchrony rule by construction.
 *
 * The algorithm, in the order it runs, because each step exists to refuse a specific mistake:
 *
 *   1. **Find candidates.** Words marked `stressed`, or the content-word fallback. Reported as
 *      `stressSource` so a reader knows which one produced the schedule.
 *   2. **Place each candidate backwards from its peak.** `strokeStart = peak − lead` with the lead
 *      drawn inside [0, 200 ms]; preparation starts a further 400 to 600 ms earlier. Placing
 *      backwards from the peak rather than forwards from the word is what makes the rule
 *      structural instead of something a later clamp has to enforce.
 *   3. **Drop what cannot fit.** `preparationStart < 0` means the gesture would have had to begin
 *      before the utterance. Dropped, never slid later. See the header.
 *   4. **Drop what the rate budget cannot afford.** A refractory interval of `60 / rate` seconds
 *      since the last accepted stroke.
 *
 * The draws come from a supplied RNG so a schedule is reproducible; pass the layer's own stream
 * and two runs of the same utterance gesture identically.
 *
 * @param {SpeechPlan} plan
 * @param {Object} [options]
 * @param {number} [options.gesturesPerMinute] - Defaults to the arousal mapping; see
 *   `rateForArousal`.
 * @param {number} [options.arousal=0] - [−1,1]. Ignored when `gesturesPerMinute` is given.
 * @param {number} [options.temporalExtent=0] - [−1,1]. Positive is faster; one unit is one SD.
 * @param {() => number} [options.random=Math.random]
 * @returns {{gestures: Array, dropped: Object, ratePerMinute: number, stressSource: string,
 *   synthetic: boolean, candidateCount: number}}
 */
export function planGestures( plan, options = {} ) {

    if ( plan === null || typeof plan !== 'object' || ! Array.isArray( plan.words ) ) {

        throw new TypeError( 'planGestures needs a SpeechPlan with a `words` array. See syntheticSpeechPlan().' );

    }

    const random = options.random ?? Math.random;
    const arousal = clampUnit( options.arousal ?? 0 );
    const ratePerMinute = clampRate( options.gesturesPerMinute ?? rateForArousal( arousal ) );
    const temporalExtent = clampUnit( options.temporalExtent ?? 0 );

    const strokeSeconds = strokeDurationFor( temporalExtent );
    const refractorySeconds = 60 / ratePerMinute;

    const marked = plan.words.some( ( word ) => word.stressed === true );
    const stressSource = marked ? 'plan' : 'content-word-fallback';

    const candidates = plan.words.filter( ( word ) => marked ? word.stressed === true : looksStressed( word ) );

    const gestures = [];
    const dropped = { tooEarly: 0, refractory: 0 };

    let lastStrokeStart = -Infinity;
    let handIndex = 0;

    for ( const word of candidates ) {

        const peakTime = word.startTime;

        const lead = STROKE_LEAD_SECONDS.min
            + random() * ( STROKE_LEAD_SECONDS.max - STROKE_LEAD_SECONDS.min );

        const preparation = PREPARATION_SECONDS.min
            + random() * ( PREPARATION_SECONDS.max - PREPARATION_SECONDS.min );

        const strokeStart = peakTime - lead;
        const preparationStart = strokeStart - preparation;

        // Step 3. The rule is one-sided, so there is no legal repair. Drop it.
        if ( preparationStart < 0 ) { dropped.tooEarly += 1; continue; }

        // Step 4. Rate budget.
        if ( strokeStart - lastStrokeStart < refractorySeconds ) { dropped.refractory += 1; continue; }

        const twoHanded = countContrastGroup( plan.words, word.contrastGroup ) === 2;

        gestures.push( {
            word: word.text,
            peakTime,
            preparationStart,
            strokeStart,
            strokeEnd: strokeStart + strokeSeconds,
            // Relaxation runs for as long as preparation took; BML's `relax` to `end` has no
            // separate measurement in the record, and reusing the preparation duration keeps the
            // envelope symmetric rather than inventing a second number.
            endTime: strokeStart + strokeSeconds + preparation,
            leadSeconds: lead,
            preparationSeconds: preparation,
            strokeSeconds,
            hand: twoHanded ? 'both' : ( handIndex ++ % 2 === 0 ? 'right' : 'left' ),
            twoHanded
        } );

        lastStrokeStart = strokeStart;

    }

    return {
        gestures,
        dropped,
        ratePerMinute,
        stressSource,
        synthetic: plan.synthetic === true,
        candidateCount: candidates.length
    };

}

/** How many words share a contrast group. BEAT: exactly two get the two-handed gesture. */
function countContrastGroup( words, group ) {

    if ( group === undefined || group === null ) return 0;
    return words.filter( ( word ) => word.contrastGroup === group ).length;

}

/**
 * Maps arousal across the measured rate band. Neutral arousal lands on the midpoint, 17.5/min.
 * See the header for why this is a mapping rather than a constant.
 */
export function rateForArousal( arousal ) {

    const unit = ( clampUnit( arousal ) + 1 ) / 2;
    return GESTURE_RATE_PER_MINUTE.min
        + unit * ( GESTURE_RATE_PER_MINUTE.max - GESTURE_RATE_PER_MINUTE.min );

}

/**
 * Temporal Extent to stroke duration, one unit per measured standard deviation, positive meaning
 * faster. The result is clamped into [mean − SD, mean + SD] so no setting can produce a stroke
 * duration outside the range the source recorded.
 */
export function strokeDurationFor( temporalExtent ) {

    const shifted = STROKE_SECONDS - clampUnit( temporalExtent ) * TEMPORAL_EXTENT_SD * STROKE_SD_SECONDS;
    return Math.min( STROKE_SECONDS + STROKE_SD_SECONDS, Math.max( STROKE_SECONDS - STROKE_SD_SECONDS, shifted ) );

}

/** Spatial Extent to an amplitude multiplier. 🚩 The band is authored; see SPATIAL_EXTENT_RANGE. */
export function amplitudeFor( spatialExtent ) {

    const unit = ( clampUnit( spatialExtent ) + 1 ) / 2;
    return SPATIAL_EXTENT_RANGE.min + unit * ( SPATIAL_EXTENT_RANGE.max - SPATIAL_EXTENT_RANGE.min );

}

/**
 * How much of a gesture survives the current posture. Keys on ADDUCTION only — see the header for
 * why suppressing on abduction too would stop joy from gesturing.
 *
 * @param {number} armSpreadDegrees - Signed. Negative is adducted, arms drawn in.
 * @returns {number} [CLOSED_POSTURE_FLOOR, 1]
 */
export function postureYield( armSpreadDegrees ) {

    if ( ! Number.isFinite( armSpreadDegrees ) || armSpreadDegrees >= 0 ) return 1;

    const closed = Math.min( 1, Math.abs( armSpreadDegrees ) / ADDUCTION_FULL_DEGREES );
    return 1 - closed * ( 1 - CLOSED_POSTURE_FLOOR );

}

// --- the envelope -----------------------------------------------------------------------------

/** Smoothstep. Used for preparation and retraction, which are approach movements, not impulses. */
function smoothstep( t ) {

    const clamped = Math.min( 1, Math.max( 0, t ) );
    return clamped * clamped * ( 3 - 2 * clamped );

}

/**
 * A gesture's activation at a given time, in [0, 1], following BML's sync points.
 *
 * preparation ramps in on a smoothstep; the stroke is the held excursion with a fast attack; the
 * retraction ramps out. The stroke is deliberately NOT a smooth hump — a beat's defining property
 * is that it has an abrupt excursion at the peak, and a symmetric bell reads as a wave.
 *
 * @returns {{activation: number, phase: string}}
 */
export function gestureEnvelope( gesture, time ) {

    if ( time < gesture.preparationStart || time >= gesture.endTime ) {

        return { activation: 0, phase: time < gesture.preparationStart ? 'start' : 'end' };

    }

    if ( time < gesture.strokeStart ) {

        const t = ( time - gesture.preparationStart ) / ( gesture.strokeStart - gesture.preparationStart );

        // Preparation carries the arm to the ready pose at 40% of full excursion, which is what
        // makes the stroke itself read as an accent rather than as the whole movement.
        return { activation: 0.4 * smoothstep( t ), phase: 'ready' };

    }

    if ( time < gesture.strokeEnd ) {

        const t = ( time - gesture.strokeStart ) / gesture.strokeSeconds;

        // Fast attack over the first fifth, then hold. The attack is where the accent lives.
        const attack = Math.min( 1, t / 0.2 );
        return { activation: 0.4 + 0.6 * smoothstep( attack ), phase: t < 0.2 ? 'strokeStart' : 'stroke' };

    }

    const t = ( time - gesture.strokeEnd ) / ( gesture.endTime - gesture.strokeEnd );
    return { activation: 1 - smoothstep( t ), phase: 'relax' };

}

// --- the layer --------------------------------------------------------------------------------

const GESTURE_BONES = Object.freeze( {
    leftUpperArm: HUMANOID_TO_FIGURE_BONE.leftUpperArm,
    rightUpperArm: HUMANOID_TO_FIGURE_BONE.rightUpperArm,
    leftLowerArm: HUMANOID_TO_FIGURE_BONE.leftLowerArm,
    rightLowerArm: HUMANOID_TO_FIGURE_BONE.rightLowerArm
} );

/**
 * The runtime half. Holds a schedule, advances a clock, writes shoulder and elbow deltas.
 *
 * ⚠️ It declares the four arm bones permanently and claims them only while a gesture is live,
 * which is the same convention `Blink` uses on the eyelids and the reason a silent gesture layer
 * does not appear in the conflict report. `BodyIdle` also declares these bones; that overlap is a
 * DECLARED conflict the stack names, and it is correct — idle sway and a beat genuinely both want
 * the arm, and the stack composing them is the mechanism that makes that work.
 */
export class GestureLayer extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.spatialExtent=0] - [−1,1]. 🚩 Authored band; see the constant.
     * @param {number} [options.temporalExtent=0] - [−1,1]. Positive is faster. One measured SD.
     * @param {number} [options.amplitude=1] - Global scale, for the page's slider.
     * @param {Object} [options.bones] - Override the four arm bone names.
     * @param {boolean} [options.yieldToPosture=true] - 🚩 Gate fodder. Off is the defect where a
     *   beat overrides an angry body's clamped arms.
     * @param {boolean} [options.dominanceDrivesAmplitude=true] - Read dominance off the live
     *   affect state each frame. 🚩 Off is the snapshot defect; see `effectiveSpatialExtent`.
     * @param {number} [options.sagittalShare=SAGITTAL_SHARE] - 🚩 Gate fodder. 0 is REQ-084's
     *   all-lateral wing.
     */
    constructor( options = {} ) {

        const bones = { ...GESTURE_BONES, ...( options.bones ?? {} ) };

        super( {
            name: options.name ?? 'gesture',
            order: MOTION_ORDER.GESTURE,
            boneChannels: Object.values( bones ),
            enabled: options.enabled ?? true,
            weight: options.weight ?? 1
        } );

        this.bones = bones;
        this.amplitude = options.amplitude ?? 1;
        this.spatialExtent = clampUnit( options.spatialExtent ?? 0 );
        this.temporalExtent = clampUnit( options.temporalExtent ?? 0 );
        this.yieldToPosture = options.yieldToPosture !== false;

        // 🚩 Gate fodder. 0 is REQ-084's defect exactly — an all-frontal stroke, the arm out
        // sideways like a wing. Kept reachable so the direction gate has something to go red on.
        this.sagittalShare = Number.isFinite( options.sagittalShare ) ? options.sagittalShare : SAGITTAL_SHARE;

        // 🚩 Gate fodder. False is the defect where amplitude is frozen at schedule time and
        // every sentence gestures at the amplitude of the sentence before it.
        this.dominanceDrivesAmplitude = options.dominanceDrivesAmplitude !== false;

        this.schedule = null;
        this.utteranceTime = 0;
        this.speaking = false;

        // Last frame's numbers, for the HUD and for the gates.
        this.applied = { activation: 0, phase: 'end', hand: null, yield: 1, spatialExtent: 0,
            shoulderDegrees: 0, elbowDegrees: 0 };

        this.scratchQuaternion = new Quaternion();
        this.scratchSagittal = new Quaternion();
        this.scratchFrontal = new Quaternion();
        this.scratchShoulder = new Vector3();
        this.scratchElbow = new Vector3();
        this.scratchSpine = new Vector3();

        // 🚩 MEASURED AT BIND, NOT TRANSCRIBED. Which way is "away from the midline" for each arm
        // depends on how the rig was authored, and a mirrored rig flips it. The first version of
        // this file hard-coded `left: +1, right: −1`, which is the exact mistake
        // `affect/PostureLayer.js` refuses — research §3 records three sign problems in the
        // published Coulson data and that file solves them by measuring the rig instead. Same
        // measurement here, and the same reason: a comment cannot fail, a bind can.
        this.armSides = { left: 1, right: -1 };
        this.armSidesMeasured = false;

        // 🚩 EACH BONE'S REST ORIENTATION RELATIVE TO THE RIG, CACHED AT BIND.
        //
        // `MotionContribution.rotateBone` states a delta in the BONE'S LOCAL SPACE, and an arm bone
        // points down and outward — its local axes are nowhere near the rig's. Handing a rig-space
        // axis straight to `rotateBoneEuler` therefore does not rotate the arm in the plane the axis
        // names, which is how the first attempt at REQ-084 produced a stroke that went forward even
        // with the sagittal share set to zero: the "frontal" rotation was not frontal.
        //
        // `Breath.toBoneDeltaFrame` is the conversion and `PostureLayer` already runs every one of
        // its channels through it. Same here.
        this.restFrames = new Map();
        this.scratchRigRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();

    }

    /**
     * Measures which way each arm abducts, off the bound figure.
     *
     * Idempotent, because `Layer.onBind`'s contract says it runs again on rebind and on
     * `MotionStack.reset()`. It reads only rest geometry — the shoulder's offset from the spine —
     * so unlike `PostureLayer`'s adduction budget there is nothing of this layer's own to subtract.
     */
    onBind( context ) {

        const target = context?.target ?? context?.stack?.target ?? null;
        if ( target === null || typeof target.getBone !== 'function' ) return;

        const spine = target.getBone( HUMANOID_TO_FIGURE_BONE.spine );
        if ( spine === null || spine === undefined ) return;

        spine.updateWorldMatrix( true, false );
        this.scratchSpine.setFromMatrixPosition( spine.matrixWorld );

        let measured = 0;

        for ( const side of [ 'left', 'right' ] ) {

            const shoulder = target.getBone( this.bones[ `${ side }UpperArm` ] );
            if ( shoulder === null || shoulder === undefined ) continue;

            shoulder.updateWorldMatrix( true, false );
            this.scratchShoulder.setFromMatrixPosition( shoulder.matrixWorld );

            // +θ about +Z swings a hanging limb toward +X, so the arm on the +X side of the spine
            // abducts on a POSITIVE frontal angle and the other one on a negative.
            this.armSides[ side ] = Math.sign( this.scratchShoulder.x - this.scratchSpine.x ) || this.armSides[ side ];
            measured += 1;

        }

        // Every driven bone's rest orientation in rig space, so `update()` can convert.
        this.restFrames.clear();

        for ( const boneName of Object.values( this.bones ) ) {

            const bone = target.getBone( boneName );
            if ( bone !== null && bone !== undefined ) this.restFrames.set( boneName, restRotationRelativeToRig( bone ) );

        }

        this.armSidesMeasured = measured === 2;

    }

    /**
     * Loads a schedule and starts the utterance clock.
     *
     * @param {SpeechPlan} plan
     * @param {Object} [options] - Forwarded to `planGestures`; `random` and `temporalExtent`
     *   default to this layer's own stream and dial.
     */
    speak( plan, options = {} ) {

        this.schedule = planGestures( plan, {
            temporalExtent: this.temporalExtent,
            random: this.random === null ? Math.random : () => this.random.next(),
            ...options
        } );

        this.utteranceTime = 0;
        this.speaking = true;

        return this.schedule;

    }

    /** Stops immediately. The envelope is dropped rather than retracted; callers wanting a graceful
     *  release should let the schedule run out. */
    stop() {

        this.schedule = null;
        this.speaking = false;
        this.applied.activation = 0;
        this.applied.phase = 'end';
        this.applied.hand = null;

    }

    reset() {

        this.stop();
        this.utteranceTime = 0;

    }

    update( deltaSeconds, context ) {

        if ( ! this.speaking || this.schedule === null ) return null;

        this.utteranceTime += deltaSeconds;

        const active = this.activeGesture( this.utteranceTime );

        if ( active === null ) {

            // The utterance is over once the clock passes the last gesture's end.
            const last = this.schedule.gestures[ this.schedule.gestures.length - 1 ];
            if ( last === undefined || this.utteranceTime >= last.endTime ) this.speaking = false;

            this.applied.activation = 0;
            this.applied.phase = 'end';
            this.applied.hand = null;
            return null;

        }

        const { activation, phase } = gestureEnvelope( active, this.utteranceTime );

        const yielded = this.yieldToPosture ? postureYield( armSpreadOf( context ) ) : 1;

        // 🎯 AMPLITUDE IS READ EVERY FRAME, NOT SNAPSHOTTED WHEN THE SCHEDULE WAS BUILT, AND THE
        // REASON IS MEASURED RATHER THAN STYLISTIC.
        //
        // `AffectState.push()` sets a TARGET; `pad` integrates toward it over subsequent frames.
        // So a host doing the obvious thing —
        //
        //     avatar.feel( 'angry', 0.9 ); avatar.say( 'I told you already.' );
        //
        // — has an affect state that still holds the PREVIOUS emotion at the instant `say()` runs.
        // Measured in a live browser on 2026-08-17: `feel({ dominance: +0.9 })` followed immediately
        // by a read gave `pad.dominance` of −0.892, the value left over from the utterance before.
        // A snapshot here would have gestured every sentence at the amplitude of the sentence
        // before it, and the node gate could not have seen it, because the gate sets the extent
        // directly and never goes through `feel()`.
        //
        // Reading live also makes this consistent with the two-tier affect design rather than
        // merely correct: the LLM pass lands about a second after the lexicon pass and blends in,
        // and a frozen amplitude would ignore that correction for the rest of the utterance. The
        // arms now settle with the face instead of holding the first guess.
        //
        // 🚩 RATE IS DIFFERENT AND IS DELIBERATELY STILL A SNAPSHOT. A schedule is built once, so
        // its refractory has to be chosen once; `Avatar.say()` therefore reads the affect TARGET
        // for rate, which is immediate, and lets amplitude track the integrated value.
        const extent = this.effectiveSpatialExtent( context );
        const scale = activation * yielded * this.amplitude * amplitudeFor( extent );

        // 🚩 BEAT_EXCURSION is what keeps this an accent rather than a whole-body movement. See
        // the constant for why omitting it is a defect rather than a simplification.
        const shoulderRadians = scale * BEAT_EXCURSION * SHOULDER_RAISE_FULL_DEGREES * DEGREES_TO_RADIANS;

        // A beat that moves the shoulder and holds the elbow rigid reads as a mannequin.
        const elbowRadians = scale * BEAT_EXCURSION * ELBOW_FOLLOW * ELBOW_RAISE_FULL_DEGREES * DEGREES_TO_RADIANS;

        this.applied.activation = activation;
        this.applied.phase = phase;
        this.applied.hand = active.hand;
        this.applied.yield = yielded;
        this.applied.spatialExtent = extent;
        this.applied.shoulderDegrees = shoulderRadians / DEGREES_TO_RADIANS;
        this.applied.elbowDegrees = elbowRadians / DEGREES_TO_RADIANS;

        if ( Math.abs( shoulderRadians ) < NEGLIGIBLE_RADIANS ) return null;

        const sides = active.hand === 'both' ? [ 'left', 'right' ] : [ active.hand ];

        // The stroke is mostly forward, with enough lateral to keep the hand off the thigh. See
        // SAGITTAL_SHARE for why, and REQ-084 for what it looked like when it was all lateral.
        const sagittalRadians = shoulderRadians * this.sagittalShare;
        const frontalRadians = shoulderRadians * ( 1 - this.sagittalShare );

        for ( const side of sides ) {

            // Measured at bind. Only the FRONTAL half is mirrored — both arms swing forward
            // together, and mirroring the sagittal half would send one hand behind the figure.
            const mirror = this.armSides[ side ];

            this.scratchSagittal.setFromAxisAngle(
                RIG_SAGITTAL_AXIS, HANGING_LIMB_SAGITTAL_SIGN * sagittalRadians );
            this.scratchFrontal.setFromAxisAngle( RIG_FRONTAL_AXIS, mirror * frontalRadians );

            // Composed rather than written as one euler: two axis-angle rotations do not commute,
            // and an euler triple hides which order was meant.
            this.scratchRigRotation.copy( this.scratchSagittal ).multiply( this.scratchFrontal );
            this.writeRigRotation( this.bones[ `${ side }UpperArm` ], this.scratchRigRotation );

            // Elbow: flexion only, and flexion is sagittal on both arms, so no mirror.
            this.scratchRigRotation.setFromAxisAngle(
                RIG_SAGITTAL_AXIS, HANGING_LIMB_SAGITTAL_SIGN * elbowRadians );
            this.writeRigRotation( this.bones[ `${ side }LowerArm` ], this.scratchRigRotation );

        }

        return this.contribution;

    }

    /**
     * Spatial Extent for this frame: dominance off the live affect state when one is published,
     * the authored knob otherwise.
     *
     * 🎯 THIS IS A CONTRACT THIS FILE INHERITED. `AffectState.faceInput()` carries Arellano et al.
     * (AMDO 2014), n=109 — pleasure reads off a static face, arousal mostly, *"dominance not at
     * all"* — and states the consequence structurally: *"dominance must be carried by posture, gaze
     * policy, interruption behaviour and GESTURE AMPLITUDE, never by the face."* `bodyInput()` then
     * names the consumer in one line: *"All three axes, for posture, gaze policy and gesture
     * amplitude. Phase 6 consumes this."* This method is Phase 6 consuming it.
     *
     * Dominance therefore reaches the body TWICE, through two mechanisms, and that is the design
     * rather than a duplication: `PostureLayer` puts it in the trunk as a static lean (anger +17.99°
     * forward, fear −3.53° back) and this puts it in the SIZE of every movement. A still frame
     * carries the first; a moving figure carries both. They can also disagree — a dominant speaker
     * whose posture is adducted gestures large-but-suppressed — which is a state neither channel
     * can express alone.
     *
     * @param {Object} context
     * @returns {number} [−1, 1]
     */
    effectiveSpatialExtent( context ) {

        if ( this.dominanceDrivesAmplitude === false ) return this.spatialExtent;

        const dominance = context?.shared?.affect?.pad?.dominance;

        return Number.isFinite( dominance ) ? clampUnit( dominance ) : this.spatialExtent;

    }

    /**
     * States a RIG-SPACE rotation on a bone, converting it into that bone's local delta frame.
     *
     * Without the conversion an arm bone receives the rotation in its own tilted local axes and
     * moves in a plane nobody asked for; see `restFrames`. A bone with no cached rest frame — one
     * the figure does not have — is skipped rather than written in the wrong space.
     */
    writeRigRotation( boneName, rigRotation ) {

        const restFrame = this.restFrames.get( boneName );
        if ( restFrame === undefined ) return;

        toBoneDeltaFrame( rigRotation, restFrame, this.scratchBoneDelta );
        this.contribution.rotateBone( boneName, this.scratchBoneDelta );

    }

    /** The gesture covering `time`, or null. Gestures never overlap: the refractory guarantees it. */
    activeGesture( time ) {

        if ( this.schedule === null ) return null;

        for ( const gesture of this.schedule.gestures ) {

            if ( time >= gesture.preparationStart && time < gesture.endTime ) return gesture;

        }

        return null;

    }

    /** One line for the HUD. */
    describe() {

        if ( this.schedule === null ) return 'gesture   ·   silent';

        const { activation, phase, hand, yield: yielded } = this.applied;

        return `gesture   ·   ${ this.schedule.gestures.length } scheduled` +
            `${ this.schedule.synthetic ? ' (synthetic timing)' : '' }` +
            `   ·   ${ phase } ${ ( activation * 100 ).toFixed( 0 ) }%` +
            `${ hand === null ? '' : ` ${ hand }` }` +
            `${ yielded < 1 ? `   ·   posture yield ${ yielded.toFixed( 2 ) }` : '' }`;

    }

    report() {

        return {
            speaking: this.speaking,
            utteranceTime: this.utteranceTime,
            spatialExtent: this.spatialExtent,
            dominanceDrivesAmplitude: this.dominanceDrivesAmplitude,
            appliedSpatialExtent: this.applied.spatialExtent,
            temporalExtent: this.temporalExtent,
            strokeSeconds: strokeDurationFor( this.temporalExtent ),
            yieldToPosture: this.yieldToPosture,
            sagittalShare: this.sagittalShare,
            armSidesMeasured: this.armSidesMeasured,
            armSides: { ...this.armSides },
            applied: { ...this.applied },
            schedule: this.schedule === null ? null : {
                count: this.schedule.gestures.length,
                ratePerMinute: this.schedule.ratePerMinute,
                stressSource: this.schedule.stressSource,
                dropped: { ...this.schedule.dropped },
                candidateCount: this.schedule.candidateCount,

                // 🚩 Rides on the data rather than living in a docstring. See syntheticSpeechPlan.
                syntheticTiming: this.schedule.synthetic
            }
        };

    }

}

// --- shared helpers ---------------------------------------------------------------------------

/**
 * The posture's current arm claim, read out of the shared bag. Returns 0 — "no claim" — when no
 * posture layer is published, which is the correct reading for a stack that has none.
 */
function armSpreadOf( context ) {

    const posture = context?.shared?.posture;
    if ( posture === undefined || posture === null ) return 0;

    const degrees = posture.appliedDegrees;
    if ( degrees === undefined || degrees === null ) return 0;

    // Both arms are clamped symmetrically; the left is representative and the gate checks that.
    return degrees.armSpreadLeft ?? degrees.armSpread ?? 0;

}

function clampUnit( value ) {

    if ( ! Number.isFinite( value ) ) return 0;
    return Math.min( 1, Math.max( -1, value ) );

}

function clampRate( value ) {

    if ( ! Number.isFinite( value ) ) return rateForArousal( 0 );
    return Math.min( GESTURE_RATE_PER_MINUTE.max, Math.max( GESTURE_RATE_PER_MINUTE.min, value ) );

}
