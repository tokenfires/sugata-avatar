/**
 * Gaze — where the eyes point, how they get there, and when they look away.
 *
 * Schwind et al. (2018) eye-tracked ~75 characters and found users fixate the eyes *first*,
 * before assessing any other feature. Every error in this file is therefore seen before
 * anything else in the renderer is, which is why it is worth building from measurements rather
 * than from feel. Everything numbered below is either quoted from
 * `docs/research/affect-and-animation.md` §4 (Ruhland et al. 2015 and the sources it collects)
 * or measured off the shipped figure. Anything that is neither is marked TUNABLE and says so.
 *
 *
 * THE THREE THINGS THIS FILE DOES
 *
 *   1. SACCADES on the main sequence. Amplitude determines peak velocity and duration; nothing
 *      about a saccade is free-floating. 10° ≈ 300°/s, 30° ≈ 500°/s, saturating past 15–20°.
 *      Fixations between them are exponentially distributed, floored at the 150 ms minimum
 *      intersaccadic interval. Microsaccades ride on top at 1–2/s. Drift and tremor are
 *      deliberately absent — tremor is 50–100 Hz at <0.01°, below any display's resolution.
 *
 *   2. EYE–HEAD COORDINATION. The saccade animates the gaze point in *rig* space, and the eye
 *      angle is whatever is left after the head has moved: `eye = gaze − head`. That one line is
 *      the VOR — counter-rotation with gain 1.0 — and it falls out of the formulation rather
 *      than being bolted on, so it compensates for breath and sway and nods as well as for the
 *      head motion gaze itself asked for.
 *
 *   3. CONVERSATIONAL GAZE POLICY, from BEAT (Cassell, Vilhjálmsson & Bickmore, SIGGRAPH 2001):
 *      gaze away at THEME 70%, toward at RHEME 73%. Note that TalkingHead ships 0.2 listening /
 *      0.5 speaking, which inverts the Kendon/Argyle finding — a listener looks at the speaker
 *      almost all the time. We use BEAT's.
 *
 *
 * WHAT DRIVES THE EYES ON THIS ASSET
 *
 * The MakeHuman `game_engine` rig has NO EYE BONES (see figure/Skeleton.js). Gaze is the eight
 * ARKit `eyeLook{In,Out,Up,Down}{Left,Right}` morphs, and how far each one actually turns the
 * eyeball is a property of the asset, not of ARKit. Measured by Kabsch-fitting the rigid
 * rotation of the 48 eyeball vertices per side against each morph target, on all three points
 * of the gender sweep:
 *
 *              g000     g050     g100
 *     in      14.98°   14.77°   14.50°
 *     out     14.64°   14.27°   13.87°
 *     up       9.73°    9.64°    9.52°
 *     down    11.29°   11.09°   10.86°
 *
 * ⚠️ That is the whole ocular range this figure has: about ±14.5° horizontal and +9.6/−11.1°
 * vertical at morph weight 1.0. It is roughly a third of the human oculomotor range, and it is
 * the reason head recruitment is not optional here — a 25° gaze shift is unreachable by eyes
 * alone. Horizontally the numbers are kind: the 15–20° physiological head-recruitment threshold
 * sits just above the 14.5° the morphs give, so the asset's limit and the literature's threshold
 * do not fight.
 *
 * 🚩 VERTICALLY THEY DO, AND THAT IS WORTH SAYING OUT LOUD. 9.6° of upward travel is well BELOW
 * any head-recruitment threshold in the literature, so a policy that treats the two axes alike
 * asks the eye for vertical angles it does not have, gets them clipped, and parks the irises
 * under the upper lids with a band of sclera showing beneath. Three things keep that from
 * happening, and all three are needed: the recruitment threshold scales with each axis' own
 * excursion (`headRecruitmentThresholdDegrees`), the head is obliged to carry anything past a
 * comfortable fraction of it (EYE_COMFORT_FRACTION), and the policy's own vertical targets are
 * held inside what the eye can reach unaided (POLICY_VERTICAL_BUDGET_FRACTION). Gated in
 * `Gaze.selftest.mjs`, which measures the fraction of frames spent at the vertical limit.
 *
 *
 * RIG CONVENTIONS, MEASURED NOT ASSUMED
 *
 * The figure is Y-up and faces +Z; the character's own LEFT is +X (verified: `eyeLookOutLeft`
 * displaces the +X eyeball toward +X, i.e. temporally). So throughout this file:
 *
 *     yawDegrees    positive turns gaze toward the figure's own left  (right-handed about +Y)
 *     pitchDegrees  positive raises gaze
 *
 * Both are measured from the head's REST forward direction, so they are head-relative when they
 * describe an eye and rig-relative when they describe gaze. Interpupillary distance measures
 * 58.5 mm; vergence for near targets is deliberately not modelled — every target this layer is
 * given is a direction, not a point, and at conversational distance the vergence angle is under
 * a degree.
 *
 *
 * USAGE
 *
 *     const gaze = new Gaze();
 *     stack.add( gaze );
 *     stack.add( gaze.head );          // the head half; omit it for an eyes-only figure
 *
 *     gaze.setConversationState( 'speaking' );
 *     gaze.setDiscourse( 'rheme' );
 *     gaze.markFilledPause();
 *     gaze.markTurnEnd();
 *     gaze.lookAt( { yawDegrees: -20, pitchDegrees: 5 }, { predicted: true } );
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';

// --- measured on the shipped figure -----------------------------------------------------------

/**
 * Degrees of eyeball rotation at morph weight 1.0, from figure_g050.glb. The spread across the
 * gender sweep is under 3%, so one set of numbers covers all five figures; override through
 * `options.eyeExcursionDegrees` for a different asset.
 */
export const EYE_MORPH_EXCURSION_DEGREES = {
    in: 14.77,
    out: 14.27,
    up: 9.64,
    down: 11.09
};

/** The rig's own axes, measured. Forward is where a zero-yaw, zero-pitch gaze points. */
const RIG_FORWARD = new Vector3( 0, 0, 1 );

// --- the main sequence ------------------------------------------------------------------------

/*
 * Peak velocity saturates exponentially with amplitude:
 *
 *     V(A) = Vmax · ( 1 − exp( −A / C ) )
 *
 * The research gives two anchors — 10° ≈ 300°/s and 30° ≈ 500°/s — which is exactly enough to
 * solve for both constants. Writing x = exp( −10 / C ), the ratio 300/500 = 0.6 gives
 * ( 1 − x ) / ( 1 − x³ ) = 0.6, i.e. 1 + x + x² = 5/3, so x = 0.457427 and:
 *
 *     C    = −10 / ln( 0.457427 ) = 12.788°
 *     Vmax = 300 / ( 1 − 0.457427 ) = 552.9 °/s
 *
 * The curve then reproduces both anchors exactly and saturates where the literature says it
 * does: 437°/s at 20°, 500 at 30°, 531 at 40°, against an asymptote of 553.
 */
const SACCADE_PEAK_VELOCITY_ASYMPTOTE = 552.9;
const SACCADE_VELOCITY_CONSTANT_DEGREES = 12.788;

/*
 * Velocity profile shape, as a Tukey window: a flat middle with raised-cosine ramps over
 * `taper/2` at each end. Its mean/peak ratio is exactly 1 − taper/2, which is the only property
 * that matters here, because amplitude, peak velocity and duration are not independent —
 * A = ∫v dt ties them together. Peak velocity is the anchored quantity (it is what "the main
 * sequence" names), so duration is derived: D = A / ( q · V(A) ).
 *
 * 🚩 The literature's velocity and duration figures come from different studies and are NOT
 * mutually consistent under any profile: a symmetric bell has q ≈ 0.5, which would put a 30°
 * saccade at 120 ms against a stated <100 ms. Choosing q = 0.75 lands every derived duration
 * inside the stated bands — 5° at 37 ms and 10° at 44 ms against "5–10° at 30–40 ms", 30° at
 * 80 ms against "<100 ms" — and the research is explicit that profile shape is invisible to
 * observers anyway ("symmetric bell velocity profiles are fine; asymmetry is invisible").
 */
const SACCADE_VELOCITY_TAPER = 0.5;

/** Saccade latency from decision to movement onset. */
const SACCADE_LATENCY_SECONDS = 0.2;

/** No new saccade may start within this long of the last one ending. */
const MINIMUM_INTERSACCADIC_SECONDS = 0.15;

// --- microsaccades ----------------------------------------------------------------------------

const MICROSACCADE_RATE_PER_SECOND = 1.5;        // the research gives 1-2/s
const MICROSACCADE_DURATION_SECONDS = 0.025;

/**
 * 30 arcmin, fixed rather than distributed. The research records a MEAN amplitude and no spread,
 * and at this scale the difference is not worth inventing a number for: a plausible ±0.15° of
 * variation is one percent of the eye's total range on this asset.
 */
const MICROSACCADE_AMPLITUDE_DEGREES = 0.5;

/**
 * How far the accumulated microsaccade offset may wander from the fixation centre. A memoryless
 * walk with no bound would slide off the target over a long fixation, and that slide is exactly
 * the ocular drift the research tells us to skip. Clamping the offset is how you get one without
 * the other.
 */
const MICROSACCADE_OFFSET_CAP_DEGREES = 1;

// --- eye–head coordination --------------------------------------------------------------------

/**
 * Below this, a HORIZONTAL gaze shift is eyes-only. Physiology puts the threshold at 15–20°;
 * graphics implementations use 10–15° and this asset's eyes saturate at 14.3°, so 12° is the
 * choice.
 *
 * ⚠️ The vertical threshold is NOT this number. It is this number scaled by how much less
 * vertical range the asset has — see `headRecruitmentThresholdDegrees()`. A single threshold is
 * the defect this used to have: 12° is 84% of the horizontal excursion but 124% of the upward
 * one, so a 12° upward gaze recruited no head at all and drove the eye a fifth of the way past
 * the top of its range. The irises then jam under the lids with a band of sclera below them,
 * which is the single ugliest thing this layer can do and it was doing it on 15.6% of frames.
 */
const HEAD_RECRUITMENT_THRESHOLD_DEGREES = 12;

/**
 * TUNABLE. How much of its own range an eye is allowed to settle at before the head is obliged
 * to carry the remainder.
 *
 * The old rule recruited exactly enough head to leave the eye AT its limit, which is arithmetic
 * that satisfies the geometry and fails the picture: an eye parked on the last degree of its
 * morph is a stuck eye, and any further motion from any other source — breath, sway, a nod —
 * cannot be compensated because the reflex has nowhere left to go. Leaving a sixth of the range
 * in hand costs a couple of degrees of extra head and buys the VOR somewhere to work.
 *
 * ⚠️ This must stay ABOVE the recruitment threshold's own fraction of the range — 12 / 14.27 =
 * 0.841 on this asset — or the head starts being recruited below the literature's threshold and
 * "a shift under 12° is eyes-only" stops being true. `Gaze.selftest.mjs` checks that directly.
 */
const EYE_COMFORT_FRACTION = 0.85;

/** REACTIVE shift: the head starts this long after the eyes. Research gives 20–50 ms. */
const HEAD_FOLLOW_MINIMUM_SECONDS = 0.02;
const HEAD_FOLLOW_MAXIMUM_SECONDS = 0.05;

/**
 * PREDICTED shift: the head starts this long BEFORE the eyes.
 *
 * This is the single cheapest tell in the whole ocular layer. An avatar that already knows where
 * it is about to look moves its head first, and viewers read that as intent; the same shift with
 * the head trailing reads as a reflex to something off-screen. It costs one signed offset.
 */
const HEAD_LEAD_SECONDS = 0.1;

/**
 * How much of a gaze shift the head takes, beyond the recruitment threshold. Andrist et al.
 * found this one scalar switches social register: MORE head reads affiliative and raises
 * rapport, LESS head reads referential and improves learning. It is a dial for the character's
 * relationship to whoever it is talking to, not a rendering detail.
 */
const DEFAULT_HEAD_ALIGNMENT = 0.7;

/**
 * TUNABLE. Head-movement smoothing time at speed 1.0. The research says head speed is
 * voluntarily modulable and therefore expressive, where saccade speed is not — but it gives no
 * number for it, so this is a starting point and `setHeadSpeed()` is the expressive channel.
 */
const HEAD_SMOOTH_TIME_SECONDS = 0.18;

/**
 * TUNABLE safety clamps, from cervical range of motion rather than from the research doc:
 * axial rotation ~75° each way, extension ~70°, flexion ~50°. Held well inside those, because a
 * neck at its anatomical limit reads as a medical event.
 */
const HEAD_YAW_LIMIT_DEGREES = 55;
const HEAD_PITCH_UP_LIMIT_DEGREES = 35;
const HEAD_PITCH_DOWN_LIMIT_DEGREES = 45;

/** Vestibulo-ocular reflex gain. 1.0 is the measured human value; the latency is discussed below. */
const DEFAULT_VOR_GAIN = 1;

// --- conversational policy --------------------------------------------------------------------

/**
 * Probability that a given gaze act is directed AT the conversational partner.
 *
 * Every figure here is a proportion of time from the literature, and it is read as a probability
 * per gaze act because region dwell is drawn from the same distribution whichever direction is
 * chosen — so the proportion of acts and the proportion of time agree in expectation.
 *
 * `speaking` and `fluent` disagree, and the disagreement is real rather than a mistake: 71%
 * toward is Kendon's overall speaking figure, 50% is the figure for FLUENT speech specifically.
 * They come from different measures and cannot be reconciled, so fluency is opt-in and, once
 * set, wins — it is the more specific measurement.
 */
export const GAZE_TOWARD_PROBABILITY = {
    theme: 0.3,       // BEAT: gaze AWAY 70% of the time at theme
    rheme: 0.73,      // BEAT: gaze TOWARD 73% at rheme
    listening: 0.9,   // listener gazes away ~10%
    speaking: 0.71,   // speaker gazes away ~29%
    fluent: 0.5,      // speakers look at listeners ~50% during fluent speech
    hesitant: 0.203,  // and only 20.3% during hesitant speech
    idle: 0.15        // TUNABLE — no partner engaged, so no literature figure applies
};

/**
 * TUNABLE. Mean time spent in one gaze region before the policy reconsiders. The research fixes
 * the *proportions* of toward and away but not the granularity, and granularity is what this
 * controls: shorter makes a twitchier, more surveying character at the same proportions.
 */
const REGION_HOLD_MEAN_SECONDS = 1.8;
const REGION_HOLD_MINIMUM_SECONDS = 0.4;

/**
 * TUNABLE. Mean fixation inside the current region — the small exploratory saccades that scan a
 * face. Drawn exponentially, which the research does fix, and floored at the minimum
 * intersaccadic interval, which it also fixes. Only the mean is ours.
 */
const FIXATION_MEAN_SECONDS = 0.35;

/** TUNABLE. Amplitude of those within-region saccades — the 5–10° the research calls typical. */
const EXPLORATORY_SACCADE_MINIMUM_DEGREES = 3;
const EXPLORATORY_SACCADE_MAXIMUM_DEGREES = 9;

/**
 * TUNABLE. A scan of a face is a flattened ellipse, not a circle: the informative things to look
 * at in conversation are laid out sideways — the other eye, the mouth corner, the person next to
 * them — and almost nothing worth fixating is directly above. Squashing the vertical component
 * of the exploratory saccade is therefore both what people do and what this asset can afford,
 * since its eyes have two thirds the vertical range they have horizontal.
 *
 * A purely vertical exploratory saccade is correspondingly smaller than a purely horizontal one.
 * That is the intent, not a rounding error.
 */
const EXPLORATORY_VERTICAL_FRACTION = 0.45;

/**
 * TUNABLE. Where "away" is. The yaw offsets start beyond the exploratory range so that an
 * aversion cannot be mistaken for a scan of the partner's face, and stay inside a comfortable
 * head turn.
 */
const AVERSION_YAW_MINIMUM_DEGREES = 15;
const AVERSION_YAW_MAXIMUM_DEGREES = 40;

/**
 * TUNABLE. The vertical half of an aversion, as a fraction of the asset's own vertical eye
 * range rather than as a fixed angle. Written this way because the number that matters is how
 * much of the eye's travel an aversion spends, and that is a property of the asset: the same
 * ±20° that is comfortable on a rig with a full ±30° oculomotor range is off the end of the
 * morph on this one.
 */
const AVERSION_PITCH_FRACTION_OF_EYE_RANGE = 0.6;

/**
 * TUNABLE. Ceiling on the vertical gaze angle the POLICY may ask for, again as a fraction of the
 * asset's vertical eye range.
 *
 * This is the backstop that makes the saturation gate hold. Head recruitment alone does not: the
 * head takes ~180 ms to arrive and the eyes get there in ~50 ms, so for the difference the eye
 * carries the WHOLE shift, and a target the eye cannot reach on its own is a target that pins
 * the eye for a fifth of a second every time it is chosen. Keeping the policy's own targets
 * inside what the eye can reach unaided means the transit is never at the limit either.
 *
 * `lookAt()` is deliberately NOT clamped by this. An external caller aiming at something real
 * must be able to ask for 30° up, and an eye that hits its limit while the head catches up on a
 * shift that large is what a real eye does.
 */
const POLICY_VERTICAL_BUDGET_FRACTION = 0.8;

/**
 * TUNABLE durations for the two discourse events. The research establishes that both happen and
 * what they mean — aversion during a filled pause is a speech-planning signal; the mutual-break
 * pattern is speaker-looks-at-listener, brief mutual gaze, listener breaks and takes the floor —
 * but not how long either lasts. Both are arguments to the marker functions.
 */
const FILLED_PAUSE_AVERSION_SECONDS = 0.8;
const MUTUAL_GAZE_SECONDS = 0.6;
const TURN_TAKING_BREAK_SECONDS = 0.4;

/** Gaze shifts at least this large tend to co-occur with a blink. */
const BLINK_CO_OCCURRENCE_THRESHOLD_DEGREES = 30;

// --- pure main-sequence functions --------------------------------------------------------------

/**
 * Peak angular velocity of a saccade of this amplitude, in degrees per second.
 * Exported because it is the claim this file most needs a reviewer to check against Ruhland
 * et al. — `Gaze.selftest.mjs` prints the curve for exactly that reason.
 */
export function saccadePeakVelocityDegreesPerSecond( amplitudeDegrees ) {

    const amplitude = Math.abs( amplitudeDegrees );

    return SACCADE_PEAK_VELOCITY_ASYMPTOTE *
        ( 1 - Math.exp( -amplitude / SACCADE_VELOCITY_CONSTANT_DEGREES ) );

}

/**
 * How long that saccade takes. Derived, not independent: with a fixed velocity profile the
 * amplitude is the integral of the velocity, so duration follows from amplitude and peak
 * velocity and cannot be chosen separately. See the note on SACCADE_VELOCITY_TAPER.
 */
export function saccadeDurationSeconds( amplitudeDegrees ) {

    const amplitude = Math.abs( amplitudeDegrees );
    if ( amplitude === 0 ) return 0;

    const meanOverPeak = 1 - SACCADE_VELOCITY_TAPER / 2;

    return amplitude / ( meanOverPeak * saccadePeakVelocityDegreesPerSecond( amplitude ) );

}

/**
 * Fraction of the saccade travelled at normalised time `u` ∈ [0, 1] — the integral of the Tukey
 * velocity window, normalised so that `saccadeProgress( 1 ) === 1`.
 *
 * Closed form rather than a numerical integration so that a saccade lands exactly on its target
 * however long the frame was.
 */
export function saccadeProgress( normalisedTime, taper = SACCADE_VELOCITY_TAPER ) {

    const u = clamp( normalisedTime, 0, 1 );
    const ramp = taper / 2;
    const area = 1 - ramp;

    if ( ramp <= 0 ) return u;

    if ( u < ramp ) return rampIntegral( u, ramp ) / area;
    if ( u > 1 - ramp ) return ( area - rampIntegral( 1 - u, ramp ) ) / area;

    return ( ramp / 2 + ( u - ramp ) ) / area;

}

/** ∫ of the raised-cosine ramp 0.5·(1 − cos(π s / ramp)) from 0 to s, valid for s ≤ ramp. */
function rampIntegral( s, ramp ) {

    return 0.5 * s - ( ramp / ( 2 * Math.PI ) ) * Math.sin( Math.PI * s / ramp );

}

// --- the eye layer ------------------------------------------------------------------------------

export class Gaze extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.headAlignment=0.7] - Andrist's social register scalar, [0, 1].
     * @param {number} [options.headSpeed=1] - Expressive head-velocity multiplier.
     * @param {number} [options.partnerYawDegrees=0] - Where "toward" is. Also settable at
     *   runtime through `setPartnerDirection()`, but only the option survives `reset()`.
     * @param {number} [options.partnerPitchDegrees=0]
     * @param {string} [options.conversationState='idle']
     * @param {number} [options.vestibuloOcularGain=1]
     * @param {Object} [options.eyeExcursionDegrees] - Override the measured morph excursions.
     * @param {string} [options.headBoneName='head']
     * @param {string} [options.neckBoneName='neck_01']
     * @param {Object3D} [options.rigRoot] - The frame gaze angles are expressed in. See
     *   `resolveRigRoot()`; the default is right for a character whose own node does not rotate.
     * @param {string} [options.blinkLayerName='blink'] - Layer asked to blink on a large shift.
     * @param {boolean} [options.enabled=true]
     */
    constructor( options = {} ) {

        super( {
            name: options.name ?? 'gaze',
            order: MOTION_ORDER.GAZE,
            enabled: options.enabled,
            morphChannels: [
                'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeLookDownLeft',
                'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeLookDownRight'
            ]
        } );

        this.eyeExcursionDegrees = { ...EYE_MORPH_EXCURSION_DEGREES, ...( options.eyeExcursionDegrees ?? {} ) };
        this.vestibuloOcularGain = options.vestibuloOcularGain ?? DEFAULT_VOR_GAIN;
        this.blinkLayerName = options.blinkLayerName ?? 'blink';

        this.headBoneName = options.headBoneName ?? 'head';
        this.neckBoneName = options.neckBoneName ?? 'neck_01';
        this.requestedRigRoot = options.rigRoot ?? null;

        // The head half of the pair. Added to the stack separately so it can sit in the HEAD
        // slot, which runs before this one — see MOTION_ORDER.
        this.head = new GazeHead( this, options );

        // Figure facts, resolved in onBind().
        this.headBone = null;
        this.rigRoot = null;
        this.headRestRotation = new Quaternion();
        this.headRestRotationInverse = new Quaternion();

        // Scratch, so a running frame allocates nothing.
        this.scratchQuaternion = new Quaternion();
        this.scratchVector = new Vector3();

        // Kept so that reset() restores the configuration the layer was built with, not the
        // module defaults — a run that resets must be the same run.
        this.initialOptions = options;

        this.resetState( options );

    }

    // --- public API -----------------------------------------------------------------------

    /**
     * Where the conversational partner is, in rig space. Everything the policy calls "toward"
     * aims here. Defaults to straight ahead, which is where a camera at eye level sits.
     */
    setPartnerDirection( { yawDegrees = 0, pitchDegrees = 0 } = {} ) {

        this.partnerYawDegrees = yawDegrees;
        this.partnerPitchDegrees = pitchDegrees;

        return this;

    }

    /**
     * 'speaking' | 'listening' | 'idle'. Selects which row of GAZE_TOWARD_PROBABILITY applies,
     * and decides what `markTurnEnd()` means.
     */
    setConversationState( state ) {

        assertOneOf( state, [ 'speaking', 'listening', 'idle' ], 'conversation state' );
        this.conversationState = state;

        return this;

    }

    /**
     * 'theme' | 'rheme' | null. BEAT's rule applies to the utterance being spoken, so this is
     * only consulted while speaking; setting it while listening is harmless and inert.
     */
    setDiscourse( discourse ) {

        assertOneOf( discourse, [ 'theme', 'rheme', null ], 'discourse' );
        this.discourse = discourse;

        return this;

    }

    /**
     * 'fluent' | 'hesitant' | null. Opt-in refinement of the speaking figure; see the note on
     * GAZE_TOWARD_PROBABILITY for why it is opt-in rather than the default.
     */
    setFluency( fluency ) {

        assertOneOf( fluency, [ 'fluent', 'hesitant', null ], 'fluency' );
        this.fluency = fluency;

        return this;

    }

    /**
     * Andrist's register dial, [0, 1]. Higher recruits more head into every gaze shift, which
     * reads as affiliative and raises rapport; lower reads referential.
     */
    setHeadAlignment( alignment ) {

        this.headAlignment = clamp( alignment, 0, 1 );

        return this;

    }

    /**
     * Multiplier on head-movement speed. Expressive on purpose: subjects can voluntarily modulate
     * head velocity but not saccade velocity, so this is a channel and saccade speed is not.
     */
    setHeadSpeed( speed ) {

        this.headSpeed = Math.max( speed, 0.05 );

        return this;

    }

    /**
     * "Um." Gaze aversion during a filled pause is a speech-planning signal, not decoration —
     * it tells the listener the floor is still held while the next clause is assembled.
     */
    markFilledPause( { durationSeconds = FILLED_PAUSE_AVERSION_SECONDS } = {} ) {

        this.forcedRegion = 'away';
        this.forcedRegionRemaining = durationSeconds;

        this.beginRegion( 'away' );

        return this;

    }

    /**
     * The mutual-break pattern at a turn boundary, whichever side of it we are on.
     *
     * Speaker at end of utterance: look at the listener and HOLD. The brief mutual gaze that
     * follows is the floor being offered, and the other party breaks it by starting to speak.
     * Listener at end of the other party's utterance: break the mutual gaze and look away — that
     * break IS the act of taking the floor, and it comes fractionally before the first word.
     */
    markTurnEnd() {

        const takingTheFloor = this.conversationState === 'listening';

        this.forcedRegion = takingTheFloor ? 'away' : 'toward';
        this.forcedRegionRemaining = takingTheFloor ? TURN_TAKING_BREAK_SECONDS : MUTUAL_GAZE_SECONDS;

        this.beginRegion( this.forcedRegion );

        return this;

    }

    /**
     * Aim gaze somewhere explicitly, overriding the policy until the current region expires.
     *
     * @param {Object|Vector3} target - `{ yawDegrees, pitchDegrees }`, or a direction in rig
     *   space (it is normalised, so a point relative to the head works too).
     * @param {Object} [options]
     * @param {boolean} [options.predicted=false] - TRUE when the figure already knows where it
     *   is about to look: an object it is about to name, a place it has been told to check. The
     *   head then leads the eyes by ~100 ms instead of trailing them by 20–50 ms, and that
     *   single sign flip is what makes the movement read as intent rather than as a reflex.
     */
    lookAt( target, { predicted = false } = {} ) {

        const { yawDegrees, pitchDegrees } = toYawPitch( target, this.scratchVector );

        this.regionHoldRemaining = REGION_HOLD_MEAN_SECONDS;
        this.regionCentreYawDegrees = yawDegrees;
        this.regionCentrePitchDegrees = pitchDegrees;

        this.scheduleGazeShift( yawDegrees, pitchDegrees, predicted );

        return this;

    }

    /** Where gaze is pointing right now, in rig space, degrees. Read-only. */
    get gazeYawDegrees() { return this.currentGazeYawDegrees; }
    get gazePitchDegrees() { return this.currentGazePitchDegrees; }

    /** Where the eyes are pointing within the head, degrees. This is what the morphs encode. */
    get eyeYawDegrees() { return this.currentEyeYawDegrees; }
    get eyePitchDegrees() { return this.currentEyePitchDegrees; }

    /** True while the policy is deliberately not looking at the partner. */
    get isAverting() { return this.region === 'away'; }

    // --- the frame -------------------------------------------------------------------------

    onBind( context ) {

        this.headBone = context.target.getBone?.( this.headBoneName ) ?? null;
        this.rigRoot = this.resolveRigRoot();

        if ( this.headBone !== null && this.rigRoot !== null ) {

            rotationRelativeTo( this.headBone, this.rigRoot, this.headRestRotation );
            this.headRestRotationInverse.copy( this.headRestRotation ).invert();

        }

        this.head.onBindFromGaze( context );

    }

    update( deltaSeconds, context ) {

        this.advancePolicy( deltaSeconds );
        this.advanceSaccade( deltaSeconds );
        this.advanceMicrosaccade( deltaSeconds );

        this.readHeadRotation();
        this.applyVestibuloOcularReflex();
        this.writeEyeMorphs();

        this.publishSharedState( context );

        return this.contribution;

    }

    reset() {

        this.resetState( this.initialOptions );

    }

    // --- policy ----------------------------------------------------------------------------

    /**
     * The slow clock. Decides WHERE to look — at the partner or away — and re-decides when the
     * current region expires. The fast clock inside a region is `advanceSaccade`.
     */
    advancePolicy( deltaSeconds ) {

        if ( this.forcedRegionRemaining > 0 ) {

            this.forcedRegionRemaining -= deltaSeconds;

            if ( this.forcedRegionRemaining > 0 ) return;

            // A forced aversion or mutual gaze ends by handing control straight back to the
            // policy, rather than by leaving the character parked wherever the event left it.
            this.forcedRegion = null;
            this.regionHoldRemaining = 0;

        }

        this.regionHoldRemaining -= deltaSeconds;
        this.fixationRemaining -= deltaSeconds;

        if ( this.regionHoldRemaining <= 0 ) {

            this.beginRegion( this.chooseRegion() );
            return;

        }

        // Still in the same region: scan around inside it. These are the 5–10° saccades the
        // research calls typical, and they are why a fixating character does not look frozen.
        if ( this.fixationRemaining <= 0 && this.pendingShift === null ) {

            this.beginExploratorySaccade();

        }

    }

    /** Draws toward-or-away from whichever literature figure the current state selects. */
    chooseRegion() {

        return this.random.chance( this.towardProbability() ) ? 'toward' : 'away';

    }

    /**
     * The one place the conversational findings are turned into a number. Read top to bottom:
     * the first condition that applies wins, most specific first.
     */
    towardProbability() {

        if ( this.conversationState === 'speaking' ) {

            if ( this.discourse === 'theme' ) return GAZE_TOWARD_PROBABILITY.theme;
            if ( this.discourse === 'rheme' ) return GAZE_TOWARD_PROBABILITY.rheme;
            if ( this.fluency === 'fluent' ) return GAZE_TOWARD_PROBABILITY.fluent;
            if ( this.fluency === 'hesitant' ) return GAZE_TOWARD_PROBABILITY.hesitant;

            return GAZE_TOWARD_PROBABILITY.speaking;

        }

        if ( this.conversationState === 'listening' ) return GAZE_TOWARD_PROBABILITY.listening;

        return GAZE_TOWARD_PROBABILITY.idle;

    }

    /**
     * Enters a region and starts the gaze shift into it. Region changes are self-generated, so
     * they are PREDICTED by construction — the figure decided to look there, it did not react to
     * something appearing. That is why an idle character's head leads its eyes.
     */
    beginRegion( region ) {

        this.region = region;

        this.regionHoldRemaining = this.random.exponential( REGION_HOLD_MEAN_SECONDS, {
            min: REGION_HOLD_MINIMUM_SECONDS
        } );

        if ( region === 'toward' ) {

            this.regionCentreYawDegrees = this.partnerYawDegrees;
            this.regionCentrePitchDegrees = this.clampPolicyPitch( this.partnerPitchDegrees );

        } else {

            const side = this.random.chance( 0.5 ) ? 1 : -1;

            this.regionCentreYawDegrees = this.partnerYawDegrees + side *
                this.random.range( AVERSION_YAW_MINIMUM_DEGREES, AVERSION_YAW_MAXIMUM_DEGREES );

            const spread = AVERSION_PITCH_FRACTION_OF_EYE_RANGE;

            this.regionCentrePitchDegrees = this.clampPolicyPitch( this.partnerPitchDegrees +
                this.random.range( -spread * this.eyeExcursionDegrees.down, spread * this.eyeExcursionDegrees.up ) );

        }

        this.scheduleGazeShift( this.regionCentreYawDegrees, this.regionCentrePitchDegrees, true );

    }

    /** A small saccade around the region centre — scanning a face, or the space beside it. */
    beginExploratorySaccade() {

        const amplitude = this.random.range(
            EXPLORATORY_SACCADE_MINIMUM_DEGREES, EXPLORATORY_SACCADE_MAXIMUM_DEGREES );
        const direction = this.random.range( 0, Math.PI * 2 );

        this.scheduleGazeShift(
            this.regionCentreYawDegrees + amplitude * Math.cos( direction ),
            this.clampPolicyPitch( this.regionCentrePitchDegrees
                + amplitude * Math.sin( direction ) * EXPLORATORY_VERTICAL_FRACTION ),
            true
        );

    }

    /**
     * Holds a policy-generated vertical target inside what the eyes can reach on their own.
     *
     * Applied to the policy's targets and to nothing else — see POLICY_VERTICAL_BUDGET_FRACTION
     * for why `lookAt()` is exempt.
     */
    clampPolicyPitch( pitchDegrees ) {

        const budget = POLICY_VERTICAL_BUDGET_FRACTION;

        return clamp( pitchDegrees,
            -budget * this.eyeExcursionDegrees.down, budget * this.eyeExcursionDegrees.up );

    }

    // --- saccades --------------------------------------------------------------------------

    /**
     * Queues a shift rather than starting one. Two things have to happen at different times: the
     * eyes move after a latency, and the head moves either before or after them depending on
     * whether the target was predicted.
     *
     * The head release is scheduled SEPARATELY from the eye movement, and the two are timed from
     * different origins. A predicted head lead is measured from now, because the point of it is
     * to arrive before the saccade. A reactive head follow is measured from saccade ONSET, which
     * is not known yet — the minimum intersaccadic interval can push onset later than planned —
     * so it is scheduled in `launchSaccade` instead. Timing both from `now` was the first version
     * and it silently collapsed the 20-50 ms follow to zero whenever onset slipped.
     */
    scheduleGazeShift( yawDegrees, pitchDegrees, predicted ) {

        const deltaYaw = yawDegrees - this.currentGazeYawDegrees;
        const deltaPitch = pitchDegrees - this.currentGazePitchDegrees;
        const amplitude = Math.hypot( deltaYaw, deltaPitch );

        if ( amplitude < 1e-4 ) return;

        // A predicted shift is self-generated, so there is no stimulus to react to and no
        // reaction time to serve; the delay before the eyes move exists only to give the head
        // its head start. A reactive shift pays the full 200 ms.
        const eyeDelay = predicted ? HEAD_LEAD_SECONDS : SACCADE_LATENCY_SECONDS;

        this.pendingShift = {
            yawDegrees,
            pitchDegrees,
            amplitude,
            predicted,
            eyeCountdown: eyeDelay
        };

        if ( predicted ) {

            this.headRelease = {
                yawDegrees,
                pitchDegrees,
                countdown: eyeDelay - HEAD_LEAD_SECONDS
            };

        } else {

            // Nothing for the head to do until the eyes actually go.
            this.headRelease = null;

        }

    }

    /** The 20-50 ms a reactive gaze shift's head trails its eyes by. */
    drawHeadFollowSeconds() {

        // lookAt() may be called before the layer has joined a stack and been given a stream, so
        // this falls back to the midpoint of the range rather than throwing.
        if ( this.random === null ) {

            return ( HEAD_FOLLOW_MINIMUM_SECONDS + HEAD_FOLLOW_MAXIMUM_SECONDS ) / 2;

        }

        return this.random.range( HEAD_FOLLOW_MINIMUM_SECONDS, HEAD_FOLLOW_MAXIMUM_SECONDS );

    }

    /**
     * Advances the pending shift and the in-flight saccade, and leaves `currentGaze*` holding
     * this frame's gaze direction in rig space.
     */
    advanceSaccade( deltaSeconds ) {

        this.sinceSaccadeEnded += deltaSeconds;

        // The head can be released before, with or after the eyes — that is the whole point of
        // the predicted/reactive distinction — so it runs on its own clock.
        if ( this.headRelease !== null ) {

            this.headRelease.countdown -= deltaSeconds;

            if ( this.headRelease.countdown <= 0 ) {

                this.commandHead( this.headRelease.yawDegrees, this.headRelease.pitchDegrees );
                this.headRelease = null;

            }

        }

        const pending = this.pendingShift;

        if ( pending !== null ) {

            pending.eyeCountdown -= deltaSeconds;

            const intersaccadicSatisfied = this.sinceSaccadeEnded >= MINIMUM_INTERSACCADIC_SECONDS;

            if ( pending.eyeCountdown <= 0 && this.saccade === null && intersaccadicSatisfied ) {

                this.launchSaccade( pending );

            }

        }

        if ( this.saccade === null ) return;

        this.saccade.elapsed += deltaSeconds;

        const progress = saccadeProgress( this.saccade.elapsed / this.saccade.duration );

        this.currentGazeYawDegrees = this.saccade.fromYaw +
            ( this.saccade.toYaw - this.saccade.fromYaw ) * progress;
        this.currentGazePitchDegrees = this.saccade.fromPitch +
            ( this.saccade.toPitch - this.saccade.fromPitch ) * progress;

        if ( this.saccade.elapsed >= this.saccade.duration ) {

            this.currentGazeYawDegrees = this.saccade.toYaw;
            this.currentGazePitchDegrees = this.saccade.toPitch;
            this.saccade = null;
            this.sinceSaccadeEnded = 0;

        }

    }

    launchSaccade( pending ) {

        this.saccade = {
            fromYaw: this.currentGazeYawDegrees,
            fromPitch: this.currentGazePitchDegrees,
            toYaw: pending.yawDegrees,
            toPitch: pending.pitchDegrees,
            elapsed: 0,
            duration: saccadeDurationSeconds( pending.amplitude )
        };

        this.lastSaccadeAmplitudeDegrees = pending.amplitude;
        this.saccadeCount ++;

        // A reactive shift's head follow is measured from here, because here is where onset
        // actually happened — the intersaccadic floor may have pushed it past where it was planned.
        if ( pending.predicted === false ) {

            this.headRelease = {
                yawDegrees: pending.yawDegrees,
                pitchDegrees: pending.pitchDegrees,
                countdown: this.drawHeadFollowSeconds()
            };

        }

        this.pendingShift = null;

        this.fixationRemaining = this.random.exponential( FIXATION_MEAN_SECONDS, {
            min: MINIMUM_INTERSACCADIC_SECONDS
        } );

        this.requestBlinkForLargeShift( pending.amplitude );

    }

    /** Blinks co-occur with gaze-shift onset, especially for shifts past 30°. */
    requestBlinkForLargeShift( amplitudeDegrees ) {

        if ( amplitudeDegrees < BLINK_CO_OCCURRENCE_THRESHOLD_DEGREES ) return;
        if ( this.stack === null ) return;

        const blink = this.stack.findLayer( this.blinkLayerName );
        if ( blink === null || typeof blink.triggerWithSaccade !== 'function' ) return;

        blink.triggerWithSaccade( amplitudeDegrees );

    }

    // --- microsaccades ---------------------------------------------------------------------

    /**
     * 1–2 per second, 30 arcmin, 25 ms. Small enough that nobody consciously sees one and large
     * enough that their absence is what makes a still eye look like a doll's.
     *
     * Suppressed during a saccade, as in physiology, and bounded by a clamp on the accumulated
     * offset — see MICROSACCADE_OFFSET_CAP_DEGREES for why that clamp is the whole trick.
     */
    advanceMicrosaccade( deltaSeconds ) {

        if ( this.microsaccadeRemaining > 0 ) {

            this.microsaccadeRemaining -= deltaSeconds;

            const progress = saccadeProgress(
                1 - Math.max( this.microsaccadeRemaining, 0 ) / MICROSACCADE_DURATION_SECONDS );

            this.microsaccadeYawDegrees = this.microsaccadeFromYaw +
                ( this.microsaccadeToYaw - this.microsaccadeFromYaw ) * progress;
            this.microsaccadePitchDegrees = this.microsaccadeFromPitch +
                ( this.microsaccadeToPitch - this.microsaccadeFromPitch ) * progress;

            return;

        }

        if ( this.saccade !== null ) return;
        if ( this.random.poissonEventOccurs( MICROSACCADE_RATE_PER_SECOND, deltaSeconds ) === false ) return;

        // A direction that would take the eye past the cap is redrawn rather than shortened.
        // Shortening was the first version and it pulled the mean amplitude down to 0.43° against
        // a stated 30 arcmin; redrawing keeps every movement exactly 30 arcmin and biases the
        // direction inward instead — which is the right bias anyway, since microsaccades are
        // largely corrective. From the cap, roughly 42% of directions are admissible, so this
        // draws two or three times at worst.
        let yaw = 0;
        let pitch = 0;
        let accepted = false;

        for ( let attempt = 0; attempt < 8 && accepted === false; attempt ++ ) {

            const direction = this.random.range( 0, Math.PI * 2 );

            yaw = this.microsaccadeYawDegrees + MICROSACCADE_AMPLITUDE_DEGREES * Math.cos( direction );
            pitch = this.microsaccadePitchDegrees + MICROSACCADE_AMPLITUDE_DEGREES * Math.sin( direction );

            accepted = Math.hypot( yaw, pitch ) <= MICROSACCADE_OFFSET_CAP_DEGREES;

        }

        // Eight misses is a ~1% event at the very edge of the cap. Rather than let one through
        // and quietly break the bound, that draw becomes a purely corrective microsaccade —
        // still exactly 30 arcmin, aimed straight back at the fixation centre.
        if ( accepted === false ) {

            const distance = Math.hypot( this.microsaccadeYawDegrees, this.microsaccadePitchDegrees );
            const step = Math.min( MICROSACCADE_AMPLITUDE_DEGREES / distance, 1 );

            yaw = this.microsaccadeYawDegrees * ( 1 - step );
            pitch = this.microsaccadePitchDegrees * ( 1 - step );

        }

        this.microsaccadeFromYaw = this.microsaccadeYawDegrees;
        this.microsaccadeFromPitch = this.microsaccadePitchDegrees;
        this.microsaccadeToYaw = yaw;
        this.microsaccadeToPitch = pitch;
        this.microsaccadeRemaining = MICROSACCADE_DURATION_SECONDS;
        this.microsaccadeCount ++;

    }

    // --- eye–head coordination --------------------------------------------------------------

    /**
     * How much of this shift the head takes, per axis.
     *
     * Two conditions, and the second is not optional on this asset. The first is Andrist's
     * register: a share of everything past the recruitment threshold. The second is arithmetic:
     * the eyes stop at ~14° sideways and ~10° up, so anything past that MUST come from the head
     * or the gaze simply does not arrive. The head takes whichever is larger.
     */
    commandHead( yawDegrees, pitchDegrees ) {

        this.head.setTarget(
            this.headShareDegrees( yawDegrees, this.horizontalEyeRangeDegrees() ),
            this.headShareDegrees( pitchDegrees,
                pitchDegrees >= 0 ? this.eyeExcursionDegrees.up : this.eyeExcursionDegrees.down )
        );

    }

    /**
     * Andrist's alignment fraction of everything past this axis' recruitment threshold, or the
     * part the eye cannot reach comfortably, whichever is larger.
     */
    headShareDegrees( gazeDegrees, eyeRangeDegrees ) {

        const magnitude = Math.abs( gazeDegrees );

        const alignmentShare = this.headAlignment *
            Math.max( 0, magnitude - this.headRecruitmentThresholdDegrees( eyeRangeDegrees ) );
        const beyondComfort = Math.max( 0, magnitude - eyeRangeDegrees * EYE_COMFORT_FRACTION );

        return Math.sign( gazeDegrees ) * Math.max( alignmentShare, beyondComfort );

    }

    /**
     * Where head recruitment starts on one axis.
     *
     * The literature's threshold is a horizontal one, and it is quoted for a human eye with
     * roughly the same range up as sideways. This asset does not have that: 14.3° out against
     * 9.6° up. Holding the threshold at a fixed 12° would therefore mean the vertical axis never
     * recruits the head until the eye is already 25% past its own limit. Expressing it as the
     * same PROPORTION of each axis' excursion — 84% — keeps the literature's number exactly
     * where it was horizontally and starts the head 4° earlier for a look upward, which is the
     * whole of the vertical-saturation fix that is not a target-selection change.
     */
    headRecruitmentThresholdDegrees( eyeRangeDegrees ) {

        return HEAD_RECRUITMENT_THRESHOLD_DEGREES * eyeRangeDegrees / this.horizontalEyeRangeDegrees();

    }

    /**
     * How far sideways the eyes can go. Whichever way gaze turns, one eye is turning nasally and
     * the other temporally, so the pair is limited by the SMALLER of the two excursions — on this
     * asset that is `out` at 14.27°, and asking for more would drive one morph past 1.0 while the
     * other still had room, which reads as a squint rather than as a look.
     */
    horizontalEyeRangeDegrees() {

        return Math.min( this.eyeExcursionDegrees.in, this.eyeExcursionDegrees.out );

    }

    /**
     * Reads how far the head has actually turned, in rig space, from the bone the stack
     * committed LAST frame.
     *
     * Reading last frame's commit rather than this frame's intent is deliberate on two counts.
     * It is the only value available — the stack commits after every layer has run — and the
     * resulting one-frame delay IS the VOR latency: 16.7 ms at 60 Hz, 8.3 ms at 120 Hz, against
     * a measured 7–15 ms. Modelling the latency explicitly on top of that would double-count it.
     *
     * It also means VOR compensates for every source of head motion, not just gaze's own —
     * breath, sway, a backchannel nod — because all of them are in that committed quaternion.
     */
    readHeadRotation() {

        if ( this.headBone === null || this.rigRoot === null ) {

            this.headYawDegrees = 0;
            this.headPitchDegrees = 0;
            return;

        }

        rotationRelativeTo( this.headBone, this.rigRoot, this.scratchQuaternion );
        this.scratchQuaternion.multiply( this.headRestRotationInverse );

        this.scratchVector.copy( RIG_FORWARD ).applyQuaternion( this.scratchQuaternion );

        this.headYawDegrees = Math.atan2( this.scratchVector.x, this.scratchVector.z ) * RADIANS_TO_DEGREES;
        this.headPitchDegrees = Math.asin( clamp( this.scratchVector.y, -1, 1 ) ) * RADIANS_TO_DEGREES;

    }

    /**
     * `eye = gaze − gain · head`. The whole vestibulo-ocular reflex, in two lines, because gaze
     * is tracked in rig space rather than in head space. Hold gaze still and turn the head and
     * the eyes counter-rotate exactly enough to keep the gaze point where it was; that is what
     * gain 1.0 means.
     *
     * The clamp afterwards is the oculomotor range, and on this figure it is the morph range —
     * about ±14° horizontally. When it bites, gaze falls short of its target until the head
     * catches up, which is also what happens in a real eye–head shift.
     */
    applyVestibuloOcularReflex() {

        const yaw = this.currentGazeYawDegrees + this.microsaccadeYawDegrees -
            this.vestibuloOcularGain * this.headYawDegrees;
        const pitch = this.currentGazePitchDegrees + this.microsaccadePitchDegrees -
            this.vestibuloOcularGain * this.headPitchDegrees;

        const yawLimit = this.horizontalEyeRangeDegrees();
        const pitchLimit = pitch >= 0 ? this.eyeExcursionDegrees.up : this.eyeExcursionDegrees.down;

        this.currentEyeYawDegrees = clamp( yaw, -yawLimit, yawLimit );
        this.currentEyePitchDegrees = clamp( pitch, -pitchLimit, pitchLimit );

    }

    // --- output ------------------------------------------------------------------------------

    /**
     * Eye angle to the eight ARKit morphs. Each axis picks one of an opposing pair and divides by
     * that morph's measured excursion, so a weight of 1.0 means exactly the rotation the morph
     * was authored to produce. Left and right differ because "in" and "out" are mirror-image
     * directions while "up" and "down" are not.
     */
    writeEyeMorphs() {

        const yaw = this.currentEyeYawDegrees;
        const pitch = this.currentEyePitchDegrees;

        if ( yaw >= 0 ) {

            // Gaze to the figure's left: temporal for the left eye, nasal for the right.
            this.contribution.setMorph( 'eyeLookOutLeft', yaw / this.eyeExcursionDegrees.out );
            this.contribution.setMorph( 'eyeLookInRight', yaw / this.eyeExcursionDegrees.in );

        } else {

            this.contribution.setMorph( 'eyeLookInLeft', -yaw / this.eyeExcursionDegrees.in );
            this.contribution.setMorph( 'eyeLookOutRight', -yaw / this.eyeExcursionDegrees.out );

        }

        if ( pitch >= 0 ) {

            this.contribution.setMorph( 'eyeLookUpLeft', pitch / this.eyeExcursionDegrees.up );
            this.contribution.setMorph( 'eyeLookUpRight', pitch / this.eyeExcursionDegrees.up );

        } else {

            this.contribution.setMorph( 'eyeLookDownLeft', -pitch / this.eyeExcursionDegrees.down );
            this.contribution.setMorph( 'eyeLookDownRight', -pitch / this.eyeExcursionDegrees.down );

        }

    }

    /**
     * Publishes gaze state for the layers that need to know about it: blink co-occurrence,
     * expression (aversion reads as thought), and anything downstream that wants to know whether
     * the character is currently making eye contact.
     */
    publishSharedState( context ) {

        let published = context.shared.gaze;

        if ( published === undefined ) {

            published = {};
            context.shared.gaze = published;

        }

        published.yawDegrees = this.currentGazeYawDegrees;
        published.pitchDegrees = this.currentGazePitchDegrees;
        published.eyeYawDegrees = this.currentEyeYawDegrees;
        published.eyePitchDegrees = this.currentEyePitchDegrees;
        published.headYawDegrees = this.headYawDegrees;
        published.headPitchDegrees = this.headPitchDegrees;
        published.region = this.region;
        published.isAverting = this.region === 'away';
        published.isSaccading = this.saccade !== null;
        published.lastSaccadeAmplitudeDegrees = this.lastSaccadeAmplitudeDegrees;

    }

    // --- helpers -------------------------------------------------------------------------------

    /**
     * The frame gaze angles live in. In precedence order: whatever the caller passed, the
     * Skeleton's rig root if one is in shared state, then the top of the bone's ancestry.
     *
     * The fallback is exact as long as the character's own node does not rotate, because the
     * node's transform then appears in both the rest rotation and the current one and cancels.
     * Pass `rigRoot` explicitly for a character that turns in the scene.
     */
    resolveRigRoot() {

        if ( this.requestedRigRoot !== null ) return this.requestedRigRoot;

        const shared = this.stack?.context?.shared ?? {};
        if ( shared.skeleton?.rigRoot !== undefined ) return shared.skeleton.rigRoot;

        if ( this.headBone === null ) return null;

        let node = this.headBone;
        while ( node.parent !== null && node.parent !== undefined ) node = node.parent;

        return node;

    }

    /**
     * All motion state in one place, so that `reset()` genuinely returns the layer to frame zero.
     * A layer that resets only its random stream restarts mid-saccade and diverges from the run
     * it is supposed to reproduce.
     */
    resetState( options ) {

        this.conversationState = options.conversationState ?? 'idle';
        this.discourse = null;
        this.fluency = null;

        this.headAlignment = clamp( options.headAlignment ?? DEFAULT_HEAD_ALIGNMENT, 0, 1 );
        this.headSpeed = Math.max( options.headSpeed ?? 1, 0.05 );

        // Constructor options rather than plain zeroes, because `reset()` returns the layer to
        // its start-of-run state and a partner placed once at scene setup should still be there
        // after a critic rerun.
        this.partnerYawDegrees = options.partnerYawDegrees ?? 0;
        this.partnerPitchDegrees = options.partnerPitchDegrees ?? 0;

        this.region = 'toward';
        this.regionCentreYawDegrees = 0;
        this.regionCentrePitchDegrees = 0;
        this.regionHoldRemaining = 0;      // decide a region on the first frame
        this.fixationRemaining = 0;

        this.forcedRegion = null;
        this.forcedRegionRemaining = 0;

        this.currentGazeYawDegrees = 0;
        this.currentGazePitchDegrees = 0;
        this.currentEyeYawDegrees = 0;
        this.currentEyePitchDegrees = 0;

        this.headYawDegrees = 0;
        this.headPitchDegrees = 0;

        this.pendingShift = null;
        this.headRelease = null;
        this.saccade = null;
        this.sinceSaccadeEnded = MINIMUM_INTERSACCADIC_SECONDS;
        this.lastSaccadeAmplitudeDegrees = 0;
        this.saccadeCount = 0;

        this.microsaccadeYawDegrees = 0;
        this.microsaccadePitchDegrees = 0;
        this.microsaccadeFromYaw = 0;
        this.microsaccadeFromPitch = 0;
        this.microsaccadeToYaw = 0;
        this.microsaccadeToPitch = 0;
        this.microsaccadeRemaining = 0;
        this.microsaccadeCount = 0;

        this.head?.resetState();

    }

}

// --- the head layer ------------------------------------------------------------------------------

/**
 * GazeHead — the head half of a gaze shift.
 *
 * It is a separate Layer because it belongs in a different slot: MOTION_ORDER.HEAD runs before
 * MOTION_ORDER.GAZE, which is what lets the eye layer counter-rotate against the head. It holds
 * no policy of its own; Gaze decides where the head should be and this smooths toward it.
 *
 * Because HEAD runs first, it reads a target Gaze set on the PREVIOUS frame. That is a 16 ms lag
 * on a movement with a 180 ms smoothing time — invisible, and far smaller than the 20–50 ms
 * follow and 100 ms lead this layer exists to express.
 *
 * A rig driven through figure/Skeleton.js rather than through the stack's bone channels can
 * ignore the bone output entirely and read `yawDegrees` / `pitchDegrees` off this object.
 */
export class GazeHead extends Layer {

    constructor( gaze, options = {} ) {

        const neckBoneName = options.neckBoneName ?? 'neck_01';
        const headBoneName = options.headBoneName ?? 'head';

        super( {
            name: options.headLayerName ?? 'gazeHead',
            order: MOTION_ORDER.HEAD,
            enabled: options.enabled,
            boneChannels: [ neckBoneName, headBoneName ]
        } );

        this.gaze = gaze;
        this.neckBoneName = neckBoneName;
        this.headBoneName = headBoneName;

        // Split evenly across the two cervical joints this rig has, which is the smoothest curve
        // available from two joints. A rig with a full cervical chain would weight from the base up.
        this.neckShare = options.neckShare ?? 0.5;

        // Rig-space yaw and pitch axes expressed in each bone's REST frame. The stack commits
        // `bone.quaternion = rest · delta`, so a delta is read in the bone's rest frame; writing
        // a rig-space rotation therefore means conjugating it, `delta = R⁻¹ · A · R`, which for
        // an axis-angle is just the axis carried into that frame. This is what keeps "nod" a nod
        // on a rig whose head bone rests 99° off, instead of only on this one.
        this.boneAxes = new Map();

        this.scratchYawRotation = new Quaternion();
        this.scratchPitchRotation = new Quaternion();

        this.targetYawDegrees = 0;
        this.targetPitchDegrees = 0;

        this.resetState();

    }

    /** Called by Gaze once it has resolved the rig root, which both layers measure against. */
    onBindFromGaze( context ) {

        this.boneAxes.clear();

        const rigRoot = this.gaze.rigRoot;
        if ( rigRoot === null ) return;

        for ( const boneName of [ this.neckBoneName, this.headBoneName ] ) {

            const bone = context.target.getBone?.( boneName ) ?? null;
            if ( bone === null ) continue;

            const rest = rotationRelativeTo( bone, rigRoot, new Quaternion() );
            const restInverse = rest.clone().invert();

            this.boneAxes.set( boneName, {
                yaw: new Vector3( 0, 1, 0 ).applyQuaternion( restInverse ),
                pitch: new Vector3( 1, 0, 0 ).applyQuaternion( restInverse )
            } );

        }

    }

    /** Gaze calls this when the head is released — before, with or after the eye saccade. */
    setTarget( yawDegrees, pitchDegrees ) {

        this.targetYawDegrees = clamp( yawDegrees, -HEAD_YAW_LIMIT_DEGREES, HEAD_YAW_LIMIT_DEGREES );
        this.targetPitchDegrees = clamp( pitchDegrees,
            -HEAD_PITCH_DOWN_LIMIT_DEGREES, HEAD_PITCH_UP_LIMIT_DEGREES );

    }

    update( deltaSeconds ) {

        const smoothTime = HEAD_SMOOTH_TIME_SECONDS / this.gaze.headSpeed;

        this.yawDegrees = this.yawSmoother.advance( this.targetYawDegrees, smoothTime, deltaSeconds );
        this.pitchDegrees = this.pitchSmoother.advance( this.targetPitchDegrees, smoothTime, deltaSeconds );

        this.writeBone( this.neckBoneName, this.neckShare );
        this.writeBone( this.headBoneName, 1 - this.neckShare );

        return this.contribution;

    }

    reset() {

        this.resetState();

    }

    resetState() {

        this.yawDegrees = 0;
        this.pitchDegrees = 0;
        this.targetYawDegrees = 0;
        this.targetPitchDegrees = 0;

        this.yawSmoother = new CriticallyDampedAngle();
        this.pitchSmoother = new CriticallyDampedAngle();

    }

    /**
     * Yaw about the rig's up axis, then pitch about the rig's right axis, both carried into this
     * bone's rest frame.
     *
     * Splitting one rotation across two joints this way is an approximation: the head bone's
     * axes have already been tipped by the neck's share, so the two pitches cross-couple by a
     * fraction of a degree at conversational angles. It does not accumulate, because
     * `Gaze.readHeadRotation()` measures where the head ACTUALLY ended up and VOR compensates
     * against that rather than against what was asked for.
     */
    writeBone( boneName, share ) {

        const axes = this.boneAxes.get( boneName );
        if ( axes === undefined ) return;

        this.scratchYawRotation.setFromAxisAngle(
            axes.yaw, this.yawDegrees * share * DEGREES_TO_RADIANS );

        // Negated because positive pitch means "look up", and a right-handed rotation about the
        // rig's +X axis tips the forward direction down.
        this.scratchPitchRotation.setFromAxisAngle(
            axes.pitch, -this.pitchDegrees * share * DEGREES_TO_RADIANS );

        this.contribution.rotateBone(
            boneName, this.scratchYawRotation.multiply( this.scratchPitchRotation ) );

    }

}

// --- shared helpers --------------------------------------------------------------------------

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Second-order critically damped smoothing — the standard SmoothDamp. Chosen over an exponential
 * approach because a first-order filter starts at full speed, and a head that snaps into motion
 * and eases out reads as a flinch. Critically damped starts from rest, accelerates and settles
 * without overshoot, which is what a head does.
 */
class CriticallyDampedAngle {

    constructor() {

        this.value = 0;
        this.velocity = 0;

    }

    advance( target, smoothTime, deltaSeconds ) {

        if ( deltaSeconds <= 0 ) return this.value;

        const omega = 2 / Math.max( smoothTime, 1e-4 );
        const x = omega * deltaSeconds;

        // Padé approximation of exp(-x); accurate to ~0.1% over the frame times we ever see, and
        // it costs three multiplies instead of a transcendental.
        const decay = 1 / ( 1 + x + 0.48 * x * x + 0.235 * x * x * x );

        const change = this.value - target;
        const temp = ( this.velocity + omega * change ) * deltaSeconds;

        this.velocity = ( this.velocity - omega * temp ) * decay;
        this.value = target + ( change + temp ) * decay;

        return this.value;

    }

}

/**
 * A bone's rotation relative to an ancestor, by walking the chain. Used for both the rest pose
 * at bind and the live pose every frame, which is why it is written once rather than twice.
 *
 * Normalised because the GLB stores quaternions to six decimal places, so each rest rotation is
 * about 5e-7 off unit length; `invert()` is a conjugate, exact only for unit quaternions, and
 * the error compounds down a chain.
 */
function rotationRelativeTo( object, ancestor, out ) {

    out.identity();

    for ( let node = object; node !== null && node !== ancestor; node = node.parent ) {

        out.premultiply( node.quaternion );

    }

    return out.normalize();

}

/** Accepts either an angle pair or a rig-space direction, and yields the angle pair. */
function toYawPitch( target, scratch ) {

    if ( target === null || target === undefined ) {

        throw new Error( 'Gaze.lookAt() needs { yawDegrees, pitchDegrees } or a direction Vector3.' );

    }

    if ( target.isVector3 === true ) {

        scratch.copy( target ).normalize();

        return {
            yawDegrees: Math.atan2( scratch.x, scratch.z ) * RADIANS_TO_DEGREES,
            pitchDegrees: Math.asin( clamp( scratch.y, -1, 1 ) ) * RADIANS_TO_DEGREES
        };

    }

    return {
        yawDegrees: target.yawDegrees ?? 0,
        pitchDegrees: target.pitchDegrees ?? 0
    };

}

function assertOneOf( value, allowed, label ) {

    if ( allowed.includes( value ) ) return;

    throw new Error( `Gaze: "${ value }" is not a valid ${ label }. Expected one of ${ allowed.map( String ).join( ', ' ) }.` );

}

function clamp( value, minimum, maximum ) {

    return Math.min( Math.max( value, minimum ), maximum );

}
