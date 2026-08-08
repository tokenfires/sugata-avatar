/**
 * BodyIdle — the arms, hands, shoulder girdle and trunk of a person who is standing still.
 *
 * A silent human's hands are never perfectly still. Breath keeps the ribcage moving and Sway
 * keeps the stance moving, and both of those reach the head through the spine — which is exactly
 * the failure a critic reported against this figure: "no arm/hand/torso idle whatsoever, the arms
 * are rigid, the body is a statue with a living head." A body whose head is alive and whose arms
 * are welded is worse than one that is wholly still, because the stillness becomes conspicuous by
 * contrast.
 *
 *
 * WHAT THIS LAYER OWNS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Owns: clavicles, upper arms, forearms, hands, all thirty finger joints, and one trunk DOF.
 * Does not own: the head and neck (IdleMotion), the sagittal ribcage/belly expansion (Breath),
 * the postural lean (Sway).
 *
 * 🚩 IdleMotion.js ALSO declares the six arm bones, at about a degree of peak deviation each.
 * Contributions sum, so running both is not an error — it is a quiet doubling that nobody
 * intended. The intended configuration is IdleMotion driving the head and BodyIdle driving
 * everything below the neck. Until IdleMotion grows a switch for that, the integrator has to
 * choose; the stack's conflict report names both writers on every arm bone, which is precisely
 * why every channel here is declared even when the layer is mostly quiet on it.
 *
 *
 * THE FREQUENCIES, AND WHY THEY ARE OCTAVES
 *
 * Perlin & Goldberg, *Improv* (SIGGRAPH '96), drive an idle arm from coherent-noise signals
 * N0, N1, N2, each one octave above the last: **~1 Hz upper arm, ~2 Hz forearm, ~4 Hz wrist**
 * (§7 of docs/research/body-motion-numbers.md).
 *
 * Perlin is explicit that these were chosen because they LOOKED right, and that "frequency ratios
 * that varied significantly from these did not look natural." His post-hoc rationalisation of the
 * 2:1 step is that the forearm has about half the mass of the whole arm, so it settles about twice
 * as fast. That is not a derivation and he does not offer it as one — but it is the only published
 * number for this, it came out of a lot of looking, and his broader argument is the reason to
 * trust it: viewers perceive the STATISTICS of a motion, not its mechanism.
 *
 * Two extensions of the ladder, both ours rather than his, both following the same mass argument:
 *
 *   - The shoulder GIRDLE (clavicle) sits one octave BELOW the upper arm, at 0.5 Hz. It carries
 *     the scapula plus the whole arm, so by Perlin's own reasoning it settles slower than any
 *     joint he modelled.
 *   - The fingers do NOT continue upward to 8 Hz. Extending the ladder there would put finger
 *     motion's spectral tail inside the 8–12 Hz physiological-tremor band, and idle motion that
 *     reaches that band reads as illness rather than life. Relaxed fingers drift; they do not
 *     buzz. They get a slow shared drift instead, and the selftest gates the tremor band.
 *
 * Note that gradient noise at lattice rate f puts its spectral energy near 0.5f — measured in
 * this codebase, see the band calibration in Sway.js — so the "4 Hz" wrist produces about 2 Hz of
 * actual content. The 1:2:4 RATIO is what survives into the output, and that ratio is what the
 * selftest asserts. It measures the dominant frequency of each joint's own angle series rather
 * than trusting the constants below.
 *
 *
 * DECORRELATION IS NOT OPTIONAL
 *
 * Every joint on every side draws from its OWN noise stream, and each side additionally carries
 * its own offset along the noise lattice. Symmetric arm drift is the single most recognisable
 * "it's a rig" tell in an idle pose — it reads as mechanical instantly, before a viewer can say
 * why. Independent noise streams never phase-lock however their rates are related, which is a
 * property of noise rather than of the rates, so the octave ladder above costs nothing here.
 *
 * The one place symmetry is correct is a shoulder settle, which really is bilateral — and even
 * there the two sides get independently drawn amplitudes and a short onset lag.
 *
 *
 * 🚩 AMPLITUDES ARE NOT MEASURED. Improv's own intervals — an upper arm swinging over 25°–55° —
 * are for a stylised, gesturing character and are one to two orders of magnitude too large for a
 * photoreal figure standing quietly. Nothing in the research doc gives an idle micro-motion
 * amplitude for a limb. The defaults below are conservative tuning constants: a few degrees at
 * the shoulder, less at every joint further down. Over-animating an idle is as bad as having
 * none — it reads as fidgeting or as a nervous condition — so the selftest prints the resulting
 * per-joint angular RMS in degrees precisely so a reader can judge them rather than trust them.
 *
 *
 * AROUSAL
 *
 * Wallbott 1998 (§4 of the research doc) rates movement dynamics/energy 1–3 per emotion:
 * **1.00 for sadness up to 2.73 for hot anger, a 2.7× range**, and it carries by far the largest
 * between-emotion F of any body measure (14.10). That makes it the primary arousal gain, and it
 * converges with the GRETA finding in §1: dynamics/energy read poorly as a channel of its own,
 * but as a MULTIPLIER on amplitude and speed it is strongly emotion-discriminative. So it is
 * applied as a multiplier here and never as a channel.
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D, PoissonSchedule } from './Signals.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './Breath.js';
import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';

// --- measured constants ------------------------------------------------------------------

/** Improv's N0/N1/N2, in Hz. One octave apart. Do not "improve" the ratio; Perlin already tried. */
const UPPER_ARM_FREQUENCY_HZ = 1;
const FOREARM_FREQUENCY_HZ = 2;
const WRIST_FREQUENCY_HZ = 4;

/** One octave below N0, by Perlin's own mass argument. See the file header. */
const CLAVICLE_FREQUENCY_HZ = 0.5;

/**
 * Wallbott 1998, movement dynamics/energy: 1.00 (sadness) to 2.73 (hot anger). The widest spread
 * and the largest F of any body measure in the paper, which is why it is the arousal gain.
 */
const WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL = 1.00;
const WALLBOTT_DYNAMICS_AT_HIGHEST_AROUSAL = 2.73;

/**
 * Duarte & Zatsiorsky 1999 put spontaneous idle posture events at about one a minute, and
 * Cassell et al. 2001 independently put conversational posture shifts at 1.4–1.6 a minute. A
 * shoulder settle is one member of that family, not the whole of it, so it takes a fraction of
 * the budget and leaves the rest to Sway's fidgets and shifts. Events per second.
 */
const SHOULDER_SETTLE_RATE = 0.5 / 60;

// --- tuning constants, with no primary support -------------------------------------------

/**
 * TUNING. Peak deviation per joint, in degrees, before the arousal gain. See the amplitude note
 * in the file header — these are judged by the selftest's printed RMS, not derived.
 *
 * The chain descends because a hanging limb's slack accumulates from the top: the shoulder joint
 * carries the whole arm's inertia and has the longest lever, so the same angular budget spent
 * further down would be invisible at the shoulder and jittery at the fingertip.
 */
const CLAVICLE_DEGREES = 0.40;
const UPPER_ARM_DEGREES = 2.00;
const FOREARM_DEGREES = 1.20;
const WRIST_DEGREES = 0.80;
const FINGER_DEGREES = 0.45;

/**
 * TUNING. The second axis of each joint's noise, as a fraction of the first. A hanging arm's
 * slack is mostly fore-and-aft — the shoulder is free in the sagittal plane and constrained
 * against the ribcage in the frontal one — so the secondary axis is the smaller of the two.
 */
const SECONDARY_AXIS_FRACTION = 0.55;

/**
 * TUNING. Fingers. A relaxed hand moves as a loose unit: the whole hand's tone drifts and the
 * fingers ride it together, with only a little independence on top. Fingers that each wander on
 * their own stream read as a hand playing an invisible piano. The two weights sum to 1 so that
 * FINGER_DEGREES stays the honest statement of the peak.
 */
const FINGER_UNIT_FREQUENCY_HZ = 0.7;
const FINGER_INDIVIDUAL_FREQUENCY_HZ = 1.4;
const FINGER_UNIT_WEIGHT = 0.75;
const FINGER_INDIVIDUAL_WEIGHT = 0.25;

/**
 * TUNING. How the drift is shared along one finger, proximal to distal. Flexion accumulates down
 * a relaxed finger, so the proximal joint leads and the distal joint follows at a fraction.
 */
const FINGER_SEGMENT_SHARE = [ 1.0, 0.8, 0.6 ];

/**
 * TUNING. The thumb opposes the other four, so its flexion axis is genuinely different from the
 * across-the-palm axis derived below. At half a degree the error is not visible, but it is real,
 * so the thumb is driven at a reduced share rather than pretended to be a fifth finger.
 */
const THUMB_SHARE = 0.55;

/**
 * TUNING. The trunk. Breath owns these bones' sagittal expansion and Sway owns their lean, so
 * this layer takes the one trunk DOF neither of them writes — a slow axial twist — and stays off
 * their axes entirely. That is what "do not fight breathing" means concretely: not a smaller
 * amplitude on the same axis, a different axis.
 */
const TORSO_TWIST_FREQUENCY_HZ = 0.15;
const TORSO_TWIST_DEGREES = 0.35;
const TORSO_TWIST_SHARE = [ 0.4, 0.6 ]; // chest, upperChest

/**
 * TUNING. A shoulder settle: the girdle slowly gives up a little tone and comes back. Fast in,
 * slow out, like a sigh — the asymmetry is what makes it read as releasing rather than as a
 * shrug. Duarte gives the rate's order of magnitude but no amplitude or duration for this.
 */
const SHOULDER_SETTLE_DEGREES = 1.10;
const SHOULDER_SETTLE_SECONDS = 2.20;
const SHOULDER_SETTLE_RISE_FRACTION = 0.28;
const SHOULDER_SETTLE_ONSET_LAG_SECONDS = [ 0.06, 0.16 ]; // drawn per side, so it is not a snap
const SHOULDER_SETTLE_AMPLITUDE_JITTER = 0.2;

/**
 * TUNING. The arms' answer to a weight shift. When the pelvis translates over one foot the arms
 * are left behind for a moment and swing back into place — a small, once-off, decaying pendulum,
 * not a gesture. Sway measures the shift; this layer only reacts to it, through onWeightShift().
 *
 * The two sides run at slightly different rates so a bilateral event still does not leave them
 * moving in lockstep. See the decorrelation note in the file header.
 */
const WEIGHT_SHIFT_SWING_DEGREES = 1.50;
const WEIGHT_SHIFT_SWING_FREQUENCY_HZ = 0.65;
const WEIGHT_SHIFT_SWING_DECAY_SECONDS = 1.60;
const WEIGHT_SHIFT_SWING_SIDE_DETUNE = 0.12;
const WEIGHT_SHIFT_MAGNITUDE_LIMIT = 3;

/**
 * TUNING. How each discrete event is shared down the arm. A settle is a girdle event that the
 * arm hangs from; a swing is an arm event the girdle barely feels. Same axis, opposite profiles,
 * which is what keeps the two from reading as the same motion at different sizes.
 */
const SETTLE_SHARE = { clavicle: 1.0, upperArm: 0.45, forearm: 0.15, hand: 0 };
const SWING_SHARE = { clavicle: 0.20, upperArm: 1.0, forearm: 0.40, hand: 0.15 };

/**
 * TUNING, and the one place the arousal gain is deliberately NOT applied at full strength.
 *
 * Wallbott's dynamics scale is amplitude AND speed together, so the honest reading is to raise
 * both by 2.73×. But 2.73× on the wrist's 4 Hz lattice puts its spectral tail well inside the
 * 8–12 Hz tremor band, and an aroused figure should look energised, not unwell. Amplitude takes
 * the full gain; the noise rate takes its square root, which tops out at 1.65× and keeps the
 * fastest joint's f95 clear of 8 Hz. Discrete event rates take the full gain — a Poisson rate has
 * no spectrum to push anywhere.
 */
const AROUSAL_RATE_EXPONENT = 0.5;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Rig-space anatomical axes, verified on figure_g050.glb (2026-08-07): +X left-right, +Y up,
 * +Z forward. Naming the axes anatomically rather than by letter is what lets a joint say "swing
 * fore and aft" and still be correct on the next figure.
 */
const SAGITTAL_AXIS = new Vector3( 1, 0, 0 ); // rotation about it swings forward/back
const VERTICAL_AXIS = new Vector3( 0, 1, 0 ); // rotation about it turns left/right
const FRONTAL_AXIS = new Vector3( 0, 0, 1 );  // rotation about it swings side to side

/**
 * The five fingers as the rig names them. VRM calls the pinky "little" and gives the thumb
 * metacarpal/proximal/distal where the other four are proximal/intermediate/distal; Skeleton.js
 * already maps all thirty onto the figure's bones, so this only has to name the humanoid keys.
 */
const FINGERS = [
    { name: 'Thumb', segments: [ 'Metacarpal', 'Proximal', 'Distal' ], share: THUMB_SHARE },
    { name: 'Index', segments: [ 'Proximal', 'Intermediate', 'Distal' ], share: 1 },
    { name: 'Middle', segments: [ 'Proximal', 'Intermediate', 'Distal' ], share: 1 },
    { name: 'Ring', segments: [ 'Proximal', 'Intermediate', 'Distal' ], share: 1 },
    { name: 'Little', segments: [ 'Proximal', 'Intermediate', 'Distal' ], share: 1 }
];

export class BodyIdle extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.amplitude=1] - One multiplier over every joint, for art direction.
     *   The per-joint degrees above stay readable as the statement of intent they are.
     * @param {number} [options.arousal=0] - [0, 1]. Starting arousal; see setArousal().
     * @param {boolean} [options.fingersEnabled=true]
     * @param {boolean} [options.torsoEnabled=true] - Turn off when a posture or gesture layer is
     *   authoring trunk twist and you do not want the two summing.
     * @param {boolean} [options.eventsEnabled=true] - Turn off to measure the noise floor alone.
     * @param {number} [options.settleAmplitudeJitter=0.2] - How much the two sides' settle
     *   amplitudes may differ. Set to 0 together with `settleOnsetLagSeconds: [0, 0]` to build the
     *   PUPPET'S CROSSBAR this file's own comment warns about — two shoulders dropping on the same
     *   frame by the same angle. The selftest constructs exactly that to prove its bilaterality
     *   gate can see it.
     * @param {number[]} [options.settleOnsetLagSeconds=[0.06, 0.16]] - The per-side onset lag draw.
     * @param {boolean} [options.frameCoupledArrivals=false] - Set to true to advance the settle
     *   with one Bernoulli draw per FRAME, the way this layer used to. The rate stays correct and
     *   the trajectory becomes a function of the frame rate; the invariance gate builds it.
     * @param {Object} [options.bones] - Overrides for the humanoid names this drives.
     */
    constructor( options = {} ) {

        const bones = {
            leftShoulder: HUMANOID_TO_FIGURE_BONE.leftShoulder,
            rightShoulder: HUMANOID_TO_FIGURE_BONE.rightShoulder,
            leftUpperArm: HUMANOID_TO_FIGURE_BONE.leftUpperArm,
            rightUpperArm: HUMANOID_TO_FIGURE_BONE.rightUpperArm,
            leftLowerArm: HUMANOID_TO_FIGURE_BONE.leftLowerArm,
            rightLowerArm: HUMANOID_TO_FIGURE_BONE.rightLowerArm,
            leftHand: HUMANOID_TO_FIGURE_BONE.leftHand,
            rightHand: HUMANOID_TO_FIGURE_BONE.rightHand,
            chest: HUMANOID_TO_FIGURE_BONE.chest,
            upperChest: HUMANOID_TO_FIGURE_BONE.upperChest,
            ...( options.bones ?? {} )
        };

        const fingerBoneNames = [
            ...fingerBoneNamesForSide( 'left' ),
            ...fingerBoneNamesForSide( 'right' )
        ];

        super( {
            name: options.name ?? 'bodyIdle',
            // Just after IdleMotion (SWAY + 50) and well before GESTURE: idle micro-motion is the
            // floor a real gesture is layered on top of, never a competitor to one.
            order: options.order ?? ( MOTION_ORDER.SWAY + 60 ),
            boneChannels: [ ...Object.values( bones ), ...fingerBoneNames ]
        } );

        this.bones = bones;
        this.amplitude = options.amplitude ?? 1;
        this.arousal = clampUnit( options.arousal ?? 0 );

        this.fingersEnabled = options.fingersEnabled ?? true;
        this.torsoEnabled = options.torsoEnabled ?? true;
        this.eventsEnabled = options.eventsEnabled ?? true;

        // The two things that keep a bilateral settle from reading as a puppet's crossbar. Both
        // are overridable so the gate can build the crossbar and prove it is rejected.
        this.settleAmplitudeJitter = options.settleAmplitudeJitter ?? SHOULDER_SETTLE_AMPLITUDE_JITTER;
        this.settleOnsetLagSeconds = options.settleOnsetLagSeconds ?? SHOULDER_SETTLE_ONSET_LAG_SECONDS;

        // The pre-fix arrival mechanism, kept only so the invariance gate has a known-bad.
        this.frameCoupledArrivals = options.frameCoupledArrivals ?? false;

        // Noise position, integrated rather than derived from elapsed time, so that a change of
        // arousal changes the RATE the noise is read at without jumping to a new position in it.
        this.noisePhase = 0;

        this.eventCounts = { shoulderSettle: 0, weightShiftSwing: 0 };

        // The shoulder settle's arrival process. Filled at bind, when the stack has forked a
        // stream to build it on. See `advanceEvents`.
        this.settleSchedule = null;

        this.arms = [
            createArm( 'left', bones.leftShoulder, bones.leftUpperArm, bones.leftLowerArm, bones.leftHand ),
            createArm( 'right', bones.rightShoulder, bones.rightUpperArm, bones.rightLowerArm, bones.rightHand )
        ];

        this.torso = {
            boneNames: [ bones.chest, bones.upperChest ],
            restFrames: [ new Quaternion(), new Quaternion() ],
            noise: null
        };

        this.scratchRigRotation = new Quaternion();
        this.scratchAxisRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();

    }

    // --- action -----------------------------------------------------------------------------

    /**
     * @param {number} arousal - [0, 1]. Scales amplitude by Wallbott's 1.00–2.73 dynamics range,
     *   the noise rate by the square root of it, and the discrete event rate by all of it. See
     *   AROUSAL_RATE_EXPONENT for why the noise rate is held back.
     */
    setArousal( arousal ) {

        this.arousal = clampUnit( arousal );

    }

    /**
     * Tells the arms that the stance just moved under them. Sway calls this the moment it starts
     * a weight shift; the arms answer with one small decaying swing and then go quiet again.
     *
     * Kept as a call from Sway rather than a rate in this file on purpose. The arm swing is not
     * an independent behaviour that happens to occur at the same rate as a weight shift — it is
     * caused by one, and two Poisson processes tuned to the same mean would drift apart within a
     * minute and read as the arms twitching for no reason.
     *
     * @param {Object} [shift]
     * @param {number} [shift.magnitude=1] - Signed multiplier on the nominal swing. Sway's
     *   natural value is its drawn shift amplitude over its mean (22 mm ML), signed by direction.
     */
    onWeightShift( { magnitude = 1 } = {} ) {

        if ( this.eventsEnabled === false ) return;

        const bounded = Math.max( Math.min( magnitude, WEIGHT_SHIFT_MAGNITUDE_LIMIT ), -WEIGHT_SHIFT_MAGNITUDE_LIMIT );

        for ( const arm of this.arms ) {

            arm.swing.elapsedSeconds = 0;
            arm.swing.amplitude = WEIGHT_SHIFT_SWING_DEGREES * DEGREES_TO_RADIANS * bounded;
            arm.swing.active = true;

        }

        this.eventCounts.weightShiftSwing ++;

    }

    onBind( context ) {

        for ( const arm of this.arms ) this.prepareArm( arm, context.target );

        this.torso.noise = new CoherentNoise1D( this.nextSeed(), 512 );

        // The shoulder settle's arrivals, on their own stream. See `advanceEvents` for why this is
        // a schedule rather than a per-frame coin, and `Signals.PoissonSchedule` for the general
        // argument. Built here because `this.random` does not exist until the stack forks it, and
        // rebuilt on every bind because `MotionStack.reset()` rewinds and re-binds.
        this.settleSchedule = new PoissonSchedule( this.random.fork( 'shoulderSettle' ) );

        this.torso.boneNames.forEach( ( boneName, index ) => {

            this.torso.restFrames[ index ] = restRotationRelativeToRig( context.target.getBone( boneName ) );

        } );

    }

    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        const amplitudeGain = this.amplitudeGain;

        this.noisePhase += deltaSeconds * this.noiseRateGain;

        if ( this.eventsEnabled ) this.advanceEvents( deltaSeconds );

        for ( const arm of this.arms ) {

            this.writeArm( arm, amplitudeGain );

        }

        if ( this.torsoEnabled ) this.writeTorso( amplitudeGain );

        return this.contribution;

    }

    reset() {

        this.noisePhase = 0;
        this.eventCounts = { shoulderSettle: 0, weightShiftSwing: 0 };

        // Rewound here for a reset outside the stack. In the stack's own path `onBind` runs a
        // moment later and replaces it with a schedule on a freshly forked stream.
        this.settleSchedule?.reset();

        for ( const arm of this.arms ) {

            arm.settle.elapsedSeconds = 0;
            arm.settle.amplitude = 0;
            arm.settle.active = false;

            arm.swing.elapsedSeconds = 0;
            arm.swing.amplitude = 0;
            arm.swing.active = false;

        }

    }

    // --- gains --------------------------------------------------------------------------------

    /** Wallbott's dynamics scale, normalised so that arousal 0 leaves the tuning constants alone. */
    get amplitudeGain() {

        const dynamics = WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL
            + this.arousal * ( WALLBOTT_DYNAMICS_AT_HIGHEST_AROUSAL - WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL );

        return dynamics / WALLBOTT_DYNAMICS_AT_LOWEST_AROUSAL;

    }

    /** The same gain, held back so an aroused figure does not drift into the tremor band. */
    get noiseRateGain() {

        return Math.pow( this.amplitudeGain, AROUSAL_RATE_EXPONENT );

    }

    // --- events -------------------------------------------------------------------------------

    /**
     * The discrete half of the layer: rare, larger, and shaped rather than noise-driven. Both
     * events live on the frontal axis, because both are answers to something happening sideways —
     * the girdle giving up tone, or the stance moving out from under the arms.
     */
    advanceEvents( deltaSeconds ) {

        // 🎯 A SCHEDULE, NOT A PER-FRAME COIN. `poissonEventOccurs(rate, dt)` gets the rate right at
        // any frame rate and the trajectory wrong at all of them, because it draws once per FRAME:
        // measured on this layer, 30.0 draws/s at 30 Hz against 60.0 at 60 Hz, and the worst bone
        // divergence between the two traces of seed 1 over 300 s was 12.36 mm. Drawing one interval
        // per EVENT makes the arrival times a property of the seed instead. See
        // `Signals.PoissonSchedule`.
        //
        // The rate is arousal-scaled and therefore time-varying, which the schedule handles by
        // counting down in unit-rate units at `rate × dt` — the integral of the rate — rather than
        // by freezing whatever value the last frame saw.
        const rate = SHOULDER_SETTLE_RATE * this.amplitudeGain;

        // 🚩 THE EVENTS IN FLIGHT ARE AGED FIRST AND THE NEW ARRIVALS FIRE AFTER, WHICH IS THE
        // OPPOSITE OF WHAT THIS USED TO DO. Firing first meant a settle that began this frame was
        // immediately aged by a whole frame, so its shape started at a phase set by the frame rate.
        // Measured: it was the entire remaining divergence once the arrivals were scheduled —
        // 0.48 mm at 30 Hz against 60 Hz, down to float dust with the order swapped.
        for ( const arm of this.arms ) {

            if ( arm.settle.active ) {

                arm.settle.elapsedSeconds += deltaSeconds;
                if ( arm.settle.elapsedSeconds >= SHOULDER_SETTLE_SECONDS ) arm.settle.active = false;

            }

            if ( arm.swing.active ) {

                arm.swing.elapsedSeconds += deltaSeconds;

                // Four decay constants is 1.8% of the initial amplitude — under a hundredth of a
                // degree, which is below the stack's own identity epsilon.
                if ( arm.swing.elapsedSeconds >= WEIGHT_SHIFT_SWING_DECAY_SECONDS * 4 ) arm.swing.active = false;

            }

        }

        if ( this.frameCoupledArrivals ) {

            // 🚩 THE DEFECT, REBUILT ON PURPOSE, so the invariance gate has something to reject.
            if ( this.settleSchedule.random.poissonEventOccurs( rate, deltaSeconds ) ) this.beginShoulderSettle();

            return;

        }

        this.settleSchedule?.advance( rate, deltaSeconds,
            ( secondsSinceArrival ) => this.beginShoulderSettle( secondsSinceArrival ) );

    }

    /**
     * A shoulder settle is genuinely bilateral, so both sides fire — but with independently drawn
     * amplitudes and a short onset lag, because two shoulders that drop on exactly the same frame
     * by exactly the same angle read as a puppet's crossbar.
     */
    /**
     * @param {number} [secondsSinceArrival=0] - How far into the frame the arrival actually landed.
     *   The settle starts already that much aged, so its shape sits at the same phase whatever the
     *   frame rate. Without it the arrival snaps to the next frame boundary and a 30 Hz trace runs
     *   the settle up to 33 ms late — measured at 0.31 mm of bone divergence against 60 Hz, which
     *   is small but is a frame-rate dependence and this round is about not having any.
     */
    beginShoulderSettle( secondsSinceArrival = 0 ) {

        // The event's own draws come from the settle process's stream, so everything this process
        // consumes is one sequence advanced once per event. Sharing the layer stream would work
        // today and would break silently the moment a second per-frame draw appeared beside it.
        const random = this.settleSchedule.random;

        for ( const arm of this.arms ) {

            const jitter = 1 + random.range( -this.settleAmplitudeJitter, this.settleAmplitudeJitter );
            const lag = random.range( this.settleOnsetLagSeconds[ 0 ], this.settleOnsetLagSeconds[ 1 ] );

            arm.settle.elapsedSeconds = secondsSinceArrival - lag;
            arm.settle.amplitude = SHOULDER_SETTLE_DEGREES * DEGREES_TO_RADIANS * jitter * arm.mirror;
            arm.settle.active = true;

        }

        this.eventCounts.shoulderSettle ++;

    }

    // --- posing -------------------------------------------------------------------------------

    /**
     * One arm, from the girdle to the fingertips: four noise-driven joints carrying whatever the
     * discrete events are asking for this frame, then the fingers.
     */
    writeArm( arm, amplitudeGain ) {

        const settleAngle = settleShape( arm.settle ) * arm.settle.amplitude * amplitudeGain;
        const swingAngle = swingShape( arm.swing, arm.detune ) * arm.swing.amplitude * amplitudeGain;

        for ( const joint of arm.joints ) {

            const eventAngle = settleAngle * joint.settleShare + swingAngle * joint.swingShare;

            this.writeNoiseJoint( joint, arm, amplitudeGain, eventAngle );

        }

        if ( this.fingersEnabled ) this.writeFingers( arm, amplitudeGain );

    }

    /**
     * A joint's idle: a swing on its primary axis from one stream, a smaller swing on its
     * secondary axis from another, plus whatever the frontal-axis events want. Both streams are
     * read at the joint's own Improv frequency and at the arm's own offset along the lattice.
     */
    writeNoiseJoint( joint, arm, amplitudeGain, eventAngle ) {

        const peak = joint.peakDegrees * DEGREES_TO_RADIANS * this.amplitude * amplitudeGain;
        const noiseTime = this.noisePhase * joint.frequencyHz + arm.noiseOffset;

        this.scratchRigRotation.setFromAxisAngle(
            joint.primaryAxis, peak * joint.noise[ 0 ].at( noiseTime ) );

        this.scratchAxisRotation.setFromAxisAngle(
            joint.secondaryAxis, peak * SECONDARY_AXIS_FRACTION * joint.noise[ 1 ].at( noiseTime ) );
        this.scratchRigRotation.multiply( this.scratchAxisRotation );

        if ( eventAngle !== 0 ) {

            this.scratchAxisRotation.setFromAxisAngle( FRONTAL_AXIS, eventAngle );
            this.scratchRigRotation.multiply( this.scratchAxisRotation );

        }

        toBoneDeltaFrame( this.scratchRigRotation, joint.restFrame, this.scratchBoneDelta );

        this.contribution.rotateBone( joint.boneName, this.scratchBoneDelta );

    }

    /**
     * The hand as a loose unit: one drift shared by every joint in it, plus a quarter as much
     * per-finger independence on top. All of it about the across-the-palm flexion axis resolved
     * at bind. See FINGER_UNIT_WEIGHT for why the shared term dominates.
     */
    writeFingers( arm, amplitudeGain ) {

        const peak = FINGER_DEGREES * DEGREES_TO_RADIANS * this.amplitude * amplitudeGain;
        const unitDrift = arm.fingerUnitNoise.at( this.noisePhase * FINGER_UNIT_FREQUENCY_HZ + arm.noiseOffset );

        for ( const finger of arm.fingers ) {

            const individualDrift = finger.noise.at(
                this.noisePhase * FINGER_INDIVIDUAL_FREQUENCY_HZ + arm.noiseOffset );

            const drift = FINGER_UNIT_WEIGHT * unitDrift + FINGER_INDIVIDUAL_WEIGHT * individualDrift;

            for ( const segment of finger.segments ) {

                this.scratchRigRotation.setFromAxisAngle(
                    arm.fingerFlexionAxis, peak * drift * finger.share * segment.share );

                toBoneDeltaFrame( this.scratchRigRotation, segment.restFrame, this.scratchBoneDelta );

                this.contribution.rotateBone( segment.boneName, this.scratchBoneDelta );

            }

        }

    }

    /**
     * The trunk's one contribution: a slow axial twist, shared between chest and upper chest so
     * the turn accumulates up the spine rather than hinging at a single joint. Deliberately on an
     * axis neither Breath nor Sway writes — see TORSO_TWIST_FREQUENCY_HZ.
     */
    writeTorso( amplitudeGain ) {

        const peak = TORSO_TWIST_DEGREES * DEGREES_TO_RADIANS * this.amplitude * amplitudeGain;
        const twist = peak * this.torso.noise.at( this.noisePhase * TORSO_TWIST_FREQUENCY_HZ );

        this.torso.boneNames.forEach( ( boneName, index ) => {

            this.scratchRigRotation.setFromAxisAngle( VERTICAL_AXIS, twist * TORSO_TWIST_SHARE[ index ] );

            toBoneDeltaFrame( this.scratchRigRotation, this.torso.restFrames[ index ], this.scratchBoneDelta );

            this.contribution.rotateBone( boneName, this.scratchBoneDelta );

        } );

    }

    // --- bind-time resolution -------------------------------------------------------------------

    /**
     * Gives one arm its noise streams, its rest frames and its finger flexion axis. Seeds come
     * from the layer's own stream, which MotionStack rewinds before it re-runs onBind, so a reset
     * reproduces the run exactly.
     */
    prepareArm( arm, target ) {

        // A whole lattice period apart, so the two sides could not align even if a future change
        // accidentally handed them the same noise table.
        arm.noiseOffset = this.random.range( 0, 128 );

        for ( const joint of arm.joints ) {

            joint.noise = [
                new CoherentNoise1D( this.nextSeed(), 256 ),
                new CoherentNoise1D( this.nextSeed(), 256 )
            ];

            joint.restFrame = restRotationRelativeToRig( target.getBone( joint.boneName ) );

        }

        arm.fingerUnitNoise = new CoherentNoise1D( this.nextSeed(), 256 );
        arm.fingerFlexionAxis = this.resolveFingerFlexionAxis( arm, target );
        arm.fingers = [];

        for ( const finger of fingersForSide( arm.side ) ) {

            const segments = [];

            finger.segments.forEach( ( boneName, index ) => {

                const bone = target.getBone( boneName );
                if ( bone === null || bone === undefined ) return;

                segments.push( {
                    boneName,
                    share: FINGER_SEGMENT_SHARE[ index ],
                    restFrame: restRotationRelativeToRig( bone )
                } );

            } );

            if ( segments.length === 0 ) continue;

            arm.fingers.push( { share: finger.share, noise: new CoherentNoise1D( this.nextSeed(), 256 ), segments } );

        }

    }

    /**
     * Where a relaxed finger bends, read off the rig instead of assumed.
     *
     * Flexion rotates a finger about the axis that runs ACROSS the palm, so the index-to-little
     * direction is that axis, orthogonalised against the direction the fingers point in. Deriving
     * it means the layer survives a figure posed differently at export — an A-pose and a T-pose
     * put the hand at completely different orientations, and a hard-coded axis would curl the
     * fingers sideways on one of them.
     *
     * Read from world matrices, which is the same frame the rig-space axis constants above assume
     * (rig root at identity), and only meaningful at bind, before any layer has posed the figure.
     */
    resolveFingerFlexionAxis( arm, target ) {

        const indexProximal = target.getBone( arm.fingerReference.indexProximal );
        const indexDistal = target.getBone( arm.fingerReference.indexDistal );
        const littleProximal = target.getBone( arm.fingerReference.littleProximal );

        // A rig without fingers falls back to the frontal axis, which is harmless: the layer will
        // find no finger bones to write either.
        if ( indexProximal == null || indexDistal == null || littleProximal == null ) {

            return FRONTAL_AXIS.clone();

        }

        const knuckle = worldPositionOf( indexProximal );
        const alongFinger = worldPositionOf( indexDistal ).sub( knuckle ).normalize();
        const acrossPalm = worldPositionOf( littleProximal ).sub( knuckle );

        acrossPalm.addScaledVector( alongFinger, -acrossPalm.dot( alongFinger ) );

        return acrossPalm.lengthSq() > 1e-8 ? acrossPalm.normalize() : FRONTAL_AXIS.clone();

    }

    nextSeed() {

        return this.random.integer( 0, 0x7fffffff );

    }

}

// --- local helpers ----------------------------------------------------------------------------

function createArm( side, clavicleBoneName, upperArmBoneName, lowerArmBoneName, handBoneName ) {

    return {

        side,

        // +1 left, −1 right. Applied only to the shoulder settle, which is the one event that is
        // genuinely mirror-symmetric; the weight-shift swing is NOT, because a stance moving
        // sideways abducts one arm and adducts the other.
        mirror: side === 'left' ? 1 : -1,

        // A few percent of frequency difference between the sides, so a bilateral event does not
        // leave the two arms ringing in step.
        detune: side === 'left' ? 1 : 1 + WEIGHT_SHIFT_SWING_SIDE_DETUNE,

        noiseOffset: 0,

        joints: [
            createJoint( clavicleBoneName, CLAVICLE_FREQUENCY_HZ, CLAVICLE_DEGREES, FRONTAL_AXIS, VERTICAL_AXIS, 'clavicle' ),
            createJoint( upperArmBoneName, UPPER_ARM_FREQUENCY_HZ, UPPER_ARM_DEGREES, SAGITTAL_AXIS, FRONTAL_AXIS, 'upperArm' ),
            createJoint( lowerArmBoneName, FOREARM_FREQUENCY_HZ, FOREARM_DEGREES, SAGITTAL_AXIS, FRONTAL_AXIS, 'forearm' ),
            createJoint( handBoneName, WRIST_FREQUENCY_HZ, WRIST_DEGREES, SAGITTAL_AXIS, FRONTAL_AXIS, 'hand' )
        ],

        fingerReference: fingerReferenceBonesForSide( side ),
        fingerFlexionAxis: FRONTAL_AXIS.clone(),
        fingerUnitNoise: null,
        fingers: [],

        settle: { elapsedSeconds: 0, amplitude: 0, active: false },
        swing: { elapsedSeconds: 0, amplitude: 0, active: false }

    };

}

/**
 * @param {Vector3} primaryAxis - The joint's larger, freer swing.
 * @param {Vector3} secondaryAxis - Its smaller one.
 * @param {string} role - Which row of SETTLE_SHARE / SWING_SHARE this joint takes.
 */
function createJoint( boneName, frequencyHz, peakDegrees, primaryAxis, secondaryAxis, role ) {

    return {
        boneName,
        frequencyHz,
        peakDegrees,
        primaryAxis,
        secondaryAxis,
        settleShare: SETTLE_SHARE[ role ],
        swingShare: SWING_SHARE[ role ],
        noise: [],
        restFrame: new Quaternion()
    };

}

/** Every finger bone on one side, grouped by finger, in the rig's own names. */
function fingersForSide( side ) {

    return FINGERS.map( ( finger ) => ( {
        share: finger.share,
        segments: finger.segments.map( ( segment ) => HUMANOID_TO_FIGURE_BONE[ `${ side }${ finger.name }${ segment }` ] )
    } ) );

}

function fingerBoneNamesForSide( side ) {

    return fingersForSide( side ).flatMap( ( finger ) => finger.segments );

}

/** The three bones the flexion axis is derived from. See resolveFingerFlexionAxis(). */
function fingerReferenceBonesForSide( side ) {

    return {
        indexProximal: HUMANOID_TO_FIGURE_BONE[ `${ side }IndexProximal` ],
        indexDistal: HUMANOID_TO_FIGURE_BONE[ `${ side }IndexDistal` ],
        littleProximal: HUMANOID_TO_FIGURE_BONE[ `${ side }LittleProximal` ]
    };

}

/**
 * The settle's profile: a quick raised-cosine rise, then a longer raised-cosine release. Fast in
 * and slow out is what makes a shoulder drop read as letting go rather than as a shrug. Both
 * halves have zero slope at both ends, so acceleration is continuous across the join.
 */
function settleShape( settle ) {

    if ( settle.active === false ) return 0;
    if ( settle.elapsedSeconds < 0 ) return 0; // still inside this side's onset lag

    const progress = settle.elapsedSeconds / SHOULDER_SETTLE_SECONDS;

    if ( progress >= 1 ) return 0;

    if ( progress < SHOULDER_SETTLE_RISE_FRACTION ) {

        return 0.5 * ( 1 - Math.cos( Math.PI * progress / SHOULDER_SETTLE_RISE_FRACTION ) );

    }

    const release = ( progress - SHOULDER_SETTLE_RISE_FRACTION ) / ( 1 - SHOULDER_SETTLE_RISE_FRACTION );

    return 0.5 * ( 1 + Math.cos( Math.PI * release ) );

}

/** The swing's profile: one decaying pendulum, detuned per side. Starts at zero, ends at zero. */
function swingShape( swing, detune ) {

    if ( swing.active === false ) return 0;

    const decay = Math.exp( -swing.elapsedSeconds / WEIGHT_SHIFT_SWING_DECAY_SECONDS );
    const phase = 2 * Math.PI * WEIGHT_SHIFT_SWING_FREQUENCY_HZ * detune * swing.elapsedSeconds;

    return decay * Math.sin( phase );

}

function worldPositionOf( bone ) {

    bone.updateWorldMatrix( true, false );

    return new Vector3().setFromMatrixPosition( bone.matrixWorld );

}

function clampUnit( value ) {

    return Math.min( Math.max( value, 0 ), 1 );

}
