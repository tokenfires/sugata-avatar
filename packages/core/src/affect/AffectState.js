/**
 * AffectState — PAD on two timescales. Punch-list 5.1.
 *
 * WHAT IT IS FOR
 * --------------
 * research/affect-and-animation.md §8.3, "Smooth, don't switch":
 *
 *   > Never let a single utterance drive the rig. Asymmetric exponential smoothing — fast attack
 *   > ~150-250 ms, slow decay ~1.5-3 s — buys robustness for free and reads as emotional inertia.
 *   > ALMA's much slower mood layer (10-min change, 20-min return) sits above it.
 *   > That two-timescale structure is what makes a character feel continuous rather than reactive.
 *
 * So this module holds three PAD vectors, not one:
 *
 *   `target`   what the estimators most recently believed. Piecewise constant — it changes only
 *              when someone calls `push()`. Nothing renders from it.
 *   `emotion`  the fast layer. Asymmetric exponential toward `target`. Seconds.
 *   `mood`     the slow layer. Linear pursuit of `target`, returning to `defaultMood` when the
 *              target relaxes. Tens of minutes.
 *
 * and `pad` is their sum, clamped. Read `pad` to drive a face; read `mood` on its own for anything
 * that must not move at conversational speed.
 *
 * 🎯 THE MOOD LAYER IS NOT DECORATION. Phase 9's Dresser and Phase 10's identity work both gate on
 * it, because an avatar that changes clothes on a 200 ms affect spike strobes. `mood` is the only
 * signal in this file that is safe to hang a wardrobe change, an identity note or any other
 * expensive, visible, discrete decision on. The measured separation between the two layers is in
 * `affect.selftest.mjs`: one second of a full-scale target moves `emotion` by 0.993 and `mood` by
 * 0.00333, a ratio of 298:1.
 *
 *
 * WHY THE COMPOSITION IS A PLAIN SUM AND NOT A WEIGHTED BLEND
 * ----------------------------------------------------------
 * ALMA treats mood as the prevailing state that emotions are short-lived deviations FROM, so the
 * deviation adds to the baseline at unit weight. Any other weight would be a number this project
 * invented; `moodInfluence` exists so a caller can choose one deliberately, and its default is the
 * only value the literature licenses. The sum saturates — a long-cheerful avatar reads a merely
 * pleasant remark at the ceiling — and that is the mood layer doing its job, not an overflow.
 *
 *
 * 🚩 FRAME-RATE INVARIANCE, AND THE ONE PLACE IT NEARLY LEAKED
 * -----------------------------------------------------------
 * LEARNINGS §1.13 and §1.13a: four layers in `motion/` shipped a trajectory that depended on the
 * frame rate, and every rate, amplitude and spectral gate in the repo stayed green through all of
 * it. Two mechanisms did it, and neither was visible to a gate that measured the right quantity in
 * the wrong statistic.
 *
 * Both integrators here are exact:
 *
 *   - the fast layer uses `1 - exp(-dt/tau)`, whose composition over a split step is exactly its
 *     composition over the whole step. A fixed per-frame alpha (`v += (t-v)*0.15`) is the classic
 *     defect and is reachable as `defects.frameLerp` so the gate can shoot at it.
 *   - the slow layer moves at `rate * dt` and CLAMPS at its target, so the sum of the steps is the
 *     integral of the rate. `defects.moodPerFrame` is the per-frame-constant version.
 *
 * The subtle part is the ATTACK/DECAY BRANCH. A move that reverses sign passes through the
 * baseline, and the branch flips there — decay while the old feeling releases, then attack as the
 * new one comes up. That flip lands mid-frame, and a frame that straddles it while using one time
 * constant for its whole width makes the trajectory depend on where the frame boundaries fell.
 * `advanceExponential` therefore SOLVES for the crossing instant in closed form and cuts the frame
 * at it, which is the same discipline §1.13a describes for event arrivals. Measured cost of not
 * doing it: 0.0207 of an axis between 30 Hz and 120 Hz on a single sign reversal, against the
 * 1e-12 the split version achieves. `defects.noBranchSplit` reintroduces it.
 *
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * -----------------------------------------
 * It does not decide which emotion is showing — that is `ExpressionMap.js`, which thresholds and
 * saturates over the PAD point this file produces. It does not touch the figure. And it does not
 * estimate anything: `push()` is the only way affect gets in, and `ReflexAffect` (tier 1) and a
 * later `AppraisalAffect` (tier 2) are its two callers.
 */

/**
 * Attack time constant, seconds. research §8.3 states a band of 150-250 ms and no measurement
 * anywhere in `docs/research/` picks a point inside it, so this is its midpoint and is labelled as
 * one. It is a TIME CONSTANT, not a time-to-arrive: the value covers 1 - 1/e = 63.2% of the
 * remaining distance in one of these, and 95% in three (0.600 s).
 */
export const ATTACK_SECONDS = 0.200;

/**
 * Decay time constant, seconds. Midpoint of research §8.3's 1.5-3 s band, on the same footing as
 * ATTACK_SECONDS. 95% of the release completes in 6.75 s, which sits under ALMA's 20 s linear
 * emotion decay rather than contradicting it.
 */
export const DECAY_SECONDS = 2.25;

/**
 * ALMA's two mood timescales, verbatim from research §1: "Mood return to default: 20 minutes",
 * "Usual mood change time: 10 minutes".
 */
export const MOOD_CHANGE_SECONDS = 600;
export const MOOD_RETURN_SECONDS = 1200;

/**
 * The width of one PAD axis. ALMA's mood times are stated as durations for a mood transition and
 * ALMA's decay is linear, so the rate is a full axis traversal per stated duration. Writing the
 * span out means the two rates below are arithmetic rather than typed-in constants.
 */
export const PAD_AXIS_SPAN = 2;

export const MOOD_CHANGE_RATE = PAD_AXIS_SPAN / MOOD_CHANGE_SECONDS;   // 0.003333.. per second
export const MOOD_RETURN_RATE = PAD_AXIS_SPAN / MOOD_RETURN_SECONDS;   // 0.001666.. per second

export const PAD_AXES = Object.freeze( [ 'pleasure', 'arousal', 'dominance' ] );

/** The two axes a face is allowed to see. See `faceInput()`. */
export const FACE_AXES = Object.freeze( [ 'pleasure', 'arousal' ] );

export class AffectState {

    /**
     * @param {Object} [options]
     * @param {number} [options.attackSeconds=ATTACK_SECONDS]
     * @param {number} [options.decaySeconds=DECAY_SECONDS]
     * @param {number} [options.moodChangeSeconds=MOOD_CHANGE_SECONDS]
     * @param {number} [options.moodReturnSeconds=MOOD_RETURN_SECONDS]
     * @param {number} [options.moodInfluence=1] - Weight of `mood` in `pad`. See the header.
     * @param {{pleasure,arousal,dominance}} [options.defaultMood] - The mood this personality
     *   returns to. Origin unless a caller states otherwise; Phase 10 identity work owns it,
     *   because "cheerful by default" is a trait and not a state.
     * @param {Object} [options.defects] - 🚩 Gate fodder only. Named ways this module could be
     *   wrong, each reachable so `affect.selftest.mjs` can prove its gates red. See DEFECTS.
     */
    constructor( options = {} ) {

        this.attackSeconds = options.attackSeconds ?? ATTACK_SECONDS;
        this.decaySeconds = options.decaySeconds ?? DECAY_SECONDS;

        this.moodChangeRate = PAD_AXIS_SPAN / ( options.moodChangeSeconds ?? MOOD_CHANGE_SECONDS );
        this.moodReturnRate = PAD_AXIS_SPAN / ( options.moodReturnSeconds ?? MOOD_RETURN_SECONDS );

        this.moodInfluence = options.moodInfluence ?? 1;

        this.defaultMood = toPad( options.defaultMood ?? {} );

        this.target = toPad( options.target ?? {} );
        this.emotion = toPad( options.emotion ?? {} );
        this.mood = { ...this.defaultMood };

        this.defects = { ...DEFECTS_OFF, ...( options.defects ?? {} ) };

        /** Motion time, the integral of the deltas handed to `update`. Diagnostics only. */
        this.time = 0;

    }

    // --- input ------------------------------------------------------------------------------

    /**
     * States what an estimator now believes, optionally per-axis confident.
     *
     * Confidence is a BLEND, not a gate: research/lm-studio-integration.md's two-tier design says
     * the slow appraisal is "blended into the running state rather than snapped to, so the
     * correction reads as a natural settling rather than a pop", and the same mechanism lets tier
     * 1 offer a weak dominance estimate without that weak estimate owning the axis. A confidence
     * of 1 replaces the axis outright; 0 leaves it alone.
     *
     * @param {Object} estimate - `{pleasure, arousal, dominance}`, any subset, each in [-1, 1].
     * @param {number|Object} [estimate.confidence=1] - A scalar, or `{pleasure, arousal, dominance}`.
     */
    push( estimate = {} ) {

        const confidence = estimate.confidence ?? 1;

        for ( const axis of PAD_AXES ) {

            const proposed = estimate[ axis ];
            if ( typeof proposed !== 'number' || Number.isNaN( proposed ) ) continue;

            const weight = clamp( typeof confidence === 'number' ? confidence : ( confidence[ axis ] ?? 0 ), 0, 1 );
            if ( weight === 0 ) continue;

            this.target[ axis ] = clampAxis(
                this.target[ axis ] * ( 1 - weight ) + clampAxis( proposed ) * weight );

        }

        return this;

    }

    /**
     * Drops the target straight to neutral. The layers still release at their own time constants,
     * which is the point — "calm down" is not the same instruction as "freeze".
     */
    release() {

        for ( const axis of PAD_AXES ) this.target[ axis ] = 0;
        return this;

    }

    // --- the clock ---------------------------------------------------------------------------

    /**
     * Advances both layers by `deltaSeconds`.
     *
     * @param {number} deltaSeconds
     * @returns {{pleasure, arousal, dominance}} `this.pad`, for callers that want it inline.
     */
    update( deltaSeconds ) {

        const dt = Number.isFinite( deltaSeconds ) && deltaSeconds > 0 ? deltaSeconds : 0;

        this.time += dt;

        for ( const axis of PAD_AXES ) {

            this.emotion[ axis ] = this.advanceEmotionAxis( this.emotion[ axis ], this.target[ axis ], dt );
            this.mood[ axis ] = this.advanceMoodAxis( this.mood[ axis ], this.target[ axis ], this.defaultMood[ axis ], dt );

        }

        return this.pad;

    }

    /**
     * The fast layer, one axis.
     *
     * ATTACK while the magnitude relative to the baseline is growing, DECAY while it is shrinking.
     * That is the plain envelope reading of the two words, and it puts the branch flip at the
     * baseline crossing, where it can be solved for exactly.
     */
    advanceEmotionAxis( value, target, dt ) {

        if ( dt === 0 || value === target ) return value;

        if ( this.defects.frameLerp === true ) {

            // 🚩 The classic. Right steady state, right-looking curve, trajectory owned by the
            // frame rate. LEARNINGS §1.13.
            return value + ( target - value ) * FRAME_LERP_DEFECT_ALPHA;

        }

        // 🚩 Perfectly frame-rate invariant and perceptually wrong: an emotion that releases as
        // fast as it arrives has no inertia and every utterance snaps the face.
        const decaySeconds = this.defects.symmetricSmoothing === true
            ? this.attackSeconds
            : this.decaySeconds;

        return advanceExponential( {
            value,
            target,
            baseline: 0,
            dt,
            attackSeconds: this.attackSeconds,
            decaySeconds,
            splitAtBaseline: this.defects.noBranchSplit !== true
        } );

    }

    /**
     * The slow layer, one axis. Linear, because ALMA's decay is linear and its mood numbers are
     * stated as transition DURATIONS; an exponential would need a duration-to-time-constant
     * conversion this project has no basis for.
     *
     * Same attack/decay predicate as the fast layer, at ALMA's two rates: a target that pulls the
     * mood further from its default is a mood CHANGE (10 min), one that lets it settle back is a
     * RETURN (20 min). No "is an emotion active" epsilon is needed, which is the reason for
     * reusing the predicate rather than writing a threshold.
     */
    advanceMoodAxis( value, target, baseline, dt ) {

        if ( dt === 0 || value === target ) return value;

        if ( this.defects.moodPerFrame === true ) {

            // 🚩 A per-FRAME step instead of a per-SECOND rate. Identical at 60 Hz, half as fast at
            // 30 Hz, twice as fast at 120 Hz.
            const step = this.moodChangeRate / 60;
            return value + Math.sign( target - value ) * Math.min( step, Math.abs( target - value ) );

        }

        return advanceLinear( {
            value,
            target,
            baseline,
            dt,
            attackRate: this.moodChangeRate,
            decayRate: this.moodReturnRate,
            splitAtBaseline: this.defects.noBranchSplit !== true
        } );

    }

    // --- output ------------------------------------------------------------------------------

    /**
     * The composite PAD point everything downstream reads. Emotion plus mood, clamped per axis.
     */
    get pad() {

        return {
            pleasure: clampAxis( this.emotion.pleasure + this.mood.pleasure * this.moodInfluence ),
            arousal: clampAxis( this.emotion.arousal + this.mood.arousal * this.moodInfluence ),
            dominance: clampAxis( this.emotion.dominance + this.mood.dominance * this.moodInfluence )
        };

    }

    /**
     * 🚩 THE ONLY PAD A FACE MAY SEE, AND THE REASON THE TYPE HAS TWO FIELDS INSTEAD OF THREE.
     *
     * Arellano et al. (AMDO 2014), n=109, 216 generated images, SAM ratings: pleasure was reliably
     * identified from a static face, arousal mostly, "dominance not at all". research §1 draws the
     * conclusion this project treats as structural — "dominance must be carried by posture, gaze
     * policy, interruption behaviour and gesture amplitude, never by the face."
     *
     * A comment saying so would be a policy. A return type with no `dominance` key is a mechanism:
     * `ExpressionMap.face()` THROWS on any input carrying one, so the mistake surfaces on the first
     * frame rather than as a face that subtly reads wrong. The object is frozen so a caller cannot
     * add the axis back on the way past.
     */
    faceInput() {

        const pad = this.pad;
        return Object.freeze( { pleasure: pad.pleasure, arousal: pad.arousal } );

    }

    /** All three axes, for posture, gaze policy and gesture amplitude. Phase 6 consumes this. */
    bodyInput() {

        return Object.freeze( this.pad );

    }

    /**
     * The MOOD layer, tagged with which layer it is.
     *
     * 🚩 The tag is not ceremony. `pad` and `mood` are the same three field names carrying two
     * different time constants — 0.2 s attack against 600 s — and `WardrobeAgency.readMood`
     * REFUSES anything not tagged `mood`, because outfit selection driven off the fast layer
     * changes the avatar's clothes mid-sentence (punch-list 9.11, 9.13).
     *
     * Measured separation, so the refusal is a number rather than an opinion: one second of a
     * full-scale target moves the fast layer 298x further than the slow one.
     */
    readMood() {

        return { layer: 'mood', ...this.mood };

    }

    /** Mood strength, ALMA's definition: distance from the origin, maximum norm sqrt(3). */
    get moodStrength() {

        return Math.hypot( this.mood.pleasure, this.mood.arousal, this.mood.dominance );

    }

    /**
     * ALMA's eight mood octants, by sign. Named because a wardrobe or an identity note wants a
     * word, not three floats — and because Arellano's validated per-mood AU sets are indexed by
     * exactly this.
     */
    get moodOctant() {

        return octantName( this.mood );

    }

    /** Back to a cold start, keeping the configuration. Mirrors `Layer.reset()`'s contract. */
    reset() {

        this.target = toPad( {} );
        this.emotion = toPad( {} );
        this.mood = { ...this.defaultMood };
        this.time = 0;

    }

}

/**
 * 🚩 Ways this module could be wrong, each reachable so a gate can be proved red against it.
 *
 * LEARNINGS §1.25a: "Write the known-bad you were going to write. Then write a second one you did
 * NOT have in mind when you designed the gate." The class being defended is *any integrator whose
 * trajectory depends on where the frame boundaries fell*, and these are three structurally
 * different members of it — a wrong alpha, a wrong unit, and a right integrator cut in the wrong
 * place. `symmetricSmoothing` is in a different class again: perfectly frame-rate invariant and
 * perceptually wrong.
 */
export const DEFECTS = Object.freeze( {
    frameLerp: 'fast layer advances by a fixed per-frame fraction instead of 1 - exp(-dt/tau)',
    moodPerFrame: 'slow layer advances by a per-frame step instead of rate * dt',
    noBranchSplit: 'the attack/decay flip is not cut at the baseline crossing',
    symmetricSmoothing: 'decay uses the attack time constant — no emotional inertia'
} );

const DEFECTS_OFF = Object.freeze( Object.fromEntries( Object.keys( DEFECTS ).map( ( key ) => [ key, false ] ) ) );

/** The alpha `defects.frameLerp` uses. Chosen to look right at 60 Hz, which is how it survives. */
const FRAME_LERP_DEFECT_ALPHA = 0.15;

// --- integrators ----------------------------------------------------------------------------

/**
 * One axis of asymmetric exponential smoothing, over one frame, exactly.
 *
 * The whole reason this is a function rather than three lines inline: the attack/decay branch can
 * flip inside the frame, and a frame that straddles the flip must be cut at it. `splitAtBaseline`
 * false is the defect.
 */
function advanceExponential( { value, target, baseline, dt, attackSeconds, decaySeconds, splitAtBaseline } ) {

    const intensifying = isIntensifying( value, target, baseline );
    const tau = intensifying ? attackSeconds : decaySeconds;

    if ( intensifying === true || splitAtBaseline === false ) {

        return approachExponential( value, target, tau, dt );

    }

    // Releasing. If the target is on the far side of the baseline the value will cross it inside
    // this frame or a later one; solve for when, and if it is inside this frame, cut there.
    const crossing = exponentialCrossingTime( value, target, baseline, decaySeconds );

    if ( crossing === null || crossing >= dt ) {

        return approachExponential( value, target, tau, dt );

    }

    // Exactly at the baseline at `crossing`, then attacking for the remainder.
    return approachExponential( baseline, target, attackSeconds, dt - crossing );

}

/** `v + (t - v) * (1 - exp(-dt/tau))`, written so tau <= 0 degenerates to a snap rather than a NaN. */
function approachExponential( value, target, tau, dt ) {

    if ( ! ( tau > 0 ) ) return target;

    return value + ( target - value ) * ( 1 - Math.exp( -dt / tau ) );

}

/**
 * When an exponential release from `value` toward `target` passes through `baseline`, or null if
 * it never does. Derived from v(t) = target + (value - target) * exp(-t/tau).
 */
function exponentialCrossingTime( value, target, baseline, tau ) {

    if ( ! ( tau > 0 ) ) return null;

    const ratio = ( baseline - target ) / ( value - target );

    // Outside (0, 1) the baseline is not between the value and its target, so it is never reached.
    if ( ! ( ratio > 0 && ratio < 1 ) ) return null;

    return -tau * Math.log( ratio );

}

/** The same shape for a linear pursuit. Clamping at the target is what makes the sum exact. */
function advanceLinear( { value, target, baseline, dt, attackRate, decayRate, splitAtBaseline } ) {

    const intensifying = isIntensifying( value, target, baseline );
    const rate = intensifying ? attackRate : decayRate;

    if ( intensifying === true || splitAtBaseline === false ) {

        return stepToward( value, target, rate * dt );

    }

    const distanceToBaseline = Math.abs( value - baseline );
    const crossesBaseline = ( target - baseline ) * ( value - baseline ) < 0;
    const crossing = crossesBaseline ? distanceToBaseline / decayRate : null;

    if ( crossing === null || crossing >= dt ) return stepToward( value, target, rate * dt );

    return stepToward( baseline, target, attackRate * ( dt - crossing ) );

}

function stepToward( value, target, step ) {

    const remaining = target - value;
    if ( Math.abs( remaining ) <= step ) return target;

    return value + Math.sign( remaining ) * step;

}

/**
 * The shared predicate. True when the move takes the value FURTHER from its baseline.
 *
 * A value sitting exactly on the baseline counts as intensifying, because any move off it is an
 * onset. This is the one comparison that decides attack versus decay in both layers, and reusing
 * it is why the mood layer needs no separate "is an emotion active" threshold.
 */
function isIntensifying( value, target, baseline ) {

    const displacement = value - baseline;
    if ( displacement === 0 ) return true;

    return Math.sign( target - value ) === Math.sign( displacement );

}

// --- helpers ---------------------------------------------------------------------------------

function toPad( source ) {

    return {
        pleasure: clampAxis( source.pleasure ?? 0 ),
        arousal: clampAxis( source.arousal ?? 0 ),
        dominance: clampAxis( source.dominance ?? 0 )
    };

}

function clampAxis( value ) {

    if ( typeof value !== 'number' || Number.isNaN( value ) ) return 0;
    return clamp( value, -1, 1 );

}

function clamp( value, low, high ) {

    return Math.min( Math.max( value, low ), high );

}

/**
 * ALMA's eight octants, research §1: "Exuberant/Bored, Dependent/Disdainful, Relaxed/Anxious,
 * Docile/Hostile." Each pair is a sign triple and its negation.
 */
export function octantName( { pleasure, arousal, dominance } ) {

    // The origin has no octant. ALMA defines mood strength as the distance from it, so a mood of
    // zero strength is 'neutral' rather than whichever corner the >= happens to fall into — which
    // was 'exuberant', and a cold-start avatar reported as exuberant is a wardrobe bug waiting.
    if ( pleasure === 0 && arousal === 0 && dominance === 0 ) return 'neutral';

    const p = pleasure >= 0, a = arousal >= 0, d = dominance >= 0;

    if ( p && a && d ) return 'exuberant';
    if ( ! p && ! a && ! d ) return 'bored';
    if ( p && a && ! d ) return 'dependent';
    if ( ! p && ! a && d ) return 'disdainful';
    if ( p && ! a && d ) return 'relaxed';
    if ( ! p && a && ! d ) return 'anxious';
    if ( p && ! a && ! d ) return 'docile';
    return 'hostile';

}
