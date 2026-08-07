/**
 * IdleMotion — Perlin's coherent-noise micro-motion on the arms and head.
 *
 * Breath keeps the torso alive and Sway keeps the stance alive. Neither touches the limbs, and a
 * figure whose arms are welded to its sides while its chest moves is worse than one that is
 * wholly still — the stillness becomes conspicuous by contrast. This is the layer that puts a
 * floor of movement under everything else.
 *
 *
 * THE FREQUENCIES, AND WHY THEY ARE OCTAVES
 *
 * Perlin & Goldberg, *Improv* (SIGGRAPH '96) drive the arm from coherent noise signals N0, N1, N2,
 * each one octave above the last: **~1 Hz upper arm (shoulder), ~2 Hz forearm (elbow), ~4 Hz
 * wrist**.
 *
 * Perlin is explicit that these were chosen because they LOOKED right, and that "frequency ratios
 * that varied significantly from these did not look natural." His post-hoc rationalisation of the
 * 2:1 step is that the forearm has about half the mass of the whole arm. That is not a derivation
 * and he does not present it as one — but it is the only published number for this, it was
 * arrived at by looking at a lot of output, and his broader argument is the reason to trust it:
 * viewers perceive the *statistics* of motion, not its mechanism.
 *
 * 🚩 PUNCH-LIST DISCREPANCY, resolved deliberately. docs/PUNCHLIST.md 2.7 asks for "co-prime
 * cycles"; the primary source says octaves, which are the opposite of co-prime. The intent behind
 * "co-prime" is that the joints must not visibly lock into step with each other, and this layer
 * gets that a better way: every joint draws from its OWN independent noise stream. Two independent
 * noise signals never phase-lock however their rates are related — that is a property of periodic
 * signals, not of noise. So the rates stay at Perlin's measured 1:2:4 and the synchrony problem is
 * solved at the source instead.
 *
 * Note also that a gradient-noise signal at lattice rate f puts its spectral energy near 0.5f
 * (measured; see the band calibration in Sway.js). So the wrist's "4 Hz" lands around 2 Hz of
 * actual content — well clear of the 8–12 Hz band where motion starts reading as physiological
 * tremor rather than life.
 *
 *
 * WHO OWNS THE ARMS
 *
 * BodyIdle declares the same six arm bones this layer does, and the stack SUMS bone contributions
 * — so a stack running both as shipped silently doubles every arm joint, and nothing can catch it
 * because two layers writing a bone is the normal case the stack exists to serve. The intended
 * split is BodyIdle from the neck down and this layer on the head, and `armsEnabled` defaults to
 * 'auto' so that is what a consumer gets without having to know any of the above. Pass
 * `armsEnabled: true` for a stack with no BodyIdle in it that still wants Improv on the arms.
 *
 *
 * 🚩 AMPLITUDES ARE NOT MEASURED. Improv's own intervals — R_UP_ARM swinging over 25°–55° — are
 * for a stylised, gesturing character, and are one to two orders of magnitude too large for a
 * photoreal figure standing quietly. Nothing in the research doc gives an idle micro-motion
 * amplitude. The defaults below are conservative tuning constants, chosen so that the hand travels
 * a few millimetres rather than centimetres, and the selftest prints the resulting hand excursion
 * in millimetres precisely so that a reader can judge them rather than trust them.
 */

import { Quaternion, Vector3 } from 'three';

import { Layer } from './Layer.js';
import { MOTION_ORDER } from './MotionStack.js';
import { CoherentNoise1D } from './Signals.js';
import { restRotationRelativeToRig, toBoneDeltaFrame } from './Breath.js';
import { HUMANOID_TO_FIGURE_BONE } from '../figure/Skeleton.js';

// --- measured constants ------------------------------------------------------------------

/** Improv's N0/N1/N2, in Hz. One octave apart. Do not "improve" the ratio; Perlin already tried. */
const SHOULDER_FREQUENCY_HZ = 1;
const ELBOW_FREQUENCY_HZ = 2;
const WRIST_FREQUENCY_HZ = 4;

// --- tuning constants, with no primary support -------------------------------------------

/**
 * TUNING. Peak deviation per joint, in degrees. See the amplitude note in the file header.
 *
 * The secondary axis is smaller than the primary because a hanging arm's slack is mostly
 * fore-and-aft: the shoulder is free to swing in the sagittal plane and constrained against the
 * ribcage in the frontal one.
 */
const SHOULDER_SWING_DEGREES = 0.9;
const ELBOW_SWING_DEGREES = 0.7;
const WRIST_SWING_DEGREES = 1.4;
const SECONDARY_AXIS_FRACTION = 0.6;

/**
 * TUNING. Head micro-motion. Slower than the arms because the head is heavier and because head
 * motion above about half a hertz stops reading as idle and starts reading as a gesture — at
 * which point it belongs to the HEAD layer (gaze policy, backchannel nods), not here.
 */
const HEAD_FREQUENCY_HZ = 0.5;
const HEAD_NOD_DEGREES = 0.4;
const HEAD_TURN_DEGREES = 0.5;
const HEAD_TILT_DEGREES = 0.3;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Rig-space anatomical axes, verified on figure_g050.glb (2026-08-07): +X left-right, +Y up,
 * +Z forward. Naming the axes anatomically rather than by letter is what lets a joint say
 * "swing fore and aft" and be correct on the next figure too.
 */
const SAGITTAL_AXIS = new Vector3( 1, 0, 0 ); // rotation about it swings forward/back
const VERTICAL_AXIS = new Vector3( 0, 1, 0 ); // rotation about it turns left/right
const FRONTAL_AXIS = new Vector3( 0, 0, 1 );  // rotation about it tilts side to side

export class IdleMotion extends Layer {

    /**
     * @param {Object} [options]
     * @param {number} [options.amplitude=1] - One multiplier over every joint, for art direction.
     *   The per-joint degrees stay readable as the statement of intent they are.
     * @param {boolean} [options.headEnabled=true] - Turn off when a gaze or head layer is driving
     *   the neck and you do not want the two summing.
     * @param {boolean|'auto'} [options.armsEnabled='auto'] - Whether this layer drives the six arm
     *   bones. See `resolveArmsEnabled()`; 'auto' yields them to BodyIdle when one is in the stack.
     * @param {string} [options.armOwnerLayerName='bodyIdle'] - The layer 'auto' looks for.
     * @param {Object} [options.bones] - Overrides for the humanoid names this drives.
     */
    constructor( options = {} ) {

        const bones = {
            leftUpperArm: HUMANOID_TO_FIGURE_BONE.leftUpperArm,
            rightUpperArm: HUMANOID_TO_FIGURE_BONE.rightUpperArm,
            leftLowerArm: HUMANOID_TO_FIGURE_BONE.leftLowerArm,
            rightLowerArm: HUMANOID_TO_FIGURE_BONE.rightLowerArm,
            leftHand: HUMANOID_TO_FIGURE_BONE.leftHand,
            rightHand: HUMANOID_TO_FIGURE_BONE.rightHand,
            head: HUMANOID_TO_FIGURE_BONE.head,
            ...( options.bones ?? {} )
        };

        super( {
            name: options.name ?? 'idle',
            // Between SWAY and GESTURE on purpose: idle micro-motion is the floor that a real
            // gesture is layered on top of, never a competitor to one.
            order: options.order ?? ( MOTION_ORDER.SWAY + 50 ),
            boneChannels: Object.values( bones )
        } );

        this.bones = bones;
        this.amplitude = options.amplitude ?? 1;
        this.headEnabled = options.headEnabled ?? true;

        // 'auto' until onBind() can see what else is in the stack. Read `armsEnabled` for the
        // resolved answer; this is the request.
        this.requestedArmsEnabled = options.armsEnabled ?? 'auto';
        this.armOwnerLayerName = options.armOwnerLayerName ?? 'bodyIdle';
        this.armsEnabled = this.requestedArmsEnabled !== false;
        this.armOwnershipResolved = false;

        this.elapsedSeconds = 0;

        /**
         * The six arm joints. Each holds its bone name, its noise rate, its two peak angles, and
         * — filled in at bind — its own noise streams and rest frame.
         *
         * Every joint gets its OWN streams. Sharing one would mirror the left arm onto the right,
         * which is the single most recognisable "it's a rig" tell in an idle pose.
         *
         * Do not empty this to silence the arms; that was the integration hack `armsEnabled`
         * exists to replace, and it leaves the layer's declared channels lying about what it
         * drives. The head joint is held separately because it is switched separately.
         */
        this.joints = [
            createJoint( bones.leftUpperArm, SHOULDER_FREQUENCY_HZ, SHOULDER_SWING_DEGREES ),
            createJoint( bones.rightUpperArm, SHOULDER_FREQUENCY_HZ, SHOULDER_SWING_DEGREES ),
            createJoint( bones.leftLowerArm, ELBOW_FREQUENCY_HZ, ELBOW_SWING_DEGREES ),
            createJoint( bones.rightLowerArm, ELBOW_FREQUENCY_HZ, ELBOW_SWING_DEGREES ),
            createJoint( bones.leftHand, WRIST_FREQUENCY_HZ, WRIST_SWING_DEGREES ),
            createJoint( bones.rightHand, WRIST_FREQUENCY_HZ, WRIST_SWING_DEGREES )
        ];

        this.headJoint = createJoint( bones.head, HEAD_FREQUENCY_HZ, HEAD_NOD_DEGREES );

        this.scratchRigRotation = new Quaternion();
        this.scratchAxisRotation = new Quaternion();
        this.scratchBoneDelta = new Quaternion();

    }

    // --- action -----------------------------------------------------------------------------

    onBind( context ) {

        // Deferred to the first frame rather than settled here, because 'auto' has to look at the
        // rest of the stack and `onBind()` runs as each layer is ADDED — so a stack that adds this
        // layer before BodyIdle would resolve it against a stack that does not have one yet.
        this.armOwnershipResolved = false;

        // The streams are drawn whether or not the arms are switched on, so that turning them off
        // does not shift every other joint's seed and change a run this layer is supposed to
        // reproduce. Costs six unused noise tables.
        for ( const joint of this.joints ) this.prepareJoint( joint, context.target, 2 );

        this.prepareJoint( this.headJoint, context.target, 3 );

    }

    update( deltaSeconds, context ) { // eslint-disable-line no-unused-vars

        if ( this.armOwnershipResolved === false ) this.claimArms();

        this.elapsedSeconds += deltaSeconds;

        if ( this.armsEnabled ) {

            for ( const joint of this.joints ) this.writeArmJoint( joint );

        }

        if ( this.headEnabled ) this.writeHead();

        return this.contribution;

    }

    reset() {

        this.elapsedSeconds = 0;

    }

    // --- helpers ------------------------------------------------------------------------------

    /**
     * Who owns the arms.
     *
     * BodyIdle declares the same six arm bones this layer does, and bone contributions SUM — so
     * running both as shipped is not an error the stack can catch, it is a silent doubling of
     * every arm joint that nobody asked for. The intended split is BodyIdle below the neck and
     * this layer on the head, and 'auto' makes that the behaviour you get by default instead of
     * something every consumer has to remember. Say `armsEnabled: true` to take them back.
     */
    claimArms() {

        this.armOwnershipResolved = true;
        this.armsEnabled = this.requestedArmsEnabled === 'auto'
            ? this.stack?.findLayer( this.armOwnerLayerName ) === null
            : this.requestedArmsEnabled === true;

        // Keeps the declared channel list honest about what this layer actually drives. The
        // declaration is not decoration — it is how the stack masks bones and how it names both
        // sides of a channel conflict. A layer that declares the arms and then writes identity
        // into them is a layer whose conflict report says it is fighting BodyIdle when it is not.
        this.declareChannels( {
            boneChannels: this.armsEnabled ? Object.values( this.bones ) : [ this.bones.head ]
        } );

    }

    /**
     * Gives a joint its noise streams and its rest frame. Seeds come from the layer's own random
     * stream, which MotionStack rewinds before it re-runs onBind, so a reset reproduces the run.
     */
    prepareJoint( joint, target, streamCount ) {

        joint.noise = [];

        for ( let index = 0; index < streamCount; index ++ ) {

            joint.noise.push( new CoherentNoise1D( this.random.integer( 0, 0x7fffffff ), 256 ) );

        }

        joint.restFrame = restRotationRelativeToRig( target.getBone( joint.boneName ) );

    }

    /**
     * A hanging arm's idle: a fore-and-aft swing from one stream, a smaller in-and-out swing from
     * another. Both at the joint's own Improv frequency.
     */
    writeArmJoint( joint ) {

        const peak = joint.peakDegrees * DEGREES_TO_RADIANS * this.amplitude;
        const noiseTime = this.elapsedSeconds * joint.frequencyHz;

        this.scratchRigRotation.setFromAxisAngle(
            SAGITTAL_AXIS, peak * joint.noise[ 0 ].at( noiseTime ) );

        this.scratchAxisRotation.setFromAxisAngle(
            FRONTAL_AXIS, peak * SECONDARY_AXIS_FRACTION * joint.noise[ 1 ].at( noiseTime ) );

        this.scratchRigRotation.multiply( this.scratchAxisRotation );

        toBoneDeltaFrame( this.scratchRigRotation, joint.restFrame, this.scratchBoneDelta );

        this.contribution.rotateBone( joint.boneName, this.scratchBoneDelta );

    }

    /** The head's three axes, each on its own stream, so nod/turn/tilt never move together. */
    writeHead() {

        const joint = this.headJoint;
        const noiseTime = this.elapsedSeconds * joint.frequencyHz;
        const scale = DEGREES_TO_RADIANS * this.amplitude;

        this.scratchRigRotation.setFromAxisAngle(
            SAGITTAL_AXIS, HEAD_NOD_DEGREES * scale * joint.noise[ 0 ].at( noiseTime ) );

        this.scratchAxisRotation.setFromAxisAngle(
            VERTICAL_AXIS, HEAD_TURN_DEGREES * scale * joint.noise[ 1 ].at( noiseTime ) );
        this.scratchRigRotation.multiply( this.scratchAxisRotation );

        this.scratchAxisRotation.setFromAxisAngle(
            FRONTAL_AXIS, HEAD_TILT_DEGREES * scale * joint.noise[ 2 ].at( noiseTime ) );
        this.scratchRigRotation.multiply( this.scratchAxisRotation );

        toBoneDeltaFrame( this.scratchRigRotation, joint.restFrame, this.scratchBoneDelta );

        this.contribution.rotateBone( joint.boneName, this.scratchBoneDelta );

    }

}

// --- local helpers ----------------------------------------------------------------------------

function createJoint( boneName, frequencyHz, peakDegrees ) {

    return {
        boneName,
        frequencyHz,
        peakDegrees,
        noise: [],
        restFrame: new Quaternion()
    };

}
