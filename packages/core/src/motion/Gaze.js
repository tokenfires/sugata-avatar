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
 *      head motion gaze itself asked for. It happens in two stages, because that is what a gaze
 *      shift is: the eyes GO, then the head comes along and the eyes settle back toward the
 *      middle of the orbit. See `advanceHeadRecentring()` — without it the figure holds long
 *      sideways glances, which reads as sullen rather than as attentive.
 *
 *   3. CONVERSATIONAL GAZE POLICY, from BEAT (Cassell, Vilhjálmsson & Bickmore, SIGGRAPH 2001):
 *      gaze away at THEME 70%, toward at RHEME 73%. Note that TalkingHead ships 0.2 listening /
 *      0.5 speaking, which inverts the Kendon/Argyle finding — a listener looks at the speaker
 *      almost all the time. We use BEAT's.
 *
 *
 * AND IT DOES ALL THREE IN SIMULATED TIME, NOT IN FRAMES
 *
 * Every clock in this file — region dwell, fixation, saccade latency, the intersaccadic floor,
 * head release, microsaccade arrivals, the recentring hold-off — is advanced by a walk that cuts
 * each frame at the next scheduled transition, so an event happens at the instant it was drawn
 * for rather than at the next frame boundary. That is not tidiness. Advancing them by the frame
 * and discarding the overshoot inflated every interval by dt/2, which at 30 Hz against 60 Hz gave
 * the SAME SEED 691 saccades against 721 and head yaw traces correlating at r = 0.017 — so every
 * number measured at 60 Hz described a trajectory the 30 fps captures never rendered. See
 * `advanceOcularState()`, LEARNINGS §1.13, and the FRAME-RATE INVARIANCE section of the selftest.
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

import { Matrix4, Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { PoissonSchedule } from './Signals.js';

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
const RIG_UP = new Vector3( 0, 1, 0 );
const RIG_RIGHT = new Vector3( 1, 0, 0 );

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

// --- the sub-frame walk -------------------------------------------------------------------------

/**
 * Slack on the threshold tests that fire an event, in seconds.
 *
 * `advanceOcularState` cuts each step exactly at the next transition, so a clock that COUNTS DOWN
 * is stepped by its own remaining value and lands on exactly zero — that arithmetic is exact in
 * binary floating point and needs no help. The three clocks that ACCUMULATE — `sinceSaccadeEnded`,
 * `saccade.elapsed` and the eccentricity timers — are stepped by `threshold − now`, and
 * `now + ( threshold − now )` is NOT guaranteed to reach `threshold`. Without the slack the walk
 * would take an empty step, fail to fire, and take another, until the budget below stopped it.
 *
 * A femtosecond, against clocks measured in tenths of a second: 11 orders of magnitude of margin,
 * so it cannot swallow a real interval.
 */
const TRANSITION_EPSILON_SECONDS = 1e-12;

/**
 * Ceiling on sub-intervals per frame. This layer runs about ten transitions a second at its
 * busiest — saccade starts and ends, microsaccade starts and ends, region changes, head releases —
 * so a 30 Hz frame contains well under one on average and a handful at worst. 64 is two orders of
 * magnitude of headroom, and reaching it means a clock is scheduling a transition it then fails to
 * clear. See `Gaze.exhaustedStepBudgetFrames`.
 */
const MAXIMUM_STEPS_PER_FRAME = 64;

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

/**
 * TUNABLE. How far off head-centre an eye is allowed to sit INDEFINITELY, as a fraction of that
 * axis' own excursion — about 5° sideways and 3.4° up on this asset.
 *
 * EYE_COMFORT_FRACTION above is about a single shift: it says how much of its range the eye may
 * use to GET somewhere. This one is about staying there, and the two are different numbers
 * because sustained eccentric fixation is a different act from a saccade. A person asked to look
 * at something 12° off their body axis does not hold their head straight and their eyes over —
 * they turn to face it, and their eyes come back to the middle of the orbit. Holding the
 * eccentricity is effortful, and it is exactly what the critic pass read as "sullen": a figure
 * with its head square to the room and its eyes parked in the corner, under heavy lids.
 *
 * 0.35 keeps the mean eye deflection at the low end of the range measured for natural eye-in-head
 * position during everyday tasks, and it is what the saturation gate in `Gaze.selftest.mjs`
 * measures against.
 */
const SUSTAINED_EYE_ECCENTRICITY_FRACTION = 0.35;

/**
 * TUNABLE. How long an eye must hold an eccentricity before the head starts taking it over.
 *
 * This is the whole difference between a glance and a look. A quick check to the side and back
 * inside a third of a second is eyes-only and always was; anything that outlives the transit
 * recruits the head. Long enough to clear a saccade plus the head's own 180 ms settle, short
 * enough that no gaze is HELD off-centre for a length of time a viewer can notice.
 */
const HEAD_RECENTRING_LATENCY_SECONDS = 0.3;

/**
 * TUNABLE. How fast the head takes that load over, in degrees per second.
 *
 * Deliberately an order of magnitude below the ~100°/s of a head turn that belongs to a gaze
 * shift, because this is not one — it is the slow settle afterwards. Fast enough to clear a
 * typical 7° hand-over inside a second; slow enough that it never reads as a second movement.
 */
const HEAD_RECENTRING_RATE_DEGREES_PER_SECOND = 12;

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

/**
 * A neck shorter than this has no measurable direction, so the cervical axis falls back to the
 * room's vertical. One millimetre: far below any rig's real neck (this one is 108 mm) and far
 * above the 5e-7 quantisation the GLB stores positions at.
 */
const DEGENERATE_COLUMN_METRES = 0.001;

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
     * @param {boolean} [options.blinkCoupling=true] - See `setBlinkCoupling()`.
     * @param {boolean} [options.headRecentring=true] - See `setHeadRecentring()`.
     * @param {boolean} [options.policy=true] - See `setPolicyEnabled()`.
     * @param {boolean} [options.frameCoupledArrivals=false] - Set true to advance every clock by
     *   the whole frame and roll the microsaccade coin once per frame, exactly as this layer used
     *   to. It exists so `Gaze.selftest.mjs` has a known-bad run to reject; nothing should ship
     *   with it on. See `advanceOcularState()`.
     * @param {boolean} [options.frameCoupledVestibuloOcular=false] - The companion known-bad: the
     *   reflex then compensates for the head as it stood one FRAME ago rather than at the instant
     *   it is evaluated. See `readHeadRotation()` for what that was and why it went.
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
        this.microsaccades = null;
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
     * Whether a large gaze shift asks the blink layer to blink with it. On by default, because
     * the co-occurrence is physiology rather than product design; turn it off when the
     * application is driving blinks from its own script and does not want a second author.
     */
    setBlinkCoupling( enabled ) {

        this.blinkCoupling = enabled !== false;

        return this;

    }

    /**
     * Whether the head takes over an eccentricity the eyes have been holding. On by default. Off
     * gives a head that only ever moves for the shift itself — which is what a rig with no neck
     * authority, or a talking-head crop where the neck is out of frame, actually wants.
     */
    setHeadRecentring( enabled ) {

        this.headRecentring = enabled !== false;

        return this;

    }

    /**
     * Whether the autonomous conversational policy chooses where to look. On by default.
     *
     * Off pauses the region and fixation clocks and leaves `lookAt()` as the only thing that aims
     * gaze — everything below the policy still runs, so the saccade main sequence, the eye–head
     * split, microsaccades and the VOR are all unchanged. That is what an agent scripting its own
     * gaze wants (following a cursor, walking a list of targets), and it is what makes a gate on
     * the hand-over measurable: with the policy live, a three-second window is a lottery over how
     * many regions it happened to visit.
     */
    setPolicyEnabled( enabled ) {

        this.policyEnabled = enabled !== false;

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

        // Microsaccade arrivals, on their own stream. Built here because `this.random` does not
        // exist until the stack forks it, and rebuilt on every bind because `MotionStack.reset()`
        // rewinds and re-binds. See `fireEventTransitions()` for why this is a schedule rather
        // than a per-frame coin.
        this.microsaccades = new PoissonSchedule( this.random.fork( 'microsaccade' ) );

        this.head.onBindFromGaze( context );

    }

    update( deltaSeconds, context ) {

        // Idempotent per frame: `GazeHead` runs first and calls this too, so that the head bone
        // it writes carries THIS frame's decisions rather than last frame's. See the method.
        this.advanceOcularState( deltaSeconds, context );

        this.writeEyeMorphs();

        this.publishSharedState( context );

        return this.contribution;

    }

    reset() {

        this.resetState( this.initialOptions );

    }

    /**
     * One frame of ocular simulation, walked in sub-intervals cut at every scheduled transition.
     *
     * 🎯 THE FRAME IS NOT THE CLOCK. THE SIMULATION IS. Read this before changing anything below.
     *
     * The version this replaced advanced eight countdowns by `deltaSeconds` once per frame and
     * DISCARDED the overshoot every time one expired, which rounds every drawn interval up to a
     * whole multiple of the frame time. That inflates each interval by dt/2 in expectation — 16.7
     * ms at 30 Hz against 8.3 ms at 60 Hz — and the two runs drift apart by that much per event
     * for as long as they run. Measured on this layer before the fix, seed 1 over 300 s, the same
     * seed at 30 and 60 Hz produced 691 against 721 saccades and head yaw traces that agreed to
     * pearson r = 0.017, worst disagreement 76.6° at a matched instant. LEARNINGS §1.13.
     *
     * Now every clock is advanced in SIMULATED time: the step is cut at the soonest scheduled
     * transition, the continuous state is integrated across the interval, and the transition
     * fires exactly on the boundary. An arrival time is then a property of the seed alone, and
     * the frame rate decides only which frame observes it.
     *
     * The order inside a step is load-bearing, and it is the same order `Sway.advanceAxis` uses:
     * everything in flight is AGED first, then arrivals fire. Firing first would let an event
     * scheduled at the boundary spend the interval that decided on it — a region change and the
     * 200 ms saccade latency it schedules would collapse into the same instant.
     *
     * ⚠️ TWO RESIDUES ARE INHERENT AND ARE WHAT THE INVARIANCE TOLERANCE IS SIZED FOR.
     * `advanceAxisRecentring` accumulates its eccentricity clock from the eye angle sampled at the
     * END of each interval, so the 0.3 s hand-over latency can start up to one step late; and the
     * VOR reads the head bone the stack committed LAST frame, which is a deliberate 7–15 ms
     * latency realised as one frame. Both are bounded by dt and neither accumulates.
     */
    advanceOcularState( deltaSeconds, context ) {

        if ( context.frame === this.advancedForFrame ) return;
        if ( this.enabled === false ) return;

        this.advancedForFrame = context.frame;

        // Once per frame, not once per step: this reads a bone the stack commits between frames,
        // so it cannot change inside one.
        this.readHeadRotation();

        if ( this.frameCoupledArrivals ) {

            // 🚩 THE DEFECT, REBUILT ON PURPOSE. One step the length of the whole frame, so every
            // expiry overshoots and the overshoot is thrown away, and one Bernoulli draw per frame
            // off the LAYER's stream for the microsaccades — which is what used to advance the
            // whole layer's randomness at the frame rate. The selftest's invariance section must
            // reject this.
            const eligible = this.saccade === null && this.microsaccadeActive === false;

            this.head.advanceSmoothing( deltaSeconds );
            this.ageEventClocks( deltaSeconds );

            if ( eligible &&
                this.random.poissonEventOccurs( MICROSACCADE_RATE_PER_SECOND, deltaSeconds ) ) {

                this.beginMicrosaccade();

            }

            this.fireEventTransitions( 0 );
            this.applyVestibuloOcularReflex();
            this.advanceHeadRecentring( deltaSeconds );

            return;

        }

        let remaining = deltaSeconds;
        let steps = 0;

        while ( remaining > 0 && steps < MAXIMUM_STEPS_PER_FRAME ) {

            const step = Math.min( remaining, this.secondsUntilNextTransition() );

            // Captured before ageing, because a step that ends ON a saccade's end was ineligible
            // for its whole length. Suppression PAUSES the microsaccade process rather than
            // sampling and discarding it, which is what keeps the rate a rate over eligible time.
            const eligibleSeconds =
                ( this.saccade === null && this.microsaccadeActive === false ) ? step : 0;

            this.head.advanceSmoothing( step );
            this.ageEventClocks( step );

            this.fireEventTransitions( eligibleSeconds );

            this.applyVestibuloOcularReflex();

            // After the reflex, because it is this instant's EYE angle — not the gaze target —
            // that says whether the eyes are being left to hold an eccentricity on their own.
            this.advanceHeadRecentring( step );

            remaining -= step;
            steps ++;

        }

        // A budget of MAXIMUM_STEPS_PER_FRAME is roughly two orders of magnitude above the
        // transition rate this layer actually produces, so a non-zero count means a clock is
        // scheduling a transition it then fails to clear. Recorded rather than thrown, because a
        // motion layer must not be able to stop a render loop, and asserted zero in the selftest.
        if ( steps >= MAXIMUM_STEPS_PER_FRAME ) this.exhaustedStepBudgetFrames ++;

        this.worstStepsInAFrame = Math.max( this.worstStepsInAFrame, steps );

    }

    /**
     * How long until the next scheduled change of state, over every clock this layer runs.
     *
     * Zero is a legitimate answer and means "a transition is due right now": the walk then takes
     * an empty step, fires it, and comes straight back. That is how a schedule set up mid-frame —
     * a predicted shift releases its head at countdown zero — reaches its own instant instead of
     * waiting for the next frame.
     */
    secondsUntilNextTransition() {

        let soonest = Infinity;

        // The policy's clocks. A forced region suspends them both: while one is running, nothing
        // else about where to look is up for reconsideration.
        if ( this.policyEnabled === false ) {

            // Nothing scheduled here at all — see setPolicyEnabled().

        } else if ( this.forcedRegion !== null ) {

            soonest = Math.min( soonest, this.forcedRegionRemaining );

        } else {

            soonest = Math.min( soonest, this.regionHoldRemaining );

            if ( this.pendingShift === null ) soonest = Math.min( soonest, this.fixationRemaining );

        }

        if ( this.headRelease !== null ) soonest = Math.min( soonest, this.headRelease.countdown );

        if ( this.saccade !== null ) {

            soonest = Math.min( soonest, this.saccade.duration - this.saccade.elapsed );

        } else if ( this.pendingShift !== null ) {

            // Two conditions gate the launch and the later of them decides the instant: the
            // latency has to have run out AND the intersaccadic floor has to be clear.
            soonest = Math.min( soonest, Math.max( this.pendingShift.eyeCountdown,
                MINIMUM_INTERSACCADIC_SECONDS - this.sinceSaccadeEnded ) );

        }

        if ( this.microsaccadeActive ) {

            soonest = Math.min( soonest, this.microsaccadeRemaining );

        } else if ( this.saccade === null && this.microsaccades !== null ) {

            soonest = Math.min( soonest,
                this.microsaccades.secondsUntilArrival( MICROSACCADE_RATE_PER_SECOND ) );

        }

        return Math.max( soonest, 0 );

    }

    /**
     * Everything continuous, moved forward by one sub-interval. Nothing here draws a random
     * number and nothing here starts or ends an event: every arrival happens between calls to
     * this, which is what keeps the trajectory a property of the seed.
     */
    ageEventClocks( seconds ) {

        if ( this.policyEnabled === false ) {

            // Paused, not merely ignored, so re-enabling resumes from where it stopped rather
            // than firing a backlog of expiries on the first frame.

        } else if ( this.forcedRegion !== null ) {

            this.forcedRegionRemaining -= seconds;

        } else {

            this.regionHoldRemaining -= seconds;
            this.fixationRemaining -= seconds;

        }

        this.sinceSaccadeEnded += seconds;

        if ( this.headRelease !== null ) this.headRelease.countdown -= seconds;
        if ( this.pendingShift !== null ) this.pendingShift.eyeCountdown -= seconds;

        if ( this.saccade !== null ) {

            this.saccade.elapsed += seconds;

            const progress = saccadeProgress( this.saccade.elapsed / this.saccade.duration );

            this.currentGazeYawDegrees = this.saccade.fromYaw +
                ( this.saccade.toYaw - this.saccade.fromYaw ) * progress;
            this.currentGazePitchDegrees = this.saccade.fromPitch +
                ( this.saccade.toPitch - this.saccade.fromPitch ) * progress;

        }

        if ( this.microsaccadeActive ) {

            this.microsaccadeRemaining -= seconds;

            const progress = saccadeProgress(
                1 - Math.max( this.microsaccadeRemaining, 0 ) / MICROSACCADE_DURATION_SECONDS );

            this.microsaccadeYawDegrees = this.microsaccadeFromYaw +
                ( this.microsaccadeToYaw - this.microsaccadeFromYaw ) * progress;
            this.microsaccadePitchDegrees = this.microsaccadeFromPitch +
                ( this.microsaccadeToPitch - this.microsaccadeFromPitch ) * progress;

        }

    }

    /**
     * Every event that lands on this interval's boundary, in a fixed order: ends before
     * beginnings, and the slow policy clock last.
     *
     * The ordering is not cosmetic. A saccade that finishes at this instant has to be OVER before
     * the next one is allowed to consider starting, or the intersaccadic floor is measured against
     * the wrong movement. And the policy runs last so that a region change scheduling a 200 ms
     * saccade latency cannot have that latency spent by the launch check sitting above it.
     *
     * @param {number} eligibleSeconds - How much of the interval the microsaccade process was
     *   allowed to run for. Zero during a saccade or while one microsaccade is still in flight.
     */
    fireEventTransitions( eligibleSeconds ) {

        if ( this.saccade !== null &&
            this.saccade.elapsed >= this.saccade.duration - TRANSITION_EPSILON_SECONDS ) {

            this.currentGazeYawDegrees = this.saccade.toYaw;
            this.currentGazePitchDegrees = this.saccade.toPitch;
            this.saccade = null;
            this.sinceSaccadeEnded = 0;

        }

        if ( this.microsaccadeActive &&
            this.microsaccadeRemaining <= TRANSITION_EPSILON_SECONDS ) {

            this.microsaccadeYawDegrees = this.microsaccadeToYaw;
            this.microsaccadePitchDegrees = this.microsaccadeToPitch;
            this.microsaccadeRemaining = 0;
            this.microsaccadeActive = false;

        }

        if ( this.headRelease !== null &&
            this.headRelease.countdown <= TRANSITION_EPSILON_SECONDS ) {

            this.commandHead( this.headRelease.yawDegrees, this.headRelease.pitchDegrees );
            this.headRelease = null;

        }

        if ( this.pendingShift !== null && this.saccade === null &&
            this.pendingShift.eyeCountdown <= TRANSITION_EPSILON_SECONDS &&
            this.sinceSaccadeEnded >= MINIMUM_INTERSACCADIC_SECONDS - TRANSITION_EPSILON_SECONDS ) {

            this.launchSaccade( this.pendingShift );

        }

        if ( eligibleSeconds > 0 ) {

            this.microsaccades.advance( MICROSACCADE_RATE_PER_SECOND, eligibleSeconds,
                () => this.beginMicrosaccade() );

        }

        this.firePolicyTransitions();

    }

    // --- policy ----------------------------------------------------------------------------

    /**
     * The slow clock. Decides WHERE to look — at the partner or away — and re-decides when the
     * current region expires. The fast clock inside a region is the saccade.
     */
    firePolicyTransitions() {

        if ( this.policyEnabled === false ) return;

        if ( this.forcedRegion !== null ) {

            if ( this.forcedRegionRemaining > TRANSITION_EPSILON_SECONDS ) return;

            // A forced aversion or mutual gaze ends by handing control straight back to the
            // policy, rather than by leaving the character parked wherever the event left it.
            this.forcedRegion = null;
            this.forcedRegionRemaining = 0;

            this.beginRegion( this.chooseRegion() );
            return;

        }

        if ( this.regionHoldRemaining <= TRANSITION_EPSILON_SECONDS ) {

            this.beginRegion( this.chooseRegion() );
            return;

        }

        // Still in the same region: scan around inside it. These are the 5–10° saccades the
        // research calls typical, and they are why a fixating character does not look frozen.
        if ( this.fixationRemaining <= TRANSITION_EPSILON_SECONDS && this.pendingShift === null ) {

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

        // The DRAWN interval, kept because the countdown above is a different quantity the moment
        // any time passes. The selftest's KS test used to read `fixationRemaining` after a frame
        // had run and so tested a distribution shifted left by part of a frame — which put mass
        // below the 0.15 s floor, where the reference CDF is zero. That is where its D = 0.343
        // came from, and it is a property of the sampling, not of the layer.
        this.lastFixationSeconds = this.fixationRemaining;

        this.requestBlinkForLargeShift( pending.amplitude );

    }

    /**
     * Blinks co-occur with gaze-shift onset, especially for shifts past 30°.
     *
     * Wired here rather than left to the application, because the co-occurrence is a fact about
     * the eyes and not about any one product: an app that adds a Gaze layer and a Blink layer has
     * already said everything needed to know that the two are coupled. `setBlinkCoupling( false )`
     * is the way out for a caller that wants to drive blinks itself.
     *
     * The threshold here is Blink's own SATURATION amplitude, so a shift that gets this far is one
     * Blink treats as certain-enough to be worth its maximum probability. Blink owns whether the
     * blink actually happens; this layer only reports what the eyes just did.
     */
    requestBlinkForLargeShift( amplitudeDegrees ) {

        if ( this.blinkCoupling === false ) return;
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
     *
     * 🎯 Called from a `PoissonSchedule` arrival, never from a per-frame coin, and every draw here
     * comes from THAT process's own stream rather than from the layer's. Both halves matter. The
     * coin drew one random number per FRAME, which advanced the whole layer's stream at the frame
     * rate and moved every gaze decision downstream of it; and a shared stream would re-couple the
     * frame rate through the order two processes happen to interleave in. See `Signals.js`.
     */
    beginMicrosaccade() {

        const random = this.microsaccades.random;

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

            const direction = random.range( 0, Math.PI * 2 );

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
        this.microsaccadeActive = true;
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

        this.commandedHeadYawDegrees =
            this.headShareDegrees( yawDegrees, this.horizontalEyeRangeDegrees() );
        this.commandedHeadPitchDegrees = this.headShareDegrees( pitchDegrees,
            pitchDegrees >= 0 ? this.eyeExcursionDegrees.up : this.eyeExcursionDegrees.down );

        this.aimHead();

    }

    /**
     * The second half of a gaze shift: the head comes along and the eyes come back to centre.
     *
     * The share above is what the head takes AT the shift, and on its own it leaves the eye
     * wherever the arithmetic put it — 12° out for a partner 12° off-axis, held for as long as
     * the figure keeps looking at them, because 12° is under the recruitment threshold and inside
     * the comfort margin so neither rule ever fires. That is the defect this method exists to
     * fix. Nothing in the arithmetic was wrong; what was missing is that real eye–head
     * coordination has a slow second stage, and the whole point of it is to give the eyes their
     * range back.
     *
     * The load is handed over slowly and given back instantly, and the asymmetry is deliberate.
     * Taking MORE head is the settle — it has to be slow or it reads as a second, unmotivated
     * movement. Needing LESS head means gaze has moved on, and the head must be free to swing
     * straight to wherever the new shift wants it; a head that had to unwind at the settle rate
     * would leave the eyes pinned on the far side of their range for the whole return.
     */
    advanceHeadRecentring( deltaSeconds ) {

        if ( this.headRecentring === false ) return;

        this.advanceAxisRecentring( this.recentringYaw, {
            gazeDegrees: this.settledGazeYawDegrees,
            eyeRangeDegrees: this.horizontalEyeRangeDegrees(),
            commandedHeadDegrees: this.commandedHeadYawDegrees,
            deltaSeconds
        } );

        this.advanceAxisRecentring( this.recentringPitch, {
            gazeDegrees: this.settledGazePitchDegrees,
            eyeRangeDegrees: this.settledGazePitchDegrees >= 0
                ? this.eyeExcursionDegrees.up : this.eyeExcursionDegrees.down,
            commandedHeadDegrees: this.commandedHeadPitchDegrees,
            deltaSeconds
        } );

        this.aimHead();

    }

    /**
     * Where gaze is SETTLING — the saccade's destination while one is in flight, and where gaze
     * already is otherwise.
     *
     * 🎯 THE SETTLE IS NOT PART OF THE TRANSIT, and reading the live interpolated angle instead of
     * this one is what kept the head frame-rate-coupled after the arrivals were fixed. A saccade
     * crosses the midline at up to 500°/s; the recentring hand-over is a 12°/s settle afterwards.
     * Driving the hand-over's target from the transit made the head's target a CONTINUOUS function
     * of a very fast signal, and a continuous target is only ever sampled at whatever instants the
     * frame rate happens to offer — the smoother then integrates against a different staircase at
     * every rate. Measured, seed 1 over 300 s with everything else already fixed: worst head yaw
     * disagreement 3.764° at 30 vs 60 Hz, halving to 1.875° at 60 vs 120 Hz, i.e. first order in
     * dt. Reading the destination makes both the amount and the SIGN piecewise constant, changing
     * only at transitions the walk already cuts at, and the disagreement goes to exactly zero.
     */
    get settledGazeYawDegrees() {

        return this.saccade !== null ? this.saccade.toYaw : this.currentGazeYawDegrees;

    }

    get settledGazePitchDegrees() {

        return this.saccade !== null ? this.saccade.toPitch : this.currentGazePitchDegrees;

    }

    /**
     * One axis of the hand-over. `axis` carries the unsigned head angle recentring has claimed so
     * far and how long the eye has been off-centre; the sign comes from the gaze direction at the
     * moment the head is aimed, so a gaze that crosses the midline carries the head across with it
     * rather than stranding it on the old side.
     */
    advanceAxisRecentring( axis, options ) {

        const { gazeDegrees, eyeRangeDegrees, commandedHeadDegrees, deltaSeconds } = options;

        const comfortDegrees = eyeRangeDegrees * SUSTAINED_EYE_ECCENTRICITY_FRACTION;
        const wantedDegrees = Math.max( 0, Math.abs( gazeDegrees ) - comfortDegrees );

        // How far round the head already is, counted as a TARGET rather than as the smoothed bone,
        // and only when it is round the same side gaze wants. `eye = gaze − head`, so the eye is
        // sitting outside its comfort band exactly when the settled gaze asks for more than the
        // head is already carrying — which is the same condition the old `|eye| > comfort` test
        // stated, but written on two piecewise-constant quantities instead of on the live
        // eyeball. The eyeball carries the saccade transit, every microsaccade, and the one-frame
        // VOR latency, none of which is evidence about whether an eccentricity is being HELD.
        const commandedRelief = Math.sign( commandedHeadDegrees ) === Math.sign( gazeDegrees )
            ? Math.abs( commandedHeadDegrees ) : 0;

        if ( wantedDegrees > Math.max( commandedRelief, axis.headDegrees ) ) axis.eccentricSeconds += deltaSeconds;
        else axis.eccentricSeconds = 0;

        if ( wantedDegrees <= axis.headDegrees ) {

            axis.headDegrees = wantedDegrees;
            return;

        }

        // A shift that has ALREADY recruited the head gets its final angle at once, because the
        // head is travelling anyway and a person makes one movement where this would otherwise
        // make two: a turn, a stop, and a creep on for the last few degrees. The slow hand-over
        // below is for the other case — a gaze the head was never recruited for at all, which is
        // where a held eccentricity comes from and is the only place a settle has to be visible.
        if ( commandedRelief > 0 ) {

            axis.headDegrees = wantedDegrees;
            return;

        }

        // The ramp runs for the part of this interval that came AFTER the latch matured, not for
        // the whole of any interval the maturity happened to land in. Rounding the start up to the
        // next boundary is the same discard-the-overshoot error the whole frame walk exists to
        // remove — it cost 0.447° of hand-over, one frame's worth at 12°/s, purely because 30 Hz
        // and 60 Hz round the 0.3 s latency to different instants. Written this way the ramp is
        // also exact under splitting: the total is the same however the interval is cut.
        const rampSeconds = Math.min( deltaSeconds,
            Math.max( axis.eccentricSeconds - HEAD_RECENTRING_LATENCY_SECONDS, 0 ) );

        if ( rampSeconds <= 0 ) return;

        axis.headDegrees = Math.min( wantedDegrees,
            axis.headDegrees + HEAD_RECENTRING_RATE_DEGREES_PER_SECOND * rampSeconds );

    }

    /**
     * Where the head is being asked to point, from the two things that ask for it: the share of
     * the shift it was commanded to take, and the eccentricity it has since agreed to carry.
     *
     * Whichever is larger wins rather than the two summing, because they are two statements about
     * the SAME angle — how far round the head has to be — not two movements to add together.
     */
    aimHead() {

        // The SETTLED gaze decides the side, for the same reason it decides the amount: a saccade
        // that crosses the midline would otherwise flip this sign at a continuous zero crossing
        // sampled wherever the frame rate put it. See `settledGazeYawDegrees`.
        this.head.setTarget(
            largerMagnitude( this.commandedHeadYawDegrees,
                Math.sign( this.settledGazeYawDegrees ) * this.recentringYaw.headDegrees ),
            largerMagnitude( this.commandedHeadPitchDegrees,
                Math.sign( this.settledGazePitchDegrees ) * this.recentringPitch.headDegrees )
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
     * Separates the head rotation the VOR has to compensate for into the part this layer asked
     * for and the part somebody else did — breath, sway, a backchannel nod.
     *
     * 🚩 THE OLD DOC COMMENT HERE JUSTIFIED A ONE-FRAME LAG AND IT WAS RIGHT ABOUT THE WRONG
     * RANGE. It read: "the resulting one-frame delay IS the VOR latency: 16.7 ms at 60 Hz, 8.3 ms
     * at 120 Hz, against a measured 7–15 ms." Both of those numbers are inside the measured band
     * and the sentence never mentions **30 Hz, which is 33.3 ms — more than double the top of
     * that band, and it is the rate every judge capture in this project is rendered at.** A
     * latency defined as "one frame" is not a latency, it is a frame-rate coupling: measured,
     * seed 1 over 300 s with every other coupling already removed, eye yaw disagreed by 3.394°
     * worst / 0.337° RMS between 30 and 60 Hz, and by 0.000° once the head term below was read at
     * the current instant instead.
     *
     * The stack commits bones after every layer has run, so the bone genuinely is one frame old
     * and cannot be made fresher from here. What CAN be made fresh is this layer's own share of
     * it, because this layer is the thing that decided it: `GazeHead.yawDegrees` is exact at every
     * sub-step of the walk. So the stale bone is used only to recover what everyone ELSE did —
     *
     *     external = bone( t − dt ) − thisLayer( t − dt )
     *
     * both terms being from the same instant, so the subtraction is exact — and the reflex adds
     * this layer's live angle back at the instant it is evaluated. Measured on this rig, the
     * cervical chain delivers what it was asked for to **0.009° of yaw and 0.010° of pitch**, so
     * the decomposition is a real separation rather than a hopeful one.
     *
     * The residual lag on `external` is 33 ms of a signal that moves at under a degree a second
     * (sway's head excursion is millimetres over seconds), and those layers are dt-invariant in
     * their own right.
     */
    readHeadRotation() {

        this.externalHeadYawDegrees = 0;
        this.externalHeadPitchDegrees = 0;

        if ( this.headBone === null || this.rigRoot === null ) return;

        rotationRelativeTo( this.headBone, this.rigRoot, this.scratchQuaternion );
        this.scratchQuaternion.multiply( this.headRestRotationInverse );

        this.scratchVector.copy( RIG_FORWARD ).applyQuaternion( this.scratchQuaternion );

        const boneYawDegrees = Math.atan2( this.scratchVector.x, this.scratchVector.z ) * RADIANS_TO_DEGREES;
        const bonePitchDegrees = Math.asin( clamp( this.scratchVector.y, -1, 1 ) ) * RADIANS_TO_DEGREES;

        // `this.head` has not been advanced yet this frame, so both terms describe the same
        // instant — the pose the stack committed at the end of the last one.
        this.externalHeadYawDegrees = boneYawDegrees - this.head.yawDegrees;
        this.externalHeadPitchDegrees = bonePitchDegrees - this.head.pitchDegrees;

        // Kept only so the known-bad rebuild can compose against the stale angle. See
        // `applyVestibuloOcularReflex`.
        this.headYawAtFrameStart = this.head.yawDegrees;
        this.headPitchAtFrameStart = this.head.pitchDegrees;

    }

    /**
     * `eye = gaze − gain · head`. The whole vestibulo-ocular reflex, in two lines, because gaze
     * is tracked in rig space rather than in head space. Hold gaze still and turn the head and
     * the eyes counter-rotate exactly enough to keep the gaze point where it was; that is what
     * gain 1.0 means.
     *
     * The clamp afterwards is the eye's REACH, not the morph's end stop, and the difference is
     * the whole of defect 1.
     *
     * `headShareDegrees()` already promises that a settled eye never needs more than
     * EYE_COMFORT_FRACTION of its range. That promise used to hold only once the head had
     * ARRIVED — for the ~300 ms it takes to get there the eye carried the entire shift, ran off
     * the end of the morph, and sat against the stop. Measured, that was a quarter of all frames
     * within 1.3° of the mechanical limit, which is what the critic pass saw as a long sideways
     * glance under heavy lids.
     *
     * Clamping to the reach instead makes the promise true on every frame. Physiologically it is
     * also the better model: an eye making a gaze shift larger than its orbit does not slam into
     * the stop and wait — the saccade lands where the orbit allows, the head brings the rest, and
     * gaze arrives late. Gaze falling short of its target until the head catches up is exactly
     * what a real eye–head shift does; gaze arriving on time with the eyeball jammed against bone
     * is not.
     */
    applyVestibuloOcularReflex() {

        // 🚩 THE OTHER DEFECT, REBUILT ON PURPOSE. Composing against the head angle as it stood at
        // the START of the frame is what reading the bone alone used to do, and it makes the
        // reflex's latency equal to the frame time. The selftest's invariance section rejects it.
        const headYawDegrees = this.frameCoupledVestibuloOcular
            ? this.headYawAtFrameStart : this.head.yawDegrees;
        const headPitchDegrees = this.frameCoupledVestibuloOcular
            ? this.headPitchAtFrameStart : this.head.pitchDegrees;

        // Where the head is at THIS instant: what everyone else did to it as of the last commit,
        // plus this layer's own share as of now. See `readHeadRotation()`.
        this.headYawDegrees = this.externalHeadYawDegrees + headYawDegrees;
        this.headPitchDegrees = this.externalHeadPitchDegrees + headPitchDegrees;

        const yaw = this.currentGazeYawDegrees + this.microsaccadeYawDegrees -
            this.vestibuloOcularGain * this.headYawDegrees;
        const pitch = this.currentGazePitchDegrees + this.microsaccadePitchDegrees -
            this.vestibuloOcularGain * this.headPitchDegrees;

        const yawReach = this.horizontalEyeRangeDegrees() * EYE_COMFORT_FRACTION;
        const pitchReach = EYE_COMFORT_FRACTION *
            ( pitch >= 0 ? this.eyeExcursionDegrees.up : this.eyeExcursionDegrees.down );

        this.currentEyeYawDegrees = clamp( yaw, -yawReach, yawReach );
        this.currentEyePitchDegrees = clamp( pitch, -pitchReach, pitchReach );

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
        this.lastFixationSeconds = 0;

        this.forcedRegion = null;
        this.forcedRegionRemaining = 0;

        this.currentGazeYawDegrees = 0;
        this.currentGazePitchDegrees = 0;
        this.currentEyeYawDegrees = 0;
        this.currentEyePitchDegrees = 0;

        this.headYawDegrees = 0;
        this.headPitchDegrees = 0;
        this.externalHeadYawDegrees = 0;
        this.externalHeadPitchDegrees = 0;
        this.headYawAtFrameStart = 0;
        this.headPitchAtFrameStart = 0;

        // The two things that aim the head: the share of a shift it was commanded to take, and
        // the sustained eccentricity it has agreed to carry. See aimHead().
        this.commandedHeadYawDegrees = 0;
        this.commandedHeadPitchDegrees = 0;
        this.headRecentring = options.headRecentring ?? true;
        this.recentringYaw = { headDegrees: 0, eccentricSeconds: 0 };
        this.recentringPitch = { headDegrees: 0, eccentricSeconds: 0 };

        this.blinkCoupling = options.blinkCoupling ?? true;
        this.policyEnabled = options.policy ?? true;
        this.frameCoupledArrivals = options.frameCoupledArrivals ?? false;
        this.frameCoupledVestibuloOcular = options.frameCoupledVestibuloOcular ?? false;

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
        this.microsaccadeActive = false;
        this.microsaccadeCount = 0;

        // Rewound here for a reset outside the stack. In the stack's own path `onBind` runs a
        // moment later and replaces it with a schedule on a freshly forked stream.
        this.microsaccades?.reset();

        // -1 rather than 0, because MotionStack's first frame IS frame 1 and a layer must not
        // start the run believing it has already advanced.
        this.advancedForFrame = -1;
        this.exhaustedStepBudgetFrames = 0;
        this.worstStepsInAFrame = 0;

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
        //
        // ⚠️ This number is about the SHAPE of the neck and nothing else. It used to decide how
        // far the head SLID sideways as well, which is a different quantity and was never checked
        // against anything. See `onBindFromGaze()` for what that cost and how the two were
        // separated.
        this.neckShare = options.neckShare ?? 0.5;

        // Rig-space yaw and pitch axes expressed in each bone's REST frame. The stack commits
        // `bone.quaternion = rest · delta`, so a delta is read in the bone's rest frame; writing
        // a rig-space rotation therefore means conjugating it, `delta = R⁻¹ · A · R`, which for
        // an axis-angle is just the axis carried into that frame. This is what keeps "nod" a nod
        // on a rig whose head bone rests 99° off, instead of only on this one.
        this.boneAxes = new Map();

        // Measured at bind: the cervical column direction and how far off vertical it leans. Read
        // by the selftest, and reported rather than assumed because it is a property of the rig.
        this.cervicalColumn = new Vector3( 0, 1, 0 );
        this.cervicalTiltDegrees = 0;
        this.cervicalLengthMetres = 0;

        this.scratchYawRotation = new Quaternion();
        this.scratchPitchRotation = new Quaternion();
        this.scratchDesiredRotation = new Quaternion();
        this.scratchNeckRotation = new Quaternion();
        this.scratchHeadRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();

        this.targetYawDegrees = 0;
        this.targetPitchDegrees = 0;

        this.resetState();

    }

    /**
     * Called by Gaze once it has resolved the rig root, which both layers measure against.
     *
     * 🎯 THE NECK TURNS ABOUT ITS OWN LONG AXIS, NOT ABOUT THE ROOM'S VERTICAL. This is the whole
     * of the fix recorded below, and it is a modelling fact, not a tuning choice.
     *
     * The head joint on this rig sits **47.3 mm anterior and 97.3 mm superior** to `neck_01` — a
     * 108.2 mm cervical column leaning **25.95° forward** of vertical (measured on figure_g050 in
     * relaxed-standing; `Gaze.selftest.mjs` re-measures and prints all four, so they are facts
     * about whatever rig is loaded rather than numbers copied into a comment). Yawing the neck
     * about the ROOM's vertical therefore swings the head joint through an arc of radius 47 mm:
     * the skull does not just turn, it slides sideways by 47 mm × sin(neck yaw).
     *
     * Measured on the shipped `alive.js` stack, seed 1, 420 s at 30 fps — the same simulation
     * `captures/r5-body` was rendered from — with the cervical axis as the only difference between
     * the two runs:
     *
     *                                          vertical      column
     *   head lateral relative to the neck       9.22 mm      1.35 mm  SD
     *   pearson( head − neck, neck )             −0.226      −0.984
     *   head joint on screen, above 1/15 Hz      5.94 px      2.93 px  SD
     *   pelvis on screen, above 1/15 Hz          3.01 px      3.01 px  SD
     *   head / pelvis on that band                1.973        0.973
     *   head yaw                                22.253°      22.253°  SD  ← unchanged
     *
     * The last row is the point: **the head turns exactly as far as it did.** Only the sliding
     * stopped. A fix that had merely quietened the head would have shown up there.
     *
     * That arc was the whole residue. Nothing else in the stack moves the head sideways relative
     * to its own neck: `IdleMotion` and this layer's own head-bone share rotate the skull about
     * its own origin, which translates nothing, and `Sway`'s neck stabilisation opposes what is
     * left — which is why the correlation goes to −0.984 once the arc is gone.
     *
     * 🚩 `docs/PROGRESS.md` records this residue as *"a roll contribution — yaw and pitch do not
     * move the head joint"*. **That diagnosis is wrong, and it is wrong in a way worth keeping.**
     * Measured head world roll is **0.661° SD**, which over a 108 mm neck can produce 1.2 mm; the
     * observed 9.22 mm is 7.4× that. The mechanism is yaw, acting through a lever nobody had
     * measured — pitch and yaw genuinely do not move the head joint *when the axis passes through
     * it*, and the axis did not.
     *
     * Rotating the neck's share about the **column direction** instead puts the head joint ON the
     * axis of rotation, where a rotation cannot translate it. The neck still turns — the shape of
     * the bend is `neckShare`'s business and is deliberately untouched — but the skull turns in
     * place instead of swinging.
     *
     * A tilted axis costs two things — it under-delivers the yaw by about cos(tilt), and it tips
     * the skull toward one shoulder. Both are paid back exactly at the head joint rather than
     * approximately; see `writeCervicalChain()`, which is where the two joints stopped being two
     * copies of one rotation. The two are doing different jobs: the column carries the cervical
     * turn, the head joint aims.
     */
    onBindFromGaze( context ) {

        this.boneAxes.clear();

        const rigRoot = this.gaze.rigRoot;
        if ( rigRoot === null ) return;

        const neckBone = context.target.getBone?.( this.neckBoneName ) ?? null;
        const headBone = context.target.getBone?.( this.headBoneName ) ?? null;

        this.measureCervicalColumn( neckBone, headBone, rigRoot );

        for ( const [ boneName, bone ] of [ [ this.neckBoneName, neckBone ], [ this.headBoneName, headBone ] ] ) {

            if ( bone === null ) continue;

            // The rig-space rest rotation, kept whole rather than reduced to two axes: the head's
            // share is a general rotation now, not an axis-angle, so the conjugation that carries
            // it into the bone's rest frame needs the whole quaternion.
            this.boneAxes.set( boneName, {
                rest: rotationRelativeTo( bone, rigRoot, new Quaternion() )
            } );

        }

    }

    /**
     * Where the cervical column points, in rig space.
     *
     * Measured off the rig rather than declared, because the lean is anatomy: this figure's
     * column leans 26° forward, another rig's will not, and a hardcoded axis would silently
     * reintroduce the slide on any figure that is not this one. A rig whose two neck joints sit
     * on top of each other has no measurable column, so that case keeps the room's vertical and
     * says so by leaving `cervicalTiltDegrees` at zero.
     */
    measureCervicalColumn( neckBone, headBone, rigRoot ) {

        this.cervicalColumn.set( 0, 1, 0 );
        this.cervicalTiltDegrees = 0;
        this.cervicalLengthMetres = 0;

        if ( neckBone === null || headBone === null ) return;

        const rigInverse = new Matrix4().copy( rigRoot.matrixWorld ).invert();

        const neckPosition = new Vector3();
        const headPosition = new Vector3();

        neckBone.updateWorldMatrix( true, false );
        headBone.updateWorldMatrix( true, false );

        neckPosition.setFromMatrixPosition( neckBone.matrixWorld ).applyMatrix4( rigInverse );
        headPosition.setFromMatrixPosition( headBone.matrixWorld ).applyMatrix4( rigInverse );

        const column = headPosition.sub( neckPosition );
        this.cervicalLengthMetres = column.length();

        if ( this.cervicalLengthMetres < DEGENERATE_COLUMN_METRES ) return;

        this.cervicalColumn.copy( column ).normalize();

        this.cervicalTiltDegrees =
            Math.acos( clamp( this.cervicalColumn.y, -1, 1 ) ) * RADIANS_TO_DEGREES;

    }

    /** Gaze calls this when the head is released — before, with or after the eye saccade. */
    setTarget( yawDegrees, pitchDegrees ) {

        this.targetYawDegrees = clamp( yawDegrees, -HEAD_YAW_LIMIT_DEGREES, HEAD_YAW_LIMIT_DEGREES );
        this.targetPitchDegrees = clamp( pitchDegrees,
            -HEAD_PITCH_DOWN_LIMIT_DEGREES, HEAD_PITCH_UP_LIMIT_DEGREES );

    }

    update( deltaSeconds, context ) {

        // 🎯 THE HEAD SLOT IS WHERE THE WHOLE OCULAR SIMULATION RUNS, and it runs before this
        // layer writes a bone. Gaze's own slot is later, so a head driven from there would be
        // reading a target decided one frame ago — a lag of 33 ms at 30 Hz against 16.7 ms at
        // 60 Hz, which is a frame-rate-dependent head trajectory by any other name. Advancing
        // here instead makes the bone below carry THIS frame's decisions. The call is idempotent
        // per frame, so an eyes-only figure that never adds this layer still advances correctly
        // from `Gaze.update`.
        this.gaze.advanceOcularState( deltaSeconds, context );

        this.writeCervicalChain();

        return this.contribution;

    }

    /**
     * One sub-interval of head smoothing, driven from Gaze's walk rather than from the frame, so
     * that a target set part-way through a frame is smoothed toward from the instant it was set.
     */
    advanceSmoothing( seconds ) {

        const smoothTime = HEAD_SMOOTH_TIME_SECONDS / this.gaze.headSpeed;

        this.yawDegrees = this.yawSmoother.advance( this.targetYawDegrees, smoothTime, seconds );
        this.pitchDegrees = this.pitchSmoother.advance( this.targetPitchDegrees, smoothTime, seconds );

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
     * Writes the two cervical joints as ONE rotation split between them, rather than as two
     * independent copies of the same rotation scaled by a share.
     *
     * The distinction is what makes the column axis usable at all. Turning the neck about a
     * column that leans 26° forward stops the head sliding sideways, but it also tips the skull
     * toward one shoulder and leaves the yaw short. Measured with both joints writing
     * independently, over the selftest's sweep: **9.18° of head roll at the 55° clamp** and a
     * realised yaw of **51.70° for a commanded 55°**. That is the subaxial spine's real
     * coupled lateral flexion, and a real neck does not leave it standing: the upper cervical
     * joints take it back out, which is why a person turning their head keeps their eyes level.
     * Penning & Wilmink 1987 and Wang et al. 2019 both put 57–63% of cervical axial rotation at
     * Oc–C1/C1–C2, i.e. at the top of the chain, which on a two-joint rig is the head bone.
     *
     * So does this. The neck writes its share about the column; the head then writes
     * `A_neck⁻¹ · desired`, whatever that is — the gain the tilted axis lost, the coupled roll, and
     * the old fraction-of-a-degree pitch cross-coupling all come out in the same step, exactly
     * rather than approximately. The composition is exact because the stack applies each bone's
     * delta on the LEFT of its rest rotation in rig space, so the head's rig-space orientation is
     * `A_neck · A_head · rest`, and the head only has to carry the difference.
     *
     * `neckShare` is left doing the one job its comment claims: deciding the SHAPE of the bend.
     */
    writeCervicalChain() {

        const neckAxes = this.boneAxes.get( this.neckBoneName );
        const headAxes = this.boneAxes.get( this.headBoneName );

        // Where the head is being asked to point, in rig space. Pitch is negated because positive
        // pitch means "look up", and a right-handed rotation about the rig's +X axis tips the
        // forward direction down.
        this.scratchYawRotation.setFromAxisAngle(
            RIG_UP, this.yawDegrees * DEGREES_TO_RADIANS );
        this.scratchPitchRotation.setFromAxisAngle(
            RIG_RIGHT, -this.pitchDegrees * DEGREES_TO_RADIANS );
        this.scratchDesiredRotation
            .copy( this.scratchYawRotation ).multiply( this.scratchPitchRotation );

        // The neck's share, about the cervical column. A rig with no neck bone hands the whole
        // rotation to the head, which is the right degradation: no slide, no shape.
        this.scratchNeckRotation.identity();

        if ( neckAxes !== undefined ) {

            this.scratchYawRotation.setFromAxisAngle(
                this.cervicalColumn, this.yawDegrees * this.neckShare * DEGREES_TO_RADIANS );
            this.scratchPitchRotation.setFromAxisAngle(
                RIG_RIGHT, -this.pitchDegrees * this.neckShare * DEGREES_TO_RADIANS );
            this.scratchNeckRotation
                .copy( this.scratchYawRotation ).multiply( this.scratchPitchRotation );

            this.contribution.rotateBone( this.neckBoneName,
                conjugateIntoRestFrame( this.scratchNeckRotation, neckAxes.rest, this.scratchBoneDelta ) );

        }

        if ( headAxes === undefined ) return;

        // Whatever the neck did not deliver — including the roll it introduced.
        this.scratchHeadRotation
            .copy( this.scratchNeckRotation ).invert().multiply( this.scratchDesiredRotation );

        this.contribution.rotateBone( this.headBoneName,
            conjugateIntoRestFrame( this.scratchHeadRotation, headAxes.rest, this.scratchBoneDelta ) );

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
 *
 * 🎯 WITH `decay = exp( −ω·dt )` THIS IS THE EXACT ANALYTIC SOLUTION, not an integrator.
 * For a constant target the error `e = value − target` obeys `ë + 2ω·ė + ω²e = 0`, whose solution
 * is `e(t) = ( e₀ + ( v₀ + ω·e₀ )·t )·exp( −ω·t )` — which is line for line what is written below.
 * Exactness is the property that matters here: two half-steps then give bit-for-bit the same
 * answer as one whole step, so the head's trajectory does not depend on how often it is sampled.
 *
 * ⚠️ It used to use a Padé rational for `exp( −x )`, "accurate to ~0.1%, three multiplies instead
 * of a transcendental". True, and it is exactly that 0.1% that broke the identity: measured on a
 * 30° step target, 30 Hz against 60 Hz, the Padé form disagreed by **0.0286° worst / 0.0078° RMS**
 * and `Math.exp` by **0.000000°**. Cheap and nearly right is the wrong trade for a quantity a
 * frame-rate invariance gate is stated on.
 */
class CriticallyDampedAngle {

    constructor() {

        this.value = 0;
        this.velocity = 0;

    }

    advance( target, smoothTime, deltaSeconds ) {

        if ( deltaSeconds <= 0 ) return this.value;

        const omega = 2 / Math.max( smoothTime, 1e-4 );
        const decay = Math.exp( -omega * deltaSeconds );

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
/**
 * Carries a rig-space rotation into a bone's rest frame: `delta = rest⁻¹ · A · rest`.
 *
 * The stack commits `bone.quaternion = rest · delta`, so a delta is read in the bone's rest
 * frame. Conjugating is what keeps "nod" a nod on a rig whose head bone rests 99° off, instead of
 * only on this one. The old code conjugated the AXIS of an axis-angle, which is the same operation
 * written for the special case; this is the general form, needed since the head's share stopped
 * being an axis-angle.
 */
function conjugateIntoRestFrame( rigRotation, rest, out ) {

    return out.copy( rest ).invert().multiply( rigRotation ).multiply( rest );

}

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

/** Whichever of two signed angles is the larger demand, sign and all. */
function largerMagnitude( first, second ) {

    return Math.abs( first ) >= Math.abs( second ) ? first : second;

}
