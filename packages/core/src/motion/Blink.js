/**
 * Blink — the eyelid reflex, with the down/up asymmetry that the VTuber baseline ships backwards.
 *
 * THIS FILE EXISTS FOR ONE NUMBER
 * ------------------------------
 * A human blink closes in 50–100 ms and opens in 150–300 ms. The lid FALLS fast and CREEPS back
 * up; downphase velocity is about twice upphase. Live2D's Cubism SDK ships 0.1 s close / 0.15 s
 * open — nearly symmetric, and what asymmetry it has points the wrong way. Every avatar built on
 * that default blinks like a doll's weighted eyelid rather than a person's.
 *
 * Getting the direction right costs nothing at runtime and beats the entire VTuber baseline on
 * this channel. That is the whole reason this module is a separate, documented file instead of
 * two lines of lerp somewhere.
 *
 * (Sources for everything below: docs/research/affect-and-animation.md §4 — Ruhland et al. 2015,
 * CGF 34(6); Doughty's blink-rate meta-study; Trutoiu et al., ACM TAP 2011.)
 *
 * THE FOUR THINGS THAT MAKE A BLINK READ AS REAL
 * ----------------------------------------------
 *   1. Asymmetry.     Closing 50–100 ms, opening 150–300 ms, and per blink the opening is
 *                     always at least 2x the closing — enforced when the pair is sampled, not
 *                     just true on average.
 *   2. Full closure.  Trutoiu found partial-closure blinks are consistently rated as wrong.
 *                     The lids reach exactly full closure and the frame that crosses into it is
 *                     snapped so a 60 Hz sampler can never skip over it. "Full closure" is a
 *                     statement about the LID, not about the morph slider: on this asset the eye
 *                     is sealed at weight 0.735 and everything above that drives the lid through
 *                     the lower one. See FULL_CLOSURE_MORPH_WEIGHT.
 *   3. Non-uniform velocity WITHIN each phase, and differently shaped between the two:
 *                     the downphase is near-ballistic (trapezoidal velocity — a fast onset, a
 *                     long constant-speed fall, a short deceleration as the lids meet); the
 *                     upphase is a hard levator pull that decays into a slow creep to full
 *                     aperture. Neither is a linear ramp and neither is a plain smoothstep.
 *   4. Poisson timing at a rate that MEANS something. Blink rate is a marker of central
 *                     dopamine function: visual attention lowers it, working-memory load
 *                     raises it. `setAttention()` and `setCognitiveLoad()` are therefore real
 *                     signal channels for Phase 5, not decoration.
 *
 * A NOTE ON THE RECORDED RANGES
 * -----------------------------
 * The research doc records "complete blink 100–400 ms" alongside "closing 50–100 ms, opening
 * 150–300 ms". Those cannot both hold: the shortest blink the phase durations allow is 200 ms.
 * The phase durations are the more specific measurement and the ones the perceptual result
 * hangs on, so they win; total duration here lands in 210–430 ms. Flagging it rather than
 * quietly fudging one of them.
 *
 * WHAT THIS LAYER DOES NOT DO
 * ---------------------------
 * No inter-eye timing offset. Real lids desynchronise by a few milliseconds, which is sub-frame
 * at 60 Hz and would cost a second timeline for nothing visible. The eyes differ only in the
 * rare unilateral blink, where one lid simply does not participate.
 *
 * No lid-follows-gaze coupling. That belongs to Gaze (2.2), which owns the eyeLook* morphs.
 *
 * USAGE
 *
 *     const blink = stack.add( new Blink() );
 *     blink.setCognitiveLoad( 0.7 );          // thinking hard -> blinks more
 *     blink.setAttention( 0.2 );              // watching closely -> blinks less
 *     ...
 *     blink.triggerWithSaccade( 34 );         // Gaze calls this at gaze-shift onset
 */

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';

// --- kinematics, measured (research §4) --------------------------------------------------------

const CLOSING_DURATION_RANGE_SECONDS = [ 0.050, 0.100 ];
const OPENING_DURATION_RANGE_SECONDS = [ 0.150, 0.300 ];

// The asymmetry, enforced per blink. Sampling the two durations independently would occasionally
// produce a 100 ms close against a 150 ms open — a 1.5x ratio that reads as a symmetric doll
// blink even though both numbers sit inside their recorded ranges. So the opening is sampled
// from the window that satisfies BOTH its own range and this ratio against the closing already
// drawn. "About 2x" is the floor, not the target.
const OPENING_TO_CLOSING_RATIO_RANGE = [ 2.0, 3.5 ];

// The lids rest together for a moment at the bottom of a spontaneous blink. Kept short, and kept
// for a second reason: it widens the window in which a frame can sample full closure.
const CLOSED_HOLD_RANGE_SECONDS = [ 0.010, 0.030 ];

// --- velocity shaping --------------------------------------------------------------------------
//
// Downphase: a trapezoidal velocity profile. Orbicularis oculi fires as a burst, the lid
// accelerates over the first ~18% of the fall, runs at essentially constant speed, then sheds
// speed over the last ~28% as the lids come together. Peak velocity is 1/(1 - (0.18+0.28)/2)
// = 1.30x the mean — a flat profile, which is what "ballistic" looks like on a position trace.
const DOWNPHASE_ACCELERATION_FRACTION = 0.18;
const DOWNPHASE_CONTACT_FRACTION = 0.28;

// Upphase: levator palpebrae pulls hard the instant the lids part, then the last third of the
// aperture is a slow creep. Modelled as 1 - (1-u)^k, whose velocity starts at k x the mean and
// decays to zero. k = 1.7 puts the peak-velocity ratio between the phases near 2 across the
// sampled duration range, which is the number the literature states.
const UPPHASE_DECAY_EXPONENT = 1.7;

// --- rate, measured (Doughty via research §4) --------------------------------------------------

const BASELINE_RATE_PER_MINUTE = 20;
const CONVERSATION_RATE_RANGE_PER_MINUTE = [ 10.5, 32.5 ];

// Direction of both effects is measured; the gains are read off the recorded conversation band
// rather than invented. Baseline 20/min, band 10.5–32.5: full visual attention should reach the
// bottom (10.5 / 20 = 0.525, so a gain of 0.475) and full working-memory load the top
// (32.5 / 20 = 1.625, so a gain of 0.625). They are deliberately not symmetric because the band
// is not symmetric about its baseline.
const COGNITIVE_LOAD_GAIN = 0.625;
const VISUAL_ATTENTION_GAIN = 0.475;

// --- coupling and asymmetry, NOT MEASURED ------------------------------------------------------
//
// The research records the *direction* of both of these and no magnitude. Ruhland: blinks
// "often co-occur with gaze-shift onset, especially saccades > 30 degrees" — no probability
// given. Unilateral blinks are known to be rare and are not quantified anywhere we checked.
// Both are exposed as options so the critic pass can tune them; do not cite these back as
// measured constants.
const SACCADE_COUPLING_DEFAULTS = {
    thresholdDegrees: 10,      // below this a gaze shift never recruits a blink
    saturationDegrees: 30,     // the amplitude the research singles out
    maximumProbability: 0.5,   // probability at and above saturation
};

const UNILATERAL_BLINK_PROBABILITY = 0.02;

// --- the asset's real useful range, measured -----------------------------------------------------
//
// 🎯 THE MORPH IS NOT A 0..1 APERTURE, AND ASSUMING IT IS COSTS TWO THIRDS OF THE ANIMATION.
//
// `eyeBlink{Left,Right}` is a linear vertex displacement, so the lid keeps travelling for as long
// as the weight keeps rising — including well past the point where it has already met the lower
// lid. Measured on all five figures of the gender sweep by rasterising the eye-region skin and
// the eyeball into a frontal depth map and finding the weight at which no eyeball is visible at
// all (`ocular.selftest.mjs` re-measures this against the GLB on every run, so the number below
// cannot silently drift away from the asset):
//
//     figure   eye sealed at   lashes clear the aperture at
//     g000        0.733            0.683
//     g025        0.722            0.677
//     g050        0.697            0.603
//     g075        0.679            0.630
//     g100        0.658            0.552
//
// Driving to 1.0 therefore did two things, both visible. Past the seal the lid margin carries on
// down through the lower lid — 0.30 of a weight, about 3.8 mm of travel on g050 — which is what
// pushes the lash cards and a sliver of sclera through the skin.
//
// And the timing curve stopped meaning what it says. With the aperture written straight onto the
// morph, the g050 lid is already shut 62.7% of the way down the fall and stays looking shut for
// the first 19.1% of the rise, so 30% of a curve whose whole point is its shape was spent
// against the stop. The blink read as "shut, HOLD, roll open" — a hold three times longer than
// the 10–30 ms the layer actually schedules — which is the asymmetry this file exists to get
// right, undone at the output boundary.
//
// The default is the LARGEST of the five, so every figure in the sweep reaches full closure. The
// cost is that g100 overshoots by 0.077 of a weight — under a millimetre of lid travel, against
// the 3.8 mm it had before — and Trutoiu is explicit that a blink which fails to close fully is
// the worse error of the two.
const FULL_CLOSURE_MORPH_WEIGHT = 0.735;

const LEFT_EYELID_MORPH = 'eyeBlinkLeft';
const RIGHT_EYELID_MORPH = 'eyeBlinkRight';

const SECONDS_PER_MINUTE = 60;

export class Blink extends Layer {

    /**
     * @param {Object} [options]
     * @param {string} [options.name='blink']
     * @param {number} [options.order=MOTION_ORDER.BLINK]
     * @param {number} [options.baselineRatePerMinute=20]
     * @param {number[]} [options.rateBoundsPerMinute=[10.5, 32.5]] - Hard clamp on the rate after
     *   load and attention are applied. Widen it for a non-conversational context: Doughty's
     *   reading figure is 1.4–14.4/min, primary gaze 8.0–21.0/min.
     * @param {Object} [options.saccadeCoupling] - See SACCADE_COUPLING_DEFAULTS.
     * @param {number} [options.unilateralProbability=0.02]
     * @param {number} [options.fullClosureMorphWeight=0.735] - The morph weight at which THIS
     *   asset's lid is fully shut. Measure it before changing it; see FULL_CLOSURE_MORPH_WEIGHT.
     */
    constructor( options = {} ) {

        super( {
            name: options.name ?? 'blink',
            order: options.order ?? MOTION_ORDER.BLINK,
            morphChannels: [ LEFT_EYELID_MORPH, RIGHT_EYELID_MORPH ],
            enabled: options.enabled,
            weight: options.weight,
        } );

        // Tuning. All of it is live — changing any of these mid-run affects the next blink, not
        // the one in flight, which is what a reflex should do.
        this.baselineRatePerMinute = options.baselineRatePerMinute ?? BASELINE_RATE_PER_MINUTE;
        this.rateBoundsPerMinute = [ ...( options.rateBoundsPerMinute ?? CONVERSATION_RATE_RANGE_PER_MINUTE ) ];
        this.saccadeCoupling = { ...SACCADE_COUPLING_DEFAULTS, ...( options.saccadeCoupling ?? {} ) };
        this.unilateralProbability = options.unilateralProbability ?? UNILATERAL_BLINK_PROBABILITY;
        this.fullClosureMorphWeight = options.fullClosureMorphWeight ?? FULL_CLOSURE_MORPH_WEIGHT;

        // Drive signals, 0..1, written by the affect/attention system in Phase 5.
        this.cognitiveLoad = 0;
        this.attention = 0;

        // The blink in flight. `elapsed` is negative-safe: -1 means no blink is running.
        this.elapsed = -1;
        this.closingDuration = 0;
        this.closedHold = 0;
        this.openingDuration = 0;
        this.leftAmplitude = 1;
        this.rightAmplitude = 1;

        this.secondsUntilNextBlink = 0;

        // Aperture, not morph weight: 0 open, 1 shut. Published to the rest of the stack in these
        // units too, because "how shut are the eyes" is an answer about the eye, not about this
        // asset's blendshape range. See morphWeightFor().
        this.closure = 0;

        // Diagnostics. The selftest reads these; so does the critic harness.
        this.blinkCount = 0;
        this.lastSampledInterval = 0;
        this.lastBlinkWasUnilateral = false;

        // Preallocated so a running frame allocates nothing, and so any layer holding a reference
        // sees this frame's values without a lookup.
        this.publishedState = { closure: 0, isBlinking: false, ratePerMinute: 0 };

    }

    /**
     * The clock is armed here and nowhere else. `reset()` deliberately does not draw, because the
     * stack calls `reset()` and then `onBind()`; drawing in both would advance the layer's stream
     * one sample further on a reset run than on a fresh one, and the two runs would diverge.
     */
    onBind() {

        this.scheduleNextBlink();

    }

    // --- the frame -----------------------------------------------------------------------------

    update( deltaSeconds, context ) {

        this.advanceSchedule( deltaSeconds );
        this.advanceBlinkInFlight( deltaSeconds );

        this.closure = this.eyelidClosureAt( this.elapsed );

        this.publishedState.closure = this.closure;
        this.publishedState.isBlinking = this.elapsed >= 0;
        this.publishedState.ratePerMinute = this.effectiveRatePerMinute();
        context.shared.blink = this.publishedState;

        // Between blinks the lids belong to whatever expression is running, so say nothing.
        if ( this.closure === 0 ) return null;

        this.contribution.setMorph( LEFT_EYELID_MORPH, this.morphWeightFor( this.leftAmplitude ) );
        this.contribution.setMorph( RIGHT_EYELID_MORPH, this.morphWeightFor( this.rightAmplitude ) );

        return this.contribution;

    }

    // --- drive signals -------------------------------------------------------------------------

    /**
     * Working-memory engagement, 0..1. Raises the blink rate. This is a real cognitive-load
     * readout, not an aesthetic knob: blink rate tracks central dopaminergic activity, so an
     * agent that is thinking should visibly blink more.
     */
    setCognitiveLoad( load ) {

        this.cognitiveLoad = clampToUnitRange( load );

    }

    /**
     * Sustained visual attention, 0..1. LOWERS the blink rate — an agent watching something
     * closely holds its eyes open. Opposes cognitive load, and both can be high at once.
     */
    setAttention( attention ) {

        this.attention = clampToUnitRange( attention );

    }

    setBaselineRate( ratePerMinute ) {

        this.baselineRatePerMinute = Math.max( ratePerMinute, 0 );

    }

    /** Widen or narrow the hard clamp — conversation is not the only context. */
    setRateBounds( minimumPerMinute, maximumPerMinute ) {

        this.rateBoundsPerMinute = [ minimumPerMinute, maximumPerMinute ];

    }

    /** Blinks per minute after load and attention, clamped to the configured band. */
    effectiveRatePerMinute() {

        const modulation = 1
            + COGNITIVE_LOAD_GAIN * this.cognitiveLoad
            - VISUAL_ATTENTION_GAIN * this.attention;

        const rate = this.baselineRatePerMinute * modulation;

        return Math.min( Math.max( rate, this.rateBoundsPerMinute[ 0 ] ), this.rateBoundsPerMinute[ 1 ] );

    }

    // --- external triggers ---------------------------------------------------------------------

    /**
     * Called by the gaze layer at saccade onset. Blinks co-occur with gaze shifts, strongly so
     * above 30 degrees, and a blink that lands on a large gaze shift is doing real perceptual
     * work: it masks the transit the same way a saccadic suppression does in a real viewer.
     *
     * A blink recruited this way counts as a blink — it rearms the Poisson clock, so a talkative
     * gaze policy does not silently double the blink rate.
     *
     * @param {number} amplitudeDegrees
     * @returns {boolean} Whether a blink actually started.
     */
    triggerWithSaccade( amplitudeDegrees ) {

        if ( this.elapsed >= 0 ) return false;

        const { thresholdDegrees, saturationDegrees, maximumProbability } = this.saccadeCoupling;

        if ( amplitudeDegrees <= thresholdDegrees ) return false;

        const span = Math.max( saturationDegrees - thresholdDegrees, 1e-6 );
        const ramp = Math.min( ( amplitudeDegrees - thresholdDegrees ) / span, 1 );

        if ( this.random.chance( ramp * maximumProbability ) === false ) return false;

        this.beginBlink();
        return true;

    }

    /**
     * Starts a blink now, whatever the schedule said. For scripted beats and for the selftest.
     * Ignored while a blink is already in flight — a reflex does not restart mid-fall.
     *
     * @param {Object} [options]
     * @param {boolean} [options.unilateral] - Force or forbid the single-eye case.
     */
    blinkNow( options = {} ) {

        if ( this.elapsed >= 0 ) return false;

        this.beginBlink( options.unilateral );
        return true;

    }

    // --- the eyelid curve ----------------------------------------------------------------------

    /**
     * Eyelid closure at `seconds` into the current blink: 0 fully open, 1 fully shut.
     *
     * Pure apart from reading the current blink's durations, which is what lets the selftest plot
     * the curve without running a stack.
     */
    eyelidClosureAt( seconds ) {

        if ( seconds < 0 ) return 0;

        if ( seconds < this.closingDuration ) {

            return closureDuringDownphase( seconds / this.closingDuration );

        }

        const closedUntil = this.closingDuration + this.closedHold;
        if ( seconds <= closedUntil ) return 1;

        const openingProgress = ( seconds - closedUntil ) / this.openingDuration;
        if ( openingProgress >= 1 ) return 0;

        return 1 - reopeningDuringUpphase( openingProgress );

    }

    /**
     * The one place perceptual closure becomes an asset weight.
     *
     * Everything above this line — the phase durations, the two velocity profiles, the closed
     * hold, the snap that guarantees a rendered 1.0 — is in APERTURE units: 0 is a fully open
     * eye and 1 is a fully shut one, which is what the literature's numbers are about and what
     * makes the timing constants readable. The morph is not that scale, so the two are kept
     * apart and the mapping happens once, here, at the boundary. Linear, because the morph is a
     * linear vertex displacement: half the perceptual closure is the lid margin half way down.
     *
     * `amplitude` is the per-eye 0 or 1 that makes a unilateral blink unilateral.
     */
    morphWeightFor( amplitude ) {

        return this.closure * amplitude * this.fullClosureMorphWeight;

    }

    /** Total wall time of the blink in flight, closing through fully open. */
    blinkDuration() {

        return this.closingDuration + this.closedHold + this.openingDuration;

    }

    // --- lifecycle -----------------------------------------------------------------------------

    reset() {

        this.elapsed = -1;
        this.closure = 0;
        this.leftAmplitude = 1;
        this.rightAmplitude = 1;
        this.cognitiveLoad = 0;
        this.attention = 0;
        this.blinkCount = 0;
        this.lastSampledInterval = 0;
        this.lastBlinkWasUnilateral = false;
        this.secondsUntilNextBlink = 0;

    }

    // --- helpers -------------------------------------------------------------------------------

    /**
     * Counts down to the next arrival and fires it when the lids are free.
     *
     * The arrival is sampled as a pure exponential with no floor, because that is what "Poisson
     * process" means and a floor would put an 11% atom at the floor value. The refractory period
     * is instead enforced by DEFERRAL: an arrival that lands inside a blink already in flight
     * fires the moment that blink finishes. That is also what the eyelid physically does, and it
     * keeps the sampled distribution exactly exponential for anything that wants to test it.
     */
    advanceSchedule( deltaSeconds ) {

        this.secondsUntilNextBlink -= deltaSeconds;

        if ( this.secondsUntilNextBlink > 0 ) return;
        if ( this.elapsed >= 0 ) return;               // deferred: still blinking

        this.beginBlink();

    }

    advanceBlinkInFlight( deltaSeconds ) {

        if ( this.elapsed < 0 ) return;

        const previous = this.elapsed;
        let next = previous + deltaSeconds;

        // Trutoiu's finding is that a blink which never renders fully shut reads as wrong, and at
        // 60 Hz a 20 ms closed window is only two-thirds likely to be sampled at all. So a frame
        // that would step straight over the closed window is pulled back to the instant of
        // closure. Costs at most one frame of timing jitter; buys a guaranteed 1.0.
        const closureInstant = this.closingDuration;
        const closedUntil = closureInstant + this.closedHold;

        if ( previous < closureInstant && next > closedUntil ) next = closureInstant;

        this.elapsed = next;

        if ( this.elapsed >= this.blinkDuration() ) this.elapsed = -1;

    }

    /**
     * Samples one blink's shape and starts it. Sampling here rather than at schedule time means a
     * blink recruited by a saccade is drawn from the same distribution as a spontaneous one.
     */
    beginBlink( forceUnilateral ) {

        this.closingDuration = this.random.range( ...CLOSING_DURATION_RANGE_SECONDS );

        // The opening window is the intersection of its own recorded range with the ratio floor
        // against the closing just drawn, so both constraints hold for every blink.
        const ratioFloor = this.closingDuration * OPENING_TO_CLOSING_RATIO_RANGE[ 0 ];
        const ratioCeiling = this.closingDuration * OPENING_TO_CLOSING_RATIO_RANGE[ 1 ];

        const openingMinimum = Math.max( OPENING_DURATION_RANGE_SECONDS[ 0 ], ratioFloor );
        const openingMaximum = Math.min( OPENING_DURATION_RANGE_SECONDS[ 1 ], ratioCeiling );

        this.openingDuration = this.random.range( openingMinimum, Math.max( openingMaximum, openingMinimum ) );
        this.closedHold = this.random.range( ...CLOSED_HOLD_RANGE_SECONDS );

        const unilateral = forceUnilateral ?? this.random.chance( this.unilateralProbability );

        this.leftAmplitude = 1;
        this.rightAmplitude = 1;

        if ( unilateral === true ) {

            if ( this.random.chance( 0.5 ) ) this.leftAmplitude = 0;
            else this.rightAmplitude = 0;

        }

        this.lastBlinkWasUnilateral = unilateral === true;
        this.elapsed = 0;
        this.blinkCount ++;

        this.scheduleNextBlink();

    }

    /**
     * Arms the clock for the next arrival, measured from THIS blink's onset rather than from its
     * end. Measuring from the end would add the blink's own 210–430 ms to every interval and quietly
     * run the whole avatar ~10% below the rate it was asked for.
     */
    scheduleNextBlink() {

        const ratePerSecond = this.effectiveRatePerMinute() / SECONDS_PER_MINUTE;

        this.lastSampledInterval = this.random.poissonInterval( ratePerSecond );
        this.secondsUntilNextBlink = this.lastSampledInterval;

    }

}

// --- the two velocity profiles -----------------------------------------------------------------
//
// Exported because they are the claim this file makes. A reviewer should be able to plot them
// without instantiating anything, and the selftest does exactly that.

/**
 * Closure during the downphase, 0..1 over normalised phase 0..1.
 *
 * Trapezoidal velocity: accelerate, fall at constant speed, decelerate into contact. The
 * constant-speed middle is what makes this read as a lid dropping rather than a lid easing.
 */
export function closureDuringDownphase( phase ) {

    if ( phase <= 0 ) return 0;
    if ( phase >= 1 ) return 1;

    const accelerate = DOWNPHASE_ACCELERATION_FRACTION;
    const decelerate = DOWNPHASE_CONTACT_FRACTION;

    // The plateau velocity that makes the area under the trapezoid exactly 1.
    const plateauVelocity = 1 / ( 1 - ( accelerate + decelerate ) / 2 );

    if ( phase < accelerate ) {

        return plateauVelocity * phase * phase / ( 2 * accelerate );

    }

    if ( phase <= 1 - decelerate ) {

        return plateauVelocity * ( accelerate / 2 + ( phase - accelerate ) );

    }

    const remaining = ( 1 - phase ) / decelerate;

    return 1 - plateauVelocity * decelerate * remaining * remaining / 2;

}

/**
 * How far the eye has REOPENED during the upphase, 0..1 over normalised phase 0..1. Closure is
 * one minus this.
 *
 * Levator pull then creep: velocity starts at UPPHASE_DECAY_EXPONENT x the mean and decays to
 * zero, so the last sliver of aperture takes a disproportionate share of the phase. That long
 * tail is the visible half of the asymmetry — the part a symmetric implementation loses.
 */
export function reopeningDuringUpphase( phase ) {

    if ( phase <= 0 ) return 0;
    if ( phase >= 1 ) return 1;

    return 1 - Math.pow( 1 - phase, UPPHASE_DECAY_EXPONENT );

}

/**
 * Peak eyelid speed in each phase, in closure units per second, for a given pair of durations.
 * The literature states the asymmetry as a velocity ratio, so this is how the claim is checked.
 */
export function peakPhaseVelocities( closingDuration, openingDuration ) {

    const downphasePlateau = 1 / ( 1 - ( DOWNPHASE_ACCELERATION_FRACTION + DOWNPHASE_CONTACT_FRACTION ) / 2 );

    return {
        downphase: downphasePlateau / closingDuration,
        upphase: UPPHASE_DECAY_EXPONENT / openingDuration,
    };

}

export const BLINK_CONSTANTS = {
    FULL_CLOSURE_MORPH_WEIGHT,
    CLOSING_DURATION_RANGE_SECONDS,
    OPENING_DURATION_RANGE_SECONDS,
    OPENING_TO_CLOSING_RATIO_RANGE,
    CLOSED_HOLD_RANGE_SECONDS,
    BASELINE_RATE_PER_MINUTE,
    CONVERSATION_RATE_RANGE_PER_MINUTE,
    COGNITIVE_LOAD_GAIN,
    VISUAL_ATTENTION_GAIN,
};

function clampToUnitRange( value ) {

    return Math.min( Math.max( value, 0 ), 1 );

}
