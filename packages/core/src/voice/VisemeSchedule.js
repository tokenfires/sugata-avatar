/**
 * VisemeSchedule — a viseme timeline sampled against the audio clock, EARLY, on purpose.
 *
 * Punch-list 4.1 asks for "a viseme timeline `{viseme, startTime, duration}[]` scheduled against
 * `AudioContext.currentTime`", and 4.4 is not a later item but a constraint on this one:
 * **schedule the visemes AHEAD of the audio.**
 *
 *
 * 1. WHY EARLY, AND HOW EARLY
 * ---------------------------
 * research/affect-and-animation.md §3, from ITU-R BT.1359-1: detectability is **+45 ms audio lead
 * against −125 ms audio lag**. Restated in the direction this file cares about — how far the MOUTH
 * may be from the sound before a viewer notices:
 *
 *     mouth LATE  by more than  45 ms  -> detectable
 *     mouth EARLY by more than 125 ms  -> detectable
 *
 * "Humans tolerate audio lagging the mouth ~3x more than audio leading it. Real-world sound always
 * arrives after sight, so the perceptual system has a visual-first prior. **Always err toward
 * animating early.**"
 *
 * 🎯 So the undetectable window is not centred on zero. It runs from 45 ms late to 125 ms early,
 * and the point furthest from BOTH edges is **40 ms early**: `(125 − 45) / 2 = 40`. That is where
 * `DEFAULT_LEAD_SECONDS` comes from. It is derived from the two published thresholds rather than
 * dialled in, and it buys **85 ms of margin in each direction** for everything downstream that can
 * shift the delivered timing — frame quantisation, presentation latency, an audio graph's own
 * output latency, a dropped frame.
 *
 * ⚠️ Zero lead is NOT the neutral choice. Zero sits 45 ms from the near edge and 125 ms from the
 * far one, so it throws away two thirds of the available margin in the direction that is three
 * times cheaper to spend. Building the lead in now is also the only sane time: the research doc's
 * §8 note is that "a reactive architecture that analyses output audio is fighting all four"
 * timing constraints, and retrofitting a lead into a reactive design is not a parameter change.
 *
 *
 * 2. WHY THERE IS NO PER-FRAME STATE IN THE SHIPPED PATH
 * -----------------------------------------------------
 * 🚩 Four layers in `motion/` have shipped a frame-rate-coupled trajectory in this project and all
 * four passed every gate they had (LEARNINGS §1.13, §1.13a). The mechanisms were different every
 * time: a random draw per frame; a countdown that discarded its overshoot; a smoother using a
 * rational approximation of `exp(−x)`; a feedback target sampled wherever the frame boundary
 * happened to fall.
 *
 * The structural answer is to have no trajectory state at all. `sampleAt(audioTime)` is a pure
 * function of the timeline and one absolute instant: no accumulator, no cursor, no smoothing, no
 * memory of the previous frame. Two frame rates cannot disagree about the value of a pure function
 * at the same instant. The invariance is then a property of the SHAPE of the code rather than a
 * property anyone has to maintain, and the gate exists to prove it has not been reintroduced.
 *
 * `update(deltaSeconds, audioTime)` exists for callers with a frame loop, and **it ignores
 * `deltaSeconds` entirely** unless a defect is switched on. That is not an oversight; it is the
 * point, and the parameter is kept so the defect rebuilds have somewhere to read `dt` from.
 *
 * 🚩 THE DEFECT OPTIONS ARE GATE FODDER, NOT FEATURES. `visemes.selftest.mjs` reintroduces three
 * structurally different frame-rate couplings through them and requires the invariance gate to
 * reject all three. A gate that has only ever seen one defect is a gate that has been fitted to it.
 *
 *
 * 3. THE MOUTH BELONGS TO LIPSYNC
 * -------------------------------
 * This class emits OVR viseme weights and nothing else — there is no path through it to
 * `mouthSmileLeft`, `jawOpen` or any ARKit shape. Phase 5's emotion layer reaches the mouth the one
 * sanctioned way, `ExpressionBank.addMouthCornerOffset`, which ADDS an AU12/AU15 corner offset over
 * whatever the viseme put there. `VisemeLayer.js` carries the composition argument.
 */

import { envelopeKeys, envelopeWindow, weightAt } from './Coarticulation.js';
import { OVR_VISEMES, STRONG_VISEME_PEAK, normaliseTimeline, peakFor, timelineDuration } from './Visemes.js';

/** ITU-R BT.1359-1 detectability, in the "how far may the mouth be from the sound" direction. */
export const MOUTH_LATE_DETECTABLE_SECONDS = 0.045;
export const MOUTH_EARLY_DETECTABLE_SECONDS = 0.125;

/**
 * The midpoint of the undetectable window, which is the maximum-margin place to sit. Derived, not
 * chosen: `(0.125 − 0.045) / 2`. See the header.
 */
export const DEFAULT_LEAD_SECONDS =
    ( MOUTH_EARLY_DETECTABLE_SECONDS - MOUTH_LATE_DETECTABLE_SECONDS ) / 2;

/**
 * Ceiling on the sum of all viseme weights in one frame.
 *
 * Overlapping envelopes are the entire point of coarticulation, but two shapes at high weight
 * deform the same vertices twice — research §1's "linear blending of overlapping blendshapes
 * produces double-transform / off-model artifacts". When the sum crosses this the whole set is
 * scaled down PROPORTIONALLY, which preserves the ratio between the outgoing and incoming shape
 * (that ratio is what reads as the mouth travelling) while keeping the total deformation on-model.
 *
 * Set at 1.0 so a single shape at its authored peak — 0.9 for PP/FF, 0.6 otherwise — is never
 * touched. Only genuine overlap can engage it. The self-test reports how often it does.
 *
 * 🎯 THE STRONG SHAPES ARE PAID FIRST. `Visemes.js` gives PP and FF a peak of 0.9 against 0.6 for
 * a reason: a bilabial closure and a labiodental have to LAND or the consonant is not visible.
 * A proportional scale-down that took the same fraction from everyone would spend the 0.9 on
 * whichever vowel happened to overlap — measured at 0.2 of the 0.9, which is most of the reason
 * the number is 0.9 in the first place. So PP and FF keep their weight and the remaining budget is
 * shared out among the rest; only if the strong shapes ALONE exceed the cap (which needs two
 * bilabials overlapping, i.e. a timeline that has already gone wrong) does the scale-down reach
 * them.
 */
export const MAX_TOTAL_VISEME_WEIGHT = 1.0;

/**
 * The shapes exempt from the proportional scale-down, resolved once from the peak table rather
 * than restated, so the two facts cannot drift apart.
 */
const STRONG_SHAPES = new Set( OVR_VISEMES.filter( ( name ) => peakFor( name ) === STRONG_VISEME_PEAK ) );

/** Per-frame smoothing coefficient used ONLY by the `frameRateDependentSmoothing` defect. */
const DEFECT_SMOOTHING_PER_FRAME = 0.35;

/** Anticipation, in frames, used ONLY by the `anticipationInFrames` defects. */
const DEFECT_ANTICIPATION_FRAMES = 2;

/** The frame rate the `anticipationAssumes60Hz` defect wrongly believes it is running at. */
const DEFECT_ASSUMED_RATE_HZ = 60;

export class VisemeSchedule {

    /**
     * @param {Object} [options]
     * @param {number} [options.leadSeconds=DEFAULT_LEAD_SECONDS] - How far ahead of the audio the
     *   mouth runs. Clamped into `(0, MOUTH_EARLY_DETECTABLE_SECONDS)` with a warning, because a
     *   negative lead is the one setting the research says is three times worse than its mirror.
     * @param {Function} [options.clock] - Returns the current audio-clock time in seconds. In the
     *   browser this is `() => audioContext.currentTime`. Injected rather than reached for so the
     *   self-test can drive simulated instants, and so a page with a suspended AudioContext can
     *   fall back to `performance.now()` without this class knowing.
     * @param {number} [options.maxTotalWeight=MAX_TOTAL_VISEME_WEIGHT]
     * @param {Object} [options.defects] - 🚩 See the header. `{ frameCoupledCursor,
     *   frameRateDependentSmoothing, anticipationInFrames }`, all false in anything that ships.
     */
    constructor( options = {} ) {

        this.clock = options.clock ?? ( () => 0 );
        this.maxTotalWeight = options.maxTotalWeight ?? MAX_TOTAL_VISEME_WEIGHT;
        this.leadSeconds = clampLead( options.leadSeconds ?? DEFAULT_LEAD_SECONDS );

        this.defects = {
            frameCoupledCursor: false,
            frameRateDependentSmoothing: false,
            anticipationInFrames: false,
            anticipationAssumes60Hz: false,
            ...( options.defects ?? {} )
        };

        /** The normalised timeline currently being spoken. Frozen; replaced, never edited. */
        this.timeline = Object.freeze( [] );

        /** Per-entry envelope windows, sorted by window start. Rebuilt with the timeline. */
        this.windows = [];
        this.longestWindowSeconds = 0;

        /** Audio-clock time at which `timeline[i].startTime === 0` is heard. */
        this.audioStartTime = 0;

        /**
         * The frame's answer. One key per OVR shape, always present, so a consumer can iterate a
         * stable shape and nothing allocates per frame.
         */
        this.weights = {};
        for ( const name of OVR_VISEMES ) this.weights[ name ] = 0;

        // Defect state. Untouched unless a defect is on.
        this.defectCursorIndex = 0;
        this.defectCursorElapsed = 0;
        this.defectSmoothed = {};
        for ( const name of OVR_VISEMES ) this.defectSmoothed[ name ] = 0;

    }

    /**
     * Loads an utterance.
     *
     * @param {Array<{viseme: string|number, startTime: number, duration: number}>} timeline
     *   Times in seconds from the start of the utterance. Any naming convention `Visemes.js`
     *   understands.
     * @param {Object} [options]
     * @param {number} [options.at] - The audio-clock instant at which `startTime === 0` will be
     *   HEARD. Defaults to now. 🎯 Pass the value the audio graph will actually start at —
     *   `audioContext.currentTime + scheduleAhead` — rather than "now", or the mouth is early by
     *   the lead and late by the scheduling delay at the same time.
     * @param {Object} [options.normalise] - Forwarded to `normaliseTimeline`.
     */
    speak( timeline, options = {} ) {

        this.timeline = normaliseTimeline( timeline, options.normalise );
        this.audioStartTime = options.at ?? this.clock();

        this.rebuildWindows();
        this.resetDefectState();

        return this;

    }

    /** Silence, immediately. Weights go to zero on the next sample. */
    stop() {

        this.timeline = Object.freeze( [] );
        this.windows = [];
        this.longestWindowSeconds = 0;
        this.resetDefectState();

        for ( const name of OVR_VISEMES ) this.weights[ name ] = 0;

        return this;

    }

    /** Seconds of audio in the loaded utterance. */
    get durationSeconds() {

        return timelineDuration( this.timeline );

    }

    /** Whether `audioTime` falls inside the utterance, lead included. */
    isSpeakingAt( audioTime ) {

        if ( this.timeline.length === 0 ) return false;

        const t = this.timelineTimeFor( audioTime );
        return t >= this.windows[ 0 ].start && t <= this.latestWindowEnd;

    }

    /**
     * The audio clock mapped into the timeline's own seconds, WITH the lead applied.
     *
     * This one line is the whole of 4.4: at wall-clock instant `audioTime` the mouth is showing
     * what the audio will be doing `leadSeconds` from now.
     */
    timelineTimeFor( audioTime ) {

        return audioTime - this.audioStartTime + this.leadSeconds;

    }

    /**
     * Every viseme weight at one absolute audio-clock instant.
     *
     * Pure with respect to the frame loop: no state is read or written except the reused output
     * object, and the same `audioTime` always produces the same answer. Sampling backwards, out of
     * order, or twice is safe and is exactly what the invariance gate does.
     *
     * @param {number} audioTime - Seconds on the same clock `speak({at})` was given.
     * @returns {Object<string, number>} The reused `weights` object. Copy it if you need to keep it.
     */
    sampleAt( audioTime ) {

        return this.sampleTimelineTime( this.timelineTimeFor( audioTime ) );

    }

    /**
     * The frame-loop entry point.
     *
     * `deltaSeconds` is accepted and — in everything that ships — deliberately unused. Read the
     * header before deciding that is a bug.
     *
     * @param {number} deltaSeconds
     * @param {number} [audioTime=this.clock()]
     */
    update( deltaSeconds, audioTime = this.clock() ) {

        if ( this.defects.frameCoupledCursor === true ) {

            this.sampleTimelineTime( this.advanceDefectCursor( deltaSeconds ) );

        } else if ( this.defects.anticipationInFrames === true ) {

            this.sampleTimelineTime( this.timelineTimeFor( audioTime ),
                { anticipationSeconds: DEFECT_ANTICIPATION_FRAMES * deltaSeconds } );

        } else if ( this.defects.anticipationAssumes60Hz === true ) {

            // 🚩 DEFECT REBUILD 4 of 4 — the one built to WALK PAST the invariance gate. Timing
            // authored in frames again, but resolved against a hardcoded 60 Hz instead of the real
            // dt. The result is identical at every frame rate, so a gate that compares 30 Hz
            // against 120 Hz sees nothing at all — and the envelope is still wrong at all three.
            this.sampleTimelineTime( this.timelineTimeFor( audioTime ),
                { anticipationSeconds: DEFECT_ANTICIPATION_FRAMES / DEFECT_ASSUMED_RATE_HZ } );

        } else {

            this.sampleAt( audioTime );

        }

        if ( this.defects.frameRateDependentSmoothing === true ) this.applyDefectSmoothing();

        return this.weights;

    }

    /**
     * Onsets — the instants a viseme's envelope begins to move — inside a half-open audio-clock
     * interval, oldest first.
     *
     * Not used by the mouth, which is sampled continuously. It is here because Phase 6's gesture
     * layer needs discrete speech landmarks to align a stroke against ("stroke onset 0-200 ms
     * BEFORE the stressed syllable, never after"), and the schedule is the only thing that knows
     * where they are. Half-open so a frame loop calling it back to back sees each onset once.
     */
    onsetsBetween( fromAudioTime, toAudioTime ) {

        const from = this.timelineTimeFor( fromAudioTime );
        const to = this.timelineTimeFor( toAudioTime );

        const onsets = [];

        for ( const window of this.windows ) {

            if ( window.start >= from && window.start < to ) {

                onsets.push( {
                    viseme: window.entry.viseme,
                    audioTime: window.start - this.leadSeconds + this.audioStartTime,
                    peak: window.entry.peak
                } );

            }

        }

        return onsets;

    }

    // --- internals ---------------------------------------------------------------------------

    /**
     * The shared body of every sampling path: accumulate each overlapping envelope, then cap the
     * total proportionally.
     *
     * @param {number} t - Timeline seconds, lead already applied.
     * @param {Object} [defect] - Passed through to the envelope. Null in anything that ships.
     */
    sampleTimelineTime( t, defect = null ) {

        for ( const name of OVR_VISEMES ) this.weights[ name ] = 0;

        if ( this.windows.length === 0 ) return this.weights;

        let total = 0;
        let strongTotal = 0;

        // Entries are sorted by window start, so everything that can be active at `t` began no
        // earlier than one longest-window ago. Walk back from the last window that has opened.
        const lastOpened = this.lastWindowStartingAtOrBefore( t );
        const earliest = t - this.longestWindowSeconds;

        for ( let index = lastOpened; index >= 0; index -- ) {

            const window = this.windows[ index ];
            if ( window.start < earliest ) break;

            if ( t <= window.start || t >= window.end ) continue;

            const weight = defect === null
                ? weightAt( window.entry, t )
                : weightAt( window.entry, t, defect );

            if ( weight <= 0 ) continue;

            this.weights[ window.entry.viseme ] += weight;
            total += weight;
            if ( STRONG_SHAPES.has( window.entry.viseme ) ) strongTotal += weight;

        }

        if ( total > this.maxTotalWeight ) this.capTotalWeight( total, strongTotal );

        return this.weights;

    }

    /**
     * Brings the frame's total deformation back to the cap, paying the strong shapes first.
     * See MAX_TOTAL_VISEME_WEIGHT for why "first" and not "equally".
     */
    capTotalWeight( total, strongTotal ) {

        if ( strongTotal >= this.maxTotalWeight ) {

            // Two bilabials overlapping. Nothing can be protected; fall back to proportional.
            const scale = this.maxTotalWeight / total;
            for ( const name of OVR_VISEMES ) this.weights[ name ] *= scale;
            return;

        }

        const scale = ( this.maxTotalWeight - strongTotal ) / ( total - strongTotal );

        for ( const name of OVR_VISEMES ) {

            if ( STRONG_SHAPES.has( name ) ) continue;
            this.weights[ name ] *= scale;

        }

    }

    /** Index of the last window whose start is <= t, or -1. Binary search. */
    lastWindowStartingAtOrBefore( t ) {

        let low = 0;
        let high = this.windows.length - 1;
        let found = -1;

        while ( low <= high ) {

            const middle = ( low + high ) >> 1;

            if ( this.windows[ middle ].start <= t ) {

                found = middle;
                low = middle + 1;

            } else {

                high = middle - 1;

            }

        }

        return found;

    }

    rebuildWindows() {

        this.windows = this.timeline.map( ( entry ) => {

            const span = envelopeWindow( entry );
            return { entry, start: span.start, end: span.end };

        } );

        // An entry's window opens `anticipation` before its nominal start, and anticipation varies
        // with duration, so window order is NOT timeline order in general — a long viseme starting
        // 10 ms after a short one opens 50 ms before it. Sort by what the search actually indexes.
        this.windows.sort( ( a, b ) => a.start - b.start );

        this.longestWindowSeconds = 0;
        this.latestWindowEnd = 0;

        for ( const window of this.windows ) {

            this.longestWindowSeconds = Math.max( this.longestWindowSeconds, window.end - window.start );
            this.latestWindowEnd = Math.max( this.latestWindowEnd, window.end );

        }

    }

    resetDefectState() {

        this.defectCursorIndex = 0;
        this.defectCursorElapsed = 0;
        for ( const name of OVR_VISEMES ) this.defectSmoothed[ name ] = 0;

    }

    /**
     * 🚩 DEFECT REBUILD 1 of 3 — the countdown that discards its overshoot (LEARNINGS §1.13a).
     *
     * Walks the timeline entry by entry, holding a per-entry elapsed counter that is advanced by
     * `dt` and RESET TO ZERO on rollover rather than carrying the remainder. Every entry is
     * therefore rounded up to a whole number of frames — `ceil(d/dt)*dt`, a mean of `dt/2` of
     * fabricated time per entry — and the whole timeline drifts at a rate set by the frame rate.
     * Reads exactly like an ordinary sequencer, which is why the real one had to be written to
     * make this impossible rather than merely avoided.
     */
    advanceDefectCursor( deltaSeconds ) {

        this.defectCursorElapsed += deltaSeconds;

        while ( this.defectCursorIndex < this.timeline.length
            && this.defectCursorElapsed >= this.timeline[ this.defectCursorIndex ].duration ) {

            this.defectCursorElapsed = 0;
            this.defectCursorIndex ++;

        }

        const entry = this.timeline[ Math.min( this.defectCursorIndex, this.timeline.length - 1 ) ];
        return entry.startTime + this.defectCursorElapsed;

    }

    /**
     * 🚩 DEFECT REBUILD 2 of 3 — a smoother with a constant PER-FRAME coefficient.
     *
     * `w += (target − w) * k` retains `(1 − k)` of the error per FRAME, so it settles in a fixed
     * number of frames rather than a fixed number of seconds: three times faster at 120 Hz than at
     * 40 Hz. Structurally unrelated to the cursor defect — it leaves every arrival instant exactly
     * where it was and corrupts only the trajectory between them — which is precisely why the gate
     * has to compare whole trajectories and not event times.
     */
    applyDefectSmoothing() {

        for ( const name of OVR_VISEMES ) {

            this.defectSmoothed[ name ] += ( this.weights[ name ] - this.defectSmoothed[ name ] )
                * DEFECT_SMOOTHING_PER_FRAME;
            this.weights[ name ] = this.defectSmoothed[ name ];

        }

    }

}

/**
 * Keeps the lead inside the window the research describes, and says so when it does not.
 *
 * A negative lead is rejected outright rather than clamped quietly: it is the specific setting
 * ITU-R BT.1359-1 says is ~3x more detectable than its mirror, and a caller that asked for it has
 * misread the sign convention.
 */
function clampLead( leadSeconds ) {

    if ( ! Number.isFinite( leadSeconds ) ) {

        console.warn( `VisemeSchedule: lead ${ leadSeconds } is not a number. Using ${ DEFAULT_LEAD_SECONDS } s.` );
        return DEFAULT_LEAD_SECONDS;

    }

    if ( leadSeconds < 0 ) {

        console.warn(
            `VisemeSchedule: a lead of ${ leadSeconds } s puts the mouth BEHIND the audio. ITU-R ` +
            'BT.1359-1 makes that ~3x more detectable than the same offset early. Using 0.'
        );
        return 0;

    }

    if ( leadSeconds > MOUTH_EARLY_DETECTABLE_SECONDS ) {

        console.warn(
            `VisemeSchedule: a lead of ${ leadSeconds } s is past the ${ MOUTH_EARLY_DETECTABLE_SECONDS } s ` +
            'early-detectability threshold. Clamped.'
        );
        return MOUTH_EARLY_DETECTABLE_SECONDS;

    }

    return leadSeconds;

}

export { envelopeKeys };
