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
 *                     A complete blink therefore reaches exactly full closure, and the frame that
 *                     crosses into it is snapped so a 60 Hz sampler can never skip over it. "Full
 *                     closure" is a statement about the LID, not about the morph slider: the eye
 *                     is sealed at weight 0.681-0.750 across the gender sweep and everything above
 *                     that drives the lid through the lower one. See FULL_CLOSURE_MORPH_WEIGHT,
 *                     which carries the measured table and the 0.752 the layer drives to.
 *   2b. Varying amplitude. Blinks are not all the same size, and a run of identical ones is the
 *                     loudest tell this layer can produce — a 20-second capture once held eleven
 *                     blinks with a single peak value between them. Amplitude is a MIXTURE: most
 *                     blinks complete, a minority are genuinely partial. See
 *                     PARTIAL_BLINK_PROBABILITY, and note that the ceiling never moves.
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
 * AND THE ARRIVALS ARE IN SIMULATED TIME, NOT IN FRAMES
 * -----------------------------------------------------
 * 🎯 THIS LAYER WAS THE FOURTH FRAME-COUPLED ONE, AND IT COUPLED BY A DIFFERENT MECHANISM FROM
 * THE OTHER THREE, WHICH IS WHY THE AUDIT THAT FOUND THEM MISSED IT.
 *
 * `Gaze`, `FacialIdle` and `HandIdle` coupled through `Signals.poissonEventOccurs` — one random
 * draw per FRAME, so their draw RATE scales with the frame rate and an instrumented count finds
 * them immediately (LEARNINGS §1.13). All three are converted now. Blink never called it. It drew one interval per blink, so
 * its draw rate is flat — measured 2.1 draws/s at 30, 60 and 120 Hz — and it was frame-coupled
 * anyway, because it counted the interval down against dt and re-armed with `= interval`,
 * THROWING AWAY THE NEGATIVE OVERSHOOT. Every interval was therefore rounded UP to the next whole
 * frame, which adds a mean of dt/2 to each one.
 *
 * That is a systematic drift, not sampling error, and it measures exactly what the arithmetic
 * predicts. Seed 1, 600 s, `figure_g050` in relaxed standing, blink onsets detected on
 * `elapsed >= 0`:
 *
 *     blink count 30 / 60 / 120 Hz     206 / 207 / 207
 *     first onset (s)                  0.9667 / 0.9500 / 0.9417
 *     onset #206 (s)                   593.3000 / 591.5833 / 590.6833
 *     last-onset drift, 30 - 120 Hz    2.6167 s over 206 blinks = 12.70 ms per blink
 *
 * A countdown that fires on the first frame at or past zero realises `ceil(interval / dt) * dt`,
 * so it adds a mean of dt/2 per interval: 16.67 ms at 30 Hz against 4.17 ms at 120 Hz, a predicted
 * 12.50 ms of drift per blink. Measured 12.70 ms (seed 1, 600 s) and 12.59 ms (seed 20260807).
 * Confirmed directly by instrumenting both quantities over 3000 s at seed 1 — mean REALISED
 * interval minus mean SAMPLED interval, which isolates the rounding from everything else:
 *
 *     rate      30 Hz     60 Hz    120 Hz    480 Hz
 *     excess   29.68 ms  21.03 ms  16.66 ms  13.32 ms
 *     vs 480    16.36     7.71      3.34        —          against a dt/2 of 16.67 / 8.33 / 4.17
 *
 * The 13.32 ms that survives at 480 Hz is the deferral rule, which is a real part of the model and
 * is not frame-coupled; it puts the realised rate ~0.45% under the sampled one at every rate.
 *
 * The visible consequence is total. Comparing the two runs at the instants they SHARE — every
 * 1/30 s — the worst disagreement in eyelid closure was **1.000000**: one frame rate has the eye
 * fully shut where the other has it fully open. The judge captures at 30 fps and every ocular gate
 * ran at 60 Hz, so this file's 51 checks were describing a blink train the camera never rendered.
 *
 * The fix is the same shape as `Sway`'s: a `Signals.PoissonSchedule` on its OWN forked stream,
 * with the frame walked in sub-intervals cut at each arrival, so a blink begins at the instant it
 * was drawn for rather than at the next frame boundary. Two consequences worth knowing:
 *
 *   - The rate is now integrated rather than frozen. The old code sampled the interval at the rate
 *     in force when the PREVIOUS blink started, so an agent whose cognitive load spiked mid-interval
 *     still waited out an interval drawn at the resting rate. `PoissonSchedule` consumes waiting
 *     time at `rate x seconds`, which is the standard time-rescaling and is correct under a rate
 *     that changes.
 *   - The closure snap moved from the TIMELINE to the SAMPLE. See renderedClosure().
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
import { PoissonSchedule } from './Signals.js';

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
// for a second reason: it widens the window in which a frame can sample full closure. A partial
// blink has no such moment, because nothing has met anything — see beginBlink().
const CLOSED_HOLD_RANGE_SECONDS = [ 0.010, 0.030 ];

// --- amplitude ---------------------------------------------------------------------------------
//
// 🎯 EVERY BLINK BEING THE SAME SIZE IS VISIBLE, and it was: a 20-second capture held 11 blinks
// with exactly ONE peak value between them. Nothing in the timing distribution can hide that,
// because the eye is the first thing a viewer looks at and a repeated identical event is the
// single strongest cue that something is on a loop.
//
// Real spontaneous blinking is a mixture of two populations, not a spread around one mean. Most
// blinks close completely; a substantial minority are incomplete, the lid coming most of the way
// down and returning without the margins meeting. So this is modelled as a mixture rather than as
// jitter on a single amplitude, and the full population is an ATOM at exactly 1.0 rather than a
// band just below it. Trutoiu et al. found blinks that fail to close read as wrong, and on this
// asset the difference between "sealed" and "0.96 of sealed" is a third of a millimetre of visible
// eye — a real error, bought for no visible variety. The variety comes from the partial
// population, where it is legible.
//
// 🚩 The proportion and the range are TUNING. The research doc records that incomplete blinks
// happen and that they read as wrong when they are the ONLY kind; it gives no incidence rate and
// no amplitude distribution. Do not cite these back as measured.
const PARTIAL_BLINK_PROBABILITY = 0.3;
const PARTIAL_CLOSURE_RANGE = [ 0.6, 0.95 ];

// 🚩 Amplitude and duration are deliberately NOT coupled, and that is a judgement call worth
// stating. A partial blink drawn from the range above travels 60-95% as far in the same time, so
// its lid runs 60-95% as fast — while the sampled closing duration already spans a factor of two
// (50-100 ms) all by itself. The amplitude's effect on lid speed is therefore smaller than the
// spread the timing model already has, and the two candidate couplings in the literature (constant
// duration with velocity scaling, versus constant velocity with duration scaling) disagree about
// which direction to correct in. Inventing one to move a number by less than its own noise is not
// worth the line of code.

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
//
// 🎯 THE SEAL IS A PROPERTY OF THE ASSET, AND THE ASSET CHANGED. The high-poly eye proxy with its
// separate corneal shell stands 1.145 mm further forward than the low-poly globe it replaced, so
// the lid has further to travel. Re-measured across the sweep by `ocular.selftest.mjs`, which
// exists to stop this constant drifting away from the figure:
//
//     low-poly  g000 0.733   g025 0.722   g050 0.697   g075 0.679   g100 0.658
//     high-poly g000 0.750   g025 0.726   g050 0.713   g075 0.700   g100 0.681
//
// 0.735 left g000 0.0145 of a weight short of shut. 0.752 keeps the same ~0.002 margin over the
// measured seal that 0.735 had over the low-poly's 0.733, and the overshoot gate still passes
// (worst 0.071 against a 0.1 limit).
//
// ⚠️ UNVERIFIED, AND SAID OUT LOUD: `docs/LEARNINGS.md` records that "past 0.735 the lash cards
// punch through the lid". Nothing in the repo MEASURES lash punch-through — the selftest's
// `sealWithLashes` number is about occlusion, not intersection. The 0.735/0.733 pairing says the
// constant came from this probe rather than from a lash artefact, but nobody has looked at a
// closed lid on the new asset. If lashes punch through, this is the constant to suspect first.
const FULL_CLOSURE_MORPH_WEIGHT = 0.752;

const LEFT_EYELID_MORPH = 'eyeBlinkLeft';
const RIGHT_EYELID_MORPH = 'eyeBlinkRight';

const SECONDS_PER_MINUTE = 60;

// The frame is cut at the instant a blink finishes so a deferred arrival can start exactly there.
// That step is computed as `blinkDuration() - elapsed` and then added back on, and the round trip
// lands a few ulps either side of the end; without a tolerance the walk would spin on
// sub-femtosecond steps. Same reasoning, and the same magnitude, as `Signals.WAIT_EPSILON` — ten
// orders of magnitude under the shortest real quantity in this file, the 10 ms closed hold.
const BLINK_END_EPSILON_SECONDS = 1e-12;

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
     * @param {number} [options.fullClosureMorphWeight=0.752] - The morph weight at which THIS
     *   asset's lid is fully shut. Measure it before changing it; see FULL_CLOSURE_MORPH_WEIGHT.
     * @param {number} [options.partialBlinkProbability=0.3] - Share of blinks that do not close
     *   fully. Raise it for a drowsy or distracted character; zero it for a stylised one.
     * @param {number[]} [options.partialClosureRange=[0.6, 0.95]] - How far those close, as a
     *   fraction of full closure. Never above 1: past full closure the lash cards punch through
     *   the lower lid, which is what fullClosureMorphWeight exists to stop.
     * @param {boolean} [options.frameQuantisedArrivals=false] - 🚩 REBUILDS THE DEFECT. Restores
     *   the countdown-with-dropped-remainder this layer shipped with, and the timeline write-back
     *   form of the closure snap, so the frame-rate invariance gate has something to reject
     *   (docs/LEARNINGS.md §1.1). Never set it in an application.
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
        this.partialBlinkProbability = options.partialBlinkProbability ?? PARTIAL_BLINK_PROBABILITY;
        this.partialClosureRange = [ ...( options.partialClosureRange ?? PARTIAL_CLOSURE_RANGE ) ];
        this.frameQuantisedArrivals = options.frameQuantisedArrivals === true;

        // Drive signals, 0..1, written by the affect/attention system in Phase 5.
        this.cognitiveLoad = 0;
        this.attention = 0;

        // The blink in flight. `elapsed` is negative-safe: -1 means no blink is running.
        this.elapsed = -1;
        this.closingDuration = 0;
        this.closedHold = 0;
        this.openingDuration = 0;

        // How far this blink closes, 0..1 of full closure. 1 for a complete blink.
        this.closureAmplitude = 1;

        // Whether each lid takes part at all, 0 or 1. This is what makes the rare unilateral
        // blink unilateral, and it is a different thing from the amplitude above: one says which
        // eyes blink, the other says how far.
        this.leftLidParticipation = 1;
        this.rightLidParticipation = 1;

        // The arrival process, built at bind time because `this.random` does not exist until the
        // stack forks it. Its own forked stream, so the intervals between blinks are decided by
        // the seed alone and never by how the shape draws happen to interleave with them.
        this.arrivals = null;

        // An arrival that lands inside a blink already in flight. It is held rather than dropped,
        // and fired at the exact instant that blink finishes — see advanceTimeline().
        this.arrivalPending = false;

        // Where the current blink stood when this frame began, so the closure snap can tell
        // whether the frame is about to step over full closure. -1 outside a blink; set to 0 by
        // beginBlink() for a blink that started part way through the frame.
        this.phaseAtFrameStart = -1;

        // 🚩 Only the rebuilt-defect path uses these two. See frameQuantisedArrivals.
        this.secondsUntilNextBlink = 0;
        this.lastSampledInterval = 0;

        // Aperture, not morph weight: 0 open, 1 shut. Published to the rest of the stack in these
        // units too, because "how shut are the eyes" is an answer about the eye, not about this
        // asset's blendshape range. See morphWeightFor().
        this.closure = 0;

        // Diagnostics. The selftest reads these; so does the critic harness.
        this.blinkCount = 0;
        this.lastBlinkWasUnilateral = false;

        // Whether THIS frame's reported closure was pulled back to the instant of closure. It is
        // the one place two frame rates are entitled to disagree, so the invariance gate needs to
        // be told which frames those are rather than re-deriving the rule and agreeing with itself.
        this.closureWasSnapped = false;

        // Preallocated so a running frame allocates nothing, and so any layer holding a reference
        // sees this frame's values without a lookup.
        this.publishedState = { closure: 0, isBlinking: false, ratePerMinute: 0 };

    }

    /**
     * The clock is armed here and nowhere else. `reset()` deliberately does not draw, because the
     * stack calls `reset()` and then `onBind()`; drawing in both would advance the layer's stream
     * one sample further on a reset run than on a fresh one, and the two runs would diverge.
     *
     * Rebuilt on every bind rather than in the constructor for two reasons: `this.random` does not
     * exist until the stack forks it, and `MotionStack.reset()` rewinds the stream and then calls
     * `onBind()` again — so a reset genuinely replays the same arrivals.
     */
    onBind() {

        this.arrivals = new PoissonSchedule( this.random.fork( 'arrival' ) );
        this.arrivalPending = false;

        if ( this.frameQuantisedArrivals ) this.scheduleNextBlinkTheOldWay();

    }

    // --- the frame -----------------------------------------------------------------------------

    update( deltaSeconds, context ) {

        this.phaseAtFrameStart = this.elapsed;

        this.advanceTimeline( deltaSeconds );

        this.closure = this.renderedClosure();

        this.publishedState.closure = this.closure;
        this.publishedState.isBlinking = this.elapsed >= 0;
        this.publishedState.ratePerMinute = this.effectiveRatePerMinute();
        context.shared.blink = this.publishedState;

        // Between blinks the lids belong to whatever expression is running, so say nothing.
        if ( this.closure === 0 ) return null;

        this.contribution.setMorph( LEFT_EYELID_MORPH, this.morphWeightFor( this.leftLidParticipation ) );
        this.contribution.setMorph( RIGHT_EYELID_MORPH, this.morphWeightFor( this.rightLidParticipation ) );

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
        this.rearmArrivalClock();
        return true;

    }

    /**
     * Starts a blink now, whatever the schedule said. For scripted beats and for the selftest.
     * Ignored while a blink is already in flight — a reflex does not restart mid-fall.
     *
     * @param {Object} [options]
     * @param {boolean} [options.unilateral] - Force or forbid the single-eye case.
     * @param {number} [options.closureAmplitude] - Force how far it closes, 0..1 of full closure.
     */
    blinkNow( options = {} ) {

        if ( this.elapsed >= 0 ) return false;

        this.beginBlink( options.unilateral, options.closureAmplitude );
        this.rearmArrivalClock();
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

        // The two velocity profiles describe the SHAPE of a blink; the amplitude scales it. A
        // partial blink is the same movement stopped short, not a different movement.
        const amplitude = this.closureAmplitude;

        if ( seconds < this.closingDuration ) {

            return amplitude * closureDuringDownphase( seconds / this.closingDuration );

        }

        const closedUntil = this.closingDuration + this.closedHold;
        if ( seconds <= closedUntil ) return amplitude;

        const openingProgress = ( seconds - closedUntil ) / this.openingDuration;
        if ( openingProgress >= 1 ) return 0;

        return amplitude * ( 1 - reopeningDuringUpphase( openingProgress ) );

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
     * `participation` is the per-eye 0 or 1 that makes a unilateral blink unilateral. This eye's
     * own amplitude is already in `closure`, which is why the ceiling holds for every blink: the
     * measured seal weight is reached when closure is 1 and never exceeded, because closure is a
     * fraction of full closure and full closure is what that weight means.
     */
    morphWeightFor( participation ) {

        return this.closure * participation * this.fullClosureMorphWeight;

    }

    /** Total wall time of the blink in flight, closing through fully open. */
    blinkDuration() {

        return this.closingDuration + this.closedHold + this.openingDuration;

    }

    // --- lifecycle -----------------------------------------------------------------------------

    reset() {

        this.elapsed = -1;
        this.closure = 0;
        this.closureAmplitude = 1;
        this.leftLidParticipation = 1;
        this.rightLidParticipation = 1;
        this.cognitiveLoad = 0;
        this.attention = 0;
        this.blinkCount = 0;
        this.lastBlinkWasUnilateral = false;
        this.closureWasSnapped = false;
        this.phaseAtFrameStart = -1;
        this.arrivalPending = false;

        // Left alone on purpose: the schedule is rebuilt in onBind(), which the stack calls
        // immediately after this, on a stream it has just rewound. Redrawing here as well would
        // put a reset run one sample ahead of a fresh one.
        this.secondsUntilNextBlink = 0;
        this.lastSampledInterval = 0;

    }

    // --- helpers -------------------------------------------------------------------------------

    /**
     * One frame of blink time, walked in sub-intervals split at each event.
     *
     * 🎯 THE FRAME IS CUT AT THE ARRIVAL, AND THAT IS THE WHOLE POINT — see the header. A blink
     * begins at the instant its interval was drawn for rather than at the next frame boundary, so
     * the onset times are a property of the seed and nothing else. The only thing the frame rate
     * decides is which frame first OBSERVES a blink that was always going to start when it did.
     *
     * The arrival is sampled as a pure exponential with no floor, because that is what "Poisson
     * process" means and a floor would put an 11% atom at the floor value. The refractory period
     * is instead enforced by DEFERRAL: an arrival that lands inside a blink already in flight
     * fires the moment that blink finishes. That is also what the eyelid physically does, and it
     * keeps the sampled distribution exactly exponential for anything that wants to test it — so
     * the frame is cut at the END of a blink too, and the deferred blink starts exactly there.
     * (The deferral is the one part of the interval that is NOT frame-coupled and never was: it
     * costs a rate-independent 13.32 ms per blink, measured at 480 Hz.)
     *
     * In-flight time is aged BEFORE new arrivals fire. That ordering was worth 0.48 mm in
     * `BodyIdle` and it is what makes the blink-end cut land the deferred blink on the right side
     * of the boundary.
     */
    advanceTimeline( deltaSeconds ) {

        const ratePerSecond = this.effectiveRatePerMinute() / SECONDS_PER_MINUTE;

        if ( this.frameQuantisedArrivals ) {

            this.advanceTheOldFrameQuantisedWay( deltaSeconds );
            return;

        }

        let remaining = deltaSeconds;

        while ( remaining > 0 ) {

            const step = Math.min( remaining, this.secondsUntilNextEvent( ratePerSecond ) );

            this.ageBlinkInFlight( step );
            this.arrivals.advance( ratePerSecond, step, () => { this.arrivalPending = true; } );

            remaining -= step;

            if ( this.arrivalPending === true && this.elapsed < 0 ) {

                this.arrivalPending = false;
                this.beginBlink();

            }

        }

    }

    /**
     * How far the walk above may step before something has to be decided: the next arrival, or the
     * instant the blink in flight finishes and frees the lids for a deferred one.
     */
    secondsUntilNextEvent( ratePerSecond ) {

        const untilArrival = this.arrivals.secondsUntilArrival( ratePerSecond );

        if ( this.elapsed < 0 ) return untilArrival;

        return Math.min( untilArrival, this.blinkDuration() - this.elapsed );

    }

    /** Ages the blink in flight by exactly `seconds`. Nothing here is quantised to a frame. */
    ageBlinkInFlight( seconds ) {

        if ( this.elapsed < 0 ) return;

        this.elapsed += seconds;

        if ( this.elapsed >= this.blinkDuration() - BLINK_END_EPSILON_SECONDS ) this.elapsed = -1;

    }

    /**
     * The eyelid closure this frame should RENDER, which is not always the closure at the instant
     * the frame ends.
     *
     * Trutoiu's finding is that a blink which never renders fully shut reads as wrong, and at
     * 60 Hz a 20 ms closed window is only two-thirds likely to be sampled at all — at 30 Hz, which
     * is what the judge captures, a partial blink's closed window is zero seconds wide and would
     * essentially never be sampled. So a frame that steps straight over the closed window reports
     * the closure at the instant of closure instead of the closure at its own end.
     *
     * 🎯 THIS IS A CORRECTION TO THE SAMPLE, NOT TO THE TIMELINE, and the distinction is the
     * second half of the frame-rate fix. The version this replaced pulled `elapsed` itself back to
     * the closure instant, which delayed everything after it in the blink by up to a frame and
     * made the remaining trajectory depend on the frame rate. The blink now runs on its own clock
     * and only the reported value is snapped, so two frame rates agree exactly at every instant
     * they share except the handful of frames where one of them needed the snap and the other
     * did not.
     *
     * A blink cannot start and finish inside one frame, so the peak can never be lost between two
     * blinks: the shortest blink the sampled durations allow is 50 + 0 + 150 = 200 ms, against a
     * `MotionStack.maxDeltaSeconds` of 100 ms. `ocular.selftest.mjs` asserts that margin.
     */
    renderedClosure() {

        this.closureWasSnapped = false;

        if ( this.elapsed < 0 ) return 0;

        // The rebuilt defect keeps the snap in the timeline, so the sample is just the timeline.
        if ( this.frameQuantisedArrivals ) return this.eyelidClosureAt( this.elapsed );

        const closureInstant = this.closingDuration;
        const closedUntil = closureInstant + this.closedHold;
        const previous = Math.max( this.phaseAtFrameStart, 0 );

        if ( previous < closureInstant && this.elapsed > closedUntil ) {

            this.closureWasSnapped = true;
            return this.eyelidClosureAt( closureInstant );

        }

        return this.eyelidClosureAt( this.elapsed );

    }

    /**
     * 🚩 THE DEFECT, REBUILT ON PURPOSE, so the invariance gate has something to reject (§1.1).
     *
     * Two frame couplings in six lines, and neither of them advances the random stream at the
     * frame rate — which is why the audit that converted `Sway` and `BodyIdle` by counting draws
     * per second walked straight past this file. The countdown fires on the first frame at or past
     * zero and re-arms with `= interval`, discarding the overshoot; and the closure snap is
     * written back into the timeline rather than into the sample.
     */
    advanceTheOldFrameQuantisedWay( deltaSeconds ) {

        this.secondsUntilNextBlink -= deltaSeconds;

        if ( this.secondsUntilNextBlink <= 0 && this.elapsed < 0 ) this.beginBlink();

        if ( this.elapsed < 0 ) return;

        const previous = this.elapsed;
        let next = previous + deltaSeconds;

        const closureInstant = this.closingDuration;
        const closedUntil = closureInstant + this.closedHold;

        if ( previous < closureInstant && next > closedUntil ) next = closureInstant;

        this.elapsed = next;

        if ( this.elapsed >= this.blinkDuration() ) this.elapsed = -1;

    }

    /**
     * Samples one blink's shape and starts it. Sampling here rather than at schedule time means a
     * blink recruited by a saccade is drawn from the same distribution as a spontaneous one.
     *
     * @param {boolean} [forceUnilateral] - Force or forbid the single-eye case.
     * @param {number} [forceAmplitude] - Force the closure amplitude, for scripted beats and for
     *   the selftest. Omit for the mixture this layer samples.
     */
    beginBlink( forceUnilateral, forceAmplitude ) {

        this.closingDuration = this.random.range( ...CLOSING_DURATION_RANGE_SECONDS );

        // The opening window is the intersection of its own recorded range with the ratio floor
        // against the closing just drawn, so both constraints hold for every blink.
        const ratioFloor = this.closingDuration * OPENING_TO_CLOSING_RATIO_RANGE[ 0 ];
        const ratioCeiling = this.closingDuration * OPENING_TO_CLOSING_RATIO_RANGE[ 1 ];

        const openingMinimum = Math.max( OPENING_DURATION_RANGE_SECONDS[ 0 ], ratioFloor );
        const openingMaximum = Math.min( OPENING_DURATION_RANGE_SECONDS[ 1 ], ratioCeiling );

        this.openingDuration = this.random.range( openingMinimum, Math.max( openingMaximum, openingMinimum ) );

        this.closureAmplitude = forceAmplitude ?? this.drawClosureAmplitude();

        // Only a complete blink has a moment with the lids resting together, because only a
        // complete blink has anything resting on anything. A partial blink turns straight round
        // at the bottom of its travel — and the closure snap in renderedClosure() still
        // guarantees a frame lands exactly on that instant, so the peak is never skipped.
        this.closedHold = this.closureAmplitude < 1
            ? 0 : this.random.range( ...CLOSED_HOLD_RANGE_SECONDS );

        const unilateral = forceUnilateral ?? this.random.chance( this.unilateralProbability );

        this.leftLidParticipation = 1;
        this.rightLidParticipation = 1;

        if ( unilateral === true ) {

            if ( this.random.chance( 0.5 ) ) this.leftLidParticipation = 0;
            else this.rightLidParticipation = 0;

        }

        this.lastBlinkWasUnilateral = unilateral === true;
        this.elapsed = 0;
        this.blinkCount ++;

        // A blink that starts part way through a frame has no earlier phase in this frame, so the
        // snap must judge it against 0 rather than against the -1 that stood at the frame's start.
        this.phaseAtFrameStart = 0;

        if ( this.frameQuantisedArrivals ) this.scheduleNextBlinkTheOldWay();

    }

    /**
     * How far this blink closes. A mixture of two populations rather than a spread around one
     * value — see the note on PARTIAL_BLINK_PROBABILITY for why the complete population is an
     * exact 1.0 and all the variety lives in the partial one.
     */
    drawClosureAmplitude() {

        if ( this.random.chance( this.partialBlinkProbability ) === false ) return 1;

        return this.random.range( ...this.partialClosureRange );

    }

    /**
     * Restarts the arrival clock from now. A blink that was recruited by something other than the
     * schedule — a saccade, a scripted beat — counts as a blink, so the next spontaneous one is
     * measured from THIS blink's onset rather than from the arrival that was already in flight.
     * Without it a talkative gaze policy would silently double the blink rate.
     *
     * Redrawing rather than keeping the outstanding wait is the memoryless property of the
     * process, so it changes the realisation and not the distribution.
     */
    rearmArrivalClock() {

        this.arrivalPending = false;

        if ( this.frameQuantisedArrivals ) {

            this.scheduleNextBlinkTheOldWay();
            return;

        }

        // Null until the layer has been added to a BOUND stack. A scripted `blinkNow()` before
        // that point is legal and has nothing to rearm — `onBind()` will draw the first arrival.
        if ( this.arrivals !== null ) this.arrivals.reset();

    }

    /**
     * 🚩 Part of the rebuilt defect. Arms the countdown that `advanceTheOldFrameQuantisedWay()`
     * walks. It draws from the arrival stream's own random, so the rebuild differs from the
     * shipped layer in the ONE property under test and not in which numbers come out of the seed.
     */
    scheduleNextBlinkTheOldWay() {

        const ratePerSecond = this.effectiveRatePerMinute() / SECONDS_PER_MINUTE;

        this.lastSampledInterval = this.arrivals.random.poissonInterval( ratePerSecond );
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
    PARTIAL_BLINK_PROBABILITY,
    PARTIAL_CLOSURE_RANGE,
    BASELINE_RATE_PER_MINUTE,
    CONVERSATION_RATE_RANGE_PER_MINUTE,
    COGNITIVE_LOAD_GAIN,
    VISUAL_ATTENTION_GAIN,
};

function clampToUnitRange( value ) {

    return Math.min( Math.max( value, 0 ), 1 );

}
