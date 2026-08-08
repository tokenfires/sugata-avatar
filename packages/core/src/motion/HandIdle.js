/**
 * HandIdle — the thirty finger joints of a person who is standing still and not using their hands.
 *
 * A blind visual judge watched seven minutes of this figure and wrote: *"THE HANDS NEVER MOVE"* —
 * identical finger curl at every sample across the whole clip. It was right, and the reason is
 * worth stating precisely rather than as "the amplitude was low", because the amplitude was not
 * obviously low. It was 0.45° peak at a knuckle, which sounds like a reasonable micro-motion.
 *
 * Measured on figure_g050 in the relaxed-standing rest pose, over 420 s, on the committed bones:
 *
 *   index fingertip travel, in the HAND's own frame     0.73 mm peak-to-peak
 *   total index flexion (knuckle + middle joint)        1.19° of range about a 55.9° mean
 *
 * At the full-body framing this project captures at — 1200 px over a framed height of
 * 1.659 m × 1.10 = 1.825 m, so 0.657 px/mm — that is **0.48 pixels over seven minutes.** The
 * record in docs/PROGRESS.md already contains the verdict on that order of motion: a weight shift
 * worth "1.6 pixels at full-body framing" produced before-and-after plates that were
 * *indistinguishable*. This was three times smaller than the motion already known to be invisible.
 *
 * 🎯 So the defect was never "the fingers are switched off". It was that the amplitude was stated
 * in DEGREES AT A JOINT, a quantity nobody can picture, and never converted into the quantity the
 * defect is actually about — how far the fingertip goes, and whether a viewer can see it. That is
 * the same class of error as the two the sway layer went through (LEARNINGS §1.7, §1.11): a
 * number authored in one frame of reference and judged in another.
 *
 *
 * WHAT THIS LAYER AUTHORS, AND WHY IT IS A FRACTION RATHER THAN AN ANGLE
 *
 * Every amplitude here is a fraction of the joint's OWN RESTING FLEXION, measured off the rig at
 * bind. A relaxed hand sits in the position of rest — every joint partly flexed, held there by
 * passive flexor tone rather than by intent — and what a resting hand does over a minute is let
 * that tone vary. So the honest statement of the motion is *"the flexor tone varies by a tenth of
 * its resting value"*, not *"the knuckle moves 0.45 degrees"*.
 *
 * Three things fall out of that for free, and each of them would otherwise be a tuning table:
 *
 *   - **The finger-to-finger gradient.** Measured on this rig, resting flexion runs index 55.9°,
 *     middle 65.7°, ring 76.1°, little 90.8° (knuckle + middle joint). The little finger rests
 *     most flexed, so it has the most tone to give up and it drifts most. The eye knows that
 *     gradient without being able to name it; `RestPose`'s own notes say so, and it is a real
 *     consequence of the flexor arrangement.
 *   - **The joint-to-joint gradient.** The middle joint rests at 34.6° against the knuckle's
 *     21.3°, so it moves proportionally more, which is the right shape for a curl.
 *   - **Pose independence.** Point this at a figure holding a cup and the fingers keep drifting by
 *     a tenth of whatever they are flexed to. No constant needs revisiting.
 *
 *
 * WHERE THE HINGE AXES COME FROM
 *
 * Each joint's flexion axis is the cross product of the two segment directions it sits between,
 * read off the rig's world matrices at bind. That is exactly how `RestPose` derives its elbow
 * hinge ("the cross product of the bind pose's upper-arm and forearm directions"), and it is
 * better than one shared across-the-palm axis in two ways: the thumb, whose plane is oblique to
 * the other four, stops needing a fudge factor, and a figure exported in a different hand pose
 * still curls rather than splaying.
 *
 * The distal joint is the one place there is nothing to take a cross product with — the rig has no
 * fingertip bone, so its distal segment has no successor. It borrows the middle joint's axis,
 * which is anatomically right: the DIP and PIP hinges of a finger are parallel.
 *
 *
 * FREQUENCIES — WHY THE PERLIN LADDER STOPS BEFORE IT GETS HERE
 *
 * Perlin & Goldberg's *Improv* ladder (research/body-motion-numbers.md §7) runs ~1 Hz upper arm,
 * ~2 Hz forearm, ~4 Hz wrist, one octave apart, rationalised by each segment carrying about half
 * the mass of the one above. Continued naively the fingers land at 8 Hz.
 *
 * 🚩 That continuation is wrong, and it is wrong by Perlin's own argument rather than in spite of
 * it. The mass rationale describes a segment SETTLING under its own inertia. A resting finger is
 * not settling under inertia; it is held by tone, and tone varies on the timescale of a breath,
 * not of a twitch. Worse, 8 Hz would put the spectral tail squarely inside the 8–12 Hz
 * physiological-tremor band, and idle motion that reaches that band reads as illness rather than
 * life. Relaxed fingers drift; they do not buzz. The tremor band is gated, not assumed.
 *
 * So the fingers get the same two slow rates `BodyIdle` chose for the same reason — a shared
 * whole-hand drift at 0.7 Hz with a quarter as much per-finger independence at 1.4 Hz on top.
 * Fingers each wandering on their own stream read as a hand playing an invisible piano; the
 * selftest gates the same-hand correlation to keep them together.
 *
 * (Gradient noise at lattice rate f puts its energy near 0.5f — measured in this codebase, see the
 * band calibration in Sway.js — so 0.7 Hz produces about 0.35 Hz of actual content.)
 *
 *
 * THE RE-SETTLE, AND WHY A DRIFT ALONE IS NOT ENOUGH
 *
 * A continuous drift makes every sampled frame different, which is literally what the judge asked
 * for. It does not make the hand read as ALIVE, because a drift has no event structure: nothing
 * ever happens, the curl merely is different later. A resting hand also re-settles — the fingers
 * ease out a little and curl back, once every half-minute or so, over a second or two.
 *
 * That is the same shape as `BodyIdle`'s shoulder settle and `Sway`'s fidget: fast in, slow out,
 * Poisson-timed, ending exactly where it began. 🚩 Its RATE has no primary support and none is
 * claimed — see `HAND_RESETTLE_RATE`. What is gated is the consequence, not the constant.
 *
 *
 * WHO OWNS THE FINGERS
 *
 * `BodyIdle` declares all thirty finger bones too, and stack contributions SUM — so a stack
 * running both as shipped would silently double every finger joint, which is precisely the trap
 * `IdleMotion` and `BodyIdle` already documented for the arms. This layer resolves it the same way
 * and in the same place: on the first frame, once the stack is fully assembled, it switches
 * `BodyIdle.fingersEnabled` off and takes the channel. See `claimFingers()` for why taking is the
 * right direction here and why it is not left to the integrator to remember.
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D, PoissonSchedule } from './Signals.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './Breath.js';
import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';

// --- constants measured in this repository -------------------------------------------------

/**
 * How flexed the distal joint rests, as a fraction of the middle joint's resting flexion.
 *
 * The rig has no fingertip bone, so the distal joint's flexion cannot be read as an angle between
 * two segment directions the way the other two can. It is read instead off the pose that authored
 * it — `figure/poses/relaxed-standing.json`, whose per-joint increments for this figure are
 * index 24 → 10, middle 34 → 13, ring 38 → 16, little 45 → 18. Those four ratios are 0.417,
 * 0.382, 0.421 and 0.400; their mean is 0.405.
 *
 * The thumb's own ratio there is 12 → 8 = 0.67, which is a different joint doing a different job.
 * It is left out of the mean and the thumb simply takes the four-finger figure: half a degree of
 * error on a joint whose whole excursion is a few degrees, against the cost of a second constant
 * carrying a single data point.
 */
const DISTAL_FLEXION_FRACTION_OF_MIDDLE_JOINT = 0.405;

/**
 * The two rates, in Hz, and the split between them. Taken from `BodyIdle`'s finger model rather
 * than re-derived, because the reasoning there is sound and having the two layers disagree about
 * how fast a hand drifts would be a difference with no meaning. The weights sum to 1 so that the
 * drift fraction below stays an honest statement of the peak.
 */
const HAND_UNIT_FREQUENCY_HZ = 0.7;
const FINGER_INDIVIDUAL_FREQUENCY_HZ = 1.4;
const HAND_UNIT_WEIGHT = 0.75;
const FINGER_INDIVIDUAL_WEIGHT = 0.25;

/**
 * Wallbott 1998 (research/body-motion-numbers.md §4), movement dynamics/energy: 1.00 for sadness
 * to 2.73 for hot anger. The widest spread and by far the largest between-emotion F (14.10) of any
 * body measure in the paper, which is why it is the arousal gain everywhere in this stack.
 */
const WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL = 1.00;
const WALLBOTT_DYNAMICS_AT_HIGHEST_AROUSAL = 2.73;

/**
 * Amplitude takes the full arousal gain; the noise RATE takes its square root. 2.73× on a 1.4 Hz
 * lattice would push the fastest finger stream's tail toward the 8–12 Hz tremor band, and an
 * aroused figure should look energised rather than unwell. Same reasoning, same exponent, as
 * `BodyIdle.AROUSAL_RATE_EXPONENT`.
 */
const AROUSAL_RATE_EXPONENT = 0.5;

// --- tuning constants, with no primary support -----------------------------------------------

/**
 * TUNING. The continuous drift, as a fraction of each joint's measured resting flexion.
 *
 * Nothing in docs/research/ gives an idle finger amplitude, so this is a judgement — but it is a
 * judgement about a quantity that can be checked, which the 0.45° it replaces was not. At 0.12,
 * with the re-settle below on top, the index finger's total flexion swings 14–17° peak-to-peak
 * about its 55.9° rest over a seven-minute window, which carries the fingertip 7–9 mm — 5–6 px at
 * full-body framing, against the 1.6 px this project has on record as indistinguishable and the
 * 0.5 px the layer this replaces was producing.
 *
 * The selftest prints fingertip travel in millimetres AND in full-body pixels, and gates the
 * pixels, precisely so this constant is judged by what it produces rather than trusted.
 */
const FINGER_DRIFT_FRACTION_OF_RESTING_FLEXION = 0.12;

/**
 * TUNING. One re-settle's peak, as a fraction of resting flexion. Larger than the drift because a
 * discrete event has to be legible as an event; small enough that it stays a settle rather than
 * becoming a gesture, which belongs to `Gesture` and not here.
 */
const RESETTLE_FRACTION_OF_RESTING_FLEXION = 0.16;

/**
 * TUNING, and 🚩 the weakest number in this file. Re-settles per second, per hand.
 *
 * There is no measured resting-hand fidget rate in docs/research/. What is there is a three-way
 * convergence on roughly one to two POSTURAL events a minute — Duarte & Zatsiorsky's ~1.2/min
 * lateral fidget, Bates et al.'s 2.39/min at a 10%-bodyweight threshold, Cassell et al.'s
 * 1.4–1.6/min in conversation. A hand is a distal, low-inertia, high-degree-of-freedom segment and
 * fidgets more often than the trunk does, but by how much is not in the record and is not invented
 * here. 3/min per hand is the order of magnitude of the postural figure, chosen so a viewer
 * sampling every ten seconds sees a different hand most times.
 *
 * What the selftest gates is the CONSEQUENCE — articulation per unit time, and no tremor-band
 * power — never this constant.
 */
const HAND_RESETTLE_RATE = 3 / 60;

/**
 * TUNING. The re-settle's shape: fast out of the resting curl, slow back into it. The asymmetry is
 * what makes it read as a release rather than as a grip. Same profile as `BodyIdle`'s shoulder
 * settle, for the same reason.
 */
const RESETTLE_SECONDS = 1.8;
const RESETTLE_RISE_FRACTION = 0.30;

/**
 * TUNING. How much each finger joins in a given re-settle, drawn per finger per event. A hand that
 * re-settles every digit by exactly the same fraction reads as a clamp closing; the whole point of
 * the event is that the hand is loose.
 */
const RESETTLE_FINGER_SHARE = [ 0.35, 1.0 ];

const DEGREES_TO_RADIANS = Math.PI / 180;

/** Below this the two segment directions are collinear and their cross product is meaningless. */
const HINGE_AXIS_MINIMUM_LENGTH = 1e-6;

/**
 * Rig-space fallback axis, matching the convention verified on figure_g050.glb (2026-08-07):
 * +X left-right, +Y up, +Z forward. Only reached on a rig whose fingers are perfectly straight at
 * bind, where there is no hinge plane to measure.
 */
const FRONTAL_AXIS = new Vector3( 0, 0, 1 );

/**
 * The five digits as the humanoid vocabulary names them. `Skeleton.js` already maps all thirty
 * onto this figure's bones, so this only has to name the keys and their order along the chain.
 */
const FINGERS = [
    { name: 'Thumb', segments: [ 'Metacarpal', 'Proximal', 'Distal' ] },
    { name: 'Index', segments: [ 'Proximal', 'Intermediate', 'Distal' ] },
    { name: 'Middle', segments: [ 'Proximal', 'Intermediate', 'Distal' ] },
    { name: 'Ring', segments: [ 'Proximal', 'Intermediate', 'Distal' ] },
    { name: 'Little', segments: [ 'Proximal', 'Intermediate', 'Distal' ] }
];

export class HandIdle extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.amplitude=1] - One multiplier over every joint, for art direction.
     *   The fractions above stay readable as the statement of intent they are.
     * @param {number} [options.arousal=0] - [0, 1]. See setArousal().
     * @param {boolean} [options.resettlesEnabled=true] - Turn off to measure the drift alone.
     * @param {string|null} [options.claimFingersFrom='bodyIdle'] - Name of a layer that also
     *   drives the fingers and exposes a `fingersEnabled` flag. Pass null to leave it alone and
     *   accept the doubling, which is only ever right in a test that wants to measure it.
     * @param {boolean} [options.frameCoupledArrivals=false] - Rebuilds the pre-conversion defect:
     *   one Bernoulli coin per hand per frame, off one shared stream. The rate stays correct and
     *   the trajectory becomes a function of the frame rate. Exists so the invariance gate has
     *   something to reject; see `Signals.poissonEventOccurs` and LEARNINGS §1.13.
     */
    constructor( options = {} ) {

        super( {
            name: options.name ?? 'handIdle',
            // After BodyIdle (SWAY + 60), which owns everything from the girdle to the wrist, and
            // well before GESTURE: idle micro-motion is the floor a real hand gesture is layered
            // on top of, never a competitor to one.
            order: options.order ?? ( MOTION_ORDER.SWAY + 70 ),
            boneChannels: [ ...fingerBoneNamesForSide( 'left' ), ...fingerBoneNamesForSide( 'right' ) ]
        } );

        this.amplitude = options.amplitude ?? 1;
        this.arousal = clampUnit( options.arousal ?? 0 );
        this.resettlesEnabled = options.resettlesEnabled ?? true;
        this.frameCoupledArrivals = options.frameCoupledArrivals ?? false;
        this.claimFingersFrom = options.claimFingersFrom === undefined ? 'bodyIdle' : options.claimFingersFrom;

        // Noise position, integrated rather than read off elapsed time, so a change of arousal
        // changes the rate the noise is read at without jumping to a new position in it.
        this.noisePhase = 0;

        this.eventCounts = { resettle: 0 };

        // Filled in at bind, because every amplitude in this layer is a fraction of something
        // measured on the figure. Two entries, one per hand.
        this.hands = [ createHand( 'left' ), createHand( 'right' ) ];

        // Ownership is resolved on the first frame rather than here; see claimFingers().
        this.fingerOwnershipResolved = false;
        this.yieldedLayer = null;

        this.scratchRigRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();

    }

    // --- action -----------------------------------------------------------------------------

    /**
     * @param {number} arousal - [0, 1]. Scales amplitude by Wallbott's 1.00–2.73 dynamics range,
     *   the noise rate by its square root, and the re-settle rate by all of it — a Poisson rate
     *   has no spectrum to push anywhere.
     */
    setArousal( arousal ) {

        this.arousal = clampUnit( arousal );

    }

    onBind( context ) {

        // Deferred to the first frame for the same reason IdleMotion defers its arm claim:
        // onBind() runs as each layer is ADDED, so a stack that adds this layer before BodyIdle
        // would resolve ownership against a stack that does not have one yet.
        this.fingerOwnershipResolved = false;

        for ( const hand of this.hands ) this.prepareHand( hand, context.target );

    }

    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        if ( this.fingerOwnershipResolved === false ) this.claimFingers();

        const amplitudeGain = this.amplitudeGain;

        this.noisePhase += deltaSeconds * this.noiseRateGain;

        for ( const hand of this.hands ) {

            if ( this.resettlesEnabled ) this.advanceResettle( hand, deltaSeconds, amplitudeGain );

            this.writeHand( hand, amplitudeGain );

        }

        return this.contribution;

    }

    reset() {

        this.noisePhase = 0;
        this.eventCounts = { resettle: 0 };

        for ( const hand of this.hands ) {

            hand.resettle.elapsedSeconds = 0;
            hand.resettle.active = false;

            // Redraws the first arrival on the rewound stream. Optional-chained because reset() can
            // be called on a layer that has never been bound, which is where the schedule is built.
            hand.schedule?.reset();

            for ( const finger of hand.fingers ) finger.resettleShare = 0;

        }

    }

    dispose() {

        // Hand the channel back. A layer that silences another one and then leaves would take the
        // fingers with it, and the failure would present as "the hands stopped moving when I
        // removed an unrelated layer" — which is exactly the kind of bug this file exists to end.
        if ( this.yieldedLayer !== null ) {

            this.yieldedLayer.fingersEnabled = true;
            this.yieldedLayer = null;

        }

    }

    // --- gains --------------------------------------------------------------------------------

    /** Wallbott's dynamics scale, normalised so arousal 0 leaves the fractions above alone. */
    get amplitudeGain() {

        const dynamics = WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL
            + this.arousal * ( WALLBOTT_DYNAMICS_AT_HIGHEST_AROUSAL - WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL );

        return dynamics / WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL;

    }

    /** The same gain, held back so an aroused hand does not drift into the tremor band. */
    get noiseRateGain() {

        return Math.pow( this.amplitudeGain, AROUSAL_RATE_EXPONENT );

    }

    // --- ownership ------------------------------------------------------------------------------

    /**
     * Who owns the fingers.
     *
     * `BodyIdle` declares all thirty finger bones and drives them at a fixed 0.45° peak. Bone
     * contributions SUM, so leaving both running is not an error the stack can catch — it is a
     * silent doubling, the same trap already documented between `IdleMotion` and `BodyIdle` on the
     * arms.
     *
     * 🎯 The direction of the resolution is the opposite of IdleMotion's, and deliberately so.
     * IdleMotion YIELDS the arms because BodyIdle's arm model is the richer one. Here it is the
     * other way round: `BodyIdle`'s finger model is a strict subset of this one — a shared drift
     * plus per-finger independence, which this layer also has, at an amplitude measured at 0.48 px
     * of fingertip travel over seven minutes at full-body framing. So this layer takes the
     * channel, and a consumer gets the working behaviour by adding a layer rather than by
     * remembering to switch another one off.
     *
     * Reaching into a sibling layer's flag is not free of surprise, which is why it is a named,
     * defeatable option; why the previous value is restored in dispose(); and why the selftest
     * asserts that it happened rather than assuming it.
     */
    claimFingers() {

        this.fingerOwnershipResolved = true;

        if ( this.claimFingersFrom === null || this.stack === null ) return;

        const owner = this.stack.findLayer( this.claimFingersFrom );

        if ( owner === null || typeof owner.fingersEnabled !== 'boolean' ) return;

        if ( owner.fingersEnabled === true ) {

            owner.fingersEnabled = false;
            this.yieldedLayer = owner;

        }

    }

    // --- events ---------------------------------------------------------------------------------

    /**
     * The discrete half: the hand eases out of its resting curl and settles back into it. Poisson
     * timed per hand, so the two hands never re-settle together.
     *
     * 🎯 A SCHEDULE, NOT A PER-FRAME COIN. `poissonEventOccurs(rate, dt)` gets the long-run rate
     * right at any frame rate and the realised sequence wrong at all of them, because it consumes
     * one draw per FRAME. See `Signals.poissonEventOccurs` and LEARNINGS §1.13.
     *
     * 🚩 AND THE REFRACTORY IS THE SECOND COUPLING. A running re-settle blocks the next arrival, so
     * the block ends at `RESETTLE_SECONDS` — and a frame stepping over that instant used to carry
     * the block to the next frame boundary, quantising the refractory window to dt exactly the way
     * `Blink`'s countdown quantised its intervals (§1.13a). The frame is therefore cut at the
     * event's end as well as at each arrival. Pausing a memoryless wait while an event runs is
     * exactly equivalent to suppressing the coins, not an approximation of it.
     *
     * The rate is arousal-scaled, which the schedule handles by counting down in unit-rate units at
     * `rate × seconds` — the integral of the rate rather than a frozen sample of it.
     */
    advanceResettle( hand, deltaSeconds, amplitudeGain ) {

        const rate = HAND_RESETTLE_RATE * amplitudeGain;

        if ( this.frameCoupledArrivals ) {

            // 🚩 THE DEFECT, REBUILT ON PURPOSE, so the invariance gate has something to reject.
            // One coin per hand per frame, off the LAYER's stream, so the two hands re-interleave
            // through the draw order as well.
            if ( hand.resettle.active ) {

                hand.resettle.elapsedSeconds += deltaSeconds;
                if ( hand.resettle.elapsedSeconds >= RESETTLE_SECONDS ) hand.resettle.active = false;
                return;

            }

            if ( this.random.poissonEventOccurs( rate, deltaSeconds ) ) this.beginResettle( hand, this.random );

            return;

        }

        let remaining = deltaSeconds;

        while ( remaining > 0 ) {

            if ( hand.resettle.active ) {

                const step = Math.min( remaining,
                    Math.max( RESETTLE_SECONDS - hand.resettle.elapsedSeconds, 0 ) );

                hand.resettle.elapsedSeconds += step;
                remaining -= step;

                if ( hand.resettle.elapsedSeconds < RESETTLE_SECONDS ) break;

                hand.resettle.active = false;
                continue;

            }

            const step = Math.min( remaining, hand.schedule.secondsUntilArrival( rate ) );

            remaining -= step;

            hand.schedule.advance( rate, step, () => this.beginResettle( hand, hand.schedule.random ) );

        }

    }

    /**
     * @param {Object} hand
     * @param {MotionRandom} random - The hand's OWN stream in the shipped path. The frame-coupled
     *   rebuild passes the layer stream, because sharing one was half of that defect.
     */
    beginResettle( hand, random ) {

        hand.resettle.elapsedSeconds = 0;
        hand.resettle.active = true;

        // Negative: a re-settle eases the fingers OUT of their curl before returning. Extending is
        // what a hand at rest has room to do; curling further is a grip.
        for ( const finger of hand.fingers ) {

            finger.resettleShare = -random.range( RESETTLE_FINGER_SHARE[ 0 ], RESETTLE_FINGER_SHARE[ 1 ] );

        }

        this.eventCounts.resettle ++;

    }

    // --- posing -----------------------------------------------------------------------------------

    /**
     * One hand: a drift shared by every joint in it, a quarter as much per-finger independence on
     * top, and whatever the re-settle is asking for. All of it as a fraction of each joint's own
     * measured resting flexion, about that joint's own measured hinge.
     */
    writeHand( hand, amplitudeGain ) {

        const unitDrift = hand.unitNoise.at( this.noisePhase * HAND_UNIT_FREQUENCY_HZ + hand.noiseOffset );
        const resettle = resettleShape( hand.resettle );

        for ( const finger of hand.fingers ) {

            const individualDrift = finger.noise.at(
                this.noisePhase * FINGER_INDIVIDUAL_FREQUENCY_HZ + hand.noiseOffset );

            const drift = HAND_UNIT_WEIGHT * unitDrift + FINGER_INDIVIDUAL_WEIGHT * individualDrift;

            const flexionFraction = amplitudeGain * this.amplitude * (
                FINGER_DRIFT_FRACTION_OF_RESTING_FLEXION * drift
                + RESETTLE_FRACTION_OF_RESTING_FLEXION * resettle * finger.resettleShare );

            for ( const joint of finger.joints ) {

                this.scratchRigRotation.setFromAxisAngle( joint.hingeAxis, flexionFraction * joint.restingFlexionRadians );

                toBoneDeltaFrame( this.scratchRigRotation, joint.restFrame, this.scratchBoneDelta );

                this.contribution.rotateBone( joint.boneName, this.scratchBoneDelta );

            }

        }

    }

    // --- bind-time resolution -----------------------------------------------------------------

    /**
     * Reads one hand off the rig: every joint's hinge axis and resting flexion, its rest frame,
     * and the noise streams that drive it.
     *
     * Seeds come from the layer's own random stream, which MotionStack rewinds before it re-runs
     * onBind, so a reset reproduces the run exactly. Every hand and every finger gets its own
     * stream — symmetric finger drift is the same "it's a rig" tell as symmetric arm drift, and
     * two independent noise signals never phase-lock however their rates are related.
     */
    prepareHand( hand, target ) {

        // A whole lattice period apart, so the two hands could not align even if a future change
        // accidentally handed them the same noise table.
        hand.noiseOffset = this.random.range( 0, 128 );
        hand.unitNoise = new CoherentNoise1D( this.nextSeed(), 256 );
        hand.fingers = [];

        // Forked from the seed and the label rather than from the current state, so the two hands'
        // arrival streams do not depend on how far the layer stream has been drawn when they are
        // built — which is what makes a left hand's re-settles independent of the right's.
        hand.schedule = new PoissonSchedule( this.random.fork( `handIdle:${ hand.side }` ) );

        const wrist = target.getBone( HUMANOID_TO_FIGURE_BONE[ `${ hand.side }Hand` ] );

        for ( const finger of FINGERS ) {

            const boneNames = finger.segments.map(
                ( segment ) => HUMANOID_TO_FIGURE_BONE[ `${ hand.side }${ finger.name }${ segment }` ] );

            const bones = boneNames.map( ( boneName ) => target.getBone( boneName ) );

            if ( wrist == null || bones.some( ( bone ) => bone == null ) ) continue;

            hand.fingers.push( {
                name: finger.name,
                noise: new CoherentNoise1D( this.nextSeed(), 256 ),
                resettleShare: 0,
                joints: resolveFingerJoints( wrist, bones, boneNames, finger.segments )
            } );

        }

    }

    nextSeed() {

        return this.random.integer( 0, 0x7fffffff );

    }

    // --- inspection -----------------------------------------------------------------------------

    /**
     * What this layer read off the rig at bind, per finger, in degrees: the knuckle-plus-middle
     * flexion every amplitude here is a fraction of.
     *
     * 🚩 Worth reading before wondering why a figure's hands are quiet. This layer's amplitude is a
     * fraction of resting flexion, so a rig standing in its raw BIND pose — fingers half straight,
     * measured 27.1° on figure_g050 against 55.9° once `relaxed-standing` is applied — gets about
     * half the excursion. That is the model being consistent rather than a bug, but an unposed rig
     * is an authoring state and not a configuration anybody renders, and this is how to see it.
     *
     * @returns {Array<{side: string, finger: string, restingFlexionDegrees: number}>}
     */
    describeRestingFlexion() {

        const rows = [];

        for ( const hand of this.hands ) {

            for ( const finger of hand.fingers ) {

                // The first two joints only: the distal one is a fixed fraction of the middle one
                // rather than an independent measurement, so including it would double-count.
                const total = finger.joints.slice( 0, 2 )
                    .reduce( ( sum, joint ) => sum + joint.restingFlexionDegrees, 0 );

                rows.push( { side: hand.side, finger: finger.name, restingFlexionDegrees: total } );

            }

        }

        return rows;

    }

}

// --- local helpers ------------------------------------------------------------------------------

function createHand( side ) {

    return {
        side,
        noiseOffset: 0,
        unitNoise: null,
        fingers: [],
        resettle: { elapsedSeconds: 0, active: false },

        // 🎯 ONE SCHEDULE PER HAND. The two hands used to share `this.random`, so which hand fired
        // first in a frame decided the draw order for both — and which frame that was depends on
        // dt. Built at bind, where the layer's stream arrives.
        schedule: null
    };

}

/**
 * The three joints of one finger, each with the hinge it turns about and how far it already rests
 * turned about it. Both are read from world matrices, which is the frame the layer's rotations are
 * composed in, and both are only meaningful at bind — before any layer has posed the figure.
 *
 * The hinge is the cross product of the two segment directions the joint sits between, taken in
 * that order so that a POSITIVE rotation about it increases flexion. That sign convention is what
 * lets one signed drift signal curl a whole finger coherently, and it comes out right on both
 * hands without a mirror term, because both segment directions mirror with the hand.
 */
function resolveFingerJoints( wrist, bones, boneNames, segmentNames ) {

    const points = [ worldPositionOf( wrist ), ...bones.map( worldPositionOf ) ];

    const directions = [];

    for ( let index = 0; index < points.length - 1; index ++ ) {

        directions.push( points[ index + 1 ].clone().sub( points[ index ] ) );

    }

    const joints = [];

    for ( let index = 0; index < bones.length; index ++ ) {

        // The distal joint has no successor segment to measure against, so it borrows the middle
        // joint's hinge and a fraction of its flexion. See DISTAL_FLEXION_FRACTION_OF_MIDDLE_JOINT.
        const borrowsFromParent = index === bones.length - 1;
        const measuredAt = borrowsFromParent ? index - 1 : index;

        const before = directions[ measuredAt ].clone().normalize();
        const after = directions[ measuredAt + 1 ].clone().normalize();

        const hingeAxis = new Vector3().crossVectors( before, after );

        const flexion = Math.acos( Math.min( Math.max( before.dot( after ), -1 ), 1 ) )
            * ( borrowsFromParent ? DISTAL_FLEXION_FRACTION_OF_MIDDLE_JOINT : 1 );

        joints.push( {
            boneName: boneNames[ index ],
            segmentName: segmentNames[ index ],
            hingeAxis: hingeAxis.lengthSq() > HINGE_AXIS_MINIMUM_LENGTH
                ? hingeAxis.normalize()
                : FRONTAL_AXIS.clone(),
            restingFlexionRadians: flexion,
            restingFlexionDegrees: flexion / DEGREES_TO_RADIANS,
            restFrame: restRotationRelativeToRig( bones[ index ] )
        } );

    }

    return joints;

}

/**
 * The re-settle's profile: out fast, back slowly, zero at both ends. A raised cosine on each half
 * so velocity is continuous across the turn and the event has no corner in it.
 */
function resettleShape( resettle ) {

    if ( resettle.active === false ) return 0;

    const phase = resettle.elapsedSeconds / RESETTLE_SECONDS;

    if ( phase <= 0 || phase >= 1 ) return 0;

    if ( phase < RESETTLE_RISE_FRACTION ) {

        return 0.5 - 0.5 * Math.cos( Math.PI * phase / RESETTLE_RISE_FRACTION );

    }

    return 0.5 + 0.5 * Math.cos( Math.PI * ( phase - RESETTLE_RISE_FRACTION ) / ( 1 - RESETTLE_RISE_FRACTION ) );

}

/** Every finger bone on one side, in the rig's own names. */
function fingerBoneNamesForSide( side ) {

    return FINGERS.flatMap( ( finger ) =>
        finger.segments.map( ( segment ) => HUMANOID_TO_FIGURE_BONE[ `${ side }${ finger.name }${ segment }` ] ) );

}

function worldPositionOf( object ) {

    return new Vector3().setFromMatrixPosition( object.matrixWorld );

}

function clampUnit( value ) {

    return Math.min( Math.max( value, 0 ), 1 );

}
